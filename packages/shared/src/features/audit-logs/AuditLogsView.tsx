'use client';

import { Eye } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { ResourceTable, RowActions } from '@hagamra/shared/components/tables/ResourceTable';
import { Button } from '@hagamra/shared/components/ui/Button';
import { Dialog } from '@hagamra/shared/components/ui/Dialog';
import { Input, Select } from '@hagamra/shared/components/ui/Field';
import { Badge, PageHeader, Td, Th, Tr, Value } from '@hagamra/shared/components/ui/Primitives';
import { useResource } from '@hagamra/shared/hooks/useResource';
import { useSession } from '@hagamra/shared/hooks/useSession';
import { auditLogsService, companiesService } from '@hagamra/shared/services';
import type { AuditLog, Company } from '@hagamra/shared/types';
import {
  ACTION_LABELS,
  RESOURCE_LABELS,
  SOURCE_LABELS,
  formatDateTime,
} from '@hagamra/shared/utils/format';

/**
 * The audit trail (spec §54) — read-only, by construction.
 *
 * There is no edit or delete here and no endpoint behind one: the backend
 * exposes the trail for reading only, so nothing in this panel could alter a
 * record even if someone asked it to.
 */
export function AuditLogsView() {
  const { isSuperAdmin } = useSession();

  const state = useResource<AuditLog>(
    useCallback((query, signal) => auditLogsService.getAll(query, signal), []),
  );

  const [viewing, setViewing] = useState<AuditLog | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) return;

    companiesService
      .getAll({ per_page: 100 })
      .then((result) => setCompanies(result.items))
      .catch(() => setCompanies([]));
  }, [isSuperAdmin]);

  const sourceTone = (source: AuditLog['source']) =>
    source === 'mcp_agent' ? 'info' : source === 'dashboard' ? 'primary' : 'neutral';

  const actionTone = (action: string) =>
    action === 'deleted' || action === 'login_failed'
      ? 'danger'
      : action === 'created'
        ? 'success'
        : 'neutral';

  return (
    <>
      <PageHeader
        title="سجل العمليات"
        description="سجل غير قابل للتعديل لكل عملية مهمّة في النظام"
      />

      <ResourceTable
        state={state}
        searchPlaceholder="بحث…"
        emptyTitle="لا توجد عمليات مسجّلة"
        emptyDescription="ستظهر هنا كل عملية إنشاء أو تعديل أو حذف."
        filters={
          <>
            <Select
              value={(state.filters.action as string) ?? ''}
              onChange={(event) => state.setFilter('action', event.target.value)}
              aria-label="تصفية بالعملية"
              className="h-10 w-auto min-w-36"
            >
              <option value="">كل العمليات</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>

            <Select
              value={(state.filters.resource_type as string) ?? ''}
              onChange={(event) => state.setFilter('resource_type', event.target.value)}
              aria-label="تصفية بالمورد"
              className="h-10 w-auto min-w-36"
            >
              <option value="">كل الموارد</option>
              {Object.entries(RESOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>

            <Select
              value={(state.filters.source as string) ?? ''}
              onChange={(event) => state.setFilter('source', event.target.value)}
              aria-label="تصفية بالمصدر"
              className="h-10 w-auto min-w-36"
            >
              <option value="">كل المصادر</option>
              {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>

            {isSuperAdmin && (
              <Select
                value={(state.filters.company_id as string) ?? ''}
                onChange={(event) => state.setFilter('company_id', event.target.value)}
                aria-label="تصفية بالشركة"
                className="h-10 w-auto min-w-40"
              >
                <option value="">كل الشركات</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </Select>
            )}

            <Input
              type="date"
              value={(state.filters.from as string) ?? ''}
              onChange={(event) => state.setFilter('from', event.target.value)}
              aria-label="من تاريخ"
              className="h-10 w-auto"
            />
          </>
        }
        columns={
          <>
            <Th>المستخدم</Th>
            <Th>الدور</Th>
            <Th>العملية</Th>
            <Th>المورد</Th>
            <Th>المعرّف</Th>
            <Th>المصدر</Th>
            <Th>التاريخ</Th>
            <Th className="text-end">تفاصيل</Th>
          </>
        }
        renderRow={(log) => (
          <Tr key={log.id}>
            <Td>
              <span className="font-medium text-foreground"><Value>{log.actor.name}</Value></span>
              {log.actor.email && (
                <span className="ltr mt-0.5 block text-xs text-muted">{log.actor.email}</span>
              )}
            </Td>
            <Td className="text-muted-strong"><Value>{log.actor.role}</Value></Td>
            <Td>
              <Badge tone={actionTone(log.action)}>
                {ACTION_LABELS[log.action] ?? log.action}
              </Badge>
            </Td>
            <Td>{RESOURCE_LABELS[log.resource_type] ?? log.resource_type}</Td>
            <Td className="tabular text-muted"><Value>{log.resource_id}</Value></Td>
            <Td>
              <Badge tone={sourceTone(log.source)}>
                {SOURCE_LABELS[log.source] ?? log.source}
              </Badge>
            </Td>
            <Td className="whitespace-nowrap text-muted">
              <Value>{formatDateTime(log.created_at)}</Value>
            </Td>
            <Td>
              <RowActions>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewing(log)}
                  aria-label={`تفاصيل العملية ${log.id}`}
                >
                  <Eye className="size-4" aria-hidden="true" />
                </Button>
              </RowActions>
            </Td>
          </Tr>
        )}
      />

      <Dialog
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title="تفاصيل العملية"
        description={viewing ? formatDateTime(viewing.created_at) ?? undefined : undefined}
        size="lg"
        footer={<Button variant="outline" onClick={() => setViewing(null)}>إغلاق</Button>}
      >
        {viewing && (
          <dl className="space-y-3 text-sm">
            {[
              ['المستخدم', viewing.actor.name],
              ['البريد', viewing.actor.email],
              ['الدور', viewing.actor.role],
              ['العملية', ACTION_LABELS[viewing.action] ?? viewing.action],
              ['المورد', RESOURCE_LABELS[viewing.resource_type] ?? viewing.resource_type],
              ['معرّف المورد', viewing.resource_id],
              ['المصدر', SOURCE_LABELS[viewing.source] ?? viewing.source],
              ['عنوان IP', viewing.ip_address],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex gap-3 border-b border-border-subtle pb-2">
                <dt className="w-32 shrink-0 text-muted">{label}</dt>
                <dd className="ltr text-foreground"><Value>{value}</Value></dd>
              </div>
            ))}

            {viewing.metadata && (
              <div>
                <dt className="mb-1.5 text-muted">البيانات المرفقة</dt>
                <dd>
                  {/* Secrets are stripped server-side before the row is ever
                      written, so whatever appears here is safe to show. */}
                  <pre className="ltr overflow-x-auto rounded-[var(--radius-base)] bg-surface-muted p-3 text-xs">
                    {JSON.stringify(viewing.metadata, null, 2)}
                  </pre>
                </dd>
              </div>
            )}
          </dl>
        )}
      </Dialog>
    </>
  );
}
