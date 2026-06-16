export interface BrowserPublishPayload {
  postId: string;
  text: string;
  imageUrl: string | null;
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

export function linkedInComposerUrl(text: string): string {
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
}

/**
 * Opent LinkedIn met vooraf ingevulde tekst en zet de afbeelding op het klembord.
 * Als de Chrome-extensie is geïnstalleerd, vraagt die ook om de afbeelding in de composer te plaatsen.
 */
export async function publishPostToLinkedIn(payload: BrowserPublishPayload): Promise<{
  imageCopied: boolean;
  extensionNotified: boolean;
}> {
  let imageCopied = false;
  if (payload.imageUrl) {
    imageCopied = await copyImageToClipboard(payload.imageUrl);
  }

  const extensionNotified = dispatchExtensionPublish(payload);

  window.open(linkedInComposerUrl(payload.text), "_blank", "noopener,noreferrer");

  return { imageCopied, extensionNotified };
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
