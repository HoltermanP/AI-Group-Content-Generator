import type { WebsiteCase } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * websiteCases — haalt de praktijkcases van de bedrijfswebsite op
 * (bijv. https://www.ai-group.nl/cases/ai-engine.html) en bewaart ze als
 * feitelijke bron voor case-posts. Elke case-post linkt naar de case-pagina.
 *
 * Robuust by design: netwerkfouten of een gewijzigde site-structuur leveren
 * nooit een crash op; de bestaande cases in de database blijven dan staan.
 */

const FETCH_TIMEOUT_MS = 10_000;
const MAX_CONTENT_CHARS = 5000;
/** Hoe lang opgehaalde cases "vers" zijn voordat de cron ze opnieuw ophaalt. */
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export interface CrawledCase {
  url: string;
  slug: string;
  title: string;
  sector: string | null;
  tag: string | null;
  resultLine: string | null;
  teaser: string | null;
  description: string | null;
  content: string;
  imageUrl: string | null;
}

// ─── Ophalen ──────────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AI-Group-ContentTool/1.0)",
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Vindt de case-links op de website. Eerst de overzichtskaarten op de
 * homepage (met tag, resultaatregel en teaser); valt terug op alle links
 * die naar /cases/ of /case/ verwijzen.
 */
export async function discoverCases(websiteUrl: string): Promise<CrawledCase[]> {
  const base = normalizeBase(websiteUrl);
  const candidates = [`${base}/`, `${base}/cases`, `${base}/cases/`, `${base}/ons-werk`];
  const seen = new Map<string, CrawledCase>();

  for (const pageUrl of candidates) {
    const html = await fetchHtml(pageUrl);
    if (!html) continue;
    for (const card of extractCaseCards(html, base)) {
      if (!seen.has(card.url)) seen.set(card.url, card);
    }
    // De homepage bevat normaal alle kaarten; stop zodra we iets hebben.
    if (seen.size > 0) break;
  }

  // Detailpagina's ophalen voor de volledige inhoud.
  const results: CrawledCase[] = [];
  for (const card of Array.from(seen.values())) {
    const html = await fetchHtml(card.url);
    if (!html) {
      if (card.teaser) results.push({ ...card, content: card.teaser });
      continue;
    }
    results.push(parseCasePage(html, card, base));
  }
  return results;
}

function normalizeBase(websiteUrl: string): string {
  const withProtocol = /^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`;
  const url = new URL(withProtocol);
  return `${url.protocol}//${url.host}`;
}

function absoluteUrl(href: string, base: string): string {
  try {
    return new URL(href, `${base}/`).toString();
  } catch {
    return href;
  }
}

function slugFromUrl(url: string): string {
  const last = url.replace(/\/+$/, "").split("/").pop() ?? "";
  return last.replace(/\.(html?|php)$/i, "") || "case";
}

/** Overzichtskaarten (<a class="project" href="/cases/...">…</a>) met metadata. */
function extractCaseCards(html: string, base: string): CrawledCase[] {
  const cards: CrawledCase[] = [];
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html))) {
    const attrs = match[1];
    const inner = match[2];
    const hrefMatch = attrs.match(/href="([^"]+)"/i) ?? attrs.match(/href='([^']+)'/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (!/\/cases?\//i.test(href) || /#/.test(href) === true && !/\/cases?\/[^#]+/.test(href)) continue;
    if (/\/cases?\/?$/i.test(href)) continue; // overzichtspagina zelf
    const url = absoluteUrl(href, base);
    if (!url.startsWith(base)) continue;

    const title =
      textOf(firstMatch(inner, /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i)) || textOf(inner).slice(0, 80) || slugFromUrl(url);
    const tag = textOf(firstMatch(inner, /<span[^>]*class="[^"]*\btag\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i)) || null;
    const resultLine =
      textOf(firstMatch(inner, /<span[^>]*class="[^"]*result-line[^"]*"[^>]*>([\s\S]*?)<\/span>/i)) || null;
    const teaser = textOf(firstMatch(inner, /<p[^>]*>([\s\S]*?)<\/p>/i)) || null;

    cards.push({
      url,
      slug: slugFromUrl(url),
      title,
      sector: null,
      tag,
      resultLine,
      teaser,
      description: null,
      content: "",
      imageUrl: null,
    });
  }
  return cards;
}

