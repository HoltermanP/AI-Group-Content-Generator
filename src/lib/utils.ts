import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PostStatus, ImageStatus, PostSourceType } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  DRAFT: "Concept",
  SCHEDULED: "Ingepland",
  PENDING_APPROVAL: "Wacht op goedkeuring",
  APPROVED: "Goedgekeurd",
  PUBLISHED: "Gepubliceerd",
  REJECTED: "Afgewezen",
  FAILED: "Mislukt",
};

export const POST_STATUS_COLORS: Record<PostStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PUBLISHED: "bg-violet-50 text-violet-700 border-violet-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
};

export const SOURCE_TYPE_LABELS: Record<PostSourceType, string> = {
  COMPANY: "Bedrijfsprofiel",
  PRODUCT: "Eén product",
  MULTI_PRODUCT: "Meerdere producten",
  FREE_TOPIC: "Vrij onderwerp",
  NEWS: "Actualiteit / nieuws",
  CASE: "Praktijkcase",
};

export const IMAGE_STATUS_LABELS: Record<ImageStatus, string> = {
  NONE: "Geen afbeelding",
  PENDING: "Prompt klaar",
  GENERATING: "Bezig met genereren",
  COMPLETED: "Klaar",
  FAILED: "Mislukt",
};

export const WEEKDAY_LABELS = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}
