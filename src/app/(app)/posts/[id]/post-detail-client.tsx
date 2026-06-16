"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ImageStatus, PostSourceType, PostStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { formatDateTime, IMAGE_STATUS_LABELS, SOURCE_TYPE_LABELS } from "@/lib/utils";
import { publishPostToLinkedIn } from "@/lib/browserPublish";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/app/status-badge";

interface PostDetail {
  id: string;
  title: string;
  summary: string;
  body: string;
  cta: string;
  hashtags: string[];
  status: PostStatus;
  sourceType: PostSourceType;
  topic: string | null;
  scheduledAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  productNames: string[];
  image: {
    imagePrompt: string;
    imageUrl: string | null;
    imageProvider: string | null;
    imageStatus: ImageStatus;
    errorMessage: string | null;
    generatedAt: string | null;
  } | null;
  logs: { id: string; provider: string; status: string; message: string | null; attemptedAt: string }[];
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PostDetailClient({ post }: { post: PostDetail }) {
  const router = useRouter();
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [summary, setSummary] = useState(post.summary);
  const [hashtags, setHashtags] = useState(post.hashtags.join(" "));
  const [imagePrompt, setImagePrompt] = useState(post.image?.imagePrompt ?? "");
  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue(post.scheduledAt));
  const [busy, setBusy] = useState<string | null>(null);
  const [browserDialogOpen, setBrowserDialogOpen] = useState(false);

  const fullPostText = [body, hashtags].filter(Boolean).join("\n\n");

