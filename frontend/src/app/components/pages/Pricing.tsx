import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { CheckCircle, Sparkles, ArrowRight, Globe, Zap } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { fetchWithAuth, getErrorMessage, parseResponseBody } from '../../lib/api';

export function Pricing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [processingPlan, setProcessingPlan] = useState<'starter' | 'pro' | null>(null);
  const [verifying, setVerifying] = useState(false);

  const tiers = [
    {
      planKey: 'free' as const,
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for getting started',
      features: [
        '1 resume optimization',
        '1 cover letter generation',
        'Basic ATS score',
        'Resume parsing',
        'Standard templates',
      ],
      cta: 'Get Started',
      popular: false,
      ctaVariant: 'outline' as const,
    },
    {
      planKey: 'starter' as const,
      name: 'Starter',
      price: '$5',
      period: 'per month',
      description: 'For active job seekers',
      features: [
        '10 resume optimizations/month',
        '5 cover letters/month',
        'Full ATS scoring & analysis',
        'LinkedIn profile optimization',
        'Interview prep questions',
        'Career gap analysis',
        'Email support',
      ],
      cta: isAuthenticated ? 'Choose Starter' : 'Start Free Trial',
      popular: false,
      ctaVariant: 'default' as const,
    },
    {
      planKey: 'pro' as const,
      name: 'Pro',
      price: '$12',
      period: 'per month',
      description: 'For serious professionals',
      features: [
        '50 resume optimizations/month',
        '50 cover letters/month',
        'Advanced ATS optimization',
        'LinkedIn profile optimizer',
        'Advanced interview prep',
        'Career gap analysis',
        'Shareable portfolio page',
        'Resume version manager',
        'Priority support',
        'Export to all formats',
      ],
      cta: 'Go Pro',
      popular: true,
      ctaVariant: 'default' as const,
    },
  ];

  const visibleTiers = isAuthenticated ? tiers.filter((tier) => tier.planKey !== 'free') : tiers;
  const isBusy = useMemo(() => Boolean(processingPlan || verifying), [processingPlan, verifying]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (!reference || verifying) return;

    const verifyPayment = async () => {
      setVerifying(true);
      try {
        const response = await fetchWithAuth(`/payments/verify/?reference=${encodeURIComponent(reference)}`);
        const data = await parseResponseBody(response);
        if (!response.ok) {
          throw new Error(getErrorMessage(data, 'Payment verification failed'));
        }
        const payload = data as { message?: string; status?: string };
        toast.success(payload.message || 'Payment verified successfully');
        navigate('/dashboard', { replace: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Payment verification failed';
        toast.error(msg);
        // Remove reference from URL to stop retry loop; failed payments won't succeed on retry
        navigate('/pricing', { replace: true });
      } finally {
        setVerifying(false);
      }
    };

    void verifyPayment();
  }, [location.search, navigate, verifying]);

  const handlePlanCheckout = async (planKey: 'free' | 'starter' | 'pro') => {
    if (planKey === 'free') {
      navigate('/dashboard');
      return;
    }

    if (!isAuthenticated) {
      toast.error('Login required before payment');
      navigate('/login');
      return;
    }

    setProcessingPlan(planKey);
    try {
      const response = await fetchWithAuth('/payments/initialize/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Unable to initialize payment'));
      }
      const payload = data as { authorization_url?: string };
      if (!payload.authorization_url) {
        throw new Error('Payment gateway did not return an authorization URL.');
      }
      window.location.href = payload.authorization_url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to start payment');
      setProcessingPlan(null);
    }
  };

  const handleBuyCredits = async () => {
    if (!isAuthenticated) {
      toast.error('Login required to buy credits');
      navigate('/login');
      return;
    }
    setProcessingPlan('starter');
    try {
      const response = await fetchWithAuth('/payments/initialize/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'starter', purchase_type: 'credits' }),
      });
      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Unable to initialize credit purchase'));
      }
      const payload = data as { authorization_url?: string };
      if (!payload.authorization_url) {
        throw new Error('Payment gateway did not return an authorization URL.');
      }
      window.location.href = payload.authorization_url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to start credit purchase');
      setProcessingPlan(null);
    }
  };

  const faqs = [
    {
      question: 'Can I cancel anytime?',
      answer: 'Yes! You can cancel your subscription at any time. No questions asked.',
    },
    {
      question: 'Do you offer refunds?',
      answer: 'We offer a 14-day money-back guarantee. If you\'re not satisfied, we\'ll refund your payment.',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We currently accept card payments through Paystack.',
    },
    {
      question: 'Is my data secure?',
      answer: 'Absolutely. We use bank-level encryption to protect your data and never share it with third parties.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4">Pricing</Badge>
          <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that works for you.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className={`grid gap-6 mb-16 ${isAuthenticated ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {visibleTiers.map((tier, index) => (
            <Card
              key={index}
              className={`border-border/50 relative ${
                tier.popular ? 'border-indigo-500 shadow-xl shadow-indigo-500/10 scale-105' : ''
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white px-4 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="mt-4">
                  <div className="text-4xl font-bold">{tier.price}</div>
                  <div className="text-sm text-muted-foreground">{tier.period}</div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full gap-2"
                  variant={tier.ctaVariant}
                  disabled={isBusy}
                  onClick={() => void handlePlanCheckout(tier.planKey)}
                >
                  {processingPlan === tier.planKey ? 'Processing...' : tier.cta}
                  {tier.popular && <ArrowRight className="w-4 h-4" />}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pay-Per-Use */}
        <Card className="mb-16 border-amber-500/50 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Pay-Per-Use Option</h3>
                  <p className="text-muted-foreground mb-2">
                    Need more ATS runs? Buy a top-up pack.
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">$5.00</span>
                    <span className="text-muted-foreground">per credit pack</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    1 pack = 30 extra ATS credits
                  </p>
                </div>
              </div>
              <Button size="lg" variant="outline" disabled={isBusy} onClick={() => void handleBuyCredits()}>
                Buy Credits
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Features Comparison */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-center">Why Choose JobCrafts AI?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="font-semibold mb-2">AI-Powered</h3>
                <p className="text-sm text-muted-foreground">
                  Advanced AI that understands ATS systems and tailors your resume perfectly
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="font-semibold mb-2">African-Friendly</h3>
                <p className="text-sm text-muted-foreground">
                  Special pricing and local payment options for African markets
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="font-semibold mb-2">Lightning Fast</h3>
                <p className="text-sm text-muted-foreground">
                  Get optimized resumes in under 30 seconds with our powerful AI engine
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQs */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <Card key={index} className="border-border/50">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">{faq.question}</h3>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA */}
        <Card className="border-indigo-500/50 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Job Search?</h2>
            <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
              Join thousands of job seekers who have landed their dream jobs with AI-optimized resumes
            </p>
            <Link to={isAuthenticated ? '/dashboard' : '/register'}>
              <Button size="lg" className="gap-2">
                {isAuthenticated ? 'Go to Dashboard' : 'Start Free Trial'} <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground mt-4">
              No credit card required • Cancel anytime
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
