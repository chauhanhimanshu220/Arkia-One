using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddScoped<AuthTokenService>();
var tokenService = new AuthTokenService(builder.Configuration, builder.Environment);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2),
            ValidIssuer = tokenService.Issuer,
            ValidAudience = tokenService.Audience,
            IssuerSigningKey = tokenService.GetSigningKey()
        };
    });
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        policy.AllowAnyHeader()
              .AllowAnyMethod();

        if (builder.Environment.IsDevelopment())
        {
            policy.AllowAnyOrigin();
        }
        else
        {
            policy.WithOrigins("https://timesheet.arkiatechnology.com", "https://Timesheet.arkiatechnology.com");
        }
    });
});
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        sqlOptions => sqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(30),
            errorNumbersToAdd: null)));

builder.Services.AddMemoryCache();
builder.Services.Configure<SmtpOptions>(options =>
{
    builder.Configuration.GetSection("Smtp").Bind(options);

    options.Host = builder.Configuration["SMTP_HOST"] ?? options.Host;
    options.User = builder.Configuration["SMTP_USER"] ?? options.User;
    options.Pass = builder.Configuration["SMTP_PASS"] ?? options.Pass;
    options.FromEmail = builder.Configuration["SMTP_FROM_EMAIL"] ?? options.FromEmail;
    options.FromName = builder.Configuration["SMTP_FROM_NAME"] ?? options.FromName;

    if (int.TryParse(builder.Configuration["SMTP_PORT"], out var port))
    {
        options.Port = port;
    }

    if (bool.TryParse(builder.Configuration["SMTP_SECURE"], out var secure))
    {
        options.Secure = secure;
    }
});
builder.Services.Configure<TimesheetSystemOptions>(builder.Configuration.GetSection("TimesheetSystem"));
builder.Services.AddHttpClient<LocationLookupService>(client =>
{
    client.BaseAddress = new Uri("https://nominatim.openstreetmap.org/");
});
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<EmployeeWelcomeEmailService>();
builder.Services.AddScoped<LoginActivityService>();
builder.Services.AddScoped<LateTimesheetAccessService>();
builder.Services.AddScoped<ActivityService>();
builder.Services.AddScoped<ChatService>();
builder.Services.AddScoped<PasswordChangeRequestService>();
builder.Services.AddScoped<ProjectManagerRoleService>();
builder.Services.AddScoped<PayrollExportReportService>();

var app = builder.Build();

var webRootPath = app.Environment.WebRootPath;
if (string.IsNullOrWhiteSpace(webRootPath))
{
    webRootPath = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
    app.Environment.WebRootPath = webRootPath;
}

Directory.CreateDirectory(webRootPath);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseStaticFiles();
app.UseCors("frontend");

app.Use(async (context, next) =>
{
    context.Response.Headers.Append("Cache-Control", "no-cache, no-store, must-revalidate");
    context.Response.Headers.Append("Pragma", "no-cache");
    context.Response.Headers.Append("Expires", "0");
    await next();
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await EnsureDatabaseReadyAsync(dbContext);
}

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await AppDbInitializer.SeedAsync(dbContext);
}
using (var scope = app.Services.CreateScope())
{
    var chatService = scope.ServiceProvider.GetRequiredService<ChatService>();

    try
    {
        await chatService.EnsureFoundationsAsync();
    }
    catch (DbUpdateConcurrencyException exception)
    {
        app.Logger.LogWarning(
            exception,
            "Chat foundation synchronization was skipped because the database changed during startup."
        );
    }
}

app.Run();

