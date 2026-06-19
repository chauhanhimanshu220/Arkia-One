# Enterprise Architecture Refactor Plan

This document defines the target production-grade structure for the Timesheet + Finance Management system and the migration approach used to move from the legacy layout to the current naming convention.

## Current Assessment

The repository originally used `apps/api` and `apps/web`, but most code inside those apps was still organized by technical layer instead of by business feature.

### What is working

- The repo root is already app-first.
- The frontend `chat` module is the closest example of a feature-focused structure.
- The backend already separates controllers, contracts, models, data, and infrastructure at a basic level.

### Main problems observed

- Frontend business logic is scattered across parallel folders such as `pages`, `components`, `hooks`, `services`, and `types`.
- `frontend/TimesheetManagement.Web/src/App.tsx` is acting as a large route registry and orchestration file.
- Several backend controllers use `AppDbContext` directly and contain validation, mapping, persistence, and workflow logic in one place.
- `backend/TimesheetManagement.Api/Program.cs` contains startup wiring plus database repair/bootstrap behavior that should be moved behind extensions/services.
- There is no repository layer or interface-based service boundary for most features.
- Naming is inconsistent: the repo/project name is `TimesheetManagementSystem`, while most API namespaces still use `AbhiTimesheet.Api`.
- There are a few confusing leftovers that should be cleaned during migration, such as the orphan `apps/web/package-lock.json` at the repository root and the empty `Billable` file.

## Final Project Structure

```text
TimesheetManagementSystem/
|-- backend/
|   `-- TimesheetManagement.Api/
|       |-- src/
|       |   |-- TimesheetManagementSystem.Api/
|       |   |   |-- Controllers/
|       |   |   |   |-- Account/
|       |   |   |   |-- Activity/
|       |   |   |   |-- Auth/
|       |   |   |   |-- Chat/
|       |   |   |   |-- Departments/
|       |   |   |   |-- Employees/
|       |   |   |   |-- Finance/
|       |   |   |   |-- Leaves/
|       |   |   |   `-- Timesheets/
|       |   |   |-- Middleware/
|       |   |   |   |-- ErrorHandlingMiddleware.cs
|       |   |   |   `-- RequestLoggingMiddleware.cs
|       |   |   |-- Extensions/
|       |   |   |   |-- ServiceCollectionExtensions.cs
|       |   |   |   `-- ApplicationBuilderExtensions.cs
|       |   |   |-- Filters/
|       |   |   |-- Program.cs
|       |   |   |-- appsettings.json
|       |   |   `-- appsettings.Development.json
|       |   |-- TimesheetManagementSystem.Application/
|       |   |   |-- Common/
|       |   |   |   |-- Exceptions/
|       |   |   |   |-- Interfaces/
|       |   |   |   `-- Models/
|       |   |   `-- Features/
|       |   |       |-- Account/
|       |   |       |   |-- DTOs/
|       |   |       |   |-- Interfaces/
|       |   |       |   |-- Mappings/
|       |   |       |   `-- Services/
|       |   |       |-- Activity/
|       |   |       |-- Auth/
|       |   |       |-- Chat/
|       |   |       |-- Departments/
|       |   |       |-- Employees/
|       |   |       |-- Finance/
|       |   |       |-- Leaves/
|       |   |       |-- Projects/
|       |   |       `-- Timesheets/
|       |   |-- TimesheetManagementSystem.Domain/
|       |   |   |-- Entities/
|       |   |   |-- Enums/
|       |   |   |-- ValueObjects/
|       |   |   `-- Constants/
|       |   `-- TimesheetManagementSystem.Infrastructure/
|       |       |-- Persistence/
|       |       |   |-- Context/
|       |       |   |   `-- AppDbContext.cs
|       |       |   |-- Configurations/
|       |       |   |-- Migrations/
|       |       |   `-- Seed/
|       |       |-- Repositories/
|       |       |   |-- Account/
|       |       |   |-- Activity/
|       |       |   |-- Auth/
|       |       |   |-- Chat/
|       |       |   |-- Departments/
|       |       |   |-- Employees/
|       |       |   |-- Finance/
|       |       |   |-- Leaves/
|       |       |   |-- Projects/
|       |       |   `-- Timesheets/
|       |       |-- Services/
|       |       |   |-- Location/
|       |       |   |-- Security/
|       |       |   `-- Storage/
|       |       `-- DependencyInjection/
|       `-- tests/
|           |-- TimesheetManagementSystem.Api.Tests/
|           |-- TimesheetManagementSystem.Application.Tests/
|           `-- TimesheetManagementSystem.Infrastructure.Tests/
|-- frontend/
|   `-- TimesheetManagement.Web/
|       |-- public/
|       `-- src/
|           |-- app/
|           |   |-- providers/
|           |   |-- router/
|           |   |   |-- AppRouter.tsx
|           |   |   `-- routeGuards.tsx
|           |   `-- App.tsx
|           |-- features/
|           |   |-- account/
|           |   |   |-- components/
|           |   |   |-- hooks/
|           |   |   |-- pages/
|           |   |   |-- services/
|           |   |   |-- types/
|           |   |   `-- index.ts
|           |   |-- activity/
|           |   |-- approvals/
|           |   |-- auth/
|           |   |-- chat/
|           |   |-- dashboards/
|           |   |-- departments/
|           |   |-- employees/
|           |   |-- finance/
|           |   |-- leaves/
|           |   |-- notifications/
|           |   |-- projects/
|           |   `-- timesheets/
|           |-- components/
|           |   |-- common/
|           |   `-- layout/
|           |-- services/
|           |   `-- api/
|           |       |-- client.ts
|           |       |-- endpoints.ts
|           |       `-- http.ts
|           |-- store/
|           |   |-- slices/
|           |   `-- index.ts
|           |-- utils/
|           |-- assets/
|           |-- index.css
|           `-- main.tsx
|-- database/
|   |-- scripts/
|   |-- seed-data/
|   `-- diagrams/
|-- documentation/
|   |-- project-structure.md
|   `-- architecture-refactor-plan.md
|-- scripts/
|   `-- powershell/
`-- TimesheetManagementSystem.slnx
```

### Frontend feature template

Every frontend feature should use the same internal shape:

```text
features/<feature-name>/
|-- components/
|-- hooks/
|-- pages/
|-- services/
|-- types/
`-- index.ts
```

