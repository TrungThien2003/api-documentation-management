import assert from 'node:assert/strict';
import test from 'node:test';
import { diffSpec } from '../src/utils/specDiff.js';

test('diff: add / remove / replace theo JSON Pointer', () => {
  const before = { summary: 'a', responses: { 200: { description: 'ok' } }, deprecated: true };
  const after = { summary: 'b', responses: { 200: { description: 'ok' }, 404: { description: 'nf' } } };
  assert.deepEqual(diffSpec(before, after), [
    { op: 'replace', path: '/summary', before: 'a', after: 'b' },
    { op: 'add', path: '/responses/404', after: { description: 'nf' } },
    { op: 'remove', path: '/deprecated', before: true },
  ]);
});

test('diff: mảng so theo chỉ số, key có "/" được escape', () => {
  const changes = diffSpec({ p: [{ n: 'x' }], 'a/b': 1 }, { p: [{ n: 'y' }, { n: 'z' }], 'a/b': 2 });
  assert.deepEqual(changes, [
    { op: 'replace', path: '/p/0/n', before: 'x', after: 'y' },
    { op: 'add', path: '/p/1', after: { n: 'z' } },
    { op: 'replace', path: '/a~1b', before: 1, after: 2 },
  ]);
});

test('diff: spec giống nhau => rỗng; before null => add toàn bộ', () => {
  assert.deepEqual(diffSpec({ a: { b: [1, 2] } }, { a: { b: [1, 2] } }), []);
  assert.deepEqual(diffSpec(null, { a: 1 }), [{ op: 'add', path: '', after: { a: 1 } }]);
});
