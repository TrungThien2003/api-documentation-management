import mongoose from 'mongoose';
import { cleanJSON } from './plugins.js';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);
userSchema.plugin(cleanJSON);

export const User = mongoose.model('User', userSchema);
