import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, Loader2, Sparkles, Target, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { fetchWithAuth, getErrorMessage, parseResponseBody, pollTaskUntilComplete } from '../../lib/api';

type JobAnalysisResponse = {
  id: string;
  job_title: string;
  job_description: string;
  keywords: { all?: string[] };
  match: {
    present?: string[];
    missing?: string[];
    coverage_percent?: number;
  };
};

export function JobAnalysis() {
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<JobAnalysisResponse | null>(null);

  const resumeId = window.localStorage.getItem('resumeai-current-resume-id');

  const requiredSkills = useMemo(() => {
    if (!analysis) return [];
    const all = analysis.keywords.all ?? [];
    const presentSet = new Set(analysis.match.present ?? []);
    return all.map((skill, index) => ({
      skill,
      importance: index < 6 ? 'high' : index < 14 ? 'medium' : 'low',
      inResume: presentSet.has(skill),
    }));
  }, [analysis]);

  const handleAnalyze = async () => {
    if (!resumeId) {
      toast.error('Upload a resume first');
      return;
    }

    setAnalyzing(true);
    try {
      const response = await fetchWithAuth(`/resumes/${resumeId}/job-analysis/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_description: jobDescription,
          job_title: jobTitle,
        }),
      });

      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Failed to analyze job description'));
      }

      const { task_id } = data as { task_id: string };
      const result = await pollTaskUntilComplete<JobAnalysisResponse>(task_id);
      setAnalysis(result);
      window.localStorage.setItem('resumeai-last-job-description', jobDescription);
      window.localStorage.setItem('resumeai-last-job-title', jobTitle);
      toast.success('Job analysis completed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      {analyzing && (
        <div className="fixed inset-0 z-50 bg-background/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-md border-indigo-500/50 bg-gradient-to-br from-indigo-500/15 to-cyan-500/15">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                <div>
                  <p className="font-medium">Analyzing job description with AI...</p>
                  <p className="text-sm text-muted-foreground">Please wait. This can take a few seconds.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Job Description Analysis</h1>
          <p className="text-muted-foreground">Paste a job description to extract key requirements</p>
        </div>

        {!resumeId && (
          <Card className="mb-6 border-amber-500/40 bg-amber-500/10">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <p className="text-sm text-amber-300">Upload a resume first before running job analysis.</p>
              <Link to="/resume">
                <Button size="sm" variant="outline">Go to Resume Upload</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Enter Job Description</CardTitle>
              <CardDescription>Copy and paste the full job posting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="job-title">Job Title (Optional)</Label>
                <Textarea
                  id="job-title"
                  placeholder="e.g. Senior Backend Engineer"
                  className="min-h-[60px] mt-2"
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="job-desc">Job Description</Label>
                <Textarea
                  id="job-desc"
                  placeholder="Paste job description here..."
                  className="min-h-[220px] mt-2"
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                />
              </div>
              <Button onClick={handleAnalyze} disabled={!jobDescription || analyzing || !resumeId} className="gap-2">
                {analyzing ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4" />
                    Analyze Job
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {analysis && (
            <>
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Match Overview</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-3">
                  <Badge className="text-base px-4 py-2">
                    Coverage: {analysis.match.coverage_percent ?? 0}%
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Present: {(analysis.match.present ?? []).length} • Missing: {(analysis.match.missing ?? []).length}
                  </span>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Required Keywords</CardTitle>
                  <CardDescription>Extracted from the job description and matched against your resume</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {requiredSkills.map((item, index) => (
                      <div key={`${item.skill}-${index}`} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{item.skill}</span>
                          <Badge variant={item.importance === 'high' ? 'default' : item.importance === 'medium' ? 'secondary' : 'outline'}>
                            {item.importance}
                          </Badge>
                        </div>
                        {item.inResume ? (
                          <span className="text-sm text-emerald-400 flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            In your resume
                          </span>
                        ) : (
                          <span className="text-sm text-amber-400 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            Missing
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-indigo-500/50 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">Next Steps</h3>
                  <p className="text-sm text-muted-foreground mb-4">Ready to optimize your resume for this job?</p>
                  <Link to="/optimize">
                    <Button className="gap-2">
                      <Sparkles className="w-4 h-4" />
                      Optimize Resume
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
