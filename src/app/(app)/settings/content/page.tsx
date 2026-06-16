import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContentSettingsForm } from "./content-form";

export default async function ContentSettingsPage() {
  const session = await getServerSession(authOptions);
  const settings = await prisma.contentSettings.findUnique({ where: { userId: session!.user.id } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contentinstellingen</h1>
        <p className="text-muted-foreground">
          Bepaal hoe vaak en in welke stijl er gepubliceerd wordt.
        </p>
      </div>
      <ContentSettingsForm
        initialData={
          settings
            ? {
                frequencyDays: settings.frequencyDays,
                minDaysBetween: settings.minDaysBetween,
                preferredDays: settings.preferredDays,
                windowStart: settings.windowStart,
                windowEnd: settings.windowEnd,
                timeVariationMinutes: settings.timeVariationMinutes,
                postLength: settings.postLength as "kort" | "middel" | "lang",
                style: settings.style,
                useEmojis: settings.useEmojis,
                hashtagCount: settings.hashtagCount,
                defaultCta: settings.defaultCta,
                autoGenerate: settings.autoGenerate,
                autoPublish: settings.autoPublish,
                planAheadDays: settings.planAheadDays,
              }
            : null
        }
      />
    </div>
  );
}
