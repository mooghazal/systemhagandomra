'use client';

import { KeyRound, ScrollText, Users } from 'lucide-react';
import Link from 'next/link';

import { Card, PageHeader } from '@hagamra/shared/components/ui/Primitives';
import { useSession } from '@hagamra/shared/hooks/useSession';

/**
 * Settings (spec §55).
 *
 * Intentionally sparse. The spec asks for a structure ready for future
 * requirements, not for settings invented now because the page looked empty —
 * so this links to where the system's real configuration already lives and
 * stops there.
 */
export function SettingsView() {
  const { isSuperAdmin, user, can } = useSession();

  const links = [
    {
      href: '/employees',
      icon: Users,
      title: 'الموظفون والصلاحيات',
      description: 'إضافة الموظفين وتحديد ما يُسمح لكل منهم بالوصول إليه.',
      show: can('employees.view'),
    },
    {
      href: '/audit-logs',
      icon: ScrollText,
      title: 'سجل العمليات',
      description: 'مراجعة كل عملية جرت في النظام ومن نفّذها ومن أي مصدر.',
      show: isSuperAdmin || user.role === 'owner',
    },
    {
      href: '/profile',
      icon: KeyRound,
      title: 'الملف الشخصي',
      description: 'بيانات حسابك والصلاحيات الممنوحة لك.',
      show: true,
    },
  ].filter((link) => link.show);

  return (
    <>
      <PageHeader title="الإعدادات" description="إدارة النظام" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href}>
            <Card className="h-full p-5 transition-colors hover:border-primary/40 hover:bg-surface-muted/50">
              <Icon className="mb-3 size-5 text-primary" aria-hidden="true" />
              <h2 className="mb-1 text-sm font-semibold text-foreground">{title}</h2>
              <p className="text-xs leading-relaxed text-muted">{description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
