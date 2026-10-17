export class ApiError extends Error {
  constructor(status, message, code = 'ERROR', details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
  static badRequest(msg, details) { return new ApiError(400, msg, 'BAD_REQUEST', details); }
  static unauthorized(msg = 'Chưa xác thực') { return new ApiError(401, msg, 'UNAUTHORIZED'); }
  static forbidden(msg = 'Bạn không có quyền thực hiện thao tác này') { return new ApiError(403, msg, 'FORBIDDEN'); }
  static notFound(msg = 'Không tìm thấy dữ liệu') { return new ApiError(404, msg, 'NOT_FOUND'); }
  static conflict(msg, details) { return new ApiError(409, msg, 'CONFLICT', details); }
}
