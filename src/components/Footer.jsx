import { footerInfo, downloadSection } from '../data/content';
import './Footer.css';

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <p className="site-footer__brand">{footerInfo.projectBy}</p>
        <p>
          {footerInfo.org} · {footerInfo.street}, {footerInfo.zipCity}
          <br />
          <a href={`tel:${footerInfo.phone.replace(/\s/g, '')}`}>{footerInfo.phone}</a>
        </p>
        <p className="site-footer__links">
          <a href={downloadSection.linkHref} download>
            {downloadSection.linkLabel}
          </a>
          {' · '}
          <a href="/admin">Admin</a>
        </p>
        <div className="site-footer__bottom">
          <div>
            <nav className="site-footer__legal" aria-label="Rechtliches">
              <a href="/impressum">Impressum</a>
              <a href="/datenschutz">Datenschutz</a>
            </nav>
            <p className="site-footer__copy">{footerInfo.copyright}</p>
          </div>
          <a className="site-footer__church" href="https://www.kirche-wm.ch/"
            target="_blank" rel="noopener noreferrer"
            aria-label="Offizielle Website der reformierten Kirche Weinland Mitte (neuer Tab)">
            <img src="/images/logo.png" alt="Reformierte Kirche Weinland Mitte"
              width="595" height="207" loading="lazy" />
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
