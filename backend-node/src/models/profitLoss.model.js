import { db } from "../config/db.js";

const buildWhere = (filters, dateColumn) => {
  const clauses = [];
  const params = {};

  if (filters.month) {
    clauses.push(`DATE_FORMAT(${dateColumn}, '%Y-%m') = :month`);
    params.month = filters.month;
  }
  if (filters.year) {
    clauses.push(`YEAR(${dateColumn}) = :year`);
    params.year = Number(filters.year);
  }
  if (filters.startDate && filters.endDate) {
    clauses.push(`${dateColumn} BETWEEN :startDate AND :endDate`);
    params.startDate = filters.startDate;
    params.endDate = filters.endDate;
  }
  if (filters.department) {
    clauses.push("department = :department");
    params.department = filters.department;
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
};

export const getProfitLossReport = async (filters = {}) => {
  const revenueFilter = buildWhere(filters, "revenue_date");
  const expenseFilter = buildWhere(filters, "expense_date");

  const [[revenueTotals], [expenseTotals], [monthlyRows], [departments]] = await Promise.all([
    db.execute(`SELECT COALESCE(SUM(amount), 0) AS totalRevenue FROM revenues ${revenueFilter.where}`, revenueFilter.params),
    db.execute(`SELECT COALESCE(SUM(amount), 0) AS totalExpense FROM expenses ${expenseFilter.where}`, expenseFilter.params),
    db.execute(
      `SELECT month, SUM(revenue) AS revenue, SUM(expense) AS expense, SUM(revenue) - SUM(expense) AS profit
       FROM (
         SELECT DATE_FORMAT(revenue_date, '%Y-%m') AS month, SUM(amount) AS revenue, 0 AS expense FROM revenues GROUP BY DATE_FORMAT(revenue_date, '%Y-%m')
         UNION ALL
         SELECT DATE_FORMAT(expense_date, '%Y-%m') AS month, 0 AS revenue, SUM(amount) AS expense FROM expenses GROUP BY DATE_FORMAT(expense_date, '%Y-%m')
       ) monthly GROUP BY month ORDER BY month`,
    ),
    db.execute(
      `SELECT department FROM revenues UNION SELECT department FROM expenses ORDER BY department`,
    ),
  ]);

  const totalRevenue = Number(revenueTotals[0]?.totalRevenue || 0);
  const totalExpense = Number(expenseTotals[0]?.totalExpense || 0);
  const net = totalRevenue - totalExpense;
  const previous = monthlyRows.at(-2);
  const latest = monthlyRows.at(-1);
  const previousProfit = Number(previous?.profit || 0);
  const latestProfit = Number(latest?.profit || 0);
  const monthlyGrowth = previousProfit === 0 ? (latestProfit > 0 ? 100 : 0) : ((latestProfit - previousProfit) / Math.abs(previousProfit)) * 100;

  return {
    summary: {
      totalRevenue,
      totalExpense,
      netProfit: Math.max(net, 0),
      netLoss: Math.max(-net, 0),
      monthlyGrowth,
    },
    monthly: monthlyRows.map((row) => ({
      month: row.month,
      revenue: Number(row.revenue || 0),
      expense: Number(row.expense || 0),
      profit: Number(row.profit || 0),
    })),
    departments: departments.map((row) => row.department).filter(Boolean),
  };
};

export const saveProfitLossSnapshot = async ({ periodStart, periodEnd, department, totalRevenue, totalExpense }) => {
  const netProfit = Math.max(totalRevenue - totalExpense, 0);
  const netLoss = Math.max(totalExpense - totalRevenue, 0);
  const [result] = await db.execute(
    `INSERT INTO profit_loss_reports (period_start, period_end, department, total_revenue, total_expense, net_profit, net_loss)
     VALUES (:periodStart, :periodEnd, :department, :totalRevenue, :totalExpense, :netProfit, :netLoss)`,
    { periodStart, periodEnd, department: department || null, totalRevenue, totalExpense, netProfit, netLoss },
  );
  return result.insertId;
};