static async Task EnsureDatabaseReadyAsync(AppDbContext dbContext)
{
    await RepairLegacyDefaultSchemaTablesAsync(dbContext);
    await RepairMissingChatWorkspaceTablesAsync(dbContext);
    await dbContext.Database.MigrateAsync();
    await EnsureFinanceSettingsTableAsync(dbContext);
    await EnsureLicenseOwnersAndWorkspacesTablesAsync(dbContext);
    await EnsureWorkspaceIdColumnsAsync(dbContext);

    try
    {
        await dbContext.Employees.AsNoTracking().AnyAsync();
        await EnsureTaskAssignmentsHasTotalHoursAsync(dbContext);
        await EnsureTaskAssignmentsWorkflowColumnsAsync(dbContext);
        await EnsureWeeklyTimesheetsWorkflowColumnsAsync(dbContext);
        await EnsureLeaveRequestsWorkflowColumnsAsync(dbContext);
        await EnsureEmployeesHaveRolesJsonAsync(dbContext);
    }
    catch (SqlException exception) when (exception.Number == 208)
    {
        throw new InvalidOperationException(
            "Required database tables are missing after migrations were applied. " +
            "Automatic database deletion has been disabled to avoid destructive resets. " +
            "Please verify the target database and migration history before retrying.",
            exception);
    }
}

static async Task EnsureFinanceSettingsTableAsync(AppDbContext dbContext)
{
    await dbContext.Database.ExecuteSqlRawAsync("""
        IF OBJECT_ID(N'[FinanceSettings]', N'U') IS NULL
        BEGIN
            CREATE TABLE [FinanceSettings] (
                [Id] uniqueidentifier NOT NULL,
                [Category] nvarchar(80) NOT NULL,
                [Key] nvarchar(120) NOT NULL,
                [Name] nvarchar(200) NOT NULL,
                [Description] nvarchar(1000) NOT NULL,
                [Status] nvarchar(50) NOT NULL,
                [DataJson] nvarchar(max) NOT NULL,
                [CreatedAtUtc] datetime2 NOT NULL,
                [UpdatedAtUtc] datetime2 NOT NULL,
                [UpdatedBy] nvarchar(200) NOT NULL,
                CONSTRAINT [PK_FinanceSettings] PRIMARY KEY ([Id])
            );
        END

        IF OBJECT_ID(N'[FinanceSettings]', N'U') IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_FinanceSettings_Category_Key' AND [object_id] = OBJECT_ID(N'[FinanceSettings]'))
        BEGIN
            CREATE UNIQUE INDEX [IX_FinanceSettings_Category_Key] ON [FinanceSettings] ([Category], [Key]);
        END

        IF OBJECT_ID(N'[FinanceSettings]', N'U') IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_FinanceSettings_Category' AND [object_id] = OBJECT_ID(N'[FinanceSettings]'))
        BEGIN
            CREATE INDEX [IX_FinanceSettings_Category] ON [FinanceSettings] ([Category]);
        END
        """);
}

