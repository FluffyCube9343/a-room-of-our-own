# Blue and white invitation and community

The `design/open-invitation` worktree uses one shared blue and white theme across the landing page, signup/login, Home, Rooms, Connections, Build together, Share resources, profiles, editors, conversations, and settings. Existing navigation and application flows remain in place.

## Shared visual theme

`frontend/src/styles/theme.css` defines a white background (`#FFFFFF`), electric-blue text and accents (`#1D46E8`). Pale-blue surfaces, borders, muted text, status colors, and hover states derive from those shared tokens. Fonts are the landing page's locally stored InviteSans and InviteSerif. Navigation uses a blue active pill; primary buttons use blue with white text. The shared top-left logo uses the original Lucide DoorOpen SVG from the starter implementation. Orange accents have been removed. Cards, inputs, messages, resource illustrations, profiles, dialogs, and error states use the same system.

The landing page fills the viewport and has no bottom controls, palette picker, or pause button. The retired palette preference API and old landing stylesheet have been removed. OS/browser reduced-motion preferences still stop automatic motion and skip the door transition.

## Landing motion and imagery

Two centered phrase carousels advance every 3.5 and 4.7 seconds. Mouse movement starts the portrait trail immediately. Photos disappear after 0.9 seconds, with at most six visible. Their complete rotated bounds must stay at least 24px away from the entire logo entry. Resizing clears existing photos. The trail is disabled during entry, for reduced motion, while the tab is hidden, and for touch input.

The portrait sequence is Ada Lovelace, Grace Hopper, Margaret Hamilton, Katherine Johnson, Dorothy Vaughan, and Hedy Lamarr. Local public-domain archival images come from Wikimedia Commons; Ada's is a historical painted portrait. Original source pages, credits, and licenses are recorded in `frontend/public/invitation/credits.json`. CSS presents all six images in black and white, without captions.

The logo door shares its panel outline with the frame, leaving no inset gap. Hover or keyboard focus swings it to 108 degrees in 0.85 seconds, with the original round knob, fixed size, and no recoil. White light fills the opening with a gentle glow and soft bloom. The wordmark stays still. Leaving the entry closes the door smoothly.

Clicking immediately starts a 620ms white sweep from the doorway. The router navigates only after the viewport is covered. `DoorTransitionProvider` holds the light while initial destination queries settle, then reveals the destination over 650ms. Loading errors remain visible. Browser Back cancels entry, viewport changes recalculate coverage, and enabling reduced motion clears the transition immediately.

## Run the isolated preview

The running preview is **http://127.0.0.1:5174/** with Django on port 8001 and a separate SQLite snapshot. The original checkout remains separate on port 5173.

From the worktree root:

```powershell
$env:DJANGO_CSRF_TRUSTED_ORIGINS = 'http://127.0.0.1:5174,http://localhost:5174'
& ..\ghh26\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8001 --noreload
```

From `frontend`, in another terminal:

```powershell
$env:API_PROXY_TARGET = 'http://127.0.0.1:8001'
npm.cmd run dev -- --port 5174 --strictPort
```

Use a supported Node version as documented in `setup.md`. This preview uses the project-local runtime under the original checkout's ignored `artifacts/tools` directory.

## Verification

TypeScript, production build, formatting, and browser checks cover the fixed theme, removed landing controls, ignored obsolete palette storage, full-height landing layout, door entry, signup/login validation, immediate photo motion, logo clearance, reduced motion, navigation, primary sections, detail pages, editors, profiles, and settings. Responsive checks cover desktop, tablet, and mobile layouts. Reports and screenshots are in the worktree's ignored `artifacts` directory.
