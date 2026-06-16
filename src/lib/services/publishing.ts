import { prisma } from "@/lib/prisma";
import { publishPost } from "@/lib/services/linkedin/linkedinPublishService";

/**
 * Publicatieservice met de goedkeuringsgarantie van de applicatie:
 * een post wordt ALLEEN gepubliceerd als status APPROVED is.
 * Elke poging wordt gelogd in PublicationLog.
 */
export async function publishApprovedPost(
  userId: string,
  postId: string,
): Promise<{ success: boolean; message: string }> {
  const post = await prisma.post.findFirst({ where: { id: postId, userId } });
  if (!post) return { success: false, message: "Post niet gevonden." };

  if (post.status !== "APPROVED") {
    await prisma.publicationLog.create({
      data: {
        userId,
        postId,
        provider: "linkedin",
        status: "skipped",
        message: `Publicatie geweigerd: post heeft status ${post.status}, alleen goedgekeurde posts worden gepubliceerd.`,
      },
    });
    return { success: false, message: "Alleen goedgekeurde posts kunnen worden gepubliceerd." };
  }

  const account = await prisma.integrationAccount.findUnique({
    where: { userId_provider: { userId, provider: "linkedin" } },
  });

  const result = await publishPost(account, post);

  // "stub" betekent: integratie niet beschikbaar/geconfigureerd. Dat is geen
  // mislukte publicatiepoging — de post blijft goedgekeurd zodat de handmatige
  // flow (kopiëren + downloaden) gewoon blijft werken.
  const skipped = !result.success && result.provider === "stub";

  await prisma.publicationLog.create({
    data: {
      userId,
      postId,
      provider: result.provider,
      status: result.success ? "success" : skipped ? "skipped" : "failed",
      message: result.message,
      externalId: result.externalId,
    },
  });

  if (skipped) {
    return { success: false, message: result.message };
  }

  if (result.success) {
    await prisma.post.update({
      where: { id: postId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    if (account) {
      await prisma.integrationAccount.update({
        where: { id: account.id },
        data: { lastPublishedAt: new Date(), lastError: null },
      });
    }
  } else {
    await prisma.post.update({ where: { id: postId }, data: { status: "FAILED" } });
    if (account) {
      await prisma.integrationAccount.update({
        where: { id: account.id },
        data: { lastError: result.message },
      });
    }
  }

  return { success: result.success, message: result.message };
}

/**
 * Markeert een goedgekeurde post als handmatig gepubliceerd (gebruiker heeft
 * de tekst gekopieerd en zelf op LinkedIn geplaatst).
 */
export async function markManuallyPublished(
  userId: string,
  postId: string,
): Promise<{ success: boolean; message: string }> {
  const post = await prisma.post.findFirst({ where: { id: postId, userId } });
  if (!post) return { success: false, message: "Post niet gevonden." };
  if (post.status !== "APPROVED") {
    return { success: false, message: "Alleen goedgekeurde posts kunnen als gepubliceerd worden gemarkeerd." };
  }

  await prisma.$transaction([
    prisma.post.update({
      where: { id: postId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    }),
    prisma.publicationLog.create({
      data: {
        userId,
        postId,
        provider: "manual",
        status: "success",
        message: "Handmatig gepubliceerd (gekopieerd en zelf op LinkedIn geplaatst).",
      },
    }),
  ]);

  return { success: true, message: "Post gemarkeerd als gepubliceerd." };
}
