import Link from "next/link";
import { getServerSession } from "next-auth";
import { FileText, CalendarClock, CheckCircle2, Send, Sparkles, PackagePlus, CalendarDays } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDateTime } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const [draftCount, scheduledCount, approvedCount, publishedCount, pendingCount, nextPost] = await Promise.all([
    prisma.post.count({ where: { userId, status: "DRAFT" } }),
    prisma.post.count({ where: { userId, status: { in: ["SCHEDULED", "PENDING_APPROVAL", "APPROVED"] }, scheduledAt: { gte: new Date() } } }),
    prisma.post.count({ where: { userId, status: "APPROVED" } }),
    prisma.post.count({ where: { userId, status: "PUBLISHED" } }),
    prisma.post.count({ where: { userId, status: "PENDING_APPROVAL" } }),
    prisma.post.findFirst({
      where: { userId, scheduledAt: { gte: new Date() }, status: { notIn: ["REJECTED", "FAILED", "PUBLISHED"] } },
      orderBy: { scheduledAt: "asc" },
      include: { product: { select: { name: true } } },
    }),
  ]);

  const stats = [
    { label: "Concepten", value: draftCount, icon: FileText },
    { label: "Gepland", value: scheduledCount, icon: CalendarClock },
    { label: "Goedgekeurd", value: approvedCount, icon: CheckCircle2 },
    { label: "Gepubliceerd", value: publishedCount, icon: Send },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overzicht van je LinkedIn-content voor AI-Group.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/posts/generate" className={cn(buttonVariants())}>
            <Sparkles className="h-4 w-4" /> Nieuwe post genereren
          </Link>
          <Link href="/products" className={cn(buttonVariants({ variant: "outline" }))}>
            <PackagePlus className="h-4 w-4" /> Product toevoegen
          </Link>
          <Link href="/calendar" className={cn(buttonVariants({ variant: "outline" }))}>
            <CalendarDays className="h-4 w-4" /> Contentkalender openen
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pendingCount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-amber-900">
              Er {pendingCount === 1 ? "wacht 1 post" : `wachten ${pendingCount} posts`} op je goedkeuring.
            </p>
            <Link
              href="/posts?status=PENDING_APPROVAL"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Bekijken
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Eerstvolgende geplande post</CardTitle>
        </CardHeader>
        <CardContent>
          {nextPost ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <Link href={`/posts/${nextPost.id}`} className="font-medium hover:underline">
                  {nextPost.title}
                </Link>
                <p className="text-sm text-muted-foreground">{nextPost.summary}</p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{formatDateTime(nextPost.scheduledAt)}</span>
                  {nextPost.product && <span>· {nextPost.product.name}</span>}
                </div>
              </div>
              <StatusBadge status={nextPost.status} />
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <p>Er staat nog niets gepland.</p>
              <p className="mt-1">
                Genereer een post via{" "}
                <Link href="/posts/generate" className="font-medium text-foreground underline">
                  Nieuwe post
                </Link>{" "}
                of vul de kalender automatisch aan.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
