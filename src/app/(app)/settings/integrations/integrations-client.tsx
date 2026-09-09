"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Building2, Chrome, Copy, ExternalLink, KeyRound, Linkedin, Unplug } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AccountStatus {
  active: boolean;
  hasToken: boolean;
  tokenExpiresAt: string | null;
  lastError: string | null;
  lastPublishedAt: string | null;
  organizationName: string | null;
  authorizedForOrganization: boolean;
}

interface OrganizationInfo {
  id: string;
  adminUrl: string;
}

interface LastPublishedPost {
  id: string;
  title: string;
  publishedAt: string | null;
}

export function IntegrationsClient({
  configured,
  redirectUri,
  hasExtensionToken,
  organization,
  account,
  lastPublishedPost,
}: {
  configured: boolean;
  redirectUri: string;
  hasExtensionToken: boolean;
  organization: OrganizationInfo | null;
  account: AccountStatus | null;
  lastPublishedPost: LastPublishedPost | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenBusy, setTokenBusy] = useState(false);

  useEffect(() => {
    const result = searchParams.get("linkedin");
    if (result === "connected") {
      toast.success("LinkedIn succesvol gekoppeld.");
      router.replace("/settings/integrations");
    } else if (result === "error") {
      toast.error(searchParams.get("message") ?? "LinkedIn koppelen mislukt.");
      router.replace("/settings/integrations");
    }
  }, [searchParams, router]);

  async function generateToken() {
    setTokenBusy(true);
    try {
      const response = await fetch("/api/extension/token", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Token genereren mislukt.");
        return;
      }
      setNewToken(body.token);
      toast.success("Extensietoken gegenereerd. Kopieer hem nu; hij wordt maar één keer getoond.");
      router.refresh();
    } finally {
      setTokenBusy(false);
    }
  }

  async function revokeToken() {
    setTokenBusy(true);
    try {
      const response = await fetch("/api/extension/token", { method: "DELETE" });
      if (!response.ok) {
        toast.error("Intrekken mislukt.");
        return;
      }
      setNewToken(null);
      toast.success("Extensietoken ingetrokken.");
      router.refresh();
    } finally {
      setTokenBusy(false);
    }
  }

  async function disconnect() {
    const response = await fetch("/api/integrations/linkedin/disconnect", { method: "POST" });
    if (!response.ok) {
      toast.error("Ontkoppelen mislukt.");
      return;
    }
    toast.success("LinkedIn-koppeling verwijderd.");
    router.refresh();
  }

  const connected = Boolean(account?.active && account?.hasToken);
  const tokenExpired = Boolean(
    account?.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date(),
  );
  const needsReauthorization = Boolean(connected && !tokenExpired && organization && !account?.authorizedForOrganization);
  const organizationLabel = organization
    ? account?.organizationName ?? `bedrijfspagina ${organization.id}`
    : "je persoonlijke profiel";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integraties</h1>
        <p className="text-muted-foreground">Koppelingen met externe platformen.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-600 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Publiceren namens</CardTitle>
              <CardDescription>
                Alle posts (API, Chrome-extensie en browserflow) worden geplaatst namens {organizationLabel}.
              </CardDescription>
            </div>
          </div>
          <Badge variant={organization ? "default" : "outline"}>
            {organization ? "Bedrijfspagina" : "Persoonlijk profiel"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {organization ? (
            <>
              <dl className="grid gap-2 sm:grid-cols-2">
                <dt className="text-muted-foreground">Bedrijfspagina</dt>
                <dd>{account?.organizationName ?? "AI-Group"}</dd>
                <dt className="text-muted-foreground">Organisatie-id</dt>
                <dd>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{organization.id}</code>
                </dd>
                <dt className="text-muted-foreground">Beheerdersomgeving</dt>
                <dd>
                  <a
                    href={organization.adminUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium hover:underline"
                  >
                    Open in LinkedIn <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </dd>
              </dl>
              <p className="text-muted-foreground">
                Het LinkedIn-account waarmee je koppelt of inlogt moet beheerder (of content-beheerder) van deze
                pagina zijn. Wil je een andere pagina? Pas <code>LINKEDIN_ORGANIZATION_ID</code> aan.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">
              Er is geen bedrijfspagina geconfigureerd; posts gaan naar het profiel waarmee je bent ingelogd. Zet{" "}
              <code>LINKEDIN_ORGANIZATION_ID</code> om namens een bedrijfspagina te publiceren.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-800 text-white">
              <Chrome className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Chrome-extensie (aanbevolen)</CardTitle>
              <CardDescription>
                Plaatst tekst en afbeelding automatisch in de LinkedIn-composer van {organizationLabel}. Jij klikt
                zelf op &quot;Posten&quot;.
              </CardDescription>
            </div>
          </div>
          <Badge variant={hasExtensionToken ? "default" : "outline"}>
            {hasExtensionToken ? "Token actief" : "Geen token"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {newToken && (
            <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-900">
                Je nieuwe token (wordt maar één keer getoond):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-white px-2 py-1.5 text-xs">{newToken}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(newToken);
                    toast.success("Token gekopieerd.");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={generateToken} disabled={tokenBusy}>
              <KeyRound className="h-4 w-4" />
              {hasExtensionToken ? "Nieuw token genereren" : "Extensietoken genereren"}
            </Button>
            {hasExtensionToken && (
              <Button variant="outline" onClick={revokeToken} disabled={tokenBusy}>
                Token intrekken
              </Button>
            )}
          </div>

          <div className="rounded-md border p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Installatie</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Open <code>chrome://extensions</code> en zet &quot;Ontwikkelaarsmodus&quot; aan.</li>
              <li>Kies &quot;Uitgepakte extensie laden&quot; en selecteer de map <code>chrome-extension/</code> uit dit project.</li>
              <li>Herlaad de extensie na updates (knop ⟳ bij de extensie).</li>
              <li>Open de instellingen van de extensie en vul de app-URL en dit token in.</li>
            </ol>
            <p className="mt-2">
              Bij goedkeuren opent de app {organization ? "de beheerdersomgeving van de bedrijfspagina" : "LinkedIn"}{" "}
              automatisch. Met de extensie worden tekst én afbeelding in de composer gezet
              {organization ? " namens de pagina" : " op het account waarmee je bent ingelogd"}. Zorg dat je in
              Chrome bent ingelogd met een LinkedIn-account dat beheerder van de pagina is.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0A66C2] text-white">
              <Linkedin className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>LinkedIn API (optioneel)</CardTitle>
              <CardDescription>
                Automatisch publiceren zonder browser namens {organizationLabel} — vereist OAuth-app configuratie.
              </CardDescription>
            </div>
          </div>
          <Badge variant={connected && !tokenExpired && !needsReauthorization ? "default" : "outline"}>
            {connected && !tokenExpired ? (needsReauthorization ? "Opnieuw koppelen" : "Actief") : "Inactief"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <dt className="text-muted-foreground">OAuth-token</dt>
            <dd>
              {account?.hasToken
                ? tokenExpired
                  ? `Verlopen op ${formatDateTime(account.tokenExpiresAt)}`
                  : `Geldig tot ${formatDateTime(account?.tokenExpiresAt)}`
                : "Geen token"}
            </dd>
            <dt className="text-muted-foreground">Publiceert namens</dt>
            <dd>
              {connected
                ? account?.authorizedForOrganization
                  ? organizationLabel
                  : "persoonlijk profiel (nog niet geautoriseerd voor de bedrijfspagina)"
                : "—"}
            </dd>
            <dt className="text-muted-foreground">Laatst gepubliceerd via koppeling</dt>
            <dd>{formatDateTime(account?.lastPublishedAt ?? null)}</dd>
          </dl>

          {needsReauthorization && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Deze koppeling is gemaakt zonder rechten voor de bedrijfspagina. Koppel LinkedIn opnieuw zodat de
              app toestemming krijgt om namens {organizationLabel} te publiceren.
            </p>
          )}

          {account?.lastError && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              Laatste foutmelding: {account.lastError}
            </p>
          )}

          {!configured && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              LinkedIn is nog niet geconfigureerd. Stel <code>LINKEDIN_CLIENT_ID</code> en{" "}
              <code>LINKEDIN_CLIENT_SECRET</code> in (zie <code>.env.example</code>). Tot die tijd werkt de
              handmatige publicatieflow: tekst kopiëren, afbeelding downloaden en zelf plaatsen.
            </p>
          )}

          {!(connected && !tokenExpired) && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <p className="font-medium">Redirect-URL voor je LinkedIn-app</p>
              <p className="text-muted-foreground">
                Registreer <strong>exact</strong> deze URL in je LinkedIn Developer-app onder Auth →
                &quot;Authorized redirect URLs&quot; (elk teken telt, ook http/https en slashes):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 text-xs">{redirectUri}</code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(redirectUri);
                    toast.success("Redirect-URL gekopieerd.");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Koppel je zowel lokaal als op productie? Registreer dan beide URL&apos;s (localhost én je
                productiedomein) in de LinkedIn-app.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {configured && !connected && (
              <a href="/api/integrations/linkedin/connect">
                <Button>
                  <Linkedin className="h-4 w-4" /> LinkedIn koppelen
                </Button>
              </a>
            )}
            {configured && connected && (tokenExpired || needsReauthorization) && (
              <a href="/api/integrations/linkedin/connect">
                <Button>
                  <Linkedin className="h-4 w-4" /> Opnieuw koppelen
                </Button>
              </a>
            )}
            {connected && (
              <Button variant="outline" onClick={disconnect}>
                <Unplug className="h-4 w-4" /> Ontkoppelen
              </Button>
            )}
          </div>

          <div className="rounded-md border p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Wanneer gebruiken?</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Alleen nodig als je volledig automatisch wilt publiceren (cron, zonder browser).</li>
              <li>Voor normaal gebruik volstaat de browserflow via goedkeuren + Chrome-extensie.</li>
              <li>Vereist <code>LINKEDIN_CLIENT_ID</code> en <code>LINKEDIN_CLIENT_SECRET</code> in je omgeving.</li>
              {organization && (
                <li>
                  Voor de bedrijfspagina moet het product <strong>Community Management API</strong> op je
                  LinkedIn-app actief zijn (scopes <code>w_organization_social</code> en{" "}
                  <code>r_organization_admin</code>), en moet je koppelen met een beheerdersaccount van de pagina.
                </li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Laatst gepubliceerde post</CardTitle>
        </CardHeader>
        <CardContent>
          {lastPublishedPost ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <Link href={`/posts/${lastPublishedPost.id}`} className="font-medium hover:underline">
                {lastPublishedPost.title}
              </Link>
              <span className="text-muted-foreground">{formatDateTime(lastPublishedPost.publishedAt)}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nog geen posts gepubliceerd.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
