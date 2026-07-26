import { z } from "zod";
import type { ProfileUpdate } from "@/types/api";

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Ограничения зеркалят Bean Validation в ProfileUpdateRequest на бэкенде.
const optional = (max: number) => z.string().max(max).optional();

export const profileSchema = z.object({
  firstName: optional(100),
  lastName: optional(100),
  phone: optional(20),
  bio: optional(2000),
  country: optional(100),
  city: optional(100),
  address: optional(255),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/** Пустая (в т. ч. состоящая из пробелов) строка означает «поле не задано» → null. */
export function toProfileUpdate(input: ProfileInput): ProfileUpdate {
  const v = (s?: string): string | null => (s != null && s.trim() !== "" ? s : null);
  return {
    firstName: v(input.firstName),
    lastName: v(input.lastName),
    phone: v(input.phone),
    bio: v(input.bio),
    country: v(input.country),
    city: v(input.city),
    address: v(input.address),
  };
}
