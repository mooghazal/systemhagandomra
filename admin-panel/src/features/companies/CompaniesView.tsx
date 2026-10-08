'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ResourceTable, RowActions } from '@hagamra/shared/components/tables/ResourceTable';
import { Button } from '@hagamra/shared/components/ui/Button';
import { ConfirmDialog, Dialog } from '@hagamra/shared/components/ui/Dialog';
import { Checkbox, Field, Input, Select, Textarea } from '@hagamra/shared/components/ui/Field';
import { Badge, PageHeader, Td, Th, Thumb, Tr, Value } from '@hagamra/shared/components/ui/Primitives';
import { ImageUploader, type ImageSelection } from '@hagamra/shared/components/upload/ImageUploader';
import { useResource } from '@hagamra/shared/hooks/useResource';
import { useToast } from '@hagamra/shared/components/ui/Toast';
import { ApiError } from '@hagamra/shared/lib/api';
import { companiesService } from '@hagamra/shared/services';
import type { Company } from '@hagamra/shared/types';
import { toFormData } from '@hagamra/shared/utils/format';

/**
 * Companies (spec §11–§13) — super-admin only.
 *
 * Creating a company can mint its first owner in the same request, which is
 * the only path in the whole system that assigns the owner role. Laravel does
 * both in one transaction, so a rejected owner leaves no half-made company
 * behind.
 */

interface FormState {
  name: string;
  domain: string;
  email: string;
  phone: string;
  address: string;
  is_active: boolean;
  withOwner: boolean;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPhone: string;
}

const BLANK: FormState = {
  name: '',
  domain: '',
  email: '',
  phone: '',
  address: '',
  is_active: true,
  withOwner: false,
  ownerName: '',
  ownerEmail: '',
  ownerPassword: '',
  ownerPhone: '',
};

