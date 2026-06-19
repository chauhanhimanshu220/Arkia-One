-- ============================================================================
-- ARKIA TIMESHEET MANAGEMENT SYSTEM — SAMPLE DATA
-- Engine: SQL Server (LocalDB / Express / Standard)
-- Execute AFTER schema.sql
-- ============================================================================

USE [Timesheet];
GO

-- ============================================================================
-- DELETE EXISTING DATA (in reverse FK order)
-- ============================================================================
DELETE FROM [dbo].[ChatNotificationPreferences];
DELETE FROM [dbo].[ChatPresences];
DELETE FROM [dbo].[ChatReactions];
DELETE FROM [dbo].[ChatAttachments];
DELETE FROM [dbo].[ChatMessages];
DELETE FROM [dbo].[ChatParticipants];
DELETE FROM [dbo].[ChatThreads];
DELETE FROM [dbo].[UserLoginActivity];
DELETE FROM [dbo].[PasswordChangeRequests];
DELETE FROM [dbo].[LateTimesheetRequestItems];
DELETE FROM [dbo].[LateTimesheetRequests];
DELETE FROM [dbo].[LeaveRequests];
DELETE FROM [dbo].[DailyTimesheetEntries];
DELETE FROM [dbo].[DailyTimesheets];
DELETE FROM [dbo].[WeeklyTimesheets];
DELETE FROM [dbo].[TaskAssignments];
DELETE FROM [dbo].[Projects];
DELETE FROM [dbo].[FinanceSettings];
DELETE FROM [dbo].[AccountAuditLogs];
DELETE FROM [dbo].[Employees];
DELETE FROM [dbo].[Departments];
GO

-- ============================================================================
-- 1. DEPARTMENTS (7 departments)
-- ============================================================================
INSERT INTO [dbo].[Departments] ([Id],[Name],[Code],[Description],[ParentDepartmentId],[HeadEmployeeId],[EmailAlias],[CostCenter],[Status],[CreatedAtUtc],[UpdatedAtUtc])
VALUES
('D0000001-0000-0000-0000-000000000001',N'Engineering',       N'ENG', N'Software development, infrastructure, and technology operations', NULL, NULL, N'engineering@arkiatechnology.com', N'CC-ENG-001', N'Active', DATEADD(MONTH,-24,GETUTCDATE()), DATEADD(MONTH,-1,GETUTCDATE())),
('D0000001-0000-0000-0000-000000000002',N'Human Resources',   N'HR',  N'Talent acquisition, employee relations, payroll, and compliance',   NULL, NULL, N'hr@arkiatechnology.com',        N'CC-HR-001',  N'Active', DATEADD(MONTH,-24,GETUTCDATE()), DATEADD(MONTH,-1,GETUTCDATE())),
('D0000001-0000-0000-0000-000000000003',N'Sales & Marketing', N'SM',  N'Client acquisition, account management, and brand marketing',      NULL, NULL, N'sales@arkiatechnology.com',      N'CC-SM-001',  N'Active', DATEADD(MONTH,-24,GETUTCDATE()), DATEADD(MONTH,-1,GETUTCDATE())),
('D0000001-0000-0000-0000-000000000004',N'Finance',           N'FIN', N'Financial planning, accounting, and audit controls',                NULL, NULL, N'finance@arkiatechnology.com',    N'CC-FIN-001', N'Active', DATEADD(MONTH,-24,GETUTCDATE()), DATEADD(MONTH,-1,GETUTCDATE())),
('D0000001-0000-0000-0000-000000000005',N'Operations',        N'OPS', N'Facilities management, admin support, and logistics',              NULL, NULL, N'ops@arkiatechnology.com',        N'CC-OPS-001', N'Active', DATEADD(MONTH,-24,GETUTCDATE()), DATEADD(MONTH,-1,GETUTCDATE())),
('D0000001-0000-0000-0000-000000000006',N'Design',            N'DSG', N'UI/UX design, graphic design, and brand identity',                  NULL, NULL, N'design@arkiatechnology.com',     N'CC-DSG-001', N'Active', DATEADD(MONTH,-18,GETUTCDATE()), DATEADD(MONTH,-1,GETUTCDATE())),
('D0000001-0000-0000-0000-000000000007',N'Quality Assurance', N'QA',  N'Software testing, automation, and quality engineering',            NULL, NULL, N'qa@arkiatechnology.com',         N'CC-QA-001',  N'Active', DATEADD(MONTH,-18,GETUTCDATE()), DATEADD(MONTH,-1,GETUTCDATE()));
GO

