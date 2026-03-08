import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, Mail, Linkedin, Github, Download, MapPin, Briefcase } from 'lucide-react';
import { buildUrl } from '../../lib/api';

type PortfolioData = {
  name: string;
  title: string;
  location: string;
  short_summary: string;
  experience: Array<{ job_role: string; achievements: string[] }>;
  projects: Array<{ description: string; link: string }>;
  skills: string[];
  email: string;
  linkedin_url: string;
  github_url: string;
  has_resume: boolean;
  resume_download_url?: string;
};

export function PortfolioPublic() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      try {
        const response = await fetch(buildUrl(`/portfolio/public/${slug}/`));
        if (!response.ok) {
          setError('Portfolio not found');
          return;
        }
        const json = await response.json();
        setData(json as PortfolioData);
      } catch {
        setError('Failed to load portfolio');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-destructive">{error ?? 'Portfolio not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const resumeUrl = slug && data.has_resume
    ? buildUrl(`/portfolio/public/${slug}/resume/`)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <Card className="mb-6">
          <CardContent className="pt-8 pb-8">
            <h1 className="text-3xl font-bold mb-1">{data.name}</h1>
            {data.title && (
              <p className="text-lg text-muted-foreground mb-2">{data.title}</p>
            )}
            {data.location && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {data.location}
              </p>
            )}
            {data.short_summary && (
              <p className="mt-4 text-muted-foreground leading-relaxed">{data.short_summary}</p>
            )}
            {/* Contact & Resume */}
            <div className="flex flex-wrap gap-3 mt-6">
              {data.email && (
                <a href={`mailto:${data.email}`}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </Button>
                </a>
              )}
              {data.linkedin_url && (
                <a href={data.linkedin_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Linkedin className="w-4 h-4" />
                    LinkedIn
                  </Button>
                </a>
              )}
              {data.github_url && (
                <a href={data.github_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Github className="w-4 h-4" />
                    GitHub
                  </Button>
                </a>
              )}
              {resumeUrl && (
                <a href={resumeUrl} download>
                  <Button size="sm" className="gap-2">
                    <Download className="w-4 h-4" />
                    Download Resume
                  </Button>
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Experience */}
        {data.experience?.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Experience
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {data.experience.map((exp, i) => (
                <div key={i}>
                  <h3 className="font-semibold">{exp.job_role}</h3>
                  {exp.achievements?.length > 0 && (
                    <ul className="mt-2 list-disc list-inside space-y-1 text-muted-foreground text-sm">
                      {exp.achievements.map((a, j) => (
                        <li key={j}>{a}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Projects */}
        {data.projects?.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.projects.map((proj, i) => (
                <div key={i}>
                  {proj.link ? (
                    <a
                      href={proj.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline font-medium"
                    >
                      {proj.description || proj.link}
                    </a>
                  ) : (
                    <p>{proj.description}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Skills */}
        {data.skills?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.skills.map((skill, i) => (
                  <Badge key={i} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
