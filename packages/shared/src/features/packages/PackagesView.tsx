'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { FeatureSelector, PACKAGE_FEATURES } from '@hagamra/shared/components/forms/FeatureSelector';
import { ResourceTable, RowActions } from '@hagamra/shared/components/tables/ResourceTable';
import { Button } from '@hagamra/shared/components/ui/Button';
import { ConfirmDialog, Dialog } from '@hagamra/shared/components/ui/Dialog';
import { Field, Input, NumberInput, Select, Textarea, Checkbox } from '@hagamra/shared/components/ui/Field';
import { Badge, PageHeader, Td, Th, Thumb, Tr, Value } from '@hagamra/shared/components/ui/Primitives';
import { ImageUploader, type ImageSelection } from '@hagamra/shared/components/upload/ImageUploader';
import { useResource } from '@hagamra/shared/hooks/useResource';
import { useSession } from '@hagamra/shared/hooks/useSession';
import { useToast } from '@hagamra/shared/components/ui/Toast';
import { ApiError } from '@hagamra/shared/lib/api';
import { companiesService, packagesService } from '@hagamra/shared/services';
import type { Company, Package } from '@hagamra/shared/types';
import { formatDate, formatPrice, toFormData } from '@hagamra/shared/utils/format';

/**
 * Packages (spec §18–§23).
 *
 * The thing this screen has to get right is that almost every field is
 * optional. A package may carry a name and nothing else, and the table and
 * form both have to handle that without complaint — hence the em dashes in the
 * cells and the `(اختياري)` markers on all but one input.
 */

interface FormState {
  name: string;
  description: string;
  price: number | null;
  currency: string;
  days: number | null;
  start_date: string;
  end_date: string;
  trip_type: string;
  location: string;
  features: string[];
  is_active: boolean;
}

const BLANK: FormState = {
  name: '',
  description: '',
  price: null,
  currency: 'SAR',
  days: null,
  start_date: '',
  end_date: '',
  trip_type: '',
  location: '',
  features: [],
  is_active: true,
};

/** Suggestions only — the backend accepts any label (§13 of the backend spec). */
const TRIP_TYPES = [
  'حج',
  'عمرة',
  'عمرة رمضان',
  'عمرة عائلية',
  'عمرة جماعية',
  'VIP',
  'اقتصادية',
];