-- ============================================================================
-- 2. EMPLOYEES (25 employees)
-- ============================================================================
INSERT INTO [dbo].[Employees] ([Id],[EmployeeCode],[UserId],[FullName],[Email],[MobileNumber],[DateOfBirth],[Gender],[Role],[RolesJson],[Department],[Designation],[ReportingManagerId],[BusinessUnit],[WorkLocation],[Status],[UserType],[ProfilePhotoUrl],[PasswordHash],[PasswordSalt],[PasswordChangedAtUtc],[CreatedAtUtc],[UpdatedAtUtc],[UpdatedBy])
VALUES
('E0000001-0000-0000-0000-000000000001',N'EMP-0001',N'sharma.rajesh',N'Rajesh Sharma',     N'rajesh.sharma@arkiatechnology.com',   N'+91-9876543210',N'1980-05-15',N'Male',  N'System Admin',N'["System Admin"]',N'Engineering',      N'CTO & Co-Founder',             NULL, N'Engineering',       N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-6,GETUTCDATE()),DATEADD(MONTH,-36,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000002',N'EMP-0002',N'patel.anjali', N'Anjali Patel',      N'anjali.patel@arkiatechnology.com',    N'+91-9876543211',N'1983-11-22',N'Female',N'System Admin',N'["System Admin"]',N'Engineering',      N'VP of Engineering',            NULL, N'Engineering',       N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-4,GETUTCDATE()),DATEADD(MONTH,-30,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000003',N'EMP-0003',N'verma.vikram', N'Vikram Verma',       N'vikram.verma@arkiatechnology.com',    N'+91-9876543212',N'1987-08-03',N'Male',  N'Team Manager',N'["Team Manager","Employee"]',N'Engineering', N'Engineering Manager', (SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'), N'Engineering', N'Hybrid',N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-3,GETUTCDATE()),DATEADD(MONTH,-24,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL);
GO

INSERT INTO [dbo].[Employees] ([Id],[EmployeeCode],[UserId],[FullName],[Email],[MobileNumber],[DateOfBirth],[Gender],[Role],[RolesJson],[Department],[Designation],[ReportingManagerId],[BusinessUnit],[WorkLocation],[Status],[UserType],[ProfilePhotoUrl],[PasswordHash],[PasswordSalt],[PasswordChangedAtUtc],[CreatedAtUtc],[UpdatedAtUtc],[UpdatedBy])
VALUES
('E0000001-0000-0000-0000-000000000004',N'EMP-0004',N'joshi.neha',   N'Neha Joshi',         N'neha.joshi@arkiatechnology.com',      N'+91-9876543213',N'1990-02-14',N'Female',N'Employee',  N'["Employee"]',N'Engineering', N'Senior Software Engineer', (SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0003'), N'Engineering', N'Remote',N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-2,GETUTCDATE()),DATEADD(MONTH,-18,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000005',N'EMP-0005',N'kapoor.arjun', N'Arjun Kapoor',       N'arjun.kapoor@arkiatechnology.com',    N'+91-9876543214',N'1992-07-21',N'Male',  N'Employee',  N'["Employee"]',N'Engineering', N'Software Engineer',   (SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0003'), N'Engineering', N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-1,GETUTCDATE()),DATEADD(MONTH,-12,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000006',N'EMP-0006',N'rao.priya',    N'Priya Rao',          N'priya.rao@arkiatechnology.com',       N'+91-9876543215',N'1994-12-05',N'Female',N'Employee',  N'["Employee"]',N'Engineering', N'Junior Software Engineer',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'), N'Engineering', N'Hybrid',N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-1,GETUTCDATE()),DATEADD(MONTH,-6,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000007',N'EMP-0007',N'thakur.amit',  N'Amit Thakur',        N'amit.thakur@arkiatechnology.com',     N'+91-9876543216',N'1989-09-30',N'Male',  N'Employee',  N'["Employee"]',N'Engineering', N'DevOps Engineer',  (SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0003'), N'Engineering', N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-2,GETUTCDATE()),DATEADD(MONTH,-14,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL);
GO

INSERT INTO [dbo].[Employees] ([Id],[EmployeeCode],[UserId],[FullName],[Email],[MobileNumber],[DateOfBirth],[Gender],[Role],[RolesJson],[Department],[Designation],[ReportingManagerId],[BusinessUnit],[WorkLocation],[Status],[UserType],[ProfilePhotoUrl],[PasswordHash],[PasswordSalt],[PasswordChangedAtUtc],[CreatedAtUtc],[UpdatedAtUtc],[UpdatedBy])
VALUES
('E0000001-0000-0000-0000-000000000008',N'EMP-0008',N'singh.meera',  N'Meera Singh',        N'meera.singh@arkiatechnology.com',     N'+91-9876543217',N'1985-04-18',N'Female',N'HR Manager', N'["HR Manager","Employee"]',N'Human Resources', N'HR Director',  NULL, N'Human Resources', N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-5,GETUTCDATE()),DATEADD(MONTH,-24,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000009',N'EMP-0009',N'gupta.rahul',  N'Rahul Gupta',        N'rahul.gupta@arkiatechnology.com',     N'+91-9876543218',N'1991-06-12',N'Male',  N'Employee',  N'["Employee"]',N'Human Resources', N'HR Executive', (SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0008'), N'Human Resources',N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-1,GETUTCDATE()),DATEADD(MONTH,-10,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000010',N'EMP-0010',N'pandey.sonia', N'Sonia Pandey',       N'sonia.pandey@arkiatechnology.com',    N'+91-9876543219',N'1993-10-08',N'Female',N'Employee',  N'["Employee"]',N'Human Resources', N'HR Coordinator',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0008'), N'Human Resources',N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-1,GETUTCDATE()),DATEADD(MONTH,-8,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL);
GO

INSERT INTO [dbo].[Employees] ([Id],[EmployeeCode],[UserId],[FullName],[Email],[MobileNumber],[DateOfBirth],[Gender],[Role],[RolesJson],[Department],[Designation],[ReportingManagerId],[BusinessUnit],[WorkLocation],[Status],[UserType],[ProfilePhotoUrl],[PasswordHash],[PasswordSalt],[PasswordChangedAtUtc],[CreatedAtUtc],[UpdatedAtUtc],[UpdatedBy])
VALUES
('E0000001-0000-0000-0000-000000000011',N'EMP-0011',N'desai.karan',  N'Karan Desai',        N'karan.desai@arkiatechnology.com',     N'+91-9876543220',N'1986-01-25',N'Male',  N'Team Manager',N'["Team Manager","Employee"]',N'Sales & Marketing', N'Sales Director', NULL, N'Sales & Marketing',N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-4,GETUTCDATE()),DATEADD(MONTH,-22,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000012',N'EMP-0012',N'yadav.pooja',  N'Pooja Yadav',        N'pooja.yadav@arkiatechnology.com',     N'+91-9876543221',N'1992-03-17',N'Female',N'Employee',  N'["Employee"]',N'Sales & Marketing', N'Account Manager', (SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0011'), N'Sales & Marketing',N'Hybrid',N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-2,GETUTCDATE()),DATEADD(MONTH,-14,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000013',N'EMP-0013',N'khanna.rohit', N'Rohit Khanna',       N'rohit.khanna@arkiatechnology.com',    N'+91-9876543222',N'1990-08-11',N'Male',  N'Employee',  N'["Employee"]',N'Sales & Marketing', N'Marketing Specialist',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0011'), N'Sales & Marketing',N'Remote',N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-1,GETUTCDATE()),DATEADD(MONTH,-10,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000014',N'EMP-0014',N'nair.swati',   N'Swati Nair',         N'swati.nair@arkiatechnology.com',      N'+91-9876543223',N'1995-06-04',N'Female',N'Employee',  N'["Employee"]',N'Sales & Marketing', N'Business Development Exec',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0012'), N'Sales & Marketing',N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-1,GETUTCDATE()),DATEADD(MONTH,-6,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL);
GO

INSERT INTO [dbo].[Employees] ([Id],[EmployeeCode],[UserId],[FullName],[Email],[MobileNumber],[DateOfBirth],[Gender],[Role],[RolesJson],[Department],[Designation],[ReportingManagerId],[BusinessUnit],[WorkLocation],[Status],[UserType],[ProfilePhotoUrl],[PasswordHash],[PasswordSalt],[PasswordChangedAtUtc],[CreatedAtUtc],[UpdatedAtUtc],[UpdatedBy])
VALUES
('E0000001-0000-0000-0000-000000000015',N'EMP-0015',N'chopra.manish',N'Manish Chopra',      N'manish.chopra@arkiatechnology.com',    N'+91-9876543224',N'1984-12-02',N'Male',  N'Finance Admin',N'["Finance Admin","Employee"]',N'Finance', N'Finance Controller', NULL, N'Finance', N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-4,GETUTCDATE()),DATEADD(MONTH,-24,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000016',N'EMP-0016',N'reddy.kavya',  N'Kavya Reddy',        N'kavya.reddy@arkiatechnology.com',     N'+91-9876543225',N'1991-09-19',N'Female',N'Employee',  N'["Employee"]',N'Finance', N'Accountant', (SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0015'), N'Finance', N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-2,GETUTCDATE()),DATEADD(MONTH,-12,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000017',N'EMP-0017',N'mehta.akash',  N'Akash Mehta',        N'akash.mehta@arkiatechnology.com',     N'+91-9876543226',N'1993-11-30',N'Male',  N'Employee',  N'["Employee"]',N'Finance', N'Financial Analyst',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0015'), N'Finance', N'Hybrid',N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-1,GETUTCDATE()),DATEADD(MONTH,-8,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL);
GO

