# A three-minute community demo

After migrations and `seed_demo`, run `python backend/manage.py add_demo_photos` to fill missing demo portraits, project covers, and room covers. Existing uploads are preserved. Projects use a separate photo collection from rooms. Use `--refresh-project-covers` to replace bundled project covers while preserving uploads. Portraits are Unsplash stock photos representing fictional profiles; their depicted identities are unrelated to the demo names. Sources and licenses are recorded in the `credits.json` files under `backend/assets/demo-portraits`, `backend/assets/project-covers`, and `backend/assets/room-covers`. Demo photo seeding requires DEBUG.

All seeded members, rooms, projects, and profile statements are fictional. Room links point to `https://example.com/demo-room`; they demonstrate access control and do not launch real meetings.

## Sign in

Run `seed_demo` as described in [setup](setup.md), then open http://127.0.0.1:5173/login.

- Student: **maya@room.demo**
- Mentor and host of “Women Building with AI”: **priya@room.demo**
- Password for seeded demo accounts: **RoomDemo!2026**

These credentials are intentionally public, local-only demo credentials. Do not deploy these accounts to a real community. The seed command does not reset an existing account's password or undo user privacy settings.

## Walkthrough

1. Start on the landing page. Introduce the mission: “Find your people. Build your own room.”
2. Create a fresh account to demonstrate three-step onboarding, or sign in as Maya to skip setup. Pick AI, social impact, and frontend as interests; choose Python as a learning goal.
3. Open “Women Building with AI” from Home or Rooms. RSVP with “Save me a seat.” The private meeting action becomes available. Refresh to demonstrate persistence. Do not present the placeholder link as a real event.
4. Scroll to related people and projects, or open Connections. Read the shared-interest explanations and profile prompt. Save a profile, then open Saved profiles to find it again. A save is a private bookmark, not a mutual match.
5. Open Build together, choose “A more accessible campus,” and send a short introduction. The request stays pending; acceptance and in-app conversation are intentionally deferred.
6. Sign out from Settings and sign in as Priya. Open the project to read the incoming request, or open her room to manage attendees.

## Additional checks

- Create and edit a room with a real future start/end time and an HTTPS meeting URL.
- Create and edit a project, then close or reopen it.
- Cancel your RSVP or withdraw your project request.
- Hide your profile from discovery in Settings. Author attribution remains on your rooms/projects.
- Submit a report, review it through Django admin, and try blocking/unblocking another member.
- Check the mobile bottom navigation at 390px. On desktop, browse through the top navigation.

Blocking removes visibility and interaction in both directions, cancels related RSVPs/project requests, and removes bookmarks between those members. Unblocking restores eligibility, but does not recreate those earlier actions. A host's attendee removal remains effective until the host explicitly restores RSVP eligibility.
