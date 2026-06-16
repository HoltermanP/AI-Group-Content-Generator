import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GenerateClient } from "./generate-client";

export default async function GeneratePostPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const [products, profile] = await Promise.all([
    prisma.product.findMany({
      where: { userId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, shortDescription: true },
    }),
    prisma.companyProfile.findUnique({ where: { userId }, select: { id: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nieuwe post genereren</h1>
        <p className="text-muted-foreground">
          De generator gebruikt altijd het bedrijfsprofiel, de contentinstellingen en eerdere posts als context.
        </p>
      </div>
      <GenerateClient products={products} hasProfile={Boolean(profile)} />
    </div>
  );
}
