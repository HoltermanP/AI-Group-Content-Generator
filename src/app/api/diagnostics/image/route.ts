import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUserId } from "@/lib/auth";
import { activeImageProvider } from "@/lib/ai/imageService";
import { handleApiError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Diagnose-endpoint voor beeldgeneratie. Auth vereist; geeft geen secrets terug,
 * alleen of ze aanwezig zijn en wat er bij een echte testgeneratie misgaat.
 *
 * Gebruik (ingelogd in de app, in een nieuw tabblad):
 *   GET /api/diagnostics/image
 */
export async function GET() {
  try {
    await requireUserId();

    const config = {
      environment: process.env.VERCEL ? "vercel" : process.env.NODE_ENV,
      imageProviderSetting: process.env.IMAGE_PROVIDER || "auto",
      activeProvider: activeImageProvider(),
      hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
      imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      hasBlobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    };

    const checks: { step: string; ok: boolean; detail: string }[] = [];

    // 1. OpenAI key
    if (!process.env.OPENAI_API_KEY) {
      checks.push({
        step: "OpenAI key",
        ok: false,
        detail: "OPENAI_API_KEY ontbreekt. Zet hem in de Vercel env-vars en redeploy.",
      });
      return NextResponse.json({ config, checks, conclusion: conclude(checks) });
    }
    checks.push({ step: "OpenAI key", ok: true, detail: "Aanwezig." });

    // 2. Blob-opslag (vereist op Vercel)
    if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
      checks.push({
        step: "Blob-opslag",
        ok: false,
        detail: "BLOB_READ_WRITE_TOKEN ontbreekt in deze deployment. Koppel de Blob-store en redeploy.",
      });
    } else {
      checks.push({
        step: "Blob-opslag",
        ok: true,
        detail: process.env.BLOB_READ_WRITE_TOKEN ? "Token aanwezig." : "Lokaal (filesystem).",
      });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 3. Testgeneratie met het ingestelde model
    const primaryModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    const primary = await tryGenerate(client, primaryModel);
    checks.push({
      step: `Model ${primaryModel}`,
      ok: primary.ok,
      detail: primary.detail,
    });

    // 4. Fallback dall-e-3 testen als het primaire model faalt
    if (!primary.ok && primaryModel !== "dall-e-3") {
      const fallback = await tryGenerate(client, "dall-e-3");
      checks.push({ step: "Model dall-e-3 (fallback)", ok: fallback.ok, detail: fallback.detail });
    }

    // 5. Blob-write testen (klein bestand)
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import("@vercel/blob");
        const blob = await put(`uploads/diagnostic-${Date.now()}.txt`, "ok", {
          access: "public",
          contentType: "text/plain",
        });
        checks.push({ step: "Blob-write", ok: true, detail: `Geschreven naar ${blob.url}` });
      } catch (err) {
        checks.push({
          step: "Blob-write",
          ok: false,
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({ config, checks, conclusion: conclude(checks) });
  } catch (err) {
    return handleApiError(err);
  }
}

async function tryGenerate(client: OpenAI, model: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const params =
      model === "dall-e-3"
        ? { model, prompt: "A plain light grey background, minimal.", size: "1024x1024" as const, n: 1 }
        : { model, prompt: "A plain light grey background, minimal.", size: "1024x1024" as const, n: 1 };
    const result = await client.images.generate(params);
    const item = result.data?.[0];
    if (item?.b64_json || item?.url) return { ok: true, detail: "Testafbeelding gegenereerd." };
    return { ok: false, detail: "Geen bruikbare afbeelding teruggekregen." };
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: `${status ? `HTTP ${status}: ` : ""}${message}` };
  }
}

function conclude(checks: { step: string; ok: boolean; detail: string }[]): string {
  const failed = checks.filter((c) => !c.ok);
  if (failed.length === 0) return "Alles werkt. Beeldgeneratie zou nu moeten lukken.";
  return `Probleem bij: ${failed.map((f) => f.step).join(", ")}. Zie de details per stap.`;
}
