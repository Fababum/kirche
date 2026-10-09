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

import { BOOKING_CUTOFF_HOURS, MIN_TOUR_PARTICIPANTS, MAX_TOUR_PARTICIPANTS } from '../../shared/event.js';

export const eventInfo = {
  title: "Osterweg Wyland",
  dateRange: "17.-28. März 2027",
  location: {
    name: "Reformierte Kirche",
    street: "Hauptstrasse",
    zipCity: "8467 Truttikon",
  },
  claim: "Ostern erleben mit allen Sinnen",
  introHeading: "Tauche ein in eine andere Zeit!",
  intro: "Ein Guide nimmt dich mit auf eine Zeitreise ins biblische Ostergeschehen vor 2000 Jahren. Erlebe, fühle und gehe den Weg aktiv mit und entdecke die Hoffnung, die darin steckt.",
  introInvite: "Komm vorbei: ob allein, mit der Familie, in der Gruppe oder mit der Schul- und Untiklasse.",
  introKafi: "Nach dem Rundgang: Zeit für ein Getränk und Begegnung im «Kafi i de Chile». Das Kafi ist während der Führungszeiten geöffnet.",
};

export const kafi = {
  name: "S'Kafi i de Chile",
  text: "Während der Führungszeiten geöffnet.",
};

export const registrationInfo = {
  heading: "Führungen und Anmeldung",
  subheading: "17. - 28. März 2027",
  notice: `Stündliche Gruppen-Führungen. Online-Anmeldung ist notwendig! Einzelpersonen und Gruppen sind willkommen. Eine Führung findet ab ${MIN_TOUR_PARTICIPANTS} Personen statt, mit maximal ${MAX_TOUR_PARTICIPANTS} Personen.`,
  groupsHint: "Ausserhalb der Öffnungszeiten: Gruppen meldet euch beim Sekretariat.",
  accessibility: "Der Rundgang ist barrierefrei.",
  deadline: `Anmeldeschluss ist ${BOOKING_CUTOFF_HOURS} Stunden vor Beginn der Führung.`,
  mobileHint: "Tag antippen, dann Führung auswählen.",
};

export const tourInfo = {
  heading: "Führungszeiten",
  description: "Stündliche Gruppen-Führungen, Dauer ca. 45 Minuten. Online-Anmeldung ist notwendig!",
  schedule: [
    { days: "Mi, 17. März", time: "Für Schulklassen reserviert / ausgebucht" },
    { days: "Do + So, 18./21. und 25./28. März", time: "14, 15, 16 und 17 Uhr" },
    { days: "Fr, 19. und 26. März", time: "14, 15, 16, 17 sowie 19 und 20 Uhr" },
    { days: "Sa, 20. und 27. März", time: "10, 11 sowie 14, 15, 16 und 17 Uhr" },
  ],
};

export const costsInfo = {
  heading: "Eintritt frei",
  text: "Kollekte zur Deckung der Unkosten.",
};

export const travelInfo = {
  heading: "Anreise & Parken",
  text: "Parkplätze vor Ort sind signalisiert (an der Langenmooserstrasse, siehe Karte).",
  publicTransport: "Postauto-Linie 621 ab Bahnhof Ossingen oder Bahnhof Marthalen, Haltestelle Truttikon.",
};

export const secretariat = {
  heading: "Kontakt",
  text: "Melde dich bei unserem Sekretariat.",
  name: "Sekretariat Rheinau",
  phone: "052 319 12 73",
  email: "sekretariat@kirche-wm.ch",
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
    key: "guide",
    title: "Guide",
    period: "Schulungen ab Januar 2027",
    description: "Magst du es, die Ostergeschichte freudig und mit Begeisterung anderen weiterzuerzählen? Dann bist du hier genau richtig! Ausgerüstet mit einem Tablet führst du die Besucher durch den Rundgang des Osterwegs. Mehr dazu erfährst du an einer kurzen Schulung ab Januar 2027. Probelauf für Guides: 13./14. März 2027.",
    contacts: [
      { name: "Thomas Guler", phone: "079 605 23 50", email: "thomas.guler@kirche-wm.ch" },
    ],
  },
  {
    key: "kafi-team",
    title: '«Kafi»-Team',
    period: "17.-28. März 2027",
    description: "Wir begrüssen unsere eintreffenden Gäste herzlich. Im Anschluss an die packende Zeitreise laden wir sie in unser gemütliches «Kafi» ein, wo Erfrischungen und feine Snacks auf sie warten. Möchtest du mit deiner gastfreundlichen Art Teil unseres Teams werden?",
    contacts: [
      { name: "Susan Renggli", phone: "079 511 31 03" },
    ],
  },
  {
    key: "gastgeber",
    title: "Gastgeber / Host",
    period: "17.-28. März 2027",
    description: "Nach jeder Führung machst du einen Rundgang durch die Räumlichkeiten und richtest alles wieder für die neue Gruppe her. Diese Aufgabe ist besonders wichtig!",
    contacts: [
      { name: "Thomas Guler", phone: "079 605 23 50", email: "thomas.guler@kirche-wm.ch" },
    ],
  },
  {
    key: "aufbau",
    title: "Aufbau + Dekoration",
    period: "8.-12. März 2027",
    description: "Wir suchen helfende Hände für die Montage und den Aufbau der Ausstellungsmodule und die Dekos.",
    contacts: [
      { name: "Anita Spengler und Beat Graf", phone: "079 850 67 68", email: "beat.graf@kirche-wm.ch" },
    ],
  },
  {
    key: "abbau",
    title: "Abbau",
    period: "29. März 2027 (Ostermontag)",
    description: "Nach dem Osterweg muss alles zurückgebaut und verstaut werden. Hier brauchen wir ein paar geschickte Hände, die bereit sind mitanzupacken!",
    contacts: [
      { name: "Anita Spengler und Beat Graf", phone: "079 850 67 68", email: "beat.graf@kirche-wm.ch" },
    ],
  },
  {
    key: "gebets-team",
    title: "Gebets-Team",
    period: "",
    description: "Wir bauen ein Gebetsteam auf, das das gesamte Projekt im Gebet mitträgt und dafür betet, dass alles reibungslos klappt und Menschen berührt werden. Möchtest du mitbeten? Egal ob regelmässig oder punktuell: Deine Unterstützung zählt! Melde dich, wenn du dabei sein möchtest. Das Gebetsteam trifft sich alle 14 Tage, dienstags jeweils um 19.00 Uhr in der Kirche Truttikon. Termine siehe auf der Homepage der ref. Kirche Weinland Mitte → Gemeindegebet.",
    contacts: [],
  },
];

export const downloadSection = {
  heading: "Werbematerial",
  title: "Flyer herunterladen",
  text: "Flyer, Plakat und Banner zum Weitergeben und Veröffentlichen.",
  linkHref: "/downloads/osterweg_wyland_flyer.zip",
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
  email: secretariat.email,
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
