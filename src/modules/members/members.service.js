import { ROLES } from '../../constants/roles.js';
import { ProjectMember } from '../../models/ProjectMember.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';

const POPULATE_USER = ['user', 'email name'];

export const listMembers = (projectId) =>
  ProjectMember.find({ project: projectId })
    .populate(...POPULATE_USER)
    .sort({ createdAt: 1 });

/** Mời thành viên theo email (người dùng phải đã có tài khoản). */
export async function addMember(projectId, inviterId, { email, role }) {
  const user = await User.findOne({ email }).select('_id');
  if (!user) {
    throw ApiError.notFound('Không tìm thấy người dùng với email này (cần đăng ký tài khoản trước)');
  }
  if (await ProjectMember.exists({ project: projectId, user: user._id })) {
    throw ApiError.conflict('Người dùng đã là thành viên của project');
  }
  const member = await ProjectMember.create({
    project: projectId,
    user: user._id,
    role,
    invitedBy: inviterId,
  });
  return member.populate(...POPULATE_USER);
}

/** Project luôn phải còn ít nhất một MANAGER. */
async function assertAnotherManager(projectId, userId) {
  const others = await ProjectMember.countDocuments({
    project: projectId,
    role: ROLES.MANAGER,
    user: { $ne: userId },
  });
  if (others === 0) throw ApiError.badRequest('Project phải còn ít nhất một Manager');
}

export async function updateMemberRole(projectId, userId, role) {
  const member = await ProjectMember.findOne({ project: projectId, user: userId });
  if (!member) throw ApiError.notFound('Thành viên không tồn tại trong project');
  if (member.role === ROLES.MANAGER && role !== ROLES.MANAGER) {
    await assertAnotherManager(projectId, userId);
  }
  member.role = role;
  await member.save();
  return member.populate(...POPULATE_USER);
}

export async function removeMember(projectId, userId) {
  const member = await ProjectMember.findOne({ project: projectId, user: userId });
  if (!member) throw ApiError.notFound('Thành viên không tồn tại trong project');
  if (member.role === ROLES.MANAGER) await assertAnotherManager(projectId, userId);
  await member.deleteOne();
}
