import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Serveert afbeeldingen uit een privé Vercel Blob-store. Wordt gebruikt als
 * de gekoppelde Blob-store op "private" staat: de app slaat de afbeelding dan
 * privé op en deze route streamt hem met het server-side token.
 *
 * Bewust zonder login-check (uitgesloten in de middleware): dit zijn
 * marketingafbeeldingen die toch publiek op LinkedIn verschijnen, en de
 * LinkedIn-upload haalt ze server-side op zonder sessiecookie.
 */
export async function GET(_request: Request, { params }: { params: { path: string[] } }) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob-opslag is niet geconfigureerd" }, { status: 404 });
  }

  // Alleen paden binnen uploads/ toestaan.
  const pathname = params.path.join("/");
  if (!pathname.startsWith("uploads/") || pathname.includes("..")) {
    return NextResponse.json({ error: "Ongeldig pad" }, { status: 400 });
  }

  try {
    const { get } = await import("@vercel/blob");
    const result = await get(pathname, { access: "private" });
    if (!result || !result.stream) {
      return NextResponse.json({ error: "Afbeelding niet gevonden" }, { status: 404 });
    }

    return new Response(result.stream, {
      headers: {
        "Content-Type": result.blob?.contentType ?? "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Afbeelding niet gevonden" }, { status: 404 });
  }
}
