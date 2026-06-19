using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TimesheetManagementSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPasswordChangeApprovalWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PasswordChangeRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    UserEmail = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Department = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Designation = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CurrentPasswordHashSnapshot = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    CurrentPasswordSaltSnapshot = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    PendingPasswordHash = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    PendingPasswordSalt = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    OtpHash = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    OtpSalt = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    OtpExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    OtpAttemptCount = table.Column<int>(type: "int", nullable: false),
                    OtpVerifiedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReviewedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReviewedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    DecisionNote = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    DecisionAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordChangeRequests", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PasswordChangeRequests_CreatedAtUtc",
                table: "PasswordChangeRequests",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordChangeRequests_Status",
                table: "PasswordChangeRequests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordChangeRequests_UserId",
                table: "PasswordChangeRequests",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PasswordChangeRequests");
        }
    }
}
