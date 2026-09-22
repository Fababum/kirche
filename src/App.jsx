import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import SectionWave from './components/SectionWave';
import Booking from './components/Booking';
import FlyerBanner from './components/FlyerBanner';
import InfoSection from './components/InfoSection';
import QuoteBanner from './components/QuoteBanner';
import Volunteer from './components/Volunteer';
import TeamContacts from './components/TeamContacts';
import Footer from './components/Footer';
import CookieConsent from './components/CookieConsent';

// Der Admin-Bereich (inkl. Excel-Export-Bibliothek) wird erst geladen, wenn
// er tatsächlich besucht wird - normale Besucher:innen laden ihn nie mit.
const AdminApp = lazy(() => import('./pages/AdminApp'));
const Impressum = lazy(() => import('./pages/Impressum'));
const Datenschutz = lazy(() => import('./pages/Datenschutz'));

function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <SectionWave fill="#fbe0c2" />
        <Booking />
        <FlyerBanner />
        <InfoSection />
        <QuoteBanner />
        <Volunteer />
        <SectionWave fill="#faf7f2" />
        <TeamContacts />
      </main>
      <Footer />
    </>
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
      {!isAdmin && <CookieConsent />}
    </>
  );
}

export default App;
