# Personal Portfolio Website (Full-Stack)

- **Frontend:** HTML, CSS, JavaScript (`public/`)
- **Backend:** Node.js + Express (`server.js`)
- **Database:** MongoDB (Mongoose) – stores projects and contact messages
- **Hosting:** Render (or any Node host)

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env` and set `MONGODB_URI` (free cluster at mongodb.com/atlas)
3. `npm start` → open https://tharanex-internship.onrender.com/#contact

## API
- `GET /api/projects` – list projects
- `POST /api/contact` – save a message `{name, email, message}`

## Deploy (Render)
1. Push this folder to GitHub.
2. render.com → New → Web Service → select repo.
3. Build command: `npm install`, Start command: `npm start`.
4. Add environment variable `MONGODB_URI`. Deploy and submit the live URL.
