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
src/lib/services/linkedin/            # linkedinConfig (bedrijfspagina) + linkedinAuthService (OAuth) + linkedinPublishService (Posts API)
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
   - `LINKEDIN_ORGANIZATION_ID` — id van de bedrijfspagina (standaard `110094547`, AI-Group)
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
- opent de beheerdersomgeving van de bedrijfspagina en zet tekst en afbeelding klaar in de composer
  (namens de pagina); zonder bedrijfspagina de persoonlijke feed-composer met voorgevulde tekst;
- meldt de post na het plaatsen terug als "gepubliceerd".

**Geen automatische publicatie**: de extensie vult alleen de composer; de gebruiker controleert de post
en klikt zelf op "Posten".

Installatie: `chrome://extensions` → Ontwikkelaarsmodus aan → "Uitgepakte extensie laden" → map
`chrome-extension/` kiezen. Genereer daarna in de app (Integraties → Chrome-extensie) een token en vul
app-URL + token in bij de extensie-instellingen. Het token wordt alleen als SHA-256-hash opgeslagen en
is per direct intrekbaar.

## LinkedIn-integratie

- **Publiceert namens de bedrijfspagina van AI-Group**
  (`https://www.linkedin.com/company/110094547/admin/dashboard/`). Het organisatie-id staat in
  `LINKEDIN_ORGANIZATION_ID` (standaard `110094547`; zet op `personal` om op het persoonlijke profiel
  te publiceren). Dit geldt voor alle drie de routes: API, Chrome-extensie en browserflow.
- Uitsluitend via de **officiële LinkedIn OAuth-flow en de versioned Posts/Images API**
  (`/rest/posts`, `/rest/images`) met scopes `w_organization_social` + `r_organization_admin`
  (bedrijfspagina) en `w_member_social` (persoonlijk). Geen browser-automatisering, geen
  click-automation, geen anti-detectie.
- Configureer een LinkedIn-app met de producten "Sign In with LinkedIn using OpenID Connect",
  "Share on LinkedIn" én **"Community Management API"** (vereist voor posten namens een pagina; koppel
  de app in de Developer Portal aan de AI-Group bedrijfspagina) en zet
  `LINKEDIN_CLIENT_ID`/`LINKEDIN_CLIENT_SECRET`. Redirect-URL:
  `<NEXTAUTH_URL>/api/integrations/linkedin/callback`.
- Koppel met een LinkedIn-account dat **beheerder** (of content-beheerder) van de bedrijfspagina is;
  de callback controleert de rol via `organizationAcls` en slaat de organisatie-URN op de koppeling op.
  Een oudere koppeling zonder paginarechten toont "Opnieuw koppelen" onder Integraties.
- Zonder configuratie draait de publicatieservice in stub-modus en blijft de handmatige flow volledig
  werken: tekst kopiëren, afbeelding downloaden, LinkedIn openen, instructies volgen.
- Tokens worden alleen server-side opgeslagen en nooit naar de browser gestuurd.

## Volledig automatische modus

Onder **Contentinstellingen** zit één schakelaar "Volledig automatische modus". Staat die aan, dan:

1. genereert de dagelijkse cron nieuwe posts volgens de ingestelde frequentie (toegankelijke stijl,
   afgedwongen in de promptservice: B1-taalniveau, geen jargon, geen managementtaal, geen AI-taal);
2. wordt bij elke post direct een fotorealistische afbeelding gegenereerd (contextueel, zonder mensen
   of gezichten in beeld);
3. worden posts automatisch goedgekeurd;
4. publiceert de publicatie-cron ze op het geplande moment via de officiële LinkedIn API namens de
   bedrijfspagina, **inclusief afbeelding** (LinkedIn Images-upload).

Vereist: een actieve LinkedIn-koppeling (Instellingen → Integraties). De gebruiker hoeft daarna alleen
nog de publicatiefrequentie in te stellen. Zonder de schakelaar blijft de goedkeuringsflow gelden:
er wordt nooit gepubliceerd zonder expliciet akkoord.

## Website als bron: bedrijfsinformatie en cases

- **Websitesamenvatting**: onder Bedrijfsprofiel haalt de app `www.ai-group.nl` op en vat die samen
  (max. 300 woorden: wat, voor wie, aanpak, diensten, cases, genoemde resultaten). Die samenvatting gaat
  als feitelijke context mee in elke post. Het model krijgt de expliciete instructie niets te verzinnen
  dat niet in profiel, website of case staat.
- **Cases**: `src/lib/services/websiteCases.ts` leest de case-kaarten op de homepage
  (`/cases/*.html`) en de detailpagina's (vraagstuk, aanpak, oplossing, resultaat) en bewaart ze in
  `WebsiteCase`. Verversen: knop onder Bedrijfsprofiel, of automatisch (max. eens per 12 uur) in de
  generatie-cron. Cases die van de site verdwijnen worden inactief.
- **Case-posts**: in de generator kies je een case (of een eigen omschrijving). De post gebruikt alleen
  de case-tekst als bron en eindigt met "Lees de hele case: <url>"; de link wordt afgedwongen in
  `ensureCaseLink`, ook als het model hem vergeet. De link staat ook op de post (`sourceUrl`).
- **Automatische afwisseling**: de cron kiest per post de soort (case, product, bedrijf) die in de
  laatste zes posts het minst voorkwam, en pakt daarbinnen de case die het langst niet aan bod kwam.
- **Beeld**: de beeldprompt moet beginnen met de concrete werkomgeving van het onderwerp (sleuf met
  kabels, contracten op tafel, magazijnstellingen, bouwplaats bij natuurgebied, …), Nederlandse setting,
  geen mensen, geen tekst, geen AI-symboliek. `imageService` voegt daar altijd vaste fotografische
  randvoorwaarden aan toe en gebruikt `gpt-image-1` op kwaliteit `high` (instelbaar via
  `OPENAI_IMAGE_QUALITY`) met `dall-e-3` in stijl `natural`/`hd` als fallback.

## Automatische generatie (cron)

- `GET /api/cron/generate-posts` — genereert conceptposts (status *wacht op goedkeuring*) voor gebruikers
  met automatische generatie aan, alléén als er onvoldoende geplande posts zijn binnen de horizon
  (standaard 14 dagen vooruit). Wisselt producten en onderwerpen af en vermijdt herhaling van CTA's.
- `GET /api/cron/publish-posts` — publiceert **goedgekeurde** posts waarvan het geplande moment is
  bereikt, alleen bij actieve LinkedIn-koppeling én automatische publicatie aan.
- Beide vereisen `Authorization: Bearer ${CRON_SECRET}`. Op Vercel geregeld via `vercel.json`; lokaal:

> **Vercel Hobby-plan:** cron-jobs mogen daar maximaal **één keer per dag** draaien. Daarom staan beide
> schedules in `vercel.json` op dagelijks (`generate-posts` om 06:00, `publish-posts` om 07:00 UTC).
> Gevolg: een goedgekeurde post wordt op die dagelijkse run gepubliceerd, niet exact op het geplande
> tijdstip. Wil je publiceren dichter op het geplande moment (bijv. elk kwartier `*/15 * * * *`), dan
> heb je het Vercel Pro-plan nodig — pas dan de `publish-posts`-schedule aan. Alternatief zonder
> upgrade: publiceer handmatig via de app of de Chrome-extensie, of trigger de cron-route zelf met het
> `CRON_SECRET`.

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
