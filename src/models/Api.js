import mongoose from 'mongoose';
import { cleanJSON } from './plugins.js';

const { ObjectId, Mixed } = mongoose.Schema.Types;

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'];

const apiSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: true },
    method: { type: String, enum: HTTP_METHODS, required: true },
    endpoint: { type: String, required: true, trim: true, maxlength: 500 },

    // Các trường denormalize từ spec để liệt kê/tìm kiếm nhanh
    summary: { type: String, default: '', maxlength: 500 },
    tags: { type: [String], default: [] },
    deprecated: { type: Boolean, default: false },

    spec: { type: Mixed, required: true }, // OpenAPI operation object (tương đương JSONB)

    // Tăng 1 sau mỗi lần thay đổi; vừa là số phiên bản, vừa dùng cho optimistic locking
    version: { type: Number, default: 1 },
    createdBy: { type: ObjectId, ref: 'User' },
    updatedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: false },
);
apiSchema.index({ project: 1, endpoint: 1, method: 1 }, { unique: true });
apiSchema.index({ project: 1, tags: 1 });
apiSchema.plugin(cleanJSON);

export const Api = mongoose.model('Api', apiSchema);
