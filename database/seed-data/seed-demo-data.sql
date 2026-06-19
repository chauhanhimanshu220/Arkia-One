SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

DECLARE @ExistingDemoEmployees TABLE (Id uniqueidentifier PRIMARY KEY);
DECLARE @ExistingDemoProjects TABLE (Id uniqueidentifier PRIMARY KEY);

INSERT INTO @ExistingDemoEmployees (Id)
SELECT Id
FROM Employees
WHERE Email LIKE '%@demo.timesheet.local';

INSERT INTO @ExistingDemoProjects (Id)
SELECT Id
FROM Projects
WHERE Code LIKE 'DEMO-%';

DELETE FROM DailyTimesheetEntries
WHERE DailyTimesheetId IN (
    SELECT Id
    FROM DailyTimesheets
    WHERE UserId IN (SELECT Id FROM @ExistingDemoEmployees)
);

DELETE FROM DailyTimesheets
WHERE UserId IN (SELECT Id FROM @ExistingDemoEmployees);

DELETE FROM WeeklyTimesheets
WHERE UserId IN (SELECT Id FROM @ExistingDemoEmployees);

DELETE FROM LeaveRequests
WHERE EmployeeId IN (SELECT Id FROM @ExistingDemoEmployees);

DELETE FROM TaskAssignments
WHERE AssignedTo IN (SELECT Id FROM @ExistingDemoEmployees)
   OR ProjectId IN (SELECT Id FROM @ExistingDemoProjects);

DELETE FROM Projects
WHERE Id IN (SELECT Id FROM @ExistingDemoProjects);

DELETE FROM Employees
WHERE Id IN (SELECT Id FROM @ExistingDemoEmployees);

INSERT INTO Employees (Id, FullName, Email, Role, Department, Status, CreatedAtUtc)
VALUES
    ('90111111-1111-1111-1111-111111111101', N'Dheeraj Malhotra', N'dheeraj.admin@demo.timesheet.local', N'System Admin', N'Operations', N'Active', '2026-04-05T09:00:00'),
    ('90111111-1111-1111-1111-111111111102', N'Nisha Rao', N'nisha.hr@demo.timesheet.local', N'HR Manager', N'Human Resources', N'Active', '2026-04-05T09:01:00'),
    ('90111111-1111-1111-1111-111111111103', N'Karan Patel', N'karan.finance@demo.timesheet.local', N'Finance Admin', N'Finance', N'Active', '2026-04-05T09:02:00'),
    ('90111111-1111-1111-1111-111111111104', N'Kavya Singh', N'kavya.manager@demo.timesheet.local', N'Team Manager', N'Engineering', N'Active', '2026-04-05T09:03:00'),
    ('90111111-1111-1111-1111-111111111105', N'Mohit Sethi', N'mohit.manager@demo.timesheet.local', N'Team Manager', N'Operations', N'Active', '2026-04-05T09:04:00'),
    ('90111111-1111-1111-1111-111111111106', N'Aisha Khan', N'aisha@demo.timesheet.local', N'Employee', N'Engineering', N'Active', '2026-04-05T09:05:00'),
    ('90111111-1111-1111-1111-111111111107', N'Rohan Verma', N'rohan@demo.timesheet.local', N'Employee', N'Engineering', N'Active', '2026-04-05T09:06:00'),
    ('90111111-1111-1111-1111-111111111108', N'Sneha Iyer', N'sneha@demo.timesheet.local', N'Employee', N'Design', N'Active', '2026-04-05T09:07:00'),
    ('90111111-1111-1111-1111-111111111109', N'Vivek Sharma', N'vivek@demo.timesheet.local', N'Employee', N'Finance', N'Active', '2026-04-05T09:08:00'),
    ('90111111-1111-1111-1111-111111111110', N'Naina Joshi', N'naina@demo.timesheet.local', N'Employee', N'Engineering', N'Active', '2026-04-05T09:09:00'),
    ('90111111-1111-1111-1111-111111111111', N'Farhan Ali', N'farhan@demo.timesheet.local', N'Employee', N'Design', N'Active', '2026-04-05T09:10:00'),
    ('90111111-1111-1111-1111-111111111112', N'Pooja Menon', N'pooja@demo.timesheet.local', N'Employee', N'Human Resources', N'Active', '2026-04-05T09:11:00');