/** Leest de detailpagina van een case uit tot gestructureerde tekst. */
function parseCasePage(html: string, card: CrawledCase, base: string): CrawledCase {
  const title = textOf(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)) || card.title;
  const description =
    firstMatch(html, /<meta[^>]*name="description"[^>]*content="([^"]*)"/i) ??
    firstMatch(html, /<meta[^>]*content="([^"]*)"[^>]*name="description"/i);

  const main = firstMatch(html, /<main[^>]*>([\s\S]*?)<\/main>/i) ?? html;
  const imageSrc = firstMatch(main, /<img[^>]*src="([^"]+)"/i);

  let text = htmlToText(main);
  // Navigatie naar vorige/volgende case en de contact-footer horen niet bij de inhoud.
  text = cutAt(text, ["← VORIGE CASE", "VORIGE CASE", "UW PROCES ALS VOLGENDE", "Start een gesprek"]);
  text = text.replace(/^\s*ONS WERK\s*\/\s*[^\n]*\n?/i, "").trim();

  const sector = firstMatch(text, /SECTOR\s+([^\n]+?)\s+(?:GEBRUIKERS|TYPE OPLOSSING|STATUS|HET VRAAGSTUK)/i) ?? null;

  return {
    ...card,
    title,
    sector: sector?.trim() ?? null,
    description: description ? decodeEntities(description).trim() : null,
    content: text.slice(0, MAX_CONTENT_CHARS),
    imageUrl: imageSrc ? absoluteUrl(imageSrc, base) : null,
  };
}

function cutAt(text: string, markers: string[]): string {
  let cut = text.length;
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx > 200 && idx < cut) cut = idx;
  }
  return text.slice(0, cut).trim();
}

function firstMatch(input: string, re: RegExp): string | null {
  const m = input.match(re);
  return m ? m[1] : null;
}

function textOf(fragment: string | null): string {
  if (!fragment) return "";
  return htmlToText(fragment).replace(/\s+/g, " ").trim();
}

/** HTML naar leesbare tekst met regeleinden bij blokelementen, zonder externe dependencies. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|h[1-6]|blockquote|figcaption|tr|dt|dd)>/gi, "\n")
    .replace(/<(p|div|section|article|li|h[1-6]|blockquote|figcaption|tr|dt|dd)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(withBreaks)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  eacute: "é",
  euml: "ë",
  egrave: "è",
  euro: "€",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

// ─── Opslag ───────────────────────────────────────────────────────────────────

/**
 * Haalt de cases op en werkt de database bij (upsert op URL). Cases die niet
 * meer op de site staan worden inactief gemaakt. Zonder `force` wordt er
 * alleen opnieuw opgehaald als de opgeslagen cases ouder zijn dan 12 uur.
 */
export async function syncWebsiteCases(
  userId: string,
  websiteUrl: string,
  options: { force?: boolean } = {},
): Promise<WebsiteCase[]> {
  if (!options.force) {
    const newest = await prisma.websiteCase.findFirst({
      where: { userId },
      orderBy: { lastFetchedAt: "desc" },
      select: { lastFetchedAt: true },
    });
    if (newest && Date.now() - newest.lastFetchedAt.getTime() < STALE_AFTER_MS) {
      return prisma.websiteCase.findMany({ where: { userId, active: true }, orderBy: { title: "asc" } });
    }
  }

  const crawled = await discoverCases(websiteUrl);
  if (crawled.length === 0) {
    // Niets gevonden (site onbereikbaar of structuur gewijzigd): laat de
    // bestaande cases ongemoeid.
    return prisma.websiteCase.findMany({ where: { userId, active: true }, orderBy: { title: "asc" } });
  }

  const now = new Date();
  for (const c of crawled) {
    const data = {
      slug: c.slug,
      title: c.title,
      sector: c.sector,
      tag: c.tag,
      resultLine: c.resultLine,
      teaser: c.teaser,
      description: c.description,
      content: c.content || c.teaser || c.title,
      imageUrl: c.imageUrl,
      active: true,
      lastFetchedAt: now,
    };
    await prisma.websiteCase.upsert({
      where: { userId_url: { userId, url: c.url } },
      update: data,
      create: { userId, url: c.url, ...data },
    });
  }
  await prisma.websiteCase.updateMany({
    where: { userId, url: { notIn: crawled.map((c) => c.url) } },
    data: { active: false },
  });

  return prisma.websiteCase.findMany({ where: { userId, active: true }, orderBy: { title: "asc" } });
}

/** Actieve cases van de gebruiker (zonder ophalen). */
export function listWebsiteCases(userId: string): Promise<WebsiteCase[]> {
  return prisma.websiteCase.findMany({ where: { userId, active: true }, orderBy: { title: "asc" } });
}

/**
 * Kiest de case die het langst niet aan bod is gekomen, zodat alle cases
 * evenredig terugkomen in de content.
 */
export function pickNextWebsiteCase(userId: string): Promise<WebsiteCase | null> {
  return prisma.websiteCase.findFirst({
    where: { userId, active: true },
    orderBy: [{ lastUsedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
  });
}
