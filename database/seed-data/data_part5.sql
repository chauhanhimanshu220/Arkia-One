-- ============================================================================
-- 10. LEAVE REQUESTS (8 requests)
-- ============================================================================
INSERT INTO [dbo].[LeaveRequests] ([Id],[EmployeeId],[EmployeeName],[Department],[AdminId],[AdminName],[Type],[StartDate],[EndDate],[Days],[Reason],[Status],[ManagerApprovalStatus],[HRApprovalStatus],[AdminApprovalStatus],[ApprovedBy],[ApprovalFlowType],[CreatedAtUtc])
VALUES
('L0000001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),N'Neha Joshi',N'Engineering',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',N'Annual',DATEADD(DAY,-45,GETUTCDATE()),DATEADD(DAY,-40,GETUTCDATE()),5,N'Annual leave for family function in Pune.',N'Approved',N'Approved',N'Approved',N'Approved',N'Vikram Verma',N'ManagerThenHR',
DATEADD(DAY,-50,GETUTCDATE())),

('L0000001-0000-0000-0000-000000000002',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0005'),N'Arjun Kapoor',N'Engineering',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',N'Sick',DATEADD(DAY,-30,GETUTCDATE()),DATEADD(DAY,-29,GETUTCDATE()),2,N'Medical leave — severe cold and fever.',N'Approved',N'Approved',N'Approved',N'Approved',N'Vikram Verma',N'ManagerThenHR',
DATEADD(DAY,-31,GETUTCDATE())),

('L0000001-0000-0000-0000-000000000003',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0006'),N'Priya Rao',N'Engineering',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',N'Casual',DATEADD(DAY,-20,GETUTCDATE()),DATEADD(DAY,-18,GETUTCDATE()),2,N'Personal work — need to attend a family event.',N'Approved',N'Approved',N'Approved',N'Approved',N'Neha Joshi',N'ManagerThenHR',
DATEADD(DAY,-22,GETUTCDATE())),

('L0000001-0000-0000-0000-000000000004',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0021'),N'Ananya Iyer',N'Design',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',N'Annual',DATEADD(DAY,-15,GETUTCDATE()),DATEADD(DAY,-10,GETUTCDATE()),5,N'Vacation to Kerala.',N'Approved',N'Approved',N'Approved',N'Approved',N'Vikram Verma',N'ManagerThenHR',
DATEADD(DAY,-18,GETUTCDATE())),

('L0000001-0000-0000-0000-000000000005',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0009'),N'Rahul Gupta',N'Human Resources',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0008'),N'Meera Singh',N'Personal',DATEADD(DAY,-8,GETUTCDATE()),DATEADD(DAY,-7,GETUTCDATE()),1,N'Personal appointment.',N'Approved',N'Approved',N'Approved',N'Approved',N'Meera Singh',N'ManagerThenHR',
DATEADD(DAY,-10,GETUTCDATE())),

('L0000001-0000-0000-0000-000000000006',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0013'),N'Rohit Khanna',N'Sales & Marketing',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0011'),N'Karan Desai',N'Sick',DATEADD(DAY,-5,GETUTCDATE()),DATEADD(DAY,-4,GETUTCDATE()),1,N'Not feeling well — rest advised by doctor.',N'Approved',N'Approved',N'Approved',N'Approved',N'Karan Desai',N'ManagerThenHR',
DATEADD(DAY,-6,GETUTCDATE())),

('L0000001-0000-0000-0000-000000000007',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0007'),N'Amit Thakur',N'Engineering',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Rajesh Sharma',N'Annual',DATEADD(DAY,10,GETUTCDATE()),DATEADD(DAY,15,GETUTCDATE()),5,N'Planned family vacation.',N'Pending',N'Pending',N'Pending',N'Pending',N'',N'ManagerThenHR',
DATEADD(DAY,-2,GETUTCDATE())),

('L0000001-0000-0000-0000-000000000008',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0017'),N'Akash Mehta',N'Finance',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0015'),N'Manish Chopra',N'Casual',DATEADD(DAY,5,GETUTCDATE()),DATEADD(DAY,5,GETUTCDATE()),1,N'Personal day off.',N'Submitted',N'Pending',N'Pending',N'Pending',N'',N'ManagerThenHR',
DATEADD(DAY,-1,GETUTCDATE()));
GO
