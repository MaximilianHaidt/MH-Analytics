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

- Der öffentliche Bereich heißt `Datenquellen` und ist eine reine Quellen-/Data-Health-Ansicht.
- Die frühere öffentliche Provider-Konfiguration ist entfernt: keine editierbaren API-Key-Felder, keine Key-Speicherbuttons, keine Key-Testbuttons und keine Browser-Diagnose.
- Alte Browserdaten aus früheren API-Key-Versionen werden beim Start bereinigt; neue Provider-Keys werden nicht mehr im Frontend gespeichert.
- EIA wurde serverseitig angebunden.
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
- Aktuell normalisiert: BLS CPI, BLS Arbeitsmarkt, Treasury Daily Rates, World Bank GDP Growth und IMF Growth

ECB, SEC/EDGAR, OECD, Eurostat und OpenFIGI sind im Datenquellenbereich sauber eingeordnet. Sie sind aber nicht alle vollständig live verdrahtet.

## Öffentliche Datenquellen-Übersicht

Der Reiter `Datenquellen` zeigt für normale Nutzer:

- Provider-Name
- Kategorie
- Rolle
- Typ: serverseitig, serverseitig normalisiert, Open Data oder hybrid
- Status: Live, Fallback, teilweise oder nicht genutzt
- verwendete Module
- kurzer Transparenztext

Sichtbare Quellen:

1. Finnhub
2. Alpha Vantage
3. Frankfurter FX
4. FRED
5. ECB
6. BLS
7. U.S. Treasury Fiscal Data
8. SEC / EDGAR
9. EIA
10. CoinGecko
11. World Bank
12. IMF DataMapper
13. OECD Data Explorer
14. Eurostat
15. OpenFIGI

## Data Health / Quellenübersicht

Der Reiter `Data Health` ist die öffentliche Transparenzseite für Datenqualität und Quellenstatus. Er ersetzt keine interne Betreiber-Konfiguration und zeigt keine API-Key-Felder.

Data Health zeigt jetzt:

- Gesamtstatus der Datenlage
- Anzahl aktiver, live erfolgreicher, hybrider/fallback-gestützter und problematischer Quellen
- Modulstatus für Startseite, Tagesüberblick, Tages-Recap, Asset-Seiten, Events, Quick Compare, Watchlist, Alerts, Makro/Liquidität, ETF, Portfolio, Research und Datenquellen
- Provider-Karten mit Rolle, Quellentyp, Health, Frische, letzter erfolgreicher Aktualisierung und betroffenen Modulen
- klare Zuständigkeit je Quelle, z. B. FRED für US-Makro, Finnhub für Aktien/News/Earnings, EIA für Energie und Frankfurter für FX

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
- Events/Earnings: Finnhub und Alpha Vantage laufen über eigene `/api/...`-Routen; lokale Events bleiben Backup.
- ETF, Portfolio, Journal und Reports bleiben bewusst hybrid oder lokal, weil dort viel Produktlogik und Nutzereingabe enthalten ist.

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

## Roadmap, nicht als Versprechen

Spaetere Bloecke bleiben bewusst offen und wurden in dieser QA-Runde nicht neu gebaut:

- Journal / Psychologie / Fehleranalyse V2
- tiefere Live-Daten in Spezialbereichen
- ETF-Live-Holdings, falls eine geeignete Quelle gefunden wird
- Login / Cloud-Sync
- echte Push- oder E-Mail-Benachrichtigungen
- serverseitige Alert-Pruefung
- Community spaeter
- finale rechtliche Pruefung
- Datenqualitaet und Plausibilitaetspruefungen weiter vertiefen.

## Disclaimer

MH Analytics ist keine Anlageberatung. Daten, Scores, Top Picks, Ratings, Reports und Signale dienen nur zur Information und können simuliert, verzögert, unvollständig oder falsch sein.
