# MH Analytics

MH Analytics ist eine statische Premium-Finanzwebsite für Research, Watchlist, Screener, Ratings, Alerts, ETF, Portfolio, Makro, Geldmengen, Reports und TradingView-Analyse.

Die Website bleibt bewusst einfach:

- kein Node.js für das Frontend
- kein npm
- kein Build-Prozess
- lokal per Doppelklick nutzbar
- online über Vercel deploybar

## Schnellstart für Anfänger

1. Diesen Projektordner öffnen.
2. `index.html` doppelklicken.
3. Die Website startet direkt im Browser.

Lokal nutzt MH Analytics Fallback-Daten, wenn serverseitige Live-Quellen nicht verfügbar sind. Das ist gewollt, damit die Seite auch ohne Deployment stabil bleibt.

## Was in dieser Datenarchitektur-Runde geändert wurde

- `Data Health`/`Datenquellen` stehen nicht mehr in der öffentlichen Hauptnavigation. Normale Nutzer sehen nur kurze Status-Badges direkt in den Modulen.
- Die frühere öffentliche Provider-Konfiguration ist entfernt: keine editierbaren API-Key-Felder, keine Key-Speicherbuttons, keine Key-Testbuttons und keine Browser-Diagnose.
- Alte Browserdaten aus früheren API-Key-Versionen werden beim Start bereinigt; neue Provider-Keys werden nicht mehr im Frontend gespeichert.
- EIA wurde serverseitig angebunden.
- CFTC Commitments of Traders wurde als Open-Data-Route fuer Rohstoff-Positionierung angebunden.
- FX/Währungen laufen serverseitig über Frankfurter.
- CoinGecko läuft als klarer Krypto-Datenpfad über eine eigene Vercel Function.
- BLS, Treasury, World Bank und IMF laufen über eine normalisierte Open-Data-Schicht.
- Das Frontend ruft für diese Daten nur noch eigene Routen auf:
  - `/api/fred`
  - `/api/finnhub`
  - `/api/alphavantage`
  - `/api/eia`
  - `/api/fx`
  - `/api/coingecko`
  - `/api/opendata`

## Environment Variables in Vercel

Diese Variablen sind für serverseitige Anbieter nötig:

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

Für die aktuelle FX-Quelle wird kein `FX_API_KEY` benötigt, weil Frankfurter ohne Key läuft. Falls später ein anderer FX-Anbieter gewählt wird, kann `FX_API_KEY` ergänzt werden.

## Serverseitige Provider

**FRED**

- Route: `/api/fred`
- Environment Variable: `FRED_API_KEY`
- Zuständig für: US-Makro, Geldmengen, Fed Funds, CPI, Arbeitslosenquote, Zinsserien und Spreads

**Finnhub**

- Route: `/api/finnhub`
- Environment Variable: `FINNHUB_API_KEY`
- Zuständig für: Aktien-Quotes, Unternehmensprofile, Company News, Basic Financials und Earnings

**Alpha Vantage**

- Route: `/api/alphavantage`
- Environment Variable: `ALPHA_VANTAGE_API_KEY`
- Zuständig für: FX-/Rohstoff-Zusatzdaten, Zeitreihen, technische Indikatoren, IPO- und Earnings-Zusatzdaten

**EIA**

- Route: `/api/eia`
- Environment Variable: `EIA_API_KEY`
- Zuständig für: Öl, Gas und Energie-/Rohstoffdaten

**Frankfurter FX**

- Route: `/api/fx`
- Kein API-Key nötig
- Zuständig für: Basis-FX-Kurse und einfache Währungsumrechnung

**CoinGecko**

- Route: `/api/coingecko`
- `COINGECKO_API_KEY` optional
- Zuständig für: BTC, ETH und SOL Preise, Market Cap und 24h-Bewegung

**Open-Data-Normalisierung**

- Route: `/api/opendata`
- Kein API-Key nötig
- Aktuell normalisiert: BLS CPI, BLS Arbeitsmarkt, Treasury Daily Rates, World Bank GDP Growth, IMF Growth, Eurostat HICP/Arbeitsmarkt, SEC Submissions vorbereitet und CFTC COT für Rohstoff-Positionierung

**CFTC Commitments of Traders**

- Route: `/api/opendata?source=cftc-cot`
- Kein API-Key nötig
- Zuständig für: Commercial-/Non-Commercial-Positionierung bei Gold, Silber, WTI-Öl, Natural Gas und Kupfer
- Wichtig: COT-Daten sind wöchentliche Kontextdaten, keine Kursprognose und keine Kauf-/Verkaufsempfehlung.

