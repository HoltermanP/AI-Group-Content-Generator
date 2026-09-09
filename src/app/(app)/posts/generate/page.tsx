import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listWebsiteCases } from "@/lib/services/websiteCases";
import { GenerateClient } from "./generate-client";

export default async function GeneratePostPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const [products, profile, websiteCases] = await Promise.all([
    prisma.product.findMany({
      where: { userId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, shortDescription: true },
    }),
    prisma.companyProfile.findUnique({ where: { userId }, select: { id: true } }),
    listWebsiteCases(userId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nieuwe post genereren</h1>
        <p className="text-muted-foreground">
          De generator gebruikt altijd het bedrijfsprofiel, de contentinstellingen en eerdere posts als context.
        </p>
      </div>
      <GenerateClient
        products={products}
        hasProfile={Boolean(profile)}
        websiteCases={websiteCases.map((c) => ({
          id: c.id,
          title: c.title,
          sector: c.sector,
          resultLine: c.resultLine,
          teaser: c.teaser,
          url: c.url,
          lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
