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

## Was in dieser API-Runde bereinigt wurde

- Die aktive Provider-Seite zeigt nur noch den öffentlichen Kernstack.
- “Live genutzt” wird nicht mehr durch einen bloßen Key-Test erzeugt.
- Provider zeigen getrennt: Key-Status, Teststatus, Datenlayer-Status, Nutzungsstatus und Einsatzart.
- FRED wurde auf einen JSON-Test mit `file_type=json` umgestellt.
- Financial Modeling Prep, Twelve Data, NewsAPI, GNews, CoinCap und weitere alte Slots wurden aus der aktiven öffentlichen API-Key-Seite entfernt.
- Events/Earnings sind klar Finnhub und Alpha Vantage zugeordnet; Dividenden/Splits bleiben lokal abgesichert.
- README und Footer beschreiben den neuen Provider-Stack ehrlich.

## Was in der Prioritätsrunde ergänzt wurde

- Startseite mit neuem Bereich **“Was ist heute wichtig?”** für Marktbewegungen, Events, Earnings, auffällige Assets und Risk-on/Risk-off-Einordnung.
- Asset-Seiten mit stärkerer 5-Minuten-Research-Zusammenfassung, Chancen/Risiken, Triggern und eigenem **Thesis / Journal** Tab.
- Liquidität und Geldmengen bleiben als eigener Bereich sichtbar und wurden auf der Startseite stärker mit Markt-Wirkung erklärt.
- Screener zeigt das erweiterte lokale Universum mit aktuell knapp 80 Assets und bleibt hybrid aus Live-Quotes und Fallback-Research-Score.
- Watchlist zeigt zusätzliche Watchlist-News und Event-Hinweise.
- Alerts unterstützen jetzt Preis-, Watchlist-, Sentiment- und Earnings-/Event-Reminder.
- Portfolio-Bereich erklärt Risiko, Exposure, Klumpenrisiko und Rebalancing klarer.
- ETF-Overlap Checker enthält eine verständliche Einordnung der Überschneidung.
- Research/Report wurde um eine 5-Minuten-Aktienanalyse und mehr Thesis-/Risiko-Logik erweitert.
- Journal-/Psychologie-Basis speichert These, Trigger, Emotion und Regel-Check lokal im Browser.

## Was in dieser Vertiefungsrunde verbessert wurde

- Makro und Liquidität haben jetzt eine klarere Kernaussage mit Liquiditätsampel, Score und verständlicher Wirkung auf Aktien, Gold, Krypto und Anleihen.
- M1, M2, M3 und M4 sind im Liquiditätsbereich stärker gruppiert und werden nicht mehr nur als lose Zahlen gezeigt.
- Realzins, Yield Curve und Zentralbank-Bilanz werden deutlicher als Zins- und Liquiditätsrisiken eingeordnet.
- Die Startseite verbindet den Tagesüberblick stärker mit dem Makro-/Liquiditätsbild.
- ETF-Karten erklären jetzt Einsatz, Ausschüttungstyp, Top-5-Konzentration, Regionen, Währungsrisiko und Struktur klarer.
- Der ETF-Kostenrechner zeigt grobe Kosten pro Jahr, pro Monat und über den gewählten Zeitraum.
- Der ETF-Overlap-Checker bewertet nicht nur Top-Holdings, sondern auch regionale Überschneidung und TER-Differenz.
- Portfolio, Journal, Watchlist und Reports wurden sprachlich und logisch weiter geschärft, ohne neue technische Infrastruktur einzuführen.

## Öffentlicher Kernstack

Diese elf Quellen bilden ab jetzt den sichtbaren Provider-Kern:

1. **Finnhub**: Aktien-Quotes, Unternehmensprofile, Company News, Earnings Calendar.
2. **Alpha Vantage**: FX, Rohstoffe, technische Indikatoren, IPO-/Earnings-Zusatz, Quote-Fallback.
3. **FRED**: US-Makro, Geldmengen, Zinsserien und Spreads.
4. **ECB**: Eurozone, EZB-Daten, EUR-bezogene Makrodaten.
5. **BLS**: CPI, Inflation und US-Arbeitsmarkt.
6. **U.S. Treasury Fiscal Data**: Yield Curve, Treasury Rates und Zinsstruktur.
7. **SEC / EDGAR**: Filings, Submissions, XBRL und offizielle Fundamentaldatenbasis.
8. **EIA**: Energie, Öl, Gas und Energiedaten.
9. **World Bank**: globale Länderprofile und Makrodaten.
10. **IMF DataMapper**: internationale Makroergänzung.
11. **OECD Data Explorer**: OECD-Vergleiche und Wirtschaftsstruktur.

