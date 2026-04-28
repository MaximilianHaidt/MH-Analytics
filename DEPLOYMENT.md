# MH Analytics online stellen

Diese Anleitung ist für Anfänger gedacht. MH Analytics bleibt eine statische Website: kein Node.js, kein npm, kein Build-Prozess und kein eigener Server.

## Lokal öffnen

1. Projektordner öffnen.
2. `index.html` doppelklicken.
3. Die Website startet im Browser.

Wenn Live-Daten nicht laden, ist das normal, solange keine API Keys eingetragen sind. Die App nutzt dann Fallback-Daten.

## Auf GitHub hochladen

1. Bei GitHub ein neues Repository erstellen.
2. Die Dateien aus diesem Ordner hochladen.
3. Wichtig sind mindestens:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
   - `DEPLOYMENT.md`
   - `vercel.json`
4. Achte darauf, dass die Dateinamen exakt gleich bleiben.

## Mit Vercel deployen

1. Bei Vercel anmelden.
2. `Add New Project` wählen.
3. Dein GitHub-Repository auswählen.
4. Einstellungen:
   - Framework Preset: `Other`
   - Build Command: leer lassen
   - Output Directory: leer lassen
5. `Deploy` klicken.

Vercel erkennt `index.html` als statische Startdatei.

## API Keys nach dem Deployment

API Keys werden aktuell lokal im Browser gespeichert.

Das bedeutet:

- Jeder Browser hat seine eigenen Keys.
- Keys werden nicht automatisch auf andere Geräte übertragen.
- Für private Nutzung ist das okay.
- Für eine öffentliche Plattform sollten sensible Keys später nicht im Browser liegen.

Später sinnvoll:

- Backend-Proxy
- Edge Functions
- Supabase für User-Daten
- getrennte Public-/Private-Key-Strategie

## Wenn etwas nicht lädt

Prüfe zuerst:

1. Sind `index.html`, `styles.css` und `app.js` im selben Ordner?
2. Wurde `app.js` wirklich hochgeladen?
3. Blockiert ein Browser-Plugin externe Widgets wie TradingView?
4. Sind API Keys korrekt eingetragen?
5. Zeigt die App einen Fallback-Status an?

Fallback-Daten sind kein Fehler. Sie sind eingebaut, damit MH Analytics stabil bleibt, auch wenn ein Anbieter gerade nicht erreichbar ist.
