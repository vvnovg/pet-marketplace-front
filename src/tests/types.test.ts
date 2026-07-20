import { describe, it, expectTypeOf } from "vitest";
import type { Page, Listing, TokenResponse } from "@/types/api";

describe("types", () => {
  it("Page<Listing> has content array of Listing", () => {
    const p = {} as Page<Listing>;
    expectTypeOf(p.content).toEqualTypeOf<Listing[]>();
  });
  it("TokenResponse has number expiresIn", () => {
    const t = {} as TokenResponse;
    expectTypeOf(t.expiresIn).toEqualTypeOf<number>();
  });
});