# A Room of Our Own — Scaffold Implementation Plan

Status: Implemented locally; see `docs/verification.md` for checks and limits.  
Stack: React + TypeScript frontend; Python + Django backend  
Source: Project concept in `README.md` and the supplied brainstorm

## 1. Product goal

Build a women-centered, gender-inclusive community for UVA students to host events, discover mentors, and find project collaborators.

The first scaffold should support a complete demo journey: sign up, choose interests, RSVP to a room, discover a relevant mentor, and request to join a project. Core actions should persist in Django so the experience survives a page refresh.

Use the mission as the landing-page headline:

> Find your people. Build your own room.

Supporting copy: “A space for women in tech to meet, share what they know, and build something together.”

## 2. Scope and priorities

### Scaffold deliverables

- Public landing page, sign-up, sign-in, and a short onboarding flow.
- Responsive application shell with Home, Rooms, Connections, Build Together, and Profile.
- Personalized home sections using shared interest tags.
- Room discovery, room details, room creation, RSVP/cancel, and access to an external meeting link.
- Mentor discovery with profile prompts, deterministic compatibility explanations, Skip, and Save profile actions.
- Project discovery, project details, project creation, and persistent collaboration requests.
- Profile editing, discoverability controls, reporting, blocking, and basic moderation through Django admin.
- Seeded fictional community data, documented setup, and focused verification of the main flows.

### Explicitly deferred

- Mutual mentorship matching and accepting mentorship requests.
- In-app messaging, email notifications, and scheduled mentorship sessions.
- AI matching, mini-conferences, recurring rooms, recordings, and project workspaces.
- Video hosting, institutional verification, and multi-campus administration.
- Public production launch requirements such as email verification and password recovery can follow the local scaffold; complete them before opening real registration.

Saving a mentor means bookmarking their profile. The UI must not claim that a connection or conversation exists. Project requests remain pending in this version; show requesters to the project owner, but defer team acceptance workflows.

## 3. Visual direction: clean, minimal, Hinge-inspired

Interpret the requested inspiration through spacious layouts, expressive headings, rounded cards, and personal prompts. Give A Room of Our Own its own identity and community-focused language.

### Design tokens

- Background: warm ivory `#FAF8F5`.
- Card surface: white `#FFFFFF`.
- Primary text: near-black `#272329`.
- Secondary text: muted plum-gray `#706773`.
- Primary action: deep plum `#56334F`, with white text.
- Soft accent: pale lilac `#EEE6EF`, with dark plum text.
- Borders: warm gray `#E5DFE2`.
- Success: dark green `#32624B`; error: dark red `#A12D3B`.
- Typography: a restrained serif heading face such as Georgia paired with a system sans-serif body. Keep fonts local/system-based for the initial scaffold.
- Spacing: a 4px base with 8, 12, 16, 24, 32, 48, and 64px steps.
- Corners: 16–24px for major cards, 10–12px for inputs and buttons, pill shapes for tags.
- Shadows: use sparingly; rely on spacing and subtle borders to define groups.

### Layout and interaction

- Desktop: quiet top navigation, a centered content container up to 1120px, and generous page margins.
- Mobile: compact header and four-item bottom navigation for Home, Rooms, Connections, and Build. Open Profile from the header avatar; account for the bottom safe area.
- Forms: a single readable column, approximately 560px wide.
- Mentor discovery: one prominent profile at a time, approximately 600px wide, with visible Skip and Save profile buttons. Optional swipe gestures must trigger the same actions as the buttons.
- Room and project discovery: a two- or three-column desktop grid that becomes a single column on small screens.
- Use initials or fictional illustrations for demo avatars. Photos are optional, and browsing should emphasize goals and prompt answers.
- Keep one clear primary action per card or screen. Avoid dense dashboards, decorative gradients, follower counts, and excessive badges.
- Use short transitions around 150–200ms and respect reduced-motion preferences.
- Provide visible keyboard focus, labeled fields, at least 44px touch targets, and checked text contrast. Never rely on color alone to communicate state.

### Reusable components

`AppShell`, `PageHeader`, `Button`, `TextField`, `TextArea`, `TagPicker`, `Avatar`, `RoomCard`, `MentorCard`, `PromptCard`, `ProjectCard`, `CompatibilityReasons`, `EmptyState`, `LoadingSkeleton`, `ErrorNotice`, `ConfirmDialog`, and `Toast`.

Every data-driven screen needs loading, empty, failure, and success states. Pending buttons prevent duplicate submissions; failures preserve form input and offer a retry.

## 4. Screens and routes

### Public entry

