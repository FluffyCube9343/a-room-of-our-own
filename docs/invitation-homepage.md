# Blue and white invitation and community

The shared theme uses the primary color as the background with light text on the start page (`/`), and light backgrounds with primary-colored text on signup/login, Home (`/home`), Rooms, Connections, Build together, Share resources, profiles, editors, conversations, and settings. Existing navigation and application flows remain in place.

## Shared visual theme

Edit **`frontend/.env.theme`** to change both brand colors for the whole site:

```dotenv
VITE_THEME_PRIMARY="#1D46E8"
VITE_THEME_BACKGROUND="#FFFFFF"
```

The start page uses PRIMARY as its background and BACKGROUND as its text color. The main site uses the reverse. Normal Vite env files (`.env`, `.env.local`, mode-specific files) and deployment environment variables override the shared values. Keep the quotes around hex colors. Saving `.env.theme` or `.env.theme.local` automatically restarts Vite and reloads the live preview. Rebuild for production. Missing or invalid colors stop startup/build with a clear error. These are public styling values, not secrets.

`frontend/src/styles/theme.css` derives surfaces, borders, muted text, hover states, and accents from these colors. Vite injects the validated variables into the document before rendering to avoid a theme flash. Fonts are the locally stored InviteSans and InviteSerif. The shared top-left logo uses the original Lucide DoorOpen SVG with a black wordmark and larger responsive sizing. Body copy and form values use charcoal; supporting descriptions and metadata use neutral gray. The primary color remains on major headings and accents. The landing page retains its own colors and logo styling. Orange accents have been removed. Cards, inputs, messages, resource illustrations, profiles, dialogs, and error states share the theme. The entry sweep uses the configured main-site background color.

The landing page fills the viewport and has no bottom controls, palette picker, or pause button. The retired palette preference API and old landing stylesheet have been removed. OS/browser reduced-motion preferences still stop automatic motion and skip the door transition.

## Community pinboard (`/home`)

Home is a responsive corkboard with a natural photographic cork texture, an oak-colored frame, tilted polaroids, yellow sticky notes, glossy theme-colored pushpins, translucent masking tape, and paperclipped project links. Layered paper shadows give the board depth. A measured masonry grid mixes the formats without overlapping their contents. Notes use a prominent 17px prompt with a larger answer underneath. Photos, projects, and invitations omit category taglines; cards use consistent title, content, and author styling. Text and controls follow the shared theme variables; natural cork, wood, and paper use material colors.

The board uses the existing `/home/` recommendations plus the signed-in member's profile. Notes are nonempty, visible profile answers; member photos come from profile photo stories. Room and project cards open their real detail pages. Three color UVA Today photographs are independent campus polaroids with photographer credits and original source links in the photo viewer. These are real UVA photos, not member uploads or activity. Local assets: `frontend/public/board/uva-friends-on-grounds.jpg` (Lathan Goumas), `uva-spring-on-the-lawn.jpg` (Emily Faith Morgan), and `uva-rotunda-in-bloom.jpg` (Julia Weaver), all University Communications. Sources: [fall on Grounds](https://news.virginia.edu/content/photos-breathtaking-look-falls-beauty-across-grounds) and [spring on Grounds](https://news.virginia.edu/content/spring-has-sprung-grounds).

Filters show Everything, Polaroids, Notes, or Open invitations. Clicking a polaroid opens a photo-story dialog with previous/next buttons, arrow-key navigation, and Escape to close. “Pin something” opens choices leading to the existing photo/prompt editor, room creator, or project creator. Own content links to `/profile`; other members' content links to their member pages. No separate board-post API or persistence format is introduced.

Empty filters show an explicit empty state. API failures show the existing error/retry notice, and image failures show a visible error instead of substituting another image. Reduced-motion preferences disable hover motion.

## Landing motion and imagery

Two centered phrase carousels advance every 3.5 and 4.7 seconds. Mouse movement starts the portrait trail immediately. Photos disappear after 0.9 seconds, with at most six visible. Their complete rotated bounds must stay at least 24px away from the entire logo entry. Resizing clears existing photos. The trail is disabled during entry, for reduced motion, while the tab is hidden, and for touch input.

