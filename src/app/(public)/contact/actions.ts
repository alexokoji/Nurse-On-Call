'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { connectDB } from '@/lib/db/connect';
import { SupportTicket, User, nextReference } from '@/models';
import { getCurrentUser } from '@/lib/auth/current-user';
import { rateLimit, RATE_LIMITS, clientIp } from '@/lib/auth/rate-limit';
import { notify } from '@/lib/notifications/service';
import { emailSchema } from '@/lib/validations/auth';
import type { ActionResult } from '@/types';

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  email: emailSchema,
  phone: z.string().trim().max(30).optional(),
  subject: z.string().trim().min(3, 'Enter a subject').max(200),
  message: z.string().trim().min(10, 'Tell us a little more').max(4000),
});

/**
 * Contact messages become support tickets so the admin team works from one
 * inbox. A message from a signed-in patient is attached to their account;
 * one from a stranger is matched by email if an account exists, and
 * otherwise creates an unattached ticket.
 */
export async function submitContactAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    subject: formData.get('subject'),
    message: formData.get('message'),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const ip = clientIp(await headers());
  if (!rateLimit(`contact:${ip}`, RATE_LIMITS.contact).success) {
    return {
      ok: false,
      message: 'You have sent several messages recently. Please try again in a few minutes.',
    };
  }

  const { name, email, phone, subject, message } = parsed.data;

  try {
    await connectDB();

    const currentUser = await getCurrentUser();
    const matched =
      currentUser ?? (await User.findOne({ email }).select('_id name').lean().then((u) =>
        u ? { id: String(u._id), name: u.name } : null,
      ));

    if (!matched) {
      // No account to attach the ticket to — notify the team by email instead
      // so the message is not silently lost.
      await notify({
        recipientEmail: 'care@nurseoncall.ng',
        recipientName: 'NurseOnCall Support',
        template: 'custom',
        channels: ['email'],
        data: {
          subject: `Website enquiry: ${subject}`,
          body: `From: ${name} <${email}>${phone ? ` · ${phone}` : ''}\n\n${message}`,
        },
      });

      return {
        ok: true,
        message: 'Thank you — your message has reached our team. We will reply by email shortly.',
      };
    }

    await SupportTicket.create({
      reference: await nextReference('ticket'),
      patient: matched.id,
      subject,
      category: 'website_enquiry',
      status: 'open',
      priority: 'normal',
      messages: [
        {
          author: matched.id,
          authorName: name,
          isStaff: false,
          body: phone ? `${message}\n\nContact number: ${phone}` : message,
          createdAt: new Date(),
        },
      ],
    });

    return {
      ok: true,
      message:
        'Thank you — your message has reached our team. You can also follow it up from your ' +
        'dashboard under Support.',
    };
  } catch (error) {
    console.error('[contact] failed to record enquiry', error);
    return {
      ok: false,
      message:
        'We could not send your message just now. Please call 0800 123 4567 and we will help ' +
        'you straight away.',
    };
  }
}
