import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import * as service from './auth.service.js';

const router = Router();

const email = z.string().trim().email().max(254).toLowerCase();
const registerBody = z.object({
  email,
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(72), // bcrypt chỉ dùng 72 byte đầu
});
const loginBody = z.object({ email, password: z.string().min(1).max(72) });

// POST /auth/register
router.post('/register', validate({ body: registerBody }), async (req, res) => {
  res.status(201).json({ data: await service.register(req.valid.body) });
});

// POST /auth/login
router.post('/login', validate({ body: loginBody }), async (req, res) => {
  res.json({ data: await service.login(req.valid.body) });
});

export default router;
