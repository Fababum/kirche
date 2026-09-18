// ============================================================================
// CLI-Skript: legt die Führungs-Zeitslots für den gesamten Zeitraum an.
// Ausführen mit: node server/db/seed.js
// (Wird beim Docker-Start auch automatisch aufgerufen, siehe server/index.js)
// ============================================================================
import { seedTours } from './seedLogic.js';

const created = seedTours();
console.log(`Seed abgeschlossen: ${created} neue Führungs-Slots angelegt.`);
