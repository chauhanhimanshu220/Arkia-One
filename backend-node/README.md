# Profit & Loss API

Node.js + Express + MySQL API for the Payroll Management System Profit & Loss module.

## Setup

1. Create the MySQL database:

```sql
CREATE DATABASE payroll_management;
```

2. Run the schema:

```bash
mysql -u root -p payroll_management < sql/profit_loss_schema.sql
```

3. Configure environment:

```bash
copy .env.example .env
```

4. Install and run:

```bash
npm install
npm run dev
```

5. Point the React app to this API while developing:

```bash
set VITE_BACKEND_TARGET=http://localhost:5300
npm run dev
```

## API

- `POST /api/auth/login`
- `GET /api/profit-loss/dashboard`
- `POST /api/profit-loss/revenues`
- `PUT /api/profit-loss/revenues/:id`
- `DELETE /api/profit-loss/revenues/:id`
- `POST /api/profit-loss/expenses`
- `PUT /api/profit-loss/expenses/:id`
- `DELETE /api/profit-loss/expenses/:id`
- `POST /api/profit-loss/reports`

All profit-loss routes require a JWT token with `Admin` or `Finance Admin` role.
