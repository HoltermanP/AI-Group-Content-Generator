"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Package, Boxes, Lightbulb, Newspaper, Briefcase, Sparkles, Loader2 } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SourceType = "COMPANY" | "PRODUCT" | "MULTI_PRODUCT" | "FREE_TOPIC" | "NEWS" | "CASE";

interface ProductOption {
  id: string;
  name: string;
  shortDescription: string;
}

interface WebsiteCaseOption {
  id: string;
  title: string;
  sector: string | null;
  resultLine: string | null;
  teaser: string | null;
  url: string;
  lastUsedAt: string | null;
}

const SOURCE_OPTIONS: { value: SourceType; label: string; description: string; icon: typeof Building2 }[] = [
  { value: "COMPANY", label: "Bedrijfsprofiel", description: "Een post over wat AI-Group voor klanten betekent.", icon: Building2 },
  { value: "PRODUCT", label: "Eén product", description: "Een post over één specifiek product of dienst.", icon: Package },
  { value: "MULTI_PRODUCT", label: "Meerdere producten", description: "Een post waarin producten elkaar versterken.", icon: Boxes },
  { value: "FREE_TOPIC", label: "Vrij onderwerp", description: "Een post over een onderwerp dat je zelf invoert.", icon: Lightbulb },
  { value: "NEWS", label: "Actualiteit / nieuws", description: "Een post die inhaakt op een actuele ontwikkeling.", icon: Newspaper },
  { value: "CASE", label: "Praktijkcase", description: "Een post over een case van de website, met link naar die case.", icon: Briefcase },
];

const TOPIC_LABELS: Partial<Record<SourceType, { label: string; placeholder: string }>> = {
  FREE_TOPIC: { label: "Onderwerp", placeholder: "Bijv.: waarom kleine AI-stappen meer opleveren dan grote AI-plannen" },
  NEWS: { label: "Actualiteit of nieuwsbericht", placeholder: "Plak of beschrijf hier het nieuws waar de post op inhaakt" },
  CASE: { label: "Praktijkcase", placeholder: "Beschrijf de situatie, aanpak en het resultaat (zonder vertrouwelijke details)" },
};

export function GenerateClient({
  products,
  hasProfile,
  websiteCases,
}: {
  products: ProductOption[];
  hasProfile: boolean;
  websiteCases: WebsiteCaseOption[];
}) {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<SourceType>("COMPANY");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  // Bij CASE: id van de gekozen website-case, of "custom" voor een eigen omschrijving.
  const [selectedCase, setSelectedCase] = useState<string>(websiteCases[0]?.id ?? "custom");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);

  const needsProducts = sourceType === "PRODUCT" || sourceType === "MULTI_PRODUCT";
  const usesWebsiteCase = sourceType === "CASE" && selectedCase !== "custom";
  const needsTopic = Boolean(TOPIC_LABELS[sourceType]) && !usesWebsiteCase;

  function toggleProduct(id: string) {
    if (sourceType === "PRODUCT") {
      setSelectedProducts([id]);
    } else {
      setSelectedProducts((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    }
  }

  async function generate() {
    if (sourceType === "PRODUCT" && selectedProducts.length !== 1) {
      toast.error("Kies precies één product.");
      return;
    }
    if (sourceType === "MULTI_PRODUCT" && selectedProducts.length < 2) {
      toast.error("Kies minimaal twee producten.");
      return;
    }
    if (needsTopic && !topic.trim()) {
      toast.error("Vul een onderwerp in.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/posts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          productIds: needsProducts ? selectedProducts : [],
          topic: needsTopic || (usesWebsiteCase && topic.trim()) ? topic : undefined,
          websiteCaseId: usesWebsiteCase ? selectedCase : undefined,
          count,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Genereren mislukt.");
        return;
      }
      const created = body?.posts ?? [];
      toast.success(created.length === 1 ? "Post gegenereerd." : `${created.length} posts gegenereerd.`);
      if (created.length === 1) {
        router.push(`/posts/${created[0].id}`);
      } else {
        router.push("/posts?status=DRAFT");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!hasProfile) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          <p>Er is nog geen bedrijfsprofiel ingevuld.</p>
          <p className="mt-1">
            Vul eerst het{" "}
            <Link href="/settings/company" className="font-medium text-foreground underline">
              bedrijfsprofiel
            </Link>{" "}
            in; dat is de basis voor elke post.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Waar gaat de post over?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SOURCE_OPTIONS.map(({ value, label, description, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setSourceType(value);
                  setSelectedProducts([]);
                }}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  sourceType === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent",
                )}
              >
                <Icon className="mb-2 h-5 w-5" />
                <p className="text-sm font-medium">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {needsProducts && (
        <Card>
          <CardHeader>
            <CardTitle>{sourceType === "PRODUCT" ? "Kies een product" : "Kies producten"}</CardTitle>
            <CardDescription>
              {sourceType === "PRODUCT" ? "Eén product per post." : "Minimaal twee producten."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Geen actieve producten.{" "}
                <Link href="/products" className="font-medium text-foreground underline">
                  Voeg eerst een product toe.
                </Link>
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleProduct(product.id)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      selectedProducts.includes(product.id)
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:bg-accent",
                    )}
                  >
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{product.shortDescription}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {sourceType === "CASE" && (
        <Card>
          <CardHeader>
            <CardTitle>Welke case?</CardTitle>
            <CardDescription>
              Cases worden automatisch opgehaald van de website. De post gebruikt alleen de feiten uit de case en
              linkt ernaar.{" "}
              <Link href="/settings/company" className="font-medium text-foreground underline">
                Cases vernieuwen
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {websiteCases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nog geen cases opgehaald. Ga naar{" "}
                <Link href="/settings/company" className="font-medium text-foreground underline">
                  Bedrijfsprofiel
                </Link>{" "}
                en klik op &quot;Cases ophalen van de website&quot;, of beschrijf de case hieronder zelf.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {websiteCases.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCase(c.id)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      selectedCase === c.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent",
                    )}
                  >
                    <p className="text-sm font-medium">{c.title}</p>
                    {c.sector && <p className="text-xs text-muted-foreground">{c.sector}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{c.resultLine ?? c.teaser}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {c.lastUsedAt ? `Laatst gebruikt: ${formatDateTime(c.lastUsedAt)}` : "Nog niet gebruikt"}
                    </p>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedCase("custom")}
                  className={cn(
                    "rounded-lg border border-dashed p-3 text-left transition-colors",
                    selectedCase === "custom" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent",
                  )}
                >
                  <p className="text-sm font-medium">Eigen omschrijving</p>
                  <p className="mt-1 text-xs text-muted-foreground">Een case die (nog) niet op de website staat.</p>
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(needsTopic || usesWebsiteCase) && (
        <Card>
          <CardHeader>
            <CardTitle>{usesWebsiteCase ? "Extra aanwijzingen (optioneel)" : TOPIC_LABELS[sourceType]!.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={usesWebsiteCase ? 2 : 4}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={
                usesWebsiteCase
                  ? "Bijv.: leg de nadruk op het resultaat voor de engineers"
                  : TOPIC_LABELS[sourceType]!.placeholder
              }
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="count">Aantal posts</Label>
            <Select
              id="count"
              className="w-32"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={generate} disabled={busy} size="lg">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Bezig met genereren..." : "Genereer post"}
          </Button>
        </CardContent>
      </Card>

      {busy && (
        <p className="text-center text-sm text-muted-foreground">
          De post wordt gegenereerd, inclusief samenvatting, afbeeldingprompt en een voorgestelde
          publicatiedatum. Dit kan even duren.
        </p>
      )}
    </div>
  );
}
