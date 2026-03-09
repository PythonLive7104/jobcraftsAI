import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Loader2, Plus, Trash2, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithAuth, getErrorMessage, parseResponseBody } from '../../lib/api';

type ExperienceItem = { job_role: string; achievements: string[] };
type ProjectItem = { description: string; link: string };
type ResumeItem = { id: string; filename: string };

export function Portfolio() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    title: '',
    location: '',
    short_summary: '',
    experience: [] as ExperienceItem[],
    projects: [] as ProjectItem[],
    skills: [] as string[],
    resume: '' as string | null,
    email: '',
    linkedin_url: '',
    github_url: '',
  });

  const [proRequired, setProRequired] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [portfolioRes, resumesRes, summaryRes] = await Promise.all([
          fetchWithAuth('/portfolio/'),
          fetchWithAuth('/resumes/'),
          fetchWithAuth('/dashboard/summary/'),
        ]);
        const portfolioData = await parseResponseBody(portfolioRes);
        const resumesData = await parseResponseBody(resumesRes);
        const summaryData = await parseResponseBody(summaryRes);

        if (portfolioRes.status === 403) {
          setProRequired(true);
          setLoading(false);
          return;
        }
        if (summaryRes.ok && summaryData && typeof summaryData === 'object') {
          const s = summaryData as { plan?: { is_pro?: boolean } };
          if (!s.plan?.is_pro) {
            setProRequired(true);
            setLoading(false);
            return;
          }
        }

        if (resumesRes.ok && Array.isArray((resumesData as { items?: ResumeItem[] }).items)) {
          setResumes((resumesData as { items: ResumeItem[] }).items);
        }

        if (portfolioRes.ok && portfolioData && typeof portfolioData === 'object') {
          const p = portfolioData as {
            name?: string;
            title?: string;
            location?: string;
            short_summary?: string;
            experience?: ExperienceItem[];
            projects?: ProjectItem[];
            skills?: string[];
            resume?: string;
            email?: string;
            linkedin_url?: string;
            github_url?: string;
            share_url?: string;
          };
          setForm({
            name: p.name ?? '',
            title: p.title ?? '',
            location: p.location ?? '',
            short_summary: p.short_summary ?? '',
            experience: Array.isArray(p.experience) ? p.experience : [],
            projects: Array.isArray(p.projects) ? p.projects : [],
            skills: Array.isArray(p.skills) ? p.skills : [],
            resume: p.resume ?? null,
            email: p.email ?? '',
            linkedin_url: p.linkedin_url ?? '',
            github_url: p.github_url ?? '',
          });
          setShareUrl(p.share_url ?? null);
        }
      } catch {
        toast.error('Failed to load portfolio');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        title: form.title,
        location: form.location,
        short_summary: form.short_summary,
        experience: form.experience,
        projects: form.projects,
        skills: form.skills,
        resume: form.resume || null,
        email: form.email,
        linkedin_url: form.linkedin_url,
        github_url: form.github_url,
      };
      const response = await fetchWithAuth('/portfolio/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Failed to save portfolio'));
      }
      const d = data as { share_url?: string };
      setShareUrl(d.share_url ?? null);
      toast.success('Portfolio saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addExperience = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setForm((f) => ({ ...f, experience: [...f.experience, { job_role: '', achievements: [''] }] }));
  };
  const removeExperience = (i: number) =>
    setForm((f) => ({ ...f, experience: f.experience.filter((_, j) => j !== i) }));
  const updateExperience = (i: number, field: 'job_role' | 'achievements', value: string | string[]) =>
    setForm((f) => ({
      ...f,
      experience: f.experience.map((e, j) =>
        j === i ? { ...e, [field]: value } : e
      ),
    }));

  const addProject = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setForm((f) => ({ ...f, projects: [...f.projects, { description: '', link: '' }] }));
  };
  const removeProject = (i: number) =>
    setForm((f) => ({ ...f, projects: f.projects.filter((_, j) => j !== i) }));
  const updateProject = (i: number, field: 'description' | 'link', value: string) =>
    setForm((f) => ({
      ...f,
      projects: f.projects.map((p, j) => (j === i ? { ...p, [field]: value } : p)),
    }));

  const [newSkill, setNewSkill] = useState('');
  const skillsStr = form.skills.join(', ');
  const setSkillsStr = (s: string) =>
    setForm((f) => ({ ...f, skills: s.split(',').map((x) => x.trim()).filter(Boolean) }));
  const addSkill = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const toAdd = newSkill.trim();
    if (toAdd) {
      setForm((f) => ({ ...f, skills: [...f.skills, toAdd] }));
      setNewSkill('');
    }
  };

  const copyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (proRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Pro Feature</CardTitle>
            <CardDescription>
              Portfolio is available for Pro subscribers. Upgrade to create your shareable portfolio page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/pricing">
              <Button>Upgrade to Pro</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Portfolio</h1>
          <p className="text-muted-foreground">
            Create a shareable portfolio page to send to recruiters. Pro feature.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Info</CardTitle>
              <CardDescription>Your name, title, and location</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Software Engineer"
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="San Francisco, CA"
                />
              </div>
              <div>
                <Label htmlFor="summary">Short Summary</Label>
                <Textarea
                  id="summary"
                  value={form.short_summary}
                  onChange={(e) => setForm((f) => ({ ...f, short_summary: e.target.value }))}
                  rows={4}
                  placeholder="Brief professional summary..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Experience */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Experience</CardTitle>
                  <CardDescription>Job roles and achievements</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={(e) => addExperience(e)}>
                  <Plus className="w-4 h-4 mr-1" /> Add Experience
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.experience.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  No experience added yet. Click &quot;Add Experience&quot; to add your first entry.
                </p>
              )}
              {form.experience.map((exp, i) => (
                <div key={`exp-${i}-${exp.job_role?.slice(0, 10) || 'new'}`} className="p-4 border rounded-lg space-y-3">
                  <div className="flex gap-2">
                    <Input
                      className="flex-1 min-w-0"
                      placeholder="Job role"
                      value={exp.job_role}
                      onChange={(e) => updateExperience(i, 'job_role', e.target.value)}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeExperience(i)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs">Achievements (one per line)</Label>
                    <Textarea
                      value={exp.achievements.join('\n')}
                      onChange={(e) =>
                        updateExperience(
                          i,
                          'achievements',
                          e.target.value.split('\n')
                        )
                      }
                      rows={3}
                      placeholder="• Achievement 1&#10;• Achievement 2"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Projects */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Projects</CardTitle>
                  <CardDescription>Project descriptions and links</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={(e) => addProject(e)}>
                  <Plus className="w-4 h-4 mr-1" /> Add Project
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.projects.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  No projects added yet. Click &quot;Add Project&quot; to add your first entry.
                </p>
              )}
              {form.projects.map((proj, i) => (
                <div key={`proj-${i}-${proj.link?.slice(0, 10) || 'new'}`} className="p-4 border rounded-lg space-y-3">
                  <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeProject(i)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Project link (URL)"
                    value={proj.link}
                    onChange={(e) => updateProject(i, 'link', e.target.value)}
                  />
                  <Textarea
                    placeholder="Project description"
                    value={proj.description}
                    onChange={(e) => updateProject(i, 'description', e.target.value)}
                    rows={2}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Skills */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Skills</CardTitle>
                  <CardDescription>Add skills one at a time or as comma-separated list</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSkill(e)}
                  placeholder="Type a skill and press Enter or click Add"
                />
                <Button type="button" variant="outline" size="sm" onClick={addSkill}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
              <Input
                value={skillsStr}
                onChange={(e) => setSkillsStr(e.target.value)}
                placeholder="Or paste comma-separated: Python, React, AWS..."
              />
              {form.skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.skills.map((skill, i) => (
                    <span
                      key={`${skill}-${i}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-sm"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, skills: f.skills.filter((_, j) => j !== i) }))
                        }
                        className="hover:text-destructive"
                        aria-label={`Remove ${skill}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resume & Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Resume & Contact</CardTitle>
              <CardDescription>Attach a resume and contact links</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Resume (PDF for download)</Label>
                <Select
                  value={form.resume || 'none'}
                  onValueChange={(v) => setForm((f) => ({ ...f, resume: v === 'none' ? null : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a resume" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No resume</SelectItem>
                    {resumes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.filename}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <Label htmlFor="linkedin">LinkedIn URL</Label>
                <Input
                  id="linkedin"
                  value={form.linkedin_url}
                  onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
              <div>
                <Label htmlFor="github">GitHub URL</Label>
                <Input
                  id="github"
                  value={form.github_url}
                  onChange={(e) => setForm((f) => ({ ...f, github_url: e.target.value }))}
                  placeholder="https://github.com/username"
                />
              </div>
            </CardContent>
          </Card>

          {/* Share URL */}
          {shareUrl && (
            <Card className="border-emerald-500/30">
              <CardContent className="pt-6">
                <Label>Your shareable link</Label>
                <div className="flex gap-2 mt-2">
                  <Input value={shareUrl} readOnly className="font-mono text-sm" />
                  <Button type="button" variant="outline" onClick={copyLink}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                    <Button type="button" variant="outline">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-4">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Portfolio
            </Button>
            <Link to="/dashboard">
              <Button type="button" variant="outline">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
