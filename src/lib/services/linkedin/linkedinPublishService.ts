import type { IntegrationAccount, Post } from "@prisma/client";
import { isLinkedInConfigured } from "@/lib/services/linkedin/linkedinAuthService";

/**
 * linkedinPublishService — publiceert goedgekeurde posts via de officiële
 * LinkedIn UGC Posts API (w_member_social).
 *
 * Modulair opgezet: zolang de LinkedIn-app niet geconfigureerd is, draait de
 * service in stub-modus en wordt er niets daadwerkelijk gepubliceerd. De
 * aanroepende code (publishing.ts) bewaakt dat alléén goedgekeurde posts
 * deze service bereiken.
 */

const UGC_POSTS_URL = "https://api.linkedin.com/v2/ugcPosts";

export interface PublishResult {
  success: boolean;
  externalId?: string;
  provider: "linkedin" | "stub";
  message: string;
}

export function isPublishAvailable(account: IntegrationAccount | null): boolean {
  return Boolean(
    isLinkedInConfigured() &&
      account?.active &&
      account.accessToken &&
      account.providerAccountId &&
      (!account.expiresAt || account.expiresAt > new Date()),
  );
}

/**
 * Publiceert de post als tekstpost op LinkedIn. De afbeelding wordt niet
 * automatisch meegestuurd; in de UI blijft de afbeelding downloadbaar zodat
 * deze desgewenst handmatig kan worden toegevoegd. (Asset-upload kan later
 * als uitbreiding aan deze service worden toegevoegd.)
 */
export async function publishPost(account: IntegrationAccount | null, post: Post): Promise<PublishResult> {
  if (!isPublishAvailable(account) || !account) {
    return {
      success: false,
      provider: "stub",
      message:
        "LinkedIn-integratie is niet actief of niet geconfigureerd. Gebruik de handmatige publicatieflow (kopiëren + afbeelding downloaden).",
    };
  }

  const text = [post.body, post.hashtags.join(" ")].filter(Boolean).join("\n\n");

  const payload = {
    author: account.providerAccountId,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  try {
    const response = await fetch(UGC_POSTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        provider: "linkedin",
        message: `LinkedIn API gaf status ${response.status}: ${body.slice(0, 500)}`,
      };
    }

    const externalId = response.headers.get("x-restli-id") ?? undefined;
    return {
      success: true,
      provider: "linkedin",
      externalId,
      message: "Post succesvol gepubliceerd via LinkedIn.",
    };
  } catch (err) {
    return {
      success: false,
      provider: "linkedin",
      message: `Publicatie mislukt: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
