'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { saveServiceAction } from '../actions/services';
import { Field, FieldSet } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/misc';
import { Alert } from '@/components/ui/feedback';
import { SERVICE_ICON_OPTIONS } from '@/components/public/service-icon';
import { slugify } from '@/lib/utils';
import { SERVICE_TYPES, SERVICE_STATUSES, LABELS } from '@/types';
import type { ActionResult } from '@/types';
import type { getServiceForEdit } from '@/lib/queries/admin';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { ImageUpload } from '@/components/forms/image-upload';

const INITIAL: ActionResult<{ id: string }> = { ok: false };

type ServiceDraft = NonNullable<Awaited<ReturnType<typeof getServiceForEdit>>>;

export function ServiceForm({
  service,
  categories,
}: {
  service: ServiceDraft | null;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveServiceAction, INITIAL);

  const [name, setName] = useState(service?.name ?? '');
  const [slug, setSlug] = useState(service?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(service));

  useActionFeedback(state, { onSuccess: () => router.push('/admin/services') });

  return (
    <form action={formAction} className="space-y-5">
      {service && <input type="hidden" name="serviceId" value={service.id} />}

      {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Card title="Basics">
            <Field label="Service name" required error={state.fieldErrors?.name?.[0]}>
              <Input
                name="name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  // Auto-fill the slug until the user edits it themselves.
                  if (!slugTouched) setSlug(slugify(event.target.value));
                }}
                placeholder="Home Nursing"
                required
              />
            </Field>

            <Field
              label="URL slug"
              required
              description={`Public address: /services/${slug || 'your-slug'}`}
              error={state.fieldErrors?.slug?.[0]}
            >
              <Input
                name="slug"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value));
                }}
                required
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Category" required error={state.fieldErrors?.categoryId?.[0]}>
                <Select name="categoryId" defaultValue={service?.categoryId} required>
                  <option value="">Choose a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Icon" error={state.fieldErrors?.icon?.[0]}>
                <Select name="icon" defaultValue={service?.icon ?? 'stethoscope'}>
                  {SERVICE_ICON_OPTIONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon.replace(/-/g, ' ')}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label="Short description"
              required
              description="One line, shown on cards and in search results."
              error={state.fieldErrors?.shortDescription?.[0]}
            >
              <Input
                name="shortDescription"
                defaultValue={service?.shortDescription}
                maxLength={240}
                required
              />
            </Field>

            <Field
              label="Full description"
              required
              description="Separate paragraphs with a blank line."
              error={state.fieldErrors?.description?.[0]}
            >
              <Textarea name="description" defaultValue={service?.description} rows={8} required />
            </Field>

            <ImageUpload
              name="image"
              folder="service"
              label="Service image"
              defaultValue={service?.image}
              description="Shown on the service page and its card. Landscape works best."
            />
            {state.fieldErrors?.image?.[0] && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {state.fieldErrors.image[0]}
              </p>
            )}
          </Card>

          <Card title="Details shown to patients">
            <RepeatableList
              name="whatsIncluded"
              label="What's included"
              placeholder="Full assessment of vital signs"
              initial={service?.whatsIncluded ?? ['']}
            />
            <RepeatableList
              name="requirements"
              label="What the patient needs"
              placeholder="A valid prescription"
              initial={service?.requirements ?? ['']}
            />
            <RepeatableList
              name="preparation"
              label="How to prepare"
              placeholder="Fast for 8 hours before the appointment"
              initial={service?.preparation ?? ['']}
            />
            <FaqList initial={service?.faqs ?? []} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Pricing &amp; duration">
            <Field
              label="Price (₦)"
              required
              description="What the patient pays for a standard booking."
              error={state.fieldErrors?.price?.[0]}
            >
              <Input
                name="price"
                type="number"
                min={0}
                step={100}
                defaultValue={service?.price ?? ''}
                required
              />
            </Field>

            <Field
              label="Home visit surcharge (₦)"
              description="Added only when the patient chooses a home visit."
              error={state.fieldErrors?.homeVisitSurcharge?.[0]}
            >
              <Input
                name="homeVisitSurcharge"
                type="number"
                min={0}
                step={100}
                defaultValue={service?.homeVisitSurcharge ?? 0}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Duration (min)"
                required
                error={state.fieldErrors?.durationMinutes?.[0]}
              >
                <Input
                  name="durationMinutes"
                  type="number"
                  min={5}
                  step={5}
                  defaultValue={service?.durationMinutes ?? 60}
                  required
                />
              </Field>

              <Field
                label="Buffer (min)"
                description="Travel / clean-up after."
                error={state.fieldErrors?.bufferMinutes?.[0]}
              >
                <Input
                  name="bufferMinutes"
                  type="number"
                  min={0}
                  step={5}
                  defaultValue={service?.bufferMinutes ?? 15}
                />
              </Field>
            </div>

            <Field
              label="Delivered as"
              required
              description="Controls which locations a patient may choose."
              error={state.fieldErrors?.serviceType?.[0]}
            >
              <Select name="serviceType" defaultValue={service?.serviceType ?? 'clinic'} required>
                {SERVICE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {LABELS.serviceType[type]}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>

          <Card title="Publishing">
            <Field label="Status" error={state.fieldErrors?.status?.[0]}>
              <Select name="status" defaultValue={service?.status ?? 'draft'}>
                {SERVICE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status[0].toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <span>
                <span className="block text-sm font-medium text-navy-800">Feature this service</span>
                <span className="block text-xs text-muted-foreground">
                  Highlights it on the homepage.
                </span>
              </span>
              <Switch name="isFeatured" defaultChecked={service?.isFeatured} />
            </label>
          </Card>

          <Card title="Search engine listing">
            <Field
              label="SEO title"
              description="Up to 70 characters. Defaults to the service name."
              error={state.fieldErrors?.seoTitle?.[0]}
            >
              <Input name="seoTitle" defaultValue={service?.seoTitle} maxLength={70} />
            </Field>

            <Field
              label="Meta description"
              description="Up to 160 characters."
              error={state.fieldErrors?.seoDescription?.[0]}
            >
              <Textarea
                name="seoDescription"
                defaultValue={service?.seoDescription}
                rows={3}
                maxLength={160}
              />
            </Field>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
        <Button asChild variant="ghost">
          <Link href="/admin/services">Cancel</Link>
        </Button>
        <SubmitButton size="lg" pendingLabel="Saving…">
          {service ? 'Save changes' : 'Create service'}
        </SubmitButton>
      </div>
    </form>
  );
}