### Backend feature template

Every backend feature should follow the same request flow:

```text
Controller -> Application Service -> Repository -> DbContext
```

With ownership split like this:

- `Api`: HTTP concerns only.
- `Application`: use cases, DTOs, validation, orchestration.
- `Domain`: entities and business rules.
- `Infrastructure`: EF Core, repositories, file storage, external integrations.

## Database Separation

Use SQL Server schemas to make the database structure clearer:

### `core`

Stable master/reference data.

- `core.Departments`
- `core.Employees`
- `core.Projects`
- `core.LeaveTypes`
- `core.ApprovalChains`

### `txn`

Day-to-day transactional records.

- `txn.DailyTimesheets`
- `txn.DailyTimesheetEntries`
- `txn.WeeklyTimesheets`
- `txn.LeaveRequests`
- `txn.LateTimesheetRequests`
- `txn.LateTimesheetRequestItems`
- `txn.ChatThreads`
- `txn.ChatParticipants`
- `txn.ChatMessages`
- `txn.PayrollRuns`
- `txn.BillingInvoices`
- `txn.Payments`

### `audit`

Traceability, monitoring, and compliance data.

- `audit.AccountAuditLogs`
- `audit.UserLoginActivity`
- `audit.ApprovalHistory`
- `audit.ImportJobLogs`
- `audit.IntegrationLogs`

If schema changes are too disruptive for the first pass, keep current table names first and introduce schema separation in a second migration wave.

## Architecture Explanation

This structure is better because each business capability is owned end-to-end instead of being scattered across unrelated folders. On the frontend, an employee change stays mostly inside `features/employees`; on the backend, the request moves through clear layers without controllers talking directly to EF Core for every decision.

