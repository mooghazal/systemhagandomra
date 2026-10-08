'use client';

import {
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
import { Badge, Card, PageHeader, Value } from '@hagamra/shared/components/ui/Primitives';
import { ErrorState, Spinner } from '@hagamra/shared/components/ui/Feedback';
import { useSession } from '@hagamra/shared/hooks/useSession';
import { ApiError } from '@hagamra/shared/lib/api';
import { auditLogsService, statsService } from '@hagamra/shared/services';
import type { AuditLog, Stats } from '@hagamra/shared/types';
import { ACTION_LABELS, RESOURCE_LABELS, SOURCE_LABELS, formatDateTime } from '@hagamra/shared/utils/format';

/**
 * The landing screen (spec §10): counts, recent activity, quick actions.
 *
 * Every card and button here is filtered by permission. A super admin sees the
 * system; a company user sees their own company and never learns how many
 * other companies exist — the backend decides that, not this component.
 */
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
    // would be a guaranteed 403 and a pointless request.
    if (!isSuperAdmin && user.role !== 'owner') return;

    const controller = new AbortController();

    auditLogsService
      .getAll({ per_page: 8 }, controller.signal)
      .then((result) => setLogs(result.items))
      .catch(() => setLogs([]));

    return () => controller.abort();
  }, [isSuperAdmin, user.role]);

  const cards = [
    { key: 'companies', label: 'الشركات', icon: Building2, href: '/companies', show: isSuperAdmin },
    { key: 'owners', label: 'الملاك', icon: UserCog, href: '/owners', show: isSuperAdmin },
    { key: 'employees', label: 'الموظفون', icon: Users, href: '/employees', show: can('employees.view') },
    { key: 'packages', label: 'الباقات', icon: Package, href: '/packages', show: can('packages.view') },
    { key: 'hotels', label: 'الفنادق', icon: Hotel, href: '/hotels', show: can('hotels.view') },
    { key: 'buses', label: 'الحافلات', icon: Bus, href: '/buses', show: can('buses.view') },
  ].filter((card) => card.show);

  const quickActions = [
    { label: 'إضافة شركة', href: '/companies?new=1', show: isSuperAdmin },
    { label: 'إضافة موظف', href: '/employees?new=1', show: can('employees.create') },
    { label: 'إضافة باقة', href: '/packages?new=1', show: can('packages.create') },
    { label: 'إضافة فندق', href: '/hotels?new=1', show: can('hotels.create') },
    { label: 'إضافة حافلة', href: '/buses?new=1', show: can('buses.create') },
  ].filter((action) => action.show);

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
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map(({ key, label, icon: Icon, href }) => {
            const count = stats?.[key as keyof Stats];

            return (
              <Link key={key} href={href}>
                <Card className="h-full p-4 transition-colors hover:border-primary/40 hover:bg-surface-muted/50">
                  <Icon className="mb-2 size-5 text-primary" aria-hidden="true" />
                  <p className="text-xs text-muted">{label}</p>
                  <p className="tabular mt-0.5 text-2xl font-bold text-foreground">
                    {stats === null ? <Spinner className="size-5" /> : (count ?? 0)}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {quickActions.length > 0 && (
        <Card className="mb-6 p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">إجراءات سريعة</h2>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <Button variant="secondary" size="sm">
                  <Plus className="size-4" aria-hidden="true" />
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {logs !== null && (
        <Card>
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ScrollText className="size-4 text-muted" aria-hidden="true" />
              آخر العمليات
            </h2>

            {isSuperAdmin && (
              <Link href="/admin/audit-logs" className="text-xs text-primary hover:underline">
                عرض الكل
              </Link>
            )}
          </div>

          {logs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">لا توجد عمليات مسجّلة بعد.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {logs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-sm">
                  <span className="font-medium text-foreground">
                    <Value>{log.actor.name}</Value>
                  </span>
                  <span className="text-muted">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                  <Badge tone="neutral">
                    {RESOURCE_LABELS[log.resource_type] ?? log.resource_type}
                  </Badge>

                  {/* Agent traffic is called out: a change made through the AI
                      assistant should be obvious at a glance. */}
                  {log.source === 'mcp_agent' && (
                    <Badge tone="info">{SOURCE_LABELS[log.source]}</Badge>
                  )}

                  <span className="ms-auto text-xs text-muted">
                    {formatDateTime(log.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
