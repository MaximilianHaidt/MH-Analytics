# MH Analytics Daten-Audit V1

Dieses Dokument ist interne Transparenz fuer Entwickler und Betreiber. Es ist kein oeffentlicher Hauptreiter in der App und keine Betreiber-Konfiguration.

## Datenklassen

- `Live`: echter aktueller API-Abruf ueber eine serverseitige Route.
- `Cached`: echter API-Abruf, aber aus lokalem Cache wiederverwendet.
- `Hybrid`: echte Daten plus lokale Produktlogik, Heuristik oder strukturierte Ersatzdaten.
- `Local Structured`: lokal gepflegte strukturierte Daten, z. B. ETF-Holdings, Asset-Universum oder Termin-Fallbacks.
- `Demo`: reine Beispieldaten fuer Demo- oder Onboarding-Modus.
- `Modelled`: berechnete oder heuristische Einordnung, z. B. Ratings, Risikoampeln, Scores.
- `Unavailable`: keine belastbaren Daten vorhanden oder Quelle nicht produktiv nutzbar.

Wichtig: Nur `Live` und `Cached` duerfen konkrete Abruf- oder Cache-Zeitpunkte zeigen. `Hybrid`, `Local Structured`, `Demo`, `Modelled` und `Unavailable` zeigen keine aktuelle Fake-Frische.

## Modul-Audit

| Modul | Live | Cached | Hybrid | Local Structured | Demo | Modelled | Unavailable / offen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Startseite | Quotes, Krypto, Makro und Events soweit serverseitig verfuegbar | API-Cache fuer dieselben Quellen | Heute-wichtig, Recap-Priorisierung, Shortcuts | Guided Start, lokale Aktivitaeten | Demo-Setup | Setup-Fortschritt, XP | keine Garantie fuer vollstaendige Live-Abdeckung |
| Aktie | Finnhub/Alpha/CoinGecko/EIA je Asset-Typ, CFTC COT fuer Gold/Silber/Oel-Kontext | Cache je Route | 5-Minuten-Research aus Daten + Produktlogik | Asset-Universum, lokale Fallback-KPIs | nein | Rating, Chancen/Risiken, Technik/Research-Snapshot, COT-Ampel | unbekannte Assets koennen eingeschraenkt bleiben |
| Screener | Quotes/Profile/Fundamentals/Zeitreihen begrenzt | API-Cache | Dateninputs + lokale Scores | Asset-Universum und Filterlisten | nein | Momentum/Value/Growth/Quality/Risk/Top-Picks | fehlende Fundamentals werden nicht fake-bewertet |
| Compare | Asset- und ETF-Daten soweit vorhanden | API-Cache | Vergleichslogik + echte Inputs | lokale ETF-Struktur | nein | Staerken/Schwaechen-Einordnung | Datenluecken je Asset sichtbar |
| Makro | FRED, BLS, Treasury, World Bank, IMF, FX, Eurostat, CFTC COT | API-Cache | Laendervergleich + lokale Basiswerte + COT-Kontext | Laender-Baselines, China/Euro-Kontext | nein | Makroampel, Risiko, Asset-Implikationen, Rohstoff-Sentiment-Ampel | China und manche Euro-/Zinsdaten bleiben teilweise eingeschraenkt |
| Liquiditaet | FRED/Treasury/FX/CFTC soweit verfuegbar | API-Cache | echte Reihen + lokale Liquiditaetslogik + COT-Kontext | lokale M1/M3/M4/Global-Basis | nein | Liquiditaetsampel, COT-Einordnung | ECB/Bundesbank tiefer noch offen |
| ETF | Kurse nur falls ETF als Asset live versorgt ist | Quote-Cache | Kurse + lokale ETF-Struktur | TER, Holdings, Regionen, Sektoren, Ausschuetttung | Demo-Vergleich moeglich | Kostenrechnung, Overlap, Portfolio-Fit | keine Live-Holdings-Quelle aktiv |
| Events | Finnhub/Alpha Kalender soweit verfuegbar | API-Cache | Live-Events + lokale Termine/Relevanz | Dividenden, Makrotermine, Fallback-Events | Demo-Alerts | Relevanz/Watchlist-Priorisierung | Corporate Actions nicht vollstaendig |
| News / Sentiment | Finnhub Company News, Alpha Vantage NEWS_SENTIMENT soweit serverseitig verfuegbar | API-Cache fuer Newsfeeds | Marktnews + Company News + Watchlist/Event-Kontext | lokale News-Strukturdaten | Demo nur im Demo-Setup | einfache positiv/neutral/negativ/gemischt/unbekannt-Heuristik | keine echte KI-Stimmungsanalyse, keine Social-Scraping-Quelle |
| Research / Reports | uebernommene Live/Cached Inputs aus Modulen inkl. CFTC COT | uebernommene Cache-Inputs | Report-Synthese aus mehreren Modulen | Print-Layout, Reportstruktur | nein | Executive Summaries, Risiken/Trigger, COT-Kontext | kein Server-PDF, keine Garantie auf Vollstaendigkeit |
| Watchlist | Quotes/Events soweit verfuegbar | API-Cache | Watchlist-Kontext + Live Inputs | Watchlist lokal im Browser | Demo-Watchlist | Relevanzhinweise | keine Cloud-Synchronisation |
| Alerts | Preis/Event-Kontext soweit Daten geladen | indirekt ueber Quote/Event-Cache | lokale Regeln + Dateninputs | Alert-Regeln lokal | Demo-Alerts | Trigger-/Prioritaetslogik | keine serverseitige Dauerpruefung |
| Journal | nein | nein | nein | Nutzer-Eintraege lokal | Demo-Eintrag | Bias-/Disziplin-Auswertung | kein therapeutisches oder objektives Messsystem |
| Portfolio | Kurse/Events soweit verfuegbar | API-Cache | lokale Positionen + Marktdaten | Positionen, Cash, Notizen lokal | Demo-Portfolio | Health, Risiko, Exposure, What-if | keine Broker-Anbindung |
| Help Assistant / Learning | nein | nein | nein | FAQ, Glossar, Command-Katalog lokal | Quiz-/XP-Demo moeglich | Regelbasierte Antworten, kein KI-System | keine Finanzberatung, keine KI-API |

