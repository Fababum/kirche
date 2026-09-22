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
        <nav className="site-footer__legal" aria-label="Rechtliches">
          <a href="/impressum">Impressum</a>
          <a href="/datenschutz">Datenschutz</a>
        </nav>
        <p className="site-footer__copy">{footerInfo.copyright}</p>
      </div>
    </footer>
  );
}

export default Footer;
