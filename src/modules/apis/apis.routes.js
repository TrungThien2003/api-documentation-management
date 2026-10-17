import { Router } from 'express';
import { z } from 'zod';
import { projectRoleGuard } from '../../middlewares/projectRoleGuard.js';
import { validate } from '../../middlewares/validate.js';
import { HTTP_METHODS } from '../../models/Api.js';
import { objectId, pagination } from '../../utils/common.js';
import commentsRouter from '../comments/comments.routes.js';
import revisionsRouter from '../revisions/revisions.routes.js';
import * as service from './apis.service.js';

const router = Router({ mergeParams: true }); // mount tại /projects/:projectId/apis

const apiParams = z.object({ apiId: objectId });

const listQuery = pagination.extend({
  q: z.string().trim().max(100).optional(),
  method: z.string().toUpperCase().pipe(z.enum(HTTP_METHODS)).optional(),
  tag: z.string().trim().max(100).optional(),
});

const importBody = z
  .object({
    spec: z.record(z.string(), z.any()).optional(), // OpenAPI dạng JSON object
    content: z.string().min(1).optional(), // hoặc chuỗi JSON/YAML
    commitMessage: z.string().trim().min(1).max(500).optional(),
  })
  .refine((b) => (b.spec !== undefined) !== (b.content !== undefined), {
    message: 'Truyền đúng một trong hai: "spec" (object) hoặc "content" (chuỗi JSON/YAML)',
  });

const updateBody = z.object({
  spec: z.object({ responses: z.record(z.string(), z.any()) }).passthrough(), // operation object
  commitMessage: z.string().trim().min(1, 'Cần commit message').max(500),
  baseVersion: z.number().int().positive().optional(), // version client đang xem (chống ghi đè)
});

// GET /projects/:projectId/apis?q=&method=&tag=&page=&limit=
router.get('/', projectRoleGuard('api:read'), validate({ query: listQuery }), async (req, res) => {
  const { items, meta } = await service.listApis(req.params.projectId, req.valid.query);
  res.json({ data: items, meta });
});

// POST /projects/:projectId/apis/import
router.post('/import', projectRoleGuard('api:write'), validate({ body: importBody }), async (req, res) => {
  res.status(201).json({ data: await service.importApis(req.params.projectId, req.user.id, req.valid.body) });
});

// GET /projects/:projectId/apis/:apiId
router.get('/:apiId', projectRoleGuard('api:read'), validate({ params: apiParams }), async (req, res) => {
  res.json({ data: await service.getApi(req.params.projectId, req.params.apiId) });
});

// PUT /projects/:projectId/apis/:apiId   (tự sinh revision)
router.put(
  '/:apiId',
  projectRoleGuard('api:write'),
  validate({ params: apiParams, body: updateBody }),
  async (req, res) => {
    const data = await service.updateApi(req.params.projectId, req.params.apiId, req.user.id, req.valid.body);
    res.json({ data });
  },
);

// DELETE /projects/:projectId/apis/:apiId
router.delete('/:apiId', projectRoleGuard('api:write'), validate({ params: apiParams }), async (req, res) => {
  await service.deleteApi(req.params.projectId, req.params.apiId);
  res.status(204).end();
});

router.use('/:apiId/revisions', validate({ params: apiParams }), revisionsRouter);
router.use('/:apiId/comments', validate({ params: apiParams }), commentsRouter);

export default router;
