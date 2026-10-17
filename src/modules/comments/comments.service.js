import { ROLES } from '../../constants/roles.js';
import { Api } from '../../models/Api.js';
import { Comment } from '../../models/Comment.js';
import { ApiError } from '../../utils/ApiError.js';
import { pageMeta } from '../../utils/common.js';

const AUTHOR = ['author', 'name email'];

async function assertApiExists(projectId, apiId) {
  if (!(await Api.exists({ _id: apiId, project: projectId }))) throw ApiError.notFound('API không tồn tại');
}

async function findThread(projectId, apiId, commentId) {
  const thread = await Comment.findOne({ _id: commentId, api: apiId, project: projectId, parent: null });
  if (!thread) throw ApiError.notFound('Thread bình luận không tồn tại');
  return thread;
}

/** Danh sách thread (mới nhất trước) kèm replies theo thứ tự thời gian. */
export async function listThreads(projectId, apiId, { resolved, page, limit }) {
  await assertApiExists(projectId, apiId);
  const filter = { api: apiId, project: projectId, parent: null };
  if (resolved !== undefined) filter.resolved = resolved;

  const [threads, total] = await Promise.all([
    Comment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(...AUTHOR)
      .populate('resolvedBy', 'name email'),
    Comment.countDocuments(filter),
  ]);

  const replies = await Comment.find({ parent: { $in: threads.map((t) => t._id) } })
    .sort({ createdAt: 1 })
    .populate(...AUTHOR);
  const byParent = {};
  for (const r of replies) (byParent[r.parent] ??= []).push(r.toJSON());

  const items = threads.map((t) => ({ ...t.toJSON(), replies: byParent[t._id] ?? [] }));
  return { items, meta: pageMeta(page, limit, total) };
}

export async function createThread(projectId, apiId, userId, { content, anchor }) {
  await assertApiExists(projectId, apiId);
  const comment = await Comment.create({ project: projectId, api: apiId, author: userId, content, anchor });
  return comment.populate(...AUTHOR);
}

export async function reply(projectId, apiId, threadId, userId, { content }) {
  const thread = await findThread(projectId, apiId, threadId);
  const comment = await Comment.create({
    project: projectId, api: apiId, author: userId, content, parent: thread._id,
  });
  return comment.populate(...AUTHOR);
}

export async function setResolved(projectId, apiId, threadId, userId, resolved) {
  const thread = await findThread(projectId, apiId, threadId);
  thread.resolved = resolved;
  thread.resolvedBy = resolved ? userId : null;
  thread.resolvedAt = resolved ? new Date() : null;
  await thread.save();
  await thread.populate([{ path: 'author', select: 'name email' }, { path: 'resolvedBy', select: 'name email' }]);
  return thread;
}

/** Tác giả hoặc Manager được xoá. Xoá thread sẽ xoá luôn các reply. */
export async function deleteComment(projectId, apiId, commentId, user, role) {
  const comment = await Comment.findOne({ _id: commentId, api: apiId, project: projectId });
  if (!comment) throw ApiError.notFound('Bình luận không tồn tại');
  if (comment.author.toString() !== user.id && role !== ROLES.MANAGER) {
    throw ApiError.forbidden('Chỉ tác giả hoặc Manager mới được xoá bình luận');
  }
  if (!comment.parent) await Comment.deleteMany({ parent: comment._id });
  await comment.deleteOne();
}
