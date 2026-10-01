'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { saveArticleAction } from '../actions/services';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import { slugify } from '@/lib/utils';
import type { ActionResult } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { ImageUpload } from '@/components/forms/image-upload';

const INITIAL: ActionResult<{ id: string }> = { ok: false };

export interface ArticleDraft {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  tags: string[];
  authorName: string;
  readMinutes: number;
  status: string;
}

const CATEGORIES = [
  'General Health',
  'Chronic Conditions',
  'Home Care',
  'Elderly Care',
  'Diagnostics',
  'Preventive Care',
  'Maternal Health',
  'Mental Health',
];

export function ArticleForm({ article }: { article: ArticleDraft | null }) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveArticleAction, INITIAL);

  const [title, setTitle] = useState(article?.title ?? '');
  const [slug, setSlug] = useState(article?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(article));

  useActionFeedback(state, { onSuccess: () => router.push('/admin/content') });

  return (
    <form action={formAction} className="space-y-5">
      {article && <input type="hidden" name="articleId" value={article.id} />}

      {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[1.8fr_1fr] lg:items-start">
        <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
          <Field label="Title" required error={state.fieldErrors?.title?.[0]}>
            <Input
              name="title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (!slugTouched) setSlug(slugify(event.target.value));
              }}
              required
            />
          </Field>

          <Field
            label="URL slug"
            required
            description={`Public address: /health-resources/${slug || 'your-slug'}`}
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

          <Field
            label="Excerpt"
            required
            description="Shown on cards and used as the meta description."
            error={state.fieldErrors?.excerpt?.[0]}
          >
            <Textarea name="excerpt" defaultValue={article?.excerpt} rows={3} maxLength={400} required />
          </Field>

          <Field
            label="Article body"
            required
            description={
              'Plain text. Start a line with "## " for a heading, "- " for a bullet, and wrap ' +
              'text in ** for bold. Separate paragraphs with a blank line.'
            }
            error={state.fieldErrors?.content?.[0]}
          >
            <Textarea
              name="content"
              defaultValue={article?.content}
              rows={22}
              className="font-mono text-[13px]"
              required
            />
          </Field>
        </section>

        <div className="space-y-5">
          <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-sm font-semibold text-navy-800">Publishing</h2>

            <Field label="Status" error={state.fieldErrors?.status?.[0]}>
              <select
                name="status"
                defaultValue={article?.status ?? 'draft'}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </Field>

            <Field label="Category" error={state.fieldErrors?.category?.[0]}>
              <select
                name="category"
                defaultValue={article?.category ?? 'General Health'}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Author" error={state.fieldErrors?.authorName?.[0]}>
              <Input
                name="authorName"
                defaultValue={article?.authorName ?? 'NurseOnCall Clinical Team'}
              />
            </Field>

            <Field
              label="Read time (minutes)"
              error={state.fieldErrors?.readMinutes?.[0]}
            >
              <Input
                name="readMinutes"
                type="number"
                min={1}
                max={60}
                defaultValue={article?.readMinutes ?? 5}
              />
            </Field>

            <Field label="Tags" description="Separate with commas.">
              <Input
                name="tags"
                defaultValue={article?.tags.join(', ')}
                placeholder="hypertension, monitoring"
              />
            </Field>

            <ImageUpload
              name="coverImage"
              folder="article"
              label="Cover image"
              defaultValue={article?.coverImage}
              description="Heads the article and appears on the resources list."
            />
            {state.fieldErrors?.coverImage?.[0] && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {state.fieldErrors.coverImage[0]}
              </p>
            )}
          </section>

          <Alert variant="info">
            Article bodies are rendered as text, never as raw HTML — so formatting stays simple and
            content can never inject scripts into the page.
          </Alert>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
        <Button asChild variant="ghost">
          <Link href="/admin/content">Cancel</Link>
        </Button>
        <SubmitButton size="lg" pendingLabel="Saving…">
          {article ? 'Save changes' : 'Create article'}
        </SubmitButton>
      </div>
    </form>
  );
}
