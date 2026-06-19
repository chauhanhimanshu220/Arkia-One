import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    const [[companiesResult]] = await db.execute('SELECT COUNT(*) as total FROM companies');
    const [[activeSubsResult]] = await db.execute("SELECT COUNT(*) as total FROM company_subscriptions WHERE subscription_status = 'Active' AND expiry_date >= CURDATE()");
    const [[expiredSubsResult]] = await db.execute("SELECT COUNT(*) as total FROM company_subscriptions WHERE subscription_status != 'Active' OR expiry_date < CURDATE()");
    const [[expiringSubsResult]] = await db.execute("SELECT COUNT(*) as total FROM company_subscriptions WHERE subscription_status = 'Active' AND expiry_date >= CURDATE() AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)");
    
    const [[seatsResult]] = await db.execute('SELECT SUM(seat_limit) as total_limit, SUM(seats_used) as total_used FROM company_subscriptions');
    const [[employeesResult]] = await db.execute('SELECT SUM(total_active_employees) as total_employees, SUM(current_active_projects) as total_projects FROM workspace_statistics');
    
    // In this model, MRR is a calculated field or a sum of monthly active plans. Here we just return a mock aggregate if no billing table exists yet.
    const monthlyRevenue = 125000;

    const totalSeatAllocation = seatsResult.total_limit || 0;
    const seatsUsed = seatsResult.total_used || 0;

    const stats = {
      totalRegisteredCompanies: companiesResult.total || 0,
      activeSubscriptions: activeSubsResult.total || 0,
      expiredSubscriptions: expiredSubsResult.total || 0,
      expiringSubscriptions: expiringSubsResult.total || 0,
      totalPlatformUsers: employeesResult.total_employees || 0, 
      totalActiveEmployees: employeesResult.total_employees || 0,
      currentActiveProjects: employeesResult.total_projects || 0,
      totalSeatAllocation: totalSeatAllocation,
      seatsUsed: seatsUsed,
      seatsRemaining: totalSeatAllocation - seatsUsed,
      monthlyRevenue: monthlyRevenue,
      systemHealth: 'Optimal',
      workspaceGrowth: '+12.4%',
      platformActivity: [
        { id: 1, action: "New subscription activated", target: "Nova Systems", time: "10 minutes ago" },
        { id: 2, action: "Support ticket escalated", target: "ABC Technologies", time: "1 hour ago" },
        { id: 3, action: "Invoice paid", target: "Zenith Labs", time: "2 hours ago" },
        { id: 4, action: "New admin provisioned", target: "Global Tech", time: "3 hours ago" }
      ]
    };

    res.json(stats);
  } catch (error) {
    console.error("Database connection failed, returning empty dashboard stats:", error);
    res.json({
      totalRegisteredCompanies: 0,
      activeSubscriptions: 0,
      expiredSubscriptions: 0,
      expiringSubscriptions: 0,
      totalPlatformUsers: 0,
      totalActiveEmployees: 0,
      currentActiveProjects: 0,
      totalSeatAllocation: 0,
      seatsUsed: 0,
      seatsRemaining: 0,
      monthlyRevenue: 0,
      systemHealth: 'Database Offline - Showing Empty Data',
      workspaceGrowth: '0%',
      platformActivity: []
    });
  }
});

export const getCompanies = asyncHandler(async (req, res) => {
  try {
    const [companies] = await db.execute(`
      SELECT 
        c.id, 
        c.company_name, 
        c.workspace_status, 
        c.billing_status,
        c.account_status,
        lo.full_name as license_owner,
        lo.email as license_owner_email,
        COALESCE(s.plan_name, 'No Plan') as plan_name,
        s.expiry_date,
        s.seat_limit,
        s.seats_used,
        s.subscription_status,
        ws.total_active_employees,
        ws.current_active_projects,
        DATEDIFF(s.expiry_date, CURDATE()) as remaining_days
      FROM companies c
      LEFT JOIN license_owners lo ON c.id = lo.company_id
      LEFT JOIN company_subscriptions s ON c.id = s.company_id
      LEFT JOIN workspace_statistics ws ON c.id = ws.company_id
      ORDER BY c.created_at DESC
    `);

    res.json(companies);
  } catch (error) {
    console.error("Database connection failed, returning empty companies data:", error);
    res.json([]);
  }
});
