/**
 * linkedinConfig — centrale configuratie voor publiceren namens de
 * LinkedIn-bedrijfspagina van AI-Group.
 *
 * De bedrijfspagina wordt geïdentificeerd met het numerieke organisatie-id
 * uit de admin-URL (https://www.linkedin.com/company/<id>/admin/dashboard/).
 * Standaard is dat de AI-Group pagina; via LINKEDIN_ORGANIZATION_ID kun je
 * dat overschrijven, of met de waarde "personal" op het persoonlijke profiel
 * publiceren.
 */

export const DEFAULT_LINKEDIN_ORGANIZATION_ID = "110094547";

/** Versie van de LinkedIn Marketing/Community Management API (formaat YYYYMM). */
export function getLinkedInApiVersion(): string {
  return (process.env.LINKEDIN_API_VERSION || "202606").trim();
}

/**
 * Het organisatie-id van de bedrijfspagina waarop gepubliceerd wordt, of
 * null als er op het persoonlijke profiel gepubliceerd moet worden.
 * Accepteert een kaal id, een URN (urn:li:organization:123) of de admin-URL.
 */
export function getLinkedInOrganizationId(): string | null {
  const raw = (process.env.LINKEDIN_ORGANIZATION_ID ?? DEFAULT_LINKEDIN_ORGANIZATION_ID).trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === "none" || lower === "personal" || lower === "persoonlijk") return null;
  const match = raw.match(/(\d{3,})/);
  return match ? match[1] : null;
}

export function organizationUrn(organizationId: string): string {
  return `urn:li:organization:${organizationId}`;
}

export function organizationIdFromUrn(urn: string | null | undefined): string | null {
  if (!urn) return null;
  const match = urn.match(/urn:li:organization:(\d+)/);
  return match ? match[1] : null;
}

/** Admin-dashboard van de bedrijfspagina (voor links in de UI). */
export function organizationAdminUrl(organizationId: string): string {
  return `https://www.linkedin.com/company/${organizationId}/admin/dashboard/`;
}

/** Publieke pagina van de organisatie. */
export function organizationPageUrl(organizationId: string): string {
  return `https://www.linkedin.com/company/${organizationId}/`;
}
