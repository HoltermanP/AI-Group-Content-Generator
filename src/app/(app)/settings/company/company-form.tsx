"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Globe } from "lucide-react";
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

export function CompanyProfileForm({
  initialData,
  websiteSummary,
}: {
  initialData: CompanyProfileInput | null;
  websiteSummary: string | null;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
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

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Bezig met opslaan..." : "Profiel opslaan"}
      </Button>
    </form>
  );
}
