import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { handleApiError, notFound, badRequest } from "@/lib/api";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const post = await prisma.post.findFirst({ where: { id: params.id, userId } });
    if (!post) return notFound("Post");
    if (post.status === "PUBLISHED") return badRequest("Een gepubliceerde post kan niet worden afgewezen.");

    const updated = await prisma.post.update({
      where: { id: params.id },
      data: { status: "REJECTED", approvedAt: null },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
