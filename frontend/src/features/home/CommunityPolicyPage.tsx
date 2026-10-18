import { Link } from 'react-router-dom';
import { Logo } from '../../components/ui';

const privacy = [
  {
    id: 'account',
    title: 'Your account',
    text: 'The app stores your email address and a protected password hash so you can sign in. Your email is shown in your account settings, not on your member profile. Changing your email also changes the address you use to sign in.',
  },
  {
    id: 'profile',
    title: 'What other members see',
    text: 'Signed-in members can see the profile details, photos, and prompt answers you choose to show. Private prompt drafts are excluded from other members’ profiles. Turning off Discover removes your profile from discovery; your name may still appear on rooms, projects, and resources you shared.',
  },
  {
    id: 'conversations',
    title: 'Conversations and requests',
    text: 'Connection messages are available to the people in that connection. Borrowing notes and pickup details are shared with the people involved in that request. Blocking a member prevents further interaction and hides their activity from you.',
  },
  {
    id: 'photos',
    title: 'Photos',
    text: 'Uploaded profile photos are decoded and re-encoded before storage, removing embedded EXIF metadata such as location information. Photo files require an authenticated request. Removing a profile photo deletes its stored file after the database change succeeds.',
  },
  {
    id: 'cookies',
    title: 'Cookies and storage',
    text: 'The site uses session and security cookies to keep you signed in and protect form submissions. Account details, messages, rooms, projects, and resource requests are stored on the server. Following an external link takes you to a separate site with its own privacy practices.',
  },
  {
    id: 'control',
    title: 'Your choices',
    text: 'You can edit your profile, hide it from Discover, remove photos, keep prompt answers private, or block members in your profile editor. Ending a connection or hiding a profile does not delete all previous records. For other account or data-removal questions, contact a site administrator.',
  },
];
const terms = [
  {
    id: 'community',
    title: 'Take care of the community',
    text: 'Use your account to meet people, share knowledge, and collaborate respectfully. Do not harass, impersonate, discriminate against, or threaten other members. Do not post private information about someone else without their permission.',
  },
  {
    id: 'sharing',
    title: 'Share what is yours to share',
    text: 'Only upload photos, links, and other content you have permission to share. Describe your experience, projects, and resources honestly. Keep private contact details and sensitive information out of public profile answers.',
  },
  {
    id: 'resources',
    title: 'Borrowing and lending',
    text: 'Shared resources are offered for free. Agree on condition, pickup, use, and return arrangements with the owner before collecting an item. Inspect equipment before using it, follow its instructions, and tell the owner promptly about damage or a change in your plans.',
  },
  {
    id: 'gatherings',
    title: 'Rooms and collaborations',
    text: 'Check the time, location, and requirements before joining a gathering or project. Hosts are responsible for keeping their invitations accurate. Respect a host’s decision to close a room, remove an attendee, or decline a request.',
  },
  {
    id: 'safety',
    title: 'If something feels wrong',
    text: 'Use the report control on a member, room, project, or resource to flag misuse. You can block a member from their profile and manage blocked people in Account settings. A site administrator may review reports and restrict access when community rules are broken.',
  },
  {
    id: 'account',
    title: 'Your account',
    text: 'Keep your password private and your email address current. Activity is associated with your signed-in account. For help with access, stored data, or these community rules, contact a site administrator.',
  },
];

export function CommunityPolicyPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const sections = kind === 'privacy' ? privacy : terms;
  const title = kind === 'privacy' ? 'Privacy' : 'Community terms';
  return (
    <div className="community-site policy-site">
      <header className="site-header">
        <Link to="/" aria-label="A Room of Our Own landing page">
          <Logo />
        </Link>
        <Link className="text-link" to="/enter">
          Back to the community
        </Link>
      </header>
      <main className="policy-page">
        <header>
          <h1>{title}</h1>
        </header>
        <nav aria-label={`${title} sections`}>
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.title}
            </a>
          ))}
        </nav>
        <article>
          {sections.map((section) => (
            <section id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              <p>{section.text}</p>
            </section>
          ))}
        </article>
      </main>
      <footer className="app-footer">
        <span>A room of our own.</span>
        <nav aria-label="Community information">
          <Link to="/about">About</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
      </footer>
    </div>
  );
}
