# Task Management Application

Full-stack task manager with user authentication.

## Features
- User registration and login (JWT + bcrypt password hashing)
- Authorization: every user can only see and change their own tasks
- CRUD for tasks: create, read, update, delete (title, description, priority, status, due date)
- Filter by status, quick "Mark done"
- Responsive design for web and mobile screens

## Tech
HTML/CSS/JavaScript, Node.js, Express, MongoDB (Mongoose)

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env`; set `MONGODB_URI` and `JWT_SECRET`
3. `npm start` and open http://localhost:3000

## API
- POST `/api/auth/register`, POST `/api/auth/login`
- GET/POST `/api/tasks`, PUT/DELETE `/api/tasks/:id` (need `Authorization: Bearer <token>`)

## Deploy (Render)
Build: `npm install` | Start: `npm start` | Env vars: `MONGODB_URI`, `JWT_SECRET`
