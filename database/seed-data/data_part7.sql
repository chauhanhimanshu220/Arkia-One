-- ============================================================================
-- 3. ACCOUNT AUDIT LOGS (5 events)
-- ============================================================================
INSERT INTO [dbo].[AccountAuditLogs] ([Id],[SubjectUserId],[ActorUserId],[Action],[Detail],[IpAddress],[UserAgent],[CreatedAtUtc])
VALUES
('AAL00001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'UserLogin',N'Successful login from registered device.',N'192.168.1.100',N'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',DATEADD(DAY,-1,GETUTCDATE())),
('AAL00001-0000-0000-0000-000000000002',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0003'),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0003'),N'UserLogin',N'Successful login from office network.',N'10.0.0.45',N'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0',DATEADD(DAY,-1,GETUTCDATE())),
('AAL00001-0000-0000-0000-000000000003',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0006'),N'RoleChange',N'Employee role updated from Employee to Team Manager.',N'10.0.0.45',N'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0',DATEADD(DAY,-30,GETUTCDATE())),
('AAL00001-0000-0000-0000-000000000004',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0007'),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0002'),N'PasswordReset',N'Password reset initiated by admin for user.',N'10.0.0.1',N'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',DATEADD(DAY,-15,GETUTCDATE())),
('AAL00001-0000-0000-0000-000000000005',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0005'),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0005'),N'ProfileUpdate',N'Profile photo and mobile number updated.',N'103.45.67.89',N'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148',DATEADD(DAY,-7,GETUTCDATE()));
GO

-- ============================================================================
-- 4. FINANCE SETTINGS (4 settings)
-- ============================================================================
INSERT INTO [dbo].[FinanceSettings] ([Id],[Category],[Key],[Name],[Description],[Status],[DataJson],[CreatedAtUtc],[UpdatedAtUtc],[UpdatedBy])
VALUES
('FINS0001-0000-0000-0000-000000000001',N'Timesheet',N'BillableRate_Default',N'Default Billable Rate',N'Default hourly billing rate for billable projects.',N'Active',N'{"ratePerHour":1500,"currency":"INR","effectiveFrom":"2025-01-01"}',DATEADD(MONTH,-6,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),N'Manish Chopra'),
('FINS0001-0000-0000-0000-000000000002',N'Timesheet',N'BillableRate_ACME',N'Acme Corp Billable Rate',N'Negotiated billing rate for Acme Corporation projects.',N'Active',N'{"ratePerHour":1800,"currency":"INR","effectiveFrom":"2025-03-01"}',DATEADD(MONTH,-4,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),N'Manish Chopra'),
('FINS0001-0000-0000-0000-000000000003',N'Timesheet',N'BillableRate_GLOB',N'GlobalShop Billable Rate',N'Negotiated billing rate for GlobalShop Inc. projects.',N'Active',N'{"ratePerHour":2000,"currency":"INR","effectiveFrom":"2025-04-01"}',DATEADD(MONTH,-3,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),N'Manish Chopra'),
('FINS0001-0000-0000-0000-000000000004',N'Timesheet',N'BillableRate_QSR',N'QuickServe Billable Rate',N'Negotiated billing rate for QuickServe Restaurants.',N'Active',N'{"ratePerHour":1200,"currency":"INR","effectiveFrom":"2025-05-01"}',DATEADD(MONTH,-1,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),N'Manish Chopra');
GO

