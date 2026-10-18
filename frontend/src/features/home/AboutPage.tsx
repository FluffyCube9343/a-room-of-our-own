import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/ui';
import './about.css';

const quote = '“a woman must have ... a room of her own if she is to write [code]”';
const author = 'Virginia Woolf,';
const title = 'A Room of One’s Own';
const total = quote.length + author.length + title.length;

export function AboutPage() {
  const [typed, setTyped] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const play = () => {
      clearTimeout(timer);
      if (media.matches) {
        setTyped(total);
        return;
      }
      setTyped(0);
      let position = 0;
      const passage = quote + author + title;
      const typeNext = () => {
        position += 1;
        setTyped(position);
        if (position >= total) return;
        const previous = passage[position - 1];
        let delay = 60 + Math.random() * 65;
        if (position === quote.length || position === quote.length + author.length) {
          delay += 500;
        } else if (previous === ' ' && Math.random() < 0.28) {
          delay += 220 + Math.random() * 340;
        } else if (previous === '.' || previous === ',') {
          delay += 130 + Math.random() * 130;
        }
        timer = setTimeout(typeNext, delay);
      };
      timer = setTimeout(typeNext, 600);
    };
    play();
    media.addEventListener('change', play);
    return () => {
      clearTimeout(timer);
      media.removeEventListener('change', play);
    };
  }, [ready]);

  // Keep word wrapping stable as each character appears, including the attribution.
  const text = (value: string, offset: number) => {
    let index = offset;
    return value.split(/(\s+)/).map((word, wordIndex) => (
      <span className={word.trim() ? 'mac-word' : undefined} key={wordIndex}>
        {[...word].map((char) => {
          const position = index++;
          return (
            <span
              key={position}
              className={`${typed > position ? 'mac-letter-visible' : 'mac-letter-hidden'}${typed === position && typed < total ? ' mac-caret' : ''}`}
            >
              {char}
            </span>
          );
        })}
      </span>
    ));
  };

  return (
    <div className="about-page">
      <a className="skip-link" href="#about-main">
        Skip to our story
      </a>
      <header className="about-header">
        <Link to="/" aria-label="A Room of Our Own landing page">
          <Logo />
        </Link>
        <Link className="about-enter" to="/enter">
          Come on in <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main id="about-main" className="mac-main">
        <h1 className="sr-only">About A Room of Our Own</h1>
        <div className="mac-computer">
          <img
            src="/invitation/macintosh-cutout.png"
            alt="A vintage Apple Macintosh computer with its keyboard"
            width="1254"
            height="1254"
            onLoad={() => setReady(true)}
          />
          <blockquote className="mac-screen">
            <span className="sr-only">
              {quote} Adapted from Virginia Woolf, A Room of One’s Own.
            </span>
            <div aria-hidden="true" className="mac-screen-text">
              <p className="mac-quote">{text(quote, 0)}</p>
              <footer className="mac-attribution">
                <span>{text(author, quote.length)}</span>
                <cite>{text(title, quote.length + author.length)}</cite>
              </footer>
            </div>
          </blockquote>
        </div>
      </main>
    </div>
  );
}
