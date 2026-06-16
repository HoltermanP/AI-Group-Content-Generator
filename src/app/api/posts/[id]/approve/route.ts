import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { handleApiError, notFound, badRequest } from "@/lib/api";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const post = await prisma.post.findFirst({
      where: { id: params.id, userId },
      include: { image: { select: { imageUrl: true } } },
    });
    if (!post) return notFound("Post");
    if (post.status === "PUBLISHED") return badRequest("Deze post is al gepubliceerd.");

    const updated = await prisma.post.update({
      where: { id: params.id },
      data: { status: "APPROVED", approvedAt: new Date() },
      include: { image: { select: { imageUrl: true } } },
    });

    const origin = new URL(_request.url).origin;
    const imageUrl = updated.image?.imageUrl
      ? updated.image.imageUrl.startsWith("http")
        ? updated.image.imageUrl
        : `${origin}${updated.image.imageUrl}`
      : null;

    return NextResponse.json({
      ...updated,
      fullText: [updated.body, updated.hashtags.join(" ")].filter(Boolean).join("\n\n"),
      imageUrl,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
