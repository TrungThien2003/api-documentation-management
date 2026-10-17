import { Router } from 'express';
import { z } from 'zod';
import { projectRoleGuard } from '../../middlewares/projectRoleGuard.js';
import { validate } from '../../middlewares/validate.js';
import { objectId, pagination } from '../../utils/common.js';
import * as service from './comments.service.js';

const router = Router({ mergeParams: true }); // mount tại /projects/:projectId/apis/:apiId/comments

const commentParams = z.object({ commentId: objectId });
const listQuery = pagination.extend({
  resolved: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
const threadBody = z.object({
  content: z.string().trim().min(1).max(5000),
  anchor: z.string().trim().max(200).optional(),
});
const replyBody = z.object({ content: z.string().trim().min(1).max(5000) });
const resolveBody = z.object({ resolved: z.boolean() });

// GET .../comments?resolved=true|false&page=&limit=
router.get('/', projectRoleGuard('comment:read'), validate({ query: listQuery }), async (req, res) => {
  const { items, meta } = await service.listThreads(req.params.projectId, req.params.apiId, req.valid.query);
  res.json({ data: items, meta });
});

// POST .../comments   (tạo thread - Developer)
router.post('/', projectRoleGuard('comment:create'), validate({ body: threadBody }), async (req, res) => {
  const data = await service.createThread(req.params.projectId, req.params.apiId, req.user.id, req.valid.body);
  res.status(201).json({ data });
});

// POST .../comments/:commentId/replies   (Manager & Developer)
router.post(
  '/:commentId/replies',
  projectRoleGuard('comment:reply'),
  validate({ params: commentParams, body: replyBody }),
  async (req, res) => {
    const { projectId, apiId, commentId } = req.params;
    res.status(201).json({ data: await service.reply(projectId, apiId, commentId, req.user.id, req.valid.body) });
  },
);

// PATCH .../comments/:commentId/resolve   { resolved: true|false }   (Manager)
router.patch(
  '/:commentId/resolve',
  projectRoleGuard('comment:resolve'),
  validate({ params: commentParams, body: resolveBody }),
  async (req, res) => {
    const { projectId, apiId, commentId } = req.params;
    res.json({ data: await service.setResolved(projectId, apiId, commentId, req.user.id, req.valid.body.resolved) });
  },
);

// DELETE .../comments/:commentId   (tác giả hoặc Manager)
router.delete(
  '/:commentId',
  projectRoleGuard('comment:delete'),
  validate({ params: commentParams }),
  async (req, res) => {
    const { projectId, apiId, commentId } = req.params;
    await service.deleteComment(projectId, apiId, commentId, req.user, req.membership.role);
    res.status(204).end();
  },
);

export default router;
