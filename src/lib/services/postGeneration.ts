import type { Post, PostSourceType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generatePostContent } from "@/lib/ai/textService";
import { computeNextSlots } from "@/lib/services/scheduling";

export interface GenerationRequest {
  userId: string;
  sourceType: PostSourceType;
  productIds?: string[];
  topic?: string;
  count?: number;
  /** "manual" voor de generator-pagina, "auto-fill" voor de kalender, "cron" voor de achtergrondtaak */
  source?: string;
  /** Posts die via cron/auto-fill ontstaan krijgen status PENDING_APPROVAL i.p.v. DRAFT */
  markPendingApproval?: boolean;
}

/**
 * Orkestreert het genereren van één of meer posts:
 * bedrijfsprofiel + producten + instellingen + eerdere posts → AI → Post + PostImage + planning.
 */
export async function generatePosts(request: GenerationRequest): Promise<Post[]> {
  const { userId } = request;
  const count = request.count ?? 1;

  const [profile, settings] = await Promise.all([
    prisma.companyProfile.findUnique({ where: { userId } }),
    prisma.contentSettings.findUnique({ where: { userId } }),
  ]);
  if (!profile) throw new Error("Vul eerst het bedrijfsprofiel in via Instellingen → Bedrijfsprofiel.");
  if (!settings) throw new Error("Vul eerst de contentinstellingen in via Instellingen → Content.");

  const selectedProducts =
    request.productIds && request.productIds.length > 0
      ? await prisma.product.findMany({ where: { userId, id: { in: request.productIds } } })
      : [];

  const existingScheduled = await prisma.post.findMany({
    where: { userId, scheduledAt: { gte: new Date() }, status: { notIn: ["REJECTED", "FAILED"] } },
    select: { scheduledAt: true },
  });
  const slots = computeNextSlots({
    settings,
    existingScheduled: existingScheduled.map((p) => p.scheduledAt!).filter(Boolean),
    count,
  });

  const created: Post[] = [];
  for (let i = 0; i < count; i++) {
    const recentPosts = await prisma.post.findMany({
      where: { userId, status: { not: "REJECTED" } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { title: true, summary: true, cta: true },
    });

    const output = await generatePostContent({
      profile,
      settings,
      products: selectedProducts,
      sourceType: request.sourceType,
      topic: request.topic,
      recentPosts,
      websiteSummary: profile.websiteSummary,
    });

    const scheduledAt = slots[i] ?? null;
    const data: Prisma.PostCreateInput = {
      user: { connect: { id: userId } },
      title: output.title,
      summary: output.summary,
      body: output.body,
      cta: output.cta,
      hashtags: output.hashtags,
      status: request.markPendingApproval ? "PENDING_APPROVAL" : "DRAFT",
      sourceType: request.sourceType,
      topic: request.topic ?? null,
      productIds: selectedProducts.map((p) => p.id),
      scheduledAt,
      image: {
        create: {
          imagePrompt: output.imagePrompt,
          imageStatus: "PENDING",
        },
      },
    };
    if (selectedProducts[0]) {
      data.product = { connect: { id: selectedProducts[0].id } };
    }

    const post = await prisma.post.create({ data });

    if (scheduledAt) {
      await prisma.publicationSchedule.create({
        data: { userId, postId: post.id, plannedAt: scheduledAt, source: request.source ?? "manual" },
      });
    }
    created.push(post);
  }

  return created;
}

/**
 * Vult de kalender aan tot de planningshorizon, met afwisseling van producten
 * en onderwerpen en zonder dubbele posts op dezelfde dag.
 */
export async function fillCalendar(userId: string, source: "auto-fill" | "cron"): Promise<Post[]> {
  const settings = await prisma.contentSettings.findUnique({ where: { userId } });
  if (!settings) throw new Error("Contentinstellingen ontbreken.");

  const horizon = new Date(Date.now() + settings.planAheadDays * 86_400_000);
  const scheduledCount = await prisma.post.count({
    where: {
      userId,
      scheduledAt: { gte: new Date(), lte: horizon },
      status: { notIn: ["REJECTED", "FAILED"] },
    },
  });
  const target = Math.floor(settings.planAheadDays / Math.max(settings.frequencyDays, 1));
  const needed = Math.max(0, target - scheduledCount);
  if (needed === 0) return [];

  const activeProducts = await prisma.product.findMany({ where: { userId, active: true } });

  // Wissel af: producten om en om, met af en toe een bedrijfspost ertussen.
  const recentProductIds = (
    await prisma.post.findMany({
      where: { userId, productId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: activeProducts.length,
      select: { productId: true },
    })
  ).map((p) => p.productId);

  const rotation = [...activeProducts].sort((a, b) => {
    const ai = recentProductIds.indexOf(a.id);
    const bi = recentProductIds.indexOf(b.id);
    // Producten die het langst niet aan bod kwamen eerst.
    return (ai === -1 ? -1 : ai) > (bi === -1 ? -1 : bi) ? -1 : 1;
  });

  const created: Post[] = [];
  for (let i = 0; i < needed; i++) {
    const useCompanyPost = activeProducts.length === 0 || i % 3 === 2;
    const product = useCompanyPost ? undefined : rotation[i % Math.max(rotation.length, 1)];
    const posts = await generatePosts({
      userId,
      sourceType: useCompanyPost || !product ? "COMPANY" : "PRODUCT",
      productIds: product ? [product.id] : [],
      count: 1,
      source,
      markPendingApproval: true,
    });
    created.push(...posts);
  }
  return created;
}
