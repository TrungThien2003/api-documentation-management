import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'ID không hợp lệ');
export const isObjectId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const pageMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
