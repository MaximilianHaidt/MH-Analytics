# MH Analytics

MH Analytics ist eine statische Premium-Finanzwebsite für Research, Live-Daten, Watchlist, Screener, Ratings, Alerts, ETF, Portfolio, Insider-/Institutionellen-Daten, Makro, Geldmengen, Reports und TradingView-Analyse.

Die Website bleibt bewusst einfach:

- kein Node.js
- kein npm
- kein Build-Prozess
- kein eigener Server
- lokal per Doppelklick nutzbar
- online als statische Website deploybar

## Schnellstart für Anfänger

1. Diesen Projektordner öffnen.
2. `index.html` doppelklicken.
3. Die Website startet direkt im Browser.

Die Seite funktioniert sofort mit lokalen Fallback-Daten. Für Live-Daten brauchst du Internet und optional API Keys im Bereich `API Keys`.

## Was in Phase 2E verbessert wurde

- API-Key Center mit Anfänger-Reihenfolge für die wichtigsten Provider
- sichtbarer Key-, Test- und Live-Zugriffsstatus pro Provider
- neues `Data Health` Dashboard für Provider, Module, Fehlerstatus, Fallback-Nutzung und letzte erfolgreiche Abrufe
- Finnhub, FRED, FMP, Alpha Vantage und CoinGecko klarer als priorisierte Datenquellen markiert
- Events/Earnings mit Finnhub- und FMP-Live-Pfaden vorbereitet und Fallback-Kalender stabil gehalten
- Asset-Seiten mit Datenlage-Leiste für Preis, Profil, Fundamentals, News und Events
- Screener als Hybrid-Modell: Live-Quote, falls vorhanden; lokaler Research-Score bleibt nutzbar
- README mit klarer Live/Fallback/Vorbereitet-Einordnung aktualisiert

## Welche API Keys zuerst sinnvoll sind

1. **Finnhub**: wichtigster Key für Aktienkurse, Profile, Company News, Basic Financials und vorbereiteten Earnings Calendar.
2. **FRED**: wichtigster Key für Makro-Daten wie Fed Funds, CPI, Arbeitslosenquote und 10Y Yield.
3. **Financial Modeling Prep**: sinnvoll für Profile, Fundamentaldaten und vorbereitete Earnings-Daten.
4. **Alpha Vantage**: optionaler Kurs-Fallback, wenn Finnhub nicht reicht.
5. **CoinGecko**: Krypto-Preise laufen als Public/Demo-Quelle; produktionsnah später besser mit Key oder Proxy.

## Die wichtigsten Dateien

- `index.html` enthält Grundgerüst, Navigation, Footer und bindet CSS/JS relativ ein.
- `styles.css` enthält Premium-Design, Dark/Light Mode, Mobile Layout und Print/Report Styles.
- `app.js` enthält die statische App-Logik: Routing, Provider Registry, API Layer, Fallback-Daten, Data Health, Screener, Ratings, Top Picks, Alerts, Asset-Seiten, ETF, Portfolio, Makro, Geldmengen, Insider, Reports und Personalisierung.
- `README.md` erklärt Projekt, Nutzung, Datenlogik und Deployment.
- `DEPLOYMENT.md` erklärt GitHub und Vercel Schritt für Schritt.
- `vercel.json` ist eine kleine optionale Vercel-Konfiguration für statisches Hosting.

## Aktiv genutzte Provider

Diese Provider werden in der App aktiv genutzt, sobald ein Key oder eine öffentliche Demo-Quelle verfügbar ist:

- Finnhub: Quotes, Profile, Company News, Basic Financials, Earnings Calendar vorbereitet/aktiv bei Key
- Finnhub News: Company News und News-Status in Asset-Seiten
- Alpha Vantage: optionaler Quote-Fallback
- Financial Modeling Prep: Profile, Fundamentals und Earnings Calendar vorbereitet/aktiv bei Key
- FRED: Makrodaten wie Fed Funds, CPI, Arbeitslosenquote und 10Y Yield
- CoinGecko: Public/Demo-Krypto-Preise für BTC, ETH und SOL

## Vorbereitete Provider

Diese Slots sind professionell vorbereitet, aber noch nicht vollständig live verdrahtet:

- Twelve Data
- EODHD
- ECB
- GNews
- CoinCap
- ExchangeRate-API
- Open Exchange Rates
- Metals-API
- Supabase

## Backend-only oder besser serverseitig

Diese Anbieter sollten für eine öffentliche Plattform später über Backend, Proxy oder Edge Functions laufen:

- NewsAPI
- Marketaux
- Reddit
- Brevo
- sensible Market-Data-Keys
- Supabase Service Role Keys

## Live, Fallback oder vorbereitet

- Start-Ticker: live mit Finnhub/Alpha Vantage/CoinGecko, sonst Fallback
- Asset-Kurse: live mit Finnhub/Alpha Vantage/CoinGecko, sonst Fallback
- Company News: live mit Finnhub, sonst Fallback
- Fundamentals: live mit FMP/Finnhub, sonst lokaler Fallback
- Makro: live mit FRED, sonst Fallback
- Geldmengen/Liquidität: vorbereitet mit FRED/ECB, aktuell überwiegend Fallback
- Events/Earnings: Finnhub/FMP live vorbereitet, EODHD vorbereitet, lokaler Kalender bleibt aktiv
- Screener: Hybrid aus Live-Quotes und lokalem Research-Universum
- ETF: lokale strukturierte Datenbasis
- Portfolio/Watchlist/Alerts: lokal im Browser gespeichert
- Reports: Browser-Print/PDF-Fallback ohne Backend

## Data Health

Der Bereich `Data Health` zeigt:

- aktive Provider
- vorbereitete Provider
- letzter erfolgreicher Abruf
- Fehlerstatus
- Fallback-Nutzung
- welche Module welchen Provider nutzen

So siehst du schneller, ob ein Key fehlt, ein Provider funktioniert oder ein Modul gerade bewusst mit Fallback-Daten arbeitet.

## API Keys und Sicherheit

API Keys werden in dieser statischen Version im Browser per localStorage gespeichert. Das ist für private lokale Tests praktisch.

Für eine echte öffentliche App sollten geheime Keys später geschützt werden:

- Backend-Proxy
- Edge Functions
- Supabase oder anderer Backend-Dienst
- Public/Private-Key-Trennung

## Deployment

Eine einfache Anleitung steht in `DEPLOYMENT.md`.

Kurzfassung:

1. Projektordner bei GitHub hochladen.
2. Vercel mit GitHub verbinden.
3. Repository importieren.
4. Framework: `Other`.
5. Build Command leer lassen.
6. Output Directory leer lassen.
7. Deploy klicken.

## Disclaimer

MH Analytics ist keine Anlageberatung. Daten, Scores, Top Picks, Ratings, Reports und Signale dienen nur zur Information und können simuliert, verzögert, unvollständig oder falsch sein.
