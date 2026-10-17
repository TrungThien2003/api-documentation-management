import { isDeepStrictEqual } from 'node:util';
import mongoose from 'mongoose';
import { Api } from '../../models/Api.js';
import { ApiRevision } from '../../models/ApiRevision.js';
import { Comment } from '../../models/Comment.js';
import { ApiError } from '../../utils/ApiError.js';
import { escapeRegex, pageMeta } from '../../utils/common.js';
import { extractMeta, parseOpenApi } from '../../utils/openapi.js';
import { withTransaction } from '../../utils/transaction.js';

const CONFLICT_MSG = 'API vừa được người khác chỉnh sửa, hãy tải lại rồi thử lại';

export async function listApis(projectId, { q, method, tag, page, limit }) {
  const filter = { project: projectId };
  if (method) filter.method = method;
  if (tag) filter.tags = tag;
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ endpoint: re }, { summary: re }];
  }
  const [items, total] = await Promise.all([
    Api.find(filter)
      .select('-spec') // danh sách không cần tải toàn bộ spec
      .sort({ endpoint: 1, method: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Api.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(page, limit, total) };
}

export async function findApiOrThrow(projectId, apiId, session = null) {
  const api = await Api.findOne({ _id: apiId, project: projectId }).session(session);
  if (!api) throw ApiError.notFound('API không tồn tại');
  return api;
}

export const getApi = (projectId, apiId) => findApiOrThrow(projectId, apiId);

/**
 * Điểm ghi thay đổi duy nhất: cập nhật Api + ghi ApiRevision.
 * Phải gọi trong transaction. Dùng optimistic locking theo `version`.
 */
export async function applySpecChange(
  session,
  { api, newSpec, userId, action, commitMessage, restoredFromVersion },
) {
  const updated = await Api.findOneAndUpdate(
    { _id: api._id, version: api.version },
    { $set: { spec: newSpec, ...extractMeta(newSpec), updatedBy: userId }, $inc: { version: 1 } },
    { new: true, session },
  );
  if (!updated) throw ApiError.conflict(CONFLICT_MSG);

  await ApiRevision.create(
    [
      {
        api: api._id,
        project: api.project,
        version: updated.version,
        action,
        changedBy: userId,
        previousSpec: api.spec,
        newSpec,
        commitMessage,
        restoredFromVersion,
      },
    ],
    { session },
  );
  return updated;
}

/** Manager sửa API: lấy spec cũ -> cập nhật spec mới -> lưu revision (cùng transaction). */
export function updateApi(projectId, apiId, userId, { spec, commitMessage, baseVersion }) {
  return withTransaction(async (session) => {
    const api = await findApiOrThrow(projectId, apiId, session);
    if (baseVersion !== undefined && baseVersion !== api.version) {
      throw ApiError.conflict(CONFLICT_MSG, { currentVersion: api.version });
    }
    if (isDeepStrictEqual(api.spec, spec)) {
      throw ApiError.badRequest('Nội dung spec không thay đổi so với phiên bản hiện tại');
    }
    return applySpecChange(session, { api, newSpec: spec, userId, action: 'UPDATE', commitMessage });
  });
}

export function deleteApi(projectId, apiId) {
  return withTransaction(async (session) => {
    const res = await Api.deleteOne({ _id: apiId, project: projectId }, { session });
    if (!res.deletedCount) throw ApiError.notFound('API không tồn tại');
    await ApiRevision.deleteMany({ api: apiId }, { session });
    await Comment.deleteMany({ api: apiId }, { session });
  });
}

/**
 * Import OpenAPI: mỗi operation (method + endpoint) là một Api.
 *  - chưa có      -> tạo mới (version 1) + revision
 *  - đã có, khác  -> cập nhật + revision
 *  - đã có, giống -> bỏ qua
 * Toàn bộ chạy trong một transaction (hoặc thành công hết, hoặc không gì thay đổi).
 */
export async function importApis(projectId, userId, { spec, content, commitMessage }) {
  const { info, operations } = await parseOpenApi({ spec, content });
  if (operations.length === 0) throw ApiError.badRequest('Không tìm thấy operation nào trong tài liệu');

  const message = commitMessage ?? `Import OpenAPI: ${info.title || 'untitled'} ${info.version}`.trim();
  const projectOid = new mongoose.Types.ObjectId(projectId);

  return withTransaction(async (session) => {
    const existing = await Api.find({ project: projectId })
      .select('method endpoint spec version')
      .session(session)
      .lean();
    const byKey = new Map(existing.map((a) => [`${a.method} ${a.endpoint}`, a]));

    const creates = [];
    const updates = [];
    const revisions = [];
    const summary = { created: 0, updated: 0, unchanged: 0 };

    for (const op of operations) {
      const found = byKey.get(`${op.method} ${op.endpoint}`);
      const meta = extractMeta(op.spec);

      if (!found) {
        const _id = new mongoose.Types.ObjectId();
        creates.push({
          _id, project: projectOid, method: op.method, endpoint: op.endpoint, spec: op.spec,
          ...meta, version: 1, createdBy: userId, updatedBy: userId,
        });
        revisions.push({
          api: _id, project: projectOid, version: 1, action: 'IMPORT', changedBy: userId,
          previousSpec: null, newSpec: op.spec, commitMessage: message,
        });
        summary.created++;
      } else if (isDeepStrictEqual(found.spec, op.spec)) {
        summary.unchanged++;
      } else {
        updates.push({
          updateOne: {
            filter: { _id: found._id, version: found.version },
            update: { $set: { spec: op.spec, ...meta, updatedBy: userId }, $inc: { version: 1 } },
          },
        });
        revisions.push({
          api: found._id, project: projectOid, version: found.version + 1, action: 'IMPORT',
          changedBy: userId, previousSpec: found.spec, newSpec: op.spec, commitMessage: message,
        });
        summary.updated++;
      }
    }

    if (creates.length) await Api.insertMany(creates, { session });
    if (updates.length) {
      const res = await Api.bulkWrite(updates, { session });
      if (res.modifiedCount !== updates.length) throw ApiError.conflict(CONFLICT_MSG);
    }
    if (revisions.length) await ApiRevision.insertMany(revisions, { session });

    return { source: info, total: operations.length, ...summary };
  });
}
