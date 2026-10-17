import { Api } from '../../models/Api.js';
import { ApiRevision } from '../../models/ApiRevision.js';
import { Comment } from '../../models/Comment.js';
import { Project } from '../../models/Project.js';
import { ProjectMember } from '../../models/ProjectMember.js';
import { ROLES } from '../../constants/roles.js';
import { ApiError } from '../../utils/ApiError.js';
import { withTransaction } from '../../utils/transaction.js';

/** Người tạo project tự động trở thành MANAGER (một transaction). */
export async function createProject(userId, { name, description }) {
  const project = await withTransaction(async (session) => {
    const [created] = await Project.create([{ name, description, createdBy: userId }], { session });
    await ProjectMember.create(
      [{ project: created._id, user: userId, role: ROLES.MANAGER, invitedBy: userId }],
      { session },
    );
    return created;
  });
  return { ...project.toJSON(), role: ROLES.MANAGER };
}

export async function listMyProjects(userId) {
  const memberships = await ProjectMember.find({ user: userId })
    .populate('project')
    .sort({ createdAt: -1 });
  return memberships
    .filter((m) => m.project)
    .map((m) => ({ ...m.project.toJSON(), role: m.role, joinedAt: m.createdAt }));
}

export async function getProject(projectId, role) {
  const project = await Project.findById(projectId);
  if (!project) throw ApiError.notFound('Project không tồn tại');
  return { ...project.toJSON(), role };
}

export async function updateProject(projectId, changes) {
  const project = await Project.findByIdAndUpdate(
    projectId,
    { $set: changes },
    { new: true, runValidators: true },
  );
  if (!project) throw ApiError.notFound('Project không tồn tại');
  return project;
}

/** Xoá project kèm toàn bộ dữ liệu liên quan. */
export async function deleteProject(projectId) {
  await withTransaction(async (session) => {
    await Comment.deleteMany({ project: projectId }, { session });
    await ApiRevision.deleteMany({ project: projectId }, { session });
    await Api.deleteMany({ project: projectId }, { session });
    await ProjectMember.deleteMany({ project: projectId }, { session });
    const res = await Project.deleteOne({ _id: projectId }, { session });
    if (!res.deletedCount) throw ApiError.notFound('Project không tồn tại');
  });
}
