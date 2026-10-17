import { ROLES } from './roles.js';

const { MANAGER, DEVELOPER } = ROLES;
const BOTH = [MANAGER, DEVELOPER];

/**
 * Ma trận phân quyền (Project-level RBAC) - khớp với bảng trong kế hoạch.
 * Muốn đổi quyền chỉ cần sửa tại đây, các route chỉ tham chiếu theo tên permission.
 */
export const PERMISSIONS = Object.freeze({
  'project:read': BOTH,
  'project:manage': [MANAGER],

  'member:manage': [MANAGER],

  'api:read': BOTH, // tra cứu & thử nghiệm API
  'api:write': [MANAGER], // import / edit / delete

  'revision:read': BOTH, // xem lịch sử thay đổi + diff
  'revision:restore': [MANAGER],

  'comment:read': BOTH,
  'comment:create': [DEVELOPER], // theo ma trận: Developer tạo comment
  'comment:reply': BOTH,
  'comment:resolve': [MANAGER],
  'comment:delete': BOTH, // service kiểm tra thêm: chỉ tác giả hoặc Manager
});

export const can = (role, permission) => PERMISSIONS[permission]?.includes(role) ?? false;
