import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function POST() {
  try {
    const userId = await requireUserId();
    await prisma.integrationAccount.updateMany({
      where: { userId, provider: "linkedin" },
      data: { active: false, accessToken: null, refreshToken: null, expiresAt: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
