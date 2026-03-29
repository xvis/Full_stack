# Quick Start Guide - Running Both Servers

## Prerequisites
- PostgreSQL installed and running on localhost:5432
- Node.js v16+

## Step 1: Setup PostgreSQL Database

```bash
# Open PostgreSQL CLI
psql -U postgres

# Create database
CREATE DATABASE fullstack_db;

# Exit
\q
```

## Step 2: Backend Server (Port 5000)

**Terminal 1:**
```bash
cd /Users/vivekkumar/Desktop/FullStack_Project/backend
npm run dev
```

Expected output:
```
Server is running on port 5000
```

Test health check:
```bash
curl http://localhost:5000/api/health
# Response: {"message":"Server is running"}
```

## Step 3: Frontend Server (Port 4200)

**Terminal 2:**
```bash
cd /Users/vivekkumar/Desktop/FullStack_Project/frontend
ng serve
```

Expected output:
```
Application bundle generation complete...
```

Open browser: `http://localhost:4200`

## Architecture Overview

```
┌─────────────────────────────────────────┐
│         Frontend (Angular)              │
│         http://localhost:4200           │
│  ┌─────────────────────────────────┐   │
│  │  Components, Services, Routing  │   │
│  └─────────────────┬───────────────┘   │
└────────────────────┼───────────────────┘
                     │ HTTP Requests
                     ▼
┌─────────────────────────────────────────┐
│      Backend (Node.js / Express)        │
│      http://localhost:5000              │
│  ┌─────────────────────────────────┐   │
│  │  Routes, Controllers, Models    │   │
│  └─────────────────┬───────────────┘   │
└────────────────────┼───────────────────┘
                     │ SQL Queries
                     ▼
         ┌───────────────────────┐
         │  PostgreSQL Database  │
         │  fullstack_db         │
         └───────────────────────┘
```

## Folder Structure

```
FullStack_Project/
├── frontend/          # Angular CLI project (PORT 4200)
│   ├── src/app/      # Angular components & services
│   ├── angular.json
│   └── package.json
│
├── backend/           # Express.js server (PORT 5000)
│   ├── src/
│   │   ├── config/   # Database connection
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── index.js
│   ├── .env          # Environment variables
│   └── package.json
│
└── README.md
```

## Common Issues

### Backend won't start
- Check PostgreSQL is running: `brew services start postgresql`
- Verify .env file has correct DB credentials
- Check port 5000 is not in use: `lsof -i :5000`

### Frontend won't start
- Run: `cd frontend && npm install`
- Clear Angular cache: `ng cache clean`
- Check port 4200 is not in use: `lsof -i :4200`

### Database connection error
- Verify PostgreSQL is running
- Check DB_USER and DB_PASSWORD in .env
- Ensure fullstack_db database exists

## Next Steps

1. Start both servers (see Step 2 & 3 above)
2. Navigate to `http://localhost:4200`
3. Build API endpoints in backend
4. Create Angular services to call APIs
5. Build UI components in Angular
