/**
 * linkedinAuthService — OAuth 2.0 koppeling met de officiële LinkedIn API.
 *
 * Gebruikt uitsluitend de officiële OAuth-flow en API's van LinkedIn:
 * - Authorization Code flow (https://learn.microsoft.com/linkedin/shared/authentication/authorization-code-flow)
 * - Scopes voor het persoonlijke profiel: openid profile w_member_social
 * - Scopes voor de bedrijfspagina (Community Management API):
 *   w_organization_social (posten namens de organisatie) en
 *   r_organization_admin (controleren dat de gebruiker beheerder is).
 *
 * Geen browser-automatisering, geen scraping; alleen de officiële koppeling.
 */

import {
  getLinkedInApiVersion,
  getLinkedInOrganizationId,
  organizationUrn,
} from "@/lib/services/linkedin/linkedinConfig";

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const REST_BASE_URL = "https://api.linkedin.com/rest";

export interface LinkedInTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export interface LinkedInProfile {
  /** member URN, bijv. "urn:li:person:abc123" */
  memberUrn: string;
  name?: string;
}

export interface LinkedInOrganization {
  /** bijv. "urn:li:organization:110094547" */
  urn: string;
  name: string | null;
  /** null = beheerdersrol kon niet worden gecontroleerd (scope ontbreekt / API-fout). */
  isAdministrator: boolean | null;
  warning?: string;
}

export function isLinkedInConfigured(): boolean {
  return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

/**
 * De redirect-URL die LinkedIn exact geregistreerd moet hebben. Gebaseerd op
 * NEXTAUTH_URL, zodat lokaal en productie elk hun eigen (geregistreerde) URL
 * gebruiken.
 */
export function getRedirectUri(): string {
  const base = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/api/integrations/linkedin/callback`;
}

/**
 * De OAuth-scopes die worden aangevraagd. Met een geconfigureerde
 * bedrijfspagina komen de organisatie-scopes erbij; die vereisen dat het
 * product "Community Management API" op de LinkedIn-app is geactiveerd.
 * Met LINKEDIN_OAUTH_SCOPES kun je de lijst volledig overschrijven.
 */
export function getOAuthScopes(): string[] {
  const override = process.env.LINKEDIN_OAUTH_SCOPES?.trim();
  if (override) return override.split(/[\s,]+/).filter(Boolean);
  const scopes = ["openid", "profile", "w_member_social"];
  if (getLinkedInOrganizationId()) scopes.push("w_organization_social", "r_organization_admin");
  return scopes;
}

/** Bouwt de URL waar de gebruiker naartoe wordt gestuurd om de koppeling goed te keuren. */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    redirect_uri: getRedirectUri(),
    scope: getOAuthScopes().join(" "),
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/** Wisselt de authorization code in voor tokens. */
export async function exchangeCodeForTokens(code: string): Promise<LinkedInTokens> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
      client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
      redirect_uri: getRedirectUri(),
    }),
  });
  if (!response.ok) {
    throw new Error(`LinkedIn token-uitwisseling mislukt (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/** Haalt het member-URN op van het gekoppelde LinkedIn-account. */
export async function fetchProfile(accessToken: string): Promise<LinkedInProfile> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`LinkedIn profiel ophalen mislukt (${response.status})`);
  }
  const data = (await response.json()) as { sub: string; name?: string };
  return { memberUrn: `urn:li:person:${data.sub}`, name: data.name };
}

/** Standaard-headers voor de versioned LinkedIn REST API. */
export function restHeaders(accessToken: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": getLinkedInApiVersion(),
    ...extra,
  };
}

/**
 * Controleert de geconfigureerde bedrijfspagina voor het gekoppelde account:
 * - beheerdersrol via organizationAcls (q=roleAssignee)
 * - naam van de pagina via de Organization Lookup API
 *
 * Geeft null terug als er geen bedrijfspagina geconfigureerd is. Faalt de
 * rolcontrole om technische redenen (bijv. scope niet toegekend), dan wordt
 * dat als waarschuwing teruggegeven zodat de koppeling niet onnodig blokkeert.
 */
export async function resolveOrganization(accessToken: string): Promise<LinkedInOrganization | null> {
  const organizationId = getLinkedInOrganizationId();
  if (!organizationId) return null;

  const urn = organizationUrn(organizationId);
  const result: LinkedInOrganization = { urn, name: null, isAdministrator: null };

  try {
    const aclResponse = await fetch(
      `${REST_BASE_URL}/organizationAcls?q=roleAssignee&state=APPROVED&count=100`,
      { headers: restHeaders(accessToken) },
    );
    if (aclResponse.ok) {
      const data = (await aclResponse.json()) as {
        elements?: { organization?: string; organizationTarget?: string; role?: string; state?: string }[];
      };
      const postingRoles = new Set(["ADMINISTRATOR", "CONTENT_ADMINISTRATOR", "DIRECT_SPONSORED_CONTENT_POSTER"]);
      result.isAdministrator = (data.elements ?? []).some(
        (el) =>
          (el.organization === urn || el.organizationTarget === urn) &&
          (!el.role || postingRoles.has(el.role)),
      );
    } else {
      result.warning = `Beheerdersrol kon niet worden gecontroleerd (organizationAcls gaf ${aclResponse.status}).`;
    }
  } catch (err) {
    result.warning = `Beheerdersrol kon niet worden gecontroleerd: ${err instanceof Error ? err.message : String(err)}`;
  }

  try {
    const orgResponse = await fetch(`${REST_BASE_URL}/organizations/${organizationId}`, {
      headers: restHeaders(accessToken),
    });
    if (orgResponse.ok) {
      const data = (await orgResponse.json()) as { localizedName?: string; vanityName?: string };
      result.name = data.localizedName ?? data.vanityName ?? null;
    }
  } catch {
    // Naam is puur cosmetisch; zonder naam tonen we het id.
  }

  return result;
}
