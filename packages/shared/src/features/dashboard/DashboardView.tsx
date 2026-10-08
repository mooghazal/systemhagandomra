'use client';

import {
  ArrowLeft,
  Building2,
  Bus,
  Hotel,
  Package,
  Plus,
  ScrollText,
  UserCog,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@hagamra/shared/components/ui/Button';
import {
  type Accent,
  Avatar,
  Badge,
  Card,
  PageHeader,
  accentStyle,
} from '@hagamra/shared/components/ui/Primitives';
import { ErrorState } from '@hagamra/shared/components/ui/Feedback';
import { useSession } from '@hagamra/shared/hooks/useSession';
import { ApiError } from '@hagamra/shared/lib/api';
import { auditLogsService, statsService } from '@hagamra/shared/services';
import type { AuditLog, Stats } from '@hagamra/shared/types';
import {
  ACTION_LABELS,
  RESOURCE_LABELS,
  SOURCE_LABELS,
  formatDateTime,
  formatNumber,
} from '@hagamra/shared/utils/format';

/**
 * The landing screen: counts, recent activity, quick actions.
 *
 * Every card and button is filtered by permission. A super admin sees the
 * system; a company user sees their own company and never learns how many
 * other companies exist — the backend decides that, not this component.
 */

interface Tile {
  key: keyof Stats;
  label: string;
  icon: React.ElementType;
  href: string;
  accent: Accent;
  show: boolean;
}

export function DashboardView() {
  const { user, can, isSuperAdmin } = useSession();

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState<ApiError | null>(null);
  const [logs, setLogs] = useState<AuditLog[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    statsService
      .get(controller.signal)
      .then(setStats)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;

        setStatsError(
          error instanceof ApiError ? error : new ApiError(0, 'تعذّر تحميل الإحصائيات.'),
        );
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    // Only super admins and owners may read the trail; asking as anyone else
    // would be a guaranteed refusal and a pointless request.
    if (!isSuperAdmin && user.role !== 'owner') return;

    const controller = new AbortController();

    auditLogsService
      .getAll({ per_page: 7 }, controller.signal)
      .then((result) => setLogs(result.items))
      .catch(() => setLogs([]));

    return () => controller.abort();
  }, [isSuperAdmin, user.role]);

  const tiles: Tile[] = [
    { key: 'companies', label: 'الشركات', icon: Building2, href: '/companies', accent: 'companies', show: isSuperAdmin },
    { key: 'owners', label: 'الملاك', icon: UserCog, href: '/owners', accent: 'owners', show: isSuperAdmin },
    { key: 'employees', label: 'الموظفون', icon: Users, href: '/employees', accent: 'employees', show: can('employees.view') },
    { key: 'packages', label: 'الباقات', icon: Package, href: '/packages', accent: 'packages', show: can('packages.view') },
    { key: 'hotels', label: 'الفنادق', icon: Hotel, href: '/hotels', accent: 'hotels', show: can('hotels.view') },
    { key: 'buses', label: 'الحافلات', icon: Bus, href: '/buses', accent: 'buses', show: can('buses.view') },
  ];

  const visibleTiles = tiles.filter((tile) => tile.show);

  const quickActions = [
    { label: 'شركة', href: '/companies?new=1', accent: 'companies' as Accent, show: isSuperAdmin },
    { label: 'موظف', href: '/employees?new=1', accent: 'employees' as Accent, show: can('employees.create') },
    { label: 'باقة', href: '/packages?new=1', accent: 'packages' as Accent, show: can('packages.create') },
    { label: 'فندق', href: '/hotels?new=1', accent: 'hotels' as Accent, show: can('hotels.create') },
    { label: 'حافلة', href: '/buses?new=1', accent: 'buses' as Accent, show: can('buses.create') },
  ].filter((action) => action.show);

  const canSeeTrail = isSuperAdmin || user.role === 'owner';

  return (
    <>
      <PageHeader
        title={`أهلاً، ${user.name}`}
        description={
          user.company
            ? `${user.role_label} — ${user.company.name}`
            : 'نظرة عامة على النظام'
        }
      />

      {statsError ? (
        <Card className="mb-6">
          <ErrorState message={statsError.message} forbidden={statsError.isForbidden} />
        </Card>
      ) : visibleTiles.length > 0 ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {visibleTiles.map(({ key, label, icon: Icon, href, accent }) => {
            const count = stats?.[key];

            return (
              <Link key={key} href={href} style={accentStyle(accent)} className="group">
                <Card className="h-full p-4 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-[var(--accent)]/35 group-hover:shadow-raised">
                  <span className="mb-3 flex size-9 items-center justify-center rounded-[var(--radius-small)] bg-[var(--accent-soft)]">
                    <Icon className="size-[18px] text-[var(--accent)]" aria-hidden="true" />
                  </span>

                  <p className="text-xs font-medium text-muted">{label}</p>

                  <p className="tabular mt-1 text-[1.75rem] leading-none font-bold text-foreground">
                    {stats === null ? (
                      // Matches the digits' footprint, so nothing shifts when
                      // the real number lands.
                      <span className="inline-block h-7 w-10 animate-pulse rounded bg-surface-sunken align-middle" />
                    ) : (
                      formatNumber(count ?? 0)
                    )}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : null}

      <div className={canSeeTrail ? 'grid gap-4 lg:grid-cols-5' : ''}>
        {quickActions.length > 0 && (
          <Card className={canSeeTrail ? 'p-5 lg:col-span-2' : 'mb-4 p-5'}>
            <h2 className="mb-4 text-sm font-semibold text-foreground">إضافة سريعة</h2>

            <div className="flex flex-col gap-2">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  style={accentStyle(action.accent)}
                  className="group flex items-center gap-3 rounded-[var(--radius-small)] border border-border-subtle px-3 py-2.5 transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--accent-soft)]"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-surface">
                    <Plus className="size-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{action.label}</span>
                  <ArrowLeft className="ms-auto size-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </Card>
        )}

        {canSeeTrail && logs !== null && (
          <Card className="overflow-hidden lg:col-span-3">
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ScrollText className="size-4 text-muted" aria-hidden="true" />
                آخر العمليات
              </h2>

              <Link
                href="/audit-logs"
                className="text-xs font-medium text-primary transition-opacity hover:opacity-70"
              >
                عرض الكل
              </Link>
            </div>

            {logs.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted">
                لا توجد عمليات مسجّلة بعد.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {logs.map((log) => (
                  <li key={log.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={log.actor.name ?? '؟'} size={30} accent="employees" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">
                        <span className="font-medium">{log.actor.name ?? 'غير معروف'}</span>
                        <span className="text-muted"> {ACTION_LABELS[log.action] ?? log.action} </span>
                        <span className="text-muted-strong">
                          {RESOURCE_LABELS[log.resource_type] ?? log.resource_type}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{formatDateTime(log.created_at)}</p>
                    </div>

                    {/* Agent traffic is called out: a change made through the
                        AI assistant should be obvious at a glance. */}
                    {log.source === 'mcp_agent' && (
                      <Badge tone="info" dot>{SOURCE_LABELS[log.source]}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
