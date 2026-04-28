# MH Analytics

MH Analytics ist eine statische Premium-Finanzwebsite fuer Research, Watchlist, Screener, Ratings, Alerts, ETF, Portfolio, Insider-/Institutionellen-Daten, Makro, Reports und TradingView-Analyse.

Die Website bleibt bewusst einfach startbar:

- kein Node.js
- kein npm
- kein Build-Prozess
- kein eigener Server
- lokal per Doppelklick nutzbar
- online als statische Website deploybar

## Schnellstart fuer Anfaenger

1. Diesen Projektordner oeffnen.
2. `index.html` doppelklicken.
3. Die Website startet direkt im Browser.

Die Seite funktioniert sofort mit lokalen Fallback-Daten. Fuer Live-Daten brauchst du Internet und optional API Keys im Bereich `API Keys`.

## Die vier Hauptdateien

Diese vier Dateien sind die Source of Truth der App:

- `index.html` enthaelt Grundgeruest, Navigation, Footer und bindet CSS/JS relativ ein.
- `styles.css` enthaelt das Premium-Design, Dark/Light Mode, Mobile Layout und Print/Report Styles.
- `app.js` enthaelt die statische App-Logik: Routing, Provider Registry, API Layer, Fallback-Daten, Screener, Ratings, Top Picks, Alerts, Asset-Seiten, ETF, Portfolio, Makro, Insider, Reports und Personalisierung.
- `README.md` erklaert Projekt, Nutzung, Datenlogik und Deployment.

Zusaetzliche Dateien wie `DEPLOYMENT.md`, `.gitignore` oder `vercel.json` sind nur Projekt- und Deployment-Hilfen. Die eigentliche Website bleibt in den vier Hauptdateien.

## Projektstruktur

```text
mh-analytics/
  index.html       # Startdatei der Website
  styles.css       # Designsystem und responsive Oberflaeche
  app.js           # komplette statische App-Logik
  README.md        # diese Hauptanleitung
  DEPLOYMENT.md    # einfache GitHub- und Vercel-Anleitung
  vercel.json      # optionale Vercel-Konfiguration fuer statisches Hosting
  .gitignore       # lokale System-/Editor-Dateien aus Git heraushalten
```

## Warum app.js aktuell nicht aufgeteilt wurde

`app.js` ist gross, aber die Module teilen sich gemeinsamen State, gemeinsame Fallback-Daten und gemeinsame Hilfsfunktionen. Ein radikales Aufteilen ohne Build-System waere aktuell ein groesseres Risiko als ein Nutzen.

Deshalb bleibt Phase 2C konservativ:

- bestehende Features bleiben erhalten
- keine neue Toolchain
- keine neue Abhaengigkeit
- interne Modul-Grenzen sind im Kopf von `app.js` dokumentiert
- spaeteres Aufteilen ist vorbereitet, aber nicht erzwungen

## Wichtige Funktionen

- Premium-Design in Schwarz, Anthrazit, Off-White und Gold
- Dark/Light Mode
- responsive Mobile-first Darstellung
- globale Suche mit Asset-Auswahl
- Asset-Seiten mit TradingView-Integration und Fallback-Link
- Screener mit lokalen Fallback-Daten
- Technical Rating Engine
- Top Picks auf Basis transparenter Heuristiken
- lokale Alerts mit localStorage
- Provider Registry / API-Key Center
- Makro-Dashboard mit FRED-Anbindung und Fallbacks
- ETF-Modul mit Kostenrechner und Overlap Checker
- Portfolio-System mit mehreren lokalen Portfolios
- Insider- und Institutionellen-Tab auf Asset-Seiten
- Report-/Print-Export fuer Browser-PDF
- Personalisierung mit Dashboard-Modi, Favoriten und zuletzt gesehenen Assets

## Daten und API Keys

MH Analytics nutzt eine Provider Registry. Jeder Provider ist markiert als:

- aktiv genutzt
- vorbereitet
- optional
- besser spaeter serverseitig

Aktiv oder vorbereitet sind unter anderem:

- Finnhub
- Alpha Vantage
- Twelve Data
- Financial Modeling Prep
- EODHD
- FRED
- ECB
- NewsAPI
- GNews
- CoinGecko
- CoinCap
- ExchangeRate-API
- Open Exchange Rates
- Reddit
- Brevo
- Supabase
- Metals-API
- Marketaux

API Keys werden in dieser statischen Version im Browser per localStorage gespeichert. Das ist fuer private lokale Tests praktisch. Fuer eine echte oeffentliche App sollten geheime Keys spaeter ueber ein Backend, einen Proxy oder Edge Functions geschuetzt werden.

## Fallback-Daten

Wenn kein Key vorhanden ist, ein Anbieter blockiert, CORS greift oder ein Rate Limit erreicht wird, bleibt die Seite nutzbar. Dann werden strukturierte lokale Fallback-Daten angezeigt.

Jede wichtige Datenkarte zeigt:

- Quelle
- Timestamp
- Status: live, fallback oder veraltet

Fallback-basiert sind aktuell vor allem:

- Insider Trades
- Institutionelle Holdings
- ETF-Daten
- Portfolio-Exposure
- Teile des Makro-Ausbaus wie DXY, ECB, M1/M3/M4, Realzins und Yield Curve
- Social/Sentiment
- Reports

## Deployment

Eine einfache Schritt-fuer-Schritt-Anleitung fuer GitHub und Vercel steht in `DEPLOYMENT.md`.

Kurzfassung:

1. Projektordner bei GitHub hochladen.
2. Vercel mit GitHub verbinden.
3. Repository importieren.
4. Build Command leer lassen.
5. Output Directory leer lassen.
6. Deploy klicken.

## Was spaeter sinnvoll waere

- `app.js` schrittweise in kleinere statische JS-Dateien aufteilen
- API Keys ueber Backend/Proxy schuetzen
- echte Live-Provider fuer ETF, Insider, Institutionelle und Events anbinden
- Supabase oder ein anderes Backend fuer Login, Cloud-Sync und User-Daten nutzen
- Tests und Monitoring erst einfuehren, wenn die statische Basis stabil online steht

## Disclaimer

MH Analytics ist keine Anlageberatung. Daten, Scores, Top Picks, Ratings, Reports und Signale dienen nur zur Information und koennen simuliert, verzoegert, unvollstaendig oder falsch sein.
