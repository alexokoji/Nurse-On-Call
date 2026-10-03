import 'server-only';
import { getSettings } from './index';
import { telHref } from '@/lib/utils';

/**
 * The organisation's contact details, resolved once per request.
 *
 * Every public page that shows a phone number or an email address reads it
 * from here. They used to be written into the markup, which meant the General
 * settings screen saved values that changed nothing — the admin appeared to
 * work while the site kept showing the old details.
 *
 * `getSettings` is wrapped in React's `cache()`, so several components calling
 * this in one render share a single database read.
 */

export interface ContactDetails {
  organisationName: string;
  tagline: string;
  phone: string;
  /** Dialable form of `phone`, independent of how it was typed. */
  phoneHref: string;
  email: string;
  emailHref: string;
  address: string;
  website: string;
}

export async function getContactDetails(): Promise<ContactDetails> {
  const general = await getSettings('general');

  return {
    organisationName: general.organisationName,
    tagline: general.tagline,
    phone: general.phone,
    phoneHref: telHref(general.phone),
    email: general.supportEmail,
    emailHref: `mailto:${general.supportEmail}`,
    address: general.address,
    website: general.website,
  };
}