INSERT INTO [dbo].[Employees] ([Id],[EmployeeCode],[UserId],[FullName],[Email],[MobileNumber],[DateOfBirth],[Gender],[Role],[RolesJson],[Department],[Designation],[ReportingManagerId],[BusinessUnit],[WorkLocation],[Status],[UserType],[ProfilePhotoUrl],[PasswordHash],[PasswordSalt],[PasswordChangedAtUtc],[CreatedAtUtc],[UpdatedAtUtc],[UpdatedBy])
VALUES
('E0000001-0000-0000-0000-000000000018',N'EMP-0018',N'saxena.deepak',N'Deepak Saxena',      N'deepak.saxena@arkiatechnology.com',   N'+91-9876543227',N'1988-07-08',N'Male',  N'Team Manager',N'["Team Manager","Employee"]',N'Operations', N'Operations Manager', NULL, N'Operations', N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-3,GETUTCDATE()),DATEADD(MONTH,-20,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000019',N'EMP-0019',N'arya.ritu',    N'Ritu Arya',          N'ritu.arya@arkiatechnology.com',       N'+91-9876543228',N'1994-05-26',N'Female',N'Employee',  N'["Employee"]',N'Operations', N'Administrative Officer',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0018'), N'Operations', N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-1,GETUTCDATE()),DATEADD(MONTH,-10,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000020',N'EMP-0020',N'kohli.samar',  N'Samar Kohli',        N'samar.kohli@arkiatechnology.com',     N'+91-9876543229',N'1996-01-14',N'Male',  N'Employee',  N'["Employee"]',N'Operations', N'Facilities Coordinator',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0018'), N'Operations', N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-1,GETUTCDATE()),DATEADD(MONTH,-6,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL);
GO

