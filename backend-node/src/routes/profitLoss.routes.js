import { Router } from "express";
import { body, param, query } from "express-validator";
import {
  addExpense,
  addRevenue,
  createSnapshot,
  editExpense,
  editRevenue,
  getDashboard,
  removeExpense,
  removeRevenue,
} from "../controllers/profitLoss.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();
const financeRoles = ["Admin", "Finance Admin"];

const filterValidators = [
  query("month").optional().matches(/^\d{4}-\d{2}$/).withMessage("Month must be YYYY-MM"),
  query("year").optional().isInt({ min: 2000, max: 2100 }).withMessage("Year must be valid"),
  query("startDate").optional().isISO8601().withMessage("Start date must be valid"),
  query("endDate").optional().isISO8601().withMessage("End date must be valid"),
  query("department").optional().trim().isLength({ max: 120 }).withMessage("Department is too long"),
];

const revenueValidators = [
  body("title").trim().isLength({ min: 2, max: 160 }).withMessage("Title is required"),
  body("department").trim().isLength({ min: 2, max: 120 }).withMessage("Department is required"),
  body("source").trim().isLength({ min: 2, max: 120 }).withMessage("Source is required"),
  body("amount").isFloat({ min: 0.01 }).withMessage("Amount must be greater than zero"),
  body("revenueDate").isISO8601().withMessage("Revenue date must be valid"),
  body("notes").optional({ values: "falsy" }).trim().isLength({ max: 500 }).withMessage("Notes are too long"),
];

const expenseValidators = [
  body("title").trim().isLength({ min: 2, max: 160 }).withMessage("Title is required"),
  body("category").isIn(["Salary", "Bonus", "Office", "Travel", "Tax", "Other"]).withMessage("Expense category is invalid"),
  body("department").trim().isLength({ min: 2, max: 120 }).withMessage("Department is required"),
  body("amount").isFloat({ min: 0.01 }).withMessage("Amount must be greater than zero"),
  body("expenseDate").isISO8601().withMessage("Expense date must be valid"),
  body("vendor").optional({ values: "falsy" }).trim().isLength({ max: 160 }).withMessage("Vendor is too long"),
  body("notes").optional({ values: "falsy" }).trim().isLength({ max: 500 }).withMessage("Notes are too long"),
];

router.use(authenticate, authorize(...financeRoles));
router.get("/dashboard", filterValidators, validate, getDashboard);
router.post("/revenues", revenueValidators, validate, addRevenue);
router.put("/revenues/:id", param("id").isInt({ min: 1 }), revenueValidators, validate, editRevenue);
router.delete("/revenues/:id", param("id").isInt({ min: 1 }), validate, removeRevenue);
router.post("/expenses", expenseValidators, validate, addExpense);
router.put("/expenses/:id", param("id").isInt({ min: 1 }), expenseValidators, validate, editExpense);
router.delete("/expenses/:id", param("id").isInt({ min: 1 }), validate, removeExpense);
router.post(
  "/reports",
  [
    body("periodStart").isISO8601().withMessage("Period start is required"),
    body("periodEnd").isISO8601().withMessage("Period end is required"),
    body("department").optional({ values: "falsy" }).trim().isLength({ max: 120 }),
    body("totalRevenue").isFloat({ min: 0 }),
    body("totalExpense").isFloat({ min: 0 }),
  ],
  validate,
  createSnapshot,
);

export default router;
