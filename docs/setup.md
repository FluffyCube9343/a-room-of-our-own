# Run A Room of Our Own locally

The app consists of a React/TypeScript frontend and a Django REST API. Community actions use the real database; no mock API or browser-only persistence is required.

## Requirements

- Python 3.11 or newer compatible with Django 5.2.
- Node.js 22.18 or newer supported by Vite 7, and npm.
- Two terminals, opened at the repository root.

## First-time setup (PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv\Scripts\python.exe backend/manage.py migrate
.\.venv\Scripts\python.exe backend/manage.py seed_demo
Set-Location frontend
npm.cmd ci
```

The checked-in dependency locks are `frontend/package-lock.json` and `backend/requirements.txt`. `backend/requirements.in` records the intended direct dependency ranges; install from `requirements.txt` for a reproducible setup.

On macOS/Linux, use `.venv/bin/python` in place of `.\.venv\Scripts\python.exe` and `npm` in place of `npm.cmd`.

## Start the app

Terminal 1, from the repository root:

```powershell
.\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8000
```

Terminal 2:

```powershell
Set-Location frontend
npm.cmd run dev
```

Open **http://127.0.0.1:5173/**. Use the same hostname throughout a session; `localhost` and `127.0.0.1` have separate cookies. Django runs on port 8000 and Vite forwards `/api` requests. Port 5173 is fixed to keep the CSRF development origin predictable. Stop each server with Ctrl+C.

No environment file is necessary for local development. Optional settings are documented in `backend/.env.example` and `frontend/.env.example`; copy them to `.env` in the same directory when overrides are needed. Never commit real secrets.

## Demo accounts and moderation

See [the demo guide](demo.md) for fictional accounts and a walkthrough. You can also create a fresh account through the landing page.

Create a moderator separately:

```powershell
.\.venv\Scripts\python.exe backend/manage.py createsuperuser
```

Open **http://127.0.0.1:8000/admin/**. Reports, rooms, profiles, projects, RSVPs, and blocks are available there. Use the Reports screen to mark reports reviewed/resolved and add private staff notes. Moderators can deactivate accounts and cancel rooms or close projects.

## Checks

From the repository root:

```powershell
.\.venv\Scripts\python.exe backend/manage.py check
.\.venv\Scripts\python.exe backend/manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe backend/manage.py test tests --verbosity 2
Set-Location frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run format:check
```

Backend tests use a separate temporary database and leave the local demo database intact. `seed_demo` updates the same fictional records and moves room dates into the future; it does not erase user-created content. It only runs with development mode enabled.

## Architecture

- `frontend/src/app`: routing, session guard, application shell.
- `frontend/src/features`: auth, home, rooms, connections, projects, profile/onboarding, and safety.
- `frontend/src/components`: shared visual controls and cards.
- `frontend/src/lib`: typed fetch client and query/mutation helpers.
- `backend/apps`: separate domain models, with shared API serializers, views, and recommendation services in `community`.
- SQLite data lives at `backend/db.sqlite3` and is ignored by Git.

Authentication uses Django sessions and CSRF protection, including signup/login/logout. The frontend obtains a token before writes and refreshes the token after authentication. Backend serializers and querysets enforce ownership, private meeting URLs, discoverability, and blocking independently of the UI.

Implementation references: [Django CSRF guidance](https://docs.djangoproject.com/en/5.2/howto/csrf/), [DRF session authentication](https://www.django-rest-framework.org/api-guide/authentication/#sessionauthentication), and [Vite setup](https://vite.dev/guide/).

## Before a public deployment

This deliverable is a local scaffold. It has not been published. The planned deferred features remain deferred: messaging, mutual matching, team acceptance, video hosting, and email notifications.

For real users, complete verified email registration and password recovery, choose a shared database such as PostgreSQL, configure backups and persistent deployment storage, supply a strong secret, explicitly set `DJANGO_DEBUG=0`, configure allowed hosts/trusted origins and HTTPS, and arrange active moderation. The default development configuration must not be exposed publicly. Django's local-memory throttling is suitable for the scaffold; shared deployment needs shared rate-limit storage.

Serve the built frontend and `/api` on one public origin, with SPA history fallback for frontend routes. `npm run preview` serves only the built frontend and is not a replacement for routing the Django API. Configure Django static assets separately for the admin interface. No external meeting service is bundled.
