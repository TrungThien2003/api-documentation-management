import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

export async function authenticate(req, _res, next) {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized('Thiếu access token');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw ApiError.unauthorized('Token không hợp lệ hoặc đã hết hạn');
  }

  const user = await User.findById(payload.sub).select('email name').lean();
  if (!user) throw ApiError.unauthorized('Tài khoản không còn tồn tại');

  req.user = { id: user._id.toString(), email: user.email, name: user.name };
  next();
}
