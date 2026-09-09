import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLinkedInOrganizationId } from "@/lib/services/linkedin/linkedinConfig";
import { PostDetailClient } from "./post-detail-client";

export default async function PostDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const post = await prisma.post.findFirst({
    where: { id: params.id, userId },
    include: {
      image: true,
      product: { select: { id: true, name: true } },
      logs: { orderBy: { attemptedAt: "desc" } },
    },
  });
  if (!post) notFound();

  const linkedProducts =
    post.productIds.length > 0
      ? await prisma.product.findMany({
          where: { userId, id: { in: post.productIds } },
          select: { id: true, name: true },
        })
      : [];

  return (
    <PostDetailClient
      linkedInOrganizationId={getLinkedInOrganizationId()}
      post={{
        id: post.id,
        title: post.title,
        summary: post.summary,
        body: post.body,
        cta: post.cta,
        hashtags: post.hashtags,
        status: post.status,
        sourceType: post.sourceType,
        topic: post.topic,
        sourceUrl: post.sourceUrl,
        scheduledAt: post.scheduledAt?.toISOString() ?? null,
        approvedAt: post.approvedAt?.toISOString() ?? null,
        publishedAt: post.publishedAt?.toISOString() ?? null,
        createdAt: post.createdAt.toISOString(),
        productNames: linkedProducts.map((p) => p.name),
        image: post.image
          ? {
              imagePrompt: post.image.imagePrompt,
              imageUrl: post.image.imageUrl,
              imageProvider: post.image.imageProvider,
              imageStatus: post.image.imageStatus,
              errorMessage: post.image.errorMessage,
              generatedAt: post.image.generatedAt?.toISOString() ?? null,
            }
          : null,
        logs: post.logs.map((log) => ({
          id: log.id,
          provider: log.provider,
          status: log.status,
          message: log.message,
          attemptedAt: log.attemptedAt.toISOString(),
        })),
      }}
    />
  );
}
