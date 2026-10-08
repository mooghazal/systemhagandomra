'use client';

import {
  Building2,
  Bus,
  Hotel,
  LayoutDashboard,
  Package,
  ScrollText,
  Settings,
  UserCog,
  Users,
} from 'lucide-react';

import type { RailItem, RailSection } from '@hagamra/shared/components/layout/Rail';
import { Shell } from '@hagamra/shared/components/layout/Shell';
import { useSession } from '@hagamra/shared/hooks/useSession';

/**
 * The admin panel's frame.
 *
 * Only the navigation and the name live here; the structure is shared, so this
 * panel and the company dashboard stay recognisably one product.
 *
 * Items are filtered by permission, so the panel never advertises a screen
 * that would only answer "forbidden". Hiding it is a courtesy — Laravel
 * refuses the request either way.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { can, isSuperAdmin } = useSession();

  const content = [
    { href: '/packages', label: 'الباقات', icon: Package, accent: 'packages' as const, show: can('packages.view') },
    { href: '/hotels', label: 'الفنادق', icon: Hotel, accent: 'hotels' as const, show: can('hotels.view') },
    { href: '/buses', label: 'الحافلات', icon: Bus, accent: 'buses' as const, show: can('buses.view') },
  ];

  const system = [
    { href: '/companies', label: 'الشركات', icon: Building2, accent: 'companies' as const, show: isSuperAdmin },
    { href: '/owners', label: 'الملاك', icon: UserCog, accent: 'owners' as const, show: isSuperAdmin },
    { href: '/employees', label: 'الموظفون', icon: Users, accent: 'employees' as const, show: can('employees.view') },
    { href: '/audit-logs', label: 'سجل العمليات', icon: ScrollText, accent: 'hotels' as const, show: isSuperAdmin },
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
      { title: 'النظام', items: visible(system) },
    ] satisfies RailSection[]
  ).filter((section) => section.items.length > 0);

  return (
    <Shell sections={sections} brandTitle="حجامرة" brandSubtitle="لوحة التحكم">
      {children}
    </Shell>
  );
}
