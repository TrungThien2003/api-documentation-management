import { Router } from 'express';
import { z } from 'zod';
import { ROLE_VALUES } from '../../constants/roles.js';
import { projectRoleGuard } from '../../middlewares/projectRoleGuard.js';
import { validate } from '../../middlewares/validate.js';
import { objectId } from '../../utils/common.js';
import * as service from './members.service.js';

const router = Router({ mergeParams: true }); // mount tại /projects/:projectId/members

const addBody = z.object({
  email: z.string().trim().email().toLowerCase(),
  role: z.enum(ROLE_VALUES).default('DEVELOPER'),
});
const roleBody = z.object({ role: z.enum(ROLE_VALUES) });
const memberParams = z.object({ userId: objectId });

// GET /projects/:projectId/members
router.get('/', projectRoleGuard('member:manage'), async (req, res) => {
  res.json({ data: await service.listMembers(req.params.projectId) });
});

// POST /projects/:projectId/members   { email, role }
router.post('/', projectRoleGuard('member:manage'), validate({ body: addBody }), async (req, res) => {
  const data = await service.addMember(req.params.projectId, req.user.id, req.valid.body);
  res.status(201).json({ data });
});

// PATCH /projects/:projectId/members/:userId   { role }
router.patch(
  '/:userId',
  projectRoleGuard('member:manage'),
  validate({ params: memberParams, body: roleBody }),
  async (req, res) => {
    const data = await service.updateMemberRole(req.params.projectId, req.params.userId, req.valid.body.role);
    res.json({ data });
  },
);

// DELETE /projects/:projectId/members/:userId
router.delete(
  '/:userId',
  projectRoleGuard('member:manage'),
  validate({ params: memberParams }),
  async (req, res) => {
    await service.removeMember(req.params.projectId, req.params.userId);
    res.status(204).end();
  },
);

export default router;