It is also more scalable because shared pieces are limited to real cross-cutting concerns. Layout components, API client code, middleware, logging, and utilities live in stable shared locations, while feature-specific code stays out of global folders. That keeps the codebase easier to reason about as the finance and timesheet modules grow.

## Naming Standards

### Backend

- Use one namespace family only: `TimesheetManagementSystem.Api`, `TimesheetManagementSystem.Application`, `TimesheetManagementSystem.Domain`, `TimesheetManagementSystem.Infrastructure`.
- Keep persistence models under `Domain/Entities` and use the `Entity` suffix only for database entities if you want that distinction.
- Rename `Contracts` to `DTOs`, split further into `Requests` and `Responses` when helpful.
- Use `IEmployeeService`, `EmployeeService`, `IEmployeeRepository`, `EmployeeRepository`.
- Keep controller names plural and route-focused, for example `EmployeesController`.

### Frontend

- Keep folder names lowercase and feature names singular/plural by domain, for example `features/employees`, `features/timesheets`.
- Use `PascalCase` for React components and pages.
- Use `camelCase` or dotted filenames consistently for service/helpers. Pick one convention and enforce it; for example `employee.service.ts`, `useEmployees.ts`, `employee.types.ts`.
- Keep shared UI only in `components/common` or `components/layout`. Do not place feature UI there.

### Cleanup targets

- Remove leftover names based on `AbhiTimesheet`.
- Remove duplicate or unclear files such as the legacy root `apps/web/package-lock.json`.
- Remove empty placeholder files like `Billable` unless they have a documented purpose.

## Migration Plan

1. Create the new folders first without moving everything at once.
2. Standardize naming before large moves: namespace root, folder names, and DTO naming.
3. Split the backend into `Api`, `Application`, `Domain`, and `Infrastructure` projects in the solution.
4. Move `Models` into `Domain/Entities` and move `AppDbContext`, EF configurations, migrations, and seed logic into `Infrastructure/Persistence`.
5. Add application-layer interfaces such as `IEmployeeService`, `IProjectService`, `ITimesheetService`, and repository interfaces for each feature.
6. Refactor one backend feature at a time from controller-heavy code into `Controller -> Service -> Repository`.
7. Start with a low-risk vertical slice such as `Employees`, because it touches CRUD, validation, files, DTOs, and mapping patterns that can be reused.
8. Extract middleware from `Program.cs` for exception handling and request logging, then move service registration into extension methods.
9. On the frontend, create `src/app`, `src/features`, `src/components/common`, `src/components/layout`, `src/services/api`, `src/store`, and keep `src/utils` for small shared helpers only.
10. Move one frontend feature at a time. A good first slice is `employees` because it already has a page, hook, service usage, components, and types spread across the current structure.
11. Move route registration out of `App.tsx` into `app/router/AppRouter.tsx` and allow each feature to expose its own route definitions.
12. Use the current `chat` module as the reference pattern for how a feature can own its own pages, hooks, services, and types.
13. After each slice, update imports, run a build, and remove the old files only after the replacement works.
14. Add tests while migrating each slice instead of waiting until the end.
15. Move database objects into `core`, `txn`, and `audit` schemas only after the application-layer refactor is stable.

## Common Mistakes To Avoid

- Do not do a big-bang move of every file in one branch.
- Do not keep controllers directly querying `DbContext` after introducing services and repositories.
- Do not mix DTOs, EF entities, and frontend view models under one generic `Models` folder.
- Do not turn `components/common` or `utils` into dumping grounds for feature-specific code.
- Do not create vague folders like `Helpers`, `Misc`, `Manager`, or `SharedStuff`.
- Do not let route configuration stay centralized in one giant `App.tsx`.
- Do not move database tables into new schemas without migration scripts, data validation, and rollback planning.
- Do not rename namespaces, folders, and DTOs inconsistently; establish the convention first and apply it everywhere.
