import { db } from "../config/db.js";

const buildWhere = (filters) => {
  const clauses = [];
  const params = {};

  if (filters.month) {
    clauses.push("DATE_FORMAT(expense_date, '%Y-%m') = :month");
    params.month = filters.month;
  }
  if (filters.year) {
    clauses.push("YEAR(expense_date) = :year");
    params.year = Number(filters.year);
  }
  if (filters.startDate && filters.endDate) {
    clauses.push("expense_date BETWEEN :startDate AND :endDate");
    params.startDate = filters.startDate;
    params.endDate = filters.endDate;
  }
  if (filters.department) {
    clauses.push("department = :department");
    params.department = filters.department;
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
};

export const listExpenses = async (filters = {}) => {
  const { where, params } = buildWhere(filters);
  const [rows] = await db.execute(
    `SELECT id, title, category, department, amount, expense_date AS expenseDate, vendor, notes, created_at AS createdAt, updated_at AS updatedAt
     FROM expenses ${where} ORDER BY expense_date DESC, id DESC`,
    params,
  );
  return rows;
};

export const createExpense = async (payload) => {
  const [result] = await db.execute(
    `INSERT INTO expenses (title, category, department, amount, expense_date, vendor, notes)
     VALUES (:title, :category, :department, :amount, :expenseDate, :vendor, :notes)`,
    payload,
  );
  return result.insertId;
};

export const updateExpense = async (id, payload) => {
  const [result] = await db.execute(
    `UPDATE expenses SET title = :title, category = :category, department = :department, amount = :amount, expense_date = :expenseDate, vendor = :vendor, notes = :notes
     WHERE id = :id`,
    { ...payload, id },
  );
  return result.affectedRows;
};

export const deleteExpense = async (id) => {
  const [result] = await db.execute("DELETE FROM expenses WHERE id = :id", { id });
  return result.affectedRows;
};

export const expenseBreakdown = async (filters = {}) => {
  const { where, params } = buildWhere(filters);
  const [rows] = await db.execute(
    `SELECT category, SUM(amount) AS totalExpense, COUNT(*) AS records
     FROM expenses ${where} GROUP BY category ORDER BY totalExpense DESC`,
    params,
  );
  return rows;
};
