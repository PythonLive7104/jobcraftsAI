import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Calendar, Copy, Download, Eye, FileText, FolderOpen, Linkedin, Loader2, Target } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { fetchWithAuth, getErrorMessage, parseResponseBody } from '../../lib/api';

type ResumeItem = {
  id: string;
  filename: string;
  file_type: string;
  parse_status: string;
  created_at: string;
};

type ResumeVersionItem = {
  id: string;
  title: string;
  target_role: string;
  job_title: string;
  optimized_text: string;
  ats_score: number;
  created_at: string;
};

type LinkedInOptimizationItem = {
  id: string;
  target_role: string;
  headlines: string[];
  about_versions: string[];
  experience_rewrites: { before: string; after: string }[];
  recommended_skills: string[];
  created_at: string;
};

export function ResumeVersions() {
  const [loading, setLoading] = useState(true);
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [activeResumeId, setActiveResumeId] = useState(window.localStorage.getItem('resumeai-current-resume-id') ?? '');
  const [versions, setVersions] = useState<ResumeVersionItem[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ResumeVersionItem | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [linkedinOptimizations, setLinkedinOptimizations] = useState<LinkedInOptimizationItem[]>([]);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [selectedLinkedin, setSelectedLinkedin] = useState<LinkedInOptimizationItem | null>(null);

  const activeResume = useMemo(
    () => resumes.find((resume) => resume.id === activeResumeId) ?? null,
    [resumes, activeResumeId],
  );

  const avgAts = useMemo(() => {
    if (!versions.length) return 0;
    const sum = versions.reduce((acc, version) => acc + version.ats_score, 0);
    return Math.round(sum / versions.length);
  }, [versions]);

  useEffect(() => {
    const loadResumes = async () => {
      setLoading(true);
      try {
        const response = await fetchWithAuth('/resumes/');
        const data = await parseResponseBody(response);
        if (!response.ok) {
          throw new Error(getErrorMessage(data, 'Failed to load resumes'));
        }

        const payload = data as { items?: ResumeItem[] };
        const items = payload.items ?? [];
        setResumes(items);

        if (!activeResumeId && items[0]?.id) {
          setActiveResumeId(items[0].id);
          window.localStorage.setItem('resumeai-current-resume-id', items[0].id);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load resumes');
      } finally {
        setLoading(false);
      }
    };

    void loadResumes();
  }, []);

  useEffect(() => {
    const loadVersions = async () => {
      if (!activeResumeId) {
        setVersions([]);
        return;
      }

      try {
        const response = await fetchWithAuth(`/resumes/${activeResumeId}/versions/`);
        const data = await parseResponseBody(response);
        if (!response.ok) {
          throw new Error(getErrorMessage(data, 'Failed to load resume versions'));
        }

        const payload = data as { versions?: ResumeVersionItem[] };
        setVersions(payload.versions ?? []);
        setSelectedVersion(null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load resume versions');
      }
    };

    void loadVersions();
  }, [activeResumeId]);

  useEffect(() => {
    const loadLinkedin = async () => {
      setLinkedinLoading(true);
      try {
        const response = await fetchWithAuth('/linkedin/history/');
        const data = await parseResponseBody(response);
        if (!response.ok) {
          toast.error(getErrorMessage(data, 'Failed to load LinkedIn optimizations'));
          setLinkedinOptimizations([]);
          return;
        }
        const payload = data as { items?: LinkedInOptimizationItem[] };
        setLinkedinOptimizations(payload.items ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load LinkedIn optimizations');
        setLinkedinOptimizations([]);
      } finally {
        setLinkedinLoading(false);
      }
    };
    void loadLinkedin();
  }, []);

  const handleDownloadVersion = async (version: ResumeVersionItem) => {
    setDownloadingId(version.id);
    try {
      const response = await fetchWithAuth(`/versions/${version.id}/download/`);
      if (!response.ok) {
        const data = await parseResponseBody(response);
        throw new Error(getErrorMessage(data, 'Download failed'));
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="?([^";\n]+)"?/);
      const filename = match?.[1] ?? `optimized-resume-${version.target_role || version.job_title || 'resume'}.docx`.replace(/\s+/g, '-');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Resume downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Resume Versions</h1>
            <p className="text-muted-foreground">View uploaded resumes and optimized versions</p>
          </div>
          <Link to="/optimize">
            <Button>Create New Version</Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="text-2xl font-bold mb-1">{resumes.length}</div>
              <div className="text-sm text-muted-foreground">Saved Resumes</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="text-2xl font-bold mb-1">{versions.length}</div>
              <div className="text-sm text-muted-foreground">ATS Versions</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="text-2xl font-bold mb-1">{linkedinOptimizations.length}</div>
              <div className="text-sm text-muted-foreground">LinkedIn</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="text-2xl font-bold mb-1 text-emerald-400">{avgAts}%</div>
              <div className="text-sm text-muted-foreground">Avg ATS Score</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50 mb-6">
          <CardHeader>
            <CardTitle>Uploaded Resumes</CardTitle>
            <CardDescription>Select which resume to view versions for</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <span className="text-sm text-muted-foreground">Loading resumes...</span>
            ) : resumes.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No resumes saved yet.{' '}
                <Link to="/resume" className="text-indigo-400 hover:text-indigo-300">
                  Upload your first resume
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-2">
                {resumes.map((resume) => (
                  <button
                    key={resume.id}
                    type="button"
                    onClick={() => {
                      setActiveResumeId(resume.id);
                      window.localStorage.setItem('resumeai-current-resume-id', resume.id);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      activeResumeId === resume.id ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-border/50 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        <span className="truncate text-sm">{resume.filename || `Resume ${resume.id}`}</span>
                      </div>
                      <Badge variant={resume.parse_status === 'done' ? 'default' : 'secondary'}>{resume.parse_status}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Versions for Selected Resume</CardTitle>
            <CardDescription>{activeResume ? activeResume.filename : 'No resume selected'}</CardDescription>
          </CardHeader>
          <CardContent>
            {!activeResumeId ? (
              <span className="text-sm text-muted-foreground">Select a resume first.</span>
            ) : versions.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No optimized versions yet.{' '}
                <Link to="/optimize" className="text-indigo-400 hover:text-indigo-300">
                  Create one now
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((version) => (
                  <div key={version.id} className="p-4 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 flex items-center justify-center flex-shrink-0">
                          <FolderOpen className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium mb-1">{version.title}</h4>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-2">
                            <span className="flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              {version.target_role || version.job_title || 'General Target'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(version.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-emerald-500/10 text-emerald-400">ATS: {version.ats_score}%</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectedVersion(version)}>
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => {
                            void navigator.clipboard.writeText(version.optimized_text);
                            toast.success('Optimized text copied to clipboard');
                          }}
                        >
                          <Copy className="w-4 h-4" />
                          Copy
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-2"
                          onClick={() => void handleDownloadVersion(version)}
                          disabled={downloadingId === version.id}
                        >
                          {downloadingId === version.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* LinkedIn Optimizations */}
        <Card className="border-border/50 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Linkedin className="w-5 h-5 text-blue-500" />
              LinkedIn Optimizations
            </CardTitle>
            <CardDescription>Your LinkedIn profile optimizations</CardDescription>
          </CardHeader>
          <CardContent>
            {linkedinLoading ? (
              <span className="text-sm text-muted-foreground">Loading LinkedIn optimizations...</span>
            ) : linkedinOptimizations.length === 0 ? (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  No LinkedIn optimizations yet.{' '}
                  <Link to="/linkedin" className="text-indigo-400 hover:text-indigo-300">
                    Optimize your LinkedIn profile
                  </Link>
                  .
                </p>
                <p className="text-xs">
                  Only optimizations run after this feature was added are stored. Run a new optimization to see it here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {linkedinOptimizations.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center flex-shrink-0">
                          <Linkedin className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium mb-1">{item.target_role}</h4>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(item.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline">{item.headlines?.length ?? 0} headlines</Badge>
                            <Badge variant="outline">{item.about_versions?.length ?? 0} about versions</Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setSelectedLinkedin(selectedLinkedin?.id === item.id ? null : item)}
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedLinkedin && (
          <Card className="border-blue-500/50 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 mt-6">
            <CardHeader>
              <CardTitle>{selectedLinkedin.target_role}</CardTitle>
              <CardDescription>LinkedIn optimization preview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedLinkedin.headlines?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Headlines</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {selectedLinkedin.headlines.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedLinkedin.about_versions?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">About</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {selectedLinkedin.about_versions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedLinkedin.experience_rewrites?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Experience Rewrites</h4>
                  <div className="space-y-2 text-sm">
                    {selectedLinkedin.experience_rewrites.map((r, i) => (
                      <div key={i} className="p-3 rounded border border-border/50">
                        <p className="text-muted-foreground line-through">{r.before}</p>
                        <p className="text-foreground mt-1">{r.after}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedLinkedin.recommended_skills?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Recommended Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedLinkedin.recommended_skills.map((s, i) => (
                      <Badge key={i} variant="secondary">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {selectedVersion && (
          <Card className="border-indigo-500/50 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 mt-6">
            <CardHeader>
              <CardTitle>{selectedVersion.title}</CardTitle>
              <CardDescription>Preview of optimized resume text</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 max-h-[420px] overflow-auto">
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{selectedVersion.optimized_text}</pre>
              </div>
              <Button
                variant="default"
                className="gap-2"
                onClick={() => void handleDownloadVersion(selectedVersion)}
                disabled={downloadingId === selectedVersion.id}
              >
                {downloadingId === selectedVersion.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download Optimized Resume
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
