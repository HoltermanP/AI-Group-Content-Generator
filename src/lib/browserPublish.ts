export interface BrowserPublishPayload {
  postId: string;
  text: string;
  imageUrl: string | null;
  /** Numeriek id van de LinkedIn-bedrijfspagina; null = persoonlijk profiel. */
  organizationId?: string | null;
  /** Vooraf berekende composer-URL (bijv. door de server); anders afgeleid van organizationId. */
  composerUrl?: string | null;
}

export function buildFullPostText(body: string, hashtags: string[]): string {
  const tags = hashtags.filter(Boolean).join(" ");
  return [body, tags].filter(Boolean).join("\n\n");
}

/** Kopieert een afbeelding naar het klembord zodat je die in LinkedIn kunt plakken. */
export async function copyImageToClipboard(imageUrl: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return false;
    const blob = await response.blob();
    const type = blob.type.startsWith("image/") ? blob.type : "image/png";
    await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * URL van de LinkedIn-composer.
 * - Bedrijfspagina: de beheerdersomgeving van de pagina, waar "Een post maken"
 *   de composer namens de organisatie opent (`share=true` opent die direct
 *   waar LinkedIn dat ondersteunt). Tekst kan hier niet via de URL worden
 *   voorgevuld; de Chrome-extensie of het klembord regelt dat.
 * - Persoonlijk profiel: de feed-composer met voorgevulde tekst.
 */
export function linkedInComposerUrl(text: string, organizationId?: string | null): string {
  if (organizationId) {
    return `https://www.linkedin.com/company/${organizationId}/admin/page-posts/published/?share=true`;
  }
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
}

/**
 * Opent LinkedIn (de bedrijfspagina als die geconfigureerd is) en zet de
 * inhoud klaar op het klembord. Als de Chrome-extensie is geïnstalleerd,
 * plaatst die tekst én afbeelding automatisch in de composer.
 *
 * Klembord: op de bedrijfspagina kan de tekst niet via de URL worden
 * voorgevuld, dus daar gaat de tekst op het klembord; op het persoonlijke
 * profiel staat de tekst al in de composer en gaat de afbeelding erop.
 */
export async function publishPostToLinkedIn(payload: BrowserPublishPayload): Promise<{
  textCopied: boolean;
  imageCopied: boolean;
  extensionNotified: boolean;
  asOrganization: boolean;
}> {
  const asOrganization = Boolean(payload.organizationId);
  const composerUrl = payload.composerUrl ?? linkedInComposerUrl(payload.text, payload.organizationId);

  let textCopied = false;
  let imageCopied = false;
  if (asOrganization) {
    textCopied = await copyTextToClipboard(payload.text);
  } else if (payload.imageUrl) {
    imageCopied = await copyImageToClipboard(payload.imageUrl);
  }

  const extensionNotified = dispatchExtensionPublish({ ...payload, composerUrl });

  window.open(composerUrl, "_blank", "noopener,noreferrer");

  return { textCopied, imageCopied, extensionNotified, asOrganization };
}

/** Stuurt een signaal naar de Chrome-extensie (app-bridge content script). */
export function dispatchExtensionPublish(payload: BrowserPublishPayload): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.dispatchEvent(
      new CustomEvent("aigroup-linkedin-publish", {
        detail: payload,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