static async Task EnsureLicenseOwnersAndWorkspacesTablesAsync(AppDbContext dbContext)
{
    await dbContext.Database.ExecuteSqlRawAsync("""
        IF OBJECT_ID(N'[license_owners]', N'U') IS NULL
        BEGIN
            CREATE TABLE [license_owners] (
                [Id] uniqueidentifier NOT NULL,
                [WorkspaceId] nvarchar(100) NOT NULL,
                [OwnerName] nvarchar(200) NOT NULL,
                [CompanyName] nvarchar(200) NOT NULL,
                [Email] nvarchar(200) NOT NULL,
                [PasswordHash] nvarchar(256) NOT NULL,
                [PasswordSalt] nvarchar(256) NOT NULL,
                [SubscriptionPlan] nvarchar(50) NOT NULL,
                [SubscriptionStatus] nvarchar(50) NOT NULL,
                [SeatLimit] int NOT NULL,
                [CurrentUsage] int NOT NULL,
                [RenewalDate] datetime2 NOT NULL,
                [CreatedAt] datetime2 NOT NULL,
                CONSTRAINT [PK_license_owners] PRIMARY KEY ([Id])
            );
        END

        IF OBJECT_ID(N'[license_owners]', N'U') IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_license_owners_Email' AND [object_id] = OBJECT_ID(N'[license_owners]'))
        BEGIN
            CREATE UNIQUE INDEX [IX_license_owners_Email] ON [license_owners] ([Email]);
        END

        IF OBJECT_ID(N'[workspaces]', N'U') IS NULL
        BEGIN
            CREATE TABLE [workspaces] (
                [WorkspaceId] nvarchar(100) NOT NULL,
                [WorkspaceName] nvarchar(200) NOT NULL,
                [WorkspaceSlug] nvarchar(200) NOT NULL,
                [OwnerId] uniqueidentifier NOT NULL,
                [Status] nvarchar(50) NOT NULL,
                [CreatedAt] datetime2 NOT NULL,
                CONSTRAINT [PK_workspaces] PRIMARY KEY ([WorkspaceId])
            );
        END

        IF OBJECT_ID(N'[subscriptions]', N'U') IS NULL
        BEGIN
            CREATE TABLE [subscriptions] (
                [Id] uniqueidentifier NOT NULL,
                [WorkspaceId] nvarchar(100) NOT NULL,
                [PlanName] nvarchar(50) NOT NULL,
                [BillingCycle] nvarchar(50) NOT NULL,
                [Amount] decimal(18,2) NOT NULL,
                [Status] nvarchar(50) NOT NULL,
                [InvoiceNumber] nvarchar(100) NOT NULL,
                [PaymentMethod] nvarchar(50) NOT NULL,
                [TransactionDate] datetime2 NOT NULL,
                CONSTRAINT [PK_subscriptions] PRIMARY KEY ([Id])
            );
        END

        -- Ensure columns for license_owners
        IF OBJECT_ID(N'[license_owners]', N'U') IS NOT NULL
        BEGIN
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[license_owners]') AND name = N'WorkspaceId')
                ALTER TABLE [license_owners] ADD [WorkspaceId] nvarchar(100) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[license_owners]') AND name = N'OwnerName')
                ALTER TABLE [license_owners] ADD [OwnerName] nvarchar(200) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[license_owners]') AND name = N'CompanyName')
                ALTER TABLE [license_owners] ADD [CompanyName] nvarchar(200) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[license_owners]') AND name = N'Email')
                ALTER TABLE [license_owners] ADD [Email] nvarchar(200) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[license_owners]') AND name = N'PasswordHash')
                ALTER TABLE [license_owners] ADD [PasswordHash] nvarchar(256) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[license_owners]') AND name = N'PasswordSalt')
                ALTER TABLE [license_owners] ADD [PasswordSalt] nvarchar(256) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[license_owners]') AND name = N'SubscriptionPlan')
                ALTER TABLE [license_owners] ADD [SubscriptionPlan] nvarchar(50) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[license_owners]') AND name = N'SubscriptionStatus')
                ALTER TABLE [license_owners] ADD [SubscriptionStatus] nvarchar(50) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[license_owners]') AND name = N'SeatLimit')
                ALTER TABLE [license_owners] ADD [SeatLimit] int NOT NULL DEFAULT 10;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[license_owners]') AND name = N'CurrentUsage')
                ALTER TABLE [license_owners] ADD [CurrentUsage] int NOT NULL DEFAULT 0;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[license_owners]') AND name = N'RenewalDate')
                ALTER TABLE [license_owners] ADD [RenewalDate] datetime2 NOT NULL DEFAULT '2026-01-01';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[license_owners]') AND name = N'CreatedAt')
                ALTER TABLE [license_owners] ADD [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE();
        END

        -- Ensure columns for workspaces
        IF OBJECT_ID(N'[workspaces]', N'U') IS NOT NULL
        BEGIN
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[workspaces]') AND name = N'WorkspaceName')
                ALTER TABLE [workspaces] ADD [WorkspaceName] nvarchar(200) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[workspaces]') AND name = N'WorkspaceSlug')
                ALTER TABLE [workspaces] ADD [WorkspaceSlug] nvarchar(200) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[workspaces]') AND name = N'OwnerId')
                ALTER TABLE [workspaces] ADD [OwnerId] uniqueidentifier NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[workspaces]') AND name = N'Status')
                ALTER TABLE [workspaces] ADD [Status] nvarchar(50) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[workspaces]') AND name = N'CreatedAt')
                ALTER TABLE [workspaces] ADD [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE();
        END

        -- Ensure columns for subscriptions
        IF OBJECT_ID(N'[subscriptions]', N'U') IS NOT NULL
        BEGIN
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[subscriptions]') AND name = N'WorkspaceId')
                ALTER TABLE [subscriptions] ADD [WorkspaceId] nvarchar(100) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[subscriptions]') AND name = N'PlanName')
                ALTER TABLE [subscriptions] ADD [PlanName] nvarchar(50) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[subscriptions]') AND name = N'BillingCycle')
                ALTER TABLE [subscriptions] ADD [BillingCycle] nvarchar(50) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[subscriptions]') AND name = N'Amount')
                ALTER TABLE [subscriptions] ADD [Amount] decimal(18,2) NOT NULL DEFAULT 0.0;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[subscriptions]') AND name = N'Status')
                ALTER TABLE [subscriptions] ADD [Status] nvarchar(50) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[subscriptions]') AND name = N'InvoiceNumber')
                ALTER TABLE [subscriptions] ADD [InvoiceNumber] nvarchar(100) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[subscriptions]') AND name = N'PaymentMethod')
                ALTER TABLE [subscriptions] ADD [PaymentMethod] nvarchar(50) NOT NULL DEFAULT '';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[subscriptions]') AND name = N'TransactionDate')
                ALTER TABLE [subscriptions] ADD [TransactionDate] datetime2 NOT NULL DEFAULT GETUTCDATE();
        END
        """);
}

