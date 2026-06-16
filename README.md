# AI-Group LinkedIn Content Generator

Webapplicatie waarmee AI-Group structureel LinkedIn-content maakt: posts genereren op basis van het
bedrijfsprofiel en producten, fotorealistische afbeeldingen klaarzetten, plannen in een contentkalender,
goedkeuren en publiceren — handmatig (kopiëren/downloaden) of automatisch via de officiële LinkedIn API.

## Stack

- **Next.js 14 (App Router)** + **TypeScript**
- **Tailwind CSS** + shadcn/ui-stijl componenten
- **PostgreSQL** + **Prisma ORM**
- **NextAuth** (credentials, JWT-sessies)
- **OpenAI API** voor tekstgeneratie, beeldpromptgeneratie en afbeeldingen (met stub-fallback)
- **Zod** + **React Hook Form** voor validatie
- Vercel-ready (incl. `vercel.json` met cron-jobs)

## Snel starten (lokaal)

```bash
# 1. Dependencies
npm install

# 2. PostgreSQL starten (bijv. via Docker)
docker run --name aigroup-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aigroup -p 5432:5432 -d postgres:16

# 3. Environment
cp .env.example .env
# vul minimaal DATABASE_URL en NEXTAUTH_SECRET in

# 4. Database schema + seed (AI-Group profiel, 6 producten, demo-gebruiker)
npm run db:push
npm run db:seed

# 5. Starten
npm run dev
```

Inloggen met het seed-account: **demo@ai-group.nl** / **aigroup2026**

> **Zonder OpenAI API key** draait de app in stub-modus: de generator maakt voorbeeldposts en
> placeholder-afbeeldingen zodat de volledige flow (genereren → plannen → goedkeuren → publiceren)
> lokaal testbaar is. Zet `OPENAI_API_KEY` en `IMAGE_PROVIDER="openai"` voor echte generatie.

## De basisflow

Bedrijfsprofiel invoeren → producten toevoegen → posts genereren → afbeelding genereren → plannen →
goedkeuren → kopiëren óf publiceren via LinkedIn.

Een post wordt **nooit** automatisch gepubliceerd zonder expliciete goedkeuring. Die garantie zit op twee
plekken: in de cron-route (alleen `APPROVED` posts worden opgepakt) én in de publicatieservice zelf
(`src/lib/services/publishing.ts` weigert elke andere status en logt de poging).

## Structuur

```
prisma/schema.prisma          # User, CompanyProfile, Product, ContentSettings, Post,
                              # PostImage, PublicationSchedule, PublicationLog, IntegrationAccount
prisma/seed.ts                # AI-Group seed-data (profiel, instellingen, 6 producten)
src/lib/ai/prompts.ts         # Promptbuilders (postgeneratie + afbeeldingprompt)
src/lib/ai/textService.ts     # OpenAI-tekstservice met JSON-validatie, retry en stub-fallback
src/lib/ai/imageService.ts    # Image-providers (openai | stub), retry, opslag in /public/uploads
src/lib/services/scheduling.ts        # Frequentie, voorkeursdagen, tijdvenster, natuurlijke spreiding
src/lib/services/postGeneration.ts    # Orkestratie: context → AI → post + afbeeldingprompt + planning
src/lib/services/publishing.ts        # Goedkeuringsgarantie + publicatielog
src/lib/services/websiteSummary.ts    # Website ophalen/samenvatten, faalt stil terug op profiel
src/lib/services/linkedin/            # linkedinAuthService (OAuth) + linkedinPublishService (UGC API)
src/app/(app)/                # Dashboard, posts, generator, kalender, producten, instellingen
src/app/api/                  # REST-routes incl. /api/cron/* (beveiligd met CRON_SECRET)
```

## Pagina's

| Route | Functie |
|---|---|
| `/` | Dashboard: tellers per status, eerstvolgende post, snelkoppelingen |
| `/posts` | Postbeheer: filteren, goedkeuren, afwijzen, dupliceren, verwijderen |
| `/posts/generate` | Generator: bedrijfsprofiel, product(en), vrij onderwerp, nieuws of case |
| `/posts/[id]` | Detail: tekst bewerken, afbeelding (her)genereren, plannen, publiceren, historie |
| `/calendar` | Contentkalender: maand- en lijstweergave, verplaatsen, automatisch aanvullen |
| `/products` | Producten en diensten beheren |
| `/settings/company` | Bedrijfsprofiel (basis voor elke post) + websitesamenvatting |
| `/settings/content` | Frequentie, voorkeursdagen, tijdvenster, spreiding, stijl, automatisering |
| `/settings/integrations` | LinkedIn-koppeling (OAuth), status, foutmeldingen |

## Livegang (Vercel) — alleen keys invullen

Het project is deploy-klaar. Stappenplan:

1. **Database** — maak een PostgreSQL-database aan (Neon, Supabase of Vercel Postgres) en noteer de
   connection string.
2. **Vercel-project** — importeer deze repository in Vercel. `vercel.json` regelt de cron-jobs
   automatisch; `postinstall` draait `prisma generate` bij elke build.
