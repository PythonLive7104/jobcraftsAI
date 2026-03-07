 # ResumeAI (Frontend + DRF Backend)

This project now includes:
- A React + Vite frontend
- A Django REST Framework backend with JWT authentication

## 1) Frontend setup

From `frontend`:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

If needed, create a `.env` file in `frontend`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

## 2) Backend setup (Django + DRF)

From `backend`:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend runs on `http://127.0.0.1:8000`.

## 3) Docker setup (frontend + backend)

From project root:

```bash
docker compose up --build
```

Services:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`

To stop:

```bash
docker compose down
```

## 4) Auth endpoints

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/refresh/`
- `GET /api/auth/me/`

## 5) Login flow in app

- Register at `/register`
- Login at `/login`
- Dashboard and app tools are protected routes
- Unauthenticated users are redirected to `/login`
  