"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { productSchema, type ProductInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/app/confirm-dialog";

export interface ProductRow extends ProductInput {
  id: string;
}

const EMPTY: ProductInput = {
  name: "",
  shortDescription: "",
  longDescription: "",
  targetAudience: "",
  problem: "",
  benefits: "",
  useCases: "",
  cta: "",
  websiteUrl: "https://www.ai-group.nl",
  active: true,
};

export function ProductsClient({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState<ProductRow | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductInput>({ resolver: zodResolver(productSchema), defaultValues: EMPTY });

  function openCreate() {
    setEditing(null);
    reset(EMPTY);
    setDialogOpen(true);
  }

  function openEdit(product: ProductRow) {
    setEditing(product);
    reset(product);
    setDialogOpen(true);
  }

  async function onSubmit(data: ProductInput) {
    const url = editing ? `/api/products/${editing.id}` : "/api/products";
    const response = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error ?? "Opslaan mislukt.");
      return;
    }
    toast.success(editing ? "Product bijgewerkt." : "Product toegevoegd.");
    setDialogOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleting) return;
    const response = await fetch(`/api/products/${deleting.id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Verwijderen mislukt.");
      return;
    }
    toast.success("Product verwijderd.");
    router.refresh();
  }

  function textField(name: keyof ProductInput, label: string, textarea = false) {
    return (
      <div className="space-y-2">
        <Label htmlFor={name}>{label}</Label>
        {textarea ? (
          <Textarea id={name} rows={3} {...register(name)} />
        ) : (
          <Input id={name} {...register(name)} />
        )}
        {errors[name] && <p className="text-sm text-destructive">{String(errors[name]?.message)}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Product toevoegen
        </Button>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <p>Nog geen producten.</p>
            <p className="mt-1">Voeg je eerste product toe of draai het seed-script voor de AI-Group producten.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {products.map((product) => (
            <Card key={product.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{product.name}</CardTitle>
                  <Badge variant={product.active ? "secondary" : "outline"} className="mt-2">
                    {product.active ? "Actief" : "Inactief"}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(product)} title="Bewerken">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleting(product)} title="Verwijderen">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{product.shortDescription}</p>
                <p>
                  <span className="font-medium text-foreground">Doelgroep:</span> {product.targetAudience}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `${editing.name} bewerken` : "Nieuw product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {textField("name", "Productnaam")}
            {textField("shortDescription", "Korte omschrijving", true)}
            {textField("longDescription", "Uitgebreide omschrijving", true)}
            {textField("targetAudience", "Doelgroep", true)}
            {textField("problem", "Probleem dat het oplost", true)}
            {textField("benefits", "Voordelen", true)}
            {textField("useCases", "Concrete use-cases", true)}
            {textField("cta", "CTA")}
            {textField("websiteUrl", "Website-URL")}
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <p className="text-sm font-medium">Actief (wordt gebruikt bij automatische generatie)</p>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </div>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Bezig..." : "Opslaan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Product verwijderen"
        description={`Weet je zeker dat je "${deleting?.name}" wilt verwijderen? Gekoppelde posts blijven bestaan maar verliezen de productkoppeling.`}
        confirmLabel="Verwijderen"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
