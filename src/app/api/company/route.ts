import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { companyProfileSchema, toList } from "@/lib/validations";
import { handleApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireUserId();
    const profile = await prisma.companyProfile.findUnique({ where: { userId } });
    return NextResponse.json(profile);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await requireUserId();
    const input = companyProfileSchema.parse(await request.json());

    const data = {
      companyName: input.companyName,
      shortDescription: input.shortDescription,
      longDescription: input.longDescription,
      websiteUrl: input.websiteUrl,
      toneOfVoice: input.toneOfVoice,
      targetAudience: input.targetAudience,
      themes: toList(input.themes),
      defaultCta: input.defaultCta,
      forbiddenPhrases: toList(input.forbiddenPhrases),
      writingStyle: input.writingStyle,
      defaultHashtags: toList(input.defaultHashtags),
    };

    const profile = await prisma.companyProfile.upsert({
      where: { userId },
      update: data,
      create: { ...data, userId },
    });

    return NextResponse.json(profile);
  } catch (err) {
    return handleApiError(err);
  }
}
