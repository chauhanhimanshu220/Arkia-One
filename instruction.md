# TMSedit Project - Setup & Run Instructions

Yeh document TMSedit full project (Backend aur Frontend) ko set up aur run karne ke steps batata hai.

## Prerequisites
- **Backend ke liye**: .NET 8 SDK (Ya usse naya version), SQL Server, aur Entity Framework Core CLI tools (`dotnet tool install --global dotnet-ef`).
- **Frontend ke liye**: Node.js (v18+) aur npm/yarn/pnpm.

---

## 1. Backend (API) Ko Run Karne Ke Steps

### Step 1: Open Terminal for Backend
Sabse pehle terminal open karein aur backend project folder mein navigate karein:
```bash
cd backend\TimesheetManagement.Api
```

### Step 2: Restore Dependencies & Update Database
Apne database ko latest migrations ke saath update karein (Ensure karein ki `appsettings.json` mein connection string sahi ho):
```bash
dotnet restore
dotnet ef database update
```

### Step 3: Run the API
```bash
dotnet run
```
*(API usually `http://localhost:5296` (http) or other configured port. Aap Swagger UI ko browser mein open karke endpoints test kar sakte hain.)*

---

## 2. Frontend Ko Run Karne Ke Steps

### Step 1: Open New Terminal for Frontend
Naya terminal open karein aur frontend project folder mein navigate karein:
```bash
cd frontend
```

### Step 2: Install Dependencies & Run
Saare zaroori packages install karke development server start karein:
```bash
npm install
npm run dev
```
*(Agar aap yarn use karte hain, toh `yarn install` aur `yarn dev` run karein. Frontend application usually `http://localhost:5173` ya `http://localhost:3000` par open hogi).*