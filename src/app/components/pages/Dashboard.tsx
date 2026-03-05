import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import {
  FileText,
  Sparkles,
  MessageSquare,
  GraduationCap,
  Linkedin,
  TrendingUp,
  FolderOpen,
  Target,
  ArrowRight,
  Settings as SettingsIcon,
  CheckCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchWithAuth, parseResponseBody } from '../../lib/api';

type DashboardSummary = {
  stats: {
    resumes_created: number;
    cover_letters: number;
    avg_ats_score: number;
    credits_left: number;
  };
  plan: {
    name: string;
    ats_used: number;
    ats_limit: number;
    ats_remaining: number;
  };
  recent_activity: Array<{
    action: string;
    detail: string;
    time: string;
    status: 'completed';
  }>;
};

export function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const planProgress = useMemo(() => {
    if (!summary) return 0;
    const pct = (summary.plan.ats_used / Math.max(summary.plan.ats_limit, 1)) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [summary]);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const response = await fetchWithAuth('/dashboard/summary/');
        const data = await parseResponseBody(response);
        if (!response.ok) return;
        setSummary(data as DashboardSummary);
      } finally {
        setLoading(false);
      }
    };
    void loadSummary();
  }, []);
  const quickActions = [
    {
      icon: FileText,
      title: 'Upload Resume',
      description: 'Parse and analyze your resume',
      path: '/resume',
      color: 'from-indigo-500 to-cyan-500',
    },
    {
      icon: Target,
      title: 'Optimize Resume',
      description: 'Tailor for a specific job',
      path: '/optimize',
      color: 'from-cyan-500 to-emerald-500',
    },
    {
      icon: MessageSquare,
      title: 'Cover Letter',
      description: 'Generate AI cover letters',
      path: '/cover-letter',
      color: 'from-emerald-500 to-indigo-500',
    },
    {
      icon: GraduationCap,
      title: 'Interview Prep',
      description: 'Practice interview questions',
      path: '/interview-prep',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: Linkedin,
      title: 'LinkedIn Optimizer',
      description: 'Enhance your profile',
      path: '/linkedin',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: TrendingUp,
      title: 'Career Gap Analysis',
      description: 'Identify skill gaps',
      path: '/career-gap',
      color: 'from-orange-500 to-red-500',
    },
  ];

  const recentActivity = summary?.recent_activity ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Welcome back{user ? `, ${user.first_name || user.username}` : ''}!
            </h1>
            <p className="text-muted-foreground">Let's accelerate your job search with AI</p>
          </div>
          <Link to="/settings">
            <Button variant="outline" className="gap-2">
              <SettingsIcon className="w-4 h-4" />
              Settings
            </Button>
          </Link>
        </div>

        {loading && (
          <Card className="mb-8 border-border/50">
            <CardContent className="p-6 flex items-center gap-3 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading dashboard data...
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="border-border/50 bg-gradient-to-br from-indigo-500/5 to-cyan-500/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Resumes Created</p>
                  <p className="text-2xl font-bold">{summary?.stats.resumes_created ?? 0}</p>
                </div>
                <FileText className="w-8 h-8 text-indigo-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-gradient-to-br from-cyan-500/5 to-emerald-500/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Cover Letters</p>
                  <p className="text-2xl font-bold">{summary?.stats.cover_letters ?? 0}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-gradient-to-br from-emerald-500/5 to-indigo-500/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Avg ATS Score</p>
                  <p className="text-2xl font-bold">{summary?.stats.avg_ats_score ?? 0}%</p>
                </div>
                <Target className="w-8 h-8 text-emerald-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Credits Left</p>
                  <p className="text-2xl font-bold">
                    {summary?.stats.credits_left ?? 0}
                  </p>
                </div>
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Plan */}
        <Card className="mb-8 border-indigo-500/50 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold mb-1">{summary?.plan.name ?? 'Plan'}</h3>
                <p className="text-sm text-muted-foreground">
                  {summary
                    ? `${summary.plan.ats_remaining} of ${summary.plan.ats_limit} ATS optimizations remaining this month`
                    : 'Loading usage details...'}
                </p>
                <Progress value={planProgress} className="mt-3 w-48" />
              </div>
              <Link to="/pricing">
                <Button className="gap-2">
                  Upgrade to Pro <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Link key={index} to={action.path}>
                    <Card className="border-border/50 hover:border-border transition-all hover:shadow-lg group cursor-pointer h-full">
                      <CardContent className="p-6">
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="font-semibold mb-1">{action.title}</h3>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {recentActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity yet. Start by uploading your resume.</p>
                  ) : recentActivity.map((activity, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium mb-0.5">{activity.action}</p>
                        <p className="text-xs text-muted-foreground truncate">{activity.detail}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link to="/versions">
                  <Button variant="outline" size="sm" className="w-full mt-4 gap-2">
                    <FolderOpen className="w-4 h-4" />
                    View All Versions
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
