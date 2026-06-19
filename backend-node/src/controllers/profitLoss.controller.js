import * as Expense from "../models/expense.model.js";
import * as ProfitLoss from "../models/profitLoss.model.js";
import * as Revenue from "../models/revenue.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const filtersFromQuery = (query) => ({
  month: query.month || undefined,
  year: query.year || undefined,
  startDate: query.startDate || undefined,
  endDate: query.endDate || undefined,
  department: query.department || undefined,
});

export const getDashboard = asyncHandler(async (req, res) => {
  const filters = filtersFromQuery(req.query);
  const [report, revenues, expenses, revenueSummary, expenseSummary] = await Promise.all([
    ProfitLoss.getProfitLossReport(filters),
    Revenue.listRevenues(filters),
    Expense.listExpenses(filters),
    Revenue.monthlyRevenueSummary(filters),
    Expense.expenseBreakdown(filters),
  ]);

  res.json({
    ...report,
    revenues,
    expenses,
    monthlyRevenueSummary: revenueSummary,
    expenseBreakdown: expenseSummary,
  });
});

export const addRevenue = asyncHandler(async (req, res) => {
  const id = await Revenue.createRevenue(req.body);
  res.status(201).json({ id, message: "Revenue created" });
});

export const editRevenue = asyncHandler(async (req, res) => {
  const affected = await Revenue.updateRevenue(req.params.id, req.body);
  if (!affected) {
    res.status(404).json({ message: "Revenue not found" });
    return;
  }
  res.json({ message: "Revenue updated" });
});

export const removeRevenue = asyncHandler(async (req, res) => {
  const affected = await Revenue.deleteRevenue(req.params.id);
  if (!affected) {
    res.status(404).json({ message: "Revenue not found" });
    return;
  }
  res.status(204).send();
});

export const addExpense = asyncHandler(async (req, res) => {
  const id = await Expense.createExpense(req.body);
  res.status(201).json({ id, message: "Expense created" });
});

export const editExpense = asyncHandler(async (req, res) => {
  const affected = await Expense.updateExpense(req.params.id, req.body);
  if (!affected) {
    res.status(404).json({ message: "Expense not found" });
    return;
  }
  res.json({ message: "Expense updated" });
});

export const removeExpense = asyncHandler(async (req, res) => {
  const affected = await Expense.deleteExpense(req.params.id);
  if (!affected) {
    res.status(404).json({ message: "Expense not found" });
    return;
  }
  res.status(204).send();
});

export const createSnapshot = asyncHandler(async (req, res) => {
  const id = await ProfitLoss.saveProfitLossSnapshot(req.body);
  res.status(201).json({ id, message: "Profit and loss snapshot saved" });
});
