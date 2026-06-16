import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CompanyProfileForm } from "./company-form";

export default async function CompanySettingsPage() {
  const session = await getServerSession(authOptions);
  const profile = await prisma.companyProfile.findUnique({ where: { userId: session!.user.id } });

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
      />
    </div>
  );
}
