'use client';

import { Building2, Mail, Phone, Shield, UserCircle, User as UserIcon } from 'lucide-react';

import { Badge, Card, PageHeader, Value } from '@hagamra/shared/components/ui/Primitives';
import { useSession } from '@hagamra/shared/hooks/useSession';
import {
  PERMISSION_ACTION_LABELS,
  PERMISSION_GROUP_LABELS,
  orderPermissionGroups,
} from '@hagamra/shared/utils/format';

/**
 * The signed-in account (spec §53).
 *
 * Read-only, and deliberately so: nothing sensitive is shown and nothing is
 * editable here. Changing a password or disabling an account goes through the
 * employee and owner screens, where the backend can check who is asking.
 */
export function ProfileView() {
  const { user, permissions, isSuperAdmin } = useSession();

  const grouped = permissions.reduce<Record<string, string[]>>((groups, permission) => {
    const [group, action] = permission.split('.');

    (groups[group] ??= []).push(action);

    return groups;
  }, {});

  const rows = [
    { icon: UserIcon, label: 'الاسم', value: user.name },
    { icon: Mail, label: 'البريد الإلكتروني', value: user.email, ltr: true },
    { icon: Phone, label: 'الهاتف', value: user.phone, ltr: true },
    { icon: Shield, label: 'الدور', value: user.role_label },
    { icon: Building2, label: 'الشركة', value: user.company?.name ?? null },
  ];

  return (
    <>
      <PageHeader
        title="الملف الشخصي"
        description="بيانات حسابك وصلاحياتك"
        icon={UserCircle}
        accent="employees"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <div className="mb-5 flex flex-col items-center text-center">
            <span className="mb-3 flex size-16 items-center justify-center rounded-full bg-primary-soft text-2xl font-bold text-primary">
              {user.name.charAt(0)}
            </span>
            <h2 className="text-lg font-semibold text-foreground">{user.name}</h2>
            <Badge tone={isSuperAdmin ? 'primary' : 'neutral'} className="mt-2">
              {user.role_label}
            </Badge>
          </div>

          <dl className="space-y-3">
            {rows.map(({ icon: Icon, label, value, ltr }) => (
              <div key={label} className="flex items-start gap-3 text-sm">
                <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className={ltr ? 'ltr truncate text-foreground' : 'truncate text-foreground'}>
                    <Value>{value}</Value>
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-1 text-base font-semibold text-foreground">الصلاحيات</h2>
          <p className="mb-5 text-xs text-muted">
            {isSuperAdmin
              ? 'كمشرف عام، لديك صلاحية كاملة على النظام.'
              : user.role === 'owner'
                ? 'كمالك، لديك صلاحية كاملة داخل شركتك.'
                : 'الصلاحيات الممنوحة لك من مالك الشركة.'}
          </p>

          {permissions.length === 0 ? (
            <p className="rounded-[var(--radius-base)] bg-warning-soft px-3 py-2 text-sm text-warning">
              لا توجد صلاحيات ممنوحة لحسابك. تواصل مع مالك الشركة.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {orderPermissionGroups(grouped).map(([group, actions]) => (
                <div key={group} className="rounded-[var(--radius-base)] border border-border-subtle p-3">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    {PERMISSION_GROUP_LABELS[group] ?? group}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {actions.map((action) => (
                      <Badge key={action} tone="primary">
                        {PERMISSION_ACTION_LABELS[action] ?? action}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-5 rounded-[var(--radius-base)] bg-surface-muted px-3 py-2 text-xs text-muted">
            ما تراه هنا يحدّد ما تعرضه الواجهة فقط. كل طلب يُفحص من جديد في الخادم، فإخفاء زرّ أو
            إظهاره لا يغيّر شيئاً في ما هو مسموح فعلاً.
          </p>
        </Card>
      </div>
    </>
  );
}