INSERT INTO Projects (
    Id, Name, Code, Description, ClientBusinessUnit, Department, AdminId, AdminName, ManagerId, ManagerName,
    ProjectLead, DeliveryModel, TeamMemberIdsJson, TeamMemberNamesJson, TeamSize, Budget, Priority, Status,
    StartDate, EndDate, IsBillable, CreatedAtUtc
)
VALUES
    (
        '90222222-2222-2222-2222-222222222201',
        N'Atlas Portal Revamp',
        N'DEMO-ENG-001',
        N'Customer portal rebuild used for engineering and approval workflow testing.',
        N'Client Success',
        N'Engineering',
        '90111111-1111-1111-1111-111111111101',
        N'Dheeraj Malhotra',
        '90111111-1111-1111-1111-111111111104',
        N'Kavya Singh',
        N'Kavya Singh',
        N'Dedicated Squad',
        N'["90111111-1111-1111-1111-111111111104","90111111-1111-1111-1111-111111111106","90111111-1111-1111-1111-111111111107","90111111-1111-1111-1111-111111111110"]',
        N'["Kavya Singh","Aisha Khan","Rohan Verma","Naina Joshi"]',
        4,
        180000.00,
        N'High',
        N'Active',
        '2026-03-16',
        '2026-05-30',
        1,
        '2026-04-05T09:20:00'
    ),
    (
        '90222222-2222-2222-2222-222222222202',
        N'Payroll Compliance Rollout',
        N'DEMO-FIN-001',
        N'Payroll and billing readiness project for finance workflow checks.',
        N'Finance Transformation',
        N'Finance',
        '90111111-1111-1111-1111-111111111101',
        N'Dheeraj Malhotra',
        '90111111-1111-1111-1111-111111111103',
        N'Karan Patel',
        N'Karan Patel',
        N'Hybrid Delivery',
        N'["90111111-1111-1111-1111-111111111103","90111111-1111-1111-1111-111111111109","90111111-1111-1111-1111-111111111102"]',
        N'["Karan Patel","Vivek Sharma","Nisha Rao"]',
        3,
        145000.00,
        N'Medium',
        N'Active',
        '2026-03-23',
        '2026-06-12',
        1,
        '2026-04-05T09:21:00'
    ),
    (
        '90222222-2222-2222-2222-222222222203',
        N'People Ops Automation',
        N'DEMO-HR-001',
        N'Leave, onboarding, and policy workflow automation demo project.',
        N'People Operations',
        N'Human Resources',
        '90111111-1111-1111-1111-111111111101',
        N'Dheeraj Malhotra',
        '90111111-1111-1111-1111-111111111102',
        N'Nisha Rao',
        N'Nisha Rao',
        N'Shared Services',
        N'["90111111-1111-1111-1111-111111111102","90111111-1111-1111-1111-111111111112","90111111-1111-1111-1111-111111111105"]',
        N'["Nisha Rao","Pooja Menon","Mohit Sethi"]',
        3,
        95000.00,
        N'Medium',
        N'Active',
        '2026-03-30',
        '2026-05-15',
        0,
        '2026-04-05T09:22:00'
    ),
    (
        '90222222-2222-2222-2222-222222222204',
        N'Design System Sprint',
        N'DEMO-DES-001',
        N'Design consistency and component polish workstream for UI review.',
        N'Product Experience',
        N'Design',
        '90111111-1111-1111-1111-111111111101',
        N'Dheeraj Malhotra',
        '90111111-1111-1111-1111-111111111105',
        N'Mohit Sethi',
        N'Mohit Sethi',
        N'Specialist Pod',
        N'["90111111-1111-1111-1111-111111111108","90111111-1111-1111-1111-111111111111"]',
        N'["Sneha Iyer","Farhan Ali"]',
        2,
        72000.00,
        N'High',
        N'Active',
        '2026-03-30',
        '2026-05-01',
        1,
        '2026-04-05T09:23:00'
    ),
    (
        '90222222-2222-2222-2222-222222222205',
        N'Operations BI Launch',
        N'DEMO-OPS-001',
        N'Operations dashboards and anomaly reporting for leadership reviews.',
        N'Operations Excellence',
        N'Operations',
        '90111111-1111-1111-1111-111111111101',
        N'Dheeraj Malhotra',
        '90111111-1111-1111-1111-111111111105',
        N'Mohit Sethi',
        N'Mohit Sethi',
        N'Matrix Team',
        N'["90111111-1111-1111-1111-111111111105","90111111-1111-1111-1111-111111111106","90111111-1111-1111-1111-111111111109"]',
        N'["Mohit Sethi","Aisha Khan","Vivek Sharma"]',
        3,
        160000.00,
        N'High',
        N'Active',
        '2026-03-30',
        '2026-06-26',
        1,
        '2026-04-05T09:24:00'
    );

