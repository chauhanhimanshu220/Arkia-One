# TimesheetManagementSystem

TimesheetManagementSystem is organized as a small monorepo with clear top-level areas for the backend, frontend, database assets, documentation, operational scripts, and logs.

## Repository Layout

```text
.
|-- backend/
|   `-- TimesheetManagement.Api/
|-- frontend/
|   `-- TimesheetManagement.Web/
|-- database/
|   |-- scripts/
|   |-- seed-data/
|   `-- diagrams/
|-- documentation/
|-- scripts/
|   `-- powershell/
|-- logs/
|   `-- codex/
`-- TimesheetManagementSystem.sln
```

## Quick Start

### Backend

Build and run from the repository root:
```powershell
dotnet restore TimesheetManagementSystem.sln
dotnet build TimesheetManagementSystem.sln
dotnet run --project backend/TimesheetManagement.Api/TimesheetManagement.Api.csproj
```

Alternatively, build and run directly from the API folder:
```powershell
cd backend/TimesheetManagement.Api
dotnet restore
dotnet run
```

### Frontend

```powershell
cd frontend/TimesheetManagement.Web
npm install
npm run dev
```

Copy `frontend/TimesheetManagement.Web/.env.example` to `.env` when you need custom frontend environment values.

## Notes

- Generated logs and temporary build output are intentionally ignored.
- PowerShell utilities now live under `scripts/powershell`.
- Demo database seed assets now live under `database/seed-data`.
- The solution file points to the API project under `backend/TimesheetManagement.Api`.
- The target enterprise refactor plan is documented in `documentation/architecture-refactor-plan.md`.
