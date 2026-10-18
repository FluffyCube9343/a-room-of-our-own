# Social features audit and build proposal

Date: October 18, 2026

**Status: proposal only — awaiting approval.** No application changes are authorized by this document. The audit reviewed the local frontend routes, components, API endpoints, and models; it does not certify what is currently deployed on the hosted site. All features below are proposed unless explicitly listed as existing.

## Recommended direction

Make people easy to find from anywhere, then add a community feed with posts, replies, follows, and reshares. Keep the current purple visual design and the existing Hinge-style profile presentation on Connections. Add social activity around that profile rather than replacing it.

Keep three actions distinct:

- **Follow:** a one-way subscription to someone's posts.
- **Connect:** the existing mutual introduction and acceptance flow, which unlocks direct messaging.
- **Join a room:** membership in a topic conversation or attendance at a session.

Following should not silently send a connection request or grant messaging access.

## What exists today

- Signed-in member pages at `/members/:id`, a personal profile at `/profile`, profile editing, prompts, and uploaded profile photos.
- People discovery and recommendations, incoming and sent likes, accepted connections, and saved profiles.
- Text-only direct messages between accepted connections.
- Topic chatrooms with replies, message editing/deletion, host moderation, members, and three-second polling. The new-message indicator is local to the open channel, not a persistent unread inbox.
- Rooms, project ideas, shared resources, and search on their respective discovery pages.
- Blocking and reports for members, rooms, and projects.
- A visual home/community board made from profile photos and prompts, room invitations, project ideas, and curated campus photos.

The home board is **not yet an independent posting system**. There are no dedicated post, follow, post-like, reshare, bookmark-post, or notification models/endpoints in the inspected code.

## 1. Make every member identity navigable — first priority

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

## 2. Build a real feed and posting system

### First release

- Add a dedicated **Feed** destination; keep the existing Home board initially.
- Add **Following** and **Community** tabs. Following is chronological and contains your posts plus posts/reshares from people you follow. Community contains eligible community posts chronologically. Avoid calling a chronological feed “For you.”
- A composer for text posts, proposed limit 1,000 characters, with a counter, clear submission state, retry behavior, and a preserved draft on failure.
- Optional images, proposed maximum four, with previews, removal before posting, and alt text. Reuse image validation and normalization patterns; don't couple post images to the profile gallery.
- Post cards with clickable identity, timestamp, body, media, reply/like/reshare/bookmark controls, and an overflow menu.
- Stable post-detail URLs, copy-link sharing, threaded replies, and links that open correctly after sign-in.
- Edit your own text with an edited marker; delete your own posts/replies with confirmation. Preserve sensible placeholders where a deleted post was referenced.
- New-post indicator instead of inserting content above someone while they are reading. Cursor pagination, retained scroll position, loading/error/empty states, and duplicate-submit protection.

### Social interactions

- Like/unlike posts with accurate counts. Keep post likes separate from the existing profile-introduction likes.
- Reply and reply-to-reply within a post conversation; use a bounded visual nesting depth so threads remain readable.
- Reshare/unshare an existing post with “Reshared by …” attribution. Store a reference to the original, not a copied body or image.
- Quote-post with your own comment and a reference to the original.
- Bookmark/unbookmark posts privately.
- Share a room, project, or resource into a post using an internal preview card and its original destination.

### Reshare rules

- No duplicate reshare by the same person; undoing a reshare does not delete the original.
- Deleting, hiding, or restricting an original must remove its content from reshares and quote previews as appropriate.
- Viewers must be authorized to see both the surrounding post and the referenced content. Blocks cannot be bypassed through somebody else's reshare.
- Distinguish quoting from editing someone else's post; always retain original attribution.

## 3. Extend profiles with follows and activity

- Follow/unfollow buttons on other members' profiles; no self-follow and no duplicate follow records.
- Follower/following counts and paginated lists with linked identities.
- Add **Posts**, **Replies**, and **Media** views around the existing profile content. Include plain reshares in the post timeline with attribution.
- Keep saved posts private in a separate personal view; do not expose a public liked-post history by default.
- Show that person's visible rooms, projects, and shared resources to connect their activity across the site.
- Retain Connect/Message as separate controls with the current acceptance rules.
- Optional later: unique handles for mentions and cleaner profile URLs. Numeric URLs can remain as stable aliases.

Proposed initial audience: signed-in community members, consistent with the current app. Following determines subscriptions, not permission to read community-visible posts. Public internet profiles and follower-only accounts need a separate explicit decision.

## 4. Add notifications and a usable inbox

This is a major missing social behavior: people currently need to revisit individual sections to discover many interactions.

- An in-app notification center and unread badge.
- Notifications for follows, post replies, mentions, likes, reshares, connection requests/acceptance, room collaboration decisions, and resource-request decisions.
- Link each notification to the relevant post, profile, conversation, room, or request.
- Persist read/unread state across devices; support mark-all-read, deduplication, and grouped reactions.
- Suppress self-notifications and remove or redact notifications made inaccessible by blocks/deletion.
- Notification preferences; email and browser push can follow later with explicit opt-in.
- A consolidated Messages view for direct conversations and joined chatrooms, with persistent last-read positions and unread counts.

## 5. Close the remaining chat and collaboration gaps

