/**
 * Mirrors the shapes returned by the Laravel API Resources.
 *
 * These describe what the backend sends; they are not a second definition of
 * the domain. When an API Resource changes, this file follows it — never the
 * other way round.
 */

// -- Envelope ---------------------------------------------------------------

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

// -- Identity ---------------------------------------------------------------

export type UserRole = 'super_admin' | 'owner' | 'employee';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  role_label: string;
  is_active: boolean;
  company_id: number | null;
  company?: Company | null;
  /** Present only when the backend loaded the relation. */
  permissions?: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface Company {
  id: number;
  name: string;
  slug: string;
  domain: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_path: string | null;
  logo_url: string | null;
  is_active: boolean;
  counts?: {
    owners: number;
    employees: number;
    packages: number;
    hotels: number;
    buses: number;
  };
  created_at: string | null;
  updated_at: string | null;
}

export interface Permission {
  id: number;
  name: string;
  group: string;
  label: string;
}

// -- Company-owned resources ------------------------------------------------

/**
 * Note how much of this is nullable.
 *
 * A package may be priced without a duration, dated without a price, or carry
 * nothing but a name. The UI must render every one of those without falling
 * over — see the `—` fallbacks in the tables.
 */
export interface Package {
  id: number;
  company_id: number;
  company?: Company;
  name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  days: number | null;
  start_date: string | null;
  end_date: string | null;
  trip_type: string | null;
  location: string | null;
  features: string[];
  image_path: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface Hotel {
  id: number;
  company_id: number;
  company?: Company;
  name: string;
  location: string | null;
  description: string | null;
  /** Walking distance in metres. */
  distance_from_haram: number | null;
  distance_from_masjid_nabawi: number | null;
  rating: number | null;
  room_type: string | null;
  features: string[];
  image_path: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface Bus {
  id: number;
  company_id: number;
  company?: Company;
  name: string;
  type: string | null;
  capacity: number | null;
  model: string | null;
  description: string | null;
  features: string[];
  image_path: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

// -- Audit ------------------------------------------------------------------

export type AuditSource = 'dashboard' | 'api' | 'mcp_agent';

export interface AuditLog {
  id: number;
  action: string;
  resource_type: string;
  resource_id: number | null;
  source: AuditSource;
  company_id: number | null;
  actor: {
    id: number | null;
    name: string | null;
    email: string | null;
    role: string | null;
  };
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

// -- Dashboard --------------------------------------------------------------

/**
 * A super admin receives every key; a company user receives only the four
 * that concern their own company.
 */
export interface Stats {
  companies?: number;
  active_companies?: number;
  owners?: number;
  employees: number;
  packages: number;
  hotels: number;
  buses: number;
}

export interface Session {
  user: User;
  permissions: string[];
}
