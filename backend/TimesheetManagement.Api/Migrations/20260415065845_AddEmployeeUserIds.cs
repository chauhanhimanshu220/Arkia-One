using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TimesheetManagementSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeUserIds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "Employees",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE [Employees]
                SET [UserId] = CASE
                    WHEN [Id] = '77777777-7777-7777-7777-777777777701' THEN 'admin'
                    WHEN [EmployeeCode] IS NOT NULL AND LTRIM(RTRIM([EmployeeCode])) <> '' THEN LOWER(REPLACE(LTRIM(RTRIM([EmployeeCode])), '-', ''))
                    ELSE LOWER(CONCAT('user', REPLACE(CONVERT(nvarchar(36), [Id]), '-', '')))
                END
                WHERE [UserId] IS NULL OR LTRIM(RTRIM([UserId])) = '';
                """);

            migrationBuilder.AlterColumn<string>(
                name: "UserId",
                table: "Employees",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Employees_UserId",
                table: "Employees",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Employees_UserId",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Employees");
        }
    }
}
