export type * from "./database";

// Common utility types
export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
