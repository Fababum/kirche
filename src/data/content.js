// ============================================================================
// Zentrale Inhalts-Datei für die Osterweg-Wyland Webseite
// ----------------------------------------------------------------------------
// Hier stehen ALLE Texte, Kontaktdaten und Infos, die auf der Webseite
// angezeigt werden. Wer Texte, Telefonnummern, E-Mails etc. ändern möchte,
// kann das direkt in dieser Datei tun, ohne den restlichen Code anzufassen.
//
// Hinweis zur Zielgruppe: Die Texte sind bewusst KURZ und EINFACH gehalten
// (viele Besucher:innen sind 60-80 Jahre alt). Bitte beim Anpassen kurze
// Sätze beibehalten statt lange Absätze.
//
// Wichtig: Textstellen mit "[TODO: ...]" sind Platzhalter für Angaben, die im
// Original-Text unvollständig oder unklar waren. Bitte ersetzen, sobald die
// korrekten Angaben feststehen.
// ============================================================================

export const eventInfo = {
  title: "Osterweg Wyland",
  dateRange: "17.-28. März 2027",
  location: {
    name: "Reformierte Kirche",
    street: "Hauptstrasse",
    zipCity: "8467 Truttikon",
  },
  claim: "Ostern erleben mit allen Sinnen",
  intro: "Ein Guide führt dich durch das Ostergeschehen. Für alle: allein, mit Familie, in der Gruppe.",
};

export const kafi = {
  name: "S'Kafi i de Chile",
  hours: [
    { days: "Mi - Fr", time: "14-18 Uhr" },
    { days: "Sa + So", time: "12-18 Uhr" },
  ],
};

export const registrationInfo = {
  heading: "Rundgang reservieren",
  subheading: "13. - 28. März 2027",
  notice: "Anmeldung nötig. Ab 5 Personen, max. 15 Personen pro Gruppe.",
  schoolClasses: "Schulklassen: bitte bei Susanne Egloff anmelden.",
  accessibility: "Der Rundgang ist barrierefrei.",
  deadline: "Anmeldung bis 48 Stunden vorher möglich.",
  mobileHint: "Tag antippen, dann Führung auswählen.",
};

export const tourInfo = {
  heading: "Führungszeiten",
  description: "Dauer: ca. 45 Minuten.",
  schedule: [
    { days: "Di - Do", time: "10-11 + 14-19 Uhr" },
    { days: "Fr + Sa", time: "10-11 + 14-21 Uhr" },
    { days: "So", time: "12-19 Uhr" },
  ],
};

export const costsInfo = {
  heading: "Kosten",
  text: "Eintritt frei. Spenden willkommen.",
};

export const travelInfo = {
  heading: "Anreise & Parken",
  text: "Parkplätze bei der Kirche vorhanden. Postauto ab Ossingen oder Marthalen.",
  publicTransport: "Postauto-Linie 621 ab Bahnhof Ossingen oder Bahnhof Marthalen, Haltestelle Truttikon.",
};

export const secretariat = {
  heading: "Kontakt",
  text: "Melde dich bei unserem Sekretariat.",
  name: "Susanne Egloff",
  phone: "052 319 12 73",
  email: "susanne.egloff@kirche-wm.ch",
  address: {
    org: "Evangelisch-reformierte Kirchgemeinde Weinland Mitte",
    line1: "Sekretariat Rheinau",
    street: "Poststrasse 6",
    zipCity: "8462 Rheinau",
  },
};

