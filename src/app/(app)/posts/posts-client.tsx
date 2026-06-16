"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PostStatus } from "@prisma/client";
import { toast } from "sonner";
import { publishPostToLinkedIn } from "@/lib/browserPublish";
import { Check, Copy, Eye, ImageOff, Pencil, Trash2, X } from "lucide-react";
import { cn, formatDateTime, POST_STATUS_LABELS } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { ConfirmDialog } from "@/components/app/confirm-dialog";

export interface PostRow {
  id: string;
  title: string;
  summary: string;
  status: PostStatus;
  scheduledAt: string | null;
  productName: string | null;
  imageUrl: string | null;
}

const FILTERS: (PostStatus | null)[] = [
  null,
  "DRAFT",
  "PENDING_APPROVAL",
  "SCHEDULED",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
  "FAILED",
];

export function PostsClient({ posts, activeStatus }: { posts: PostRow[]; activeStatus: PostStatus | null }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<PostRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function postAction(id: string, action: "approve" | "reject" | "duplicate") {
    setBusyId(id);
    try {
      const response = await fetch(`/api/posts/${id}/${action}`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Actie mislukt.");
        return;
      }
      if (action === "approve" && body.fullText) {
        const post = posts.find((p) => p.id === id);
        const imageUrl = body.imageUrl ?? (post?.imageUrl?.startsWith("http") ? post.imageUrl : post?.imageUrl ? `${window.location.origin}${post.imageUrl}` : null);
        await publishPostToLinkedIn({ postId: id, text: body.fullText, imageUrl });
        toast.success("Post goedgekeurd — LinkedIn geopend.");
      } else {
        const messages = { approve: "Post goedgekeurd.", reject: "Post afgewezen.", duplicate: "Post gedupliceerd." };
        toast.success(messages[action]);
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    const response = await fetch(`/api/posts/${deleting.id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Verwijderen mislukt.");
      return;
    }
    toast.success("Post verwijderd.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter ?? "all"}
            href={filter ? `/posts?status=${filter}` : "/posts"}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              activeStatus === filter
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {filter ? POST_STATUS_LABELS[filter] : "Alle"}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <p>Geen posts gevonden{activeStatus ? ` met status "${POST_STATUS_LABELS[activeStatus]}"` : ""}.</p>
            <p className="mt-1">
              <Link href="/posts/generate" className="font-medium text-foreground underline">
                Genereer een nieuwe post
              </Link>
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {post.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageOff className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/posts/${post.id}`} className="font-medium hover:underline">
                      {post.title}
                    </Link>
                    <StatusBadge status={post.status} />
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{post.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {post.scheduledAt ? `Gepland: ${formatDateTime(post.scheduledAt)}` : "Niet gepland"}
                    {post.productName && ` · ${post.productName}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Link href={`/posts/${post.id}`} title="Bekijken">
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href={`/posts/${post.id}?edit=1`} title="Bewerken">
                    <Button variant="ghost" size="icon">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  {!["APPROVED", "PUBLISHED"].includes(post.status) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Goedkeuren & plaatsen op LinkedIn"
                      disabled={busyId === post.id}
                      onClick={() => postAction(post.id, "approve")}
                    >
                      <Check className="h-4 w-4 text-emerald-600" />
                    </Button>
                  )}
                  {!["REJECTED", "PUBLISHED"].includes(post.status) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Afwijzen"
                      disabled={busyId === post.id}
                      onClick={() => postAction(post.id, "reject")}
                    >
                      <X className="h-4 w-4 text-rose-600" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Dupliceren"
                    disabled={busyId === post.id}
                    onClick={() => postAction(post.id, "duplicate")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Verwijderen" onClick={() => setDeleting(post)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Post verwijderen"
        description={`Weet je zeker dat je "${deleting?.title}" definitief wilt verwijderen?`}
        confirmLabel="Verwijderen"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
