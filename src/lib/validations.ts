import { z } from "zod";

// ─── Bedrijfsprofiel ──────────────────────────────────────────────────────────

export const companyProfileSchema = z.object({
  companyName: z.string().min(1, "Bedrijfsnaam is verplicht"),
  shortDescription: z.string().min(10, "Geef een korte omschrijving (min. 10 tekens)"),
  longDescription: z.string().min(30, "Geef een uitgebreide omschrijving (min. 30 tekens)"),
  websiteUrl: z.string().url("Voer een geldige URL in"),
  toneOfVoice: z.string().min(5, "Beschrijf de tone of voice"),
  targetAudience: z.string().min(5, "Beschrijf de doelgroep"),
  themes: z.string(), // komma-gescheiden in het formulier
  defaultCta: z.string().min(3, "Geef een standaard CTA"),
  forbiddenPhrases: z.string(),
  writingStyle: z.string().min(3, "Beschrijf de schrijfstijl"),
  defaultHashtags: z.string(),
});

export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

// ─── Product ──────────────────────────────────────────────────────────────────

export const productSchema = z.object({
  name: z.string().min(1, "Productnaam is verplicht"),
  shortDescription: z.string().min(10, "Korte omschrijving is verplicht (min. 10 tekens)"),
  longDescription: z.string().min(20, "Uitgebreide omschrijving is verplicht (min. 20 tekens)"),
  targetAudience: z.string().min(3, "Doelgroep is verplicht"),
  problem: z.string().min(3, "Beschrijf het probleem dat het oplost"),
  benefits: z.string().min(3, "Beschrijf de voordelen"),
  useCases: z.string().min(3, "Beschrijf concrete use-cases"),
  cta: z.string().min(3, "CTA is verplicht"),
  websiteUrl: z.union([z.string().url("Voer een geldige URL in"), z.literal("")]).optional(),
  active: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;

// ─── Contentinstellingen ──────────────────────────────────────────────────────

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Gebruik HH:MM, bijv. 08:00");

export const contentSettingsSchema = z.object({
  frequencyDays: z.coerce.number().int().min(1, "Minimaal 1 dag").max(30),
  minDaysBetween: z.coerce.number().int().min(0).max(30),
  preferredDays: z.array(z.number().int().min(0).max(6)).min(1, "Kies minimaal één dag"),
  windowStart: timeString,
  windowEnd: timeString,
  timeVariationMinutes: z.coerce.number().int().min(0).max(240),
  postLength: z.enum(["kort", "middel", "lang"]),
  style: z.string().min(3),
  useEmojis: z.boolean(),
  hashtagCount: z.coerce.number().int().min(0).max(10),
  defaultCta: z.string().min(3),
  autoGenerate: z.boolean(),
  autoApprove: z.boolean().default(false),
  autoPublish: z.boolean(),
  planAheadDays: z.coerce.number().int().min(7).max(90),
});

export type ContentSettingsInput = z.infer<typeof contentSettingsSchema>;

// ─── Postgeneratie ────────────────────────────────────────────────────────────

export const generatePostSchema = z
  .object({
    sourceType: z.enum(["COMPANY", "PRODUCT", "MULTI_PRODUCT", "FREE_TOPIC", "NEWS", "CASE"]),
    productIds: z.array(z.string()).default([]),
    topic: z.string().max(2000).optional(),
    /** Case van de website (WebsiteCase.id) als bron voor een CASE-post. */
    websiteCaseId: z.string().optional(),
    count: z.coerce.number().int().min(1).max(5).default(1),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === "PRODUCT" && data.productIds.length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["productIds"], message: "Kies precies één product" });
    }
    if (data.sourceType === "MULTI_PRODUCT" && data.productIds.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["productIds"], message: "Kies minimaal twee producten" });
    }
    if (["FREE_TOPIC", "NEWS"].includes(data.sourceType) && !data.topic?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["topic"], message: "Vul een onderwerp in" });
    }
    if (data.sourceType === "CASE" && !data.topic?.trim() && !data.websiteCaseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["topic"],
        message: "Kies een case van de website of beschrijf de case zelf",
      });
    }
  });

export type GeneratePostInput = z.infer<typeof generatePostSchema>;

// ─── Post bewerken ────────────────────────────────────────────────────────────

export const updatePostSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  cta: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  topic: z.string().nullable().optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  imagePrompt: z.string().optional(),
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

// ─── AI-output ────────────────────────────────────────────────────────────────

export const generatedPostOutputSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  body: z.string().min(1),
  cta: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
  imagePrompt: z.string().min(1),
});

export type GeneratedPostOutput = z.infer<typeof generatedPostOutputSchema>;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  name: z.string().min(2, "Naam is verplicht"),
  email: z.string().email("Voer een geldig e-mailadres in"),
  password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens zijn"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Splitst komma- of newline-gescheiden invoer naar een nette string-array. */
export function toList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
