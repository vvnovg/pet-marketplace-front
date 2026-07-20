import type { ApiProblemDetail } from "@/types/api";

export interface ApiViolation { field: string; message: string; }

export class ApiError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail: string,
    public violations: ApiViolation[] = [],
  ) {
    super(`${title}: ${detail}`);
    this.name = "ApiError";
  }
  static fromProblem(p: ApiProblemDetail, fallbackStatus: number): ApiError {
    return new ApiError(
      p.status ?? fallbackStatus,
      p.title ?? "Error",
      p.detail ?? "Request failed",
      p.violations ?? [],
    );
  }
}

export async function parseProblem(res: Response): Promise<never> {
  const text = await res.text();
  let detail = text;
  let body: ApiProblemDetail | null = null;
  try {
    body = text ? (JSON.parse(text) as ApiProblemDetail) : null;
    if (body) detail = body.detail ?? text;
  } catch {
    /* not JSON */
  }
  if (body) throw ApiError.fromProblem(body, res.status);
  throw new ApiError(res.status, "Error", detail || `HTTP ${res.status}`);
}