# Backend - Node.js Express Server

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   - Copy `.env.example` to `.env`
   - Update the PostgreSQL credentials

3. **Create PostgreSQL Database**
   ```sql
   CREATE DATABASE fullstack_db;
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Run Production Server**
   ```bash
   npm start
   ```

## Folder Structure

```
backend/
├── src/
│   ├── config/          # Database and configuration files
│   ├── controllers/     # Route controllers
│   ├── routes/          # API routes
│   ├── models/          # Database models
│   ├── middleware/      # Custom middleware
│   ├── utils/           # Utility functions
│   └── index.js         # Entry point
├── .env.example         # Environment variables template
├── .gitignore
└── package.json
```

## API Endpoints

- `GET /api/health` - Server health check
