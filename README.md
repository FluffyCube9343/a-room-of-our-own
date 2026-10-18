# A Room of Our Own

*If we're not given a seat at the table, we'll build our own room.*

A women-centered, gender-inclusive community for finding your people in tech: host a conversation, meet a mentor, start a project, or share the tools to build one.

Inspired by Virginia Woolf's *A Room of One's Own* and rooted in the University of Virginia community, the project gives people a place to create opportunities together.

## Explore the app

- **Rooms:** Host scheduled talks, workshops, panels, and coworking sessions, or create an ongoing topic chatroom. Rooms support physical and virtual locations together, cover photos, RSVPs, and host-approved collaborators. Search by topic and discover rooms related to your interests.
- **Connections:** Discover people through photo-and-prompt profiles, shared interests, and compatibility explanations. Send likes, form mutual connections, and continue the conversation in DMs. Member names and avatars link to their profiles throughout the app.
- **Build together:** Share project ideas, search for topics and skills, and request to collaborate. Hardware projects can surface relevant community resources and curated external learning links.
- **Share resources:** List equipment and materials to lend or give away. Search and filter the shelf, see interest-based recommendations, and manage borrowing and lending requests.
- **Room conversations:** Participate in a single shared channel with replies, message editing, deletion, and a member sidebar. Room messages refresh through polling.
- **Your profile:** Introduce yourself with photos, prompts, interests, skills, academic stage or professional role, and what you're here to do.

The Home board brings people, rooms, and projects together. Blocking, reporting, profile visibility controls, and host moderation support the community experience.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, React Router, TanStack Query, React Hook Form, and Zod.
- **Backend:** Django 5.2 and Django REST Framework, with session authentication and CSRF protection.
- **Data and media:** SQLite for local development; PostgreSQL and S3 storage supported through deployment settings.
- **Production serving:** Docker, Gunicorn, and WhiteNoise.

Recommendations use profile interests, skills, and keyword matching. No generative AI API is required to run the app.

## Run locally

### Prerequisites

- Python 3.11 or newer compatible with Django 5.2.
- Node.js 22.18+ and npm.
- Two terminals: one for Django and one for Vite.

### 1. Install and prepare the database

From the repository root in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv\Scripts\python.exe backend/manage.py migrate
.\.venv\Scripts\python.exe backend/manage.py seed_demo
Set-Location frontend
npm.cmd ci
```

`seed_demo` is optional. It adds fictional members and community content for exploring the app locally. See the [demo accounts](docs/demo.md#sign-in) for sign-in details.

On macOS/Linux, use `.venv/bin/python` instead of `.\.venv\Scripts\python.exe`, `cd frontend` instead of `Set-Location frontend`, and `npm` instead of `npm.cmd`.

### 2. Start the backend

In a terminal at the repository root:

```powershell
.\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8000
```

### 3. Start the frontend

In a second terminal at the repository root:

```powershell
Set-Location frontend
npm.cmd run dev
```

Open **http://127.0.0.1:5173/**. Keep both servers running: Vite forwards `/api` requests to Django on port 8000. Use the same hostname throughout your session; `localhost` and `127.0.0.1` have separate cookies.

No `.env` file is required for the default local setup. Optional overrides are described in [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example). Never commit real secrets.

## Development checks

From the repository root:

```powershell
.\.venv\Scripts\python.exe backend/manage.py check
.\.venv\Scripts\python.exe backend/manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe backend/manage.py test tests --verbosity 2
```

From `frontend/`:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Backend tests use a separate temporary database. After pulling changes that include migrations, run `backend/manage.py migrate` with your virtual environment's Python before starting the app.

## Repository layout

```text
backend/
  apps/             Domain models, API endpoints, and recommendation logic
  config/           Django settings and routing
  tests/            Backend tests
frontend/
  src/app/          Routes, session guards, and application shell
  src/features/     Feature pages and interactions
  src/components/   Shared UI components
  src/lib/          API client and shared helpers
  public/           Static images and brand assets
docs/               Setup, demo, API, and verification notes
deploy/             Container startup script
Dockerfile          Frontend build and backend runtime
```

## Current scope and next steps

Rooms, connections, DMs, projects, and resource sharing are implemented. The next proposed social improvements are automatic incoming DM updates, notifications, and a persistent unread inbox. A separate posting feed, follows, and reshares are deferred; see the [focused social experience plan](SOCIAL_FEATURES_PLAN.md).

Scheduled rooms use external meeting links; the app does not host video calls. Hardware learning links are curated rather than generated from a live web search.

This README describes the repository's implementation. The hosted site's features depend on which revision and database migrations have been deployed. The Docker entrypoint applies migrations before starting Gunicorn; production also needs its own secrets, allowed hosts, trusted origins, database, and persistent media storage. Local demo accounts are for development only.

## Further reading

- [Local setup, configuration, and admin access](docs/setup.md)
- [Local demo accounts](docs/demo.md#sign-in)
- [API documentation](docs/api.md)
- [Recorded verification notes](docs/verification.md)
- [Social experience priorities](SOCIAL_FEATURES_PLAN.md)
- [Original scaffold plan](SCAFFOLD_PLAN.md)

Some supporting documents describe earlier milestones; use the current source and migrations as the reference for implemented behavior.
