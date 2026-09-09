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
        content: `Vat de volgende websitetekst van ${websiteUrl} samen in maximaal 300 woorden, in het Nederlands, feitelijk en zonder reclametaal. Benoem: wat doet het bedrijf, voor wie (sectoren en functies), hoe de aanpak eruitziet (stappen), welke diensten/producten/cases worden genoemd, en welke concrete resultaten of cijfers de site noemt. Verzin niets dat niet in de tekst staat.\n\n${text.slice(0, 16000)}`,
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
  "a technician working on equipment in a workshop, seen from the side with face turned toward the work, not toward the camera",
  "a single worker at a construction site, at a middle distance, face not clearly visible due to distance and angle",
  "a warehouse worker checking a handheld scanner, photographed from a three-quarter back angle so the face is only partially visible",
  "a technician in a server room working on a rack panel, face turned away from the camera toward the equipment",
  "a healthcare worker adjusting equipment on a cart, photographed from the side with attention on the task rather than the camera",
  "a delivery driver loading packages from a van, photographed at a slight distance with the face turned down toward the boxes",
  "a shop employee restocking shelves, photographed from behind at an angle so the face is not clearly visible",
];

function stubImagePrompt(postBody: string, companyName: string): string {
  const firstLine = postBody.split("\n")[0]?.slice(0, 120) ?? "a workplace";
  const scene = STUB_SCENES[Math.floor(Math.random() * STUB_SCENES.length)];
  return (
    `Photorealistic professional photo, Dutch business setting: ${scene}, matching the practice described in the post. ` +
    `Soft natural light, shallow depth of field, shot on a 35mm lens. At most one person in frame, no crowds. No clear, ` +
    `sharp, camera-facing close-up of a face. No robots, no holograms. The text "${companyName}" is clearly ` +
    `visible somewhere in the frame (e.g. on a sign, sticker, or workwear). Theme related to: ${firstLine}`
  );
}
