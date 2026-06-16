import { NextResponse } from "next/server";
import type { PostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as PostStatus | null;

    const posts = await prisma.post.findMany({
      where: { userId, ...(status ? { status } : {}) },
      include: { image: true, product: { select: { id: true, name: true } } },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(posts);
  } catch (err) {
    return handleApiError(err);
  }
}
