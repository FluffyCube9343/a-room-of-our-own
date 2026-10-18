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
- `PATCH /account/` → accepts `email` for the signed-in account and returns `{ email }`. Addresses are trimmed, lowercased, and checked for case-insensitive uniqueness. The session stays signed in; subsequent sign-ins use the new address.
- Profiles include read-only `avatar_url`: the most recently uploaded photo, independent of display order, or null for initials.
- `GET/PATCH /profile/` → current profile only. Editable fields: `display_name`, `pronouns`, `bio`, `university`, `role`, `goals`, `intent`, `discoverable`, `onboarding_complete`, `interests`, `skills`, `learning`, `prompts`.
- `intent`: `learn`, `mentor`, or `both`. Prompt objects have `key` (`ask`, `wish`, `learn`), `answer`, and `order`. A provided prompt list replaces existing answers; duplicate keys are rejected.
- The profile form collects `academic_stage`, `major` for students or `profession` for post-grad, and `purposes` as a nonempty array (`learn`, `mentor`, `build`, `discuss`, `collaborate`, `community`). The API derives the display `role` and legacy mentorship `intent`. Inactive major/profession fields are cleared on stage changes. Completing the updated form requires a stage, its corresponding major/role, at least one purpose, and at least one interest. Legacy profiles retain existing role and goal text until updated.
- `GET /tags/` → paginated `{ id, slug, label }` values.

## Discovery

- `GET /discover/?q=...`: search all visible people by name, role, bio, university, interests, or skills, including previously passed or connected profiles. Hidden, blocked, inactive, and incomplete profiles remain excluded. Results are paginated. Without `q`, existing discovery/recommendation behavior is unchanged.

- `GET /home/` → `{ rooms, mentors, projects }`, up to three per section.
- `GET /home/?room={id}` → rank suggestions using the visible room's topics.
- `GET /mentors/` → eligible profiles sorted by shared interests, then useful skill overlap. Each includes truthful `reasons` and the viewer's `saved` state.
- `GET /members/{id}/` → visible member profile. No email or private account fields.
- `GET /saved-profiles/`, `PUT/DELETE /saved-profiles/{member_id}/` → list/save/unsave private bookmarks. Repeated PUT/DELETE is idempotent.

## Rooms

- `GET/POST /rooms/`: browse or create rooms. Default `feed=for-you` ranks rooms by the number of topics shared with the viewer?s interests, then upcoming date and ID. `feed=all` keeps general browsing order. Rooms without shared interests remain available; no-interest profiles receive a general feed. `matching_interests` gives the actual matching topic labels for recommendation explanations. Filters: `q` searches title, description, topic, and host; `kind` selects format; `topic` selects a tag slug; `mine=1` includes hosted and approved collaborator rooms, including past/cancelled rooms.
- Formats: `conversation`, `workshop`, `panel`, `coworking`, `chatroom`.
- Scheduled sessions require `starts_at`, `ends_at`, and at least one of `meeting_url` (HTTPS) or `physical_location` (up to 500 characters). Both locations can be supplied for hybrid sessions.
- Topic chatrooms are ongoing: timestamps are null and external locations are optional. Create fields also include `title`, `description`, and `tags`. Switching between a session and chatroom after creation requires a separate room.
- `GET/PATCH /rooms/{id}/`: room details; host and approved collaborators can edit. Only the host can set `status: scheduled|cancelled`.
- `GET /rooms/similar/?title=...&tags=1,2`: up to five visible active rooms ranked by title similarity and shared topics, returned as `{results}`. Suggestions do not prevent creating a distinct room.
- `PUT/DELETE /rooms/{id}/rsvp/`: join/leave. Sessions stop accepting RSVPs at their start; chatrooms accept members until cancelled. Removed attendees cannot rejoin until restored by the host.
- `GET /rooms/{id}/attendees/` and `PATCH /rooms/{id}/attendees/{user_id}/`: host-only membership management. PATCH accepts `removed` or `cancelled` (restore eligibility). Removal also revokes collaboration.
- `GET/POST /rooms/{id}/messages/`: chatroom members, host, and approved collaborators can read/send messages; POST accepts `body` (1?2000 nonblank characters). Messages are paginated newest first; blocked senders are excluded. Closed rooms reject access. The group-chat UI refreshes every three seconds while visible, shows messages chronologically, and uses `before={id}` for earlier history and `after={id}` for incoming messages. Cursor filters are mutually exclusive; after-results are returned oldest first. Enter sends, Shift+Enter adds a line, and unsuccessful sends preserve the draft.
- `POST /rooms/{id}/collaborators/`: request collaboration; repeated pending/approved requests are idempotent. `GET` lists requests for the host. `PATCH` accepts `{user_id, status: approved|declined}` and is host-only. Approval grants editing/chat access, but not cancellation or membership management. Revocation removes those privileges; ordinary RSVP membership remains independent.
- Responses include `location_type`, `can_edit`, `collaboration_status`, `is_owner`, `host`, `attendee_count`, and `rsvp_status`. Exact locations are omitted from lists and suggestions. Detail exposes them to the host and approved collaborators, or to joined members while the room is active.

### Room covers

Room create/edit accepts multipart `cover_image` (JPEG, PNG, WebP, max 5 MB / 25 megapixels). Images are resized, re-encoded as JPEG, and stripped of metadata. Hosts and approved collaborators can replace a cover; JSON `cover_image: null` removes it. Responses include `cover_url` and `cover_credit`. `GET /rooms/{id}/cover/` checks the same authentication and block visibility as room details. Covers use the configured media storage, including S3 in production.

After migration, `python backend/manage.py add_room_covers` fills empty covers from the bundled, credited photo collection. `--refresh-defaults` reassigns bundled defaults while preserving user uploads. The nine existing default covers use distinct photos; additional rooms can upload their own covers. Run this command on the deployed database/storage separately when deploying these changes.

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

Local-memory throttling is 20 authentication attempts/minute, 60 anonymous requests/minute, and 300 authenticated requests/minute. These are scaffold limits, not a distributed abuse-prevention service. Room chat and connection messaging are supported; video hosting is not bundled.