## Gepruefte Open-Data-Quellen

### Eurostat

- Offizielle EU-API fuer Statistikdaten, JSON-stat/SDMX, kostenloser programmatischer Zugriff.
- Sinnvoll fuer: Eurozone/Deutschland Inflation, Arbeitsmarkt, BIP, Laenderprofile.
- Status in MH Analytics: angebunden ueber `/api/opendata?source=eurostat-hicp` und `/api/opendata?source=eurostat-unemployment`.
- Nutzung: Makro V2 ersetzt Eurozone/Deutschland-Inflation und Arbeitsmarkt, wenn der Abruf klappt.
- Referenz: https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-introduction

### Deutsche Bundesbank SDMX

- Offizielle REST-API fuer Zeitreihen, HTTPS, SDMX-CSV/JSON/XML.
- Sinnvoll fuer: deutsche/europaeische Zeitreihen, Zinsen, Wechselkurse, Geldmengen.
- Status in MH Analytics: generischer Test-/Vorbereitungsendpunkt `/api/opendata?source=bundesbank-series&flow=...&key=...`.
- Noch nicht tief integriert, weil konkrete Series-Keys pro Modul sauber validiert werden muessen.
- Referenz: https://www.bundesbank.de/en/statistics/time-series-databases/help-for-sdmx-web-service

### Destatis GENESIS

- Offizielle GENESIS-Online Schnittstelle, Datenlizenz Deutschland Namensnennung 2.0, REST/JSON.
- Seit 2025 sind POST-Methoden der REST/JSON-Schnittstelle relevant.
- Status in MH Analytics: geprueft, nicht integriert. Grund: Tabellen-/Methodenwahl und POST-Umstellung sollen separat sauber umgesetzt werden.
- Referenz: https://www.destatis.de/EN/Service/OpenData/api-webservice.html

### SEC EDGAR

- Offizielle SEC APIs fuer Submissions und XBRL, keine API-Keys, CORS nicht fuer direkte Browsernutzung.
- Status in MH Analytics: sicher vorbereitet ueber `/api/opendata?source=sec-submissions&cik=...`.
- Der Endpunkt ruft nur ab, wenn `SEC_USER_AGENT` serverseitig gesetzt ist; sonst liefert er bewusst einen Fehler statt unklaren Zugriff zu versuchen.
- Nutzung im Frontend: noch nicht tief integriert; Asset-Seiten behalten weiter nur den offiziellen EDGAR-Link.
- Referenz: https://www.sec.gov/edgar/sec-api-documentation

### CFTC COT

- Offizielle COT-Berichte und historische Dateien, woechentliche/jaehrliche Daten.
- Status in MH Analytics: V1 integriert ueber `/api/opendata?source=cftc-cot`.
- Nutzung: Gold, Silber, WTI-Oel, Natural Gas und Kupfer werden aus dem aktuellen Legacy Futures-Only COT-File gemappt. Angezeigt werden Commercials, Non-Commercials, Netto-Positionierung, Wochenveraenderung soweit im File vorhanden, Datenstand und eine einfache Kontextampel.
- Wichtig: Die Ampel ist `Modelled`/Kontextlogik auf Basis echter COT-Daten. Sie ist keine Prognose und keine Anlageberatung. Wenn CFTC nicht erreichbar ist, wird `Unavailable` gezeigt und kein lokaler Sentimentwert erfunden.
- Referenzen: https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm und https://www.cftc.gov/dea/newcot/deafut.txt

### ECB Data Portal

- Offizielle SDMX-Webservices der ECB.
- Status in MH Analytics: eingeordnet, aber in dieser Runde nicht zusaetzlich integriert, weil Eurostat zuerst die konkreten Eurozone/Deutschland-Luecken reduziert.
- Referenz: https://data.ecb.europa.eu/help/api/overview

## Fake-Live-Schutz

- `makeMeta()` normalisiert alte Statuswerte auf die neuen Datenklassen.
- Nur `Live` und `Cached` behalten einen Timestamp.
- Lokale, Demo- und Modell-Daten zeigen Text wie `Stand: lokale Datenbasis`, `Demo-Daten`, `modellierte Einordnung` oder `kein belastbarer Live-Abruf`.
- `cachedJson()` und `cachedText()` markieren Cache jetzt als `Cached`, nicht mehr als `Live`.
- Reports nutzen dieselben Metadaten und zeigen keine aktuelle Uhrzeit fuer lokale Heuristiken.

## Nicht oeffentlich

`Data Health` und `Datenquellen` bleiben aus der oeffentlichen Hauptnavigation entfernt. Dieses Audit ist Dokumentation, keine normale Nutzerseite und keine Betreiber-Konfiguration.
