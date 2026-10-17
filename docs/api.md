# API contract

Base path: `/api/v1/`. All paths end with `/`. JSON request and response bodies; Django session cookies; CSRF token required for unsafe methods, including public authentication endpoints.

## Conventions

- Lists return `{ count, next, previous, results }`, with 24 results per page and `?page=2` for pagination. `next`/`previous` are null at the corresponding boundaries.
- A successful create returns 201, ordinary reads/updates return 200, and successful DELETE actions return 204 without a body. Signup returns 200 and starts a session.
- Validation errors return 400 with field-name arrays or `non_field_errors`. Permission failures return 403 with `detail`; inaccessible/blocked records return 404; unsupported methods return 405; throttled requests return 429.
- Authentication is required except for CSRF, signup, login, logout, and the current-session endpoint. An anonymous session read returns `{ user: null }`. With session authentication, protected unauthenticated endpoints return 403.
- Ownership is derived from the authenticated session. Client-supplied owner IDs are not used.
- Tags are represented by numeric IDs in records. Resolve them through `GET /tags/`.
- Timestamps use ISO 8601 with timezone information. The frontend converts local form inputs to UTC and shows event timezone labels.

## Session and profile

- `GET /auth/csrf/` → `{ csrfToken }`. Send it as `X-CSRFToken` on writes.
- `POST /auth/signup/` → accepts `email`, `password`, `display_name`; validates password and creates a session.
- `POST /auth/login/` → accepts `email`, `password`.
- Signup/login return `id`, `onboarding_complete`, and a fresh `csrfToken` after session rotation.
- `POST /auth/logout/` → ends the session and returns a new token.
- `GET /auth/me/` → `{ user: { id, email, profile } }` or `{ user: null }`. Email is only returned for the current user.
- `GET/PATCH /profile/` → current profile only. Editable fields: `display_name`, `pronouns`, `bio`, `university`, `role`, `goals`, `intent`, `discoverable`, `onboarding_complete`, `interests`, `skills`, `learning`, `prompts`.
- `intent`: `learn`, `mentor`, or `both`. Prompt objects have `key` (`ask`, `wish`, `learn`), `answer`, and `order`. A provided prompt list replaces existing answers; duplicate keys are rejected.
- Completing onboarding requires a role, a goal, and at least one interest.
- `GET /tags/` → paginated `{ id, slug, label }` values.

## Discovery

- `GET /home/` → `{ rooms, mentors, projects }`, up to three per section.
- `GET /home/?room={id}` → rank suggestions using the visible room's topics.
- `GET /mentors/` → eligible profiles sorted by shared interests, then useful skill overlap. Each includes truthful `reasons` and the viewer's `saved` state.
- `GET /members/{id}/` → visible member profile. No email or private account fields.
- `GET /saved-profiles/`, `PUT/DELETE /saved-profiles/{member_id}/` → list/save/unsave private bookmarks. Repeated PUT/DELETE is idempotent.

## Rooms

- `GET/POST /rooms/` → browse upcoming rooms or create one. Optional `topic={slug}` and `mine=1`; the latter includes the host's past/cancelled rooms.
- Create fields: `title`, `description`, `format`, `tags`, `starts_at`, `ends_at`, `meeting_url`.
- Formats: `conversation`, `workshop`, `panel`, `coworking`.
- `GET/PATCH /rooms/{id}/` → details/host edits. Status can be `scheduled` or `cancelled`.
- `PUT/DELETE /rooms/{id}/rsvp/` → RSVP/cancel current RSVP. The host cannot RSVP to their own room. Cancelled, started, or ended rooms do not accept new RSVPs.
- `GET /rooms/{id}/attendees/` → host-only attendees, with minimal `user` and `status` fields.
- `PATCH /rooms/{id}/attendees/{user_id}/` → host-only `status: removed` or `status: cancelled` to restore eligibility. Restoration does not enroll the attendee again.
- Every room response includes `host`, `attendee_count`, `is_owner`, and the viewer's `rsvp_status`. `meeting_url` is omitted from all lists/home responses. Detail exposes it to the host, or to an active RSVP while the room is scheduled and has not ended.

## Projects

- `GET/POST /projects/` → open projects/create. `mine=1` includes the owner's closed projects.
- Create fields: `title`, `description`, `tags`, `needed_skills`, optional HTTPS `repository_url`.
- `GET/PATCH /projects/{id}/` → details/owner edits, including `status: open|closed`.
- `PUT /projects/{id}/interest/` → idempotent current-member request with optional `introduction`. Owner self-requests and requests to closed projects are rejected.
- `DELETE /projects/{id}/interest/` → withdraw a request.
- `GET /projects/{id}/interests/` → owner-only pending requests with minimal requester details, introduction, status, and update timestamp.
- Project responses include `owner`, `is_owner`, and the current viewer's `interest_status`. Other members' introductions are never included.

## Safety

- `POST /reports/` → exactly one of `member`, `room`, `project`, plus `category` and optional `details`. Categories: `harassment`, `spam`, `inappropriate`, `other`. Returns a receipt only; inspection/resolution happens in staff-authorized Django admin.
- `GET /blocks/` → current member's block list.
- `PUT/DELETE /blocks/{member_id}/` → block/unblock. Self-blocks are rejected.
- Blocking is enforced on lists, details, recommendations, RSVPs, saves, and project interests. Existing interaction records between the pair are cancelled/withdrawn and bookmarks removed. Host and project-owner lists also exclude blocked relationships.

## Intentional limits

Local-memory throttling is 20 authentication attempts/minute, 60 anonymous requests/minute, and 300 authenticated requests/minute. These are scaffold limits, not a distributed abuse-prevention service. There is no API for messaging, mutual matches, request acceptance, or video hosting.
