using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TimesheetManagementSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectManagerRolePromotionTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ManagerOriginalRole",
                table: "Projects",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ManagerOriginalRolesJson",
                table: "Projects",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<bool>(
                name: "ManagerRolePromotionApplied",
                table: "Projects",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(
                """
                IF COL_LENGTH(N'Employees', N'RolesJson') IS NULL
                BEGIN
                    ALTER TABLE [Employees]
                    ADD [RolesJson] nvarchar(max) NOT NULL
                        CONSTRAINT [DF_Employees_RolesJson] DEFAULT N'';
                END
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ManagerOriginalRole",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "ManagerOriginalRolesJson",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "ManagerRolePromotionApplied",
                table: "Projects");

            migrationBuilder.Sql(
                """
                IF COL_LENGTH(N'Employees', N'RolesJson') IS NOT NULL
                BEGIN
                    DECLARE @constraintName nvarchar(128);

                    SELECT @constraintName = [dc].[name]
                    FROM sys.default_constraints AS [dc]
                    INNER JOIN sys.columns AS [c] ON [c].[default_object_id] = [dc].[object_id]
                    INNER JOIN sys.tables AS [t] ON [t].[object_id] = [c].[object_id]
                    WHERE [t].[name] = N'Employees'
                      AND [c].[name] = N'RolesJson';

                    IF @constraintName IS NOT NULL
                    BEGIN
                        EXEC(N'ALTER TABLE [Employees] DROP CONSTRAINT ' + QUOTENAME(@constraintName));
                    END

                    ALTER TABLE [Employees] DROP COLUMN [RolesJson];
                END
                """);
        }
    }
}
