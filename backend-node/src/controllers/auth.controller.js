import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { findAdminByEmail, findSuperAdminByEmail } from "../models/auth.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const login = asyncHandler(async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password;
  
  // Hardcoded Super Admin for Arkia One Owner (Bypasses MySQL if down)
  if (email === 'sunil.kumar@arkiatechnology.com' && password === 'arkiaone@123') {
    const tokenPayload = { 
      id: 'super-admin-1', 
      email: email, 
      role: 'super_admin',
      account_type: 'super_admin',
      access_level: 'full',
      company_id: null
    };
    
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || "change-this-secret-in-production",
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" },
    );

    return res.json({
      token,
      user: { 
        id: 'super-admin-1', 
        name: 'Sunil Kumar', 
        email: email, 
        role: 'super_admin',
        account_type: 'super_admin',
        access_level: 'full'
      },
    });
  }

  let user;
  let accountType = "workspace_user";

  try {
    user = await findAdminByEmail(email);
    if (!user) {
      user = await findSuperAdminByEmail(email);
      accountType = "super_admin";
    }
  } catch (dbError) {
    console.error("Database connection failed during login:", dbError);
    return res.status(500).json({ message: "Database connection failed. Please ensure MySQL is running." });
  }

  if (!user || (accountType === "workspace_user" && !user.isActive) || (accountType === "super_admin" && user.account_status !== 'Active')) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const tokenPayload = { 
    id: user.id, 
    email: user.email, 
    role: user.role,
    account_type: accountType,
    access_level: user.access_level || 'standard',
    company_id: user.company_id || null
  };

  const token = jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET || "change-this-secret-in-production",
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" },
  );

  res.json({
    token,
    user: { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role,
      account_type: accountType,
      access_level: user.access_level || 'standard'
    },
  });
});

export const getMe = asyncHandler(async (req, res) => {
  if (!req.admin) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  
  res.json({
    token: req.headers.authorization?.split(" ")[1],
    user: { 
      id: req.admin.id, 
      name: req.admin.email, 
      email: req.admin.email, 
      role: req.admin.role,
      account_type: req.admin.account_type,
      access_level: req.admin.access_level
    },
  });
});
