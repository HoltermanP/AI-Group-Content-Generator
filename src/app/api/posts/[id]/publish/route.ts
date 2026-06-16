import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { publishApprovedPost, markManuallyPublished } from "@/lib/services/publishing";
import { handleApiError, badRequest } from "@/lib/api";

export const maxDuration = 60;

const publishSchema = z.object({
  mode: z.enum(["linkedin", "manual"]),
});

/**
 * Publiceert een goedgekeurde post:
 * - mode "linkedin": via de officiële LinkedIn API (alleen als integratie actief is)
 * - mode "manual": markeert de post als handmatig gepubliceerd
 *
 * De publicatieservice weigert alles wat niet de status APPROVED heeft.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const { mode } = publishSchema.parse(await request.json());

    const result =
      mode === "linkedin"
        ? await publishApprovedPost(userId, params.id)
        : await markManuallyPublished(userId, params.id);

    if (!result.success) return badRequest(result.message);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
