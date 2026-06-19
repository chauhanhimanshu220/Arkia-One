BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @SystemAdminId UNIQUEIDENTIFIER = '90000000-0000-0000-0000-000000000001';
    DECLARE @HrManagerId UNIQUEIDENTIFIER = '90000000-0000-0000-0000-000000000002';
    DECLARE @FinanceAdminId UNIQUEIDENTIFIER = '90000000-0000-0000-0000-000000000003';
    DECLARE @EngineeringManagerId UNIQUEIDENTIFIER = '90000000-0000-0000-0000-000000000004';
    DECLARE @SalesManagerId UNIQUEIDENTIFIER = '90000000-0000-0000-0000-000000000005';
    DECLARE @AmanId UNIQUEIDENTIFIER = '90000000-0000-0000-0000-000000000006';
    DECLARE @SnehaId UNIQUEIDENTIFIER = '90000000-0000-0000-0000-000000000007';
    DECLARE @PoojaId UNIQUEIDENTIFIER = '90000000-0000-0000-0000-000000000008';
    DECLARE @VivekId UNIQUEIDENTIFIER = '90000000-0000-0000-0000-000000000009';
    DECLARE @RahulId UNIQUEIDENTIFIER = '90000000-0000-0000-0000-000000000010';
    DECLARE @NehaId UNIQUEIDENTIFIER = '90000000-0000-0000-0000-000000000011';
    DECLARE @KaranId UNIQUEIDENTIFIER = '90000000-0000-0000-0000-000000000012';

    DECLARE @AtlasProjectId UNIQUEIDENTIFIER = '91000000-0000-0000-0000-000000000001';
    DECLARE @PayrollProjectId UNIQUEIDENTIFIER = '91000000-0000-0000-0000-000000000002';
    DECLARE @LeaveProjectId UNIQUEIDENTIFIER = '91000000-0000-0000-0000-000000000003';
    DECLARE @SalesProjectId UNIQUEIDENTIFIER = '91000000-0000-0000-0000-000000000004';
    DECLARE @OpsProjectId UNIQUEIDENTIFIER = '91000000-0000-0000-0000-000000000005';

    DECLARE @TaskAman UNIQUEIDENTIFIER = '92000000-0000-0000-0000-000000000001';
    DECLARE @TaskSneha UNIQUEIDENTIFIER = '92000000-0000-0000-0000-000000000002';
    DECLARE @TaskPooja UNIQUEIDENTIFIER = '92000000-0000-0000-0000-000000000003';
    DECLARE @TaskVivek UNIQUEIDENTIFIER = '92000000-0000-0000-0000-000000000004';
    DECLARE @TaskNikhil UNIQUEIDENTIFIER = '92000000-0000-0000-0000-000000000005';
    DECLARE @TaskNeha UNIQUEIDENTIFIER = '92000000-0000-0000-0000-000000000006';
    DECLARE @TaskAsha UNIQUEIDENTIFIER = '92000000-0000-0000-0000-000000000007';
    DECLARE @TaskRahul UNIQUEIDENTIFIER = '92000000-0000-0000-0000-000000000008';
    DECLARE @TaskKabir UNIQUEIDENTIFIER = '92000000-0000-0000-0000-000000000009';
    DECLARE @TaskKaran UNIQUEIDENTIFIER = '92000000-0000-0000-0000-000000000010';
    DECLARE @TaskSystemAdmin UNIQUEIDENTIFIER = '92000000-0000-0000-0000-000000000011';
    DECLARE @TaskCrossTeam UNIQUEIDENTIFIER = '92000000-0000-0000-0000-000000000012';

    DECLARE @DailyAman UNIQUEIDENTIFIER = '93000000-0000-0000-0000-000000000001';
    DECLARE @DailySneha UNIQUEIDENTIFIER = '93000000-0000-0000-0000-000000000002';
    DECLARE @DailyVivek UNIQUEIDENTIFIER = '93000000-0000-0000-0000-000000000003';
    DECLARE @DailyRahul UNIQUEIDENTIFIER = '93000000-0000-0000-0000-000000000004';
    DECLARE @DailyKaran UNIQUEIDENTIFIER = '93000000-0000-0000-0000-000000000005';
    DECLARE @DailyPooja UNIQUEIDENTIFIER = '93000000-0000-0000-0000-000000000006';

    DECLARE @WeeklyAman UNIQUEIDENTIFIER = '94000000-0000-0000-0000-000000000001';
    DECLARE @WeeklySneha UNIQUEIDENTIFIER = '94000000-0000-0000-0000-000000000002';
    DECLARE @WeeklyPooja UNIQUEIDENTIFIER = '94000000-0000-0000-0000-000000000003';
    DECLARE @WeeklyVivek UNIQUEIDENTIFIER = '94000000-0000-0000-0000-000000000004';
    DECLARE @WeeklyRahul UNIQUEIDENTIFIER = '94000000-0000-0000-0000-000000000005';
    DECLARE @WeeklyNeha UNIQUEIDENTIFIER = '94000000-0000-0000-0000-000000000006';
    DECLARE @WeeklyKaran UNIQUEIDENTIFIER = '94000000-0000-0000-0000-000000000007';

    DECLARE @LeaveSneha UNIQUEIDENTIFIER = '95000000-0000-0000-0000-000000000001';
    DECLARE @LeaveRahul UNIQUEIDENTIFIER = '95000000-0000-0000-0000-000000000002';
    DECLARE @LeaveNeha UNIQUEIDENTIFIER = '95000000-0000-0000-0000-000000000003';
    DECLARE @LeaveAman UNIQUEIDENTIFIER = '95000000-0000-0000-0000-000000000004';
    DECLARE @LeaveKaran UNIQUEIDENTIFIER = '95000000-0000-0000-0000-000000000005';
    DECLARE @LeavePooja UNIQUEIDENTIFIER = '95000000-0000-0000-0000-000000000006';

    DELETE FROM DailyTimesheetEntries WHERE DailyTimesheetId IN (@DailyAman, @DailySneha, @DailyVivek, @DailyRahul, @DailyKaran, @DailyPooja);
    DELETE FROM DailyTimesheets WHERE Id IN (@DailyAman, @DailySneha, @DailyVivek, @DailyRahul, @DailyKaran, @DailyPooja);
    DELETE FROM WeeklyTimesheets WHERE Id IN (@WeeklyAman, @WeeklySneha, @WeeklyPooja, @WeeklyVivek, @WeeklyRahul, @WeeklyNeha, @WeeklyKaran);
    DELETE FROM LeaveRequests WHERE Id IN (@LeaveSneha, @LeaveRahul, @LeaveNeha, @LeaveAman, @LeaveKaran, @LeavePooja);
    DELETE FROM TaskAssignments WHERE Id IN (@TaskAman, @TaskSneha, @TaskPooja, @TaskVivek, @TaskNikhil, @TaskNeha, @TaskAsha, @TaskRahul, @TaskKabir, @TaskKaran, @TaskSystemAdmin, @TaskCrossTeam);
    DELETE FROM Projects WHERE Id IN (@AtlasProjectId, @PayrollProjectId, @LeaveProjectId, @SalesProjectId, @OpsProjectId);
    DELETE FROM Employees WHERE Id IN (@SystemAdminId, @HrManagerId, @FinanceAdminId, @EngineeringManagerId, @SalesManagerId, @AmanId, @SnehaId, @PoojaId, @VivekId, @RahulId, @NehaId, @KaranId);

    INSERT INTO Employees (Id, FullName, Email, Role, Department, Status, CreatedAtUtc) VALUES
    (@SystemAdminId, 'Demo System Admin', 'sysadmin.demo@demo.timesheet.local', 'System Admin', 'Operations', 'Active', '2026-03-01T08:00:00Z'),
    (@HrManagerId, 'Asha Menon', 'hr.demo@demo.timesheet.local', 'HR Manager', 'Human Resources', 'Active', '2026-03-01T08:05:00Z'),
    (@FinanceAdminId, 'Nikhil Arora', 'finance.demo@demo.timesheet.local', 'Finance Admin', 'Finance', 'Active', '2026-03-01T08:10:00Z'),
    (@EngineeringManagerId, 'Riya Kapoor', 'eng.manager@demo.timesheet.local', 'Team Manager', 'Engineering', 'Active', '2026-03-01T08:15:00Z'),
    (@SalesManagerId, 'Kabir Shah', 'sales.manager@demo.timesheet.local', 'Team Manager', 'Sales', 'Active', '2026-03-01T08:20:00Z'),
    (@AmanId, 'Aman Verma', 'aman.verma@demo.timesheet.local', 'Employee', 'Engineering', 'Active', '2026-03-01T08:25:00Z'),
    (@SnehaId, 'Sneha Iyer', 'sneha.iyer@demo.timesheet.local', 'Employee', 'Engineering', 'Active', '2026-03-01T08:30:00Z'),
    (@PoojaId, 'Pooja Nair', 'pooja.nair@demo.timesheet.local', 'Employee', 'Design', 'Active', '2026-03-01T08:35:00Z'),
    (@VivekId, 'Vivek Rao', 'vivek.rao@demo.timesheet.local', 'Employee', 'Finance', 'Active', '2026-03-01T08:40:00Z'),
    (@RahulId, 'Rahul Mehta', 'rahul.mehta@demo.timesheet.local', 'Employee', 'Sales', 'Active', '2026-03-01T08:45:00Z'),
    (@NehaId, 'Neha Das', 'neha.das@demo.timesheet.local', 'Employee', 'Human Resources', 'Active', '2026-03-01T08:50:00Z'),
    (@KaranId, 'Karan Singh', 'karan.singh@demo.timesheet.local', 'Employee', 'Operations', 'Active', '2026-03-01T08:55:00Z');

    INSERT INTO Projects (Id, Name, Code, Description, ClientBusinessUnit, Department, AdminId, AdminName, ManagerId, ManagerName, ProjectLead, DeliveryModel, TeamMemberIdsJson, TeamMemberNamesJson, TeamSize, Budget, Priority, Status, StartDate, EndDate, IsBillable, CreatedAtUtc) VALUES
    (@AtlasProjectId, 'Atlas Portal Revamp', 'DEMO-ENG-001', 'Admin and employee dashboard rebuild for the internal portal.', 'Internal Platforms', 'Engineering', @SystemAdminId, 'Demo System Admin', @EngineeringManagerId, 'Riya Kapoor', 'Riya Kapoor', 'Dedicated Squad', '["90000000-0000-0000-0000-000000000006","90000000-0000-0000-0000-000000000007","90000000-0000-0000-0000-000000000008"]', '["Aman Verma","Sneha Iyer","Pooja Nair"]', 3, 180000, 'Critical', 'Active', '2026-03-10', '2026-06-30', 1, '2026-03-10T09:00:00Z'),
    (@PayrollProjectId, 'Payroll Automation 2.0', 'DEMO-FIN-001', 'Payroll-ready workflow, export review, and finance controls.', 'Finance Transformation', 'Finance', @SystemAdminId, 'Demo System Admin', @FinanceAdminId, 'Nikhil Arora', 'Nikhil Arora', 'Managed Services', '["90000000-0000-0000-0000-000000000003","90000000-0000-0000-0000-000000000009"]', '["Nikhil Arora","Vivek Rao"]', 2, 150000, 'High', 'Active', '2026-03-15', '2026-07-15', 1, '2026-03-12T09:00:00Z'),
    (@LeaveProjectId, 'Leave Compliance Rollout', 'DEMO-HR-001', 'Policy updates, leave approvals, and audit preparation.', 'People Operations', 'Human Resources', @SystemAdminId, 'Demo System Admin', @HrManagerId, 'Asha Menon', 'Asha Menon', 'Program Delivery', '["90000000-0000-0000-0000-000000000002","90000000-0000-0000-0000-000000000011"]', '["Asha Menon","Neha Das"]', 2, 95000, 'High', 'Active', '2026-03-18', '2026-05-30', 0, '2026-03-18T09:00:00Z'),
    (@SalesProjectId, 'Territory Realignment', 'DEMO-SAL-001', 'Sales hierarchy cleanup and approval support for territory mapping.', 'Commercial Excellence', 'Sales', @SystemAdminId, 'Demo System Admin', @SalesManagerId, 'Kabir Shah', 'Kabir Shah', 'Shared Services', '["90000000-0000-0000-0000-000000000005","90000000-0000-0000-0000-000000000010"]', '["Kabir Shah","Rahul Mehta"]', 2, 72000, 'Medium', 'Pending', '2026-03-22', '2026-07-01', 1, '2026-03-22T09:00:00Z'),
    (@OpsProjectId, 'Operations Command Center', 'DEMO-OPS-001', 'Workflow monitoring, alerting, and admin operations coordination.', 'Operations Excellence', 'Operations', @SystemAdminId, 'Demo System Admin', @SystemAdminId, 'Demo System Admin', 'Demo System Admin', 'Dedicated Squad', '["90000000-0000-0000-0000-000000000001","90000000-0000-0000-0000-000000000012"]', '["Demo System Admin","Karan Singh"]', 2, 110000, 'Medium', 'Completed', '2026-02-20', '2026-04-15', 0, '2026-02-20T09:00:00Z');

    INSERT INTO TaskAssignments (Id, ProjectId, ProjectName, AssignedTo, AssignedToName, Title, Description, StartDate, EndDate, TotalHours, Status, CreatedAtUtc) VALUES
    (@TaskAman, @AtlasProjectId, 'Atlas Portal Revamp', @AmanId, 'Aman Verma', 'Build dashboard widgets', 'Create KPI cards and action queue modules for the admin dashboard.', '2026-03-30', '2026-04-04', 40, 'Pending', '2026-03-30T07:30:00Z'),
    (@TaskSneha, @AtlasProjectId, 'Atlas Portal Revamp', @SnehaId, 'Sneha Iyer', 'QA approval workflow', 'Test the approval inbox flow and track validation defects.', '2026-03-30', '2026-04-04', 32, 'Pending', '2026-03-30T07:45:00Z'),
    (@TaskPooja, @AtlasProjectId, 'Atlas Portal Revamp', @PoojaId, 'Pooja Nair', 'Design dashboard cards', 'Prepare polished card layouts for dashboard and notifications.', '2026-03-30', '2026-04-03', 40, 'Approved', '2026-03-30T08:00:00Z'),
    (@TaskVivek, @PayrollProjectId, 'Payroll Automation 2.0', @VivekId, 'Vivek Rao', 'Validate payroll export ledger', 'Cross-check approved timesheets before payroll export.', '2026-03-30', '2026-04-04', 40, 'Approved', '2026-03-30T08:15:00Z'),
    (@TaskNikhil, @PayrollProjectId, 'Payroll Automation 2.0', @FinanceAdminId, 'Nikhil Arora', 'Review finance exceptions', 'Review blocked payroll cases and release clean batches.', '2026-03-30', '2026-04-04', 24, 'Pending', '2026-03-30T08:20:00Z'),
    (@TaskNeha, @LeaveProjectId, 'Leave Compliance Rollout', @NehaId, 'Neha Das', 'Audit leave policy records', 'Verify leave policy changes and approval note quality.', '2026-03-30', '2026-04-03', 24, 'Pending', '2026-03-30T08:25:00Z'),
    (@TaskAsha, @LeaveProjectId, 'Leave Compliance Rollout', @HrManagerId, 'Asha Menon', 'Approve compliance changes', 'Sign off updated HR leave workflow changes.', '2026-03-30', '2026-04-03', 16, 'Pending', '2026-03-30T08:30:00Z'),
    (@TaskRahul, @SalesProjectId, 'Territory Realignment', @RahulId, 'Rahul Mehta', 'Prepare territory sheet', 'Compile regional mapping and missing ownership rows.', '2026-03-30', '2026-04-04', 32, 'Pending', '2026-03-30T08:35:00Z'),
    (@TaskKabir, @SalesProjectId, 'Territory Realignment', @SalesManagerId, 'Kabir Shah', 'Review pipeline mapping', 'Validate sales coverage and escalation mapping.', '2026-03-30', '2026-04-04', 24, 'Pending', '2026-03-30T08:40:00Z'),
    (@TaskKaran, @OpsProjectId, 'Operations Command Center', @KaranId, 'Karan Singh', 'Monitor admin queue', 'Track approval queues and refresh operational watchlists.', '2026-03-30', '2026-04-04', 40, 'Approved', '2026-03-30T08:45:00Z'),
    (@TaskSystemAdmin, @OpsProjectId, 'Operations Command Center', @SystemAdminId, 'Demo System Admin', 'Configure approval routes', 'Tune routing, permissions, and admin visibility.', '2026-03-30', '2026-04-02', 18, 'Approved', '2026-03-30T08:50:00Z'),
    (@TaskCrossTeam, @AtlasProjectId, 'Atlas Portal Revamp', @EngineeringManagerId, 'Riya Kapoor', 'Review cross-team blockers', 'Coordinate dependencies across engineering and design.', '2026-03-30', '2026-04-04', 20, 'Pending', '2026-03-30T08:55:00Z');

    INSERT INTO DailyTimesheets (Id, UserId, Date, Status, TotalHours, UpdatedAtUtc) VALUES
    (@DailyAman, @AmanId, '2026-04-03', 'Submitted', 8, '2026-04-03T17:20:00Z'),
    (@DailySneha, @SnehaId, '2026-04-03', 'Draft', 6, '2026-04-03T16:10:00Z'),
    (@DailyVivek, @VivekId, '2026-04-03', 'Approved', 8, '2026-04-03T18:00:00Z'),
    (@DailyRahul, @RahulId, '2026-04-04', 'Submitted', 7.5, '2026-04-04T16:40:00Z'),
    (@DailyKaran, @KaranId, '2026-04-04', 'Approved', 8, '2026-04-04T18:10:00Z'),
    (@DailyPooja, @PoojaId, '2026-04-03', 'Approved', 8, '2026-04-03T17:50:00Z');

    INSERT INTO DailyTimesheetEntries (Id, DailyTimesheetId, TaskId, TaskTitle, Hours, WorkDescription) VALUES
    ('93100000-0000-0000-0000-000000000001', @DailyAman, @TaskAman, 'Build dashboard widgets', 8, 'Built KPI cards and finalised admin queue layout.'),
    ('93100000-0000-0000-0000-000000000002', @DailySneha, @TaskSneha, 'QA approval workflow', 6, 'Validated submit and approve scenarios for weekly sheets.'),
    ('93100000-0000-0000-0000-000000000003', @DailyVivek, @TaskVivek, 'Validate payroll export ledger', 8, 'Reviewed export totals and matched approved billable hours.'),
    ('93100000-0000-0000-0000-000000000004', @DailyRahul, @TaskRahul, 'Prepare territory sheet', 7.5, 'Completed territory mapping workbook and raised open owner gaps.'),
    ('93100000-0000-0000-0000-000000000005', @DailyKaran, @TaskKaran, 'Monitor admin queue', 8, 'Cleared admin alert queue and refreshed watchlist metrics.'),
    ('93100000-0000-0000-0000-000000000006', @DailyPooja, @TaskPooja, 'Design dashboard cards', 8, 'Prepared dashboard card designs and icon polish for review.');

    INSERT INTO WeeklyTimesheets (Id, UserId, AdminId, AdminName, WeekStart, WeekEnd, Status, TotalHours, RowsJson, UpdatedAtUtc) VALUES
    (@WeeklyAman, @AmanId, @EngineeringManagerId, 'Riya Kapoor', '2026-03-30', '2026-04-05', 'Submitted', 38, N'[{"id":"week-aman-1","projectId":"91000000-0000-0000-0000-000000000001","projectName":"Atlas Portal Revamp","taskName":"Build dashboard widgets","notes":"Admin dashboard build","billable":true,"hours":{"2026-03-30":8,"2026-03-31":8,"2026-04-01":8,"2026-04-02":7,"2026-04-03":7}}]', '2026-04-04T18:00:00Z'),
    (@WeeklySneha, @SnehaId, @EngineeringManagerId, 'Riya Kapoor', '2026-03-30', '2026-04-05', 'Draft', 26, N'[{"id":"week-sneha-1","projectId":"91000000-0000-0000-0000-000000000001","projectName":"Atlas Portal Revamp","taskName":"QA approval workflow","notes":"Approval QA","billable":true,"hours":{"2026-03-30":6,"2026-03-31":5,"2026-04-01":5,"2026-04-02":5,"2026-04-03":5}}]', '2026-04-04T15:30:00Z'),
    (@WeeklyPooja, @PoojaId, @EngineeringManagerId, 'Riya Kapoor', '2026-03-30', '2026-04-05', 'Approved', 40, N'[{"id":"week-pooja-1","projectId":"91000000-0000-0000-0000-000000000001","projectName":"Atlas Portal Revamp","taskName":"Design dashboard cards","notes":"Design polish","billable":true,"hours":{"2026-03-30":8,"2026-03-31":8,"2026-04-01":8,"2026-04-02":8,"2026-04-03":8}}]', '2026-04-04T18:20:00Z'),
    (@WeeklyVivek, @VivekId, @FinanceAdminId, 'Nikhil Arora', '2026-03-30', '2026-04-05', 'Approved', 40, N'[{"id":"week-vivek-1","projectId":"91000000-0000-0000-0000-000000000002","projectName":"Payroll Automation 2.0","taskName":"Validate payroll export ledger","notes":"Payroll review","billable":true,"hours":{"2026-03-30":8,"2026-03-31":8,"2026-04-01":8,"2026-04-02":8,"2026-04-03":8}}]', '2026-04-04T19:00:00Z'),
    (@WeeklyRahul, @RahulId, @SalesManagerId, 'Kabir Shah', '2026-03-30', '2026-04-05', 'Submitted', 34, N'[{"id":"week-rahul-1","projectId":"91000000-0000-0000-0000-000000000004","projectName":"Territory Realignment","taskName":"Prepare territory sheet","notes":"Sales alignment","billable":true,"hours":{"2026-03-30":7,"2026-03-31":7,"2026-04-01":7,"2026-04-02":6,"2026-04-03":7}}]', '2026-04-04T17:15:00Z'),
    (@WeeklyNeha, @NehaId, @HrManagerId, 'Asha Menon', '2026-03-30', '2026-04-05', 'Rejected', 24, N'[{"id":"week-neha-1","projectId":"91000000-0000-0000-0000-000000000003","projectName":"Leave Compliance Rollout","taskName":"Audit leave policy records","notes":"Policy audit","billable":false,"hours":{"2026-03-30":4,"2026-03-31":5,"2026-04-01":5,"2026-04-02":5,"2026-04-03":5}}]', '2026-04-04T14:20:00Z'),
    (@WeeklyKaran, @KaranId, @SystemAdminId, 'Demo System Admin', '2026-03-30', '2026-04-05', 'Approved', 42, N'[{"id":"week-karan-1","projectId":"91000000-0000-0000-0000-000000000005","projectName":"Operations Command Center","taskName":"Monitor admin queue","notes":"Ops monitoring","billable":false,"hours":{"2026-03-30":8,"2026-03-31":8,"2026-04-01":8,"2026-04-02":8,"2026-04-03":10}}]', '2026-04-04T19:20:00Z');

    INSERT INTO LeaveRequests (Id, EmployeeId, EmployeeName, Department, AdminId, AdminName, Type, StartDate, EndDate, Days, Reason, Status, CreatedAtUtc) VALUES
    (@LeaveSneha, @SnehaId, 'Sneha Iyer', 'Engineering', @EngineeringManagerId, 'Riya Kapoor', 'Casual Leave', '2026-04-08', '2026-04-09', 2, 'Family function and travel.', 'Pending', '2026-04-04T09:30:00Z'),
    (@LeaveRahul, @RahulId, 'Rahul Mehta', 'Sales', @SalesManagerId, 'Kabir Shah', 'Sick Leave', '2026-04-04', '2026-04-05', 2, 'Seasonal illness and recovery.', 'Approved', '2026-04-03T10:15:00Z'),
    (@LeaveNeha, @NehaId, 'Neha Das', 'Human Resources', @HrManagerId, 'Asha Menon', 'Work From Home', '2026-04-03', '2026-04-03', 1, 'Policy review from home.', 'Approved', '2026-04-02T11:00:00Z'),
    (@LeaveAman, @AmanId, 'Aman Verma', 'Engineering', @EngineeringManagerId, 'Riya Kapoor', 'Earned Leave', '2026-04-11', '2026-04-12', 2, 'Personal travel plan.', 'Rejected', '2026-04-03T14:10:00Z'),
    (@LeaveKaran, @KaranId, 'Karan Singh', 'Operations', @SystemAdminId, 'Demo System Admin', 'Casual Leave', '2026-04-10', '2026-04-10', 1, 'Personal work.', 'Pending', '2026-04-04T15:10:00Z'),
    (@LeavePooja, @PoojaId, 'Pooja Nair', 'Design', @EngineeringManagerId, 'Riya Kapoor', 'Work From Home', '2026-04-06', '2026-04-06', 1, 'Remote design review.', 'Approved', '2026-04-03T12:20:00Z');

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
