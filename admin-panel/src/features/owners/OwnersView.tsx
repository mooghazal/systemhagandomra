'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { ResourceTable, RowActions } from '@hagamra/shared/components/tables/ResourceTable';
import { Button } from '@hagamra/shared/components/ui/Button';
import { ConfirmDialog, Dialog } from '@hagamra/shared/components/ui/Dialog';
import { Checkbox, Field, Input, Select } from '@hagamra/shared/components/ui/Field';
import { Badge, PageHeader, Td, Th, Tr, Value } from '@hagamra/shared/components/ui/Primitives';
import { useResource } from '@hagamra/shared/hooks/useResource';
import { useToast } from '@hagamra/shared/components/ui/Toast';
import { ApiError } from '@hagamra/shared/lib/api';
import { companiesService, ownersService } from '@hagamra/shared/services';
import type { Company, User } from '@hagamra/shared/types';
import { formatDate } from '@hagamra/shared/utils/format';

/**
 * Company owners (spec §14) — super-admin only.
 *
 * A company has exactly one owner, enforced in the schema. The form reflects
 * that: companies that already have one are not offered when creating, and the
 * backend refuses anyway if the list is stale.
 */

interface FormState {
  name: string;
  email: string;
  password: string;
  phone: string;
  is_active: boolean;
}

const BLANK: FormState = { name: '', email: '', password: '', phone: '', is_active: true };

