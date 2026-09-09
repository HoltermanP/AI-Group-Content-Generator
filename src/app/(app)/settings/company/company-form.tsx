"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Briefcase, ExternalLink, Globe } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { companyProfileSchema, type CompanyProfileInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DEFAULTS: CompanyProfileInput = {
  companyName: "AI-Group",
  shortDescription: "",
  longDescription: "",
  websiteUrl: "https://www.ai-group.nl",
  toneOfVoice: "",
  targetAudience: "",
  themes: "",
  defaultCta: "Bekijk meer op www.ai-group.nl",
  forbiddenPhrases: "",
  writingStyle: "",
  defaultHashtags: "#AIGroup, #AI, #Procesverbetering",
};

interface WebsiteCaseRow {
  id: string;
  title: string;
  sector: string | null;
  resultLine: string | null;
  url: string;
  lastFetchedAt: string;
  lastUsedAt: string | null;
}

export function CompanyProfileForm({
  initialData,
  websiteSummary,
  websiteCases,
}: {
  initialData: CompanyProfileInput | null;
  websiteSummary: string | null;
  websiteCases: WebsiteCaseRow[];
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingCases, setRefreshingCases] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompanyProfileInput>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: initialData ?? DEFAULTS,
  });

  async function onSubmit(data: CompanyProfileInput) {
    const response = await fetch("/api/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error ?? "Opslaan mislukt.");
      return;
    }
    toast.success("Bedrijfsprofiel opgeslagen.");
    router.refresh();
  }

  async function refreshWebsiteSummary() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/company/refresh-summary", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok) {
        toast.success("Websitesamenvatting bijgewerkt.");
        router.refresh();
      } else {
        toast.info(body?.message ?? "Website kon niet worden samengevat; het profiel blijft de basis.");
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshCases() {
    setRefreshingCases(true);
    try {
      const response = await fetch("/api/company/cases", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok) {
        toast.success(`${body.cases.length} case(s) opgehaald van de website.`);
        router.refresh();
      } else {
        toast.info(body?.error ?? "Geen cases gevonden op de website.");
      }
    } finally {
      setRefreshingCases(false);
    }
  }

  function field(name: keyof CompanyProfileInput, label: string, props?: { textarea?: boolean; rows?: number; hint?: string }) {
    return (
      <div className="space-y-2">
        <Label htmlFor={name}>{label}</Label>
        {props?.textarea ? (
          <Textarea id={name} rows={props.rows ?? 3} {...register(name)} />
        ) : (
          <Input id={name} {...register(name)} />
        )}
        {props?.hint && <p className="text-xs text-muted-foreground">{props.hint}</p>}
        {errors[name] && <p className="text-sm text-destructive">{errors[name]?.message}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basisgegevens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {field("companyName", "Bedrijfsnaam")}
          {field("shortDescription", "Korte bedrijfsomschrijving", { textarea: true, rows: 2 })}
          {field("longDescription", "Uitgebreide bedrijfsomschrijving", { textarea: true, rows: 6 })}
          {field("websiteUrl", "Website-URL")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stijl en doelgroep</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {field("toneOfVoice", "Tone of voice", { textarea: true, rows: 3 })}
          {field("targetAudience", "Doelgroep", { textarea: true, rows: 3 })}
          {field("themes", "Belangrijkste thema's", { textarea: true, rows: 2, hint: "Komma-gescheiden, bijv.: AI-agents, procesverbetering, contractanalyse" })}
          {field("writingStyle", "Gewenste schrijfstijl", { textarea: true, rows: 2 })}
          {field("forbiddenPhrases", "Verboden woorden of zinnen", { textarea: true, rows: 2, hint: "Komma-gescheiden; deze worden nooit in posts gebruikt" })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Standaarden</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {field("defaultCta", "Standaard CTA")}
          {field("defaultHashtags", "Standaard hashtags", { hint: "Komma-gescheiden, bijv.: #AIGroup, #AI" })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Websitesamenvatting</CardTitle>
          <CardDescription>
            De applicatie kan de website ophalen en samenvatten als extra context bij postgeneratie. Lukt dat
            niet, dan wordt alleen het opgeslagen bedrijfsprofiel gebruikt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {websiteSummary ? (
            <p className="rounded-md bg-muted p-3 text-sm">{websiteSummary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Nog geen samenvatting opgehaald.</p>
          )}
          <Button type="button" variant="outline" onClick={refreshWebsiteSummary} disabled={refreshing}>
            <Globe className="h-4 w-4" />
            {refreshing ? "Bezig met ophalen..." : "Website ophalen en samenvatten"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cases op de website</CardTitle>
          <CardDescription>
            Praktijkcases worden automatisch van de website gehaald en dienen als feitelijke bron voor
            case-posts. Elke case-post linkt naar de case. De cron ververst deze lijst dagelijks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {websiteCases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen cases opgehaald.</p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {websiteCases.map((c) => (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {c.title}
                      {c.sector && <span className="ml-2 text-xs font-normal text-muted-foreground">{c.sector}</span>}
                    </p>
                    {c.resultLine && <p className="text-xs text-muted-foreground">{c.resultLine}</p>}
                    <p className="text-[11px] text-muted-foreground">
                      {c.lastUsedAt ? `Laatste post: ${formatDateTime(c.lastUsedAt)}` : "Nog geen post over gemaakt"}
                    </p>
                  </div>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                  >
                    Bekijk case <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          )}
          {websiteCases[0] && (
            <p className="text-xs text-muted-foreground">
              Laatst opgehaald: {formatDateTime(websiteCases[0].lastFetchedAt)}
            </p>
          )}
          <Button type="button" variant="outline" onClick={refreshCases} disabled={refreshingCases}>
            <Briefcase className="h-4 w-4" />
            {refreshingCases ? "Bezig met ophalen..." : "Cases ophalen van de website"}
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Bezig met opslaan..." : "Profiel opslaan"}
      </Button>
    </form>
  );
}
