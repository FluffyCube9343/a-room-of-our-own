# A Room of Our Own

*If we're not given a seat at the table, we'll build our own room.*

A women-centered, gender-inclusive community for finding your people in tech: host a conversation, meet a mentor, start a project, or share the tools to build one.

Inspired by Virginia Woolf's *A Room of One's Own* and rooted in the University of Virginia community, the project gives people a place to create opportunities together.

## Explore the app

- **Rooms:** Host scheduled talks, workshops, panels, and coworking sessions, or create an ongoing topic chatroom. Rooms support physical and virtual locations together, cover photos, RSVPs, and host-approved collaborators. Search by topic and discover rooms related to your interests.
- **Connections:** Discover people through photo-and-prompt profiles, shared interests, and compatibility explanations. Send likes, form mutual connections, and continue the conversation in DMs. Member names and avatars link to their profiles throughout the app.
- **Build together:** Share project ideas, search for topics and skills, and request to collaborate. Hardware projects can surface relevant community resources and curated external learning links.
- **AI project suggester:** Describe a build goal and get a plan grounded in what the community is actually sharing: which parts to borrow, who owns them, and the steps to build. One click posts the result as a project idea. Powered by Gemini, with a keyword fallback when no API key is configured.
- **Share resources:** List equipment and materials to lend or give away. Search and filter the shelf, see interest-based recommendations, and manage borrowing and lending requests.
- **Room conversations:** Participate in a single shared channel with replies, message editing, deletion, and a member sidebar. Room messages refresh through polling.
- **Your profile:** Introduce yourself with photos, prompts, interests, skills, academic stage or professional role, and what you're here to do.

The Home board brings people, rooms, and projects together. Blocking, reporting, profile visibility controls, and host moderation support the community experience.

## Try it live

The app is deployed at **[roomofourown.us](https://roomofourown.us)**.

## How Gemini works here

The project suggester is retrieval-augmented generation over the shared resource catalog. The flow when a member hits "Suggest a project" and submits a build goal:

1. The frontend posts the goal to `POST /api/suggest-project/`, handled by `backend/apps/resources/suggest.py`.
2. **Retrieval:** up to 60 catalog listings are embedded with Gemini's `gemini-embedding-001` model using the `RETRIEVAL_DOCUMENT` task type, and the goal plus the member's interests are embedded as a `RETRIEVAL_QUERY`. Cosine similarity ranks the listings and the top 12 move on.
3. **Caching:** listing embeddings are cached in the server process, keyed by a hash of each listing's text, so only new or edited listings are re-embedded.
4. **Generation:** one function, `gemini_suggest()`, calls `gemini-3.8-flash` with a prompt that contains only the retrieved listings and asks for strict JSON: title, description, difficulty, steps, and part ids chosen from the retrieved set. The response shape is validated before it is used, which keeps the suggestion grounded in parts that actually exist.
5. **Posting:** one click turns the result into a project idea through the normal projects endpoint.

Key handling and failure modes:

- The API key comes from the `GEMINI_API_KEY` environment variable only and travels in the `x-goog-api-key` request header, never in URLs, logs, or responses. Usage is billed by Google to the account that owns the key; the models are configurable through the `GEMINI_MODEL` and `GEMINI_EMBED_MODEL` environment variables.
- Every failure maps to a short non-secret reason code (`invalid-key`, `key-or-api-disabled`, `model-not-found`, `quota`, `network`), and the endpoint falls back to keyword matching, so the feature responds even with no key, no quota, or no network path to Google.
- Both the embedding call and the generation call are each isolated in a single small function, so another provider (for example Amazon Bedrock) can be swapped in without touching the endpoint.

## How Tiger Cloud works here

Tiger Cloud is a managed PostgreSQL service, and it hosts the database this app uses in production and in shared team development. The app talks to it as plain Postgres through Django's standard `postgresql` backend; nothing in the app code depends on Tiger-specific extensions.

- **Local by default:** with no database settings, Django uses a local SQLite file, so the app runs with zero setup.
- **Shared dev database:** the team's `backend/.env` (never committed) points local Django at one shared Tiger Cloud database, so everyone develops against the same data. That is why running `python manage.py migrate` after pulling schema changes matters for the whole team.
- **In production:** the ECS task definition sets `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PORT` from Terraform variables, and `DB_PASSWORD` is injected from AWS Secrets Manager, so no credential is ever in the image or the repo. `backend/config/settings.py` switches from SQLite to Postgres whenever `DB_HOST` is present.
- **Migrations in deploys:** the container entrypoint (`deploy/entrypoint.sh`) runs `python manage.py migrate` on every boot, then starts Gunicorn, so a deploy always brings the database schema up to date.
- **Outside the repo:** the instance's region and plan are not in the codebase; Terraform carries only the connection settings as variables.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, React Router, TanStack Query, React Hook Form, and Zod.
- **Backend:** Django 5.2 and Django REST Framework, with session authentication and CSRF protection.
- **Data and media:** SQLite for local development; PostgreSQL (hosted on Tiger Cloud) and S3 storage in production.
- **AI (optional):** Google Gemini API. `gemini-embedding-001` embeds goals and resources for retrieval, and `gemini-3.8-flash` generates suggestions.
- **Production serving:** Docker, Gunicorn, and WhiteNoise.

Recommendations use profile interests, skills, and keyword matching. The project suggester uses the Gemini API when a key is configured and falls back to keyword matching without one, so the app runs fully with no AI key.

## Deployment

- **CI/CD:** GitHub Actions (`.github/workflows/deploy.yml`) runs the backend tests, builds the Docker image, pushes it to Amazon ECR, and rolls the ECS service on every push to `main`.
- **Compute:** Amazon ECS on Fargate behind an Application Load Balancer. The React frontend is built into the same image and served through Django and WhiteNoise.
- **Data:** PostgreSQL hosted on Tiger Cloud; media files on S3.
- **Secrets:** Database credentials, the Django secret key, and the Gemini API key live in AWS Secrets Manager and are injected into the container at launch. The Gemini key syncs from a GitHub repository secret during deploys.
- **Infrastructure as code:** The AWS stack is defined in Terraform under [`deploy/terraform`](deploy/terraform): load balancer, service, roles, and secrets.
- **Domain:** DNS managed in Route 53, with the registered domain pointed at the hosted zone.

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
deploy/             Container startup script and Terraform for the AWS stack
Dockerfile          Frontend build and backend runtime
.github/workflows/  CI: backend tests, image build, and ECS deploy
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

## Created By

- Joyce Yang
- Vrishak Vemuri
- Thomas Kennedy
- Yogesh Thambidurai
