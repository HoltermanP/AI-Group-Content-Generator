import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { fillCalendar } from "@/lib/services/postGeneration";
import { handleApiError } from "@/lib/api";

export const maxDuration = 300;

/**
 * "Vul kalender automatisch aan": genereert posts volgens de ingestelde
 * frequentie tot de planningshorizon gevuld is.
 */
export async function POST() {
  try {
    const userId = await requireUserId();
    const created = await fillCalendar(userId, "auto-fill");
    return NextResponse.json({ created: created.length });
  } catch (err) {
    return handleApiError(err);
  }
}
