import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { generatePostSchema } from "@/lib/validations";
import { generatePosts } from "@/lib/services/postGeneration";
import { handleApiError } from "@/lib/api";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const input = generatePostSchema.parse(await request.json());

    const posts = await generatePosts({
      userId,
      sourceType: input.sourceType,
      productIds: input.productIds,
      topic: input.topic,
      count: input.count,
      source: "manual",
    });

    return NextResponse.json({ posts }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
