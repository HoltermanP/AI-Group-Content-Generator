import type { CompanyProfile, ContentSettings, Product, Post, WebsiteCase } from "@prisma/client";

/** Beknopte case-info voor context bij niet-case posts. */
export type WebsiteCaseSummary = Pick<WebsiteCase, "title" | "sector" | "resultLine" | "url">;

export interface PostGenerationContext {
  profile: CompanyProfile;
  settings: ContentSettings;
  products: Product[]; // gekozen producten (leeg bij bedrijfs-/onderwerpposts)
  sourceType: string;
  topic?: string;
  recentPosts: Pick<Post, "title" | "summary" | "cta">[];
  websiteSummary?: string | null;
  /** De case van de website waarover de post gaat (bij sourceType CASE). */
  websiteCase?: WebsiteCase | null;
  /** Alle cases van de website, als feitelijke voorbeelden bij andere posts. */
  websiteCases?: WebsiteCaseSummary[];
}

/**
 * Systeeminstructie voor LinkedIn-postgeneratie.
 * Bevat de vaste kwaliteitseisen; de bedrijfscontext gaat in de user prompt.
 */
export function buildPostSystemPrompt(ctx: PostGenerationContext): string {
  const { profile, settings } = ctx;

  const lengthInstruction =
    settings.postLength === "kort"
      ? "Maximaal 120 woorden."
      : settings.postLength === "middel"
        ? "Tussen 120 en 200 woorden."
        : "Tussen 200 en 300 woorden.";

  return `Je bent de senior contentmarketeer van ${profile.companyName}. Je schrijft LinkedIn-posts in het Nederlands namens de bedrijfspagina van ${profile.companyName}.

SCHRIJFSTIJL — TOEGANKELIJK EN MENSELIJK (dit gaat boven alles):
- Schrijf op taalniveau B1: korte zinnen, alledaagse woorden. Alsof je het aan een collega bij de koffieautomaat vertelt.
- Niet technisch: geen vaktermen zonder uitleg, geen afkortingen die een buitenstaander niet kent.
- Geen managementtaal. VERBODEN zijn woorden als: synergie, optimaliseren, efficiëntieslag, stakeholders, meerwaarde creëren, borgen, uitrollen, schakelen, in de keten, wendbaar, toekomstbestendig, strategische pijlers.
- Geen AI-taal. VERBODEN zijn frasen als: "duik in", "ontgrendel", "naadloos", "krachtig", "transformeer", "in het huidige landschap", "laten we eerlijk zijn", "het is geen geheim dat", "Kortom:", "de wereld verandert snel". Vermijd opsommingen met precies drie bijvoeglijke naamwoorden ("sneller, slimmer en beter") en gebruik geen gedachtestreepjes als stijlmiddel.
- Menselijk en direct, alsof een ondernemer zelf schrijft. Concreet boven abstract: noem een situatie, een aantal uren, een herkenbaar moment.
- Doe geen overdreven claims; blijf nuchter en geloofwaardig.

FEITELIJK — GEEN VERZINSELS:
- Gebruik alleen feiten die in de meegeleverde context staan (bedrijfsprofiel, websitesamenvatting, productinformatie, case-tekst).
- Verzin geen klantnamen, cijfers, percentages of resultaten die niet in de context staan. Staat er geen getal, schrijf dan zonder getal.
- Verwijs bij een case altijd naar de case op de website met de meegeleverde link.

VERPLICHTE OPBOUW (structuur van de body):
1. Eén openingszin die een herkenbare situatie, ergernis of vraag neerzet. Nooit een algemene opening zoals "In de wereld van vandaag".
2. Daarna 2 tot 4 korte alinea's van maximaal 2 zinnen, ALTIJD gescheiden door een witregel (\\n\\n). Nooit één doorlopend tekstblok.
3. Afsluiten met de CTA op een eigen regel.

VARIATIE (verplicht — voorkom dat posts op elkaar gaan lijken):
- Kies bewust een invalshoek voor de openingszin en wissel actief af ten opzichte van eerdere posts: bijvoorbeeld een concrete vraag, een korte anekdote of situatie, een opvallend getal of feit, een herkenbare frustratie, of een kort stukje dialoog. Herhaal niet dezelfde invalshoek als de meest recente post(s) hieronder.
- Varieer de toon binnen de tone of voice: niet elke post hoeft even enthousiast, luchtig of serieus te zijn.
- Bedenk elke keer een eigen CTA-formulering; kopieer nooit letterlijk de CTA-zin van een eerdere post.
- Varieer het aantal alinea's (2 tot 4) en de lengte ervan per post.

EISEN AAN ELKE POST:
- ${lengthInstruction}
- Stijl: ${settings.style}. Schrijfstijl: ${profile.writingStyle}
- Tone of voice: ${profile.toneOfVoice}
- Superlatieven en dikke woorden zijn verboden: geen "aanzienlijk", "efficiënt", "optimaal", "innovatief", "revolutionair". Zeg gewoon wat het scheelt: uren, fouten, wachttijd.
- ${settings.useEmojis ? "Gebruik spaarzaam (max. 2) passende emoji's." : "Gebruik geen emoji's."}
- Eindig met een duidelijke CTA. Verwijs waar passend naar ${profile.websiteUrl.replace(/^https?:\/\//, "")}, een productspecifieke URL of de link van de case.
- Gebruik precies ${settings.hashtagCount} hashtags, passend bij het onderwerp.
- Verboden woorden/zinnen (gebruik deze NOOIT): ${profile.forbiddenPhrases.join("; ") || "geen"}

EISEN AAN DE AFBEELDINGPROMPT (imagePrompt, in het Engels):
- Doel: een echte, geloofwaardige foto die zonder tekst laat zien waar de post over gaat. Niet "een kantoor met een laptop", maar de concrete werkomgeving van het onderwerp.
- Begin de prompt met de concrete scène, gekoppeld aan het onderwerp. Voorbeelden van goede verankering: bij tracéontwerp voor kabels en leidingen: een open sleuf met kabels langs een weg en een tablet met een kaart erop; bij contracten: een stapel contracten met gemarkeerde clausules op een vergadertafel; bij een magazijn: stellingen met pallets en een handscanner; bij stikstof en bouwplannen: een bouwplaats met kraan naast een natuurgebied; bij aanbestedingen: een tafel vol tenderdocumenten en een planning aan de muur; bij vastgoed: een leeg kantoorpand met bouwtekeningen; bij schouwen en inspecties: een monteur-perspectief op leidingen, meters of een schakelkast. Deze voorbeelden zijn ter inspiratie; beschrijf de scène specifiek voor déze post: locatie, materialen, weer of tijdstip, wat er (onscherp) op een scherm of papier te zien is, en welk detail de kern van de post zichtbaar maakt.
- Verboden als hoofdonderwerp: generiek bureau met laptop, koffiekop en notitieblok, tenzij de post echt over bureauwerk gaat.
- Nederlandse of Noordwest-Europese setting: herkenbare Nederlandse straten, polders, bedrijventerreinen, bouwplaatsen, kantoren; geen Amerikaanse skylines of tropische omgevingen.
- Mensen mogen heel normaal in beeld staan en aan het werk zijn, maar zonder duidelijk, scherp of prominent gezicht: bijvoorbeeld iemand die opzij of van de camera af kijkt, op enige afstand, deels in beweging (lichte motion blur), of met het gezicht deels buiten het frame of buiten scherpte. Geen close-up van een gezicht dat recht in de camera kijkt. Gebruik ten hoogste 1 of 2 personen per foto; geen groepen of drukke scènes met veel mensen.
- Zet mensen niet gekunsteld weg zonder hoofd of lichaam (geen afgesneden nek, geen "onzichtbare persoon"): het moet een normale, natuurlijke foto blijven, alleen zonder een duidelijk gezicht in beeld.
- Geen robots, geen zwevende hologrammen, geen gloeiende blauwe hersenen, geen circuit-patronen, geen overduidelijke AI-symboliek, geen neonlicht.
- De tekst "AI-Group" moet altijd ergens duidelijk zichtbaar in beeld staan, subtiel en natuurlijk verwerkt (bijv. op een sticker, bordje, werkkleding, beeldscherm of notitieboek) — laat dit nooit weg. Verder geen leesbare tekst, geen andere logo's, geen watermerken. Schermen tonen hooguit een onscherpe kaart, tabel of grafiek.
- Fotografische beschrijving: camera en lens (bijv. full-frame, 35mm of 50mm), diafragma (f/2.8 tot f/5.6), natuurlijk daglicht of realistisch kunstlicht, echte materialen en texturen, documentaire/redactionele stijl. Sluit af met: "photorealistic editorial photograph, no CGI, no 3D render, no illustration".

OUTPUT:
Antwoord uitsluitend met geldige JSON, zonder markdown, exact in dit formaat:
{
  "title": "Interne titel (kort, voor intern beheer)",
  "summary": "Korte samenvatting van de post in 1-2 zinnen",
  "body": "Volledige LinkedIn-post inclusief CTA, zonder hashtags aan het einde",
  "cta": "De gebruikte CTA als losse string",
  "hashtags": ["#voorbeeld"],
  "imagePrompt": "Photorealistic image prompt in English"
}`;
}

