import { Compass, Heart, MessageCircle, Sparkles, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const tabs = [
  { id: 'discover', to: '/connections', label: 'Discover', Icon: Compass },
  { id: 'recommended', to: '/connections?tab=recommended', label: 'Recommended', Icon: Sparkles },
  { id: 'incoming', to: '/connections?tab=incoming', label: 'Likes You', Icon: Heart },
  { id: 'matches', to: '/connections?tab=matches', label: 'Connections', Icon: MessageCircle },
  { id: 'profile', to: '/profile', label: 'Profile', Icon: UserRound },
];
export function ConnectionsNav() {
  const { pathname, search } = useLocation();
  const selected = pathname.startsWith('/profile')
    ? 'profile'
    : /^\/connections\/\d+/.test(pathname)
      ? 'matches'
      : new URLSearchParams(search).get('tab') || 'discover';
  return (
    <nav className="connection-nav" aria-label="Connection navigation">
      {tabs.map(({ id, to, label, Icon }) => (
        <Link key={id} to={to} aria-current={selected === id ? 'page' : undefined}>
          <Icon size={19} strokeWidth={selected === id ? 2 : 1.5} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
