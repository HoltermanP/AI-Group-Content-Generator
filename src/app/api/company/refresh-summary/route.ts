import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { handleApiError, badRequest } from "@/lib/api";
import { fetchAndSummarizeWebsite } from "@/lib/services/websiteSummary";

/**
 * Haalt de website van het bedrijfsprofiel op en slaat een samenvatting op.
 * Als ophalen of samenvatten niet lukt, blijft de applicatie gewoon werken
 * op basis van het opgeslagen profiel.
 */
export async function POST() {
  try {
    const userId = await requireUserId();
    const profile = await prisma.companyProfile.findUnique({ where: { userId } });
    if (!profile) return badRequest("Vul eerst het bedrijfsprofiel in.");

    const summary = await fetchAndSummarizeWebsite(profile.websiteUrl);
    if (!summary) {
      return NextResponse.json({
        ok: false,
        message:
          "Website kon niet worden opgehaald of samengevat. De applicatie gebruikt het opgeslagen bedrijfsprofiel.",
      });
    }

    await prisma.companyProfile.update({ where: { userId }, data: { websiteSummary: summary } });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return handleApiError(err);
  }
}