export function buildPostUserPrompt(ctx: PostGenerationContext): string {
  const { profile, products, sourceType, topic, recentPosts, websiteSummary, websiteCase, websiteCases } = ctx;

  const parts: string[] = [];

  parts.push(`BEDRIJFSPROFIEL ${profile.companyName}:
${profile.longDescription}

Doelgroep: ${profile.targetAudience}
Belangrijkste thema's: ${profile.themes.join(", ")}
Website: ${profile.websiteUrl}
Standaard CTA: ${profile.defaultCta}
Standaard hashtags: ${profile.defaultHashtags.join(" ")}`);

  if (websiteSummary) {
    parts.push(`SAMENVATTING VAN DE WEBSITE ${profile.websiteUrl} (feitelijke bron):\n${websiteSummary}`);
  }

  if (websiteCases && websiteCases.length > 0 && sourceType !== "CASE") {
    parts.push(
      `PRAKTIJKCASES OP DE WEBSITE (echte projecten; je mag er één kort noemen als voorbeeld, met de link erbij):\n` +
        websiteCases
          .map((c) => `- ${c.title}${c.sector ? ` (${c.sector})` : ""}${c.resultLine ? `: ${c.resultLine}` : ""} — ${c.url}`)
          .join("\n"),
    );
  }

  if (products.length > 0) {
    parts.push(
      "PRODUCTINFORMATIE:\n" +
        products
          .map(
            (p) => `• ${p.name}: ${p.shortDescription}
  Probleem: ${p.problem}
  Voordelen: ${p.benefits}
  Use-cases: ${p.useCases}
  Doelgroep: ${p.targetAudience}
  CTA: ${p.cta}${p.websiteUrl ? `\n  URL: ${p.websiteUrl}` : ""}`,
          )
          .join("\n"),
    );
  }

  if (websiteCase) {
    const isExample = /voorbeeld/i.test(`${websiteCase.tag ?? ""} ${websiteCase.title} ${websiteCase.description ?? ""}`);
    if (isExample) {
      parts.push(
        `LET OP: dit is een VOORBEELDCASE, een uitgewerkt scenario en geen bestaande klant. Benoem dat eerlijk in de post (bijv. "een voorbeeld dat we uitwerkten voor een distributiecentrum") en presenteer cijfers als inschatting, niet als behaald resultaat.`,
      );
    }
    parts.push(`DE CASE (volledige tekst van ${websiteCase.url}; dit is de enige feitelijke bron voor deze post):
Titel: ${websiteCase.title}${websiteCase.sector ? `\nSector: ${websiteCase.sector}` : ""}${websiteCase.resultLine ? `\nKernresultaat: ${websiteCase.resultLine}` : ""}${websiteCase.description ? `\nSamenvatting: ${websiteCase.description}` : ""}
Link naar de case: ${websiteCase.url}

${websiteCase.content}`);
  }

  const caseTask = websiteCase
    ? `Schrijf een LinkedIn-post over de praktijkcase "${websiteCase.title}" van ${profile.companyName}. Vertel het als een verhaal: welk probleem had de organisatie (het vraagstuk), wat deed ${profile.companyName} (de aanpak), wat is er nu anders (het resultaat). Gebruik alleen wat in de case-tekst staat; noem geen klantnaam als die er niet in staat. Kies één invalshoek in plaats van alles te noemen. Sluit af met de CTA en de link naar de case: "Lees de hele case: ${websiteCase.url}" op een eigen regel.${topic ? `\nExtra aanwijzingen: ${topic}` : ""}`
    : `Schrijf een LinkedIn-post over deze praktijkcase: "${topic}". Beschrijf situatie, aanpak en resultaat zonder vertrouwelijke details te verzinnen.`;

  const taskByType: Record<string, string> = {
    COMPANY: `Schrijf een LinkedIn-post over wat ${profile.companyName} voor klanten betekent. Kies één concreet thema, dienst of praktijkvoorbeeld van de website, niet alles tegelijk. Noem je een case, zet dan de link naar die case in de post.`,
    PRODUCT: `Schrijf een LinkedIn-post over het product ${products[0]?.name ?? ""}. Maak het concreet: welk probleem, welk resultaat.`,
    MULTI_PRODUCT: `Schrijf een LinkedIn-post waarin de producten ${products.map((p) => p.name).join(" en ")} samen een verhaal vormen, bijvoorbeeld hoe ze elkaar versterken in één werkproces.`,
    FREE_TOPIC: `Schrijf een LinkedIn-post over dit onderwerp: "${topic}". Verbind het op een natuurlijke manier met wat ${profile.companyName} doet.`,
    NEWS: `Schrijf een LinkedIn-post die inhaakt op deze actualiteit: "${topic}". Geef een nuchtere, praktische kijk vanuit ${profile.companyName}; geen hype.`,
    CASE: caseTask,
  };

  parts.push(`OPDRACHT:\n${taskByType[sourceType] ?? taskByType.COMPANY}`);

  if (recentPosts.length > 0) {
    parts.push(
      `EERDERE POSTS (vermijd herhaling van invalshoek, opening en CTA-formulering):\n` +
        recentPosts.map((p) => `- ${p.title}: ${p.summary} (CTA: ${p.cta})`).join("\n"),
    );
  }

  return parts.join("\n\n");
}

