export { default } from "next-auth/middleware";

/**
 * Beschermt de hele applicatie behalve de auth-pagina's, NextAuth-routes,
 * cron-routes (eigen secret-check), extensie-routes (eigen Bearer-token-check;
 * /api/extension/token valideert daarbinnen alsnog de sessie) en statische
 * bestanden.
 */
export const config = {
  matcher: [
    "/((?!api/auth|api/register|api/cron|api/extension|api/images|login|register|_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
