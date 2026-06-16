import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { handleApiError, notFound } from "@/lib/api";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const post = await prisma.post.findFirst({
      where: { id: params.id, userId },
      include: { image: true },
    });
    if (!post) return notFound("Post");

    const duplicate = await prisma.post.create({
      data: {
        userId,
        title: `${post.title} (kopie)`,
        summary: post.summary,
        body: post.body,
        cta: post.cta,
        hashtags: post.hashtags,
        status: "DRAFT",
        sourceType: post.sourceType,
        topic: post.topic,
        productId: post.productId,
        productIds: post.productIds,
        image: post.image
          ? { create: { imagePrompt: post.image.imagePrompt, imageStatus: "PENDING" } }
          : undefined,
      },
    });
    return NextResponse.json(duplicate, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
