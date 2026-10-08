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
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@hagamra/shared/lib/cn';
import { useSession } from '@hagamra/shared/hooks/useSession';

/**
 * Navigation, filtered to what the person can actually use (spec §9).
 *
 * A link is hidden when its permission is missing — so the panel does not
 * advertise a screen that would only answer with "forbidden". Hiding it is a
 * courtesy; Laravel refuses the request either way.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Omitted means everyone signed in may see it. */
  permission?: string;
  superAdminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: '/', label: 'الرئيسية', icon: LayoutDashboard },
  { href: '/companies', label: 'الشركات', icon: Building2, superAdminOnly: true },
  { href: '/owners', label: 'الملاك', icon: UserCog, superAdminOnly: true },
  { href: '/employees', label: 'الموظفون', icon: Users, permission: 'employees.view' },
  { href: '/packages', label: 'الباقات', icon: Package, permission: 'packages.view' },
  { href: '/hotels', label: 'الفنادق', icon: Hotel, permission: 'hotels.view' },
  { href: '/buses', label: 'الحافلات', icon: Bus, permission: 'buses.view' },
  { href: '/audit-logs', label: 'سجل العمليات', icon: ScrollText, superAdminOnly: true },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, isSuperAdmin } = useSession();

  const visible = NAV.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.permission && !can(item.permission)) return false;

    return true;
  });

  return (
    <nav aria-label="القائمة الرئيسية" className="flex h-full flex-col gap-1 p-3">
      {visible.map((item) => {
        // `/admin` would otherwise light up on every child route.
        const active =
          item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

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
