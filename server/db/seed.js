// ============================================================================
// CLI-Skript: initialisiert die Führungs-Zeitslots einmalig wie beim Serverstart.
// Ausführen mit: node server/db/seed.js
// Wiederholungen sind No-ops, auch nach Löschung aller Slots. Bestehende Daten
// werden als Baseline übernommen; fehlende/gelöschte Slots werden nicht ergänzt.
// ============================================================================
import 'dotenv/config';
import { initializeTours } from './seedLogic.js';

const created = initializeTours();
console.log(`Einmalige Initialisierung abgeschlossen: ${created} neue Führungs-Slots angelegt. Bestehende oder gelöschte Slots werden nicht ergänzt.`);
