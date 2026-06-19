using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AbhiTimesheet.Api.Migrations
{
    /// <inheritdoc />
    public partial class ExpandUserLoginActivityForMonitoring : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AttemptedEmail",
                table: "UserLoginActivity",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "UserLoginActivity",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Country",
                table: "UserLoginActivity",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "UserLoginActivity",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "GETUTCDATE()");

            migrationBuilder.AddColumn<string>(
                name: "FailureReason",
                table: "UserLoginActivity",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsSuspicious",
                table: "UserLoginActivity",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LogoutTime",
                table: "UserLoginActivity",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "State",
                table: "UserLoginActivity",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql(
                """
                UPDATE [UserLoginActivity]
                SET [CreatedAt] = [LoginTime]
                WHERE [CreatedAt] IS NULL OR [CreatedAt] < '1900-01-01';
                """);

            migrationBuilder.CreateIndex(
                name: "IX_UserLoginActivity_AttemptedEmail",
                table: "UserLoginActivity",
                column: "AttemptedEmail");

            migrationBuilder.CreateIndex(
                name: "IX_UserLoginActivity_LoginStatus_LoginTime",
                table: "UserLoginActivity",
                columns: new[] { "LoginStatus", "LoginTime" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserLoginActivity_AttemptedEmail",
                table: "UserLoginActivity");

            migrationBuilder.DropIndex(
                name: "IX_UserLoginActivity_LoginStatus_LoginTime",
                table: "UserLoginActivity");

            migrationBuilder.DropColumn(
                name: "AttemptedEmail",
                table: "UserLoginActivity");

            migrationBuilder.DropColumn(
                name: "City",
                table: "UserLoginActivity");

            migrationBuilder.DropColumn(
                name: "Country",
                table: "UserLoginActivity");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "UserLoginActivity");

            migrationBuilder.DropColumn(
                name: "FailureReason",
                table: "UserLoginActivity");

            migrationBuilder.DropColumn(
                name: "IsSuspicious",
                table: "UserLoginActivity");

            migrationBuilder.DropColumn(
                name: "LogoutTime",
                table: "UserLoginActivity");

            migrationBuilder.DropColumn(
                name: "State",
                table: "UserLoginActivity");
        }
    }
}
