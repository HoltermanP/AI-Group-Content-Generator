import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLinkedInConfigured } from "@/lib/services/linkedin/linkedinAuthService";
import { IntegrationsClient } from "./integrations-client";

export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const [account, user] = await Promise.all([
    prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId, provider: "linkedin" } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { extensionTokenHash: true } }),
  ]);

  const lastPublished = await prisma.post.findFirst({
    where: { userId, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: { id: true, title: true, publishedAt: true },
  });

  // Let op: tokens worden bewust NIET naar de client gestuurd; alleen status.
  return (
    <IntegrationsClient
      configured={isLinkedInConfigured()}
      hasExtensionToken={Boolean(user?.extensionTokenHash)}
      account={
        account
          ? {
              active: account.active,
              hasToken: Boolean(account.accessToken),
              tokenExpiresAt: account.expiresAt?.toISOString() ?? null,
              lastError: account.lastError,
              lastPublishedAt: account.lastPublishedAt?.toISOString() ?? null,
            }
          : null
      }
      lastPublishedPost={
        lastPublished
          ? {
              id: lastPublished.id,
              title: lastPublished.title,
              publishedAt: lastPublished.publishedAt?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}
