import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import Booking from './components/Booking';
import InfoSection from './components/InfoSection';
import Volunteer from './components/Volunteer';
import TeamContacts from './components/TeamContacts';
import Footer from './components/Footer';

// Der Admin-Bereich (inkl. Excel-Export-Bibliothek) wird erst geladen, wenn
// er tatsächlich besucht wird - normale Besucher:innen laden ihn nie mit.
const AdminApp = lazy(() => import('./pages/AdminApp'));

function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Booking />
        <InfoSection />
        <Volunteer />
        <TeamContacts />
      </main>
      <Footer />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
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
    </BrowserRouter>
  );
}

export default App;