INSERT INTO TaskAssignments (
    Id, ProjectId, ProjectName, AssignedTo, AssignedToName, Title, Description, StartDate, EndDate, TotalHours, Status, CreatedAtUtc
)
VALUES
    ('90333333-3333-3333-3333-333333333301', '90222222-2222-2222-2222-222222222201', N'Atlas Portal Revamp', '90111111-1111-1111-1111-111111111106', N'Aisha Khan', N'API integration sprint', N'Connect portal forms with backend APIs and close integration gaps.', '2026-03-30', '2026-04-18', 48, N'In Progress', '2026-04-05T09:30:00'),
    ('90333333-3333-3333-3333-333333333302', '90222222-2222-2222-2222-222222222201', N'Atlas Portal Revamp', '90111111-1111-1111-1111-111111111107', N'Rohan Verma', N'Approval workflow polish', N'Finalize approval steps, routing, and manager review states.', '2026-03-30', '2026-04-18', 42, N'In Progress', '2026-04-05T09:31:00'),
    ('90333333-3333-3333-3333-333333333303', '90222222-2222-2222-2222-222222222201', N'Atlas Portal Revamp', '90111111-1111-1111-1111-111111111110', N'Naina Joshi', N'Regression test pack', N'Run QA scenarios for portal releases and approval edge cases.', '2026-03-31', '2026-04-19', 44, N'In Progress', '2026-04-05T09:32:00'),
    ('90333333-3333-3333-3333-333333333304', '90222222-2222-2222-2222-222222222202', N'Payroll Compliance Rollout', '90111111-1111-1111-1111-111111111109', N'Vivek Sharma', N'Payroll export mapping', N'Validate export format and earnings code mapping for payroll.', '2026-03-30', '2026-04-17', 32, N'In Progress', '2026-04-05T09:33:00'),
    ('90333333-3333-3333-3333-333333333305', '90222222-2222-2222-2222-222222222202', N'Payroll Compliance Rollout', '90111111-1111-1111-1111-111111111103', N'Karan Patel', N'Reconciliation board', N'Prepare finance reconciliation dashboard and risk tracker.', '2026-03-30', '2026-04-11', 24, N'In Progress', '2026-04-05T09:34:00'),
    ('90333333-3333-3333-3333-333333333306', '90222222-2222-2222-2222-222222222202', N'Payroll Compliance Rollout', '90111111-1111-1111-1111-111111111102', N'Nisha Rao', N'Exception rule review', N'Cross-check payroll exceptions against leave and attendance rules.', '2026-03-31', '2026-04-15', 20, N'To Do', '2026-04-05T09:35:00'),
    ('90333333-3333-3333-3333-333333333307', '90222222-2222-2222-2222-222222222203', N'People Ops Automation', '90111111-1111-1111-1111-111111111112', N'Pooja Menon', N'Leave policy matrix', N'Document leave types, balances, and policy decision rules.', '2026-03-30', '2026-04-14', 18, N'Completed', '2026-04-05T09:36:00'),
    ('90333333-3333-3333-3333-333333333308', '90222222-2222-2222-2222-222222222203', N'People Ops Automation', '90111111-1111-1111-1111-111111111102', N'Nisha Rao', N'Onboarding checklist', N'Standardize onboarding workflow checkpoints and approvals.', '2026-03-30', '2026-04-16', 20, N'In Progress', '2026-04-05T09:37:00'),
    ('90333333-3333-3333-3333-333333333309', '90222222-2222-2222-2222-222222222204', N'Design System Sprint', '90111111-1111-1111-1111-111111111108', N'Sneha Iyer', N'Component audit', N'Audit layout components and accessibility states before release.', '2026-03-30', '2026-04-12', 30, N'In Progress', '2026-04-05T09:38:00'),
    ('90333333-3333-3333-3333-333333333310', '90222222-2222-2222-2222-222222222204', N'Design System Sprint', '90111111-1111-1111-1111-111111111111', N'Farhan Ali', N'Icon cleanup', N'Normalize icon sizes, exports, and sidebar states.', '2026-03-30', '2026-04-12', 36, N'In Progress', '2026-04-05T09:39:00'),
    ('90333333-3333-3333-3333-333333333311', '90222222-2222-2222-2222-222222222205', N'Operations BI Launch', '90111111-1111-1111-1111-111111111105', N'Mohit Sethi', N'BI pipeline launch', N'Own rollout checklist and stakeholder sync for BI launch.', '2026-03-30', '2026-04-19', 28, N'In Progress', '2026-04-05T09:40:00'),
    ('90333333-3333-3333-3333-333333333312', '90222222-2222-2222-2222-222222222205', N'Operations BI Launch', '90111111-1111-1111-1111-111111111106', N'Aisha Khan', N'Attendance anomaly report', N'Build anomaly slices for missing hours and delayed submissions.', '2026-03-30', '2026-04-19', 12, N'In Progress', '2026-04-05T09:41:00'),
    ('90333333-3333-3333-3333-333333333313', '90222222-2222-2222-2222-222222222205', N'Operations BI Launch', '90111111-1111-1111-1111-111111111109', N'Vivek Sharma', N'Budget watchlist', N'Prepare budget threshold views for project and department leads.', '2026-03-30', '2026-04-19', 16, N'To Do', '2026-04-05T09:42:00'),
    ('90333333-3333-3333-3333-333333333314', '90222222-2222-2222-2222-222222222203', N'People Ops Automation', '90111111-1111-1111-1111-111111111105', N'Mohit Sethi', N'Escalation routing', N'Define escalations for overdue approvals and employee exceptions.', '2026-03-31', '2026-04-17', 22, N'In Progress', '2026-04-05T09:43:00');

