import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authRouter from '../modules/auth/auth.routes.js';
import projectsRouter from '../modules/projects/projects.routes.js';
import usersRouter from '../modules/users/users.routes.js';

const router = Router();

// Giới hạn chặt hơn cho đăng ký/đăng nhập để chống dò mật khẩu
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Thử lại sau ít phút' } },
});

router.use('/auth', authLimiter, authRouter);
router.use('/users', usersRouter);
router.use('/projects', projectsRouter);

export default router;
