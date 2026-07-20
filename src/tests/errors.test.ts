import { describe, it, expect } from "vitest";
import { ApiError, parseProblem } from "@/lib/api/errors";

describe("parseProblem", () => {
  it("parses RFC 9457 problem+json with violations", async () => {
    const res = new Response(JSON.stringify({
      status: 400, title: "Bad Request", detail: "validation failed",
      violations: [{ field: "email", message: "must be valid" }],
    }), { status: 400, headers: { "content-type": "application/problem+json" } });
    await expect(parseProblem(res)).rejects.toMatchObject({
      status: 400, title: "Bad Request", detail: "validation failed",
      violations: [{ field: "email", message: "must be valid" }],
    });
  });

  it("produces ApiError instance", async () => {
    const res = new Response("{}", { status: 500 });
    await expect(parseProblem(res)).rejects.toBeInstanceOf(ApiError);
  });

  it("falls back when body is not JSON", async () => {
    const res = new Response("boom", { status: 502 });
    await expect(parseProblem(res)).rejects.toMatchObject({ status: 502, detail: "boom" });
  });
});