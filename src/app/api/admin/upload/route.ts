import type { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { apiRequireUser } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import {
  uploadImage,
  sniffImageType,
  isStorageConfigured,
  StorageError,
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  UPLOAD_FOLDERS,
  type UploadFolder,
} from '@/lib/storage/cloudinary';
import { rateLimit, clientIp } from '@/lib/auth/rate-limit';
import { recordAudit } from '@/lib/audit';
import { apiSuccess, apiError, handleApiError } from '@/lib/api';
import type { Permission } from '@/lib/permissions/catalogue';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/admin/upload
 *
 * Accepts one image and returns its hosted URL for a form to store.
 *
 * Four things are checked before a byte leaves this server, in order of how
 * cheaply they fail: the caller is signed in, their role covers the thing the
 * image belongs to, the file is within the size limit, and — last, because it
 * requires reading the file — the bytes really are an image.
 */

/** Which permission each upload target requires. */
const FOLDER_PERMISSION: Record<UploadFolder, Permission> = {
  service: 'services.edit',
  staff: 'staff.manage',
  article: 'content.manage',
  branding: 'settings.manage',
};

export async function POST(request: NextRequest) {
  try {
    const user = await apiRequireUser();

    /* Uploads are expensive and a signed-in insider could still abuse them. */
    const ip = clientIp(await headers());
    const limit = rateLimit(`upload:${user.id}:${ip}`, { limit: 30, windowSeconds: 600 });
    if (!limit.success) {
      return apiError('Too many uploads. Please wait a moment and try again.', 429, {
        code: 'RATE_LIMITED',
      });
    }

    const form = await request.formData().catch(() => null);
    if (!form) return apiError('That upload could not be read.', 400);

    const folder = String(form.get('folder') ?? '') as UploadFolder;
    if (!(folder in UPLOAD_FOLDERS)) {
      return apiError('Unknown upload target.', 400, { code: 'BAD_FOLDER' });
    }

    const permission = FOLDER_PERMISSION[folder];
    if (!userCan(user, permission)) {
      return apiError('You do not have permission to upload this kind of image.', 403, {
        code: 'FORBIDDEN',
      });
    }

    const file = form.get('file');
    if (!(file instanceof File)) return apiError('No file was received.', 400);

    if (file.size === 0) return apiError('That file is empty.', 400);
    if (file.size > MAX_UPLOAD_BYTES) {
      return apiError(
        `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
        413,
        { code: 'TOO_LARGE' },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    /* The declared Content-Type is attacker-controlled, so the real check is
       the file signature. A renamed script never reaches the media library. */
    const actualType = sniffImageType(bytes);
    if (!actualType || !ACCEPTED_IMAGE_TYPES.includes(actualType as never)) {
      return apiError('That file is not a JPEG, PNG or WebP image.', 415, {
        code: 'BAD_TYPE',
      });
    }

    /* Checked last, deliberately. An unauthorised caller gets 403 whether or
       not storage is configured, so this never reveals how the deployment is
       set up — and a 503 always means "the request was fine, we are not". */
    if (!isStorageConfigured()) {
      return apiError(
        'Image upload is not configured yet. Paste an image URL instead, or ask an administrator to add the Cloudinary keys.',
        503,
        { code: 'NOT_CONFIGURED' },
      );
    }

    const result = await uploadImage(bytes, {
      folder,
      contentType: actualType,
      filename: file.name,
    });

    await recordAudit({
      actor: user,
      action: 'media.upload',
      entity: 'Media',
      entityId: result.publicId,
      summary: `Uploaded a ${folder} image (${Math.round(result.bytes / 1024)} KB)`,
      after: { folder, width: result.width, height: result.height, format: result.format },
    });

    return apiSuccess({
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    if (error instanceof StorageError) {
      return apiError(error.message, error.code === 'NOT_CONFIGURED' ? 503 : 502, {
        code: error.code,
      });
    }
    return handleApiError(error, 'admin.upload');
  }
}
