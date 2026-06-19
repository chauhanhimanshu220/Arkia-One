using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AbhiTimesheet.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF COL_LENGTH(N'Employees', N'BusinessUnit') IS NULL
                BEGIN
                    ALTER TABLE [Employees] ADD [BusinessUnit] nvarchar(100) NOT NULL CONSTRAINT [DF_Employees_BusinessUnit] DEFAULT N'';
                END

                IF COL_LENGTH(N'Employees', N'DateOfBirth') IS NULL
                BEGIN
                    ALTER TABLE [Employees] ADD [DateOfBirth] date NULL;
                END

                IF COL_LENGTH(N'Employees', N'Designation') IS NULL
                BEGIN
                    ALTER TABLE [Employees] ADD [Designation] nvarchar(100) NOT NULL CONSTRAINT [DF_Employees_Designation] DEFAULT N'';
                END

                IF COL_LENGTH(N'Employees', N'EmployeeCode') IS NULL
                BEGIN
                    ALTER TABLE [Employees] ADD [EmployeeCode] nvarchar(50) NOT NULL CONSTRAINT [DF_Employees_EmployeeCode] DEFAULT N'';
                END

                IF COL_LENGTH(N'Employees', N'Gender') IS NULL
                BEGIN
                    ALTER TABLE [Employees] ADD [Gender] nvarchar(50) NOT NULL CONSTRAINT [DF_Employees_Gender] DEFAULT N'';
                END

                IF COL_LENGTH(N'Employees', N'MobileNumber') IS NULL
                BEGIN
                    ALTER TABLE [Employees] ADD [MobileNumber] nvarchar(30) NOT NULL CONSTRAINT [DF_Employees_MobileNumber] DEFAULT N'';
                END

                IF COL_LENGTH(N'Employees', N'ReportingManagerId') IS NULL
                BEGIN
                    ALTER TABLE [Employees] ADD [ReportingManagerId] uniqueidentifier NULL;
                END

                IF COL_LENGTH(N'Employees', N'UserType') IS NULL
                BEGIN
                    ALTER TABLE [Employees] ADD [UserType] nvarchar(50) NOT NULL CONSTRAINT [DF_Employees_UserType] DEFAULT N'';
                END

                IF COL_LENGTH(N'Employees', N'WorkLocation') IS NULL
                BEGIN
                    ALTER TABLE [Employees] ADD [WorkLocation] nvarchar(50) NOT NULL CONSTRAINT [DF_Employees_WorkLocation] DEFAULT N'';
                END
                """);

            migrationBuilder.Sql(
                """
                UPDATE [target]
                SET [EmployeeCode] = CONCAT(N'EMP-', RIGHT(CONCAT(N'0000', CAST([source].[Seq] AS nvarchar(10))), 4))
                FROM [Employees] AS [target]
                INNER JOIN (
                    SELECT
                        [Id],
                        ROW_NUMBER() OVER (ORDER BY [CreatedAtUtc], [Id]) AS [Seq]
                    FROM [Employees]
                ) AS [source] ON [source].[Id] = [target].[Id]
                WHERE LTRIM(RTRIM(ISNULL([target].[EmployeeCode], N''))) = N'';
                """);

            migrationBuilder.Sql(
                """
                IF NOT EXISTS (
                    SELECT 1
                    FROM sys.indexes
                    WHERE [name] = N'IX_Employees_EmployeeCode'
                      AND [object_id] = OBJECT_ID(N'[Employees]')
                )
                BEGIN
                    CREATE UNIQUE INDEX [IX_Employees_EmployeeCode] ON [Employees] ([EmployeeCode]);
                END
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Employees_EmployeeCode",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "BusinessUnit",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "DateOfBirth",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "Designation",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "EmployeeCode",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "MobileNumber",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "ReportingManagerId",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "UserType",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "WorkLocation",
                table: "Employees");
        }
    }
}