INSERT INTO DailyTimesheets (Id, UserId, Date, Status, TotalHours, UpdatedAtUtc)
VALUES
    ('90444444-4444-4444-4444-444444444401', '90111111-1111-1111-1111-111111111106', '2026-03-31', N'Submitted', 8, '2026-04-05T10:00:00'),
    ('90444444-4444-4444-4444-444444444402', '90111111-1111-1111-1111-111111111106', '2026-04-01', N'Submitted', 7, '2026-04-05T10:01:00'),
    ('90444444-4444-4444-4444-444444444403', '90111111-1111-1111-1111-111111111107', '2026-04-01', N'Submitted', 8, '2026-04-05T10:02:00'),
    ('90444444-4444-4444-4444-444444444404', '90111111-1111-1111-1111-111111111108', '2026-04-02', N'Submitted', 6, '2026-04-05T10:03:00'),
    ('90444444-4444-4444-4444-444444444405', '90111111-1111-1111-1111-111111111109', '2026-04-03', N'Draft', 4, '2026-04-05T10:04:00'),
    ('90444444-4444-4444-4444-444444444406', '90111111-1111-1111-1111-111111111110', '2026-04-04', N'Submitted', 6, '2026-04-05T10:05:00'),
    ('90444444-4444-4444-4444-444444444407', '90111111-1111-1111-1111-111111111111', '2026-04-04', N'Submitted', 5, '2026-04-05T10:06:00'),
    ('90444444-4444-4444-4444-444444444408', '90111111-1111-1111-1111-111111111103', '2026-04-02', N'Submitted', 4, '2026-04-05T10:07:00'),
    ('90444444-4444-4444-4444-444444444409', '90111111-1111-1111-1111-111111111105', '2026-04-03', N'Submitted', 5, '2026-04-05T10:08:00'),
    ('90444444-4444-4444-4444-444444444410', '90111111-1111-1111-1111-111111111112', '2026-04-01', N'Submitted', 4, '2026-04-05T10:09:00');

