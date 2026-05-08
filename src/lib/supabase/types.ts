/**
 * Hand-rolled minimal types for the public schema. Generate full types via
 * `pnpm db:types` once the project is connected to a live Supabase instance.
 */
export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type DisplayPref = 'avatar_only' | 'avatar_name';
export type Role = 'member' | 'admin';

export interface Profile {
  id: string;
  display_name: string;
  avatar_path: string;
  display_pref: DisplayPref;
  instagram: string | null;
  website: string | null;
  is_member: boolean;
  role: Role;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivateProfile {
  id: string;
  real_name: string | null;
  email: string | null;
  line_sub: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  slug: string;
  label: string;
  icon: string;
  color: string;
  sort_order: number;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Pin {
  id: string;
  created_by: string;
  name: string;
  google_place_id: string | null;
  address: string;
  lat: number;
  lng: number;
  prefecture: string;
  city: string | null;
  address_components: Json | null;
  category_id: string;
  vouch_note: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface PinPhoto {
  id: string;
  pin_id: string;
  storage_path: string;
  sort_order: number;
  uploaded_by: string;
  created_at: string;
}

export interface Vouch {
  id: string;
  pin_id: string;
  voucher_id: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invite {
  token: string;
  created_by: string;
  note: string | null;
  created_at: string;
  expires_at: string;
  used_by: string | null;
  used_at: string | null;
}

export type AcceptInviteResult = 'accepted' | 'already_member' | 'expired' | 'invalid';

export interface JwtClaims {
  sub: string;
  is_member?: boolean;
  role?: Role;
  exp: number;
  iat: number;
  aud: string;
  iss?: string;
  email?: string;
}
