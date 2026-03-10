import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, CheckCircle, Download, FileText, Loader2, Sparkles, Target, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { fetchWithAuth, getErrorMessage, parseResponseBody } from '../../lib/api';

type OptimizeSuggestion = {
  type?: string;
  section?: string;
  before?: string;
  after?: string;
  keyword?: string;
  where?: string;
};

type OptimizeResponse = {
  resume_id: string;
  version: {
    id: string;
    title: string;
    target_role: string;
    job_title: string;
    optimized_text: string;
    ats_score: number;
    created_at: string;
  };
  ats: {
    score: number;
    breakdown: Record<string, number>;
    missing_keywords: string[];
    suggestions: OptimizeSuggestion[];
  };
};

type AtsUsageSummary = {
  used: number;
  limit: number;
};

type ResumeListItem = {
  id: string;
  filename: string;
  file_type: string;
  parse_status: string;
  created_at: string;
};

const formatBreakdownLabel = (value: string) =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatSuggestion = (suggestion: OptimizeSuggestion) => {
  if (suggestion.type === 'bullet_rewrite') {
    const before = suggestion.before ? `"${suggestion.before}"` : 'existing bullet points';
    const after = suggestion.after ? `"${suggestion.after}"` : 'a stronger rewrite';
    const section = suggestion.section ? ` in ${suggestion.section}` : '';
    return `Rewrite ${before}${section} to ${after}.`;
  }
  if (suggestion.type === 'add_keyword') {
    const keyword = suggestion.keyword ?? 'missing keyword';
    const where = suggestion.where ? ` under ${suggestion.where}` : '';
    return `Add "${keyword}"${where}.`;
  }
  return 'Apply this AI recommendation to improve ATS alignment.';
};

