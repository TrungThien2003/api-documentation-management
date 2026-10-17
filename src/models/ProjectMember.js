import mongoose from 'mongoose';
import { ROLES, ROLE_VALUES } from '../constants/roles.js';
import { cleanJSON } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

const projectMemberSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLE_VALUES, default: ROLES.DEVELOPER, required: true },
    invitedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
projectMemberSchema.index({ project: 1, user: 1 }, { unique: true }); // mỗi user chỉ có 1 role / project
projectMemberSchema.index({ user: 1 }); // GET /users/me/projects
projectMemberSchema.plugin(cleanJSON);

export const ProjectMember = mongoose.model('ProjectMember', projectMemberSchema);
