import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishApprovedPost } from "@/lib/services/publishing";

export const maxDuration = 300;

/**
 * Cron: publiceert goedgekeurde posts waarvan het geplande moment is
 * aangebroken, maar uitsluitend voor gebruikers met:
 * - automatische publicatie ingeschakeld, én
 * - een actieve LinkedIn-koppeling.
 *
 * Posts zonder expliciete goedkeuring (status APPROVED) worden nooit
 * gepubliceerd; die controle zit ook nog eens in de publicatieservice zelf.
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

  const duePosts = await prisma.post.findMany({
    where: {
      status: "APPROVED",
      scheduledAt: { lte: new Date() },
      user: {
        contentSettings: { autoPublish: true },
        integrations: { some: { provider: "linkedin", active: true } },
      },
    },
    select: { id: true, userId: true },
    take: 20,
  });

  const results: { postId: string; success: boolean; message: string }[] = [];
  for (const post of duePosts) {
    const result = await publishApprovedPost(post.userId, post.id);
    results.push({ postId: post.id, ...result });
  }

  return NextResponse.json({ due: duePosts.length, results });
}
