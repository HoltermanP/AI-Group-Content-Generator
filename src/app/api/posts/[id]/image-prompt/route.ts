import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { generateImagePrompt } from "@/lib/ai/textService";
import { handleApiError, notFound } from "@/lib/api";

export const maxDuration = 60;

/**
 * Hergenereert de afbeeldingprompt op basis van de actuele posttekst.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const post = await prisma.post.findFirst({ where: { id: params.id, userId } });
    if (!post) return notFound("Post");

    const profile = await prisma.companyProfile.findUnique({ where: { userId } });
    const prompt = await generateImagePrompt(post.body, profile?.companyName ?? "AI-Group");

    const image = await prisma.postImage.upsert({
      where: { postId: post.id },
      update: { imagePrompt: prompt, imageStatus: "PENDING" },
      create: { postId: post.id, imagePrompt: prompt, imageStatus: "PENDING" },
    });
    return NextResponse.json(image);
  } catch (err) {
    return handleApiError(err);
  }
}
