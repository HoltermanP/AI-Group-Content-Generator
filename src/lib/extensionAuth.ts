import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "@/lib/auth";

/**
 * Authenticatie voor de Chrome-extensie.
 *
 * De extensie krijgt een persoonlijk token (eenmalig getoond in de app).
 * In de database staat alleen de SHA-256-hash; het token zelf is dus niet
 * terug te lezen, ook niet door de app zelf.
 */

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateExtensionToken(): string {
  return `aigx_${randomBytes(24).toString("hex")}`;
}

/** Leest het Bearer-token uit het request en geeft het bijbehorende userId terug. */
export async function requireExtensionUserId(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token || !token.startsWith("aigx_")) throw new UnauthorizedError();

  const user = await prisma.user.findUnique({
    where: { extensionTokenHash: hashToken(token) },
    select: { id: true },
  });
  if (!user) throw new UnauthorizedError();
  return user.id;
}

/**
 * CORS-headers voor de extensie-routes. De extensie authenticeert met een
 * Bearer-token (geen cookies), dus een ruime origin is hier veilig.
 */
export const EXTENSION_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
} as const;

export function corsPreflightResponse(): Response {
  return new Response(null, { status: 204, headers: EXTENSION_CORS_HEADERS });
}
