namespace AbhiTimesheet.Api.Contracts.Departments;

public sealed record DepartmentRequest(
    string Name,
    string Code,
    string Description,
    string? ParentDepartmentId,
    string? HeadEmployeeId,
    string EmailAlias,
    string CostCenter,
    string Status);

public sealed record DepartmentListDto(
    string Id,
    string Name,
    string Code,
    string Description,
    string? ParentDepartmentId,
    string? ParentDepartmentName,
    string? HeadEmployeeId,
    string? HeadEmployeeName,
    string EmailAlias,
    string CostCenter,
    int EmployeeCount,
    int ActiveEmployeeCount,
    int InactiveEmployeeCount,
    int ProjectCount,
    int ActiveProjectCount,
    string Status,
    string CreatedAtUtc,
    string UpdatedAtUtc);

public sealed record DepartmentEmployeeDto(
    string Id,
    string FullName,
    string Email,
    string Role,
    string Status);

public sealed record DepartmentProjectDto(
    string Id,
    string Name,
    string Code,
    string ManagerName,
    string Status,
    string EndDate);

public sealed record DepartmentDetailDto(
    string Id,
    string Name,
    string Code,
    string Description,
    string? ParentDepartmentId,
    string? ParentDepartmentName,
    string? HeadEmployeeId,
    string? HeadEmployeeName,
    string EmailAlias,
    string CostCenter,
    int EmployeeCount,
    int ActiveEmployeeCount,
    int InactiveEmployeeCount,
    int ProjectCount,
    int ActiveProjectCount,
    string Status,
    string CreatedAtUtc,
    string UpdatedAtUtc,
    IReadOnlyList<DepartmentEmployeeDto> Employees,
    IReadOnlyList<DepartmentProjectDto> Projects);