static async Task EnsureWorkspaceIdColumnsAsync(AppDbContext dbContext)
{
    try
    {
        await dbContext.Database.ExecuteSqlRawAsync("SELECT TOP (1) [WorkspaceId] FROM [Employees]");
    }
    catch (SqlException exception) when (exception.Number == 207)
    {
        await dbContext.Database.ExecuteSqlRawAsync(
            "ALTER TABLE [Employees] ADD [WorkspaceId] nvarchar(100) NOT NULL CONSTRAINT [DF_Employees_WorkspaceId] DEFAULT (N'wrk_default')");
    }

    try
    {
        await dbContext.Database.ExecuteSqlRawAsync("SELECT TOP (1) [WorkspaceId] FROM [Projects]");
    }
    catch (SqlException exception) when (exception.Number == 207)
    {
        await dbContext.Database.ExecuteSqlRawAsync(
            "ALTER TABLE [Projects] ADD [WorkspaceId] nvarchar(100) NOT NULL CONSTRAINT [DF_Projects_WorkspaceId] DEFAULT (N'wrk_default')");
    }
}

static async Task RepairLegacyDefaultSchemaTablesAsync(AppDbContext dbContext)
{
    await dbContext.Database.ExecuteSqlRawAsync("""
        IF SCHEMA_ID(N'Timesheet_user') IS NOT NULL
            AND OBJECT_ID(N'[dbo].[AccountAuditLogs]', N'U') IS NULL
            AND OBJECT_ID(N'[Timesheet_user].[AccountAuditLogs]', N'U') IS NOT NULL
        BEGIN
            ALTER SCHEMA [dbo] TRANSFER [Timesheet_user].[AccountAuditLogs];
        END

        IF SCHEMA_ID(N'Timesheet_user') IS NOT NULL
            AND OBJECT_ID(N'[dbo].[Departments]', N'U') IS NULL
            AND OBJECT_ID(N'[Timesheet_user].[Departments]', N'U') IS NOT NULL
        BEGIN
            ALTER SCHEMA [dbo] TRANSFER [Timesheet_user].[Departments];
        END

        IF SCHEMA_ID(N'Timesheet_user') IS NOT NULL
            AND OBJECT_ID(N'[dbo].[LateTimesheetRequests]', N'U') IS NULL
            AND OBJECT_ID(N'[Timesheet_user].[LateTimesheetRequests]', N'U') IS NOT NULL
        BEGIN
            ALTER SCHEMA [dbo] TRANSFER [Timesheet_user].[LateTimesheetRequests];
        END

        IF SCHEMA_ID(N'Timesheet_user') IS NOT NULL
            AND OBJECT_ID(N'[dbo].[LateTimesheetRequestItems]', N'U') IS NULL
            AND OBJECT_ID(N'[Timesheet_user].[LateTimesheetRequestItems]', N'U') IS NOT NULL
        BEGIN
            ALTER SCHEMA [dbo] TRANSFER [Timesheet_user].[LateTimesheetRequestItems];
        END

        IF SCHEMA_ID(N'Timesheet_user') IS NOT NULL
            AND OBJECT_ID(N'[dbo].[UserLoginActivity]', N'U') IS NULL
            AND OBJECT_ID(N'[Timesheet_user].[UserLoginActivity]', N'U') IS NOT NULL
        BEGIN
            ALTER SCHEMA [dbo] TRANSFER [Timesheet_user].[UserLoginActivity];
        END
        """);
}

