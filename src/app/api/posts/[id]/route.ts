import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { updatePostSchema } from "@/lib/validations";
import { handleApiError, notFound } from "@/lib/api";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const post = await prisma.post.findFirst({
      where: { id: params.id, userId },
      include: {
        image: true,
        product: { select: { id: true, name: true } },
        logs: { orderBy: { attemptedAt: "desc" } },
      },
    });
    if (!post) return notFound("Post");
    return NextResponse.json(post);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const existing = await prisma.post.findFirst({ where: { id: params.id, userId } });
    if (!existing) return notFound("Post");

    const input = updatePostSchema.parse(await request.json());
    const { imagePrompt, scheduledAt, ...postFields } = input;

    const post = await prisma.post.update({
      where: { id: params.id },
      data: {
        ...postFields,
        ...(scheduledAt !== undefined ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null } : {}),
      },
      include: { image: true },
    });

    if (scheduledAt !== undefined) {
      if (scheduledAt) {
        await prisma.publicationSchedule.upsert({
          where: { postId: params.id },
          update: { plannedAt: new Date(scheduledAt) },
          create: { userId, postId: params.id, plannedAt: new Date(scheduledAt), source: "manual" },
        });
      } else {
        await prisma.publicationSchedule.deleteMany({ where: { postId: params.id } });
      }
    }

    if (imagePrompt !== undefined) {
      await prisma.postImage.upsert({
        where: { postId: params.id },
        update: { imagePrompt, imageStatus: "PENDING" },
        create: { postId: params.id, imagePrompt, imageStatus: "PENDING" },
      });
    }

    const updated = await prisma.post.findUnique({ where: { id: params.id }, include: { image: true } });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const existing = await prisma.post.findFirst({ where: { id: params.id, userId } });
    if (!existing) return notFound("Post");

    await prisma.post.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
