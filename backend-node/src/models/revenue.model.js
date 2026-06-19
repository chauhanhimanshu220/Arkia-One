import { db } from "../config/db.js";

const buildWhere = (filters) => {
  const clauses = [];
  const params = {};

  if (filters.month) {
    clauses.push("DATE_FORMAT(revenue_date, '%Y-%m') = :month");
    params.month = filters.month;
  }
  if (filters.year) {
    clauses.push("YEAR(revenue_date) = :year");
    params.year = Number(filters.year);
  }
  if (filters.startDate && filters.endDate) {
    clauses.push("revenue_date BETWEEN :startDate AND :endDate");
    params.startDate = filters.startDate;
    params.endDate = filters.endDate;
  }
  if (filters.department) {
    clauses.push("department = :department");
    params.department = filters.department;
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
};

export const listRevenues = async (filters = {}) => {
  const { where, params } = buildWhere(filters);
  const [rows] = await db.execute(
    `SELECT id, title, department, source, amount, revenue_date AS revenueDate, notes, created_at AS createdAt, updated_at AS updatedAt
     FROM revenues ${where} ORDER BY revenue_date DESC, id DESC`,
    params,
  );
  return rows;
};

export const createRevenue = async (payload) => {
  const [result] = await db.execute(
    `INSERT INTO revenues (title, department, source, amount, revenue_date, notes)
     VALUES (:title, :department, :source, :amount, :revenueDate, :notes)`,
    payload,
  );
  return result.insertId;
};

export const updateRevenue = async (id, payload) => {
  const [result] = await db.execute(
    `UPDATE revenues SET title = :title, department = :department, source = :source, amount = :amount, revenue_date = :revenueDate, notes = :notes
     WHERE id = :id`,
    { ...payload, id },
  );
  return result.affectedRows;
};

export const deleteRevenue = async (id) => {
  const [result] = await db.execute("DELETE FROM revenues WHERE id = :id", { id });
  return result.affectedRows;
};

export const monthlyRevenueSummary = async (filters = {}) => {
  const { where, params } = buildWhere(filters);
  const [rows] = await db.execute(
    `SELECT DATE_FORMAT(revenue_date, '%Y-%m') AS month, SUM(amount) AS totalRevenue, COUNT(*) AS records
     FROM revenues ${where} GROUP BY DATE_FORMAT(revenue_date, '%Y-%m') ORDER BY month`,
    params,
  );
  return rows;
};
