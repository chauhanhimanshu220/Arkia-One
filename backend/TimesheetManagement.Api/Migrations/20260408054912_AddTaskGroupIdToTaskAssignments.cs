using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AbhiTimesheet.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskGroupIdToTaskAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TaskGroupId",
                table: "TaskAssignments",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_TaskAssignments_TaskGroupId",
                table: "TaskAssignments",
                column: "TaskGroupId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TaskAssignments_TaskGroupId",
                table: "TaskAssignments");

            migrationBuilder.DropColumn(
                name: "TaskGroupId",
                table: "TaskAssignments");
        }
    }
}
