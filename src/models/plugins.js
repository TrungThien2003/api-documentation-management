/** Chuẩn hoá JSON trả về: _id -> id, bỏ __v/passwordHash, giữ nguyên object rỗng trong spec. */
export function cleanJSON(schema) {
  schema.set('toJSON', {
    versionKey: false,
    minimize: false,
    transform(_doc, ret) {
      ret.id = ret._id?.toString();
      delete ret._id;
      delete ret.passwordHash;
      return ret;
    },
  });
}
