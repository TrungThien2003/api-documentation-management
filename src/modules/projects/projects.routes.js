import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate.js';
import { projectRoleGuard } from '../../middlewares/projectRoleGuard.js';
import { validate } from '../../middlewares/validate.js';
import apisRouter from '../apis/apis.routes.js';
import membersRouter from '../members/members.routes.js';
import * as service from './projects.service.js';

const router = Router();
router.use(authenticate);

const createBody = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(''),
});
const updateBody = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(1000).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Cần ít nhất một trường để cập nhật' });

// POST /projects  (người tạo thành MANAGER của project)
router.post('/', validate({ body: createBody }), async (req, res) => {
  res.status(201).json({ data: await service.createProject(req.user.id, req.valid.body) });
});

// GET /projects/:projectId
router.get('/:projectId', projectRoleGuard('project:read'), async (req, res) => {
  res.json({ data: await service.getProject(req.params.projectId, req.membership.role) });
});

// PATCH /projects/:projectId
router.patch(
  '/:projectId',
  projectRoleGuard('project:manage'),
  validate({ body: updateBody }),
  async (req, res) => {
    res.json({ data: await service.updateProject(req.params.projectId, req.valid.body) });
  },
);

// DELETE /projects/:projectId
router.delete('/:projectId', projectRoleGuard('project:manage'), async (req, res) => {
  await service.deleteProject(req.params.projectId);
  res.status(204).end();
});

router.use('/:projectId/members', membersRouter);
router.use('/:projectId/apis', apisRouter);

export default router;
