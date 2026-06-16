import { NextResponse } from "next/server";
import {
  requireExtensionUserId,
  EXTENSION_CORS_HEADERS,
  corsPreflightResponse,
} from "@/lib/extensionAuth";
import { markManuallyPublished } from "@/lib/services/publishing";
import { handleApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return corsPreflightResponse();
}

/**
 * Markeert een post als gepubliceerd nadat de gebruiker hem zelf via de
 * LinkedIn-composer heeft geplaatst. Werkt alleen voor goedgekeurde posts
 * (afgedwongen in de publicatieservice).
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireExtensionUserId(request);
    const result = await markManuallyPublished(userId, params.id);
    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
      headers: EXTENSION_CORS_HEADERS,
    });
  } catch (err) {
    const response = handleApiError(err);
    for (const [key, value] of Object.entries(EXTENSION_CORS_HEADERS)) response.headers.set(key, value);
    return response;
  }
}
