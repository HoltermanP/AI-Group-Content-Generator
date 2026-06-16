import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { requireUserId } from "@/lib/auth";
import { getAuthorizationUrl, isLinkedInConfigured } from "@/lib/services/linkedin/linkedinAuthService";
import { handleApiError, badRequest } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Start de officiële LinkedIn OAuth-flow. De gebruiker wordt doorgestuurd
 * naar LinkedIn om de koppeling expliciet goed te keuren.
 */
export async function GET() {
  try {
    await requireUserId();
    if (!isLinkedInConfigured()) {
      return badRequest(
        "LinkedIn is niet geconfigureerd. Stel LINKEDIN_CLIENT_ID en LINKEDIN_CLIENT_SECRET in.",
      );
    }

    const state = randomBytes(16).toString("hex");
    cookies().set("linkedin_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });

    return NextResponse.redirect(getAuthorizationUrl(state));
  } catch (err) {
    return handleApiError(err);
  }
}
