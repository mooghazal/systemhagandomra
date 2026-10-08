'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { BUS_FEATURES, FeatureSelector } from '@hagamra/shared/components/forms/FeatureSelector';
import { ResourceTable, RowActions } from '@hagamra/shared/components/tables/ResourceTable';
import { Button } from '@hagamra/shared/components/ui/Button';
import { ConfirmDialog, Dialog } from '@hagamra/shared/components/ui/Dialog';
import { Checkbox, Field, Input, NumberInput, Select, Textarea } from '@hagamra/shared/components/ui/Field';
import { Badge, PageHeader, Td, Th, Thumb, Tr, Value } from '@hagamra/shared/components/ui/Primitives';
import { ImageUploader, type ImageSelection } from '@hagamra/shared/components/upload/ImageUploader';
import { useResource } from '@hagamra/shared/hooks/useResource';
import { useSession } from '@hagamra/shared/hooks/useSession';
import { useToast } from '@hagamra/shared/components/ui/Toast';
import { ApiError } from '@hagamra/shared/lib/api';
import { busesService, companiesService } from '@hagamra/shared/services';
import type { Bus, Company } from '@hagamra/shared/types';
import { formatNumber, toFormData } from '@hagamra/shared/utils/format';

/** Buses (spec §28–§30). Only the name is required; the rest is optional. */

interface FormState {
  name: string;
  type: string;
  capacity: number | null;
  model: string;
  description: string;
  features: string[];
  is_active: boolean;
}

const BLANK: FormState = {
  name: '',
  type: '',
  capacity: null,
  model: '',
  description: '',
  features: [],
  is_active: true,
};

const BUS_TYPES = ['VIP', 'سياحية', 'عادية', 'نوم'];

