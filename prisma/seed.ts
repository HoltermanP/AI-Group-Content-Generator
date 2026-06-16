import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("aigroup2026", 10);

  const user = await prisma.user.upsert({
    where: { email: "demo@ai-group.nl" },
    update: {},
    create: {
      email: "demo@ai-group.nl",
      name: "AI-Group Demo",
      passwordHash,
    },
  });

  await prisma.companyProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      companyName: "AI-Group",
      shortDescription:
        "AI-Group helpt bedrijven om processen slimmer, sneller en beter te maken met praktische AI-oplossingen.",
      longDescription:
        "AI-Group helpt bedrijven om processen slimmer, sneller en beter te maken met praktische AI-oplossingen. " +
        "Geen AI om de AI, maar concrete toepassingen die werk uit handen nemen, zoektijd verminderen, processen " +
        "versnellen en mensen helpen betere beslissingen te nemen. AI-Group analyseert processen, ziet waar AI " +
        "waarde toevoegt, bouwt de oplossing en helpt bij implementatie in de praktijk.",
      websiteUrl: "https://www.ai-group.nl",
      toneOfVoice:
        "Direct, praktisch, persoonlijk, zakelijk en concreet. Geen holle managementtaal. Geen overdreven AI-hype. " +
        "Wel duidelijk laten zien wat AI in de praktijk oplevert.",
      targetAudience:
        "Directeuren, ondernemers, projectleiders, managers, contractmanagers, infrabedrijven, netbeheerders, " +
        "aannemers, vastgoedbedrijven en organisaties die veel handmatig kenniswerk doen.",
      themes: [
        "AI-agents",
        "procesverbetering",
        "contractanalyse",
        "vergadernotulen",
        "engineering",
        "veiligheid",
        "toezicht",
        "energietransitie",
        "watertransitie",
        "slimmer werken",
        "minder handwerk",
        "sneller van vraag naar resultaat",
      ],
      defaultCta: "Bekijk meer op www.ai-group.nl",
      forbiddenPhrases: [
        "In de wereld van vandaag",
        "In het huidige digitale tijdperk",
        "game-changer",
        "revolutionair",
        "naar een hoger niveau tillen",
        "ontketen de kracht",
      ],
      writingStyle: "Kort, helder, actief geschreven. Concrete voorbeelden, geen abstracties.",
      defaultHashtags: ["#AIGroup", "#AI", "#Procesverbetering"],
    },
  });

  await prisma.contentSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      frequencyDays: 2,
      minDaysBetween: 1,
      preferredDays: [1, 2, 3, 4, 5],
      windowStart: "08:00",
      windowEnd: "18:00",
      timeVariationMinutes: 45,
      postLength: "kort",
      style: "persoonlijk, concreet, zakelijk, direct",
      useEmojis: false,
      hashtagCount: 3,
      defaultCta: "Bekijk meer op www.ai-group.nl",
      autoGenerate: false,
      autoPublish: false,
      planAheadDays: 14,
    },
  });

  const products = [
    {
      name: "AI-Meetings",
      shortDescription:
        "Zet gesprekken, overleggen en projectmeetings om in duidelijke notulen, besluiten, actielijsten en opvolging.",
      longDescription:
        "AI-Meetings luistert mee met gesprekken, overleggen en projectmeetings en zet deze automatisch om in " +
        "duidelijke notulen, besluitenlijsten en actiepunten met eigenaren. Acties worden opgevolgd, zodat niets " +
        "blijft liggen. Teams besparen uren uitwerktijd per week en iedereen weet wat er is afgesproken.",
      targetAudience: "Projectleiders, managers, directies en teams met veel overleggen.",
      problem:
        "Notulen maken kost veel tijd, acties blijven liggen en afspraken zijn achteraf niet terug te vinden.",
      benefits:
        "Geen handmatige notulen meer, duidelijke besluiten- en actielijsten, betere opvolging en doorzoekbare verslagen.",
      useCases:
        "Projectoverleggen in de infra, MT-vergaderingen, bouwvergaderingen, klantgesprekken en interne stand-ups.",
      cta: "Plan een demo van AI-Meetings via www.ai-group.nl",
      websiteUrl: "https://www.ai-group.nl",
    },
    {
      name: "AI-Contracts",
      shortDescription:
        "Leest contracten, haalt looptijden, verplichtingen, risico's en boeteclausules eruit en maakt contractinformatie snel doorzoekbaar.",
      longDescription:
        "AI-Contracts leest contracten en haalt automatisch looptijden, verplichtingen, risico's en boeteclausules " +
        "eruit. Contractinformatie wordt snel doorzoekbaar, zodat contractmanagers in seconden antwoord hebben op " +
        "vragen waar ze eerder uren naar zochten.",
      targetAudience: "Contractmanagers, inkopers, juristen en projectorganisaties met veel contracten.",
      problem:
        "Contractinformatie zit verstopt in lange documenten; deadlines, verplichtingen en risico's worden gemist.",
      benefits:
        "Snel inzicht in looptijden en verplichtingen, minder gemiste deadlines, lagere risico's en minder zoektijd.",
      useCases:
        "Contractdossiers bij aannemers, raamovereenkomsten bij netbeheerders, huurcontracten bij vastgoedbedrijven.",
      cta: "Ontdek AI-Contracts op www.ai-group.nl",
      websiteUrl: "https://www.ai-group.nl",
    },
    {
      name: "AI-Businessscan",
      shortDescription: "Analyseert processen en laat zien waar AI concreet waarde kan toevoegen.",
      longDescription:
        "De AI-Businessscan analyseert de processen van een organisatie en laat concreet zien waar AI waarde " +
        "toevoegt: welke taken geautomatiseerd kunnen worden, waar zoektijd zit en welke quick wins er zijn. " +
        "Het resultaat is een praktisch plan met haalbare AI-toepassingen, geen abstract adviesrapport.",
      targetAudience: "Directeuren, ondernemers en managers die willen weten waar AI hun organisatie helpt.",
      problem:
        "Organisaties weten dat AI kansen biedt, maar niet waar te beginnen of wat het concreet oplevert.",
      benefits:
        "Concreet overzicht van AI-kansen, prioritering op impact en haalbaarheid, direct uitvoerbaar plan.",
      useCases:
        "Procesanalyse bij infrabedrijven, kansenscan bij vastgoedorganisaties, AI-roadmap voor MKB-bedrijven.",
      cta: "Vraag de AI-Businessscan aan via www.ai-group.nl",
      websiteUrl: "https://www.ai-group.nl",
    },
    {
      name: "AI-Engineering",
      shortDescription:
        "Ondersteunt engineeringprocessen in de ondergrondse infrastructuur, zoals tracékeuzes, kabelberekeningen, vergunningen, bodemonderzoeken en werkplannen.",
      longDescription:
        "AI-Engineering ondersteunt engineeringprocessen in de ondergrondse infrastructuur. Van tracékeuzes en " +
        "kabelberekeningen tot vergunningen, bodemonderzoeken en werkplannen: AI-Engineering versnelt het werk " +
        "van engineers en verhoogt de kwaliteit van ontwerpen en documenten.",
      targetAudience: "Engineers, werkvoorbereiders en projectleiders bij infrabedrijven en netbeheerders.",
      problem:
        "Engineeringwerk in de ondergrondse infra is arbeidsintensief: veel zoeken, rekenen en documenten opstellen.",
      benefits:
        "Snellere doorlooptijden van ontwerp naar uitvoering, consistente documenten, minder handwerk voor engineers.",
      useCases:
        "Tracéstudies voor kabels en leidingen, automatische werkplannen, vergunningchecks, bodemdata-analyse.",
      cta: "Lees meer over AI-Engineering op www.ai-group.nl",
      websiteUrl: "https://www.ai-group.nl",
    },
    {
      name: "AI-Safety",
      shortDescription:
        "Helpt veiligheidsmeldingen, incidenten, werkplekinspecties en verbetermaatregelen slimmer vast te leggen en te analyseren.",
      longDescription:
        "AI-Safety helpt organisaties om veiligheidsmeldingen, incidenten, werkplekinspecties en verbetermaatregelen " +
        "slimmer vast te leggen en te analyseren. Melden wordt makkelijker, trends worden zichtbaar en " +
        "verbetermaatregelen krijgen opvolging.",
      targetAudience: "HSE-managers, veiligheidskundigen en uitvoerders bij aannemers en industriële bedrijven.",
      problem:
        "Veiligheidsmeldingen worden niet of te laat gedaan, analyses kosten veel tijd en lessen blijven onbenut.",
      benefits:
        "Lagere meldingsdrempel, automatische analyses en trends, betere opvolging van verbetermaatregelen.",
      useCases:
        "Werkplekinspecties op bouwlocaties, incidentanalyse bij infraprojecten, veiligheidsdashboards voor HSE-teams.",
      cta: "Ontdek AI-Safety op www.ai-group.nl",
      websiteUrl: "https://www.ai-group.nl",
    },
    {
      name: "AI-Toezicht",
      shortDescription:
        "Ondersteunt toezichthouders bij inspecties, verslaglegging, afwijkingen, fotoanalyse en opvolging.",
      longDescription:
        "AI-Toezicht ondersteunt toezichthouders bij inspecties, verslaglegging, afwijkingen, fotoanalyse en " +
        "opvolging. Inspectierapporten worden ter plekke gegenereerd, foto's worden automatisch geanalyseerd en " +
        "afwijkingen krijgen gestructureerde opvolging.",
      targetAudience: "Toezichthouders, directievoerders en opdrachtgevers in de bouw en infra.",
      problem:
        "Toezichthouders besteden veel tijd aan verslaglegging en het handmatig verwerken van foto's en afwijkingen.",
      benefits:
        "Snellere verslaglegging, consistente rapporten, automatische fotoanalyse en aantoonbare opvolging.",
      useCases:
        "Dagrapportages bij infraprojecten, fotoanalyse van werklocaties, afwijkingenregistratie en opvolging.",
      cta: "Lees meer over AI-Toezicht op www.ai-group.nl",
      websiteUrl: "https://www.ai-group.nl",
    },
  ];

  for (const product of products) {
    const existing = await prisma.product.findFirst({
      where: { userId: user.id, name: product.name },
    });
    if (!existing) {
      await prisma.product.create({ data: { ...product, userId: user.id, active: true } });
    }
  }

  console.log("Seed voltooid. Inloggen kan met demo@ai-group.nl / aigroup2026");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
