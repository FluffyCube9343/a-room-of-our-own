import { Link, useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { id: 'discover', to: '/connections', label: 'Discover' },
  { id: 'recommended', to: '/connections?tab=recommended', label: 'Recommended' },
  { id: 'incoming', to: '/connections?tab=incoming', label: 'Requests' },
  { id: 'matches', to: '/connections?tab=matches', label: 'Connections' },
  { id: 'sent', to: '/connections?tab=sent', label: 'Sent requests' },
  { id: 'profile', to: '/profile', label: 'Profile' },
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
        {tabs.map(({ id, to, label }) => (
          <Link key={id} to={to} aria-current={selected === id ? 'page' : undefined}>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
