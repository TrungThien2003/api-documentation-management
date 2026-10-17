import mongoose from 'mongoose';

/**
 * Chạy fn(session) trong một MongoDB transaction (cần replica set - Atlas có sẵn).
 * Mongoose tự commit/abort và retry khi gặp lỗi tạm thời.
 * LƯU Ý: mọi query bên trong phải truyền { session } / .session(session),
 * và không chạy song song (Promise.all) các thao tác trên cùng một session.
 */
export const withTransaction = (fn) => mongoose.connection.transaction(fn);
