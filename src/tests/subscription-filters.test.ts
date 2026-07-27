import { describe, it, expect } from "vitest";
import {
  describeSubscription, subscriptionToCatalogQuery, filtersToSubscriptionCreate, hasAnyFilter,
} from "@/lib/subscriptions/filters";
import type { SubscriptionFilters } from "@/types/api";

const empty: SubscriptionFilters = {
  categoryId: null, breedId: null, city: null, minPrice: null, maxPrice: null,
  gender: null, minAge: null, maxAge: null, hasVaccination: null, hasDocuments: null,
};

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(",")})` : key;
const deps = { t, genderLabel: (g: string) => `gender:${g}`, categoryName: null, breedName: null };

describe("describeSubscription", () => {
  it("returns an empty list when nothing is set", () => {
    expect(describeSubscription(empty, deps)).toEqual([]);
  });

  it("uses resolved category and breed names", () => {
    const f = { ...empty, categoryId: "c1", breedId: "b1" };
    expect(describeSubscription(f, { ...deps, categoryName: "Собаки", breedName: "Лабрадор" }))
      .toEqual(["Собаки", "Лабрадор"]);
  });

  it("falls back to a placeholder when a name is not resolved", () => {
    expect(describeSubscription({ ...empty, categoryId: "c1" }, deps)).toEqual(["unknownRef"]);
  });

  it("renders city, price range, age range, gender and flags", () => {
    const f: SubscriptionFilters = {
      ...empty, city: "Самара", minPrice: "100", maxPrice: "900",
      gender: "MALE", minAge: 2, maxAge: null, hasVaccination: true, hasDocuments: true,
    };
    expect(describeSubscription(f, deps)).toEqual([
      "filterCity(Самара)",
      "filterPrice(rangeBetween(100,900))",
      "gender:MALE",
      "filterAge(rangeFrom(2))",
      "filterVaccination",
      "filterDocuments",
    ]);
  });

  it("renders one-sided ranges", () => {
    expect(describeSubscription({ ...empty, maxPrice: "500" }, deps)).toEqual(["filterPrice(rangeTo(500))"]);
  });

  it("skips flags that are false", () => {
    expect(describeSubscription({ ...empty, hasVaccination: false }, deps)).toEqual([]);
  });
});

describe("subscriptionToCatalogQuery", () => {
  it("returns a bare catalog path when nothing is set", () => {
    expect(subscriptionToCatalogQuery(empty)).toBe("/catalog");
  });

  it("maps every catalog-supported filter", () => {
    const f: SubscriptionFilters = {
      ...empty, categoryId: "c1", breedId: "b1", city: "Самара",
      minPrice: "100", maxPrice: "900", gender: "FEMALE", minAge: 1, maxAge: 12,
      hasVaccination: true, hasDocuments: true,
    };
    const url = new URL(subscriptionToCatalogQuery(f), "http://t");
    expect(url.pathname).toBe("/catalog");
    expect(url.searchParams.get("categoryId")).toBe("c1");
    expect(url.searchParams.get("breedId")).toBe("b1");
    expect(url.searchParams.get("city")).toBe("Самара");
    expect(url.searchParams.get("minPrice")).toBe("100");
    expect(url.searchParams.get("maxPrice")).toBe("900");
    expect(url.searchParams.get("gender")).toBe("FEMALE");
    expect(url.searchParams.get("minAge")).toBe("1");
    expect(url.searchParams.get("maxAge")).toBe("12");
    // каталог не читает эти параметры — они намеренно не переносятся
    expect(url.searchParams.get("hasVaccination")).toBeNull();
    expect(url.searchParams.get("hasDocuments")).toBeNull();
  });
});

describe("filtersToSubscriptionCreate", () => {
  it("drops sorting and pagination", () => {
    const body = filtersToSubscriptionCreate({
      categoryId: "c1", city: "Самара", minPrice: 100,
      sortBy: "price", sortDirection: "ASC", page: 3, size: 12,
    });
    expect(body).toEqual({
      categoryId: "c1", breedId: null, city: "Самара", minPrice: 100, maxPrice: null,
      gender: null, minAge: null, maxAge: null, hasVaccination: null, hasDocuments: null,
    });
  });
});

describe("hasAnyFilter", () => {
  it("is false for an all-null body", () => {
    expect(hasAnyFilter(filtersToSubscriptionCreate({ sortBy: "price", page: 2, size: 12 }))).toBe(false);
  });
  it("is false when only a blank city is set", () => {
    expect(hasAnyFilter(filtersToSubscriptionCreate({ city: "" }))).toBe(false);
  });
  it("is true when at least one filter is set", () => {
    expect(hasAnyFilter(filtersToSubscriptionCreate({ minAge: 0 }))).toBe(true);
  });
});
