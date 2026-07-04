import type { CompanyProfile, ContentSettings, Product, Post } from "@prisma/client";

export interface PostGenerationContext {
  profile: CompanyProfile;
  settings: ContentSettings;
  products: Product[]; // gekozen producten (leeg bij bedrijfs-/onderwerpposts)
  sourceType: string;
  topic?: string;
  recentPosts: Pick<Post, "title" | "summary" | "cta">[];
  websiteSummary?: string | null;
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

  return `Je bent de senior contentmarketeer van ${profile.companyName}. Je schrijft LinkedIn-posts in het Nederlands.

SCHRIJFSTIJL — TOEGANKELIJK EN MENSELIJK (dit gaat boven alles):
- Schrijf op taalniveau B1: korte zinnen, alledaagse woorden. Alsof je het aan een collega bij de koffieautomaat vertelt.
- Niet technisch: geen vaktermen zonder uitleg, geen afkortingen die een buitenstaander niet kent.
- Geen managementtaal. VERBODEN zijn woorden als: synergie, optimaliseren, efficiëntieslag, stakeholders, meerwaarde creëren, borgen, uitrollen, schakelen, in de keten, wendbaar, toekomstbestendig, strategische pijlers.
- Geen AI-taal. VERBODEN zijn frasen als: "duik in", "ontgrendel", "naadloos", "krachtig", "transformeer", "in het huidige landschap", "laten we eerlijk zijn", "het is geen geheim dat", "Kortom:", "de wereld verandert snel". Vermijd opsommingen met precies drie bijvoeglijke naamwoorden ("sneller, slimmer en beter") en gebruik geen gedachtestreepjes als stijlmiddel.
- Menselijk en direct, alsof een ondernemer zelf schrijft. Concreet boven abstract: noem een situatie, een aantal uren, een herkenbaar moment.
- Doe geen overdreven claims; blijf nuchter en geloofwaardig.

VERPLICHTE OPBOUW (structuur van de body):
1. Eén openingszin die een herkenbare situatie, ergernis of vraag neerzet. Nooit een algemene opening zoals "In de wereld van vandaag".
2. Daarna 2 tot 4 korte alinea's van maximaal 2 zinnen, ALTIJD gescheiden door een witregel (\\n\\n). Nooit één doorlopend tekstblok.
3. Afsluiten met de CTA op een eigen regel.

EISEN AAN ELKE POST:
- ${lengthInstruction}
- Stijl: ${settings.style}. Schrijfstijl: ${profile.writingStyle}
- Tone of voice: ${profile.toneOfVoice}
- Superlatieven en dikke woorden zijn verboden: geen "aanzienlijk", "efficiënt", "optimaal", "innovatief", "revolutionair". Zeg gewoon wat het scheelt: uren, fouten, wachttijd.
- ${settings.useEmojis ? "Gebruik spaarzaam (max. 2) passende emoji's." : "Gebruik geen emoji's."}
- Eindig met een duidelijke CTA. Verwijs waar passend naar ${profile.websiteUrl.replace(/^https?:\/\//, "")} of een productspecifieke URL.
- Gebruik precies ${settings.hashtagCount} hashtags, passend bij het onderwerp.
- Verboden woorden/zinnen (gebruik deze NOOIT): ${profile.forbiddenPhrases.join("; ") || "geen"}

EISEN AAN DE AFBEELDINGPROMPT (imagePrompt, in het Engels):
- Fotorealistische professionele foto, zakelijke Nederlandse/Europese setting. Moet aanvoelen als een echte foto, niet als AI-beeld.
- GEEN mensen in beeld. Geen gezichten, ook niet op de achtergrond, niet van opzij en niet onscherp. Hooguit handen bij een toetsenbord of gereedschap, als het echt nodig is.
- Werk met objecten, werkplekken, laptops, documenten, dashboards, infrastructuur, bouwplaatsen, kabels/leidingen, projectomgevingen of abstracte zakelijke situaties.
- Duidelijke visuele link met het onderwerp van de post: de kijker moet zonder de tekst kunnen raden waar de post over gaat.
- Geen robots, geen zwevende hologrammen, geen gloeiende blauwe hersenen, geen overduidelijke AI-symboliek.
- Geen grote hoeveelheden tekst in beeld; hooguit subtiel "AI-Group" of een productnaam.
- Beschrijf camera-instelling en licht (bijv. 35mm, natuurlijk daglicht, kleine scherptediepte) voor een natuurlijk resultaat.

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
  const { profile, products, sourceType, topic, recentPosts, websiteSummary } = ctx;

  const parts: string[] = [];

  parts.push(`BEDRIJFSPROFIEL ${profile.companyName}:
${profile.longDescription}

Doelgroep: ${profile.targetAudience}
Belangrijkste thema's: ${profile.themes.join(", ")}
Website: ${profile.websiteUrl}
Standaard CTA: ${profile.defaultCta}
Standaard hashtags: ${profile.defaultHashtags.join(" ")}`);

  if (websiteSummary) {
    parts.push(`SAMENVATTING VAN DE WEBSITE:\n${websiteSummary}`);
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

  const taskByType: Record<string, string> = {
    COMPANY: `Schrijf een LinkedIn-post over wat ${profile.companyName} voor klanten betekent. Kies één concreet thema of voorbeeld, niet alles tegelijk.`,
    PRODUCT: `Schrijf een LinkedIn-post over het product ${products[0]?.name ?? ""}. Maak het concreet: welk probleem, welk resultaat.`,
    MULTI_PRODUCT: `Schrijf een LinkedIn-post waarin de producten ${products.map((p) => p.name).join(" en ")} samen een verhaal vormen, bijvoorbeeld hoe ze elkaar versterken in één werkproces.`,
    FREE_TOPIC: `Schrijf een LinkedIn-post over dit onderwerp: "${topic}". Verbind het op een natuurlijke manier met wat ${profile.companyName} doet.`,
    NEWS: `Schrijf een LinkedIn-post die inhaakt op deze actualiteit: "${topic}". Geef een nuchtere, praktische kijk vanuit ${profile.companyName}; geen hype.`,
    CASE: `Schrijf een LinkedIn-post over deze praktijkcase: "${topic}". Beschrijf situatie, aanpak en resultaat zonder vertrouwelijke details te verzinnen.`,
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
- fotorealistisch en professioneel zijn, als een echte zakelijke foto (niet herkenbaar als AI-beeld);
- passen bij een zakelijke Nederlandse/Europese context;
- GEEN mensen tonen: geen gezichten, ook niet op de achtergrond of onscherp; hooguit handen bij een toetsenbord of gereedschap;
- werken met objecten, werkplekken, laptops, documenten, dashboards, infrastructuur of projectomgevingen;
- duidelijk visueel verwijzen naar het onderwerp van de post, zodat de kijker zonder tekst kan raden waar de post over gaat;
- geen robots, hologrammen of overduidelijke AI-symboliek bevatten;
- geen grote hoeveelheden tekst bevatten (hooguit subtiel "${companyName}" of een productnaam);
- camera- en lichtbeschrijving bevatten voor een natuurlijk resultaat.

DE POST:
${postBody}

Antwoord uitsluitend met de Engelse prompt, zonder toelichting.`;
}
