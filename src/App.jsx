import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import Booking from './components/Booking';
import FlyerBanner from './components/FlyerBanner';
import InfoSection from './components/InfoSection';
import Volunteer from './components/Volunteer';
import TeamContacts from './components/TeamContacts';
import Footer from './components/Footer';
import CookieConsent from './components/CookieConsent';
import SchoolClassContact from './components/SchoolClassContact';
import ConfirmBooking from './pages/ConfirmBooking';
import { registrationInfo } from './data/content';
import './pages/HomePage.css';

// Der Admin-Bereich (inkl. Excel-Export-Bibliothek) wird erst geladen, wenn
// er tatsächlich besucht wird - normale Besucher:innen laden ihn nie mit.
const AdminApp = lazy(() => import('./pages/AdminApp'));
const Impressum = lazy(() => import('./pages/Impressum'));
const Datenschutz = lazy(() => import('./pages/Datenschutz'));

function HomePage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    let cancelled = false;
    // Font metrics can shift sections after a direct anchor navigation.
    document.fonts.ready.then(() => {
      if (!cancelled) document.getElementById(hash.slice(1))?.scrollIntoView();
    });
    return () => { cancelled = true; };
  }, [hash]);

  return (
    <div className="home-page">
      <a className="home-page__skip" href="#informationen">Direkt zu den Informationen</a>
      <main id="top" className="home-page__main">
        <Hero>
          <InfoSection />
          <section id="reservieren" className="section reservation-intro">
            <div className="container">
              <div className="section-heading">
                <h2>Anmeldung / Reservation</h2>
              </div>
              <p>{registrationInfo.notice}</p>
              <p><SchoolClassContact /></p>
              <p>{registrationInfo.accessibility}</p>
              <p className="reservation-intro__deadline">{registrationInfo.deadline}</p>
              <a className="btn btn--primary" href="/reservation">Jetzt anmelden</a>
            </div>
          </section>
          <Volunteer />
          <FlyerBanner />
          <TeamContacts />
        </Hero>
      </main>
      <Footer />
    </div>
  );
}

function ReservationPage() {
  return (
    <div className="home-page reservation-page">
      <Header minimal />
      <main>
        <div className="container reservation-page__back">
          <a href="/#reservieren">Zurück zur Übersicht</a>
        </div>
        <Booking />
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

function AppRoutes() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/reservation" element={<ReservationPage />} />
        <Route path="/reservation/bestaetigen" element={<ConfirmBooking key={location.hash} />} />
        <Route
          path="/impressum"
          element={
            <Suspense fallback={<div className="admin-loading" />}>
              <Impressum />
            </Suspense>
          }
        />
        <Route
          path="/datenschutz"
          element={
            <Suspense fallback={<div className="admin-loading" />}>
              <Datenschutz />
            </Suspense>
          }
        />
        <Route
          path="/admin/*"
          element={
            <Suspense
              fallback={
                <div className="admin-loading">
                  <p>Lädt …</p>
                </div>
              }
            >
              <AdminApp />
            </Suspense>
          }
        />
      </Routes>
      {!isAdmin && location.pathname !== '/reservation/bestaetigen' && <CookieConsent />}
    </>
  );
}

export default App;
