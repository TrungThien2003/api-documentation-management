import { isDeepStrictEqual } from 'node:util';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const esc = (k) => String(k).replace(/~/g, '~0').replace(/\//g, '~1'); // JSON Pointer (RFC 6901)

/**
 * So sánh 2 spec JSON, trả về danh sách thay đổi:
 *   { op: 'add' | 'remove' | 'replace', path: '/responses/404', before?, after? }
 * Mảng được so sánh theo chỉ số (index).
 */
export function diffSpec(before, after) {
  if (before == null) return [{ op: 'add', path: '', after }];
  const out = [];
  walk(before, after, '', out);
  return out;
}

function walk(a, b, path, out) {
  if (isDeepStrictEqual(a, b)) return;

  if (isObj(a) && isObj(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const p = `${path}/${esc(k)}`;
      const inA = Object.hasOwn(a, k);
      const inB = Object.hasOwn(b, k);
      if (!inA) out.push({ op: 'add', path: p, after: b[k] });
      else if (!inB) out.push({ op: 'remove', path: p, before: a[k] });
      else walk(a[k], b[k], p, out);
    }
    return;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      const p = `${path}/${i}`;
      if (i >= a.length) out.push({ op: 'add', path: p, after: b[i] });
      else if (i >= b.length) out.push({ op: 'remove', path: p, before: a[i] });
      else walk(a[i], b[i], p, out);
    }
    return;
  }

  out.push({ op: 'replace', path, before: a, after: b });
}