ECB, SEC/EDGAR, OECD, Eurostat und OpenFIGI sind intern in der Quellenlogik eingeordnet. Sie sind aber nicht alle vollständig live verdrahtet und werden nicht als öffentlicher Provider-Reiter geführt.

## Öffentliche Statushinweise

Die öffentliche Website zeigt keinen separaten Provider-, Data-Health- oder Datenquellen-Reiter. Stattdessen werden Statushinweise dort angezeigt, wo sie für Nutzer relevant sind:

- `Live`, `Hybrid`, `Fallback`, `Lokal`, `Offline` oder `Unbekannt` direkt in Modulen.
- kurze Datenstatus-Zeilen in Asset-Seiten, Makro, ETF, Portfolio und Reports.
- keine Provider-Konfiguration, keine Key-Felder, keine Browser-Diagnose und keine öffentlichen Testbuttons.

Eine tiefere Provider- und Betreiberkonfiguration bleibt Sache der Vercel-/Backend-Dokumentation.

Die verwendeten Statusbegriffe sind:

- `Live`: eine Quelle hat in dieser Sitzung erfolgreich geliefert oder frische Cache-Daten aus einem erfolgreichen Abruf geliefert.
- `Hybrid`: echte Daten und Fallback-/Produktlogik werden kombiniert.
- `Fallback`: strukturierte lokale Daten sichern das Modul ab, wenn kein Live-Abruf verfügbar ist.
- `Offline`: Quelle meldet Fehler, ist nicht konfiguriert oder bewusst nicht aktiv.
- `Unbekannt`: es gibt noch keinen belastbaren Laufzeitstatus.

Die Health-Einordnung ist bewusst nutzerfreundlich:

- `Gesund`: Datenlage wirkt belastbar.
- `Eingeschränkt`: Bereich ist nutzbar, aber teilweise Cache, Hybrid oder Zusatzquelle.
- `Degradiert`: Fallback steht im Vordergrund.
- `Gestört`: Fehler, fehlende Konfiguration oder offline.

Wichtig: Diese Werte sind Transparenz- und Vertrauensinformationen. Sie sind keine Garantie für Vollständigkeit, Echtzeit oder Fehlerfreiheit.

## Betreiber-Konfiguration

Normale Website-Besucher konfigurieren keine Provider. Betreiber tragen sensible Anbieter-Schlüssel ausschließlich in Vercel unter `Settings` -> `Environment Variables` ein. Nach Änderungen an diesen Variablen ist ein neues Deployment nötig.

Keys dürfen nicht in `app.js`, nicht in `index.html`, nicht in `localStorage` und nicht in öffentliche Formulare geschrieben werden.

## Live, Fallback oder hybrid

- Start-Ticker: bevorzugt Finnhub über `/api/finnhub`, danach Alpha Vantage über `/api/alphavantage`, Krypto über `/api/coingecko`, sonst Fallback.
- Asset-Seiten: Finnhub liefert Quotes, Profile, News, Basic Financials und Earnings, wenn die Vercel Function konfiguriert ist.
- Makro: FRED läuft über `/api/fred`; BLS, Treasury, World Bank und IMF laufen über `/api/opendata`; FX-Kernpaare laufen über `/api/fx`.
- Energie/Rohstoffe: Öl läuft bevorzugt über `/api/eia`, Gold/Silber/WTI-Zusatzdaten über `/api/alphavantage`, sonst Fallback.
- Rohstoff-Sentiment: CFTC COT läuft über `/api/opendata?source=cftc-cot`; bei Ausfall wird `Unavailable` angezeigt, kein lokaler Sentimentwert erfunden.
- Events/Earnings: Finnhub und Alpha Vantage laufen über eigene `/api/...`-Routen; lokale Events bleiben Backup.
- ETF, Portfolio, Journal und Reports bleiben bewusst hybrid oder lokal, weil dort viel Produktlogik und Nutzereingabe enthalten ist.

## Datenrealismus / Datenklassen

MH Analytics trennt Daten jetzt klarer:

- `Live`: echter aktueller API-Abruf ueber eine serverseitige Route.
- `Cached`: echter API-Abruf, aber aus lokalem Cache wiederverwendet.
- `Hybrid`: echte Daten und lokale Produktlogik werden kombiniert.
- `Local Structured`: lokal gepflegte strukturierte Daten, z. B. ETF-Holdings oder Asset-Baselines.
- `Demo`: reine Beispieldaten fuer Demo- oder Onboarding-Modus.
- `Modelled`: berechnete oder heuristische Einordnung, z. B. Scores, Ampeln oder Risiko-Logik.
- `Unavailable`: keine belastbaren Daten vorhanden.

