"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { contentSettingsSchema, type ContentSettingsInput } from "@/lib/validations";
import { cn, WEEKDAY_LABELS } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DEFAULTS: ContentSettingsInput = {
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
  autoApprove: false,
  autoPublish: false,
  planAheadDays: 14,
};

export function ContentSettingsForm({ initialData }: { initialData: ContentSettingsInput | null }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContentSettingsInput>({
    resolver: zodResolver(contentSettingsSchema),
    defaultValues: initialData ?? DEFAULTS,
  });

  const fullyAutomatic = watch("autoGenerate") && watch("autoApprove") && watch("autoPublish");

  function setFullyAutomatic(on: boolean) {
    setValue("autoGenerate", on, { shouldDirty: true });
    setValue("autoApprove", on, { shouldDirty: true });
    setValue("autoPublish", on, { shouldDirty: true });
  }

  async function onSubmit(data: ContentSettingsInput) {
    const response = await fetch("/api/content-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error ?? "Opslaan mislukt.");
      return;
    }
    toast.success("Contentinstellingen opgeslagen.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card className={fullyAutomatic ? "border-emerald-300 bg-emerald-50/50" : undefined}>
        <CardHeader>
          <CardTitle>Volledig automatische modus</CardTitle>
          <CardDescription>
            De app genereert posts volgens jouw frequentie, maakt er een fotorealistische afbeelding bij,
            keurt ze automatisch goed en publiceert ze op het geplande moment via de LinkedIn-koppeling.
            Jij hoeft alleen de frequentie hieronder in te stellen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border bg-card p-4">
            <div>
              <p className="text-sm font-medium">
                {fullyAutomatic ? "Aan — de app plaatst zelfstandig posts" : "Uit — posts wachten op jouw goedkeuring"}
              </p>
              <p className="text-xs text-muted-foreground">
                Vereist een actieve LinkedIn-koppeling (Instellingen → Integraties). Je kunt elke post
                achteraf terugzien onder Posts.
              </p>
            </div>
            <Switch checked={fullyAutomatic} onCheckedChange={setFullyAutomatic} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publicatieritme</CardTitle>
          <CardDescription>
            De kalender plant met dit ritme en spreidt publicatietijden op natuurlijke wijze binnen het venster.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="frequencyDays">Publiceer elke ... dagen</Label>
              <Input id="frequencyDays" type="number" min={1} {...register("frequencyDays")} />
              {errors.frequencyDays && <p className="text-sm text-destructive">{errors.frequencyDays.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="minDaysBetween">Minimaal aantal dagen tussen posts</Label>
              <Input id="minDaysBetween" type="number" min={0} {...register("minDaysBetween")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planAheadDays">Vooruit plannen (dagen)</Label>
              <Input id="planAheadDays" type="number" min={7} max={90} {...register("planAheadDays")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Voorkeursdagen</Label>
            <Controller
              control={control}
              name="preferredDays"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_LABELS.map((label, day) => {
                    const selected = field.value.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          field.onChange(
                            selected ? field.value.filter((d) => d !== day) : [...field.value, day].sort(),
                          )
                        }
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-sm transition-colors",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            />
            {errors.preferredDays && <p className="text-sm text-destructive">{errors.preferredDays.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="windowStart">Venster vanaf</Label>
              <Input id="windowStart" type="time" {...register("windowStart")} />
              {errors.windowStart && <p className="text-sm text-destructive">{errors.windowStart.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="windowEnd">Venster tot</Label>
              <Input id="windowEnd" type="time" {...register("windowEnd")} />
              {errors.windowEnd && <p className="text-sm text-destructive">{errors.windowEnd.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeVariationMinutes">Spreiding plaatsingstijd (± minuten)</Label>
              <Input id="timeVariationMinutes" type="number" min={0} max={240} {...register("timeVariationMinutes")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stijl van de posts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="postLength">Standaard postlengte</Label>
              <Select id="postLength" {...register("postLength")}>
                <option value="kort">Kort (aanbevolen)</option>
                <option value="middel">Middel</option>
                <option value="lang">Lang</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hashtagCount">Aantal hashtags</Label>
              <Input id="hashtagCount" type="number" min={0} max={10} {...register("hashtagCount")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="style">Gewenste stijl</Label>
            <Input id="style" {...register("style")} />
            {errors.style && <p className="text-sm text-destructive">{errors.style.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultCta">Standaard CTA</Label>
            <Input id="defaultCta" {...register("defaultCta")} />
            {errors.defaultCta && <p className="text-sm text-destructive">{errors.defaultCta.message}</p>}
          </div>
          <Controller
            control={control}
            name="useEmojis"
            render={({ field }) => (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Emoji's gebruiken</p>
                  <p className="text-xs text-muted-foreground">Spaarzaam, maximaal twee per post.</p>
                </div>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automatisering (losse instellingen)</CardTitle>
          <CardDescription>
            De drie stappen achter de automatische modus, ook los in te stellen. Zonder &quot;Automatisch
            goedkeuren&quot; wordt er nooit gepubliceerd zonder jouw expliciete akkoord.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Controller
            control={control}
            name="autoGenerate"
            render={({ field }) => (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Automatisch nieuwe conceptposts genereren</p>
                  <p className="text-xs text-muted-foreground">
                    De achtergrondtaak vult de kalender aan als er onvoldoende geplande posts zijn.
                  </p>
                </div>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
          <Controller
            control={control}
            name="autoApprove"
            render={({ field }) => (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Automatisch goedkeuren</p>
                  <p className="text-xs text-muted-foreground">
                    Automatisch gegenereerde posts worden direct goedgekeurd, zonder handmatige controle.
                  </p>
                </div>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
          <Controller
            control={control}
            name="autoPublish"
            render={({ field }) => (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Automatische publicatie ná goedkeuring</p>
                  <p className="text-xs text-muted-foreground">
                    Alleen goedgekeurde posts, alleen via de officiële LinkedIn-koppeling.
                  </p>
                </div>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Bezig met opslaan..." : "Instellingen opslaan"}
      </Button>
    </form>
  );
}
