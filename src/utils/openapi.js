import SwaggerParser from '@apidevtools/swagger-parser';
import YAML from 'yaml';
import { ApiError } from './ApiError.js';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
export const MAX_OPERATIONS = 1000;

const toPlain = (v) => JSON.parse(JSON.stringify(v)); // bỏ undefined, đảm bảo JSON thuần để lưu Mongo

/** Các trường denormalize để hiển thị danh sách API mà không cần tải cả spec. */
export function extractMeta(spec) {
  return {
    summary: String(spec.summary ?? spec.description ?? '').slice(0, 500),
    tags: Array.isArray(spec.tags) ? spec.tags.filter((t) => typeof t === 'string').slice(0, 20) : [],
    deprecated: spec.deprecated === true,
  };
}

function mergeParameters(pathParams = [], opParams = []) {
  const map = new Map(); // parameter cấp operation ghi đè cấp path (cùng name + in)
  for (const p of [...pathParams, ...opParams]) map.set(p.$ref ?? `${p.in}:${p.name}`, p);
  return [...map.values()];
}

function swagger2Servers(doc) {
  if (!doc.host) return undefined;
  return [{ url: `${doc.schemes?.[0] ?? 'https'}://${doc.host}${doc.basePath ?? ''}` }];
}

/**
 * Nhận OpenAPI 3.x / Swagger 2.0 (object hoặc chuỗi JSON/YAML), validate rồi tách thành
 * từng operation (method + endpoint). Mỗi operation là một spec độc lập: $ref đã được
 * dereference, parameters cấp path đã gộp, servers/security đã kế thừa từ gốc.
 */
export async function parseOpenApi({ spec, content }) {
  let doc = spec;
  if (doc === undefined) {
    try {
      doc = YAML.parse(content); // YAML là superset của JSON
    } catch (e) {
      throw ApiError.badRequest(`Không đọc được nội dung JSON/YAML: ${e.message}`);
    }
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw ApiError.badRequest('OpenAPI spec phải là một object');
  }
  if (!doc.openapi && !doc.swagger) {
    throw ApiError.badRequest('Thiếu trường "openapi" hoặc "swagger" ở gốc tài liệu');
  }

  let deref;
  try {
    // external:false => không tải $ref từ file/URL ngoài (tránh SSRF/đọc file server)
    deref = await SwaggerParser.validate(structuredClone(doc), {
      resolve: { external: false },
      dereference: { circular: 'ignore' },
    });
  } catch (e) {
    throw ApiError.badRequest(`OpenAPI spec không hợp lệ: ${e.message}`);
  }

  const isV2 = Boolean(deref.swagger);
  const operations = [];

  for (const [endpoint, item] of Object.entries(deref.paths ?? {})) {
    if (!item || typeof item !== 'object') continue;
    for (const m of HTTP_METHODS) {
      const op = item[m];
      if (!op || typeof op !== 'object') continue;

      const spec = {
        ...op,
        parameters: mergeParameters(item.parameters, op.parameters),
        servers: op.servers ?? item.servers ?? (isV2 ? swagger2Servers(deref) : deref.servers),
        security: op.security ?? deref.security,
      };
      if (isV2) {
        spec.consumes = op.consumes ?? deref.consumes;
        spec.produces = op.produces ?? deref.produces;
      }

      operations.push({ method: m.toUpperCase(), endpoint, spec: toPlain(spec) });
      if (operations.length > MAX_OPERATIONS) {
        throw ApiError.badRequest(`Mỗi lần import tối đa ${MAX_OPERATIONS} operation`);
      }
    }
  }

  return {
    info: { title: deref.info?.title ?? '', version: deref.info?.version ?? '' },
    operations,
  };
}
