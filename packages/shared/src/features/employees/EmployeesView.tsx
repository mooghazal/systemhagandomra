'use client';

import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ResourceTable, RowActions } from '@hagamra/shared/components/tables/ResourceTable';
import { Button } from '@hagamra/shared/components/ui/Button';
import { ConfirmDialog, Dialog } from '@hagamra/shared/components/ui/Dialog';
import { Checkbox, Field, Input, Select } from '@hagamra/shared/components/ui/Field';
import { Badge, Card, PageHeader, Td, Th, Tr, Value } from '@hagamra/shared/components/ui/Primitives';
import { Spinner } from '@hagamra/shared/components/ui/Feedback';
import { useResource } from '@hagamra/shared/hooks/useResource';
import { useSession } from '@hagamra/shared/hooks/useSession';
import { useToast } from '@hagamra/shared/components/ui/Toast';
import { ApiError } from '@hagamra/shared/lib/api';
import { companiesService, employeesService, permissionsService } from '@hagamra/shared/services';
import type { Company, Permission, User } from '@hagamra/shared/types';
import {
  PERMISSION_ACTION_LABELS,
  PERMISSION_GROUP_LABELS,
  formatDate,
  orderPermissionGroups,
} from '@hagamra/shared/utils/format';

/**
 * Employees and their permissions (spec §15–§17).
 *
 * Two things this screen deliberately does not do:
 *
 *   - it never offers a role field. An account created here is an employee,
 *     decided by Laravel, with no input that could say otherwise;
 *   - it never shows a password after creation, only lets one be replaced.
 *
 * Permission editing is a separate dialog because it is a separate privilege:
 * `employees.update` lets someone edit a colleague, but only an owner may
 * change what that colleague is allowed to do.
 */

interface FormState {
  name: string;
  email: string;
  password: string;
  phone: string;
  is_active: boolean;
}

const BLANK: FormState = { name: '', email: '', password: '', phone: '', is_active: true };