- `/`: Mission, three brief pillar introductions, preview cards, and “Find your room” as the primary sign-up action. Existing members can sign in.
- `/signup` and `/login`: Email/password authentication with inline validation.
- `/onboarding`: Three short steps: basic profile; interests and skills; goals and whether the person wants to mentor, find a mentor, or both. Include one optional profile prompt. Persist completion on the backend.

### Home — `/home`

- Personal greeting and a brief invitation to participate.
- “Rooms you might like,” “People to learn with,” and “Projects looking for you.”
- Rank by shared tags and fall back to upcoming rooms and recent projects for a new member.
- Keep browse-all links visible so recommendations never restrict access to the wider community.

### Rooms — `/rooms`, `/rooms/new`, `/rooms/:id`

- Browse upcoming rooms with a topic filter and clear date, time, host, and event format.
- Create a room using title, description, topics, start/end time, format, and external meeting URL.
- Detail page shows RSVP state and a “Join room” action for the host and registered attendees.
- After RSVP, show relevant mentors and projects using the room's tags, giving the demo a natural transition between pillars.
- Hosts can edit or cancel their room and remove an attendee. A removed attendee cannot re-RSVP unless the host restores access.
- Store dates in UTC and display the viewer's timezone explicitly. Show a distinct cancelled or past-event state.

### Connections — `/connections`, `/connections/saved`

- Display one mentor profile with name, academic year or role, interests, skills, mentorship intent, and prompt answers.
- Example prompts: “Ask me about…”, “I wish someone had told me…”, and “I'm hoping to learn…”.
- Show up to three concrete compatibility reasons, such as “You both care about accessibility.”
- Skip advances the current browsing session; Save profile persists a bookmark. Provide a saved list and an unsave action.
- Exclude the current user, hidden profiles, and blocked relationships. Offer an intentional end-of-list state.

### Build Together — `/projects`, `/projects/new`, `/projects/:id`

- Cards show title, short pitch, owner, topic tags, and skills needed.
- Create a project using title, description, topic tags, needed skills, and an optional repository link.
- Detail page supports “Request to join” with an optional short introduction, followed by “Request sent” and a withdrawal action.
- Owners can edit or close their projects and privately view incoming requests.
- Advanced skill filtering and acceptance/team management remain follow-up work.

### Profile and safety — `/profile`, `/profile/edit`, `/settings`

- Edit profile details, tags, goals, mentorship intent, and prompt responses.
- Choose whether the profile appears in member discovery; email addresses never appear in public profile responses.
- Report or block from member and content menus. Settings includes the blocked-member list and unblock action.
- Hiding a profile removes it from discovery; existing authored rooms and projects still show a minimal author identity. Explain this distinction in settings.

## 5. Technical architecture

### Frontend

- React with TypeScript, built with Vite.
- React Router for public and authenticated routes.
- TanStack Query for server state, cache invalidation, and mutation status.
- React Hook Form and Zod for client-side form validation; Django remains authoritative.
- Plain CSS with shared custom-property tokens and feature-level styles to keep the visual system small.
- A typed API client wrapping `fetch`, including session credentials, CSRF headers, and normalized errors.
- Use React state for local UI; avoid adding a global state library unless a concrete need appears.

### Backend

- Django with Django REST Framework and an API prefix of `/api/v1/`.
- SQLite for local development and the hackathon scaffold; use PostgreSQL when preparing shared hosting.
- Django session authentication with CSRF protection. Use Django password hashing and validators.
- Define a custom user model with email login before the initial migration.
- Django admin for seed inspection, reports, content moderation, and account management.
- No Redis, background worker, WebSocket service, or AI dependency in the scaffold.
- Pin compatible supported package versions and commit dependency lock files during implementation.

### Local request flow

The browser calls relative `/api/v1/` URLs. Vite proxies `/api` to Django in development, avoiding a separate browser-facing API origin. Configure the development CSRF trusted origin explicitly. Retrieve a CSRF token before login or signup and refresh it after authentication rotates the token; protect logout and all writes as well.

For eventual deployment, prefer one public origin with static frontend assets and `/api` routed to Django. Keep secrets in environment variables, disable debug mode outside development, and use secure cookies over HTTPS.

## 6. Repository structure

```text
ghh26/
  README.md
  SCAFFOLD_PLAN.md
  .gitignore
  frontend/
    package.json
    package-lock.json
    .env.example
    src/
      app/                 # Router, providers, application shell
      components/          # Shared presentation components
      features/
        auth/
        onboarding/
        home/
        rooms/
        connections/
        projects/
        profile/
        safety/
      lib/                 # Typed API client and shared helpers
      styles/              # Tokens, global styles, component styles
      types/               # Shared API types
  backend/
    manage.py
    requirements.txt      # Pinned runtime dependencies
    requirements-dev.txt
    .env.example
    config/               # Settings, URLs, WSGI/ASGI
    apps/
      accounts/
      community/          # Shared tags and home feed
      rooms/
      connections/
      projects/
      safety/
    tests/
  docs/
    api.md
    demo.md
```