/**
 * Prompt om een losse afbeeldingprompt te (her)genereren voor een bestaande post.
 */
export function buildImagePromptInstruction(postBody: string, companyName: string): string {
  return `Maak een fotorealistische image-generatieprompt (in het Engels) voor een LinkedIn-post van ${companyName}.

De afbeelding moet:
- een echte, geloofwaardige foto lijken van de concrete werkomgeving waar de post over gaat: niet "een kantoor met een laptop", maar bijvoorbeeld een sleuf met kabels langs een weg, een vergadertafel met gemarkeerde contracten, een magazijn met stellingen en een handscanner, een bouwplaats naast een natuurgebied, of een schakelkast tijdens een inspectie;
- beginnen met die concrete scène, zodat de kijker zonder tekst kan raden waar de post over gaat;
- passen bij een Nederlandse of Noordwest-Europese context (geen Amerikaanse skylines);
- mensen mogen heel normaal in beeld staan en aan het werk zijn, maar zonder duidelijk, scherp of prominent gezicht (bijv. opzij of van de camera af kijkend, op afstand, in lichte beweging, of deels buiten scherpte) — geen close-up van een gezicht recht in de camera. Gebruik ten hoogste 1 of 2 personen, geen groepen of drukke scènes. Geen gekunsteld weggesneden hoofden of lichamen: het moet een natuurlijke foto blijven, alleen zonder duidelijk gezicht;
- geen robots, hologrammen, gloeiende hersenen, circuit-patronen of andere AI-symboliek bevatten, geen neonlicht;
- altijd de tekst "${companyName}" duidelijk zichtbaar en subtiel verwerkt bevatten (bijv. op een sticker, bordje, werkkleding of scherm) — nooit weglaten; verder geen leesbare tekst, andere logo's of watermerken; schermen hooguit met een onscherpe kaart of grafiek;
- een fotografische beschrijving bevatten: camera en lens (full-frame, 35mm of 50mm), diafragma, natuurlijk daglicht, echte materialen en texturen, documentaire stijl;
- eindigen met: "photorealistic editorial photograph, no CGI, no 3D render, no illustration".

DE POST:
${postBody}

Antwoord uitsluitend met de Engelse prompt, zonder toelichting.`;
}
