# ============================================================================
# Osterweg Wyland - Docker-Image
# Multi-Stage-Build: 1) Frontend bauen  2) schlankes Laufzeit-Image
# Ein einziger Container liefert sowohl die Webseite als auch die Buchungs-API
# aus (Express liefert das fertige React-Build mit aus).
# ============================================================================

# ---- Stage 1: Frontend & Abhängigkeiten bauen ------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 wird als natives Modul kompiliert und braucht dafür
# Build-Werkzeuge (Python, make, g++).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Stage 2: Laufzeit-Image ----------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# better-sqlite3 muss als natives Modul kompiliert werden - dafür braucht es
# einmalig Build-Werkzeuge (Python, make, g++). Werden nach der Installation
# nicht mehr benötigt, bleiben aber im Image (schlank genug für dieses Projekt).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Nur Produktions-Abhängigkeiten installieren (baut better-sqlite3 passend
# zu diesem Image neu, daher wird hier kein node_modules kopiert).
COPY package*.json ./
RUN npm ci --omit=dev

# Fertiges Frontend-Build sowie Server-Code übernehmen.
COPY --from=build /app/dist ./dist
COPY server ./server

# Standard-Speicherort für die SQLite-Datenbank innerhalb des Containers.
# Über docker-compose wird hierauf ein Volume gemountet, damit Reservationen
# einen Container-Neustart überleben.
ENV DB_PATH=/app/server/data/data.db
RUN mkdir -p /app/server/data

EXPOSE 4001

CMD ["node", "server/index.js"]
