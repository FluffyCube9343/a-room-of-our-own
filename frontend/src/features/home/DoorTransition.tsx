import { useIsFetching } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './doorTransition.css';

type Destination = '/home' | '/signup' | '/enter';
type LightOrigin = { x: number; y: number; scale: number };
type EntryTransition = {
  phase: 'covering' | 'holding' | 'revealing';
  destination: Destination;
  sourcePath: string;
  origin: LightOrigin;
};

function lightScale(x: number, y: number) {
  const farthestX = Math.max(Math.abs(x), Math.abs(window.innerWidth - x));
  const farthestY = Math.max(Math.abs(y), Math.abs(window.innerHeight - y));
  return Math.ceil(Math.hypot(farthestX, farthestY) / 22) + 2;
}

const DoorTransitionContext = createContext<{
  entering: boolean;
  enter: (destination: Destination, source: Element) => void;
} | null>(null);

export function useDoorTransition() {
  const transition = useContext(DoorTransitionContext);
  if (!transition) throw new Error('Door entry requires DoorTransitionProvider inside the router.');
  return transition;
}

export function DoorTransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const pendingQueries = useIsFetching({ predicate: (query) => query.state.status === 'pending' });
  const [transition, setTransition] = useState<EntryTransition | null>(null);
  const active = useRef(false);

  function enter(destination: Destination, source: Element) {
    if (active.current) return;
    if (!source.isConnected)
      throw new Error('The entry link must be mounted before starting its light transition.');
    const bounds = source.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0)
      throw new Error('The entry link must have a visible size for the light transition.');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigate(destination);
      return;
    }
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    active.current = true;
    setTransition({
      phase: 'covering',
      destination,
      sourcePath: location.pathname,
      origin: { x, y, scale: lightScale(x, y) },
    });
  }

  useEffect(() => {
    const resize = () => {
      setTransition((current) =>
        current
          ? {
              ...current,
              origin: {
                ...current.origin,
                scale: lightScale(current.origin.x, current.origin.y),
              },
            }
          : current,
      );
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const cancelForHistory = () => {
      active.current = false;
      setTransition(null);
    };
    window.addEventListener('popstate', cancelForHistory);
    return () => window.removeEventListener('popstate', cancelForHistory);
  }, []);

  useEffect(() => {
    if (!transition) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => {
      if (!media.matches) return;
      active.current = false;
      setTransition(null);
      if (transition.phase === 'covering') navigate(transition.destination);
    };
    media.addEventListener('change', reduce);
    return () => media.removeEventListener('change', reduce);
  }, [transition, location.pathname, navigate]);

  useEffect(() => {
    if (
      transition?.phase !== 'holding' ||
      location.pathname === transition.sourcePath ||
      pendingQueries > 0
    )
      return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        setTransition({ ...transition, phase: 'revealing' });
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [transition, location.pathname, pendingQueries]);

  const overlay = transition;
  const origin = overlay?.origin;

  return (
    <DoorTransitionContext.Provider value={{ entering: transition !== null, enter }}>
      {children}
      {overlay && origin && (
        <div
          className="door-transition-curtain"
          data-phase={overlay.phase}
          aria-hidden="true"
          style={
            {
              '--door-light-x': `${origin.x}px`,
              '--door-light-y': `${origin.y}px`,
              '--door-light-scale': origin.scale,
            } as CSSProperties
          }
          onAnimationEnd={(event) => {
            if (event.animationName === 'door-light-expand' && overlay.phase === 'covering') {
              setTransition({ ...overlay, phase: 'holding' });
              navigate(overlay.destination);
            }
            if (event.animationName === 'door-light-reveal' && overlay.phase === 'revealing') {
              active.current = false;
              setTransition(null);
            }
          }}
        >
          <div className="door-transition-light" />
        </div>
      )}
    </DoorTransitionContext.Provider>
  );
}
