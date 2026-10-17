import { PERMISSIONS, can } from '../constants/permissions.js';
import { ProjectMember } from '../models/ProjectMember.js';
import { ApiError } from '../utils/ApiError.js';
import { isObjectId } from '../utils/common.js';

/**
 * ProjectRoleGuard: kiểm tra user hiện tại có thuộc project (req.params.projectId) không
 * và role của họ có permission yêu cầu không (xem constants/permissions.js).
 *  - Không phải thành viên  -> 404 (không tiết lộ project có tồn tại hay không)
 *  - Là thành viên nhưng thiếu quyền -> 403
 * Thành công: gán req.membership = { projectId, role }.
 */
export function projectRoleGuard(permission) {
  if (!PERMISSIONS[permission]) throw new Error(`Permission không tồn tại: ${permission}`);

  return async (req, _res, next) => {
    const { projectId } = req.params;
    if (!isObjectId(projectId)) throw ApiError.notFound('Project không tồn tại');

    const membership = await ProjectMember.findOne({ project: projectId, user: req.user.id })
      .select('role')
      .lean();
    if (!membership) throw ApiError.notFound('Project không tồn tại hoặc bạn không phải thành viên');

    if (!can(membership.role, permission)) {
      throw ApiError.forbidden(`Vai trò ${membership.role} không có quyền thực hiện thao tác này`);
    }

    req.membership = { projectId, role: membership.role };
    next();
  };
}
