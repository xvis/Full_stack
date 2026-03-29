# Full Stack Application - Angular & Node.js

A complete full-stack web application built with Angular frontend, Node.js/Express backend, and PostgreSQL database.

## Project Structure

```
FullStack_Project/
├── frontend/                # Angular application
│   ├── src/
│   │   ├── app/            # Main application folder
│   │   │   ├── components/ # Reusable components
│   │   │   ├── pages/      # Page components
│   │   │   ├── services/   # API services
│   │   │   ├── models/     # TypeScript interfaces
│   │   │   └── app.module.ts
│   │   ├── assets/         # Static files
│   │   └── index.html
│   └── package.json
│
├── backend/                 # Node.js Express server
│   ├── src/
│   │   ├── config/         # Database configuration
│   │   ├── controllers/    # Request handlers
│   │   ├── routes/         # API route definitions
│   │   ├── models/         # Data models
│   │   ├── middleware/     # Custom middleware
│   │   ├── utils/          # Helper functions
│   │   └── index.js        # Server entry point
│   ├── .env                # Environment variables
│   └── package.json
│
└── README.md              # This file
```

## Technology Stack

### Frontend
- **Angular 16** - UI framework
- **TypeScript** - Programming language
- **RxJS** - Reactive programming
- **Angular Router** - Navigation
- **Angular Forms** - Form handling

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **PostgreSQL** - Relational database
- **JWT** - Authentication
- **BCrypt** - Password hashing

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- PostgreSQL (v12 or higher)
- Angular CLI

### Installation

1. **Install PostgreSQL and create database**
   ```bash
   # Create database
   createdb fullstack_db
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Update .env with your PostgreSQL credentials
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   # Generate Angular project structure if needed
   ng new . --skip-git
   ng serve
   ```

## Running the Application

### Development Mode

**Terminal 1 - Backend**
```bash
cd backend
npm run dev
```
Server runs on `http://localhost:5000`

**Terminal 2 - Frontend**
```bash
cd frontend
ng serve
```
Application runs on `http://localhost:4200`

### Production Mode

**Backend**
```bash
cd backend
npm start
```

**Frontend**
```bash
cd frontend
ng build --configuration production
```

## API Endpoints

Base URL: `http://localhost:5000/api`

- `GET /health` - Server health check

## Environment Variables

### Backend (.env)
```
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fullstack_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_key
```

### Frontend (environment.ts)
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api'
};
```

## Development Guidelines

### Backend
- Use controllers for business logic
- Create middleware for cross-cutting concerns
- Use models for data validation
- Handle errors gracefully

### Frontend
- Use services for API calls
- Create reusable components
- Use Angular forms for validation
- Implement guards for route protection

## Database Setup

### Create Initial Tables

```sql
-- Users table example
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Testing

### Backend
```bash
cd backend
npm test
```

### Frontend
```bash
cd frontend
ng test
```

## Deployment

### Backend Deployment
- Use services like Heroku, Railway, or AWS
- Set environment variables on deployment platform
- Run database migrations

### Frontend Deployment
- Build: `ng build --configuration production`
- Deploy to Netlify, Vercel, or AWS S3

## Troubleshooting

### Backend Connection Issues
- Verify PostgreSQL is running
- Check .env credentials
- Ensure database exists

### Frontend Issues
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear Angular cache: `ng cache clean`
- Check API endpoint configuration

## License

ISC

## Author

Your Name