export function PackagesView() {
  const { can, isSuperAdmin } = useSession();
  const toast = useToast();
  const params = useSearchParams();

  const state = useResource<Package>(
    useCallback((query, signal) => packagesService.getAll(query, signal), []),
  );

  const [editing, setEditing] = useState<Package | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Package | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<FormState>(BLANK);
  const [image, setImage] = useState<ImageSelection>({ file: null, removed: false });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Super admins must say which company a new package belongs to; company
  // users have exactly one and the backend fills it in for them.
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>('');

  useEffect(() => {
    if (!isSuperAdmin) return;

    companiesService
      .getAll({ per_page: 100 })
      .then((result) => setCompanies(result.items))
      .catch(() => setCompanies([]));
  }, [isSuperAdmin]);

  // The dashboard's quick actions link here with ?new=1.
  useEffect(() => {
    if (params.get('new') === '1' && can('packages.create')) setCreating(true);
  }, [params, can]);

  const open = (item: Package | null) => {
    setErrors({});
    setImage({ file: null, removed: false });

    if (item) {
      setForm({
        name: item.name,
        description: item.description ?? '',
        price: item.price,
        currency: item.currency ?? 'SAR',
        days: item.days,
        start_date: item.start_date ?? '',
        end_date: item.end_date ?? '',
        trip_type: item.trip_type ?? '',
        location: item.location ?? '',
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

    // An empty text box means "no value", not an empty string: sending null
    // lets the backend store it as absent rather than as "".
    const blank = (value: string) => (value.trim() === '' ? null : value.trim());

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: blank(form.description),
      price: form.price,
      currency: form.price === null ? null : blank(form.currency),
      days: form.days,
      start_date: blank(form.start_date),
      end_date: blank(form.end_date),
      trip_type: blank(form.trip_type),
      location: blank(form.location),
      features: form.features,
      is_active: form.is_active,
    };

    if (isSuperAdmin && !editing) payload.company_id = companyId || null;
    if (image.file) payload.image = image.file;
    if (image.removed) payload.remove_image = true;

    try {
      if (editing) {
        await packagesService.update(editing.id, toFormData(payload));
        toast.success('تم تحديث الباقة.');
      } else {
        await packagesService.create(toFormData(payload));
        toast.success('تمت إضافة الباقة.');
      }

      close();
      state.reload();
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        // Server-side messages go beside the fields they belong to (§33).
        setErrors(
          Object.fromEntries(
            Object.entries(error.errors).map(([field, messages]) => [field, messages[0]]),
          ),
        );
      } else {
        toast.error(error instanceof ApiError ? error.message : 'تعذّر حفظ الباقة.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;

    setBusy(true);

    try {
      await packagesService.delete(deleting.id);
      toast.success('تم حذف الباقة.');
      setDeleting(null);
      state.reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'تعذّر حذف الباقة.');
    } finally {
      setBusy(false);
    }
  }

  const addButton = can('packages.create') ? (
    <Button onClick={() => open(null)}>
      <Plus className="size-4" aria-hidden="true" />
      إضافة باقة
    </Button>
  ) : null;

  return (
    <>
      <PageHeader title="الباقات" description="باقات الحج والعمرة" action={addButton} />

      <ResourceTable
        state={state}
        searchPlaceholder="بحث باسم الباقة…"
        emptyTitle="لا توجد باقات"
        emptyDescription="ابدأ بإضافة أول باقة."
        emptyAction={addButton}
        filters={
          <Select
            value={(state.filters.trip_type as string) ?? ''}
            onChange={(event) => state.setFilter('trip_type', event.target.value)}
            aria-label="تصفية بنوع الرحلة"
            className="h-10 w-auto min-w-40"
          >
            <option value="">كل الأنواع</option>
            {TRIP_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </Select>
        }
        columns={
          <>
            <Th className="w-16">الصورة</Th>
            <Th>الاسم</Th>
            <Th>السعر</Th>
            <Th>المدة</Th>
            <Th>النوع</Th>
            <Th>الوجهة</Th>
            {isSuperAdmin && <Th>الشركة</Th>}
            <Th>الحالة</Th>
            <Th className="text-end">إجراءات</Th>
          </>
        }
        renderRow={(item) => (
          <Tr key={item.id}>
            <Td>
              <Thumb src={item.image_url} alt={item.name} />
            </Td>
            <Td>
              <span className="font-medium text-foreground">{item.name}</span>
              {item.start_date && (
                <span className="mt-0.5 block text-xs text-muted">
                  من {formatDate(item.start_date)}
                </span>
              )}
            </Td>
            <Td className="tabular whitespace-nowrap">
              <Value>{formatPrice(item.price, item.currency)}</Value>
            </Td>
            <Td className="tabular">
              <Value>{item.days ? `${item.days} يوم` : null}</Value>
            </Td>
            <Td><Value>{item.trip_type}</Value></Td>
            <Td><Value>{item.location}</Value></Td>
            {isSuperAdmin && <Td><Value>{item.company?.name}</Value></Td>}
            <Td>
              <Badge tone={item.is_active ? 'success' : 'neutral'}>
                {item.is_active ? 'نشطة' : 'متوقفة'}
              </Badge>
            </Td>
            <Td>
              <RowActions>
                {can('packages.update') && (
                  <Button variant="ghost" size="icon" onClick={() => open(item)} aria-label={`تعديل ${item.name}`}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                )}
                {can('packages.delete') && (
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
        title={editing ? 'تعديل الباقة' : 'إضافة باقة'}
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
                <Select
                  id={id}
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value)}
                  aria-invalid={invalid}
                >
                  <option value="">اختر الشركة…</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </Select>
              )}
            </Field>
          )}

          <Field label="اسم الباقة" required error={errors.name}>
            {({ id, invalid }) => (
              <Input
                id={id}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                aria-invalid={invalid}
                placeholder="مثال: عمرة رمضان"
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="السعر" error={errors.price} hint="اتركه فارغاً إن لم يكن محدّداً">
              {({ id }) => (
                <NumberInput
                  id={id}
                  value={form.price}
                  onChange={(price) => setForm({ ...form, price })}
                  min={0}
                  step="0.01"
                />
              )}
            </Field>

            <Field label="العملة" error={errors.currency}>
              {({ id }) => (
                <Select
                  id={id}
                  value={form.currency}
                  onChange={(event) => setForm({ ...form, currency: event.target.value })}
                >
                  <option value="SAR">ريال سعودي (SAR)</option>
                  <option value="EGP">جنيه مصري (EGP)</option>
                  <option value="USD">دولار (USD)</option>
                </Select>
              )}
            </Field>

            <Field label="عدد الأيام" error={errors.days}>
              {({ id }) => (
                <NumberInput
                  id={id}
                  value={form.days}
                  onChange={(days) => setForm({ ...form, days })}
                  min={1}
                  max={365}
                />
              )}
            </Field>

            <Field label="نوع الرحلة" error={errors.trip_type}>
              {({ id }) => (
                <Input
                  id={id}
                  list="trip-types"
                  value={form.trip_type}
                  onChange={(event) => setForm({ ...form, trip_type: event.target.value })}
                  placeholder="اختر أو اكتب نوعاً"
                />
              )}
            </Field>

            <Field label="تاريخ البداية" error={errors.start_date}>
              {({ id }) => (
                <Input
                  id={id}
                  type="date"
                  value={form.start_date}
                  onChange={(event) => setForm({ ...form, start_date: event.target.value })}
                />
              )}
            </Field>

            <Field label="تاريخ النهاية" error={errors.end_date}>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  type="date"
                  value={form.end_date}
                  min={form.start_date || undefined}
                  onChange={(event) => setForm({ ...form, end_date: event.target.value })}
                  aria-invalid={invalid}
                />
              )}
            </Field>
          </div>

          {/* A datalist suggests without restricting, which is exactly how the
              backend treats trip_type. */}
          <datalist id="trip-types">
            {TRIP_TYPES.map((type) => <option key={type} value={type} />)}
          </datalist>

          <Field label="الوجهة" error={errors.location}>
            {({ id }) => (
              <Input
                id={id}
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                placeholder="مثال: مكة المكرمة والمدينة المنورة"
              />
            )}
          </Field>

          <Field label="الوصف" error={errors.description}>
            {({ id }) => (
              <Textarea
                id={id}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            )}
          </Field>

          <FeatureSelector
            suggestions={PACKAGE_FEATURES}
            value={form.features}
            onChange={(features) => setForm({ ...form, features })}
          />

          <ImageUploader
            label="صورة الباقة"
            currentUrl={editing?.image_url}
            onChange={setImage}
            error={errors.image}
          />

          <Checkbox
            label="الباقة نشطة"
            checked={form.is_active}
            onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
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
