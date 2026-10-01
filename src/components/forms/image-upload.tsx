'use client';

import { useRef, useState } from 'react';
import NextImage from 'next/image';
import { ImageUp, Link2, Loader2, Trash2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Image field that uploads to the media library, with a URL box as a fallback.
 *
 * The URL option stays for two reasons: the storage keys may not be configured
 * yet, and an operator may already host the image elsewhere. Either way the
 * component's output is the same — a single hidden input carrying a URL — so
 * the server actions did not have to change at all.
 *
 * Validation here mirrors the server's and exists only to fail fast; the route
 * re-checks size and sniffs the real file type regardless.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

export type UploadFolder = 'service' | 'staff' | 'article' | 'branding';

export function ImageUpload({
  name,
  defaultValue = '',
  folder,
  label = 'Image',
  description,
  /** Preview aspect ratio — portrait suits a staff photo, landscape a cover. */
  aspect = 'landscape',
}: {
  name: string;
  defaultValue?: string;
  folder: UploadFolder;
  label?: string;
  description?: string;
  aspect?: 'landscape' | 'square' | 'portrait';
}) {
  const [url, setUrl] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ratio = {
    landscape: 'aspect-[16/9]',
    square: 'aspect-square',
    portrait: 'aspect-[3/4]',
  }[aspect];

  async function upload(file: File) {
    setError(null);

    if (file.size > MAX_BYTES) {
      setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`);
      return;
    }

    setUploading(true);

    try {
      const body = new FormData();
      body.set('file', file);
      body.set('folder', folder);

      const response = await fetch('/api/admin/upload', { method: 'POST', body });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? 'That image could not be uploaded.');
        return;
      }

      setUrl(payload.url);
    } catch {
      setError('We could not reach the upload service. Check your connection and try again.');
    } finally {
      setUploading(false);
      // Clear the picker so choosing the same file again still fires onChange.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-navy-800">{label}</span>
        <button
          type="button"
          onClick={() => setShowUrlInput((shown) => !shown)}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Link2 className="size-3" aria-hidden />
          {showUrlInput ? 'Upload a file instead' : 'Use a URL instead'}
        </button>
      </div>

      {/* The value the form actually submits, whichever route produced it. */}
      <input type="hidden" name={name} value={url} />

      {showUrlInput ? (
        <Input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://…"
          aria-label={`${label} URL`}
        />
      ) : url ? (
        <div className="space-y-2">
          <div
            className={cn(
              'relative overflow-hidden rounded-lg border border-border bg-secondary/40',
              ratio,
            )}
          >
            <NextImage
              src={url}
              alt=""
              fill
              sizes="(min-width: 640px) 24rem, 90vw"
              className="object-cover"
              // The URL route accepts any host, which next/image will refuse
              // unless it is in remotePatterns — so skip optimisation here and
              // let the preview load regardless.
              unoptimized
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <ImageUp className="size-3.5" />
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-red-50"
              onClick={() => {
                setUrl('');
                setError(null);
              }}
            >
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-8 transition-colors',
            'hover:border-brand-300 hover:bg-secondary/60',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            uploading && 'cursor-wait opacity-70',
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
              <span className="text-sm text-muted-foreground">Uploading…</span>
            </>
          ) : (
            <>
              <ImageUp className="size-5 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium text-navy-800">Choose an image</span>
              <span className="text-xs text-muted-foreground">JPEG, PNG or WebP · up to 5 MB</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-destructive">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {description && !error && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
