/**
 * Validate params/query/body bằng zod. Kết quả đã parse nằm ở req.valid.{params,query,body}.
 * (Express 5: req.query chỉ đọc nên không ghi đè trực tiếp.)
 * ZodError được ném ra và errorHandler chuyển thành 400.
 */
export const validate = (schemas) => (req, _res, next) => {
  req.valid = req.valid ?? {};
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const input = key === 'body' ? (req.body ?? {}) : req[key];
    req.valid[key] = schemas[key].parse(input);
  }
  next();
};
