import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Award, GraduationCap, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/feedback';
import { LABELS } from '@/types';
import { initials } from '@/lib/utils';
import { getPublicTeam } from '@/lib/queries/public';
import { cloudinaryVariant } from '@/lib/storage/image-url';

export const metadata: Metadata = {
  title: 'Our Team',
  description:
    'Meet the nurses, doctors, physiotherapists, pharmacists and technicians who deliver ' +
    'NurseOnCall care across Port Harcourt and Rivers State.',
  alternates: { canonical: '/team' },
};

export default async function TeamPage() {
  const team = await getPublicTeam();

  /* Group by department so the page reads as an organisation, not a list. */
  const byDepartment = team.reduce<Record<string, typeof team>>((acc, member) => {
    (acc[member.department] ??= []).push(member);
    return acc;
  }, {});

  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-brand-50/60 to-background">
        <div className="container py-12 md:py-16">
          <p className="eyebrow">Our Team</p>
          <h1 className="mt-3 max-w-3xl text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            The people who will actually attend you
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground">
            Every professional listed here is employed by NurseOnCall — not contracted through a
            marketplace. You can request a specific person when you book.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {team.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Our team profiles are being updated"
              description="Please check back shortly, or call us and we'll tell you who is available."
              action={{ label: 'Contact us', href: '/contact' }}
            />
          ) : (
            <div className="space-y-14">
              {Object.entries(byDepartment).map(([department, members]) => (
                <div key={department}>
                  <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
                    {LABELS.department[department as keyof typeof LABELS.department] ?? department}
                  </h2>

                  <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {members.map((member) => (
                      <article
                        key={member.id}
                        className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card"
                      >
                        <div className="flex items-start gap-4">
                          {member.avatar ? (
                            <Image
                              src={cloudinaryVariant(
                                member.avatar,
                                'c_fill,g_face,w_160,h_160,q_auto,f_auto',
                              )}
                              alt=""
                              width={56}
                              height={56}
                              className="size-14 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-lg font-bold text-brand-700">
                              {initials(member.name)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-semibold text-navy-800">
                              {member.name}
                            </h3>
                            <p className="text-sm text-crimson-600">
                              {LABELS.staffRole[member.title as keyof typeof LABELS.staffRole]}
                            </p>
                            {member.reviewCount > 0 && (
                              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                                {member.averageRating.toFixed(1)}
                                <span className="sr-only">
                                  out of 5, from {member.reviewCount} reviews
                                </span>
                                <span aria-hidden>({member.reviewCount})</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {member.bio && (
                          <p className="mt-4 line-clamp-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                            {member.bio}
                          </p>
                        )}

                        {member.yearsOfExperience > 0 && (
                          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Award className="size-3.5" aria-hidden />
                            {member.yearsOfExperience} years&apos; experience
                          </p>
                        )}

                        {member.qualifications.length > 0 && (
                          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                            <GraduationCap className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                            <span>{member.qualifications.join(' · ')}</span>
                          </p>
                        )}

                        {member.specialisations.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {member.specialisations.slice(0, 3).map((item) => (
                              <Badge key={item} variant="outline">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {member.services.length > 0 && (
                          <div className="mt-5 border-t border-border pt-4">
                            <p className="text-xs font-medium text-navy-800">Provides</p>
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                              {member.services.slice(0, 4).map((service) => (
                                <Link
                                  key={service.slug}
                                  href={`/services/${service.slug}`}
                                  className="text-xs text-primary hover:underline"
                                >
                                  {service.name}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-14 rounded-2xl border border-border bg-secondary/50 p-8 text-center">
            <h2 className="font-display text-xl font-bold text-navy-800">
              Want a particular person?
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              During booking you can choose from the professionals qualified for that service,
              and we&apos;ll keep the assignment wherever their schedule allows.
            </p>
            <Button asChild className="mt-5">
              <Link href="/book">Book a service</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
