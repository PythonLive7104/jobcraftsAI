export const SITE_URL = "https://jobcraftsai.com";

export const PUBLIC_SITEMAP_ROUTES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/pricing", changefreq: "weekly", priority: "0.9" },
];

export const ROUTE_FAQS = {
  "/": [
    {
      question: "What is JobCrafts AI?",
      answer:
        "JobCrafts AI is an AI-powered platform for resume optimization, ATS scoring, cover letter generation, and interview preparation.",
    },
    {
      question: "Who should use JobCrafts AI?",
      answer:
        "Job seekers who want stronger applications, better ATS compatibility, and faster interview readiness.",
    },
    {
      question: "Can I use JobCrafts AI for free?",
      answer: "Yes. A free plan is available to get started.",
    },
  ],
  "/pricing": [
    {
      question: "Can I cancel anytime?",
      answer: "Yes. You can cancel your subscription at any time.",
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept card payments through Paystack.",
    },
    {
      question: "Is my data secure?",
      answer: "Yes. We use secure authentication and protect your account data.",
    },
  ],
};
