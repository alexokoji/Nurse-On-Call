'use client';

import { useActionState, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { saveCategoryAction } from '../../actions/services';
import { ServiceIcon, SERVICE_ICON_OPTIONS, ACCENT_OPTIONS } from '@/components/public/service-icon';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/feedback';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { slugify } from '@/lib/utils';
import type { ActionResult } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  accent: string;
  sortOrder: number;
  isActive: boolean;
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New category
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <div
            key={category.id}
            className="rounded-xl border border-border bg-card p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <ServiceIcon icon={category.icon} accent={category.accent} />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setEditing(category)}
                aria-label={`Edit ${category.name}`}
              >
                <Pencil className="size-3.5" />
              </Button>
            </div>

            <h3 className="mt-3 text-sm font-semibold text-navy-800">{category.name}</h3>
            <p className="font-mono text-xs text-muted-foreground">/{category.slug}</p>

            {category.description && (
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {category.description}
              </p>
            )}

            <div className="mt-3">
              <Badge variant={category.isActive ? 'success' : 'neutral'}>
                {category.isActive ? 'Active' : 'Hidden'}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {/* The key remounts the dialog when a different category is opened, so
          its form state re-initialises without an effect. */}
      <CategoryDialog
        key={editing?.id ?? 'new'}
        category={editing}
        open={creating || editing !== null}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
      />
    </>
  );
}

function CategoryDialog({
  category,
  open,
  onClose,
}: {
  category: Category | null;
  open: boolean;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(saveCategoryAction, INITIAL);
  // The parent keys this component on the category, so these initialisers run
  // fresh each time a different one is opened — no reset effect needed.
  const [name, setName] = useState(category?.name ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');

  useActionFeedback(state, { onSuccess: onClose });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Edit category' : 'New category'}</DialogTitle>
          <DialogDescription>
            Categories appear on the homepage and drive the service filters.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {category && <input type="hidden" name="categoryId" value={category.id} />}

          {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

          <Field label="Name" required error={state.fieldErrors?.name?.[0]}>
            <Input
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!category) setSlug(slugify(event.target.value));
              }}
              required
            />
          </Field>

          <Field label="Slug" required error={state.fieldErrors?.slug?.[0]}>
            <Input
              name="slug"
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
              required
            />
          </Field>

          <Field label="Description" error={state.fieldErrors?.description?.[0]}>
            <Textarea name="description" defaultValue={category?.description} rows={2} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Icon">
              <select
                name="icon"
                defaultValue={category?.icon ?? 'heart-pulse'}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm capitalize shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {SERVICE_ICON_OPTIONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon.replace(/-/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Accent">
              <select
                name="accent"
                defaultValue={category?.accent ?? 'crimson'}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm capitalize shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ACCENT_OPTIONS.map((accent) => (
                  <option key={accent} value={accent}>
                    {accent}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Sort order">
              <Input
                name="sortOrder"
                type="number"
                defaultValue={category?.sortOrder ?? 0}
              />
            </Field>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <span className="text-sm font-medium text-navy-800">Show on the public site</span>
            <Switch name="isActive" defaultChecked={category?.isActive ?? true} />
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving…">
              {category ? 'Save changes' : 'Create category'}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
