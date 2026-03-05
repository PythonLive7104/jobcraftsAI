import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PUBLIC_SITEMAP_ROUTES, SITE_URL } from "../src/app/lib/seo-routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const sitemapPath = path.join(publicDir, "sitemap.xml");

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const urlEntries = PUBLIC_SITEMAP_ROUTES.map((route) => {
  const loc = `${SITE_URL}${route.path}`;
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <changefreq>${escapeXml(route.changefreq)}</changefreq>
    <priority>${escapeXml(route.priority)}</priority>
  </url>`;
}).join("\n");

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

await mkdir(publicDir, { recursive: true });
await writeFile(sitemapPath, sitemapXml, "utf8");

console.log(`Generated sitemap at ${sitemapPath}`);
