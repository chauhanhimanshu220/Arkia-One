import { db } from "../config/db.js";

export const findAdminByEmail = async (email) => {
  const [rows] = await db.execute(
    "SELECT id, name, email, password_hash AS passwordHash, role, is_active AS isActive FROM admins WHERE email = :email LIMIT 1",
    { email },
  );
  return rows[0] || null;
};

export const findSuperAdminByEmail = async (email) => {
  const [rows] = await db.execute(
    "SELECT id, full_name AS name, email, password_hash AS passwordHash, role, access_level, account_status FROM super_admins WHERE email = :email LIMIT 1",
    { email },
  );
  return rows[0] || null;
};
