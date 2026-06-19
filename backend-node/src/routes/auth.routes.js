import { Router } from "express";
import { body } from "express-validator";
import { login, getMe } from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.js";
import superAdminAuth from "../middleware/superAdminAuth.middleware.js";

const router = Router();

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  validate,
  login,
);

router.get("/me", superAdminAuth, getMe);

export default router;
