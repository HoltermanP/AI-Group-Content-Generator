import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { generateImage, activeImageProvider } from "@/lib/ai/imageService";
import { handleApiError, notFound, badRequest } from "@/lib/api";

export const maxDuration = 120;

/**
 * Genereert de afbeelding voor een post op basis van de opgeslagen imagePrompt.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const post = await prisma.post.findFirst({
      where: { id: params.id, userId },
      include: { image: true },
    });
    if (!post) return notFound("Post");
    if (!post.image?.imagePrompt) return badRequest("Deze post heeft nog geen afbeeldingprompt.");

    await prisma.postImage.update({
      where: { postId: post.id },
      data: { imageStatus: "GENERATING", errorMessage: null },
    });

    try {
      const result = await generateImage(post.image.imagePrompt, post.id);
      const image = await prisma.postImage.update({
        where: { postId: post.id },
        data: {
          imageUrl: result.url,
          imageProvider: result.provider,
          imageStatus: "COMPLETED",
          generatedAt: new Date(),
          errorMessage: null,
        },
      });
      return NextResponse.json(image);
    } catch (genError) {
      const message = genError instanceof Error ? genError.message : String(genError);
      await prisma.postImage.update({
        where: { postId: post.id },
        data: { imageStatus: "FAILED", errorMessage: message },
      });
      return NextResponse.json({ error: message, provider: activeImageProvider() }, { status: 502 });
    }
  } catch (err) {
    return handleApiError(err);
  }
}
