import { summarizeWebsiteText } from "@/lib/ai/textService";

/**
 * Haalt de inhoud van een website op en vat deze samen voor gebruik als
 * extra context bij postgeneratie.
 *
 * Robuust by design: elke fout (timeout, blokkade, geen API key) levert null op,
 * waarna de applicatie gewoon verder werkt met alleen het opgeslagen bedrijfsprofiel.
 */
export async function fetchAndSummarizeWebsite(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AI-Group-ContentTool/1.0)",
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const html = await response.text();
    const text = extractText(html);
    if (text.length < 100) return null;

    return await summarizeWebsiteText(text, websiteUrl);
  } catch {
    return null;
  }
}

/** Heel eenvoudige HTML-naar-tekst extractie, bewust zonder externe dependencies. */
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
