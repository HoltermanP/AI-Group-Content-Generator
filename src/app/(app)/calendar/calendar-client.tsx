"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PostStatus } from "@prisma/client";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";
import { CalendarPlus, ChevronLeft, ChevronRight, List, LayoutGrid, Loader2, Sparkles } from "lucide-react";
import { cn, formatDateTime, POST_STATUS_COLORS } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/app/status-badge";

interface CalendarPost {
  id: string;
  title: string;
  status: PostStatus;
  scheduledAt: string;
  productName: string | null;
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CalendarClient({ posts }: { posts: CalendarPost[] }) {
  const router = useRouter();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState<"month" | "list">("month");
  const [filling, setFilling] = useState(false);
  const [reschedule, setReschedule] = useState<CalendarPost | null>(null);
  const [newDateTime, setNewDateTime] = useState("");

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const result: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) result.push(d);
    return result;
  }, [month]);

  async function fillCalendar() {
    setFilling(true);
    try {
      const response = await fetch("/api/calendar/fill", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Aanvullen mislukt.");
        return;
      }
      if (body.created === 0) {
        toast.info("De kalender is al gevuld voor de planningshorizon.");
      } else {
        toast.success(`${body.created} nieuwe post(s) gegenereerd en ingepland (wachten op goedkeuring).`);
      }
      router.refresh();
    } finally {
      setFilling(false);
    }
  }

  async function saveReschedule() {
    if (!reschedule || !newDateTime) return;
    const response = await fetch(`/api/posts/${reschedule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: new Date(newDateTime).toISOString() }),
    });
    if (!response.ok) {
      toast.error("Verplaatsen mislukt.");
      return;
    }
    toast.success("Publicatiedatum aangepast.");
    setReschedule(null);
    router.refresh();
  }

  const sortedPosts = [...posts].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-40 text-center font-medium capitalize">
            {format(month, "LLLL yyyy", { locale: nl })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            Vandaag
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={view === "month" ? "default" : "outline"} size="sm" onClick={() => setView("month")}>
            <LayoutGrid className="h-4 w-4" /> Maand
          </Button>
          <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>
            <List className="h-4 w-4" /> Lijst
          </Button>
          <Button onClick={fillCalendar} disabled={filling}>
            {filling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {filling ? "Bezig met genereren..." : "Vul kalender automatisch aan"}
          </Button>
        </div>
      </div>

      {view === "month" ? (
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-muted-foreground">
              {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border">
              {days.map((day) => {
                const dayPosts = posts.filter((p) => isSameDay(new Date(p.scheduledAt), day));
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-24 bg-card p-1.5",
                      !isSameMonth(day, month) && "bg-muted/50 text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                        isToday(day) && "bg-primary font-semibold text-primary-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayPosts.map((post) => (
                        <button
                          key={post.id}
                          onClick={() => {
                            setReschedule(post);
                            setNewDateTime(toLocalInputValue(post.scheduledAt));
                          }}
                          className={cn(
                            "block w-full truncate rounded border px-1.5 py-1 text-left text-xs",
                            POST_STATUS_COLORS[post.status],
                          )}
                          title={`${post.title} — ${formatDateTime(post.scheduledAt)}`}
                        >
                          {format(new Date(post.scheduledAt), "HH:mm")} {post.title}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {sortedPosts.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <p>Er staan nog geen posts in de kalender.</p>
                <p className="mt-1">Gebruik &quot;Vul kalender automatisch aan&quot; om te starten.</p>
              </div>
            ) : (
              <ul className="divide-y">
                {sortedPosts.map((post) => (
                  <li key={post.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <Link href={`/posts/${post.id}`} className="font-medium hover:underline">
                        {post.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(post.scheduledAt)}
                        {post.productName && ` · ${post.productName}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={post.status} />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReschedule(post);
                          setNewDateTime(toLocalInputValue(post.scheduledAt));
                        }}
                      >
                        <CalendarPlus className="h-4 w-4" /> Verplaatsen
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(reschedule)} onOpenChange={(open) => !open && setReschedule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicatiedatum wijzigen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{reschedule?.title}</p>
            <div className="space-y-2">
              <Label htmlFor="newDateTime">Nieuw publicatiemoment</Label>
              <Input
                id="newDateTime"
                type="datetime-local"
                value={newDateTime}
                onChange={(e) => setNewDateTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReschedule(null)}>
              Annuleren
            </Button>
            {reschedule && (
              <Link href={`/posts/${reschedule.id}`} className="inline-flex">
                <Button variant="outline">Post openen</Button>
              </Link>
            )}
            <Button onClick={saveReschedule}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
