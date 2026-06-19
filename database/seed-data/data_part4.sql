-- ============================================================================
-- 7. WEEKLY TIMESHEETS (10 sheets for 5 employees across 2-3 weeks)
-- ============================================================================
-- Neha Joshi (EMP-0004) — Week 1
INSERT INTO [dbo].[WeeklyTimesheets] ([Id],[UserId],[AdminId],[AdminName],[WeekStart],[WeekEnd],[Status],[ManagerApprovalStatus],[AdminApprovalStatus],[ApprovedBy],[ApprovalFlowType],[TotalHours],[RowsJson],[UpdatedAtUtc])
VALUES('W0000001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),DATEADD(WEEK,-3,DATEADD(WEEKDAY,8-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),N'Approved',N'Approved',N'Approved',N'Vikram Verma',N'ManagerOnly',40,N'[]',GETUTCDATE());

-- Neha Joshi (EMP-0004) — Week 2
INSERT INTO [dbo].[WeeklyTimesheets] ([Id],[UserId],[AdminId],[AdminName],[WeekStart],[WeekEnd],[Status],[ManagerApprovalStatus],[AdminApprovalStatus],[ApprovedBy],[ApprovalFlowType],[TotalHours],[RowsJson],[UpdatedAtUtc])
VALUES('W0000001-0000-0000-0000-000000000002',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),DATEADD(WEEK,-2,DATEADD(WEEKDAY,8-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),N'Approved',N'Approved',N'Approved',N'Vikram Verma',N'ManagerOnly',42,N'[]',GETUTCDATE());

-- Neha Joshi (EMP-0004) — Week 3
INSERT INTO [dbo].[WeeklyTimesheets] ([Id],[UserId],[AdminId],[AdminName],[WeekStart],[WeekEnd],[Status],[ManagerApprovalStatus],[AdminApprovalStatus],[ApprovedBy],[ApprovalFlowType],[TotalHours],[RowsJson],[UpdatedAtUtc])
VALUES('W0000001-0000-0000-0000-000000000003',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',DATEADD(WEEK,-1,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),DATEADD(WEEK,-1,DATEADD(WEEKDAY,8-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),N'Approved',N'Approved',N'Approved',N'Vikram Verma',N'ManagerOnly',38,N'[]',GETUTCDATE());

-- Arjun Kapoor (EMP-0005) — Week 1
INSERT INTO [dbo].[WeeklyTimesheets] ([Id],[UserId],[AdminId],[AdminName],[WeekStart],[WeekEnd],[Status],[ManagerApprovalStatus],[AdminApprovalStatus],[ApprovedBy],[ApprovalFlowType],[TotalHours],[RowsJson],[UpdatedAtUtc])
VALUES('W0000001-0000-0000-0000-000000000004',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0005'),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),DATEADD(WEEK,-3,DATEADD(WEEKDAY,8-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),N'Approved',N'Approved',N'Approved',N'Vikram Verma',N'ManagerOnly',44,N'[]',GETUTCDATE());

-- Arjun Kapoor (EMP-0005) — Week 2
INSERT INTO [dbo].[WeeklyTimesheets] ([Id],[UserId],[AdminId],[AdminName],[WeekStart],[WeekEnd],[Status],[ManagerApprovalStatus],[AdminApprovalStatus],[ApprovedBy],[ApprovalFlowType],[TotalHours],[RowsJson],[UpdatedAtUtc])
VALUES('W0000001-0000-0000-0000-000000000005',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0005'),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),DATEADD(WEEK,-2,DATEADD(WEEKDAY,8-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),N'Approved',N'Approved',N'Approved',N'Vikram Verma',N'ManagerOnly',36,N'[]',GETUTCDATE());

-- Arjun Kapoor (EMP-0005) — Week 3
INSERT INTO [dbo].[WeeklyTimesheets] ([Id],[UserId],[AdminId],[AdminName],[WeekStart],[WeekEnd],[Status],[ManagerApprovalStatus],[AdminApprovalStatus],[ApprovedBy],[ApprovalFlowType],[TotalHours],[RowsJson],[UpdatedAtUtc])
VALUES('W0000001-0000-0000-0000-000000000006',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0005'),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',DATEADD(WEEK,-1,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),DATEADD(WEEK,-1,DATEADD(WEEKDAY,8-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),N'Submitted',N'Pending',N'Pending',N'',N'ManagerOnly',32,N'[]',GETUTCDATE());

-- Priya Rao (EMP-0006) — Week 2
INSERT INTO [dbo].[WeeklyTimesheets] ([Id],[UserId],[AdminId],[AdminName],[WeekStart],[WeekEnd],[Status],[ManagerApprovalStatus],[AdminApprovalStatus],[ApprovedBy],[ApprovalFlowType],[TotalHours],[RowsJson],[UpdatedAtUtc])
VALUES('W0000001-0000-0000-0000-000000000007',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0006'),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),DATEADD(WEEK,-2,DATEADD(WEEKDAY,8-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),N'Approved',N'Approved',N'Approved',N'Vikram Verma',N'ManagerOnly',40,N'[]',GETUTCDATE());

-- Priya Rao (EMP-0006) — Week 3
INSERT INTO [dbo].[WeeklyTimesheets] ([Id],[UserId],[AdminId],[AdminName],[WeekStart],[WeekEnd],[Status],[ManagerApprovalStatus],[AdminApprovalStatus],[ApprovedBy],[ApprovalFlowType],[TotalHours],[RowsJson],[UpdatedAtUtc])
VALUES('W0000001-0000-0000-0000-000000000008',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0006'),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',DATEADD(WEEK,-1,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),DATEADD(WEEK,-1,DATEADD(WEEKDAY,8-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),N'Draft',N'Pending',N'Pending',N'',N'ManagerOnly',28,N'[]',GETUTCDATE());

-- Amit Thakur (EMP-0007) — Week 1
INSERT INTO [dbo].[WeeklyTimesheets] ([Id],[UserId],[AdminId],[AdminName],[WeekStart],[WeekEnd],[Status],[ManagerApprovalStatus],[AdminApprovalStatus],[ApprovedBy],[ApprovalFlowType],[TotalHours],[RowsJson],[UpdatedAtUtc])
VALUES('W0000001-0000-0000-0000-000000000009',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0007'),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),DATEADD(WEEK,-3,DATEADD(WEEKDAY,8-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),N'Approved',N'Approved',N'Approved',N'Vikram Verma',N'ManagerOnly',40,N'[]',GETUTCDATE());

-- Ananya Iyer (EMP-0021) — Week 2
INSERT INTO [dbo].[WeeklyTimesheets] ([Id],[UserId],[AdminId],[AdminName],[WeekStart],[WeekEnd],[Status],[ManagerApprovalStatus],[AdminApprovalStatus],[ApprovedBy],[ApprovalFlowType],[TotalHours],[RowsJson],[UpdatedAtUtc])
VALUES('W0000001-0000-0000-0000-000000000010',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0021'),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),DATEADD(WEEK,-2,DATEADD(WEEKDAY,8-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE))),N'Submitted',N'Approved',N'Pending',N'Vikram Verma',N'ManagerThenAdmin',20,N'[]',GETUTCDATE());
GO

-- ============================================================================
-- 8. DAILY TIMESHEETS (30 daily sheets)
-- ============================================================================
-- Neha Joshi — Week 1 daily
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000001', e.Id, DATEADD(DAY,0,DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0004';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000002', e.Id, DATEADD(DAY,1,DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0004';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000003', e.Id, DATEADD(DAY,2,DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0004';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000004', e.Id, DATEADD(DAY,3,DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0004';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000005', e.Id, DATEADD(DAY,4,DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0004';

-- Neha Joshi — Week 2
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000006', e.Id, DATEADD(DAY,0,DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.5, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0004';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000007', e.Id, DATEADD(DAY,1,DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.5, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0004';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000008', e.Id, DATEADD(DAY,2,DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.5, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0004';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000009', e.Id, DATEADD(DAY,3,DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.5, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0004';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000010', e.Id, DATEADD(DAY,4,DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.5, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0004';

-- Arjun Kapoor — Week 1
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000011', e.Id, DATEADD(DAY,0,DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 9.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0005';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000012', e.Id, DATEADD(DAY,1,DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 9.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0005';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000013', e.Id, DATEADD(DAY,2,DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 9.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0005';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000014', e.Id, DATEADD(DAY,3,DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 9.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0005';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000015', e.Id, DATEADD(DAY,4,DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0005';

-- Arjun Kapoor — Week 2
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000016', e.Id, DATEADD(DAY,0,DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 7.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0005';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000017', e.Id, DATEADD(DAY,1,DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 7.5, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0005';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000018', e.Id, DATEADD(DAY,2,DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 7.5, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0005';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000019', e.Id, DATEADD(DAY,3,DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 7.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0005';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000020', e.Id, DATEADD(DAY,4,DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 7.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0005';

-- Priya Rao — Week 2
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000021', e.Id, DATEADD(DAY,0,DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0006';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000022', e.Id, DATEADD(DAY,1,DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0006';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000023', e.Id, DATEADD(DAY,2,DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0006';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000024', e.Id, DATEADD(DAY,3,DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0006';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000025', e.Id, DATEADD(DAY,4,DATEADD(WEEK,-2,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0006';

-- Amit Thakur — Week 1
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000026', e.Id, DATEADD(DAY,0,DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0007';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000027', e.Id, DATEADD(DAY,1,DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0007';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000028', e.Id, DATEADD(DAY,2,DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0007';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000029', e.Id, DATEADD(DAY,3,DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0007';
INSERT INTO [dbo].[DailyTimesheets] ([Id],[UserId],[Date],[Status],[TotalHours],[UpdatedAtUtc])
SELECT 'D0000001-0000-0000-0000-000000000030', e.Id, DATEADD(DAY,4,DATEADD(WEEK,-3,DATEADD(WEEKDAY,2-DATEPART(WEEKDAY,GETUTCDATE()),CAST(GETUTCDATE() AS DATE)))), N'Approved', 8.0, GETUTCDATE() FROM [dbo].[Employees] e WHERE e.EmployeeCode=N'EMP-0007';
GO

-- ============================================================================
-- 9. DAILY TIMESHEET ENTRIES (60 entries - 2 per daily sheet)
-- ============================================================================
INSERT INTO [dbo].[DailyTimesheetEntries] ([Id],[DailyTimesheetId],[TaskId],[TaskTitle],[Hours],[WorkDescription])
VALUES('DE000001-0000-0000-0000-000000000001','D0000001-0000-0000-0000-000000000001','T0000001-0000-0000-0000-000000000001',N'Design database schema',4,N'Worked on ERD and migration scripts');
INSERT INTO [dbo].[DailyTimesheetEntries] ([Id],[DailyTimesheetId],[TaskId],[TaskTitle],[Hours],[WorkDescription])
VALUES('DE000001-0000-0000-0000-000000000002','D0000001-0000-0000-0000-000000000001','T0000001-0000-0000-0000-000000000005',N'Dashboard UI design',4,N'Dashboard wireframe review');
INSERT INTO [dbo].[DailyTimesheetEntries] ([Id],[DailyTimesheetId],[TaskId],[TaskTitle],[Hours],[WorkDescription])
VALUES('DE000001-0000-0000-0000-000000000003','D0000001-0000-0000-0000-000000000002','T0000001-0000-0000-0000-000000000001',N'Design database schema',8,N'Completed migration scripts');
INSERT INTO [dbo].[DailyTimesheetEntries] ([Id],[DailyTimesheetId],[TaskId],[TaskTitle],[Hours],[WorkDescription])
VALUES('DE000001-0000-0000-0000-000000000004','D0000001-0000-0000-0000-000000000003','T0000001-0000-0000-0000-000000000010',N'Payment gateway integration',4,N'Reviewed Razorpay API documentation');
INSERT INTO [dbo].[DailyTimesheetEntries] ([Id],[DailyTimesheetId],[TaskId],[TaskTitle],[Hours],[WorkDescription])
VALUES('DE000001-0000-0000-0000-000000000005','D0000001-0000-0000-0000-000000000003','T0000001-0000-0000-0000-000000000001',N'Design database schema',4,N'Schema review meeting + final changes');
INSERT INTO [dbo].[DailyTimesheetEntries] ([Id],[DailyTimesheetId],[TaskId],[TaskTitle],[Hours],[WorkDescription])
VALUES('DE000001-0000-0000-0000-000000000006','D0000001-0000-0000-0000-000000000004','T0000001-0000-0000-0000-000000000010',N'Payment gateway integration',8,N'Payment gateway sandbox testing');
INSERT INTO [dbo].[DailyTimesheetEntries] ([Id],[DailyTimesheetId],[TaskId],[TaskTitle],[Hours],[WorkDescription])
VALUES('DE000001-0000-0000-0000-000000000007','D0000001-0000-0000-0000-000000000005','T0000001-0000-0000-0000-000000000001',N'Design database schema',4,N'Team review and sign-off');
INSERT INTO [dbo].[DailyTimesheetEntries] ([Id],[DailyTimesheetId],[TaskId],[TaskTitle],[Hours],[WorkDescription])
VALUES('DE000001-0000-0000-0000-000000000008','D0000001-0000-0000-0000-000000000005','T0000001-0000-0000-0000-000000000005',N'Dashboard UI design',4,N'Dashboard design review');
INSERT INTO [dbo].[DailyTimesheetEntries] ([Id],[DailyTimesheetId],[TaskId],[TaskTitle],[Hours],[WorkDescription])
VALUES('DE000001-0000-0000-0000-000000000009','D0000001-0000-0000-0000-000000000006','T0000001-0000-0000-0000-000000000003',N'Implement approval workflow API',4,N'API endpoint development — approval flow');
INSERT INTO [dbo].[DailyTimesheetEntries] ([Id],[DailyTimesheetId],[TaskId],[TaskTitle],[Hours],[WorkDescription])
VALUES('DE000001-0000-0000-0000-000000000010','D0000001-0000-0000-0000-000000000006','T0000001-0000-0000-0000-000000000001',N'Design database schema',4.5,N'Post-deployment schema fixes');
INSERT INTO [dbo].[DailyTimesheetEntries] ([Id],[DailyTimesheetId],[TaskId],[TaskTitle],[Hours],[WorkDescription])
VALUES('DE000001-0000-0000-0000-000000000011','D0000001-0000-0000-0000-000000000011','T0000001-0000-0000-0000-000000000002',N'Build timesheet submission UI',5,N'Timesheet form layout implementation');
INSERT INTO [dbo].[DailyTimesheetEntries] ([Id],[DailyTimesheetId],[TaskId],[TaskTitle],[Hours],[WorkDescription])
VALUES('DE000001-0000-0000-0000-000000000012','D0000001-0000-0000-0000-000000000011','T0000001-0000-0000-0000-000000000007',N'Authentication system',4,N'Auth login page design and implementation');
GO

-- bulk of entries
INSERT INTO [dbo].[DailyTimesheetEntries] ([Id],[DailyTimesheetId],[TaskId],[TaskTitle],[Hours],[WorkDescription])
VALUES
('DE000001-0000-0000-0000-000000000013','D0000001-0000-0000-0000-000000000012','T0000001-0000-0000-0000-000000000002',N'Build timesheet submission UI',5,N'Validation logic added to timesheet form'),
('DE000001-0000-0000-0000-000000000014','D0000001-0000-0000-0000-000000000012','T0000001-0000-0000-0000-000000000007',N'Authentication system',4,N'JWT token handling implementation'),
('DE000001-0000-0000-0000-000000000015','D0000001-0000-0000-0000-000000000013','T0000001-0000-0000-0000-000000000002',N'Build timesheet submission UI',5,N'Error handling and edge cases'),
('DE000001-0000-0000-0000-000000000016','D0000001-0000-0000-0000-000000000013','T0000001-0000-0000-0000-000000000007',N'Authentication system',4,N'Token refresh mechanism'),
('DE000001-0000-0000-0000-000000000017','D0000001-0000-0000-0000-000000000014','T0000001-0000-0000-0000-000000000002',N'Build timesheet submission UI',5,N'Unit tests for submission component'),
('DE000001-0000-0000-0000-000000000018','D0000001-0000-0000-0000-000000000014','T0000001-0000-0000-0000-000000000007',N'Authentication system',4,N'Auth client approval and code cleanup'),
('DE000001-0000-0000-0000-000000000019','D0000001-0000-0000-0000-000000000015','T0000001-0000-0000-0000-000000000002',N'Build timesheet submission UI',4,N'Code review fixes and optimizations'),
('DE000001-0000-0000-0000-000000000020','D0000001-0000-0000-0000-000000000015','T0000001-0000-0000-0000-000000000007',N'Authentication system',4,N'Auth module final testing and deployment'),
('DE000001-0000-0000-0000-000000000021','D0000001-0000-0000-0000-000000000016','T0000001-0000-0000-0000-000000000008',N'Milestone tracking API',4,N'Milestone CRUD endpoint development'),
('DE000001-0000-0000-0000-000000000022','D0000001-0000-0000-0000-000000000016','T0000001-0000-0000-0000-000000000009',N'Document upload feature',3,N'Upload endpoint setup and testing'),
('DE000001-0000-0000-0000-000000000023','D0000001-0000-0000-0000-000000000017','T0000001-0000-0000-0000-000000000008',N'Milestone tracking API',4,N'Status transition implementation'),
('DE000001-0000-0000-0000-000000000024','D0000001-0000-0000-0000-000000000017','T0000001-0000-0000-0000-000000000009',N'Document upload feature',3.5,N'File validation and scan integration'),
('DE000001-0000-0000-0000-000000000025','D0000001-0000-0000-0000-000000000018','T0000001-0000-0000-0000-000000000008',N'Milestone tracking API',4,N'API documentation and review'),
('DE000001-0000-0000-0000-000000000026','D0000001-0000-0000-0000-000000000018','T0000001-0000-0000-0000-000000000009',N'Document upload feature',3.5,N'Preview generation implementation'),
('DE000001-0000-0000-0000-000000000027','D0000001-0000-0000-0000-000000000019','T0000001-0000-0000-0000-000000000008',N'Milestone tracking API',4,N'API testing and bug fixes'),
('DE000001-0000-0000-0000-000000000028','D0000001-0000-0000-0000-000000000019','T0000001-0000-0000-0000-000000000009',N'Document upload feature',3,N'Upload module final testing'),
('DE000001-0000-0000-0000-000000000029','D0000001-0000-0000-0000-000000000020','T0000001-0000-0000-0000-000000000008',N'Milestone tracking API',4,N'API polishing and deployment prep'),
('DE000001-0000-0000-0000-000000000030','D0000001-0000-0000-0000-000000000020','T0000001-0000-0000-0000-000000000009',N'Document upload feature',3,N'Upload module deployment');
GO

-- Priya Rao entries
INSERT INTO [dbo].[DailyTimesheetEntries] ([Id],[DailyTimesheetId],[TaskId],[TaskTitle],[Hours],[WorkDescription])
VALUES
('DE000001-0000-0000-0000-000000000031','D0000001-0000-0000-0000-000000000021','T0000001-0000-0000-0000-000000000003',N'Implement approval workflow API',4,N'Business logic for approval chain'),
('DE000001-0000-0000-0000-000000000032','D0000001-0000-0000-0000-000000000021','T0000001-0000-0000-0000-000000000012',N'Inventory management API',4,N'Inventory DB schema design'),
('DE000001-0000-0000-0000-000000000033','D0000001-0000-0000-0000-000000000022','T0000001-0000-0000-0000-000000000003',N'Implement approval workflow API',4,N'Role-based access checks'),
('DE000001-0000-0000-0000-000000000034','D0000001-0000-0000-0000-000000000022','T0000001-0000-0000-0000-000000000012',N'Inventory management API',4,N'Inventory CRUD endpoints'),
('DE000001-0000-0000-0000-000000000035','D0000001-0000-0000-0000-000000000023','T0000001-0000-0000-0000-000000000003',N'Implement approval workflow API',4,N'Integration tests for approval flow'),
('DE000001-0000-0000-0000-000000000036','D0000001-0000-0000-0000-000000000023','T0000001-0000-0000-0000-000000000012',N'Inventory management API',4,N'Stock level alert logic'),
('DE000001-0000-0000-0000-000000000037','D0000001-0000-0000-0000-000000000024','T0000001-0000-0000-0000-000000000003',N'Implement approval workflow API',4,N'Code review and performance tuning'),
('DE000001-0000-0000-0000-000000000038','D0000001-0000-0000-0000-000000000024','T0000001-0000-0000-0000-000000000012',N'Inventory management API',4,N'Supplier integration module'),
('DE000001-0000-0000-0000-000000000039','D0000001-0000-0000-0000-000000000025','T0000001-0000-0000-0000-000000000014',N'Leave management module',4,N'Leave types and balance calculation'),
('DE000001-0000-0000-0000-000000000040','D0000001-0000-0000-0000-000000000025','T0000001-0000-0000-0000-000000000012',N'Inventory management API',4,N'Inventory API documentation');
GO

-- Amit Thakur entries
INSERT INTO [dbo].[DailyTimesheetEntries] ([Id],[DailyTimesheetId],[TaskId],[TaskTitle],[Hours],[WorkDescription])
VALUES
('DE000001-0000-0000-0000-000000000041','D0000001-0000-0000-0000-000000000026','T0000001-0000-0000-0000-000000000004',N'Set up CI/CD pipeline',4,N'Build pipeline configuration in Azure DevOps'),
('DE000001-0000-0000-0000-000000000042','D0000001-0000-0000-0000-000000000026','T0000001-0000-0000-0000-000000000011',N'Infrastructure setup',4,N'VM provisioning on Azure'),
('DE000001-0000-0000-0000-000000000043','D0000001-0000-0000-0000-000000000027','T0000001-0000-0000-0000-000000000004',N'Set up CI/CD pipeline',4,N'Test stage added to pipeline'),
('DE000001-0000-0000-0000-000000000044','D0000001-0000-0000-0000-000000000027','T0000001-0000-0000-0000-000000000011',N'Infrastructure setup',4,N'Load balancer configuration'),
('DE000001-0000-0000-0000-000000000045','D0000001-0000-0000-0000-000000000028','T0000001-0000-0000-0000-000000000004',N'Set up CI/CD pipeline',4,N'Deployment stage configuration'),
('DE000001-0000-0000-0000-000000000046','D0000001-0000-0000-0000-000000000028','T0000001-0000-0000-0000-000000000011',N'Infrastructure setup',4,N'Database setup and migration'),
('DE000001-0000-0000-0000-000000000047','D0000001-0000-0000-0000-000000000029','T0000001-0000-0000-0000-000000000004',N'Set up CI/CD pipeline',4,N'Pipeline documentation and handover'),
('DE000001-0000-0000-0000-000000000048','D0000001-0000-0000-0000-000000000029','T0000001-0000-0000-0000-000000000011',N'Infrastructure setup',4,N'Monitoring setup with Azure Monitor'),
('DE000001-0000-0000-0000-000000000049','D0000001-0000-0000-0000-000000000030','T0000001-0000-0000-0000-000000000019',N'Azure environment setup',4,N'Azure networking and security groups'),
('DE000001-0000-0000-0000-000000000050','D0000001-0000-0000-0000-000000000030','T0000001-0000-0000-0000-000000000011',N'Infrastructure setup',4,N'Infrastructure diagram documentation');
GO
