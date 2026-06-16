import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { contentSettingsSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireUserId();
    const settings = await prisma.contentSettings.findUnique({ where: { userId } });
    return NextResponse.json(settings);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await requireUserId();
    const data = contentSettingsSchema.parse(await request.json());

    const settings = await prisma.contentSettings.upsert({
      where: { userId },
      update: data,
      create: { ...data, userId },
    });

    return NextResponse.json(settings);
  } catch (err) {
    return handleApiError(err);
  }
}
