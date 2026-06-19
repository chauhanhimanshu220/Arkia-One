-- ============================================================================
-- ARKIA ONE WORKFORCE PLATFORM — DATABASE SCHEMA ONLY
-- Engine: SQL Server (LocalDB / Express / Standard)
-- ============================================================================

IF DB_ID(N'Timesheet') IS NULL
    CREATE DATABASE [Timesheet];
GO

USE [Timesheet];
GO

-- ============================================================================
-- TABLES (in dependency order)
-- ============================================================================

-- 1. DEPARTMENTS
IF OBJECT_ID(N'[dbo].[Departments]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Departments] (
        [Id]                uniqueidentifier NOT NULL,
        [Name]              nvarchar(200)    NOT NULL,
        [Code]              nvarchar(50)     NOT NULL,
        [Description]       nvarchar(1000)   NOT NULL,
        [ParentDepartmentId] uniqueidentifier NULL,
        [HeadEmployeeId]    uniqueidentifier NULL,
        [EmailAlias]        nvarchar(200)    NOT NULL,
        [CostCenter]        nvarchar(100)    NOT NULL,
        [Status]            nvarchar(50)     NOT NULL,
        [CreatedAtUtc]      datetime2        NOT NULL,
        [UpdatedAtUtc]      datetime2        NOT NULL,
        CONSTRAINT [PK_Departments] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE UNIQUE INDEX [IX_Departments_Name] ON [dbo].[Departments] ([Name]);
    CREATE UNIQUE INDEX [IX_Departments_Code] ON [dbo].[Departments] ([Code]);
END
GO

-- 2. EMPLOYEES
IF OBJECT_ID(N'[dbo].[Employees]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Employees] (
        [Id]                 uniqueidentifier NOT NULL,
        [EmployeeCode]       nvarchar(50)     NOT NULL,
        [UserId]             nvarchar(100)    NOT NULL,
        [FullName]           nvarchar(200)    NOT NULL,
        [Email]              nvarchar(200)    NOT NULL,
        [MobileNumber]       nvarchar(30)     NOT NULL,
        [DateOfBirth]        date             NULL,
        [Gender]             nvarchar(50)     NOT NULL,
        [Role]               nvarchar(50)     NOT NULL,
        [RolesJson]          nvarchar(max)    NOT NULL,
        [Department]         nvarchar(100)    NOT NULL,
        [Designation]        nvarchar(100)    NOT NULL,
        [ReportingManagerId] uniqueidentifier NULL,
        [BusinessUnit]       nvarchar(100)    NOT NULL,
        [WorkLocation]       nvarchar(50)     NOT NULL,
        [Status]             nvarchar(50)     NOT NULL,
        [UserType]           nvarchar(50)     NOT NULL,
        [ProfilePhotoUrl]    nvarchar(500)    NULL,
        [PasswordHash]       nvarchar(256)    NOT NULL,
        [PasswordSalt]       nvarchar(256)    NOT NULL,
        [PasswordChangedAtUtc] datetime2      NULL,
        [CreatedAtUtc]       datetime2        NOT NULL,
        [UpdatedAtUtc]       datetime2        NOT NULL,
        [UpdatedBy]          uniqueidentifier NULL,
        CONSTRAINT [PK_Employees] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE UNIQUE INDEX [IX_Employees_Email]         ON [dbo].[Employees] ([Email]);
    CREATE UNIQUE INDEX [IX_Employees_EmployeeCode]  ON [dbo].[Employees] ([EmployeeCode]);
    CREATE UNIQUE INDEX [IX_Employees_UserId]        ON [dbo].[Employees] ([UserId]);

    ALTER TABLE [dbo].[Employees] ADD CONSTRAINT [FK_Employees_ReportingManager]
        FOREIGN KEY ([ReportingManagerId]) REFERENCES [dbo].[Employees] ([Id]);
END
GO

-- 3. ACCOUNT AUDIT LOGS
IF OBJECT_ID(N'[dbo].[AccountAuditLogs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AccountAuditLogs] (
        [Id]            uniqueidentifier NOT NULL,
        [SubjectUserId] uniqueidentifier NOT NULL,
        [ActorUserId]   uniqueidentifier NOT NULL,
        [Action]        nvarchar(100)    NOT NULL,
        [Detail]        nvarchar(500)    NOT NULL,
        [IpAddress]     nvarchar(64)     NOT NULL,
        [UserAgent]     nvarchar(1024)   NOT NULL,
        [CreatedAtUtc]  datetime2        NOT NULL,
        CONSTRAINT [PK_AccountAuditLogs] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE INDEX [IX_AccountAuditLogs_SubjectUserId] ON [dbo].[AccountAuditLogs] ([SubjectUserId]);
    CREATE INDEX [IX_AccountAuditLogs_ActorUserId]   ON [dbo].[AccountAuditLogs] ([ActorUserId]);
    CREATE INDEX [IX_AccountAuditLogs_CreatedAtUtc]  ON [dbo].[AccountAuditLogs] ([CreatedAtUtc]);
END
GO

-- 4. FINANCE SETTINGS
IF OBJECT_ID(N'[dbo].[FinanceSettings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[FinanceSettings] (
        [Id]           uniqueidentifier NOT NULL,
        [Category]     nvarchar(80)     NOT NULL,
        [Key]          nvarchar(120)    NOT NULL,
        [Name]         nvarchar(200)    NOT NULL,
        [Description]  nvarchar(1000)   NOT NULL,
        [Status]       nvarchar(50)     NOT NULL,
        [DataJson]     nvarchar(max)    NOT NULL,
        [CreatedAtUtc] datetime2        NOT NULL,
        [UpdatedAtUtc] datetime2        NOT NULL,
        [UpdatedBy]    nvarchar(200)    NOT NULL,
        CONSTRAINT [PK_FinanceSettings] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE UNIQUE INDEX [IX_FinanceSettings_Category_Key] ON [dbo].[FinanceSettings] ([Category], [Key]);
    CREATE INDEX [IX_FinanceSettings_Category]             ON [dbo].[FinanceSettings] ([Category]);
END
GO

-- 5. PROJECTS
IF OBJECT_ID(N'[dbo].[Projects]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Projects] (
        [Id]                       uniqueidentifier NOT NULL,
        [Name]                     nvarchar(200)    NOT NULL,
        [Code]                     nvarchar(100)    NOT NULL,
        [Description]              nvarchar(max)    NOT NULL,
        [ClientBusinessUnit]       nvarchar(200)    NOT NULL,
        [Department]               nvarchar(100)    NOT NULL,
        [AdminId]                  uniqueidentifier NOT NULL,
        [AdminName]                nvarchar(200)    NOT NULL,
        [ManagerId]                uniqueidentifier NOT NULL,
        [ManagerName]              nvarchar(200)    NOT NULL,
        [ManagerRolePromotionApplied] bit           NOT NULL,
        [ManagerOriginalRole]      nvarchar(50)     NOT NULL,
        [ManagerOriginalRolesJson] nvarchar(max)    NOT NULL,
        [ProjectLead]              nvarchar(200)    NOT NULL,
        [DeliveryModel]            nvarchar(100)    NOT NULL,
        [TeamMemberIdsJson]        nvarchar(max)    NOT NULL,
        [TeamMemberNamesJson]      nvarchar(max)    NOT NULL,
        [TeamSize]                 int              NOT NULL,
        [Budget]                   decimal(18,2)    NOT NULL,
        [Priority]                 nvarchar(50)     NOT NULL,
        [Status]                   nvarchar(50)     NOT NULL,
        [StartDate]                date             NOT NULL,
        [EndDate]                  date             NOT NULL,
        [IsBillable]               bit              NOT NULL,
        [CreatedAtUtc]             datetime2        NOT NULL,
        CONSTRAINT [PK_Projects] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE UNIQUE INDEX [IX_Projects_Code] ON [dbo].[Projects] ([Code]);
END
GO

-- 6. TASK ASSIGNMENTS
IF OBJECT_ID(N'[dbo].[TaskAssignments]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TaskAssignments] (
        [Id]                 uniqueidentifier NOT NULL,
        [TaskGroupId]        uniqueidentifier NOT NULL,
        [ProjectId]          uniqueidentifier NOT NULL,
        [ProjectName]        nvarchar(200)    NOT NULL,
        [AssignedTo]         uniqueidentifier NOT NULL,
        [AssignedToName]     nvarchar(200)    NOT NULL,
        [TaskCode]           nvarchar(50)     NOT NULL,
        [Title]              nvarchar(200)    NOT NULL,
        [Description]        nvarchar(max)    NOT NULL,
        [WorkBreakdown]      nvarchar(4000)   NOT NULL,
        [StartDate]          date             NULL,
        [EndDate]            date             NULL,
        [TotalHours]         float            NOT NULL,
        [PlannedDays]        int              NOT NULL,
        [AssignedDays]       int              NOT NULL,
        [Priority]           nvarchar(50)     NOT NULL,
        [Status]             nvarchar(50)     NOT NULL,
        [AssignmentStatus]   nvarchar(50)     NOT NULL,
        [Notes]              nvarchar(2000)   NOT NULL,
        [RoleInTask]         nvarchar(200)    NOT NULL,
        [ExpectedDeliverable] nvarchar(500)   NOT NULL,
        [CreatedAtUtc]       datetime2        NOT NULL,
        CONSTRAINT [PK_TaskAssignments] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE INDEX [IX_TaskAssignments_TaskGroupId] ON [dbo].[TaskAssignments] ([TaskGroupId]);
END
GO

-- 7. WEEKLY TIMESHEETS
IF OBJECT_ID(N'[dbo].[WeeklyTimesheets]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[WeeklyTimesheets] (
        [Id]                  uniqueidentifier NOT NULL,
        [UserId]              uniqueidentifier NOT NULL,
        [AdminId]             uniqueidentifier NOT NULL,
        [AdminName]           nvarchar(200)    NOT NULL,
        [WeekStart]           date             NOT NULL,
        [WeekEnd]             date             NOT NULL,
        [Status]              nvarchar(50)     NOT NULL,
        [ManagerApprovalStatus] nvarchar(50)   NOT NULL,
        [AdminApprovalStatus] nvarchar(50)     NOT NULL,
        [ApprovedBy]          nvarchar(200)    NOT NULL,
        [ApprovalFlowType]    nvarchar(50)     NOT NULL,
        [TotalHours]          float            NOT NULL,
        [RowsJson]            nvarchar(max)    NOT NULL,
        [UpdatedAtUtc]        datetime2        NOT NULL,
        CONSTRAINT [PK_WeeklyTimesheets] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE UNIQUE INDEX [IX_WeeklyTimesheets_UserId_WeekStart] ON [dbo].[WeeklyTimesheets] ([UserId], [WeekStart]);
END
GO

-- 8. DAILY TIMESHEETS
IF OBJECT_ID(N'[dbo].[DailyTimesheets]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DailyTimesheets] (
        [Id]           uniqueidentifier NOT NULL,
        [UserId]       uniqueidentifier NOT NULL,
        [Date]         date             NOT NULL,
        [Status]       nvarchar(50)     NOT NULL,
        [TotalHours]   float            NOT NULL,
        [UpdatedAtUtc] datetime2        NOT NULL,
        CONSTRAINT [PK_DailyTimesheets] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE UNIQUE INDEX [IX_DailyTimesheets_UserId_Date] ON [dbo].[DailyTimesheets] ([UserId], [Date]);
END
GO

-- 9. DAILY TIMESHEET ENTRIES
IF OBJECT_ID(N'[dbo].[DailyTimesheetEntries]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DailyTimesheetEntries] (
        [Id]               uniqueidentifier NOT NULL,
        [DailyTimesheetId] uniqueidentifier NOT NULL,
        [TaskId]           uniqueidentifier NOT NULL,
        [TaskTitle]        nvarchar(200)    NOT NULL,
        [Hours]            float            NOT NULL,
        [WorkDescription]  nvarchar(max)    NOT NULL,
        CONSTRAINT [PK_DailyTimesheetEntries] PRIMARY KEY CLUSTERED ([Id])
    );

    ALTER TABLE [dbo].[DailyTimesheetEntries] ADD CONSTRAINT [FK_DailyTimesheetEntries_DailyTimesheet]
        FOREIGN KEY ([DailyTimesheetId]) REFERENCES [dbo].[DailyTimesheets] ([Id]) ON DELETE CASCADE;

    CREATE INDEX [IX_DailyTimesheetEntries_DailyTimesheetId] ON [dbo].[DailyTimesheetEntries] ([DailyTimesheetId]);
END
GO

-- 10. LEAVE REQUESTS
IF OBJECT_ID(N'[dbo].[LeaveRequests]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LeaveRequests] (
        [Id]                   uniqueidentifier NOT NULL,
        [EmployeeId]           uniqueidentifier NOT NULL,
        [EmployeeName]         nvarchar(200)    NOT NULL,
        [Department]           nvarchar(100)    NOT NULL,
        [AdminId]              uniqueidentifier NOT NULL,
        [AdminName]            nvarchar(200)    NOT NULL,
        [Type]                 nvarchar(100)    NOT NULL,
        [StartDate]            date             NOT NULL,
        [EndDate]              date             NOT NULL,
        [Days]                 int              NOT NULL,
        [Reason]               nvarchar(max)    NOT NULL,
        [Status]               nvarchar(50)     NOT NULL,
        [ManagerApprovalStatus] nvarchar(50)    NOT NULL,
        [HRApprovalStatus]     nvarchar(50)     NOT NULL,
        [AdminApprovalStatus]  nvarchar(50)     NOT NULL,
        [ApprovedBy]           nvarchar(200)    NULL,
        [ApprovalFlowType]     nvarchar(100)    NULL,
        [CreatedAtUtc]         datetime2        NOT NULL,
        CONSTRAINT [PK_LeaveRequests] PRIMARY KEY CLUSTERED ([Id])
    );
END
GO

-- 11. LATE TIMESHEET REQUESTS
IF OBJECT_ID(N'[dbo].[LateTimesheetRequests]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LateTimesheetRequests] (
        [Id]               uniqueidentifier NOT NULL,
        [UserId]           uniqueidentifier NOT NULL,
        [UserName]         nvarchar(200)    NOT NULL,
        [Reason]           nvarchar(500)    NOT NULL,
        [AdditionalRemarks] nvarchar(2000)  NOT NULL,
        [CreatedAtUtc]     datetime2        NOT NULL,
        [UpdatedAtUtc]     datetime2        NOT NULL,
        CONSTRAINT [PK_LateTimesheetRequests] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE INDEX [IX_LateTimesheetRequests_UserId]      ON [dbo].[LateTimesheetRequests] ([UserId]);
    CREATE INDEX [IX_LateTimesheetRequests_CreatedAtUtc] ON [dbo].[LateTimesheetRequests] ([CreatedAtUtc]);
END
GO

-- 12. LATE TIMESHEET REQUEST ITEMS
IF OBJECT_ID(N'[dbo].[LateTimesheetRequestItems]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LateTimesheetRequestItems] (
        [Id]               uniqueidentifier NOT NULL,
        [RequestId]        uniqueidentifier NOT NULL,
        [EntryDate]        date             NOT NULL,
        [ProjectId]        uniqueidentifier NOT NULL,
        [ProjectName]      nvarchar(200)    NOT NULL,
        [TaskId]           uniqueidentifier NOT NULL,
        [TaskTitle]        nvarchar(200)    NOT NULL,
        [ManagerId]        uniqueidentifier NOT NULL,
        [ManagerName]      nvarchar(200)    NOT NULL,
        [Status]           nvarchar(50)     NOT NULL,
        [DecisionNote]     nvarchar(1000)   NOT NULL,
        [DecisionAtUtc]    datetime2        NULL,
        [UnlockExpiresAtUtc] datetime2      NULL,
        [LastUsedAtUtc]    datetime2        NULL,
        CONSTRAINT [PK_LateTimesheetRequestItems] PRIMARY KEY CLUSTERED ([Id])
    );

    ALTER TABLE [dbo].[LateTimesheetRequestItems] ADD CONSTRAINT [FK_LateTimesheetRequestItems_Request]
        FOREIGN KEY ([RequestId]) REFERENCES [dbo].[LateTimesheetRequests] ([Id]) ON DELETE CASCADE;

    CREATE INDEX [IX_LateTimesheetRequestItems_ManagerId] ON [dbo].[LateTimesheetRequestItems] ([ManagerId]);
    CREATE INDEX [IX_LateTimesheetRequestItems_EntryDate_ProjectId_TaskId]
        ON [dbo].[LateTimesheetRequestItems] ([EntryDate], [ProjectId], [TaskId]);
END
GO

-- 13. PASSWORD CHANGE REQUESTS
IF OBJECT_ID(N'[dbo].[PasswordChangeRequests]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PasswordChangeRequests] (
        [Id]                        uniqueidentifier NOT NULL,
        [UserId]                    uniqueidentifier NOT NULL,
        [UserName]                  nvarchar(200)    NOT NULL,
        [UserEmail]                 nvarchar(200)    NOT NULL,
        [Department]                nvarchar(100)    NOT NULL,
        [Designation]               nvarchar(100)    NOT NULL,
        [Status]                    nvarchar(50)     NOT NULL,
        [CurrentPasswordHashSnapshot]  nvarchar(256) NOT NULL,
        [CurrentPasswordSaltSnapshot]  nvarchar(256) NOT NULL,
        [PendingPasswordHash]       nvarchar(256)    NULL,
        [PendingPasswordSalt]       nvarchar(256)    NULL,
        [OtpHash]                   nvarchar(256)    NULL,
        [OtpSalt]                   nvarchar(256)    NULL,
        [OtpExpiresAtUtc]           datetime2        NULL,
        [OtpAttemptCount]           int              NOT NULL,
        [OtpVerifiedAtUtc]          datetime2        NULL,
        [ReviewedByUserId]          uniqueidentifier NULL,
        [ReviewedByName]            nvarchar(200)    NOT NULL,
        [DecisionNote]              nvarchar(2000)   NOT NULL,
        [DecisionAtUtc]             datetime2        NULL,
        [CreatedAtUtc]              datetime2        NOT NULL,
        [UpdatedAtUtc]              datetime2        NOT NULL,
        CONSTRAINT [PK_PasswordChangeRequests] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE INDEX [IX_PasswordChangeRequests_UserId]      ON [dbo].[PasswordChangeRequests] ([UserId]);
    CREATE INDEX [IX_PasswordChangeRequests_Status]      ON [dbo].[PasswordChangeRequests] ([Status]);
    CREATE INDEX [IX_PasswordChangeRequests_CreatedAtUtc] ON [dbo].[PasswordChangeRequests] ([CreatedAtUtc]);
END
GO

-- 14. USER LOGIN ACTIVITY
IF OBJECT_ID(N'[dbo].[UserLoginActivity]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[UserLoginActivity] (
        [Id]             uniqueidentifier NOT NULL,
        [UserId]         uniqueidentifier NULL,
        [AttemptedEmail] nvarchar(200)    NOT NULL,
        [LoginTime]      datetime2        NOT NULL,
        [LogoutTime]     datetime2        NULL,
        [Latitude]       float            NULL,
        [Longitude]      float            NULL,
        [Accuracy]       float            NULL,
        [City]           nvarchar(100)    NOT NULL,
        [State]          nvarchar(100)    NOT NULL,
        [Country]        nvarchar(100)    NOT NULL,
        [IpAddress]      nvarchar(64)     NOT NULL,
        [UserAgent]      nvarchar(1024)   NOT NULL,
        [Browser]        nvarchar(100)    NOT NULL,
        [OperatingSystem] nvarchar(100)   NOT NULL,
        [DeviceType]     nvarchar(50)     NOT NULL,
        [LoginStatus]    nvarchar(50)     NOT NULL,
        [FailureReason]  nvarchar(500)    NOT NULL,
        [IsSuspicious]   bit              NOT NULL,
        [CreatedAt]      datetime2        NOT NULL,
        CONSTRAINT [PK_UserLoginActivity] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE INDEX [IX_UserLoginActivity_LoginTime]        ON [dbo].[UserLoginActivity] ([LoginTime]);
    CREATE INDEX [IX_UserLoginActivity_UserId]           ON [dbo].[UserLoginActivity] ([UserId]);
    CREATE INDEX [IX_UserLoginActivity_AttemptedEmail]   ON [dbo].[UserLoginActivity] ([AttemptedEmail]);
    CREATE INDEX [IX_UserLoginActivity_LoginStatus_LoginTime] ON [dbo].[UserLoginActivity] ([LoginStatus], [LoginTime]);
END
GO

-- 15. CHAT THREADS
IF OBJECT_ID(N'[dbo].[ChatThreads]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ChatThreads] (
        [Id]              uniqueidentifier NOT NULL,
        [ThreadType]      nvarchar(50)     NOT NULL,
        [Name]            nvarchar(200)    NOT NULL,
        [ProjectId]       uniqueidentifier NULL,
        [DepartmentName]  nvarchar(100)    NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [CreatedAtUtc]    datetime2        NOT NULL,
        [UpdatedAtUtc]    datetime2        NOT NULL,
        [IsActive]        bit              NOT NULL,
        [IsArchived]      bit              NOT NULL,
        [PhotoUrl]        nvarchar(500)    NULL,
        [Description]     nvarchar(1000)   NULL,
        [PermissionsJson] nvarchar(max)    NOT NULL,
        [ArchivedByUserId] uniqueidentifier NULL,
        [ArchivedAtUtc]   datetime2        NULL,
        CONSTRAINT [PK_ChatThreads] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE INDEX [IX_ChatThreads_ThreadType_ProjectId]     ON [dbo].[ChatThreads] ([ThreadType], [ProjectId]);
    CREATE INDEX [IX_ChatThreads_ThreadType_DepartmentName] ON [dbo].[ChatThreads] ([ThreadType], [DepartmentName]);
END
GO

-- 16. CHAT PARTICIPANTS
IF OBJECT_ID(N'[dbo].[ChatParticipants]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ChatParticipants] (
        [Id]               uniqueidentifier NOT NULL,
        [ChatThreadId]     uniqueidentifier NOT NULL,
        [UserId]           uniqueidentifier NOT NULL,
        [RoleInThread]     nvarchar(50)     NOT NULL,
        [JoinedAtUtc]      datetime2        NOT NULL,
        [IsMuted]          bit              NOT NULL,
        [IsPinned]         bit              NOT NULL,
        [LastSeenMessageId] uniqueidentifier NULL,
        [LastSeenAtUtc]    datetime2        NULL,
        [IsActive]          bit              NOT NULL,
        CONSTRAINT [PK_ChatParticipants] PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT [FK_ChatParticipants_ChatThreads]
            FOREIGN KEY ([ChatThreadId]) REFERENCES [dbo].[ChatThreads] ([Id]) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX [IX_ChatParticipants_ChatThreadId_UserId] ON [dbo].[ChatParticipants] ([ChatThreadId], [UserId]);
    CREATE INDEX [IX_ChatParticipants_UserId]                      ON [dbo].[ChatParticipants] ([UserId]);
END
GO

-- 17. CHAT MESSAGES
IF OBJECT_ID(N'[dbo].[ChatMessages]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ChatMessages] (
        [Id]                    uniqueidentifier NOT NULL,
        [ChatThreadId]          uniqueidentifier NOT NULL,
        [SenderUserId]          uniqueidentifier NULL,
        [MessageType]           nvarchar(50)     NOT NULL,
        [MessageText]           nvarchar(4000)   NOT NULL,
        [MessageStatus]         nvarchar(50)     NOT NULL,
        [ReplyToMessageId]      uniqueidentifier NULL,
        [ForwardedFromMessageId] uniqueidentifier NULL,
        [CreatedAtUtc]          datetime2        NOT NULL,
        [EditedAtUtc]           datetime2        NULL,
        [DeliveredAtUtc]        datetime2        NULL,
        [SeenAtUtc]             datetime2        NULL,
        [IsPinned]              bit              NOT NULL,
        [PinnedByUserId]        uniqueidentifier NULL,
        [PinnedAtUtc]           datetime2        NULL,
        [DeletedAtUtc]          datetime2        NULL,
        [DeletedByUserId]       uniqueidentifier NULL,
        [IsDeleted]             bit              NOT NULL,
        CONSTRAINT [PK_ChatMessages] PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT [FK_ChatMessages_ChatThreads]
            FOREIGN KEY ([ChatThreadId]) REFERENCES [dbo].[ChatThreads] ([Id]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_ChatMessages_ChatThreadId_CreatedAtUtc] ON [dbo].[ChatMessages] ([ChatThreadId], [CreatedAtUtc]);
    CREATE INDEX [IX_ChatMessages_SenderUserId]              ON [dbo].[ChatMessages] ([SenderUserId]);
END
GO

-- 18. CHAT ATTACHMENTS
IF OBJECT_ID(N'[dbo].[ChatAttachments]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ChatAttachments] (
        [Id]               uniqueidentifier NOT NULL,
        [ChatMessageId]    uniqueidentifier NULL,
        [UploadedByUserId] uniqueidentifier NOT NULL,
        [FileName]         nvarchar(260)    NOT NULL,
        [OriginalFileName] nvarchar(260)    NOT NULL,
        [ContentType]      nvarchar(120)    NOT NULL,
        [FileSizeBytes]    bigint           NOT NULL,
        [StoragePath]      nvarchar(500)    NOT NULL,
        [PublicUrl]        nvarchar(500)    NOT NULL,
        [AttachmentType]   nvarchar(50)     NOT NULL,
        [ScanStatus]       nvarchar(50)     NOT NULL,
        [PreviewUrl]       nvarchar(500)    NULL,
        [CreatedAtUtc]     datetime2        NOT NULL,
        [IsDeleted]        bit              NOT NULL,
        [DeletedAtUtc]     datetime2        NULL,
        CONSTRAINT [PK_ChatAttachments] PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT [FK_ChatAttachments_ChatMessages]
            FOREIGN KEY ([ChatMessageId]) REFERENCES [dbo].[ChatMessages] ([Id]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_ChatAttachments_ChatMessageId] ON [dbo].[ChatAttachments] ([ChatMessageId]);
END
GO

-- 19. CHAT REACTIONS
IF OBJECT_ID(N'[dbo].[ChatReactions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ChatReactions] (
        [Id]            uniqueidentifier NOT NULL,
        [ChatMessageId] uniqueidentifier NOT NULL,
        [UserId]        uniqueidentifier NOT NULL,
        [Emoji]         nvarchar(32)     NOT NULL,
        [CreatedAtUtc]  datetime2        NOT NULL,
        CONSTRAINT [PK_ChatReactions] PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT [FK_ChatReactions_ChatMessages]
            FOREIGN KEY ([ChatMessageId]) REFERENCES [dbo].[ChatMessages] ([Id]) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX [IX_ChatReactions_ChatMessageId_UserId_Emoji]
        ON [dbo].[ChatReactions] ([ChatMessageId], [UserId], [Emoji]);
END
GO

-- 20. CHAT PRESENCES
IF OBJECT_ID(N'[dbo].[ChatPresences]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ChatPresences] (
        [UserId]       uniqueidentifier NOT NULL,
        [PresenceStatus] nvarchar(50)   NOT NULL,
        [ActiveThreadId] uniqueidentifier NULL,
        [IsTyping]     bit              NOT NULL,
        [LastSeenAtUtc] datetime2       NOT NULL,
        [UpdatedAtUtc] datetime2        NOT NULL,
        CONSTRAINT [PK_ChatPresences] PRIMARY KEY CLUSTERED ([UserId])
    );

    CREATE INDEX [IX_ChatPresences_UpdatedAtUtc] ON [dbo].[ChatPresences] ([UpdatedAtUtc]);
END
GO

-- 21. CHAT NOTIFICATION PREFERENCES
IF OBJECT_ID(N'[dbo].[ChatNotificationPreferences]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ChatNotificationPreferences] (
        [UserId]                     uniqueidentifier NOT NULL,
        [BrowserNotificationsEnabled] bit             NOT NULL,
        [SoundEnabled]               bit             NOT NULL,
        [EmailNotificationsEnabled]  bit             NOT NULL,
        [MentionNotificationsEnabled] bit            NOT NULL,
        [OfflineNotificationsEnabled] bit            NOT NULL,
        [UpdatedAtUtc]               datetime2       NOT NULL,
        CONSTRAINT [PK_ChatNotificationPreferences] PRIMARY KEY CLUSTERED ([UserId])
    );
END
GO

-- 22. LICENSE_OWNERS
IF OBJECT_ID(N'[dbo].[license_owners]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[license_owners] (
        [Id]                 uniqueidentifier NOT NULL,
        [WorkspaceId]        nvarchar(100)    NOT NULL,
        [OwnerName]          nvarchar(200)    NOT NULL,
        [CompanyName]        nvarchar(200)    NOT NULL,
        [Email]              nvarchar(200)    NOT NULL,
        [PasswordHash]       nvarchar(256)    NOT NULL,
        [PasswordSalt]       nvarchar(256)    NOT NULL,
        [SubscriptionPlan]   nvarchar(50)     NOT NULL,
        [SubscriptionStatus] nvarchar(50)     NOT NULL,
        [SeatLimit]          int              NOT NULL,
        [CurrentUsage]       int              NOT NULL,
        [RenewalDate]        datetime2        NOT NULL,
        [CreatedAt]          datetime2        NOT NULL,
        CONSTRAINT [PK_license_owners] PRIMARY KEY CLUSTERED ([Id])
    );
    CREATE UNIQUE INDEX [IX_license_owners_Email] ON [dbo].[license_owners] ([Email]);
END
GO

-- 23. WORKSPACES
IF OBJECT_ID(N'[dbo].[workspaces]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[workspaces] (
        [WorkspaceId]   nvarchar(100)    NOT NULL,
        [WorkspaceName] nvarchar(200)    NOT NULL,
        [WorkspaceSlug] nvarchar(200)    NOT NULL,
        [OwnerId]       uniqueidentifier NOT NULL,
        [Status]        nvarchar(50)     NOT NULL,
        [CreatedAt]     datetime2        NOT NULL,
        CONSTRAINT [PK_workspaces] PRIMARY KEY CLUSTERED ([WorkspaceId])
    );
END
GO

-- 24. SUBSCRIPTIONS
IF OBJECT_ID(N'[dbo].[subscriptions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[subscriptions] (
        [Id]              uniqueidentifier NOT NULL,
        [WorkspaceId]     nvarchar(100)    NOT NULL,
        [PlanName]        nvarchar(50)     NOT NULL,
        [BillingCycle]    nvarchar(50)     NOT NULL,
        [Amount]          decimal(18,2)    NOT NULL,
        [Status]          nvarchar(50)     NOT NULL,
        [InvoiceNumber]   nvarchar(100)    NOT NULL,
        [PaymentMethod]   nvarchar(50)     NOT NULL,
        [TransactionDate] datetime2        NOT NULL,
        CONSTRAINT [PK_subscriptions] PRIMARY KEY CLUSTERED ([Id])
    );
END
GO

PRINT 'All 24 tables created successfully.';
GO
