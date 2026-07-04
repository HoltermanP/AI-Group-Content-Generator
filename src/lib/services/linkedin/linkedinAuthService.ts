/**
 * linkedinAuthService — OAuth 2.0 koppeling met de officiële LinkedIn API.
 *
 * Gebruikt uitsluitend de officiële OAuth-flow en API's van LinkedIn:
 * - Authorization Code flow (https://learn.microsoft.com/linkedin/shared/authentication/authorization-code-flow)
 * - Scopes: openid profile w_member_social
 *
 * Geen browser-automatisering, geen scraping; alleen de officiële koppeling.
 */

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

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

/** Bouwt de URL waar de gebruiker naartoe wordt gestuurd om de koppeling goed te keuren. */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    redirect_uri: getRedirectUri(),
    scope: "openid profile w_member_social",
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
