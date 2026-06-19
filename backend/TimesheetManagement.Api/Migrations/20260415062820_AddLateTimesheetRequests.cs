using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TimesheetManagementSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLateTimesheetRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LateTimesheetRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    AdditionalRemarks = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LateTimesheetRequests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LateTimesheetRequestItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EntryDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProjectName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TaskId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TaskTitle = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ManagerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ManagerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    DecisionNote = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    DecisionAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UnlockExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastUsedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LateTimesheetRequestItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LateTimesheetRequestItems_LateTimesheetRequests_RequestId",
                        column: x => x.RequestId,
                        principalTable: "LateTimesheetRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LateTimesheetRequestItems_EntryDate_ProjectId_TaskId",
                table: "LateTimesheetRequestItems",
                columns: new[] { "EntryDate", "ProjectId", "TaskId" });

            migrationBuilder.CreateIndex(
                name: "IX_LateTimesheetRequestItems_ManagerId",
                table: "LateTimesheetRequestItems",
                column: "ManagerId");

            migrationBuilder.CreateIndex(
                name: "IX_LateTimesheetRequestItems_RequestId",
                table: "LateTimesheetRequestItems",
                column: "RequestId");

            migrationBuilder.CreateIndex(
                name: "IX_LateTimesheetRequests_CreatedAtUtc",
                table: "LateTimesheetRequests",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_LateTimesheetRequests_UserId",
                table: "LateTimesheetRequests",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LateTimesheetRequestItems");

            migrationBuilder.DropTable(
                name: "LateTimesheetRequests");
        }
    }
}
