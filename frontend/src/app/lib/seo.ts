import { ROUTE_FAQS, SITE_URL } from "./seo-routes";

type JsonLd = Record<string, unknown>;

const DEFAULT_OG_IMAGE = `${SITE_URL}/logo.png`;
const SITE_NAME = "JobCrafts AI";

type SeoConfig = {
  title: string;
  description: string;
  robots: string;
  canonicalPath: string;
  ogType?: string;
  jsonLd?: JsonLd | JsonLd[];
};

const defaultDescription =
  "JobCrafts AI helps job seekers optimize resumes, improve ATS scores, generate cover letters, and prepare for interviews.";

const buildFaqPageJsonLd = (routePath: keyof typeof ROUTE_FAQS): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: ROUTE_FAQS[routePath].map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
});

const siteJsonLd: JsonLd[] = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/pricing`,
      "query-input": "required name=search_term_string",
    },
  },
];

const pageSeo: Record<string, SeoConfig> = {
  "/": {
    title: "JobCrafts AI - AI Resume Builder, ATS Optimizer, Interview Prep",
    description:
      "Build stronger job applications with JobCrafts AI. Optimize your resume for ATS, generate cover letters, and prepare for interviews faster.",
    robots: "index,follow",
    canonicalPath: "/",
    ogType: "website",
    jsonLd: [
      ...siteJsonLd,
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "AI-powered platform for resume optimization, ATS scoring, cover letters, and interview preparation.",
        url: SITE_URL,
      },
      buildFaqPageJsonLd("/"),
    ],
  },
  "/pricing": {
    title: "Pricing - JobCrafts AI",
    description:
      "Explore JobCrafts AI pricing plans for ATS optimization, cover letters, interview prep, and career tools.",
    robots: "index,follow",
    canonicalPath: "/pricing",
    ogType: "website",
    jsonLd: buildFaqPageJsonLd("/pricing"),
  },
  "/login": {
    title: "Login - JobCrafts AI",
    description: "Login to your JobCrafts AI account.",
    robots: "noindex,nofollow",
    canonicalPath: "/login",
  },
  "/register": {
    title: "Register - JobCrafts AI",
    description: "Create your JobCrafts AI account.",
    robots: "noindex,nofollow",
    canonicalPath: "/register",
  },
};

const protectedNoIndexTitle = "JobCrafts AI App";

const upsertMeta = (attr: "name" | "property", key: string, content: string) => {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
};

const upsertCanonical = (href: string) => {
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
};

const setStructuredData = (jsonLd?: JsonLd | JsonLd[]) => {
  const id = "seo-structured-data";
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  if (!jsonLd) return;

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = id;
  script.text = JSON.stringify(jsonLd);
  document.head.appendChild(script);
};

export const applySeoForPath = (pathname: string) => {
  const config = pageSeo[pathname] ?? {
    title: protectedNoIndexTitle,
    description: defaultDescription,
    robots: "noindex,nofollow",
    canonicalPath: pathname,
  };

  const canonicalUrl = `${SITE_URL}${config.canonicalPath}`;
  const title = config.title;
  const description = config.description;

  document.title = title;
  upsertMeta("name", "description", description);
  upsertMeta("name", "robots", config.robots);
  upsertMeta("name", "keywords", "resume optimizer, ATS score, cover letter generator, interview prep, AI career tools");

  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:type", config.ogType ?? "website");
  upsertMeta("property", "og:url", canonicalUrl);
  upsertMeta("property", "og:site_name", SITE_NAME);
  upsertMeta("property", "og:image", DEFAULT_OG_IMAGE);

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", DEFAULT_OG_IMAGE);

  upsertCanonical(canonicalUrl);
  setStructuredData(config.jsonLd ?? (pathname === "/" ? siteJsonLd : undefined));
};
