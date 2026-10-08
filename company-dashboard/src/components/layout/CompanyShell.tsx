'use client';

import { Bus, Hotel, LayoutDashboard, Package, ScrollText, Settings, Users } from 'lucide-react';

import type { RailItem, RailSection } from '@hagamra/shared/components/layout/Rail';
import { Shell } from '@hagamra/shared/components/layout/Shell';
import { useSession } from '@hagamra/shared/hooks/useSession';

/**
 * The company dashboard's frame.
 *
 * Shorter than the admin panel's by design: there are no companies and no
 * owners here, because a company has no business managing either. The audit
 * trail is an owner's view of their own company.
 *
 * The header carries the company's name rather than the product's — that is
 * what its staff care to see.
 */
export function CompanyShell({ children }: { children: React.ReactNode }) {
  const { can, user } = useSession();

  const content = [
    { href: '/packages', label: 'الباقات', icon: Package, accent: 'packages' as const, show: can('packages.view') },
    { href: '/hotels', label: 'الفنادق', icon: Hotel, accent: 'hotels' as const, show: can('hotels.view') },
    { href: '/buses', label: 'الحافلات', icon: Bus, accent: 'buses' as const, show: can('buses.view') },
  ];

  const company = [
    { href: '/employees', label: 'الموظفون', icon: Users, accent: 'employees' as const, show: can('employees.view') },
    { href: '/audit-logs', label: 'سجل العمليات', icon: ScrollText, accent: 'hotels' as const, show: user.role === 'owner' },
    { href: '/settings', label: 'الإعدادات', icon: Settings, accent: 'employees' as const, show: true },
  ];

  const visible = (items: Array<RailItem & { show: boolean }>): RailItem[] =>
    items
      .filter((item) => item.show)
      .map(({ href, label, icon, accent }) => ({ href, label, icon, accent }));

  const sections: RailSection[] = (
    [
      {
        items: [
          { href: '/', label: 'الرئيسية', icon: LayoutDashboard, accent: 'packages' },
        ],
      },
      { title: 'المحتوى', items: visible(content) },
      { title: 'الشركة', items: visible(company) },
    ] satisfies RailSection[]
  ).filter((section) => section.items.length > 0);

  return (
    <Shell
      sections={sections}
      brandTitle={user.company?.name ?? 'لوحة الشركة'}
      brandSubtitle="حجامرة"
    >
      {children}
    </Shell>
  );
}
