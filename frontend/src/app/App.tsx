import { useEffect } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { DoorOpen, Home, Sparkles, Users, Leaf } from 'lucide-react';
import { useMe } from '../lib/hooks';
import { Avatar, ErrorNotice, Loading, Logo } from '../components/ui';
import { Landing } from '../features/home/Landing';
import { AboutPage } from '../features/home/AboutPage';
import { HomePage } from '../features/home/HomePage';
import { AuthPage } from '../features/auth/AuthPage';
import { OnboardingPage } from '../features/profile/ProfilePage';
import { ProfileAccountPage, ProfilePreviewPage } from '../features/profile/ProfileAccountPage';
import { RoomsPage, RoomDetail, RoomEditor } from '../features/rooms/RoomsPage';
import {
  ConnectionsPage,
  MemberPage,
  ConversationPage,
} from '../features/connections/DiscoveryPage';
import { ConnectionsNav } from '../features/connections/ConnectionsNav';
import { ResourcesPage, ResourceDetail, ResourceEditor } from '../features/resources/ResourcesPage';
import { SuggestProject } from '../features/resources/SuggestProject';
import { ProjectsPage, ProjectDetail, ProjectEditor } from '../features/projects/ProjectsPage';

function DoorEntry() {
  const query = useMe();
  if (query.isPending || query.isFetching) return <Loading />;
  if (query.isError) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  return <Navigate to={query.data.user ? '/home' : '/signup'} replace />;
}

function Protected() {
  const query = useMe();
  const location = useLocation();
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  if (!query.data.user) return <Navigate to="/login" replace />;
  if (!query.data.user.profile.onboarding_complete && location.pathname !== '/onboarding')
    return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
const navigation = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/rooms', label: 'Rooms', icon: DoorOpen },
  { to: '/connections', label: 'Connections', icon: Users },
  { to: '/projects', label: 'Build together', icon: Sparkles },
  { to: '/resources', label: 'Share resources', icon: Leaf },
];
function Shell() {
  const { data } = useMe();
  const { pathname } = useLocation();
  const connectionSection = ['/connections', '/members'].some(
    (path) => pathname === path || pathname.startsWith(path + '/'),
  );
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link to="/" aria-label="A Room of Our Own home">
          <Logo />
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {navigation.map(({ to, label }) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
          <NavLink to="/about">About us</NavLink>
        </nav>
        <SuggestProject />
        <Link to="/profile" className="profile-link" aria-label="Your profile">
          {data?.user?.profile.avatar_url ? (
            <img
              className="header-profile-photo"
              src={data.user.profile.avatar_url}
              alt="Your profile photo"
            />
          ) : (
            <Avatar name={data?.user?.profile.display_name || 'You'} />
          )}
        </Link>
      </header>
      <main id="main" className={`app-main ${connectionSection ? 'connection-main' : ''}`}>
        {connectionSection && (
          <div className="connection-subnav">
            <ConnectionsNav />
          </div>
        )}
        {connectionSection ? (
          <div className="connection-content">
            <Outlet />
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      <footer className="app-footer">
        <span>A room for you. A world of possibility.</span>
        <Link to="/about">About us</Link>
        <span>Made for community, at UVA.</span>
      </footer>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink to={to} key={to}>
            <Icon size={20} />
            <span>{to === '/projects' ? 'Build' : to === '/resources' ? 'Share' : label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
export default function App() {
  return (
    <>
      <ScrollReset />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/enter" element={<DoorEntry />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage signup />} />
        <Route element={<Protected />}>
          <Route element={<Shell />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/rooms/new" element={<RoomEditor />} />
            <Route path="/rooms/:id/edit" element={<RoomEditor />} />
            <Route path="/rooms/:id" element={<RoomDetail />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/connections/:id" element={<ConversationPage />} />
            <Route path="/members/:id" element={<MemberPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/new" element={<ProjectEditor />} />
            <Route path="/projects/:id/edit" element={<ProjectEditor />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/profile" element={<ProfileAccountPage />} />
            <Route path="/profile/preview" element={<ProfilePreviewPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/resources/new" element={<ResourceEditor />} />
            <Route path="/resources/:id/edit" element={<ResourceEditor />} />
            <Route path="/resources/:id" element={<ResourceDetail />} />
          </Route>
        </Route>
        <Route
          path="*"
          element={
            <div className="not-found">
              <Logo />
              <h1>This room isn't here.</h1>
              <Link className="button" to="/">
                Let's head home
              </Link>
            </div>
          }
        />
      </Routes>
    </>
  );
}
