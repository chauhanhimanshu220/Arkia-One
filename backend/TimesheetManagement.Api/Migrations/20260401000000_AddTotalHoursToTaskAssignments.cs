using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AbhiTimesheet.Api.Migrations;

[Migration("20260401000000_AddTotalHoursToTaskAssignments")]
public sealed class AddTotalHoursToTaskAssignments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<double>(
            name: "TotalHours",
            table: "TaskAssignments",
            type: "float",
            nullable: false,
            defaultValue: 0d);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "TotalHours",
            table: "TaskAssignments");
    }
}
