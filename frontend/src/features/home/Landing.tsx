import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowUpRight, Check, Palette as PaletteIcon, Pause, Play, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useMe } from '../../lib/hooks';
import { useDoorTransition } from './DoorTransition';
import {
  palettes,
  readPalettePreference,
  selectedPalette,
  writePalettePreference,
  type PaletteColors,
  type PalettePreference,
} from './invitationPalettes';
import './invitation.css';

const plans = [
  'a good conversation',
  'your next idea',
  'a new perspective',
  'a little common ground',
];
const people = ['your people', 'a few new friends', 'curious minds', 'future collaborators'];
const photographs = [
  'ada-lovelace',
  'grace-hopper',
  'margaret-hamilton',
  'katherine-johnson',
  'dorothy-vaughan',
  'hedy-lamarr',
];
const photoSize = { width: 172, height: 207 };
const logoClearance = 24;
const rotations = [-11, 7, -5, 12, -8, 4];
const doorPanelPath = 'M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z';
type TrailPhoto = { id: number; x: number; y: number; file: string; rotation: number };

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

function PalettePicker({
  preference,
  onChange,
}: {
  preference: PalettePreference;
  onChange: (preference: PalettePreference) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState<PaletteColors>(preference.custom);
  const selected = selectedPalette(preference);

  function open() {
    setDraft(preference.custom);
    setCustomizing(preference.id === 'custom');
    dialog.current!.showModal();
  }

  return (
    <>
      <button className="invite-palette-trigger" onClick={open} aria-haspopup="dialog">
        <span className="invite-current-colors" aria-hidden="true">
          {[selected.paper, selected.ink, selected.accent].map((color, index) => (
            <i key={index} style={{ background: color }} />
          ))}
        </span>
        <span>Palette</span>
        <span className="invite-current-palette">{selected.name}</span>
        <PaletteIcon size={14} />
      </button>
      <dialog ref={dialog} className="invite-palette-dialog" aria-labelledby="palette-title">
        <div className="invite-palette-heading">
          <div>
            <p>MAKE IT YOURS</p>
            <h2 id="palette-title">A little color.</h2>
          </div>
          <button aria-label="Close palettes" onClick={() => dialog.current!.close()}>
            <X size={18} />
          </button>
        </div>
        <div className="invite-palette-options" role="group" aria-label="Homepage palettes">
          {palettes.map((palette) => (
            <button
              key={palette.id}
              className="invite-palette-option"
              aria-pressed={!customizing && preference.id === palette.id}
              onClick={() => {
                setCustomizing(false);
                onChange({ ...preference, id: palette.id });
              }}
              title={palette.mood}
            >
              <span className="invite-palette-dots" aria-hidden="true">
                {[palette.paper, palette.ink, palette.accent].map((color, index) => (
                  <i key={index} style={{ background: color }} />
                ))}
              </span>
              <span>{palette.name}</span>
              {!customizing && preference.id === palette.id && <Check size={12} />}
            </button>
          ))}
          <button
            className="invite-palette-option"
            aria-pressed={customizing}
            onClick={() => setCustomizing(true)}
          >
            <span className="invite-palette-dots" aria-hidden="true">
              {[draft.paper, draft.ink, draft.accent].map((color, index) => (
                <i key={index} style={{ background: color }} />
              ))}
            </span>
            <span>Your own</span>
            <PaletteIcon size={12} />
          </button>
        </div>
        {customizing && (
          <form
            className="invite-custom-palette"
            onSubmit={(event) => {
              event.preventDefault();
              onChange({ id: 'custom', custom: draft });
              dialog.current!.close();
            }}
          >
            <p>Three colors. Entirely yours.</p>
            <div className="invite-color-inputs">
              {(['paper', 'ink', 'accent'] as const).map((key) => (
                <label key={key}>
                  <span>{key === 'paper' ? 'Background' : key === 'ink' ? 'Text' : 'Accent'}</span>
                  <input
                    type="color"
                    aria-label={`Custom ${key === 'paper' ? 'background' : key === 'ink' ? 'text' : 'accent'} color`}
                    value={draft[key]}
                    onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                  />
                  <span>{draft[key].toUpperCase()}</span>
                </label>
              ))}
            </div>
            <button className="invite-apply" type="submit">
              Use my palette <ArrowUpRight size={15} />
            </button>
          </form>
        )}
        <p className="invite-palette-note">Saved on this browser. Homepage only.</p>
        {preference.id === 'uva' && !customizing && (
          <a
            className="invite-uva-source"
            href="https://brand.virginia.edu/design-assets/colors"
            target="_blank"
            rel="noreferrer"
          >
            UVA’s official navy & orange ↗
          </a>
        )}
      </dialog>
    </>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const { data } = useMe();
  const [preference, setPreference] = useState(readPalettePreference);
  const [plan, setPlan] = useState(0);
  const [person, setPerson] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [trail, setTrail] = useState<TrailPhoto[]>([]);
  const [doorOpen, setDoorOpen] = useState(false);
  const { entering, enter } = useDoorTransition();
  const entry = useRef<HTMLAnchorElement>(null);
  const lastPoint = useRef<{ x: number; y: number; time: number } | null>(null);
  const trailId = useRef(0);
  const reducedMotion = useReducedMotion();
  const motionEnabled = !paused && !reducedMotion && visible;
  const palette = selectedPalette(preference);
  const destination = data?.user ? '/home' : '/signup';

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    const clearTrail = () => {
      setTrail([]);
      lastPoint.current = null;
    };
    window.addEventListener('resize', clearTrail);
    return () => window.removeEventListener('resize', clearTrail);
  }, []);

  useEffect(() => {
    if (!motionEnabled) return;
    const timer = window.setInterval(
      () => setPlan((previous) => (previous + 1) % plans.length),
      3500,
    );
    const peopleTimer = window.setInterval(
      () => setPerson((previous) => (previous + 1) % people.length),
      4700,
    );
    return () => {
      window.clearInterval(timer);
      window.clearInterval(peopleTimer);
    };
  }, [motionEnabled]);

  function updatePalette(next: PalettePreference) {
    writePalettePreference(next);
    setPreference(next);
  }

  function followPointer(event: PointerEvent<HTMLElement>) {
    if (entering || !motionEnabled || event.pointerType !== 'mouse') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const time = performance.now();
    const previous = lastPoint.current;
    if (previous && (Math.hypot(x - previous.x, y - previous.y) < 85 || time - previous.time < 95))
      return;
    const rotation = rotations[trailId.current % rotations.length];
    const radians = (rotation * Math.PI) / 180;
    const halfWidth =
      (Math.abs(Math.cos(radians)) * photoSize.width +
        Math.abs(Math.sin(radians)) * photoSize.height) /
      2;
    const halfHeight =
      (Math.abs(Math.sin(radians)) * photoSize.width +
        Math.abs(Math.cos(radians)) * photoSize.height) /
      2;
    const logo = entry.current!.getBoundingClientRect();
    if (
      event.clientX + halfWidth > logo.left - logoClearance &&
      event.clientX - halfWidth < logo.right + logoClearance &&
      event.clientY + halfHeight > logo.top - logoClearance &&
      event.clientY - halfHeight < logo.bottom + logoClearance
    )
      return;
    lastPoint.current = { x, y, time };
    const id = trailId.current++;
    setTrail((current) => [
      ...current.slice(-5),
      {
        id,
        x,
        y,
        file: photographs[id % photographs.length],
        rotation,
      },
    ]);
  }

  const theme = {
    '--invite-paper': palette.paper,
    '--invite-ink': palette.ink,
    '--invite-accent': palette.accent,
    '--invite-photo-width': `${photoSize.width}px`,
    '--invite-photo-height': `${photoSize.height}px`,
  } as CSSProperties;

  return (
    <div
      className="invitation-home"
      style={theme}
      data-palette={palette.id}
      data-motion={motionEnabled}
    >
      <a className="invite-skip" href="#invitation">
        Skip to the invitation
      </a>
      <main id="invitation" className="invite-main" onPointerMove={followPointer}>
        <div className="invite-trail-layer" aria-hidden="true">
          {motionEnabled &&
            trail.map((photo) => (
              <figure
                key={photo.id}
                className="invite-trail-photo"
                style={
                  {
                    left: photo.x,
                    top: photo.y,
                    '--photo-turn': `${photo.rotation}deg`,
                  } as CSSProperties
                }
                onAnimationEnd={() =>
                  setTrail((current) => current.filter((item) => item.id !== photo.id))
                }
              >
                <img src={`/invitation/${photo.file}.jpg`} alt="" draggable={false} />
              </figure>
            ))}
        </div>
        <h1
          className="invite-message"
          aria-label="Make room for a good conversation with your people."
        >
          <span className="invite-message-lead">make room for</span>
          <span className="invite-word-window" aria-hidden="true">
            <span key={plan} className={motionEnabled ? 'invite-rolling-word' : ''}>
              {plans[plan]}
            </span>
          </span>
          <span className="invite-with-group" aria-hidden="true">
            <span className="invite-message-with">with</span>
            <span className="invite-people-pill">
              <span key={person} className={motionEnabled ? 'invite-rolling-person' : ''}>
                {people[person]}
              </span>
            </span>
          </span>
        </h1>
        <Link
          ref={entry}
          className="invite-entry"
          to={destination}
          aria-label="A Room of Our Own — Count me in"
          aria-busy={entering}
          data-open={doorOpen}
          data-entering={entering}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse' && motionEnabled && !entering) setDoorOpen(true);
          }}
          onPointerLeave={() => {
            if (!entering) setDoorOpen(false);
          }}
          onFocus={(event) => {
            if (event.currentTarget.matches(':focus-visible') && motionEnabled && !entering)
              setDoorOpen(true);
          }}
          onBlur={() => {
            if (!entering) setDoorOpen(false);
          }}
          onClick={(event) => {
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            if (entering) return;
            if (!motionEnabled) {
              navigate(destination);
              return;
            }
            const aperture = entry.current!.querySelector<SVGPathElement>('.invite-logo-aperture');
            if (!aperture) throw new Error('The logo is missing its doorway light aperture.');
            setTrail([]);
            enter(destination, aperture);
          }}
        >
          <span className="invite-entry-brand" aria-hidden="true">
            <span className="invite-logo-door">
              <span className="invite-logo-interior" />
              <svg className="invite-logo-frame" viewBox="0 0 24 26" preserveAspectRatio="none">
                <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M2 21h20" />
                <path
                  className="invite-logo-aperture"
                  d={doorPanelPath}
                  fill="none"
                  stroke="none"
                />
              </svg>
              <span className="invite-logo-leaf">
                <svg viewBox="0 0 24 26" preserveAspectRatio="none">
                  <path className="invite-logo-panel" d={doorPanelPath} />
                  <circle cx="15.5" cy="12.5" r="0.45" fill="currentColor" stroke="none" />
                </svg>
              </span>
            </span>
            <span className="invite-entry-wordmark">
              <span>a room</span>
              <span>of our own.</span>
            </span>
          </span>
        </Link>
      </main>
      <div className="invite-design-controls" inert={entering}>
        <button
          className="invite-motion-toggle"
          disabled={reducedMotion}
          aria-pressed={paused || reducedMotion}
          onClick={() => {
            setPaused(!paused);
            setTrail([]);
          }}
        >
          {paused || reducedMotion ? <Play size={12} /> : <Pause size={12} />}
          {reducedMotion ? 'Motion reduced' : paused ? 'Resume motion' : 'Pause motion'}
        </button>
        <PalettePicker preference={preference} onChange={updatePalette} />
      </div>
    </div>
  );
}
