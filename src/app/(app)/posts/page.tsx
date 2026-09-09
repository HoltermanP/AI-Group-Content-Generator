import { getServerSession } from "next-auth";
import type { PostStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLinkedInOrganizationId } from "@/lib/services/linkedin/linkedinConfig";
import { PostsClient } from "./posts-client";

const VALID_STATUSES: PostStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "PENDING_APPROVAL",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
  "FAILED",
];

export default async function PostsPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await getServerSession(authOptions);
  const status = VALID_STATUSES.includes(searchParams.status as PostStatus)
    ? (searchParams.status as PostStatus)
    : undefined;

  const posts = await prisma.post.findMany({
    where: { userId: session!.user.id, ...(status ? { status } : {}) },
    include: { image: true, product: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Posts</h1>
        <p className="text-muted-foreground">Beheer, beoordeel en plan je LinkedIn-posts.</p>
      </div>
      <PostsClient
        activeStatus={status ?? null}
        linkedInOrganizationId={getLinkedInOrganizationId()}
        posts={posts.map((p) => ({
          id: p.id,
          title: p.title,
          summary: p.summary,
          status: p.status,
          scheduledAt: p.scheduledAt?.toISOString() ?? null,
          productName: p.product?.name ?? null,
          imageUrl: p.image?.imageUrl ?? null,
        }))}
      />
    </div>
  );
}