Keep the existing concept in `README.md`; add setup instructions or link to a dedicated setup document. Ignore local databases, virtual environments, build output, and real `.env` files.

## 7. Data model

Use database constraints for uniqueness and enforce ownership in backend permissions, not just frontend controls.

- **User:** Email, password hash, active status, staff status, timestamps.
- **Profile:** One-to-one user, display name, optional pronouns, bio, university, academic year/role, goals, mentorship intent, discoverability, onboarding completion, and interest/skill tag relations. Gender disclosure is not required.
- **ProfilePrompt:** Profile, prompt key, answer, display order; one answer per prompt key per profile.
- **Tag:** Unique slug and display label, reused across profiles, rooms, and projects.
- **Room:** Host, title, description, format, tags, start/end timestamps, meeting URL, status (`scheduled` or `cancelled`).
- **RSVP:** Room, user, status (`going`, `cancelled`, or `removed`), timestamps; unique room/user pair.
- **SavedProfile:** Owner and saved member, creation timestamp; unique pair, no self-save.
- **Project:** Owner, title, description, topics, needed skills, optional repository URL, status (`open` or `closed`).
- **ProjectInterest:** Project, requester, introduction, status (`pending` or `withdrawn`), timestamps; unique project/requester pair.
- **Block:** Blocker and blocked member, creation timestamp; unique pair, no self-block.
- **Report:** Reporter, exactly one target (member, room, or project), category, optional details, status, staff notes, timestamps. Validate the target choice at database and serializer levels.

### Permissions and privacy

- Require authentication for community data; public landing previews use static fictional content.
- Limit room/project edits to owners or authorized staff; users edit only their own profiles.
- Restrict meeting URLs to the host and active RSVPs; omit URLs from all other serializers, including list responses.
- Restrict collaboration request details to the requester, project owner, and authorized staff.
- Blocked relationships are excluded in both directions from discovery, recommendations, and member-to-member actions. Apply the same policy to direct detail endpoints and hosted content access.
- Only staff can inspect report details or change moderation status. Report submission returns a minimal receipt.
- Validate HTTPS meeting/repository URLs and date ordering. Do not fetch user-provided URLs on the server. Render descriptions as plain text.

## 8. API contract outline

All endpoints below use `/api/v1`. Use a consistent pagination envelope for lists and documented field-level validation errors. Derive owner/user IDs from the session rather than trusting client-supplied ownership fields.

### Authentication and account

- `GET /auth/csrf/`: Establish CSRF protection.
- `POST /auth/signup/`, `POST /auth/login/`, `POST /auth/logout/`.
- `GET /auth/me/`: Current user and onboarding status.
- `GET/PATCH /profile/`: Current member's editable profile.
- `GET /tags/`: Shared tag choices.

### Home and rooms

- `GET /home/`: Small recommendation sections with explanation metadata.
- `GET/POST /rooms/`: Upcoming rooms, optional topic filter, and creation.
- `GET/PATCH /rooms/{id}/`: Details and owner edits, including cancellation.
- `PUT/DELETE /rooms/{id}/rsvp/`: Set or cancel the current user's RSVP idempotently.
- `GET /rooms/{id}/attendees/`: Host-only attendee management list.
- `PATCH /rooms/{id}/attendees/{user_id}/`: Host-only removal or restoration.

### Connections

- `GET /mentors/`: Eligible profiles and compatibility reasons.
- `GET /members/{id}/`: Safe member profile with visibility checks.
- `GET /saved-profiles/`: Current user's saved profiles.
- `PUT/DELETE /saved-profiles/{member_id}/`: Save or unsave idempotently.

### Projects and safety

- `GET/POST /projects/`, `GET/PATCH /projects/{id}/`.
- `PUT/DELETE /projects/{id}/interest/`: Submit or withdraw the current user's request idempotently.
- `GET /projects/{id}/interests/`: Owner-only incoming requests.
- `POST /reports/`: Submit a report.
- `GET /blocks/`, `PUT/DELETE /blocks/{member_id}/`: Manage the current user's blocks.

On successful mutations, refresh relevant queries: RSVP updates room/home state; bookmarking updates discovery/saved state; project requests update details; blocking invalidates all discovery and detail caches.

## 9. Simple, explainable recommendations

Implement deterministic logic in a backend service so the same rules power Home and Connections.

