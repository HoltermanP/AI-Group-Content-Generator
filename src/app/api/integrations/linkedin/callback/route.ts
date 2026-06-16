import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { exchangeCodeForTokens, fetchProfile } from "@/lib/services/linkedin/linkedinAuthService";

function redirectToIntegrations(request: Request, params: Record<string, string>): NextResponse {
  const url = new URL("/settings/integrations", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

/**
 * OAuth-callback van LinkedIn: wisselt de code in voor tokens en slaat de
 * koppeling op. Tokens blijven server-side en worden nooit naar de browser
 * gestuurd.
 */
export async function GET(request: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return redirectToIntegrations(request, { linkedin: "error", message: "Niet ingelogd" });
  }

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

    if (oauthError) return redirectToIntegrations(request, { linkedin: "error", message: oauthError });

    const expectedState = cookies().get("linkedin_oauth_state")?.value;
    cookies().delete("linkedin_oauth_state");
    if (!code || !state || !expectedState || state !== expectedState) {
      return redirectToIntegrations(request, { linkedin: "error", message: "Ongeldige OAuth-state" });
    }

    const tokens = await exchangeCodeForTokens(code);
    const profile = await fetchProfile(tokens.accessToken);

    await prisma.integrationAccount.upsert({
      where: { userId_provider: { userId, provider: "linkedin" } },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        providerAccountId: profile.memberUrn,
        active: true,
        lastError: null,
      },
      create: {
        userId,
        provider: "linkedin",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        providerAccountId: profile.memberUrn,
        active: true,
      },
    });

    return redirectToIntegrations(request, { linkedin: "connected" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return redirectToIntegrations(request, { linkedin: "error", message });
  }
}
