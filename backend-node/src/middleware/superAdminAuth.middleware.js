import jwt from 'jsonwebtoken';

const superAdminAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-this-secret-in-production');
    
    // Check if the decoded token represents a super admin
    if (decoded.account_type !== 'super_admin' && decoded.role !== 'super_admin' && decoded.role !== 'Owner' && decoded.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'Access forbidden: Super Admin only' });
    }

    // Attach admin info to request
    req.admin = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token', error: error.message });
  }
};

export default superAdminAuth;
