import 'server-only';
import { createHash } from 'crypto';

/**
 * Cloudinary uploads, signed and performed server-side.
 *
 * The browser never sees the API secret and never talks to Cloudinary: it
 * posts the file to our own route, which authenticates the admin, validates
 * the bytes, and then forwards the upload. An unsigned browser-side preset
 * would be simpler but would let anyone with the preset name fill the
 * account's storage.
 *
 * No SDK — the REST API over fetch keeps one less dependency to patch.
 */

const API_BASE = 'https://api.cloudinary.com/v1_1';

/** Where each kind of image lives in the Cloudinary media library. */
export const UPLOAD_FOLDERS = {
  service: 'nurseoncall/services',
  staff: 'nurseoncall/staff',
  article: 'nurseoncall/articles',
  branding: 'nurseoncall/branding',
} as const;

export type UploadFolder = keyof typeof UPLOAD_FOLDERS;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

/** Accepted types, checked against the file's actual bytes, not its header. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

/**
 * Identifies an image by its magic bytes.
 *
 * The browser-supplied Content-Type is attacker-controlled, so a file claiming
 * to be a PNG could be anything. Reading the signature is what actually keeps
 * a script or a polyglot file out of the media library.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => bytes[index] === byte)) return 'image/png';

  // WebP: "RIFF" .... "WEBP"
  const riff = String.fromCharCode(...bytes.subarray(0, 4));
  const webp = String.fromCharCode(...bytes.subarray(8, 12));
  if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp';

  return null;
}

/**
 * Cloudinary's signature: the signed parameters sorted by key, joined as a
 * querystring, with the API secret appended, hashed with SHA-1.
 */
function sign(params: Record<string, string>, apiSecret: string): string {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
}

export class StorageError extends Error {
  constructor(
    message: string,
    public code: 'NOT_CONFIGURED' | 'REJECTED' | 'UPLOAD_FAILED' = 'UPLOAD_FAILED',
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Uploads an image and returns its delivery URL.
 *
 * `eager` asks Cloudinary to produce a capped-size variant at upload time, so
 * a 5 MB phone photo is not served to every visitor at full resolution.
 */
export async function uploadImage(
  file: Uint8Array,
  options: { folder: UploadFolder; contentType: string; filename?: string },
): Promise<UploadResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new StorageError(
      'Image upload is not configured. Add the Cloudinary keys to the environment.',
      'NOT_CONFIGURED',
    );
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = UPLOAD_FOLDERS[options.folder];

  /* Only these go into the signature — Cloudinary rejects the upload if the
     signed set and the sent set disagree. */
  const signedParams: Record<string, string> = {
    folder,
    timestamp,
    // Strip any embedded location or camera data before it is ever stored.
    eager: 'c_limit,w_1600,h_1600,q_auto,f_auto',
  };

  const signature = sign(signedParams, apiSecret);

  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(file)], { type: options.contentType }),
    options.filename ?? 'upload',
  );
  form.append('api_key', apiKey);
  for (const [key, value] of Object.entries(signedParams)) form.append(key, value);
  form.append('signature', signature);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    });
  } catch (error) {
    throw new StorageError(
      `Could not reach the image service: ${error instanceof Error ? error.message : 'network error'}`,
    );
  }

  const payload = (await response.json().catch(() => ({}))) as {
    secure_url?: string;
    public_id?: string;
    width?: number;
    height?: number;
    bytes?: number;
    format?: string;
    error?: { message?: string };
  };

  if (!response.ok || !payload.secure_url || !payload.public_id) {
    throw new StorageError(
      payload.error?.message ?? `The image service rejected the upload (${response.status}).`,
      'REJECTED',
    );
  }

  return {
    url: payload.secure_url,
    publicId: payload.public_id,
    width: payload.width ?? 0,
    height: payload.height ?? 0,
    bytes: payload.bytes ?? file.byteLength,
    format: payload.format ?? 'jpg',
  };
}

/**
 * Removes an image from the media library.
 *
 * Never throws: an orphaned file costs a fraction of a penny, whereas failing
 * the surrounding save because cleanup failed costs the operator their work.
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) return false;

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = sign({ public_id: publicId, timestamp }, apiSecret);

    const form = new FormData();
    form.append('public_id', publicId);
    form.append('timestamp', timestamp);
    form.append('api_key', apiKey);
    form.append('signature', signature);

    const response = await fetch(`${API_BASE}/${cloudName}/image/destroy`, {
      method: 'POST',
      body: form,
    });

    return response.ok;
  } catch (error) {
    console.error('[storage] failed to delete image', { publicId, error });
    return false;
  }
}

/* URL helpers live in ./image-url.ts, which carries no `server-only` guard so
   client components can build the same variants. Re-exported for convenience. */
export { cloudinaryVariant, isOptimisableHost } from './image-url';
