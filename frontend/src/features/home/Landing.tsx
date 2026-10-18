import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDoorTransition } from './DoorTransition';
import './invitation.css';

const plans = [
  'a good conversation',
  'your next idea',
  'a new perspective',
  'a little common ground',
];
const people = [
  'curious minds',
  'future collaborators',
  'women in tech',
  'your people',
  'a few new friends',
];
const photographs = [
  'ada-lovelace',
  'grace-hopper',
  'margaret-hamilton',
  'katherine-johnson',
  'dorothy-vaughan',
  'hedy-lamarr',
  'fei-fei-li',
  'gladys-west',
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

export function Landing() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState(0);
  const [person, setPerson] = useState(0);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [trail, setTrail] = useState<TrailPhoto[]>([]);
  const [doorOpen, setDoorOpen] = useState(false);
  const { entering, enter } = useDoorTransition();
  const entry = useRef<HTMLAnchorElement>(null);
  const lastPoint = useRef<{ x: number; y: number; time: number } | null>(null);
  const trailId = useRef(0);
  const reducedMotion = useReducedMotion();
  const motionEnabled = !reducedMotion && visible;
  const destination = '/enter';

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

  return (
    <div className="invitation-home" data-motion={motionEnabled}>
      <Link className="invite-about-link" to="/about">
        About us <span aria-hidden="true">↗</span>
      </Link>
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
                    '--invite-photo-width': `${photoSize.width}px`,
                    '--invite-photo-height': `${photoSize.height}px`,
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
          aria-label="A Room of Our Own: Count me in"
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
      <a className="invite-photo-credits" href="/invitation/credits.html">
        Photo credits
      </a>
    </div>
  );
}
