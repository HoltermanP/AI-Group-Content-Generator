import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listWebsiteCases } from "@/lib/services/websiteCases";
import { CompanyProfileForm } from "./company-form";

export default async function CompanySettingsPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const [profile, websiteCases] = await Promise.all([
    prisma.companyProfile.findUnique({ where: { userId } }),
    listWebsiteCases(userId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bedrijfsprofiel</h1>
        <p className="text-muted-foreground">
          Dit profiel wordt bij elke postgeneratie als basis gebruikt.
        </p>
      </div>
      <CompanyProfileForm
        initialData={
          profile
            ? {
                companyName: profile.companyName,
                shortDescription: profile.shortDescription,
                longDescription: profile.longDescription,
                websiteUrl: profile.websiteUrl,
                toneOfVoice: profile.toneOfVoice,
                targetAudience: profile.targetAudience,
                themes: profile.themes.join(", "),
                defaultCta: profile.defaultCta,
                forbiddenPhrases: profile.forbiddenPhrases.join(", "),
                writingStyle: profile.writingStyle,
                defaultHashtags: profile.defaultHashtags.join(", "),
              }
            : null
        }
        websiteSummary={profile?.websiteSummary ?? null}
        websiteCases={websiteCases.map((c) => ({
          id: c.id,
          title: c.title,
          sector: c.sector,
          resultLine: c.resultLine,
          url: c.url,
          lastFetchedAt: c.lastFetchedAt.toISOString(),
          lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