- Bring DMs up to the room-chat baseline: incoming-message refresh, replies, editing/deletion, better history navigation, and consistent profile links. The current DM view uses paginated fetches and explicitly refreshes after sending; it has no recurring incoming-message polling configured.
- Add message-level reporting, reactions, and image/file attachments with controlled file types and access checks.
- Add chat search, message permalinks, pinned messages, room mute, and persistent drafts.
- Consider typing indicators and optional read receipts later. Do not show online/typing states without actual presence data.
- Consider WebSockets/SSE when needed; polling is acceptable for an initial release and does not provide presence by itself.
- Complete project collaboration: the current project detail explicitly says team acceptance and messaging are coming later. Add approve/decline, accepted members, roles, and a project discussion destination.
- For borrowing/lending, provide a private request conversation tied to the transaction rather than requiring a social connection first.

## 6. Discovery, safety, and everyday polish

### Discovery and navigation

- Search posts and members from the feed; eventually a global search with People, Posts, Rooms, Projects, and Resources sections.
- Add topic tags, followed-topic views, and explained interest recommendations after the chronological feeds work.
- Show useful onboarding/empty states: follow suggested members, join a room, or create a first post.
- Shareable deep links with Back restoring the previous search, tab, and scroll position.
- Add saved rooms/projects/resources if user demand warrants it; saved profiles already exist.

### Safety and privacy required for the social launch

- Extend reporting to posts, replies, individual messages, and resource listings. Existing reports target members/rooms/projects only; resource screens can report their owner rather than the listing itself.
- Extend blocks across follows, feeds, search, media, notifications, mentions, quotes, and reshares. Add mute/unmute for a less disruptive way to hide content.
- Add post-author controls to hide or report abusive replies, with moderator review and an audit trail for moderation actions.
- Rate limits and anti-spam checks for follows, posts, reactions, mentions, and replies.
- Enforce ownership and visibility on the server for every mutation and media request; refresh counts/caches after changes.
- Treat text as text or safely rendered markup, restrict unsafe URL schemes, and validate uploaded files. If remote link previews are added later, protect server-side fetching against internal-network requests.
- Define account deactivation/deletion behavior, content retention, and what happens to existing quoted/deleted content.

### Usability

- Visible focus states, accessible controls, sufficient contrast, image alt text, and screen-reader announcements that don't reread the entire feed.
- Laptop-first layouts with usable mobile layouts and no hover-only essential actions.
- Draft recovery, undo for reversible actions, clear failed-send states, and consistent confirmation for destructive actions.

## Proposed technical shape

Create a Django social app rather than overloading room messages or profile prompts.

- `Post`: author, body, created/edited/deleted timestamps, optional parent reply and quoted-post reference, audience.
- `PostMedia`: post, stored image, alt text, position; protected media delivery.
- `Follow`: follower/followed pair with uniqueness and no-self constraints.
- `PostLike`, `Reshare`, `PostBookmark`: unique user/post pairs. Bookmarks remain private.
- `Notification`: recipient, actor, event type, target, read timestamp, and deduplication information.
- Conversation read markers and mute preferences as separate records.

Example proposed routes: `/feed`, `/posts/:id`, profile activity tabs, `/notifications`, and `/messages`. Keep current `/members/:id` and `/connections/:id` routes working.

Use server-side visibility filtering and cursor pagination. Avoid a separate database query for each card's author, counts, or interaction state. Reuse shared identity and post components across the feed, profile timeline, and post detail.

No Gemini API is required for profile links, posts, follows, feeds, or reshares. A later recommendation service is separate work; it should not be a dependency for basic social interactions.

## Suggested build order and approval boundaries

1. **Identity foundation:** clickable names/avatars everywhere, photo fallback, inaccessible-profile handling, keyboard behavior. Keep the current profile design.
2. **Social launch:** text/image posts, profile timelines, follows, chronological feeds, replies, likes, reshares/quote-posts, private bookmarks, and the safety rules needed for these features. Ship in-app interaction notifications with this release.
3. **Conversation and collaboration completion:** persistent unread inbox, DM improvements, project acceptance/discussion, transaction conversations.
4. **Discovery and refinements:** global search, mentions/handles, topic follows, personalized feed ranking, pins/reactions, optional presence and opt-in push/email.

Each phase should be reviewable locally before deployment. New models require migrations; deployment approval should be separate from approval to implement.

## Proposed defaults for approval

- Preserve the Hinge-style Connections profile and existing Home board.
- Add Feed as a separate destination initially.
- Start with signed-in community visibility, not public internet posting.
- Keep follows one-way and independent of mutual connections/DM permission.
- Start with Following and Community chronological feeds.
- Use 1,000-character posts and up to four images.
- Include original-attribution reshares and quote-posts.
- Keep bookmarks private and launch with in-app notifications only.

These are recommendations, not settled user requirements. Approval can cover the whole roadmap or only a numbered phase. **Wait for the user's approval before implementing any phase.**

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

## Validation required when implementation is approved

- Test identity navigation across all audited surfaces, including self, blocked, hidden, and deleted accounts.
- Test follow/like/reshare idempotency, accurate counts, pagination under new activity, and preserved scroll/drafts.
- Test ownership, audience permissions, protected image access, and original-post deletion through reshares/quotes.
- Test notifications, unread state across sessions, and blocked-content exclusion from every surface.
- Test text/image posting and failure recovery end to end on desktop and mobile.
- Confirm existing connection acceptance, room membership, resource requests, and the Hinge-style profile still work.

No application tests were run for this documentation-only task; the findings above come from source inspection.
