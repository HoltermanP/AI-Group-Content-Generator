import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fillCalendar } from "@/lib/services/postGeneration";

export const maxDuration = 300;

/**
 * Cron: genereert periodiek nieuwe conceptposts voor gebruikers die
 * automatische generatie hebben ingeschakeld. Genereert alleen als er
 * onvoldoende geplande posts zijn binnen de planningshorizon.
 *
 * Vercel Cron stuurt `Authorization: Bearer ${CRON_SECRET}` mee.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const users = await prisma.contentSettings.findMany({
    where: { autoGenerate: true },
    select: { userId: true },
  });

  const results: { userId: string; created: number; error?: string }[] = [];
  for (const { userId } of users) {
    try {
      const created = await fillCalendar(userId, "cron");
      results.push({ userId, created: created.length });
    } catch (err) {
      results.push({ userId, created: 0, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ users: users.length, results });
}