INSERT INTO DailyTimesheetEntries (Id, DailyTimesheetId, TaskId, TaskTitle, Hours, WorkDescription)
VALUES
    ('90555555-5555-5555-5555-555555555501', '90444444-4444-4444-4444-444444444401', '90333333-3333-3333-3333-333333333301', N'API integration sprint', 6, N'Integrated project APIs and fixed request payloads.'),
    ('90555555-5555-5555-5555-555555555502', '90444444-4444-4444-4444-444444444401', '90333333-3333-3333-3333-333333333312', N'Attendance anomaly report', 2, N'Reviewed anomaly widgets and filtered false positives.'),
    ('90555555-5555-5555-5555-555555555503', '90444444-4444-4444-4444-444444444402', '90333333-3333-3333-3333-333333333301', N'API integration sprint', 5, N'Closed API validation gaps and updated request handling.'),
    ('90555555-5555-5555-5555-555555555504', '90444444-4444-4444-4444-444444444402', '90333333-3333-3333-3333-333333333312', N'Attendance anomaly report', 2, N'Prepared missing-timesheet anomaly summaries.'),
    ('90555555-5555-5555-5555-555555555505', '90444444-4444-4444-4444-444444444403', '90333333-3333-3333-3333-333333333302', N'Approval workflow polish', 8, N'Updated approval state handling and routing conditions.'),
    ('90555555-5555-5555-5555-555555555506', '90444444-4444-4444-4444-444444444404', '90333333-3333-3333-3333-333333333309', N'Component audit', 6, N'Audited component states and accessibility regressions.'),
    ('90555555-5555-5555-5555-555555555507', '90444444-4444-4444-4444-444444444405', '90333333-3333-3333-3333-333333333304', N'Payroll export mapping', 4, N'Drafted initial export-field mapping notes.'),
    ('90555555-5555-5555-5555-555555555508', '90444444-4444-4444-4444-444444444406', '90333333-3333-3333-3333-333333333303', N'Regression test pack', 6, N'Ran QA scenarios for weekly approvals and dashboard views.'),
    ('90555555-5555-5555-5555-555555555509', '90444444-4444-4444-4444-444444444407', '90333333-3333-3333-3333-333333333310', N'Icon cleanup', 5, N'Cleaned icon spacing and standardized sidebar assets.'),
    ('90555555-5555-5555-5555-555555555510', '90444444-4444-4444-4444-444444444408', '90333333-3333-3333-3333-333333333305', N'Reconciliation board', 4, N'Reviewed finance reconciliation widgets for latest period.'),
    ('90555555-5555-5555-5555-555555555511', '90444444-4444-4444-4444-444444444409', '90333333-3333-3333-3333-333333333311', N'BI pipeline launch', 5, N'Prepared rollout checklist and stakeholder update.'),
    ('90555555-5555-5555-5555-555555555512', '90444444-4444-4444-4444-444444444410', '90333333-3333-3333-3333-333333333307', N'Leave policy matrix', 4, N'Consolidated leave policy matrix for HR review.');

