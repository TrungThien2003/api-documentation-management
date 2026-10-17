// Seed tài khoản Manager + Developer và một project mẫu (idempotent: chạy lại nhiều lần vẫn an toàn).
//   npm run seed          tạo/cập nhật dữ liệu mẫu
//   npm run seed:reset    xoá dữ liệu mẫu
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { ROLES } from '../src/constants/roles.js';
import { Project } from '../src/models/Project.js';
import { ProjectMember } from '../src/models/ProjectMember.js';
import { User } from '../src/models/User.js';
import { importApis } from '../src/modules/apis/apis.service.js';
import { deleteProject } from '../src/modules/projects/projects.service.js';
import { SEED } from './seedData.js';

async function upsertUser({ email, name, password }) {
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  // Chạy lại seed sẽ đặt lại mật khẩu về giá trị mẫu
  return User.findOneAndUpdate(
    { email },
    { $set: { name, passwordHash } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function ensureMember(projectId, userId, role, invitedBy) {
  await ProjectMember.updateOne(
    { project: projectId, user: userId },
    { $set: { role, invitedBy } },
    { upsert: true },
  );
}

export async function seed() {
  const manager = await upsertUser(SEED.manager);
  const developer = await upsertUser(SEED.developer);

  let project = await Project.findOne({ name: SEED.project.name, createdBy: manager._id });
  if (!project) project = await Project.create({ ...SEED.project, createdBy: manager._id });

  await ensureMember(project._id, manager._id, ROLES.MANAGER, manager._id);
  await ensureMember(project._id, developer._id, ROLES.DEVELOPER, manager._id);

  const imported = await importApis(project._id.toString(), manager._id.toString(), {
    spec: SEED.spec,
    commitMessage: 'Seed: import Petstore demo',
  });

  return { manager, developer, project, imported };
}

export async function reset() {
  const emails = [SEED.manager.email, SEED.developer.email];
  const manager = await User.findOne({ email: SEED.manager.email });
  if (manager) {
    const projects = await Project.find({ name: SEED.project.name, createdBy: manager._id });
    for (const p of projects) await deleteProject(p._id.toString());
  }
  const users = await User.find({ email: { $in: emails } }).select('_id');
  await ProjectMember.deleteMany({ user: { $in: users.map((u) => u._id) } });
  await User.deleteMany({ email: { $in: emails } });
}

// Chỉ chạy khi gọi trực tiếp (import từ file khác thì không tự chạy)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    console.error('Từ chối chạy seed khi NODE_ENV=production (thêm --force nếu bạn chắc chắn).');
    process.exit(1);
  }
  await connectDB();
  try {
    if (process.argv.includes('--reset')) {
      await reset();
      console.log('Đã xoá tài khoản và project mẫu.');
    } else {
      const r = await seed();
      console.log('\nSeed xong:');
      console.log(`  Project : ${r.project.name} (${r.project._id})`);
      console.log(`  API     : tạo ${r.imported.created}, cập nhật ${r.imported.updated}, giữ nguyên ${r.imported.unchanged}`);
      console.log('\nTài khoản (chỉ dùng cho môi trường dev):');
      console.log(`  MANAGER   ${SEED.manager.email} / ${SEED.manager.password}`);
      console.log(`  DEVELOPER ${SEED.developer.email} / ${SEED.developer.password}`);
    }
  } catch (e) {
    console.error('Seed thất bại:', e);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}
