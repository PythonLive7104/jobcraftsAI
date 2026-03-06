import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Calendar, Download, Eye, FileText, FolderOpen, Target } from 'lucide-react';
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

export function ResumeVersions() {
  const [loading, setLoading] = useState(true);
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [activeResumeId, setActiveResumeId] = useState(window.localStorage.getItem('resumeai-current-resume-id') ?? '');
  const [versions, setVersions] = useState<ResumeVersionItem[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ResumeVersionItem | null>(null);

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

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="text-2xl font-bold mb-1">{resumes.length}</div>
              <div className="text-sm text-muted-foreground">Saved Resumes</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="text-2xl font-bold mb-1">{versions.length}</div>
              <div className="text-sm text-muted-foreground">Total Versions</div>
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
                          <Download className="w-4 h-4" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedVersion && (
          <Card className="border-indigo-500/50 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 mt-6">
            <CardHeader>
              <CardTitle>{selectedVersion.title}</CardTitle>
              <CardDescription>Preview of optimized resume text</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 max-h-[420px] overflow-auto">
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{selectedVersion.optimized_text}</pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
