'use client';

import { Bus, Hotel, LayoutDashboard, Package, ScrollText, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@hagamra/shared/lib/cn';
import { useSession } from '@hagamra/shared/hooks/useSession';

/**
 * Navigation for a company's own staff.
 *
 * Shorter than the admin panel's by design: there are no companies and no
 * owners here, because a company has no business managing either. The audit
 * trail is an owner's view of their own company.
 *
 * Items are filtered by permission, which hides a screen that would only
 * answer "forbidden". Hiding it is a courtesy; Laravel refuses the request
 * either way.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  ownerOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: '/', label: 'الرئيسية', icon: LayoutDashboard },
  { href: '/packages', label: 'الباقات', icon: Package, permission: 'packages.view' },
  { href: '/hotels', label: 'الفنادق', icon: Hotel, permission: 'hotels.view' },
  { href: '/buses', label: 'الحافلات', icon: Bus, permission: 'buses.view' },
  { href: '/employees', label: 'الموظفون', icon: Users, permission: 'employees.view' },
  { href: '/audit-logs', label: 'سجل العمليات', icon: ScrollText, ownerOnly: true },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, user } = useSession();

  const visible = NAV.filter((item) => {
    if (item.ownerOnly && user.role !== 'owner') return false;
    if (item.permission && !can(item.permission)) return false;

    return true;
  });

  return (
    <nav aria-label="القائمة الرئيسية" className="flex h-full flex-col gap-1 p-3">
      {visible.map((item) => {
        // `/` would otherwise light up on every route.
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-[var(--radius-base)] px-3 py-2.5 text-sm transition-colors',
              active
                ? 'bg-primary-soft font-semibold text-primary'
                : 'text-muted-strong hover:bg-surface-muted hover:text-foreground',
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
