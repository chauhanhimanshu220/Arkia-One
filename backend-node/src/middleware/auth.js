import jwt from "jsonwebtoken";

export const authenticate = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ message: "Authentication token is required" });
    return;
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "change-this-secret-in-production");
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    res.status(403).json({ message: "You do not have permission to access this resource" });
    return;
  }

  next();
};
