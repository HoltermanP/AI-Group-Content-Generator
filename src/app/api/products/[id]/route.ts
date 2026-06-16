import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { productSchema } from "@/lib/validations";
import { handleApiError, notFound } from "@/lib/api";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const existing = await prisma.product.findFirst({ where: { id: params.id, userId } });
    if (!existing) return notFound("Product");

    const data = productSchema.parse(await request.json());
    const product = await prisma.product.update({
      where: { id: params.id },
      data: { ...data, websiteUrl: data.websiteUrl || null },
    });
    return NextResponse.json(product);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const existing = await prisma.product.findFirst({ where: { id: params.id, userId } });
    if (!existing) return notFound("Product");

    await prisma.product.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
