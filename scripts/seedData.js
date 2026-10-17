import 'dotenv/config';

export const SEED = {
  manager: {
    email: process.env.SEED_MANAGER_EMAIL ?? 'manager@example.com',
    name: 'Demo Manager',
    password: process.env.SEED_MANAGER_PASSWORD ?? 'Manager@123456',
  },
  developer: {
    email: process.env.SEED_DEVELOPER_EMAIL ?? 'developer@example.com',
    name: 'Demo Developer',
    password: process.env.SEED_DEVELOPER_PASSWORD ?? 'Developer@123456',
  },
  project: { name: 'Demo Project', description: 'Project mẫu do script seed tạo' },
  spec: {
    openapi: '3.0.3',
    info: { title: 'Petstore (demo)', version: '1.0.0' },
    servers: [{ url: 'https://petstore.example.com/v1' }],
    paths: {
      '/pets': {
        get: {
          summary: 'Liệt kê thú cưng',
          tags: ['pets'],
          parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100 } }],
          responses: {
            200: {
              description: 'Danh sách thú cưng',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Pet' } } } },
            },
          },
        },
        post: {
          summary: 'Tạo thú cưng',
          tags: ['pets'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/NewPet' } } },
          },
          responses: {
            201: { description: 'Đã tạo', content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } },
            400: { description: 'Dữ liệu sai', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/pets/{petId}': {
        parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'string' } }],
        get: {
          summary: 'Xem một thú cưng',
          tags: ['pets'],
          responses: {
            200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } },
            404: { description: 'Không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        put: {
          summary: 'Cập nhật thú cưng',
          tags: ['pets'],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/NewPet' } } } },
          responses: { 200: { description: 'OK' }, 404: { description: 'Không tìm thấy' } },
        },
        delete: {
          summary: 'Xoá thú cưng',
          tags: ['pets'],
          deprecated: true,
          responses: { 204: { description: 'Đã xoá' } },
        },
      },
    },
    components: {
      schemas: {
        NewPet: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, tag: { type: 'string' } } },
        Pet: {
          allOf: [{ $ref: '#/components/schemas/NewPet' }, { type: 'object', properties: { id: { type: 'string' } } }],
        },
        Error: { type: 'object', properties: { code: { type: 'integer' }, message: { type: 'string' } } },
      },
    },
  },
};
