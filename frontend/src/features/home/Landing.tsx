import { ArrowRight, ArrowUpRight, Check, DoorOpen, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, CommunityNote, Logo } from '../../components/ui';
import { useMe } from '../../lib/hooks';

export function Landing() {
  const { data } = useMe();
  const destination = data?.user ? '/home' : '/signup';
  return (
    <div className="landing">
      <header className="site-header">
        <Link to="/" aria-label="A Room of Our Own">
          <Logo />
        </Link>
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#our-room">Our story</a>
          <a href="#possibilities">What's inside</a>
        </nav>
        <Link className="button secondary small" to={data?.user ? '/home' : '/login'}>
          {data?.user ? 'My community' : 'Come on in'}
          <ArrowUpRight size={16} />
        </Link>
      </header>
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" /> A COMMUNITY STARTING AT UVA
            </p>
            <h1>
              Find your people.
              <br />
              Build your
              <br />
              <em>own room.</em>
              <span className="hero-star" aria-hidden="true">
                ✳
              </span>
            </h1>
            <p className="hero-description">
              A space for women in tech to meet, share what they know, and build something together.
            </p>
            <Link className="button hero-button" to={destination}>
              Find your room <ArrowRight size={19} />
            </Link>
            <div className="hero-caption">
              <span className="avatar-stack">
                <Avatar name="Maya Chen" />
                <Avatar name="Priya Sharma" />
                <Avatar name="Zoe Williams" />
              </span>
              <span>
                Big ideas. Open doors.
                <br />
                <strong>A place to begin.</strong>
              </span>
            </div>
          </div>
          <div className="hero-composition" aria-label="Illustrative community preview">
            <div className="hero-arch">
              <span className="arch-caption">
                GOOD THINGS HAPPEN
                <br />
                WHEN WE MAKE SPACE.
              </span>
              <div className="arch-line" />
              <div className="arch-door" />
              <span className="arch-star">✳</span>
            </div>
            <article className="floating-profile">
              <span className="tiny-label">A LITTLE COMMON GROUND</span>
              <div className="profile-mini">
                <Avatar name="Priya Sharma" large />
                <div>
                  <h3>Meet Priya.</h3>
                  <p>Fourth-year · CS</p>
                </div>
                <Sparkles size={22} />
              </div>
              <p className="mini-prompt">
                “Ask me about turning your
                <br />
                first idea into something real.”
              </p>
              <div className="mini-match">
                <Check size={14} />
                You both care about social impact
              </div>
            </article>
            <div className="floating-room">
              <span className="mini-door">
                <DoorOpen size={24} />
              </span>
              <div>
                <span className="tiny-label">THERE'S A ROOM FOR THAT</span>
                <strong>Women Building with AI</strong>
                <span>A conversation. A starting point.</span>
              </div>
              <ArrowUpRight size={18} />
            </div>
            <span className="preview-note">A glimpse of our fictional demo community</span>
          </div>
        </section>
        <CommunityNote />
        <section id="possibilities" className="possibilities">
          <p className="eyebrow">MORE THAN A NETWORK. YOUR PEOPLE.</p>
          <div className="section-heading">
            <h2>
              One open door.
              <br />
              <em>So many possibilities.</em>
            </h2>
            <p>
              You don't need to have it all figured out.
              <br />
              You just need somewhere to start.
            </p>
          </div>
          <div className="pillar-grid">
            {[
              {
                icon: DoorOpen,
                number: '01',
                title: 'Make room.',
                text: 'Host a conversation, join a workshop, or find a coding circle. Small gatherings can start something big.',
                link: 'Explore rooms',
              },
              {
                icon: Users,
                number: '02',
                title: 'Find your people.',
                text: 'Meet a mentor who gets it. Connect through shared interests, honest stories, and a little common ground.',
                link: 'Discover connections',
              },
              {
                icon: Sparkles,
                number: '03',
                title: 'Build something.',
                text: 'That idea in your notes app? Give it a team. Find collaborators who are as curious as you are.',
                link: 'Build together',
              },
            ].map(({ icon: Icon, number, title, text, link }) => (
              <article key={number}>
                <div className="pillar-top">
                  <Icon strokeWidth={1.3} size={26} />
                  <span>{number}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <Link to={destination}>
                  {link}
                  <ArrowRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section id="our-room" className="mission">
          <span className="eyebrow">INSPIRED BY VIRGINIA WOOLF. BUILT BY US.</span>
          <h2>
            If we're not given a seat at the table,
            <br />
            <em>we'll build our own room.</em>
          </h2>
          <p>
            Women-centered and gender-inclusive, this is a community shaped by the people in it.
            Starting at the University of Virginia. With room to grow.
          </p>
          <Link className="button" to={destination}>
            There's a place for you here <ArrowRight size={17} />
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <p>A little more possible, together.</p>
        <span>UVA · A Room of Our Own</span>
      </footer>
    </div>
  );
}
