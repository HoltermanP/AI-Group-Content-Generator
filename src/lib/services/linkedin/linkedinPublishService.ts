import type { IntegrationAccount, Post, PostImage } from "@prisma/client";
import { isLinkedInConfigured } from "@/lib/services/linkedin/linkedinAuthService";

/**
 * linkedinPublishService — publiceert goedgekeurde posts via de officiële
 * LinkedIn API (w_member_social): UGC Posts voor de post zelf en de Assets
 * API voor het meesturen van de afbeelding.
 *
 * Modulair opgezet: zolang de LinkedIn-app niet geconfigureerd is, draait de
 * service in stub-modus en wordt er niets daadwerkelijk gepubliceerd. De
 * aanroepende code (publishing.ts) bewaakt dat alléén goedgekeurde posts
 * deze service bereiken.
 */

const UGC_POSTS_URL = "https://api.linkedin.com/v2/ugcPosts";
const REGISTER_UPLOAD_URL = "https://api.linkedin.com/v2/assets?action=registerUpload";

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
 * Publiceert de post op LinkedIn. Als de post een gegenereerde afbeelding
 * heeft, wordt die via de officiële Assets API geüpload en meegestuurd.
 * Lukt de afbeeldingsupload niet, dan wordt de post als tekstpost geplaatst
 * (beter een post zonder beeld dan geen post) en staat dat in de melding.
 */
export async function publishPost(
  account: IntegrationAccount | null,
  post: Post & { image?: PostImage | null },
): Promise<PublishResult> {
  if (!isPublishAvailable(account) || !account) {
    return {
      success: false,
      provider: "stub",
      message:
        "LinkedIn-integratie is niet actief of niet geconfigureerd. Koppel LinkedIn via Instellingen → Integraties.",
    };
  }

  const text = [post.body, post.hashtags.join(" ")].filter(Boolean).join("\n\n");

  // Afbeelding uploaden als die er is; bij mislukking door met tekst-only.
  let assetUrn: string | null = null;
  let imageNote = "";
  const imageUrl = post.image?.imageStatus === "COMPLETED" ? post.image.imageUrl : null;
  if (imageUrl) {
    try {
      assetUrn = await uploadImage(account, imageUrl);
    } catch (err) {
      imageNote = ` (afbeelding kon niet worden meegestuurd: ${err instanceof Error ? err.message : String(err)})`;
    }
  }

  const payload = {
    author: account.providerAccountId,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: assetUrn ? "IMAGE" : "NONE",
        ...(assetUrn
          ? {
              media: [
                {
                  status: "READY",
                  media: assetUrn,
                  title: { text: post.title.slice(0, 200) },
                },
              ],
            }
          : {}),
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
      message: assetUrn
        ? "Post met afbeelding gepubliceerd via LinkedIn."
        : `Post gepubliceerd via LinkedIn${imageNote || " (zonder afbeelding)"}.`,
    };
  } catch (err) {
    return {
      success: false,
      provider: "linkedin",
      message: `Publicatie mislukt: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Uploadt de afbeelding naar LinkedIn via de officiële Assets API:
 * registerUpload → binary PUT → asset-URN voor gebruik in de UGC-post.
 */
async function uploadImage(account: IntegrationAccount, imageUrl: string): Promise<string> {
  // 1. Afbeelding ophalen.
  const imageBuffer = await fetchImageBuffer(imageUrl);

  // 2. Upload registreren.
  const registerResponse = await fetch(REGISTER_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: account.providerAccountId,
        serviceRelationships: [
          { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
        ],
      },
    }),
  });
  if (!registerResponse.ok) {
    throw new Error(`registerUpload gaf status ${registerResponse.status}`);
  }
  const registerData = (await registerResponse.json()) as {
    value: {
      asset: string;
      uploadMechanism: Record<string, { uploadUrl: string }>;
    };
  };
  const uploadUrl = Object.values(registerData.value.uploadMechanism)[0]?.uploadUrl;
  if (!uploadUrl) throw new Error("geen uploadUrl ontvangen van LinkedIn");

  // 3. Binary uploaden.
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(imageBuffer),
  });
  if (!uploadResponse.ok && uploadResponse.status !== 201) {
    throw new Error(`upload gaf status ${uploadResponse.status}`);
  }

  return registerData.value.asset;
}

/**
 * Haalt de afbeeldingsbytes op. Afbeeldingen in een privé Blob-store
 * (opgeslagen als /api/images/...) worden direct uit Blob gelezen; overige
 * relatieve paden worden geabsolutiseerd met de app-URL.
 */
async function fetchImageBuffer(imageUrl: string): Promise<Buffer> {
  if (imageUrl.startsWith("/api/images/") && process.env.BLOB_READ_WRITE_TOKEN) {
    const pathname = imageUrl.replace("/api/images/", "");
    const { get } = await import("@vercel/blob");
    const result = await get(pathname, { access: "private" });
    if (!result?.stream) throw new Error("afbeelding niet gevonden in Blob-opslag");
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }

  const absolute = imageUrl.startsWith("http")
    ? imageUrl
    : `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}${imageUrl}`;
  const response = await fetch(absolute);
  if (!response.ok) throw new Error(`afbeelding ophalen mislukt (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}