static async Task RepairMissingChatWorkspaceTablesAsync(AppDbContext dbContext)
{
    await dbContext.Database.ExecuteSqlRawAsync("""
        IF OBJECT_ID(N'[__EFMigrationsHistory]', N'U') IS NOT NULL
            AND EXISTS (
                SELECT 1
                FROM [__EFMigrationsHistory]
                WHERE [MigrationId] = N'20260417011142_AddChatWorkspace'
            )
            AND OBJECT_ID(N'[ChatThreads]', N'U') IS NULL
        BEGIN
            CREATE TABLE [ChatThreads] (
                [Id] uniqueidentifier NOT NULL,
                [ThreadType] nvarchar(50) NOT NULL,
                [Name] nvarchar(200) NOT NULL,
                [ProjectId] uniqueidentifier NULL,
                [DepartmentName] nvarchar(100) NULL,
                [CreatedByUserId] uniqueidentifier NULL,
                [CreatedAtUtc] datetime2 NOT NULL,
                [UpdatedAtUtc] datetime2 NOT NULL,
                [IsActive] bit NOT NULL,
                [IsArchived] bit NOT NULL,
                [PhotoUrl] nvarchar(500) NULL,
                [Description] nvarchar(1000) NULL,
                CONSTRAINT [PK_ChatThreads] PRIMARY KEY ([Id])
            );
        END

        IF OBJECT_ID(N'[ChatThreads]', N'U') IS NOT NULL
            AND OBJECT_ID(N'[ChatMessages]', N'U') IS NULL
        BEGIN
            CREATE TABLE [ChatMessages] (
                [Id] uniqueidentifier NOT NULL,
                [ChatThreadId] uniqueidentifier NOT NULL,
                [SenderUserId] uniqueidentifier NULL,
                [MessageType] nvarchar(50) NOT NULL,
                [MessageText] nvarchar(4000) NOT NULL,
                [ReplyToMessageId] uniqueidentifier NULL,
                [CreatedAtUtc] datetime2 NOT NULL,
                [EditedAtUtc] datetime2 NULL,
                [DeletedAtUtc] datetime2 NULL,
                [IsDeleted] bit NOT NULL,
                CONSTRAINT [PK_ChatMessages] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_ChatMessages_ChatThreads_ChatThreadId] FOREIGN KEY ([ChatThreadId]) REFERENCES [ChatThreads] ([Id]) ON DELETE CASCADE
            );
        END

        IF OBJECT_ID(N'[ChatThreads]', N'U') IS NOT NULL
            AND OBJECT_ID(N'[ChatParticipants]', N'U') IS NULL
        BEGIN
            CREATE TABLE [ChatParticipants] (
                [Id] uniqueidentifier NOT NULL,
                [ChatThreadId] uniqueidentifier NOT NULL,
                [UserId] uniqueidentifier NOT NULL,
                [RoleInThread] nvarchar(50) NOT NULL,
                [JoinedAtUtc] datetime2 NOT NULL,
                [IsMuted] bit NOT NULL,
                [IsPinned] bit NOT NULL,
                [LastSeenMessageId] uniqueidentifier NULL,
                [LastSeenAtUtc] datetime2 NULL,
                [IsActive] bit NOT NULL,
                CONSTRAINT [PK_ChatParticipants] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_ChatParticipants_ChatThreads_ChatThreadId] FOREIGN KEY ([ChatThreadId]) REFERENCES [ChatThreads] ([Id]) ON DELETE CASCADE
            );
        END

        IF OBJECT_ID(N'[ChatMessages]', N'U') IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_ChatMessages_ChatThreadId_CreatedAtUtc' AND [object_id] = OBJECT_ID(N'[ChatMessages]'))
        BEGIN
            CREATE INDEX [IX_ChatMessages_ChatThreadId_CreatedAtUtc] ON [ChatMessages] ([ChatThreadId], [CreatedAtUtc]);
        END

        IF OBJECT_ID(N'[ChatMessages]', N'U') IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_ChatMessages_SenderUserId' AND [object_id] = OBJECT_ID(N'[ChatMessages]'))
        BEGIN
            CREATE INDEX [IX_ChatMessages_SenderUserId] ON [ChatMessages] ([SenderUserId]);
        END

        IF OBJECT_ID(N'[ChatParticipants]', N'U') IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_ChatParticipants_ChatThreadId_UserId' AND [object_id] = OBJECT_ID(N'[ChatParticipants]'))
        BEGIN
            CREATE UNIQUE INDEX [IX_ChatParticipants_ChatThreadId_UserId] ON [ChatParticipants] ([ChatThreadId], [UserId]);
        END

        IF OBJECT_ID(N'[ChatParticipants]', N'U') IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_ChatParticipants_UserId' AND [object_id] = OBJECT_ID(N'[ChatParticipants]'))
        BEGIN
            CREATE INDEX [IX_ChatParticipants_UserId] ON [ChatParticipants] ([UserId]);
        END

        IF OBJECT_ID(N'[ChatThreads]', N'U') IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_ChatThreads_ThreadType_DepartmentName' AND [object_id] = OBJECT_ID(N'[ChatThreads]'))
        BEGIN
            CREATE INDEX [IX_ChatThreads_ThreadType_DepartmentName] ON [ChatThreads] ([ThreadType], [DepartmentName]);
        END

        IF OBJECT_ID(N'[ChatThreads]', N'U') IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_ChatThreads_ThreadType_ProjectId' AND [object_id] = OBJECT_ID(N'[ChatThreads]'))
        BEGIN
            CREATE INDEX [IX_ChatThreads_ThreadType_ProjectId] ON [ChatThreads] ([ThreadType], [ProjectId]);
        END
        """);
}

