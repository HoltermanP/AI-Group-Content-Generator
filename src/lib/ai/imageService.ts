import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";

export interface GeneratedImage {
  url: string;
  provider: string;
}

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

/**
 * Providerkeuze:
 * - IMAGE_PROVIDER="stub"   → altijd placeholder (expliciet uitgezet)
 * - IMAGE_PROVIDER="openai" → OpenAI (vereist OPENAI_API_KEY)
 * - IMAGE_PROVIDER="auto" of niet gezet → OpenAI zodra er een key is, anders stub.
 *   Zo werkt echte beeldgeneratie direct zodra de API key is ingevuld.
 */
export function activeImageProvider(): "openai" | "stub" {
  const configured = (process.env.IMAGE_PROVIDER || "auto").toLowerCase();
  if (configured === "stub") return "stub";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "stub";
}

/**
 * Genereert een fotorealistische afbeelding voor een post, met één automatische
 * retry. Opslag:
 * - met BLOB_READ_WRITE_TOKEN (Vercel Blob): permanente publieke URL — vereist in productie;
 * - anders lokaal onder /public/uploads (alleen geschikt voor lokaal draaien).
 */
export async function generateImage(prompt: string, postId: string): Promise<GeneratedImage> {
  const provider = activeImageProvider();
  if (provider === "stub") {
    return {
      url: `https://placehold.co/1200x675/0f172a/e2e8f0/png?text=AI-Group`,
      provider: "stub",
    };
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await generateWithOpenAI(prompt, postId);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `Afbeelding genereren mislukt na 2 pogingen: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function generateWithOpenAI(prompt: string, postId: string): Promise<GeneratedImage> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const result = await client.images.generate({
    model: IMAGE_MODEL,
    prompt,
    size: "1536x1024",
    n: 1,
  });

  const item = result.data?.[0];
  if (!item) throw new Error("Geen afbeelding ontvangen van OpenAI");

  let buffer: Buffer;
  if (item.b64_json) {
    buffer = Buffer.from(item.b64_json, "base64");
  } else if (item.url) {
    const response = await fetch(item.url);
    if (!response.ok) throw new Error(`Download van afbeelding mislukt (${response.status})`);
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    throw new Error("OpenAI gaf geen bruikbare afbeelding terug");
  }

  const filename = `${postId}-${Date.now()}.png`;
  const url = await persistImage(buffer, filename);
  return { url, provider: "openai" };
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

  // Lokale fallback. Op Vercel is het filesystem ephemeral: stel daar
  // BLOB_READ_WRITE_TOKEN in zodat afbeeldingen permanent worden opgeslagen.
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}
