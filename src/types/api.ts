export type UUID = string;
export type IsoInstant = string;
export type Money = string; // BigDecimal as string to preserve precision

export type Role = "BUYER" | "SELLER" | "ADMIN" | "MODERATOR";
export type ListingStatus =
  | "DRAFT" | "PENDING_MODERATION" | "ACTIVE"
  | "RESERVED" | "SOLD" | "ARCHIVED" | "REJECTED";
export type ListingGender = "MALE" | "FEMALE";
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface PublicProfile {
  id: UUID;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  rating: Money | null;
  totalReviews: number | null;
  role: Role;
}

export interface UserProfile {
  id: UUID;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: Role;
  verified: boolean;
  active: boolean;
  bio: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  latitude: Money | null;
  longitude: Money | null;
  rating: Money | null;
  totalReviews: number | null;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface ListingImage {
  id: UUID;
  url: string;
  orderIndex: number;
  isMain: boolean;
}

export interface Listing {
  id: UUID;
  seller: PublicProfile;
  categoryId: UUID;
  categoryName: string;
  breedId: UUID | null;
  breedName: string | null;
  title: string;
  description: string | null;
  price: Money;
  currency: string;
  gender: ListingGender;
  ageMonths: number;
  color: string | null;
  weightKg: Money | null;
  healthInfo: string | null;
  hasVaccination: boolean | null;
  hasDocuments: boolean | null;
  locationCountry: string | null;
  locationCity: string | null;
  status: ListingStatus;
  viewsCount: number;
  images: ListingImage[];
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface ListingMini {
  id: UUID;
  title: string;
  price: Money;
  currency: string;
  locationCity: string | null;
  mainImageUrl: string | null;
  status: ListingStatus;
}

export interface Booking {
  id: UUID;
  listing: { id: UUID; title: string; price: Money; currency: string; mainImageUrl: string | null };
  buyer: PublicProfile;
  seller: PublicProfile;
  status: BookingStatus;
  message: string | null;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface Message {
  id: UUID;
  sender: PublicProfile;
  receiver: PublicProfile;
  listing: { id: UUID; title: string } | null;
  content: string | null;
  attachmentUrl: string | null;
  read: boolean;
  createdAt: IsoInstant;
}

export interface Conversation {
  partner: PublicProfile;
  lastMessage: Message | null;
  unreadCount: number;
}

export interface Review {
  id: UUID;
  author: PublicProfile;
  recipient: PublicProfile;
  booking: { id: UUID } | null;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: IsoInstant;
}

export interface Favorite {
  id: UUID;
  listing: ListingMini;
  createdAt: IsoInstant;
}

export interface Breed { id: UUID; name: string; }
export interface CategoryWithBreeds {
  id: UUID;
  name: string;
  slug: string;
  breeds: Breed[];
}

export interface Subscription {
  id: UUID;
  filters: Record<string, unknown>;
  isActive: boolean;
  createdAt: IsoInstant;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;       // current page (0-based)
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface AdminUser {
  id: UUID;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: Role;
  verified: boolean;
  active: boolean;
  bio: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  latitude: Money | null;
  longitude: Money | null;
  rating: Money | null;
  totalReviews: number | null;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface AdminStatistics {
  totalUsers: number;
  activeUsers: number;
  listingsByStatus: Partial<Record<ListingStatus, number>>;
  bookingsByStatus: Partial<Record<BookingStatus, number>>;
  reviewsByStatus: Partial<Record<ReviewStatus, number>>;
  listingsCreatedToday: number;
  listingsCreatedThisWeek: number;
  listingsCreatedThisMonth: number;
}

export interface UserStatusUpdate { active: boolean; reason?: string; }
export interface UserRoleUpdate { role: Role; }
export interface ListingModerate { status: "ACTIVE" | "REJECTED"; reason?: string; }
export interface ReviewModerate { status: "APPROVED" | "REJECTED"; reason?: string; }

export interface ApiProblemDetail {
  status?: number;
  title?: string;
  detail?: string;
  type?: string;
  violations?: { field: string; message: string }[];
}