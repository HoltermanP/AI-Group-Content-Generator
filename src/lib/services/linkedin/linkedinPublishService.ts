import type { IntegrationAccount, Post, PostImage } from "@prisma/client";
import { isLinkedInConfigured, restHeaders } from "@/lib/services/linkedin/linkedinAuthService";
import { getLinkedInOrganizationId, organizationUrn } from "@/lib/services/linkedin/linkedinConfig";

/**
 * linkedinPublishService — publiceert goedgekeurde posts via de officiële,
 * versioned LinkedIn API (Community Management API):
 * - Posts API (/rest/posts) voor de post zelf, met als auteur de
 *   bedrijfspagina van AI-Group (urn:li:organization:…) of, als er geen
 *   bedrijfspagina geconfigureerd is, het persoonlijke profiel.
 * - Images API (/rest/images) voor het meesturen van de afbeelding.
 *
 * Modulair opgezet: zolang de LinkedIn-app niet geconfigureerd is, draait de
 * service in stub-modus en wordt er niets daadwerkelijk gepubliceerd. De
 * aanroepende code (publishing.ts) bewaakt dat alléén goedgekeurde posts
 * deze service bereiken.
 */

const POSTS_URL = "https://api.linkedin.com/rest/posts";
const INITIALIZE_IMAGE_UPLOAD_URL = "https://api.linkedin.com/rest/images?action=initializeUpload";

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
 * Bepaalt namens wie er gepubliceerd wordt. Is er een bedrijfspagina
 * geconfigureerd, dan moet de koppeling daarvoor ook geautoriseerd zijn
 * (organizationUrn op het account); anders is opnieuw koppelen nodig.
 */
export function resolveAuthor(
  account: IntegrationAccount,
): { authorUrn: string; label: string } | { error: string } {
  const configuredId = getLinkedInOrganizationId();
  if (!configuredId) {
    return { authorUrn: account.providerAccountId!, label: "persoonlijk profiel" };
  }
  const expected = organizationUrn(configuredId);
  if (account.organizationUrn !== expected) {
    return {
      error:
        "De LinkedIn-koppeling is nog niet geautoriseerd voor de bedrijfspagina. Koppel LinkedIn opnieuw via Instellingen → Integraties.",
    };
  }
  return { authorUrn: expected, label: account.organizationName ?? `bedrijfspagina ${configuredId}` };
}

/**
 * Publiceert de post op LinkedIn namens de bedrijfspagina. Als de post een
 * gegenereerde afbeelding heeft, wordt die via de officiële Images API
 * geüpload en meegestuurd. Lukt de afbeeldingsupload niet, dan wordt de post
 * als tekstpost geplaatst (beter een post zonder beeld dan geen post) en
 * staat dat in de melding.
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

  const author = resolveAuthor(account);
  if ("error" in author) {
    return { success: false, provider: "stub", message: author.error };
  }

  const text = [post.body, post.hashtags.join(" ")].filter(Boolean).join("\n\n");

  // Afbeelding uploaden als die er is; bij mislukking door met tekst-only.
  let imageUrn: string | null = null;
  let imageNote = "";
  const imageUrl = post.image?.imageStatus === "COMPLETED" ? post.image.imageUrl : null;
  if (imageUrl) {
    try {
      imageUrn = await uploadImage(account.accessToken!, author.authorUrn, imageUrl);
    } catch (err) {
      imageNote = ` (afbeelding kon niet worden meegestuurd: ${err instanceof Error ? err.message : String(err)})`;
    }
  }

  const payload = {
    author: author.authorUrn,
    commentary: toLittleText(text),
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    ...(imageUrn
      ? {
          content: {
            media: {
              id: imageUrn,
              title: post.title.slice(0, 200),
              altText: post.summary.slice(0, 120),
            },
          },
        }
      : {}),
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  try {
    const response = await fetch(POSTS_URL, {
      method: "POST",
      headers: restHeaders(account.accessToken!, { "Content-Type": "application/json" }),
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
      message: imageUrn
        ? `Post met afbeelding gepubliceerd op LinkedIn namens ${author.label}.`
        : `Post gepubliceerd op LinkedIn namens ${author.label}${imageNote || " (zonder afbeelding)"}.`,
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
 * Zet platte tekst om naar LinkedIn's "little text format" voor het
 * commentary-veld. Gereserveerde tekens worden ge-escaped zodat ze letterlijk
 * worden getoond; hashtags (#woord) blijven staan zodat LinkedIn ze herkent.
 */
export function toLittleText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/[|{}@[\]()<>*_~]/g, (char) => `\\${char}`)
    .replace(/#(?![\w\u00C0-\u024F])/g, "\\#");
}

/**
 * Uploadt de afbeelding naar LinkedIn via de officiële Images API:
 * initializeUpload → binary PUT → image-URN voor gebruik in de post.
 * De eigenaar van de afbeelding is dezelfde als de auteur van de post.
 */
async function uploadImage(accessToken: string, ownerUrn: string, imageUrl: string): Promise<string> {
  // 1. Afbeelding ophalen.
  const imageBuffer = await fetchImageBuffer(imageUrl);

  // 2. Upload registreren.
  const initResponse = await fetch(INITIALIZE_IMAGE_UPLOAD_URL, {
    method: "POST",
    headers: restHeaders(accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
  });
  if (!initResponse.ok) {
    throw new Error(`initializeUpload gaf status ${initResponse.status}`);
  }
  const initData = (await initResponse.json()) as {
    value: { uploadUrl: string; image: string };
  };
  const { uploadUrl, image } = initData.value ?? {};
  if (!uploadUrl || !image) throw new Error("geen uploadUrl ontvangen van LinkedIn");

  // 3. Binary uploaden.
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(imageBuffer),
  });
  if (!uploadResponse.ok && uploadResponse.status !== 201) {
    throw new Error(`upload gaf status ${uploadResponse.status}`);
  }

  return image;
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