-- ============================================================================
-- 11. LATE TIMESHEET REQUESTS (2 requests)
-- ============================================================================
INSERT INTO [dbo].[LateTimesheetRequests] ([Id],[UserId],[UserName],[Reason],[AdditionalRemarks],[CreatedAtUtc],[UpdatedAtUtc])
VALUES
('LTR00001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0006'),N'Priya Rao',N'Missed deadline due to medical emergency.',N'Was on sick leave for 2 days. Requesting to submit timesheet for last week.',DATEADD(DAY,-3,GETUTCDATE()),DATEADD(DAY,-3,GETUTCDATE())),
('LTR00001-0000-0000-0000-000000000002',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0025'),N'Anil Contractor',N'Forgot to submit on Friday — was travelling.',N'Was traveling for a personal emergency. Kindly allow late submission.',DATEADD(DAY,-2,GETUTCDATE()),DATEADD(DAY,-2,GETUTCDATE()));
GO

-- ============================================================================
-- 12. LATE TIMESHEET REQUEST ITEMS (3 items)
-- ============================================================================
INSERT INTO [dbo].[LateTimesheetRequestItems] ([Id],[RequestId],[EntryDate],[ProjectId],[ProjectName],[TaskId],[TaskTitle],[ManagerId],[ManagerName],[Status],[DecisionNote],[DecisionAtUtc],[UnlockExpiresAtUtc],[LastUsedAtUtc])
VALUES
('LTRI0001-0000-0000-0000-000000000001','LTR00001-0000-0000-0000-000000000001',DATEADD(DAY,-7,GETUTCDATE()),'P0000001-0000-0000-0000-000000000001',N'Timesheet Management System v2','T0000001-0000-0000-0000-000000000003',N'Implement approval workflow API',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),N'Neha Joshi',N'Approved',N'Approved — valid reason.',DATEADD(DAY,-2,GETUTCDATE()),DATEADD(DAY,5,GETUTCDATE()),NULL),
('LTRI0001-0000-0000-0000-000000000002','LTR00001-0000-0000-0000-000000000001',DATEADD(DAY,-6,GETUTCDATE()),'P0000001-0000-0000-0000-000000000004',N'HR Automation Suite','T0000001-0000-0000-0000-000000000014',N'Leave management module',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),N'Neha Joshi',N'Approved',N'Approved.',DATEADD(DAY,-2,GETUTCDATE()),DATEADD(DAY,5,GETUTCDATE()),NULL),
('LTRI0001-0000-0000-0000-000000000003','LTR00001-0000-0000-0000-000000000002',DATEADD(DAY,-7,GETUTCDATE()),'P0000001-0000-0000-0000-000000000002',N'Client Portal - Acme Corp','T0000001-0000-0000-0000-000000000009',N'Document upload feature',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0005'),N'Arjun Kapoor',N'Pending',N'',NULL,NULL,NULL);
GO

-- ============================================================================
-- 13. PASSWORD CHANGE REQUESTS (2 requests)
-- ============================================================================
INSERT INTO [dbo].[PasswordChangeRequests] ([Id],[UserId],[UserName],[UserEmail],[Department],[Designation],[Status],[CurrentPasswordHashSnapshot],[CurrentPasswordSaltSnapshot],[PendingPasswordHash],[PendingPasswordSalt],[OtpHash],[OtpSalt],[OtpExpiresAtUtc],[OtpAttemptCount],[OtpVerifiedAtUtc],[ReviewedByUserId],[ReviewedByName],[DecisionNote],[DecisionAtUtc],[CreatedAtUtc],[UpdatedAtUtc])
VALUES
('PCR00001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0006'),N'Priya Rao',N'priya.rao@arkiatechnology.com',N'Engineering',N'Junior Software Engineer',N'Approved',N'aXBhZC1zYW1wbGU=',N'c2FsdC1zYW1wbGU=',N'bmV3LWhhc2gtc2FtcGxl',N'bmV3LXNhbHQtc2FtcGxl',N'b3RwLWhhc2g=',N'b3RwLXNhbHQ=',DATEADD(HOUR,1,GETUTCDATE()),0,DATEADD(DAY,-2,GETUTCDATE()),(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',N'Approved — valid request.',DATEADD(DAY,-2,GETUTCDATE()),DATEADD(DAY,-5,GETUTCDATE()),DATEADD(DAY,-2,GETUTCDATE())),
('PCR00001-0000-0000-0000-000000000002',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0017'),N'Akash Mehta',N'akash.mehta@arkiatechnology.com',N'Finance',N'Financial Analyst',N'Pending',N'aXBhZC1zYW1wbGU=',N'c2FsdC1zYW1wbGU=',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,N'',N'',NULL,DATEADD(DAY,-1,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()));
GO

-- ============================================================================
-- 14. USER LOGIN ACTIVITY (10 login records)
-- ============================================================================
INSERT INTO [dbo].[UserLoginActivity] ([Id],[UserId],[AttemptedEmail],[LoginTime],[LogoutTime],[Latitude],[Longitude],[Accuracy],[City],[State],[Country],[IpAddress],[UserAgent],[Browser],[OperatingSystem],[DeviceType],[LoginStatus],[FailureReason],[IsSuspicious],[CreatedAt])
VALUES
('ULA00001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'rajesh.sharma@arkiatechnology.com',DATEADD(HOUR,-8,GETUTCDATE()),DATEADD(HOUR,-2,GETUTCDATE()),19.0760,72.8777,50.0,N'Mumbai',N'Maharashtra',N'India',N'192.168.1.100',N'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',N'Chrome 120',N'Windows 10',N'Desktop',N'Success',N'',0,DATEADD(HOUR,-8,GETUTCDATE())),
('ULA00001-0000-0000-0000-000000000002',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0003'),N'vikram.verma@arkiatechnology.com',DATEADD(HOUR,-7,GETUTCDATE()),NULL,19.1136,72.8697,30.0,N'Mumbai',N'Maharashtra',N'India',N'10.0.0.45',N'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0',N'Edge 120',N'Windows 11',N'Desktop',N'Success',N'',0,DATEADD(HOUR,-7,GETUTCDATE())),
('ULA00001-0000-0000-0000-000000000003',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),N'neha.joshi@arkiatechnology.com',DATEADD(HOUR,-9,GETUTCDATE()),DATEADD(HOUR,-1,GETUTCDATE()),12.9716,77.5946,100.0,N'Bangalore',N'Karnataka',N'India',N'203.45.67.89',N'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1',N'Safari 605',N'macOS 10.15',N'Desktop',N'Success',N'',0,DATEADD(HOUR,-9,GETUTCDATE())),
('ULA00001-0000-0000-0000-000000000004',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0005'),N'arjun.kapoor@arkiatechnology.com',DATEADD(HOUR,-8,GETUTCDATE()),NULL,19.0760,72.8777,50.0,N'Mumbai',N'Maharashtra',N'India',N'192.168.1.105',N'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',N'Chrome 120',N'Windows 10',N'Desktop',N'Success',N'',0,DATEADD(HOUR,-8,GETUTCDATE())),
('ULA00001-0000-0000-0000-000000000005',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0006'),N'priya.rao@arkiatechnology.com',DATEADD(HOUR,-7,GETUTCDATE()),NULL,28.6139,77.2090,200.0,N'New Delhi',N'Delhi',N'India',N'203.56.78.90',N'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/121.0',N'Firefox 121',N'Windows 11',N'Desktop',N'Success',N'',0,DATEADD(HOUR,-7,GETUTCDATE())),
('ULA00001-0000-0000-0000-000000000006',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0007'),N'amit.thakur@arkiatechnology.com',DATEADD(HOUR,-6,GETUTCDATE()),DATEADD(HOUR,-1,GETUTCDATE()),19.0760,72.8777,50.0,N'Mumbai',N'Maharashtra',N'India',N'10.0.0.50',N'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',N'Chrome 120',N'Windows 10',N'Desktop',N'Success',N'',0,DATEADD(HOUR,-6,GETUTCDATE())),
('ULA00001-0000-0000-0000-000000000007',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0015'),N'manish.chopra@arkiatechnology.com',DATEADD(HOUR,-8,GETUTCDATE()),DATEADD(HOUR,-3,GETUTCDATE()),19.0760,72.8777,50.0,N'Mumbai',N'Maharashtra',N'India',N'10.0.0.60',N'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0',N'Edge 120',N'Windows 10',N'Desktop',N'Success',N'',0,DATEADD(HOUR,-8,GETUTCDATE())),
('ULA00001-0000-0000-0000-000000000008',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0021'),N'ananya.iyer@arkiatechnology.com',DATEADD(HOUR,-10,GETUTCDATE()),DATEADD(HOUR,-2,GETUTCDATE()),12.9716,77.5946,100.0,N'Bangalore',N'Karnataka',N'India',N'103.67.89.12',N'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0',N'Chrome 120',N'macOS 10.15',N'Desktop',N'Success',N'',0,DATEADD(HOUR,-10,GETUTCDATE())),
('ULA00001-0000-0000-0000-000000000009',NULL,N'unknown@arkiatechnology.com',DATEADD(HOUR,-12,GETUTCDATE()),NULL,NULL,NULL,NULL,N'',N'',N'Unknown',N'45.67.89.123',N'Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36',N'Mobile Safari',N'Android 14',N'Mobile',N'Failed',N'Invalid credentials',1,DATEADD(HOUR,-12,GETUTCDATE())),
('ULA00001-0000-0000-0000-000000000010',NULL,N'hacker@test.com',DATEADD(HOUR,-11,GETUTCDATE()),NULL,NULL,NULL,NULL,N'',N'',N'Unknown',N'78.90.123.45',N'curl/8.0',N'Unknown',N'Unknown',N'Unknown',N'Failed',N'Account not found',1,DATEADD(HOUR,-11,GETUTCDATE()));
GO

PRINT 'All sample data inserted successfully.';
GO