export function BusesView() {
  const { can, isSuperAdmin } = useSession();
  const toast = useToast();
  const params = useSearchParams();

  const state = useResource<Bus>(
    useCallback((query, signal) => busesService.getAll(query, signal), []),
  );

  const [editing, setEditing] = useState<Bus | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Bus | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<FormState>(BLANK);
  const [image, setImage] = useState<ImageSelection>({ file: null, removed: false });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');

  useEffect(() => {
    if (!isSuperAdmin) return;

    companiesService
      .getAll({ per_page: 100 })
      .then((result) => setCompanies(result.items))
      .catch(() => setCompanies([]));
  }, [isSuperAdmin]);

  useEffect(() => {
    if (params.get('new') === '1' && can('buses.create')) setCreating(true);
  }, [params, can]);

  const open = (item: Bus | null) => {
    setErrors({});
    setImage({ file: null, removed: false });

    if (item) {
      setForm({
        name: item.name,
        type: item.type ?? '',
        capacity: item.capacity,
        model: item.model ?? '',
        description: item.description ?? '',
        features: item.features,
        is_active: item.is_active,
      });
      setCompanyId(String(item.company_id));
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

    const blank = (value: string) => (value.trim() === '' ? null : value.trim());

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      type: blank(form.type),
      capacity: form.capacity,
      model: blank(form.model),
      description: blank(form.description),
      features: form.features,
      is_active: form.is_active,
    };

    if (isSuperAdmin && !editing) payload.company_id = companyId || null;
    if (image.file) payload.image = image.file;
    if (image.removed) payload.remove_image = true;

    try {
      if (editing) {
        await busesService.update(editing.id, toFormData(payload));
        toast.success('تم تحديث الحافلة.');
      } else {
        await busesService.create(toFormData(payload));
        toast.success('تمت إضافة الحافلة.');
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
        toast.error(error instanceof ApiError ? error.message : 'تعذّر حفظ الحافلة.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;

    setBusy(true);

    try {
      await busesService.delete(deleting.id);
      toast.success('تم حذف الحافلة.');
      setDeleting(null);
      state.reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'تعذّر حذف الحافلة.');
    } finally {
      setBusy(false);
    }
  }

  const addButton = can('buses.create') ? (
    <Button onClick={() => open(null)}>
      <Plus className="size-4" aria-hidden="true" />
      إضافة حافلة
    </Button>
  ) : null;

  return (
    <>
      <PageHeader title="الحافلات" description="أسطول النقل" action={addButton} />

      <ResourceTable
        state={state}
        searchPlaceholder="بحث باسم الحافلة…"
        emptyTitle="لا توجد حافلات"
        emptyDescription="ابدأ بإضافة أول حافلة."
        emptyAction={addButton}
        filters={
          <Select
            value={(state.filters.type as string) ?? ''}
            onChange={(event) => state.setFilter('type', event.target.value)}
            aria-label="تصفية بالنوع"
            className="h-10 w-auto min-w-40"
          >
            <option value="">كل الأنواع</option>
            {BUS_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </Select>
        }
        columns={
          <>
            <Th className="w-16">الصورة</Th>
            <Th>الاسم</Th>
            <Th>النوع</Th>
            <Th>السعة</Th>
            <Th>الموديل</Th>
            {isSuperAdmin && <Th>الشركة</Th>}
            <Th>الحالة</Th>
            <Th className="text-end">إجراءات</Th>
          </>
        }
        renderRow={(item) => (
          <Tr key={item.id}>
            <Td><Thumb src={item.image_url} alt={item.name} /></Td>
            <Td><span className="font-medium text-foreground">{item.name}</span></Td>
            <Td><Value>{item.type}</Value></Td>
            <Td className="tabular">
              <Value>{item.capacity ? `${formatNumber(item.capacity)} مقعد` : null}</Value>
            </Td>
            <Td><Value>{item.model}</Value></Td>
            {isSuperAdmin && <Td><Value>{item.company?.name}</Value></Td>}
            <Td>
              <Badge tone={item.is_active ? 'success' : 'neutral'}>
                {item.is_active ? 'نشطة' : 'متوقفة'}
              </Badge>
            </Td>
            <Td>
              <RowActions>
                {can('buses.update') && (
                  <Button variant="ghost" size="icon" onClick={() => open(item)} aria-label={`تعديل ${item.name}`}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                )}
                {can('buses.delete') && (
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
        title={editing ? 'تعديل الحافلة' : 'إضافة حافلة'}
        description="الاسم وحده مطلوب — أضف ما ينطبق فقط."
        size="lg"
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

          <Field label="اسم الحافلة" required error={errors.name}>
            {({ id, invalid }) => (
              <Input
                id={id}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-invalid={invalid}
                placeholder="مثال: حافلة ١"
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="النوع" error={errors.type}>
              {({ id }) => (
                <Input
                  id={id}
                  list="bus-types"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                />
              )}
            </Field>

            <Field label="السعة" error={errors.capacity} hint="عدد المقاعد">
              {({ id }) => (
                <NumberInput
                  id={id}
                  value={form.capacity}
                  onChange={(capacity) => setForm({ ...form, capacity })}
                  min={1}
                  max={200}
                />
              )}
            </Field>
          </div>

          <datalist id="bus-types">
            {BUS_TYPES.map((type) => <option key={type} value={type} />)}
          </datalist>

          <Field label="الموديل" error={errors.model}>
            {({ id }) => (
              <Input
                id={id}
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="مثال: Mercedes Tourismo"
              />
            )}
          </Field>

          <Field label="الوصف" error={errors.description}>
            {({ id }) => (
              <Textarea
                id={id}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            )}
          </Field>

          <FeatureSelector
            suggestions={BUS_FEATURES}
            value={form.features}
            onChange={(features) => setForm({ ...form, features })}
          />

          <ImageUploader
            label="صورة الحافلة"
            currentUrl={editing?.image_url}
            onChange={setImage}
            error={errors.image}
          />

          <Checkbox
            label="الحافلة نشطة"
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
      />
    </>
  );
}
