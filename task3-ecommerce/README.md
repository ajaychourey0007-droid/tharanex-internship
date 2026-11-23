# E-Commerce Web Application

Full-stack online store with product management and order tracking.

## Features
- Product catalog with search, add to cart, quantity control and checkout
- User login/registration (JWT + bcrypt) with role-based access (Admin / User)
- Admin: add, edit, delete products; view all orders; update order status (placed, packed, shipped, delivered, cancelled)
- User: place orders and track their status under "My Orders"
- Backend REST APIs for products and orders; prices and stock are verified on the server
- MongoDB database (Mongoose); responsive UI

**The first account registered becomes the Admin.** Later accounts are normal users.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env`; set `MONGODB_URI` and `JWT_SECRET`
3. `npm start` and open http://localhost:3000 (4 sample products are added automatically)

## API
- POST `/api/auth/register`, `/api/auth/login`
- GET `/api/products`; POST/PUT/DELETE `/api/products/:id` (admin)
- POST `/api/orders`, GET `/api/orders/mine`, GET `/api/orders` (admin), PUT `/api/orders/:id/status` (admin)

## Deploy (Render)
Build: `npm install` | Start: `npm start` | Env vars: `MONGODB_URI`, `JWT_SECRET`