export function CompaniesView() {
  const toast = useToast();
  const params = useSearchParams();

  const state = useResource<Company>(
    useCallback((query, signal) => companiesService.getAll(query, signal), []),
  );

  const [editing, setEditing] = useState<Company | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Company | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<FormState>(BLANK);
  const [logo, setLogo] = useState<ImageSelection>({ file: null, removed: false });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (params.get('new') === '1') setCreating(true);
  }, [params]);

  const open = (item: Company | null) => {
    setErrors({});
    setLogo({ file: null, removed: false });

    if (item) {
      setForm({
        ...BLANK,
        name: item.name,
        domain: item.domain ?? '',
        email: item.email ?? '',
        phone: item.phone ?? '',
        address: item.address ?? '',
        is_active: item.is_active,
      });
      setEditing(item);
    } else {
      setForm(BLANK);
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

    const blank = (value: string) => (value.trim() === '' ? null : value.trim());

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      domain: blank(form.domain),
      email: blank(form.email),
      phone: blank(form.phone),
      address: blank(form.address),
      is_active: form.is_active,
    };

    if (logo.file) payload.logo = logo.file;
    if (logo.removed) payload.remove_logo = true;

    // The owner block is nested, so it is flattened into the multipart body
    // under the names Laravel's `owner.*` rules expect.
    if (!editing && form.withOwner) {
      payload['owner[name]'] = form.ownerName.trim();
      payload['owner[email]'] = form.ownerEmail.trim();
      payload['owner[password]'] = form.ownerPassword;

      if (form.ownerPhone.trim()) payload['owner[phone]'] = form.ownerPhone.trim();
    }

    try {
      if (editing) {
        await companiesService.update(editing.id, toFormData(payload));
        toast.success('تم تحديث الشركة.');
      } else {
        await companiesService.create(toFormData(payload));
        toast.success('تمت إضافة الشركة.');
      }

      close();
      state.reload();
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        setErrors(
          Object.fromEntries(
            Object.entries(error.errors).map(([field, messages]) => [field, messages[0]]),
          ),
        );
      } else {
        toast.error(error instanceof ApiError ? error.message : 'تعذّر حفظ الشركة.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;

    setBusy(true);

    try {
      await companiesService.delete(deleting.id);
      toast.success('تم حذف الشركة.');
      setDeleting(null);
      state.reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'تعذّر حذف الشركة.');
    } finally {
      setBusy(false);
    }
  }

  const addButton = (
    <Button onClick={() => open(null)}>
      <Plus className="size-4" aria-hidden="true" />
      إضافة شركة
    </Button>
  );

  const counts = deleting?.counts;

  return (
    <>
      <PageHeader title="الشركات" description="شركات الحج والعمرة المسجّلة" action={addButton} />

      <ResourceTable
        state={state}
        searchPlaceholder="بحث بالاسم أو البريد…"
        emptyTitle="لا توجد شركات"
        emptyDescription="ابدأ بإضافة أول شركة."
        emptyAction={addButton}
        filters={
          <Select
            value={(state.filters.is_active as string) ?? ''}
            onChange={(event) => state.setFilter('is_active', event.target.value)}
            aria-label="تصفية بالحالة"
            className="h-10 w-auto min-w-36"
          >
            <option value="">كل الحالات</option>
            <option value="1">نشطة</option>
            <option value="0">متوقفة</option>
          </Select>
        }
        columns={
          <>
            <Th className="w-16">الشعار</Th>
            <Th>الاسم</Th>
            <Th>النطاق</Th>
            <Th>البريد</Th>
            <Th>الهاتف</Th>
            <Th>المحتوى</Th>
            <Th>الحالة</Th>
            <Th className="text-end">إجراءات</Th>
          </>
        }
        renderRow={(item) => (
          <Tr key={item.id}>
            <Td><Thumb src={item.logo_url} alt={item.name} /></Td>
            <Td>
              <span className="font-medium text-foreground">{item.name}</span>
              <span className="ltr mt-0.5 block text-xs text-muted">{item.slug}</span>
            </Td>
            <Td><span className="ltr block"><Value>{item.domain}</Value></span></Td>
            <Td><span className="ltr block"><Value>{item.email}</Value></span></Td>
            <Td><span className="ltr block"><Value>{item.phone}</Value></span></Td>
            <Td>
              {item.counts ? (
                <span className="flex flex-wrap gap-1">
                  <Badge tone="neutral">{item.counts.employees} موظف</Badge>
                  <Badge tone="neutral">{item.counts.packages} باقة</Badge>
                  <Badge tone="neutral">{item.counts.hotels} فندق</Badge>
                  <Badge tone="neutral">{item.counts.buses} حافلة</Badge>
                </span>
              ) : (
                <Value>{null}</Value>
              )}
            </Td>
            <Td>
              <Badge tone={item.is_active ? 'success' : 'neutral'}>
                {item.is_active ? 'نشطة' : 'متوقفة'}
              </Badge>
            </Td>
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
        title={editing ? 'تعديل الشركة' : 'إضافة شركة'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={busy}>إلغاء</Button>
            <Button onClick={submit} loading={busy}>{editing ? 'حفظ' : 'إضافة'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="اسم الشركة" required error={errors.name}>
            {({ id, invalid }) => (
              <Input
                id={id}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-invalid={invalid}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="النطاق" error={errors.domain}>
              {({ id }) => (
                <Input
                  id={id}
                  dir="ltr"
                  className="text-start"
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="example.com"
                />
              )}
            </Field>

            <Field label="البريد الإلكتروني" error={errors.email}>
              {({ id }) => (
                <Input
                  id={id}
                  type="email"
                  dir="ltr"
                  className="text-start"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                  placeholder="+9665XXXXXXXX"
                />
              )}
            </Field>
          </div>

          <Field label="العنوان" error={errors.address}>
            {({ id }) => (
              <Textarea
                id={id}
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            )}
          </Field>

          <ImageUploader
            label="شعار الشركة"
            currentUrl={editing?.logo_url}
            onChange={setLogo}
            error={errors.logo}
          />

          <Checkbox
            label="الشركة نشطة"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />

          {!editing && (
            <div className="rounded-[var(--radius-base)] border border-border-subtle bg-surface-muted p-4">
              <Checkbox
                label="إنشاء حساب المالك الآن"
                checked={form.withOwner}
                onChange={(e) => setForm({ ...form, withOwner: e.target.checked })}
              />

              {form.withOwner && (
                <div className="mt-4 space-y-4">
                  <p className="text-xs text-muted">
                    لكل شركة مالك واحد. يمكنك إنشاؤه لاحقاً من صفحة الملاك.
                  </p>

                  <Field label="اسم المالك" required error={errors['owner.name']}>
                    {({ id, invalid }) => (
                      <Input
                        id={id}
                        value={form.ownerName}
                        onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                        aria-invalid={invalid}
                      />
                    )}
                  </Field>

                  <Field label="بريد المالك" required error={errors['owner.email']}>
                    {({ id, invalid }) => (
                      <Input
                        id={id}
                        type="email"
                        dir="ltr"
                        className="text-start"
                        value={form.ownerEmail}
                        onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                        aria-invalid={invalid}
                      />
                    )}
                  </Field>

                  <Field
                    label="كلمة المرور"
                    required
                    error={errors['owner.password']}
                    hint="١٠ أحرف على الأقل، تتضمّن حروفاً وأرقاماً"
                  >
                    {({ id, invalid }) => (
                      <Input
                        id={id}
                        type="password"
                        autoComplete="new-password"
                        value={form.ownerPassword}
                        onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
                        aria-invalid={invalid}
                      />
                    )}
                  </Field>

                  <Field label="هاتف المالك" error={errors['owner.phone']}>
                    {({ id }) => (
                      <Input
                        id={id}
                        dir="ltr"
                        className="text-start"
                        value={form.ownerPhone}
                        onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })}
                      />
                    )}
                  </Field>
                </div>
              )}
            </div>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        itemName={deleting?.name}
        loading={busy}
        message={
          counts && (counts.employees || counts.packages || counts.hotels || counts.buses) ? (
            <>
              سيتم حذف <span className="font-semibold text-foreground">«{deleting?.name}»</span> مع كل
              ما تملكه:{' '}
              <span className="font-semibold text-danger">
                {counts.owners} مالك، {counts.employees} موظف، {counts.packages} باقة،{' '}
                {counts.hotels} فندق، {counts.buses} حافلة
              </span>
              . يمكن استرجاعها لاحقاً من قاعدة البيانات، لكنها ستختفي من النظام فوراً.
            </>
          ) : undefined
        }
      />
    </>
  );
}
