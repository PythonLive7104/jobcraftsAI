import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { buildUrl, getErrorMessage, parseResponseBody } from '../../lib/api';
import { 
  Sparkles, 
  FileText, 
  Target, 
  MessageSquare, 
  GraduationCap, 
  Linkedin, 
  TrendingUp, 
  CheckCircle,
  ArrowRight,
  Zap,
  Shield,
  Globe,
  Facebook,
} from 'lucide-react';

export function LandingPage() {
  const { user } = useAuth();
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [sendingContact, setSendingContact] = useState(false);
  const socialLinks = {
    linkedin: 'https://linkedin.com/company/jobcrafts-ai',
    facebook: 'https://www.facebook.com/jobcraftsai/',
  };
  const features = [
    {
      icon: Target,
      title: 'AI Resume Tailoring',
      description: 'Automatically optimize your resume for any job description using advanced AI',
    },
    {
      icon: CheckCircle,
      title: 'ATS Optimization',
      description: 'Get scored and optimized for Applicant Tracking Systems',
    },
    {
      icon: MessageSquare,
      title: 'Cover Letter Generator',
      description: 'Create personalized cover letters in multiple tones',
    },
    {
      icon: GraduationCap,
      title: 'Interview Prep',
      description: 'Practice with AI-generated questions and suggested answers',
    },
    {
      icon: Linkedin,
      title: 'LinkedIn Optimizer',
      description: 'Enhance your LinkedIn profile for maximum recruiter visibility',
    },
    {
      icon: TrendingUp,
      title: 'Career Gap Analysis',
      description: 'Identify skill gaps and get personalized learning roadmaps',
    },
    {
      icon: Globe,
      title: 'Shareable Portfolio',
      description: 'Create a professional portfolio page to share with recruiters (Pro)',
    },
  ];

  const pricingTiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      features: [
        '1 resume optimization',
        '1 cover letter',
        'Basic ATS score',
        'Resume parsing',
      ],
      cta: 'Get Started',
      popular: false,
    },
    {
      name: 'Starter',
      price: '$5',
      period: 'per month',
      features: [
        '10 optimizations per month',
        '5 cover letters',
        'Full ATS scoring',
        'LinkedIn optimization',
        'Interview prep access',
      ],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Pro',
      price: '$12',
      period: 'per month',
      features: [
        '50 optimizations per month',
        '50 cover letters per month',
        'Advanced interview prep',
        'Career gap analysis',
        'Shareable portfolio page',
        'Resume version manager',
        'Priority support',
      ],
      cta: 'Go Pro',
      popular: true,
    },
  ];

  const handleContactSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSendingContact(true);
    try {
      const response = await fetch(buildUrl('/contact/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          message: contactMessage,
        }),
      });
      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Unable to send message'));
      }
      toast.success('Message sent. We will get back to you soon.');
      setContactName('');
      setContactEmail('');
      setContactMessage('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send message');
    } finally {
      setSendingContact(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-border/50 backdrop-blur-xl bg-background/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-lg">JobCrafts AI</span>
            </Link>
            <div className="flex items-center gap-4">
              {user && (
                <span className="hidden sm:inline text-sm text-muted-foreground">
                  Hi, {user.first_name || user.username}
                </span>
              )}
              <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
              <Link to="/dashboard">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-cyan-500/10 to-emerald-500/10 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-sm text-indigo-400">AI-Powered Career Platform</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              Land Your Dream Job with AI-Optimized Resumes
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Automatically tailor your resume and cover letter to any job posting. Get ATS-optimized, interview-ready, and stand out from the crowd.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/dashboard">
                <Button size="lg" className="gap-2">
                  Start Free <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline">
                  View Pricing
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              No credit card required • African-friendly pricing
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need to Succeed</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A complete AI-powered career toolkit designed for the modern job seeker
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <div className="text-3xl font-bold mb-2">{'<'}30s</div>
              <div className="text-muted-foreground">Average optimization time</div>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div className="text-3xl font-bold mb-2">100%</div>
              <div className="text-muted-foreground">ATS-compatible output</div>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-indigo-500 flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <div className="text-3xl font-bold mb-2">Global</div>
              <div className="text-muted-foreground">With African-friendly pricing</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that works for you.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <Card 
                key={index} 
                className={`border-border/50 relative ${
                  tier.popular ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : ''
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Most Popular
                    </span>
                  </div>
                )}
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-2">{tier.name}</h3>
                  <div className="mb-4">
                    <div className="text-3xl font-bold">{tier.price}</div>
                    <div className="text-sm text-muted-foreground">{tier.period}</div>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/dashboard">
                    <Button 
                      className="w-full" 
                      variant={tier.popular ? 'default' : 'outline'}
                    >
                      {tier.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 via-cyan-500/10 to-emerald-500/10 border border-border/50 p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Accelerate Your Career?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of job seekers who have transformed their applications with AI
            </p>
            <Link to="/dashboard">
              <Button size="lg" className="gap-2">
                Get Started Free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact and Social */}
      <section className="py-16 border-t border-border/50 bg-muted/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-2xl font-semibold mb-4">Contact Us</h3>
            <form className="space-y-3 max-w-xl" onSubmit={handleContactSubmit}>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="contactName">Name</Label>
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contactEmail">Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="contactMessage">Message</Label>
                <Textarea
                  id="contactMessage"
                  value={contactMessage}
                  onChange={(event) => setContactMessage(event.target.value)}
                  rows={4}
                  required
                />
              </div>
              <Button type="submit" disabled={sendingContact}>
                {sendingContact ? 'Sending...' : 'Send Message'}
              </Button>
            </form>
          </div>

          <div>
            <h3 className="text-2xl font-semibold mb-4">Follow Us</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Stay connected for tips, updates, and career insights.
            </p>
            <div className="flex items-center gap-3">
              <a
                href={socialLinks.linkedin}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="LinkedIn"
                target="_blank"
                rel="noreferrer"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href={socialLinks.facebook}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="Facebook"
                target="_blank"
                rel="noreferrer"
              >
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-lg">JobCrafts AI</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI-powered tools to help you create standout applications, beat ATS filters, and get interview-ready faster.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
                <FileText className="w-3.5 h-3.5" />
                Built for modern job seekers
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <div className="space-y-2 text-sm">
                <Link to="/dashboard" className="block text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
                <Link to="/optimize" className="block text-muted-foreground hover:text-foreground transition-colors">Resume Optimizer</Link>
                <Link to="/cover-letter" className="block text-muted-foreground hover:text-foreground transition-colors">Cover Letter</Link>
                <Link to="/interview-prep" className="block text-muted-foreground hover:text-foreground transition-colors">Interview Prep</Link>
                <Link to="/portfolio" className="block text-muted-foreground hover:text-foreground transition-colors">Portfolio (Pro)</Link>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <div className="space-y-2 text-sm">
                <Link to="/pricing" className="block text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
                <Link to="/resume" className="block text-muted-foreground hover:text-foreground transition-colors">Upload Resume</Link>
                <Link to="/job-analysis" className="block text-muted-foreground hover:text-foreground transition-colors">Job Analysis</Link>
                <Link to="/linkedin" className="block text-muted-foreground hover:text-foreground transition-colors">LinkedIn Optimizer</Link>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Start Now</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Create your account and begin optimizing your next application.
              </p>
              <Link to={user ? "/dashboard" : "/register"}>
                <Button size="sm" className="gap-2">
                  {user ? 'Go to Dashboard' : 'Create Free Account'} <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              © 2026 JobCrafts AI. Empowering job seekers globally.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