## Welche Keys zuerst sinnvoll sind

1. **Finnhub**: wichtigster Key für Aktienkurse, Profile, Company News und Earnings.
2. **FRED**: wichtigster Key für US-Makro, Geldmengen und Zinsdaten.
3. **Alpha Vantage**: sinnvoll für FX, Rohstoffe, technische Indikatoren und Quote-Fallback.
4. **EIA**: sinnvoll, wenn Energie-/Rohstoffdaten live genutzt werden sollen.

ECB, BLS, Treasury, SEC, World Bank, IMF und OECD brauchen in dieser Startphase kein Key-Feld. Sie sind Open-Data-Quellen oder browserkritische offizielle Quellen und werden entsprechend gekennzeichnet.

## Bewusst entfernte öffentliche Provider-Slots

Diese Anbieter werden nicht mehr in der aktiven öffentlichen API-Key-Seite beworben:

- Financial Modeling Prep
- Twelve Data
- NewsAPI
- GNews
- CoinCap
- EODHD
- Marketaux
- ExchangeRate-API
- Open Exchange Rates
- Metals-API
- Reddit
- Brevo
- Supabase

CoinGecko bleibt nur als optionaler interner Krypto-Prototyp für BTC/ETH-Fallbacks erhalten und ist kein Kernprovider für den öffentlichen Start.

## Live, Fallback oder zugeordnet

- Start-Ticker: live mit Finnhub oder Alpha Vantage, sonst Fallback. Krypto nutzt optional CoinGecko-Prototyp/Fallback.
- Asset-Kurse: Finnhub primär, Alpha Vantage als Fallback, sonst lokaler Fallback.
- Company News: Finnhub, sonst lokaler News-Fallback.
- Fundamentals: Finnhub Basic Financials, später SEC/XBRL sauber ausbauen, sonst lokaler Fallback.
- Makro: FRED live bei Key, sonst Fallback; ECB/BLS/Treasury/World Bank/IMF/OECD sind klar zugeordnet.
- Geldmengen/Liquidität: FRED und ECB zugeordnet, lokale Fallbacks bleiben aktiv.
- Events/Earnings: Finnhub live bei Key, Alpha Vantage als Zusatzpfad zugeordnet, lokaler Kalender bleibt aktiv.
- Screener: Hybrid aus Live-Quotes und lokalem Research-Universum.
- ETF: lokale strukturierte Datenbasis.
- Portfolio/Watchlist/Alerts: lokal im Browser gespeichert.
- Reports: Browser-Print/PDF-Fallback ohne Backend.

## Data Health

Der Bereich `Data Health` zeigt:

- Key vorhanden oder Key fehlt
- Test verfügbar oder nicht sinnvoll
- Test erfolgreich oder fehlgeschlagen
- aktuell live genutzt, Fallback aktiv oder aktuell nicht genutzt
- browsergeeignet, browserkritisch oder später serverseitig sinnvoll
- welche Module welchen Provider verwenden

Wichtig: Ein erfolgreicher API-Test bedeutet nur “Test erfolgreich”. Erst ein erfolgreicher Datenabruf durch ein Modul zählt als “aktuell live genutzt”.

## Die wichtigsten Dateien

- `index.html` enthält Grundgerüst, Navigation, Footer und bindet CSS/JS relativ ein.
- `styles.css` enthält Premium-Design, Dark/Light Mode, Mobile Layout und Print/Report Styles.
- `app.js` enthält die statische App-Logik: Routing, Provider Registry, API Layer, Fallback-Daten, Data Health, Screener, Ratings, Top Picks, Alerts, Asset-Seiten, ETF, Portfolio, Makro, Geldmengen, Insider, Reports und Personalisierung.
- `README.md` erklärt Projekt, Nutzung, Datenlogik und Deployment.
- `DEPLOYMENT.md` erklärt GitHub und Vercel Schritt für Schritt.
- `vercel.json` ist eine kleine optionale Vercel-Konfiguration für statisches Hosting.

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
