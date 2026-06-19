import express from 'express';
import { getDashboardStats, getCompanies } from '../controllers/management.controller.js';
import superAdminAuth from '../middleware/superAdminAuth.middleware.js';

const router = express.Router();

// Protected routes
router.use(superAdminAuth);

router.get('/dashboard', getDashboardStats);
router.get('/companies', getCompanies);

export default router;
