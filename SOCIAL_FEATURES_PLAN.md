# Social experience: focused P0 plan

Updated: October 18, 2026

**Status: clickable names and avatars (P0 item 3) approved and implemented locally.** Reliable DMs, notifications, and the inbox remain awaiting approval. This replaces the earlier social-network roadmap. Findings come from the local source audit, not a certification of the hosted deployment.

## Product direction

Make the existing experience reliable before adding another place to socialize. Keep the Hinge-style profiles and matching flow unchanged. Connections introduce people; DMs continue their conversations; rooms host group discussions. The inbox is a way back to those conversations, not a separate messaging system.

Do not build a feed, follows, posts, or reshares in P0. Keep the current Home board.

## P0 priorities, in the user's order

### 1. Reliable DMs

Incoming messages should appear without refreshing or sending a message first.

- Poll active conversations initially, using the room-chat approach as a starting point. WebSockets are not a prerequisite.
- Load the latest messages first and page backward through earlier history with stable cursors.
- Merge by message ID to avoid duplicates or gaps when fetching and sending overlap.
- Keep the reader's scroll position when browsing earlier messages. Show a new-message indicator instead of forcing a jump.
- Preserve drafts and show retryable failures. Prevent double submission and handle ambiguous network outcomes without duplicating a sent message.
- Refetch on reconnect and tab focus; avoid aggressive background polling.
- Continue enforcing accepted connections, blocks, inactive accounts, and ended connections on every read and send.

Acceptance: two signed-in users can exchange messages and see replies automatically; older history, reconnects, and failed sends work without losing drafts or messages.

### 2. Notifications

Let people know about existing social interactions and take them straight to the relevant action.

- Add an in-app notification list and unread badge accessible from the app header.
- Cover incoming profile likes/connection requests, accepted connections, and new DMs.
- Treat a profile like that creates a connection request as one event, not two duplicate alerts.
- Link to incoming requests or the existing conversation as appropriate.
- Persist notifications and their read state across sessions/devices. Support mark-all-read.
- Group repeated message alerts by conversation and suppress self-notifications.
- Avoid alerting someone repeatedly for a conversation they are actively reading.
- Respect blocks and access changes; inaccessible targets must not leak content through previews or notification links.
- Keep email, browser push, follow notifications, room-event alerts, and resource/project notifications outside P0.

Acceptance: each supported action generates one useful notification; counts remain correct after reading, reconnecting, and signing in elsewhere.

### 3. Clickable profiles everywhere

Use existing profiles rather than introducing a new profile system. Both the member's displayed name and avatar should open the appropriate profile. Preserve the existing Hinge-style profile layout.

### Findings

Some places already work: recommended-person cards, mentor previews, and connection invitation identities link to member pages. The header avatar opens your own profile.

The following need consistent name/avatar links:

- Room-card host identities and room-detail host bylines.
- Room attendees and collaborator/request lists.
- Chat authors, avatars, reply author names, and member-sidebar entries.
- Project-card and project-detail creators, plus people requesting to collaborate.
- Resource-card and resource-detail owners, plus borrower/lender identities in requests.
- DM header name and avatar: a separate “View profile” link exists, but the identity itself is not linked.
- Home-board room/project author areas: some are inside a link to the content, so clicking the author opens the content rather than the person.
- Any future feed author, reply author, resharer, follower, and notification actor.

### Proposed implementation

- Build a shared `MemberLink`/`MemberIdentity` component that accepts the member's **user ID**, display name, and permitted avatar URL.
- Use `/profile` for yourself and `/members/{userId}` for another member. Do not assume a profile database ID equals a user ID.
- Link both the name and avatar. Give avatar-only links an accessible name such as “View Maya's profile.”
- Show the selected profile photo where allowed, with initials as fallback. Today's shared `Avatar` renders initials only, and the common `author()` API payload does not include a photo URL.
- Split content-card links from author links. Avoid nested anchors, click-handler hacks, and author clicks triggering a card action.
- Preserve image enlargement where it is the intended action on profile-gallery/board photos; provide a clearly linked author identity beside it. Decorative, historical, campus, and resource photos do not represent app members and should not receive fake profile links.
- Retain normal link behavior: keyboard focus, Enter, open in new tab, and browser Back.

### Privacy issue to resolve with this work

`visible_profiles()` currently excludes the viewer, hidden/non-discoverable profiles, incomplete profiles, inactive users, and blocked users. Content-author visibility is not identical to profile discovery visibility. Consequently, blindly wrapping every identity in a link can lead to unavailable profiles.

Proposed default: keep current privacy restrictions, route self-links correctly, and show a clear “This profile isn't available” state for inaccessible members. Do not change discoverability or expose a protected photo merely to make a link work. A later privacy setting can explicitly separate “appear in discovery” from “who can view my profile.”

### Acceptance checks

- Every identity listed above opens the correct permitted profile.
- Your own identity never produces a missing-member error.
- Card-body clicks still open the room/project/resource; author clicks open the person.
- Blocked, hidden, deleted, and inactive accounts do not leak profile information or photos.
- Keyboard navigation works and the Hinge-style profile layout remains unchanged.

## 4. Unread messages and inbox

Make ongoing conversations easy to find and return to.