static async Task EnsureTaskAssignmentsHasTotalHoursAsync(AppDbContext dbContext)
{
    try
    {
        await dbContext.Database.ExecuteSqlRawAsync("SELECT TOP (1) [TotalHours] FROM [TaskAssignments]");
    }
    catch (SqlException exception) when (exception.Number == 208)
    {
        // Table does not exist yet (fresh database); migrations will create it.
    }
    catch (SqlException exception) when (exception.Number == 207)
    {
        // Database existed before the TotalHours column was introduced.
        await dbContext.Database.ExecuteSqlRawAsync(
            "ALTER TABLE [TaskAssignments] ADD [TotalHours] float NOT NULL CONSTRAINT [DF_TaskAssignments_TotalHours] DEFAULT (0)");
    }
}

static async Task EnsureTaskAssignmentsWorkflowColumnsAsync(AppDbContext dbContext)
{
    await EnsureTaskAssignmentsColumnAsync(
        dbContext,
        "TaskCode",
        "nvarchar(50) NOT NULL CONSTRAINT [DF_TaskAssignments_TaskCode] DEFAULT (N'')");
    await EnsureTaskAssignmentsColumnAsync(
        dbContext,
        "WorkBreakdown",
        "nvarchar(max) NOT NULL CONSTRAINT [DF_TaskAssignments_WorkBreakdown] DEFAULT (N'')");
    await EnsureTaskAssignmentsColumnAsync(
        dbContext,
        "PlannedDays",
        "int NOT NULL CONSTRAINT [DF_TaskAssignments_PlannedDays] DEFAULT (0)");
    await EnsureTaskAssignmentsColumnAsync(
        dbContext,
        "AssignedDays",
        "int NOT NULL CONSTRAINT [DF_TaskAssignments_AssignedDays] DEFAULT (0)");
    await EnsureTaskAssignmentsColumnAsync(
        dbContext,
        "Priority",
        "nvarchar(50) NOT NULL CONSTRAINT [DF_TaskAssignments_Priority] DEFAULT (N'Medium')");
    await EnsureTaskAssignmentsColumnAsync(
        dbContext,
        "AssignmentStatus",
        "nvarchar(50) NOT NULL CONSTRAINT [DF_TaskAssignments_AssignmentStatus] DEFAULT (N'Unassigned')");
    await EnsureTaskAssignmentsColumnAsync(
        dbContext,
        "Notes",
        "nvarchar(max) NOT NULL CONSTRAINT [DF_TaskAssignments_Notes] DEFAULT (N'')");
    await EnsureTaskAssignmentsColumnAsync(
        dbContext,
        "RoleInTask",
        "nvarchar(200) NOT NULL CONSTRAINT [DF_TaskAssignments_RoleInTask] DEFAULT (N'')");
    await EnsureTaskAssignmentsColumnAsync(
        dbContext,
        "ExpectedDeliverable",
        "nvarchar(500) NOT NULL CONSTRAINT [DF_TaskAssignments_ExpectedDeliverable] DEFAULT (N'')");
}

