import { validationResult } from "express-validator";

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    next();
    return;
  }

  res.status(422).json({
    message: "Validation failed",
    errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
  });
};