INSERT INTO WeeklyTimesheets (Id, UserId, AdminId, AdminName, WeekStart, WeekEnd, Status, TotalHours, RowsJson, UpdatedAtUtc)
VALUES
    (
        '90666666-6666-6666-6666-666666666601',
        '90111111-1111-1111-1111-111111111106',
        '90111111-1111-1111-1111-111111111104',
        N'Kavya Singh',
        '2026-03-30',
        '2026-04-05',
        N'Approved',
        40,
        N'[{"id":"aisha-row-1","projectId":"90222222-2222-2222-2222-222222222201","projectName":"Atlas Portal Revamp","taskName":"API integration sprint","notes":"API sprint and bug fixes","billable":true,"hours":{"2026-03-30":7,"2026-03-31":7,"2026-04-01":6,"2026-04-02":6,"2026-04-03":6,"2026-04-04":4,"2026-04-05":0}},{"id":"aisha-row-2","projectId":"90222222-2222-2222-2222-222222222205","projectName":"Operations BI Launch","taskName":"Attendance anomaly report","notes":"Dashboard anomaly review","billable":false,"hours":{"2026-03-30":1,"2026-03-31":1,"2026-04-01":1,"2026-04-02":1,"2026-04-03":0,"2026-04-04":0,"2026-04-05":0}}]',
        '2026-04-05T11:00:00'
    ),
    (
        '90666666-6666-6666-6666-666666666602',
        '90111111-1111-1111-1111-111111111107',
        '90111111-1111-1111-1111-111111111104',
        N'Kavya Singh',
        '2026-03-30',
        '2026-04-05',
        N'Submitted',
        42,
        N'[{"id":"rohan-row-1","projectId":"90222222-2222-2222-2222-222222222201","projectName":"Atlas Portal Revamp","taskName":"Approval workflow polish","notes":"Manager routing and review polish","billable":true,"hours":{"2026-03-30":8,"2026-03-31":8,"2026-04-01":8,"2026-04-02":6,"2026-04-03":6,"2026-04-04":6,"2026-04-05":0}}]',
        '2026-04-05T11:01:00'
    ),
    (
        '90666666-6666-6666-6666-666666666603',
        '90111111-1111-1111-1111-111111111108',
        '90111111-1111-1111-1111-111111111105',
        N'Mohit Sethi',
        '2026-03-30',
        '2026-04-05',
        N'Rejected',
        30,
        N'[{"id":"sneha-row-1","projectId":"90222222-2222-2222-2222-222222222204","projectName":"Design System Sprint","taskName":"Component audit","notes":"Accessibility pass before release","billable":true,"hours":{"2026-03-30":6,"2026-03-31":6,"2026-04-01":6,"2026-04-02":4,"2026-04-03":4,"2026-04-04":4,"2026-04-05":0}}]',
        '2026-04-05T11:02:00'
    ),
    (
        '90666666-6666-6666-6666-666666666604',
        '90111111-1111-1111-1111-111111111109',
        '90111111-1111-1111-1111-111111111103',
        N'Karan Patel',
        '2026-03-30',
        '2026-04-05',
        N'Draft',
        24,
        N'[{"id":"vivek-row-1","projectId":"90222222-2222-2222-2222-222222222202","projectName":"Payroll Compliance Rollout","taskName":"Payroll export mapping","notes":"Export template preparation","billable":true,"hours":{"2026-03-30":4,"2026-03-31":4,"2026-04-01":4,"2026-04-02":4,"2026-04-03":4,"2026-04-04":4,"2026-04-05":0}}]',
        '2026-04-05T11:03:00'
    ),
    (
        '90666666-6666-6666-6666-666666666605',
        '90111111-1111-1111-1111-111111111110',
        '90111111-1111-1111-1111-111111111104',
        N'Kavya Singh',
        '2026-03-30',
        '2026-04-05',
        N'Approved',
        44,
        N'[{"id":"naina-row-1","projectId":"90222222-2222-2222-2222-222222222201","projectName":"Atlas Portal Revamp","taskName":"Regression test pack","notes":"Regression coverage and release QA","billable":true,"hours":{"2026-03-30":8,"2026-03-31":8,"2026-04-01":8,"2026-04-02":8,"2026-04-03":6,"2026-04-04":6,"2026-04-05":0}}]',
        '2026-04-05T11:04:00'
    ),
    (
        '90666666-6666-6666-6666-666666666606',
        '90111111-1111-1111-1111-111111111111',
        '90111111-1111-1111-1111-111111111105',
        N'Mohit Sethi',
        '2026-03-30',
        '2026-04-05',
        N'Submitted',
        35,
        N'[{"id":"farhan-row-1","projectId":"90222222-2222-2222-2222-222222222204","projectName":"Design System Sprint","taskName":"Icon cleanup","notes":"Visual cleanup and asset exports","billable":true,"hours":{"2026-03-30":6,"2026-03-31":6,"2026-04-01":6,"2026-04-02":6,"2026-04-03":6,"2026-04-04":5,"2026-04-05":0}}]',
        '2026-04-05T11:05:00'
    ),
    (
        '90666666-6666-6666-6666-666666666607',
        '90111111-1111-1111-1111-111111111103',
        '90111111-1111-1111-1111-111111111101',
        N'Dheeraj Malhotra',
        '2026-03-30',
        '2026-04-05',
        N'Submitted',
        20,
        N'[{"id":"karan-row-1","projectId":"90222222-2222-2222-2222-222222222202","projectName":"Payroll Compliance Rollout","taskName":"Reconciliation board","notes":"Finance exception board review","billable":true,"hours":{"2026-03-30":4,"2026-03-31":4,"2026-04-01":4,"2026-04-02":4,"2026-04-03":4,"2026-04-04":0,"2026-04-05":0}}]',
        '2026-04-05T11:06:00'
    ),
    (
        '90666666-6666-6666-6666-666666666608',
        '90111111-1111-1111-1111-111111111105',
        '90111111-1111-1111-1111-111111111101',
        N'Dheeraj Malhotra',
        '2026-03-30',
        '2026-04-05',
        N'Approved',
        28,
        N'[{"id":"mohit-row-1","projectId":"90222222-2222-2222-2222-222222222205","projectName":"Operations BI Launch","taskName":"BI pipeline launch","notes":"Launch planning and stakeholder sync","billable":true,"hours":{"2026-03-30":5,"2026-03-31":5,"2026-04-01":5,"2026-04-02":5,"2026-04-03":4,"2026-04-04":4,"2026-04-05":0}}]',
        '2026-04-05T11:07:00'
    );

