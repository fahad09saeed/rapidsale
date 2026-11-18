export interface Role {
  id: number;
  name: string;
  description: string;
  is_system: boolean;
  permissions?: Permission[];
}

export interface Permission {
  id: number;
  name: string;
  description: string;
}

export interface User {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  avatar_url: string;
  about: string;
  role_id: number;
  role?: Role;
  status: "pending" | "active" | "banned";
  email_verified_at?: string;
  phone_verified_at?: string;
  location_id?: number;
  last_seen_at?: string;
  created_at: string;
}

export interface Me extends User {
  role_name: string;
  permissions: string[];
}

export interface PublicUser {
  id: number;
  name: string;
  avatar_url: string;
  about: string;
  verified: boolean;
  last_seen_at?: string;
  created_at: string;
  online: boolean;
}

export interface CategoryAttribute {
  id: number;
  category_id: number;
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  options?: string[];
  required: boolean;
  filterable: boolean;
  unit?: string;
  sort_order: number;
}

export interface Category {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  attributes?: CategoryAttribute[];
  children?: Category[];
}

export interface Location {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  type: "province" | "city" | "area";
  children?: Location[];
}

export interface ListingImage {
  id: number;
  url: string;
  sort_order: number;
}

export type ListingStatus = "pending" | "active" | "rejected" | "sold" | "expired" | "inactive";

export interface Listing {
  id: number;
  user_id: number;
  user?: User;
  category_id: number;
  category?: Category;
  location_id: number;
  location?: Location;
  title: string;
  description: string;
  price: number;
  negotiable: boolean;
  condition: string;
  status: ListingStatus;
  attributes: Record<string, string | number | boolean>;
  contact_name: string;
  contact_phone?: string;
  show_phone: boolean;
  is_featured: boolean;
  views: number;
  reject_reason?: string;
  expires_at?: string;
  images: ListingImage[];
  created_at: string;
  updated_at: string;
  is_favorite: boolean;
  has_phone: boolean;
}

export interface ListingDetail {
  listing: Listing;
  seller: PublicUser;
  seller_listings: number;
  category_path: Category[];
  location_path: Location[];
  attribute_defs: CategoryAttribute[];
  related: Listing[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface Conversation {
  id: number;
  listing: { id: number; title: string; price: number; status: string; image: string } | null;
  other_user: PublicUser;
  role: "buying" | "selling";
  last_message: string;
  last_message_at: string | null;
  unread: number;
  created_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  image_url?: string;
  read_at: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  user: Me;
}

export interface OtpResponse {
  message: string;
  target: string;
  purpose?: string;
  dev_code?: string;
}

export interface Report {
  id: number;
  reporter?: User;
  listing?: Listing;
  reported_user?: User;
  reason: string;
  details: string;
  status: "open" | "resolved" | "dismissed";
  admin_note?: string;
  created_at: string;
}