3. **Blob-opslag** — Vercel-dashboard → Storage → Blob → store aanmaken en aan het project koppelen.
   `BLOB_READ_WRITE_TOKEN` wordt dan automatisch gezet; gegenereerde afbeeldingen krijgen permanente
   publieke URL's.
4. **Environment variables** (Vercel → Settings → Environment Variables), zie `.env.example`:
   - `DATABASE_URL` — de connection string uit stap 1
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32`
   - `NEXTAUTH_URL` — `https://<jouw-domein>`
   - `OPENAI_API_KEY` — hiermee staat echte tekst- én beeldgeneratie direct aan (`IMAGE_PROVIDER`
     staat standaard op `auto`)
   - `CRON_SECRET` — `openssl rand -hex 24`
   - optioneel: `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` voor automatische publicatie
5. **Schema + seed** — eenmalig vanaf je eigen machine, met `DATABASE_URL` naar productie:

   ```bash
   DATABASE_URL="<productie-url>" npx prisma migrate deploy
   DATABASE_URL="<productie-url>" npm run db:seed   # optioneel: AI-Group profiel + producten
   ```

6. **Deploy** — klaar. Maak een account aan via `/register` (of log in met het seed-account en wijzig
   het wachtwoord), controleer het bedrijfsprofiel en genereer de eerste post.

Checklist na livegang: cron-jobs zichtbaar onder Vercel → Cron, een testpost genereren (echte AI),
afbeelding genereren (URL moet op `blob.vercel-storage.com` staan), goedkeuren en publiceren.

## Chrome-extensie (publicatie-assistent)

In [chrome-extension/](chrome-extension/) zit een Manifest V3-extensie die publiceren vanuit de browser
versnelt zonder LinkedIn te automatiseren:

- toont alle **goedgekeurde** posts die klaarstaan (uit de app, via een persoonlijk token);
- kopieert de posttekst, downloadt de afbeelding;
- opent de LinkedIn-composer met de tekst vooraf ingevuld via LinkedIn's eigen share-deeplink;
- meldt de post na het plaatsen terug als "gepubliceerd".

**Bewust geen** content scripts op linkedin.com, geen automatische kliks, geen botgedrag: de gebruiker
controleert de post en klikt zelf op "Posten".

Installatie: `chrome://extensions` → Ontwikkelaarsmodus aan → "Uitgepakte extensie laden" → map
`chrome-extension/` kiezen. Genereer daarna in de app (Integraties → Chrome-extensie) een token en vul
app-URL + token in bij de extensie-instellingen. Het token wordt alleen als SHA-256-hash opgeslagen en
is per direct intrekbaar.

## LinkedIn-integratie

- Uitsluitend via de **officiële LinkedIn OAuth-flow en UGC Posts API** (`w_member_social`).
  Geen browser-automatisering, geen click-automation, geen anti-detectie.
- Configureer een LinkedIn-app (producten "Share on LinkedIn" + "Sign In with LinkedIn using OpenID
  Connect") en zet `LINKEDIN_CLIENT_ID`/`LINKEDIN_CLIENT_SECRET`. Redirect-URL:
  `<NEXTAUTH_URL>/api/integrations/linkedin/callback`.
- Zonder configuratie draait de publicatieservice in stub-modus en blijft de handmatige flow volledig
  werken: tekst kopiëren, afbeelding downloaden, LinkedIn openen, instructies volgen.
- Tokens worden alleen server-side opgeslagen en nooit naar de browser gestuurd.

## Automatische generatie (cron)

- `GET /api/cron/generate-posts` — genereert conceptposts (status *wacht op goedkeuring*) voor gebruikers
  met automatische generatie aan, alléén als er onvoldoende geplande posts zijn binnen de horizon
  (standaard 14 dagen vooruit). Wisselt producten en onderwerpen af en vermijdt herhaling van CTA's.
- `GET /api/cron/publish-posts` — publiceert **goedgekeurde** posts op hun geplande moment, alleen bij
  actieve LinkedIn-koppeling én automatische publicatie aan.
- Beide vereisen `Authorization: Bearer ${CRON_SECRET}`. Op Vercel geregeld via `vercel.json`; lokaal:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/generate-posts
```

## Security

- Server-side validatie met Zod op alle mutaties.
- Alle queries gefilterd op `userId`; middleware beschermt alle app-routes.
- API keys en tokens alleen in environment variables / database, nooit in de client.
- Foutafhandeling en retry op AI- en image-calls; elke publicatiepoging wordt gelogd.

## Productie-notities

- Afbeeldingsopslag schakelt automatisch naar **Vercel Blob** zodra `BLOB_READ_WRITE_TOKEN` is gezet;
  zonder token vallen uploads terug op het lokale filesystem (alleen voor lokaal gebruik).
- Migraties staan in `prisma/migrations/`; gebruik `npm run db:deploy` (`prisma migrate deploy`) voor
  productie en `npm run db:migrate` tijdens ontwikkeling.
- Schemawijzigingen: pas `prisma/schema.prisma` aan en draai `npm run db:migrate` — commit de nieuwe
  migratiemap mee.