export function EmployeesView() {
  const { can, isSuperAdmin, user } = useSession();
  const toast = useToast();
  const params = useSearchParams();

  const state = useResource<User>(
    useCallback((query, signal) => employeesService.getAll(query, signal), []),
  );

  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<FormState>(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');

  // Permission editor
  const [catalogue, setCatalogue] = useState<Permission[] | null>(null);
  const [permissionTarget, setPermissionTarget] = useState<User | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  // Only an owner can reach the permission endpoints; a super admin passes
  // too, via Gate::before on the backend.
  const mayManagePermissions = user.role === 'owner' || isSuperAdmin;

  useEffect(() => {
    if (!isSuperAdmin) return;

    companiesService
      .getAll({ per_page: 100 })
      .then((result) => setCompanies(result.items))
      .catch(() => setCompanies([]));
  }, [isSuperAdmin]);

  useEffect(() => {
    if (params.get('new') === '1' && can('employees.create')) setCreating(true);
  }, [params, can]);

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

    // On an edit an empty password box means "leave it alone", never "clear
    // it" — so the field is simply omitted.
    if (form.password) payload.password = form.password;
    if (isSuperAdmin && !editing) payload.company_id = companyId || null;

    try {
      if (editing) {
        await employeesService.update(editing.id, payload);
        toast.success('تم تحديث بيانات الموظف.');
      } else {
        await employeesService.create(payload);
        toast.success('تمت إضافة الموظف.');
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
        toast.error(error instanceof ApiError ? error.message : 'تعذّر حفظ بيانات الموظف.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;

    setBusy(true);

    try {
      await employeesService.delete(deleting.id);
      toast.success('تم حذف الموظف.');
      setDeleting(null);
      state.reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'تعذّر حذف الموظف.');
    } finally {
      setBusy(false);
    }
  }

  async function openPermissions(employee: User) {
    setPermissionTarget(employee);
    setSelected([]);

    // The catalogue comes from the backend so a permission added in Laravel
    // appears here without a frontend change (§17).
    if (!catalogue) {
      try {
        const result = await permissionsService.getAll();
        setCatalogue(result.permissions);
      } catch {
        setCatalogue([]);
      }
    }

    try {
      const result = await employeesService.getPermissions(employee.id);
      setSelected(result.permissions);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'تعذّر تحميل الصلاحيات.');
    }
  }

  async function savePermissions() {
    if (!permissionTarget) return;

    setBusy(true);

    try {
      await employeesService.setPermissions(permissionTarget.id, selected);
      toast.success('تم تحديث الصلاحيات.');
      setPermissionTarget(null);
      state.reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'تعذّر حفظ الصلاحيات.');
    } finally {
      setBusy(false);
    }
  }

  const grouped = (catalogue ?? []).reduce<Record<string, Permission[]>>((groups, permission) => {
    (groups[permission.group] ??= []).push(permission);

    return groups;
  }, {});

  const orderedGroups = orderPermissionGroups(grouped);

  const addButton = can('employees.create') ? (
    <Button onClick={() => open(null)}>
      <Plus className="size-4" aria-hidden="true" />
      إضافة موظف
    </Button>
  ) : null;

  return (
    <>
      <PageHeader title="الموظفون" description="حسابات الموظفين وصلاحياتهم" action={addButton} />

      <ResourceTable
        state={state}
        searchPlaceholder="بحث بالاسم أو البريد…"
        emptyTitle="لا يوجد موظفون"
        emptyDescription="ابدأ بإضافة أول موظف."
        emptyAction={addButton}
        filters={
          isSuperAdmin ? (
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
          ) : undefined
        }
        columns={
          <>
            <Th>الاسم</Th>
            <Th>البريد الإلكتروني</Th>
            <Th>الهاتف</Th>
            {isSuperAdmin && <Th>الشركة</Th>}
            <Th>الصلاحيات</Th>
            <Th>الحالة</Th>
            <Th>أُضيف في</Th>
            <Th className="text-end">إجراءات</Th>
          </>
        }
        renderRow={(item) => (
          <Tr key={item.id}>
            <Td><span className="font-medium text-foreground">{item.name}</span></Td>
            <Td><span className="ltr block text-muted-strong">{item.email}</span></Td>
            <Td><span className="ltr block"><Value>{item.phone}</Value></span></Td>
            {isSuperAdmin && <Td><Value>{item.company?.name}</Value></Td>}
            <Td>
              {item.permissions && item.permissions.length > 0 ? (
                <Badge tone="primary">{item.permissions.length} صلاحية</Badge>
              ) : (
                <Badge tone="neutral">بلا صلاحيات</Badge>
              )}
            </Td>
            <Td>
              <Badge tone={item.is_active ? 'success' : 'neutral'}>
                {item.is_active ? 'نشط' : 'موقوف'}
              </Badge>
            </Td>
            <Td className="whitespace-nowrap text-muted"><Value>{formatDate(item.created_at)}</Value></Td>
            <Td>
              <RowActions>
                {mayManagePermissions && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openPermissions(item)}
                    aria-label={`صلاحيات ${item.name}`}
                    title="إدارة الصلاحيات"
                  >
                    <KeyRound className="size-4" aria-hidden="true" />
                  </Button>
                )}
                {can('employees.update') && (
                  <Button variant="ghost" size="icon" onClick={() => open(item)} aria-label={`تعديل ${item.name}`}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                )}
                {can('employees.delete') && item.id !== user.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleting(item)}
                    aria-label={`حذف ${item.name}`}
                    className="text-danger hover:bg-danger-soft"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </RowActions>
            </Td>
          </Tr>
        )}
      />

      <Dialog
        open={creating || editing !== null}
        onClose={close}
        title={editing ? 'تعديل الموظف' : 'إضافة موظف'}
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={busy}>إلغاء</Button>
            <Button onClick={submit} loading={busy}>{editing ? 'حفظ' : 'إضافة'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {isSuperAdmin && !editing && (
            <Field label="الشركة" required error={errors.company_id}>
              {({ id, invalid }) => (
                <Select id={id} value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-invalid={invalid}>
                  <option value="">اختر الشركة…</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </Select>
              )}
            </Field>
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
            hint={
              editing
                ? 'اتركه فارغاً للإبقاء على كلمة المرور الحالية'
                : '١٠ أحرف على الأقل، تتضمّن حروفاً وأرقاماً'
            }
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

          {!editing && mayManagePermissions && (
            <p className="rounded-[var(--radius-base)] bg-info-soft px-3 py-2 text-xs text-info">
              سيُنشأ الحساب بلا صلاحيات. حدّدها بعد الإضافة من زرّ المفتاح.
            </p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={permissionTarget !== null}
        onClose={() => setPermissionTarget(null)}
        title="إدارة الصلاحيات"
        description={permissionTarget?.name}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setPermissionTarget(null)} disabled={busy}>
              إلغاء
            </Button>
            <Button onClick={savePermissions} loading={busy}>حفظ الصلاحيات</Button>
          </>
        }
      >
        {catalogue === null ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <div className="space-y-4">
            {orderedGroups.map(([group, permissions]) => {
              const names = permissions.map((permission) => permission.name);
              const allOn = names.every((name) => selected.includes(name));

              return (
                <Card key={group} className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      {PERMISSION_GROUP_LABELS[group] ?? group}
                    </h3>

                    <button
                      type="button"
                      onClick={() =>
                        setSelected((current) =>
                          allOn
                            ? current.filter((name) => !names.includes(name))
                            : [...new Set([...current, ...names])],
                        )
                      }
                      className="text-xs text-primary hover:underline"
                    >
                      {allOn ? 'إلغاء الكل' : 'تحديد الكل'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {permissions.map((permission) => {
                      const action = permission.name.split('.')[1] ?? permission.name;

                      return (
                        <Checkbox
                          key={permission.name}
                          label={PERMISSION_ACTION_LABELS[action] ?? permission.label}
                          checked={selected.includes(permission.name)}
                          onChange={(event) =>
                            setSelected((current) =>
                              event.target.checked
                                ? [...current, permission.name]
                                : current.filter((name) => name !== permission.name),
                            )
                          }
                        />
                      );
                    })}
                  </div>
                </Card>
              );
            })}

            <p className="text-xs text-muted" aria-live="polite">
              {selected.length === 0
                ? 'لم تُحدَّد أي صلاحية — لن يتمكّن الموظف من شيء.'
                : `${selected.length} صلاحية مختارة`}
            </p>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        itemName={deleting?.name}
        loading={busy}
      />
    </>
  );
}