export function OwnersView() {
  const toast = useToast();

  const state = useResource<User>(
    useCallback((query, signal) => ownersService.getAll(query, signal), []),
  );

  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<FormState>(BLANK);
  const [companyId, setCompanyId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [companies, setCompanies] = useState<Company[]>([]);

  const loadCompanies = useCallback(() => {
    companiesService
      .getAll({ per_page: 100 })
      .then((result) => setCompanies(result.items))
      .catch(() => setCompanies([]));
  }, []);

  useEffect(loadCompanies, [loadCompanies]);

  // Only companies still without an owner can receive a new one.
  const available = companies.filter((company) => (company.counts?.owners ?? 0) === 0);

  const open = (item: User | null) => {
    setErrors({});

    if (item) {
      setForm({
        name: item.name,
        email: item.email,
        password: '',
        phone: item.phone ?? '',
        is_active: item.is_active,
      });
      setCompanyId(String(item.company_id ?? ''));
      setEditing(item);
    } else {
      setForm(BLANK);
      setCompanyId('');
      setCreating(true);
    }
  };

  const close = () => {
    setEditing(null);
    setCreating(false);
    setErrors({});
  };

  async function submit() {
    setBusy(true);
    setErrors({});

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      is_active: form.is_active,
    };

    if (form.password) payload.password = form.password;

    try {
      if (editing) {
        await ownersService.update(editing.company_id as number, editing.id, payload);
        toast.success('تم تحديث بيانات المالك.');
      } else {
        if (!companyId) {
          setErrors({ company_id: 'اختر الشركة.' });
          setBusy(false);

          return;
        }

        await ownersService.create(Number(companyId), payload);
        toast.success('تمت إضافة المالك.');
      }

      close();
      state.reload();
      loadCompanies();
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        setErrors(
          Object.fromEntries(
            Object.entries(error.errors).map(([field, messages]) => [field, messages[0]]),
          ),
        );
      } else {
        toast.error(error instanceof ApiError ? error.message : 'تعذّر حفظ بيانات المالك.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;

    setBusy(true);

    try {
      await ownersService.delete(deleting.company_id as number, deleting.id);
      toast.success('تم حذف المالك.');
      setDeleting(null);
      state.reload();
      loadCompanies();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'تعذّر حذف المالك.');
    } finally {
      setBusy(false);
    }
  }

  const addButton = (
    <Button onClick={() => open(null)} disabled={available.length === 0}>
      <Plus className="size-4" aria-hidden="true" />
      إضافة مالك
    </Button>
  );

  return (
    <>
      <PageHeader
        title="الملاك"
        description="مالك واحد لكل شركة"
        action={
          available.length === 0 && companies.length > 0 ? (
            <span className="text-xs text-muted">كل الشركات لديها مالك</span>
          ) : (
            addButton
          )
        }
      />

      <ResourceTable
        state={state}
        searchPlaceholder="بحث بالاسم أو البريد…"
        emptyTitle="لا يوجد ملاك"
        emptyDescription="أضف شركة أولاً، ثم عيّن لها مالكاً."
        emptyAction={available.length > 0 ? addButton : undefined}
        filters={
          <Select
            value={(state.filters.company_id as string) ?? ''}
            onChange={(event) => state.setFilter('company_id', event.target.value)}
            aria-label="تصفية بالشركة"
            className="h-10 w-auto min-w-44"
          >
            <option value="">كل الشركات</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </Select>
        }
        columns={
          <>
            <Th>الاسم</Th>
            <Th>البريد الإلكتروني</Th>
            <Th>الشركة</Th>
            <Th>الهاتف</Th>
            <Th>الحالة</Th>
            <Th>أُضيف في</Th>
            <Th className="text-end">إجراءات</Th>
          </>
        }
        renderRow={(item) => (
          <Tr key={item.id}>
            <Td><span className="font-medium text-foreground">{item.name}</span></Td>
            <Td><span className="ltr block text-muted-strong">{item.email}</span></Td>
            <Td><Value>{item.company?.name}</Value></Td>
            <Td><span className="ltr block"><Value>{item.phone}</Value></span></Td>
            <Td>
              <Badge tone={item.is_active ? 'success' : 'neutral'}>
                {item.is_active ? 'نشط' : 'موقوف'}
              </Badge>
            </Td>
            <Td className="whitespace-nowrap text-muted"><Value>{formatDate(item.created_at)}</Value></Td>
            <Td>
              <RowActions>
                <Button variant="ghost" size="icon" onClick={() => open(item)} aria-label={`تعديل ${item.name}`}>
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleting(item)}
                  aria-label={`حذف ${item.name}`}
                  className="text-danger hover:bg-danger-soft"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </RowActions>
            </Td>
          </Tr>
        )}
      />

      <Dialog
        open={creating || editing !== null}
        onClose={close}
        title={editing ? 'تعديل المالك' : 'إضافة مالك'}
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={busy}>إلغاء</Button>
            <Button onClick={submit} loading={busy}>{editing ? 'حفظ' : 'إضافة'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {!editing && (
            <Field label="الشركة" required error={errors.company_id}>
              {({ id, invalid }) => (
                <Select id={id} value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-invalid={invalid}>
                  <option value="">اختر الشركة…</option>
                  {available.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </Select>
              )}
            </Field>
          )}

          {editing && (
            <p className="rounded-[var(--radius-base)] bg-surface-muted px-3 py-2 text-xs text-muted">
              الشركة: <span className="font-medium text-foreground">{editing.company?.name}</span> —
              لا يمكن نقل المالك إلى شركة أخرى.
            </p>
          )}

          <Field label="الاسم" required error={errors.name}>
            {({ id, invalid }) => (
              <Input
                id={id}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-invalid={invalid}
              />
            )}
          </Field>

          <Field label="البريد الإلكتروني" required error={errors.email}>
            {({ id, invalid }) => (
              <Input
                id={id}
                type="email"
                dir="ltr"
                className="text-start"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                aria-invalid={invalid}
              />
            )}
          </Field>

          <Field
            label={editing ? 'كلمة مرور جديدة' : 'كلمة المرور'}
            required={!editing}
            error={errors.password}
            hint={editing ? 'اتركه فارغاً للإبقاء على الحالية' : '١٠ أحرف على الأقل'}
          >
            {({ id, invalid }) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                aria-invalid={invalid}
              />
            )}
          </Field>

          <Field label="الهاتف" error={errors.phone}>
            {({ id }) => (
              <Input
                id={id}
                dir="ltr"
                className="text-start"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            )}
          </Field>

          <Checkbox
            label="الحساب نشط"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        itemName={deleting?.name}
        loading={busy}
        message={
          <>
            سيفقد <span className="font-semibold text-foreground">«{deleting?.name}»</span> صلاحية
            الوصول إلى شركته فوراً، وستصبح الشركة بلا مالك حتى تعيّن غيره.
          </>
        }
      />
    </>
  );
}
