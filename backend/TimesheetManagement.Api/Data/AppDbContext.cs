using AbhiTimesheet.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AbhiTimesheet.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AccountAuditLogEntity> AccountAuditLogs => Set<AccountAuditLogEntity>();
    public DbSet<ChatMessageEntity> ChatMessages => Set<ChatMessageEntity>();
    public DbSet<ChatParticipantEntity> ChatParticipants => Set<ChatParticipantEntity>();
    public DbSet<ChatAttachmentEntity> ChatAttachments => Set<ChatAttachmentEntity>();
    public DbSet<ChatNotificationPreferenceEntity> ChatNotificationPreferences => Set<ChatNotificationPreferenceEntity>();
    public DbSet<ChatPresenceEntity> ChatPresences => Set<ChatPresenceEntity>();
    public DbSet<ChatReactionEntity> ChatReactions => Set<ChatReactionEntity>();
    public DbSet<ChatThreadEntity> ChatThreads => Set<ChatThreadEntity>();
    public DbSet<DepartmentEntity> Departments => Set<DepartmentEntity>();
    public DbSet<EmployeeEntity> Employees => Set<EmployeeEntity>();
    public DbSet<FinanceSettingEntity> FinanceSettings => Set<FinanceSettingEntity>();
    public DbSet<LateTimesheetRequestEntity> LateTimesheetRequests => Set<LateTimesheetRequestEntity>();
    public DbSet<LateTimesheetRequestItemEntity> LateTimesheetRequestItems => Set<LateTimesheetRequestItemEntity>();
    public DbSet<ProjectEntity> Projects => Set<ProjectEntity>();
    public DbSet<LeaveRequestEntity> LeaveRequests => Set<LeaveRequestEntity>();
    public DbSet<PasswordChangeRequestEntity> PasswordChangeRequests => Set<PasswordChangeRequestEntity>();
    public DbSet<TaskAssignmentEntity> TaskAssignments => Set<TaskAssignmentEntity>();
    public DbSet<DailyTimesheetEntity> DailyTimesheets => Set<DailyTimesheetEntity>();
    public DbSet<DailyTimesheetEntryEntity> DailyTimesheetEntries => Set<DailyTimesheetEntryEntity>();
    public DbSet<WeeklyTimesheetEntity> WeeklyTimesheets => Set<WeeklyTimesheetEntity>();
    public DbSet<UserLoginActivityEntity> UserLoginActivities => Set<UserLoginActivityEntity>();
    public DbSet<LicenseOwnerEntity> LicenseOwners => Set<LicenseOwnerEntity>();
    public DbSet<WorkspaceEntity> Workspaces => Set<WorkspaceEntity>();
    public DbSet<SubscriptionEntity> Subscriptions => Set<SubscriptionEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DepartmentEntity>(entity =>
        {
            entity.ToTable("Departments");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Name).HasMaxLength(200);
            entity.Property(item => item.Code).HasMaxLength(50);
            entity.Property(item => item.Description).HasMaxLength(1000);
            entity.Property(item => item.EmailAlias).HasMaxLength(200);
            entity.Property(item => item.CostCenter).HasMaxLength(100);
            entity.Property(item => item.Status).HasMaxLength(50);
            entity.HasIndex(item => item.Name).IsUnique();
            entity.HasIndex(item => item.Code).IsUnique();
        });

        modelBuilder.Entity<EmployeeEntity>(entity =>
        {
            entity.ToTable("Employees");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.EmployeeCode).HasMaxLength(50);
            entity.Property(item => item.UserId).HasMaxLength(100);
            entity.Property(item => item.FullName).HasMaxLength(200);
            entity.Property(item => item.Email).HasMaxLength(200);
            entity.Property(item => item.MobileNumber).HasMaxLength(30);
            entity.Property(item => item.Gender).HasMaxLength(50);
            entity.Property(item => item.Role).HasMaxLength(50);
            entity.Property(item => item.RolesJson).HasColumnType("nvarchar(max)");
            entity.Property(item => item.Department).HasMaxLength(100);
            entity.Property(item => item.Designation).HasMaxLength(100);
            entity.Property(item => item.BusinessUnit).HasMaxLength(100);
            entity.Property(item => item.WorkLocation).HasMaxLength(50);
            entity.Property(item => item.Status).HasMaxLength(50);
            entity.Property(item => item.UserType).HasMaxLength(50);
            entity.Property(item => item.ProfilePhotoUrl).HasMaxLength(500);
            entity.Property(item => item.PasswordHash).HasMaxLength(256);
            entity.Property(item => item.PasswordSalt).HasMaxLength(256);
            entity.Property(item => item.WorkspaceId).HasMaxLength(100);
            entity.HasIndex(item => item.Email).IsUnique();
            entity.HasIndex(item => item.EmployeeCode).IsUnique();
            entity.HasIndex(item => item.UserId).IsUnique();
        });

        modelBuilder.Entity<AccountAuditLogEntity>(entity =>
        {
            entity.ToTable("AccountAuditLogs");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Action).HasMaxLength(100);
            entity.Property(item => item.Detail).HasMaxLength(500);
            entity.Property(item => item.IpAddress).HasMaxLength(64);
            entity.Property(item => item.UserAgent).HasMaxLength(1024);
            entity.HasIndex(item => item.SubjectUserId);
            entity.HasIndex(item => item.ActorUserId);
            entity.HasIndex(item => item.CreatedAtUtc);
        });

        modelBuilder.Entity<FinanceSettingEntity>(entity =>
        {
            entity.ToTable("FinanceSettings");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Category).HasMaxLength(80);
            entity.Property(item => item.Key).HasMaxLength(120);
            entity.Property(item => item.Name).HasMaxLength(200);
            entity.Property(item => item.Description).HasMaxLength(1000);
            entity.Property(item => item.Status).HasMaxLength(50);
            entity.Property(item => item.DataJson).HasColumnType("nvarchar(max)");
            entity.Property(item => item.UpdatedBy).HasMaxLength(200);
            entity.HasIndex(item => new { item.Category, item.Key }).IsUnique();
            entity.HasIndex(item => item.Category);
        });

        modelBuilder.Entity<ChatThreadEntity>(entity =>
        {
            entity.ToTable("ChatThreads");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.ThreadType).HasMaxLength(50);
            entity.Property(item => item.Name).HasMaxLength(200);
            entity.Property(item => item.DepartmentName).HasMaxLength(100);
            entity.Property(item => item.PhotoUrl).HasMaxLength(500);
            entity.Property(item => item.Description).HasMaxLength(1000);
            entity.Property(item => item.PermissionsJson).HasColumnType("nvarchar(max)");
            entity.HasIndex(item => new { item.ThreadType, item.ProjectId });
            entity.HasIndex(item => new { item.ThreadType, item.DepartmentName });
        });

        modelBuilder.Entity<ChatParticipantEntity>(entity =>
        {
            entity.ToTable("ChatParticipants");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.RoleInThread).HasMaxLength(50);
            entity.HasIndex(item => new { item.ChatThreadId, item.UserId }).IsUnique();
            entity.HasIndex(item => item.UserId);
            entity.HasOne(item => item.ChatThread)
                .WithMany(item => item.Participants)
                .HasForeignKey(item => item.ChatThreadId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ChatMessageEntity>(entity =>
        {
            entity.ToTable("ChatMessages");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.MessageType).HasMaxLength(50);
            entity.Property(item => item.MessageStatus).HasMaxLength(50);
            entity.Property(item => item.MessageText).HasMaxLength(4000);
            entity.HasIndex(item => new { item.ChatThreadId, item.CreatedAtUtc });
            entity.HasIndex(item => item.SenderUserId);
            entity.HasOne(item => item.ChatThread)
                .WithMany(item => item.Messages)
                .HasForeignKey(item => item.ChatThreadId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ChatAttachmentEntity>(entity =>
        {
            entity.ToTable("ChatAttachments");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.FileName).HasMaxLength(260);
            entity.Property(item => item.OriginalFileName).HasMaxLength(260);
            entity.Property(item => item.ContentType).HasMaxLength(120);
            entity.Property(item => item.StoragePath).HasMaxLength(500);
            entity.Property(item => item.PublicUrl).HasMaxLength(500);
            entity.Property(item => item.AttachmentType).HasMaxLength(50);
            entity.Property(item => item.ScanStatus).HasMaxLength(50);
            entity.Property(item => item.PreviewUrl).HasMaxLength(500);
            entity.HasIndex(item => item.ChatMessageId);
            entity.HasOne(item => item.Message)
                .WithMany(item => item.Attachments)
                .HasForeignKey(item => item.ChatMessageId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ChatReactionEntity>(entity =>
        {
            entity.ToTable("ChatReactions");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Emoji).HasMaxLength(32);
            entity.HasIndex(item => new { item.ChatMessageId, item.UserId, item.Emoji }).IsUnique();
            entity.HasOne(item => item.Message)
                .WithMany(item => item.Reactions)
                .HasForeignKey(item => item.ChatMessageId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ChatPresenceEntity>(entity =>
        {
            entity.ToTable("ChatPresences");
            entity.HasKey(item => item.UserId);
            entity.Property(item => item.PresenceStatus).HasMaxLength(50);
            entity.HasIndex(item => item.UpdatedAtUtc);
        });

        modelBuilder.Entity<ChatNotificationPreferenceEntity>(entity =>
        {
            entity.ToTable("ChatNotificationPreferences");
            entity.HasKey(item => item.UserId);
        });

        modelBuilder.Entity<ProjectEntity>(entity =>
        {
            entity.ToTable("Projects");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Name).HasMaxLength(200);
            entity.Property(item => item.Code).HasMaxLength(100);
            entity.Property(item => item.ClientBusinessUnit).HasMaxLength(200);
            entity.Property(item => item.Department).HasMaxLength(100);
            entity.Property(item => item.AdminName).HasMaxLength(200);
            entity.Property(item => item.ManagerName).HasMaxLength(200);
            entity.Property(item => item.ManagerOriginalRole).HasMaxLength(50);
            entity.Property(item => item.ManagerOriginalRolesJson).HasColumnType("nvarchar(max)");
            entity.Property(item => item.ProjectLead).HasMaxLength(200);
            entity.Property(item => item.DeliveryModel).HasMaxLength(100);
            entity.Property(item => item.Priority).HasMaxLength(50);
            entity.Property(item => item.Status).HasMaxLength(50);
            entity.Property(item => item.WorkspaceId).HasMaxLength(100);
            entity.Property(item => item.Budget).HasColumnType("decimal(18,2)");
            entity.HasIndex(item => item.Code).IsUnique();
        });

        modelBuilder.Entity<LateTimesheetRequestEntity>(entity =>
        {
            entity.ToTable("LateTimesheetRequests");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.UserName).HasMaxLength(200);
            entity.Property(item => item.Reason).HasMaxLength(500);
            entity.Property(item => item.AdditionalRemarks).HasMaxLength(2000);
            entity.HasIndex(item => item.UserId);
            entity.HasIndex(item => item.CreatedAtUtc);
        });

        modelBuilder.Entity<LateTimesheetRequestItemEntity>(entity =>
        {
            entity.ToTable("LateTimesheetRequestItems");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.ProjectName).HasMaxLength(200);
            entity.Property(item => item.TaskTitle).HasMaxLength(200);
            entity.Property(item => item.ManagerName).HasMaxLength(200);
            entity.Property(item => item.Status).HasMaxLength(50);
            entity.Property(item => item.DecisionNote).HasMaxLength(1000);
            entity.HasIndex(item => item.ManagerId);
            entity.HasIndex(item => new { item.EntryDate, item.ProjectId, item.TaskId });
            entity.HasOne(item => item.Request)
                .WithMany(item => item.Items)
                .HasForeignKey(item => item.RequestId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LeaveRequestEntity>(entity =>
        {
            entity.ToTable("LeaveRequests");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.EmployeeName).HasMaxLength(200);
            entity.Property(item => item.Department).HasMaxLength(100);
            entity.Property(item => item.AdminName).HasMaxLength(200);
            entity.Property(item => item.Type).HasMaxLength(100);
            entity.Property(item => item.Status).HasMaxLength(50);
        });

        modelBuilder.Entity<PasswordChangeRequestEntity>(entity =>
        {
            entity.ToTable("PasswordChangeRequests");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.UserName).HasMaxLength(200);
            entity.Property(item => item.UserEmail).HasMaxLength(200);
            entity.Property(item => item.Department).HasMaxLength(100);
            entity.Property(item => item.Designation).HasMaxLength(100);
            entity.Property(item => item.Status).HasMaxLength(50);
            entity.Property(item => item.CurrentPasswordHashSnapshot).HasMaxLength(256);
            entity.Property(item => item.CurrentPasswordSaltSnapshot).HasMaxLength(256);
            entity.Property(item => item.PendingPasswordHash).HasMaxLength(256);
            entity.Property(item => item.PendingPasswordSalt).HasMaxLength(256);
            entity.Property(item => item.OtpHash).HasMaxLength(256);
            entity.Property(item => item.OtpSalt).HasMaxLength(256);
            entity.Property(item => item.ReviewedByName).HasMaxLength(200);
            entity.Property(item => item.DecisionNote).HasMaxLength(2000);
            entity.HasIndex(item => item.UserId);
            entity.HasIndex(item => item.Status);
            entity.HasIndex(item => item.CreatedAtUtc);
        });

        modelBuilder.Entity<TaskAssignmentEntity>(entity =>
        {
            entity.ToTable("TaskAssignments");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.ProjectName).HasMaxLength(200);
            entity.Property(item => item.AssignedToName).HasMaxLength(200);
            entity.Property(item => item.TaskCode).HasMaxLength(50);
            entity.Property(item => item.Title).HasMaxLength(200);
            entity.Property(item => item.WorkBreakdown).HasMaxLength(4000);
            entity.Property(item => item.Priority).HasMaxLength(50);
            entity.Property(item => item.Status).HasMaxLength(50);
            entity.Property(item => item.AssignmentStatus).HasMaxLength(50);
            entity.Property(item => item.Notes).HasMaxLength(2000);
            entity.Property(item => item.RoleInTask).HasMaxLength(200);
            entity.Property(item => item.ExpectedDeliverable).HasMaxLength(500);
            entity.Property(item => item.TotalHours).HasColumnType("float");
            entity.HasIndex(item => item.TaskGroupId);
        });

        modelBuilder.Entity<DailyTimesheetEntity>(entity =>
        {
            entity.ToTable("DailyTimesheets");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Status).HasMaxLength(50);
            entity.HasIndex(item => new { item.UserId, item.Date }).IsUnique();
        });

        modelBuilder.Entity<DailyTimesheetEntryEntity>(entity =>
        {
            entity.ToTable("DailyTimesheetEntries");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.TaskTitle).HasMaxLength(200);
            entity.HasOne(item => item.DailyTimesheet)
                .WithMany(item => item.Entries)
                .HasForeignKey(item => item.DailyTimesheetId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WeeklyTimesheetEntity>(entity =>
        {
            entity.ToTable("WeeklyTimesheets");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.AdminName).HasMaxLength(200);
            entity.Property(item => item.Status).HasMaxLength(50);
            entity.HasIndex(item => new { item.UserId, item.WeekStart }).IsUnique();
        });

        modelBuilder.Entity<UserLoginActivityEntity>(entity =>
        {
            entity.ToTable("UserLoginActivity");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.AttemptedEmail).HasMaxLength(200);
            entity.Property(item => item.City).HasMaxLength(100);
            entity.Property(item => item.State).HasMaxLength(100);
            entity.Property(item => item.Country).HasMaxLength(100);
            entity.Property(item => item.IpAddress).HasMaxLength(64);
            entity.Property(item => item.UserAgent).HasMaxLength(1024);
            entity.Property(item => item.Browser).HasMaxLength(100);
            entity.Property(item => item.OperatingSystem).HasMaxLength(100);
            entity.Property(item => item.DeviceType).HasMaxLength(50);
            entity.Property(item => item.LoginStatus).HasMaxLength(50);
            entity.Property(item => item.FailureReason).HasMaxLength(500);
            entity.HasIndex(item => item.LoginTime);
            entity.HasIndex(item => item.UserId);
            entity.HasIndex(item => item.AttemptedEmail);
            entity.HasIndex(item => new { item.LoginStatus, item.LoginTime });
        });

        modelBuilder.Entity<LicenseOwnerEntity>(entity =>
        {
            entity.ToTable("license_owners");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.WorkspaceId).HasMaxLength(100);
            entity.Property(item => item.OwnerName).HasMaxLength(200);
            entity.Property(item => item.CompanyName).HasMaxLength(200);
            entity.Property(item => item.Email).HasMaxLength(200);
            entity.Property(item => item.PasswordHash).HasMaxLength(256);
            entity.Property(item => item.PasswordSalt).HasMaxLength(256);
            entity.Property(item => item.SubscriptionPlan).HasMaxLength(50);
            entity.Property(item => item.SubscriptionStatus).HasMaxLength(50);
            entity.HasIndex(item => item.Email).IsUnique();
        });

        modelBuilder.Entity<WorkspaceEntity>(entity =>
        {
            entity.ToTable("workspaces");
            entity.HasKey(item => item.WorkspaceId);
            entity.Property(item => item.WorkspaceId).HasMaxLength(100);
            entity.Property(item => item.WorkspaceName).HasMaxLength(200);
            entity.Property(item => item.WorkspaceSlug).HasMaxLength(200);
            entity.Property(item => item.Status).HasMaxLength(50);
        });

        modelBuilder.Entity<SubscriptionEntity>(entity =>
        {
            entity.ToTable("subscriptions");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.WorkspaceId).HasMaxLength(100);
            entity.Property(item => item.PlanName).HasMaxLength(50);
            entity.Property(item => item.BillingCycle).HasMaxLength(50);
            entity.Property(item => item.Status).HasMaxLength(50);
            entity.Property(item => item.InvoiceNumber).HasMaxLength(100);
            entity.Property(item => item.PaymentMethod).HasMaxLength(50);
            entity.Property(item => item.Amount).HasColumnType("decimal(18,2)");
        });
    }
}
