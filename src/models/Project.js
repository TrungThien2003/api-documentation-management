import mongoose from 'mongoose';
import { cleanJSON } from './plugins.js';

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);
projectSchema.plugin(cleanJSON);

export const Project = mongoose.model('Project', projectSchema);
