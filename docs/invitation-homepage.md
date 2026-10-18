# Open Invitation homepage

The `design/open-invitation` worktree adapts concept 03 into a minimal, color-led landing page: two larger centered carousels, a trail of six monochrome portraits of historical women in technology, and the A Room of Our Own logo with an animated drawn door at the bottom center. The top has no navigation or duplicate logo. Only the public landing page (`/`) changes. The signed-in Home, Rooms, Connections, Build together, Share resources, profile, and settings routes retain their existing implementation and styling.

The motion recreates the observable interaction on [222.place](https://222.place/): a vertical phrase reel and briefly appearing cursor photographs. The photographs and implementation are local to this project. The activity carousel advances every 3.5 seconds and the people carousel every 4.7 seconds. The cursor trail starts immediately on mouse movement; there is no initial photograph to hover over or activate. Reloading restarts the portrait sequence with Ada Lovelace. Cursor photographs disappear after 0.9 seconds, and at most six can exist at once. The photo trail passes in front of the carousels. Before adding a photo, the pointer handler checks its full rotated bounds against the complete logo entry, including a 24px gap. Photos that would enter that space are not created. Resizing clears existing photos so a shifted logo cannot collide with them. Moving back outside that space resumes the trail. The photographs have no captions and do not intercept clicks. Pause stops both effects. Reduced-motion preferences stop automatic motion, and touch input does not create cursor photographs.

## Palettes

The bottom-right Palette control offers Terracotta, Graphite, Moss, Blush, Blue hour, Butter, Plum, Sea glass, UVA, and Your own. The custom option lets you choose background, text, and accent colors. There is no contrast restriction, warning, or blocked combination. Any three valid hex colors can be applied and saved. The logo uses the text color; clicking starts a white transition across the page. Invalid stored preferences produce an explicit error instead of silently changing the theme.

Preferences live in this browser’s `room-invitation-palette-v1` storage key. Colors apply only inside the landing page. UVA uses the [official brand colors](https://brand.virginia.edu/design-assets/colors): navy `#232D4B` and orange `#E57200`. Asset references are in `frontend/public/invitation/credits.json`.

## Door entry and imagery

The entry pairs a thin SVG door with the two-line “a room / of our own.” wordmark. The door has a centered frame with matching jambs, a panel that meets the frame without an inset gap, and a symmetrical threshold. The rectangular panel and the transition aperture share the same outline; perspective comes from the animation rather than a slanted drawing. The frame and panel are separate, with the panel rotating in true 3D around its left hinge. The original round knob and thin SVG panel are restored. Hover or keyboard focus swings the panel open to 108 degrees with the earlier, faster 0.85-second easing and no start delay. It holds the final angle without overshooting or recoiling, then closes smoothly when the pointer or focus leaves. The door keeps its original size and position throughout. A bright white glow fills the entire opening inside the frame, gently brightening and dimming uniformly with a soft bloom around its edges. There are no ripples or moving bands. The glow pauses while closed or motion is paused. There is no flash, projected beam, or ring pulse. Keyboard focus underlines the wordmark instead of outlining the entry. The wordmark and both text lines remain fixed during hover and entry.

Clicking starts the final white sweep immediately, expanding from the doorway across the viewport over 620ms without replaying the panel animation. Navigation to the original signup/community destination happens only when the screen is covered. `DoorTransitionProvider`, mounted inside the router, keeps the light on screen across navigation, waits for initial destination queries to settle, then fades the light away over 650ms. Existing loading errors become visible rather than being hidden under the light. The overlay is removed when the reveal finishes. Browser Back cancels an active transition; viewport changes recalculate its coverage. Reduced or paused motion skips the transition, and enabling reduced motion during entry clears it immediately. The shared logo component and other app pages keep their existing UI and styles.

The first portrait is Ada Lovelace. The trail cycles through Ada Lovelace, Grace Hopper, Margaret Hamilton, Katherine Johnson, Dorothy Vaughan, and Hedy Lamarr, then repeats in that order. The six archival portraits are locally stored public-domain files sourced through Wikimedia Commons; Ada's is a historical painted portrait. Source pages, image URLs, original credits, and public-domain status are retained in `frontend/public/invitation/credits.json`. CSS `grayscale(1)` presents every portrait in black and white while preserving the original files. All portraits have a uniform white border with no added text.

## Run the isolated preview

The running preview is **http://127.0.0.1:5174/** with Django on port 8001. It uses a separate SQLite snapshot and the existing fictional demo accounts. The original checkout continues on port 5173.

From the worktree root, in one PowerShell terminal:

```powershell
$env:DJANGO_CSRF_TRUSTED_ORIGINS = 'http://127.0.0.1:5174,http://localhost:5174'
& ..\ghh26\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8001 --noreload
```

In another terminal, from `frontend`:

```powershell
$env:API_PROXY_TARGET = 'http://127.0.0.1:8001'
npm.cmd run dev -- --port 5174 --strictPort
```

Use a supported Node version as documented in `setup.md`. The preview in this session uses the project-local Node runtime installed under the original checkout’s ignored `artifacts/tools` directory.

## Verification

TypeScript, the production build, and formatting checks passed. Browser checks verify the full hover swing without overshoot or backward movement, smooth closing, a uniform animated white glow filling the entire doorway and the original round knob, unchanged door size and position throughout the animation, no external flash or outline, immediate white sweep on click without restarting the door animation, complete screen coverage before navigation, a smooth reveal of signup and signed-in Home, holding the light during slow initial loading, visible loading errors, zero wordmark movement, keyboard/touch input, reduced and paused motion, live changes to reduced motion, browser Back, and repeated entry. Earlier independent rounds also verify the SVG door, six grayscale portraits, photo clearance, ten palette options, custom persistence, carousels, and the unchanged existing routes. Reports and screenshots are in this worktree’s ignored `artifacts` directory.