INSERT INTO [dbo].[Employees] ([Id],[EmployeeCode],[UserId],[FullName],[Email],[MobileNumber],[DateOfBirth],[Gender],[Role],[RolesJson],[Department],[Designation],[ReportingManagerId],[BusinessUnit],[WorkLocation],[Status],[UserType],[ProfilePhotoUrl],[PasswordHash],[PasswordSalt],[PasswordChangedAtUtc],[CreatedAtUtc],[UpdatedAtUtc],[UpdatedBy])
VALUES
('E0000001-0000-0000-0000-000000000021',N'EMP-0021',N'iyer.ananya',  N'Ananya Iyer',        N'ananya.iyer@arkiatechnology.com',     N'+91-9876543230',N'1992-08-22',N'Female',N'Employee',  N'["Employee"]',N'Design', N'UI/UX Designer',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0003'), N'Design', N'Remote',N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-2,GETUTCDATE()),DATEADD(MONTH,-14,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000022',N'EMP-0022',N'sehgal.varun', N'Varun Sehgal',       N'varun.sehgal@arkiatechnology.com',    N'+91-9876543231',N'1995-03-09',N'Male',  N'Employee',  N'["Employee"]',N'Design', N'Graphic Designer',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0021'), N'Design', N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-1,GETUTCDATE()),DATEADD(MONTH,-8,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000023',N'EMP-0023',N'bose.tanya',   N'Tanya Bose',         N'tanya.bose@arkiatechnology.com',      N'+91-9876543232',N'1993-11-05',N'Female',N'Employee',  N'["Employee"]',N'Quality Assurance', N'QA Lead', (SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0003'), N'Quality Assurance',N'Hybrid',N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-2,GETUTCDATE()),DATEADD(MONTH,-12,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000024',N'EMP-0024',N'agrawal.vivek',N'Vivek Agrawal',      N'vivek.agrawal@arkiatechnology.com',   N'+91-9876543233',N'1996-07-28',N'Male',  N'Employee',  N'["Employee"]',N'Quality Assurance', N'QA Engineer',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0023'), N'Quality Assurance',N'Office', N'Active',N'Internal',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-1,GETUTCDATE()),DATEADD(MONTH,-6,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL),
('E0000001-0000-0000-0000-000000000025',N'EMP-0025',N'contract.anil',N'Anil Contractor',    N'anil.contractor@arkiatechnology.com',  N'+91-9876543234',N'1985-03-15',N'Male',  N'Employee',  N'["Employee"]',N'Engineering', N'Contract Developer',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0003'), N'Engineering', N'Remote',N'Active',N'Contractor',NULL,N'aXBhZC1zYW1wbGU=',
N'c2FsdC1zYW1wbGU=',DATEADD(MONTH,-1,GETUTCDATE()),DATEADD(MONTH,-4,GETUTCDATE()),DATEADD(DAY,-1,GETUTCDATE()),NULL);
GO

-- Update department heads
UPDATE [dbo].[Departments] SET [HeadEmployeeId] = (SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001') WHERE [Code] = N'ENG';
UPDATE [dbo].[Departments] SET [HeadEmployeeId] = (SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0008') WHERE [Code] = N'HR';
UPDATE [dbo].[Departments] SET [HeadEmployeeId] = (SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0011') WHERE [Code] = N'SM';
UPDATE [dbo].[Departments] SET [HeadEmployeeId] = (SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0015') WHERE [Code] = N'FIN';
UPDATE [dbo].[Departments] SET [HeadEmployeeId] = (SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0018') WHERE [Code] = N'OPS';
GO
