import { describe, it, expect } from "vitest";
import { localizedCategory, pickField } from "@/lib/i18n/locale";
import type { CategoryWithBreeds } from "@/types/api";

describe("locale helpers", () => {
  it("pickField prefers name_<locale> over name", () => {
    const obj = { name_ru: "Кошки", name_en: "Cats", name: "Cats" } as unknown as Record<string, unknown>;
    expect(pickField(obj, "ru", "name")).toBe("Кошки");
    expect(pickField(obj, "en", "name")).toBe("Cats");
  });
  it("localizedCategory falls back to name when no localized field", () => {
    const cat = { id: "1", name: "Cats", slug: "cats", breeds: [] } as CategoryWithBreeds;
    expect(localizedCategory(cat, "ru")).toBe("Cats");
  });
});