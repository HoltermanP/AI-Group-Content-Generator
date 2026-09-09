import type { Post, PostSourceType, Prisma, WebsiteCase } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generatePostContent } from "@/lib/ai/textService";
import { generateImage } from "@/lib/ai/imageService";
import { computeNextSlots } from "@/lib/services/scheduling";
import { listWebsiteCases, pickNextWebsiteCase, syncWebsiteCases } from "@/lib/services/websiteCases";

export interface GenerationRequest {
  userId: string;
  sourceType: PostSourceType;
  productIds?: string[];
  topic?: string;
  /** Case van de website als bron (sourceType CASE). */
  websiteCaseId?: string;
  count?: number;
  /** "manual" voor de generator-pagina, "auto-fill" voor de kalender, "cron" voor de achtergrondtaak */
  source?: string;
  /** Posts die via cron/auto-fill ontstaan krijgen status PENDING_APPROVAL i.p.v. DRAFT */
  markPendingApproval?: boolean;
  /** Volledig automatische modus: post direct goedkeuren (geen handmatige controle) */
  autoApprove?: boolean;
  /** Direct na het genereren ook de afbeelding maken (nodig voor autonome publicatie) */
  generateImages?: boolean;
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

  // Cases van de website: als feitelijke bron voor een case-post én als
  // context (echte voorbeelden met link) bij de overige posts.
  const websiteCase =
    request.sourceType === "CASE" && request.websiteCaseId
      ? await prisma.websiteCase.findFirst({ where: { id: request.websiteCaseId, userId } })
      : null;
  if (request.sourceType === "CASE" && request.websiteCaseId && !websiteCase) {
    throw new Error("De gekozen case van de website is niet gevonden. Vernieuw de cases via Instellingen → Bedrijfsprofiel.");
  }
  const websiteCases = (await listWebsiteCases(userId)).map((c) => ({
    title: c.title,
    sector: c.sector,
    resultLine: c.resultLine,
    url: c.url,
  }));

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
      websiteCase,
      websiteCases,
    });
    if (websiteCase) output.body = ensureCaseLink(output.body, websiteCase);

    const scheduledAt = slots[i] ?? null;
    const status = request.autoApprove
      ? "APPROVED"
      : request.markPendingApproval
        ? "PENDING_APPROVAL"
        : "DRAFT";

    const data: Prisma.PostCreateInput = {
      user: { connect: { id: userId } },
      title: output.title,
      summary: output.summary,
      body: output.body,
      cta: output.cta,
      hashtags: output.hashtags,
      status,
      approvedAt: request.autoApprove ? new Date() : null,
      sourceType: request.sourceType,
      topic: request.topic ?? (websiteCase ? websiteCase.title : null),
      sourceUrl: websiteCase?.url ?? null,
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
    if (websiteCase) {
      data.websiteCase = { connect: { id: websiteCase.id } };
    }

    const post = await prisma.post.create({ data });

    if (websiteCase) {
      await prisma.websiteCase.update({ where: { id: websiteCase.id }, data: { lastUsedAt: new Date() } });
    }

    if (scheduledAt) {
      await prisma.publicationSchedule.create({
        data: { userId, postId: post.id, plannedAt: scheduledAt, source: request.source ?? "manual" },
      });
    }

    if (request.generateImages) {
      await generateImageForPost(post.id, output.imagePrompt);
    }

    created.push(post);
  }

  return created;
}

/**
 * Garandeert dat een case-post naar de case op de website linkt, ook als het
 * taalmodel de link is vergeten.
 */
export function ensureCaseLink(body: string, websiteCase: Pick<WebsiteCase, "url">): string {
  const bare = websiteCase.url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (body.includes(websiteCase.url) || body.includes(bare)) return body;
  return `${body.trimEnd()}\n\nLees de hele case: ${websiteCase.url}`;
}

