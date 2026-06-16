import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CalendarClient } from "./calendar-client";

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);

  const posts = await prisma.post.findMany({
    where: {
      userId: session!.user.id,
      scheduledAt: { not: null },
      status: { notIn: ["REJECTED", "FAILED"] },
    },
    include: { product: { select: { name: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contentkalender</h1>
        <p className="text-muted-foreground">
          Geplande posts volgens je publicatiefrequentie, voorkeursdagen en tijdvenster.
        </p>
      </div>
      <CalendarClient
        posts={posts.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
          scheduledAt: p.scheduledAt!.toISOString(),
          productName: p.product?.name ?? null,
        }))}
      />
    </div>
  );
}
