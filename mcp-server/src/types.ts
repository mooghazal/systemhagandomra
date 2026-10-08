/** Mirrors the shapes the Laravel API Resources return. */

export interface ApiSuccess<T> {
  success: true;
  data: T;
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

export interface Company {
  id: number;
  name: string;
  slug: string;
  domain: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: 'super_admin' | 'owner' | 'employee';
  role_label: string;
  is_active: boolean;
  company_id: number | null;
  company?: Company | null;
  permissions?: string[];
  created_at: string | null;
}

/**
 * Almost everything here is nullable, and that is the point: a package may
 * carry a name and nothing else. An absent value means "not recorded", never
 * zero and never an error.
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
  image_url: string | null;
  is_active: boolean;
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
  image_url: string | null;
  is_active: boolean;
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
  image_url: string | null;
  is_active: boolean;
}

export interface Permission {
  id: number;
  name: string;
  group: string;
  label: string;
}

export interface Session {
  user: User;
  permissions: string[];
}
