/**
 * Image URL helpers.
 *
 * Pure string work, deliberately free of `server-only` so client components
 * can build the same variants as server ones. Anything that touches the
 * Cloudinary API lives in ./cloudinary.ts.
 */

/**
 * Requests a resized, reformatted copy of a Cloudinary image.
 *
 * Cloudinary derives it on first request and caches it at the CDN edge, so a
 * card can ask for a 600px thumbnail of the same original the detail page
 * shows full width without a second upload. `q_auto,f_auto` let Cloudinary
 * pick the quality and serve WebP or AVIF to browsers that accept them.
 *
 * A URL from anywhere else is returned untouched, so an operator who pasted a
 * link instead of uploading still gets a working image.
 */
export function cloudinaryVariant(
  url: string | undefined | null,
  transformation = 'c_fill,w_800,h_600,q_auto,f_auto',
): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/${transformation}/`);
}

/** True when next/image can optimise this host, per next.config remotePatterns. */
export function isOptimisableHost(url: string): boolean {
  return url.includes('res.cloudinary.com') || url.includes('images.unsplash.com');
}