static async Task EnsureTaskAssignmentsColumnAsync(AppDbContext dbContext, string columnName, string sqlDefinition)
{
    var selectSql = $"SELECT TOP (1) [{columnName}] FROM [TaskAssignments]";
    var alterSql = $"ALTER TABLE [TaskAssignments] ADD [{columnName}] {sqlDefinition}";

    try
    {
        await dbContext.Database.ExecuteSqlRawAsync(selectSql);
    }
    catch (SqlException exception) when (exception.Number == 208)
    {
        // Table does not exist yet (fresh database); migrations will create it.
    }
    catch (SqlException exception) when (exception.Number == 207)
    {
        await dbContext.Database.ExecuteSqlRawAsync(alterSql);
    }
}

static async Task EnsureEmployeesHaveRolesJsonAsync(AppDbContext dbContext)
{
    try
    {
        await dbContext.Database.ExecuteSqlRawAsync("SELECT TOP (1) [RolesJson] FROM [Employees]");
    }
    catch (SqlException exception) when (exception.Number == 207)
    {
        await dbContext.Database.ExecuteSqlRawAsync(
            "ALTER TABLE [Employees] ADD [RolesJson] nvarchar(max) NOT NULL CONSTRAINT [DF_Employees_RolesJson] DEFAULT (N'[]')");
    }
}

