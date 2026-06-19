import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

export const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "payroll_management",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

// Prevent Node.js process from crashing when MySQL emits an error (e.g. database goes offline)
db.on('error', (err) => {
  console.error('MySQL Pool Error:', err);
});
