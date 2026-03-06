import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AlertCircle, Copy, Download, Loader2, MessageSquare, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithAuth, getErrorMessage, parseResponseBody } from '../../lib/api';

type CoverLetterResponse = {
  cover_letter: string;
  usage?: {
    used: number;
    limit: number;
  };
};

type MeResponse = {
  subscription?: {
    usage?: { cover_letter?: number };
    limits?: { cover_letter?: number };
  };
};

export function CoverLetter() {
  const resumeId = window.localStorage.getItem('resumeai-current-resume-id');
  const [generating, setGenerating] = useState(false);
  const [tone, setTone] = useState('professional');
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  const generated = Boolean(generatedLetter.trim());
  const remainingCredits = useMemo(() => {
    if (!usage) return null;
    return `${Math.max(usage.limit - usage.used, 0)} remaining`;
  }, [usage]);

  useEffect(() => {
    const loadCoverLetterUsage = async () => {
      try {
        const response = await fetchWithAuth('/me/');
        const data = await parseResponseBody(response);
        if (!response.ok) return;
        const payload = data as MeResponse;
        const used = payload.subscription?.usage?.cover_letter;
        const limit = payload.subscription?.limits?.cover_letter;
        if (typeof used === 'number' && typeof limit === 'number') {
          setUsage({ used, limit });
        }
      } catch {
        // Non-blocking: badge just won't show if this fails.
      }
    };

    void loadCoverLetterUsage();
  }, []);

  const handleGenerate = async () => {
    if (!resumeId) {
      toast.error('Upload a resume first');
      return;
    }
    if (!companyName.trim() || !jobTitle.trim() || !jobDescription.trim()) {
      toast.error('Company name, job title, and job description are required');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetchWithAuth(`/resumes/${resumeId}/cover-letter/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_name: companyName,
          job_title: jobTitle,
          tone,
          job_description: jobDescription,
        }),
      });

      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Failed to generate cover letter'));
      }

      const payload = data as CoverLetterResponse;
      setGeneratedLetter(payload.cover_letter);
      if (payload.usage) setUsage(payload.usage);
      toast.success('Cover letter generated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLetter);
    toast.success('Cover letter copied to clipboard');
  };

  const handleDownload = () => {
    if (!generatedLetter.trim()) {
      toast.error('Generate a cover letter first');
      return;
    }

    const sanitize = (value: string) =>
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const companyPart = sanitize(companyName) || 'company';
    const rolePart = sanitize(jobTitle) || 'role';
    const fileName = `cover-letter-${companyPart}-${rolePart}.txt`;

    const blob = new Blob([generatedLetter], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    toast.success('Cover letter downloaded');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">AI Cover Letter Generator</h1>
          <p className="text-muted-foreground">Create personalized cover letters in seconds</p>
        </div>

        {!resumeId && (
          <Card className="mb-6 border-amber-500/40 bg-amber-500/10">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <p className="text-sm text-amber-300">Upload a resume first before generating a cover letter.</p>
              <Link to="/resume">
                <Button size="sm" variant="outline">
                  Go to Resume Upload
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {generating && (
          <div className="fixed inset-0 z-50 bg-background/40 backdrop-blur-sm flex items-center justify-center px-4">
            <Card className="w-full max-w-md border-indigo-500/50 bg-gradient-to-br from-indigo-500/15 to-cyan-500/15">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  <div>
                    <p className="font-medium">Generating cover letter with AI...</p>
                    <p className="text-sm text-muted-foreground">Please wait. This may take a few seconds.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Input Form */}
          <div className="lg:col-span-1">
            <Card className="border-border/50 sticky top-24">
              <CardHeader>
                <CardTitle>Job Details</CardTitle>
                <CardDescription>Enter information about the position</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {usage && (
                  <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Cover letter credits: <span className="font-medium">{usage.used}/{usage.limit}</span>
                    {' • '}
                    <span className="font-medium">{remainingCredits}</span>
                  </div>
                )}

                <div>
                  <Label htmlFor="company">Company Name</Label>
                  <Input
                    id="company"
                    placeholder="e.g. Google"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="job-title">Job Title</Label>
                  <Input
                    id="job-title"
                    placeholder="e.g. Senior Software Engineer"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="job-description">Job Description</Label>
                  <Textarea
                    id="job-description"
                    placeholder="Paste job description here..."
                    className="min-h-[180px]"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="tone">Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="confident">Confident</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                      <SelectItem value="concise">Concise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleGenerate} 
                  disabled={generating || !resumeId || !companyName.trim() || !jobTitle.trim() || !jobDescription.trim()}
                  className="w-full gap-2"
                >
                  {generating ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4" />
                      Generate Letter
                    </>
                  )}
                </Button>
                {usage && (
                  <div className="text-xs text-muted-foreground">
                    Monthly cover letter usage: {usage.used}/{usage.limit}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Generated Letter */}
          <div className="lg:col-span-2">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Your Cover Letter</CardTitle>
                    <CardDescription>AI-generated and personalized</CardDescription>
                  </div>
                  {generated && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-2" onClick={handleCopy}>
                        <Copy className="w-4 h-4" />
                        Copy
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload}>
                        <Download className="w-4 h-4" />
                        Download
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!generated ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 flex items-center justify-center mb-4">
                      <MessageSquare className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h3 className="font-medium mb-2">No Letter Generated Yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Fill in the details and click "Generate Letter" to create your personalized cover letter
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Textarea
                      className="min-h-[600px] font-mono text-sm"
                      value={generatedLetter}
                      onChange={(event) => setGeneratedLetter(event.target.value)}
                    />
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <AlertCircle className="w-3 h-3 mt-0.5" />
                      Review and personalize before sending.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {generated && (
              <Card className="border-indigo-500/50 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 mt-6">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">✨ Tips for Success</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Review and personalize the letter with specific examples</li>
                    <li>• Research the company and add relevant details</li>
                    <li>• Proofread for any errors before submitting</li>
                    <li>• Keep it to one page for best results</li>
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
