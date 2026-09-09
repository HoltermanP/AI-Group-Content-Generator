import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { handleApiError, badRequest } from "@/lib/api";
import { listWebsiteCases, syncWebsiteCases } from "@/lib/services/websiteCases";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function serialize(cases: Awaited<ReturnType<typeof listWebsiteCases>>) {
  return cases.map((c) => ({
    id: c.id,
    url: c.url,
    title: c.title,
    sector: c.sector,
    tag: c.tag,
    resultLine: c.resultLine,
    teaser: c.teaser,
    lastFetchedAt: c.lastFetchedAt.toISOString(),
    lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
  }));
}

/** Cases van de website die als bron voor posts beschikbaar zijn. */
export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.json({ cases: serialize(await listWebsiteCases(userId)) });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Haalt de cases opnieuw op van de website van het bedrijfsprofiel. */
export async function POST() {
  try {
    const userId = await requireUserId();
    const profile = await prisma.companyProfile.findUnique({ where: { userId } });
    if (!profile) return badRequest("Vul eerst het bedrijfsprofiel in.");

    const cases = await syncWebsiteCases(userId, profile.websiteUrl, { force: true });
    return NextResponse.json({ ok: cases.length > 0, cases: serialize(cases) });
  } catch (err) {
    return handleApiError(err);
  }
}
