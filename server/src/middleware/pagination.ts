import type { Request } from "express";

export interface PaginationParams {
  take: number;
  skip: number;
}

export function parsePagination(req: Request, defaultLimit = 50, maxLimit = 200): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit as string, 10) || defaultLimit));
  return { take: limit, skip: (page - 1) * limit };
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
