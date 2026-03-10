import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Badge } from '../ui/badge';
import { AlertCircle, ChevronRight, GraduationCap, Lightbulb, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithAuth, getErrorMessage, parseResponseBody } from '../../lib/api';

type InterviewQuestion = {
  question: string;
  suggested_answer: string;
  tips: string[];
  star_framework?: {
    situation: string;
    task: string;
    action: string;
    result: string;
  } | null;
};

type InterviewCategory = {
  category: string;
  questions: InterviewQuestion[];
};

type InterviewPrepResponse = {
  categories: InterviewCategory[];
  usage?: {
    used: number;
    limit: number;
  };
};

type MeResponse = {
  subscription?: {
    usage?: { interview_prep?: number };
    limits?: { interview_prep?: number };
  };
};

export function InterviewPrep() {
  const resumeId = window.localStorage.getItem('resumeai-current-resume-id');
  const [jobTitle, setJobTitle] = useState('');
  const [jobRequirements, setJobRequirements] = useState('');
  const [customQuestions, setCustomQuestions] = useState<string[]>(['']);
  const [generating, setGenerating] = useState(false);
  const [categories, setCategories] = useState<InterviewCategory[]>([]);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  const generated = categories.length > 0;
  const remainingCredits = useMemo(() => {
    if (!usage) return null;
    return `${Math.max(usage.limit - usage.used, 0)} remaining`;
  }, [usage]);

  useEffect(() => {
    const loadUsage = async () => {
      try {
        const response = await fetchWithAuth('/me/');
        const data = await parseResponseBody(response);
        if (!response.ok) return;
        const payload = data as MeResponse;
        const used = payload.subscription?.usage?.interview_prep;
        const limit = payload.subscription?.limits?.interview_prep;
        if (typeof used === 'number' && typeof limit === 'number') {
          setUsage({ used, limit });
        }
      } catch {
        // non-blocking
      }
    };
    void loadUsage();
  }, []);

  const handleGenerate = async () => {
    if (!resumeId) {
      toast.error('Upload a resume first');
      return;
    }
    if (!jobTitle.trim()) {
      toast.error('Job title is required');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetchWithAuth(`/resumes/${resumeId}/interview-prep/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_title: jobTitle,
          job_requirements: jobRequirements,
          custom_questions: customQuestions.filter((q) => q.trim()),
        }),
      });
      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Failed to generate interview prep'));
      }
      const payload = data as InterviewPrepResponse;
      setCategories(payload.categories ?? []);
      if (payload.usage) setUsage(payload.usage);
      toast.success('Interview prep generated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {generating && (
        <div className="fixed inset-0 z-50 bg-background/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-md border-indigo-500/50 bg-gradient-to-br from-indigo-500/15 to-cyan-500/15">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                <div>
                  <p className="font-medium">Generating interview prep with AI...</p>
                  <p className="text-sm text-muted-foreground">Please wait. This can take a few seconds.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Interview Preparation</h1>
          <p className="text-muted-foreground">Practice with AI-generated questions and suggested answers</p>
        </div>

        {!resumeId && (
          <Card className="mb-6 border-amber-500/40 bg-amber-500/10">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <p className="text-sm text-amber-300">Upload a resume first before generating interview prep.</p>
              <Link to="/resume">
                <Button size="sm" variant="outline">
                  Go to Resume Upload
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {/* Input */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Generate Interview Questions</CardTitle>
              <CardDescription>Enter the job title you're interviewing for</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {usage && (
                <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Interview prep credits: <span className="font-medium">{usage.used}/{usage.limit}</span>
                  {' • '}
                  <span className="font-medium">{remainingCredits}</span>
                </div>
              )}
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
                <Label htmlFor="job-requirements">Job Requirements (Optional)</Label>
                <Textarea
                  id="job-requirements"
                  placeholder="Paste role requirements (skills, tools, responsibilities)..."
                  className="min-h-[180px]"
                  value={jobRequirements}
                  onChange={(event) => setJobRequirements(event.target.value)}
                />
              </div>
              <div>
                <Label>Your Own Questions (Optional)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Add questions you want AI to answer based on your resume and the job
                </p>
                <div className="space-y-2">
                  {customQuestions.map((q, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Question ${index + 1}...`}
                        value={q}
                        onChange={(e) => {
                          setCustomQuestions((prev) => {
                            const next = [...prev];
                            next[index] = e.target.value;
                            return next;
                          });
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setCustomQuestions((prev) =>
                            prev.length > 1 ? prev.filter((_, i) => i !== index) : ['']
                          );
                        }}
                        aria-label="Remove question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setCustomQuestions((prev) => [...prev, ''])}
                  >
                    <Plus className="w-4 h-4" />
                    Add Question
                  </Button>
                </div>
              </div>
              <Button onClick={handleGenerate} className="gap-2" disabled={generating || !resumeId || !jobTitle.trim()}>
                <Sparkles className="w-4 h-4" />
                {generating ? 'Generating...' : 'Generate'}
              </Button>
            </CardContent>
          </Card>

          {generated && (
            <>
              {/* Questions by Category */}
              {categories.map((category, catIndex) => (
                <Card key={catIndex} className="border-border/50">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 flex items-center justify-center">
                        <GraduationCap className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <CardTitle>{category.category} Questions</CardTitle>
                        <CardDescription>
                          {category.questions.length} questions with suggested answers
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="space-y-3">
                      {category.questions.map((q, qIndex) => (
                        <AccordionItem
                          key={qIndex}
                          value={`${catIndex}-${qIndex}`}
                          className="border border-border/50 rounded-lg px-4"
                        >
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-start gap-3 text-left">
                              <Badge variant="outline" className="mt-1 flex-shrink-0">
                                {qIndex + 1}
                              </Badge>
                              <span>{q.question}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 pt-4">
                            {/* STAR Framework */}
                            {q.star_framework && (
                              <div className="space-y-3">
                                <h4 className="font-medium flex items-center gap-2">
                                  <Lightbulb className="w-4 h-4 text-amber-400" />
                                  STAR Method Answer
                                </h4>
                                <div className="space-y-2 pl-6">
                                  <div>
                                    <span className="text-sm font-medium text-indigo-400">Situation: </span>
                                    <span className="text-sm text-muted-foreground">{q.star_framework.situation}</span>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-cyan-400">Task: </span>
                                    <span className="text-sm text-muted-foreground">{q.star_framework.task}</span>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-emerald-400">Action: </span>
                                    <span className="text-sm text-muted-foreground">{q.star_framework.action}</span>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-purple-400">Result: </span>
                                    <span className="text-sm text-muted-foreground">{q.star_framework.result}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Suggested Answer */}
                            {q.suggested_answer && (
                              <div>
                                <h4 className="font-medium mb-2">Suggested Answer</h4>
                                <p className="text-sm text-muted-foreground">{q.suggested_answer}</p>
                              </div>
                            )}

                            {/* Tips */}
                            {q.tips && (
                              <div>
                                <h4 className="font-medium mb-2">Key Tips</h4>
                                <ul className="space-y-1">
                                  {q.tips.map((tip, tIndex) => (
                                    <li key={tIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                                      <ChevronRight className="w-4 h-4 mt-0.5 text-indigo-400 flex-shrink-0" />
                                      {tip}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}

              {/* STAR Method Guide */}
              <Card className="border-indigo-500/50 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">📚 STAR Method Framework</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-sm mb-1 text-indigo-400">Situation</h4>
                      <p className="text-xs text-muted-foreground">Set the context and background</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm mb-1 text-cyan-400">Task</h4>
                      <p className="text-xs text-muted-foreground">Describe your responsibility</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm mb-1 text-emerald-400">Action</h4>
                      <p className="text-xs text-muted-foreground">Explain what you did</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm mb-1 text-purple-400">Result</h4>
                      <p className="text-xs text-muted-foreground">Share the outcome and metrics</p>
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