  function absoluteImageUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    if (typeof window !== "undefined") return `${window.location.origin}${url}`;
    return url;
  }

  async function openInLinkedIn(text: string, imageUrl: string | null) {
    const result = await publishPostToLinkedIn({ postId: post.id, text, imageUrl });
    setBrowserDialogOpen(true);
    if (result.imageCopied) {
      toast.success("LinkedIn geopend — afbeelding staat op je klembord (Cmd+V om te plakken).");
    } else if (imageUrl) {
      toast.info("LinkedIn geopend. Plak de afbeelding handmatig of installeer de Chrome-extensie.");
    } else {
      toast.success("LinkedIn geopend met je posttekst.");
    }
  }

  async function api(path: string, options?: RequestInit): Promise<boolean> {
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => null);
      toast.error(errBody?.error ?? "Er ging iets mis.");
      return false;
    }
    return true;
  }

  async function run(action: string, fn: () => Promise<void>) {
    setBusy(action);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  const saveChanges = () =>
    run("save", async () => {
      const ok = await api(`/api/posts/${post.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          body,
          summary,
          hashtags: hashtags.split(/\s+/).filter(Boolean),
          imagePrompt,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
      });
      if (ok) {
        toast.success("Wijzigingen opgeslagen.");
        router.refresh();
      }
    });

  const approve = () =>
    run("approve", async () => {
      const response = await fetch(`/api/posts/${post.id}/approve`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Goedkeuren mislukt.");
        return;
      }
      toast.success("Post goedgekeurd — LinkedIn wordt geopend.");
      await openInLinkedIn(data.fullText ?? fullPostText, data.imageUrl ?? absoluteImageUrl(post.image?.imageUrl));
      router.refresh();
    });

  const reject = () =>
    run("reject", async () => {
      if (await api(`/api/posts/${post.id}/reject`, { method: "POST" })) {
        toast.success("Post afgewezen.");
        router.refresh();
      }
    });

  const regeneratePrompt = () =>
    run("prompt", async () => {
      const response = await fetch(`/api/posts/${post.id}/image-prompt`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Prompt hergenereren mislukt.");
        return;
      }
      setImagePrompt(data.imagePrompt);
      toast.success("Afbeeldingprompt hergenereerd.");
      router.refresh();
    });

  const generateImage = () =>
    run("image", async () => {
      if (await api(`/api/posts/${post.id}/image`, { method: "POST" })) {
        toast.success("Afbeelding gegenereerd.");
        router.refresh();
      }
    });

  const publishToLinkedInBrowser = () =>
    run("browser", async () => {
      await openInLinkedIn(fullPostText, absoluteImageUrl(post.image?.imageUrl));
    });

  const markManuallyPublished = () =>
    run("manual", async () => {
      if (await api(`/api/posts/${post.id}/publish`, { method: "POST", body: JSON.stringify({ mode: "manual" }) })) {
        toast.success("Post gemarkeerd als gepubliceerd.");
        setBrowserDialogOpen(false);
        router.refresh();
      }
    });

  async function copyToClipboard() {
    await navigator.clipboard.writeText(fullPostText);
    toast.success("Posttekst gekopieerd naar klembord.");
  }

  function downloadImage() {
    if (!post.image?.imageUrl) return;
    const a = document.createElement("a");
    a.href = post.image.imageUrl;
    a.download = `aigroup-post-${post.id}.png`;
    a.target = "_blank";
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{post.title}</h1>
            <StatusBadge status={post.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {SOURCE_TYPE_LABELS[post.sourceType]}
            {post.productNames.length > 0 && ` · ${post.productNames.join(", ")}`}
            {` · Aangemaakt ${formatDateTime(post.createdAt)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {post.status !== "PUBLISHED" && post.status !== "APPROVED" && (
            <Button onClick={approve} disabled={busy !== null}>
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Goedkeuren &amp; plaatsen op LinkedIn
            </Button>
          )}
          {post.status !== "PUBLISHED" && post.status !== "REJECTED" && (
            <Button variant="outline" onClick={reject} disabled={busy !== null}>
              {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Afwijzen
            </Button>
          )}
        </div>
      </div>

      {post.status === "APPROVED" && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="space-y-3 py-4">
            <p className="text-sm font-medium text-emerald-900">
              Deze post is goedgekeurd. Open LinkedIn om te publiceren op je ingelogde account.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={publishToLinkedInBrowser} disabled={busy !== null}>
                {busy === "browser" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Opnieuw openen in LinkedIn
              </Button>
              <Button variant="outline" onClick={copyToClipboard}>
                <Copy className="h-4 w-4" /> Tekst kopiëren
              </Button>
              {post.image?.imageUrl && (
                <Button variant="outline" onClick={downloadImage}>
                  <Download className="h-4 w-4" /> Afbeelding downloaden
                </Button>
              )}
              <Button variant="outline" onClick={() => setBrowserDialogOpen(true)}>
                <Check className="h-4 w-4" /> Markeer als gepubliceerd
              </Button>
            </div>
            <p className="text-xs text-emerald-800">
              Met de Chrome-extensie worden tekst én afbeelding automatisch in de composer gezet.
              Zonder extensie: plak de afbeelding met Cmd+V. Jij klikt altijd zelf op &quot;Posten&quot;.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>LinkedIn-posttekst</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Interne titel</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Posttekst</Label>
                <Textarea id="body" rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hashtags">Hashtags</Label>
                <Input id="hashtags" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="summary">Samenvatting</Label>
                <Textarea id="summary" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveChanges} disabled={busy !== null}>
                  {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Wijzigingen opslaan
                </Button>
                <Button variant="outline" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4" /> Kopiëren
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Planning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Gepland publicatiemoment</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Sla wijzigingen op via &quot;Wijzigingen opslaan&quot;.
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Goedgekeurd op</dt>
                <dd>{formatDateTime(post.approvedAt)}</dd>
                <dt className="text-muted-foreground">Gepubliceerd op</dt>
                <dd>{formatDateTime(post.publishedAt)}</dd>
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Afbeelding</CardTitle>
              <CardDescription>
                Status: {post.image ? IMAGE_STATUS_LABELS[post.image.imageStatus] : "Geen afbeelding"}
                {post.image?.imageProvider && ` · provider: ${post.image.imageProvider}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {post.image?.imageUrl ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.image.imageUrl}
                    alt="Gegenereerde afbeelding bij de post"
                    className="w-full rounded-lg border object-cover"
                  />
                  <Button variant="outline" size="sm" onClick={downloadImage}>
                    <Download className="h-4 w-4" /> Downloaden
                  </Button>
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <div className="text-center text-sm">
                    <ImageIcon className="mx-auto mb-2 h-8 w-8" />
                    Nog geen afbeelding gegenereerd
                  </div>
                </div>
              )}

              {post.image?.errorMessage && (
                <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                  Fout bij genereren: {post.image.errorMessage}
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="imagePrompt">Afbeeldingprompt</Label>
                <Textarea
                  id="imagePrompt"
                  rows={5}
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Pas de prompt aan en sla op, of laat hem opnieuw schrijven op basis van de posttekst.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={regeneratePrompt} disabled={busy !== null}>
                  {busy === "prompt" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Prompt hergenereren
                </Button>
                <Button onClick={generateImage} disabled={busy !== null || !imagePrompt}>
                  {busy === "image" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  {post.image?.imageUrl ? "Afbeelding opnieuw genereren" : "Afbeelding genereren"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publicatiehistorie</CardTitle>
            </CardHeader>
            <CardContent>
              {post.logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen publicatiepogingen.</p>
              ) : (
                <ul className="space-y-3">
                  {post.logs.map((log) => (
                    <li key={log.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {log.provider} · {log.status === "success" ? "geslaagd" : log.status === "failed" ? "mislukt" : "overgeslagen"}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(log.attemptedAt)}</span>
                      </div>
                      {log.message && <p className="mt-1 text-muted-foreground">{log.message}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={browserDialogOpen} onOpenChange={setBrowserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post plaatsen op LinkedIn</DialogTitle>
            <DialogDescription>
              LinkedIn is geopend in een nieuw tabblad. Controleer tekst en afbeelding en klik op Posten.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Ga naar het LinkedIn-tabblad (zorg dat je bent ingelogd).</li>
            <li>Controleer of de posttekst klopt.</li>
            <li>
              {post.image?.imageUrl
                ? "Plak de afbeelding met Cmd+V (of gebruik de Chrome-extensie die dit automatisch doet)."
                : "Voeg eventueel een afbeelding toe."}
            </li>
            <li>Klik zelf op &quot;Posten&quot; in LinkedIn.</li>
            <li>Kom terug en markeer de post als gepubliceerd.</li>
          </ol>
          <Button onClick={markManuallyPublished} disabled={busy !== null}>
            {busy === "manual" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Markeer als gepubliceerd
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