- Add one Messages/inbox destination linking to existing DMs and joined topic chatrooms, with clear Direct and Rooms sections or filters.
- Show the other member or room name, permitted avatar, latest-message preview/time, and unread count.
- Sort conversations by recent activity; keep empty and unavailable states clear.
- Store a last-read message cursor per user/conversation or room on the server. Advance it monotonically to avoid a stale tab undoing a newer read position.
- Mark messages read only when the relevant conversation is visible and the messages have actually been presented to the user. Opening the inbox alone must not mark every conversation read.
- Exclude the user's own messages from unread totals.
- Keep unread state consistent across devices and synchronize message notifications with conversation read state.
- Reuse room membership and connection permissions; leaving a room or losing access removes its private preview from the inbox.

Acceptance: a message received while away increments the correct conversation and global badge; reading it clears that unread state across sessions without marking unrelated conversations read.

## Navigation and interaction rules

- **Connections:** discover people, send introductions, and accept requests.
- **Messages:** return to existing one-to-one and room conversations.
- **Rooms:** discover/join group discussions and sessions.
- **Notifications:** find out what happened and jump to the existing destination.
- Do not add competing composers, automatic follows, or a second connection model.
- Keep layout laptop-first, with keyboard-accessible links, clear focus states, and responsive mobile navigation.

## Implementation dependencies

The ranking above is product priority, not a requirement to build dependent storage twice. Design read markers and notification events together before implementing notifications; deliver reliable DMs first, then notifications, profile links, and the inbox.

- Reuse `ConnectionMessage` and `RoomMessage`; do not create a new social-post model.
- Add notification records with recipient, actor, event type, target, deduplication key, and read timestamp.
- Add per-user conversation/room read markers. Decide explicit treatment of old history at rollout so existing users are not surprised by thousands of unread messages.
- Add server-side inbox aggregation using permission-filtered queries, not client-side downloads of every message history.
- Use a shared member-identity component and permitted avatar data across the audited pages.
- Prefer stable message cursors and efficient queries for latest messages/unread totals. Invalidate or refresh the affected inbox and notification data after sends and reads.
- New storage requires migrations and a reviewed rollout. Implementation approval does not itself authorize production deployment.

## Explicitly deferred

- Feed, independent posts, follows, public activity timelines, likes on posts, reposts/quote-posts, and post bookmarks.
- Handles, mentions, global search, topic-following, and ranked feeds.
- DM attachments, reactions, typing indicators, read receipts visible to other users, and presence.
- Project team acceptance/discussion and borrowing transaction conversations.
- Push/email notifications and additional room/project/resource notification types.

These remain possible future work, not a committed second phase. Revisit them after observing whether people can connect, notice replies, and return to conversations reliably.

## Validation and completion

- Two-user end-to-end tests for requests, acceptance, notification links, message delivery, inbox order, and unread counts.
- Multi-tab/reconnect tests, stable earlier-history pagination, failure recovery, and duplicate-send prevention.
- Permission tests for blocks, ended connections, removed room members, inactive users, protected avatars, and stale notification links.
- Verify names/avatars on all audited surfaces, including self-links and content cards with separate author links.
- Check mobile and desktop layouts, keyboard navigation, and screen-reader labeling.
- Confirm the Hinge-style profile, matching, room membership, projects, and resource requests retain existing behavior.

**Approval boundary:** the user authorized clickable names and avatars only. Wait for explicit approval before implementing the remaining P0 work; do not treat the earlier broad roadmap as authorization to build deferred features.

## What exists today

- Signed-in member pages at `/members/:id`, a personal profile at `/profile`, profile editing, prompts, and uploaded profile photos.
- People discovery and recommendations, incoming and sent likes, accepted connections, and saved profiles.
- Text-only direct messages between accepted connections.
- Topic chatrooms with replies, message editing/deletion, host moderation, members, and three-second polling. The new-message indicator is local to the open channel, not a persistent unread inbox.
- Rooms, project ideas, shared resources, and search on their respective discovery pages.
- Blocking and reports for members, rooms, and projects.
- A visual home/community board made from profile photos and prompts, room invitations, project ideas, and curated campus photos.

The home board is **not yet an independent posting system**. There are no dedicated post, follow, post-like, reshare, bookmark-post, or notification models/endpoints in the inspected code.

## Source map for the audit

- `frontend/src/app/App.tsx`: existing routes, navigation, and signed-in access.
- `frontend/src/components/ui.tsx`: initials-only Avatar, room/project bylines, linked mentor previews.
- `frontend/src/features/home/HomePage.tsx`: generated board pins and existing content/photo interactions.
- `frontend/src/features/connections/DiscoveryPage.tsx`: linked discovery/invitation cards, member pages, DM header and message fetching.
- `frontend/src/features/profile/ProfileStory.tsx` and `ProfilePage.tsx`: profile presentation and editing.
- `frontend/src/features/rooms/RoomsPage.tsx` and `RoomChannel.tsx`: host/member identities, room management, current chat behavior.
- `frontend/src/features/projects/ProjectsPage.tsx`: creator identities and pending project collaboration flow.
- `frontend/src/features/resources/ResourcesPage.tsx`: owner/borrower identities and transaction flow.
- `frontend/src/features/safety/SafetyActions.tsx`: report and block controls.
- `backend/config/urls.py`: current API surface; no social-post/follow/notification endpoints.
- `backend/apps/community/services.py`, `serializers.py`, and `views.py`: member visibility, author payload, member lookup, and existing interactions.
- `backend/apps/accounts/views.py`: profile-photo access enforcement.
- `backend/apps/connections/models.py` and `views.py`: saved profiles, mutual connections, and direct messages.
- `backend/apps/rooms/models.py` and `views.py`: room memberships and messages.
- `backend/apps/projects/models.py`: pending/withdrawn project interests.
- `backend/apps/safety/models.py`: block and current report targets.

