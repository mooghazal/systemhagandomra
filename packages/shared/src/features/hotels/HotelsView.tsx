'use client';

import { Hotel as HotelIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { FeatureSelector, HOTEL_FEATURES } from '@hagamra/shared/components/forms/FeatureSelector';
import { BulkBar, SelectAllTh, SelectTd } from '@hagamra/shared/components/tables/BulkBar';
import { ExportButton } from '@hagamra/shared/components/tables/ExportButton';
import { ResourceTable, RowActions } from '@hagamra/shared/components/tables/ResourceTable';
import { Button } from '@hagamra/shared/components/ui/Button';
import { ConfirmDialog, Dialog } from '@hagamra/shared/components/ui/Dialog';
import { Checkbox, Field, Input, NumberInput, Select, Textarea } from '@hagamra/shared/components/ui/Field';
import { Badge, PageHeader, Td, SortableTh, Th, Thumb, Tr, Value } from '@hagamra/shared/components/ui/Primitives';
import { ImageUploader, type ImageSelection } from '@hagamra/shared/components/upload/ImageUploader';
import { useCreateFromUrl } from '@hagamra/shared/hooks/useCreateFromUrl';
import { useErrorFocus } from '@hagamra/shared/hooks/useErrorFocus';
import { useResource } from '@hagamra/shared/hooks/useResource';
import { useSelection } from '@hagamra/shared/hooks/useSelection';
import { useSort } from '@hagamra/shared/hooks/useSort';
import { useSession } from '@hagamra/shared/hooks/useSession';
import { useToast } from '@hagamra/shared/components/ui/Toast';
import { ApiError } from '@hagamra/shared/lib/api';
import { describeBulk, runBulk } from '@hagamra/shared/lib/bulk';
import { companiesService, hotelsService } from '@hagamra/shared/services';
import type { Company, Hotel } from '@hagamra/shared/types';
import { formatDistance, formatRating, toFormData } from '@hagamra/shared/utils/format';

/**
 * Hotels (spec §24–§27).
 *
 * The two distance fields are the point worth noticing: a Makkah hotel has no
 * meaningful distance to Masjid an-Nabawi and a Madinah one has none to the
 * Haram, so both are optional and neither is ever filled in by default.
 */

interface FormState {
  name: string;
  location: string;
  description: string;
  distance_from_haram: number | null;
  distance_from_masjid_nabawi: number | null;
  rating: number | null;
  room_type: string;
  features: string[];
  is_active: boolean;
}

const BLANK: FormState = {
  name: '',
  location: '',
  description: '',
  distance_from_haram: null,
  distance_from_masjid_nabawi: null,
  rating: null,
  room_type: '',
  features: [],
  is_active: true,
};

const ROOM_TYPES = ['ثنائية', 'ثلاثية', 'رباعية', 'خماسية', 'جناح'];

export function HotelsView() {
  const { can, isSuperAdmin } = useSession();
  const toast = useToast();

  // Ordering happens in Laravel; this only decides which column to ask for.
  const state = useResource<Hotel>(
    useCallback((query, signal) => hotelsService.getAll(query, signal), []),
  );

  const sort = useSort(state);
  const selection = useSelection(state.items);
  const [bulkOpen, setBulkOpen] = useState(false);

  /**
   * Deleting several at once.
   *
   * One request each, so every record is authorised on its own and lands in
   * the audit trail as its own entry — "deleted 12 things" is not what
   * somebody reading that trail later needs.
   */
  /**
   * Deleting several at once.
   *
   * One request each, so every record is authorised on its own and lands in
   * the audit trail as its own entry — "deleted 12 things" is not what
   * somebody reading that trail later needs. They run in sequence, because
   * a dozen parallel writes is exactly what the write limiter exists to
   * slow down.
   */
  async function removeSelected() {
    setBusy(true);

    const result = await runBulk(selection.ids, (id) => hotelsService.delete(id));

    // Both outcomes are reported, including a partial one: "mostly worked"
    // is the case somebody actually has to act on.
    if (result.failed > 0) {
      toast.error(describeBulk(result, 'حذف'));
    } else {
      toast.success(describeBulk(result, 'حذف'));
    }

    selection.clear();
    setBulkOpen(false);
    setBusy(false);
    state.reload();
  }

  const [editing, setEditing] = useState<Hotel | null>(null);
  const [creating, setCreating] = useCreateFromUrl(can('hotels.create'));
  const [deleting, setDeleting] = useState<Hotel | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<FormState>(BLANK);
  const [image, setImage] = useState<ImageSelection>({ file: null, removed: false });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useErrorFocus(errors);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');

  useEffect(() => {
    if (!isSuperAdmin) return;

    companiesService
      .getAll({ per_page: 100 })
      .then((result) => setCompanies(result.items))
      .catch(() => setCompanies([]));
  }, [isSuperAdmin]);


  const open = (item: Hotel | null) => {
    setErrors({});
    setImage({ file: null, removed: false });

    if (item) {
      setForm({
        name: item.name,
        location: item.location ?? '',
        description: item.description ?? '',
        distance_from_haram: item.distance_from_haram,
        distance_from_masjid_nabawi: item.distance_from_masjid_nabawi,
        rating: item.rating,
        room_type: item.room_type ?? '',
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
      location: blank(form.location),
      description: blank(form.description),
      distance_from_haram: form.distance_from_haram,
      distance_from_masjid_nabawi: form.distance_from_masjid_nabawi,
      rating: form.rating,
      room_type: blank(form.room_type),
      features: form.features,
      is_active: form.is_active,
    };

    if (isSuperAdmin && !editing) payload.company_id = companyId || null;
    if (image.file) payload.image = image.file;
    if (image.removed) payload.remove_image = true;

    try {
      if (editing) {
        await hotelsService.update(editing.id, toFormData(payload));
        toast.success('تم تحديث الفندق.');
      } else {
        await hotelsService.create(toFormData(payload));
        toast.success('تمت إضافة الفندق.');
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
        toast.error(error instanceof ApiError ? error.message : 'تعذّر حفظ الفندق.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;

    setBusy(true);

    try {
      await hotelsService.delete(deleting.id);
      toast.success('تم حذف الفندق.');
      setDeleting(null);
      state.reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'تعذّر حذف الفندق.');
    } finally {
      setBusy(false);
    }
  }

  const addButton = can('hotels.create') ? (
    <Button onClick={() => open(null)}>
      <Plus className="size-4" aria-hidden="true" />
      إضافة فندق
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title="الفنادق"
        description="فنادق الإقامة في مكة والمدينة"
        icon={HotelIcon}
        accent="hotels"
        action={
          <div className="flex items-center gap-2">
            <ExportButton
              resource="hotels"
              filters={{ ...state.filters, search: state.search }}
              disabled={state.items.length === 0}
            />
            {addButton}
          </div>
        }
      />

      {can('hotels.delete') && (
        <BulkBar count={selection.count} onClear={selection.clear}>
          <Button variant="danger" size="sm" onClick={() => setBulkOpen(true)} disabled={busy}>
            <Trash2 className="size-4" aria-hidden="true" />
            حذف المحدّد
          </Button>
        </BulkBar>
      )}

      <ResourceTable
        state={state}
        searchPlaceholder="بحث باسم الفندق…"
        emptyTitle="لا توجد فنادق"
        emptyDescription="ابدأ بإضافة أول فندق."
        emptyAction={addButton}
        filters={
          <Select
            value={(state.filters.min_rating as string) ?? ''}
            onChange={(event) => state.setFilter('min_rating', event.target.value)}
            aria-label="تصفية بالتقييم"
            className="h-10 w-auto min-w-40"
          >
            <option value="">كل التقييمات</option>
            {[5, 4, 3, 2, 1].map((stars) => (
              <option key={stars} value={stars}>{stars} نجوم فأكثر</option>
            ))}
          </Select>
        }
        columns={
          <>
          {can('hotels.delete') && (
            <SelectAllTh
              all={selection.allSelected}
              some={selection.someSelected}
              onToggle={selection.toggleAll}
            />
          )}
            <Th className="w-16">الصورة</Th>
            <SortableTh column="name" {...sort}>الاسم</SortableTh>
            <Th>الموقع</Th>
            <SortableTh column="rating" {...sort}>التقييم</SortableTh>
            <SortableTh column="distance_from_haram" {...sort}>من الحرم</SortableTh>
            <SortableTh column="distance_from_masjid_nabawi" {...sort}>من المسجد النبوي</SortableTh>
            <Th>نوع الغرفة</Th>
            {isSuperAdmin && <Th>الشركة</Th>}
            <Th>الحالة</Th>
            <Th className="text-end">إجراءات</Th>
          </>
        }
        renderRow={(item) => (
          <Tr key={item.id}>
            {can('hotels.delete') && (
              <SelectTd
                checked={selection.isSelected(item.id)}
                onToggle={() => selection.toggle(item.id)}
                label={item.name}
              />
            )}
            <Td><Thumb src={item.image_url} alt={item.name} /></Td>
            <Td><span className="font-medium text-foreground">{item.name}</span></Td>
            <Td><Value>{item.location}</Value></Td>
            <Td>
              <Value>
                {item.rating ? (
                  <span className="text-warning" title={`${item.rating} من ٥`} aria-label={`${item.rating} من ٥`}>
                    {formatRating(item.rating)}
                  </span>
                ) : null}
              </Value>
            </Td>
            <Td className="tabular"><Value>{formatDistance(item.distance_from_haram)}</Value></Td>
            <Td className="tabular"><Value>{formatDistance(item.distance_from_masjid_nabawi)}</Value></Td>
            <Td><Value>{item.room_type}</Value></Td>
            {isSuperAdmin && <Td><Value>{item.company?.name}</Value></Td>}
            <Td>
              <Badge tone={item.is_active ? 'success' : 'neutral'}>
                {item.is_active ? 'نشط' : 'متوقف'}
              </Badge>
            </Td>
            <Td>
              <RowActions>
                {can('hotels.update') && (
                  <Button variant="ghost" size="icon" onClick={() => open(item)} aria-label={`تعديل ${item.name}`}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                )}
                {can('hotels.delete') && (
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
        title={editing ? 'تعديل الفندق' : 'إضافة فندق'}
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

          <Field label="اسم الفندق" required error={errors.name}>
            {({ id, invalid }) => (
              <Input
                id={id}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-invalid={invalid}
                placeholder="مثال: سويس أوتيل المقام"
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الموقع" error={errors.location}>
              {({ id }) => (
                <Input
                  id={id}
                  list="hotel-cities"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="مكة المكرمة"
                />
              )}
            </Field>

            <Field label="التقييم" error={errors.rating}>
              {({ id }) => (
                <Select
                  id={id}
                  value={form.rating ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, rating: e.target.value === '' ? null : Number(e.target.value) })
                  }
                >
                  <option value="">غير محدّد</option>
                  {[5, 4, 3, 2, 1].map((stars) => (
                    <option key={stars} value={stars}>{stars} نجوم</option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label="المسافة من الحرم"
              error={errors.distance_from_haram}
              hint="بالمتر — اتركه فارغاً لفنادق المدينة"
            >
              {({ id }) => (
                <NumberInput
                  id={id}
                  value={form.distance_from_haram}
                  onChange={(distance_from_haram) => setForm({ ...form, distance_from_haram })}
                  min={0}
                />
              )}
            </Field>

            <Field
              label="المسافة من المسجد النبوي"
              error={errors.distance_from_masjid_nabawi}
              hint="بالمتر — اتركه فارغاً لفنادق مكة"
            >
              {({ id }) => (
                <NumberInput
                  id={id}
                  value={form.distance_from_masjid_nabawi}
                  onChange={(distance_from_masjid_nabawi) =>
                    setForm({ ...form, distance_from_masjid_nabawi })
                  }
                  min={0}
                />
              )}
            </Field>
          </div>

          <datalist id="hotel-cities">
            <option value="مكة المكرمة" />
            <option value="المدينة المنورة" />
            <option value="جدة" />
          </datalist>

          <Field label="نوع الغرفة" error={errors.room_type}>
            {({ id }) => (
              <Input
                id={id}
                list="room-types"
                value={form.room_type}
                onChange={(e) => setForm({ ...form, room_type: e.target.value })}
              />
            )}
          </Field>

          <datalist id="room-types">
            {ROOM_TYPES.map((type) => <option key={type} value={type} />)}
          </datalist>

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
            suggestions={HOTEL_FEATURES}
            value={form.features}
            onChange={(features) => setForm({ ...form, features })}
          />

          <ImageUploader
            label="صورة الفندق"
            currentUrl={editing?.image_url}
            onChange={setImage}
            error={errors.image}
          />

          <Checkbox
            label="الفندق نشط"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
        </div>
      </Dialog>

        <ConfirmDialog
  open={bulkOpen}
  onClose={() => setBulkOpen(false)}
  onConfirm={removeSelected}
  title="حذف المحدّد"
  message={`سيتم حذف ${selection.count} عنصر. يمكن استرجاعها لاحقاً من قاعدة البيانات، لكن لن تظهر في اللوحة.`}
  confirmLabel="حذف الكل"
  loading={busy}
/>

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