The portrait sequence is Ada Lovelace, Grace Hopper, Margaret Hamilton, Katherine Johnson, Dorothy Vaughan, and Hedy Lamarr. Local public-domain archival images come from Wikimedia Commons; Ada's is a historical painted portrait. Original source pages, credits, and licenses are recorded in `frontend/public/invitation/credits.json`. CSS presents all six images in black and white, without captions.

The logo door shares its panel outline with the frame, leaving no inset gap. Hover or keyboard focus swings it to 108 degrees in 0.85 seconds, with the original round knob, fixed size, and no recoil. White light fills the opening with a gentle glow and soft bloom. The wordmark stays still. Leaving the entry closes the door smoothly.

Clicking immediately starts a 620ms white sweep from the doorway. The router navigates only after the viewport is covered. `DoorTransitionProvider` holds the light while initial destination queries settle, then reveals the destination over 650ms. Loading errors remain visible. Browser Back cancels entry, viewport changes recalculate coverage, and enabling reduced motion clears the transition immediately.

## Local development

Use the original `ghh26` checkout. Work on regular branches in this folder rather than creating worktrees.

The preview is **http://127.0.0.1:5174/** with Django on port 8001. From the repository root:

```powershell
$env:DJANGO_CSRF_TRUSTED_ORIGINS = 'http://127.0.0.1:5174,http://localhost:5174'
& .\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8001 --noreload
```

From `frontend`, in another terminal:

```powershell
$env:API_PROXY_TARGET = 'http://127.0.0.1:8001'
npm.cmd run dev -- --port 5174 --strictPort
```

Use a supported Node version. The local runtime is in the ignored `artifacts/tools` directory. Production Docker builds include the public `.env.theme` file; private env files remain excluded.

## Verification

TypeScript, production build, formatting, and browser checks cover the fixed theme, removed landing controls, ignored obsolete palette storage, full-height landing layout, door entry, signup/login validation, immediate photo motion, logo clearance, reduced motion, navigation, primary sections, detail pages, editors, profiles, and settings. Responsive checks cover desktop, tablet, and mobile layouts. Reports and screenshots are in the ignored `artifacts` directory.

## Cork texture asset

`frontend/public/board/cork-texture-v1.png` was generated with the built-in imagegen tool and copied into the project. It repeats at 540px on desktop and 420px on mobile.

Generation prompt:

> Use case: photorealistic-natural. Asset: seamless repeating material texture for a website cork bulletin board. Generate a square straight-on orthographic macro photograph of real natural warm beige/tan cork, small irregular compressed cork granules and subtle porous dark flecks, authentic tactile uneven surface. Uniform soft diffuse lighting, moderate subtle contrast, evenly distributed fine grain, seamless tileable edges. Entire image filled with cork surface. No frame, objects, pins, papers, text, seams, borders, perspective, vignette, shadows or large stains. Granules should be small enough to look realistic at a 600px repeating tile scale.

## Resource photography

The resources page has one main heading and a compact impact row; the former promotional banner is removed. All six demo resource listings have locally stored, online-sourced reference photographs in `frontend/public/resources`. Cards label them as reference photos; detail pages link the photographer and license. `credits.json` records every source and license, and `resourcePhotos.ts` maps the six explicit listing titles to their photos. They do not represent the owners' exact items. New listings without a mapped image explicitly state that no photo has been added. Failed images show an error instead of a substitute.

## Five-tab Connections layout

All application pages retain the shared site header and mobile navigation. Connections, member profiles, and the signed-in profile add a secondary navigation row below the shared header: Discover, Recommended, Likes You, Connections, and Profile. The rest of the site keeps its existing navigation. Discovery is a centered single-profile feed without side panels. Sent likes remain a secondary link. The Saved screen, bookmark action, and Saved entry point have been removed from Connections. Mobile keeps all five destinations in the secondary row.

Recommended uses `/discover/?feed=recommended`: up to six eligible people with shared interests or skills relevant to the viewer's learning goals, ordered by the existing compatibility score. Passed, blocked, and already-handled profiles are excluded. Unsupported feed values return an explicit validation error. Discover keeps the full eligible feed. Photos and prompt-specific likes, passing, connection requests, and conversations continue to use their existing APIs.

The resource-upload/sidebar iteration was saved in commit `e991e32` and undone by `8501143`. Its resource-photo migration was also rolled back locally, with the SQLite database snapshotted in the ignored `artifacts` directory first. That iteration remains recoverable in Git history. The five-tab replacement does not add resource uploads or a message sidebar.
