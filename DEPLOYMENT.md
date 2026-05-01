# MH Analytics online stellen

Diese Anleitung ist für Anfänger gedacht. MH Analytics bleibt im Frontend statisch: kein Build-Prozess, kein npm und kein eigener dauerlaufender Server.

Die Online-Version nutzt Vercel Functions im Ordner `api`, damit geheime API-Keys nicht im Browser liegen.

## Lokal öffnen

1. Projektordner öffnen.
2. `index.html` doppelklicken.
3. Die Website startet im Browser.

Lokal per Doppelklick laufen die Vercel Functions nicht. Deshalb nutzt die Website dort für serverseitige Quellen automatisch Fallback-Daten.

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
   - Ordner `api`
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

Vercel erkennt `index.html` als statische Startdatei und den Ordner `api` als serverseitige Functions.

## Environment Variables in Vercel eintragen

In Vercel:

1. Projekt öffnen.
2. `Settings` öffnen.
3. `Environment Variables` öffnen.
4. Diese Variablen exakt anlegen:

```text
FRED_API_KEY
FINNHUB_API_KEY
ALPHA_VANTAGE_API_KEY
EIA_API_KEY
```

Optional:

```text
COINGECKO_API_KEY
```

Für Frankfurter FX wird aktuell kein `FX_API_KEY` benötigt.

5. Als Wert jeweils deinen API-Key eintragen.
6. Speichern.
7. Danach neu deployen.

Wichtig: Die Keys werden nicht in der Website-Oberfläche eingegeben. Normale Nutzer sehen nur den Reiter `Datenquellen` mit Statusinformationen.

## Serverseitige Routen testen

Nach dem Deployment kannst du diese Routen direkt im Browser öffnen:

```text
/api/fred?action=test
/api/finnhub?endpoint=quote&symbol=AAPL
/api/alphavantage?endpoint=quote&symbol=AAPL
/api/eia?dataset=oil
/api/fx?base=USD&quotes=EUR,JPY,GBP
/api/coingecko?ids=bitcoin,ethereum&vs_currencies=usd
/api/opendata?source=bls-cpi
/api/opendata?source=treasury-rates
/api/opendata?source=worldbank-growth
/api/opendata?source=imf-growth
```

Wenn eine Environment Variable fehlt, antwortet die jeweilige Function mit einem strukturierten Fehler wie `missing_env`.

## Wenn Live-Daten nicht laden

Prüfe zuerst:

1. Wurde der Ordner `api` hochgeladen?
2. Sind die Environment Variables exakt so benannt?
3. Wurde nach dem Speichern der Variablen neu deployed?
4. Öffnest du die Vercel-URL und nicht nur die lokale `index.html`?
5. Zeigt die App einen Fallback-Status an?

Fallback-Daten sind kein Fehler. Sie sind eingebaut, damit MH Analytics stabil bleibt, auch wenn ein Anbieter gerade nicht erreichbar ist oder eine Environment Variable fehlt.
