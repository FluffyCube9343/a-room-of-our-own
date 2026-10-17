# Verification record

Verified locally on October 17, 2026, using Python 3.11 and Node.js 22.18.

## Automated checks

- Django system checks: passed, no issues.
- Migration drift check: passed, no changes detected.
- Django regression suite: **18 tests passed**. Covers session/CSRF enforcement, signup/password validation, owner permissions, onboarding, meeting-link privacy, RSVP removal/restoration, duplicate prevention, project request privacy, bookmarks, bidirectional blocking, hidden profiles, report constraints, recommendation explanations, URL/date validation, unsupported methods, and repeatable seeding.
- TypeScript checking: passed.
- ESLint: passed.
- Prettier format check: passed.
- Vite production build: passed. Rollup strips two malformed optimization annotations in the installed Zod dependency; these are dependency build warnings, not compile failures.
- Git whitespace check: passed for tracked changes.

## Browser checks

Completed against the running React frontend and Django API, rather than mock data handlers:

- Fresh signup, three-step onboarding, and arrival at the personalized home page.
- RSVP, private meeting action, and persistence after refresh.
- Mentor bookmark and saved-profile discovery.
- Project collaboration request and persistence after refresh.
- Room creation and title editing; project creation and title editing.
- Profile prompt editing and persistence after refresh.
- Report submission, block/unblock, sign-out, and sign-in.
- Host attendee removal and restoration of RSVP eligibility.
- Owner-only incoming project request panel.
- Simulated HTTP 503 response, visible error, and successful retry.
- Keyboard access to the skip link and Escape closing a confirmation dialog.
- Main routes checked at 390px, 768px, and 1440px without horizontal overflow; desktop landing and mobile home/mentor layouts visually inspected.

Expected error responses were produced during failure/blocking checks. A Vite configuration reload also briefly interrupted development resources while formatting was applied. Ordinary final page loads had no console errors.

## Limits

This is a local scaffold, not a public deployment or a full accessibility/security certification. No real video calls, email delivery, mutual matches, team acceptance, or inbox are included. The next launch steps are listed in [setup](setup.md). Browser checks were executed interactively; the checked-in automated regression suite is the Django suite.
