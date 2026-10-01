import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CategoryManager } from './category-manager';
import { requireAdmin } from '@/lib/auth/guards';
import { getCategories } from '@/lib/queries/admin';

export const metadata: Metadata = { title: 'Service categories' };

export default async function CategoriesPage() {
  await requireAdmin('services.view');
  const categories = await getCategories();

  return (
    <div className="space-y-5">
      <Link
        href="/admin/services"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All services
      </Link>

      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
          Service categories
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Categories group services on the public site and drive the filters patients use.
        </p>
      </div>

      <CategoryManager categories={categories} />
    </div>
  );
}