/**
 * Genereert de afbeelding voor een post en werkt de status bij. Faalt stil
 * (met logging in het image-record) zodat een mislukte afbeelding het
 * genereren van posts nooit blokkeert; de publicatie-cron probeert het later
 * opnieuw.
 */
export async function generateImageForPost(postId: string, imagePrompt: string): Promise<boolean> {
  try {
    await prisma.postImage.update({
      where: { postId },
      data: { imageStatus: "GENERATING", errorMessage: null },
    });
    const result = await generateImage(imagePrompt, postId);
    await prisma.postImage.update({
      where: { postId },
      data: {
        imageUrl: result.url,
        imageProvider: result.provider,
        imageStatus: "COMPLETED",
        generatedAt: new Date(),
        errorMessage: null,
      },
    });
    return true;
  } catch (err) {
    await prisma.postImage
      .update({
        where: { postId },
        data: {
          imageStatus: "FAILED",
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      })
      .catch(() => undefined);
    return false;
  }
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
  // Begrens het aantal posts per run: met beeldgeneratie erbij (autonome modus)
  // kost één post al snel een minuut, en serverless functies hebben een
  // maximale looptijd. De dagelijkse cron vult het tekort in een paar runs aan.
  const perRunCap = settings.autoApprove ? 2 : 5;
  const needed = Math.min(Math.max(0, target - scheduledCount), perRunCap);
  if (needed === 0) return [];

  const activeProducts = await prisma.product.findMany({ where: { userId, active: true } });

  // Cases van de website (max. eens per 12 uur opnieuw ophalen; faalt stil).
  const profile = await prisma.companyProfile.findUnique({ where: { userId }, select: { websiteUrl: true } });
  const websiteCases = profile
    ? await syncWebsiteCases(userId, profile.websiteUrl).catch(() => listWebsiteCases(userId))
    : [];

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

  // Afwisseling over runs heen: kies telkens de soort post (case, product,
  // bedrijf) die in de recente posts het minst voorkomt. Zo komen de cases
  // van de website structureel terug, ook als de cron per run maar één of
  // twee posts maakt.
  const recentKinds = (
    await prisma.post.findMany({
      where: { userId, status: { not: "REJECTED" } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { sourceType: true },
    })
  ).map((p) => p.sourceType);
  const kindCounts: Record<"CASE" | "PRODUCT" | "COMPANY", number> = {
    CASE: recentKinds.filter((k) => k === "CASE").length,
    PRODUCT: recentKinds.filter((k) => k === "PRODUCT" || k === "MULTI_PRODUCT").length,
    COMPANY: recentKinds.filter((k) => k === "COMPANY").length,
  };
  const availableKinds: ("CASE" | "PRODUCT" | "COMPANY")[] = [
    ...(websiteCases.length > 0 ? (["CASE"] as const) : []),
    ...(activeProducts.length > 0 ? (["PRODUCT"] as const) : []),
    "COMPANY",
  ];

  const created: Post[] = [];
  let productIndex = 0;
  for (let i = 0; i < needed; i++) {
    const kind = [...availableKinds].sort((a, b) => kindCounts[a] - kindCounts[b])[0];
    kindCounts[kind] += 1;

    const product = kind === "PRODUCT" ? rotation[productIndex++ % Math.max(rotation.length, 1)] : undefined;
    const websiteCase = kind === "CASE" ? await pickNextWebsiteCase(userId) : null;
    const sourceType: PostSourceType = websiteCase ? "CASE" : product ? "PRODUCT" : "COMPANY";

    const posts = await generatePosts({
      userId,
      sourceType,
      productIds: product ? [product.id] : [],
      websiteCaseId: websiteCase?.id,
      count: 1,
      source,
      markPendingApproval: true,
      // Volledig automatische modus: direct goedkeuren en de afbeelding
      // meteen genereren, zodat de publicatie-cron ze zonder tussenkomst
      // kan plaatsen.
      autoApprove: settings.autoApprove,
      generateImages: settings.autoApprove,
    });
    created.push(...posts);
  }
  return created;
}
