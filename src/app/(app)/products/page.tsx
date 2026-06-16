import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProductsClient } from "./products-client";

export default async function ProductsPage() {
  const session = await getServerSession(authOptions);
  const products = await prisma.product.findMany({
    where: { userId: session!.user.id },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Producten en diensten</h1>
        <p className="text-muted-foreground">
          Deze producten worden gebruikt als basis voor productposts.
        </p>
      </div>
      <ProductsClient
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          shortDescription: p.shortDescription,
          longDescription: p.longDescription,
          targetAudience: p.targetAudience,
          problem: p.problem,
          benefits: p.benefits,
          useCases: p.useCases,
          cta: p.cta,
          websiteUrl: p.websiteUrl ?? "",
          active: p.active,
        }))}
      />
    </div>
  );
}
