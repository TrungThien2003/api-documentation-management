import mongoose from 'mongoose';
import { cleanJSON } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

/** parent = null => thread gốc; parent = _id của thread => reply (chỉ 1 cấp). */
const commentSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: true },
    api: { type: ObjectId, ref: 'Api', required: true },
    author: { type: ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    anchor: { type: String, trim: true, maxlength: 200 }, // vị trí trong spec, vd "/responses/404"
    parent: { type: ObjectId, ref: 'Comment', default: null },
    resolved: { type: Boolean, default: false },
    resolvedBy: { type: ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
commentSchema.index({ api: 1, parent: 1, createdAt: -1 });
commentSchema.plugin(cleanJSON);

export const Comment = mongoose.model('Comment', commentSchema);
