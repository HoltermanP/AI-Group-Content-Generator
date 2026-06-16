import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/auth";

/**
 * Uniforme foutafhandeling voor API-routes:
 * - 401 bij niet ingelogd
 * - 400 bij validatiefouten (Zod)
 * - 500 met nette melding bij overige fouten (zonder interne details te lekken)
 */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validatiefout", details: err.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const message = err instanceof Error ? err.message : "Onbekende fout";
  console.error("[api]", err);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function notFound(resource = "Item"): NextResponse {
  return NextResponse.json({ error: `${resource} niet gevonden` }, { status: 404 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
