import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';

// Hash giả để thời gian phản hồi khi email không tồn tại gần bằng khi sai mật khẩu
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

const signToken = (user) =>
  jwt.sign({ email: user.email }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: user._id.toString(),
    expiresIn: env.JWT_EXPIRES_IN,
  });

export async function register({ email, name, password }) {
  if (await User.exists({ email })) throw ApiError.conflict('Email đã được sử dụng');
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const user = await User.create({ email, name, passwordHash });
  return { user, accessToken: signToken(user) };
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw ApiError.unauthorized('Email hoặc mật khẩu không đúng');
  return { user, accessToken: signToken(user) };
}