/* ── Building blocks ──────────────────────────────────────────────── */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <h2 className="border-b border-border px-5 py-4 text-sm font-semibold text-navy-800">
        {title}
      </h2>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm capitalize shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </select>
  );
}

/**
 * A repeatable text list. Each row posts under the same field name, which the
 * server action reads with `formData.getAll()` — no JSON encoding needed.
 */
function RepeatableList({
  name,
  label,
  placeholder,
  initial,
}: {
  name: string;
  label: string;
  placeholder: string;
  initial: string[];
}) {
  const [items, setItems] = useState<string[]>(initial.length > 0 ? initial : ['']);

  return (
    <FieldSet legend={label}>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <Input
              name={name}
              value={item}
              onChange={(event) => {
                const next = [...items];
                next[index] = event.target.value;
                setItems(next);
              }}
              placeholder={placeholder}
              aria-label={`${label} item ${index + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setItems(items.filter((_, i) => i !== index))}
              disabled={items.length === 1}
              aria-label={`Remove ${label} item ${index + 1}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, ''])}>
        <Plus className="size-3.5" />
        Add another
      </Button>
    </FieldSet>
  );
}

function FaqList({ initial }: { initial: { question: string; answer: string }[] }) {
  const [faqs, setFaqs] = useState(initial.length > 0 ? initial : [{ question: '', answer: '' }]);

  const update = (index: number, key: 'question' | 'answer', value: string) => {
    const next = [...faqs];
    next[index] = { ...next[index], [key]: value };
    setFaqs(next);
  };

  return (
    <FieldSet legend="Frequently asked questions">
      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <div key={index} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Question {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setFaqs(faqs.filter((_, i) => i !== index))}
                disabled={faqs.length === 1}
                aria-label={`Remove question ${index + 1}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>

            <Input
              name="faqQuestion"
              value={faq.question}
              onChange={(event) => update(index, 'question', event.target.value)}
              placeholder="How quickly can a nurse reach me?"
              aria-label={`Question ${index + 1}`}
            />
            <Textarea
              name="faqAnswer"
              value={faq.answer}
              onChange={(event) => update(index, 'answer', event.target.value)}
              rows={3}
              placeholder="Same-day visits are usually available…"
              aria-label={`Answer ${index + 1}`}
            />
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}
      >
        <Plus className="size-3.5" />
        Add a question
      </Button>
    </FieldSet>
  );
}
