import { api } from '@hagamra/shared/lib/api';
import type {
  AuditLog,
  Bus,
  Company,
  Hotel,
  Package,
  Paginated,
  Permission,
  PermissionPreset,
  Session,
  Stats,
  User,
} from '@hagamra/shared/types';

/**
 * Every call the panel makes, in one place.
 *
 * Components ask these for data; they never build a URL or know a path. When
 * the API contract moves, it moves here and nowhere else.
 */

export type Query = Record<string, unknown>;

// -- Auth -------------------------------------------------------------------

export const authService = {
  /**
   * Hits this app's own login route, not Laravel directly, because only the
   * server may touch the token.
   */
  async login(email: string, password: string): Promise<User> {
    let response: Response;

    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error('تعذّر الاتصال بالخادم. تحقّق من اتصالك بالشبكة.');
    }

    const body = await response.json().catch(() => null);

    if (!response.ok || !body?.success) {
      /*
       * Laravel's own wording is not shown here.
       *
       * It is English, and more importantly a failed login is deliberately
       * vague on the backend — the same answer for an unknown address and a
       * wrong password — so translating it field by field would be guesswork.
       * A 422 at this endpoint means exactly one thing: the credentials were
       * not accepted.
       */
      throw new Error(
        response.status === 429
          ? 'محاولات كثيرة جداً. يرجى الانتظار دقيقة ثم المحاولة مرة أخرى.'
          : response.status === 422 || response.status === 401
            ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
            : response.status >= 500
              ? 'تعذّر الوصول إلى الخادم. يرجى المحاولة مرة أخرى.'
              : 'تعذّر تسجيل الدخول.',
      );
    }

    return body.data.user as User;
  },

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
  },

  me: () => api.get<Session>('auth/me'),
};

// -- Companies --------------------------------------------------------------

export const companiesService = {
  getAll: (query?: Query, signal?: AbortSignal) =>
    api.list<Company>('companies', query, signal),

  getById: (id: number) => api.get<Company>(`companies/${id}`),

  create: (form: FormData) => api.upload<Company>('companies', form),

  update: (id: number, form: FormData) =>
    api.upload<Company>(`companies/${id}`, form, 'PUT'),

  delete: (id: number) => api.delete<null>(`companies/${id}`),
};

// -- Owners -----------------------------------------------------------------

export const ownersService = {
  /** Every owner in the system, for the owners screen. */
  getAll: (query?: Query, signal?: AbortSignal) =>
    api.list<User>('owners', query, signal),

  /** The owner belonging to one company. */
  forCompany: (companyId: number) =>
    api.get<User[]>(`companies/${companyId}/owners`),

  create: (companyId: number, data: Query) =>
    api.post<User>(`companies/${companyId}/owners`, data),

  update: (companyId: number, ownerId: number, data: Query) =>
    api.put<User>(`companies/${companyId}/owners/${ownerId}`, data),

  delete: (companyId: number, ownerId: number) =>
    api.delete<null>(`companies/${companyId}/owners/${ownerId}`),
};

// -- Employees --------------------------------------------------------------

export const employeesService = {
  getAll: (query?: Query, signal?: AbortSignal) =>
    api.list<User>('employees', query, signal),

  getById: (id: number) => api.get<User>(`employees/${id}`),

  create: (data: Query) => api.post<User>('employees', data),

  update: (id: number, data: Query) => api.put<User>(`employees/${id}`, data),

  delete: (id: number) => api.delete<null>(`employees/${id}`),

  getPermissions: (id: number) =>
    api.get<{ permissions: string[] }>(`employees/${id}/permissions`),

  /** Replaces the whole set; `[]` revokes everything. */
  setPermissions: (id: number, permissions: string[]) =>
    api.put<{ permissions: string[] }>(`employees/${id}/permissions`, { permissions }),
};

// -- Permission catalogue ---------------------------------------------------

export const permissionsService = {
  /**
   * The list the permission editor renders. It comes from the backend rather
   * than a hardcoded copy, so a permission added in Laravel appears here
   * without a frontend change (spec §17).
   */
  getAll: () =>
    api.get<{
      permissions: Permission[];
      groups: Record<string, string[]>;
      presets: PermissionPreset[];
    }>('permissions'),
};

// -- Company-owned resources ------------------------------------------------

/**
 * Packages, hotels and buses differ only in their fields, so their services
 * are generated from one shape rather than written out three times.
 */
function resourceService<T>(path: string) {
  return {
    getAll: (query?: Query, signal?: AbortSignal) => api.list<T>(path, query, signal),

    getById: (id: number) => api.get<T>(`${path}/${id}`),

    /** FormData throughout, because any of these may carry an image. */
    create: (form: FormData) => api.upload<T>(path, form),

    update: (id: number, form: FormData) => api.upload<T>(`${path}/${id}`, form, 'PUT'),

    delete: (id: number) => api.delete<null>(`${path}/${id}`),
  };
}

export const packagesService = resourceService<Package>('packages');
export const hotelsService = resourceService<Hotel>('hotels');
export const busesService = resourceService<Bus>('buses');

// -- Audit logs -------------------------------------------------------------

export const auditLogsService = {
  getAll: (query?: Query, signal?: AbortSignal) =>
    api.list<AuditLog>('audit-logs', query, signal),
};

// -- Dashboard --------------------------------------------------------------

export const statsService = {
  get: (signal?: AbortSignal) => api.get<Stats>('stats', undefined, signal),
};

export type { Paginated };
