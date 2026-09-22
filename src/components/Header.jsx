import { useState } from 'react';
import { eventInfo, navLinks } from '../data/content';
import './Header.css';

// `minimal`: wird auf Unterseiten (Impressum, Datenschutz) verwendet, die
// keine der Anker-Sections der Startseite (#reservieren, #informationen, ...)
// besitzen. Zeigt dann nur das Logo (verlinkt zurück zur Startseite) ohne
// die sonst ins Leere laufende Navigation.
function Header({ minimal = false }) {
  const [menuOpen, setMenuOpen] = useState(false);

  function handleNavClick() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <a
          href={minimal ? '/' : '#top'}
          className="site-header__logo"
          onClick={handleNavClick}
          aria-label={eventInfo.title}
        >
          <img
            src="/downloads/weinland_mitte_zusatz_negativ_600dpi.png"
            alt={eventInfo.title}
            className="site-header__logo-img"
            width="220"
            height="61"
          />
        </a>

        {!minimal && (
          <>
            <nav className="site-header__nav site-header__nav--desktop">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href}>
                  {link.label}
                </a>
              ))}
            </nav>

            <a href="#reservieren" className="btn btn--primary site-header__cta">
              Anmelden
            </a>

            <button
              type="button"
              className={`site-header__burger ${menuOpen ? 'site-header__burger--open' : ''}`}
              aria-label={menuOpen ? 'Menü schliessen' : 'Menü öffnen'}
              aria-expanded={menuOpen}
              aria-controls="site-mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </>
        )}
      </div>

      {!minimal && (
        <nav
          id="site-mobile-nav"
          className={`site-header__nav--mobile ${menuOpen ? 'site-header__nav--mobile-open' : ''}`}
          aria-hidden={!menuOpen}
          onClick={handleNavClick}
        >
          {navLinks
            .filter((link) => link.href !== '#reservieren')
            .map((link) => (
              <a key={link.href} href={link.href} tabIndex={menuOpen ? 0 : -1}>
                {link.label}
              </a>
            ))}
          <a
            href="#reservieren"
            className="btn btn--primary site-header__mobile-cta"
            tabIndex={menuOpen ? 0 : -1}
          >
            Anmelden
          </a>
        </nav>
      )}
    </header>
  );
}

export default Header;
