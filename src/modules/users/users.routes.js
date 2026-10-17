import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { listMyProjects } from '../projects/projects.service.js';

const router = Router();
router.use(authenticate);

// GET /users/me
router.get('/me', (req, res) => res.json({ data: req.user }));

// GET /users/me/projects  - danh sách project của bản thân kèm role
router.get('/me/projects', async (req, res) => {
  res.json({ data: await listMyProjects(req.user.id) });
});

export default router;