Nur `Live` und `Cached` duerfen konkrete Abruf- oder Cache-Zeitpunkte zeigen. Lokale, Demo- und Modell-Daten zeigen keine aktuelle Fake-Frische. Das vollstaendige Modul-Audit steht in `DATA_AUDIT.md`.

Neue bzw. vorbereitete Open-Data-Pfade:

- `/api/opendata?source=eurostat-hicp`
- `/api/opendata?source=eurostat-unemployment`
- `/api/opendata?source=bundesbank-series&flow=...&key=...`
- `/api/opendata?source=sec-submissions&cik=...` nur mit serverseitigem `SEC_USER_AGENT`
- `/api/opendata?source=cftc-cot`

## Die wichtigsten Dateien

- `index.html` enthält Grundgerüst, Navigation, Footer und bindet CSS/JS relativ ein.
- `styles.css` enthält Premium-Design, Dark/Light Mode, Mobile Layout und Print/Report Styles.
- `app.js` enthält die statische App-Logik, Routing, Datenquellenstatus, API-Layer, Fallback-Daten und Module.
- `api/fred.js` ist die Vercel Function für FRED.
- `api/finnhub.js` ist die Vercel Function für Finnhub.
- `api/alphavantage.js` ist die Vercel Function für Alpha Vantage.
- `api/eia.js` ist die Vercel Function für EIA.
- `api/fx.js` ist die Vercel Function für Währungskurse über Frankfurter.
- `api/coingecko.js` ist die Vercel Function für Krypto-Preise.
- `api/opendata.js` normalisiert ausgewählte Open-Data-Quellen.
- `DEPLOYMENT.md` erklärt GitHub und Vercel Schritt für Schritt.

## Launch-Readiness / rechtliche Platzhalter

Die Website enthaelt einen oeffentlichen Bereich `Rechtliches` mit Platzhaltern fuer:

- Impressum
- Datenschutz
- Disclaimer

Diese Inhalte sind bewusst nicht final. Der Betreiber muss Name, Adresse, Kontakt, Unternehmensangaben und Datenschutzdetails vor Veroeffentlichung rechtlich pruefen und ausfuellen lassen. MH Analytics gibt keine Rechtsberatung.

## Login / Cloud-Sync Planung

Login und Cloud-Sync sind aktuell nicht implementiert und nicht in der oeffentlichen UI aktiviert. Die lokale Nutzung bleibt Standard.

Ein spaeterer Ausbau soll nur optional erfolgen und darf keine API-Keys, Betreiber-Secrets oder Provider-Konfiguration synchronisieren. Geplante Sync-Daten waeren Watchlist, Favoriten, Portfolios, Alerts, Journal, Preferences, Learning/XP und Report-Metadaten.

Der Architekturplan mit Auth-Optionen, Datenmodell, Sicherheitsregeln, Datenschutzpunkten, Migration lokaler Daten und spaeterem Alert-Server steht in `ROADMAP.md`.

## Community Planung

Community ist aktuell nicht implementiert und nicht in der oeffentlichen UI aktiviert. Es gibt keine Profile, Posts, Kommentare, Likes, Upvotes oder Community-Formulare.

Ein spaeterer Community-Ausbau muss zuerst Moderation, Meldesystem, Regeln, Datenschutz, Haftung, Missbrauchsschutz und klare Anti-Pump-and-Dump-Regeln loesen. Das Community-Konzept V1 steht in `ROADMAP.md`.

## Roadmap, nicht als Versprechen

Spaetere Bloecke bleiben bewusst offen und wurden in dieser QA-Runde nicht neu gebaut:

- Journal / Psychologie / Fehleranalyse V2
- tiefere Live-Daten in Spezialbereichen
- ETF-Live-Holdings, falls eine geeignete Quelle gefunden wird
- Login / Cloud-Sync nach dem Plan in `ROADMAP.md`
- echte Push- oder E-Mail-Benachrichtigungen
- serverseitige Alert-Pruefung
- Community spaeter nach dem Konzept in `ROADMAP.md`
- finale rechtliche Pruefung
- Datenqualitaet und Plausibilitaetspruefungen weiter vertiefen.

## Disclaimer

MH Analytics ist keine Anlageberatung. Daten, Scores, Top Picks, Ratings, Reports und Signale dienen nur zur Information und können simuliert, verzögert, unvollständig oder falsch sein.
