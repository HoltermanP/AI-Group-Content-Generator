import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { generateExtensionToken, hashToken } from "@/lib/extensionAuth";
import { handleApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Beheer van het Chrome-extensietoken. Sessie-authenticatie (alleen vanuit de app).
 * Het token wordt één keer teruggegeven en daarna alleen als hash bewaard.
 */

export async function GET() {
  try {
    const userId = await requireUserId();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { extensionTokenHash: true },
    });
    return NextResponse.json({ hasToken: Boolean(user?.extensionTokenHash) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST() {
  try {
    const userId = await requireUserId();
    const token = generateExtensionToken();
    await prisma.user.update({
      where: { id: userId },
      data: { extensionTokenHash: hashToken(token) },
    });
    // Het token wordt alleen hier, eenmalig, teruggegeven.
    return NextResponse.json({ token });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE() {
  try {
    const userId = await requireUserId();
    await prisma.user.update({ where: { id: userId }, data: { extensionTokenHash: null } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