static async Task EnsureWeeklyTimesheetsWorkflowColumnsAsync(AppDbContext dbContext)
{
    await EnsureWeeklyTimesheetsColumnAsync(
        dbContext,
        "ManagerApprovalStatus",
        "nvarchar(50) NOT NULL CONSTRAINT [DF_WeeklyTimesheets_ManagerApprovalStatus] DEFAULT (N'Pending')");
    await EnsureWeeklyTimesheetsColumnAsync(
        dbContext,
        "AdminApprovalStatus",
        "nvarchar(50) NOT NULL CONSTRAINT [DF_WeeklyTimesheets_AdminApprovalStatus] DEFAULT (N'Pending')");
    await EnsureWeeklyTimesheetsColumnAsync(
        dbContext,
        "ApprovedBy",
        "nvarchar(200) NOT NULL CONSTRAINT [DF_WeeklyTimesheets_ApprovedBy] DEFAULT (N'')");
    await EnsureWeeklyTimesheetsColumnAsync(
        dbContext,
        "ApprovalFlowType",
        "nvarchar(100) NOT NULL CONSTRAINT [DF_WeeklyTimesheets_ApprovalFlowType] DEFAULT (N'Standard')");
}

static async Task EnsureWeeklyTimesheetsColumnAsync(AppDbContext dbContext, string columnName, string sqlDefinition)
{
    var selectSql = $"SELECT TOP (1) [{columnName}] FROM [WeeklyTimesheets]";
    var alterSql = $"ALTER TABLE [WeeklyTimesheets] ADD [{columnName}] {sqlDefinition}";

    try
    {
        await dbContext.Database.ExecuteSqlRawAsync(selectSql);
    }
    catch (SqlException exception) when (exception.Number == 208)
    {
        // Table does not exist yet (fresh database); migrations will create it.
    }
    catch (SqlException exception) when (exception.Number == 207)
    {
        await dbContext.Database.ExecuteSqlRawAsync(alterSql);
    }
}

static async Task EnsureLeaveRequestsWorkflowColumnsAsync(AppDbContext dbContext)
{
    await EnsureLeaveRequestsColumnAsync(
        dbContext,
        "ManagerApprovalStatus",
        "nvarchar(50) NOT NULL CONSTRAINT [DF_LeaveRequests_ManagerApprovalStatus] DEFAULT (N'Pending')");
    await EnsureLeaveRequestsColumnAsync(
        dbContext,
        "HRApprovalStatus",
        "nvarchar(50) NOT NULL CONSTRAINT [DF_LeaveRequests_HRApprovalStatus] DEFAULT (N'Pending')");
    await EnsureLeaveRequestsColumnAsync(
        dbContext,
        "AdminApprovalStatus",
        "nvarchar(50) NOT NULL CONSTRAINT [DF_LeaveRequests_AdminApprovalStatus] DEFAULT (N'Pending')");
    await EnsureLeaveRequestsColumnAsync(
        dbContext,
        "ApprovedBy",
        "nvarchar(200) NULL");
    await EnsureLeaveRequestsColumnAsync(
        dbContext,
        "ApprovalFlowType",
        "nvarchar(100) NULL");
}

static async Task EnsureLeaveRequestsColumnAsync(AppDbContext dbContext, string columnName, string sqlDefinition)
{
    var selectSql = $"SELECT TOP (1) [{columnName}] FROM [LeaveRequests]";
    var alterSql = $"ALTER TABLE [LeaveRequests] ADD [{columnName}] {sqlDefinition}";

    try
    {
        await dbContext.Database.ExecuteSqlRawAsync(selectSql);
    }
    catch (SqlException exception) when (exception.Number == 208)
    {
        // Table does not exist yet (fresh database); migrations will create it.
    }
    catch (SqlException exception) when (exception.Number == 207)
    {
        await dbContext.Database.ExecuteSqlRawAsync(alterSql);
    }
}
