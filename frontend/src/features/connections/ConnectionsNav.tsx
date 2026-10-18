import { Compass, UserPlus, MessageCircle, Sparkles, UserRound, Send } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { id: 'discover', to: '/connections', label: 'Discover', Icon: Compass },
  { id: 'recommended', to: '/connections?tab=recommended', label: 'Recommended', Icon: Sparkles },
  { id: 'incoming', to: '/connections?tab=incoming', label: 'Requests', Icon: UserPlus },
  { id: 'matches', to: '/connections?tab=matches', label: 'Connections', Icon: MessageCircle },
  { id: 'sent', to: '/connections?tab=sent', label: 'Sent requests', Icon: Send },
  { id: 'profile', to: '/profile', label: 'Profile', Icon: UserRound },
];
export function ConnectionsNav() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const term = new URLSearchParams(search).get('q') || '';
  const selected = pathname.startsWith('/profile')
    ? 'profile'
    : /^\/connections\/\d+/.test(pathname)
      ? 'matches'
      : new URLSearchParams(search).get('tab') || 'discover';
  return (
    <aside className="connection-sidebar" aria-label="Connections sidebar">
      <label className="connection-search">
        Search people
        <input
          type="search"
          value={term}
          placeholder="Name, skill, or interest"
          onChange={(event) => {
            const next = new URLSearchParams();
            if (selected === 'recommended') next.set('tab', 'recommended');
            if (event.target.value) next.set('q', event.target.value);
            navigate(`/connections${next.size ? `?${next}` : ''}`, { replace: true });
          }}
        />
      </label>
      <nav className="connection-nav" aria-label="Connection navigation">
        {tabs.map(({ id, to, label, Icon }) => (
          <Link key={id} to={to} aria-current={selected === id ? 'page' : undefined}>
            <Icon size={19} strokeWidth={selected === id ? 2 : 1.5} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