export function ResumeOptimization() {
  const storedResumeId = window.localStorage.getItem('resumeai-current-resume-id');
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(storedResumeId);
  const [savedResumes, setSavedResumes] = useState<ResumeListItem[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [jobDescription, setJobDescription] = useState(window.localStorage.getItem('resumeai-last-job-description') ?? '');
  const [jobTitle, setJobTitle] = useState(window.localStorage.getItem('resumeai-last-job-title') ?? '');
  const [targetRole, setTargetRole] = useState(window.localStorage.getItem('resumeai-last-job-title') ?? '');
  const [optimizing, setOptimizing] = useState(false);
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [atsUsage, setAtsUsage] = useState<AtsUsageSummary | null>(null);
  const [downloading, setDownloading] = useState(false);

  const resumeId = selectedResumeId;
  const selectedResume = useMemo(
    () => savedResumes.find((r) => r.id === resumeId) ?? null,
    [savedResumes, resumeId],
  );

  const breakdownEntries = useMemo(() => {
    if (!result?.ats.breakdown) return [];
    return Object.entries(result.ats.breakdown);
  }, [result]);

  const loadAtsUsage = async () => {
    const response = await fetchWithAuth('/me/');
    const data = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(getErrorMessage(data, 'Failed to load ATS usage'));
    }
    const payload = data as {
      subscription?: {
        limits?: { ats?: number };
        usage?: { ats?: number };
      };
    };
    const limit = payload.subscription?.limits?.ats ?? 0;
    const used = payload.subscription?.usage?.ats ?? 0;
    setAtsUsage({ used, limit });
  };

  const loadSavedResumes = async () => {
    setLoadingResumes(true);
    try {
      const response = await fetchWithAuth('/resumes/');
      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Failed to load resumes'));
      }
      const items = (data as { items?: ResumeListItem[] })?.items ?? [];
      setSavedResumes(items);
      const storedId = window.localStorage.getItem('resumeai-current-resume-id');
      if (storedId && items.some((r) => r.id === storedId)) {
        setSelectedResumeId(storedId);
      } else if (items.length > 0) {
        const firstId = items[0].id;
        setSelectedResumeId(firstId);
        window.localStorage.setItem('resumeai-current-resume-id', firstId);
      } else {
        setSelectedResumeId(null);
      }
    } catch {
      setSavedResumes([]);
    } finally {
      setLoadingResumes(false);
    }
  };

  const handleSelectResume = (resumeId: string) => {
    setSelectedResumeId(resumeId || null);
    if (resumeId) {
      window.localStorage.setItem('resumeai-current-resume-id', resumeId);
    } else {
      window.localStorage.removeItem('resumeai-current-resume-id');
    }
  };

  useEffect(() => {
    void loadAtsUsage();
  }, []);

  useEffect(() => {
    void loadSavedResumes();
  }, []);

  const optimizeResume = async () => {
    if (!resumeId) {
      toast.error('Upload a resume first');
      return;
    }
    if (!jobDescription.trim()) {
      toast.error('Job description is required');
      return;
    }

    setOptimizing(true);
    try {
      const response = await fetchWithAuth(`/resumes/${resumeId}/ats-optimize/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_description: jobDescription,
          job_title: jobTitle,
          target_role: targetRole,
        }),
      });

      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Failed to optimize resume'));
      }

      const optimized = data as OptimizeResponse;
      setResult(optimized);
      void loadAtsUsage();
      window.localStorage.setItem('resumeai-last-job-description', jobDescription);
      window.localStorage.setItem('resumeai-last-job-title', jobTitle);
      toast.success('Resume optimization completed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Optimization failed');
    } finally {
      setOptimizing(false);
    }
  };

  const handleDownloadOptimized = async () => {
    if (!result?.version?.id) return;
    setDownloading(true);
    try {
      const response = await fetchWithAuth(`/versions/${result.version.id}/download/`);
      if (!response.ok) {
        const data = await parseResponseBody(response);
        throw new Error(getErrorMessage(data, 'Download failed'));
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="?([^";\n]+)"?/);
      const filename = match?.[1] ?? `optimized-resume-${result.version.target_role || result.version.job_title || 'resume'}.docx`.replace(/\s+/g, '-');
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
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      {optimizing && (
        <div className="fixed inset-0 z-50 bg-background/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-md border-indigo-500/50 bg-gradient-to-br from-indigo-500/15 to-cyan-500/15">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                <div>
                  <p className="font-medium">Optimizing resume with AI...</p>
                  <p className="text-sm text-muted-foreground">Please wait while we generate your optimized version.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">AI Resume Optimization</h1>
          <p className="text-muted-foreground">Optimize your resume against a target job description</p>
        </div>

        {atsUsage && (
          <Card className="mb-6 border-border/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                Monthly ATS usage:{' '}
                <span className="font-medium text-foreground">
                  {atsUsage.used}/{atsUsage.limit}
                </span>
              </p>
            </CardContent>
          </Card>
        )}

        {loadingResumes ? (
          <Card className="mb-6 border-border/50">
            <CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading saved resumes...
            </CardContent>
          </Card>
        ) : savedResumes.length === 0 ? (
          <Card className="mb-6 border-amber-500/40 bg-amber-500/10">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <p className="text-sm text-amber-300">Upload a resume first before running optimization.</p>
              <Link to="/resume">
                <Button size="sm" variant="outline">
                  Go to Resume Upload
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Resume to Optimize
              </CardTitle>
              <CardDescription>Select which saved resume you want to optimize for the target job</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="optimize-resume-select">Choose resume</Label>
              <select
                id="optimize-resume-select"
                value={resumeId ?? ''}
                onChange={(e) => handleSelectResume(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a resume...</option>
                {savedResumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.filename || resume.id} — {resume.parse_status} — {new Date(resume.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
              {selectedResume && (
                <p className="text-sm text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">{selectedResume.filename || selectedResume.id}</span>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Target Job Inputs</CardTitle>
              <CardDescription>These fields are used by the optimization engine</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="target-role">Target Role (Optional)</Label>
                <Textarea
                  id="target-role"
                  placeholder="e.g. Senior Backend Engineer"
                  className="min-h-[60px] mt-2"
                  value={targetRole}
                  onChange={(event) => setTargetRole(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="job-title">Job Title (Optional)</Label>
                <Textarea
                  id="job-title"
                  placeholder="e.g. Backend Engineer"
                  className="min-h-[60px] mt-2"
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="job-description">Job Description</Label>
                <Textarea
                  id="job-description"
                  placeholder="Paste job description here..."
                  className="min-h-[220px] mt-2"
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                />
              </div>
              <Button onClick={optimizeResume} disabled={optimizing || !resumeId || !jobDescription.trim()} className="gap-2">
                {optimizing ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4" />
                    Optimize Resume
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {result && (
            <>
              <Card className="border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-2">Optimization Complete</h3>
                      <p className="text-sm text-muted-foreground mb-4">Your optimized version has been saved.</p>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex-1">
                          <Progress value={result.ats.score} className="h-3" />
                        </div>
                        <span className="text-3xl font-bold text-emerald-400">{result.ats.score}%</span>
                      </div>
                      <Button
                        onClick={handleDownloadOptimized}
                        disabled={downloading}
                        variant="default"
                        className="gap-2"
                      >
                        {downloading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        {downloading ? 'Downloading...' : 'Download Optimized Resume'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>ATS Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {breakdownEntries.map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{formatBreakdownLabel(key)}</span>
                        <span className="text-muted-foreground">{value}%</span>
                      </div>
                      <Progress value={value} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Missing Keywords</CardTitle>
                  <CardDescription>Add these strategically where they are genuinely relevant</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {result.ats.missing_keywords.length > 0 ? (
                    result.ats.missing_keywords.map((kw) => (
                      <Badge key={kw} className="bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {kw}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No major keyword gaps detected.</span>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>AI Suggestions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.ats.suggestions.length > 0 ? (
                    result.ats.suggestions.map((suggestion, index) => (
                      <div key={`${suggestion.type ?? 'suggestion'}-${index}`} className="p-4 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary">{suggestion.type ?? 'suggestion'}</Badge>
                          {suggestion.section && <Badge variant="outline">{suggestion.section}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{formatSuggestion(suggestion)}</p>
                      </div>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No suggestions returned.</span>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Optimized Resume Text</CardTitle>
                  <CardDescription>Saved as a version in your account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-4 max-h-[420px] overflow-auto">
                    <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{result.version.optimized_text}</pre>
                  </div>
                  <Button
                    onClick={handleDownloadOptimized}
                    disabled={downloading}
                    variant="default"
                    className="gap-2"
                  >
                    {downloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {downloading ? 'Downloading...' : 'Download Optimized Resume'}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardContent className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Saved version: {result.version.title} ({result.version.id})
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
