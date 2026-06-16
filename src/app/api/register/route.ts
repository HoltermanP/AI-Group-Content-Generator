import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { handleApiError, badRequest } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json());

    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) return badRequest("Er bestaat al een account met dit e-mailadres.");

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: { email: body.email.toLowerCase(), name: body.name, passwordHash },
    });

    // Standaard contentinstellingen zodat de generator direct werkt.
    await prisma.contentSettings.create({ data: { userId: user.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
