import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { TrendingUp, BookOpen, Award, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { fetchWithAuth, getErrorMessage, parseResponseBody, pollTaskUntilComplete } from '../../lib/api';

type CareerGapResult = {
  gap_assessment?: {
    risk_level?: 'low' | 'medium' | 'high';
    summary?: string;
    key_concerns?: string[];
  };
  resume_entry?: {
    title?: string;
    dates?: string;
    bullets?: string[];
  };
  linkedin_entry?: string;
  interview_answers?: {
    short?: string;
    medium?: string;
    long?: string;
  };
  skill_gaps?: Array<{
    skill: string;
    current_level: number;
    target_level: number;
    priority: 'critical' | 'important' | 'good';
    recommendation?: string;
  }>;
  certifications?: Array<{
    name: string;
    provider: string;
    relevance: 'critical' | 'high' | 'medium';
    estimated_time: string;
  }>;
  learning_roadmap?: Array<{
    phase: string;
    duration: string;
    focus_areas: string[];
    resources: string[];
  }>;
  action_plan?: string[];
};

type CareerGapHistoryItem = {
  id: string;
  target_role: string;
  gap_reason: string;
  gap_start: string;
  gap_end: string;
  what_you_did: string;
  result: CareerGapResult;
  created_at: string;
};

type CareerGapResponse = CareerGapResult & {
  analysis?: CareerGapHistoryItem;
  usage?: {
    used: number;
    limit: number;
  };
};

type CareerGapHistoryResponse = {
  count: number;
  items: CareerGapHistoryItem[];
};

export function CareerGap() {
  const [targetRole, setTargetRole] = useState('');
  const [gapReason, setGapReason] = useState('');
  const [gapStart, setGapStart] = useState('');
  const [gapEnd, setGapEnd] = useState('');
  const [whatYouDid, setWhatYouDid] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<CareerGapResult | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [history, setHistory] = useState<CareerGapHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>('');
  const [deletingHistory, setDeletingHistory] = useState(false);

  const remainingCredits = useMemo(() => {
    if (!usage) return null;
    return `${Math.max(usage.limit - usage.used, 0)} remaining`;
  }, [usage]);
  const isLimitReached = Boolean(usage && usage.used >= usage.limit);

  const applyHistoryItem = (item: CareerGapHistoryItem) => {
    setTargetRole(item.target_role);
    setGapReason(item.gap_reason);
    setGapStart(item.gap_start);
    setGapEnd(item.gap_end);
    setWhatYouDid(item.what_you_did || '');
    setResult(item.result);
    setSelectedHistoryId(item.id);
  };

  useEffect(() => {
    const loadPageData = async () => {
      try {
        const [meResponse, historyResponse] = await Promise.all([
          fetchWithAuth('/me/'),
          fetchWithAuth('/career-gap/history/'),
        ]);

        const meData = await parseResponseBody(meResponse);
        const mePayload = meData as { subscription?: { usage?: { career_gap?: number }; limits?: { career_gap?: number } } };
        const used = mePayload.subscription?.usage?.career_gap;
        const limit = mePayload.subscription?.limits?.career_gap;
        if (typeof used === 'number' && typeof limit === 'number') {
          setUsage({ used, limit });
        }

        const historyData = await parseResponseBody(historyResponse);
        if (historyResponse.ok) {
          const payload = historyData as CareerGapHistoryResponse;
          const items = Array.isArray(payload.items) ? payload.items : [];
          setHistory(items);
          if (items.length > 0) {
            applyHistoryItem(items[0]);
          }
        }
      } catch {
        // non-blocking
      }
    };
    void loadPageData();
  }, []);

  const handleAnalyze = async () => {
    if (!targetRole.trim() || !gapReason.trim() || !gapStart.trim() || !gapEnd.trim()) {
      toast.error('Target role, gap reason, gap start, and gap end are required');
      return;
    }
    setAnalyzing(true);
    try {
      const response = await fetchWithAuth('/career-gap/analyze/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_role: targetRole,
          gap_reason: gapReason,
          gap_start: gapStart,
          gap_end: gapEnd,
          what_you_did: whatYouDid,
        }),
      });
      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Failed to analyze career gap'));
      }
      const { task_id } = data as { task_id: string };
      const payload = await pollTaskUntilComplete<CareerGapResponse>(task_id);
      setResult(payload);
      if (payload?.usage) setUsage(payload.usage);
      if (payload.analysis) {
        setHistory((prev) => [payload.analysis as CareerGapHistoryItem, ...prev.filter((entry) => entry.id !== payload.analysis?.id)]);
        setSelectedHistoryId(payload.analysis.id);
      }
      toast.success('Career gap analysis generated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedHistoryId) {
      toast.error('Select an analysis to delete');
      return;
    }

    const selected = history.find((item) => item.id === selectedHistoryId);
    if (!selected) {
      toast.error('Selected analysis not found');
      return;
    }

    const confirmed = window.confirm(`Delete saved analysis for "${selected.target_role}"?`);
    if (!confirmed) return;

    setDeletingHistory(true);
    try {
      const response = await fetchWithAuth(`/career-gap/history/${selectedHistoryId}/`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await parseResponseBody(response);
        throw new Error(getErrorMessage(data, 'Failed to delete saved analysis'));
      }

      const nextHistory = history.filter((item) => item.id !== selectedHistoryId);
      setHistory(nextHistory);

      if (nextHistory.length > 0) {
        applyHistoryItem(nextHistory[0]);
      } else {
        setSelectedHistoryId('');
        setResult(null);
      }

      toast.success('Saved analysis deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setDeletingHistory(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {analyzing && (
        <div className="fixed inset-0 z-50 bg-background/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-md border-indigo-500/50 bg-gradient-to-br from-indigo-500/15 to-cyan-500/15">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                <div>
                  <p className="font-medium">Analyzing career gap with AI...</p>
                  <p className="text-sm text-muted-foreground">Please wait. This can take a few seconds.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Career Gap Analysis</h1>
          <p className="text-muted-foreground">Identify skill gaps and get a personalized learning roadmap</p>
        </div>

        <div className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Analysis Inputs</CardTitle>
              <CardDescription>Provide details to generate a detailed comeback plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {usage && (
                <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Career gap credits: <span className="font-medium">{usage.used}/{usage.limit}</span>
                  {' • '}
                  <span className="font-medium">{remainingCredits}</span>
                </div>
              )}
              {isLimitReached && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 flex items-center justify-between gap-3">
                  <span>You have reached your monthly career gap limit.</span>
                  <Link to="/pricing">
                    <Button size="sm" variant="outline">Upgrade Plan</Button>
                  </Link>
                </div>
              )}
              {history.length > 0 && (
                <div>
                  <Label htmlFor="saved-analyses">Saved Analyses</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedHistoryId}
                      onValueChange={(value) => {
                        const selected = history.find((item) => item.id === value);
                        if (selected) applyHistoryItem(selected);
                      }}
                    >
                      <SelectTrigger id="saved-analyses">
                        <SelectValue placeholder="Choose a previous career gap analysis" />
                      </SelectTrigger>
                      <SelectContent>
                        {history.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.target_role} - {new Date(item.created_at).toLocaleDateString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!selectedHistoryId || deletingHistory}
                      onClick={handleDeleteSelected}
                      aria-label="Delete selected analysis"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="target-role">Target Role</Label>
                <Input id="target-role" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Senior Software Engineer at FAANG" />
              </div>
              <div>
                <Label htmlFor="gap-reason">Gap Reason</Label>
                <Input id="gap-reason" value={gapReason} onChange={(e) => setGapReason(e.target.value)} placeholder="e.g. Caregiving, layoff, relocation, health" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="gap-start">Gap Start</Label>
                  <Input id="gap-start" value={gapStart} onChange={(e) => setGapStart(e.target.value)} placeholder="e.g. Jan 2024" />
                </div>
                <div>
                  <Label htmlFor="gap-end">Gap End</Label>
                  <Input id="gap-end" value={gapEnd} onChange={(e) => setGapEnd(e.target.value)} placeholder="e.g. Nov 2024" />
                </div>
              </div>
              <div>
                <Label htmlFor="what-you-did">What You Did During the Gap (Optional)</Label>
                <Textarea
                  id="what-you-did"
                  value={whatYouDid}
                  onChange={(e) => setWhatYouDid(e.target.value)}
                  placeholder="Courses, projects, volunteering, freelancing, certifications..."
                  className="min-h-[140px]"
                />
              </div>
              <Button onClick={handleAnalyze} disabled={analyzing || isLimitReached} className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Analyze Career Gap
              </Button>
            </CardContent>
          </Card>

          {result && (
            <>
          {/* Target Role */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Target Role</CardTitle>
              <CardDescription>{targetRole}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(result.skill_gaps ?? []).map((skill, index) => {
                  const gap = Number(skill.target_level) - Number(skill.current_level);
                  
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{skill.skill}</span>
                          <Badge variant={
                            skill.priority === 'critical' ? 'destructive' :
                            skill.priority === 'important' ? 'default' :
                            'secondary'
                          }>
                            {skill.priority === 'critical' ? 'Priority' : skill.priority === 'important' ? 'Important' : 'Good'}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {skill.current_level}% / {skill.target_level}%
                        </span>
                      </div>
                      <div className="relative">
                        <Progress value={Number(skill.current_level)} className="h-2" />
                        <div 
                          className="absolute top-0 h-2 bg-emerald-500/20 rounded-full"
                          style={{ 
                            left: `${skill.current_level}%`, 
                            width: `${Math.max(skill.target_level - skill.current_level, 0)}%` 
                          }}
                        />
                      </div>
                      {gap > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Need to improve by {gap} points
                        </p>
                      )}
                      {skill.recommendation && (
                        <p className="text-xs text-muted-foreground">{skill.recommendation}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recommended Certifications */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Recommended Certifications
              </CardTitle>
              <CardDescription>Industry-recognized credentials to boost your profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(result.certifications ?? []).map((cert, index) => (
                  <div key={index} className="p-4 rounded-lg bg-muted/30 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{cert.name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{cert.provider}</p>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={cert.relevance === 'critical' ? 'destructive' : cert.relevance === 'high' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {cert.relevance} priority
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ~{cert.estimated_time} study time
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Learning Roadmap */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                Personalized Learning Roadmap
              </CardTitle>
              <CardDescription>Detailed phase-by-phase plan to reach your target role</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {(result.learning_roadmap ?? []).map((phase, index) => (
                  <div key={index} className="relative">
                    {index < (result.learning_roadmap?.length ?? 0) - 1 && (
                      <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500 to-cyan-500" />
                    )}
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center flex-shrink-0 relative z-10">
                        <span className="font-bold text-white">{index + 1}</span>
                      </div>
                      <div className="flex-1 pb-8">
                        <h4 className="font-semibold mb-1">{phase.phase}</h4>
                        <p className="text-xs text-muted-foreground mb-2">Duration: {phase.duration}</p>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Focus Areas:</p>
                            <div className="flex flex-wrap gap-2">
                              {(phase.focus_areas ?? []).map((skill: string, sIndex: number) => (
                                <span key={sIndex} className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Recommended Resources:</p>
                            <ul className="space-y-1">
                              {(phase.resources ?? []).map((resource: string, rIndex: number) => (
                                <li key={rIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <span className="text-indigo-400">•</span>
                                  {resource}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>How To Explain The Gap</CardTitle>
              <CardDescription>Use these in resume, LinkedIn, and interviews</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground mb-2">Resume Entry</p>
                <p className="font-medium">{result.resume_entry?.title}</p>
                <p className="text-sm text-muted-foreground mb-2">{result.resume_entry?.dates}</p>
                <ul className="space-y-1">
                  {(result.resume_entry?.bullets ?? []).map((bullet: string, idx: number) => (
                    <li key={idx} className="text-sm text-muted-foreground">• {bullet}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground mb-2">LinkedIn Entry</p>
                <p className="text-sm text-muted-foreground">{result.linkedin_entry}</p>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground mb-2">Short Answer</p>
                  <p className="text-sm text-muted-foreground">{result.interview_answers?.short}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground mb-2">Medium Answer</p>
                  <p className="text-sm text-muted-foreground">{result.interview_answers?.medium}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground mb-2">Long Answer</p>
                  <p className="text-sm text-muted-foreground">{result.interview_answers?.long}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action CTA */}
          <Card className="border-indigo-500/50 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Ready to Bridge the Gap?</h3>
                  {result.gap_assessment?.risk_level && (
                    <Badge variant={result.gap_assessment.risk_level === 'high' ? 'destructive' : result.gap_assessment.risk_level === 'medium' ? 'default' : 'secondary'} className="mb-3">
                      Risk level: {result.gap_assessment.risk_level}
                    </Badge>
                  )}
                  <p className="text-sm text-muted-foreground mb-4">
                    {result.gap_assessment?.summary || 'Follow this personalized roadmap and track your progress.'}
                  </p>
                  {(result.gap_assessment?.key_concerns?.length ?? 0) > 0 && (
                    <div className="mb-4">
                      {(result.gap_assessment.key_concerns ?? []).map((concern: string, idx: number) => (
                        <p key={idx} className="text-sm text-muted-foreground">• {concern}</p>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    {(result.action_plan ?? []).map((step: string, idx: number) => (
                      <p key={idx} className="text-sm text-muted-foreground">• {step}</p>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
