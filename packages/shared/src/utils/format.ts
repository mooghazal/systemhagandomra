/**
 * Display helpers.
 *
 * Every one of these answers the same question: what do we show when the
 * backend legitimately has nothing to give us? A package with no price and a
 * hotel with no rating are valid records, not broken ones (spec §19).
 */

/*
 * Arabic month and unit names, but Western digits.
 *
 * Plain `ar-EG` renders numerals as ١٢٣, which collides badly with the Latin
 * currency codes, IDs and phone numbers sitting beside them in these tables —
 * and makes a column of figures hard to scan. The `-u-nu-latn` extension keeps
 * the Arabic formatting and asks for 0-9.
 */
const LOCALE = 'ar-EG-u-nu-latn';

export function formatNumber(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;

  return new Intl.NumberFormat(LOCALE).format(value);
}

export function formatPrice(
  value: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;

  const amount = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

  return currency ? `${amount} ${currency}` : amount;
}

export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Metres, shown as kilometres once the number stops being easy to read. */
export function formatDistance(metres: number | null | undefined): string | null {
  if (metres === null || metres === undefined) return null;

  if (metres < 1000) return `${formatNumber(metres)} م`;

  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(metres / 1000)} كم`;
}

export function formatRating(rating: number | null | undefined): string | null {
  if (rating === null || rating === undefined) return null;

  return '★'.repeat(rating) + '☆'.repeat(Math.max(0, 5 - rating));
}

export const ACTION_LABELS: Record<string, string> = {
  created: 'أنشأ',
  updated: 'عدّل',
  deleted: 'حذف',
  permissions_updated: 'غيّر صلاحيات',
  login: 'سجّل الدخول',
  logout: 'سجّل الخروج',
  logout_all: 'أنهى كل الجلسات',
  login_failed: 'محاولة دخول فاشلة',
};

export const RESOURCE_LABELS: Record<string, string> = {
  package: 'باقة',
  hotel: 'فندق',
  bus: 'حافلة',
  user: 'مستخدم',
  company: 'شركة',
  auth: 'مصادقة',
};

export const SOURCE_LABELS: Record<string, string> = {
  dashboard: 'لوحة التحكم',
  api: 'واجهة برمجية',
  mcp_agent: 'المساعد الذكي',
};

export const PERMISSION_GROUP_LABELS: Record<string, string> = {
  employees: 'الموظفون',
  packages: 'الباقات',
  hotels: 'الفنادق',
  buses: 'الحافلات',
};

/**
 * The backend returns permission groups alphabetically by their English key —
 * buses, employees, hotels, packages — which reads as no order at all on an
 * Arabic screen. This is the order a company thinks about them in.
 */
const GROUP_ORDER = ['packages', 'hotels', 'buses', 'employees'];

/**
 * Sorts grouped permissions for display. A group the backend adds later that
 * is not listed above falls in at the end rather than disappearing.
 */
export function orderPermissionGroups<T>(groups: Record<string, T>): Array<[string, T]> {
  const rank = (group: string) => {
    const index = GROUP_ORDER.indexOf(group);

    return index === -1 ? GROUP_ORDER.length : index;
  };

  return Object.entries(groups).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

export const PERMISSION_ACTION_LABELS: Record<string, string> = {
  view: 'عرض',
  create: 'إضافة',
  update: 'تعديل',
  delete: 'حذف',
};

/**
 * Builds the multipart body for a resource write.
 *
 * Three rules matter here, and all three come from the backend contract:
 *
 *   - `undefined` is skipped, so an untouched field stays untouched;
 *   - `null` is sent as an empty string, which Laravel's `nullable` converts
 *     back to null — that is how a field gets cleared on purpose;
 *   - `false` and `0` are sent as themselves, never dropped as "falsy".
 *
 * Mixing those up is how "remove the price" silently becomes "set it to zero".
 */
export function toFormData(values: Record<string, unknown>): FormData {
  const form = new FormData();

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;

    if (value === null) {
      form.append(key, '');
      continue;
    }

    if (value instanceof File) {
      form.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        // Sent as a bare empty value, not `key[]=''` — that would arrive as an
        // array holding one empty string and store a phantom feature. Laravel's
        // ConvertEmptyStringsToNull turns this into null, which the `nullable`
        // rule accepts and the model casts back to an empty list.
        form.append(key, '');
      } else {
        value.forEach((item) => form.append(`${key}[]`, String(item)));
      }
      continue;
    }

    if (typeof value === 'boolean') {
      form.append(key, value ? '1' : '0');
      continue;
    }

    form.append(key, String(value));
  }

  return form;
}
