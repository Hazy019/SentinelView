# SentinelView

> **A real-time cybersecurity threat visualiser built as a portfolio project.**  
> Simulates network log ingestion, detects three threat patterns, and pushes
> live alerts to an animated, glassmorphic dashboard with a 3D attack globe.

---

## ⚠️ Important Notices (Read Before Running)

### Cold Start Delay (~30 seconds)
The backend is hosted on Render.com's **free tier**, which **spins the service
down after 15 minutes of inactivity**. The first request after idle will take
approximately 30 seconds while the container restarts. The frontend shows a
`Connecting…` skeleton state during this window. **This is a known free-tier
limitation, not a bug.**

### Page Refresh Requires Re-Login (Intentional)
The JWT is stored **in React memory only** (Context + state). It is never
written to `localStorage`, `sessionStorage`, or any cookie. This is a
deliberate security choice to prevent persistent credential storage in the
browser. A page refresh will always require re-authentication.

### Alert History Resets on New Deploy
The SQLite database file lives on Render's ephemeral disk. It **persists
across restarts** but is **wiped when a new deploy is triggered**. For a
portfolio demo this is acceptable. A production SIEM would use a persistent
managed database.

### Single-Worker Constraint
The backend **must** run with exactly one Uvicorn worker (`--workers 1`).
The in-memory sliding-window state (`defaultdict` of `deque`s) does not
synchronise across processes. Running multiple workers will silently produce
false-negatives in threat detection. Horizontal scaling is out of scope for
this demo.

---

## Tech Stack

| Layer      | Technology                                                                 |
|-----------|----------------------------------------------------------------------------|
| Generator  | Python 3.11+, `httpx`                                                      |
| Backend    | Python 3.11+, FastAPI, aiosqlite, python-jose, passlib, structlog, uvicorn |
| Transport  | WebSocket (ticket-auth) + REST fallback                                     |
| Frontend   | Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, R3F      |
| Database   | SQLite (WAL mode, single-file, Render ephemeral disk)                       |
| Hosting    | Vercel (frontend) + Render.com free web service (backend)                  |

---

## Threat Detection Rules

| Threat        | Condition                                               | Confidence |
|--------------|---------------------------------------------------------|------------|
| BRUTE_FORCE  | > 5 failed LOGINs from one IP within 10s               | HIGH       |
| BRUTE_FORCE  | 3–5 failed LOGINs from one IP within 10s               | MEDIUM     |
| PORT_SCAN    | > 10 distinct dest IPs from one IP within 5s           | HIGH       |
| DATA_EXFIL   | Single TRANSFER with `bytes_sent` > 10,000,000         | HIGH       |
| DATA_EXFIL   | Single TRANSFER with `bytes_sent` > 1,000,000          | MEDIUM     |

Detection is **deterministic conditional logic** — no ML, no probabilistic
models.

---

## Security Architecture

- **JWT**: HS256, 1-hour expiry. Stored in React memory only.
- **WebSocket Auth**: One-time ticket (UUID v4, 30s TTL, burned on use).
  JWT is **never** passed as a URL query parameter.
- **CORS**: Locked to the exact Vercel origin. Never `*`.
- **Rate limiting**: `/auth/token` capped at 5 attempts per IP per minute
  (in-memory counter, no Redis required).
- **Logging**: Structured JSON only. Tokens, passwords, and ticket values are
  never logged. The first 8 characters of a ticket are logged for tracing.
- **Secrets**: Loaded from environment variables only. Never hardcoded.

---

## Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+

### 1. Clone and configure environment

```bash
git clone https://github.com/YOUR_USERNAME/SentinelView.git
cd SentinelView
cp .env.example .env
# Edit .env — generate JWT_SECRET_KEY and bcrypt-hash your ALLOWED_PASSWORD
```

### 2. Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt

# MUST use --workers 1 (see constraint notice above)
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1 --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Generator (separate terminal)

```bash
cd generator
python -m venv .venv
.venv\Scripts\activate  # or source .venv/bin/activate

pip install -r requirements.txt

# Send 2 events/sec
python generate.py --rate 2

# Send a burst spike
python generate.py --rate 5 --burst
```

---

## Deployment

### Backend → Render.com (Free Web Service)

- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1`
- **Working directory:** `backend/`
- Set all environment variables from `.env.example` in the Render dashboard.

### Frontend → Vercel (Free)

- Connect the GitHub repo. Vercel auto-detects Next.js.
- Set `NEXT_PUBLIC_API_BASE_URL` in the Vercel dashboard.
- **Do not** use `NEXT_PUBLIC_` prefix for `JWT_SECRET_KEY`.

---

## Known Limitations

1. **No horizontal scaling** — in-memory state, single worker only.
2. **SQLite under load** — WAL + write queue handles moderate traffic;
   extreme burst may back up the queue.
3. **Cold starts** — ~30s on Render free tier after inactivity.
4. **Alert history lost on redeploy** — SQLite file wiped with container.
5. **Re-login on refresh** — JWT in memory only, intentional security choice.

---

## What This System Will NOT Do

- Connect to real network interfaces, firewalls, or OS logs
- Use machine learning or probabilistic detection
- Store real user PII or actual credentials
- Support multiple server processes or Redis
- Use any paid infrastructure or external brokers
- Send email, SMS, or push notifications
- Expose endpoints that mutate network configuration

---

*SentinelView is a portfolio demonstration project. All network events are
synthetically generated and do not represent real traffic.*
