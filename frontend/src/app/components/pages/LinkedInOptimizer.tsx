import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Linkedin, Sparkles, Copy, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { fetchWithAuth, getErrorMessage, parseResponseBody, pollTaskUntilComplete } from '../../lib/api';

type LinkedInOptimizeResponse = {
  headlines: string[];
  about_versions: string[];
  experience_rewrites: Array<{ before: string; after: string }>;
  recommended_skills: string[];
  usage?: {
    used: number;
    limit: number;
  };
};

type MeResponse = {
  subscription?: {
    usage?: { linkedin?: number };
    limits?: { linkedin?: number };
  };
};

export function LinkedInOptimizer() {
  const [optimizing, setOptimizing] = useState(false);
  const [optimized, setOptimized] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [experience, setExperience] = useState('');
  const [result, setResult] = useState<LinkedInOptimizeResponse | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  const remainingCredits = useMemo(() => {
    if (!usage) return null;
    return `${Math.max(usage.limit - usage.used, 0)} remaining`;
  }, [usage]);
  const isLimitReached = Boolean(usage && usage.used >= usage.limit);

  useEffect(() => {
    const loadUsage = async () => {
      try {
        const response = await fetchWithAuth('/me/');
        const data = await parseResponseBody(response);
        if (!response.ok) return;
        const payload = data as MeResponse;
        const used = payload.subscription?.usage?.linkedin;
        const limit = payload.subscription?.limits?.linkedin;
        if (typeof used === 'number' && typeof limit === 'number') {
          setUsage({ used, limit });
        }
      } catch {
        // non-blocking
      }
    };
    void loadUsage();
  }, []);

  const handleOptimize = async () => {
    if (!targetRole.trim()) {
      toast.error('Target role is required');
      return;
    }

    setOptimizing(true);
    try {
      const response = await fetchWithAuth('/linkedin/optimize/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_role: targetRole,
          headline,
          about,
          experience,
        }),
      });
      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Failed to optimize LinkedIn profile'));
      }

      const { task_id } = data as { task_id: string };
      const payload = await pollTaskUntilComplete<LinkedInOptimizeResponse>(task_id);
      setResult(payload);
      if (payload.usage) setUsage(payload.usage);
      setOptimized(true);
      toast.success('LinkedIn profile optimized');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'LinkedIn optimization failed');
    } finally {
      setOptimizing(false);
    }
  };

  const activeHeadline = result?.headlines?.[0] ?? '';
  const activeAbout = result?.about_versions?.[0] ?? '';
  const activeExperience = (result?.experience_rewrites ?? []).map((item) => `• ${item.after}`).join('\n');
  const keywords = result?.recommended_skills ?? [];

  return (
    <div className="min-h-screen bg-background">
      {optimizing && (
        <div className="fixed inset-0 z-50 bg-background/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-md border-indigo-500/50 bg-gradient-to-br from-indigo-500/15 to-cyan-500/15">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                <div>
                  <p className="font-medium">Optimizing LinkedIn profile with AI...</p>
                  <p className="text-sm text-muted-foreground">Please wait. This can take a few seconds.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Linkedin className="w-8 h-8 text-blue-400" />
            LinkedIn Profile Optimizer
          </h1>
          <p className="text-muted-foreground">Optimize your profile for recruiter visibility</p>
        </div>

        {!optimized ? (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Current Profile</CardTitle>
              <CardDescription>We'll analyze and optimize your LinkedIn sections</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {usage && (
                <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  LinkedIn credits: <span className="font-medium">{usage.used}/{usage.limit}</span>
                  {' • '}
                  <span className="font-medium">{remainingCredits}</span>
                </div>
              )}
              {isLimitReached && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 flex items-center justify-between gap-3">
                  <span>You have reached your monthly LinkedIn optimization limit.</span>
                  <Link to="/pricing">
                    <Button size="sm" variant="outline">Upgrade Plan</Button>
                  </Link>
                </div>
              )}
              <div>
                <Label htmlFor="target-role">Target Role</Label>
                <Input
                  id="target-role"
                  placeholder="e.g. Senior Backend Engineer"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Headline</label>
                <Textarea
                  placeholder="Your current headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="resize-none"
                  rows={2}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Summary</label>
                <Textarea
                  placeholder="Your current summary"
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Experience Highlights</label>
                <Textarea
                  placeholder="Paste a few experience bullet points..."
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>
              <Button onClick={handleOptimize} disabled={optimizing || isLimitReached} className="gap-2">
                {optimizing ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Optimize Profile
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Profile Optimized!</h3>
                      <p className="text-sm text-muted-foreground">Your profile is now optimized for recruiter searches</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOptimized(false);
                      setResult(null);
                    }}
                  >
                    Try Another Optimization
                  </Button>
                </div>
                {isLimitReached && (
                  <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 flex items-center justify-between gap-3">
                    <span>Monthly limit reached. Upgrade to generate more LinkedIn versions.</span>
                    <Link to="/pricing">
                      <Button size="sm" variant="outline">Upgrade Plan</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="headline" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="headline">Headline</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="experience">Experience</TabsTrigger>
              </TabsList>

              <TabsContent value="headline" className="space-y-4">
                <Card className="border-border/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Original Headline</CardTitle>
                      <span className="text-xs text-muted-foreground">{headline.length} characters</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm opacity-60">{headline || 'No original headline provided.'}</p>
                  </CardContent>
                </Card>

                <Card className="border-emerald-500/50 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                        Optimized Headline
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          navigator.clipboard.writeText(activeHeadline);
                          toast.success('Copied to clipboard');
                        }}
                      >
                        <Copy className="w-4 h-4" />
                        Copy
                      </Button>
                    </div>
                    <CardDescription>{activeHeadline.length} characters • Includes key skills</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{activeHeadline}</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="summary" className="space-y-4">
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>Original Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm opacity-60 whitespace-pre-wrap">{about || 'No original summary provided.'}</p>
                  </CardContent>
                </Card>

                <Card className="border-emerald-500/50 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                        Optimized Summary
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          navigator.clipboard.writeText(activeAbout);
                          toast.success('Copied to clipboard');
                        }}
                      >
                        <Copy className="w-4 h-4" />
                        Copy
                      </Button>
                    </div>
                    <CardDescription>Structured for maximum impact</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{activeAbout}</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="experience" className="space-y-4">
                <Card className="border-emerald-500/50 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                        Optimized Experience Bullets
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          navigator.clipboard.writeText(activeExperience);
                          toast.success('Copied to clipboard');
                        }}
                      >
                        <Copy className="w-4 h-4" />
                        Copy
                      </Button>
                    </div>
                    <CardDescription>Action-oriented with measurable results</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{activeExperience}</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Keywords Added for SEO</CardTitle>
                <CardDescription>These keywords improve your profile visibility in recruiter searches</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((keyword, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-sm">
                      {keyword}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