// Bereiche, in denen man sich als Helfer/in engagieren kann.
export const volunteerAreas = [
  {
    key: "crea-team",
    title: "Crea-Team",
    period: "ab sofort",
    description: "Nähen, Basteln, Malen - hilf mit beim Vorbereiten.",
    contact: {
      name: "Anita und Beat",
      phone: "078 778 12 88",
      email: "anita@kirche-wm.ch",
    },
  },
  {
    key: "guide",
    title: "Guide",
    period: "Schulung ab Januar 2027",
    description: "Führe Besucher durch den Osterweg. Schulung inklusive.",
    contact: {
      name: "Thomas Guler",
      phone: "079 605 23 50",
      email: "thomas.guler@kirche-wm.ch",
    },
  },
  {
    key: "aufbau",
    title: "Aufbau",
    period: "12.-17. März 2027",
    description: "Hilf mit beim Aufbauen der Stationen.",
    contact: {
      name: "Beat Graf",
      phone: "079 850 67 68",
      email: "beat.graf@kirche-wm.ch",
    },
  },
  {
    key: "kafi-team",
    title: '"Kafi"-Team',
    period: "12.-17. März 2027",
    description: "Empfange Gäste im Kafi mit Getränk und Gespräch.",
    contact: {
      name: "Violett",
      phone: "Telefonnummer folgt",
      email: "", // Vollständige E-Mail-Adresse noch nicht bekannt
    },
  },
  {
    key: "gastgeber",
    title: "Gastgeber / Host",
    period: "12.-17. März 2027",
    description: "Richte die Räume nach jeder Führung wieder her.",
    contact: {
      name: "Thomas Guler",
      phone: "079 605 23 50",
      email: "thomas.guler@kirche-wm.ch",
    },
  },
  {
    key: "abbau",
    title: "Abbau",
    period: "12.-17. März 2027",
    description: "Hilf mit beim Zurückbauen und Einlagern.",
    contact: {
      name: "Beat Graf",
      phone: "079 850 67 68",
      email: "beat.graf@kirche-wm.ch",
    },
  },
];

export const downloadSection = {
  heading: "Werbematerial",
  title: "Flyer herunterladen",
  text: "Flyer, Plakat und Banner zum Weitergeben und Aufhängen.",
  linkHref: "/downloads/osterweg-wyland-flyer.zip",
  linkLabel: "Flyer herunterladen",
};

// Team- und Kontaktliste für den Bereich "Team & Kontakte"
export const teamContacts = [
  {
    name: "Pfarrer Matthias Bordt",
    email: "matthias.bordt@kirche-wm.ch",
    phone: "079 887 12 37",
  },
  {
    name: "Beat Graf",
    email: "beat.graf@kirche-wm.ch",
    phone: "079 850 67 68",
  },
  {
    name: "Thomas Guler",
    email: "thomas.guler@kirche-wm.ch",
    phone: "079 605 23 50",
  },
  {
    name: "Christine Keller",
    email: "christine.keller@kirche-wm.ch",
    phone: "Telefonnummer folgt",
  },
  {
    name: "Matthias König",
    email: "matthias.koenig@kirche-wm.ch",
    phone: "079 615 99 38",
  },
  {
    name: "Julia Spiri",
    email: "julia.spiri@kirche-wm.ch",
    phone: "078 778 12 77",
  },
  {
    name: "Susanne Wepfer",
    email: "susanne.wepfer@kirche-wm.ch",
    phone: "078 827 67 96",
  },
];

export const footerInfo = {
  org: "Evangelisch-reformierte Kirchgemeinde",
  secretariat: "Sekretariat Rheinau",
  street: "Poststrasse 6",
  zipCity: "8462 Rheinau",
  phone: "052 319 12 73",
  email: "susanne.egloff@kirche-wm.ch",
  projectBy: "Evangelisch-reformierte Kirchgemeinde Weinland Mitte",
  copyright: `© ${new Date().getFullYear()} Fabian Spiri`,
};

// Navigationspunkte für die Kopfzeile (Anchor-Links zu den Sections)
export const navLinks = [
  { href: "#reservieren", label: "Anmelden" },
  { href: "#informationen", label: "Infos" },
  { href: "#mitarbeiten", label: "Mitmachen" },
  { href: "#team", label: "Kontakt" },
];
