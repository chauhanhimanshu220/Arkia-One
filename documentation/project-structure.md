# Project Structure

This repository uses a product-first layout so the top level stays focused, predictable, and easy to navigate.

## Top-Level Rules

- Keep backend code under `backend/`.
- Keep frontend code under `frontend/`.
- Keep database assets under `database/`.
- Keep documentation under `documentation/`.
- Keep operational scripts under `scripts/`.
- Keep logs and temporary diagnostics under `logs/`, and out of source control.

## Backend

### `backend/TimesheetManagement.Api`

The backend is an ASP.NET Core API project.

- `Controllers/` contains HTTP endpoints.
- `Contracts/` contains request and response DTOs grouped by feature.
- `Data/` contains Entity Framework context and initialization logic.
- `Infrastructure/` contains shared backend helpers.
- `Migrations/` contains Entity Framework migrations.
- `Models/` contains persistence entities.

## Frontend

### `frontend/TimesheetManagement.Web`

The frontend is a React + Vite application.

- `src/pages/` contains route-level screens.
- `src/components/` contains reusable UI pieces.
- `src/components/<feature>/` uses lowercase feature folders for feature-specific UI.
- `src/services/` contains API and client integration code.
- `src/hooks/` contains reusable React hooks.
- `src/types/` contains shared frontend TypeScript models.
- `src/utils/` contains focused utility helpers.
- `src/layouts/` contains shared layout shells and navigation chrome.

## Database

### `database/`

- `scripts/` contains database setup and maintenance scripts.
- `seed-data/` contains demo and seed SQL assets.
- `diagrams/` contains schema diagrams and supporting visuals.

## Scripts

### `scripts/powershell`

- Contains local PowerShell utilities for frontend theming and workspace maintenance tasks.

## Working Conventions

- Add new backend code under `backend/TimesheetManagement.Api`.
- Add new frontend code under `frontend/TimesheetManagement.Web`.
- Add new documentation under `documentation/`.
- Add new database assets under `database/`.
- Keep route-level React files under `src/pages/` in `PascalCasePage.tsx`.
- Do not commit logs, caches, generated config output, or build artifacts.
