import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireExtensionUserId,
  EXTENSION_CORS_HEADERS,
  corsPreflightResponse,
} from "@/lib/extensionAuth";
import { handleApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return corsPreflightResponse();
}

/**
 * Goedgekeurde posts die klaarstaan om gepubliceerd te worden, voor de
 * Chrome-extensie (publicatie-assistent).
 */
export async function GET(request: Request) {
  try {
    const userId = await requireExtensionUserId(request);

    const posts = await prisma.post.findMany({
      where: { userId, status: "APPROVED" },
      include: { image: { select: { imageUrl: true, imageStatus: true } } },
      orderBy: [{ scheduledAt: "asc" }, { approvedAt: "asc" }],
      take: 25,
    });

    const origin = new URL(request.url).origin;

    return NextResponse.json(
      {
        posts: posts.map((post) => ({
          id: post.id,
          title: post.title,
          body: post.body,
          hashtags: post.hashtags,
          fullText: [post.body, post.hashtags.join(" ")].filter(Boolean).join("\n\n"),
          scheduledAt: post.scheduledAt?.toISOString() ?? null,
          imageUrl: post.image?.imageUrl
            ? post.image.imageUrl.startsWith("http")
              ? post.image.imageUrl
              : `${origin}${post.image.imageUrl}`
            : null,
        })),
      },
      { headers: EXTENSION_CORS_HEADERS },
    );
  } catch (err) {
    const response = handleApiError(err);
    for (const [key, value] of Object.entries(EXTENSION_CORS_HEADERS)) response.headers.set(key, value);
    return response;
  }
}
