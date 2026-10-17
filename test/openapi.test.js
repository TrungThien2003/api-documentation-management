import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOpenApi } from '../src/utils/openapi.js';

const YAML_DOC = `
openapi: 3.0.3
info: { title: Demo, version: '1.0' }
servers: [{ url: 'https://api.example.com' }]
paths:
  /users/{id}:
    parameters:
      - { name: id, in: path, required: true, schema: { type: string } }
    get:
      summary: Get user
      tags: [users]
      responses:
        '200':
          description: ok
          content:
            application/json:
              schema: { $ref: '#/components/schemas/User' }
    delete:
      responses: { '204': { description: gone } }
components:
  schemas:
    User:
      type: object
      properties: { id: { type: string } }
`;

test('import: tách operation, gộp param cấp path, dereference $ref, kế thừa servers', async () => {
  const { info, operations } = await parseOpenApi({ content: YAML_DOC });
  assert.equal(info.title, 'Demo');
  assert.equal(operations.length, 2);
  const get = operations.find((o) => o.method === 'GET');
  assert.equal(get.endpoint, '/users/{id}');
  assert.equal(get.spec.parameters[0].name, 'id');
  assert.equal(get.spec.servers[0].url, 'https://api.example.com');
  assert.equal(get.spec.responses['200'].content['application/json'].schema.properties.id.type, 'string');
});

test('import: Swagger 2.0 và OpenAPI 3.1', async () => {
  const v2 = await parseOpenApi({
    spec: {
      swagger: '2.0', info: { title: 'v2', version: '1' }, host: 'h.example.com', basePath: '/v1', schemes: ['https'],
      paths: { '/ping': { get: { responses: { 200: { description: 'ok' } } } } },
    },
  });
  assert.equal(v2.operations[0].spec.servers[0].url, 'https://h.example.com/v1');

  const v31 = await parseOpenApi({
    spec: {
      openapi: '3.1.0', info: { title: 'v31', version: '1' },
      paths: { '/ping': { post: { responses: { 200: { description: 'ok' } } } } },
    },
  });
  assert.equal(v31.operations[0].method, 'POST');
});

test('import: từ chối tài liệu không hợp lệ', async () => {
  await assert.rejects(parseOpenApi({ content: 'foo: bar' }), /openapi/);
  await assert.rejects(
    parseOpenApi({ spec: { openapi: '3.0.0', info: { title: 'x' }, paths: {} } }),
    /không hợp lệ/,
  );
});
