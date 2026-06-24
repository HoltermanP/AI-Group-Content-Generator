import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";

export interface GeneratedImage {
  url: string;
  provider: string;
}

const PRIMARY_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const FALLBACK_MODEL = "dall-e-3";

function isServerless(): boolean {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

/**
 * Providerkeuze:
 * - IMAGE_PROVIDER="stub"   → altijd placeholder (expliciet uitgezet)
 * - IMAGE_PROVIDER="openai" → OpenAI (vereist OPENAI_API_KEY)
 * - IMAGE_PROVIDER="auto" of niet gezet → OpenAI zodra er een key is, anders stub.
 */
export function activeImageProvider(): "openai" | "stub" {
  const configured = (process.env.IMAGE_PROVIDER || "auto").toLowerCase();
  if (configured === "stub") return "stub";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "stub";
}

/**
 * Genereert een fotorealistische afbeelding voor een post.
 *
 * Opslag (in deze volgorde):
 * - Vercel Blob als BLOB_READ_WRITE_TOKEN is gezet → permanente publieke URL (vereist in productie);
 * - anders lokaal onder /public/uploads (alleen voor lokaal draaien).
 *
 * Modelkeuze: probeert eerst PRIMARY_MODEL (standaard gpt-image-1) en valt bij
 * een modelfout terug op dall-e-3, zodat beeldgeneratie ook werkt als gpt-image-1
 * nog niet voor het OpenAI-account is vrijgegeven.
 */
export async function generateImage(prompt: string, postId: string): Promise<GeneratedImage> {
  const provider = activeImageProvider();
  if (provider === "stub") {
    return {
      url: `https://placehold.co/1200x675/0f172a/e2e8f0/png?text=AI-Group`,
      provider: "stub",
    };
  }

  // In productie zonder Blob-opslag zou de afbeelding naar een niet-schrijfbaar
  // filesystem gaan. Faal hier met een duidelijke, oplosbare melding.
  if (isServerless() && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Afbeeldingopslag ontbreekt: stel BLOB_READ_WRITE_TOKEN in (Vercel → Storage → Blob → store koppelen) en deploy opnieuw. " +
        "Het Vercel-filesystem is niet schrijfbaar, dus afbeeldingen kunnen anders niet worden bewaard.",
    );
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const buffer = await generateBuffer(client, prompt);
  const filename = `${postId}-${Date.now()}.png`;
  const url = await persistImage(buffer, filename);
  return { url, provider: "openai" };
}

/** Vraagt een afbeelding op bij OpenAI, met retry en model-fallback. */
async function generateBuffer(client: OpenAI, prompt: string): Promise<Buffer> {
  const models = PRIMARY_MODEL === FALLBACK_MODEL ? [PRIMARY_MODEL] : [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await callModel(client, model, prompt);
      } catch (err) {
        lastError = err;
        // Bij een duidelijke modelfout (niet beschikbaar / geen toegang) meteen
        // door naar het volgende model in plaats van opnieuw proberen.
        if (isModelAccessError(err)) break;
      }
    }
  }

  throw new Error(
    `Afbeelding genereren mislukt: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function callModel(client: OpenAI, model: string, prompt: string): Promise<Buffer> {
  // gpt-image-1 accepteert geen response_format en levert altijd b64;
  // dall-e-3 gebruikt een eigen ondersteund formaat.
  const params =
    model === "dall-e-3"
      ? { model, prompt, size: "1792x1024" as const, n: 1, response_format: "b64_json" as const }
      : { model, prompt, size: "1536x1024" as const, n: 1 };

  const result = await client.images.generate(params);
  const item = result.data?.[0];
  if (!item) throw new Error("Geen afbeelding ontvangen van OpenAI");

  if (item.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item.url) {
    const response = await fetch(item.url);
    if (!response.ok) throw new Error(`Download van afbeelding mislukt (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error("OpenAI gaf geen bruikbare afbeelding terug");
}

function isModelAccessError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    status === 403 ||
    status === 404 ||
    message.includes("does not have access") ||
    message.includes("must be verified") ||
    message.includes("model") && message.includes("not found")
  );
}

async function persistImage(buffer: Buffer, filename: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${filename}`, buffer, {
      access: "public",
      contentType: "image/png",
    });
    return blob.url;
  }

  // Lokale fallback (alleen voor lokaal draaien).
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}