1. Filter out ineligible records: self, hidden or blocked members, cancelled/past rooms, and closed projects.
2. Rank mentors by shared interests, then overlap between the viewer's desired learning tags and the mentor's skills. Gather desired learning tags during onboarding. Respect whether each member wants to mentor or find a mentor.
3. Rank rooms and projects by shared topic tags. Break room ties by soonest start; use stable IDs to break remaining ties.
4. Return reasons drawn from actual overlap, such as “You both selected social impact” or “They can help with Python.”
5. When there is no overlap, show “Explore someone new” instead of inventing a reason or compatibility percentage.

Add desired learning tags to Profile alongside interests and skills. Keep free-text goals available for reading, but do not imply that they have been semantically analyzed.

## 10. Implementation sequence

### Phase 1 — Foundation and visual shell

- [x] Initialize frontend and backend in the agreed directory structure.
- [x] Add environment examples, pinned dependencies, development proxy, and setup commands.
- [x] Create the custom user model and initial migrations.
- [x] Implement design tokens, responsive navigation, shared form controls, and route shells.
- [x] Build the landing page and one representative mentor card to establish the visual direction.

Exit condition: Both services start locally and the frontend renders the responsive shell and reaches Django.

### Phase 2 — Identity and community data

- [x] Implement session auth, CSRF, route protection, onboarding, and profile editing.
- [x] Add shared tags and the remaining domain models/migrations.
- [x] Create an idempotent `seed_demo` management command with fictional members, prompt answers, upcoming rooms, and projects.
- [x] Generate room dates relative to seed time so the demo stays usable.
- [x] Keep demo account creation explicit and development-only; document local credentials in demo instructions.

Exit condition: A member can sign up, finish onboarding, edit their profile, and retain state after refresh.

### Phase 3 — Complete the three pillars

- [x] Implement room browsing, details, creation, RSVP, cancellation, and meeting-link permissions.
- [x] Implement mentor discovery, compatibility explanations, session skips, and saved profiles.
- [x] Implement project browsing, creation, details, collaboration requests, and the owner's request view.
- [x] Connect Home recommendations and post-RSVP suggestions.

Exit condition: The complete cross-pillar journey works against persistent Django data.

### Phase 4 — Safety and interface polish

- [x] Add discovery privacy, reporting, blocking, host attendee controls, and Django admin moderation.
- [x] Apply permissions consistently across list, detail, and mutation endpoints.
- [x] Complete empty, loading, error, disabled, and success states.
- [x] Review copy, spacing, mobile navigation, keyboard access, and contrast.

Exit condition: The demo is visually coherent and access controls hold when endpoints are called directly.

### Phase 5 — Verification and handoff

- [x] Run frontend type checking, linting, and a production build.
- [x] Run Django system checks and focused backend tests.
- [x] Smoke-test the main journey in a browser and check narrow mobile and desktop layouts.
- [x] Write setup instructions, API notes, demo steps, known limitations, and follow-up priorities.

Exit condition: A fresh checkout can be installed, migrated, seeded, and run using the documented instructions.

## 11. Verification checklist

Prioritize tests that protect real behavior:

- Anonymous users cannot access community APIs; unsafe requests without valid CSRF protection are rejected.
- One member cannot modify another member's profile, room, or project.
- Meeting URLs do not leak through list or detail responses before RSVP, after cancellation/removal, or across a blocked relationship.
- Repeated RSVP, save, and project-interest submissions do not create duplicate records.
- Cancelled/past rooms reject new RSVPs; closed projects reject new requests; owners cannot request to join their own projects.
- Reports stay private, host moderation is owner-only, and blocked members cannot bypass restrictions through direct IDs.
- Recommendation reasons reflect stored tags and exclude ineligible records.
- Browser journey: sign up → onboard → create or RSVP to a room → save a mentor → request to join a project → refresh and verify persistence.
- Manual UI checks at approximately 390px, 768px, and 1440px; keyboard-only navigation; long titles; empty feeds; request failures.

## 12. Demo and completion criteria

Seed approximately 8–12 fictional profiles, 6 upcoming rooms, and 6 projects spanning AI, accessibility, cybersecurity, UX, and social impact. Include enough overlaps to make explanations understandable without hardcoding the demo user's matches.

Three-minute demo:

1. Introduce the mission on the landing page.
2. Onboard Maya with AI, accessibility, and frontend interests.
3. RSVP to “Women Building with AI” and show the available meeting action.
4. Discover a mentor with shared interests and save their profile.
5. Open an accessibility project and submit a collaboration request.
6. Return Home to show the room RSVP and continued discovery opportunities.

The scaffold is complete when each primary flow persists, the responsive interface follows the visual direction, safety controls are enforced on the backend, and the repository includes reproducible setup and demo instructions. Stretch features must not block delivery of this core experience.