INSERT INTO LeaveRequests (
    Id, EmployeeId, EmployeeName, Department, AdminId, AdminName, Type, StartDate, EndDate, Days, Reason, Status, CreatedAtUtc
)
VALUES
    ('90777777-7777-7777-7777-777777777701', '90111111-1111-1111-1111-111111111107', N'Rohan Verma', N'Engineering', '90111111-1111-1111-1111-111111111104', N'Kavya Singh', N'Casual Leave', '2026-04-10', '2026-04-11', 2, N'Family function travel.', N'Pending', '2026-04-05T11:20:00'),
    ('90777777-7777-7777-7777-777777777702', '90111111-1111-1111-1111-111111111108', N'Sneha Iyer', N'Design', '90111111-1111-1111-1111-111111111102', N'Nisha Rao', N'Sick Leave', '2026-04-07', '2026-04-08', 2, N'Recovery and medical rest.', N'Approved', '2026-04-05T11:21:00'),
    ('90777777-7777-7777-7777-777777777703', '90111111-1111-1111-1111-111111111109', N'Vivek Sharma', N'Finance', '90111111-1111-1111-1111-111111111103', N'Karan Patel', N'Earned Leave', '2026-04-15', '2026-04-17', 3, N'Long weekend travel plan.', N'Rejected', '2026-04-05T11:22:00'),
    ('90777777-7777-7777-7777-777777777704', '90111111-1111-1111-1111-111111111112', N'Pooja Menon', N'Human Resources', '90111111-1111-1111-1111-111111111102', N'Nisha Rao', N'Work From Home', '2026-04-06', '2026-04-06', 1, N'Planned remote support for onboarding tasks.', N'Approved', '2026-04-05T11:23:00'),
    ('90777777-7777-7777-7777-777777777705', '90111111-1111-1111-1111-111111111106', N'Aisha Khan', N'Engineering', '90111111-1111-1111-1111-111111111104', N'Kavya Singh', N'Casual Leave', '2026-04-20', '2026-04-20', 1, N'Personal errand day.', N'Pending', '2026-04-05T11:24:00'),
    ('90777777-7777-7777-7777-777777777706', '90111111-1111-1111-1111-111111111110', N'Naina Joshi', N'Engineering', '90111111-1111-1111-1111-111111111104', N'Kavya Singh', N'Earned Leave', '2026-04-27', '2026-04-29', 3, N'Planned vacation block.', N'Approved', '2026-04-05T11:25:00');

COMMIT TRANSACTION;
