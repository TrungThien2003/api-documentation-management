import mongoose from 'mongoose';
import { cleanJSON } from './plugins.js';

const { ObjectId, Mixed } = mongoose.Schema.Types;

export const REVISION_ACTIONS = ['IMPORT', 'UPDATE', 'RESTORE'];

/** Lịch sử chỉ ghi thêm (append-only): không bao giờ sửa/xoá riêng lẻ. */
const apiRevisionSchema = new mongoose.Schema(
  {
    api: { type: ObjectId, ref: 'Api', required: true },
    project: { type: ObjectId, ref: 'Project', required: true },
    version: { type: Number, required: true }, // phiên bản của Api sau thay đổi này
    action: { type: String, enum: REVISION_ACTIONS, required: true },
    changedBy: { type: ObjectId, ref: 'User', required: true },
    previousSpec: { type: Mixed, default: null }, // null khi API được tạo mới
    newSpec: { type: Mixed, required: true },
    commitMessage: { type: String, required: true, trim: true, maxlength: 500 },
    restoredFromVersion: { type: Number }, // chỉ có khi action = RESTORE
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);
apiRevisionSchema.index({ api: 1, version: -1 }, { unique: true });
apiRevisionSchema.plugin(cleanJSON);

export const ApiRevision = mongoose.model('ApiRevision', apiRevisionSchema);
