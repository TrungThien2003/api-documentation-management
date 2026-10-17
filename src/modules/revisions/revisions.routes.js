import { Router } from 'express';
import { z } from 'zod';
import { projectRoleGuard } from '../../middlewares/projectRoleGuard.js';
import { validate } from '../../middlewares/validate.js';
import { objectId, pagination } from '../../utils/common.js';
import * as service from './revisions.service.js';

const router = Router({ mergeParams: true }); // mount tại /projects/:projectId/apis/:apiId/revisions

const revisionParams = z.object({ revisionId: objectId });
const compareQuery = z.object({
  from: z.coerce.number().int().positive(),
  to: z.coerce.number().int().positive(),
});
const restoreBody = z.object({ commitMessage: z.string().trim().min(1).max(500).optional() });

// GET .../revisions?page=&limit=   (Timeline, mới nhất trước)
router.get('/', projectRoleGuard('revision:read'), validate({ query: pagination }), async (req, res) => {
  const { items, meta } = await service.listRevisions(req.params.projectId, req.params.apiId, req.valid.query);
  res.json({ data: items, meta });
});

// GET .../revisions/compare?from=2&to=5   (phải đặt trước /:revisionId)
router.get('/compare', projectRoleGuard('revision:read'), validate({ query: compareQuery }), async (req, res) => {
  res.json({ data: await service.compareRevisions(req.params.projectId, req.params.apiId, req.valid.query) });
});

// GET .../revisions/:revisionId   (kèm diff với bản trước)
router.get('/:revisionId', projectRoleGuard('revision:read'), validate({ params: revisionParams }), async (req, res) => {
  const { projectId, apiId, revisionId } = req.params;
  res.json({ data: await service.getRevision(projectId, apiId, revisionId) });
});

// POST .../revisions/:revisionId/restore   (chỉ Manager)
router.post(
  '/:revisionId/restore',
  projectRoleGuard('revision:restore'),
  validate({ params: revisionParams, body: restoreBody }),
  async (req, res) => {
    const { projectId, apiId, revisionId } = req.params;
    const data = await service.restoreRevision(projectId, apiId, revisionId, req.user.id, req.valid.body.commitMessage);
    res.json({ data });
  },
);

export default router;
