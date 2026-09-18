import { footerInfo, downloadSection } from '../data/content';
import './Footer.css';

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <img
          src="/downloads/weinland_mitte_zusatz_negativ_600dpi.png"
          alt={footerInfo.projectBy}
          className="site-footer__logo"
          width="200"
          height="55"
        />
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
        <p className="site-footer__copy">{footerInfo.copyright}</p>
      </div>
    </footer>
  );
}

export default Footer;
