import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { productSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireUserId();
    const products = await prisma.product.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(products);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const data = productSchema.parse(await request.json());
    const product = await prisma.product.create({
      data: { ...data, websiteUrl: data.websiteUrl || null, userId },
    });
    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
