# Blog Platform with Comments

Full-stack blogging platform where users can create posts and comment.

## Features
- User registration, login and authentication (JWT + bcrypt)
- Create, edit and delete blog posts (only the author can edit/delete a post)
- Comment section: logged-in users can comment; a comment can be deleted by its author or the post's author
- RESTful APIs with MongoDB (Mongoose); responsive design

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env`; set `MONGODB_URI` and `JWT_SECRET`
3. `npm start` and open http://localhost:3000

## API
- POST `/api/auth/register`, `/api/auth/login`
- GET `/api/posts`, GET `/api/posts/:id`; POST, PUT, DELETE (auth, author only)
- GET/POST `/api/posts/:id/comments`; DELETE `/api/comments/:id`

## Deploy (Render)
Build: `npm install` | Start: `npm start` | Env vars: `MONGODB_URI`, `JWT_SECRET`
