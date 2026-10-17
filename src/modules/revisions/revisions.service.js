import { isDeepStrictEqual } from 'node:util';
import { Api } from '../../models/Api.js';
import { ApiRevision } from '../../models/ApiRevision.js';
import { ApiError } from '../../utils/ApiError.js';
import { pageMeta } from '../../utils/common.js';
import { diffSpec } from '../../utils/specDiff.js';
import { withTransaction } from '../../utils/transaction.js';
import { applySpecChange, findApiOrThrow } from '../apis/apis.service.js';

const POPULATE_USER = ['changedBy', 'name email'];

async function assertApiExists(projectId, apiId) {
  if (!(await Api.exists({ _id: apiId, project: projectId }))) throw ApiError.notFound('API không tồn tại');
}

/** Dữ liệu cho Timeline: không kèm spec để nhẹ (xem chi tiết/diff ở endpoint riêng). */
export async function listRevisions(projectId, apiId, { page, limit }) {
  await assertApiExists(projectId, apiId);
  const filter = { api: apiId };
  const [items, total] = await Promise.all([
    ApiRevision.find(filter)
      .select('-previousSpec -newSpec')
      .populate(...POPULATE_USER)
      .sort({ version: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    ApiRevision.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(page, limit, total) };
}

/** Một revision kèm diff giữa spec trước và sau thay đổi đó. */
export async function getRevision(projectId, apiId, revisionId) {
  await assertApiExists(projectId, apiId);
  const rev = await ApiRevision.findOne({ _id: revisionId, api: apiId }).populate(...POPULATE_USER);
  if (!rev) throw ApiError.notFound('Revision không tồn tại');
  return { ...rev.toJSON(), diff: diffSpec(rev.previousSpec, rev.newSpec) };
}

/** So sánh trạng thái spec giữa hai phiên bản bất kỳ (from -> to). */
export async function compareRevisions(projectId, apiId, { from, to }) {
  await assertApiExists(projectId, apiId);
  const revs = await ApiRevision.find({ api: apiId, version: { $in: [from, to] } });
  const a = revs.find((r) => r.version === from);
  const b = revs.find((r) => r.version === to);
  if (!a || !b) throw ApiError.notFound('Không tìm thấy một trong hai phiên bản cần so sánh');
  return {
    from: { version: a.version, createdAt: a.createdAt, commitMessage: a.commitMessage },
    to: { version: b.version, createdAt: b.createdAt, commitMessage: b.commitMessage },
    changes: diffSpec(a.newSpec, b.newSpec),
  };
}

/**
 * Khôi phục API về trạng thái SAU revision đã chọn.
 * Không xoá lịch sử: tạo thêm một revision mới (action = RESTORE).
 */
export function restoreRevision(projectId, apiId, revisionId, userId, commitMessage) {
  return withTransaction(async (session) => {
    const api = await findApiOrThrow(projectId, apiId, session);
    const rev = await ApiRevision.findOne({ _id: revisionId, api: apiId }).session(session);
    if (!rev) throw ApiError.notFound('Revision không tồn tại');
    if (isDeepStrictEqual(api.spec, rev.newSpec)) {
      throw ApiError.badRequest('API hiện tại đã giống phiên bản này');
    }
    return applySpecChange(session, {
      api,
      newSpec: rev.newSpec,
      userId,
      action: 'RESTORE',
      commitMessage: commitMessage ?? `Khôi phục về phiên bản v${rev.version}`,
      restoredFromVersion: rev.version,
    });
  });
}
