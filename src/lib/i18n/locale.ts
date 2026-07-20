import type { Locale } from "./config";
import type { CategoryWithBreeds } from "@/types/api";

export function pickField<T extends Record<string, unknown>>(obj: T, locale: Locale, key: string): string {
  const localized = obj[`${key}_${locale}`];
  return typeof localized === "string" ? localized : (typeof obj[key] === "string" ? (obj[key] as string) : "");
}

export function localizedCategory(cat: CategoryWithBreeds, locale: Locale): string {
  // backend DTO currently exposes single `name`; helper is forward-compatible with name_<locale>
  return pickField(cat as unknown as Record<string, unknown>, locale, "name");
}