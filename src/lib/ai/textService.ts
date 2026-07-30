import OpenAI from "openai";
import {
  buildPostSystemPrompt,
  buildPostUserPrompt,
  buildImagePromptInstruction,
  type PostGenerationContext,
} from "@/lib/ai/prompts";
import { generatedPostOutputSchema, type GeneratedPostOutput } from "@/lib/validations";

const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-4o";

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function isTextAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Genereert een complete LinkedIn-post (tekst + image prompt) op basis van de context.
 * Zonder OPENAI_API_KEY valt de service terug op een stub zodat de hele flow
 * lokaal testbaar blijft.
 */
export async function generatePostContent(ctx: PostGenerationContext): Promise<GeneratedPostOutput> {
  const client = getClient();
  if (!client) return stubPost(ctx);

  const system = buildPostSystemPrompt(ctx);
  const user = buildPostUserPrompt(ctx);

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: TEXT_MODEL,
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const raw = response.choices[0]?.message?.content ?? "";
      const parsed = generatedPostOutputSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      lastError = new Error(`AI-output voldeed niet aan het verwachte formaat: ${parsed.error.message}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `Postgeneratie mislukt na 2 pogingen: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

/**
 * Genereert (of hergenereert) alleen een afbeeldingprompt voor een bestaande posttekst.
 */
export async function generateImagePrompt(postBody: string, companyName: string): Promise<string> {
  const client = getClient();
  if (!client) {
    return stubImagePrompt(postBody, companyName);
  }
  const response = await client.chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0.7,
    messages: [{ role: "user", content: buildImagePromptInstruction(postBody, companyName) }],
  });
  const prompt = response.choices[0]?.message?.content?.trim();
  if (!prompt) throw new Error("Geen afbeeldingprompt ontvangen van de AI");
  return prompt;
}

/**
 * Vat ruwe websitetekst samen voor gebruik als extra context bij postgeneratie.
 * Geeft null terug als er geen API key is (de app gebruikt dan alleen het profiel).
 */
export async function summarizeWebsiteText(text: string, websiteUrl: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const response = await client.chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0.3,
    messages: [
      {
        role: "user",
        content: `Vat de volgende websitetekst van ${websiteUrl} samen in maximaal 150 woorden, gericht op: wat doet het bedrijf, voor wie, en welke diensten/producten worden genoemd.\n\n${text.slice(0, 12000)}`,
      },
    ],
  });
  return response.choices[0]?.message?.content?.trim() ?? null;
}

// ─── Stubs (lokaal werken zonder API key) ────────────────────────────────────

function stubPost(ctx: PostGenerationContext): GeneratedPostOutput {
  const product = ctx.products[0];
  const subject = product?.name ?? ctx.topic ?? ctx.profile.companyName;
  const hashtags = ctx.profile.defaultHashtags.slice(0, Math.max(1, ctx.settings.hashtagCount));

  const body = product
    ? `Uren kwijt aan ${product.problem.toLowerCase().replace(/\.$/, "")}? Dat kan anders.\n\nMet ${product.name} ${product.shortDescription.charAt(0).toLowerCase()}${product.shortDescription.slice(1).replace(/\.$/, "")}.\n\nWat dat in de praktijk oplevert:\n${product.benefits}\n\n${product.cta}`
    : `Veel teams besteden uren per week aan werk dat slimmer kan: zoeken, uitwerken, overtypen.\n\n${ctx.profile.shortDescription}\n\nGeen AI om de AI, maar toepassingen die direct tijd opleveren.\n\n${ctx.profile.defaultCta}`;

  return {
    title: `[VOORBEELD] Post over ${subject}`,
    summary: `Voorbeeldpost over ${subject}, gegenereerd in stub-modus (geen OPENAI_API_KEY ingesteld).`,
    body,
    cta: product?.cta ?? ctx.profile.defaultCta,
    hashtags,
    imagePrompt: stubImagePrompt(body, ctx.profile.companyName),
  };
}

const STUB_SCENES = [
  "a technician's hands adjusting equipment in a workshop, a colleague working blurred in the background, no faces visible",
  "a small team gathered around a whiteboard, seen from behind, backs and shoulders only, no faces in frame",
  "a warehouse aisle with a worker in silhouette checking a handheld scanner, face turned away from camera",
  "a construction site at golden hour, a worker's torso and hands with a tool, face out of frame",
  "a server room corridor with a technician's hand on a rack panel, colleague blurred in the far background",
  "a modern workplace with a laptop showing a clean dashboard and printed documents on the desk, a person's hands typing, face not visible",
];

function stubImagePrompt(postBody: string, companyName: string): string {
  const firstLine = postBody.split("\n")[0]?.slice(0, 120) ?? "a modern office desk";
  const scene = STUB_SCENES[Math.floor(Math.random() * STUB_SCENES.length)];
  return (
    `Photorealistic professional photo, Dutch business setting: ${scene}, matching the practice described in the post. ` +
    `Soft natural light, shallow depth of field, shot on a 35mm lens. People may be visible but never recognizable: ` +
    `no clear or in-focus faces. No robots, no holograms. The text "${companyName}" is clearly visible somewhere in the frame ` +
    `(e.g. on a sign, sticker, or workwear). Theme related to: ${firstLine}`
  );
}
