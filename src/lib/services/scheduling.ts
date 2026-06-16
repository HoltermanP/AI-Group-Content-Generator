import type { ContentSettings } from "@prisma/client";
import { addDays, isSameDay, setHours, setMinutes, startOfDay } from "date-fns";

/**
 * Planningservice: berekent publicatiemomenten op basis van de contentinstellingen.
 *
 * Houdt rekening met:
 * - publicatiefrequentie (elke X dagen)
 * - minimumaantal dagen tussen posts
 * - voorkeursdagen
 * - tijdvenster (bijv. 08:00–18:00)
 * - natuurlijke spreiding van de plaatsingstijd (± variatie in minuten),
 *   zodat de contentkalender een natuurlijk ritme heeft en het bereik
 *   over verschillende momenten wordt gespreid.
 */

function parseTime(value: string): { hours: number; minutes: number } {
  const [hours, minutes] = value.split(":").map(Number);
  return { hours: hours ?? 9, minutes: minutes ?? 0 };
}

/** Kiest een tijdstip binnen het voorkeursvenster, met variatie rond het midden. */
function pickTimeInWindow(day: Date, settings: ContentSettings): Date {
  const start = parseTime(settings.windowStart);
  const end = parseTime(settings.windowEnd);

  const startMin = start.hours * 60 + start.minutes;
  const endMin = Math.max(end.hours * 60 + end.minutes, startMin + 30);
  const midpoint = Math.round((startMin + endMin) / 2);

  const variation = settings.timeVariationMinutes;
  const offset = variation > 0 ? Math.round((Math.random() * 2 - 1) * variation) : 0;
  const chosen = Math.min(Math.max(midpoint + offset, startMin), endMin);

  return setMinutes(setHours(startOfDay(day), Math.floor(chosen / 60)), chosen % 60);
}

function isPreferredDay(day: Date, settings: ContentSettings): boolean {
  if (settings.preferredDays.length === 0) return true;
  return settings.preferredDays.includes(day.getDay());
}

function conflictsWithExisting(day: Date, existing: Date[], minDaysBetween: number): boolean {
  return existing.some((d) => {
    const diffDays = Math.abs(startOfDay(d).getTime() - startOfDay(day).getTime()) / 86_400_000;
    return diffDays < Math.max(minDaysBetween, 1) || isSameDay(d, day);
  });
}

/**
 * Berekent de volgende `count` publicatiemomenten, rekening houdend met al
 * geplande posts.
 */
export function computeNextSlots(options: {
  settings: ContentSettings;
  existingScheduled: Date[];
  count: number;
  from?: Date;
}): Date[] {
  const { settings, existingScheduled, count } = options;
  const from = options.from ?? new Date();
  const slots: Date[] = [];
  const taken = [...existingScheduled];

  // Startpunt: na de laatst geplande post of vanaf morgen.
  const lastScheduled = taken.length > 0 ? new Date(Math.max(...taken.map((d) => d.getTime()))) : null;
  let cursor =
    lastScheduled && lastScheduled > from
      ? addDays(startOfDay(lastScheduled), settings.frequencyDays)
      : addDays(startOfDay(from), 1);

  let guard = 0;
  while (slots.length < count && guard < 400) {
    guard++;
    if (!isPreferredDay(cursor, settings) || conflictsWithExisting(cursor, taken, settings.minDaysBetween)) {
      cursor = addDays(cursor, 1);
      continue;
    }
    const slot = pickTimeInWindow(cursor, settings);
    slots.push(slot);
    taken.push(slot);
    cursor = addDays(cursor, Math.max(settings.frequencyDays, settings.minDaysBetween, 1));
  }

  return slots;
}

/**
 * Bepaalt hoeveel posts er nog gepland moeten worden om de komende
 * `planAheadDays` dagen volgens de frequentie gevuld te hebben.
 */
export function postsNeededForHorizon(settings: ContentSettings, scheduledInHorizon: number): number {
  const target = Math.floor(settings.planAheadDays / Math.max(settings.frequencyDays, 1));
  return Math.max(0, target - scheduledInHorizon);
}
