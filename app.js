(() => {
  "use strict";

  /*
   * MH Analytics static runtime map
   *
   * This file intentionally stays dependency-free so the project works by
   * double-clicking index.html and can also be deployed as a static website.
   *
   * Current internal order:
   * 1. Storage keys, provider registry and app configuration
   * 2. Local fallback data for assets, macro, ETFs, events and portfolios
   * 3. Shared state, routing and global event delegation
   * 4. Page renderers for home, asset, screener, macro, ETF, portfolio, alerts and settings
   * 5. API layer, cache, fallback handling and data transparency helpers
   * 6. Engines for ratings, top picks, alerts, reports, personalization and local storage
   *
   * If this file is split later, keep those boundaries and load the scripts in
   * dependency order from index.html without introducing a build step.
   */

  const STORAGE_KEYS = {
    theme: "mh.theme.v2",
    providerTests: "mh.providerTests.v1",
    providerHealth: "mh.providerHealth.v1",
    watchlist: "mh.watchlist.v2",
    portfolios: "mh.portfolios.v1",
    activePortfolioId: "mh.activePortfolioId.v1",
    dashboardPrefs: "mh.dashboardPrefs.v1",
    alerts: "mh.alerts.v2",
    alertInbox: "mh.alertInbox.v2",
    journal: "mh.journal.v1",
    recents: "mh.recents.v2",
    activeSymbol: "mh.activeSymbol.v2",
    cache: "mh.apiCache.v2"
  };

  const BOOT_TIME = Date.now();
  const CACHE_TTL = {
    quote: 60 * 1000,
    profile: 24 * 60 * 60 * 1000,
    fundamentals: 6 * 60 * 60 * 1000,
    news: 15 * 60 * 1000,
    macro: 6 * 60 * 60 * 1000,
    events: 30 * 60 * 1000,
    series: 30 * 60 * 1000,
    openData: 6 * 60 * 60 * 1000
  };

  const SCREENER_LIVE_LIMITS = {
    quotes: 28,
    profiles: 12,
    fundamentals: 8,
    series: 8
  };

  const PROVIDER_GROUPS = [
    { id: "market", label: "Markt / Aktien / Unternehmen" },
    { id: "alpha", label: "FX / Rohstoffe / Indikatoren" },
    { id: "fx", label: "Währungen / FX" },
    { id: "usMacro", label: "Makro USA" },
    { id: "euroMacro", label: "Makro Europa" },
    { id: "rates", label: "Zinsen / Yield Curve" },
    { id: "filings", label: "Filings / Fundamentals" },
    { id: "energy", label: "Energie / Rohstoffe" },
    { id: "globalMacro", label: "Globale Länderdaten" },
    { id: "reference", label: "Referenzdaten / Identifikatoren" }
  ];

  const PROVIDERS = [
    {
      id: "finnhub",
      name: "Finnhub",
      group: "market",
      categories: ["Market Data", "News", "Events / Earnings"],
      status: "active",
      keyMode: "serverEnv",
      security: "backend-only",
      description: "Aktien-Quotes, Firmenprofile, Company News, Basic Financials und Earnings/Events.",
      usage: "Primärquelle für Aktien, Profile, News und Earnings. Läuft öffentlich nur noch serverseitig über /api/finnhub mit FINNHUB_API_KEY.",
      testHint: "Kein öffentlicher Browser-Key. Status entsteht über echte Modulabrufe auf /api/finnhub.",
      testRequest: buildFinnhubProxyTestRequest,
      validateTest: validateFinnhubQuote
    },
    {
      id: "alphaVantage",
      name: "Alpha Vantage",
      group: "alpha",
      categories: ["FX", "Rohstoffe", "Indikatoren", "Fallback"],
      status: "active",
      keyMode: "serverEnv",
      security: "backend-only",
      description: "FX, Rohstoffe, technische Indikatoren, IPO-/Earnings-Zusatz und optionaler Aktienkurs-Fallback.",
      usage: "Eigener Zuständigkeitsbereich für FX, Rohstoffe, Indikatoren, Zeitreihen sowie IPO-/Earnings-Zusatz. Läuft öffentlich nur noch serverseitig über /api/alphavantage mit ALPHA_VANTAGE_API_KEY.",
      testHint: "Kein öffentlicher Browser-Key. Status entsteht über echte Modulabrufe auf /api/alphavantage.",
      testRequest: buildAlphaProxyTestRequest,
      validateTest: validateAlphaVantageQuote
    },
    {
      id: "frankfurter",
      name: "Frankfurter FX",
      group: "fx",
      categories: ["FX", "Währungen", "Umrechnung"],
      status: "active",
      keyMode: "none",
      security: "server-normalized",
      description: "Offene FX-Quelle für Basis-Währungspaare und einfache Umrechnung.",
      usage: "Währungsdaten laufen über /api/fx. Kein öffentliches Key-Feld, keine direkte Browser-Abhängigkeit.",
      testHint: "Status entsteht über echte Modulabrufe auf /api/fx."
    },
    {
      id: "twelveData",
      name: "Twelve Data",
      group: "market",
      categories: ["Market Data", "Forex / Commodities"],
      status: "disabled",
      keyMode: "required",
      security: "backend-recommended",
      description: "Vorbereiteter Slot für Realtime/Delayed Quotes, Indikatoren, Forex und Rohstoffe.",
      usage: "Aus der aktiven öffentlichen Provider-Seite entfernt; nicht im Public-Start-Kernstack.",
      testHint: "Slot vorbereitet; Integration später."
    },
    {
      id: "fmp",
      name: "Financial Modeling Prep",
      group: "fundamentals",
      categories: ["Fundamentals", "Market Data", "Events / Earnings"],
      status: "disabled",
      keyMode: "required",
      security: "backend-recommended",
      description: "Profile, Fundamentaldaten, Kennzahlen und später Earnings-Kalender.",
      usage: "Aus der aktiven öffentlichen Provider-Seite entfernt; keine Live-Pfade im Public-Start-Kernstack.",
      testHint: "Aus der öffentlichen API-Key-Seite entfernt; kein Browser-Test im Public Start."
    },
    {
      id: "eodhd",
      name: "EODHD",
      group: "fundamentals",
      categories: ["Market Data", "Fundamentals", "Events / Earnings"],
      status: "disabled",
      keyMode: "required",
      security: "backend-recommended",
      description: "Vorbereiteter Slot für EOD-Kurse, Fundamentaldaten, Dividenden und Earnings.",
      usage: "Aus der aktiven öffentlichen Provider-Seite entfernt.",
      testHint: "Slot vorbereitet; Integration später."
    },
    {
      id: "fred",
      name: "FRED",
      group: "usMacro",
      categories: ["US-Makro", "Geldmengen", "Zinsen"],
      status: "active",
      keyMode: "serverEnv",
      security: "backend-only",
      description: "US-Makrodaten wie Fed Funds, CPI, Arbeitslosenquote, Geldmengen, Zinsserien und Spreads.",
      usage: "Zuständig für US-Makro und Geldmengen. FRED läuft nicht mehr direkt im Browser, sondern über die Vercel Function /api/fred mit FRED_API_KEY als Environment Variable.",
      testHint: "Testet die Vercel Function /api/fred?action=test. Kein FRED-Key im Frontend.",
      testRequest: buildFredProxyTestRequest,
      validateTest: validateFredSeriesUpdates
    },
    {
      id: "ecb",
      name: "ECB",
      group: "euroMacro",
      categories: ["Euro-Makro", "EZB", "EUR-FX"],
      status: "mapped",
      keyMode: "none",
      security: "browser-ok-public",
      description: "Vorbereiteter Slot für EZB-Zinsen, FX-Referenzkurse und europäische Makrodaten.",
      usage: "Open-Data-Quelle für Eurozone/EZB. Zugeordnet, aber erst nach echtem Abruf als live markiert.",
      testHint: "Open-Data-Test: ECB Dataflow-Verzeichnis.",
      testRequest: () => ({ url: "https://data-api.ecb.europa.eu/service/dataflow/ECB/all/latest?detail=allstubs", responseType: "text" }),
      validateTest: validateNonEmptyText("ECB Data API")
    },
    {
      id: "newsApi",
      name: "NewsAPI",
      group: "news",
      categories: ["News"],
      status: "backendOnly",
      keyMode: "required",
      security: "backend-only",
      description: "Vorbereiteter Slot für allgemeine News-Aggregation.",
      usage: "Noch nicht aktiv. NewsAPI sollte wegen Key-Schutz und CORS später serverseitig laufen.",
      testHint: "Backend-only empfohlen."
    },
    {
      id: "finnhubNews",
      name: "Finnhub News",
      group: "news",
      categories: ["News", "Events / Earnings"],
      status: "disabled",
      keyMode: "required",
      security: "backend-recommended",
      description: "Company News und Earnings Calendar. Nutzt in der App denselben Finnhub-Key wie Market Data.",
      usage: "Nicht mehr als separater Provider sichtbar; Finnhub bündelt Quotes, News und Earnings.",
      testHint: "Kein separater Test: Finnhub News nutzt den Hauptprovider Finnhub."
    },
    {
      id: "gnews",
      name: "GNews",
      group: "news",
      categories: ["News"],
      status: "prepared",
      keyMode: "required",
      security: "backend-recommended",
      description: "Vorbereiteter Slot für News-Aggregation und Asset-News.",
      usage: "Noch nicht aktiv im Datenlayer.",
      testHint: "Slot vorbereitet; Integration später."
    },
    {
      id: "marketaux",
      name: "Marketaux",
      group: "news",
      categories: ["News", "Social / Sentiment"],
      status: "optional",
      keyMode: "required",
      security: "backend-recommended",
      description: "Optionaler Slot für Finanz-News, Entitäten und Sentiment.",
      usage: "Noch nicht aktiv im Datenlayer.",
      testHint: "Optionaler späterer News/Sentiment-Anbieter."
    },
    {
      id: "coingecko",
      name: "CoinGecko",
      group: "crypto",
      categories: ["Crypto"],
      status: "active",
      keyMode: "none",
      security: "server-normalized",
      description: "Krypto-Preise für BTC/ETH. Public/Demo nutzbar; produktionsnah besser mit Key oder Proxy.",
      usage: "Krypto-Daten laufen über /api/coingecko. COINGECKO_API_KEY ist optional und wird, falls gesetzt, nur serverseitig genutzt.",
      testHint: "Status entsteht über echte Crypto-Abrufe auf /api/coingecko."
    },
    {
      id: "coincap",
      name: "CoinCap",
      group: "crypto",
      categories: ["Crypto"],
      status: "prepared",
      keyMode: "optional",
      security: "proxy-recommended",
      description: "Vorbereiteter Slot für alternative Krypto-Preise und Market Caps.",
      usage: "Noch nicht aktiv im Datenlayer.",
      testHint: "Slot vorbereitet; Integration später."
    },
    {
      id: "exchangeRateApi",
      name: "ExchangeRate-API",
      group: "fxCommodities",
      categories: ["Forex / Commodities"],
      status: "prepared",
      keyMode: "required",
      security: "backend-recommended",
      description: "Vorbereiteter Slot für FX-Kurse und Währungsrechner.",
      usage: "Noch nicht aktiv im Datenlayer.",
      testHint: "Slot vorbereitet; Integration später."
    },
    {
      id: "openExchangeRates",
      name: "Open Exchange Rates",
      group: "fxCommodities",
      categories: ["Forex / Commodities"],
      status: "prepared",
      keyMode: "required",
      security: "backend-recommended",
      description: "Vorbereiteter Slot für FX-Kurse und Multi-Währungs-System.",
      usage: "Noch nicht aktiv im Datenlayer.",
      testHint: "Slot vorbereitet; Integration später."
    },
    {
      id: "metalsApi",
      name: "Metals-API",
      group: "fxCommodities",
      categories: ["Forex / Commodities"],
      status: "optional",
      keyMode: "required",
      security: "backend-recommended",
      description: "Optionaler Slot für Gold, Silber und Rohstoffpreise.",
      usage: "Noch nicht aktiv im Datenlayer.",
      testHint: "Optionaler Rohstoffanbieter für spätere Phase."
    },
    {
      id: "reddit",
      name: "Reddit",
      group: "social",
      categories: ["Social / Sentiment"],
      status: "backendOnly",
      keyMode: "oauth",
      security: "backend-only",
      description: "Vorbereiteter Slot für Reddit/WallStreetBets Sentiment und Mentions.",
      usage: "Noch nicht aktiv. OAuth und Token sollten später serverseitig laufen.",
      testHint: "Backend-only/OAuth empfohlen."
    },
    {
      id: "brevo",
      name: "Brevo",
      group: "crm",
      categories: ["Newsletter / CRM"],
      status: "backendOnly",
      keyMode: "required",
      security: "backend-only",
      description: "Newsletter, Listen, Double-Opt-In und später CRM-Automation.",
      usage: "UI vorbereitet, API-Aufrufe später nur über Backend.",
      testHint: "Backend-only wegen geheimem API Key."
    },
    {
      id: "supabase",
      name: "Supabase",
      group: "storage",
      categories: ["Storage / Backend-ready"],
      status: "prepared",
      keyMode: "anon",
      security: "backend-ready",
      description: "Vorbereiteter Slot für User-Daten, Watchlists, Kommentare, Auth und Edge Functions.",
      usage: "Noch nicht aktiv. In Phase statisch bleibt localStorage primär.",
      testHint: "Anon Key kann später genutzt werden; Service Role niemals im Browser speichern."
    },
    {
      id: "bls",
      name: "BLS",
      group: "usMacro",
      categories: ["CPI", "Arbeitsmarkt", "US-Labor"],
      status: "active",
      keyMode: "none",
      security: "server-normalized",
      description: "Offizielle Open-Data-Quelle für US-Arbeitsmarkt, CPI und Labor-Daten.",
      usage: "Kein Key nötig. Wird über /api/opendata normalisiert und ergänzt CPI sowie Arbeitsmarkt.",
      testHint: "Status entsteht über Open-Data-Abrufe auf /api/opendata."
    },
    {
      id: "treasury",
      name: "U.S. Treasury Fiscal Data",
      group: "rates",
      categories: ["Yield Curve", "Treasury Rates", "Zinsstruktur"],
      status: "active",
      keyMode: "none",
      security: "server-normalized",
      description: "Offizielle Open-Data-Quelle für Treasury-Rates, Yield Curve und Zinsstruktur.",
      usage: "Kein Key nötig. Wird über /api/opendata normalisiert und für 10Y-Rendite sowie Yield Curve genutzt.",
      testHint: "Status entsteht über Open-Data-Abrufe auf /api/opendata."
    },
    {
      id: "sec",
      name: "SEC / EDGAR",
      group: "filings",
      categories: ["Filings", "Submissions", "XBRL"],
      status: "mapped",
      keyMode: "none",
      security: "browser-critical",
      description: "Offizielle Open-Data-Quelle für EDGAR Submissions, XBRL und spätere Fundamentaldatenbasis.",
      usage: "Kein Key nötig. data.sec.gov ist offiziell, aber im Browser CORS-kritisch; daher aktuell zugeordnet, nicht als Frontend-Livequelle beworben.",
      testHint: "Kein Browser-Test: SEC data.sec.gov unterstützt CORS nicht zuverlässig für öffentliche Frontends."
    },
    {
      id: "eia",
      name: "EIA",
      group: "energy",
      categories: ["Energie", "Öl", "Gas"],
      status: "active",
      keyMode: "serverEnv",
      security: "backend-only",
      description: "Offizielle Energiequelle für Öl, Gas, Strom und Energiemarktdaten.",
      usage: "EIA läuft über /api/eia mit EIA_API_KEY als Vercel Environment Variable. Öl wird aktiv für Rohstoffdaten genutzt; Gas/Energie sind serverseitig vorbereitet.",
      testHint: "Kein öffentliches Key-Feld. Status entsteht über echte Modulabrufe auf /api/eia."
    },
    {
      id: "worldBank",
      name: "World Bank",
      group: "globalMacro",
      categories: ["Länderprofile", "Globale Makro"],
      status: "active",
      keyMode: "none",
      security: "server-normalized",
      description: "Open-Data-Quelle für globale Länder-, Entwicklungs- und Strukturdaten.",
      usage: "Kein Key nötig. Wird über /api/opendata normalisiert und für globale BIP-/Ländervergleiche genutzt.",
      testHint: "Status entsteht über Open-Data-Abrufe auf /api/opendata."
    },
    {
      id: "imf",
      name: "IMF DataMapper",
      group: "globalMacro",
      categories: ["Internationale Makro", "Länder"],
      status: "active",
      keyMode: "none",
      security: "server-normalized",
      description: "Offizielle internationale Makroergänzung über IMF DataMapper und IMF APIs.",
      usage: "Kein Key nötig für DataMapper. Wird über /api/opendata normalisiert und ergänzt globale Makrovergleiche.",
      testHint: "Status entsteht über Open-Data-Abrufe auf /api/opendata."
    },
    {
      id: "oecd",
      name: "OECD Data Explorer",
      group: "globalMacro",
      categories: ["OECD-Vergleiche", "Wirtschaftsstruktur"],
      status: "mapped",
      keyMode: "none",
      security: "browser-critical",
      description: "OECD Open Data über SDMX-APIs für Länder- und Wirtschaftsvergleiche.",
      usage: "Kein Key nötig. Wegen SDMX-Komplexität und Browser-/Rate-Limit-Fragen zugeordnet, aber nicht als Live-Frontendquelle markiert.",
      testHint: "Kein Browser-Test in dieser statischen Startphase. Später besser über kontrollierten Datenadapter."
    },
    {
      id: "eurostat",
      name: "Eurostat",
      group: "euroMacro",
      categories: ["Euro-Makro", "EU-Daten", "Länder"],
      status: "mapped",
      keyMode: "none",
      security: "browser-ok-public",
      description: "Offizielle Open-Data-Quelle für EU-Statistiken, Eurozone-Kennzahlen und Länderprofile.",
      usage: "Kein Key nötig. In dieser Runde als transparenter Quellenstatus eingeordnet; Live-Module werden später gezielt angebunden.",
      testHint: "Kein öffentlicher Testbutton. Status entsteht später über echte Modulabrufe."
    },
    {
      id: "openfigi",
      name: "OpenFIGI",
      group: "reference",
      categories: ["Referenzdaten", "Identifier", "Mapping"],
      status: "mapped",
      keyMode: "none",
      security: "backend-ready",
      description: "Referenzdatenquelle für spätere Symbol-, FIGI- und Instrumenten-Zuordnung.",
      usage: "Kein öffentliches Key-Feld. Für diese Runde nur als Datenquellenstatus eingeordnet; spätere Nutzung erfolgt kontrolliert serverseitig.",
      testHint: "Kein öffentlicher Testbutton. Nicht als Live-Modul beworben."
    }
  ];

  const DEFAULT_WATCHLIST = ["NVDA", "MSFT", "AAPL", "SPY", "BTC"];
  const HOME_TICKER = ["SPY", "QQQ", "DAX", "NVDA", "MSFT", "AAPL", "BTC", "ETH", "GOLD"];
  const PUBLIC_PROVIDER_IDS = ["finnhub", "alphaVantage", "frankfurter", "fred", "ecb", "bls", "treasury", "sec", "eia", "coingecko", "worldBank", "imf", "oecd", "eurostat", "openfigi"];
  const REMOVED_PUBLIC_PROVIDER_IDS = ["newsApi", "gnews", "fmp", "twelveData", "coincap", "eodhd", "marketaux", "exchangeRateApi", "openExchangeRates", "metalsApi", "reddit", "brevo", "supabase", "finnhubNews"];
  const OPTIONAL_INTERNAL_PROVIDER_IDS = [];
  const PRIORITY_PROVIDER_IDS = ["finnhub", "alphaVantage", "frankfurter", "fred", "ecb", "bls", "treasury", "sec", "eia", "coingecko", "worldBank", "imf", "oecd", "eurostat", "openfigi"];
  const DATA_HEALTH_PROVIDER_IDS = [
    "finnhub",
    "alphaVantage",
    "frankfurter",
    "fred",
    "ecb",
    "bls",
    "treasury",
    "sec",
    "eia",
    "coingecko",
    "worldBank",
    "imf",
    "oecd",
    "eurostat",
    "openfigi"
  ];

  const PROVIDER_MODULE_USAGE = {
    finnhub: ["Aktien-Quotes", "Unternehmensprofile", "Company News", "Earnings Calendar", "Asset-Seiten"],
    alphaVantage: ["Quote-Fallback", "FX", "Rohstoffe", "technische Indikatoren", "IPO/Earnings-Zusatz"],
    frankfurter: ["FX-Kurse", "Währungsumrechnung", "EUR/USD", "USD/JPY"],
    fred: ["US-Makro", "Fed Funds", "CPI/Inflation", "Arbeitslosenquote", "Geldmengen/Zinsen"],
    ecb: ["Eurozone", "EZB-Zinsen", "EUR-FX", "Euro-Makro"],
    bls: ["CPI", "Arbeitsmarkt", "US-Labor"],
    treasury: ["Yield Curve", "Treasury Rates", "Zinsstruktur"],
    sec: ["Filings", "Submissions", "XBRL", "Fundamentaldatenbasis"],
    eia: ["Energie", "Öl", "Gas", "Rohstoffdaten"],
    coingecko: ["Krypto-Preise", "Market Cap", "BTC/ETH/SOL"],
    worldBank: ["Länderprofile", "globale Makrodaten", "Strukturdaten"],
    imf: ["internationale Makroergänzung", "Ländervergleiche"],
    oecd: ["OECD-Vergleiche", "Wirtschaftsstruktur"],
    eurostat: ["Eurozone", "EU-Statistik", "Länderprofile"],
    openfigi: ["Symbol-Mapping", "Instrumenten-Referenz", "spätere Datenharmonisierung"]
  };

  const DATA_SOURCE_REGISTRY = [
    { id: "finnhub", role: "Primärquelle", type: "Serverseitig", category: "Markt / Unternehmen", description: "Aktienkurse, Unternehmensprofile, Company News und Earnings laufen über die eigene Vercel Function.", fallback: "Bei Fehlern bleiben lokale Quotes, Profile und Event-Fallbacks aktiv." },
    { id: "alphaVantage", role: "Zusatzquelle", type: "Serverseitig", category: "FX / Rohstoffe / Zeitreihen", description: "Ergänzt FX, Rohstoffe, technische Indikatoren sowie IPO- und Earnings-Zusatzdaten.", fallback: "Wird bei Aktien auch als Quote-Fallback genutzt, wenn Finnhub nicht liefert." },
    { id: "frankfurter", role: "Primärquelle FX", type: "Serverseitig normalisiert", category: "Währungen", description: "Offene FX-Kurse laufen zentral über /api/fx, ohne öffentliches Key-Feld.", fallback: "Bei Ausfall nutzt die App strukturierte lokale FX-Kontexte." },
    { id: "fred", role: "Primärquelle US-Makro", type: "Serverseitig", category: "US-Makro / Geldmengen", description: "FRED versorgt Zinsen, Geldmengen, Spreads und US-Makroserien ausschließlich serverseitig.", fallback: "Makro- und Liquiditätskarten bleiben fallback-gestützt nutzbar." },
    { id: "ecb", role: "Euro-Makro", type: "Open Data", category: "Eurozone", description: "ECB ist als offene Quelle für Eurozone, EZB-Zinsen und EUR-Kontext eingeordnet.", fallback: "Noch nicht jede ECB-Reihe ist live verdrahtet; lokale Euro-Makro-Basis bleibt sichtbar." },
    { id: "bls", role: "Offizielle US-Daten", type: "Serverseitig normalisiert", category: "Inflation / Arbeit", description: "BLS ergänzt CPI und Arbeitsmarkt über die Open-Data-Normalisierung.", fallback: "CPI und Arbeitsmarkt bleiben mit lokalen Makro-Fallbacks verfügbar." },
    { id: "treasury", role: "Zinsstruktur", type: "Serverseitig normalisiert", category: "Yield Curve", description: "Treasury liefert Renditen, Yield Curve und Zinsstruktur über /api/opendata.", fallback: "FRED/Treasury-Fallbacks sichern Zinskarten ab." },
    { id: "sec", role: "Fundamentaldatenbasis", type: "Open Data / serverseitig sinnvoll", category: "Filings", description: "SEC/EDGAR ist für Filings, Submissions und XBRL eingeordnet, aber browserseitig kritisch.", fallback: "Asset-Seiten nutzen derzeit Finnhub und lokale Fundamentaldatenbasis." },
    { id: "eia", role: "Energiequelle", type: "Serverseitig", category: "Energie / Rohstoffe", description: "EIA ist die offizielle Energiequelle für Öl, Gas und Energiedaten.", fallback: "Rohstoffkarten nutzen Alpha Vantage und lokale Fallbacks, falls EIA nicht liefert." },
    { id: "coingecko", role: "Krypto-Preise", type: "Serverseitig", category: "Krypto", description: "CoinGecko liefert Krypto-Preise über eine eigene serverseitige Route.", fallback: "BTC/ETH/SOL bleiben über lokale Krypto-Fallbacks sichtbar." },
    { id: "worldBank", role: "Globale Makroquelle", type: "Serverseitig normalisiert", category: "Länderdaten", description: "World Bank liefert globale Länder- und BIP-Daten über die Open-Data-Schicht.", fallback: "Globale Vergleichskarten nutzen lokale Länder-Fallbacks." },
    { id: "imf", role: "Internationale Makroergänzung", type: "Serverseitig normalisiert", category: "Globale Makro", description: "IMF ergänzt internationale Wachstums- und Länderdaten.", fallback: "IMF ist Ergänzung, nicht alleinige Basis." },
    { id: "oecd", role: "Vergleichsdaten", type: "Open Data / späterer Adapter", category: "OECD", description: "OECD ist für strukturierte Länder- und Wirtschaftsvergleiche eingeordnet.", fallback: "Noch nicht als Live-Kernpfad beworben." },
    { id: "eurostat", role: "EU-Statistik", type: "Open Data", category: "Euro-Makro", description: "Eurostat ist als offizielle EU-Datenquelle eingeordnet.", fallback: "Eurostat-Reihen werden erst nach gezielter Modulverdrahtung live gezählt." },
    { id: "openfigi", role: "Referenzdaten", type: "Open Data / Mapping", category: "Identifier", description: "OpenFIGI ist für spätere Instrumenten- und Identifier-Logik eingeordnet.", fallback: "Aktuell kein produktiver Live-Pfad; Symboluniversum bleibt lokal kontrolliert." }
  ];

  const DATA_HEALTH_MODULES = [
    { id: "home", name: "Startseite", providers: ["finnhub", "alphaVantage", "coingecko", "fred"], mode: "Hybrid", quality: "hoch", description: "Ticker, Tagesüberblick, Tages-Recap und Marktstatus bündeln Live- und Fallback-Daten." },
    { id: "briefing", name: "Tagesüberblick", providers: ["finnhub", "fred", "treasury", "eia"], mode: "Hybrid", quality: "hoch", description: "Marktbewegungen, Makro, Liquidität und Event-Fokus werden aus vorhandenen Daten priorisiert." },
    { id: "recap", name: "Tages-Recap", providers: ["finnhub", "alphaVantage", "coingecko"], mode: "Hybrid / lokal priorisiert", quality: "mittel", description: "Watchlist, Alerts, Events, News und Bewegungen werden lokal kuratiert und nach Relevanz sortiert." },
    { id: "asset", name: "Asset-Seiten", providers: ["finnhub", "sec", "alphaVantage"], mode: "Hybrid", quality: "hoch", description: "Preis, Profil, News und Events bevorzugen Live-Daten; Research bleibt Produktlogik." },
    { id: "events", name: "Event-/Earnings-Hub", providers: ["finnhub", "alphaVantage"], mode: "Hybrid / Fallback", quality: "mittel", description: "Earnings und IPO-Zusatzdaten werden providerbasiert geladen; lokaler Kalender bleibt Backup." },
    { id: "compare", name: "Quick Compare", providers: ["finnhub", "alphaVantage"], mode: "Hybrid", quality: "mittel", description: "Quotes und Fundamentals speisen den Vergleich; ETF-Struktur bleibt lokal modelliert." },
    { id: "watchlist", name: "Watchlist", providers: ["finnhub", "alphaVantage"], mode: "Hybrid / lokal", quality: "mittel", description: "Gespeicherte Assets sind lokal, Kurs- und Newsdaten kommen soweit möglich live." },
    { id: "alerts", name: "Alerts V2", providers: ["finnhub", "alphaVantage"], mode: "Lokal / Hybrid", quality: "mittel", description: "Regeln, Snooze und Historie sind lokal; Auslösung nutzt vorhandene Kurs- und Eventdaten." },
    { id: "macro", name: "Makro / Liquidität / Geldmengen", providers: ["fred", "bls", "treasury", "ecb"], mode: "Hybrid / Fallback", quality: "hoch", description: "US-Makro, CPI, Arbeitsmarkt, Renditen und Euro-Kontext werden offiziellen Quellen zugeordnet." },
    { id: "energy", name: "Energie / Rohstoffe / FX", providers: ["eia", "alphaVantage", "frankfurter"], mode: "Hybrid", quality: "mittel", description: "EIA, Alpha Vantage und FX-Normalisierung speisen Cross-Asset-Kontexte." },
    { id: "etf", name: "ETF", providers: ["finnhub"], mode: "Lokal / Hybrid", quality: "mittel", description: "ETF-Struktur, TER und Holdings sind strukturiert lokal; Marktpreise können über Quote-Pfade kommen." },
    { id: "portfolio", name: "Portfolio", providers: ["finnhub", "alphaVantage"], mode: "Lokal / Hybrid", quality: "mittel", description: "Positionen und Notizen sind lokal; Marktdaten werden soweit verfügbar live ergänzt." },
    { id: "research", name: "Research / Report", providers: ["finnhub", "fred", "sec"], mode: "Hybrid / Synthese", quality: "mittel", description: "Reports kombinieren echte Inputs, lokale Fallbacks und eigene Research-Synthese." },
    { id: "sources", name: "Datenquellen", providers: DATA_HEALTH_PROVIDER_IDS, mode: "Transparenz", quality: "hoch", description: "Zeigt Quellen, Status, Frische, Health und betroffene Module ohne öffentliche Key-Konfiguration." }
  ];

  const ASSETS = [
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      type: "Stock",
      sector: "Technology",
      tv: "NASDAQ:AAPL",
      currency: "USD",
      fallback: { price: 203.45, changePct: 0.38, marketCap: 3060000000000, pe: 31.2, eps: 6.52, revenue: 391000000000 },
      thesis: "Cashflow-starke Plattform mit Services-Wachstum und hoher Preissetzungsmacht.",
      risks: "China-Abhängigkeit, Regulierung, langsamere Hardware-Zyklen.",
      sentiment: 67
    },
    {
      symbol: "NVDA",
      name: "NVIDIA Corporation",
      type: "Stock",
      sector: "Semiconductors",
      tv: "NASDAQ:NVDA",
      currency: "USD",
      fallback: { price: 884.20, changePct: 1.74, marketCap: 2200000000000, pe: 58.6, eps: 15.08, revenue: 60900000000 },
      thesis: "Führende AI-Infrastruktur, sehr starke Nachfrage nach Beschleunigern und Software-Stack.",
      risks: "Hohe Erwartungen, Zyklik bei Capex, Konkurrenz durch eigene Chips großer Kunden.",
      sentiment: 78
    },
    {
      symbol: "TSLA",
      name: "Tesla Inc.",
      type: "Stock",
      sector: "Consumer Discretionary",
      tv: "NASDAQ:TSLA",
      currency: "USD",
      fallback: { price: 174.85, changePct: -1.18, marketCap: 557000000000, pe: 48.9, eps: 3.58, revenue: 96700000000 },
      thesis: "EV-Marke mit optionalem Upside aus Software, Energie und Robotik.",
      risks: "Margendruck, Wettbewerb, starke Bewertungsabhängigkeit von Zukunftsthemen.",
      sentiment: 53
    },
    {
      symbol: "META",
      name: "Meta Platforms Inc.",
      type: "Stock",
      sector: "Communication Services",
      tv: "NASDAQ:META",
      currency: "USD",
      fallback: { price: 493.15, changePct: 0.92, marketCap: 1250000000000, pe: 25.4, eps: 19.39, revenue: 134900000000 },
      thesis: "Profitabler Advertising-Compounder mit AI-Effizienz und starker Nutzerbasis.",
      risks: "Regulierung, Capex für AI/Metaverse, Werbezyklus.",
      sentiment: 71
    },
    {
      symbol: "MSFT",
      name: "Microsoft Corporation",
      type: "Stock",
      sector: "Technology",
      tv: "NASDAQ:MSFT",
      currency: "USD",
      fallback: { price: 421.50, changePct: 0.64, marketCap: 3130000000000, pe: 36.1, eps: 11.68, revenue: 227600000000 },
      thesis: "Cloud, Office und AI-Copilot liefern sehr robuste, wiederkehrende Umsätze.",
      risks: "Bewertung, Cloud-Wachstumsverlangsamung, Kartellrecht.",
      sentiment: 74
    },
    {
      symbol: "AMZN",
      name: "Amazon.com Inc.",
      type: "Stock",
      sector: "Consumer Discretionary",
      tv: "NASDAQ:AMZN",
      currency: "USD",
      fallback: { price: 183.10, changePct: 0.48, marketCap: 1900000000000, pe: 51.7, eps: 3.54, revenue: 574800000000 },
      thesis: "AWS, Retail-Margenhebel und Advertising bilden mehrere Wachstumsmotoren.",
      risks: "Konsumzyklus, Cloud-Konkurrenz, regulatorischer Druck.",
      sentiment: 69
    },
    {
      symbol: "SPY",
      name: "SPDR S&P 500 ETF",
      type: "ETF",
      sector: "US Large Caps",
      tv: "AMEX:SPY",
      currency: "USD",
      fallback: { price: 523.60, changePct: 0.31, marketCap: null, pe: null, eps: null, revenue: null },
      thesis: "Breiter US-Marktproxy mit hoher Liquidität.",
      risks: "US-Bewertung, Konzentration in Mega-Caps.",
      sentiment: 61
    },
    {
      symbol: "QQQ",
      name: "Invesco QQQ Trust",
      type: "ETF",
      sector: "Nasdaq 100",
      tv: "NASDAQ:QQQ",
      currency: "USD",
      fallback: { price: 445.80, changePct: 0.57, marketCap: null, pe: null, eps: null, revenue: null },
      thesis: "Tech-lastiger Wachstumsproxy mit hoher AI- und Software-Exposure.",
      risks: "Konzentration, Zins-Sensitivität, hohe Erwartungen.",
      sentiment: 64
    },
    {
      symbol: "DAX",
      name: "DAX Index",
      type: "Index",
      sector: "Germany",
      tv: "XETR:DAX",
      currency: "EUR",
      fallback: { price: 18520.00, changePct: -0.12, marketCap: null, pe: null, eps: null, revenue: null },
      thesis: "Deutscher Blue-Chip-Index mit Industrials-, Versicherungs- und Exportfokus.",
      risks: "Konjunktur, Energiepreise, China-Exposure.",
      sentiment: 55
    },
    {
      symbol: "GOLD",
      name: "Gold Spot",
      type: "Commodity",
      sector: "Precious Metals",
      tv: "TVC:GOLD",
      currency: "USD",
      fallback: { price: 2325.40, changePct: 0.21, marketCap: null, pe: null, eps: null, revenue: null },
      thesis: "Absicherung gegen Realzins-, Dollar- und geopolitische Risiken.",
      risks: "Steigende Realzinsen, Dollar-Stärke, keine laufenden Cashflows.",
      sentiment: 62
    },
    {
      symbol: "BTC",
      name: "Bitcoin",
      type: "Crypto",
      sector: "Digital Assets",
      tv: "BINANCE:BTCUSDT",
      coingeckoId: "bitcoin",
      currency: "USD",
      fallback: { price: 64250.00, changePct: 1.12, marketCap: 1260000000000, pe: null, eps: null, revenue: null },
      thesis: "Digitaler Knappheits- und Liquiditätsproxy mit hohem Beta.",
      risks: "Volatilität, Regulierung, Liquiditätszyklen.",
      sentiment: 66
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      type: "Crypto",
      sector: "Digital Assets",
      tv: "BINANCE:ETHUSDT",
      coingeckoId: "ethereum",
      currency: "USD",
      fallback: { price: 3125.00, changePct: 0.86, marketCap: 376000000000, pe: null, eps: null, revenue: null },
      thesis: "Smart-Contract-Basisinfrastruktur mit Staking- und Layer-2-Ökosystem.",
      risks: "Wettbewerb, Regulierung, Netzwerkgebühren und Nachfragezyklen.",
      sentiment: 63
    },
    {
      symbol: "GOOGL",
      name: "Alphabet Inc.",
      type: "Stock",
      sector: "Communication Services",
      tv: "NASDAQ:GOOGL",
      currency: "USD",
      fallback: { price: 171.80, changePct: 0.44, marketCap: 2110000000000, pe: 26.8, eps: 6.41, revenue: 307000000000 },
      thesis: "Suchgeschäft, YouTube, Cloud und AI bilden einen starken Cashflow-Mix.",
      risks: "Regulierung, AI-Disruption in Search, hohe Infrastrukturkosten.",
      sentiment: 70
    },
    {
      symbol: "AVGO",
      name: "Broadcom Inc.",
      type: "Stock",
      sector: "Semiconductors",
      tv: "NASDAQ:AVGO",
      currency: "USD",
      fallback: { price: 1320.00, changePct: 1.08, marketCap: 615000000000, pe: 34.5, eps: 38.26, revenue: 35800000000 },
      thesis: "AI-Netzwerkchips, Infrastruktur-Software und hohe Margen stützen das Qualitätsprofil.",
      risks: "Bewertung, Integrationsrisiken, Halbleiterzyklik.",
      sentiment: 73
    },
    {
      symbol: "AMD",
      name: "Advanced Micro Devices",
      type: "Stock",
      sector: "Semiconductors",
      tv: "NASDAQ:AMD",
      currency: "USD",
      fallback: { price: 156.40, changePct: 1.22, marketCap: 253000000000, pe: 43.2, eps: 3.62, revenue: 22600000000 },
      thesis: "AI-Beschleuniger und Server-CPUs schaffen optionales Wachstum.",
      risks: "Starker Wettbewerb, Margendruck, Erwartungsrisiko.",
      sentiment: 66
    },
    {
      symbol: "INTC",
      name: "Intel Corporation",
      type: "Stock",
      sector: "Semiconductors",
      tv: "NASDAQ:INTC",
      currency: "USD",
      fallback: { price: 31.60, changePct: -0.84, marketCap: 134000000000, pe: 28.0, eps: 1.13, revenue: 54200000000 },
      thesis: "Turnaround-Case mit Foundry-Option und politischer Unterstützung.",
      risks: "Execution-Risiko, hoher Kapitalbedarf, Marktanteilsdruck.",
      sentiment: 45
    },
    {
      symbol: "CRM",
      name: "Salesforce Inc.",
      type: "Stock",
      sector: "Software",
      tv: "NYSE:CRM",
      currency: "USD",
      fallback: { price: 286.00, changePct: 0.36, marketCap: 276000000000, pe: 30.7, eps: 9.31, revenue: 34900000000 },
      thesis: "Enterprise-Software mit Margenfokus, AI-Add-ons und hohem Free Cashflow.",
      risks: "Wachstumsverlangsamung, Wettbewerb, M&A-Risiko.",
      sentiment: 64
    },
    {
      symbol: "ORCL",
      name: "Oracle Corporation",
      type: "Stock",
      sector: "Software",
      tv: "NYSE:ORCL",
      currency: "USD",
      fallback: { price: 124.20, changePct: 0.51, marketCap: 340000000000, pe: 25.6, eps: 4.85, revenue: 53000000000 },
      thesis: "Cloud-Infrastruktur und Datenbankgeschäft liefern robuste Enterprise-Nachfrage.",
      risks: "Schulden, Cloud-Wettbewerb, Bewertungsrisiko.",
      sentiment: 63
    },
    {
      symbol: "IBM",
      name: "IBM",
      type: "Stock",
      sector: "Technology",
      tv: "NYSE:IBM",
      currency: "USD",
      fallback: { price: 184.10, changePct: 0.18, marketCap: 169000000000, pe: 20.4, eps: 9.03, revenue: 61900000000 },
      thesis: "Hybrid Cloud, Consulting und Mainframe-Qualität mit defensiverem Profil.",
      risks: "Begrenztes Wachstum, Consulting-Zyklus, Legacy-Anteil.",
      sentiment: 58
    },
    {
      symbol: "NFLX",
      name: "Netflix Inc.",
      type: "Stock",
      sector: "Communication Services",
      tv: "NASDAQ:NFLX",
      currency: "USD",
      fallback: { price: 628.30, changePct: 0.77, marketCap: 270000000000, pe: 36.9, eps: 17.03, revenue: 33700000000 },
      thesis: "Streaming-Leader mit Preissetzungsmacht, Werbung und Passwort-Monetarisierung.",
      risks: "Content-Kosten, Wettbewerb, Abonnentenwachstum.",
      sentiment: 67
    },
    {
      symbol: "ADBE",
      name: "Adobe Inc.",
      type: "Stock",
      sector: "Software",
      tv: "NASDAQ:ADBE",
      currency: "USD",
      fallback: { price: 514.60, changePct: -0.22, marketCap: 231000000000, pe: 30.5, eps: 16.87, revenue: 19400000000 },
      thesis: "Kreativsoftware mit starker Marge und AI-Monetarisierung.",
      risks: "AI-Disruption, Bewertung, Wachstumstempo.",
      sentiment: 59
    },
    {
      symbol: "NOW",
      name: "ServiceNow Inc.",
      type: "Stock",
      sector: "Software",
      tv: "NYSE:NOW",
      currency: "USD",
      fallback: { price: 742.90, changePct: 0.68, marketCap: 153000000000, pe: 54.1, eps: 13.73, revenue: 8970000000 },
      thesis: "Workflow-Plattform mit hohem Enterprise-Lock-in und AI-Automation.",
      risks: "Hohe Bewertung, Enterprise-Budgetzyklen.",
      sentiment: 68
    },
    {
      symbol: "PLTR",
      name: "Palantir Technologies",
      type: "Stock",
      sector: "Software",
      tv: "NYSE:PLTR",
      currency: "USD",
      fallback: { price: 23.80, changePct: 2.35, marketCap: 53000000000, pe: 68.0, eps: 0.35, revenue: 2250000000 },
      thesis: "AI-Plattform mit starkem Narrativ und wachsender kommerzieller Nutzung.",
      risks: "Bewertung, Hype-Risiko, Projektzyklen.",
      sentiment: 72
    },
    {
      symbol: "JPM",
      name: "JPMorgan Chase",
      type: "Stock",
      sector: "Financials",
      tv: "NYSE:JPM",
      currency: "USD",
      fallback: { price: 198.70, changePct: 0.29, marketCap: 572000000000, pe: 12.4, eps: 16.02, revenue: 158000000000 },
      thesis: "Qualitätsbank mit starker Einlagenbasis, Kapitalmarktgeschäft und Risikomanagement.",
      risks: "Kreditzyklus, Regulierung, Zinskurve.",
      sentiment: 65
    },
    {
      symbol: "BAC",
      name: "Bank of America",
      type: "Stock",
      sector: "Financials",
      tv: "NYSE:BAC",
      currency: "USD",
      fallback: { price: 37.20, changePct: -0.12, marketCap: 292000000000, pe: 11.3, eps: 3.29, revenue: 98500000000 },
      thesis: "Große US-Bank mit starkem Retail-Netz und Zinshebel.",
      risks: "Kreditqualität, Duration im Bond-Portfolio, Zinswende.",
      sentiment: 55
    },
    {
      symbol: "GS",
      name: "Goldman Sachs",
      type: "Stock",
      sector: "Financials",
      tv: "NYSE:GS",
      currency: "USD",
      fallback: { price: 427.40, changePct: 0.41, marketCap: 138000000000, pe: 13.8, eps: 30.97, revenue: 46200000000 },
      thesis: "Kapitalmarkt- und Advisory-Hebel bei steigender Deal-Aktivität.",
      risks: "Zyklische Erträge, Trading-Volatilität, Regulierung.",
      sentiment: 60
    },
    {
      symbol: "V",
      name: "Visa Inc.",
      type: "Stock",
      sector: "Financials",
      tv: "NYSE:V",
      currency: "USD",
      fallback: { price: 278.90, changePct: 0.24, marketCap: 570000000000, pe: 29.1, eps: 9.58, revenue: 32600000000 },
      thesis: "Zahlungsnetzwerk mit hoher Marge, globalem Volumenwachstum und Preissetzungsmacht.",
      risks: "Regulierung, Gebühren-Druck, neue Zahlungswege.",
      sentiment: 70
    },
    {
      symbol: "MA",
      name: "Mastercard Inc.",
      type: "Stock",
      sector: "Financials",
      tv: "NYSE:MA",
      currency: "USD",
      fallback: { price: 462.50, changePct: 0.33, marketCap: 430000000000, pe: 31.8, eps: 14.54, revenue: 25100000000 },
      thesis: "Asset-light Zahlungsnetzwerk mit sehr hoher Qualität und globalem Konsumhebel.",
      risks: "Regulierung, Konsumabschwächung, Wettbewerb.",
      sentiment: 69
    },
    {
      symbol: "XOM",
      name: "Exxon Mobil",
      type: "Stock",
      sector: "Energy",
      tv: "NYSE:XOM",
      currency: "USD",
      fallback: { price: 118.20, changePct: 0.47, marketCap: 468000000000, pe: 13.2, eps: 8.95, revenue: 344000000000 },
      thesis: "Integrierter Energie-Konzern mit Cashflow-Hebel auf Öl und Gas.",
      risks: "Ölpreis, Politik, Energiewende.",
      sentiment: 61
    },
    {
      symbol: "CVX",
      name: "Chevron Corporation",
      type: "Stock",
      sector: "Energy",
      tv: "NYSE:CVX",
      currency: "USD",
      fallback: { price: 162.10, changePct: 0.21, marketCap: 300000000000, pe: 12.7, eps: 12.76, revenue: 200000000000 },
      thesis: "Solide Bilanz, Dividendenprofil und Ölpreis-Exposure.",
      risks: "Rohstoffzyklus, Projektkosten, Regulierung.",
      sentiment: 59
    },
    {
      symbol: "LLY",
      name: "Eli Lilly",
      type: "Stock",
      sector: "Healthcare",
      tv: "NYSE:LLY",
      currency: "USD",
      fallback: { price: 782.40, changePct: 0.88, marketCap: 743000000000, pe: 58.0, eps: 13.49, revenue: 34100000000 },
      thesis: "GLP-1, Diabetes und Pipeline schaffen starkes strukturelles Wachstum.",
      risks: "Hohe Bewertung, Kapazitätsausbau, Patent- und Studiendatenrisiken.",
      sentiment: 74
    },
    {
      symbol: "UNH",
      name: "UnitedHealth Group",
      type: "Stock",
      sector: "Healthcare",
      tv: "NYSE:UNH",
      currency: "USD",
      fallback: { price: 496.20, changePct: -0.35, marketCap: 457000000000, pe: 19.6, eps: 25.32, revenue: 371000000000 },
      thesis: "Gesundheitsplattform mit Versicherungs- und Services-Mix.",
      risks: "Regulatorik, medizinische Kostenquote, politische Debatten.",
      sentiment: 56
    },
    {
      symbol: "JNJ",
      name: "Johnson & Johnson",
      type: "Stock",
      sector: "Healthcare",
      tv: "NYSE:JNJ",
      currency: "USD",
      fallback: { price: 153.70, changePct: 0.05, marketCap: 370000000000, pe: 15.8, eps: 9.73, revenue: 85200000000 },
      thesis: "Defensive Gesundheitsqualität mit Pharma- und MedTech-Geschäft.",
      risks: "Rechtsrisiken, Patentabläufe, langsameres Wachstum.",
      sentiment: 57
    },
    {
      symbol: "PFE",
      name: "Pfizer Inc.",
      type: "Stock",
      sector: "Healthcare",
      tv: "NYSE:PFE",
      currency: "USD",
      fallback: { price: 28.40, changePct: -0.41, marketCap: 161000000000, pe: 11.8, eps: 2.41, revenue: 58500000000 },
      thesis: "Value-/Turnaround-Profil nach Covid-Normalisierung.",
      risks: "Pipeline-Ausführung, Patentdruck, schwache Dynamik.",
      sentiment: 43
    },
    {
      symbol: "WMT",
      name: "Walmart Inc.",
      type: "Stock",
      sector: "Consumer Staples",
      tv: "NYSE:WMT",
      currency: "USD",
      fallback: { price: 61.80, changePct: 0.19, marketCap: 498000000000, pe: 27.6, eps: 2.24, revenue: 648000000000 },
      thesis: "Defensiver Konsumriese mit Omnichannel- und Werbehebel.",
      risks: "Margendruck, Lohnkosten, Bewertung.",
      sentiment: 64
    },
    {
      symbol: "COST",
      name: "Costco Wholesale",
      type: "Stock",
      sector: "Consumer Staples",
      tv: "NASDAQ:COST",
      currency: "USD",
      fallback: { price: 732.50, changePct: 0.31, marketCap: 325000000000, pe: 46.0, eps: 15.92, revenue: 242000000000 },
      thesis: "Mitgliedschaftsmodell, hohe Kundenbindung und Preissetzungsmacht.",
      risks: "Sehr hohe Bewertung, Konsumzyklus.",
      sentiment: 68
    },
    {
      symbol: "HD",
      name: "Home Depot",
      type: "Stock",
      sector: "Consumer Discretionary",
      tv: "NYSE:HD",
      currency: "USD",
      fallback: { price: 346.40, changePct: -0.18, marketCap: 344000000000, pe: 22.4, eps: 15.46, revenue: 153000000000 },
      thesis: "Heimwerker- und Bauzyklus mit starker Marke und Cashflow.",
      risks: "Immobilienzyklus, Zinsen, Konsumabschwächung.",
      sentiment: 54
    },
    {
      symbol: "MCD",
      name: "McDonald's Corporation",
      type: "Stock",
      sector: "Consumer Discretionary",
      tv: "NYSE:MCD",
      currency: "USD",
      fallback: { price: 286.70, changePct: 0.14, marketCap: 207000000000, pe: 24.5, eps: 11.70, revenue: 25400000000 },
      thesis: "Globale Marke, Franchise-Modell und robuste Margen.",
      risks: "Konsumdruck, Inputkosten, Bewertung.",
      sentiment: 60
    },
    {
      symbol: "NKE",
      name: "Nike Inc.",
      type: "Stock",
      sector: "Consumer Discretionary",
      tv: "NYSE:NKE",
      currency: "USD",
      fallback: { price: 92.30, changePct: -0.72, marketCap: 139000000000, pe: 25.2, eps: 3.66, revenue: 51300000000 },
      thesis: "Globale Sportmarke mit Turnaround-Potenzial im Direktvertrieb.",
      risks: "China, Lagerbestände, Wettbewerbsdruck.",
      sentiment: 46
    },
    {
      symbol: "DIS",
      name: "Walt Disney",
      type: "Stock",
      sector: "Communication Services",
      tv: "NYSE:DIS",
      currency: "USD",
      fallback: { price: 113.60, changePct: 0.25, marketCap: 207000000000, pe: 23.5, eps: 4.83, revenue: 88900000000 },
      thesis: "Parks, IP und Streaming-Effizienz können den Turnaround tragen.",
      risks: "Media-Disruption, Kosten, Zyklik.",
      sentiment: 55
    },
    {
      symbol: "BA",
      name: "Boeing",
      type: "Stock",
      sector: "Industrials",
      tv: "NYSE:BA",
      currency: "USD",
      fallback: { price: 178.30, changePct: -1.10, marketCap: 109000000000, pe: null, eps: -3.2, revenue: 77800000000 },
      thesis: "Luftfahrt-Nachfrage ist stark, Turnaround hängt an Qualität und Auslieferungen.",
      risks: "Produktionsprobleme, Sicherheit, Bilanzstress.",
      sentiment: 39
    },
    {
      symbol: "CAT",
      name: "Caterpillar",
      type: "Stock",
      sector: "Industrials",
      tv: "NYSE:CAT",
      currency: "USD",
      fallback: { price: 352.80, changePct: 0.58, marketCap: 174000000000, pe: 17.2, eps: 20.51, revenue: 67100000000 },
      thesis: "Infrastruktur, Mining und Energie stützen zyklische Qualitätsnachfrage.",
      risks: "Konjunkturzyklus, Rohstoffpreise, China.",
      sentiment: 63
    },
    {
      symbol: "DE",
      name: "Deere & Company",
      type: "Stock",
      sector: "Industrials",
      tv: "NYSE:DE",
      currency: "USD",
      fallback: { price: 405.50, changePct: 0.12, marketCap: 112000000000, pe: 13.9, eps: 29.17, revenue: 61200000000 },
      thesis: "Agrartechnik mit Präzisionslandwirtschaft und hoher Kundenbindung.",
      risks: "Agrarzyklus, Finanzierungskosten, Lagerabbau.",
      sentiment: 56
    },
    {
      symbol: "GE",
      name: "GE Aerospace",
      type: "Stock",
      sector: "Industrials",
      tv: "NYSE:GE",
      currency: "USD",
      fallback: { price: 160.40, changePct: 0.66, marketCap: 175000000000, pe: 34.0, eps: 4.72, revenue: 67900000000 },
      thesis: "Aerospace-Fokus mit starkem Servicegeschäft und Flugzeugtriebwerks-Nachfrage.",
      risks: "Bewertung, Lieferketten, Luftfahrtzyklus.",
      sentiment: 67
    },
    {
      symbol: "KO",
      name: "Coca-Cola",
      type: "Stock",
      sector: "Consumer Staples",
      tv: "NYSE:KO",
      currency: "USD",
      fallback: { price: 62.40, changePct: 0.08, marketCap: 269000000000, pe: 22.6, eps: 2.76, revenue: 45800000000 },
      thesis: "Defensive Marke mit globaler Distribution und Preissetzungsmacht.",
      risks: "Währungsdruck, Zuckerregulierung, langsames Wachstum.",
      sentiment: 59
    },
    {
      symbol: "PEP",
      name: "PepsiCo",
      type: "Stock",
      sector: "Consumer Staples",
      tv: "NASDAQ:PEP",
      currency: "USD",
      fallback: { price: 172.80, changePct: 0.11, marketCap: 237000000000, pe: 21.9, eps: 7.89, revenue: 91400000000 },
      thesis: "Snacks und Getränke liefern defensives Wachstum mit Markenstärke.",
      risks: "Inputkosten, Währung, Bewertung.",
      sentiment: 58
    },
    {
      symbol: "PG",
      name: "Procter & Gamble",
      type: "Stock",
      sector: "Consumer Staples",
      tv: "NYSE:PG",
      currency: "USD",
      fallback: { price: 163.20, changePct: 0.16, marketCap: 385000000000, pe: 24.0, eps: 6.80, revenue: 82000000000 },
      thesis: "Premium-Konsumgüter mit stabiler Nachfrage und Preissetzungsmacht.",
      risks: "Währung, Rohstoffkosten, schwächeres Volumenwachstum.",
      sentiment: 60
    },
    {
      symbol: "TMO",
      name: "Thermo Fisher Scientific",
      type: "Stock",
      sector: "Healthcare",
      tv: "NYSE:TMO",
      currency: "USD",
      fallback: { price: 575.40, changePct: 0.27, marketCap: 220000000000, pe: 27.3, eps: 21.07, revenue: 42800000000 },
      thesis: "Life-Science-Werkzeuge mit hoher Qualität und Forschungsexposure.",
      risks: "Biotech-Finanzierungszyklus, China, Bewertung.",
      sentiment: 61
    },
    {
      symbol: "LIN",
      name: "Linde plc",
      type: "Stock",
      sector: "Materials",
      tv: "NASDAQ:LIN",
      currency: "USD",
      fallback: { price: 452.70, changePct: 0.32, marketCap: 218000000000, pe: 29.5, eps: 15.35, revenue: 32800000000 },
      thesis: "Industriegase mit starkem Burggraben und defensiver Marge.",
      risks: "Industriezyklus, Energiepreise, Währung.",
      sentiment: 65
    },
    {
      symbol: "ASML",
      name: "ASML Holding",
      type: "Stock",
      sector: "Semiconductors",
      tv: "EURONEXT:ASML",
      currency: "EUR",
      fallback: { price: 880.00, changePct: 0.73, marketCap: 345000000000, pe: 38.4, eps: 22.92, revenue: 27600000000 },
      thesis: "Schlüsselanbieter für Lithografie und Engpass im Halbleiter-Ökosystem.",
      risks: "China-Restriktionen, Capex-Zyklus, hohe Bewertung.",
      sentiment: 70
    },
    {
      symbol: "SAP",
      name: "SAP SE",
      type: "Stock",
      sector: "Software",
      tv: "XETR:SAP",
      currency: "EUR",
      fallback: { price: 184.50, changePct: 0.42, marketCap: 225000000000, pe: 32.1, eps: 5.75, revenue: 31300000000 },
      thesis: "Europäischer Software-Champion mit Cloud-Migration und hoher Kundenbindung.",
      risks: "Transformationskosten, Wettbewerb, Bewertung.",
      sentiment: 66
    },
    {
      symbol: "SIE.DE",
      name: "Siemens AG",
      type: "Stock",
      sector: "Industrials",
      tv: "XETR:SIE",
      currency: "EUR",
      fallback: { price: 178.20, changePct: 0.26, marketCap: 142000000000, pe: 18.7, eps: 9.53, revenue: 77800000000 },
      thesis: "Industrieautomation, Software und Elektrifizierung in einem Qualitätsprofil.",
      risks: "China, Industriezyklus, Auftragsdynamik.",
      sentiment: 61
    },
    {
      symbol: "ALV.DE",
      name: "Allianz SE",
      type: "Stock",
      sector: "Financials",
      tv: "XETR:ALV",
      currency: "EUR",
      fallback: { price: 268.30, changePct: 0.19, marketCap: 104000000000, pe: 11.2, eps: 23.95, revenue: 161000000000 },
      thesis: "Versicherungsqualität mit Dividende, Rückkäufen und Kapitalstärke.",
      risks: "Schadensinflation, Kapitalmärkte, Regulierung.",
      sentiment: 62
    },
    {
      symbol: "BMW.DE",
      name: "BMW AG",
      type: "Stock",
      sector: "Consumer Discretionary",
      tv: "XETR:BMW",
      currency: "EUR",
      fallback: { price: 104.80, changePct: -0.32, marketCap: 64000000000, pe: 6.2, eps: 16.90, revenue: 155000000000 },
      thesis: "Premium-Autohersteller mit Value-Profil und China-Exposure.",
      risks: "EV-Wettbewerb, China, Margendruck.",
      sentiment: 49
    },
    {
      symbol: "AIR.PA",
      name: "Airbus SE",
      type: "Stock",
      sector: "Industrials",
      tv: "EURONEXT:AIR",
      currency: "EUR",
      fallback: { price: 158.60, changePct: 0.48, marketCap: 126000000000, pe: 27.0, eps: 5.87, revenue: 65500000000 },
      thesis: "Luftfahrt-Backlog und Duopolposition stützen langfristige Nachfrage.",
      risks: "Lieferketten, Produktionshochlauf, Währung.",
      sentiment: 64
    },
    {
      symbol: "MC.PA",
      name: "LVMH",
      type: "Stock",
      sector: "Consumer Discretionary",
      tv: "EURONEXT:MC",
      currency: "EUR",
      fallback: { price: 735.00, changePct: -0.28, marketCap: 369000000000, pe: 23.6, eps: 31.14, revenue: 86200000000 },
      thesis: "Luxusmarktführer mit Markenmacht und globaler Preissetzung.",
      risks: "China-Konsum, Währung, Zyklus im Luxussegment.",
      sentiment: 57
    },
    {
      symbol: "VTI",
      name: "Vanguard Total Stock Market ETF",
      type: "ETF",
      sector: "US Total Market",
      tv: "AMEX:VTI",
      currency: "USD",
      fallback: { price: 257.60, changePct: 0.28, marketCap: null, pe: null, eps: null, revenue: null },
      thesis: "Breiter US-Gesamtmarkt mit Large-, Mid- und Small-Cap-Anteil.",
      risks: "US-Bewertung, Dollar-Risiko, breite Marktzyklen.",
      sentiment: 60
    },
    {
      symbol: "IWM",
      name: "iShares Russell 2000 ETF",
      type: "ETF",
      sector: "US Small Caps",
      tv: "AMEX:IWM",
      currency: "USD",
      fallback: { price: 204.80, changePct: -0.44, marketCap: null, pe: null, eps: null, revenue: null },
      thesis: "Small-Cap-Proxy mit hohem Zins- und Konjunkturhebel.",
      risks: "Finanzierungskosten, schwächere Margen, Rezessionsrisiko.",
      sentiment: 48
    },
    {
      symbol: "DIA",
      name: "SPDR Dow Jones Industrial Average ETF",
      type: "ETF",
      sector: "US Blue Chips",
      tv: "AMEX:DIA",
      currency: "USD",
      fallback: { price: 390.20, changePct: 0.12, marketCap: null, pe: null, eps: null, revenue: null },
      thesis: "Dow-Industriewerte mit defensiverem Blue-Chip-Profil.",
      risks: "Zyklische Industrieanteile, geringe Tech-Breite.",
      sentiment: 56
    },
    {
      symbol: "GLD",
      name: "SPDR Gold Shares",
      type: "ETF",
      sector: "Precious Metals",
      tv: "AMEX:GLD",
      currency: "USD",
      fallback: { price: 216.40, changePct: 0.22, marketCap: null, pe: null, eps: null, revenue: null },
      thesis: "Gold-ETF als liquide Absicherung gegen Realzins- und Dollar-Risiken.",
      risks: "Steigende Realzinsen, Dollar-Stärke, keine Cashflows.",
      sentiment: 62
    },
    {
      symbol: "SLV",
      name: "iShares Silver Trust",
      type: "ETF",
      sector: "Precious Metals",
      tv: "AMEX:SLV",
      currency: "USD",
      fallback: { price: 26.30, changePct: 0.64, marketCap: null, pe: null, eps: null, revenue: null },
      thesis: "Silber-Exposure mit Edelmetall- und Industriekomponente.",
      risks: "Hohe Volatilität, Industriezyklus, Dollar.",
      sentiment: 58
    },
    {
      symbol: "TLT",
      name: "iShares 20+ Year Treasury Bond ETF",
      type: "ETF",
      sector: "Bonds",
      tv: "NASDAQ:TLT",
      currency: "USD",
      fallback: { price: 91.20, changePct: -0.18, marketCap: null, pe: null, eps: null, revenue: null },
      thesis: "Langlaufende US-Staatsanleihen als Duration- und Rezessions-Hedge.",
      risks: "Steigende Renditen, Inflation, Duration-Risiko.",
      sentiment: 51
    },
    {
      symbol: "EEM",
      name: "iShares MSCI Emerging Markets ETF",
      type: "ETF",
      sector: "Emerging Markets",
      tv: "AMEX:EEM",
      currency: "USD",
      fallback: { price: 41.70, changePct: 0.08, marketCap: null, pe: null, eps: null, revenue: null },
      thesis: "Schwellenländer-Exposure mit China-, Taiwan- und Währungshebel.",
      risks: "Dollar-Stärke, China, politische Risiken.",
      sentiment: 50
    },
    {
      symbol: "OIL",
      name: "WTI Crude Oil",
      type: "Commodity",
      sector: "Energy",
      tv: "TVC:USOIL",
      currency: "USD",
      fallback: { price: 82.40, changePct: 0.96, marketCap: null, pe: null, eps: null, revenue: null },
      thesis: "Ölpreis als Makro-, Inflations- und Energieaktien-Treiber.",
      risks: "OPEC-Politik, Nachfragezyklus, geopolitische Risiken.",
      sentiment: 59
    },
    {
      symbol: "SILVER",
      name: "Silver Spot",
      type: "Commodity",
      sector: "Precious Metals",
      tv: "TVC:SILVER",
      currency: "USD",
      fallback: { price: 28.90, changePct: 0.72, marketCap: null, pe: null, eps: null, revenue: null },
      thesis: "Silber verbindet Edelmetall-Absicherung mit Industrie-Nachfrage.",
      risks: "Volatilität, Dollar, zyklische Nachfrage.",
      sentiment: 58
    },
    {
      symbol: "NOVO",
      name: "Novo Nordisk",
      type: "Stock",
      sector: "Healthcare",
      tv: "OMXCOP:NOVO_B",
      currency: "DKK",
      fallback: { price: 890.00, changePct: 0.42, marketCap: 520000000000, pe: 37.6, eps: 23.4, revenue: 232000000000 },
      thesis: "GLP-1-Marktführer mit starkem Wachstum und hoher Preissetzungsmacht.",
      risks: "Kapazität, Wettbewerb, regulatorischer Preisdruck.",
      sentiment: 72
    },
    {
      symbol: "TM",
      name: "Toyota Motor",
      type: "Stock",
      sector: "Consumer Discretionary",
      tv: "NYSE:TM",
      currency: "USD",
      fallback: { price: 221.40, changePct: 0.24, marketCap: 300000000000, pe: 10.8, eps: 20.5, revenue: 305000000000 },
      thesis: "Globaler Auto-Qualitätswert mit Hybrid-Stärke, Produktionsskala und Japan-Exposure.",
      risks: "Währung, EV-Wettbewerb, zyklische Autonachfrage.",
      sentiment: 56
    },
    {
      symbol: "SHEL",
      name: "Shell",
      type: "Stock",
      sector: "Energy",
      tv: "NYSE:SHEL",
      currency: "USD",
      fallback: { price: 72.80, changePct: 0.44, marketCap: 230000000000, pe: 12.2, eps: 5.9, revenue: 316000000000 },
      thesis: "Energie-Major mit LNG-Hebel, Dividendenprofil und Öl-/Gas-Cashflow.",
      risks: "Energiepreise, Regulierung, Energiewende.",
      sentiment: 57
    },
    {
      symbol: "BP",
      name: "BP plc",
      type: "Stock",
      sector: "Energy",
      tv: "NYSE:BP",
      currency: "USD",
      fallback: { price: 38.20, changePct: 0.18, marketCap: 105000000000, pe: 8.9, eps: 4.3, revenue: 213000000000 },
      thesis: "Value-lastiger Energie-Titel mit hohem Rohstoffhebel und Restrukturierungspotenzial.",
      risks: "Ölpreis, Bilanz, Strategieunsicherheit.",
      sentiment: 50
    },
    {
      symbol: "RIO",
      name: "Rio Tinto",
      type: "Stock",
      sector: "Materials",
      tv: "NYSE:RIO",
      currency: "USD",
      fallback: { price: 68.70, changePct: -0.22, marketCap: 112000000000, pe: 10.7, eps: 6.4, revenue: 54000000000 },
      thesis: "Rohstoff-Exposure auf Eisenerz, Kupfer und Industrienachfrage.",
      risks: "China-Zyklus, Rohstoffpreise, politische Risiken.",
      sentiment: 49
    },
    {
      symbol: "TSM",
      name: "Taiwan Semiconductor",
      type: "Stock",
      sector: "Semiconductors",
      tv: "NYSE:TSM",
      currency: "USD",
      fallback: { price: 145.20, changePct: 1.02, marketCap: 760000000000, pe: 27.9, eps: 5.2, revenue: 69300000000 },
      thesis: "Foundry-Marktführer und zentrale Infrastruktur für AI-, Apple- und Chipzyklen.",
      risks: "Geopolitik, Taiwan-Risiko, Capex-Zyklus.",
      sentiment: 73
    },
    {
      symbol: "BABA",
      name: "Alibaba",
      type: "Stock",
      sector: "Consumer Discretionary",
      tv: "NYSE:BABA",
      currency: "USD",
      fallback: { price: 76.10, changePct: -0.48, marketCap: 185000000000, pe: 10.4, eps: 7.3, revenue: 130000000000 },
      thesis: "China-Internet-Value mit Cloud-, Commerce- und Rückkaufhebel.",
      risks: "China-Regulierung, Konsum, geopolitische Risiken.",
      sentiment: 45
    },
    {
      symbol: "SHOP",
      name: "Shopify",
      type: "Stock",
      sector: "Software",
      tv: "NYSE:SHOP",
      currency: "USD",
      fallback: { price: 74.80, changePct: 1.34, marketCap: 96000000000, pe: 58.0, eps: 1.3, revenue: 7100000000 },
      thesis: "Commerce-Software mit Händlernetzwerk, Payments und Operating-Leverage-Potenzial.",
      risks: "Bewertung, Konsumzyklus, Wettbewerb.",
      sentiment: 64
    },
    {
      symbol: "UBER",
      name: "Uber Technologies",
      type: "Stock",
      sector: "Consumer Discretionary",
      tv: "NYSE:UBER",
      currency: "USD",
      fallback: { price: 69.60, changePct: 0.88, marketCap: 145000000000, pe: 46.5, eps: 1.5, revenue: 37200000000 },
      thesis: "Plattform mit Mobilität, Delivery und wachsendem Free-Cashflow-Profil.",
      risks: "Regulierung, Fahrer-Kosten, Wettbewerb.",
      sentiment: 63
    },
    {
      symbol: "ABNB",
      name: "Airbnb",
      type: "Stock",
      sector: "Consumer Discretionary",
      tv: "NASDAQ:ABNB",
      currency: "USD",
      fallback: { price: 150.40, changePct: -0.12, marketCap: 96000000000, pe: 34.8, eps: 4.3, revenue: 9900000000 },
      thesis: "Reiseplattform mit Asset-light-Modell, Marke und globalem Netzwerk.",
      risks: "Regulierung, Reisezyklus, Nachfrageabschwächung.",
      sentiment: 55
    },
    {
      symbol: "PANW",
      name: "Palo Alto Networks",
      type: "Stock",
      sector: "Software",
      tv: "NASDAQ:PANW",
      currency: "USD",
      fallback: { price: 303.80, changePct: 1.12, marketCap: 98000000000, pe: 48.0, eps: 6.3, revenue: 8000000000 },
      thesis: "Cybersecurity-Plattform mit Konsolidierungsthese und Enterprise-Budget-Priorität.",
      risks: "Bewertung, Plattform-Umstellung, Wettbewerb.",
      sentiment: 68
    },
    {
      symbol: "SNOW",
      name: "Snowflake",
      type: "Stock",
      sector: "Software",
      tv: "NYSE:SNOW",
      currency: "USD",
      fallback: { price: 148.20, changePct: -0.76, marketCap: 50000000000, pe: null, eps: -0.4, revenue: 2800000000 },
      thesis: "Datenplattform mit AI-Daten-Narrativ und hohem Netto-Retention-Potenzial.",
      risks: "Wachstumsverlangsamung, Bewertung, Margenpfad.",
      sentiment: 52
    },
    {
      symbol: "MELI",
      name: "MercadoLibre",
      type: "Stock",
      sector: "Consumer Discretionary",
      tv: "NASDAQ:MELI",
      currency: "USD",
      fallback: { price: 1620.00, changePct: 0.69, marketCap: 82000000000, pe: 55.0, eps: 29.4, revenue: 14500000000 },
      thesis: "Lateinamerika-Commerce- und Fintech-Plattform mit strukturellem Wachstum.",
      risks: "Währungsrisiko, politische Risiken, Bewertung.",
      sentiment: 66
    },
    {
      symbol: "SOL",
      name: "Solana",
      type: "Crypto",
      sector: "Digital Assets",
      tv: "BINANCE:SOLUSDT",
      coingeckoId: "solana",
      currency: "USD",
      fallback: { price: 146.50, changePct: 2.10, marketCap: 65000000000, pe: null, eps: null, revenue: null },
      thesis: "Schnelle Smart-Contract-Plattform mit hoher Aktivität und Meme-/DeFi-Beta.",
      risks: "Netzwerkstabilität, Regulierung, hohe Krypto-Volatilität.",
      sentiment: 67
    }
  ];

  const ANALYTIC_DATA = {
    AAPL: { rsi: 58, momentum: 57, volume: 52, trend: 62, volatility: 38, value: 52, growth: 61, quality: 86, performance1m: 4.2, performance6m: 13.8, margin: 26.2, grossMargin: 45.9, profit: 96995000000, cashflow: 110500000000, debt: 108000000000, revenueGrowth: 2.1, levels: { support: 191, resistance: 215 } },
    NVDA: { rsi: 66, momentum: 82, volume: 78, trend: 84, volatility: 67, value: 31, growth: 94, quality: 82, performance1m: 12.5, performance6m: 78.4, margin: 48.8, grossMargin: 73.5, profit: 29760000000, cashflow: 28100000000, debt: 9700000000, revenueGrowth: 125.8, levels: { support: 820, resistance: 945 } },
    TSLA: { rsi: 41, momentum: 34, volume: 62, trend: 38, volatility: 76, value: 38, growth: 49, quality: 47, performance1m: -8.4, performance6m: -22.1, margin: 8.2, grossMargin: 18.2, profit: 14997000000, cashflow: 4357000000, debt: 9700000000, revenueGrowth: 18.8, levels: { support: 162, resistance: 196 } },
    META: { rsi: 61, momentum: 68, volume: 56, trend: 71, volatility: 45, value: 62, growth: 78, quality: 84, performance1m: 6.9, performance6m: 41.3, margin: 29.7, grossMargin: 80.7, profit: 39098000000, cashflow: 71110000000, debt: 37700000000, revenueGrowth: 15.7, levels: { support: 462, resistance: 520 } },
    MSFT: { rsi: 60, momentum: 64, volume: 51, trend: 74, volatility: 34, value: 53, growth: 76, quality: 91, performance1m: 5.1, performance6m: 28.2, margin: 36.7, grossMargin: 69.4, profit: 82540000000, cashflow: 87580000000, debt: 97800000000, revenueGrowth: 15.6, levels: { support: 398, resistance: 442 } },
    AMZN: { rsi: 57, momentum: 59, volume: 54, trend: 67, volatility: 49, value: 49, growth: 73, quality: 72, performance1m: 4.7, performance6m: 31.5, margin: 5.3, grossMargin: 46.9, profit: 30425000000, cashflow: 84900000000, debt: 135600000000, revenueGrowth: 11.8, levels: { support: 171, resistance: 192 } },
    SPY: { rsi: 56, momentum: 55, volume: 50, trend: 63, volatility: 31, value: 55, growth: 52, quality: 78, performance1m: 2.7, performance6m: 16.4, margin: null, grossMargin: null, profit: null, cashflow: null, debt: null, revenueGrowth: null, levels: { support: 512, resistance: 535 } },
    QQQ: { rsi: 59, momentum: 62, volume: 52, trend: 68, volatility: 43, value: 44, growth: 68, quality: 76, performance1m: 4.1, performance6m: 25.6, margin: null, grossMargin: null, profit: null, cashflow: null, debt: null, revenueGrowth: null, levels: { support: 432, resistance: 462 } },
    DAX: { rsi: 49, momentum: 44, volume: 46, trend: 51, volatility: 37, value: 58, growth: 40, quality: 62, performance1m: 1.1, performance6m: 10.2, margin: null, grossMargin: null, profit: null, cashflow: null, debt: null, revenueGrowth: null, levels: { support: 18100, resistance: 18900 } },
    GOLD: { rsi: 55, momentum: 58, volume: 48, trend: 61, volatility: 35, value: 50, growth: 42, quality: 70, performance1m: 3.4, performance6m: 14.9, margin: null, grossMargin: null, profit: null, cashflow: null, debt: null, revenueGrowth: null, levels: { support: 2280, resistance: 2390 } },
    BTC: { rsi: 63, momentum: 69, volume: 74, trend: 72, volatility: 86, value: 35, growth: 80, quality: 54, performance1m: 8.8, performance6m: 52.6, margin: null, grossMargin: null, profit: null, cashflow: null, debt: null, revenueGrowth: null, levels: { support: 59800, resistance: 69000 } },
    ETH: { rsi: 59, momentum: 63, volume: 69, trend: 65, volatility: 82, value: 37, growth: 74, quality: 57, performance1m: 6.2, performance6m: 39.1, margin: null, grossMargin: null, profit: null, cashflow: null, debt: null, revenueGrowth: null, levels: { support: 2920, resistance: 3420 } }
  };

  const INSIDER_INSTITUTIONAL_DATA = {
    AAPL: {
      insiderScore: 58,
      buySellRatio: 0.7,
      topShareholders: [["Vanguard Group", 8.6], ["BlackRock", 6.8], ["Berkshire Hathaway", 5.9]],
      holdings: [["Vanguard Total Stock Market", 2.9, "+0.2%"], ["SPDR S&P 500 ETF", 1.1, "stabil"], ["iShares Core S&P 500", 1.0, "+0.1%"]],
      changes: [["Berkshire Hathaway", "Reduziert", "-8.5%"], ["Vanguard", "Erhöht", "+0.7%"], ["BlackRock", "Stabil", "+0.1%"]],
      buys: [["Director", "Kauf", "18.000", "Fallback"], ["VP Services", "Kauf", "6.200", "Fallback"]],
      sells: [["CFO", "Verkauf", "24.000", "Fallback"], ["General Counsel", "Verkauf", "9.500", "Fallback"]]
    },
    NVDA: {
      insiderScore: 64,
      buySellRatio: 0.5,
      topShareholders: [["Vanguard Group", 8.1], ["BlackRock", 7.4], ["Fidelity", 4.2]],
      holdings: [["QQQ", 4.8, "+1.6%"], ["Vanguard Growth ETF", 2.7, "+1.1%"], ["iShares Semiconductor ETF", 1.8, "+2.4%"]],
      changes: [["Fidelity", "Erhöht", "+3.8%"], ["Vanguard", "Erhöht", "+1.2%"], ["Insider gesamt", "Reduziert", "-0.6%"]],
      buys: [["Director", "Kauf", "4.000", "Fallback"]],
      sells: [["CEO/C-Level", "Verkauf", "120.000", "Planverkauf"], ["Director", "Verkauf", "22.000", "Fallback"]]
    },
    TSLA: {
      insiderScore: 42,
      buySellRatio: 0.3,
      topShareholders: [["Elon Musk", 20.5], ["Vanguard Group", 7.2], ["BlackRock", 5.9]],
      holdings: [["ARK Innovation ETF", 6.2, "-1.8%"], ["Vanguard Total Stock Market", 1.5, "stabil"], ["QQQ", 1.2, "-0.4%"]],
      changes: [["ARK", "Reduziert", "-2.1%"], ["BlackRock", "Stabil", "+0.1%"], ["Retail Proxy", "Erhöht", "+1.9%"]],
      buys: [["Director", "Kauf", "2.500", "Fallback"]],
      sells: [["Executive", "Verkauf", "35.000", "Fallback"], ["Director", "Verkauf", "12.000", "Fallback"]]
    },
    MSFT: {
      insiderScore: 69,
      buySellRatio: 0.9,
      topShareholders: [["Vanguard Group", 8.7], ["BlackRock", 7.2], ["State Street", 3.8]],
      holdings: [["SPY", 6.9, "+0.3%"], ["QQQ", 5.2, "+0.8%"], ["Vanguard Growth ETF", 3.1, "+0.5%"]],
      changes: [["Vanguard", "Erhöht", "+0.8%"], ["State Street", "Stabil", "+0.1%"], ["BlackRock", "Erhöht", "+0.4%"]],
      buys: [["Director", "Kauf", "8.400", "Fallback"], ["Executive", "Kauf", "3.100", "Fallback"]],
      sells: [["CFO", "Verkauf", "16.000", "Planverkauf"]]
    }
  };

  const ETF_DATA = [
    {
      symbol: "SPY",
      name: "SPDR S&P 500 ETF Trust",
      ter: 0.09,
      distribution: "Ausschüttend",
      currency: "USD",
      region: [["USA", 96], ["Europa", 2], ["Sonstige", 2]],
      holdings: [["MSFT", 7.1], ["AAPL", 6.4], ["NVDA", 5.8], ["AMZN", 3.7], ["META", 2.5]],
      risk: "Breiter US-Markt, aber Mega-Cap-Konzentration.",
      fxRisk: "USD-Risiko für EUR-Anleger",
      useCase: "US-Kernbaustein für breite Large-Cap-Exposure.",
      structure: "Physisch replizierend, sehr liquide, stark USA-lastig.",
      dataNote: "Lokales ETF-Modell mit TER, Holdings und Regionen."
    },
    {
      symbol: "QQQ",
      name: "Invesco QQQ Trust",
      ter: 0.20,
      distribution: "Ausschüttend",
      currency: "USD",
      region: [["USA", 97], ["Global", 3]],
      holdings: [["MSFT", 8.7], ["NVDA", 7.9], ["AAPL", 7.4], ["AMZN", 5.1], ["META", 4.8]],
      risk: "Tech- und Growth-Konzentration.",
      fxRisk: "USD-Risiko, hohe Zins-Sensitivität",
      useCase: "Satellit für Nasdaq-, AI- und Growth-Exposure.",
      structure: "Sehr liquide, aber stärker konzentriert als ein Welt-ETF.",
      dataNote: "Lokales ETF-Modell, keine Live-Holdings."
    },
    {
      symbol: "VTI",
      name: "Vanguard Total Stock Market ETF",
      ter: 0.03,
      distribution: "Ausschüttend",
      currency: "USD",
      region: [["USA", 99], ["Sonstige", 1]],
      holdings: [["MSFT", 6.2], ["AAPL", 5.6], ["NVDA", 5.0], ["AMZN", 3.2], ["META", 2.1]],
      risk: "US-Gesamtmarkt mit Small-/Mid-Cap-Anteil.",
      fxRisk: "USD-Risiko für EUR-Anleger",
      useCase: "Sehr günstiger US-Gesamtmarkt-Baustein.",
      structure: "Breiter als SPY, aber weiterhin fast vollständig USA.",
      dataNote: "Lokale TER-/Regionen-/Holding-Basis."
    },
    {
      symbol: "VWCE",
      name: "Vanguard FTSE All-World UCITS ETF",
      ter: 0.22,
      distribution: "Thesaurierend",
      currency: "EUR",
      region: [["USA", 61], ["Europa", 16], ["Asien", 17], ["Sonstige", 6]],
      holdings: [["MSFT", 4.2], ["AAPL", 3.8], ["NVDA", 3.4], ["AMZN", 2.4], ["META", 1.6]],
      risk: "Globaler Aktienmarkt, USA trotzdem dominierend.",
      fxRisk: "Mehrwährungs-Exposure im Fonds",
      useCase: "Ein-Fonds-Weltportfolio für langfristige Kernanlage.",
      structure: "UCITS, thesaurierend, global diversifiziert.",
      dataNote: "Lokales UCITS-ETF-Modell."
    }
  ];

  const MACRO_EXTENSIONS = [
    { id: "ECB", label: "EZB / ECB Policy Rate", display: "4.00%", trend: "Restriktiv, Zinspfad wird datenabhängig", why: "Relevant für EUR, DAX, Banken und Bewertungsmultiples.", meaning: "Fallende Zinsen entlasten Finanzierungskosten; steigende Zinsen drücken Risikoassets.", source: "ECB Open-Data-Struktur", status: "fallback", bucket: "Zinsen", pressure: -1 },
    { id: "M1", label: "Geldmenge M1", display: "-4.2% YoY", trend: "Enge Liquidität bleibt rückläufig", why: "M1 zeigt sofort verfügbare Geldbestände wie Bargeld und Sichteinlagen.", meaning: "Schrumpfendes M1 kann kurzfristigen Risikoappetit und Kreditimpulse dämpfen.", source: "FRED/ECB Liquiditätsmodell", status: "fallback", bucket: "Geldmengen", pressure: -1 },
    { id: "M2", label: "Geldmenge M2", display: "+1.8% YoY", trend: "Breitere Liquidität stabilisiert sich", why: "M2 ist ein zentraler Liquiditätsproxy für Risikoassets, Kreditbedingungen und Cash im System.", meaning: "Steigendes M2 kann Risk-on unterstützen; fallendes M2 wirkt bremsend.", source: "FRED M2 + lokaler Fallback", status: "fallback", bucket: "Geldmengen", pressure: 1 },
    { id: "M3", label: "Geldmenge M3", display: "+0.9% YoY", trend: "Euro-Liquidität wächst nur moderat", why: "M3 ist für Europa besonders relevant, weil es Einlagen, Geldmarktfonds und breitere Geldbestände abbildet.", meaning: "Schwaches M3-Wachstum spricht für vorsichtige Kredit- und Liquiditätsbedingungen.", source: "ECB M3-Struktur + Fallback", status: "fallback", bucket: "Geldmengen", pressure: 0 },
    { id: "M4", label: "Geldmenge M4", display: "+1.1% YoY", trend: "Breite globale Liquidität bleibt verhalten", why: "M4 hilft als breiteres Liquiditätsbild für UK/Global-Kontext und institutionelle Geldbestände.", meaning: "Kräftiges M4-Wachstum kann Risikoassets stützen; schwaches Wachstum macht Selektion wichtiger.", source: "Globaler M4-Fallback", status: "fallback", bucket: "Geldmengen", pressure: 0 },
    { id: "REALYIELD", label: "Realzins", display: "1.25%", trend: "Positiver Realzins bleibt Bewertungsbremse", why: "Realzinsen beeinflussen Gold, Growth-Aktien, Krypto und Bewertungsmultiples.", meaning: "Steigende Realzinsen belasten Gold/Growth; fallende Realzinsen helfen oft.", source: "Treasury/FRED Realzins-Modell", status: "fallback", bucket: "Zinsen", pressure: -1 },
    { id: "YCURVE", label: "Yield Curve 2Y-10Y", display: "-0.38%", trend: "Inversion bleibt, aber weniger extrem", why: "Die 2Y-10Y-Kurve ist ein klassischer Konjunktur- und Rezessionsindikator.", meaning: "Starke Inversion signalisiert Stress; Re-Steepening kann Wendepunkt oder Rezessionsnähe anzeigen.", source: "Treasury/FRED Spread-Fallback", status: "fallback", bucket: "Zinsen", pressure: -1 }
  ];

  const LIQUIDITY_DATA = [
    ...MACRO_EXTENSIONS.filter((item) => ["M1", "M2", "M3", "M4", "REALYIELD", "YCURVE"].includes(item.id)),
    {
      id: "CBBS",
      label: "Zentralbank-Bilanz",
      display: "-2.4% YoY",
      trend: "Bilanzliquidität bleibt restriktiv",
      why: "Zentralbank-Bilanzen zeigen, ob dem System Liquidität zugeführt oder entzogen wird.",
      meaning: "Ausweitung kann Risikoassets unterstützen; Schrumpfung kann Liquidität verknappen.",
      source: "FRED/ECB Bilanz-Fallback",
      status: "fallback",
      bucket: "Liquidität",
      pressure: -1
    }
  ];

  const LIQUIDITY_IMPACT_MAP = [
    {
      asset: "Aktien",
      signal: "Selektiv",
      text: "Stabile M2-Daten helfen, aber positive Realzinsen und eine inverse Kurve bremsen Bewertungsmultiples. Qualität und Cashflow zählen stärker als Hype.",
      watch: "M2-Wachstum, 10Y-Rendite, Earnings-Revisionen"
    },
    {
      asset: "Gold",
      signal: "Sensibel für Realzins",
      text: "Gold profitiert eher von fallenden Realzinsen oder Stresssignalen. Hohe reale Renditen bleiben ein Gegenwind.",
      watch: "Realzins, DXY, Zentralbanknachfrage"
    },
    {
      asset: "Krypto",
      signal: "Liquiditätshebel",
      text: "Krypto reagiert oft stark auf globale Liquidität und Risk-on-Phasen. Sinkende Liquidität erhöht Rückschlagsrisiko.",
      watch: "M2, Stablecoin-/Retail-Flow, Risikoappetit"
    },
    {
      asset: "Anleihen",
      signal: "Kurvenrisiko",
      text: "Eine inverse Kurve zeigt Stress im Zinszyklus. Re-Steepening kann Chancen bringen, aber auch eine Wachstumsabkühlung anzeigen.",
      watch: "2Y-10Y Spread, Fed Funds, Treasury-Kurve"
    }
  ];

  const EVENT_PROVIDER_SLOTS = [
    {
      name: "Finnhub Earnings Calendar",
      provider: "Finnhub",
      status: "active",
      providerId: "finnhub",
      coverage: "Earnings Calendar, Company News und Asset-Termine über /api/finnhub",
      source: "Finnhub via Vercel Function"
    },
    {
      name: "Alpha Vantage Zusatzkalender",
      provider: "Alpha Vantage",
      status: "mapped",
      providerId: "alphaVantage",
      coverage: "IPO Calendar, Earnings-Zusatz und Marktzeitreihen als klarer Zusatzpfad",
      source: "Alpha Vantage API Slot"
    },
    {
      name: "SEC / EDGAR Filings",
      provider: "SEC / EDGAR",
      status: "mapped",
      providerId: "sec",
      coverage: "Offizielle Filings, Submissions und XBRL als spätere Ereignis- und Fundamentaldatenbasis",
      source: "SEC Open Data"
    },
    {
      name: "Lokaler Event-Fallback",
      provider: "MH Analytics",
      status: "fallback",
      coverage: "Earnings, Dividenden, Splits und Makrotermine bleiben auch ohne Live-Abruf sichtbar",
      source: "Lokale strukturierte Event-Daten"
    }
  ];

  const DASHBOARD_MODES = {
    standard: ["macro", "liquidity", "topPicks", "watchlist", "sentiment"],
    investor: ["watchlist", "macro", "liquidity", "etf", "portfolio"],
    trader: ["topPicks", "screener", "watchlist", "alerts", "sentiment"],
    learning: ["research", "macro", "liquidity", "etf", "watchlist"]
  };

  const DEFAULT_PORTFOLIOS = [
    {
      id: "core",
      name: "Core Portfolio",
      type: "real",
      cash: 4500,
      targetCash: 8,
      notes: "Langfristiger Kern mit US-Tech, breitem Markt und Gold-Hedge.",
      positions: [
        { symbol: "MSFT", quantity: 8, avgPrice: 360, country: "USA" },
        { symbol: "NVDA", quantity: 4, avgPrice: 620, country: "USA" },
        { symbol: "SPY", quantity: 20, avgPrice: 480, country: "USA" },
        { symbol: "GOLD", quantity: 2, avgPrice: 2100, country: "Global" }
      ]
    },
    {
      id: "test",
      name: "Test Portfolio",
      type: "test",
      cash: 10000,
      targetCash: 20,
      notes: "Spielwiese für Szenarien und Was-wäre-wenn Simulationen.",
      positions: [
        { symbol: "AAPL", quantity: 10, avgPrice: 180, country: "USA" },
        { symbol: "BTC", quantity: 0.08, avgPrice: 55000, country: "Global" }
      ]
    }
  ];

  const FALLBACK_EVENTS = [
    { title: "NVIDIA Earnings Window", dateOffset: 12, type: "Earnings", symbol: "NVDA", detail: "Markt achtet auf Data-Center-Umsatz, Margen und AI-Capex-Kommentare." },
    { title: "Microsoft Quarterly Results", dateOffset: 18, type: "Earnings", symbol: "MSFT", detail: "Azure-Wachstum und Copilot-Monetarisierung stehen im Fokus." },
    { title: "Apple Product / Services Update", dateOffset: 24, type: "Earnings", symbol: "AAPL", detail: "Services-Margen, iPhone-Zyklus und Kapitalrückflüsse sind relevante Treiber." },
    { title: "Tesla Delivery / Margin Check", dateOffset: 9, type: "Earnings", symbol: "TSLA", detail: "Auslieferungen, Preisdruck und Bruttomarge bleiben Kernrisiken." },
    { title: "US CPI Release", dateOffset: 6, type: "Makro", symbol: "Macro", detail: "Inflation beeinflusst Zinsfantasie, Multiples und Gold/Dollar." },
    { title: "Fed Meeting / Rate Decision", dateOffset: 28, type: "Makro", symbol: "Macro", detail: "Dot Plot, Statement und Pressekonferenz bestimmen den Liquiditätsblick." },
    { title: "EZB Zinsentscheid", dateOffset: 34, type: "Makro", symbol: "DAX", detail: "Wichtig für DAX, EUR/USD und europäische Bewertungsmultiples." },
    { title: "US IPO Window", dateOffset: 10, type: "IPO", symbol: "IPO", detail: "Lokaler IPO-Fallback für Neuemissionen, bis Alpha Vantage IPO-Daten live liefern." },
    { title: "Bitcoin Network / ETF Flow Check", dateOffset: 15, type: "Krypto", symbol: "BTC", detail: "ETF-Flows und Liquidität bleiben kurzfristige Kurstreiber." },
    { title: "SPY Ex-Dividend Reminder", dateOffset: 13, type: "Dividende", symbol: "SPY", detail: "ETF-spezifischer Dividenden-Termin als lokaler Fallback." },
    { title: "Apple Dividend Window", dateOffset: 52, type: "Dividende", symbol: "AAPL", detail: "Lokaler Dividenden-Fallback; spätere Live-Daten über offiziellen Corporate-Action-Adapter." },
    { title: "Amazon Split Monitor", dateOffset: 65, type: "Split", symbol: "AMZN", detail: "Corporate-Action-Slot für Aktiensplits und Reverse Splits vorbereitet." },
    { title: "DAX Dividend Season Check", dateOffset: 74, type: "Dividende", symbol: "DAX", detail: "Europäische Ausschüttungssaison als strukturierter Fallback-Termin." }
  ];

  const FALLBACK_NEWS = [
    {
      symbols: ["NVDA", "MSFT", "META", "AMZN", "QQQ"],
      headline: "AI-Infrastruktur bleibt das dominierende Thema im Mega-Cap-Segment",
      source: "MH Local Research",
      summary: "Investoren achten weiter auf Capex, Margenwirkung und Nachfrage nach AI-Compute.",
      sentiment: "Bullish",
      relevance: 92,
      ageHours: 3
    },
    {
      symbols: ["AAPL", "META", "MSFT"],
      headline: "Regulierung und Plattformgebühren bleiben zentrale Beobachtungspunkte",
      source: "MH Local Research",
      summary: "Großplattformen bleiben profitabel, aber politische und regulatorische Risiken steigen.",
      sentiment: "Neutral",
      relevance: 74,
      ageHours: 7
    },
    {
      symbols: ["TSLA"],
      headline: "EV-Margen und Auslieferungen bestimmen kurzfristig das Sentiment",
      source: "MH Local Research",
      summary: "Der Markt sucht nach klaren Signalen zu Nachfrage, Kosten und Produktzyklus.",
      sentiment: "Bearish",
      relevance: 81,
      ageHours: 5
    },
    {
      symbols: ["SPY", "DAX", "GOLD"],
      headline: "Realzinsen und Zentralbank-Erwartungen steuern Risikoappetit",
      source: "MH Local Research",
      summary: "Makrodaten bleiben wichtig für Aktienmultiples, Gold und globale Kapitalflüsse.",
      sentiment: "Neutral",
      relevance: 88,
      ageHours: 2
    },
    {
      symbols: ["BTC", "ETH"],
      headline: "Krypto bleibt stark an Liquiditäts- und Risk-on-Phasen gekoppelt",
      source: "MH Local Research",
      summary: "Momentum ist positiv, aber hohe Volatilität erfordert strikte Risikosteuerung.",
      sentiment: "Bullish",
      relevance: 79,
      ageHours: 4
    }
  ];

  const FALLBACK_MACRO = [
    {
      id: "FEDFUNDS",
      label: "Fed Funds Rate",
      value: 4.5,
      display: "4.50%",
      trend: "Restriktiv, Markt achtet auf Senkungspfad",
      source: "Lokaler FRED-Fallback",
      status: "fallback"
    },
    {
      id: "CPIAUCSL",
      label: "US CPI / Inflation",
      value: 3.1,
      display: "3.1%",
      trend: "Inflation bleibt über Ziel, aber abgekühlt",
      source: "Lokaler FRED-Fallback",
      status: "fallback"
    },
    {
      id: "UNRATE",
      label: "Arbeitslosenquote",
      value: 4.0,
      display: "4.0%",
      trend: "Arbeitsmarkt solide, leichte Abkühlung",
      source: "Lokaler FRED-Fallback",
      status: "fallback"
    },
    {
      id: "DGS10",
      label: "US 10Y Yield",
      value: 4.35,
      display: "4.35%",
      trend: "Renditen bleiben wichtiger Bewertungsanker",
      source: "Lokaler FRED-Fallback",
      status: "fallback"
    },
    {
      id: "DXY",
      label: "DXY Dollar Index",
      value: 104.2,
      display: "104.2",
      trend: "Fallback, falls FRED-Dollarindex nicht geladen ist",
      source: "Lokaler DXY-Fallback",
      status: "fallback"
    }
  ];

  const FRED_MACRO_SERIES = [
    { id: "FEDFUNDS", seriesId: "FEDFUNDS", label: "Fed Funds Rate", suffix: "%", mode: "level" },
    { id: "CPIAUCSL", seriesId: "CPIAUCSL", label: "US CPI / Inflation", suffix: "%", mode: "inflation" },
    { id: "UNRATE", seriesId: "UNRATE", label: "Arbeitslosenquote", suffix: "%", mode: "level" },
    { id: "DGS10", seriesId: "DGS10", label: "US 10Y Yield", suffix: "%", mode: "level" },
    { id: "M1", seriesId: "M1SL", label: "Geldmenge M1", suffix: "%", mode: "yoy" },
    { id: "M2", seriesId: "M2SL", label: "Geldmenge M2", suffix: "%", mode: "yoy" },
    { id: "REALYIELD", seriesId: "DFII10", label: "Realzins 10Y", suffix: "%", mode: "level" },
    { id: "YCURVE", seriesId: "T10Y2Y", label: "Yield Curve 2Y-10Y", suffix: "%", mode: "level" },
    { id: "CBBS", seriesId: "WALCL", label: "Zentralbank-Bilanz", suffix: "%", mode: "yoy" },
    { id: "DXY", seriesId: "DTWEXBGS", label: "US Dollar Broad Index", suffix: "", mode: "level" }
  ];

  const FALLBACK_GLOBAL_MACRO = [
    { country: "USA", indicator: "BIP-Wachstum", value: 2.5, display: "+2.5%", source: "Lokaler World-Bank-Fallback", status: "fallback" },
    { country: "Deutschland", indicator: "BIP-Wachstum", value: 0.2, display: "+0.2%", source: "Lokaler World-Bank-Fallback", status: "fallback" },
    { country: "China", indicator: "BIP-Wachstum", value: 4.8, display: "+4.8%", source: "Lokaler World-Bank-Fallback", status: "fallback" }
  ];

  const SEC_CIK_MAP = {
    AAPL: "0000320193",
    MSFT: "0000789019",
    NVDA: "0001045810",
    TSLA: "0001318605",
    META: "0001326801",
    AMZN: "0001018724",
    GOOGL: "0001652044",
    GOOG: "0001652044",
    JPM: "0000019617",
    XOM: "0000034088",
    UNH: "0000731766",
    COST: "0000909832",
    WMT: "0000104169"
  };

  const TOP_PICKS = [
    {
      symbol: "MSFT",
      side: "Long",
      setup: "Qualität + AI-Optionalität",
      reason: "Starker Cashflow, wiederkehrende Umsätze und defensiverer Tech-Charakter."
    },
    {
      symbol: "NVDA",
      side: "Long",
      setup: "Momentum + AI-Infrastruktur",
      reason: "Fundamentales Wachstum bleibt stark, aber Positionsgröße wegen Bewertung kontrollieren."
    },
    {
      symbol: "GOLD",
      side: "Hedge",
      setup: "Makro-Schutz",
      reason: "Interessant bei sinkenden Realzinsen, geopolitischem Stress oder Dollar-Schwäche."
    },
    {
      symbol: "SPY",
      side: "Core",
      setup: "Breiter Markt",
      reason: "Sauberer Benchmark-Baustein für Watchlist und Portfolio-Vergleich."
    }
  ];

  const SECTOR_HEATMAP = [
    { label: "Semis", change: 1.6 },
    { label: "Software", change: 0.8 },
    { label: "Mega Cap", change: 0.5 },
    { label: "Energy", change: -0.4 },
    { label: "Financials", change: 0.2 },
    { label: "Health", change: -0.1 },
    { label: "Industrials", change: 0.4 },
    { label: "Crypto", change: 1.1 },
    { label: "Gold", change: 0.3 },
    { label: "DAX", change: -0.2 },
    { label: "Small Caps", change: -0.5 },
    { label: "Bonds", change: 0.1 }
  ];

  const SOCIAL_ITEMS = [
    { symbol: "NVDA", channel: "Reddit / News", buzz: "+18%", mood: "Bullish", detail: "AI, Earnings, Capex" },
    { symbol: "TSLA", channel: "Social", buzz: "+12%", mood: "Neutral", detail: "EV demand, margins" },
    { symbol: "BTC", channel: "Crypto social", buzz: "+22%", mood: "Bullish", detail: "ETF flows, liquidity" },
    { symbol: "GOLD", channel: "Macro desks", buzz: "+7%", mood: "Neutral", detail: "Real yields, USD" }
  ];

  const LEARNING_GUIDES = [
    { title: "Wie liest man eine Aktie in 5 Minuten?", tag: "Guide", detail: "Preis, Trend, Bewertung, Risiko und News-Impact in einer klaren Routine." },
    { title: "Makro zu Micro: Was Zinsen für Aktien bedeuten", tag: "Macro", detail: "Übersetzt Fed, Inflation und Renditen in Sektor- und Asset-Signale." },
    { title: "Watchlist-Disziplin statt News-Chaos", tag: "Workflow", detail: "So wird aus Research ein wiederholbarer Entscheidungsprozess." }
  ];

  const state = {
    route: "home",
    activeSymbol: storageGet(STORAGE_KEYS.activeSymbol, "NVDA"),
    theme: storageGet(STORAGE_KEYS.theme, "dark"),
    providerTests: storageGet(STORAGE_KEYS.providerTests, {}),
    providerHealth: sanitizeProviderHealth(storageGet(STORAGE_KEYS.providerHealth, {})),
    watchlist: storageGet(STORAGE_KEYS.watchlist, DEFAULT_WATCHLIST),
    portfolios: storageGet(STORAGE_KEYS.portfolios, DEFAULT_PORTFOLIOS),
    activePortfolioId: storageGet(STORAGE_KEYS.activePortfolioId, "core"),
    dashboardPrefs: storageGet(STORAGE_KEYS.dashboardPrefs, { mode: "standard", favorites: ["NVDA", "MSFT"], modules: DASHBOARD_MODES.standard }),
    alerts: storageGet(STORAGE_KEYS.alerts, []),
    alertInbox: storageGet(STORAGE_KEYS.alertInbox, []),
    journal: storageGet(STORAGE_KEYS.journal, []),
    recents: storageGet(STORAGE_KEYS.recents, ["NVDA", "MSFT", "AAPL", "BTC"]),
    assetTab: "overview",
    compare: {
      left: "NVDA",
      right: "MSFT"
    },
    eventHub: {
      type: "all",
      window: "week",
      scope: "all",
      relevance: "all",
      source: "all",
      search: ""
    },
    alertFilter: "all",
    alertFilters: {
      status: "all",
      priority: "all",
      type: "all",
      scope: "all",
      search: ""
    },
    alertDraft: {
      symbol: "",
      type: "price"
    },
    screener: {
      search: "",
      momentum: "all",
      value: "all",
      growth: "all",
      marketCap: "all",
      sector: "all",
      performance: "all",
      sort: "score"
    },
    etf: {
      left: "SPY",
      right: "QQQ",
      amount: 10000,
      years: 10
    },
    portfolioScenario: {
      shock: -10,
      contribution: 500,
      symbol: "SPY",
      quantity: 0,
      avgPrice: "",
      cashChange: 0
    },
    quotes: {},
    profiles: {},
    fundamentals: {},
    news: {},
    macro: [],
    globalMacro: [],
    seriesStats: {},
    events: [],
    assetLoadedAt: {},
    lastHomeRefresh: 0,
    lastScreenerRefresh: 0,
    lastEventsRefresh: 0,
    loadingHome: false,
    loadingScreener: false,
    loadingEvents: false,
    loadingAssets: {}
  };

  const app = document.getElementById("app");
  const toastStack = document.getElementById("toastStack");
  const assetMap = new Map(ASSETS.map((asset) => [asset.symbol, asset]));

  function init() {
    removeLegacyBrowserApiKeys();
    applyTheme();
    bindGlobalEvents();
    syncRouteFromHash();
    window.addEventListener("hashchange", syncRouteFromHash);
    window.addEventListener("online", () => toast("Internetverbindung erkannt. Live-Daten werden beim nächsten Refresh erneut versucht."));
    window.addEventListener("offline", () => toast("Offline-Modus: MH Analytics nutzt lokale Fallback-Daten."));
  }

  function bindGlobalEvents() {
    document.body.addEventListener("click", handleClick);
    document.body.addEventListener("input", handleInput);
    document.body.addEventListener("change", handleChange);
    document.body.addEventListener("keydown", handleKeydown);
    document.body.addEventListener("submit", handleSubmit);
  }

  function handleClick(event) {
    const themeToggle = event.target.closest("#themeToggle");
    if (themeToggle) {
      state.theme = document.body.classList.contains("light") ? "dark" : "light";
      storageSet(STORAGE_KEYS.theme, state.theme);
      applyTheme();
      render();
      return;
    }

    const routeButton = event.target.closest("[data-route]");
    if (routeButton) {
      navigate(routeButton.dataset.route);
      return;
    }

    const compareOpen = event.target.closest("[data-compare-open]");
    if (compareOpen) {
      openCompareWith(compareOpen.dataset.compareOpen);
      return;
    }

    const comparePair = event.target.closest("[data-compare-pair-left]");
    if (comparePair) {
      openComparePair(comparePair.dataset.comparePairLeft, comparePair.dataset.comparePairRight);
      return;
    }

    const compareSwap = event.target.closest("[data-compare-swap]");
    if (compareSwap) {
      swapCompareAssets();
      return;
    }

    const symbolButton = event.target.closest("[data-symbol]");
    if (symbolButton) {
      selectAsset(symbolButton.dataset.symbol);
      return;
    }

    const favoriteButton = event.target.closest("[data-favorite-symbol]");
    if (favoriteButton) {
      toggleFavoriteSymbol(favoriteButton.dataset.favoriteSymbol);
      return;
    }

    const dashboardModeButton = event.target.closest("[data-dashboard-mode]");
    if (dashboardModeButton) {
      setDashboardMode(dashboardModeButton.dataset.dashboardMode);
      return;
    }

    const reportButton = event.target.closest("[data-report]");
    if (reportButton) {
      openReport(reportButton.dataset.report, reportButton.dataset.symbol || "");
      return;
    }

    const printButton = event.target.closest("[data-print-report]");
    if (printButton) {
      window.print();
      return;
    }

    const closeReportButton = event.target.closest("[data-close-report]");
    if (closeReportButton) {
      closeReport();
      return;
    }

    const portfolioSelect = event.target.closest("[data-portfolio-select]");
    if (portfolioSelect) {
      setActivePortfolio(portfolioSelect.dataset.portfolioSelect);
      return;
    }

    const deletePortfolio = event.target.closest("[data-portfolio-delete]");
    if (deletePortfolio) {
      deletePortfolioById(deletePortfolio.dataset.portfolioDelete);
      return;
    }

    const addButton = event.target.closest("[data-watch-add]");
    if (addButton) {
      const symbol = normalizeSymbol(addButton.dataset.watchAdd || getInputValue(addButton.dataset.watchInput) || state.activeSymbol);
      addToWatchlist(symbol);
      return;
    }

    const removeButton = event.target.closest("[data-watch-remove]");
    if (removeButton) {
      removeFromWatchlist(removeButton.dataset.watchRemove);
      return;
    }

    const clearCache = event.target.closest("[data-clear-cache]");
    if (clearCache) {
      storageSet(STORAGE_KEYS.cache, {});
      state.lastHomeRefresh = 0;
      state.lastScreenerRefresh = 0;
      state.lastEventsRefresh = 0;
      state.assetLoadedAt = {};
      toast("Daten-Cache geleert. Live-Daten werden erneut angefragt.");
      render();
      return;
    }

    const tabButton = event.target.closest("[data-asset-tab]");
    if (tabButton) {
      state.assetTab = tabButton.dataset.assetTab || "overview";
      render();
      return;
    }

    const resetScreener = event.target.closest("[data-screener-reset]");
    if (resetScreener) {
      state.screener = {
        search: "",
        momentum: "all",
        value: "all",
        growth: "all",
        marketCap: "all",
        sector: "all",
        performance: "all",
        sort: "score"
      };
      render();
      return;
    }

    const deleteAlert = event.target.closest("[data-alert-delete]");
    if (deleteAlert) {
      deleteAlertById(deleteAlert.dataset.alertDelete);
      return;
    }

    const checkAlertsButton = event.target.closest("[data-alert-check]");
    if (checkAlertsButton) {
      checkAlerts(true);
      render();
      return;
    }

    const quickAlert = event.target.closest("[data-alert-quick]");
    if (quickAlert) {
      openAlertDraft(quickAlert.dataset.alertQuick, quickAlert.dataset.alertQuickType || "price");
      return;
    }

    const eventAlert = event.target.closest("[data-alert-event-title]");
    if (eventAlert) {
      createEventAlertFromDataset(eventAlert.dataset);
      return;
    }

    const alertDone = event.target.closest("[data-alert-done]");
    if (alertDone) {
      markAlertDone(alertDone.dataset.alertDone);
      return;
    }

    const alertSnooze = event.target.closest("[data-alert-snooze]");
    if (alertSnooze) {
      snoozeAlert(alertSnooze.dataset.alertSnooze, alertSnooze.dataset.alertSnoozeDuration || "tomorrow");
      return;
    }

    const alertFilter = event.target.closest("[data-alert-filter]");
    if (alertFilter) {
      const group = alertFilter.dataset.alertFilterGroup || "type";
      state.alertFilters[group] = alertFilter.dataset.alertFilter || "all";
      state.alertFilter = group === "type" ? state.alertFilters.type : state.alertFilter;
      render();
      return;
    }

    const eventFilter = event.target.closest("[data-event-filter]");
    if (eventFilter) {
      state.eventHub.type = eventFilter.dataset.eventFilter || "all";
      render();
      return;
    }

    const eventWindow = event.target.closest("[data-event-window]");
    if (eventWindow) {
      state.eventHub.window = eventWindow.dataset.eventWindow || "week";
      render();
      return;
    }

    const eventScope = event.target.closest("[data-event-scope]");
    if (eventScope) {
      state.eventHub.scope = eventScope.dataset.eventScope || "all";
      render();
      return;
    }

    const eventRelevance = event.target.closest("[data-event-relevance]");
    if (eventRelevance) {
      state.eventHub.relevance = eventRelevance.dataset.eventRelevance || "all";
      render();
      return;
    }

    const clearInbox = event.target.closest("[data-alert-clear-inbox]");
    if (clearInbox) {
      state.alertInbox = [];
      storageSet(STORAGE_KEYS.alertInbox, state.alertInbox);
      toast("Alert-Inbox geleert.");
      render();
      return;
    }

    const exportButton = event.target.closest("[data-export-watchlist]");
    if (exportButton) {
      exportWatchlist();
    }
  }

  function handleInput(event) {
    const input = event.target.closest("[data-search-input]");
    if (input) {
      renderSuggestions(input);
    }

    const screenerInput = event.target.closest("[data-screener-control]");
    if (screenerInput) {
      updateScreenerState(screenerInput);
    }

    const etfInput = event.target.closest("[data-etf-control]");
    if (etfInput) {
      updateEtfState(etfInput);
    }

    const compareInput = event.target.closest("[data-compare-control]");
    if (compareInput) {
      updateCompareState(compareInput);
    }

    const eventInput = event.target.closest("[data-event-control]");
    if (eventInput) {
      updateEventHubState(eventInput);
    }

    const scenarioInput = event.target.closest("[data-portfolio-scenario]");
    if (scenarioInput) {
      updatePortfolioScenario(scenarioInput);
    }

    const alertInput = event.target.closest("[data-alert-control]");
    if (alertInput) {
      updateAlertFilterState(alertInput);
    }
  }

  function handleChange(event) {
    const screenerInput = event.target.closest("[data-screener-control]");
    if (screenerInput) {
      updateScreenerState(screenerInput);
    }

    const etfInput = event.target.closest("[data-etf-control]");
    if (etfInput) {
      updateEtfState(etfInput);
    }

    const compareInput = event.target.closest("[data-compare-control]");
    if (compareInput) {
      updateCompareState(compareInput);
    }

    const eventInput = event.target.closest("[data-event-control]");
    if (eventInput) {
      updateEventHubState(eventInput);
    }

    const scenarioInput = event.target.closest("[data-portfolio-scenario]");
    if (scenarioInput) {
      updatePortfolioScenario(scenarioInput);
    }

    const alertInput = event.target.closest("[data-alert-control]");
    if (alertInput) {
      updateAlertFilterState(alertInput);
    }
  }

  function handleKeydown(event) {
    const input = event.target.closest("[data-search-input]");
    if (!input || event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    const symbol = findBestSymbol(input.value);
    if (symbol) {
      selectAsset(symbol);
    } else {
      toast("Dieses Asset ist noch nicht im Phase-2E-Universum.");
    }
  }

  function handleSubmit(event) {
    if (event.target.matches("[data-watch-form]")) {
      event.preventDefault();
      const input = event.target.querySelector("[data-watch-input]");
      addToWatchlist(input ? input.value : "");
      if (input) {
        input.value = "";
      }
      return;
    }

    if (event.target.matches("[data-alert-form]")) {
      event.preventDefault();
      createAlertFromForm(event.target);
      return;
    }

    if (event.target.matches("[data-portfolio-form]")) {
      event.preventDefault();
      createPortfolioFromForm(event.target);
      return;
    }

    if (event.target.matches("[data-position-form]")) {
      event.preventDefault();
      addPositionFromForm(event.target);
      return;
    }

    if (event.target.matches("[data-portfolio-notes-form]")) {
      event.preventDefault();
      savePortfolioNotes(event.target);
      return;
    }

    if (event.target.matches("[data-journal-form]")) {
      event.preventDefault();
      saveJournalEntryFromForm(event.target);
    }
  }

  function navigate(route) {
    const normalizedRoute = route || "home";
    if (normalizedRoute === "asset") {
      window.location.hash = `asset/${state.activeSymbol || "NVDA"}`;
    } else {
      window.location.hash = normalizedRoute;
    }
  }

  function selectAsset(symbol) {
    const normalized = normalizeSymbol(symbol);
    if (!assetMap.has(normalized)) {
      toast("Asset nicht gefunden. Der Screener nutzt jetzt ein erweitertes Research-Universum. Bitte Symbol oder Namen genauer eingeben.");
      return;
    }

    state.activeSymbol = normalized;
    state.assetTab = "overview";
    storageSet(STORAGE_KEYS.activeSymbol, normalized);
    addRecent(normalized);
    window.location.hash = `asset/${normalized}`;
  }

  function syncRouteFromHash() {
    const raw = (window.location.hash || "#home").replace("#", "");
    const [route, symbol] = raw.split("/");

    state.route = route || "home";
    if (state.route === "asset" && symbol) {
      state.activeSymbol = normalizeSymbol(symbol);
      storageSet(STORAGE_KEYS.activeSymbol, state.activeSymbol);
      addRecent(state.activeSymbol, false);
    }
    render();
  }

  function render() {
    setActiveNav();

    if (state.route === "asset") {
      renderAssetPage();
    } else if (state.route === "compare") {
      renderComparePage();
    } else if (state.route === "screener") {
      renderScreenerPage();
    } else if (state.route === "macro") {
      renderMacroPage();
    } else if (state.route === "liquidity") {
      renderLiquidityPage();
    } else if (state.route === "etf") {
      renderEtfPage();
    } else if (state.route === "events") {
      renderEventsPage();
    } else if (state.route === "research") {
      renderResearchPage();
    } else if (state.route === "portfolio") {
      renderPortfolioPage();
    } else if (state.route === "alerts") {
      renderAlertsPage();
    } else if (state.route === "data-health") {
      renderDataHealthPage();
    } else if (state.route === "settings") {
      renderSettingsPage();
    } else {
      renderHomePage();
    }

    renderAllSuggestions();
  }

  function setActiveNav() {
    document.querySelectorAll("[data-route]").forEach((button) => {
      button.classList.toggle("active", button.dataset.route === state.route);
    });
  }

  function renderHomePage() {
    ensureHomeData();
    ensureEventData();

    app.innerHTML = `
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">MH Analytics</p>
          <h1>Premium Research für klare Marktentscheidungen.</h1>
          <p class="hero-text">Ein cleanes Finanz-Cockpit für Makro, Aktien, Krypto, Screener, Ratings, Alerts, Watchlist, Sentiment und transparente Datenquellen.</p>
          <div class="hero-actions">
            <button class="primary-button" type="button" data-route="asset">Aktie analysieren</button>
            <button class="ghost-button" type="button" data-route="screener">Screener öffnen</button>
            <button class="ghost-button" type="button" data-report="topPicks">Top Picks Report</button>
            <button class="ghost-button" type="button" data-route="settings">Datenquellen ansehen</button>
          </div>
          <div class="hero-meta">
            <div class="meta-tile">
              <strong>${state.watchlist.length}</strong>
              <span>Watchlist-Werte</span>
            </div>
            <div class="meta-tile">
              <strong>${countLiveQuotes()}</strong>
              <span>Live-Datenpunkte</span>
            </div>
            <div class="meta-tile">
              <strong>0</strong>
              <span>Server-Zwang</span>
            </div>
          </div>
        </div>
        <aside class="search-card">
          <div>
            <p class="eyebrow">Globale Suche</p>
            <h2>Asset, ETF, Krypto oder Index</h2>
            <p>Enter oder Vorschlag anklicken. MH Analytics verbindet Asset-Seiten, Live-Daten, Screener, Ratings, Alerts, ETF, Portfolio und Reports.</p>
          </div>
          ${renderSearchBox("home-search", "z. B. NVDA, Apple, BTC, DAX")}
          <div>
            <span class="card-label">Zuletzt gesucht</span>
            <div class="chip-row recent-row">
              ${state.recents.map((symbol) => renderSymbolChip(symbol)).join("")}
            </div>
          </div>
          <div class="status-note">
            ${renderStatusBadge(getOverallDataStatus())}
            <span>${getOverallDataStatusText()}</span>
          </div>
        </aside>
      </section>

      ${renderTicker()}
      ${renderDailyBriefingSection()}
      ${renderDailyRecapSection()}
      ${renderPersonalDashboardPanel()}
      ${renderPersonalModuleStrip()}
      ${renderQuickCompareSection()}
      ${renderMacroSection()}
      ${renderTopPicksSection()}

      <section class="section">
        <div class="grid two">
          ${renderLiquidityImpactCard()}
          ${renderHeatmapCard()}
          ${renderWatchlistCard()}
        </div>
      </section>

      <section class="section">
        <div class="grid two">
          ${renderSentimentCard()}
          ${renderResearchTeaserCard()}
        </div>
      </section>
    `;
  }

  function renderTicker() {
    const items = HOME_TICKER.map((symbol) => {
      const quote = quoteFor(symbol);
      return `
        <button class="ticker-item" type="button" data-symbol="${escAttr(symbol)}">
          <strong>${esc(symbol)}</strong>
          <span>${formatMoney(quote.price, getAsset(symbol).currency)}</span>
          <span class="${toneClass(quote.changePct)}">${formatPercent(quote.changePct)}</span>
          ${renderTinyStatus(quote.meta.status)}
        </button>
      `;
    }).join("");

    return `
      <section class="market-ticker" aria-label="Live Market Ticker">
        <div class="ticker-track">
          ${items}${items}
        </div>
      </section>
    `;
  }

  function renderDailyBriefingSection() {
    const briefing = dailyBriefingForView();
    const liquidity = briefing.liquidity;
    return `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Tagesüberblick</p>
            <h2>Was ist heute wichtig?</h2>
            <p>Ein kompakter Blick auf Marktbewegungen, Termine, Earnings und auffällige Assets. Funktioniert auch mit lokalem Fallback.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-route="events">Alle Events</button>
            <button class="ghost-button" type="button" data-route="screener">Auffällige Assets</button>
          </div>
        </div>
        <div class="daily-brief-grid">
          <article class="card daily-regime-card">
            <div class="card-topline">
              <div>
                <span class="card-label">Marktphase heute</span>
                <h3>${esc(briefing.regime.label)}</h3>
              </div>
              ${renderStatusBadge(briefing.status)}
            </div>
            <p>${esc(briefing.regime.text)}</p>
            <div class="metric-grid">
              ${renderMiniMetric("Ø Bewegung", formatPercent(briefing.avgMove))}
              ${renderMiniMetric("Live Quotes", String(countLiveQuotes()))}
              ${renderMiniMetric("Events 7T", String(briefing.upcomingEvents.length))}
              ${renderMiniMetric("Liquidität", `${formatNumber(liquidity.score)} / 100`)}
            </div>
            <div class="insight-row">
              <span class="pill">Makro-Kontext</span>
              <p>${esc(liquidity.summary)}</p>
            </div>
          </article>
          <article class="card">
            <span class="card-label">Wichtigste Marktbewegungen</span>
            <div class="stack-list">
              ${briefing.marketMoves.map((item) => `
                <button class="brief-row" type="button" data-symbol="${escAttr(item.symbol)}">
                  <span><strong>${esc(item.symbol)}</strong><small>${esc(item.name)}</small></span>
                  <span class="${toneClass(item.changePct)}">${formatPercent(item.changePct)}</span>
                </button>
              `).join("")}
            </div>
          </article>
          <article class="card">
            <span class="card-label">Termine & Earnings</span>
            <div class="stack-list">
              ${briefing.upcomingEvents.map((eventItem) => `
                <button class="brief-event-row" type="button" ${assetMap.has(eventItem.symbol) ? `data-symbol="${escAttr(eventItem.symbol)}"` : ""}>
                  <span class="pill">${esc(eventTypeLabel(eventItem))}</span>
                  <span><strong>${esc(eventItem.title)}</strong><small>${esc(eventTimingLabel(eventItem))} | ${esc(eventAreaLabel(eventItem))}</small></span>
                </button>
              `).join("") || renderEmptyState("Keine Termine im 7-Tage-Fenster.")}
            </div>
          </article>
          <article class="card">
            <span class="card-label">Auffällige Assets</span>
            <div class="stack-list">
              ${briefing.unusualAssets.map((row) => `
                <button class="brief-row" type="button" data-symbol="${escAttr(row.symbol)}">
                  <span><strong>${esc(row.symbol)}</strong><small>${esc(row.rating.rating)} | ${esc(row.pickReason)}</small></span>
                  <span class="score-pill ${row.rating.tone}">${row.score}%</span>
                </button>
              `).join("")}
            </div>
          </article>
        </div>
      </section>
    `;
  }

  function renderDailyRecapSection() {
    const recap = dailyRecapForView();
    return `
      <section class="section daily-recap-section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Tages-Recap</p>
            <h2>Was habe ich heute verpasst?</h2>
            <p>Ein kuratierter Blick auf heutige Marktbewegungen, Events, Watchlist-Hinweise, Alerts und News. Live-Daten fließen ein, lokale Priorisierung bleibt sichtbar.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-route="events">Event-Hub öffnen</button>
            <button class="ghost-button" type="button" data-route="alerts">Alerts prüfen</button>
            <button class="ghost-button" type="button" data-route="screener">Screener öffnen</button>
          </div>
        </div>
        <article class="card daily-recap-hero">
          <div class="card-topline">
            <div>
              <span class="card-label">Heute im Fokus · ${esc(recap.dateLabel)}</span>
              <h3>${esc(recap.conclusion.label)}</h3>
              <p>${esc(recap.conclusion.text)}</p>
            </div>
            ${renderStatusBadge(recap.status)}
          </div>
          <div class="metric-grid">
            ${renderMiniMetric("Top-Punkte", String(recap.priorityItems.length))}
            ${renderMiniMetric("Watchlist", String(recap.watchlistItems.length))}
            ${renderMiniMetric("Events heute", String(recap.todayEventCount))}
            ${renderMiniMetric("Alerts relevant", String(recap.alerts.length))}
          </div>
          <div class="recap-priority-list">
            ${recap.priorityItems.map(renderRecapPriorityItem).join("") || renderEmptyState("Heute gibt es keine stark priorisierten Punkte im aktuellen Datenfenster.")}
          </div>
          ${renderDataMeta(makeMeta("Daily-Recap: Watchlist + Events + Alerts + News", recap.status, Date.now(), "Relevanz wird lokal aus vorhandenen Daten priorisiert."), true)}
        </article>
        <div class="daily-recap-layout">
          <article class="card recap-panel">
            <div class="card-topline">
              <div>
                <span class="card-label">Markt</span>
                <h3>Wichtigste Bewegungen</h3>
              </div>
              <span class="pill">${esc(recap.moveMode)}</span>
            </div>
            <div class="stack-list">
              ${recap.moves.map(renderRecapMoveItem).join("") || renderEmptyState("Keine größeren Bewegungen geladen.")}
            </div>
          </article>
          <article class="card recap-panel">
            <div class="card-topline">
              <div>
                <span class="card-label">Events</span>
                <h3>Heute oder unmittelbar relevant</h3>
              </div>
              <button class="tiny-button" type="button" data-route="events">Alle Termine</button>
            </div>
            <div class="stack-list">
              ${recap.events.map(renderRecapEventItem).join("") || renderEmptyState("Keine heutigen Termine. Der Event-Hub bleibt für die Woche verfügbar.")}
            </div>
          </article>
          <article class="card recap-panel recap-watchlist-panel">
            <div class="card-topline">
              <div>
                <span class="card-label">Deine Watchlist</span>
                <h3>${esc(recap.watchlistTone.label)}</h3>
                <p>${esc(recap.watchlistTone.text)}</p>
              </div>
              ${renderStatusBadge(recap.watchlistStatus)}
            </div>
            <div class="stack-list">
              ${recap.watchlistItems.map(renderRecapWatchlistItem).join("") || renderEmptyState("Keine Watchlist-Hinweise im aktuellen Datenfenster.")}
            </div>
          </article>
          <article class="card recap-panel">
            <div class="card-topline">
              <div>
                <span class="card-label">News / Treiber</span>
                <h3>Was den Markt bewegt</h3>
              </div>
              ${renderStatusBadge(recap.newsStatus)}
            </div>
            <div class="stack-list">
              ${recap.news.map(renderRecapNewsItem).join("") || renderEmptyState("Keine kuratierten News im aktuellen Feed.")}
            </div>
          </article>
        </div>
      </section>
    `;
  }

  function renderRecapPriorityItem(item) {
    const action = item.symbol && assetMap.has(item.symbol) ? `data-symbol="${escAttr(item.symbol)}"` : `data-route="${escAttr(item.route || "events")}"`;
    return `
      <button class="recap-priority-item" type="button" ${action}>
        <span class="score-pill ${recapScoreTone(item.score)}">${Math.round(item.score)}</span>
        <span>
          <strong>${esc(item.title)}</strong>
          <small>${esc(item.text)}</small>
        </span>
        <span class="pill">${esc(item.kind)}</span>
      </button>
    `;
  }

  function renderRecapMoveItem(item) {
    return `
      <button class="brief-row recap-row" type="button" data-symbol="${escAttr(item.symbol)}">
        <span>
          <strong>${esc(item.symbol)} · ${esc(item.name)}</strong>
          <small>${esc(item.reason)}</small>
        </span>
        <span class="right-cell">
          <strong class="${toneClass(item.changePct)}">${formatPercent(item.changePct)}</strong>
          <small>${esc(recapRelevanceLabel(item.score))}</small>
        </span>
      </button>
    `;
  }

  function renderRecapEventItem(eventItem) {
    const action = assetMap.has(eventItem.symbol) ? `data-symbol="${escAttr(eventItem.symbol)}"` : `data-route="events"`;
    return `
      <button class="brief-event-row recap-event-row" type="button" ${action}>
        <span class="score-pill ${eventRelevanceTone(eventItem)}">${eventRelevance(eventItem)}</span>
        <span>
          <strong>${esc(eventItem.title)}</strong>
          <small>${esc(eventTimingLabel(eventItem))} · ${esc(eventTypeLabel(eventItem))} · ${esc(eventAreaLabel(eventItem))}</small>
        </span>
        ${isWatchlistRelevantEvent(eventItem) ? `<span class="pill bull">Watchlist</span>` : renderStatusBadge(eventItem.meta?.status)}
      </button>
    `;
  }

  function renderRecapWatchlistItem(item) {
    const action = item.symbol && assetMap.has(item.symbol) ? `data-symbol="${escAttr(item.symbol)}"` : `data-route="alerts"`;
    return `
      <button class="brief-event-row recap-watch-row" type="button" ${action}>
        <span class="pill ${item.priority === "high" ? "bear" : ""}">${esc(item.kind)}</span>
        <span>
          <strong>${esc(item.symbol || "Watchlist")}</strong>
          <small>${esc(item.text)}</small>
        </span>
      </button>
    `;
  }

  function renderRecapNewsItem(item) {
    return `
      <button class="brief-event-row recap-news-row" type="button" data-symbol="${escAttr(item.symbol)}">
        <span class="score-pill ${recapScoreTone(item.score)}">${Math.round(item.score)}</span>
        <span>
          <strong>${esc(item.headline)}</strong>
          <small>${esc(item.symbol)} · ${esc(item.source)} · ${esc(item.sentiment || "Neutral")}</small>
        </span>
        ${renderStatusBadge(item.status)}
      </button>
    `;
  }

  function renderPersonalDashboardPanel() {
    const prefs = dashboardPrefs();
    return `
      <section class="section">
        <article class="card personalization-panel">
          <div class="card-topline">
            <div>
              <span class="card-label">Personal Dashboard V1</span>
              <h3>Weiterarbeiten, wo du aufgehört hast</h3>
              <p>Letztes Asset: ${esc(state.activeSymbol)}. Favoriten: ${prefs.favorites.map(esc).join(", ") || "noch keine"}.</p>
            </div>
            ${renderDataMeta(makeMeta("Lokale Dashboard-Personalisierung", "live", Date.now()), true)}
          </div>
          <div class="dashboard-mode-row">
            ${Object.keys(DASHBOARD_MODES).map((mode) => `
              <button class="chip ${prefs.mode === mode ? "active" : ""}" type="button" data-dashboard-mode="${escAttr(mode)}">${esc(capitalize(mode))}</button>
            `).join("")}
          </div>
          <div class="continue-row">
            <button class="ghost-button" type="button" data-symbol="${escAttr(state.activeSymbol)}">Weiter mit ${esc(state.activeSymbol)}</button>
            ${state.recents.slice(0, 3).map((symbol) => `<button class="chip" type="button" data-symbol="${escAttr(symbol)}">${esc(symbol)}</button>`).join("")}
          </div>
          <div class="chip-row">
            ${ASSETS.slice(0, 8).map((asset) => `
              <button class="chip ${isFavoriteSymbol(asset.symbol) ? "active" : ""}" type="button" data-favorite-symbol="${escAttr(asset.symbol)}">${esc(asset.symbol)}</button>
            `).join("")}
          </div>
        </article>
      </section>
    `;
  }

  function renderPersonalModuleStrip() {
    const modules = dashboardPrefs().modules || DASHBOARD_MODES.standard;
    const labels = {
      macro: "Makro",
      liquidity: "Liquidität",
      topPicks: "Top Picks",
      watchlist: "Watchlist",
      sentiment: "Sentiment",
      research: "Research",
      etf: "ETF",
      portfolio: "Portfolio",
      screener: "Screener",
      alerts: "Alerts"
    };
    return `
      <section class="section compact-section">
        <div class="module-priority-strip">
          <span class="card-label">Priorisierte Module</span>
          ${modules.map((moduleId) => `<span class="pill">${esc(labels[moduleId] || moduleId)}</span>`).join("")}
        </div>
      </section>
    `;
  }

  function compareSymbols() {
    const leftSymbol = assetMap.has(state.compare.left) ? state.compare.left : "NVDA";
    let rightSymbol = assetMap.has(state.compare.right) ? state.compare.right : "MSFT";
    if (leftSymbol === rightSymbol) {
      rightSymbol = leftSymbol === "MSFT" ? "NVDA" : "MSFT";
      state.compare.right = rightSymbol;
    }
    ensureAssetData(leftSymbol);
    ensureAssetData(rightSymbol);
    return { leftSymbol, rightSymbol };
  }

  function renderComparePage() {
    const { leftSymbol, rightSymbol } = compareSymbols();
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Quick Compare</p>
            <h1>Zwei Assets direkt vergleichen.</h1>
            <p>Aktien und ETFs nebeneinander: Kurs, Profil, Bewertung, Technik, Chancen, Risiken und Datenstatus. Die Interpretation bleibt bewusst als MH-Hybridlogik gekennzeichnet.</p>
          </div>
          ${renderDataMeta(makeMeta("Hybrid: Live-Daten + lokale Research-Logik", compareStatusFor(leftSymbol, rightSymbol), Date.now()), true)}
        </div>
        ${renderCompareWorkbench(leftSymbol, rightSymbol, { full: true })}
      </section>
    `;
  }

  function renderQuickCompareSection() {
    const { leftSymbol, rightSymbol } = compareSymbols();
    return `
      <section class="section compact-section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Quick Compare</p>
            <h2>Zwei Assets direkt vergleichen</h2>
            <p>Aktie gegen Aktie oder ETF gegen ETF: Preis, Profil, Bewertung, Technik, Chancen und Risiken in einer ruhigen Gegenüberstellung.</p>
          </div>
          <div class="row-actions">
            ${renderDataMeta(makeMeta("Hybrid: Finnhub, Alpha Vantage, ETF-Fallback", compareStatusFor(leftSymbol, rightSymbol), Date.now()), true)}
            <button class="ghost-button" type="button" data-route="compare">Compare öffnen</button>
          </div>
        </div>
        ${renderCompareWorkbench(leftSymbol, rightSymbol)}
      </section>
    `;
  }

  function renderCompareWorkbench(leftSymbol, rightSymbol, options = {}) {
    const summary = compareSummary(leftSymbol, rightSymbol);
    return `
      <article class="card compare-card ${options.full ? "compare-card-full" : ""}">
        <div class="form-grid compare-controls">
          <label class="field">
            <span>Asset A</span>
            <select data-compare-control name="left">${compareOptions(leftSymbol)}</select>
          </label>
          <label class="field">
            <span>Asset B</span>
            <select data-compare-control name="right">${compareOptions(rightSymbol)}</select>
          </label>
          <button class="ghost-button compare-swap-button" type="button" data-compare-swap>Seiten tauschen</button>
        </div>
        ${renderCompareSummary(summary)}
        <div class="grid two compare-grid">
          ${renderCompareAssetCard(leftSymbol)}
          ${renderCompareAssetCard(rightSymbol)}
        </div>
        ${renderCompareMatrix(leftSymbol, rightSymbol)}
        ${renderCompareVerdict(leftSymbol, rightSymbol)}
      </article>
    `;
  }

  function compareOptions(selected) {
    return ASSETS
      .filter((asset) => ["Stock", "ETF", "Index", "Commodity", "Crypto"].includes(asset.type))
      .map((asset) => `<option value="${escAttr(asset.symbol)}" ${selected === asset.symbol ? "selected" : ""}>${esc(asset.symbol)} - ${esc(asset.name)}</option>`)
      .join("");
  }

  function renderCompareAssetCard(symbol) {
    const data = compareDataFor(symbol);
    const { asset, quote, profile, fundamentals, technical, analysis, etf } = data;
    return `
      <div class="compare-asset-panel">
        <div class="card-topline">
          <div>
            <span class="card-label">${esc(asset.type)}</span>
            <h3>${esc(symbol)} <small>${esc(profile.name || asset.name)}</small></h3>
          </div>
          <span class="score-pill ${technical.tone}">${esc(technical.rating)}</span>
        </div>
        <div class="metric-grid compare-primary-metrics">
          ${renderMiniMetric("Preis", formatMoney(quote.price, asset.currency))}
          ${renderMiniMetric("Heute", formatPercent(quote.changePct))}
          ${renderMiniMetric("1M", formatPercent(analysis.performance1m))}
          ${renderMiniMetric("Score", `${snapshotFor(symbol).score}/100`)}
        </div>
        <div class="compare-section">
          <span class="card-label">Grundprofil</span>
          <div class="metric-grid">
            ${renderMiniMetric("Typ", asset.type)}
            ${renderMiniMetric("Sektor", profile.sector || asset.sector)}
            ${renderMiniMetric("Market Cap", formatCompareValue(valueOr(profile.marketCap, fundamentals.marketCap), (value) => formatCompactMoney(value, asset.currency)))}
            ${renderMiniMetric("Daten", statusLabel(compareAssetStatus(data)))}
          </div>
        </div>
        ${etf ? renderCompareEtfBlock(etf) : renderCompareFundamentalBlock(asset, fundamentals)}
        <div class="compare-section">
          <span class="card-label">Technik</span>
          <div class="metric-grid">
            ${renderMiniMetric("Rating", `${technical.rating} · ${technical.probability}%`)}
            ${renderMiniMetric("Momentum", `${formatNumber(analysis.momentum)}/100`)}
            ${renderMiniMetric("Trend", `${formatNumber(analysis.trend)}/100`)}
            ${renderMiniMetric("Volatilität", `${formatNumber(analysis.volatility)}/100`)}
          </div>
          <p>${esc(technical.reason)}</p>
        </div>
        <div class="grid two compare-risk-grid">
          <div class="insight-row"><span class="pill">Chance</span><p>${esc(asset.thesis)}</p></div>
          <div class="insight-row"><span class="pill">Risiko</span><p>${esc(asset.risks)}</p></div>
        </div>
        ${renderDataMeta(makeMeta(compareDataSourceLabel(data), compareAssetStatus(data), compareLatestTimestamp(data), "Quick Compare nutzt Live-Daten, Cache oder Fallback je nach Verfügbarkeit."))}
      </div>
    `;
  }

  function renderCompareFundamentalBlock(asset, fundamentals) {
    return `
      <div class="compare-section">
        <span class="card-label">Bewertung / Fundamentals</span>
        <div class="metric-grid">
          ${renderMiniMetric("KGV", formatCompareValue(valueOr(fundamentals.pe, asset.fallback.pe), (value) => formatNumber(value, "x")))}
          ${renderMiniMetric("EPS", formatCompareValue(valueOr(fundamentals.eps, asset.fallback.eps), (value) => formatMoney(value, asset.currency)))}
          ${renderMiniMetric("Umsatz", formatCompareValue(valueOr(fundamentals.revenue, asset.fallback.revenue), (value) => formatCompactMoney(value, asset.currency)))}
        </div>
      </div>
    `;
  }

  function renderCompareEtfBlock(etf) {
    const concentration = etfHoldingConcentration(etf);
    const topRegion = etf.region[0] ? `${etf.region[0][0]} ${formatNumber(etf.region[0][1])}%` : "nicht verfügbar";
    const topHolding = etf.holdings[0] ? `${etf.holdings[0][0]} ${formatNumber(etf.holdings[0][1])}%` : "nicht verfügbar";
    return `
      <div class="compare-section">
        <span class="card-label">ETF-Struktur</span>
        <div class="metric-grid">
          ${renderMiniMetric("TER", `${formatNumber(etf.ter)}%`)}
          ${renderMiniMetric("Ausschüttung", etf.distribution)}
          ${renderMiniMetric("Top-Region", topRegion)}
          ${renderMiniMetric("Top-Holding", topHolding)}
          ${renderMiniMetric("Top-5 Anteil", `${formatNumber(concentration)}%`)}
          ${renderMiniMetric("Währung", etf.currency)}
        </div>
        <p>${esc(etf.useCase)} ${esc(etf.fxRisk)}.</p>
      </div>
    `;
  }

  function renderCompareSummary(summary) {
    return `
      <div class="compare-summary">
        <span class="pill">Kurzfazit</span>
        <div>
          <h3>${esc(summary.title)}</h3>
          <p>${esc(summary.text)}</p>
        </div>
        <div class="compare-fit-grid">
          <div><strong>${esc(summary.left.symbol)}</strong><span>${esc(summary.left.fit)}</span></div>
          <div><strong>${esc(summary.right.symbol)}</strong><span>${esc(summary.right.fit)}</span></div>
        </div>
      </div>
    `;
  }

  function renderCompareMatrix(leftSymbol, rightSymbol) {
    const rows = compareRows(leftSymbol, rightSymbol);
    return `
      <div class="compare-matrix">
        <div class="card-topline compact-topline">
          <div>
            <span class="card-label">Direkter Vergleich</span>
            <h3>Wo liegt der Unterschied?</h3>
          </div>
          ${renderStatusBadge(compareStatusFor(leftSymbol, rightSymbol))}
        </div>
        <div class="compare-row compare-row-head">
          <strong>${esc(leftSymbol)}</strong>
          <span>Kriterium</span>
          <strong>${esc(rightSymbol)}</strong>
        </div>
        ${rows.map(renderCompareRow).join("")}
      </div>
    `;
  }

  function renderCompareRow(row) {
    const leftClass = row.winner === "left" ? "compare-winner" : "";
    const rightClass = row.winner === "right" ? "compare-winner" : "";
    return `
      <div class="compare-row">
        <span class="${leftClass}">${esc(row.left)}</span>
        <span><strong>${esc(row.label)}</strong><small>${esc(row.note)}</small></span>
        <span class="${rightClass}">${esc(row.right)}</span>
      </div>
    `;
  }

  function renderCompareVerdict(leftSymbol, rightSymbol) {
    const left = compareDataFor(leftSymbol).snapshot;
    const right = compareDataFor(rightSymbol).snapshot;
    const winner = left.score === right.score ? null : left.score > right.score ? left : right;
    const text = winner
      ? `${winner.symbol} hat im aktuellen Hybrid-Score den stärkeren Mix aus Rating, Momentum, Value/Growth und Datenlage. Das ist keine Kaufempfehlung, sondern eine Research-Priorisierung.`
      : "Beide Assets liegen im aktuellen Hybrid-Score nahezu gleichauf. Der Zweck im Portfolio entscheidet stärker als ein einzelner Score.";
    return `
      <div class="compare-verdict">
        <span class="pill">Einordnung</span>
        <p>${esc(text)} ${esc(left.symbol)}: ${left.score} Punkte, ${esc(right.symbol)}: ${right.score} Punkte.</p>
      </div>
    `;
  }

  function compareStatusFor(leftSymbol, rightSymbol) {
    const statuses = [
      quoteFor(leftSymbol).meta.status,
      profileFor(leftSymbol).meta.status,
      fundamentalsFor(leftSymbol).meta.status,
      analysisFor(leftSymbol).meta?.status,
      quoteFor(rightSymbol).meta.status,
      profileFor(rightSymbol).meta.status,
      fundamentalsFor(rightSymbol).meta.status,
      analysisFor(rightSymbol).meta?.status
    ];
    return bestDataStatus(statuses);
  }

  function compareDataFor(symbol) {
    const asset = getAsset(symbol);
    const quote = quoteFor(symbol);
    const profile = profileFor(symbol);
    const fundamentals = fundamentalsFor(symbol);
    const analysis = analysisFor(symbol);
    const technical = technicalFor(symbol, quote);
    const snapshot = snapshotFor(symbol);
    const etf = ETF_DATA.find((item) => item.symbol === symbol) || null;
    return { symbol, asset, quote, profile, fundamentals, analysis, technical, snapshot, etf };
  }

  function compareAssetStatus(data) {
    return bestDataStatus([
      data.quote.meta.status,
      data.profile.meta.status,
      data.fundamentals.meta.status,
      data.analysis.meta?.status,
      data.etf ? "fallback" : null
    ]);
  }

  function compareLatestTimestamp(data) {
    return Math.max(
      Number(data.quote.meta.timestamp || 0),
      Number(data.profile.meta.timestamp || 0),
      Number(data.fundamentals.meta.timestamp || 0),
      Number(data.analysis.meta?.timestamp || 0),
      BOOT_TIME
    );
  }

  function compareDataSourceLabel(data) {
    if (data.etf) {
      return "Hybrid: Quotes + lokale ETF-Datenbasis";
    }
    return "Hybrid: Quotes, Profil, Fundamentals, Zeitreihen";
  }

  function compareSummary(leftSymbol, rightSymbol) {
    const left = compareDataFor(leftSymbol);
    const right = compareDataFor(rightSymbol);
    const leftStrengths = compareStrengths(left, right);
    const rightStrengths = compareStrengths(right, left);
    const title = `${leftSymbol} vs ${rightSymbol}: ${compareHeadline(left, right)}`;
    const text = [
      leftStrengths.length ? `${leftSymbol} wirkt stärker bei ${leftStrengths.join(", ")}.` : `${leftSymbol} hat keinen klaren Vorteil in den Kernmetriken.`,
      rightStrengths.length ? `${rightSymbol} wirkt stärker bei ${rightStrengths.join(", ")}.` : `${rightSymbol} hat keinen klaren Vorteil in den Kernmetriken.`
    ].join(" ");
    return {
      title,
      text,
      left: { symbol: leftSymbol, fit: compareFitText(left) },
      right: { symbol: rightSymbol, fit: compareFitText(right) }
    };
  }

  function compareStrengths(primary, secondary) {
    const strengths = [];
    if (primary.snapshot.score >= secondary.snapshot.score + 4) strengths.push("Gesamtscore");
    if (primary.analysis.momentum >= secondary.analysis.momentum + 6) strengths.push("Momentum");
    if (primary.analysis.value >= secondary.analysis.value + 6) strengths.push("Bewertung/Value");
    if (primary.technical.score >= secondary.technical.score + 5) strengths.push("Technik");
    if (primary.etf && secondary.etf) {
      if (primary.etf.ter + 0.03 < secondary.etf.ter) strengths.push("Kosten");
      if (etfHoldingConcentration(primary.etf) + 5 < etfHoldingConcentration(secondary.etf)) strengths.push("geringere Konzentration");
    }
    return strengths.slice(0, 3);
  }

  function compareHeadline(left, right) {
    if (left.asset.type === "ETF" && right.asset.type === "ETF") {
      return "Kosten, Konzentration und Einsatzbereich entscheiden";
    }
    if (left.asset.type === "ETF" || right.asset.type === "ETF") {
      return "Einzelwert gegen Baustein bewusst trennen";
    }
    if (Math.abs(left.snapshot.score - right.snapshot.score) <= 3) {
      return "nahe beieinander";
    }
    const stronger = left.snapshot.score > right.snapshot.score ? left.symbol : right.symbol;
    return `${stronger} hat den stärkeren Hybrid-Score`;
  }

  function compareFitText(data) {
    if (data.etf) {
      return data.etf.useCase || "ETF-Baustein für Portfolio-Exposure.";
    }
    if (data.technical.rating === "BUY" && data.analysis.volatility < 62) {
      return "passt eher zu Qualitäts-/Momentum-orientiertem Research.";
    }
    if (data.analysis.value >= 65) {
      return "passt eher zu Value-orientierter Prüfung.";
    }
    if (data.analysis.volatility >= 70) {
      return "eher für aktive, risikobewusste Beobachtung.";
    }
    return "passt eher zu neutraler Watchlist-Analyse.";
  }

  function compareRows(leftSymbol, rightSymbol) {
    const left = compareDataFor(leftSymbol);
    const right = compareDataFor(rightSymbol);
    const rows = [
      compareRow("Preis", formatMoney(left.quote.price, left.asset.currency), formatMoney(right.quote.price, right.asset.currency), "Nominalpreis ist kein Qualitätsvorteil.", "none"),
      compareNumericRow("Tagesbewegung", left.quote.changePct, right.quote.changePct, (value) => formatPercent(value), "höher", "Kurzfristiges Momentum."),
      compareNumericRow("1M Performance", left.analysis.performance1m, right.analysis.performance1m, (value) => formatPercent(value), "höher", "Performance aus Live-/Fallback-Zeitreihen."),
      compareNumericRow("Hybrid Score", left.snapshot.score, right.snapshot.score, (value) => `${formatNumber(value)}/100`, "höher", "MH Research-Score, keine Anlageberatung."),
      compareNumericRow("Technik", left.technical.score, right.technical.score, (value) => `${formatNumber(value)}/100`, "höher", "Trend, Momentum, Risiko und Aktivität."),
      compareRow("Sektor / Typ", left.profile.sector || left.asset.sector, right.profile.sector || right.asset.sector, "Vergleichskontext statt Gewinner.", "none")
    ];

    if (left.etf && right.etf) {
      rows.push(
        compareNumericRow("TER", left.etf.ter, right.etf.ter, (value) => `${formatNumber(value)}%`, "niedriger", "Niedrigere laufende Kosten sind ein Pluspunkt."),
        compareNumericRow("Top-5 Konzentration", etfHoldingConcentration(left.etf), etfHoldingConcentration(right.etf), (value) => `${formatNumber(value)}%`, "niedriger", "Geringere Konzentration kann breiter streuen."),
        compareRow("Ausschüttung", left.etf.distribution, right.etf.distribution, "Cashflow vs. Wiederanlage.", "none")
      );
      const overlap = etfOverlap(left.etf, right.etf);
      rows.push(compareRow("ETF-Overlap", `${formatNumber(overlap.score)}% Holdings`, `${formatNumber(overlap.regionScore)}% Regionen`, "Zeigt Dopplung statt Gewinner.", "none"));
    } else {
      rows.push(
        compareNumericRow("KGV", valueOr(left.fundamentals.pe, left.asset.fallback.pe), valueOr(right.fundamentals.pe, right.asset.fallback.pe), (value) => formatNumber(value, "x"), "niedriger", "Niedriger kann günstiger sein, ersetzt aber keine Qualitätsprüfung."),
        compareRow("Marktkapitalisierung", formatCompareValue(left.snapshot.marketCap, (value) => formatCompactMoney(value, left.asset.currency)), formatCompareValue(right.snapshot.marketCap, (value) => formatCompactMoney(value, right.asset.currency)), "Größe ist Stabilitätskontext, kein automatischer Vorteil.", "none")
      );
    }
    return rows;
  }

  function compareNumericRow(label, leftValue, rightValue, formatter, direction, note) {
    const leftNumber = compareNumberOrNull(leftValue);
    const rightNumber = compareNumberOrNull(rightValue);
    let winner = "none";
    if (leftNumber !== null && rightNumber !== null && Math.abs(leftNumber - rightNumber) > 0.01) {
      winner = direction === "niedriger"
        ? (leftNumber < rightNumber ? "left" : "right")
        : (leftNumber > rightNumber ? "left" : "right");
    }
    return compareRow(label, formatCompareValue(leftNumber, formatter), formatCompareValue(rightNumber, formatter), note, winner);
  }

  function compareNumberOrNull(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function compareRow(label, left, right, note, winner = "none") {
    return { label, left, right, note, winner };
  }

  function formatCompareValue(value, formatter) {
    if (value === null || value === undefined || value === "" || Number.isNaN(value)) {
      return "nicht verfügbar";
    }
    return formatter ? formatter(value) : String(value);
  }

  function renderMacroSection() {
    const macro = macroForView();
    const liquidity = liquidityNarrativeForView();
    return `
      <section class="section">
        <div class="section-head">
          <div>
            <h2>Makro-Schnellblick</h2>
            <p>FRED-Daten laufen online über die Vercel Function /api/fred. Lokal per Doppelklick bleibt die Seite stabil mit klar markierten Fallback-Werten.</p>
          </div>
          <button class="ghost-button" type="button" data-route="settings">FRED Function prüfen</button>
        </div>
        <div class="grid five macro-grid">
          ${macro.map((item) => `
            <article class="card data-card">
              <span class="card-label">${esc(item.label)}</span>
              <strong class="value">${esc(item.display)}</strong>
              <p>${esc(item.trend)}</p>
              ${renderDataMeta(item.meta)}
            </article>
          `).join("")}
        </div>
        <article class="card macro-context-card">
          <div class="card-topline">
            <div>
              <span class="card-label">Makro → Markt</span>
              <h3>${esc(liquidity.label)}</h3>
              <p>${esc(liquidity.summary)}</p>
            </div>
            <span class="score-pill ${liquidity.tone}">${formatNumber(liquidity.score)} / 100</span>
          </div>
          <div class="grid four">
            ${liquidityImpactForView().map((item) => `
              <div class="insight-row">
                <span class="pill">${esc(item.asset)}</span>
                <p><strong>${esc(item.signal)}:</strong> ${esc(item.text)}</p>
              </div>
            `).join("")}
          </div>
        </article>
      </section>
    `;
  }

  function renderLiquidityImpactCard() {
    const liquidity = liquidityForView();
    const realYield = liquidity.find((item) => item.id === "REALYIELD");
    const curve = liquidity.find((item) => item.id === "YCURVE");
    const narrative = liquidityNarrativeForView();
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Liquidität & Zinsen</span>
            <h3>Was bedeutet das für Märkte?</h3>
          </div>
          <span class="score-pill ${narrative.tone}">${formatNumber(narrative.score)} / 100</span>
        </div>
        <p>${esc(narrative.summary)}</p>
        <div class="insight-row"><span class="pill">Realzins</span><p>${esc(realYield ? realYield.meaning : "Steigende Realzinsen drücken oft auf Gold, Growth und Krypto.")}</p></div>
        <div class="insight-row"><span class="pill">Yield Curve</span><p>${esc(curve ? curve.meaning : "Eine inverse Kurve bleibt ein Stress- und Rezessionssignal.")}</p></div>
        <div class="insight-row"><span class="pill">Liquidität</span><p>Mehr Liquidität kann Risikoassets unterstützen; weniger Liquidität erhöht Bewertungsdruck und macht Fallback-/Cash-Planung wichtiger.</p></div>
        <button class="ghost-button" type="button" data-route="liquidity">Liquidität öffnen</button>
      </article>
    `;
  }

  function renderTopPicksSection() {
    const picks = topPicksForView();
    return `
      <section class="section">
        <div class="section-head">
          <div>
            <h2>Top Picks heute</h2>
            <p>Phase 2E rankt Picks aus Technical Rating, Momentum, Value/Growth, Risiko, Sentiment und Portfolio-Kontext. Research-Tool, keine Anlageberatung.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-route="screener">Zum Screener</button>
            <button class="ghost-button" type="button" data-report="topPicks">Report</button>
          </div>
        </div>
        <div class="split-picks">
          <article class="card">
            <div class="card-topline">
              <div>
                <span class="card-label">Long Picks</span>
                <h3>Chancen-Ranking</h3>
              </div>
              ${renderStatusBadge(getOverallDataStatus())}
            </div>
            <div class="stack-list">
              ${picks.long.map((pick, index) => renderPickRow(pick, index + 1)).join("")}
            </div>
          </article>
          <article class="card">
            <div class="card-topline">
              <div>
                <span class="card-label">Short / Risk Picks</span>
                <h3>Risiko-Ranking</h3>
              </div>
              ${renderStatusBadge("fallback")}
            </div>
            <div class="stack-list">
              ${picks.risk.map((pick, index) => renderPickRow(pick, index + 1)).join("")}
            </div>
          </article>
        </div>
      </section>
    `;
  }

  function renderPickRow(pick, index) {
    const asset = getAsset(pick.symbol);
    const quote = quoteFor(pick.symbol);
    return `
      <button class="pick-row pick-engine-row" type="button" data-symbol="${escAttr(pick.symbol)}">
        <span class="rank">${index}</span>
        <span>
          <strong>${esc(pick.symbol)} - ${esc(asset.name)}</strong>
          <span class="small">${esc(pick.direction)} | Score ${pick.score}% | ${esc(pick.setup)}</span>
          <span class="small">${esc(pick.reason)}</span>
        </span>
        <span class="right-cell">
          <span class="${toneClass(quote.changePct)}">${formatPercent(quote.changePct)}</span>
          <span class="pill ${pick.direction === "Long" ? "bull" : "bear"}">${esc(pick.direction)}</span>
        </span>
      </button>
    `;
  }

  function renderLegacyTopPickCards() {
    return TOP_PICKS.map((pick) => {
            const asset = getAsset(pick.symbol);
            const quote = quoteFor(pick.symbol);
            return `
              <article class="card pick-card">
                <div class="card-topline">
                  <span class="pill">${esc(pick.side)}</span>
                  ${renderTinyStatus(quote.meta.status)}
                </div>
                <h3>${esc(asset.symbol)} - ${esc(asset.name)}</h3>
                <strong class="value">${formatMoney(quote.price, asset.currency)}</strong>
                <p class="${toneClass(quote.changePct)}">${formatPercent(quote.changePct)} heute</p>
                <p>${esc(pick.reason)}</p>
                <div class="card-actions">
                  <button class="ghost-button" type="button" data-symbol="${escAttr(asset.symbol)}">Analyse</button>
                  <button class="ghost-button" type="button" data-watch-add="${escAttr(asset.symbol)}">Watchlist</button>
                </div>
                ${renderDataMeta(quote.meta)}
              </article>
            `;
          }).join("");
  }

  function renderHeatmapCard() {
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Sektor-Heatmap</span>
            <h3>Risk-on / Risk-off Karte</h3>
          </div>
          ${renderTinyStatus("fallback")}
        </div>
        <div class="heatmap">
          ${SECTOR_HEATMAP.map((cell) => `
            <button class="heat-cell ${toneClass(cell.change)}" style="${heatStyle(cell.change)}" type="button">
              <strong>${esc(cell.label)}</strong>
              <span>${formatPercent(cell.change)}</span>
            </button>
          `).join("")}
        </div>
        ${renderDataMeta(makeMeta("Lokales Sektor-Modell", "fallback", BOOT_TIME, "Sektor-Heatmap bleibt als lokales Modell stabil."))}
      </article>
    `;
  }

  function renderWatchlistCard() {
    const watchNews = watchlistNewsForView();
    const rows = state.watchlist.map((symbol) => {
      const asset = getAsset(symbol);
      const quote = quoteFor(symbol);
      return `
        <div class="watchlist-row compact-row">
          <button class="rank mini-rank" type="button" data-symbol="${escAttr(symbol)}">${esc(symbol.slice(0, 2))}</button>
          <div>
            <strong>${esc(symbol)}</strong>
            <span class="small">${esc(asset.name)}</span>
            ${renderDataMeta(quote.meta, true)}
          </div>
          <div class="right-cell">
            <strong>${formatMoney(quote.price, asset.currency)}</strong>
            <span class="${toneClass(quote.changePct)}">${formatPercent(quote.changePct)}</span>
          </div>
        </div>
      `;
    }).join("");

    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Watchlist der Woche</span>
            <h3>Lokal gespeichert</h3>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-route="alerts">Alerts</button>
            <button class="ghost-button" type="button" data-route="portfolio">Verwalten</button>
          </div>
        </div>
        <div class="stack-list">
          ${rows || renderEmptyState("Noch keine Watchlist. Füge ein Asset hinzu.")}
        </div>
        <div class="watchlist-news-box">
          <span class="card-label">Watchlist-News & Events</span>
          <p class="small">Bewegungen, Termine und Reminder für deine gespeicherten Assets. Live-Quotes werden bevorzugt, sonst bleibt der lokale Fallback aktiv.</p>
          ${watchNews.map((item) => `
            <button class="brief-event-row" type="button" data-symbol="${escAttr(item.symbol)}">
              <span class="pill">${esc(item.kind)}</span>
              <span><strong>${esc(item.symbol)}</strong><small>${esc(item.text)}</small></span>
            </button>
          `).join("") || renderEmptyState("Keine Watchlist-Hinweise im aktuellen Fenster.")}
        </div>
      </article>
    `;
  }

  function renderSentimentCard() {
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Reddit / Sentiment</span>
            <h3>Social Radar</h3>
          </div>
          ${renderTinyStatus("fallback")}
        </div>
        <div class="stack-list">
          ${SOCIAL_ITEMS.map((item) => `
            <button class="research-row sentiment-row" type="button" data-symbol="${escAttr(item.symbol)}">
              <span class="rank mini-rank">${esc(item.symbol.slice(0, 2))}</span>
              <span>
                <strong>${esc(item.symbol)} ${esc(item.mood)}</strong>
                <span class="small">${esc(item.channel)} - ${esc(item.detail)}</span>
              </span>
              <span class="${item.mood === "Bullish" ? "bull" : item.mood === "Bearish" ? "bear" : "neutral"}">${esc(item.buzz)}</span>
            </button>
          `).join("")}
        </div>
        ${renderDataMeta(makeMeta("Lokales Social/Sentiment-Modell", "fallback", BOOT_TIME, "Direkte Reddit/X APIs sind in dieser statischen Version nicht aktiv."))}
      </article>
    `;
  }

  function renderResearchTeaserCard() {
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Research / Guides / Newsletter</span>
            <h3>Research Library</h3>
          </div>
          <button class="ghost-button" type="button" data-route="research">Öffnen</button>
        </div>
        <div class="stack-list">
          ${LEARNING_GUIDES.map((guide, index) => `
            <div class="research-row">
              <span class="rank">${index + 1}</span>
              <span>
                <strong>${esc(guide.title)}</strong>
                <span class="small">${esc(guide.detail)}</span>
              </span>
              <span class="pill">${esc(guide.tag)}</span>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderScreenerPage() {
    ensureHomeData();
    ensureScreenerData();
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Screener V1</p>
            <h1>Rankings statt Bauchgefühl.</h1>
            <p>Filtere ein erweitertes Universum mit ${ASSETS.length} Assets nach Momentum, Value, Growth, Market Cap, Sektor und Performance. Der Screener nutzt Finnhub-Quotes/Profile/Fundamentals und Alpha-Vantage-Zeitreihen über serverseitige Vercel Functions, sofern sie im Deployment verfügbar sind; die Heuristik bleibt stabil hybrid.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-route="compare">Quick Compare</button>
            <button class="ghost-button" type="button" data-screener-reset>Filter zurücksetzen</button>
          </div>
        </div>
        <article class="card screener-controls">
          ${renderScreenerControl("search", "Suche", "input")}
          ${renderScreenerControl("momentum", "Momentum", "select", [["all", "Alle"], ["60", ">= 60"], ["70", ">= 70"]])}
          ${renderScreenerControl("value", "Value", "select", [["all", "Alle"], ["50", ">= 50"], ["60", ">= 60"]])}
          ${renderScreenerControl("growth", "Growth", "select", [["all", "Alle"], ["60", ">= 60"], ["75", ">= 75"]])}
          ${renderScreenerControl("marketCap", "Market Cap", "select", [["all", "Alle"], ["mega", "Mega Cap"], ["large", "Large Cap"], ["nonEquity", "ETF/Krypto/Rohstoff"]])}
          ${renderScreenerControl("sector", "Sektor", "select", screenerSectorOptions())}
          ${renderScreenerControl("performance", "Performance", "select", [["all", "Alle"], ["positive", "1M positiv"], ["strong", "1M > 5%"], ["weak", "1M < 0%"]])}
          ${renderScreenerControl("sort", "Sortierung", "select", [["score", "Score"], ["name", "Name"], ["performance", "Performance"], ["marketCap", "Market Cap"]])}
        </article>
      </section>
      <section class="section">
        <article class="card">
          <div class="card-topline">
            <div>
              <span class="card-label">Ranking-Liste</span>
              <h3>Gefilterte Assets</h3>
              <p>Jede Zeile zeigt, ob Quote, Profil, Fundamentals oder Zeitreihe live/cache-basiert sind oder lokal abgesichert bleiben.</p>
            </div>
            ${renderDataMeta(makeMeta("Lokale Screener Engine + verfügbare Quotes", getOverallDataStatus(), Date.now()), true)}
          </div>
          <div id="screenerResults">
            ${renderScreenerResults()}
          </div>
        </article>
      </section>
    `;
  }

  function renderScreenerControl(name, label, type, options = []) {
    const value = state.screener[name] || "";
    if (type === "input") {
      return `
        <label class="field">
          <span>${esc(label)}</span>
          <input data-screener-control name="${escAttr(name)}" value="${escAttr(value)}" placeholder="Symbol, Name oder Sektor">
        </label>
      `;
    }
    return `
      <label class="field">
        <span>${esc(label)}</span>
        <select data-screener-control name="${escAttr(name)}">
          ${options.map(([optionValue, text]) => `<option value="${escAttr(optionValue)}" ${String(value) === String(optionValue) ? "selected" : ""}>${esc(text)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function renderScreenerResults() {
    const rows = filteredScreenerRows();
    if (!rows.length) {
      return renderEmptyState("Keine Treffer. Filter etwas weiter stellen.");
    }
    return `
      <div class="screener-table">
        ${rows.map((row, index) => `
          <button class="screener-row" type="button" data-symbol="${escAttr(row.symbol)}">
            <span class="rank">${index + 1}</span>
            <span>
              <strong>${esc(row.symbol)} - ${esc(row.name)}</strong>
              <span class="small">${esc(row.sector)} | ${esc(row.rating.rating)} | ${esc(row.pickReason)}</span>
            </span>
            <span class="score-pill ${row.rating.tone}">${row.score}%</span>
            <span class="${toneClass(row.performance1m)}">${formatPercent(row.performance1m)} 1M</span>
            <span>${formatCompactMoney(row.marketCap, row.currency)}</span>
            <span class="screener-source">${renderTinyStatus(row.dataStatus)} ${esc(statusLabel(row.dataStatus))}</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderEventsPage() {
    ensureEventData();
    const events = eventsForView();
    const filtered = filteredEventHubEvents(events);
    const eventStatus = bestDataStatus(events.map((eventItem) => eventItem.meta.status));
    const summary = eventHubSummary(events);
    const focusEvents = importantEventsForHub(events).slice(0, 4);
    const watchlistEvents = events
      .filter(isWatchlistRelevantEvent)
      .filter((eventItem) => eventItem.date >= startOfToday() && eventItem.date < daysFromNow(14))
      .sort(sortEventsForHub)
      .slice(0, 8);
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Event- / Earnings-Hub</p>
            <h1>Termine, Earnings, Dividenden und Makroereignisse.</h1>
            <p>Der Hub bündelt die nächsten Termine, hebt Watchlist-Bezug hervor und trennt sauber zwischen Live-, Hybrid- und Fallback-Daten.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-route="home">Zum Tagesüberblick</button>
          </div>
        </div>
        <article class="card event-hub-hero">
          <div class="card-topline">
            <div>
              <span class="card-label">Was steht an?</span>
              <h3>${esc(summary.focusTitle)}</h3>
              <p>${esc(summary.focusText)}</p>
            </div>
            ${renderDataMeta(makeMeta("Event-Hub Datenmix", eventStatus, Date.now(), eventHubModeText(events)), true)}
          </div>
          <div class="event-hub-summary">
            ${renderMiniMetric("Heute", String(summary.today))}
            ${renderMiniMetric("Diese Woche", String(summary.week))}
            ${renderMiniMetric("Nächste Woche", String(summary.next))}
            ${renderMiniMetric("Watchlist", String(summary.watchlist))}
          </div>
          <div class="event-focus-list">
            ${focusEvents.map(renderEventFocusRow).join("") || renderEmptyState("Keine anstehenden Termine im aktuellen Kalender.")}
          </div>
        </article>
        ${renderEventProviderPanel()}
        ${renderEventHubFilters(events)}
        <div class="event-hub-layout">
          <article class="card">
            <div class="card-topline">
              <div>
                <span class="card-label">Event-Liste</span>
                <h3><span id="eventHubCount">${filtered.length}</span> Events</h3>
                <p>Gefiltert nach Zeitraum, Typ, Relevanz, Watchlist-Bezug und Quelle.</p>
              </div>
              ${renderStatusBadge(eventStatus)}
            </div>
            <div class="event-list" id="eventHubResults">
              ${filtered.map(renderEventCard).join("") || renderEmptyState("Keine Termine für diesen Filter. Zeitraum, Typ oder Suchbegriff erweitern.")}
            </div>
          </article>
          <article class="card">
            <div class="card-topline">
              <div>
                <span class="card-label">Watchlist-Relevanz</span>
                <h3>Was betrifft dich direkt?</h3>
                <p>Termine für gespeicherte Watchlist-Werte und Favoriten werden automatisch markiert.</p>
              </div>
              ${renderStatusBadge(eventStatus)}
            </div>
            <div class="event-list">
              ${watchlistEvents.map(renderEventCard).join("") || renderEmptyState("Keine Watchlist-relevanten Termine in den nächsten 14 Tagen.")}
            </div>
          </article>
        </div>
      </section>
    `;
  }

  function renderEventHubFilters(events) {
    const counts = eventHubCounts(events);
    const typeFilters = [
      ["all", "Alle", counts.all],
      ["earnings", "Earnings", counts.earnings],
      ["dividend", "Dividenden", counts.dividend],
      ["macro", "Makro", counts.macro],
      ["ipo", "IPOs", counts.ipo]
    ];
    const windowFilters = [
      ["today", "Heute"],
      ["week", "Diese Woche"],
      ["next", "Nächste Woche"]
    ];
    const scopeFilters = [
      ["all", "Alle Bereiche"],
      ["watchlist", "Nur Watchlist"],
      ["stock", "Nur Aktie"],
      ["macro", "Nur Makro"]
    ];
    const relevanceFilters = [
      ["all", "Alle Relevanzen"],
      ["high", "Hohe Relevanz"],
      ["medium", "Mindestens mittel"]
    ];
    const sourceFilters = [
      ["all", "Alle Quellen"],
      ["live", "Live"],
      ["fallback", "Fallback"],
      ["finnhub", "Finnhub"],
      ["alpha", "Alpha Vantage"],
      ["local", "Lokal / MH"]
    ];
    return `
      <article class="card event-filter-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Filter</span>
            <h3>Zeitraum, Typ und Relevanz</h3>
          </div>
          ${renderDataMeta(makeMeta("Event-Hub Filter", bestDataStatus(events.map((eventItem) => eventItem.meta.status)), Date.now()), true)}
        </div>
        <div class="event-filter-grid">
          <div>
            <span class="filter-label">Zeitraum</span>
            <div class="chip-row">
              ${windowFilters.map(([value, label]) => `<button class="chip ${state.eventHub.window === value ? "active" : ""}" type="button" data-event-window="${escAttr(value)}">${esc(label)}</button>`).join("")}
            </div>
          </div>
          <div>
            <span class="filter-label">Typ</span>
            <div class="chip-row">
              ${typeFilters.map(([value, label, count]) => `<button class="chip ${state.eventHub.type === value ? "active" : ""}" type="button" data-event-filter="${escAttr(value)}">${esc(label)} ${count}</button>`).join("")}
            </div>
          </div>
          <div>
            <span class="filter-label">Bereich</span>
            <div class="chip-row">
              ${scopeFilters.map(([value, label]) => `<button class="chip ${state.eventHub.scope === value ? "active" : ""}" type="button" data-event-scope="${escAttr(value)}">${esc(label)}</button>`).join("")}
            </div>
          </div>
          <div>
            <span class="filter-label">Relevanz</span>
            <div class="chip-row">
              ${relevanceFilters.map(([value, label]) => `<button class="chip ${state.eventHub.relevance === value ? "active" : ""}" type="button" data-event-relevance="${escAttr(value)}">${esc(label)}</button>`).join("")}
            </div>
          </div>
          <label class="field">
            <span>Quelle / Datenstatus</span>
            <select data-event-control name="source">
              ${sourceFilters.map(([value, label]) => `<option value="${escAttr(value)}" ${state.eventHub.source === value ? "selected" : ""}>${esc(label)}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Symbol oder Begriff</span>
            <input data-event-control name="search" value="${escAttr(state.eventHub.search)}" placeholder="z. B. NVDA, CPI, IPO">
          </label>
        </div>
      </article>
    `;
  }

  function renderEventHubResults(filtered) {
    const rows = filtered || filteredEventHubEvents(eventsForView());
    return rows.map(renderEventCard).join("") || renderEmptyState("Keine Termine für diesen Filter. Zeitraum, Typ oder Suchbegriff erweitern.");
  }

  function renderEventProviderPanel() {
    const events = eventsForView();
    const status = events.some((eventItem) => eventItem.meta.status === "live") ? "live" : events.some((eventItem) => eventItem.meta.status === "stale") ? "stale" : "fallback";
    return `
      <article class="card event-provider-panel">
        <div class="card-topline">
          <div>
            <span class="card-label">Events / Earnings Provider</span>
            <h3>Datenpfade für Termine und Corporate Actions</h3>
          </div>
          ${renderDataMeta(makeMeta("Provider Registry + Event-Datenlayer", status, Date.now()), true)}
        </div>
        <div class="grid four event-provider-grid">
          ${EVENT_PROVIDER_SLOTS.map((slot) => `
            <div class="provider-mini-card">
              <span class="card-label">${esc(slot.provider)}</span>
              <strong>${esc(slot.name)}</strong>
              <p>${esc(slot.coverage)}</p>
              ${slot.providerId ? renderProviderLiveBadge(providerHealthFor(slot.providerId)) : renderStatusBadge("fallback")}
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderMacroPage() {
    ensureHomeData();
    const macro = macroEnhancedForView();
    const liquidity = liquidityNarrativeForView();
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Makro Dashboard</p>
            <h1>Liquidität, Zinsen und Risiko in einem Blick.</h1>
            <p>FRED-Daten werden online serverseitig über /api/fred genutzt. ECB, BLS, Treasury und lokale Fallbacks ergänzen das Bild für Zinsen, Geldmengen, Realzins und Yield Curve.</p>
          </div>
          <button class="ghost-button" type="button" data-route="settings">Provider prüfen</button>
        </div>
        <article class="card macro-context-card">
          <div class="card-topline">
            <div>
              <span class="card-label">Kernaussage</span>
              <h3>${esc(liquidity.label)}</h3>
              <p>${esc(liquidity.summary)}</p>
            </div>
            <span class="score-pill ${liquidity.tone}">${formatNumber(liquidity.score)} / 100</span>
          </div>
          <div class="grid four">
            ${liquidityImpactForView().map((item) => `
              <div class="snapshot-tile">
                <span>${esc(item.asset)}</span>
                <strong>${esc(item.signal)}</strong>
                <p>${esc(item.text)}</p>
              </div>
            `).join("")}
          </div>
        </article>
        ${renderGlobalMacroCard()}
        <div class="grid four macro-deep-grid">
          ${macro.map((item) => renderMacroDeepCard(item)).join("")}
        </div>
      </section>
    `;
  }

  function renderGlobalMacroCard() {
    const rows = state.globalMacro.length ? state.globalMacro : fallbackGlobalMacro("Globale Open-Data-Fallbacks aktiv.");
    const status = bestDataStatus(rows.map((row) => row.meta?.status || row.status));
    return `
      <article class="card macro-context-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Globale Makro-/Ländervergleiche</span>
            <h3>World Bank / IMF Dateninput</h3>
            <p>Diese Karte ersetzt allgemeine Länderstatik durch echte Open-Data-Reihen, wenn die Quellen im Browser erreichbar sind.</p>
          </div>
          ${renderStatusBadge(status)}
        </div>
        <div class="grid three">
          ${rows.slice(0, 6).map((row) => `
            <div class="snapshot-tile">
              <span>${esc(row.indicator)}</span>
              <strong>${esc(row.country)} ${esc(row.display)}</strong>
              <p>${esc(row.source || row.meta?.source || "Open Data / Fallback")}</p>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderLiquidityPage() {
    const liquidity = liquidityForView();
    const narrative = liquidityNarrativeForView();
    const buckets = liquidityBucketsForView();
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Geldmengen & Liquidität</p>
            <h1>Liquidität, Realzins und Zinskurve klar einordnen.</h1>
            <p>Dieser Bereich trennt Geldmengen und Liquidität vom allgemeinen Makro-Dashboard. M1, M2, M3, M4, Realzins, Yield Curve und Zentralbank-Bilanzen sind mit Quelle, Zeitstempel und Status sichtbar gekennzeichnet.</p>
          </div>
          <button class="ghost-button" type="button" data-route="settings">Makro-Provider prüfen</button>
        </div>
        <article class="card macro-context-card">
          <div class="card-topline">
            <div>
              <span class="card-label">Liquiditätsampel</span>
              <h3>${esc(narrative.label)}</h3>
              <p>${esc(narrative.summary)}</p>
            </div>
            <span class="score-pill ${narrative.tone}">${formatNumber(narrative.score)} / 100</span>
          </div>
          <div class="grid four">
            ${liquidityImpactForView().map((item) => `
              <div class="snapshot-tile">
                <span>${esc(item.asset)}</span>
                <strong>${esc(item.signal)}</strong>
                <p>${esc(item.watch)}</p>
              </div>
            `).join("")}
          </div>
        </article>
        <div class="grid three liquidity-overview">
          <article class="card">
            <span class="card-label">Warum relevant?</span>
            <h3>Liquidität beeinflusst Risikoappetit</h3>
            <p>Steigende Liquidität kann Aktien, Krypto und High-Beta-Assets unterstützen. Sinkende Liquidität erhöht oft Bewertungsdruck und Stress im Markt.</p>
          </article>
          <article class="card">
            <span class="card-label">Was beobachten?</span>
            <h3>Geldmenge, Realzins, Kurve</h3>
            <p>M2, Zentralbank-Bilanzen und Kreditbedingungen zeigen die Liquiditätsrichtung. Realzins und Yield Curve helfen bei Gold, Growth und Rezessionsrisiko.</p>
          </article>
          <article class="card">
            <span class="card-label">Status</span>
            <h3>Live vorbereitet, Fallback aktiv</h3>
            <p>FRED und ECB sind vorbereitet. Wo kein Live-Pfad aktiv ist, nutzt MH Analytics strukturierte lokale Fallback-Daten.</p>
          </article>
        </div>
      </section>
      <section class="section compact-section">
        <div class="grid three">
          ${buckets.map((bucket) => `
            <article class="card liquidity-bucket-card">
              <span class="card-label">${esc(bucket.label)}</span>
              <h3>${esc(bucket.items.map((item) => item.id).join(" / "))}</h3>
              <div class="stack-list">
                ${bucket.items.map((item) => `
                  <div class="compact-row">
                    <span><strong>${esc(item.label)}</strong><small>${esc(item.trend)}</small></span>
                    <span class="right-cell"><strong>${esc(item.display)}</strong>${renderTinyStatus(item.meta.status)}</span>
                  </div>
                `).join("")}
              </div>
            </article>
          `).join("")}
        </div>
      </section>
      <section class="section">
        <div class="grid four macro-deep-grid">
          ${liquidity.map((item) => renderMacroDeepCard(item)).join("")}
        </div>
      </section>
    `;
  }

  function renderMacroDeepCard(item) {
    return `
      <article class="card data-card macro-deep-card">
        <div class="card-topline">
          <div>
            <span class="card-label">${esc(item.id)}</span>
            <h3>${esc(item.label)}</h3>
          </div>
          ${renderTinyStatus(item.meta.status)}
        </div>
        <strong class="value">${esc(item.display)}</strong>
        <p>${esc(item.trend)}</p>
        <div class="insight-row">
          <span class="pill">Warum?</span>
          <p>${esc(item.why || "Relevanter Makroindikator für Liquidität, Risikoappetit und Bewertungen.")}</p>
        </div>
        <div class="insight-row">
          <span class="pill">Signal</span>
          <p>${esc(item.meaning || "Steigend/fallend wird im Kontext von Zinsen, Inflation und Risikoassets interpretiert.")}</p>
        </div>
        ${renderDataMeta(item.meta)}
      </article>
    `;
  }

  function renderEtfPage() {
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">ETF System</p>
            <h1>ETF-Kosten, Holdings, Regionen und Überschneidung.</h1>
            <p>Lokale strukturierte ETF-Datenbasis mit TER, Regionen, Top Holdings, Ausschüttungstyp, Basisrisiko und Währungsrisiko. Wo Live-Holdings fehlen, bleibt der Status klar als Fallback markiert.</p>
          </div>
          ${renderDataMeta(makeMeta("Lokale ETF-Datenbasis", "fallback", BOOT_TIME), true)}
        </div>
        <div class="grid three etf-guide-grid">
          <article class="card">
            <span class="card-label">Worauf achten?</span>
            <h3>Kosten, Konzentration, Währung</h3>
            <p>TER ist nur ein Teil der Kosten. Wichtig sind außerdem Klumpen in Top-Holdings, USD-Exposure und ob ein ETF als Kern oder Satellit gedacht ist.</p>
          </article>
          <article class="card">
            <span class="card-label">Ausschüttend vs. thesaurierend</span>
            <h3>Cashflow oder Wiederanlage</h3>
            <p>Ausschüttende ETFs liefern laufende Zahlungen. Thesaurierende ETFs reinvestieren Erträge automatisch und sind oft bequemer für langfristigen Vermögensaufbau.</p>
          </article>
          <article class="card">
            <span class="card-label">Datenstatus</span>
            <h3>Fallback statt leerer Tabelle</h3>
            <p>TER, Regionen und Holdings sind lokal modelliert. Live-ETF-Holdings werden später über geeignete Provider ergänzt, ohne das Modul zu blockieren.</p>
          </article>
        </div>
        <div class="grid two">
          ${ETF_DATA.map(renderEtfCard).join("")}
        </div>
      </section>
      <section class="section">
        <div class="grid two">
          ${renderEtfCostCalculator()}
          ${renderEtfOverlapChecker()}
        </div>
      </section>
    `;
  }

  function renderEtfCard(etf) {
    const concentration = etfHoldingConcentration(etf);
    return `
      <article class="card etf-card">
        <div class="card-topline">
          <div>
            <span class="card-label">${esc(etf.symbol)}</span>
            <h3>${esc(etf.name)}</h3>
          </div>
          ${renderStatusBadge("fallback")}
        </div>
        <div class="metric-grid">
          ${renderMiniMetric("TER", `${formatNumber(etf.ter)}%`)}
          ${renderMiniMetric("Typ", etf.distribution)}
          ${renderMiniMetric("Währung", etf.currency)}
          ${renderMiniMetric("Top-5 Anteil", `${formatNumber(concentration)}%`)}
        </div>
        <div class="grid two">
          <div class="insight-row"><span class="pill">Einsatz</span><p>${esc(etf.useCase || "ETF-Baustein für Portfolio-Exposure.")}</p></div>
          <div class="insight-row"><span class="pill">Ausschüttung</span><p>${esc(distributionExplanation(etf))}</p></div>
        </div>
        <h4>Top Holdings</h4>
        <div class="mini-bars">
          ${etf.holdings.map(([name, weight]) => renderMiniBar(name, weight)).join("")}
        </div>
        <h4>Regionen</h4>
        <div class="mini-bars">
          ${etf.region.map(([name, weight]) => renderMiniBar(name, weight)).join("")}
        </div>
        <p><strong>Basis-Risiko:</strong> ${esc(etf.risk)}</p>
        <p><strong>Währungsrisiko:</strong> ${esc(etf.fxRisk)}</p>
        <p><strong>Struktur:</strong> ${esc(etf.structure || etf.dataNote || "Lokales ETF-Modell.")}</p>
        ${renderDataMeta(makeMeta("Lokale ETF-Datenbasis", "fallback", BOOT_TIME))}
      </article>
    `;
  }

  function renderEtfCostCalculator() {
    const amount = Number(state.etf.amount || 0);
    const years = Number(state.etf.years || 0);
    const selected = ETF_DATA.find((etf) => etf.symbol === state.etf.left) || ETF_DATA[0];
    const cost = amount * (selected.ter / 100) * years;
    const yearlyCost = amount * (selected.ter / 100);
    const monthlyCost = yearlyCost / 12;
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">ETF Kosten Rechner</span>
            <h3>Was kostet der ETF grob?</h3>
          </div>
          ${renderStatusBadge("fallback")}
        </div>
        <div class="form-grid">
          <label class="field">
            <span>ETF</span>
            <select data-etf-control name="left">${ETF_DATA.map((etf) => `<option value="${escAttr(etf.symbol)}" ${state.etf.left === etf.symbol ? "selected" : ""}>${esc(etf.symbol)}</option>`).join("")}</select>
          </label>
          <label class="field">
            <span>Anlagebetrag</span>
            <input data-etf-control name="amount" type="number" value="${escAttr(amount)}">
          </label>
          <label class="field">
            <span>Jahre</span>
            <input data-etf-control name="years" type="number" value="${escAttr(years)}">
          </label>
        </div>
        <div class="metric-grid">
          ${renderMiniMetric("pro Jahr", formatMoney(yearlyCost, selected.currency))}
          ${renderMiniMetric("pro Monat", formatMoney(monthlyCost, selected.currency))}
          ${renderMiniMetric(`${years} Jahre`, formatMoney(cost, selected.currency))}
        </div>
        <p>Grobe TER-Näherung ohne Rendite, Tracking Difference, Spreads und Steuereffekte. Für die erste Einschätzung reicht das, für echte Entscheidungen später Live-/Emittentendaten prüfen.</p>
        ${renderDataMeta(makeMeta("Lokaler ETF-Kostenrechner", "fallback", BOOT_TIME))}
      </article>
    `;
  }

  function renderEtfOverlapChecker() {
    const left = ETF_DATA.find((etf) => etf.symbol === state.etf.left) || ETF_DATA[0];
    const right = ETF_DATA.find((etf) => etf.symbol === state.etf.right) || ETF_DATA[1];
    const overlap = etfOverlap(left, right);
    const overlapText = etfOverlapText(overlap);
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">ETF Overlap Checker V1</span>
            <h3>${esc(left.symbol)} vs ${esc(right.symbol)}</h3>
          </div>
          ${renderStatusBadge("fallback")}
        </div>
        <div class="form-grid">
          <label class="field">
            <span>ETF A</span>
            <select data-etf-control name="left">${ETF_DATA.map((etf) => `<option value="${escAttr(etf.symbol)}" ${state.etf.left === etf.symbol ? "selected" : ""}>${esc(etf.symbol)}</option>`).join("")}</select>
          </label>
          <label class="field">
            <span>ETF B</span>
            <select data-etf-control name="right">${ETF_DATA.map((etf) => `<option value="${escAttr(etf.symbol)}" ${state.etf.right === etf.symbol ? "selected" : ""}>${esc(etf.symbol)}</option>`).join("")}</select>
          </label>
        </div>
        <div class="metric-grid">
          ${renderMiniMetric("Holdings", `${formatNumber(overlap.score)}%`)}
          ${renderMiniMetric("Regionen", `${formatNumber(overlap.regionScore)}%`)}
          ${renderMiniMetric("TER-Differenz", `${formatNumber(Math.abs(left.ter - right.ter))}%`)}
        </div>
        <p>Top-Holdings-Überschneidung: ${esc(overlap.names.join(", ") || "keine Top-Overlap-Holdings")}. Regionale Überschneidung: ${esc(overlap.regionNames.join(", ") || "keine erkennbare regionale Dopplung")}.</p>
        <div class="insight-row"><span class="pill">Einordnung</span><p>${esc(overlapText)}</p></div>
        <div class="row-actions">
          <button class="ghost-button" type="button" data-compare-pair-left="${escAttr(left.symbol)}" data-compare-pair-right="${escAttr(right.symbol)}">Im Quick Compare öffnen</button>
        </div>
        ${renderDataMeta(makeMeta("Lokaler ETF-Overlap-Fallback", "fallback", BOOT_TIME))}
      </article>
    `;
  }

  function renderAlertsPage() {
    ensureHomeData();
    ensureEventData();
    checkAlerts(false);
    const filteredAlerts = alertsForView();
    const inbox = alertInboxForView();
    const summary = alertSummary();
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Alerts V2</p>
            <h1>Alert-Center für Preise, Earnings, Events und Watchlist.</h1>
            <p>Alerts laufen lokal im Browser, nutzen vorhandene Kurs- und Event-Daten und markieren klar, ob ein Hinweis offen, ausgelöst, erledigt oder pausiert ist. Keine Push-Infrastruktur, keine Realtime-Versprechen.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-route="events">Event-Hub</button>
            <button class="ghost-button" type="button" data-alert-check>Jetzt prüfen</button>
          </div>
        </div>
        ${renderAlertSummary(summary)}
        <div class="grid two alerts-workbench">
          ${renderCreateAlertCard()}
          ${renderAlertInboxCard(inbox)}
        </div>
      </section>
      <section class="section">
        <article class="card">
          <div class="card-topline">
            <div>
              <span class="card-label">Gespeicherte Alerts</span>
              <h3>${filteredAlerts.length} Regeln im Filter</h3>
              <p>Status, Priorität, Typ, Watchlist-Bezug und Symbolsuche helfen gegen Alert-Chaos.</p>
            </div>
            ${renderDataMeta(makeMeta("Lokaler Browser-Speicher + Event-Hub-Daten", alertDataStatus(), Date.now()), true)}
          </div>
          ${renderAlertFilters()}
          <div class="alert-list" id="alertResults">
            ${filteredAlerts.map(renderAlertRow).join("") || renderEmptyState("Keine Alerts in diesem Filter.")}
          </div>
        </article>
      </section>
      <section class="section compact-section">
        ${renderAlertHistoryCard()}
      </section>
    `;
  }

  function renderAlertSummary(summary) {
    return `
      <div class="alert-summary-grid">
        ${renderMiniMetric("Offen", String(summary.open))}
        ${renderMiniMetric("Ausgelöst", String(summary.triggered))}
        ${renderMiniMetric("Pausiert", String(summary.paused))}
        ${renderMiniMetric("Erledigt", String(summary.done))}
        ${renderMiniMetric("Watchlist", String(summary.watchlist))}
      </div>
    `;
  }

  function renderCreateAlertCard() {
    const draftSymbol = assetMap.has(state.alertDraft.symbol) ? state.alertDraft.symbol : (assetMap.has(state.activeSymbol) ? state.activeSymbol : "NVDA");
    const draftType = state.alertDraft.type || "price";
    return `
      <article class="card alert-create-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Alert anlegen</span>
            <h3>Schnellregel speichern</h3>
            <p>Preislevel, Earnings, Events und Watchlist-Bewegungen werden lokal geprüft.</p>
          </div>
          ${renderStatusBadge("fallback")}
        </div>
        <form class="alert-form" data-alert-form>
          <label class="field">
            <span>Asset</span>
            <select name="symbol">
              ${ASSETS.map((asset) => `<option value="${escAttr(asset.symbol)}" ${draftSymbol === asset.symbol ? "selected" : ""}>${esc(asset.symbol)} - ${esc(asset.name)}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Typ</span>
            <select name="type">
              ${alertTypeOptions(draftType)}
            </select>
          </label>
          <label class="field">
            <span>Bedingung</span>
            <select name="condition">
              <option value="above">Preis über Ziel</option>
              <option value="below">Preis unter Ziel</option>
              <option value="move">Tagesbewegung größer als %</option>
            </select>
          </label>
          <label class="field">
            <span>Zielwert</span>
            <input name="target" type="number" step="0.01" placeholder="nur für Preis, z. B. 900 oder 3">
          </label>
          <label class="field">
            <span>Priorität</span>
            <select name="priority">
              <option value="high">hoch</option>
              <option value="medium" selected>mittel</option>
              <option value="low">niedrig</option>
            </select>
          </label>
          <button class="primary-button" type="submit">Alert speichern</button>
        </form>
        <div class="alert-quick-row">
          ${state.watchlist.slice(0, 5).map((symbol) => `<button class="chip" type="button" data-alert-quick="${escAttr(symbol)}" data-alert-quick-type="watchlist">${esc(symbol)} Watchlist</button>`).join("")}
        </div>
        <p class="small">Datenstatus: Preis-Alerts nutzen Kursdaten; Event- und Earnings-Alerts nutzen den Event-Hub. Alles bleibt lokal und kann verzögert oder fallback-basiert sein.</p>
      </article>
    `;
  }

  function renderAlertInboxCard(inbox) {
    return `
      <article class="card alert-inbox-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Alert Inbox</span>
            <h3>${inbox.length} Hinweise</h3>
            <p>Neue Auslösungen, Snooze- und Erledigt-Hinweise.</p>
          </div>
          <button class="ghost-button" type="button" data-alert-clear-inbox>Leeren</button>
        </div>
        <div class="stack-list">
          ${inbox.slice(0, 10).map(renderAlertInboxRow).join("") || renderEmptyState("Noch keine Hinweise. Alerts prüfen sich lokal anhand der verfügbaren Daten.")}
        </div>
      </article>
    `;
  }

  function renderAlertInboxRow(item) {
    return `
      <div class="alert-inbox-row">
        <div>
          <strong>${esc(item.title)}</strong>
          <span class="small">${esc(item.message)} | ${formatTimestamp(item.timestamp)}</span>
        </div>
        <span class="pill ${priorityTone(item.priority)}">${esc(priorityLabel(item.priority))}</span>
      </div>
    `;
  }

  function renderAlertFilters() {
    const statusFilters = [["all", "Alle"], ["open", "Offen"], ["triggered", "Ausgelöst"], ["paused", "Pausiert"], ["done", "Erledigt"]];
    const typeFilters = [["all", "Alle Typen"], ["price", "Preis"], ["earnings", "Earnings"], ["event", "Event"], ["watchlist", "Watchlist"]];
    const priorityFilters = [["all", "Alle Prioritäten"], ["high", "hoch"], ["medium", "mittel"], ["low", "niedrig"]];
    const scopeFilters = [["all", "Alle Assets"], ["watchlist", "nur Watchlist"]];
    return `
      <div class="alert-filter-panel">
        <div>
          <span class="filter-label">Status</span>
          <div class="chip-row alert-filter-row">
            ${statusFilters.map(([value, label]) => renderAlertFilterChip("status", value, label)).join("")}
          </div>
        </div>
        <div>
          <span class="filter-label">Typ</span>
          <div class="chip-row alert-filter-row">
            ${typeFilters.map(([value, label]) => renderAlertFilterChip("type", value, label)).join("")}
          </div>
        </div>
        <div>
          <span class="filter-label">Priorität</span>
          <div class="chip-row alert-filter-row">
            ${priorityFilters.map(([value, label]) => renderAlertFilterChip("priority", value, label)).join("")}
          </div>
        </div>
        <div>
          <span class="filter-label">Bereich</span>
          <div class="chip-row alert-filter-row">
            ${scopeFilters.map(([value, label]) => renderAlertFilterChip("scope", value, label)).join("")}
          </div>
        </div>
        <label class="field">
          <span>Symbol / Text</span>
          <input data-alert-control name="search" value="${escAttr(state.alertFilters.search)}" placeholder="z. B. NVDA, Earnings, Macro">
        </label>
      </div>
    `;
  }

  function renderAlertFilterChip(group, value, label) {
    const active = (state.alertFilters[group] || "all") === value;
    return `<button class="chip ${active ? "active" : ""}" type="button" data-alert-filter-group="${escAttr(group)}" data-alert-filter="${escAttr(value)}">${esc(label)}</button>`;
  }

  function renderAlertHistoryCard() {
    const history = alertHistoryForView();
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Historie</span>
            <h3>Was wurde ausgelöst oder bearbeitet?</h3>
          </div>
          ${renderDataMeta(makeMeta("Lokale Alert-Historie", "live", Date.now()), true)}
        </div>
        <div class="alert-history-list">
          ${history.map(renderAlertHistoryRow).join("") || renderEmptyState("Noch keine Alert-Historie.")}
        </div>
      </article>
    `;
  }

  function renderAlertHistoryRow(item) {
    return `
      <div class="alert-history-row">
        <span class="pill ${item.status === "triggered" ? "bear" : item.status === "done" ? "neutral" : ""}">${esc(alertStatusText(item.status))}</span>
        <span><strong>${esc(item.symbol)} · ${esc(alertTypeLabel(item.type))}</strong><small>${esc(item.message)} | ${formatTimestamp(item.timestamp)}</small></span>
        <span class="small">${esc(priorityLabel(item.priority))}</span>
      </div>
    `;
  }

  function renderAssetPage() {
    const symbol = assetMap.has(state.activeSymbol) ? state.activeSymbol : "NVDA";
    const asset = getAsset(symbol);
    const quote = quoteFor(symbol);
    const profile = profileFor(symbol);
    const fundamentals = fundamentalsFor(symbol);
    const news = newsFor(symbol);
    const sentiment = sentimentFor(symbol, quote, news);
    const technical = technicalFor(symbol, quote);
    const events = eventsForSymbol(symbol);
    const activeTab = ["overview", "technical", "fundamental", "news", "events", "insider", "journal"].includes(state.assetTab) ? state.assetTab : "overview";
    const assetContext = { symbol, asset, quote, profile, fundamentals, news, sentiment, technical, events };
    const research = buildAssetResearchSnapshot(assetContext);

    ensureAssetData(symbol);
    ensureEventData();

    app.innerHTML = `
      <section class="asset-hero">
        <div class="asset-main">
          <p class="eyebrow">Einzelaktien-Seite</p>
          <h1>${esc(symbol)} <span>${esc(profile.name || asset.name)}</span></h1>
          <p>${esc(asset.thesis)}</p>
          <div class="module-chip-row asset-identity-row">
            <span class="module-chip"><strong>Typ</strong><small>${esc(research.identity.type)}</small></span>
            <span class="module-chip"><strong>Kategorie</strong><small>${esc(research.identity.category)}</small></span>
            <span class="module-chip"><strong>Charakter</strong><small>${esc(research.identity.character)}</small></span>
            <span class="module-chip"><strong>Datenlage</strong><small>${esc(research.dataQuality.label)}</small></span>
          </div>
          <div class="asset-actions">
            <button class="primary-button" type="button" data-watch-add="${escAttr(symbol)}">Zur Watchlist</button>
            <button class="ghost-button" type="button" data-alert-quick="${escAttr(symbol)}" data-alert-quick-type="price">Alert setzen</button>
            <button class="ghost-button" type="button" data-favorite-symbol="${escAttr(symbol)}">${isFavoriteSymbol(symbol) ? "Favorit entfernen" : "Favorit"}</button>
            <button class="ghost-button" type="button" data-compare-open="${escAttr(symbol)}">Vergleichen</button>
            <button class="ghost-button" type="button" data-report="asset" data-symbol="${escAttr(symbol)}">Report exportieren</button>
            <a class="ghost-button" href="${tradingViewUrl(asset)}" target="_blank" rel="noreferrer">Chart bei TradingView</a>
          </div>
        </div>
        <div class="asset-price-card">
          <span class="card-label">Aktueller Preis</span>
          <strong>${formatMoney(quote.price, asset.currency)}</strong>
          <span class="${toneClass(quote.changePct)}">${formatPercent(quote.changePct)} heute</span>
          ${renderDataMeta(quote.meta)}
        </div>
      </section>

      <section class="section">
        <div class="kpi-strip">
          ${renderKpi("Market Cap", formatCompactMoney(valueOr(profile.marketCap, fundamentals.marketCap), asset.currency), profile.meta || fundamentals.meta)}
          ${renderKpi("KGV", formatNumber(valueOr(fundamentals.pe, asset.fallback.pe), "x"), fundamentals.meta)}
          ${renderKpi("EPS", formatMoney(valueOr(fundamentals.eps, asset.fallback.eps), asset.currency), fundamentals.meta)}
          ${renderKpi("Umsatz", formatCompactMoney(valueOr(fundamentals.revenue, asset.fallback.revenue), asset.currency), fundamentals.meta)}
        </div>
        ${renderAssetDataStatusStrip({ quote, profile, fundamentals, news, events })}
        ${renderAssetAlertStrip(symbol)}
      </section>

      <section class="section asset-research-section">
        ${renderAssetResearchSnapshot(assetContext, research)}
      </section>

      <section class="section">
        <div class="asset-tabbar" role="tablist" aria-label="Asset Bereiche">
          ${renderAssetTab("overview", "Übersicht", activeTab)}
          ${renderAssetTab("technical", "Technisch", activeTab)}
          ${renderAssetTab("fundamental", "Fundamental", activeTab)}
          ${renderAssetTab("news", "News", activeTab)}
          ${renderAssetTab("events", "Events", activeTab)}
          ${renderAssetTab("insider", "Insider / Institutionelle", activeTab)}
          ${renderAssetTab("journal", "Thesis / Journal", activeTab)}
        </div>
      </section>

      ${renderAssetTabContent(activeTab, assetContext)}
    `;

    if (activeTab === "overview") {
      mountTradingView(asset);
    }
  }

  function renderAssetTab(tab, label, activeTab) {
    return `<button class="asset-tab ${activeTab === tab ? "active" : ""}" type="button" role="tab" aria-selected="${activeTab === tab}" data-asset-tab="${escAttr(tab)}">${esc(label)}</button>`;
  }

  function renderAssetDataStatusStrip(context) {
    const items = [
      ["Preis", context.quote.meta],
      ["Profil", context.profile.meta],
      ["Fundamentals", context.fundamentals.meta],
      ["News", context.news.meta],
      ["Events", context.events[0] ? context.events[0].meta : makeMeta("Event-Kalender", "fallback", BOOT_TIME)]
    ];
    return `
      <div class="asset-data-strip">
        <span class="card-label">Datenlage dieser Asset-Seite</span>
        <div class="module-chip-row">
          ${items.map(([label, meta]) => `
            <span class="module-chip data-chip">
              <strong>${esc(label)}</strong>
              ${renderTinyStatus(meta.status)}
              <small>${esc(meta.source)}</small>
            </span>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderAssetAlertStrip(symbol) {
    const alerts = state.alerts
      .map(normalizeAlertRecord)
      .filter((alert) => alert.symbol === symbol)
      .slice(0, 3);
    return `
      <div class="asset-alert-strip">
        <div>
          <span class="card-label">Alerts zu ${esc(symbol)}</span>
          <p class="small">${alerts.length ? "Aktive oder historische Regeln für diese Asset-Seite." : "Noch keine Regel für dieses Asset. Setze bei Bedarf einen Preis-, Earnings- oder Event-Alert."}</p>
        </div>
        <div class="module-chip-row">
          ${alerts.map((alert) => `
            <span class="module-chip data-chip">
              <strong>${esc(alertTypeLabel(alert.type))}</strong>
              <small>${esc(alertStatusLabel(alert))} · ${esc(priorityLabel(alert.priority))}</small>
            </span>
          `).join("") || `<button class="ghost-button" type="button" data-alert-quick="${escAttr(symbol)}" data-alert-quick-type="price">Alert setzen</button>`}
        </div>
      </div>
    `;
  }

  function renderAssetTabContent(tab, context) {
    const { symbol, asset, quote, profile, fundamentals, news, sentiment, technical, events } = context;
    if (tab === "technical") {
      return `
        <section class="section">
          <div class="grid two">
            ${renderTechnicalCard(technical)}
            ${renderRatingExplainerCard()}
          </div>
        </section>
      `;
    }
    if (tab === "fundamental") {
      return `
        <section class="section">
          ${renderFundamentalsCard(asset, fundamentals)}
        </section>
      `;
    }
    if (tab === "news") {
      return `
        <section class="section">
          ${renderCompanyNews(symbol, news)}
        </section>
      `;
    }
    if (tab === "events") {
      return `
        <section class="section">
          ${renderAssetEventsCard(symbol, events)}
        </section>
      `;
    }
    if (tab === "insider") {
      return `
        <section class="section">
          ${renderInsiderInstitutionalCard(symbol)}
        </section>
      `;
    }
    if (tab === "journal") {
      return `
        <section class="section">
          ${renderThesisJournalCard(symbol)}
        </section>
      `;
    }
    return `
      <section class="section chart-card">
        <div class="chart-topbar">
          <div>
            <span class="card-label">TradingView</span>
            <h2>${esc(symbol)} Chart</h2>
            <p>Offizielles TradingView Advanced Chart Widget. Kein Fake-Chart als Hauptlösung.</p>
          </div>
          <div class="chart-actions">
            <a class="ghost-button" href="${tradingViewUrl(asset)}" target="_blank" rel="noreferrer">Direkt öffnen</a>
          </div>
        </div>
        <div class="tradingview-host" id="tradingviewHost" data-tv-symbol="${escAttr(asset.tv)}">
          <div class="tradingview-widget-container">
            <div class="tradingview-widget-container__widget"></div>
          </div>
          <div class="tradingview-fallback hidden" id="tradingviewFallback">
            <div class="tradingview-fallback-inner">
              <h3>TradingView konnte lokal nicht geladen werden.</h3>
              <p>Das passiert manchmal bei Datei-Start per Doppelklick, Browser-Sicherheit, Adblockern oder fehlender Internetverbindung. Online auf einer echten Domain ist die Komponente vorbereitet.</p>
              <a class="primary-button" href="${tradingViewUrl(asset)}" target="_blank" rel="noreferrer">Chart direkt bei TradingView öffnen</a>
            </div>
          </div>
        </div>
      </section>
      <section class="section">
        <div class="grid three">
          <article class="card">
            <div class="card-topline">
              <div>
                <span class="card-label">Kurzprofil</span>
                <h3>${esc(profile.name || asset.name)}</h3>
              </div>
              ${renderTinyStatus(profile.meta.status)}
            </div>
            <p>${esc(asset.thesis)}</p>
            <p><strong>Risiko:</strong> ${esc(asset.risks)}</p>
            ${renderDataMeta(profile.meta)}
          </article>
          ${renderSecFilingsCard(symbol)}
          ${renderSentimentDetail(sentiment)}
        </div>
      </section>
    `;
  }

  function renderSecFilingsCard(symbol) {
    const cik = SEC_CIK_MAP[symbol];
    const url = cik ? `https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(cik)}&owner=exclude` : "https://www.sec.gov/edgar/search/";
    const meta = makeMeta("SEC / EDGAR offizieller Filings-Link", "fallback", BOOT_TIME, "Browserkritische Open-Data-Quelle: direkte SEC-JSON-Abrufe bleiben für öffentliche Frontends bewusst vorsichtig.");
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">SEC / Filings</span>
            <h3>${cik ? `CIK ${esc(cik)}` : "Filings-Suche"}</h3>
          </div>
          ${renderStatusBadge("fallback")}
        </div>
        <p>Offizielle Filings werden über SEC/EDGAR verlinkt. JSON/XBRL bleibt im Browser bewusst nicht als grüner Live-Status markiert, weil SEC-Zugriffe in öffentlichen Frontends robust über einen späteren Datenadapter laufen sollten.</p>
        <a class="ghost-button" href="${escAttr(url)}" target="_blank" rel="noreferrer">SEC Filings öffnen</a>
        ${renderDataMeta(meta)}
      </article>
    `;
  }

  function renderAssetResearchSnapshot(context, snapshot = buildAssetResearchSnapshot(context)) {
    const { symbol, technical } = context;
    return `
      <article class="card asset-research-snapshot research-snapshot-v2">
        <div class="card-topline">
          <div>
            <span class="card-label">5-Minuten-Research</span>
            <h3>In 5 Minuten verstanden</h3>
            <p>Verdichteter Research-Snapshot aus Kurs, Profil, Bewertung, Technik, News, Events, Alerts und Datenqualität.</p>
          </div>
          ${renderDataMeta(makeMeta("5-Minuten-Research: Daten + Produktlogik", snapshot.dataStatus, Date.now(), snapshot.dataQuality.text), true)}
        </div>

        <div class="research-summary-band">
          <div>
            <span class="card-label">${esc(snapshot.identity.type)} · ${esc(snapshot.identity.category)}</span>
            <h3>${esc(snapshot.headline)}</h3>
            <p>${esc(snapshot.summary)}</p>
          </div>
          <div class="research-score-panel">
            <span class="score-pill ${technical.tone}">${esc(technical.rating)}</span>
            <strong>${snapshot.score}/100</strong>
            <small>Research-Score · ${esc(snapshot.dataQuality.label)}</small>
          </div>
        </div>

        <div class="research-identity-grid">
          <div class="snapshot-tile research-tile">
            <span>Asset-Charakter</span>
            <strong>${esc(snapshot.identity.character)}</strong>
            <p>${esc(snapshot.identity.text)}</p>
          </div>
          <div class="snapshot-tile research-tile">
            <span>Bewertung / Struktur</span>
            <strong class="${snapshot.valuation.tone}">${esc(snapshot.valuation.label)}</strong>
            <p>${esc(snapshot.valuation.text)}</p>
          </div>
          <div class="snapshot-tile research-tile">
            <span>Technisches Kurzbild</span>
            <strong class="${technical.tone}">${esc(snapshot.technical.label)}</strong>
            <p>${esc(snapshot.technical.text)}</p>
          </div>
          <div class="snapshot-tile research-tile">
            <span>Datenqualität</span>
            <strong>${esc(snapshot.dataQuality.label)}</strong>
            <p>${esc(snapshot.dataQuality.text)}</p>
          </div>
        </div>

        <div class="research-snapshot-grid">
          <section class="research-list-card">
            <div class="mini-section-head">
              <span class="card-label">Top-Chancen</span>
              <strong>Was spricht dafür?</strong>
            </div>
            ${renderResearchBulletList(snapshot.opportunities)}
          </section>
          <section class="research-list-card">
            <div class="mini-section-head">
              <span class="card-label">Top-Risiken</span>
              <strong>Was kann schiefgehen?</strong>
            </div>
            ${renderResearchBulletList(snapshot.risks)}
          </section>
          <section class="research-list-card">
            <div class="mini-section-head">
              <span class="card-label">Was jetzt wichtig ist</span>
              <strong>Nächste Trigger</strong>
            </div>
            ${renderResearchTriggerList(snapshot.triggers)}
          </section>
          <section class="research-list-card">
            <div class="mini-section-head">
              <span class="card-label">Kurzbild</span>
              <strong>Bewertung & Technik</strong>
            </div>
            ${renderResearchMetricList(snapshot.valuation.metrics)}
            ${renderResearchMetricList(snapshot.technical.metrics)}
          </section>
        </div>

        <div class="research-conclusion">
          <span class="pill">Kurzfazit</span>
          <p>${esc(snapshot.conclusion)}</p>
        </div>

        <div class="row-actions asset-next-actions">
          <button class="ghost-button" type="button" data-compare-open="${escAttr(symbol)}">Vergleichen</button>
          <button class="ghost-button" type="button" data-alert-quick="${escAttr(symbol)}" data-alert-quick-type="price">Alert setzen</button>
          <button class="ghost-button" type="button" data-route="events">Events prüfen</button>
          <button class="ghost-button" type="button" data-route="data-health">Datenqualität ansehen</button>
        </div>
      </article>
    `;
  }

  function buildAssetResearchSnapshot(context) {
    const { symbol, asset, quote, profile, fundamentals, news, sentiment, technical, events } = context;
    const analysis = analysisFor(symbol);
    const etf = etfDataForSymbol(symbol);
    const fundamental = fundamentalInterpretation(asset, fundamentals);
    const dataStatus = bestDataStatus([
      quote.meta?.status,
      profile.meta?.status,
      fundamentals.meta?.status,
      news.meta?.status,
      technical.meta?.status,
      events[0]?.meta?.status
    ]);
    const identity = assetIdentitySnapshot(asset, profile, analysis, technical, etf);
    const valuation = assetValuationSnapshot(asset, fundamentals, analysis, etf);
    const technicalSnapshot = assetTechnicalSnapshot(technical, analysis);
    const dataQuality = assetDataQualitySnapshot(dataStatus, context);
    const opportunities = assetOpportunityItems(context, { analysis, etf, fundamental, valuation, technicalSnapshot }).slice(0, 3);
    const risks = assetRiskItems(context, { analysis, etf, valuation, technicalSnapshot, dataStatus }).slice(0, 3);
    const triggers = assetTriggerItems(symbol, events, news).slice(0, 4);
    const score = Math.round(clamp(
      technical.score * 0.42 +
      analysis.quality * 0.18 +
      analysis.value * 0.15 +
      analysis.growth * 0.15 +
      sentiment.score * 0.10,
      0,
      100
    ));
    const headline = assetResearchHeadline(asset, identity, valuation, technicalSnapshot);
    const summary = assetResearchSummary(asset, quote, valuation, technicalSnapshot, triggers, etf);
    const conclusion = assetResearchConclusion(asset, valuation, technicalSnapshot, dataQuality, triggers, etf);
    return {
      symbol,
      identity,
      valuation,
      technical: technicalSnapshot,
      dataQuality,
      opportunities,
      risks,
      triggers,
      score,
      headline,
      summary,
      conclusion,
      dataStatus
    };
  }

  function renderResearchBulletList(items) {
    return `
      <div class="research-bullet-list">
        ${items.map((item) => `
          <div class="research-bullet">
            <span class="pill ${escAttr(item.tone || "")}">${esc(item.label)}</span>
            <p>${esc(item.text)}</p>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderResearchTriggerList(items) {
    return `
      <div class="research-trigger-list">
        ${items.map((item) => `
          <button class="research-trigger-row" type="button" ${item.symbol && assetMap.has(item.symbol) ? `data-symbol="${escAttr(item.symbol)}"` : `data-route="${escAttr(item.route || "events")}"`}>
            <span class="pill ${escAttr(item.tone || "")}">${esc(item.label)}</span>
            <span>
              <strong>${esc(item.title)}</strong>
              <small>${esc(item.text)}</small>
            </span>
            ${renderStatusBadge(item.status)}
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderResearchMetricList(metrics) {
    return `
      <div class="research-metric-list">
        ${metrics.map((metric) => `
          <div class="research-metric-row">
            <span>${esc(metric.label)}</span>
            <strong class="${escAttr(metric.tone || "")}">${esc(metric.value)}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  function assetIdentitySnapshot(asset, profile, analysis, technical, etf) {
    const type = assetTypeLabel(asset);
    const category = etf
      ? `${etf.region[0]?.[0] || asset.sector} / ${etf.distribution}`
      : (profile.sector || asset.sector || "Kategorie offen");
    let character = "Gemischt";
    if (etf) {
      character = etf.ter <= 0.12 ? "Kosteneffizienter Kernbaustein" : etf.region[0]?.[1] >= 90 ? "Konzentrierter ETF" : "Diversifizierter ETF";
    } else if (asset.type === "Crypto") {
      character = "Liquiditäts- und Momentum-Proxy";
    } else if (asset.type === "Commodity") {
      character = "Makro-/Realzins-Sensitiv";
    } else if (analysis.growth >= 68 && technical.rating === "BUY") {
      character = "Growth / Momentum";
    } else if (analysis.value >= 65) {
      character = "Value-orientiert";
    } else if (analysis.volatility <= 42) {
      character = "Defensiver Qualitätswert";
    } else if (analysis.volatility >= 68) {
      character = "Volatiler Chancenwert";
    } else if (analysis.quality >= 70) {
      character = "Qualitätswert";
    }
    const text = etf
      ? etf.useCase
      : `${type} aus ${category}. Die Einordnung kombiniert Sektor, Bewertungsmodell, Momentum und Risiko.`;
    return { type, category, character, text };
  }

  function assetValuationSnapshot(asset, fundamentals, analysis, etf) {
    if (etf) {
      const topRegion = etf.region[0] ? `${etf.region[0][0]} ${formatNumber(etf.region[0][1])}%` : "Region offen";
      const concentration = etfHoldingConcentration(etf);
      const tone = etf.ter <= 0.12 ? "bull" : etf.ter <= 0.25 ? "neutral" : "bear";
      return {
        label: `${formatNumber(etf.ter)}% TER`,
        tone,
        text: `${etf.distribution}, ${topRegion}. ${etf.structure}`,
        metrics: [
          { label: "TER", value: `${formatNumber(etf.ter)}%`, tone },
          { label: "Ausschüttung", value: etf.distribution },
          { label: "Top-Region", value: topRegion },
          { label: "Top-Holdings", value: `${formatNumber(concentration)}%` }
        ]
      };
    }
    if (asset.type !== "Stock") {
      return {
        label: "klassisch nicht bewertbar",
        tone: "neutral",
        text: "Für dieses Asset sind klassische Aktienkennzahlen nur eingeschränkt sinnvoll. Preis, Trend und Makroumfeld sind wichtiger.",
        metrics: [
          { label: "Asset-Typ", value: assetTypeLabel(asset) },
          { label: "Kategorie", value: asset.sector },
          { label: "Value-Score", value: `${formatNumber(analysis.value)} / 100` },
          { label: "Growth-Score", value: `${formatNumber(analysis.growth)} / 100` }
        ]
      };
    }
    const pe = firstNumber(fundamentals.pe, asset.fallback.pe);
    const eps = firstNumber(fundamentals.eps, asset.fallback.eps);
    const revenue = firstNumber(fundamentals.revenue, asset.fallback.revenue);
    const margin = firstNumber(fundamentals.margin, analysis.margin);
    let label = "Daten eingeschränkt";
    let tone = "neutral";
    if (pe !== null) {
      label = pe <= 18 ? "eher günstig" : pe >= 40 ? "ambitioniert bewertet" : "neutral bewertet";
      tone = pe <= 18 ? "bull" : pe >= 40 ? "bear" : "neutral";
    }
    const text = pe !== null
      ? `KGV ${formatNumber(pe, "x")}; Value-Score ${formatNumber(analysis.value)} / 100. Kennzahlen bleiben je nach Datenstatus zu prüfen.`
      : "KGV und volle Fundamentaldaten sind aktuell nicht belastbar verfügbar.";
    return {
      label,
      tone,
      text,
      metrics: [
        { label: "KGV", value: pe !== null ? formatNumber(pe, "x") : "nicht verfügbar", tone },
        { label: "EPS", value: eps !== null ? formatMoney(eps, asset.currency) : "nicht verfügbar" },
        { label: "Umsatz", value: revenue !== null ? formatCompactMoney(revenue, asset.currency) : "nicht verfügbar" },
        { label: "Marge", value: margin !== null ? `${formatNumber(margin)}%` : "nicht verfügbar" }
      ]
    };
  }

  function assetTechnicalSnapshot(technical, analysis) {
    const volatility = Number(analysis.volatility || 0);
    const volatilityText = volatility >= 70 ? "erhöht" : volatility <= 42 ? "ruhig" : "normal";
    const trendText = analysis.trend >= 65 ? "konstruktiv" : analysis.trend <= 42 ? "angeschlagen" : "gemischt";
    return {
      label: `${technical.rating} · ${technical.probability}%`,
      tone: technical.tone,
      text: `${trendText}er Trend, Momentum ${formatNumber(analysis.momentum)} / 100, Volatilität ${volatilityText}.`,
      metrics: [
        { label: "Momentum", value: `${formatNumber(analysis.momentum)} / 100`, tone: analysis.momentum >= 65 ? "bull" : analysis.momentum <= 42 ? "bear" : "neutral" },
        { label: "Trend", value: `${formatNumber(analysis.trend)} / 100`, tone: analysis.trend >= 65 ? "bull" : analysis.trend <= 42 ? "bear" : "neutral" },
        { label: "Volatilität", value: `${formatNumber(volatility)} / 100`, tone: volatility >= 70 ? "bear" : volatility <= 42 ? "bull" : "neutral" },
        { label: "RSI", value: `${formatNumber(analysis.rsi)} · ${rsiText(analysis.rsi)}` }
      ]
    };
  }

  function assetDataQualitySnapshot(status, context) {
    const statuses = [
      context.quote.meta?.status,
      context.profile.meta?.status,
      context.fundamentals.meta?.status,
      context.news.meta?.status,
      context.events[0]?.meta?.status
    ];
    const liveCount = statuses.filter((item) => item === "live").length;
    const fallbackCount = statuses.filter((item) => item === "fallback").length;
    if (status === "live") {
      return { label: "gute Datenlage", text: `${liveCount} Baustein${liveCount === 1 ? "" : "e"} live; Research bleibt als Produktlogik verdichtet.` };
    }
    if (status === "stale") {
      return { label: "hybrid / Cache", text: "Ein Teil der Daten stammt aus Cache oder leicht verzögerten Abrufen." };
    }
    if (fallbackCount >= 3) {
      return { label: "teilweise Fallback", text: "Mehrere Bausteine nutzen lokale oder fallback-basierte Daten. Die Seite bleibt transparent nutzbar." };
    }
    return { label: "hybrid", text: "Live-, lokale und modellierte Inputs werden klar getrennt und nicht als reine API-Wahrheit verkauft." };
  }

  function assetOpportunityItems(context, helpers) {
    const { asset, quote, news, events } = context;
    const { analysis, etf, fundamental, valuation, technicalSnapshot } = helpers;
    const items = [];
    if (etf) {
      items.push({ label: "ETF-Struktur", text: etf.useCase, tone: "bull" });
      if (etf.ter <= 0.12) {
        items.push({ label: "Kosten", text: `Sehr niedrige TER von ${formatNumber(etf.ter)}% stärkt den langfristigen Kernbaustein.`, tone: "bull" });
      }
      items.push({ label: "Diversifikation", text: `${etf.region[0]?.[0] || "Region"} dominiert, Top-Holdings liegen bei ${formatNumber(etfHoldingConcentration(etf))}%.`, tone: "neutral" });
    } else {
      if (technicalSnapshot.tone === "bull") {
        items.push({ label: "Momentum", text: `Technik wirkt konstruktiv: ${technicalSnapshot.text}`, tone: "bull" });
      }
      if (fundamental.label === "Positiv" || valuation.tone === "bull") {
        items.push({ label: "Fundamental", text: fundamental.text, tone: "bull" });
      }
      if (analysis.growth >= 65) {
        items.push({ label: "Wachstum", text: `Growth-Score ${formatNumber(analysis.growth)} / 100; struktureller Rückenwind im Modell sichtbar.`, tone: "bull" });
      }
    }
    const nextEvent = events.find((eventItem) => eventItem.date >= startOfToday());
    if (nextEvent && eventRelevance(nextEvent) >= 60) {
      items.push({ label: "Trigger", text: `${nextEvent.title} (${eventTimingLabel(nextEvent)}) kann die nächste Neueinschätzung auslösen.`, tone: "neutral" });
    }
    if (news.items[0] && String(news.items[0].sentiment || "").toLowerCase() === "bullish") {
      items.push({ label: "News", text: news.items[0].headline, tone: "bull" });
    }
    if (Number(quote.changePct || 0) > 1.5) {
      items.push({ label: "Tagesstärke", text: `Tagesbewegung ${formatPercent(quote.changePct)} zeigt kurzfristige Nachfrage.`, tone: "bull" });
    }
    items.push({ label: "These", text: asset.thesis, tone: "neutral" });
    return uniqueResearchItems(items);
  }

  function assetRiskItems(context, helpers) {
    const { asset, fundamentals, events } = context;
    const { analysis, etf, valuation, technicalSnapshot, dataStatus } = helpers;
    const items = [];
    if (etf) {
      items.push({ label: "Struktur", text: etf.risk, tone: "bear" });
      items.push({ label: "Währung", text: etf.fxRisk, tone: "neutral" });
      if (etfHoldingConcentration(etf) >= 25 || etf.region[0]?.[1] >= 90) {
        items.push({ label: "Klumpen", text: "Top-Holdings oder Regionen sind spürbar konzentriert; kein voll global neutrales Exposure.", tone: "bear" });
      }
    } else {
      const pe = firstNumber(fundamentals.pe, asset.fallback.pe);
      if (pe !== null && pe >= 40) {
        items.push({ label: "Bewertung", text: `KGV ${formatNumber(pe, "x")} lässt wenig Raum für Enttäuschungen.`, tone: "bear" });
      }
      if (analysis.volatility >= 68) {
        items.push({ label: "Volatilität", text: `Volatilitätswert ${formatNumber(analysis.volatility)} / 100; Positionsgröße und Stops brauchen Disziplin.`, tone: "bear" });
      }
      if (technicalSnapshot.tone === "bear") {
        items.push({ label: "Technik", text: technicalSnapshot.text, tone: "bear" });
      }
    }
    const soonEvent = events.find((eventItem) => eventItem.date >= startOfToday() && eventItem.date <= daysFromNow(14));
    if (soonEvent) {
      items.push({ label: "Event", text: `${soonEvent.title} kann kurzfristig Volatilität oder Erwartungsdruck erhöhen.`, tone: "neutral" });
    }
    if (["fallback", "missing", "error"].includes(dataStatus)) {
      items.push({ label: "Datenlage", text: "Ein Teil des Research-Bilds ist fallback-basiert; harte Kennzahlen vorher prüfen.", tone: "neutral" });
    }
    items.push({ label: "Asset-Risiko", text: asset.risks, tone: "bear" });
    return uniqueResearchItems(items);
  }

  function assetTriggerItems(symbol, events, news) {
    const eventItems = events
      .filter((eventItem) => eventItem.date >= startOfToday())
      .slice(0, 3)
      .map((eventItem) => ({
        label: eventTypeLabel(eventItem),
        title: eventItem.title,
        text: `${eventTimingLabel(eventItem)} · ${formatEventDate(eventItem.date)} · ${eventSourceLabel(eventItem)}`,
        status: eventItem.meta?.status || "fallback",
        tone: eventRelevance(eventItem) >= 80 ? "bull" : "neutral",
        symbol: eventItem.symbol
      }));
    const alertItems = state.alerts
      .map(normalizeAlertRecord)
      .filter((alert) => alert.symbol === symbol && normalizeAlertStatus(alert) !== "done")
      .slice(0, 2)
      .map((alert) => ({
        label: "Alert",
        title: alertTypeLabel(alert.type),
        text: `${alertStatusLabel(alert)} · ${priorityLabel(alert.priority)} · ${alertLabel(alert)}`,
        status: "local",
        tone: alert.priority === "high" ? "bull" : "neutral",
        route: "alerts"
      }));
    const newsItem = news.items[0] ? [{
      label: "News",
      title: news.items[0].headline,
      text: `${news.items[0].source || "News"} · ${formatRelativeTime(news.items[0].datetime)} · ${news.items[0].sentiment || "Neutral"}`,
      status: news.meta.status,
      tone: String(news.items[0].sentiment || "").toLowerCase() === "bullish" ? "bull" : String(news.items[0].sentiment || "").toLowerCase() === "bearish" ? "bear" : "neutral",
      symbol
    }] : [];
    const items = [...eventItems, ...alertItems, ...newsItem];
    return items.length ? items : [{
      label: "Trigger offen",
      title: "Kein harter Termin im aktuellen Fenster",
      text: "Watchlist, Event-Hub und Alerts bleiben die nächsten sinnvollen Prüfpunkte.",
      status: "fallback",
      tone: "neutral",
      route: "events"
    }];
  }

  function assetResearchHeadline(asset, identity, valuation, technicalSnapshot) {
    if (asset.type === "ETF") {
      return `${asset.symbol}: ${identity.character} mit ${valuation.label}`;
    }
    return `${asset.symbol}: ${identity.character}, ${valuation.label}, Technik ${technicalSnapshot.label}`;
  }

  function assetResearchSummary(asset, quote, valuation, technicalSnapshot, triggers, etf) {
    if (etf) {
      return `${asset.name} ist vor allem ein Struktur- und Kostenbaustein. Aktuell wichtig: ${valuation.text}`;
    }
    const move = `Tagesbewegung ${formatPercent(quote.changePct)}`;
    const trigger = triggers[0] ? ` Nächster Prüfpunkt: ${triggers[0].title}.` : "";
    return `${move}; ${valuation.text} Technisch: ${technicalSnapshot.text}${trigger}`;
  }

  function assetResearchConclusion(asset, valuation, technicalSnapshot, dataQuality, triggers, etf) {
    if (etf) {
      return `${asset.symbol} eignet sich im aktuellen Modell eher über Struktur, Kosten und Einsatzbereich als über ein kurzfristiges Signal. Prüfe TER, Top-Holdings und Währungsrisiko vor dem Vergleich.`;
    }
    if (technicalSnapshot.tone === "bull" && valuation.tone !== "bear") {
      return `Konstruktives Setup, solange Datenlage und nächster Trigger sauber geprüft bleiben. ${triggers[0] ? `Besonders wichtig: ${triggers[0].title}.` : "Kein einzelner Termin dominiert aktuell."}`;
    }
    if (technicalSnapshot.tone === "bear" || valuation.tone === "bear") {
      return `Erhöhte Vorsicht: ${valuation.label} und ${technicalSnapshot.text} Erst Trigger, Bewertung und Datenqualität prüfen; keine Anlageberatung.`;
    }
    return `Gemischtes Bild: weder klarer Druck noch klares Kaufsignal. Für ${asset.symbol} zählen jetzt Trigger, Watchlist-Regeln und Datenqualität stärker als ein Einzelwert.`;
  }

  function uniqueResearchItems(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = `${item.label}-${item.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(item.text);
    });
  }

  function assetTypeLabel(asset) {
    const labels = {
      Stock: "Aktie",
      ETF: "ETF",
      Index: "Index",
      Commodity: "Rohstoff",
      Crypto: "Krypto"
    };
    return labels[asset.type] || asset.type || "Asset";
  }

  function etfDataForSymbol(symbol) {
    return ETF_DATA.find((item) => item.symbol === symbol) || null;
  }

  function renderThesisJournalCard(symbol) {
    const entries = journalEntriesFor(symbol);
    const latest = entries[0];
    const quality = journalQualityHint(latest);
    return `
      <article class="card thesis-journal-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Thesis Tracker / Journal</span>
            <h3>Warum beobachtest du ${esc(symbol)}?</h3>
            <p>Speichere These, Trigger, Regel-Check und ob die Idee emotional getrieben war. Alles bleibt lokal im Browser.</p>
          </div>
          ${renderDataMeta(makeMeta("Lokales Journal", "live", Date.now()), true)}
        </div>
        <div class="grid three">
          <div class="snapshot-tile">
            <span>Einträge</span>
            <strong>${entries.length}</strong>
            <p>${entries.length ? "Lokale Historie für diese Aktie vorhanden." : "Noch keine gespeicherte These."}</p>
          </div>
          <div class="snapshot-tile">
            <span>Disziplin-Hinweis</span>
            <strong>${esc(quality.label)}</strong>
            <p>${esc(quality.text)}</p>
          </div>
          <div class="snapshot-tile">
            <span>Letzter Trigger</span>
            <strong>${esc(latest ? latest.ruleCheck : "offen")}</strong>
            <p>${esc(latest ? latest.trigger : "Definiere einen Auslöser, damit die These später überprüfbar ist.")}</p>
          </div>
        </div>
        <form class="journal-form" data-journal-form>
          <input type="hidden" name="symbol" value="${escAttr(symbol)}">
          <label class="field"><span>These / Warum gekauft oder beobachtet?</span><textarea name="thesis" placeholder="z. B. AI-Umsatz, Margen, Breakout, Bewertung..."></textarea></label>
          <label class="field"><span>Trigger / Was muss passieren?</span><input name="trigger" placeholder="z. B. Earnings Beat, Support hält, FRED-Daten entspannen sich"></label>
          <div class="form-grid">
            <label class="field"><span>Emotion</span><select name="emotion"><option value="rational">Rational</option><option value="unsicher">Unsicher</option><option value="fomo">FOMO</option><option value="stress">Stress</option></select></label>
            <label class="field"><span>Regel-Check</span><select name="ruleCheck"><option value="ok">Plan passt</option><option value="risk">Risiko zu hoch</option><option value="wait">Abwarten</option></select></label>
          </div>
          <button class="primary-button" type="submit">Journal-Eintrag speichern</button>
        </form>
        <div class="stack-list journal-list">
          ${entries.map((entry) => `
            <div class="journal-row">
              <strong>${esc(entry.thesis)}</strong>
              <span class="small">${formatTimestamp(entry.timestamp)} | ${esc(entry.emotion)} | ${esc(entry.ruleCheck)}</span>
              <p>${esc(entry.trigger)}</p>
            </div>
          `).join("") || renderEmptyState("Noch keine These gespeichert.")}
        </div>
      </article>
    `;
  }

  function renderCompanyNews(symbol, news) {
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Company News</span>
            <h3>${esc(symbol)} Timeline</h3>
          </div>
          ${renderTinyStatus(news.meta.status)}
        </div>
        <div class="stack-list">
          ${news.items.slice(0, 5).map((item) => `
            <a class="news-row" href="${escAttr(item.url || tradingViewUrl(getAsset(symbol)))}" target="_blank" rel="noreferrer">
              <span>
                <strong>${esc(item.headline)}</strong>
                <span class="small">${esc(item.source)} - ${formatRelativeTime(item.datetime)}</span>
                <span class="small">${esc(item.summary || "Keine Zusammenfassung verfügbar.")}</span>
              </span>
              <span class="pill ${item.sentiment ? item.sentiment.toLowerCase() : ""}">${esc(item.sentiment || "Neutral")}</span>
            </a>
          `).join("") || renderEmptyState("Keine News verfügbar.")}
        </div>
        ${renderDataMeta(news.meta)}
      </article>
    `;
  }

  function renderInsiderInstitutionalCard(symbol) {
    const data = insiderDataFor(symbol);
    return `
      <div class="grid two">
        <article class="card">
          <div class="card-topline">
            <div>
              <span class="card-label">Insider Trades</span>
              <h3>Insider Score ${data.insiderScore}/100</h3>
            </div>
            ${renderStatusBadge("fallback")}
          </div>
          <div class="metric-grid">
            ${renderMiniMetric("Buy/Sell Ratio", `${formatNumber(data.buySellRatio)}x`)}
            ${renderMiniMetric("Insider Käufe", String(data.buys.length))}
            ${renderMiniMetric("Insider Verkäufe", String(data.sells.length))}
          </div>
          <h4>Insider Käufe</h4>
          <div class="stack-list">${data.buys.map((row) => renderDataRow(row)).join("")}</div>
          <h4>Insider Verkäufe</h4>
          <div class="stack-list">${data.sells.map((row) => renderDataRow(row)).join("")}</div>
          ${renderDataMeta(makeMeta("Lokale Insider-Fallback-Datenbank / SEC-Finnhub-Zuordnung", "fallback", BOOT_TIME))}
        </article>
        <article class="card">
          <div class="card-topline">
            <div>
              <span class="card-label">Institutionelle Anleger</span>
              <h3>Smart Money / Fondsbewegungen</h3>
            </div>
            ${renderStatusBadge("fallback")}
          </div>
          <h4>Top Shareholder</h4>
          <div class="mini-bars">${data.topShareholders.map(([name, weight]) => renderMiniBar(name, weight)).join("")}</div>
          <h4>Institutionelle Holdings</h4>
          <div class="stack-list">${data.holdings.map((row) => renderDataRow(row)).join("")}</div>
          <h4>Positionsveränderungen</h4>
          <div class="stack-list">${data.changes.map((row) => renderDataRow(row)).join("")}</div>
          ${renderDataMeta(makeMeta("Lokale Institutionals-Fallback-Datenbank / SEC-Finnhub-Zuordnung", "fallback", BOOT_TIME))}
        </article>
      </div>
    `;
  }

  function renderSentimentDetail(sentiment) {
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Sentiment</span>
            <h3>Stimmungsbild</h3>
          </div>
          ${renderTinyStatus(sentiment.meta.status)}
        </div>
        <div class="score-ring" style="--score:${sentiment.score}">
          <strong>${sentiment.score}</strong>
          <span>${esc(sentiment.label)}</span>
        </div>
        <div class="stack-list">
          ${sentiment.drivers.map((driver) => `
            <div class="insight-row">
              <span class="pill">${esc(driver.kind)}</span>
              <p>${esc(driver.text)}</p>
            </div>
          `).join("")}
        </div>
        ${renderDataMeta(sentiment.meta)}
      </article>
    `;
  }

  function renderFundamentalsCard(asset, fundamentals) {
    const interpretation = fundamentalInterpretation(asset, fundamentals);
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Fundamental Deep Dive V1</span>
            <h3>${esc(interpretation.label)}</h3>
          </div>
          ${renderTinyStatus(fundamentals.meta.status)}
        </div>
        <div class="metric-grid deep-metric-grid">
          ${renderMiniMetric("Market Cap", formatCompactMoney(valueOr(fundamentals.marketCap, asset.fallback.marketCap), asset.currency))}
          ${renderMiniMetric("KGV", formatNumber(valueOr(fundamentals.pe, asset.fallback.pe), "x"))}
          ${renderMiniMetric("EPS", formatMoney(valueOr(fundamentals.eps, asset.fallback.eps), asset.currency))}
          ${renderMiniMetric("Umsatz", formatCompactMoney(valueOr(fundamentals.revenue, asset.fallback.revenue), asset.currency))}
          ${renderMiniMetric("Gewinn", formatCompactMoney(fundamentals.profit, asset.currency))}
          ${renderMiniMetric("Marge", fundamentals.margin !== null && fundamentals.margin !== undefined ? `${formatNumber(fundamentals.margin)}%` : "--")}
          ${renderMiniMetric("Bruttomarge", fundamentals.grossMargin !== null && fundamentals.grossMargin !== undefined ? `${formatNumber(fundamentals.grossMargin)}%` : "--")}
          ${renderMiniMetric("Cashflow", formatCompactMoney(fundamentals.cashflow, asset.currency))}
          ${renderMiniMetric("Schulden", formatCompactMoney(fundamentals.debt, asset.currency))}
          ${renderMiniMetric("Umsatzwachstum", fundamentals.revenueGrowth !== null && fundamentals.revenueGrowth !== undefined ? `${formatNumber(fundamentals.revenueGrowth)}%` : "--")}
          ${renderMiniMetric("Sektor", asset.sector)}
          ${renderMiniMetric("Asset-Typ", asset.type)}
        </div>
        <p>${esc(interpretation.text)}</p>
        <p><strong>Risiko:</strong> ${esc(asset.risks)}</p>
        ${renderDataMeta(fundamentals.meta)}
      </article>
    `;
  }

  function renderTechnicalCard(technical) {
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Technical Rating V1</span>
            <h3>${esc(technical.rating)}</h3>
          </div>
          <span class="score-pill ${technical.tone}">${technical.probability}%</span>
        </div>
        <p>${esc(technical.reason)}</p>
        <div class="component-list">
          ${technical.components.map((component) => `
            <div class="rating-component">
              <div>
                <strong>${esc(component.label)}</strong>
                <span class="small">${esc(component.text)}</span>
              </div>
              <div class="component-meter" aria-label="${escAttr(component.label)} ${component.score}">
                <span style="width:${component.score}%"></span>
              </div>
              <strong>${component.score}</strong>
            </div>
          `).join("")}
        </div>
        <div class="levels-grid">
          ${renderMiniMetric("Support", formatMoney(technical.levels.support, technical.currency))}
          ${renderMiniMetric("Resistance", formatMoney(technical.levels.resistance, technical.currency))}
          ${renderMiniMetric("Chance/Risiko", technical.chanceRisk)}
        </div>
        ${renderDataMeta(technical.meta)}
      </article>
    `;
  }

  function renderRatingExplainerCard() {
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Transparenz</span>
            <h3>Wie wird das Rating berechnet?</h3>
          </div>
          ${renderStatusBadge("fallback")}
        </div>
        <p>Das Rating ist eine einfache, transparente Heuristik. Es kombiniert RSI, Momentum, Volumen/Aktivität, Trend, Sentiment und Risiko. Es ist kein KI-Orakel und keine Anlageberatung.</p>
        <div class="stack-list">
          ${[
            { label: "BUY", text: "Score ab 64: Momentum, Trend und Sentiment sind überwiegend konstruktiv." },
            { label: "NEUTRAL", text: "Score 43 bis 63: gemischtes Bild, bestätigendes Signal abwarten." },
            { label: "SELL", text: "Score bis 42: Risiko, Trend oder Momentum sind auffällig schwach." }
          ].map((item) => `
            <div class="insight-row">
              <span class="pill">${esc(item.label)}</span>
              <p>${esc(item.text)}</p>
            </div>
          `).join("")}
        </div>
        ${renderDataMeta(makeMeta("Lokale Rating Engine V1", "fallback", BOOT_TIME))}
      </article>
    `;
  }

  function renderResearchPage() {
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Research</p>
            <h1>Guides, Marktlogik und Newsletter.</h1>
            <p>Phase 2E erweitert Research um transparentere Live-Daten, Reports, ETF-Analyse, Portfolio-Kontext, Insider-/Institutional-Daten und Makro-Erklärungen.</p>
          </div>
          <button class="ghost-button" type="button" data-report="topPicks">Research Report</button>
        </div>
        <div class="grid three">
          ${LEARNING_GUIDES.map((guide) => `
            <article class="card">
              <span class="pill">${esc(guide.tag)}</span>
              <h3>${esc(guide.title)}</h3>
              <p>${esc(guide.detail)}</p>
            </article>
          `).join("")}
        </div>
      </section>
      <section class="section">
        ${renderResearchWorkflowCard()}
      </section>
      <section class="section">
        <article class="card newsletter-card">
          <div>
            <span class="card-label">Newsletter</span>
            <h2>MH Weekly Research</h2>
            <p>Brevo kann später angebunden werden. Lokal wird nur das Formular-Layout vorbereitet.</p>
          </div>
          <form class="form-grid" onsubmit="return false">
            <label class="field">
              <span>E-Mail</span>
              <input type="email" placeholder="dein.name@example.com">
            </label>
            <button class="primary-button" type="button">Eintragen</button>
          </form>
          ${renderDataMeta(makeMeta("Brevo Fallback", "fallback", BOOT_TIME, "Newsletter-Backend ist in der statischen Version nicht aktiv."))}
        </article>
      </section>
    `;
  }

  function renderResearchWorkflowCard() {
    const symbol = state.activeSymbol || "NVDA";
    const asset = getAsset(symbol);
    const quote = quoteFor(symbol);
    const technical = technicalFor(symbol, quote);
    const fundamentals = fundamentalsFor(symbol);
    const fundamental = fundamentalInterpretation(asset, fundamentals);
    return `
      <article class="card research-workflow-card">
        <div class="card-topline">
          <div>
            <span class="card-label">5-Minuten-Aktienanalyse</span>
            <h3>${esc(symbol)} Research-Template</h3>
            <p>Eine kurze Struktur für These, Chancen, Risiken und Trigger. Für detaillierte Notizen nutze den Thesis-/Journal-Tab der Asset-Seite.</p>
          </div>
          <button class="ghost-button" type="button" data-report="asset" data-symbol="${escAttr(symbol)}">PDF-Report</button>
        </div>
        <div class="grid four">
          <div class="snapshot-tile"><span>These</span><strong>${esc(asset.symbol)}</strong><p>${esc(asset.thesis)}</p></div>
          <div class="snapshot-tile"><span>Technisch</span><strong class="${technical.tone}">${esc(technical.rating)}</strong><p>${esc(technical.reason)}</p></div>
          <div class="snapshot-tile"><span>Fundamental</span><strong>${esc(fundamental.label)}</strong><p>${esc(fundamental.text)}</p></div>
          <div class="snapshot-tile"><span>Risiko</span><strong>Prüfen</strong><p>${esc(asset.risks)}</p></div>
        </div>
      </article>
    `;
  }

  function renderPortfolioPage() {
    ensureHomeData();
    const portfolio = activePortfolio();
    const analysis = portfolioAnalysis(portfolio);
    const scenario = portfolioScenarioAnalysis(portfolio, analysis);

    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Portfolio / Risiko / Exposure V2</p>
            <h1>Portfolio-Kontrollzentrum.</h1>
            <p>Mehrere lokale Portfolios mit Risiko, Exposure, Performance-Beitrag, Rebalancing-Hinweisen und ehrlicher Live-/Hybrid-/Fallback-Kennzeichnung.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-report="portfolio">Portfolio Report</button>
            <button class="ghost-button" type="button" data-export-watchlist>Watchlist CSV</button>
          </div>
        </div>
        <div class="portfolio-switcher">
          ${state.portfolios.map((item) => `
            <button class="chip ${item.id === portfolio.id ? "active" : ""}" type="button" data-portfolio-select="${escAttr(item.id)}">${esc(item.name)}</button>
          `).join("")}
        </div>
      </section>

      <section class="section">
        <article class="card portfolio-control-card">
          <div class="card-topline">
            <div>
              <span class="card-label">${portfolio.type === "real" ? "Echtgeld" : "Testportfolio"} · lokal gespeichert</span>
              <h3>${esc(portfolio.name)}</h3>
              <p>${esc(analysis.health.summary)}</p>
            </div>
            ${renderDataMeta(analysis.meta, true)}
          </div>
          <div class="portfolio-hero-grid">
            ${renderMiniMetric("Gesamtwert", formatMoney(analysis.totalValue, "USD"))}
            ${renderMiniMetric("Gesamt-Performance", `${formatMoney(analysis.performanceAbs, "USD")} / ${formatPercent(analysis.performancePct)}`)}
            ${renderMiniMetric("Cash", `${formatMoney(analysis.cashValue, "USD")} (${formatNumber(analysis.cashPct)}%)`)}
            ${renderMiniMetric("Positionen", String(portfolio.positions.length))}
            ${renderMiniMetric("Risiko-Level", `${analysis.riskLevel.label} · ${formatNumber(analysis.riskScore)} / 100`)}
            ${renderMiniMetric("Größte Position", analysis.topPosition ? `${analysis.topPosition.symbol} ${formatNumber(analysis.topPosition.weight)}%` : "n/a")}
          </div>
          <div class="portfolio-health-band">
            <span class="score-pill ${analysis.riskLevel.tone}">${esc(analysis.riskLevel.label)}</span>
            <div>
              <strong>${esc(analysis.health.label)}</strong>
              <p>${esc(analysis.priorityHint)}</p>
            </div>
          </div>
          ${portfolio.notes ? `<p class="small portfolio-note-preview">${esc(portfolio.notes)}</p>` : ""}
        </article>
      </section>

      <section class="section">
        <div class="grid two">
          ${renderPortfolioFocusCard(analysis)}
          ${renderPortfolioPerformanceCard(analysis)}
        </div>
      </section>

      <section class="section">
        <div class="grid two">
          <article class="card portfolio-exposure-card">
            <div class="card-topline">
              <div>
                <span class="card-label">Exposure</span>
                <h3>Wo bist du übergewichtet?</h3>
                <p>Sektor, Region/Land, Währung und Asset-Typ werden aus Positionen, Cash und vorhandenen Stammdaten abgeleitet.</p>
              </div>
              ${renderStatusBadge(analysis.dataStatus)}
            </div>
            <div class="portfolio-exposure-grid">
              ${renderExposureBlock("Sektor", analysis.sectorExposure)}
              ${renderExposureBlock("Land / Region", analysis.countryExposure)}
              ${renderExposureBlock("Währung", analysis.currencyExposure)}
              ${renderExposureBlock("Asset-Typ", analysis.assetTypeExposure)}
            </div>
            <div class="portfolio-style-strip">
              ${renderMiniMetric("Tech-Anteil", `${formatNumber(analysis.style.techPct)}%`)}
              ${renderMiniMetric("USA-Anteil", `${formatNumber(analysis.style.usPct)}%`)}
              ${renderMiniMetric("ETF-Anteil", `${formatNumber(analysis.style.etfPct)}%`)}
              ${renderMiniMetric("Growth-Nähe", analysis.style.growthLabel)}
            </div>
          </article>

          <article class="card portfolio-risk-card">
            <div class="card-topline">
              <div>
                <span class="card-label">Risiko & Rebalancing</span>
                <h3>Klumpen, Cash und Balance</h3>
                <p>Klare Heuristik statt Pseudo-Quant: Positionen, Sektoren, Länder, Währungen, Cash und Diversifikation.</p>
              </div>
              <span class="score-pill ${analysis.riskLevel.tone}">${formatNumber(analysis.riskScore)}</span>
            </div>
            <div class="portfolio-risk-list">
              ${analysis.riskItems.map(renderPortfolioInsightRow).join("")}
            </div>
            <h4>Rebalancing-Hinweise</h4>
            <div class="portfolio-risk-list">
              ${analysis.rebalancingHints.map(renderPortfolioInsightRow).join("")}
            </div>
          </article>
        </div>
      </section>

      <section class="section">
        <article class="card portfolio-positions-card">
          <div class="card-topline">
            <div>
              <span class="card-label">Positionen</span>
              <h3>Rendite- und Risikotreiber</h3>
              <p>Jede Position zeigt Gewicht, Performance, Beitrag, Rolle, nächsten Termin und sinnvolle nächste Schritte.</p>
            </div>
            ${renderStatusBadge(analysis.dataStatus)}
          </div>
          <div class="portfolio-position-list">
            ${analysis.positions.map((row) => renderPortfolioPosition(row, analysis)).join("") || renderEmptyState("Noch kein Portfolio angelegt oder keine Positionen vorhanden.")}
          </div>
        </article>
      </section>

      <section class="section">
        <div class="grid two">
          <article class="card portfolio-scenario-card">
            <div class="card-topline">
              <div>
                <span class="card-label">Was-wäre-wenn</span>
                <h3>Einfaches Szenario testen</h3>
                <p>Simuliert lokal, wie sich Zusatzposition, Cash und Marktschock auf Wert, Exposure und Risiko auswirken würden.</p>
              </div>
              ${renderDataMeta(makeMeta("Lokale Portfolio-Simulation", "local", Date.now(), "Keine Orderlogik, kein Backend, keine Anlageberatung."), true)}
            </div>
            <div class="form-grid">
              <label class="field"><span>Symbol hinzufügen</span><input data-portfolio-scenario name="symbol" value="${escAttr(state.portfolioScenario.symbol || "SPY")}" placeholder="SPY oder NVDA"></label>
              <label class="field"><span>Anzahl</span><input data-portfolio-scenario name="quantity" type="number" step="0.0001" value="${escAttr(state.portfolioScenario.quantity || 0)}"></label>
              <label class="field"><span>Kaufkurs</span><input data-portfolio-scenario name="avgPrice" type="number" step="0.01" value="${escAttr(state.portfolioScenario.avgPrice || "")}"></label>
              <label class="field"><span>Cash-Veränderung</span><input data-portfolio-scenario name="cashChange" type="number" value="${escAttr(state.portfolioScenario.cashChange || 0)}"></label>
              <label class="field"><span>Marktschock %</span><input data-portfolio-scenario name="shock" type="number" value="${escAttr(state.portfolioScenario.shock)}"></label>
              <label class="field"><span>Monatlicher Beitrag</span><input data-portfolio-scenario name="contribution" type="number" value="${escAttr(state.portfolioScenario.contribution)}"></label>
            </div>
            ${renderScenarioResult(analysis, scenario)}
          </article>

          <article class="card portfolio-management-card">
            <div class="card-topline">
              <div>
                <span class="card-label">Portfolios & Notizen</span>
                <h3>Mehrere Portfolios sauber trennen</h3>
                <p>Echtgeld, Test, ETF-Kern oder Trading-Ideen bleiben lokal getrennt.</p>
              </div>
              ${state.portfolios.length > 1 ? `<button class="tiny-button" type="button" data-portfolio-delete="${escAttr(portfolio.id)}">Aktuelles löschen</button>` : ""}
            </div>
            <form class="form-grid" data-portfolio-form>
              <label class="field"><span>Name</span><input name="name" placeholder="z. B. ETF-Kern oder Trading"></label>
              <label class="field"><span>Typ</span><select name="type"><option value="real">Echtgeld</option><option value="test">Testportfolio</option></select></label>
              <label class="field"><span>Start-Cash</span><input name="cash" type="number" placeholder="5000"></label>
              <label class="field"><span>Ziel-Cash %</span><input name="targetCash" type="number" placeholder="10"></label>
              <label class="field full-field"><span>Kommentar</span><textarea name="notes" placeholder="Wofür ist dieses Portfolio gedacht?"></textarea></label>
              <button class="primary-button" type="submit">Portfolio speichern</button>
            </form>
            <form class="form-grid compact-section" data-position-form>
              <label class="field"><span>Symbol</span><input name="symbol" placeholder="NVDA"></label>
              <label class="field"><span>Anzahl</span><input name="quantity" type="number" step="0.0001"></label>
              <label class="field"><span>Kaufkurs</span><input name="avgPrice" type="number" step="0.01"></label>
              <button class="primary-button" type="submit">Position speichern</button>
            </form>
            <form class="compact-section" data-portfolio-notes-form>
              <label class="field"><span>Notiz / These zum aktiven Portfolio</span><textarea name="notes">${esc(portfolio.notes || "")}</textarea></label>
              <button class="primary-button" type="submit">Notiz speichern</button>
            </form>
          </article>
        </div>
      </section>

      <section class="section">
        <article class="card">
          <div class="card-topline">
            <div>
              <span class="card-label">Watchlist 2.0</span>
              <h3>Weiterhin lokal gespeichert</h3>
            </div>
            ${renderStatusBadge(getOverallDataStatus())}
          </div>
          <form class="watch-form" data-watch-form>
            <label class="global-search" data-search-root>
              <input data-search-input data-watch-input placeholder="Symbol hinzufügen, z. B. META oder ETH" autocomplete="off">
              <div class="suggestions hidden" data-search-suggestions></div>
            </label>
            <button class="primary-button" type="submit">Hinzufügen</button>
          </form>
          <div class="watch-table">
            ${state.watchlist.map((symbol) => renderWatchlistManageRow(symbol)).join("") || renderEmptyState("Noch keine Assets in der Watchlist.")}
          </div>
        </article>
      </section>
    `;
  }

  function renderPortfolioFocusCard(analysis) {
    return `
      <article class="card portfolio-focus-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Was ist jetzt wichtig?</span>
            <h3>Prioritäten für dieses Portfolio</h3>
            <p>Risiken, Events, Alerts, Bewegungen und Rebalancing werden lokal priorisiert.</p>
          </div>
          ${renderStatusBadge(analysis.dataStatus)}
        </div>
        <div class="portfolio-focus-list">
          ${analysis.focusItems.map((item) => `
            <button class="portfolio-focus-row" type="button" ${item.symbol && assetMap.has(item.symbol) ? `data-symbol="${escAttr(item.symbol)}"` : `data-route="${escAttr(item.route || "portfolio")}"`}>
              <span class="pill ${escAttr(item.tone || "")}">${esc(item.label)}</span>
              <span>
                <strong>${esc(item.title)}</strong>
                <small>${esc(item.text)}</small>
              </span>
            </button>
          `).join("") || renderEmptyState("Keine dringenden Portfolio-Hinweise.")}
        </div>
      </article>
    `;
  }

  function renderPortfolioPerformanceCard(analysis) {
    const performance = analysis.performance;
    return `
      <article class="card portfolio-performance-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Performance</span>
            <h3>Beitrag statt nur Prozentzahl</h3>
            <p>Tageswert ist kursnah; Woche, Monat und Jahr sind modellierte Näherungen aus verfügbaren Zeitreihen/Fallbacks.</p>
          </div>
          ${renderDataMeta(analysis.meta, true)}
        </div>
        <div class="portfolio-performance-grid">
          ${renderMiniMetric("Heute", `${formatMoney(performance.daily.abs, "USD")} / ${formatPercent(performance.daily.pct)}`)}
          ${renderMiniMetric("Woche", `${formatMoney(performance.week.abs, "USD")} / ${formatPercent(performance.week.pct)}`)}
          ${renderMiniMetric("Monat", `${formatMoney(performance.month.abs, "USD")} / ${formatPercent(performance.month.pct)}`)}
          ${renderMiniMetric("Jahr", `${formatMoney(performance.year.abs, "USD")} / ${formatPercent(performance.year.pct)}`)}
          ${renderMiniMetric("Gesamt", `${formatMoney(analysis.performanceAbs, "USD")} / ${formatPercent(analysis.performancePct)}`)}
        </div>
        <div class="grid two">
          <div>
            <h4>Größte Gewinner</h4>
            ${renderPortfolioContributionList(performance.winners, "Keine Gewinner im aktuellen Portfolio.")}
          </div>
          <div>
            <h4>Größte Verlierer</h4>
            ${renderPortfolioContributionList(performance.losers, "Keine Verlierer im aktuellen Portfolio.")}
          </div>
        </div>
      </article>
    `;
  }

  function renderPortfolioContributionList(rows, emptyText) {
    return `
      <div class="portfolio-contribution-list">
        ${rows.map((row) => `
          <button class="portfolio-contribution-row" type="button" data-symbol="${escAttr(row.symbol)}">
            <span><strong>${esc(row.symbol)}</strong><small>${esc(row.asset.name)}</small></span>
            <span class="${toneClass(row.performanceAbs)}">${formatMoney(row.performanceAbs, row.asset.currency)}</span>
            <span class="${toneClass(row.contributionPct)}">${formatPercent(row.contributionPct)}</span>
          </button>
        `).join("") || renderEmptyState(emptyText)}
      </div>
    `;
  }

  function renderPortfolioInsightRow(item) {
    return `
      <div class="insight-row portfolio-insight-row">
        <span class="pill ${escAttr(item.tone || "")}">${esc(item.label)}</span>
        <p>${esc(item.text)}</p>
      </div>
    `;
  }

  function renderWatchlistManageRow(symbol) {
    const asset = getAsset(symbol);
    const quote = quoteFor(symbol);
    return `
      <div class="watch-manage-row">
        <button class="symbol-button" type="button" data-symbol="${escAttr(symbol)}">
          <strong>${esc(symbol)}</strong>
          <span>${esc(asset.name)}</span>
        </button>
        <div>
          <strong>${formatMoney(quote.price, asset.currency)}</strong>
          <span class="${toneClass(quote.changePct)}">${formatPercent(quote.changePct)}</span>
        </div>
        <div>${renderDataMeta(quote.meta, true)}</div>
        <button class="icon-button danger-button" type="button" data-watch-remove="${escAttr(symbol)}" aria-label="${escAttr(symbol)} entfernen">X</button>
      </div>
    `;
  }

  function renderSettingsPage() {
    const publicProviders = visibleProviders();
    const serverSideCount = publicProviders.filter((provider) => provider.keyMode === "serverEnv").length;
    const openDataCount = publicProviders.filter((provider) => provider.keyMode === "none").length;
    const hybridCount = publicProviders.filter((provider) => provider.security === "backend-ready" || provider.security === "browser-critical").length;
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Datenquellen</p>
            <h1>Quellenstatus statt öffentlicher API-Key-Verwaltung.</h1>
            <p>Normale Nutzer sehen hier keine editierbaren Schlüssel mehr. MH Analytics zeigt nur noch, welche Quellen welche Module bedienen, ob sie serverseitig, als Open Data oder hybrid eingeordnet sind und ob gerade Live-, Fallback- oder Teilstatus aktiv ist.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-clear-cache>Daten-Cache leeren</button>
            <button class="ghost-button" type="button" data-route="data-health">Datenstatus öffnen</button>
          </div>
        </div>
        <div class="provider-summary-grid">
          ${renderProviderSummary("Kernquellen", publicProviders.length, "Öffentliche Quellenübersicht ohne Key-Felder")}
          ${renderProviderSummary("Serverseitig", serverSideCount, "FRED, Finnhub, Alpha Vantage und EIA laufen mit Environment Variables")}
          ${renderProviderSummary("Open Data", openDataCount, "Kein Key-Feld nötig")}
          ${renderProviderSummary("Hybrid / später", hybridCount, "Eingeordnet, aber nicht als öffentliche Key-Konfiguration")}
        </div>
        ${renderProviderHealthPreview()}
        <article class="card provider-warning-card">
          <div>
            <h3>Warum keine öffentlichen Key-Felder mehr?</h3>
            <p>API-Keys gehören nicht in eine öffentliche Oberfläche. Sensible Quellen laufen deshalb serverseitig über Vercel Functions; Open-Data-Quellen werden zentral normalisiert. Das Frontend erhält nur Daten und Statushinweise.</p>
          </div>
          ${renderDataMeta(makeMeta("Vercel Environment Variables", "fallback", BOOT_TIME), true)}
        </article>
      </section>
      <section class="section">
        ${PROVIDER_GROUPS.map((group) => renderProviderGroup(group)).join("")}
      </section>
    `;
  }

  function renderDataHealthPage() {
    ensureHomeData();
    ensureEventData();
    const snapshot = dataHealthSnapshot();
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Data Health</p>
            <h1>Quellen, Frische und Modulstatus transparent.</h1>
            <p>Diese Seite zeigt f\u00fcr normale Nutzer, woher Daten kommen, wie belastbar sie gerade sind und welche Module live, hybrid oder fallback-gest\u00fctzt arbeiten. Keine Keys, keine Testbuttons, keine \u00f6ffentliche Konfiguration.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-route="settings">Datenquellen ansehen</button>
          </div>
        </div>
        ${renderDataHealthOverview(snapshot)}
        ${renderDataHealthLegend()}
        ${renderDataHealthSourcesOverview(snapshot.modules)}
        <article class="card">
          <div class="card-topline">
            <div>
              <span class="card-label">Quellen\u00fcbersicht pro Provider</span>
              <h3>Welche Quelle bedient welchen Bereich?</h3>
            </div>
            ${renderDataMeta(makeMeta("Provider-Registry + Laufzeitstatus", snapshot.overall.status, snapshot.lastGlobalUpdate), true)}
          </div>
          <div class="health-provider-grid">
            ${snapshot.providers.map(renderProviderHealthRow).join("")}
          </div>
        </article>
      </section>
    `;
  }

  function renderDataHealthOverview(snapshot) {
    return `
      <article class="card data-health-summary-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Systemgesundheit</span>
            <h3>${esc(snapshot.overall.label)}</h3>
            <p>${esc(snapshot.overall.text)}</p>
          </div>
          ${renderStatusBadge(snapshot.overall.status)}
        </div>
        <div class="provider-summary-grid">
          ${renderProviderSummary("Aktive Quellen", snapshot.counts.active, "Im \u00f6ffentlichen Kernstack sichtbar")}
          ${renderProviderSummary("Live", snapshot.counts.live, "Erfolgreiche Abrufe in dieser Sitzung")}
          ${renderProviderSummary("Hybrid/Fallback", snapshot.counts.hybridFallback, "Eingeschr\u00e4nkt oder fallback-gest\u00fctzt")}
          ${renderProviderSummary("Problematisch", snapshot.counts.problematic, "Offline, Fehler oder fehlend")}
          ${renderProviderSummary("Module gesund", snapshot.counts.healthyModules, "Gute oder belastbare Datenlage")}
          ${renderProviderSummary("Module eingeschr\u00e4nkt", snapshot.counts.limitedModules, "Hybrid, fallback oder lokal")}
        </div>
        <div class="data-health-meta health-summary-meta">
          <span><strong>Letzter Statuscheck:</strong> ${esc(formatTimestamp(snapshot.lastGlobalUpdate))}</span>
          <span><strong>Einordnung:</strong> heuristisch aus echten Provider-Statuswerten, Cache-Zeiten und Modulzuordnungen abgeleitet.</span>
          <span><strong>Sicherheit:</strong> API-Keys bleiben serverseitig; normale Nutzer sehen nur Transparenzinformationen.</span>
        </div>
      </article>
    `;
  }

  function renderDataHealthLegend() {
    const statusItems = [
      ["Live", "Frische Antwort einer Quelle oder frischer Cache aus erfolgreichem Abruf."],
      ["Hybrid", "Mindestens eine Quelle liefert, andere Teile nutzen Fallback oder lokale Logik."],
      ["Fallback", "Kein erfolgreicher Live-Abruf in dieser Sitzung; strukturierte lokale Daten sichern das Modul."],
      ["Offline", "Quelle meldet Fehler, fehlt oder ist bewusst nicht erreichbar."],
      ["Unbekannt", "Noch kein belastbarer Laufzeitstatus ableitbar."]
    ];
    const healthItems = [
      ["Gesund", "Datenlage wirkt belastbar."],
      ["Eingeschr\u00e4nkt", "Nutzbar, aber teilweise Cache, Hybrid oder nur Zusatzquelle."],
      ["Degradiert", "Fallback steht im Vordergrund."],
      ["Gest\u00f6rt", "Fehler, fehlende Konfiguration oder offline."]
    ];
    return `
      <article class="card data-health-legend">
        <div>
          <span class="card-label">Statuslogik</span>
          <h3>Einheitliche Begriffe</h3>
          <p>Die Begriffe gelten f\u00fcr Quellen und Module. Sie sind bewusst nutzerorientiert und keine rohe Debug-Konsole.</p>
        </div>
        <div class="health-legend-grid">
          <div>
            <span class="filter-label">Datenstatus</span>
            ${statusItems.map(([label, text]) => `<p><strong>${esc(label)}:</strong> ${esc(text)}</p>`).join("")}
          </div>
          <div>
            <span class="filter-label">Health</span>
            ${healthItems.map(([label, text]) => `<p><strong>${esc(label)}:</strong> ${esc(text)}</p>`).join("")}
          </div>
        </div>
      </article>
    `;
  }

  function renderDataHealthSourcesOverview(rows = dataHealthModuleRows()) {
    return `
      <article class="card data-health-overview-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Modulstatus</span>
            <h3>Welche Bereiche sind datenstark?</h3>
          </div>
          ${renderDataMeta(makeMeta("Zentrale Modul-/Quellenmatrix", aggregateModuleStatus(rows.map((row) => row.status)), Date.now()), true)}
        </div>
        <p>Diese Übersicht trennt Live-Daten, Hybrid-Logik, lokale Produktlogik und Fallbacks. Ein Modul wird nur als belastbar markiert, wenn seine zugeordneten Quellen oder stabilen lokalen Daten das seriös tragen.</p>
        <div class="source-overview-grid">
          ${rows.map(renderDataHealthSourceCard).join("")}
        </div>
      </article>
    `;
  }

  function renderDataHealthSourceCard(row) {
    return `
      <div class="source-overview-card">
        <div class="card-topline compact-topline">
          <div>
            <span class="card-label">${esc(row.mode)} · ${esc(row.healthLabel)}</span>
            <h4>${esc(row.module)}</h4>
          </div>
          ${renderStatusBadge(row.status)}
        </div>
        <div class="module-chip-row">
          ${row.providers.map((providerId) => {
            const provider = providerById(providerId);
            const health = providerHealthFor(providerId);
            return `<span class="module-chip">${esc(provider ? provider.name : providerId)} · ${esc(providerHealthShortLabel(health.status))}</span>`;
          }).join("")}
        </div>
        <p>${esc(row.note)}</p>
        <div class="data-health-meta">
          <span><strong>Datenbasis:</strong> ${esc(row.dataBasis)}</span>
          <span><strong>Frische:</strong> ${esc(row.freshness.label)} - ${esc(row.freshness.text)}</span>
          <span><strong>Letzter sinnvoller Abruf:</strong> ${esc(row.lastSuccessText)}</span>
          <span><strong>Status:</strong> ${esc(row.statusText)}</span>
        </div>
      </div>
    `;
  }

  function dataHealthModuleRows() {
    return DATA_HEALTH_MODULES.map(dataHealthModuleRow);
  }

  function dataHealthModuleRow(module) {
    const providerIds = module.providers || [];
    const healthItems = providerIds.map(providerHealthFor);
    const statuses = healthItems.map((health) => health.status);
    const status = aggregateHealthStatus(statuses);
    const lastSuccess = Math.max(...healthItems.map((health) => Number(health.lastSuccess || 0)), 0);
    const timestamp = Math.max(...healthItems.map((health) => Number(health.lastSuccess || health.timestamp || BOOT_TIME)), BOOT_TIME);
    const freshness = freshnessForHealth({ status, timestamp, lastSuccess });
    const healthState = healthStateForStatus(status);
    return {
      module: module.name,
      providers: providerIds,
      mode: module.mode,
      note: module.description,
      status,
      timestamp,
      freshness,
      dataBasis: module.quality === "hoch" ? "belastbar / breit abgestützt" : module.mode,
      lastSuccessText: lastSuccess ? formatTimestamp(lastSuccess) : "kein exakter Live-Timestamp verfügbar",
      healthLabel: healthState.label,
      statusText: moduleStatusText(statuses)
    };
  }

  function dataHealthSnapshot() {
    const providers = DATA_HEALTH_PROVIDER_IDS
      .map(providerById)
      .filter(Boolean)
      .map((provider) => ({
        provider,
        health: providerHealthFor(provider.id),
        source: sourceRegistryFor(provider.id)
      }));
    const modules = dataHealthModuleRows();
    const live = providers.filter((item) => item.health.status === "live").length;
    const stale = providers.filter((item) => item.health.status === "stale").length;
    const fallback = providers.filter((item) => ["fallback", "prepared", "mapped", "notUsed"].includes(item.health.status)).length;
    const problematic = providers.filter((item) => ["error", "missing", "disabled"].includes(item.health.status)).length;
    const healthyModules = modules.filter((row) => ["live", "hybrid"].includes(normalizedDataStatus(row.status)) || row.healthLabel === "Gesund").length;
    const limitedModules = modules.length - healthyModules;
    const lastGlobalUpdate = Math.max(
      ...providers.map((item) => Number(item.health.lastSuccess || item.health.timestamp || BOOT_TIME)),
      ...modules.map((row) => Number(row.timestamp || BOOT_TIME)),
      BOOT_TIME
    );
    const overallStatus = live ? "hybrid" : problematic ? "fallback" : "fallback";
    const overall = {
      status: overallStatus,
      label: live ? "Datenlage überwiegend hybrid belastbar" : "Fallback-Sicherheitsnetz aktiv",
      text: live
        ? "Mehrere Kernbereiche nutzen echte Abrufe oder frischen Cache; lokale Fallbacks bleiben als Schutzschicht sichtbar."
        : "Die Plattform bleibt nutzbar, aber viele Bereiche arbeiten aktuell fallback- oder lokal gestützt. Das wird bewusst offengelegt."
    };
    return {
      providers,
      modules,
      lastGlobalUpdate,
      overall,
      counts: {
        active: providers.length,
        live,
        stale,
        hybridFallback: stale + fallback,
        problematic,
        healthyModules,
        limitedModules
      }
    };
  }

  function sourceRegistryFor(providerId) {
    return DATA_SOURCE_REGISTRY.find((entry) => entry.id === providerId) || {
      id: providerId,
      role: "Zugeordnet",
      type: "Unbekannt",
      category: "Weitere Quelle",
      description: "Quelle ist im Provider-Stack vorhanden.",
      fallback: "Fallback-Status wird aus der Laufzeit abgeleitet."
    };
  }

  function aggregateModuleStatus(statuses) {
    if (statuses.includes("live")) return "hybrid";
    if (statuses.includes("stale")) return "stale";
    if (statuses.includes("error") || statuses.includes("missing")) return "fallback";
    return "fallback";
  }

  function normalizedDataStatus(status) {
    if (status === "live") return "live";
    if (status === "stale") return "hybrid";
    if (["fallback", "prepared", "mapped", "notUsed"].includes(status)) return "fallback";
    if (["error", "missing", "disabled"].includes(status)) return "offline";
    return "unknown";
  }

  function healthStateForStatus(status) {
    const normalized = normalizedDataStatus(status);
    if (normalized === "live") {
      return { label: "Gesund", status: "live" };
    }
    if (normalized === "hybrid") {
      return { label: "Eingeschränkt", status: "hybrid" };
    }
    if (normalized === "fallback") {
      return { label: "Degradiert", status: "fallback" };
    }
    if (normalized === "offline") {
      return { label: "Gestört", status: "offline" };
    }
    return { label: "Unbekannt", status: "unknown" };
  }

  function freshnessForHealth(health) {
    const status = health.status || "unknown";
    if (status === "live") {
      const ageMinutes = Math.max(0, Math.round((Date.now() - Number(health.lastSuccess || health.timestamp || Date.now())) / 60000));
      if (ageMinutes <= 30) {
        return { label: "Frisch", status: "live", text: `vor ${ageMinutes} Min.` };
      }
      return { label: "Leicht verzögert", status: "hybrid", text: formatTimestamp(health.lastSuccess || health.timestamp) };
    }
    if (status === "stale") {
      return { label: "Veraltet / stale", status: "stale", text: "Cache statt frischer Antwort" };
    }
    if (["fallback", "prepared", "mapped", "notUsed"].includes(status)) {
      return { label: "Nur Fallback", status: "fallback", text: "kein erfolgreicher Live-Timestamp in dieser Sitzung" };
    }
    if (["error", "missing", "disabled"].includes(status)) {
      return { label: "Unbekannt", status: "offline", text: "Quelle meldet Fehler, fehlt oder ist deaktiviert" };
    }
    return { label: "Unbekannt", status: "unknown", text: "keine belastbare Aktualitätsinformation" };
  }

  function aggregateHealthStatus(statuses) {
    if (statuses.includes("live")) {
      return "live";
    }
    if (statuses.includes("stale")) {
      return "stale";
    }
    if (statuses.includes("fallback")) {
      return "fallback";
    }
    if (statuses.every((status) => status === "missing")) {
      return "missing";
    }
    if (statuses.includes("error") && !statuses.some((status) => ["prepared", "mapped", "notUsed"].includes(status))) {
      return "error";
    }
    return "fallback";
  }

  function moduleStatusText(statuses) {
    if (statuses.includes("live")) {
      return "Mindestens eine Quelle hat in dieser Sitzung live geliefert.";
    }
    if (statuses.includes("stale")) {
      return "Es gibt Daten, aber sie stammen aus Cache oder sind nicht frisch.";
    }
    if (statuses.includes("fallback")) {
      return "Fallback aktiv, Live-Abruf fehlt oder ist noch nicht erfolgt.";
    }
    if (statuses.includes("missing")) {
      return "Für mindestens eine Quelle fehlt die serverseitige Konfiguration oder ein erfolgreicher Abruf.";
    }
    if (statuses.includes("error")) {
      return "Mindestens ein Abruf ist fehlgeschlagen.";
    }
    return "Zugeordnet oder Open Data, aber aktuell nicht live genutzt.";
  }

  function providerHealthShortLabel(status) {
    const labels = {
      live: "live",
      stale: "Cache",
      fallback: "Fallback",
      prepared: "zugeordnet",
      mapped: "zugeordnet",
      notUsed: "nicht genutzt",
      missing: "Quelle fehlt",
      error: "Fehler",
      disabled: "deaktiviert"
    };
    return labels[status] || status || "unklar";
  }

  function renderProviderHealthRow(entry) {
    const provider = entry.provider || entry;
    const health = entry.health || providerHealthFor(provider.id);
    const source = entry.source || sourceRegistryFor(provider.id);
    const keyState = providerKeyState(provider);
    const modules = PROVIDER_MODULE_USAGE[provider.id] || provider.categories;
    const freshness = freshnessForHealth(health);
    const healthState = healthStateForStatus(health.status);
    const lastSuccess = health.lastSuccess ? formatTimestamp(health.lastSuccess) : "kein exakter Live-Timestamp verfügbar";
    return `
      <div class="health-row provider-health-card">
        <div>
          <span class="card-label">${esc(source.category)} · ${esc(source.role)}</span>
          <strong>${esc(provider.name)}</strong>
          <p>${esc(source.description || provider.description)}</p>
        </div>
        <div class="provider-readiness">
          <span class="status-badge status-hybrid">${esc(source.type || providerSourceType(provider))}</span>
          <span class="status-badge status-${escAttr(healthState.status)}">${esc(healthState.label)}</span>
          ${renderProviderKeyBadge(keyState)}
          ${renderProviderLiveBadge(health)}
        </div>
        <div class="module-chip-row">
          ${modules.map((moduleName) => `<span class="module-chip">${esc(moduleName)}</span>`).join("")}
        </div>
        <div class="data-health-meta">
          <span><strong>Letzter Erfolg:</strong> ${esc(lastSuccess)}</span>
          <span><strong>Frische:</strong> ${esc(freshness.label)} - ${esc(freshness.text)}</span>
          <span><strong>Status:</strong> ${esc(health.message || "Noch keine Abrufhistorie.")}</span>
          <span><strong>Letzter Check:</strong> ${esc(formatTimestamp(health.timestamp))}</span>
          <span><strong>Fallback:</strong> ${esc(source.fallback || "Fallback wird aus Modulstatus abgeleitet.")}</span>
        </div>
      </div>
    `;
  }

  function renderProviderSummary(label, value, hint) {
    return `
      <article class="meta-tile provider-summary">
        <strong>${esc(value)}</strong>
        <span>${esc(label)}</span>
        <small>${esc(hint)}</small>
      </article>
    `;
  }

  function renderProviderHealthPreview() {
    const health = providerHealthSummary();
    return `
      <article class="card provider-health-preview">
        <div class="card-topline">
          <div>
            <span class="card-label">Data Health</span>
            <h3>Provider-Nutzung sichtbar</h3>
          </div>
          ${renderStatusBadge(health.live ? "live" : health.fallback ? "fallback" : "missing")}
        </div>
        <div class="metric-grid">
          ${renderMiniMetric("Live Provider", String(health.live))}
          ${renderMiniMetric("Fallback aktiv", String(health.fallback))}
          ${renderMiniMetric("Fehler/fehlend", String(health.error + health.missing))}
        </div>
        <p>Das Data-Health-Dashboard zeigt, welcher Provider welches Modul bedient, wann der letzte Abruf erfolgreich war und wo Fallbacks genutzt werden.</p>
        <button class="ghost-button" type="button" data-route="data-health">Data Health ansehen</button>
      </article>
    `;
  }

  function renderProviderGroup(group) {
    const providers = visibleProviders().filter((provider) => provider.group === group.id);
    if (!providers.length) {
      return "";
    }
    return `
      <div class="provider-group">
        <div class="section-head compact-section-head">
          <div>
            <h2>${esc(group.label)}</h2>
            <p>${providers.length} klar zugeordnete Kernquelle${providers.length === 1 ? "" : "n"}.</p>
          </div>
        </div>
        <div class="provider-grid">
          ${providers.map(renderProviderCard).join("")}
        </div>
      </div>
    `;
  }

  function renderProviderCard(provider) {
    const test = providerTestFor(provider.id);
    const security = providerSecurityLabel(provider.security);
    const keyState = providerKeyState(provider);
    const health = providerHealthFor(provider.id);
    const sourceType = providerSourceType(provider);
    return `
      <article class="card provider-card">
        <div class="card-topline">
          <div>
            <span class="card-label">${esc(provider.categories.join(" / "))}</span>
            <h3>${esc(provider.name)}</h3>
          </div>
          <div class="provider-badges">
            ${renderProviderStatusBadge(provider.status)}
            ${renderProviderSecurityBadge(provider.security)}
          </div>
        </div>
        <p>${esc(provider.description)}</p>
        <p class="small"><strong>Nutzung:</strong> ${esc(provider.usage)}</p>
        <div class="provider-readiness">
          <span class="status-badge status-fallback">${esc(sourceType)}</span>
          ${renderProviderKeyBadge(keyState)}
          ${renderProviderLiveBadge(health)}
        </div>
        <div class="provider-module-row">
          ${(PROVIDER_MODULE_USAGE[provider.id] || provider.categories).map((moduleName) => `<span class="module-chip">${esc(moduleName)}</span>`).join("")}
        </div>
        ${renderProviderDebugDetails(provider, test)}
        <div class="provider-security-note">
          <strong>${esc(security.label)}</strong>
          <span>${esc(security.text)}</span>
        </div>
      </article>
    `;
  }

  function renderProviderDebugDetails(provider, test) {
    if (!provider || provider.id !== "fred" || !test.details) {
      return "";
    }
    const details = test.details;
    if (details.kind === "fred-vercel-function") {
      return renderFredProxyDebugDetails(details);
    }
    return "";
  }

  function renderFredProxyDebugDetails(details) {
    const rows = [
      ["Codepfad", details.codePath],
      ["Frontend-Endpoint", details.frontendEndpoint],
      ["Browser-Origin", details.pageOrigin],
      ["Server-Key im Frontend", details.frontendKeyExposure],
      ["Stage", details.stage],
      ["HTTP-Status", details.httpStatus],
      ["Content-Type", details.contentType],
      ["Response-Format", details.responseFormat],
      ["Parsing", details.parseStatus],
      ["Function-Fehler", details.functionError || "kein Function-Fehler"],
      ["FRED-Fehler", details.fredError || "kein FRED-error_message Feld"],
      ["Hinweis", details.note]
    ];
    return `
      <details class="provider-debug">
        <summary>FRED Vercel-Function-Diagnose anzeigen</summary>
        <div class="provider-debug-grid">
          ${rows.map(([label, value]) => `
            <span>${esc(label)}</span>
            <strong>${esc(value ?? "nicht verfügbar")}</strong>
          `).join("")}
        </div>
        ${details.responseBody ? `<pre>${esc(details.responseBody)}</pre>` : ""}
      </details>
    `;
  }

  function renderProviderKeyField(provider, keyValue) {
    return `
      <div class="keyless-provider">
        <span class="pill">${esc(keyModeLabel(provider.keyMode))}</span>
        <span class="small">Keine öffentliche Key-Konfiguration. Sensible Schlüssel liegen serverseitig oder sind für diese Quelle nicht nötig.</span>
      </div>
    `;
  }

  function providersByStatus(status) {
    return visibleProviders().filter((provider) => provider.status === status);
  }

  function providersBySecurity(security) {
    return visibleProviders().filter((provider) => provider.security === security);
  }

  function visibleProviders() {
    return PUBLIC_PROVIDER_IDS
      .map(providerById)
      .filter(Boolean);
  }

  function providerById(id) {
    return PROVIDERS.find((provider) => provider.id === id);
  }

  function providerTestFor(providerId) {
    const test = state.providerTests[providerId];
    if (!test) {
      return {
        label: "Nicht getestet",
        className: "test-untested",
        message: "Noch kein Test ausgeführt.",
        details: null
      };
    }
    if (test.status === "ok") {
      return {
        label: "Test OK",
        className: "test-ok",
        message: test.message || "Provider hat geantwortet.",
        details: test.details || null
      };
    }
    if (test.status === "warn") {
      return {
        label: "Hinweis",
        className: "test-warn",
        message: test.message || "Provider ist vorbereitet, aber nicht live getestet.",
        details: test.details || null
      };
    }
    return {
      label: "Fehler",
      className: "test-error",
      message: test.message || "Provider-Test fehlgeschlagen.",
      details: test.details || null
    };
  }

  function providerKeyState(provider) {
    if (!provider) {
      return "missing";
    }
    if (provider.keyMode === "none") {
      return "none";
    }
    if (provider.keyMode === "serverEnv") {
      return "serverEnv";
    }
    return "notPublic";
  }

  function providerSourceType(provider) {
    if (!provider) {
      return "Unklar";
    }
    if (provider.keyMode === "serverEnv") {
      return "Serverseitig";
    }
    if (provider.security === "server-normalized") {
      return "Serverseitig normalisiert";
    }
    if (provider.security === "backend-ready" || provider.security === "browser-critical") {
      return "Hybrid";
    }
    return "Open Data";
  }

  function renderProviderKeyBadge(stateName) {
    const labels = {
      none: "Kein Key nötig",
      serverEnv: "Server-Env",
      notPublic: "Kein öffentliches Key-Feld",
      present: "Konfiguriert",
      missing: "Quelle fehlt"
    };
    const status = ["present", "none", "serverEnv", "notPublic"].includes(stateName) ? "fallback" : "missing";
    return `<span class="status-badge status-${status}">${esc(labels[stateName] || "Key unklar")}</span>`;
  }

  function renderProviderTestBadge(test) {
    const status = test.className === "test-ok" ? "live" : test.className === "test-error" ? "missing" : "fallback";
    return `<span class="status-badge status-${status}">${esc(test.label)}</span>`;
  }

  function renderProviderLiveBadge(health) {
    const status = health.status || "notUsed";
    const labels = {
      live: "Live",
      stale: "Teilweise / Cache",
      fallback: "Fallback aktiv",
      prepared: "Zugeordnet",
      mapped: "Zugeordnet",
      notUsed: "Teilweise / nicht aktiv",
      missing: "Offline / nicht konfiguriert",
      error: "Offline / Fehler",
      disabled: "Nicht öffentlich aktiv"
    };
    const badgeStatus = status === "live" ? "live" : status === "stale" || status === "fallback" || status === "prepared" || status === "mapped" || status === "notUsed" ? "fallback" : "missing";
    return `<span class="status-badge status-${badgeStatus}">${esc(labels[status] || status)}</span>`;
  }

  function providerHealthFor(providerId) {
    const provider = providerById(providerId);
    if (!provider) {
      return { status: "missing", timestamp: BOOT_TIME, message: "Provider nicht gefunden." };
    }
    const health = state.providerHealth[providerId];
    if (health) {
      return health;
    }
    if (provider.status === "active") {
      return { status: "fallback", timestamp: BOOT_TIME, message: "Im Datenlayer aktiv, aber in dieser Sitzung noch kein erfolgreicher Live-Abruf." };
    }
    if (provider.status === "mapped") {
      return { status: "notUsed", timestamp: BOOT_TIME, message: "Klar zugeordnet, aber noch nicht als Live-Modul verdrahtet." };
    }
    if (provider.status === "disabled" || REMOVED_PUBLIC_PROVIDER_IDS.includes(providerId)) {
      return { status: "disabled", timestamp: BOOT_TIME, message: "Aus der aktiven öffentlichen Provider-Seite entfernt." };
    }
    return { status: "prepared", timestamp: BOOT_TIME, message: provider.usage || "Provider zugeordnet." };
  }

  function recordProviderHealth(providerId, status, message, timestamp = Date.now()) {
    if (!providerId) {
      return;
    }
    const previous = state.providerHealth[providerId] || {};
    const next = {
      ...previous,
      status,
      message,
      timestamp
    };
    if (status === "live") {
      next.lastSuccess = timestamp;
    }
    state.providerHealth = { ...state.providerHealth, [providerId]: next };
    storageSet(STORAGE_KEYS.providerHealth, state.providerHealth);
  }

  function providerHealthSummary() {
    return DATA_HEALTH_PROVIDER_IDS.reduce((sum, providerId) => {
      const health = providerHealthFor(providerId);
      if (health.status === "live" || health.status === "stale") {
        sum.live += health.status === "live" ? 1 : 0;
        sum.stale += health.status === "stale" ? 1 : 0;
      } else if (["fallback", "prepared", "mapped", "notUsed"].includes(health.status)) {
        sum.fallback += 1;
      } else if (health.status === "missing") {
        sum.missing += 1;
      } else if (health.status === "error") {
        sum.error += 1;
      }
      return sum;
    }, { live: 0, stale: 0, fallback: 0, missing: 0, error: 0 });
  }

  function renderProviderStatusBadge(status) {
    const labels = {
      active: "Im Datenlayer aktiv",
      mapped: "Zugeordnet",
      prepared: "Nur vorbereitet",
      optional: "Optional",
      backendOnly: "Backend-only",
      disabled: "Deaktiviert"
    };
    const className = status === "active" || status === "mapped" ? "status-fallback" : status === "optional" ? "status-fallback" : "status-stale";
    return `<span class="status-badge ${className}">${esc(labels[status] || status)}</span>`;
  }

  function renderProviderSecurityBadge(security) {
    const labels = {
      "browser-ok-private": "Browser privat OK",
      "browser-ok-public": "Public",
      "browser-critical": "Browserkritisch",
      "backend-recommended": "Backend empfohlen",
      "backend-only": "Backend-only",
      "server-normalized": "Serverseitig normalisiert",
      "proxy-recommended": "Proxy empfohlen",
      "backend-ready": "Backend-ready"
    };
    const className = security === "backend-only" || security === "browser-critical" ? "status-stale" : security === "server-normalized" || security.includes("recommended") ? "status-fallback" : "status-live";
    return `<span class="status-badge ${className}">${esc(labels[security] || security)}</span>`;
  }

  function providerSecurityLabel(security) {
    const labels = {
      "browser-ok-private": {
        label: "Browser-sicher für lokale private Nutzung",
        text: "Der Key kann lokal gespeichert werden, sollte aber für ein echtes Produkt trotzdem kontrolliert werden."
      },
      "browser-ok-public": {
        label: "Public / kein geheimer Key",
        text: "Dieser Slot ist für öffentliche Daten oder keylose Anbindung vorbereitet."
      },
      "browser-critical": {
        label: "Browserkritisch",
        text: "Die Quelle ist offiziell und nützlich, sollte aber nicht als garantierter Live-Abruf im öffentlichen Frontend versprochen werden."
      },
      "backend-recommended": {
        label: "Backend empfohlen",
        text: "Für Produktion besser per Backend, Proxy oder Edge Function nutzen, damit Keys nicht sichtbar werden."
      },
      "backend-only": {
        label: "Backend-only",
        text: "Nicht direkt aus dem Browser aufrufen. Key/OAuth gehört später serverseitig geschützt."
      },
      "server-normalized": {
        label: "Serverseitig normalisiert",
        text: "Die Quelle braucht kein öffentliches Key-Feld. Das Frontend nutzt eine eigene /api/... Route mit einheitlicher Fehlerbehandlung."
      },
      "proxy-recommended": {
        label: "Proxy empfohlen",
        text: "Public/Demo kann lokal funktionieren; produktionsnah besser per Key und Proxy/Backend."
      },
      "backend-ready": {
        label: "Backend-ready",
        text: "Für spätere Auth, Datenbank und Edge Functions vorbereitet."
      }
    };
    return labels[security] || { label: "Sicherheitsstatus", text: security };
  }

  function keyModeLabel(mode) {
    if (mode === "none") {
      return "Kein Key nötig";
    }
    if (mode === "optional") {
      return "Optionaler Key";
    }
    if (mode === "oauth") {
      return "OAuth / Token Slot";
    }
    if (mode === "anon") {
      return "Anon/Public Key Slot";
    }
    if (mode === "serverEnv") {
      return "Vercel Environment Variable";
    }
    return "Kein öffentliches Key-Feld";
  }

  async function ensureHomeData(force = false) {
    if (state.loadingHome) {
      return;
    }
    const freshEnough = Date.now() - state.lastHomeRefresh < 2 * 60 * 1000;
    if (!force && freshEnough && state.macro.length) {
      return;
    }

    state.loadingHome = true;
    try {
      const symbols = unique([...HOME_TICKER, ...state.watchlist]);
      await Promise.all(symbols.map(async (symbol) => {
        state.quotes[symbol] = await api.getQuote(symbol);
      }));
      state.macro = await api.getMacro();
      state.globalMacro = await api.getGlobalMacro();
      state.lastHomeRefresh = Date.now();
      checkAlerts(false);
    } catch (error) {
      logError(error);
    } finally {
      state.loadingHome = false;
      if (["home", "portfolio", "data-health"].includes(state.route)) {
        render();
      }
    }
  }

  async function ensureScreenerData(force = false) {
    if (state.loadingScreener) {
      return;
    }
    const freshEnough = Date.now() - state.lastScreenerRefresh < 3 * 60 * 1000;
    if (!force && freshEnough) {
      return;
    }

    state.loadingScreener = true;
    try {
      const rows = filteredScreenerRows();
      const quoteSymbols = rows.slice(0, SCREENER_LIVE_LIMITS.quotes).map((row) => row.symbol);
      await Promise.all(quoteSymbols.map(async (symbol) => {
        state.quotes[symbol] = await api.getQuote(symbol);
      }));
      const equitySymbols = rows
        .filter((row) => ["Stock", "ETF"].includes(row.type))
        .map((row) => row.symbol);
      await Promise.all(equitySymbols.slice(0, SCREENER_LIVE_LIMITS.profiles).map(async (symbol) => {
        state.profiles[symbol] = await api.getProfile(symbol);
      }));
      await Promise.all(equitySymbols.slice(0, SCREENER_LIVE_LIMITS.fundamentals).map(async (symbol) => {
        state.fundamentals[symbol] = await api.getFundamentals(symbol);
      }));
      await Promise.all(equitySymbols.slice(0, SCREENER_LIVE_LIMITS.series).map(async (symbol) => {
        const stats = await api.getDailyStats(symbol);
        if (stats) {
          state.seriesStats[symbol] = stats;
        }
      }));
      state.lastScreenerRefresh = Date.now();
    } catch (error) {
      logError(error);
    } finally {
      state.loadingScreener = false;
      if (state.route === "screener") {
        render();
      }
    }
  }

  async function ensureAssetData(symbol, force = false) {
    if (state.loadingAssets[symbol]) {
      return;
    }
    const freshEnough = Date.now() - (state.assetLoadedAt[symbol] || 0) < 2 * 60 * 1000;
    if (!force && freshEnough) {
      return;
    }

    state.loadingAssets[symbol] = true;
    try {
      const [quote, profile, fundamentals, news, seriesStats] = await Promise.all([
        api.getQuote(symbol),
        api.getProfile(symbol),
        api.getFundamentals(symbol),
        api.getCompanyNews(symbol),
        api.getDailyStats(symbol)
      ]);
      state.quotes[symbol] = quote;
      state.profiles[symbol] = profile;
      state.fundamentals[symbol] = fundamentals;
      state.news[symbol] = news;
      if (seriesStats) {
        state.seriesStats[symbol] = seriesStats;
      }
      state.assetLoadedAt[symbol] = Date.now();
    } catch (error) {
      logError(error);
    } finally {
      state.loadingAssets[symbol] = false;
      if (state.route === "asset" && state.activeSymbol === symbol) {
        render();
      }
    }
  }

  async function ensureEventData(force = false) {
    if (state.loadingEvents) {
      return;
    }
    const freshEnough = Date.now() - state.lastEventsRefresh < 10 * 60 * 1000;
    if (!force && freshEnough && state.events.length) {
      return;
    }

    state.loadingEvents = true;
    try {
      state.events = await api.getEvents();
      state.lastEventsRefresh = Date.now();
    } catch (error) {
      logError(error);
      state.events = fallbackEvents("Event-Provider nicht erreichbar. Lokaler Kalender aktiv.");
      state.lastEventsRefresh = Date.now();
    } finally {
      state.loadingEvents = false;
      if (["home", "events", "asset", "data-health"].includes(state.route)) {
        render();
      }
    }
  }

  const api = {
    async getQuote(symbol) {
      const asset = getAsset(symbol);

      if (asset.type === "Crypto") {
        return this.getCryptoQuote(symbol);
      }

      if (asset.type === "Commodity") {
        const commodityQuote = await this.getCommodityQuote(symbol);
        if (commodityQuote) {
          return commodityQuote;
        }
        return fallbackQuote(symbol, "Rohstoff-Livequelle nicht erreichbar. Lokaler Commodity-Fallback aktiv.");
      }

      if (asset.type === "Index") {
        const indexQuote = await this.getAlphaQuote(symbol);
        if (indexQuote) {
          return indexQuote;
        }
        return fallbackQuote(symbol, "Index-Livequelle nicht sauber verfügbar. Lokaler Index-Fallback aktiv.");
      }

      if (serverApiAvailable()) {
        try {
          const url = finnhubProxyUrl({ endpoint: "quote", symbol });
          const result = await cachedJson(`finnhub:quote:${symbol}`, url, CACHE_TTL.quote, "finnhub");
          const data = result.data || {};
          if (!Number(data.c)) {
            throw new Error("Finnhub Quote ohne Preis");
          }
          return {
            symbol,
            price: Number(data.c),
            changePct: Number(data.dp || 0),
            changeAbs: Number(data.d || 0),
            high: numberOrNull(data.h),
            low: numberOrNull(data.l),
            prevClose: numberOrNull(data.pc),
            meta: makeMeta("Finnhub Quote API", result.status, result.timestamp)
          };
        } catch (error) {
          logError(error);
        }
      } else if (["Stock", "ETF"].includes(asset.type)) {
        recordProviderHealth("finnhub", "fallback", "Finnhub läuft über /api/finnhub und ist im lokalen Datei-Modus nicht verfügbar.");
      }

      if (serverApiAvailable()) {
        try {
          const url = alphaProxyUrl({ endpoint: "quote", symbol });
          const result = await cachedJson(`alpha:quote:${symbol}`, url, CACHE_TTL.quote, "alphaVantage");
          const quote = result.data && result.data["Global Quote"];
          if (!quote || !quote["05. price"]) {
            throw new Error("Alpha Vantage Quote nicht verfügbar");
          }
          return {
            symbol,
            price: Number(quote["05. price"]),
            changePct: Number(String(quote["10. change percent"] || "0").replace("%", "")),
            changeAbs: Number(quote["09. change"] || 0),
            meta: makeMeta("Alpha Vantage GLOBAL_QUOTE", result.status, result.timestamp)
          };
        } catch (error) {
          logError(error);
        }
      } else if (["Stock", "ETF"].includes(asset.type)) {
        recordProviderHealth("alphaVantage", "fallback", "Alpha Vantage läuft über /api/alphavantage und ist im lokalen Datei-Modus nicht verfügbar.");
      }

      return fallbackQuote(symbol, "Quote-Livequelle nicht erreichbar oder serverseitig nicht konfiguriert.");
    },

    async getAlphaQuote(symbol) {
      if (!serverApiAvailable()) {
        recordProviderHealth("alphaVantage", "fallback", "Alpha Vantage Vercel Function im lokalen Datei-Modus nicht verfügbar.");
        return null;
      }
      try {
        const url = alphaProxyUrl({ endpoint: "quote", symbol });
        const result = await cachedJson(`alpha:quote:${symbol}`, url, CACHE_TTL.quote, "alphaVantage");
        const quote = result.data && result.data["Global Quote"];
        if (!quote || !quote["05. price"]) {
          throw new Error("Alpha Vantage Quote nicht verfügbar");
        }
        return {
          symbol,
          price: Number(quote["05. price"]),
          changePct: Number(String(quote["10. change percent"] || "0").replace("%", "")),
          changeAbs: Number(quote["09. change"] || 0),
          meta: makeMeta("Alpha Vantage GLOBAL_QUOTE", result.status, result.timestamp)
        };
      } catch (error) {
        logError(error);
        return null;
      }
    },

    async getCommodityQuote(symbol) {
      if (symbol === "OIL") {
        const eiaQuote = await this.getEiaEnergyQuote("oil");
        if (eiaQuote) {
          return eiaQuote;
        }
      }

      if (serverApiAvailable()) {
        const alphaQuote = await this.getAlphaCommodityQuote(symbol);
        if (alphaQuote) {
          return alphaQuote;
        }
      } else {
        recordProviderHealth("alphaVantage", "fallback", "Alpha Vantage Rohstoffdaten laufen über /api/alphavantage und sind im lokalen Datei-Modus nicht verfügbar.");
      }
      if (symbol !== "OIL") {
        recordProviderHealth("eia", "notUsed", "EIA ist für Öl/Gas/Energie zuständig; dieses Rohstoffsymbol nutzt primär Alpha Vantage.");
      }
      return null;
    },

    async getEiaEnergyQuote(dataset) {
      if (!serverApiAvailable()) {
        recordProviderHealth("eia", "fallback", "EIA läuft über /api/eia und ist im lokalen Datei-Modus nicht verfügbar.");
        return null;
      }
      try {
        const url = eiaProxyUrl({ dataset });
        const result = await cachedJson(`eia:${dataset}`, url, CACHE_TTL.quote, "eia");
        const rows = Array.isArray(result.data?.data) ? result.data.data : [];
        const row = rows.find((item) => item && item.value !== null && item.value !== undefined);
        const price = row ? Number(row.value) : NaN;
        if (!Number.isFinite(price)) {
          throw new Error("EIA-Antwort ohne nutzbaren Preis");
        }
        return {
          symbol: "OIL",
          price,
          changePct: commodityChangeFromFallback("OIL", price),
          changeAbs: 0,
          meta: makeMeta(result.data?.meta?.source || "EIA APIv2 via Vercel Function", result.status, result.timestamp)
        };
      } catch (error) {
        logError(error);
        recordProviderHealth("eia", "fallback", error.message || "EIA Energy API nicht erreichbar.");
        return null;
      }
    },

    async getAlphaCommodityQuote(symbol) {
      const config = {
        GOLD: { source: "Alpha Vantage XAU/USD via Vercel Function" },
        SILVER: { source: "Alpha Vantage XAG/USD via Vercel Function" },
        OIL: { fn: "WTI", source: "Alpha Vantage WTI" }
      }[symbol];
      if (!config) {
        return null;
      }
      try {
        const url = alphaProxyUrl({ endpoint: "commodity", symbol });
        const result = await cachedJson(`alpha:commodity:${symbol}`, url, CACHE_TTL.quote, "alphaVantage");
        const price = extractAlphaCommodityPrice(result.data);
        if (!Number.isFinite(price)) {
          throw new Error("Alpha Vantage Rohstoffantwort ohne Preis");
        }
        return {
          symbol,
          price,
          changePct: commodityChangeFromFallback(symbol, price),
          changeAbs: 0,
          meta: makeMeta(config.source, result.status, result.timestamp)
        };
      } catch (error) {
        logError(error);
        return null;
      }
    },

    async getCryptoQuote(symbol) {
      const asset = getAsset(symbol);
      if (!asset.coingeckoId) {
        return fallbackQuote(symbol, "Kein CoinGecko Mapping.");
      }
      if (!serverApiAvailable()) {
        recordProviderHealth("coingecko", "fallback", "CoinGecko läuft über /api/coingecko und ist im lokalen Datei-Modus nicht verfügbar.");
        return fallbackQuote(symbol, "CoinGecko Vercel Function lokal nicht verfügbar. Krypto-Fallback aktiv.");
      }
      try {
        const url = coingeckoProxyUrl({ ids: asset.coingeckoId, vs_currencies: "usd" });
        const result = await cachedJson(`coingecko:quote:${symbol}`, url, CACHE_TTL.quote, "coingecko");
        const payload = result.data?.data || result.data;
        const data = payload && payload[asset.coingeckoId];
        if (!data || !Number(data.usd)) {
          throw new Error("CoinGecko Quote ohne Preis");
        }
        return {
          symbol,
          price: Number(data.usd),
          changePct: Number(data.usd_24h_change || 0),
          marketCap: numberOrNull(data.usd_market_cap),
          meta: makeMeta(result.data?.meta?.source || "CoinGecko via Vercel Function", result.status, result.timestamp)
        };
      } catch (error) {
        logError(error);
        recordProviderHealth("coingecko", "fallback", "CoinGecko Function nicht erreichbar, Rate Limit oder Provider-Fehler.");
        return fallbackQuote(symbol, "CoinGecko Function nicht erreichbar. Krypto-Fallback aktiv.");
      }
    },

    async getProfile(symbol) {
      const asset = getAsset(symbol);
      const base = fallbackProfile(symbol, "Profil-Livequelle nicht erreichbar oder serverseitig nicht konfiguriert.");
      if (!["Stock", "ETF"].includes(asset.type)) {
        return base;
      }

      if (serverApiAvailable()) {
        try {
          const url = finnhubProxyUrl({ endpoint: "profile", symbol });
          const result = await cachedJson(`finnhub:profile:${symbol}`, url, CACHE_TTL.profile, "finnhub");
          const data = result.data || {};
          if (!data.name && !data.ticker) {
            throw new Error("Finnhub Profil leer");
          }
          return {
            symbol,
            name: data.name || asset.name,
            exchange: data.exchange || "",
            sector: data.finnhubIndustry || asset.sector,
            country: data.country || "",
            marketCap: data.marketCapitalization ? Number(data.marketCapitalization) * 1000000 : asset.fallback.marketCap,
            logo: data.logo || "",
            meta: makeMeta("Finnhub Profile API", result.status, result.timestamp)
          };
        } catch (error) {
          logError(error);
        }
      } else if (["Stock", "ETF"].includes(asset.type)) {
        recordProviderHealth("finnhub", "fallback", "Finnhub Profile laufen über /api/finnhub und sind im lokalen Datei-Modus nicht verfügbar.");
      }

      return base;
    },

    async getFundamentals(symbol) {
      const asset = getAsset(symbol);
      if (!["Stock", "ETF"].includes(asset.type)) {
        return fallbackFundamentals(symbol, "Fundamentals für diesen Asset-Typ lokal gemappt.");
      }

      if (serverApiAvailable()) {
        try {
          const url = finnhubProxyUrl({ endpoint: "metrics", symbol });
          const result = await cachedJson(`finnhub:metric:${symbol}`, url, CACHE_TTL.fundamentals, "finnhub");
          const metric = result.data && result.data.metric ? result.data.metric : {};
          if (!Object.keys(metric).length) {
            throw new Error("Finnhub Metrics leer");
          }
          const marketCap = normalizeFinnhubMarketCap(firstNumber(metric.marketCapitalization, metric.marketCapitalizationBasic, metric.marketCap));
          const revenue = firstNumber(metric.revenueTTM, metric.revenuePerShareTTM && metric.sharesOutstanding ? metric.revenuePerShareTTM * metric.sharesOutstanding : null, asset.fallback.revenue);
          return {
            symbol,
            marketCap: marketCap || asset.fallback.marketCap,
            pe: firstNumber(metric.peBasicExclExtraTTM, metric.peNormalizedAnnual, asset.fallback.pe),
            eps: firstNumber(metric.epsBasicExclExtraItemsTTM, metric.epsInclExtraItemsTTM, asset.fallback.eps),
            revenue,
            profit: firstNumber(metric.netIncomeCommonTTM, metric.netIncomeCommonAnnual, analysisFor(symbol).profit),
            margin: firstNumber(metric.netProfitMarginTTM, metric.operatingMarginTTM, analysisFor(symbol).margin),
            grossMargin: firstNumber(metric.grossMarginTTM, metric.grossMarginAnnual, analysisFor(symbol).grossMargin),
            cashflow: firstNumber(metric.freeCashFlowTTM, metric.operatingCashFlowTTM, analysisFor(symbol).cashflow),
            debt: firstNumber(metric.totalDebt, metric.totalDebtAnnual, analysisFor(symbol).debt),
            revenueGrowth: firstNumber(metric.revenueGrowthTTMYoy, metric.revenueGrowthQuarterlyYoy, analysisFor(symbol).revenueGrowth),
            beta: firstNumber(metric.beta, null),
            meta: makeMeta("Finnhub Basic Financials", result.status, result.timestamp)
          };
        } catch (error) {
          logError(error);
        }
      } else if (["Stock", "ETF"].includes(asset.type)) {
        recordProviderHealth("finnhub", "fallback", "Finnhub Basic Financials laufen über /api/finnhub und sind im lokalen Datei-Modus nicht verfügbar.");
      }

      return fallbackFundamentals(symbol, "Fundamentals-Livequelle nicht erreichbar oder serverseitig nicht konfiguriert.");
    },

    async getCompanyNews(symbol) {
      const asset = getAsset(symbol);
      if (!["Stock", "ETF"].includes(asset.type)) {
        return fallbackNews(symbol, "Company News für diesen Asset-Typ lokal gemappt.");
      }

      if (serverApiAvailable()) {
        try {
          const to = toIsoDate(new Date());
          const from = toIsoDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));
          const url = finnhubProxyUrl({ endpoint: "news", symbol, from, to });
          const result = await cachedJson(`finnhub:news:${symbol}`, url, CACHE_TTL.news, "finnhub");
          const rows = Array.isArray(result.data) ? result.data : [];
          if (!rows.length) {
            throw new Error("Finnhub News leer");
          }
          return {
            items: rows.slice(0, 8).map((item) => ({
              headline: item.headline || "Ohne Titel",
              source: item.source || "Finnhub",
              summary: item.summary || "",
              url: item.url || "",
              datetime: item.datetime ? Number(item.datetime) * 1000 : result.timestamp,
              sentiment: classifyNewsSentiment(`${item.headline || ""} ${item.summary || ""}`),
              relevance: 80
            })),
            meta: makeMeta("Finnhub Company News", result.status, result.timestamp)
          };
        } catch (error) {
          logError(error);
        }
      } else if (["Stock", "ETF"].includes(asset.type)) {
        recordProviderHealth("finnhub", "fallback", "Finnhub Company News laufen über /api/finnhub und sind im lokalen Datei-Modus nicht verfügbar.");
      }

      return fallbackNews(symbol, "Finnhub News-Livequelle nicht erreichbar oder serverseitig nicht konfiguriert.");
    },

    async getDailyStats(symbol) {
      const asset = getAsset(symbol);
      if (!["Stock", "ETF"].includes(asset.type)) {
        return null;
      }
      if (!serverApiAvailable()) {
        recordProviderHealth("alphaVantage", "fallback", "Alpha Vantage Zeitreihen laufen über /api/alphavantage und sind im lokalen Datei-Modus nicht verfügbar.");
        return null;
      }
      try {
        const url = alphaProxyUrl({ endpoint: "daily", symbol });
        const result = await cachedJson(`alpha:daily:${symbol}`, url, CACHE_TTL.series, "alphaVantage");
        const series = result.data && result.data["Time Series (Daily)"] ? result.data["Time Series (Daily)"] : {};
        const rows = Object.entries(series)
          .map(([date, values]) => ({ date, close: Number(values["4. close"]) }))
          .filter((row) => Number.isFinite(row.close))
          .sort((a, b) => b.date.localeCompare(a.date));
        if (rows.length < 22) {
          throw new Error("Alpha Vantage Tagesreihe enthält zu wenige Datenpunkte");
        }
        return dailyStatsFromRows(symbol, rows, result);
      } catch (error) {
        logError(error);
        return null;
      }
    },

    async getMacro() {
      const rows = [];

      if (serverApiAvailable()) {
        try {
          const fredRows = await Promise.all(FRED_MACRO_SERIES.map((item) => fetchFredSeries(item)));
          rows.push(...fredRows);
        } catch (error) {
          logError(error);
          recordProviderHealth("fred", "fallback", error.message || "FRED Live-Abruf fehlgeschlagen.");
        }
      } else {
        recordProviderHealth("fred", "fallback", "FRED Vercel Function ist im lokalen Datei-Modus nicht verfügbar. Makro nutzt BLS/Treasury/Open-Data und Fallbacks.");
      }

      const openDataRows = await Promise.allSettled([
        fetchBlsMacroRows(),
        fetchTreasuryRows(),
        fetchFxMacroRows()
      ]);
      openDataRows.forEach((result) => {
        if (result.status === "fulfilled") {
          rows.push(...result.value);
        } else {
          logError(result.reason);
        }
      });

      return mergeMacroRows(rows);
    },

    async getGlobalMacro() {
      const rows = [];
      const wb = await fetchWorldBankGrowthRows();
      rows.push(...wb);
      const imf = await fetchImfGrowthRows();
      rows.push(...imf);
      return rows.length ? rows : fallbackGlobalMacro("Globale Open-Data-Quellen nicht erreichbar. Lokaler Vergleich aktiv.");
    },

    async getEvents() {
      const liveEvents = [];
      const from = toIsoDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      const to = toIsoDate(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));

      if (serverApiAvailable()) {
        try {
          const url = finnhubProxyUrl({ endpoint: "earnings", from, to });
          const result = await cachedJson("finnhub:events:earnings", url, CACHE_TTL.events, "finnhub");
          const rows = Array.isArray(result.data && result.data.earningsCalendar) ? result.data.earningsCalendar : [];
          rows.slice(0, 18).forEach((row) => {
            const symbol = normalizeSymbol(row.symbol || "");
            if (!assetMap.has(symbol)) {
              return;
            }
            liveEvents.push({
              title: `${symbol} Earnings`,
              type: "Earnings",
              symbol,
              date: parseEventDate(row.date),
              detail: `EPS erwartet: ${row.epsEstimate ?? "--"} | Umsatz erwartet: ${row.revenueEstimate ? formatCompactMoney(Number(row.revenueEstimate), "USD") : "--"}`,
              meta: makeMeta("Finnhub Earnings Calendar", result.status, result.timestamp)
            });
          });
        } catch (error) {
          logError(error);
          recordProviderHealth("finnhub", "fallback", "Finnhub Earnings Calendar nicht erreichbar.");
        }
      } else {
        recordProviderHealth("finnhub", "fallback", "Finnhub Earnings laufen über /api/finnhub und sind im lokalen Datei-Modus nicht verfügbar.");
      }

      if (serverApiAvailable()) {
        const alphaEvents = await fetchAlphaCalendarEvents();
        liveEvents.push(...alphaEvents);
      } else {
        recordProviderHealth("alphaVantage", "fallback", "Alpha Vantage Kalender laufen über /api/alphavantage und sind im lokalen Datei-Modus nicht verfügbar.");
      }

      const fallback = fallbackEvents(liveEvents.length ? "Fallback ergänzt Live-Kalender für Dividenden, Splits und Makrotermine." : "Kein Live-Event-Feed aktiv. Lokaler Kalender aktiv.");
      return dedupeEvents([...liveEvents, ...fallback]).sort((a, b) => a.date - b.date).slice(0, 34);
    }
  };

  async function fetchFredSeries(item) {
    const seriesId = item.seriesId || item.id;
    const url = fredProxyUrl({ series_id: seriesId, limit: "24" });
    const result = await cachedJson(`fred:${seriesId}`, url, CACHE_TTL.macro, "fred");
    const payload = result.data && result.data.data ? result.data.data : result.data;
    const observations = (payload.observations || [])
      .filter((row) => row.value && row.value !== ".")
      .map((row) => ({ date: row.date, value: Number(row.value) }))
      .filter((row) => Number.isFinite(row.value));

    if (observations.length < 2) {
      throw new Error(`FRED ${item.id} ohne genug Werte`);
    }

    const latest = observations[0];
    const previous = observations[1];
    let displayValue = latest.value;
    let trend = latest.value - previous.value;

    if (item.mode === "inflation" || item.mode === "yoy") {
      const yearAgo = yearAgoObservation(observations, latest);
      if (yearAgo && yearAgo.value) {
        displayValue = ((latest.value / yearAgo.value) - 1) * 100;
      } else {
        displayValue = ((latest.value / previous.value) - 1) * 100;
      }
      trend = displayValue - (FALLBACK_MACRO.find((row) => row.id === item.id)?.value || displayValue);
    }

    return {
      id: item.id,
      label: item.label,
      value: displayValue,
      display: `${formatNumber(displayValue)}${item.suffix}`,
      trend: trendText(trend),
      meta: makeMeta(`FRED ${seriesId} via Vercel Function`, result.status, result.timestamp || Date.parse(latest.date))
    };
  }

  async function fetchBlsMacroRows() {
    const rows = [];
    try {
      const cpiResult = await cachedJson("opendata:bls:cpi", openDataProxyUrl({ source: "bls-cpi" }), CACHE_TTL.openData, "bls");
      const cpiRows = Array.isArray(cpiResult.data?.data) ? cpiResult.data.data : [];
      const latest = cpiRows[0];
      const yearAgo = latest ? yearAgoObservation(cpiRows, latest) : null;
      if (latest && yearAgo) {
        const inflation = ((latest.value / yearAgo.value) - 1) * 100;
        rows.push({
          id: "CPIAUCSL",
          label: "US CPI / Inflation",
          value: inflation,
          display: `${formatNumber(inflation)}%`,
          trend: "Serverseitig aus BLS CPI-Serie berechnet",
          meta: makeMeta(cpiResult.data?.meta?.source || "BLS via Vercel Open-Data-Normalisierung", cpiResult.status, cpiResult.timestamp || Date.now())
        });
      }
    } catch (error) {
      logError(error);
      recordProviderHealth("bls", "fallback", "BLS CPI nicht erreichbar, FRED/Fallback bleibt aktiv.");
    }

    try {
      const unrateResult = await cachedJson("opendata:bls:unrate", openDataProxyUrl({ source: "bls-unrate" }), CACHE_TTL.openData, "bls");
      const latest = Array.isArray(unrateResult.data?.data) ? unrateResult.data.data[0] : null;
      if (latest) {
        rows.push({
          id: "UNRATE",
          label: "Arbeitslosenquote",
          value: latest.value,
          display: `${formatNumber(latest.value)}%`,
          trend: "Serverseitig aus BLS Labor-Serie",
          meta: makeMeta(unrateResult.data?.meta?.source || "BLS via Vercel Open-Data-Normalisierung", unrateResult.status, unrateResult.timestamp || Date.now())
        });
      }
    } catch (error) {
      logError(error);
      recordProviderHealth("bls", "fallback", "BLS Arbeitsmarkt nicht erreichbar, FRED/Fallback bleibt aktiv.");
    }
    return rows;
  }

  async function fetchTreasuryRows() {
    try {
      const result = await cachedJson("opendata:treasury:daily-rates", openDataProxyUrl({ source: "treasury-rates" }), CACHE_TTL.openData, "treasury");
      const row = result.data?.data || null;
      const y2 = firstNumber(row?.y2);
      const y10 = firstNumber(row?.y10);
      const rows = [];
      if (y10 !== null) {
        rows.push({
          id: "DGS10",
          label: "US 10Y Yield",
          value: y10,
          display: `${formatNumber(y10)}%`,
          trend: "Serverseitig aus Treasury Daily Rates",
          meta: makeMeta(result.data?.meta?.source || "U.S. Treasury via Vercel Open-Data-Normalisierung", result.status, result.timestamp)
        });
      }
      if (y10 !== null && y2 !== null) {
        const spread = y10 - y2;
        rows.push({
          id: "YCURVE",
          label: "Yield Curve 2Y-10Y",
          value: spread,
          display: `${formatNumber(spread)}%`,
          trend: spread < 0 ? "Treasury-Kurve invers" : "Treasury-Kurve positiv",
          meta: makeMeta(result.data?.meta?.source || "U.S. Treasury via Vercel Open-Data-Normalisierung", result.status, result.timestamp)
        });
      }
      return rows;
    } catch (error) {
      logError(error);
      recordProviderHealth("treasury", "fallback", "Treasury Daily Rates nicht erreichbar, FRED/Fallback bleibt aktiv.");
      return [];
    }
  }

  async function fetchFxMacroRows() {
    try {
      const result = await cachedJson("fx:usd:core", fxProxyUrl({ base: "USD", quotes: "EUR,JPY,GBP" }), CACHE_TTL.openData, "frankfurter");
      const rates = result.data?.rates || {};
      const rows = [];
      if (Number.isFinite(Number(rates.EUR)) && Number(rates.EUR) !== 0) {
        const eurUsd = 1 / Number(rates.EUR);
        rows.push({
          id: "EURUSD",
          label: "EUR/USD",
          value: eurUsd,
          display: formatNumber(eurUsd),
          trend: "Serverseitig aus Frankfurter FX berechnet",
          meta: makeMeta(result.data?.meta?.source || "Frankfurter FX via Vercel Function", result.status, result.timestamp)
        });
      }
      if (Number.isFinite(Number(rates.JPY))) {
        rows.push({
          id: "USDJPY",
          label: "USD/JPY",
          value: Number(rates.JPY),
          display: formatNumber(Number(rates.JPY)),
          trend: "Serverseitig aus Frankfurter FX",
          meta: makeMeta(result.data?.meta?.source || "Frankfurter FX via Vercel Function", result.status, result.timestamp)
        });
      }
      return rows;
    } catch (error) {
      logError(error);
      recordProviderHealth("frankfurter", "fallback", "FX-Route nicht erreichbar, lokale Währungslogik bleibt aktiv.");
      return [];
    }
  }

  async function fetchWorldBankGrowthRows() {
    try {
      const result = await cachedJson("opendata:worldbank:gdp-growth", openDataProxyUrl({ source: "worldbank-growth" }), CACHE_TTL.openData, "worldBank");
      const rows = Array.isArray(result.data?.data) ? result.data.data : [];
      const latestByCountry = {};
      rows
        .filter((row) => row.value !== null && row.country?.value)
        .forEach((row) => {
          const name = row.country.value;
          if (!latestByCountry[name] || Number(row.date) > Number(latestByCountry[name].date)) {
            latestByCountry[name] = row;
          }
        });
      return Object.values(latestByCountry).map((row) => ({
        country: row.country.value,
        indicator: "BIP-Wachstum",
        value: Number(row.value),
        display: `${formatPercent(Number(row.value))}`,
        source: result.data?.meta?.source || "World Bank via Vercel Open-Data-Normalisierung",
        status: result.status,
        meta: makeMeta(result.data?.meta?.source || "World Bank via Vercel Open-Data-Normalisierung", result.status, result.timestamp)
      }));
    } catch (error) {
      logError(error);
      recordProviderHealth("worldBank", "fallback", "World Bank API nicht erreichbar, globaler Fallback aktiv.");
      return [];
    }
  }

  async function fetchImfGrowthRows() {
    try {
      const result = await cachedJson("opendata:imf:ngdp-rpch", openDataProxyUrl({ source: "imf-growth" }), CACHE_TTL.openData, "imf");
      const values = result.data?.data || {};
      const labels = { USA: "USA", DEU: "Deutschland", CHN: "China" };
      return Object.entries(values).map(([code, series]) => {
        const years = Object.keys(series || {}).sort((a, b) => Number(b) - Number(a));
        const year = years[0];
        return {
          country: labels[code] || code,
          indicator: "IMF reales BIP-Wachstum",
          value: Number(series[year]),
          display: `${formatPercent(Number(series[year]))}`,
          source: result.data?.meta?.source || "IMF via Vercel Open-Data-Normalisierung",
          status: result.status,
          meta: makeMeta(result.data?.meta?.source || "IMF via Vercel Open-Data-Normalisierung", result.status, result.timestamp)
        };
      }).filter((row) => Number.isFinite(row.value));
    } catch (error) {
      logError(error);
      recordProviderHealth("imf", "fallback", "IMF DataMapper nicht erreichbar, World-Bank/Fallback bleibt aktiv.");
      return [];
    }
  }

  async function fetchAlphaCalendarEvents() {
    const events = [];
    try {
      const earningsText = await cachedText("alpha:events:earnings", alphaProxyUrl({ endpoint: "earnings" }), CACHE_TTL.events, "alphaVantage");
      parseCsv(earningsText.data).slice(0, 24).forEach((row) => {
        const symbol = normalizeSymbol(row.symbol || "");
        if (!symbol || !assetMap.has(symbol)) {
          return;
        }
        events.push({
          title: `${symbol} Earnings`,
          type: "Earnings",
          symbol,
          date: parseEventDate(row.reportDate || row.reportdate),
          detail: `Alpha Vantage Kalender | EPS-Schätzung: ${row.estimate || "--"} ${row.currency || ""}`.trim(),
          meta: makeMeta("Alpha Vantage Earnings Calendar CSV", earningsText.status, earningsText.timestamp)
        });
      });
    } catch (error) {
      logError(error);
      recordProviderHealth("alphaVantage", "fallback", "Alpha Vantage Earnings Calendar nicht erreichbar.");
    }

    try {
      const ipoText = await cachedText("alpha:events:ipo", alphaProxyUrl({ endpoint: "ipo" }), CACHE_TTL.events, "alphaVantage");
      parseCsv(ipoText.data).slice(0, 10).forEach((row) => {
        const symbol = normalizeSymbol(row.symbol || "");
        if (!symbol) {
          return;
        }
        events.push({
          title: `${row.name || symbol} IPO`,
          type: "IPO",
          symbol,
          date: parseEventDate(row.ipoDate || row.ipodate),
          detail: `Alpha Vantage IPO Calendar | Spanne: ${row.priceRangeLow || "--"}-${row.priceRangeHigh || "--"} ${row.currency || ""}`.trim(),
          meta: makeMeta("Alpha Vantage IPO Calendar CSV", ipoText.status, ipoText.timestamp)
        });
      });
    } catch (error) {
      logError(error);
      recordProviderHealth("alphaVantage", "fallback", "Alpha Vantage IPO Calendar nicht erreichbar.");
    }
    return events;
  }

  function mergeMacroRows(rows) {
    const byId = new Map();
    rows.forEach((row) => {
      if (!row || !row.id) {
        return;
      }
      const current = byId.get(row.id);
      if (!current || statusRank(row.meta?.status) > statusRank(current.meta?.status)) {
        byId.set(row.id, row);
      }
    });
    fallbackMacro("Fallback ergänzt fehlende Makro-Reihen.").forEach((row) => {
      if (!byId.has(row.id)) {
        byId.set(row.id, row);
      }
    });
    MACRO_EXTENSIONS.forEach((row) => {
      if (!byId.has(row.id)) {
        byId.set(row.id, { ...row, meta: makeMeta(row.source, row.status, BOOT_TIME) });
      }
    });
    return Array.from(byId.values());
  }

  function parseBlsSeries(data) {
    const series = data && data.Results && Array.isArray(data.Results.series) ? data.Results.series[0] : null;
    const rows = series && Array.isArray(series.data) ? series.data : [];
    return rows
      .map((row) => ({
        date: blsDate(row),
        value: Number(row.value)
      }))
      .filter((row) => row.date && Number.isFinite(row.value))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function blsDate(row) {
    if (!row || !row.year || !row.period || !/^M\d{2}$/.test(row.period)) {
      return "";
    }
    return `${row.year}-${row.period.slice(1)}-01`;
  }

  function yearAgoObservation(rows, latest) {
    if (!latest || !latest.date) {
      return null;
    }
    const targetYear = String(Number(latest.date.slice(0, 4)) - 1);
    return rows.find((row) => row.date.slice(0, 4) === targetYear && row.date.slice(5, 7) === latest.date.slice(5, 7)) || null;
  }

  function dailyStatsFromRows(symbol, rows, result) {
    const latest = rows[0];
    const day20 = rows[Math.min(20, rows.length - 1)];
    const day60 = rows[Math.min(60, rows.length - 1)];
    const performance1m = day20 ? ((latest.close / day20.close) - 1) * 100 : 0;
    const performance6m = day60 ? ((latest.close / day60.close) - 1) * 100 : performance1m;
    const returns = rows.slice(0, 31).map((row, index) => {
      const next = rows[index + 1];
      return next ? ((row.close / next.close) - 1) * 100 : 0;
    }).filter((value) => Number.isFinite(value));
    const volatility = standardDeviation(returns) * Math.sqrt(252);
    return {
      symbol,
      performance1m,
      performance6m,
      volatility: clamp(volatility, 10, 95),
      momentum: clamp(50 + performance1m * 2.2, 10, 95),
      trend: clamp(50 + performance6m * 0.75, 10, 95),
      rsi: clamp(50 + performance1m * 1.1, 20, 80),
      meta: makeMeta("Alpha Vantage TIME_SERIES_DAILY", result.status, result.timestamp)
    };
  }

  function standardDeviation(values) {
    if (!values.length) {
      return 0;
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  function extractAlphaCommodityPrice(data) {
    if (!data || typeof data !== "object") {
      return NaN;
    }
    if (Array.isArray(data.data) && data.data[0]) {
      return Number(data.data[0].value);
    }
    const direct = firstNumber(data.price, data.value, data["05. price"]);
    if (direct !== null) {
      return direct;
    }
    if (data["Realtime Currency Exchange Rate"]) {
      const fx = data["Realtime Currency Exchange Rate"];
      return firstNumber(fx["5. Exchange Rate"], fx["5. exchange rate"], fx.rate) ?? NaN;
    }
    const nested = Object.values(data).find((value) => value && typeof value === "object" && !Array.isArray(value));
    return nested ? firstNumber(nested.price, nested.value, nested["05. price"]) : NaN;
  }

  function commodityChangeFromFallback(symbol, price) {
    const fallback = getAsset(symbol).fallback.price;
    return fallback ? ((price / fallback) - 1) * 100 : 0;
  }

  function fallbackGlobalMacro(message) {
    return FALLBACK_GLOBAL_MACRO.map((row) => ({
      ...row,
      meta: makeMeta(row.source, row.status, BOOT_TIME, message)
    }));
  }

  function dedupeEvents(events) {
    const seen = new Set();
    return events.filter((eventItem) => {
      const key = `${eventItem.type}|${eventItem.symbol}|${toIsoDate(eventItem.date)}|${eventItem.title}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async function cachedJson(cacheKey, url, maxAge, providerId = "") {
    const cache = storageGet(STORAGE_KEYS.cache, {});
    const cached = cache[cacheKey];

    if (cached && Date.now() - cached.timestamp < maxAge) {
      recordProviderHealth(providerId, "live", "Frische Daten aus lokalem Cache genutzt.", cached.timestamp);
      return { data: cached.data, timestamp: cached.timestamp, status: "live" };
    }

    try {
      const data = await fetchJson(url, providerId);
      const entry = { timestamp: Date.now(), data };
      cache[cacheKey] = entry;
      storageSet(STORAGE_KEYS.cache, trimCache(cache));
      recordProviderHealth(providerId, "live", "Live-Abruf erfolgreich.", entry.timestamp);
      return { data, timestamp: entry.timestamp, status: "live" };
    } catch (error) {
      if (cached) {
        recordProviderHealth(providerId, "stale", "API nicht erreichbar, veralteter Cache genutzt.", cached.timestamp);
        return { data: cached.data, timestamp: cached.timestamp, status: "stale" };
      }
      recordProviderHealth(providerId, "error", error.message || "API-Fehler ohne Cache.");
      throw error;
    }
  }

  async function cachedText(cacheKey, url, maxAge, providerId = "") {
    const cache = storageGet(STORAGE_KEYS.cache, {});
    const cached = cache[cacheKey];

    if (cached && Date.now() - cached.timestamp < maxAge) {
      recordProviderHealth(providerId, "live", "Frische CSV/Text-Daten aus lokalem Cache genutzt.", cached.timestamp);
      return { data: cached.data, timestamp: cached.timestamp, status: "live" };
    }

    try {
      const data = await fetchText(url);
      const entry = { timestamp: Date.now(), data };
      cache[cacheKey] = entry;
      storageSet(STORAGE_KEYS.cache, trimCache(cache));
      recordProviderHealth(providerId, "live", "Live-Abruf erfolgreich.", entry.timestamp);
      return { data, timestamp: entry.timestamp, status: "live" };
    } catch (error) {
      if (cached) {
        recordProviderHealth(providerId, "stale", "API nicht erreichbar, veralteter CSV/Text-Cache genutzt.", cached.timestamp);
        return { data: cached.data, timestamp: cached.timestamp, status: "stale" };
      }
      recordProviderHealth(providerId, "error", error.message || "API-Fehler ohne Cache.");
      throw error;
    }
  }

  async function fetchJson(url, providerId = "") {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      const text = await response.text();
      const parsed = parsedProviderBody(text);
      if (!response.ok) {
        const error = new Error(providerHttpMessage(response, text, parsed.ok ? parsed.data : null, providerId));
        error.kind = response.status === 429 ? "rate-limit" : "http";
        error.httpStatus = response.status;
        error.responseText = text;
        error.responseData = parsed.ok ? parsed.data : null;
        error.contentType = response.headers.get("content-type") || "";
        error.parseOk = parsed.ok;
        error.apiMessage = extractProviderErrorMessage(parsed.ok ? parsed.data : null, text);
        throw error;
      }
      if (!parsed.ok) {
        const error = new Error("Parse-Fehler: API lieferte keine gültige JSON-Antwort.");
        error.kind = "parse";
        error.cause = parsed.error;
        error.httpStatus = response.status;
        error.responseText = text;
        error.contentType = response.headers.get("content-type") || "";
        error.parseOk = false;
        throw error;
      }
      return parsed.data;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function fetchText(url) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function mountTradingView(asset) {
    const host = document.getElementById("tradingviewHost");
    if (!host) {
      return;
    }

    const container = host.querySelector(".tradingview-widget-container");
    const widget = host.querySelector(".tradingview-widget-container__widget");
    const fallback = document.getElementById("tradingviewFallback");
    const showFallback = () => fallback && fallback.classList.remove("hidden");

    if (!navigator.onLine) {
      showFallback();
      return;
    }

    if (!container || !widget) {
      showFallback();
      return;
    }

    widget.innerHTML = "";
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.text = JSON.stringify({
      autosize: true,
      symbol: asset.tv,
      interval: "D",
      timezone: "Etc/UTC",
      theme: document.body.classList.contains("light") ? "light" : "dark",
      style: "1",
      locale: "de_DE",
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com"
    });

    const timer = window.setTimeout(showFallback, 9000);
    script.onload = () => {
      window.setTimeout(() => {
        window.clearTimeout(timer);
        if (!container.querySelector("iframe")) {
          showFallback();
        }
      }, 2500);
    };
    script.onerror = showFallback;
    container.appendChild(script);
  }

  function quoteFor(symbol) {
    return state.quotes[symbol] || fallbackQuote(symbol, "Fallback bis Live-Daten geladen sind.");
  }

  function profileFor(symbol) {
    return state.profiles[symbol] || fallbackProfile(symbol, "Fallback bis Profil geladen ist.");
  }

  function fundamentalsFor(symbol) {
    return state.fundamentals[symbol] || fallbackFundamentals(symbol, "Fallback bis Fundamentals geladen sind.");
  }

  function newsFor(symbol) {
    return state.news[symbol] || fallbackNews(symbol, "Fallback bis News geladen sind.");
  }

  function macroForView() {
    return state.macro.length ? state.macro : fallbackMacro("Fallback bis FRED geladen ist.");
  }

  function macroEnhancedForView() {
    const base = macroForView().map((item) => ({
      ...item,
      why: macroWhy(item.id),
      meaning: macroMeaning(item.id)
    }));
    const liveIds = new Set(base.map((item) => item.id));
    return [...base, ...MACRO_EXTENSIONS.filter((item) => !liveIds.has(item.id)).map((item) => ({
      ...item,
      meta: makeMeta(item.source, item.status, BOOT_TIME)
    }))];
  }

  function liquidityForView() {
    const macroRows = new Map(macroForView().map((item) => [item.id, item]));
    return LIQUIDITY_DATA.map((item) => ({
      ...item,
      ...(macroRows.get(item.id) || {}),
      bucket: item.bucket,
      pressure: liquidityPressureFor(macroRows.get(item.id) || item),
      why: item.why,
      meaning: item.meaning,
      meta: makeMeta(item.source, item.status, BOOT_TIME)
    })).map((item) => ({
      ...item,
      meta: item.meta && item.meta.status !== "fallback" ? item.meta : (macroRows.get(item.id)?.meta || item.meta)
    }));
  }

  function liquidityPressureFor(item) {
    const value = Number(item.value);
    if (item.id === "M1" || item.id === "M2" || item.id === "M3" || item.id === "M4") {
      if (value > 3) return 1;
      if (value < 0) return -1;
      return 0;
    }
    if (item.id === "REALYIELD") {
      if (value > 1.5) return -1;
      if (value < 0.5) return 1;
      return 0;
    }
    if (item.id === "YCURVE") {
      if (value < -0.25) return -1;
      if (value > 0.4) return 1;
      return 0;
    }
    if (item.id === "CBBS") {
      if (value > 0) return 1;
      if (value < -1) return -1;
      return 0;
    }
    return Number(item.pressure || 0);
  }

  function liquidityNarrativeForView() {
    const items = liquidityForView();
    const pressure = items.reduce((sum, item) => sum + Number(item.pressure || 0), 0);
    const score = clamp(52 + pressure * 8, 0, 100);
    const label = score >= 60 ? "Liquidität hilft Risikoassets" : score <= 42 ? "Liquidität bleibt restriktiv" : "Gemischtes Liquiditätsbild";
    const tone = score >= 60 ? "bull" : score <= 42 ? "bear" : "neutral";
    const summary = score >= 60
      ? "Breitere Geldmengen wirken unterstützend. Trotzdem bleiben Realzins und Zinskurve wichtig für Timing und Risiko."
      : score <= 42
        ? "Das Modell zeigt eher restriktive Bedingungen. Positionen sollten stärker über Qualität, Bewertung und Risikopuffer geprüft werden."
        : "M2 stabilisiert sich, aber Realzins, Yield Curve und Bilanzliquidität senden noch kein klares Entwarnungssignal.";
    return { score, label, tone, summary, items };
  }

  function liquidityBucketsForView() {
    const buckets = {};
    liquidityForView().forEach((item) => {
      const bucket = item.bucket || "Weitere Daten";
      buckets[bucket] = buckets[bucket] || [];
      buckets[bucket].push(item);
    });
    return Object.entries(buckets).map(([label, items]) => ({ label, items }));
  }

  function liquidityImpactForView() {
    return LIQUIDITY_IMPACT_MAP;
  }

  function macroWhy(id) {
    const text = {
      FEDFUNDS: "Leitzinsen setzen den Takt für Finanzierungskosten, Bewertungsmultiples und Risk-on/Risk-off.",
      CPIAUCSL: "Inflation bestimmt, wie viel Spielraum Zentralbanken für Zinssenkungen haben.",
      UNRATE: "Der Arbeitsmarkt zeigt, ob Wachstum robust bleibt oder eine Abkühlung droht.",
      DGS10: "Die 10Y-Rendite ist ein zentraler Diskontierungsanker für Aktien und Gold.",
      DXY: "Der Dollar beeinflusst Rohstoffe, Emerging Markets, US-Gewinne und globale Liquidität."
    };
    return text[id] || "Makroindikator für Liquidität, Wachstum, Inflation oder Risikoappetit.";
  }

  function macroMeaning(id) {
    const text = {
      FEDFUNDS: "Steigend wirkt restriktiv; fallend kann Risikoassets entlasten.",
      CPIAUCSL: "Steigende Inflation belastet Zinssenkungsfantasie; fallende Inflation hilft Multiples.",
      UNRATE: "Starker Anstieg kann Rezessionsrisiko signalisieren; zu niedrige Werte können Lohndruck bedeuten.",
      DGS10: "Steigende Renditen belasten lange Duration; fallende Renditen helfen Growth und Gold.",
      DXY: "Dollar-Stärke kann Rohstoffe und internationale Gewinne belasten."
    };
    return text[id] || "Interpretation hängt von Trend, Niveau und Marktregime ab.";
  }

  function fallbackQuote(symbol, message) {
    const asset = getAsset(symbol);
    return {
      symbol,
      price: asset.fallback.price,
      changePct: asset.fallback.changePct,
      changeAbs: asset.fallback.price * asset.fallback.changePct / 100,
      marketCap: asset.fallback.marketCap,
      meta: makeMeta("Lokaler Quote-Fallback", "fallback", BOOT_TIME, message)
    };
  }

  function fallbackProfile(symbol, message) {
    const asset = getAsset(symbol);
    return {
      symbol,
      name: asset.name,
      sector: asset.sector,
      exchange: "",
      country: "",
      marketCap: asset.fallback.marketCap,
      logo: "",
      meta: makeMeta("Lokaler Profil-Fallback", "fallback", BOOT_TIME, message)
    };
  }

  function fallbackFundamentals(symbol, message) {
    const asset = getAsset(symbol);
    const analysis = analysisFor(symbol);
    return {
      symbol,
      marketCap: asset.fallback.marketCap,
      pe: asset.fallback.pe,
      eps: asset.fallback.eps,
      revenue: asset.fallback.revenue,
      profit: analysis.profit,
      margin: analysis.margin,
      grossMargin: analysis.grossMargin,
      cashflow: analysis.cashflow,
      debt: analysis.debt,
      revenueGrowth: analysis.revenueGrowth,
      beta: null,
      meta: makeMeta("Lokaler Fundamentals-Fallback", "fallback", BOOT_TIME, message)
    };
  }

  function fallbackNews(symbol, message) {
    const now = Date.now();
    const filtered = FALLBACK_NEWS
      .filter((item) => item.symbols.includes(symbol) || item.symbols.includes(getAsset(symbol).sector))
      .concat(FALLBACK_NEWS.filter((item) => item.symbols.includes("SPY")))
      .slice(0, 5)
      .map((item) => ({
        headline: item.headline,
        source: item.source,
        summary: item.summary,
        sentiment: item.sentiment,
        relevance: item.relevance,
        datetime: now - item.ageHours * 60 * 60 * 1000,
        url: ""
      }));

    return {
      items: filtered.length ? filtered : FALLBACK_NEWS.slice(0, 3).map((item) => ({
        headline: item.headline,
        source: item.source,
        summary: item.summary,
        sentiment: item.sentiment,
        relevance: item.relevance,
        datetime: now - item.ageHours * 60 * 60 * 1000,
        url: ""
      })),
      meta: makeMeta("Lokaler News-Fallback", "fallback", BOOT_TIME, message)
    };
  }

  function fallbackMacro(message) {
    return FALLBACK_MACRO.map((item) => ({
      ...item,
      meta: makeMeta(item.source, item.status, BOOT_TIME, message)
    }));
  }

  function sentimentFor(symbol, quote, news) {
    const asset = getAsset(symbol);
    const quoteScore = clamp(50 + Number(quote.changePct || 0) * 8, 15, 85);
    const newsScore = news.items.reduce((sum, item) => sum + sentimentValue(item.sentiment), 0) / Math.max(news.items.length, 1);
    const score = Math.round(clamp((quoteScore * 0.45) + (asset.sentiment * 0.35) + (newsScore * 0.2), 0, 100));
    const label = score >= 65 ? "Bullish" : score <= 40 ? "Bearish" : "Neutral";
    const status = quote.meta.status === "live" || news.meta.status === "live" ? "live" : quote.meta.status === "stale" ? "stale" : "fallback";

    return {
      score,
      label,
      drivers: [
        { kind: "Preis", text: `Tagesbewegung ${formatPercent(quote.changePct)} beeinflusst das kurzfristige Momentum.` },
        { kind: "News", text: `${news.items.length} relevante Meldungen im aktuellen Feed/Fallback.` },
        { kind: "These", text: asset.thesis }
      ],
      meta: makeMeta("Lokales Sentiment-Modell + verfügbare Daten", status, Date.now(), "Kein externes AI-Sentiment erforderlich.")
    };
  }

  function technicalFor(symbol, quote) {
    const asset = getAsset(symbol);
    const analysis = analysisFor(symbol);
    const change = Number(quote.changePct || 0);
    const rsiScore = rsiToScore(analysis.rsi);
    const momentumScore = clamp((analysis.momentum * 0.72) + (change * 7) + 14, 0, 100);
    const volumeScore = clamp(analysis.volume, 0, 100);
    const trendScore = clamp(analysis.trend, 0, 100);
    const sentimentScore = clamp(asset.sentiment, 0, 100);
    const riskScore = clamp(100 - analysis.volatility, 0, 100);
    const score = Math.round(
      rsiScore * 0.16 +
      momentumScore * 0.22 +
      volumeScore * 0.12 +
      trendScore * 0.22 +
      sentimentScore * 0.16 +
      riskScore * 0.12
    );
    const rating = score >= 64 ? "BUY" : score <= 42 ? "SELL" : "NEUTRAL";
    const tone = rating === "BUY" ? "bull" : rating === "SELL" ? "bear" : "neutral";
    const probability = Math.round(clamp(score, 5, 95));
    const reason = ratingReason(rating, { rsi: analysis.rsi, momentumScore, trendScore, sentimentScore, riskScore, change });
    return {
      rating,
      tone,
      score,
      probability,
      reason,
      currency: asset.currency,
      levels: analysis.levels,
      chanceRisk: chanceRiskText(rating, analysis.volatility),
      components: [
        { label: "RSI", score: Math.round(rsiScore), text: `RSI ${formatNumber(analysis.rsi)} - ${rsiText(analysis.rsi)}.` },
        { label: "Momentum", score: Math.round(momentumScore), text: `1M Performance ${formatPercent(analysis.performance1m)}, heute ${formatPercent(change)}.` },
        { label: "Volumen / Aktivität", score: Math.round(volumeScore), text: volumeScore >= 65 ? "Aktivität überdurchschnittlich." : "Aktivität normal bis ruhig." },
        { label: "Trend", score: Math.round(trendScore), text: trendScore >= 65 ? "Trendstruktur konstruktiv." : trendScore <= 42 ? "Trendstruktur angeschlagen." : "Trend gemischt." },
        { label: "Sentiment", score: Math.round(sentimentScore), text: sentimentScore >= 65 ? "Sentiment unterstützt das Setup." : "Sentiment liefert kein klares Signal." },
        { label: "Volatilität / Risiko", score: Math.round(riskScore), text: analysis.volatility >= 70 ? "Erhöhtes Risiko und größere Schwankungen." : "Risiko im Modell kontrollierbar." }
      ],
      meta: makeMeta("Hybrid: Regelmodell + Quote-/Zeitreihen-Inputs", bestDataStatus([quote.meta.status, analysis.meta?.status]), Math.max(Number(quote.meta.timestamp || 0), Number(analysis.meta?.timestamp || 0)) || Date.now(), "Rating bleibt Produktlogik; Inputs kommen bevorzugt aus Live-Quotes und Alpha-Zeitreihen.")
    };
  }

  function analysisFor(symbol) {
    const asset = getAsset(symbol);
    const series = state.seriesStats[asset.symbol];
    if (ANALYTIC_DATA[asset.symbol]) {
      const base = ANALYTIC_DATA[asset.symbol];
      return series ? {
        ...base,
        rsi: series.rsi,
        momentum: series.momentum,
        trend: series.trend,
        volatility: series.volatility,
        performance1m: series.performance1m,
        performance6m: series.performance6m,
        meta: series.meta
      } : { ...base, meta: makeMeta("Lokales Analysemodell", "fallback", BOOT_TIME) };
    }

    const change = Number(asset.fallback.changePct || 0);
    const marketCap = Number(asset.fallback.marketCap || 0);
    const pe = Number(asset.fallback.pe || 0);
    const sectorBoost = sectorGrowthBias(asset.sector);
    const typeRisk = asset.type === "Crypto" ? 84 : asset.type === "Commodity" ? 62 : asset.type === "ETF" || asset.type === "Index" ? 34 : 50;
    const valueScore = pe ? clamp(78 - pe * 0.9 + (marketCap > 200000000000 ? 4 : 0), 20, 82) : asset.type === "ETF" ? 56 : 48;
    const growthScore = clamp(44 + sectorBoost + (asset.sentiment - 50) * 0.45 + change * 4, 25, 90);
    const momentumScore = series ? series.momentum : clamp(50 + change * 10 + (asset.sentiment - 55) * 0.35, 20, 88);
    const trendScore = series ? series.trend : clamp(48 + change * 8 + (asset.sentiment - 50) * 0.42, 22, 86);
    const qualityScore = clamp((marketCap > 300000000000 ? 72 : 58) + (asset.type === "ETF" ? 8 : 0) + (asset.sentiment - 55) * 0.35, 35, 88);

    return {
      rsi: series ? series.rsi : clamp(50 + change * 5, 28, 72),
      momentum: momentumScore,
      volume: clamp(48 + Math.abs(change) * 8 + (marketCap > 1000000000000 ? 7 : 0), 32, 78),
      trend: trendScore,
      volatility: series ? series.volatility : clamp(typeRisk + Math.abs(change) * 6 - (asset.type === "ETF" ? 8 : 0), 24, 90),
      value: valueScore,
      growth: growthScore,
      quality: qualityScore,
      performance1m: series ? series.performance1m : clamp(change * 3.8, -18, 24),
      performance6m: series ? series.performance6m : clamp(change * 14 + sectorBoost * 0.8, -35, 70),
      margin: null,
      grossMargin: null,
      profit: null,
      cashflow: null,
      debt: null,
      revenueGrowth: pe ? clamp(growthScore - 48, -10, 42) : null,
      levels: { support: asset.fallback.price * 0.94, resistance: asset.fallback.price * 1.08 },
      meta: series ? series.meta : makeMeta("Lokales Analysemodell", "fallback", BOOT_TIME)
    };
  }

  function sectorGrowthBias(sector) {
    const bias = {
      Technology: 18,
      Semiconductors: 24,
      Software: 20,
      "Communication Services": 12,
      Healthcare: 10,
      "Consumer Discretionary": 8,
      Financials: 4,
      Industrials: 6,
      Energy: 3,
      Materials: 5,
      "Digital Assets": 22,
      "Precious Metals": 2,
      "US Large Caps": 7,
      "US Total Market": 6,
      "Nasdaq 100": 14
    };
    return bias[sector] || 0;
  }

  function snapshotFor(symbol) {
    const asset = getAsset(symbol);
    const quote = quoteFor(symbol);
    const profile = profileFor(symbol);
    const fundamentals = fundamentalsFor(symbol);
    const analysis = analysisFor(symbol);
    const rating = technicalFor(symbol, quote);
    const marketCap = valueOr(valueOr(profile.marketCap, valueOr(fundamentals.marketCap, quote.marketCap)), asset.fallback.marketCap);
    const sector = profile.sector || asset.sector;
    const dataStatus = bestDataStatus([quote.meta.status, profile.meta.status, fundamentals.meta.status, analysis.meta?.status]);
    const score = Math.round(clamp(
      rating.score * 0.44 +
      analysis.value * 0.16 +
      analysis.growth * 0.18 +
      analysis.quality * 0.12 +
      asset.sentiment * 0.10,
      0,
      100
    ));
    return {
      symbol: asset.symbol,
      name: profile.name || asset.name,
      sector,
      type: asset.type,
      currency: asset.currency,
      quote,
      profile,
      fundamentals,
      analysis,
      rating,
      marketCap,
      dataStatus,
      score,
      valueScore: analysis.value,
      growthScore: analysis.growth,
      momentumScore: analysis.momentum,
      performance1m: analysis.performance1m,
      pickReason: pickReasonFor(score, rating, analysis)
    };
  }

  function filteredScreenerRows() {
    const filters = state.screener;
    let rows = ASSETS.map((asset) => snapshotFor(asset.symbol));
    const query = String(filters.search || "").trim().toLowerCase();
    if (query) {
      rows = rows.filter((row) => `${row.symbol} ${row.name} ${row.sector} ${row.type}`.toLowerCase().includes(query));
    }
    rows = rows.filter((row) => passesNumberFilter(row.momentumScore, filters.momentum));
    rows = rows.filter((row) => passesNumberFilter(row.valueScore, filters.value));
    rows = rows.filter((row) => passesNumberFilter(row.growthScore, filters.growth));
    rows = rows.filter((row) => passesMarketCapFilter(row, filters.marketCap));
    rows = rows.filter((row) => filters.sector === "all" || row.sector === filters.sector);
    rows = rows.filter((row) => passesPerformanceFilter(row, filters.performance));
    return sortScreenerRows(rows, filters.sort);
  }

  function topPicksForView() {
    const rows = ASSETS.map((asset) => snapshotFor(asset.symbol));
    const long = rows
      .filter((row) => row.rating.rating !== "SELL")
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((row) => ({
        symbol: row.symbol,
        direction: "Long",
        score: row.score,
        setup: row.rating.rating === "BUY" ? "Momentum bestätigt" : "Qualität beobachten",
        reason: row.pickReason
      }));
    const risk = rows
      .sort((a, b) => riskRank(b) - riskRank(a))
      .slice(0, 5)
      .map((row) => ({
        symbol: row.symbol,
        direction: row.rating.rating === "SELL" ? "Bearish" : "Risk",
        score: riskRank(row),
        setup: row.rating.rating === "SELL" ? "Trend/Risiko schwach" : "Volatilität hoch",
        reason: row.rating.rating === "SELL" ? row.rating.reason : "Setup hat Chance, aber Risiko/Volatilität ist überdurchschnittlich."
      }));
    return { long, risk };
  }

  function dailyBriefingForView() {
    const symbols = unique([...HOME_TICKER, ...state.watchlist, ...dashboardPrefs().favorites]).slice(0, 18);
    const moves = symbols
      .map((symbol) => {
        const quote = quoteFor(symbol);
        return {
          symbol,
          name: getAsset(symbol).name,
          changePct: Number(quote.changePct || 0),
          status: quote.meta.status
        };
      })
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
    const avgMove = moves.length ? moves.reduce((sum, item) => sum + item.changePct, 0) / moves.length : 0;
    const upcomingEvents = eventsForView()
      .filter((eventItem) => eventItem.date >= startOfToday() && eventItem.date <= daysFromNow(7))
      .sort(sortEventsForHub)
      .slice(0, 5);
    const unusualAssets = ASSETS
      .map((asset) => snapshotFor(asset.symbol))
      .sort((a, b) => (Math.abs(b.performance1m) + b.analysis.volume * 0.05) - (Math.abs(a.performance1m) + a.analysis.volume * 0.05))
      .slice(0, 5);
    return {
      marketMoves: moves.slice(0, 5),
      upcomingEvents,
      unusualAssets,
      avgMove,
      status: moves.some((item) => item.status === "live") ? "live" : "fallback",
      regime: marketRegimeFromMoves(avgMove, moves),
      liquidity: liquidityNarrativeForView()
    };
  }

  function dailyRecapForView() {
    const briefing = dailyBriefingForView();
    const moves = recapMarketMoves(briefing);
    const events = recapEventsForView(briefing);
    const news = recapNewsForView();
    const alerts = recapAlertsForView();
    const watchlistItems = recapWatchlistItems({ moves, events, news, alerts });
    const priorityItems = recapPriorityItems({ moves, events, news, watchlistItems, alerts });
    const todayEventCount = eventsForView().filter((eventItem) => matchesEventWindow(eventItem, "today")).length;
    const status = recapDataStatus({ moves, events, news });
    return {
      dateLabel: new Date().toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" }),
      moves,
      news,
      events,
      watchlistItems,
      alerts,
      priorityItems,
      todayEventCount,
      status,
      newsStatus: recapNewsStatus(news),
      watchlistStatus: watchlistItems.some((item) => item.status === "live" || item.status === "hybrid") ? "hybrid" : "local",
      moveMode: moves.some((item) => Math.abs(item.changePct) >= 3) ? "Auffällig" : "Selektiv",
      watchlistTone: recapWatchlistTone(watchlistItems),
      conclusion: recapConclusion({ priorityItems, moves, events, watchlistItems, news, briefing })
    };
  }

  function recapMarketMoves(briefing) {
    return briefing.marketMoves
      .map((item) => {
        const isWatchlist = state.watchlist.includes(item.symbol) || dashboardPrefs().favorites.includes(item.symbol);
        const score = clamp(Math.abs(Number(item.changePct || 0)) * 14 + (isWatchlist ? 28 : 0) + (item.status === "live" ? 8 : 0), 0, 100);
        const direction = Number(item.changePct || 0) >= 0 ? "stark" : "unter Druck";
        return {
          ...item,
          score,
          reason: `${isWatchlist ? "Watchlist-relevant. " : ""}${item.symbol} bewegt sich heute ${direction}; wichtig für Momentum, Risiko und mögliche Follow-up-Checks.`
        };
      })
      .filter((item, index) => index < 5 || item.score >= 55)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  function recapEventsForView(briefing) {
    const today = eventsForView()
      .filter((eventItem) => matchesEventWindow(eventItem, "today"))
      .sort(sortEventsForHub);
    const fallback = briefing.upcomingEvents
      .filter((eventItem) => eventItem.date >= startOfToday())
      .sort(sortEventsForHub);
    return (today.length ? today : fallback).slice(0, 5);
  }

  function recapNewsForView() {
    const symbols = unique([...state.watchlist, ...dashboardPrefs().favorites, state.activeSymbol, ...HOME_TICKER]).slice(0, 14);
    const seen = new Set();
    return symbols
      .flatMap((symbol) => {
        const news = newsFor(symbol);
        return news.items.slice(0, 2).map((item) => ({
          ...item,
          symbol,
          status: news.meta?.status || "fallback",
          score: recapNewsScore(item, symbol)
        }));
      })
      .filter((item) => {
        const key = `${item.symbol}-${item.headline}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  function recapNewsScore(item, symbol) {
    const watchlistBoost = state.watchlist.includes(symbol) || dashboardPrefs().favorites.includes(symbol) ? 20 : 0;
    const ageHours = Math.max(0, (Date.now() - Number(item.datetime || Date.now())) / (60 * 60 * 1000));
    const freshness = Math.max(0, 12 - ageHours);
    return clamp(Number(item.relevance || 50) + watchlistBoost + freshness, 0, 100);
  }

  function recapAlertsForView() {
    const byId = new Map(state.alerts.map((alert) => [alert.id, normalizeAlertRecord(alert)]));
    return alertInboxForView()
      .map((item) => ({
        ...item,
        alert: byId.get(item.alertId)
      }))
      .filter((item) => item.status === "triggered" || item.alert?.priority === "high")
      .slice(0, 4);
  }

  function recapWatchlistItems(context) {
    const alertItems = context.alerts
      .filter((item) => item.alert && state.watchlist.includes(item.alert.symbol))
      .map((item) => ({
        symbol: item.alert.symbol,
        kind: "Alert",
        priority: item.alert.priority || "medium",
        status: "local",
        text: item.message || alertLabel(item.alert)
      }));
    const moveItems = context.moves
      .filter((item) => state.watchlist.includes(item.symbol))
      .map((item) => ({
        symbol: item.symbol,
        kind: "Move",
        priority: item.score >= 70 ? "high" : "medium",
        status: item.status,
        text: `${formatPercent(item.changePct)} heute. ${item.reason}`
      }));
    const eventItems = context.events
      .filter(isWatchlistRelevantEvent)
      .map((eventItem) => ({
        symbol: eventItem.symbol,
        kind: eventTypeLabel(eventItem),
        priority: eventRelevance(eventItem) >= 80 ? "high" : "medium",
        status: eventItem.meta?.status || "fallback",
        text: `${eventItem.title} · ${eventTimingLabel(eventItem)}`
      }));
    const newsItems = context.news
      .filter((item) => state.watchlist.includes(item.symbol))
      .slice(0, 2)
      .map((item) => ({
        symbol: item.symbol,
        kind: "News",
        priority: item.score >= 80 ? "high" : "medium",
        status: item.status,
        text: item.headline
      }));
    return [...alertItems, ...moveItems, ...eventItems, ...newsItems].slice(0, 6);
  }

  function recapPriorityItems(context) {
    const moveItems = context.moves.map((item) => ({
      kind: "Markt",
      symbol: item.symbol,
      title: `${item.symbol}: ${formatPercent(item.changePct)}`,
      text: item.reason,
      score: item.score
    }));
    const eventItems = context.events.map((eventItem) => ({
      kind: eventTypeLabel(eventItem),
      symbol: assetMap.has(eventItem.symbol) ? eventItem.symbol : "",
      route: "events",
      title: eventItem.title,
      text: `${eventTimingLabel(eventItem)} · ${eventAreaLabel(eventItem)} · Quelle: ${eventSourceLabel(eventItem)}`,
      score: eventRelevance(eventItem)
    }));
    const watchItems = context.watchlistItems.map((item) => ({
      kind: "Watchlist",
      symbol: item.symbol,
      route: "alerts",
      title: item.symbol ? `${item.symbol}: ${item.kind}` : item.kind,
      text: item.text,
      score: item.priority === "high" ? 88 : 68
    }));
    const newsItems = context.news.map((item) => ({
      kind: "News",
      symbol: item.symbol,
      title: item.headline,
      text: `${item.symbol} · ${item.source} · ${item.summary || "Kuratiertes News-Signal."}`,
      score: item.score
    }));
    return [...watchItems, ...eventItems, ...moveItems, ...newsItems]
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }

  function recapConclusion(context) {
    const first = context.priorityItems[0];
    const hasWatchlist = context.watchlistItems.length > 0;
    if (first && first.score >= 82) {
      return {
        label: hasWatchlist ? "Heute zuerst Watchlist prüfen" : "Heute gibt es klare Prioritäten",
        text: `${first.title} ist der stärkste Punkt im Recap. Danach Events und News prüfen, bevor neue Setups bewertet werden.`
      };
    }
    if (Math.abs(context.briefing.avgMove) >= 0.45) {
      return {
        label: context.briefing.regime.label,
        text: context.briefing.regime.text
      };
    }
    return {
      label: "Selektiver Tag",
      text: "Keine einzelne Meldung dominiert. Relevanter sind Watchlist-Bezug, kommende Events und die stärksten Einzelbewegungen."
    };
  }

  function recapDataStatus(context) {
    const statuses = [
      ...context.moves.map((item) => item.status),
      ...context.events.map((item) => item.meta?.status),
      ...context.news.map((item) => item.status)
    ];
    if (statuses.includes("live") || statuses.includes("stale")) {
      return "hybrid";
    }
    return "fallback";
  }

  function recapNewsStatus(news) {
    if (news.some((item) => item.status === "live" || item.status === "stale")) {
      return "hybrid";
    }
    return "fallback";
  }

  function recapScoreTone(score) {
    if (score >= 80) return "bull";
    if (score < 55) return "neutral";
    return "";
  }

  function recapRelevanceLabel(score) {
    if (score >= 80) return "hoch";
    if (score >= 60) return "mittel";
    return "beobachten";
  }

  function recapWatchlistTone(items) {
    if (!items.length) {
      return {
        label: "Ruhig",
        text: "Keine größeren Watchlist-Hinweise im aktuellen Datenfenster. Fokus auf geplante Setups und Events."
      };
    }
    return {
      label: `${items.length} Hinweise`,
      text: "Es gibt Bewegungen oder Termine in deiner Watchlist. Prüfe zuerst, ob sich deine These verändert hat."
    };
  }

  function marketRegimeFromMoves(avgMove, moves) {
    const positive = moves.filter((item) => item.changePct > 0).length;
    const negative = moves.filter((item) => item.changePct < 0).length;
    if (avgMove >= 0.45 && positive >= negative) {
      return { label: "Risk-on", text: "Breite Marktbewegungen sind überwiegend positiv. Momentum- und Growth-Setups bekommen Rückenwind, Risiko bleibt trotzdem über Positionsgröße steuerbar." };
    }
    if (avgMove <= -0.45 && negative > positive) {
      return { label: "Risk-off", text: "Die beobachteten Assets zeigen Druck. Defensive Watchlist, Cash-Anteil, Stops und Liquiditätsdaten sind heute besonders wichtig." };
    }
    return { label: "Neutral / selektiv", text: "Kein klarer Marktmodus. Einzelaktien-Qualität, Earnings-Trigger und klare Setups zählen stärker als breite Marktmeinung." };
  }

  function startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function daysFromNow(days) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  function eventsForView() {
    return state.events.length ? state.events : fallbackEvents("Fallback bis Event-Provider geladen sind.");
  }

  function fallbackEvents(message = "Lokaler Kalender aktiv.") {
    return FALLBACK_EVENTS.map((eventItem) => {
      const date = new Date(Date.now() + eventItem.dateOffset * 24 * 60 * 60 * 1000);
      date.setHours(12, 0, 0, 0);
      return {
        ...eventItem,
        date,
        meta: makeMeta("Lokaler Event-Fallback", "fallback", BOOT_TIME, message)
      };
    }).sort((a, b) => a.date - b.date);
  }

  function eventsForSymbol(symbol) {
    return eventsForView()
      .filter((eventItem) => eventItem.symbol === symbol || eventItem.symbol === "Macro")
      .filter((eventItem) => eventItem.date >= startOfToday() || eventItem.symbol === symbol)
      .sort(sortEventsForHub)
      .slice(0, 8);
  }

  function filteredEventHubEvents(events) {
    return events
      .filter((eventItem) => matchesEventType(eventItem, state.eventHub.type))
      .filter((eventItem) => matchesEventWindow(eventItem, state.eventHub.window))
      .filter((eventItem) => matchesEventScope(eventItem, state.eventHub.scope))
      .filter((eventItem) => matchesEventRelevance(eventItem, state.eventHub.relevance))
      .filter((eventItem) => matchesEventSource(eventItem, state.eventHub.source))
      .filter((eventItem) => matchesEventSearch(eventItem, state.eventHub.search))
      .sort(sortEventsForHub);
  }

  function matchesEventType(eventItem, filter) {
    const type = String(eventItem.type || "").toLowerCase();
    if (!filter || filter === "all") return true;
    if (filter === "earnings") return type.includes("earnings");
    if (filter === "dividend") return type.includes("dividende") || type.includes("dividend") || type.includes("split");
    if (filter === "macro") return type.includes("makro");
    if (filter === "ipo") return type.includes("ipo");
    return true;
  }

  function matchesEventWindow(eventItem, filter) {
    const start = startOfToday();
    const date = new Date(eventItem.date);
    if (filter === "today") {
      return date >= start && date < daysFromNow(1);
    }
    if (filter === "next") {
      return date >= daysFromNow(7) && date < daysFromNow(14);
    }
    return date >= start && date < daysFromNow(7);
  }

  function matchesEventScope(eventItem, filter) {
    if (!filter || filter === "all") return true;
    if (filter === "watchlist") return isWatchlistRelevantEvent(eventItem);
    if (filter === "stock") return assetMap.get(eventItem.symbol)?.type === "Stock";
    if (filter === "macro") return matchesEventType(eventItem, "macro") || eventItem.symbol === "Macro";
    return true;
  }

  function matchesEventRelevance(eventItem, filter) {
    if (!filter || filter === "all") return true;
    const relevance = eventRelevance(eventItem);
    if (filter === "high") return relevance >= 80;
    if (filter === "medium") return relevance >= 60;
    return true;
  }

  function matchesEventSource(eventItem, filter) {
    if (!filter || filter === "all") return true;
    const source = String(eventItem.meta?.source || "").toLowerCase();
    const status = String(eventItem.meta?.status || "").toLowerCase();
    if (filter === "live") return status === "live" || status === "stale";
    if (filter === "fallback") return status === "fallback";
    if (filter === "finnhub") return source.includes("finnhub");
    if (filter === "alpha") return source.includes("alpha");
    if (filter === "local") return source.includes("lokal") || source.includes("local") || source.includes("mh");
    return true;
  }

  function matchesEventSearch(eventItem, search) {
    const term = String(search || "").trim().toLowerCase();
    if (!term) return true;
    return [
      eventItem.title,
      eventItem.type,
      eventItem.symbol,
      eventItem.detail,
      eventItem.meta?.source
    ].some((value) => String(value || "").toLowerCase().includes(term));
  }

  function sortEventsForHub(a, b) {
    const aPast = new Date(a.date) < startOfToday();
    const bPast = new Date(b.date) < startOfToday();
    if (aPast !== bPast) return aPast ? 1 : -1;
    return eventRelevance(b) - eventRelevance(a) || new Date(a.date) - new Date(b.date);
  }

  function eventHubCounts(events) {
    const windowed = events.filter((eventItem) => matchesEventWindow(eventItem, state.eventHub.window));
    return {
      all: windowed.length,
      earnings: windowed.filter((eventItem) => matchesEventType(eventItem, "earnings")).length,
      dividend: windowed.filter((eventItem) => matchesEventType(eventItem, "dividend")).length,
      macro: windowed.filter((eventItem) => matchesEventType(eventItem, "macro")).length,
      ipo: windowed.filter((eventItem) => matchesEventType(eventItem, "ipo")).length
    };
  }

  function eventHubSummary(events) {
    const today = events.filter((eventItem) => matchesEventWindow(eventItem, "today")).length;
    const week = events.filter((eventItem) => matchesEventWindow(eventItem, "week")).length;
    const next = events.filter((eventItem) => matchesEventWindow(eventItem, "next")).length;
    const watchlist = events.filter(isWatchlistRelevantEvent).length;
    const focus = importantEventsForHub(events);
    const first = focus[0];
    return {
      today,
      week,
      next,
      watchlist,
      focusTitle: first ? `${eventTimingLabel(first)}: ${first.title}` : "Keine kritischen Termine im aktuellen Fenster",
      focusText: first
        ? `${eventTypeLabel(first)} für ${eventAreaLabel(first)}. Relevanz ${eventRelevanceLabel(first)}; Quelle: ${eventSourceLabel(first)}.`
        : "Der Kalender bleibt sichtbar, auch wenn Live-Provider gerade keine Termine liefern."
    };
  }

  function importantEventsForHub(events) {
    return events
      .filter((eventItem) => eventItem.date >= startOfToday() && eventItem.date < daysFromNow(14))
      .sort(sortEventsForHub);
  }

  function eventHubModeText(events) {
    const statuses = events.map((eventItem) => eventItem.meta?.status);
    const hasLive = statuses.includes("live") || statuses.includes("stale");
    const hasFallback = statuses.includes("fallback");
    if (hasLive && hasFallback) {
      return "Hybrid: Live-Kalender werden genutzt, lokale Termine sichern Dividenden, Makro und Corporate Actions ab.";
    }
    if (hasLive) {
      return "Live-Kalender aktiv. Fallbacks bleiben als Sicherheitsnetz im Datenlayer.";
    }
    return "Fallback aktiv: Der Hub bleibt nutzbar, bis serverseitige Event-Provider liefern.";
  }

  function isWatchlistRelevantEvent(eventItem) {
    return state.watchlist.includes(eventItem.symbol) || dashboardPrefs().favorites.includes(eventItem.symbol);
  }

  function eventRelevance(eventItem) {
    let score = 40;
    if (isWatchlistRelevantEvent(eventItem)) score += 35;
    if (eventItem.type === "Earnings") score += 18;
    if (eventItem.type === "Makro") score += 15;
    if (eventItem.type === "IPO") score += 8;
    if (eventItem.meta?.status === "live") score += 10;
    const days = Math.abs((new Date(eventItem.date) - Date.now()) / (24 * 60 * 60 * 1000));
    score += Math.max(0, 10 - days);
    return Math.round(clamp(score, 0, 100));
  }

  function watchlistNewsForView() {
    const eventItems = eventsForView()
      .filter((eventItem) => state.watchlist.includes(eventItem.symbol))
      .slice(0, 3)
      .map((eventItem) => ({
        symbol: eventItem.symbol,
        kind: eventItem.type,
        text: `${eventItem.title} am ${eventItem.date.toLocaleDateString("de-DE")}`
      }));
    const movers = state.watchlist
      .map((symbol) => ({ symbol, quote: quoteFor(symbol) }))
      .filter((item) => Math.abs(Number(item.quote.changePct || 0)) >= 2)
      .slice(0, 3)
      .map((item) => ({
        symbol: item.symbol,
        kind: "Move",
        text: `Tagesbewegung ${formatPercent(item.quote.changePct)}; prüfen, ob These noch passt.`
      }));
    return [...movers, ...eventItems].slice(0, 5);
  }

  function eventTypeLabel(eventItem) {
    const type = String(eventItem.type || "");
    if (type.toLowerCase().includes("dividend") || type.toLowerCase().includes("dividende")) return "Dividende";
    if (type.toLowerCase().includes("makro")) return "Makro";
    if (type.toLowerCase().includes("ipo")) return "IPO";
    if (type.toLowerCase().includes("split")) return "Split";
    if (type.toLowerCase().includes("earnings")) return "Earnings";
    return type || "Event";
  }

  function eventAreaLabel(eventItem) {
    if (eventItem.symbol === "Macro") return "Makro / Gesamtmarkt";
    const asset = assetMap.get(eventItem.symbol);
    if (asset) {
      return `${eventItem.symbol} · ${asset.name}`;
    }
    return eventItem.symbol || "Markt";
  }

  function eventTimingLabel(eventItem) {
    const date = new Date(eventItem.date);
    const start = startOfToday();
    const day = 24 * 60 * 60 * 1000;
    const tomorrow = new Date(start.getTime() + day);
    const week = new Date(start.getTime() + 7 * day);
    const nextWeek = new Date(start.getTime() + 14 * day);
    if (date < start) return "Vorbei";
    if (date < tomorrow) return "Heute";
    if (date < new Date(start.getTime() + 2 * day)) return "Morgen";
    if (date < week) return "Diese Woche";
    if (date < nextWeek) return "Nächste Woche";
    return "Später";
  }

  function formatEventDate(dateValue) {
    const date = new Date(dateValue);
    return `${date.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })} · Uhrzeit offen`;
  }

  function eventRelevanceLabel(eventItem) {
    const relevance = eventRelevance(eventItem);
    if (relevance >= 80) return "hoch";
    if (relevance >= 60) return "mittel";
    return "Basis";
  }

  function eventRelevanceTone(eventItem) {
    const relevance = eventRelevance(eventItem);
    if (relevance >= 80) return "bull";
    if (relevance >= 60) return "neutral";
    return "";
  }

  function eventSourceLabel(eventItem) {
    const source = eventItem.meta?.source || "Quelle offen";
    if (eventItem.meta?.status === "fallback") {
      return `${source} · Fallback`;
    }
    if (eventItem.meta?.status === "stale") {
      return `${source} · Cache`;
    }
    return source;
  }

  function renderEventFocusRow(eventItem) {
    const symbolButton = assetMap.has(eventItem.symbol) ? `data-symbol="${escAttr(eventItem.symbol)}"` : `data-route="events"`;
    return `
      <button class="event-focus-row" type="button" ${symbolButton}>
        <span class="score-pill ${eventRelevanceTone(eventItem)}">${eventRelevance(eventItem)}</span>
        <span>
          <strong>${esc(eventItem.title)}</strong>
          <small>${esc(eventTimingLabel(eventItem))} · ${esc(eventTypeLabel(eventItem))} · ${esc(eventAreaLabel(eventItem))}</small>
        </span>
        ${isWatchlistRelevantEvent(eventItem) ? `<span class="pill bull">Watchlist</span>` : renderStatusBadge(eventItem.meta?.status)}
      </button>
    `;
  }

  function renderEventCard(eventItem) {
    const relevance = eventRelevance(eventItem);
    const watchlistBadge = isWatchlistRelevantEvent(eventItem) ? `<span class="pill bull">Watchlist</span>` : "";
    return `
      <article class="event-card">
        <div class="event-card-head">
          <span class="pill">${esc(eventTypeLabel(eventItem))}</span>
          ${watchlistBadge}
          ${renderStatusBadge(eventItem.meta?.status)}
        </div>
        <strong>${esc(eventItem.title)}</strong>
        <div class="event-meta-line">
          <span>${esc(eventTimingLabel(eventItem))}</span>
          <span>${formatEventDate(eventItem.date)}</span>
          <span>${esc(eventAreaLabel(eventItem))}</span>
        </div>
        <p>${esc(eventItem.detail || "Kein zusätzlicher Detailtext verfügbar.")}</p>
        <div class="event-card-footer">
          <span>Relevanz: <strong>${relevance}/100</strong> · ${esc(eventRelevanceLabel(eventItem))}</span>
          <span>${esc(eventSourceLabel(eventItem))}</span>
        </div>
        <div class="row-actions event-card-actions">
          ${assetMap.has(eventItem.symbol) ? `<button class="tiny-button" type="button" data-symbol="${escAttr(eventItem.symbol)}">Asset öffnen</button>` : ""}
          <button class="tiny-button" type="button"
            data-alert-event-title="${escAttr(eventItem.title)}"
            data-alert-event-symbol="${escAttr(eventItem.symbol)}"
            data-alert-event-type="${escAttr(eventItem.type)}"
            data-alert-event-date="${escAttr(eventItem.date.toISOString())}"
            data-alert-event-priority="${escAttr(inferEventPriority(eventItem))}">Alert setzen</button>
        </div>
        ${renderDataMeta(eventItem.meta, true)}
      </article>
    `;
  }

  function renderAssetEventsCard(symbol, events) {
    const status = events.some((eventItem) => eventItem.meta.status === "live") ? "live" : events.some((eventItem) => eventItem.meta.status === "stale") ? "stale" : "fallback";
    const nextEvent = events.find((eventItem) => eventItem.date >= startOfToday());
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Asset-Termine</span>
            <h3>${esc(symbol)} Event- und Earnings-Kalender</h3>
            <p>Nächste Earnings, Dividenden, Corporate Actions und relevante Makrotermine für diese Asset-Seite.</p>
            </div>
          ${renderStatusBadge(status)}
        </div>
        ${nextEvent ? `
          <div class="event-next-callout">
            <span class="pill">${esc(eventTimingLabel(nextEvent))}</span>
            <strong>${esc(nextEvent.title)}</strong>
            <p>${esc(nextEvent.detail)}</p>
          </div>
        ` : ""}
        <div class="event-list">
          ${events.map(renderEventCard).join("") || renderEmptyState("Keine Events für dieses Asset im aktuellen Kalender.")}
        </div>
        <div class="row-actions event-card-actions">
          <button class="ghost-button" type="button" data-route="events">Event-Hub öffnen</button>
        </div>
        ${renderDataMeta(events[0] ? events[0].meta : makeMeta("Event-Kalender", "fallback", BOOT_TIME))}
      </article>
    `;
  }

  function renderAlertRow(alert) {
    const hasAsset = assetMap.has(alert.symbol);
    const asset = hasAsset ? getAsset(alert.symbol) : { name: alert.eventTitle || "Markttermin", currency: "USD" };
    const quote = hasAsset ? quoteFor(alert.symbol) : { price: null, changePct: 0 };
    const status = normalizeAlertStatus(alert);
    const snoozed = isAlertSnoozed(alert);
    const statusLabel = alertStatusLabel(alert);
    const statusClass = status === "triggered" ? "bear" : status === "done" || snoozed ? "neutral" : "";
    const displaySymbol = alert.displaySymbol || alert.symbol;
    const watchlistBadge = state.watchlist.includes(alert.symbol) ? `<span class="pill bull">Watchlist</span>` : "";
    const symbolAction = hasAsset ? `data-symbol="${escAttr(alert.symbol)}"` : "disabled";
    return `
      <div class="alert-row alert-row-v2">
        <button class="symbol-button" type="button" ${symbolAction}>
          <strong>${esc(displaySymbol)} - ${esc(asset.name)}</strong>
          <span>${esc(alertLabel(alert))}</span>
          <span class="alert-row-badges">
            <span class="pill">${esc(alertTypeLabel(alert.type))}</span>
            ${watchlistBadge}
          </span>
        </button>
        <span class="right-cell">
          <strong>${hasAsset ? formatMoney(quote.price, asset.currency) : "Termin"}</strong>
          <span class="pill ${statusClass}">${esc(statusLabel)}</span>
        </span>
        <span class="right-cell">
          <strong>${esc(priorityLabel(alert.priority))}</strong>
          <span class="small">Priorität</span>
        </span>
        <span class="right-cell">
          <strong>${alert.lastCheckedAt ? formatTimestamp(alert.lastCheckedAt) : "noch offen"}</strong>
          <span class="small">${snoozed ? `Pausiert bis ${formatTimestamp(alert.snoozedUntil)}` : "Letzter Check"}</span>
        </span>
        <div class="alert-snooze-actions">
          <button class="tiny-button" type="button" data-alert-snooze="${escAttr(alert.id)}" data-alert-snooze-duration="later">später</button>
          <button class="tiny-button" type="button" data-alert-snooze="${escAttr(alert.id)}" data-alert-snooze-duration="tomorrow">morgen</button>
          <button class="tiny-button" type="button" data-alert-snooze="${escAttr(alert.id)}" data-alert-snooze-duration="week">1 Woche</button>
        </div>
        <button class="tiny-button" type="button" data-alert-done="${escAttr(alert.id)}">Erledigt</button>
        <button class="icon-button danger-button" type="button" data-alert-delete="${escAttr(alert.id)}" aria-label="Alert löschen">X</button>
      </div>
    `;
  }

  function insiderDataFor(symbol) {
    return INSIDER_INSTITUTIONAL_DATA[symbol] || {
      insiderScore: 50,
      buySellRatio: 0.6,
      topShareholders: [["Vanguard Group", 7.5], ["BlackRock", 6.1], ["State Street", 3.3]],
      holdings: [["Broad Market ETF", 2.4, "stabil"], ["Institutional Core Fund", 1.8, "+0.2%"]],
      changes: [["Top Fonds", "Stabil", "Fallback"], ["Smart Money Proxy", "Beobachten", "Fallback"]],
      buys: [["Director", "Kauf", "Fallback", "Fallback"]],
      sells: [["Executive", "Verkauf", "Fallback", "Fallback"]]
    };
  }

  function renderDataRow(row) {
    return `
      <div class="data-row">
        <strong>${esc(row[0])}</strong>
        <span>${esc(row[1])}</span>
        <span class="small">${esc(row[2])}${row[3] ? ` | ${esc(row[3])}` : ""}</span>
      </div>
    `;
  }

  function renderMiniBar(label, value) {
    const width = clamp(Number(value || 0), 0, 100);
    return `
      <div class="mini-bar">
        <span>${esc(label)}</span>
        <div><i style="width:${width}%"></i></div>
        <strong>${formatNumber(value)}%</strong>
      </div>
    `;
  }

  function etfOverlap(left, right) {
    const leftMap = new Map(left.holdings.map(([name, weight]) => [name, weight]));
    const overlap = right.holdings
      .filter(([name]) => leftMap.has(name))
      .map(([name, weight]) => [name, Math.min(weight, leftMap.get(name))]);
    const region = regionOverlap(left, right);
    return {
      score: overlap.reduce((sum, [, weight]) => sum + weight, 0),
      names: overlap.map(([name]) => name),
      regionScore: region.score,
      regionNames: region.names
    };
  }

  function regionOverlap(left, right) {
    const leftMap = new Map(left.region.map(([name, weight]) => [name, weight]));
    const overlap = right.region
      .filter(([name]) => leftMap.has(name))
      .map(([name, weight]) => [name, Math.min(weight, leftMap.get(name))]);
    return {
      score: overlap.reduce((sum, [, weight]) => sum + weight, 0),
      names: overlap.map(([name]) => name)
    };
  }

  function etfHoldingConcentration(etf) {
    return etf.holdings.reduce((sum, [, weight]) => sum + Number(weight || 0), 0);
  }

  function distributionExplanation(etf) {
    return etf.distribution === "Thesaurierend"
      ? "Erträge werden automatisch wieder angelegt. Praktisch für langfristigen Vermögensaufbau."
      : "Erträge werden ausgeschüttet. Praktisch für Cashflow, aber Wiederanlage muss selbst passieren.";
  }

  function etfOverlapText(overlap) {
    if (overlap.score >= 20 || overlap.regionScore >= 90) {
      return "Hohe Überschneidung: beide ETFs können ähnliche Länder- und Mega-Cap-Risiken verdoppeln. Prüfen, ob ein ETF davon wirklich zusätzlichen Nutzen bringt.";
    }
    if (overlap.score >= 8 || overlap.regionScore >= 60) {
      return "Mittlere Überschneidung: als Core/Satellit möglich, aber Gewichtung und Zweck sollten klar sein.";
    }
    return "Geringere Überschneidung im lokalen Modell. Trotzdem TER, Währungsrisiko und Anlageziel separat prüfen.";
  }

  function updateEtfState(input) {
    const name = input.name;
    if (!name) {
      return;
    }
    state.etf[name] = input.type === "number" ? Number(input.value) : input.value;
    if (state.route === "etf") {
      render();
    }
  }

  function updateCompareState(input) {
    const name = input.name;
    if (!name) {
      return;
    }
    const symbol = normalizeSymbol(input.value);
    if (!assetMap.has(symbol)) {
      return;
    }
    state.compare[name] = symbol;
    if (["home", "compare"].includes(state.route)) {
      render();
    }
  }

  function openCompareWith(symbol) {
    const normalized = normalizeSymbol(symbol);
    if (!assetMap.has(normalized)) {
      toast("Asset nicht gefunden.");
      return;
    }
    state.compare.left = normalized;
    if (!assetMap.has(state.compare.right) || state.compare.right === normalized) {
      const asset = getAsset(normalized);
      state.compare.right = asset.type === "ETF" ? "QQQ" : "MSFT";
      if (state.compare.right === normalized) {
        state.compare.right = "NVDA";
      }
    }
    navigate("compare");
  }

  function openComparePair(left, right) {
    const leftSymbol = normalizeSymbol(left);
    const rightSymbol = normalizeSymbol(right);
    if (assetMap.has(leftSymbol)) {
      state.compare.left = leftSymbol;
    }
    if (assetMap.has(rightSymbol)) {
      state.compare.right = rightSymbol;
    }
    navigate("compare");
  }

  function swapCompareAssets() {
    const left = state.compare.left;
    state.compare.left = state.compare.right;
    state.compare.right = left;
    render();
  }

  function updateEventHubState(input) {
    const name = input.name;
    if (!name) {
      return;
    }
    state.eventHub[name] = input.value;
    const target = document.getElementById("eventHubResults");
    const count = document.getElementById("eventHubCount");
    if (target) {
      const filtered = filteredEventHubEvents(eventsForView());
      target.innerHTML = renderEventHubResults(filtered);
      if (count) {
        count.textContent = String(filtered.length);
      }
    } else if (state.route === "events") {
      render();
    }
  }

  function updateAlertFilterState(input) {
    const name = input.name;
    if (!name) {
      return;
    }
    state.alertFilters[name] = input.value;
    const target = document.getElementById("alertResults");
    if (target) {
      const filteredAlerts = alertsForView();
      target.innerHTML = filteredAlerts.map(renderAlertRow).join("") || renderEmptyState("Keine Alerts in diesem Filter.");
    } else if (state.route === "alerts") {
      render();
    }
  }

  function activePortfolio() {
    return state.portfolios.find((portfolio) => portfolio.id === state.activePortfolioId) || state.portfolios[0] || DEFAULT_PORTFOLIOS[0];
  }

  function setActivePortfolio(id) {
    state.activePortfolioId = id;
    storageSet(STORAGE_KEYS.activePortfolioId, id);
    render();
  }

  function createPortfolioFromForm(form) {
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    if (!name) {
      toast("Bitte Portfolio-Namen eintragen.");
      return;
    }
    const portfolio = {
      id: `pf-${Date.now()}`,
      name,
      type: String(data.get("type") || "test"),
      cash: Number(data.get("cash") || 0),
      targetCash: Number(data.get("targetCash") || 10),
      notes: String(data.get("notes") || "").trim(),
      positions: []
    };
    state.portfolios = [...state.portfolios, portfolio];
    state.activePortfolioId = portfolio.id;
    savePortfolios();
    form.reset();
    render();
  }

  function addPositionFromForm(form) {
    const data = new FormData(form);
    const symbol = findBestSymbol(data.get("symbol"));
    if (!symbol) {
      toast("Asset nicht gefunden.");
      return;
    }
    const quantity = Number(data.get("quantity") || 0);
    const avgPrice = Number(data.get("avgPrice") || 0);
    if (!quantity || !avgPrice) {
      toast("Bitte Anzahl und Kaufkurs eintragen.");
      return;
    }
    updateActivePortfolio((portfolio) => ({
      ...portfolio,
      positions: [...portfolio.positions, { symbol, quantity, avgPrice, country: countryFor(symbol) }]
    }));
    form.reset();
    render();
  }

  function savePortfolioNotes(form) {
    const notes = String(new FormData(form).get("notes") || "");
    updateActivePortfolio((portfolio) => ({ ...portfolio, notes }));
    toast("Portfolio-Notiz gespeichert.");
    render();
  }

  function updateActivePortfolio(updater) {
    state.portfolios = state.portfolios.map((portfolio) => portfolio.id === activePortfolio().id ? updater(portfolio) : portfolio);
    savePortfolios();
  }

  function deletePortfolioById(id) {
    if (state.portfolios.length <= 1) {
      toast("Mindestens ein Portfolio bleibt erhalten.");
      return;
    }
    state.portfolios = state.portfolios.filter((portfolio) => portfolio.id !== id);
    state.activePortfolioId = state.portfolios[0].id;
    savePortfolios();
    render();
  }

  function savePortfolios() {
    storageSet(STORAGE_KEYS.portfolios, state.portfolios);
    storageSet(STORAGE_KEYS.activePortfolioId, state.activePortfolioId);
  }

  function portfolioAnalysis(portfolio) {
    const positions = portfolio.positions || [];
    const cashValue = Number(portfolio.cash || 0);
    const positionRows = positions.map(portfolioPositionAnalysis);
    const invested = positionRows.reduce((sum, row) => sum + row.invested, 0);
    const current = positionRows.reduce((sum, row) => sum + row.value, 0);
    const totalValue = current + cashValue;
    const performanceAbs = current - invested;
    const performancePct = invested ? performanceAbs / invested * 100 : 0;
    const cashPct = totalValue ? cashValue / totalValue * 100 : 0;
    const targetCash = Number(portfolio.targetCash ?? 10);
    const rowsWithWeights = positionRows.map((row) => ({
      ...row,
      weight: totalValue ? row.value / totalValue * 100 : 0,
      contributionPct: totalValue ? row.performanceAbs / totalValue * 100 : 0
    })).sort((a, b) => b.weight - a.weight);
    const sectorExposure = exposureByRows(rowsWithWeights, totalValue, (row) => row.asset.sector);
    const countryExposure = exposureByRows(rowsWithWeights, totalValue, (row) => row.country);
    const currencyExposure = exposureByRows(rowsWithWeights, totalValue, (row) => row.asset.currency, [{ label: "USD Cash", value: cashValue }]);
    const assetTypeExposure = exposureByRows(rowsWithWeights, totalValue, (row) => assetTypeLabel(row.asset), [{ label: "Cash", value: cashValue }]);
    const maxSector = maxExposure(sectorExposure);
    const maxCountry = maxExposure(countryExposure);
    const maxCurrency = maxExposure(currencyExposure);
    const maxPosition = rowsWithWeights[0] || null;
    const style = portfolioStyleSnapshot(rowsWithWeights, totalValue, assetTypeExposure, countryExposure);
    const riskScore = portfolioRiskScore({
      maxPosition,
      maxSector,
      maxCountry,
      maxCurrency,
      cashPct,
      targetCash,
      positionCount: rowsWithWeights.length,
      etfPct: style.etfPct
    });
    const riskLevel = portfolioRiskLevel(riskScore);
    const performance = portfolioPerformanceSnapshot(rowsWithWeights, totalValue, performanceAbs, performancePct);
    const riskItems = portfolioRiskItems({ rows: rowsWithWeights, maxPosition, maxSector, maxCountry, maxCurrency, cashPct, targetCash });
    const rebalancingHints = portfolioRebalancingHints({ rows: rowsWithWeights, maxPosition, maxSector, maxCountry, maxCurrency, cashPct, targetCash, style });
    const focusItems = portfolioFocusItems({ rows: rowsWithWeights, riskItems, rebalancingHints });
    const dataStatus = portfolioDataStatus(rowsWithWeights);
    const health = portfolioHealthSnapshot({ riskScore, riskLevel, cashPct, style, rows: rowsWithWeights, maxSector, maxPosition });
    const meta = makeMeta("Portfolio: lokale Positionen + Kurs-/Eventdaten", dataStatus, Date.now(), "Portfolio-Werte sind lokal gespeichert; Kurse, Events und Research-Inputs können live, hybrid oder fallback sein.");
    return {
      totalValue,
      current,
      invested,
      cashValue,
      performanceAbs,
      performancePct,
      cashPct,
      targetCash,
      positions: rowsWithWeights,
      sectorExposure,
      countryExposure,
      currencyExposure,
      assetTypeExposure,
      maxSector,
      maxCountry,
      maxCurrency,
      topPosition: maxPosition,
      style,
      performance,
      riskScore,
      riskLevel,
      riskItems,
      rebalancingHints,
      focusItems,
      health,
      dataStatus,
      meta,
      concentrationHint: maxSector.value > 45 ? `Klumpenrisiko: ${maxSector.label} liegt bei ${formatNumber(maxSector.value)}%.` : "Kein extremes Sektor-Klumpenrisiko im lokalen Modell.",
      diversificationHint: rowsWithWeights.length < 4 ? "Diversifikation ist noch gering; weitere Bausteine prüfen." : "Diversifikation wirkt für ein lokales Modell solide.",
      rebalanceHint: rebalancingHints[0]?.text || "Cash, Sektor- und Positionsgewichte liegen nahe der lokalen Zielzone.",
      priorityHint: focusItems[0]?.text || "Portfolio wirkt im lokalen Modell kontrolliert; regelmäßig gegen Zielallokation prüfen."
    };
  }

  function portfolioPositionAnalysis(position) {
    const asset = getAsset(position.symbol);
    const quote = quoteFor(position.symbol);
    const analysis = analysisFor(position.symbol);
    const etf = etfDataForSymbol(position.symbol);
    const quantity = Number(position.quantity || 0);
    const avgPrice = Number(position.avgPrice || 0);
    const value = quantity * Number(quote.price || 0);
    const invested = quantity * avgPrice;
    const performanceAbs = value - invested;
    const performancePct = avgPrice ? ((Number(quote.price || 0) / avgPrice) - 1) * 100 : 0;
    const previousValue = value / (1 + Number(quote.changePct || 0) / 100);
    const dailyAbs = Number.isFinite(previousValue) ? value - previousValue : 0;
    const nextEvent = eventsForSymbol(position.symbol).find((eventItem) => eventItem.date >= startOfToday());
    const alerts = state.alerts.map(normalizeAlertRecord).filter((alert) => alert.symbol === position.symbol && normalizeAlertStatus(alert) !== "done");
    const dataStatus = bestDataStatus([quote.meta?.status, analysis.meta?.status, nextEvent?.meta?.status]);
    return {
      ...position,
      asset,
      quote,
      analysis,
      etf,
      country: position.country || countryFor(position.symbol),
      value,
      invested,
      performanceAbs,
      performancePct,
      dailyAbs,
      dailyPct: Number(quote.changePct || 0),
      monthlyPct: Number(analysis.performance1m || 0),
      yearlyPct: clamp(Number(analysis.performance6m || 0) * 2, -85, 180),
      nextEvent,
      alerts,
      dataStatus,
      role: portfolioPositionRole(asset, etf, analysis),
      riskHint: portfolioPositionRiskHint(asset, etf, analysis, nextEvent)
    };
  }

  function exposureBy(positions, totalValue, resolver) {
    const map = {};
    positions.forEach((position) => {
      const label = resolver(position);
      const value = position.quantity * quoteFor(position.symbol).price;
      map[label] = (map[label] || 0) + value;
    });
    return Object.entries(map).map(([label, value]) => ({ label, value: totalValue ? value / totalValue * 100 : 0 }));
  }

  function exposureByRows(rows, totalValue, resolver, extras = []) {
    const map = {};
    rows.forEach((row) => {
      const label = resolver(row) || "Sonstiges";
      map[label] = (map[label] || 0) + row.value;
    });
    extras.forEach((item) => {
      if (item.value) {
        map[item.label] = (map[item.label] || 0) + Number(item.value || 0);
      }
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value: totalValue ? value / totalValue * 100 : 0, amount: value }))
      .sort((a, b) => b.value - a.value);
  }

  function maxExposure(items) {
    return items.reduce((max, item) => item.value > max.value ? item : max, { label: "n/a", value: 0 });
  }

  function portfolioStyleSnapshot(rows, totalValue, assetTypeExposure, countryExposure) {
    const techSectors = ["Technology", "Software", "Semiconductors", "Nasdaq 100", "Communication Services"];
    const techValue = rows
      .filter((row) => techSectors.includes(row.asset.sector))
      .reduce((sum, row) => sum + row.value, 0);
    const usValue = rows
      .filter((row) => row.country === "USA" || row.asset.sector === "US Large Caps" || row.asset.sector === "Nasdaq 100")
      .reduce((sum, row) => sum + row.value, 0);
    const etfValue = rows.filter((row) => row.asset.type === "ETF" || row.asset.type === "Index").reduce((sum, row) => sum + row.value, 0);
    const stockValue = rows.filter((row) => row.asset.type === "Stock").reduce((sum, row) => sum + row.value, 0);
    const growthScore = rows.reduce((sum, row) => sum + row.value * Number(row.analysis.growth || 0), 0) / Math.max(rows.reduce((sum, row) => sum + row.value, 0), 1);
    const defensiveValue = rows
      .filter((row) => ["Healthcare", "Consumer Staples", "Utilities", "Precious Metals"].includes(row.asset.sector) || row.asset.type === "Commodity")
      .reduce((sum, row) => sum + row.value, 0);
    return {
      techPct: totalValue ? techValue / totalValue * 100 : 0,
      usPct: totalValue ? usValue / totalValue * 100 : 0,
      etfPct: totalValue ? etfValue / totalValue * 100 : 0,
      stockPct: totalValue ? stockValue / totalValue * 100 : 0,
      defensivePct: totalValue ? defensiveValue / totalValue * 100 : 0,
      growthScore,
      growthLabel: growthScore >= 66 ? "wachstumsnah" : growthScore <= 45 ? "defensiver" : "gemischt",
      assetTypeExposure,
      countryExposure
    };
  }

  function portfolioRiskScore(context) {
    const maxPositionWeight = Number(context.maxPosition?.weight || 0);
    const maxSectorWeight = Number(context.maxSector.value || 0);
    const maxCountryWeight = Number(context.maxCountry.value || 0);
    const maxCurrencyWeight = Number(context.maxCurrency.value || 0);
    const cashGap = Math.max(0, Number(context.targetCash || 0) - Number(context.cashPct || 0));
    const diversificationPenalty = context.positionCount < 4 ? 13 : context.positionCount < 7 ? 6 : 0;
    const etfPenalty = context.etfPct < 15 && context.positionCount > 2 ? 6 : 0;
    return Math.round(clamp(
      maxPositionWeight * 0.45 +
      maxSectorWeight * 0.32 +
      maxCountryWeight * 0.14 +
      maxCurrencyWeight * 0.10 +
      cashGap * 1.1 +
      diversificationPenalty +
      etfPenalty,
      0,
      100
    ));
  }

  function portfolioRiskLevel(score) {
    if (score >= 75) {
      return { label: "hoch", tone: "bear" };
    }
    if (score >= 56) {
      return { label: "erhöht", tone: "bear" };
    }
    if (score >= 36) {
      return { label: "mittel", tone: "neutral" };
    }
    return { label: "kontrolliert", tone: "bull" };
  }

  function portfolioPerformanceSnapshot(rows, totalValue, totalAbs, totalPct) {
    const dailyAbs = rows.reduce((sum, row) => sum + row.dailyAbs, 0);
    const monthAbs = rows.reduce((sum, row) => sum + row.value * Number(row.monthlyPct || 0) / 100, 0);
    const weekAbs = monthAbs / 4.3;
    const yearAbs = rows.reduce((sum, row) => sum + row.value * Number(row.yearlyPct || 0) / 100, 0);
    const sortedByAbs = [...rows].sort((a, b) => b.performanceAbs - a.performanceAbs);
    return {
      daily: { abs: dailyAbs, pct: totalValue ? dailyAbs / totalValue * 100 : 0 },
      week: { abs: weekAbs, pct: totalValue ? weekAbs / totalValue * 100 : 0 },
      month: { abs: monthAbs, pct: totalValue ? monthAbs / totalValue * 100 : 0 },
      year: { abs: yearAbs, pct: totalValue ? yearAbs / totalValue * 100 : 0 },
      total: { abs: totalAbs, pct: totalPct },
      winners: sortedByAbs.filter((row) => row.performanceAbs > 0).slice(0, 3),
      losers: [...rows].sort((a, b) => a.performanceAbs - b.performanceAbs).filter((row) => row.performanceAbs < 0).slice(0, 3),
      contribution: [...rows].sort((a, b) => Math.abs(b.contributionPct) - Math.abs(a.contributionPct)).slice(0, 5)
    };
  }

  function portfolioRiskItems(context) {
    const items = [];
    if (context.maxPosition) {
      items.push({
        label: "Top-Position",
        tone: context.maxPosition.weight >= 25 ? "bear" : context.maxPosition.weight >= 16 ? "neutral" : "bull",
        text: `${context.maxPosition.symbol} macht ${formatNumber(context.maxPosition.weight)}% des Portfolios aus. ${context.maxPosition.weight >= 25 ? "Das ist ein klares Einzeltitel-Klumpenrisiko." : "Gewichtung wirkt im lokalen Modell beobachtbar."}`
      });
    }
    items.push({
      label: "Sektor",
      tone: context.maxSector.value >= 45 ? "bear" : context.maxSector.value >= 32 ? "neutral" : "bull",
      text: `${context.maxSector.label} liegt bei ${formatNumber(context.maxSector.value)}%.`
    });
    items.push({
      label: "Land / Region",
      tone: context.maxCountry.value >= 72 ? "bear" : context.maxCountry.value >= 58 ? "neutral" : "bull",
      text: `${context.maxCountry.label} liegt bei ${formatNumber(context.maxCountry.value)}%.`
    });
    items.push({
      label: "Cash",
      tone: context.cashPct < Math.max(0, context.targetCash - 5) ? "bear" : "neutral",
      text: `Cash liegt bei ${formatNumber(context.cashPct)}%, Zielzone ungefähr ${formatNumber(context.targetCash)}%.`
    });
    return items;
  }

  function portfolioRebalancingHints(context) {
    const hints = [];
    if (context.maxPosition && context.maxPosition.weight >= 25) {
      hints.push({ label: "prüfen", tone: "bear", text: `${context.maxPosition.symbol} dominiert das Portfolio. Teilrebalancing oder Absicherung prüfen.` });
    }
    if (context.maxSector.value >= 45) {
      hints.push({ label: "Sektor", tone: "bear", text: `${context.maxSector.label}-Anteil wirkt hoch. Gegenpol über andere Sektoren oder breitere ETFs prüfen.` });
    }
    if (context.maxCountry.value >= 70) {
      hints.push({ label: "Region", tone: "neutral", text: `${context.maxCountry.label} ist sehr dominant. Europa, Welt-ETF oder andere Regionen als Diversifikation prüfen.` });
    }
    if (context.maxCurrency.value >= 75) {
      hints.push({ label: "Währung", tone: "neutral", text: `${context.maxCurrency.label} ist stark vertreten. Währungsrisiko bewusst akzeptieren oder diversifizieren.` });
    }
    if (context.cashPct > context.targetCash + 8) {
      hints.push({ label: "Cash", tone: "neutral", text: "Cash liegt über Zielniveau. Reinvestition, Sparplan oder bewusste Reserve prüfen." });
    } else if (context.cashPct < Math.max(0, context.targetCash - 5)) {
      hints.push({ label: "Cash", tone: "bear", text: "Cash-Puffer liegt unter Zielzone. Liquiditätsreserve oder Positionsgröße prüfen." });
    }
    if (context.style.etfPct < 15 && context.style.stockPct > 60) {
      hints.push({ label: "ETF", tone: "neutral", text: "Portfolio ist einzelwertlastig. Ein breiter ETF könnte Konzentrationsrisiko senken." });
    }
    if (context.rows.length < 4) {
      hints.push({ label: "Diversifikation", tone: "bear", text: "Wenige Positionen: Ein einzelnes Event kann das Portfolio stark bewegen." });
    }
    return hints.length ? hints.slice(0, 6) : [{ label: "Balance", tone: "bull", text: "Keine harte Übergewichtung im lokalen Modell. Regelmäßig gegen Zielallokation prüfen." }];
  }

  function portfolioFocusItems(context) {
    const items = [];
    context.rebalancingHints.slice(0, 2).forEach((hint) => {
      items.push({ label: hint.label, title: "Rebalancing prüfen", text: hint.text, tone: hint.tone, route: "portfolio" });
    });
    context.rows
      .filter((row) => Math.abs(row.dailyPct) >= 2)
      .slice(0, 2)
      .forEach((row) => {
        items.push({ label: "Move", title: `${row.symbol} bewegt sich heute ${formatPercent(row.dailyPct)}`, text: `${row.role}; Beitrag heute ungefähr ${formatMoney(row.dailyAbs, row.asset.currency)}.`, tone: row.dailyPct >= 0 ? "bull" : "bear", symbol: row.symbol });
      });
    context.rows
      .filter((row) => row.nextEvent && row.nextEvent.date <= daysFromNow(14))
      .slice(0, 2)
      .forEach((row) => {
        items.push({ label: eventTypeLabel(row.nextEvent), title: `${row.symbol}: ${row.nextEvent.title}`, text: `${eventTimingLabel(row.nextEvent)} · ${eventSourceLabel(row.nextEvent)}`, tone: "neutral", symbol: row.symbol });
      });
    context.rows
      .flatMap((row) => row.alerts.map((alert) => ({ row, alert })))
      .filter((item) => normalizeAlertStatus(item.alert) === "triggered" || item.alert.priority === "high")
      .slice(0, 2)
      .forEach((item) => {
        items.push({ label: "Alert", title: `${item.row.symbol}: ${alertTypeLabel(item.alert.type)}`, text: alertLabel(item.alert), tone: item.alert.priority === "high" ? "bear" : "neutral", symbol: item.row.symbol });
      });
    return items.slice(0, 5);
  }

  function portfolioDataStatus(rows) {
    const statuses = rows.map((row) => row.dataStatus);
    if (statuses.includes("live")) return "hybrid";
    if (statuses.includes("stale")) return "stale";
    if (statuses.includes("fallback")) return "local";
    return "local";
  }

  function portfolioHealthSnapshot(context) {
    let label = "Ausgewogen";
    if (context.riskScore >= 75) {
      label = "Stark konzentriert";
    } else if (context.riskScore >= 56) {
      label = "Leicht konzentriert";
    } else if (context.style.etfPct >= 50) {
      label = "ETF-basiert";
    } else if (context.style.techPct >= 45) {
      label = "wachstums-/tech-lastig";
    } else if (context.cashPct < 3) {
      label = "casharm";
    } else if (context.style.defensivePct >= 35) {
      label = "defensiver";
    }
    const summary = `${label}: größtes Gewicht ${context.maxPosition ? `${context.maxPosition.symbol} ${formatNumber(context.maxPosition.weight)}%` : "n/a"}, stärkster Sektor ${context.maxSector.label} ${formatNumber(context.maxSector.value)}%, Cash ${formatNumber(context.cashPct)}%.`;
    return { label, summary };
  }

  function portfolioPositionRole(asset, etf, analysis) {
    if (etf) {
      return etf.region[0]?.[1] >= 90 ? "ETF-Satellit / konzentriert" : "ETF-Kernbaustein";
    }
    if (asset.type === "Commodity") return "Hedge / Rohstoff";
    if (asset.type === "Crypto") return "Krypto-Beta";
    if (asset.type === "Index") return "Index-Baustein";
    if (analysis.growth >= 66) return "Growth-Einzeltitel";
    if (analysis.value >= 65) return "Value-Einzeltitel";
    if (analysis.volatility <= 42) return "defensiver Einzeltitel";
    return "Einzeltitel";
  }

  function portfolioPositionRiskHint(asset, etf, analysis, nextEvent) {
    if (etf) {
      const concentration = etfHoldingConcentration(etf);
      return {
        label: concentration >= 25 ? "ETF konzentriert" : "ETF diversifiziert",
        text: `${etf.distribution}, TER ${formatNumber(etf.ter)}%, Top-Holdings ${formatNumber(concentration)}%.`
      };
    }
    if (nextEvent && nextEvent.date <= daysFromNow(14)) {
      return { label: "Event-Risiko", text: `${eventTimingLabel(nextEvent)}: ${nextEvent.title}.` };
    }
    if (analysis.volatility >= 70) {
      return { label: "volatil", text: "Hohe Schwankung im lokalen Modell; Positionsgröße prüfen." };
    }
    if (asset.type === "Crypto") {
      return { label: "hohes Beta", text: "Krypto reagiert stark auf Liquidität und Risikoappetit." };
    }
    return { label: "normal", text: "Kein einzelner Risikotreiber dominiert diese Position." };
  }

  function portfolioScenarioAnalysis(portfolio, baseAnalysis) {
    const symbol = findBestSymbol(state.portfolioScenario.symbol || "SPY");
    const quantity = Number(state.portfolioScenario.quantity || 0);
    const avgPrice = symbol ? Number(state.portfolioScenario.avgPrice || quoteFor(symbol).price || 0) : 0;
    const cashChange = Number(state.portfolioScenario.cashChange || 0);
    const shock = Number(state.portfolioScenario.shock || 0);
    const contribution = Number(state.portfolioScenario.contribution || 0);
    const addedCost = symbol && quantity > 0 ? quantity * avgPrice : 0;
    const scenarioPositions = symbol && quantity > 0
      ? [...(portfolio.positions || []), { symbol, quantity, avgPrice, country: countryFor(symbol) }]
      : [...(portfolio.positions || [])];
    const projectedPortfolio = {
      ...portfolio,
      cash: Number(portfolio.cash || 0) + cashChange - addedCost,
      positions: scenarioPositions
    };
    const projected = portfolioAnalysis(projectedPortfolio);
    const projectedValue = projected.totalValue;
    const shockedValue = projectedValue * (1 + shock / 100);
    const oneYearValue = shockedValue + contribution * 12;
    const riskDelta = projected.riskScore - baseAnalysis.riskScore;
    const summaryParts = [];
    if (symbol && quantity > 0) {
      summaryParts.push(`${symbol} würde mit ${formatMoney(addedCost, "USD")} hinzukommen.`);
    }
    if (cashChange) {
      summaryParts.push(`Cash ändert sich um ${formatMoney(cashChange, "USD")}.`);
    }
    summaryParts.push(`Risiko ${riskDelta >= 0 ? "steigt" : "sinkt"} um ${formatNumber(Math.abs(riskDelta))} Punkte.`);
    if (shock) {
      summaryParts.push(`Marktschock ${formatPercent(shock)} wäre im Szenario sichtbar.`);
    }
    return {
      projected,
      projectedValue,
      shockedValue,
      oneYearValue,
      riskDelta,
      assetTypeExposure: projected.assetTypeExposure,
      summary: summaryParts.join(" ")
    };
  }

  function renderPortfolioPosition(position, analysis) {
    const eventText = position.nextEvent ? `${eventTimingLabel(position.nextEvent)} · ${position.nextEvent.title}` : "Kein naher Termin";
    const alertText = position.alerts.length ? `${position.alerts.length} aktive/r Alert` : "kein Alert";
    return `
      <div class="portfolio-position-row">
        <button class="symbol-button" type="button" data-symbol="${escAttr(position.symbol)}">
          <strong>${esc(position.symbol)}</strong>
          <span>${esc(position.asset.name)} · ${esc(position.role)}</span>
        </button>
        <div>
          <strong>${formatMoney(position.value, position.asset.currency)}</strong>
          <span class="small">${formatNumber(position.weight)}% vom Portfolio</span>
        </div>
        <div>
          <strong class="${toneClass(position.performancePct)}">${formatPercent(position.performancePct)}</strong>
          <span class="small">${formatMoney(position.performanceAbs, position.asset.currency)} · Beitrag ${formatPercent(position.contributionPct)}</span>
        </div>
        <div>
          <strong>${esc(position.riskHint.label)}</strong>
          <span class="small">${esc(position.riskHint.text)}</span>
        </div>
        <div>
          <strong>${esc(eventText)}</strong>
          <span class="small">${esc(alertText)} · ${statusLabel(position.dataStatus)}</span>
        </div>
        <div class="row-actions portfolio-position-actions">
          <button class="tiny-button" type="button" data-symbol="${escAttr(position.symbol)}">Research</button>
          <button class="tiny-button" type="button" data-compare-open="${escAttr(position.symbol)}">Compare</button>
          <button class="tiny-button" type="button" data-alert-quick="${escAttr(position.symbol)}" data-alert-quick-type="price">Alert</button>
        </div>
      </div>
    `;
  }

  function renderExposureBlock(title, exposure) {
    return `
      <div class="exposure-block">
        <span class="card-label">${esc(title)}</span>
        ${exposure.map((item) => renderMiniBar(item.label, item.value)).join("") || renderEmptyState("Noch keine Exposure-Daten.")}
      </div>
    `;
  }

  function updatePortfolioScenario(input) {
    if (input.name === "symbol") {
      state.portfolioScenario[input.name] = String(input.value || "").trim().toUpperCase();
    } else {
      state.portfolioScenario[input.name] = Number(input.value || 0);
    }
    if (state.route === "portfolio") {
      render();
    }
  }

  function renderScenarioResult(analysis, scenario = portfolioScenarioAnalysis(activePortfolio(), analysis)) {
    return `
      <div class="portfolio-scenario-result">
        <div class="metric-grid">
          ${renderMiniMetric("Szenario-Wert", formatMoney(scenario.projectedValue, "USD"))}
          ${renderMiniMetric("Nach Schock", formatMoney(scenario.shockedValue, "USD"))}
          ${renderMiniMetric("12M mit Beitrag", formatMoney(scenario.oneYearValue, "USD"))}
          ${renderMiniMetric("Risiko-Veränderung", `${scenario.riskDelta >= 0 ? "+" : ""}${formatNumber(scenario.riskDelta)} Punkte`)}
        </div>
        <div class="grid two">
          <div>
            <span class="card-label">Szenario-Auswirkung</span>
            <p>${esc(scenario.summary)}</p>
          </div>
          <div>
            <span class="card-label">Exposure nach Änderung</span>
            ${renderExposureBlock("Asset-Typ", scenario.assetTypeExposure)}
          </div>
        </div>
      </div>
      ${renderDataMeta(makeMeta("Lokale Was-wäre-wenn Simulation", "local", Date.now(), "Szenario ist eine einfache lokale Heuristik ohne Orderlogik."))}
    `;
  }

  function countryFor(symbol) {
    if (["DAX", "SAP"].includes(symbol)) {
      return "Deutschland";
    }
    if (["ASML"].includes(symbol)) {
      return "Niederlande";
    }
    if (["NOVO"].includes(symbol)) {
      return "Dänemark";
    }
    if (["AIR.PA"].includes(symbol)) {
      return "Frankreich";
    }
    if (["BTC", "ETH", "GOLD"].includes(symbol)) {
      return "Global";
    }
    return "USA";
  }

  function dashboardPrefs() {
    const mode = state.dashboardPrefs.mode || "standard";
    return {
      mode,
      favorites: state.dashboardPrefs.favorites || [],
      modules: state.dashboardPrefs.modules || DASHBOARD_MODES[mode] || DASHBOARD_MODES.standard
    };
  }

  function setDashboardMode(mode) {
    if (!DASHBOARD_MODES[mode]) {
      return;
    }
    state.dashboardPrefs = {
      ...state.dashboardPrefs,
      mode,
      modules: DASHBOARD_MODES[mode]
    };
    storageSet(STORAGE_KEYS.dashboardPrefs, state.dashboardPrefs);
    toast(`Dashboard Modus: ${capitalize(mode)}`);
    render();
  }

  function isFavoriteSymbol(symbol) {
    return dashboardPrefs().favorites.includes(symbol);
  }

  function toggleFavoriteSymbol(symbol) {
    const normalized = normalizeSymbol(symbol);
    const prefs = dashboardPrefs();
    const favorites = prefs.favorites.includes(normalized)
      ? prefs.favorites.filter((item) => item !== normalized)
      : [...prefs.favorites, normalized].slice(0, 8);
    state.dashboardPrefs = { ...state.dashboardPrefs, favorites };
    storageSet(STORAGE_KEYS.dashboardPrefs, state.dashboardPrefs);
    toast(prefs.favorites.includes(normalized) ? `${normalized} aus Favoriten entfernt.` : `${normalized} als Favorit gespeichert.`);
    render();
  }

  function journalEntriesFor(symbol) {
    return state.journal
      .filter((entry) => entry.symbol === normalizeSymbol(symbol))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 6);
  }

  function journalQualityHint(entry) {
    if (!entry) {
      return {
        label: "These offen",
        text: "Ein guter Eintrag nennt These, Trigger und Regel-Check. So wird aus Bauchgefühl später überprüfbares Lernen."
      };
    }
    if (entry.emotion === "fomo" || entry.emotion === "stress" || entry.ruleCheck === "risk") {
      return {
        label: "Noch einmal prüfen",
        text: "Der letzte Eintrag enthält Stress, FOMO oder erhöhtes Risiko. Vor einer Entscheidung Setup und Positionsgröße kontrollieren."
      };
    }
    if (entry.ruleCheck === "wait") {
      return {
        label: "Abwarten",
        text: "Der letzte Regel-Check spricht für Geduld. Erst handeln, wenn der definierte Trigger wirklich eintritt."
      };
    }
    return {
      label: "Plan wirkt sauber",
      text: "These und Regel-Check sind nachvollziehbar dokumentiert. Später lässt sich prüfen, ob der Plan funktioniert hat."
    };
  }

  function saveJournalEntryFromForm(form) {
    const data = new FormData(form);
    const symbol = normalizeSymbol(data.get("symbol"));
    const thesis = String(data.get("thesis") || "").trim();
    const trigger = String(data.get("trigger") || "").trim();
    if (!assetMap.has(symbol) || !thesis) {
      toast("Bitte mindestens eine These eintragen.");
      return;
    }
    const entry = {
      id: `journal-${Date.now()}`,
      symbol,
      thesis,
      trigger: trigger || "Kein Trigger definiert.",
      emotion: String(data.get("emotion") || "rational"),
      ruleCheck: String(data.get("ruleCheck") || "ok"),
      timestamp: Date.now()
    };
    state.journal = [entry, ...state.journal].slice(0, 120);
    storageSet(STORAGE_KEYS.journal, state.journal);
    form.reset();
    toast("Journal-Eintrag gespeichert.");
    render();
  }

  function openReport(type, symbol = "") {
    closeReport();
    const html = buildReportHtml(type, symbol);
    document.body.classList.add("report-open");
    document.body.insertAdjacentHTML("beforeend", html);
  }

  function closeReport() {
    const existing = document.getElementById("reportOverlay");
    if (existing) {
      existing.remove();
    }
    document.body.classList.remove("report-open");
  }

  function buildReportHtml(type, symbol) {
    const title = type === "portfolio" ? "Portfolio Report" : type === "topPicks" ? "Top Picks Research Report" : `${normalizeSymbol(symbol || state.activeSymbol)} Equity Report`;
    const body = type === "portfolio" ? portfolioReportBody() : type === "topPicks" ? topPicksReportBody() : assetReportBody(normalizeSymbol(symbol || state.activeSymbol));
    return `
      <div class="report-overlay" id="reportOverlay">
        <div class="report-actions no-print">
          <button class="ghost-button" type="button" data-close-report>Schließen</button>
          <button class="primary-button" type="button" data-print-report>Als PDF speichern / Drucken</button>
        </div>
        <article class="report-page">
          <header class="report-header">
            <span>MH Analytics Research</span>
            <h1>${esc(title)}</h1>
            <p>${new Date().toLocaleDateString("de-DE")} | Statische Report-Ansicht für Browser-PDF</p>
          </header>
          ${body}
          <footer class="report-footer">
            <strong>Quellen / Status</strong>
            <p>API-Daten, lokale Fallback-Daten und Provider-Zustände sind jeweils in der App gekennzeichnet. Keine Anlageberatung.</p>
          </footer>
        </article>
      </div>
    `;
  }

  function assetReportBody(symbol) {
    const asset = getAsset(symbol);
    const quote = quoteFor(symbol);
    const fundamentals = fundamentalsFor(symbol);
    const technical = technicalFor(symbol, quote);
    const fundamental = fundamentalInterpretation(asset, fundamentals);
    const events = eventsForSymbol(symbol);
    const liquidity = liquidityNarrativeForView();
    return `
      <section class="report-section">
        <h2>${esc(asset.symbol)} - ${esc(asset.name)}</h2>
        <div class="report-grid">
          ${renderMiniMetric("Preis", formatMoney(quote.price, asset.currency))}
          ${renderMiniMetric("Tagesveränderung", formatPercent(quote.changePct))}
          ${renderMiniMetric("Rating", technical.rating)}
          ${renderMiniMetric("KGV", formatNumber(valueOr(fundamentals.pe, asset.fallback.pe), "x"))}
          ${renderMiniMetric("Liquidität", `${formatNumber(liquidity.score)} / 100`)}
        </div>
        <h3>These</h3>
        <p>${esc(asset.thesis)}</p>
        <h3>Chancen</h3>
        <p>${esc(technical.reason)} Fundamental wirkt aktuell: ${esc(fundamental.label)}.</p>
        <h3>Risiken</h3>
        <p>${esc(asset.risks)}</p>
        <h3>Marktumfeld</h3>
        <p>${esc(liquidity.summary)}</p>
        <h3>Trigger</h3>
        <p>${esc(events[0] ? `${events[0].title} am ${events[0].date.toLocaleDateString("de-DE")}` : "Kein konkreter Event im lokalen Kalender.")}</p>
        ${renderDataMeta(quote.meta)}
      </section>
    `;
  }

  function portfolioReportBody() {
    const portfolio = activePortfolio();
    const analysis = portfolioAnalysis(portfolio);
    return `
      <section class="report-section">
        <h2>${esc(portfolio.name)}</h2>
        <div class="report-grid">
          ${renderMiniMetric("Gesamtwert", formatMoney(analysis.totalValue, "USD"))}
          ${renderMiniMetric("Performance", formatPercent(analysis.performancePct))}
          ${renderMiniMetric("Cash", `${formatNumber(analysis.cashPct)}%`)}
          ${renderMiniMetric("Positionen", String(portfolio.positions.length))}
          ${renderMiniMetric("Risiko-Score", `${formatNumber(analysis.riskScore)} / 100`)}
        </div>
        <h3>Klarblick</h3>
        <p>${esc(analysis.priorityHint)}</p>
        <h3>Risiko & Rebalancing</h3>
        <p>${esc(analysis.concentrationHint)} ${esc(analysis.diversificationHint)} ${esc(analysis.rebalanceHint)}</p>
        ${renderDataMeta(makeMeta("Lokaler Portfolio Report", "live", Date.now()))}
      </section>
    `;
  }

  function topPicksReportBody() {
    const picks = topPicksForView();
    return `
      <section class="report-section">
        <h2>Methodik</h2>
        <p>Die Picks kombinieren Technical Rating, Momentum, Value/Growth, Risiko, Sentiment und verfügbare Live-/Fallback-Daten. Das ist ein Research-Werkzeug, keine Anlageberatung.</p>
        <h2>Long Picks</h2>
        ${picks.long.map((pick) => `<p><strong>${esc(pick.symbol)} ${pick.score}%</strong> - ${esc(pick.reason)}</p>`).join("")}
        <h2>Risk Picks</h2>
        ${picks.risk.map((pick) => `<p><strong>${esc(pick.symbol)} ${pick.score}%</strong> - ${esc(pick.reason)}</p>`).join("")}
        ${renderDataMeta(makeMeta("Lokale Top Picks Engine", "fallback", Date.now()))}
      </section>
    `;
  }

  function capitalize(value) {
    return String(value || "").slice(0, 1).toUpperCase() + String(value || "").slice(1);
  }

  function updateScreenerState(input) {
    const name = input.name;
    if (!name) {
      return;
    }
    state.screener[name] = input.value;
    const target = document.getElementById("screenerResults");
    if (target) {
      target.innerHTML = renderScreenerResults();
    }
  }

  function screenerSectorOptions() {
    const sectors = [...new Set(ASSETS.map((asset) => asset.sector))];
    return [["all", "Alle"], ...sectors.map((sector) => [sector, sector])];
  }

  function passesNumberFilter(value, filter) {
    if (!filter || filter === "all") {
      return true;
    }
    return Number(value || 0) >= Number(filter);
  }

  function passesMarketCapFilter(row, filter) {
    if (!filter || filter === "all") {
      return true;
    }
    if (filter === "nonEquity") {
      return row.type !== "Stock";
    }
    const marketCap = Number(row.marketCap || 0);
    if (filter === "mega") {
      return marketCap >= 1000000000000;
    }
    if (filter === "large") {
      return marketCap >= 10000000000 && marketCap < 1000000000000;
    }
    return true;
  }

  function passesPerformanceFilter(row, filter) {
    if (!filter || filter === "all") {
      return true;
    }
    if (filter === "positive") {
      return row.performance1m > 0;
    }
    if (filter === "strong") {
      return row.performance1m > 5;
    }
    if (filter === "weak") {
      return row.performance1m < 0;
    }
    return true;
  }

  function sortScreenerRows(rows, sort) {
    const next = [...rows];
    if (sort === "name") {
      return next.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sort === "performance") {
      return next.sort((a, b) => b.performance1m - a.performance1m);
    }
    if (sort === "marketCap") {
      return next.sort((a, b) => Number(b.marketCap || 0) - Number(a.marketCap || 0));
    }
    return next.sort((a, b) => b.score - a.score);
  }

  function riskRank(row) {
    const weakTrend = row.rating.rating === "SELL" ? 28 : 0;
    const volatility = row.analysis.volatility * 0.44;
    const poorMomentum = Math.max(0, 58 - row.momentumScore) * 0.45;
    const negativePerformance = row.performance1m < 0 ? Math.abs(row.performance1m) * 2 : 0;
    return Math.round(clamp(weakTrend + volatility + poorMomentum + negativePerformance, 0, 100));
  }

  function pickReasonFor(score, rating, analysis) {
    if (rating.rating === "BUY") {
      return `Starkes Rating, Trend ${Math.round(analysis.trend)} und Momentum ${Math.round(analysis.momentum)} sprechen für relative Stärke.`;
    }
    if (rating.rating === "SELL") {
      return `Rating ist schwach; Momentum und Risiko sprechen für Vorsicht.`;
    }
    if (score >= 65) {
      return "Qualität und Growth sind solide, aber das technische Signal braucht Bestätigung.";
    }
    return "Gemischtes Setup, eher Watchlist-Kandidat als aktiver Pick.";
  }

  function alertTypeOptions(selected = "price") {
    const options = [
      ["price", "Preis-Alert"],
      ["earnings", "Earnings-Reminder"],
      ["event", "Event-Hinweis"],
      ["watchlist", "Watchlist-Alert"],
      ["sentiment", "Research-/Sentiment-Hinweis"]
    ];
    return options
      .map(([value, label]) => `<option value="${escAttr(value)}" ${selected === value ? "selected" : ""}>${esc(label)}</option>`)
      .join("");
  }

  function alertTypeLabel(type) {
    const labels = {
      price: "Preis",
      earnings: "Earnings",
      event: "Event",
      watchlist: "Watchlist",
      sentiment: "Research",
      system: "System"
    };
    return labels[type] || "Alert";
  }

  function alertSummary() {
    const alerts = state.alerts.map(normalizeAlertRecord);
    return {
      open: alerts.filter((alert) => normalizeAlertStatus(alert) === "open" && !isAlertSnoozed(alert)).length,
      triggered: alerts.filter((alert) => normalizeAlertStatus(alert) === "triggered").length,
      paused: alerts.filter(isAlertSnoozed).length,
      done: alerts.filter((alert) => normalizeAlertStatus(alert) === "done").length,
      watchlist: alerts.filter((alert) => state.watchlist.includes(alert.symbol) || alert.type === "watchlist").length
    };
  }

  function alertDataStatus() {
    const liveQuotes = Object.values(state.quotes).some((quote) => quote.meta?.status === "live");
    const liveEvents = state.events.some((eventItem) => eventItem.meta?.status === "live");
    if (liveQuotes || liveEvents) {
      return "hybrid";
    }
    return "local";
  }

  function priorityTone(priority) {
    if (priority === "high") {
      return "bear";
    }
    if (priority === "low") {
      return "neutral";
    }
    return "";
  }

  function inferEventPriority(eventItem) {
    if (isWatchlistRelevantEvent(eventItem) || matchesEventWindow(eventItem, "today")) {
      return "high";
    }
    return eventRelevance(eventItem) >= 65 ? "medium" : "low";
  }

  function alertHistoryForView() {
    return state.alerts
      .map(normalizeAlertRecord)
      .flatMap((alert) => (alert.history || []).map((entry) => ({
        ...entry,
        symbol: alert.displaySymbol || alert.symbol,
        type: alert.type,
        priority: alert.priority || "medium"
      })))
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
      .slice(0, 18);
  }

  function alertStatusText(status) {
    if (status === "triggered") {
      return "Ausgelöst";
    }
    if (status === "done") {
      return "Erledigt";
    }
    if (status === "snoozed" || status === "paused") {
      return "Pausiert";
    }
    return "Offen";
  }

  function buildAlertRecord(config) {
    const createdAt = Date.now();
    const priority = ["high", "medium", "low"].includes(config.priority) ? config.priority : "medium";
    return {
      id: `${createdAt}-${Math.random().toString(16).slice(2)}`,
      symbol: normalizeSymbol(config.symbol),
      displaySymbol: config.displaySymbol || normalizeSymbol(config.symbol),
      type: config.type || "price",
      condition: config.condition || "above",
      target: Number.isFinite(config.target) ? config.target : null,
      priority,
      status: "open",
      source: config.source || "local",
      eventTitle: config.eventTitle || "",
      eventDate: config.eventDate || "",
      createdAt,
      lastCheckedAt: null,
      snoozedUntil: null,
      history: [
        {
          status: "open",
          message: config.note || "Alert angelegt",
          timestamp: createdAt
        }
      ]
    };
  }

  function addAlert(alert, message = "Alert gespeichert.") {
    state.alerts = [alert, ...state.alerts].slice(0, 60);
    saveAlerts();
    toast(message);
    checkAlerts(false);
    render();
  }

  function openAlertDraft(symbol, type = "price") {
    const normalized = normalizeSymbol(symbol);
    state.alertDraft = {
      symbol: assetMap.has(normalized) ? normalized : (assetMap.has(state.activeSymbol) ? state.activeSymbol : "NVDA"),
      type: ["price", "earnings", "event", "watchlist", "sentiment"].includes(type) ? type : "price"
    };
    navigate("alerts");
  }

  function createEventAlertFromDataset(dataset) {
    const rawSymbol = dataset.alertEventSymbol || "";
    const normalized = normalizeSymbol(rawSymbol);
    const type = eventAlertType(dataset.alertEventType);
    const symbol = assetMap.has(normalized) ? normalized : "SPY";
    const alert = buildAlertRecord({
      symbol,
      displaySymbol: assetMap.has(normalized) ? normalized : (rawSymbol || "Markt"),
      type,
      priority: dataset.alertEventPriority || "medium",
      source: "event-hub",
      eventTitle: dataset.alertEventTitle || "Event-Termin",
      eventDate: dataset.alertEventDate || "",
      note: `${type === "earnings" ? "Earnings" : "Event"}-Alert aus dem Event-Hub angelegt`
    });
    addAlert(alert, "Event-Alert gespeichert.");
  }

  function eventAlertType(type) {
    return String(type || "").toLowerCase().includes("earnings") ? "earnings" : "event";
  }

  function createAlertFromForm(form) {
    const formData = new FormData(form);
    const symbol = normalizeSymbol(formData.get("symbol"));
    const type = String(formData.get("type") || "price");
    const condition = String(formData.get("condition") || "above");
    const rawTarget = String(formData.get("target") ?? "").trim();
    const target = rawTarget === "" ? NaN : Number(rawTarget);
    const priority = String(formData.get("priority") || "medium");

    if (!assetMap.has(symbol)) {
      toast("Alert konnte nicht gespeichert werden: Asset fehlt.");
      return;
    }
    if (type === "price" && !Number.isFinite(target)) {
      toast("Bitte einen Zielwert für den Preis-Alert eintragen.");
      return;
    }
    if (type === "price" && condition === "move" && !Number.isFinite(target)) {
      toast("Bitte eine Prozent-Schwelle für die Tagesbewegung eintragen.");
      return;
    }

    const alert = buildAlertRecord({
      symbol,
      type,
      condition,
      target: Number.isFinite(target) ? target : null,
      priority,
      source: "manual",
      note: `${alertTypeLabel(type)} für ${symbol} angelegt`
    });
    state.alertDraft = { symbol: "", type: "price" };
    form.reset();
    addAlert(alert, "Alert gespeichert.");
  }

  function deleteAlertById(id) {
    state.alerts = state.alerts.filter((alert) => alert.id !== id);
    saveAlerts();
    toast("Alert gelöscht.");
    render();
  }

  function checkAlerts(showToast) {
    let triggered = 0;
    state.alerts = state.alerts.map((alert) => {
      if (normalizeAlertStatus(alert) === "done") {
        return alert;
      }
      const quote = quoteFor(alert.symbol);
      if (isAlertSnoozed(alert)) {
        return {
          ...alert,
          status: "open",
          lastCheckedAt: Date.now()
        };
      }
      const wasTriggered = normalizeAlertStatus(alert) === "triggered";
      const isTriggered = evaluateAlert(alert, quote);
      if (isTriggered && !wasTriggered) {
        triggered += 1;
        const inboxItem = {
          id: `${alert.id}-${Date.now()}`,
          alertId: alert.id,
          type: alert.type,
          priority: alert.priority || "medium",
          status: "triggered",
          title: `${alert.symbol} Alert`,
          message: alertLabel(alert),
          timestamp: Date.now()
        };
        state.alertInbox = [
          inboxItem,
          ...state.alertInbox
        ].slice(0, 30);
      }
      return {
        ...alert,
        status: isTriggered ? "triggered" : "open",
        triggeredAt: isTriggered ? (alert.triggeredAt || Date.now()) : alert.triggeredAt,
        lastCheckedAt: Date.now(),
        history: isTriggered && !wasTriggered ? [
          {
            status: "triggered",
            message: alertLabel(alert),
            timestamp: Date.now()
          },
          ...(alert.history || [])
        ].slice(0, 8) : (alert.history || [])
      };
    });
    saveAlerts();
    storageSet(STORAGE_KEYS.alertInbox, state.alertInbox);
    if (showToast) {
      toast(triggered ? `${triggered} Alert(s) ausgelöst.` : "Keine neuen Alerts ausgelöst.");
    }
  }

  function evaluateAlert(alert, quote) {
    if (alert.type === "earnings") {
      if (alert.eventDate) {
        const eventDate = new Date(alert.eventDate);
        return eventDate >= startOfToday() && eventDate <= daysFromNow(14);
      }
      return eventsForSymbol(alert.symbol).some((eventItem) => eventItem.type === "Earnings" && eventItem.date >= startOfToday() && eventItem.date <= daysFromNow(14));
    }
    if (alert.type === "event") {
      if (alert.eventDate) {
        const eventDate = new Date(alert.eventDate);
        return eventDate >= startOfToday() && eventDate <= daysFromNow(14);
      }
      return eventsForSymbol(alert.symbol).some((eventItem) => eventItem.date >= startOfToday() && eventItem.date <= daysFromNow(14));
    }
    if (alert.type === "watchlist") {
      return state.watchlist.includes(alert.symbol) && Math.abs(Number(quote.changePct || 0)) >= 2;
    }
    if (alert.type === "sentiment") {
      return getAsset(alert.symbol).sentiment >= 72 || Number(quote.changePct || 0) >= 3;
    }
    if (alert.condition === "below") {
      return Number(quote.price || 0) <= Number(alert.target || 0);
    }
    if (alert.condition === "move") {
      return Math.abs(Number(quote.changePct || 0)) >= Number(alert.target || 0);
    }
    return Number(quote.price || 0) >= Number(alert.target || 0);
  }

  function alertLabel(alert) {
    if (alert.type === "watchlist") {
      return "Watchlist-Hinweis bei größerer Tagesbewegung";
    }
    if (alert.type === "sentiment") {
      return "News-/Sentiment-Hinweis vorbereitet";
    }
    if (alert.type === "earnings") {
      return alert.eventTitle ? `${alert.eventTitle}${alert.eventDate ? ` am ${formatEventDate(alert.eventDate)}` : ""}` : "Earnings-/Event-Reminder in den nächsten 14 Tagen";
    }
    if (alert.type === "event") {
      return alert.eventTitle ? `${alert.eventTitle}${alert.eventDate ? ` am ${formatEventDate(alert.eventDate)}` : ""}` : "Event-Hinweis in den nächsten 14 Tagen";
    }
    if (alert.condition === "below") {
      return `Preis unter ${formatMoney(alert.target, getAsset(alert.symbol).currency)}`;
    }
    if (alert.condition === "move") {
      return `Tagesbewegung größer als ${formatNumber(alert.target)}%`;
    }
    return `Preis über ${formatMoney(alert.target, getAsset(alert.symbol).currency)}`;
  }

  function alertsForView() {
    return state.alerts
      .map(normalizeAlertRecord)
      .filter(alertMatchesFilters)
      .sort((a, b) => alertSortRank(a) - alertSortRank(b));
  }

  function alertInboxForView() {
    return [...state.alertInbox]
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
      .map((item) => ({
        ...item,
        priority: item.priority || "medium",
        type: item.type || "price"
      }));
  }

  function normalizeAlertRecord(alert) {
    return {
      priority: "medium",
      snoozedUntil: null,
      history: [],
      ...alert,
      status: normalizeAlertStatus(alert)
    };
  }

  function normalizeAlertStatus(alert) {
    if (alert.status === "active") {
      return "open";
    }
    if (["open", "triggered", "done"].includes(alert.status)) {
      return alert.status;
    }
    return "open";
  }

  function alertStatusLabel(alert) {
    const status = normalizeAlertStatus(alert);
    if (status === "done") {
      return "Erledigt";
    }
    if (status === "triggered") {
      return "Ausgelöst";
    }
    if (isAlertSnoozed(alert)) {
      return "Pausiert";
    }
    return "Offen";
  }

  function priorityLabel(priority) {
    const labels = {
      high: "hoch",
      medium: "mittel",
      low: "niedrig"
    };
    return labels[priority] || "mittel";
  }

  function alertMatchesFilters(alert) {
    const filters = state.alertFilters || {};
    const status = normalizeAlertStatus(alert);
    const isPaused = isAlertSnoozed(alert);
    if (filters.status && filters.status !== "all") {
      if (filters.status === "paused" && !isPaused) {
        return false;
      }
      if (filters.status !== "paused" && status !== filters.status) {
        return false;
      }
    }
    if (filters.priority && filters.priority !== "all" && (alert.priority || "medium") !== filters.priority) {
      return false;
    }
    if (filters.type && filters.type !== "all" && alert.type !== filters.type) {
      return false;
    }
    if (filters.scope === "watchlist" && !state.watchlist.includes(alert.symbol) && alert.type !== "watchlist") {
      return false;
    }
    const search = String(filters.search || "").trim().toLowerCase();
    if (search) {
      const haystack = [
        alert.symbol,
        alert.displaySymbol,
        alert.eventTitle,
        alertTypeLabel(alert.type),
        alertLabel(alert),
        alert.source
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    }
    return true;
  }

  function alertSortRank(alert) {
    const statusRank = { triggered: 0, open: isAlertSnoozed(alert) ? 2 : 1, done: 3 };
    const priorityRank = { high: 0, medium: 1, low: 2 };
    return (statusRank[normalizeAlertStatus(alert)] ?? 2) * 10 + (priorityRank[alert.priority || "medium"] ?? 1);
  }

  function isAlertSnoozed(alert) {
    return Number(alert.snoozedUntil || 0) > Date.now() && normalizeAlertStatus(alert) !== "done";
  }

  function markAlertDone(id) {
    let changed = false;
    state.alerts = state.alerts.map((alert) => {
      if (alert.id !== id) {
        return alert;
      }
      changed = true;
      return {
        ...alert,
        status: "done",
        completedAt: Date.now(),
        history: [
          { status: "done", message: "Als erledigt markiert", timestamp: Date.now() },
          ...(alert.history || [])
        ].slice(0, 8)
      };
    });
    if (changed) {
      saveAlerts();
      state.alertInbox = [
        {
          id: `${id}-done-${Date.now()}`,
          alertId: id,
          type: "system",
          priority: "low",
          status: "done",
          title: "Alert erledigt",
          message: "Der Alert wurde in die Historie verschoben.",
          timestamp: Date.now()
        },
        ...state.alertInbox
      ].slice(0, 30);
      storageSet(STORAGE_KEYS.alertInbox, state.alertInbox);
      toast("Alert als erledigt markiert.");
      render();
    }
  }

  function snoozeUntilFor(duration) {
    const hours = {
      later: 6,
      tomorrow: 24,
      week: 24 * 7
    };
    return Date.now() + (hours[duration] || hours.tomorrow) * 60 * 60 * 1000;
  }

  function snoozeLabel(duration) {
    const labels = {
      later: "später heute",
      tomorrow: "morgen",
      week: "in einer Woche"
    };
    return labels[duration] || labels.tomorrow;
  }

  function snoozeAlert(id, duration = "tomorrow") {
    let changed = false;
    const until = snoozeUntilFor(duration);
    const label = snoozeLabel(duration);
    state.alerts = state.alerts.map((alert) => {
      if (alert.id !== id) {
        return alert;
      }
      changed = true;
      return {
        ...alert,
        status: "open",
        snoozedUntil: until,
        history: [
          { status: "snoozed", message: `Pausiert bis ${label}`, timestamp: Date.now() },
          ...(alert.history || [])
        ].slice(0, 8)
      };
    });
    if (changed) {
      saveAlerts();
      state.alertInbox = [
        {
          id: `${id}-snooze-${Date.now()}`,
          alertId: id,
          type: "system",
          priority: "low",
          status: "open",
          title: "Alert pausiert",
          message: `Nächster Check nach ${formatTimestamp(until)}.`,
          timestamp: Date.now()
        },
        ...state.alertInbox
      ].slice(0, 30);
      storageSet(STORAGE_KEYS.alertInbox, state.alertInbox);
      toast(`Alert bis ${label} pausiert.`);
      render();
    }
  }

  function saveAlerts() {
    storageSet(STORAGE_KEYS.alerts, state.alerts.map(normalizeAlertRecord));
  }

  function fundamentalInterpretation(asset, fundamentals) {
    const analysis = analysisFor(asset.symbol);
    const quality = Number(analysis.quality || 50);
    const value = Number(analysis.value || 50);
    const growth = Number(analysis.growth || 50);
    const debt = Number(fundamentals.debt || 0);
    const cashflow = Number(fundamentals.cashflow || 0);
    if (quality >= 75 && growth >= 65 && cashflow >= debt * 0.35) {
      return {
        label: "Positiv",
        text: "Qualität, Wachstum und Cashflow wirken im lokalen Modell konstruktiv. Bewertung und Erwartungsniveau bleiben trotzdem wichtig."
      };
    }
    if (value < 42 || quality < 50 || (debt && cashflow && debt > cashflow * 4)) {
      return {
        label: "Vorsichtig",
        text: "Das Modell sieht Bewertungs-, Qualitäts- oder Bilanzrisiken. Kennzahlen sollten vor einer Entscheidung genauer geprüft werden."
      };
    }
    return {
      label: "Neutral",
      text: "Fundamentales Bild ist gemischt: einzelne Stärken sind sichtbar, aber kein klarer Qualitäts- oder Value-Vorsprung."
    };
  }

  function rsiToScore(rsi) {
    const number = Number(rsi || 50);
    if (number >= 45 && number <= 62) {
      return 70;
    }
    if (number > 62 && number <= 72) {
      return 62;
    }
    if (number < 45 && number >= 35) {
      return 45;
    }
    if (number > 72) {
      return 38;
    }
    return 32;
  }

  function rsiText(rsi) {
    if (rsi > 72) {
      return "überhitzt";
    }
    if (rsi >= 55) {
      return "konstruktiv";
    }
    if (rsi < 40) {
      return "schwach";
    }
    return "neutral";
  }

  function ratingReason(rating, values) {
    if (rating === "BUY") {
      return `BUY, weil Trend (${Math.round(values.trendScore)}) und Momentum (${Math.round(values.momentumScore)}) überdurchschnittlich sind und das Risiko noch tragbar wirkt.`;
    }
    if (rating === "SELL") {
      return `SELL, weil Momentum, Trend oder Risiko ein schwaches Setup anzeigen. Tagesbewegung: ${formatPercent(values.change)}.`;
    }
    return `NEUTRAL, weil die Komponenten gemischt sind. Für ein klares Signal braucht es stärkeren Trend oder bessere Risiko-Bestätigung.`;
  }

  function chanceRiskText(rating, volatility) {
    if (rating === "BUY" && volatility < 55) {
      return "gut";
    }
    if (rating === "SELL" || volatility > 75) {
      return "erhöhtes Risiko";
    }
    return "ausgewogen";
  }

  function renderSearchBox(id, placeholder) {
    return `
      <label class="global-search" data-search-root for="${escAttr(id)}">
        <input id="${escAttr(id)}" data-search-input type="search" placeholder="${escAttr(placeholder)}" autocomplete="off">
        <div class="suggestions hidden" data-search-suggestions></div>
      </label>
    `;
  }

  function renderSuggestions(input) {
    const root = input.closest("[data-search-root]");
    const box = root ? root.querySelector("[data-search-suggestions]") : null;
    if (!box) {
      return;
    }

    const query = input.value.trim().toLowerCase();
    const matches = searchAssets(query).slice(0, 7);
    if (!matches.length) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }

    box.innerHTML = matches.map((asset) => `
      <button class="suggestion" type="button" data-symbol="${escAttr(asset.symbol)}">
        <span class="symbol">${esc(asset.symbol)}</span>
        <span>${esc(asset.name)}<br><small class="small">${esc(asset.sector)} - ${esc(asset.type)}</small></span>
        <span>${renderTinyStatus(quoteFor(asset.symbol).meta.status)}</span>
      </button>
    `).join("");
    box.classList.remove("hidden");
  }

  function renderAllSuggestions() {
    document.querySelectorAll("[data-search-input]").forEach((input) => {
      if (input.value) {
        renderSuggestions(input);
      }
    });
  }

  function searchAssets(query) {
    if (!query) {
      return state.recents.map(getAsset).filter(Boolean).concat(ASSETS.filter((asset) => !state.recents.includes(asset.symbol))).slice(0, 7);
    }

    return ASSETS
      .filter((asset) => {
        const haystack = `${asset.symbol} ${asset.name} ${asset.sector} ${asset.type}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => scoreAssetMatch(a, query) - scoreAssetMatch(b, query));
  }

  function findBestSymbol(query) {
    const normalized = normalizeSymbol(query);
    if (assetMap.has(normalized)) {
      return normalized;
    }
    const match = searchAssets(query)[0];
    return match ? match.symbol : "";
  }

  function scoreAssetMatch(asset, query) {
    const q = query.toLowerCase();
    if (asset.symbol.toLowerCase() === q) {
      return 0;
    }
    if (asset.symbol.toLowerCase().startsWith(q)) {
      return 1;
    }
    if (asset.name.toLowerCase().startsWith(q)) {
      return 2;
    }
    return 5;
  }

  function addToWatchlist(rawSymbol) {
    const symbol = findBestSymbol(rawSymbol);
    if (!symbol) {
      toast("Asset nicht gefunden. Nutze die Suche oder ein Symbol aus dem erweiterten Screener-Universum.");
      return;
    }
    if (state.watchlist.includes(symbol)) {
      toast(`${symbol} ist bereits in der Watchlist.`);
      return;
    }
    state.watchlist = unique([...state.watchlist, symbol]);
    storageSet(STORAGE_KEYS.watchlist, state.watchlist);
    ensureHomeData(true);
    toast(`${symbol} wurde zur Watchlist hinzugefügt.`);
    render();
  }

  function removeFromWatchlist(symbol) {
    state.watchlist = state.watchlist.filter((item) => item !== symbol);
    storageSet(STORAGE_KEYS.watchlist, state.watchlist);
    toast(`${symbol} wurde aus der Watchlist entfernt.`);
    render();
  }

  function addRecent(symbol, shouldSave = true) {
    if (!assetMap.has(symbol)) {
      return;
    }
    state.recents = unique([symbol, ...state.recents]).slice(0, 6);
    if (shouldSave) {
      storageSet(STORAGE_KEYS.recents, state.recents);
    }
  }

  function buildFredProxyTestRequest() {
    const url = fredProxyUrl({ action: "test" });
    return {
      url: url.toString(),
      responseType: "json",
      providerId: "fred",
      method: "GET"
    };
  }

  function buildFinnhubProxyTestRequest() {
    return {
      url: finnhubProxyUrl({ endpoint: "quote", symbol: "AAPL" }),
      responseType: "json",
      providerId: "finnhub",
      method: "GET"
    };
  }

  function buildAlphaProxyTestRequest() {
    return {
      url: alphaProxyUrl({ endpoint: "quote", symbol: "AAPL" }),
      responseType: "json",
      providerId: "alphaVantage",
      method: "GET"
    };
  }

  function fredProxyUrl(params = {}) {
    return serverFunctionUrl("/api/fred", params);
  }

  function finnhubProxyUrl(params = {}) {
    return serverFunctionUrl("/api/finnhub", params);
  }

  function alphaProxyUrl(params = {}) {
    return serverFunctionUrl("/api/alphavantage", params);
  }

  function eiaProxyUrl(params = {}) {
    return serverFunctionUrl("/api/eia", params);
  }

  function fxProxyUrl(params = {}) {
    return serverFunctionUrl("/api/fx", params);
  }

  function coingeckoProxyUrl(params = {}) {
    return serverFunctionUrl("/api/coingecko", params);
  }

  function openDataProxyUrl(params = {}) {
    return serverFunctionUrl("/api/opendata", params);
  }

  function serverFunctionUrl(path, params = {}) {
    const base = serverApiAvailable() ? window.location.origin : "http://localhost";
    const url = new URL(path, base);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
    return serverApiAvailable() ? url.toString() : `${url.pathname}${url.search}`;
  }

  function serverApiAvailable() {
    return window.location.protocol === "https:" || window.location.protocol === "http:";
  }

  function fredProxyDiagnostics(request, responseInfo = {}) {
    return {
      kind: "fred-vercel-function",
      codePath: "testProviderById > runFredVercelProviderTest > /api/fred > FRED API",
      frontendEndpoint: request.url,
      pageOrigin: window.location.origin || "file://",
      frontendKeyExposure: "nein, der Browser sendet keinen FRED-Key",
      contentType: "unbekannt",
      functionError: "",
      fredError: "",
      note: "",
      ...responseInfo
    };
  }

  function parsedProviderBody(text) {
    const body = String(text || "");
    if (!body.trim()) {
      return { ok: true, data: {}, empty: true };
    }
    try {
      return { ok: true, data: JSON.parse(body), empty: false };
    } catch (error) {
      return { ok: false, data: null, empty: false, error };
    }
  }

  async function fetchProviderTestPayload(request) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(request.url, {
        signal: controller.signal,
        cache: "no-store",
        headers: request.headers || {}
      });
      const text = await response.text();
      const contentType = response.headers.get("content-type") || "";
      const parsed = request.responseType === "text" ? { ok: true, data: text, empty: !text } : parsedProviderBody(text);
      if (!response.ok) {
        const error = new Error(providerHttpMessage(response, text, parsed.ok ? parsed.data : null, request.providerId));
        error.kind = response.status === 429 ? "rate-limit" : "http";
        error.httpStatus = response.status;
        error.responseText = text;
        error.responseData = parsed.ok ? parsed.data : null;
        error.contentType = contentType;
        error.parseOk = parsed.ok;
        error.apiMessage = extractProviderErrorMessage(parsed.ok ? parsed.data : null, text);
        throw error;
      }
      if (request.responseType === "text") {
        return { data: text, response, text, contentType, parseOk: true };
      }
      if (parsed.ok) {
        return { data: parsed.data, response, text, contentType, parseOk: true };
      }
      {
        const error = new Error("Parse-Fehler: Provider lieferte keine gültige JSON-Antwort. Prüfe, ob ein JSON-Parameter nötig ist.");
        error.kind = "parse";
        error.cause = parsed.error;
        error.httpStatus = response.status;
        error.responseText = text;
        error.contentType = contentType;
        error.parseOk = false;
        throw error;
      }
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("Endpoint nicht erreichbar oder Zeitlimit überschritten.");
        timeoutError.kind = "timeout";
        throw timeoutError;
      }
      if (error instanceof TypeError) {
        const browserError = new Error("Browserzugriff blockiert oder Netzwerk/CORS-Problem.");
        browserError.kind = "browser";
        browserError.cause = error;
        browserError.browserMessage = error.message || "";
        throw browserError;
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function providerHttpMessage(response, bodyText, data, providerId = "") {
    const apiMessage = extractProviderErrorMessage(data, bodyText);
    if (apiMessage) {
      const prefix = providerId === "fred" ? "FRED API meldet" : "Provider meldet";
      return `HTTP ${response.status}: ${prefix}: ${apiMessage}`;
    }
    const body = String(bodyText || "").slice(0, 220);
    if (response.status === 401 || response.status === 403) {
      return `HTTP ${response.status}: Key nicht akzeptiert oder Zugriff nicht erlaubt.`;
    }
    if (response.status === 429) {
      return "Rate Limit erreicht. Bitte später erneut testen.";
    }
    return `HTTP ${response.status}: Provider antwortet mit Fehler.${body ? ` Antwort: ${body}` : ""}`;
  }

  function extractProviderErrorMessage(data, bodyText = "") {
    if (data && typeof data === "object") {
      if (data.error_message) {
        return String(data.error_message);
      }
      if (data.error) {
        return typeof data.error === "string" ? data.error : JSON.stringify(data.error);
      }
      if (data.message) {
        return String(data.message);
      }
      if (data["Error Message"]) {
        return String(data["Error Message"]);
      }
      if (data.Note || data.Information) {
        return String(data.Note || data.Information);
      }
    }
    const text = String(bodyText || "");
    const match = text.match(/"error_message"\s*:\s*"([^"]+)"/);
    return match ? match[1] : "";
  }

  function describeProviderTestError(error) {
    if (!error) {
      return "Unbekannter Fehler beim Provider-Test.";
    }
    if (error.kind === "parse") {
      return error.message;
    }
    if (error.kind === "rate-limit") {
      return error.message;
    }
    if (error.kind === "http") {
      return error.message;
    }
    if (error.kind === "browser") {
      return "Browserzugriff blockiert, CORS-Problem oder Netzwerk offline.";
    }
    if (error.kind === "timeout") {
      return error.message;
    }
    return error.message || "Unbekannter Fehler beim Provider-Test.";
  }

  function validateFinnhubQuote(data) {
    if (data && data.error) {
      throw new Error(`API-Antwort ungültig: ${data.error}`);
    }
    if (!data || !Number.isFinite(Number(data.c)) || Number(data.c) <= 0) {
      throw new Error("API-Antwort ungültig: Finnhub liefert keinen gültigen AAPL-Preis.");
    }
    return "Test erfolgreich: Finnhub Quote für AAPL gültig. Das ist noch kein Modul-Liveabruf.";
  }

  function validateAlphaVantageQuote(data) {
    if (data && data["Error Message"]) {
      throw new Error(`API-Antwort ungültig: ${data["Error Message"]}`);
    }
    if (data && (data.Note || data.Information)) {
      throw new Error(`Alpha Vantage Hinweis: ${data.Note || data.Information}`);
    }
    const quote = data && data["Global Quote"];
    if (!quote || !Number.isFinite(Number(quote["05. price"]))) {
      throw new Error("API-Antwort ungültig: Alpha Vantage liefert keinen GLOBAL_QUOTE-Preis.");
    }
    return "Test erfolgreich: Alpha Vantage GLOBAL_QUOTE gültig. In Aktien bleibt Finnhub Primärquelle.";
  }

  function validateFredObservations(data) {
    if (data && data.error_code) {
      throw new Error(`FRED API-Fehler ${data.error_code}: ${data.error_message || "Antwort ungültig."}`);
    }
    const observations = data && Array.isArray(data.observations) ? data.observations : [];
    if (!observations.length || observations.every((row) => !row.value || row.value === ".")) {
      throw new Error("API-Antwort ungültig: FRED JSON enthält keine nutzbaren Beobachtungen.");
    }
    return "Test erfolgreich: FRED liefert JSON-Beobachtungen für FEDFUNDS.";
  }

  function validateFredSeriesUpdates(data) {
    if (data && data.ok === false) {
      throw new Error(`FRED Function-Fehler: ${data.message || data.error || "unbekannter Fehler"}`);
    }
    const payload = data && data.data ? data.data : data;
    if (data && data.error_code) {
      throw new Error(`FRED API-Fehler ${data.error_code}: ${data.error_message || "Antwort ungültig."}`);
    }
    if (payload && payload.error_code) {
      throw new Error(`FRED API-Fehler ${payload.error_code}: ${payload.error_message || "Antwort ungültig."}`);
    }
    const series = payload && Array.isArray(payload.seriess) ? payload.seriess : [];
    if (!series.length) {
      throw new Error("FRED-Antwort ungültig: JSON ist erreichbar, aber `seriess` fehlt oder ist leer.");
    }
    return "Test erfolgreich: /api/fred erreicht FRED serverseitig und liefert JSON.";
  }

  function validateBlsSeries(data) {
    if (!data || data.status !== "REQUEST_SUCCEEDED") {
      throw new Error(`BLS-Antwort ungültig: ${data?.status || "kein Status"}`);
    }
    const series = data.Results && Array.isArray(data.Results.series) ? data.Results.series : [];
    if (!series.length || !series[0].data || !series[0].data.length) {
      throw new Error("BLS-Antwort ungültig: keine Zeitreihendaten gefunden.");
    }
    return "Test erfolgreich: BLS Open Data liefert aktuelle CPI-Zeitreihe.";
  }

  function validateFiscalData(data) {
    if (!data || !Array.isArray(data.data) || !data.data.length) {
      throw new Error("Treasury-Antwort ungültig: keine Fiscal-Data-Zeilen gefunden.");
    }
    return "Test erfolgreich: Treasury Fiscal Data liefert Open-Data-Zeilen.";
  }

  function validateEiaResponse(data) {
    if (data && data.error) {
      throw new Error(`EIA API-Fehler: ${data.error}`);
    }
    if (!data || typeof data !== "object" || !data.response) {
      throw new Error("EIA-Antwort ungültig: keine APIv2-Metadaten erhalten.");
    }
    return "Test erfolgreich: EIA APIv2 antwortet mit Metadaten.";
  }

  function validateWorldBankResponse(data) {
    if (!Array.isArray(data) || !data[1] || !Array.isArray(data[1])) {
      throw new Error("World-Bank-Antwort ungültig: erwartetes Indicator-Array fehlt.");
    }
    return "Test erfolgreich: World Bank Indicators API liefert JSON-Daten.";
  }

  function validateImfResponse(data) {
    if (!data || typeof data.values !== "object") {
      throw new Error("IMF-Antwort ungültig: DataMapper-Werte fehlen.");
    }
    return "Test erfolgreich: IMF DataMapper liefert JSON-Werte.";
  }

  function validateNonEmptyText(label) {
    return (text) => {
      if (!String(text || "").trim()) {
        throw new Error(`${label} liefert keine verwertbare Antwort.`);
      }
      return `Test erfolgreich: ${label} antwortet.`;
    };
  }

  async function testProviderById(providerId) {
    const provider = providerById(providerId);
    if (!provider) {
      return;
    }

    if (providerId === "fred") {
      await runFredVercelProviderTest(provider);
      return;
    }

    setProviderTest(providerId, "warn", "Test läuft lokal im Browser...");
    render();

    if (provider.security === "backend-only" && provider.keyMode !== "serverEnv") {
      setProviderTest(providerId, "warn", "Backend-only: Test im öffentlichen Browser bewusst nicht ausgeführt.");
      toast(`${provider.name}: Browser-Test hier nicht sinnvoll.`);
      render();
      return;
    }
    if (provider.security === "browser-critical" && !provider.testRequest && !provider.testUrl) {
      setProviderTest(providerId, "warn", provider.security === "browser-critical" ? "Browser-Test bewusst nicht implementiert: Quelle ist browserkritisch." : "Backend-only: Test im Browser bewusst nicht ausgeführt.");
      toast(`${provider.name}: Browser-Test hier nicht sinnvoll.`);
      render();
      return;
    }
    const requestFactory = provider.testRequest || (provider.testUrl ? (() => ({ url: provider.testUrl(), responseType: "json" })) : null);
    if (!requestFactory) {
      setProviderTest(providerId, "warn", "Kein Browser-Test implementiert. Quelle ist nur zugeordnet, nicht als Browser-Livetest versprochen.");
      toast(`${provider.name}: kein Browser-Test implementiert.`);
      render();
      return;
    }

    try {
      const request = requestFactory();
      const testResult = await fetchProviderTestPayload(request);
      const message = provider.validateTest ? provider.validateTest(testResult.data, testResult.response) : "Provider hat im Browser-Test geantwortet.";
      setProviderTest(providerId, "ok", message || "Provider hat im Browser-Test geantwortet.");
      toast(`${provider.name}: Test erfolgreich.`);
    } catch (error) {
      setProviderTest(providerId, "error", describeProviderTestError(error));
      toast(`${provider.name}: Test fehlgeschlagen.`);
      logError(error);
    }
    render();
  }

  async function runFredVercelProviderTest(provider) {
    const request = buildFredProxyTestRequest();

    if (!serverApiAvailable()) {
      setProviderTest("fred", "warn", "FRED läuft jetzt serverseitig über /api/fred. Im lokalen Datei-Modus ist diese Vercel Function nicht verfügbar.", fredProxyDiagnostics(request, {
        stage: "nicht gesendet",
        httpStatus: "kein Request",
        responseFormat: "keine Antwort",
        parseStatus: "nicht ausgeführt",
        note: "Öffne die Vercel-Deployment-URL oder nutze Vercel lokal, damit /api/fred existiert."
      }));
      recordProviderHealth("fred", "fallback", "FRED Vercel Function im lokalen Datei-Modus nicht verfügbar.");
      toast("FRED: Vercel Function lokal nicht verfügbar.");
      render();
      return;
    }

    setProviderTest("fred", "warn", "FRED Vercel-Function-Test läuft. Der API-Key bleibt serverseitig in FRED_API_KEY.", fredProxyDiagnostics(request, {
      stage: "Request gebaut",
      httpStatus: "wartet",
      responseFormat: "wartet",
      parseStatus: "wartet",
      note: "Frontend ruft nur /api/fred auf; der FRED-Key wird nicht im Browser gesendet."
    }));
    render();

    try {
      const testResult = await fetchProviderTestPayload(request);
      let message = "FRED Vercel Function hat geantwortet.";
      try {
        message = provider.validateTest ? provider.validateTest(testResult.data, testResult.response) : message;
      } catch (validationError) {
        validationError.httpStatus = testResult.response.status;
        validationError.responseText = testResult.text;
        validationError.responseData = testResult.data;
        validationError.contentType = testResult.contentType || "";
        validationError.parseOk = testResult.parseOk;
        validationError.apiMessage = extractProviderErrorMessage(testResult.data, testResult.text);
        throw validationError;
      }
      const details = fredProxyDiagnostics(request, {
        stage: "Response erhalten",
        httpStatus: testResult.response.status,
        contentType: testResult.contentType || "unbekannt",
        responseFormat: "JSON",
        parseStatus: testResult.parseOk ? "Parsing erfolgreich" : "Parsing fehlgeschlagen",
        fredError: "",
        note: "Vercel Function konnte FRED serverseitig erreichen."
      });
      setProviderTest("fred", "ok", message, details);
      toast("FRED: Vercel Function erfolgreich.");
    } catch (error) {
      const details = fredProxyDiagnostics(request, {
        stage: error.httpStatus ? "Response erhalten" : "Fetch fehlgeschlagen",
        httpStatus: error.httpStatus || "keine HTTP-Antwort",
        contentType: error.contentType || "unbekannt",
        responseFormat: error.parseOk === false ? "nicht JSON" : error.responseData ? "JSON" : "unbekannt",
        parseStatus: error.parseOk === false ? "Parsing fehlgeschlagen" : error.responseData ? "Parsing erfolgreich" : "nicht ausgeführt",
        functionError: error.responseData?.message || "",
        fredError: error.responseData?.fredError || error.apiMessage || "",
        browserFetchError: error.browserMessage || error.message || "",
        responseBody: error.responseText ? String(error.responseText).slice(0, 420) : "",
        note: "Wenn HTTP 500 mit missing_env erscheint, fehlt FRED_API_KEY in Vercel Environment Variables."
      });
      const message = describeProviderTestError(error);
      setProviderTest("fred", "error", message, details);
      toast("FRED: Vercel Function fehlgeschlagen.");
      logError(error);
    }
    render();
  }

  async function testConfiguredProviders() {
    const testable = visibleProviders().filter((provider) => {
      const hasTest = Boolean(provider.testRequest || provider.testUrl);
      if (!hasTest) {
        return false;
      }
      if (provider.security === "browser-critical") {
        return false;
      }
      return true;
    });
    if (!testable.length) {
      toast("Keine testbaren öffentlichen Quellen vorhanden.");
      return;
    }
    for (const provider of testable) {
      await testProviderById(provider.id);
    }
  }

  function setProviderTest(providerId, status, message, details = null) {
    state.providerTests = {
      ...state.providerTests,
      [providerId]: {
        status,
        message,
        timestamp: Date.now(),
        details
      }
    };
    storageSet(STORAGE_KEYS.providerTests, state.providerTests);
  }

  function exportWatchlist() {
    const lines = ["Symbol,Name,Preis,Tagesveränderung,Status,Quelle"];
    state.watchlist.forEach((symbol) => {
      const asset = getAsset(symbol);
      const quote = quoteFor(symbol);
      lines.push([
        symbol,
        asset.name,
        quote.price ?? "",
        quote.changePct ?? "",
        quote.meta.status,
        quote.meta.source
      ].map(csvCell).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mh-analytics-watchlist.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function renderKpi(label, value, meta) {
    return `
      <article class="kpi-card">
        <span class="card-label">${esc(label)}</span>
        <strong>${value || "--"}</strong>
        ${renderDataMeta(meta || makeMeta("Lokaler Fallback", "fallback", BOOT_TIME), true)}
      </article>
    `;
  }

  function renderMiniMetric(label, value) {
    return `
      <div class="mini-metric">
        <span>${esc(label)}</span>
        <strong>${esc(value || "--")}</strong>
      </div>
    `;
  }

  function renderDataMeta(meta, compact = false) {
    const safeMeta = meta || makeMeta("Unbekannte Quelle", "missing", BOOT_TIME);
    return `
      <div class="data-meta ${compact ? "compact-meta" : ""}" title="${escAttr(safeMeta.message || "")}">
        <span>${esc(safeMeta.source)}</span>
        <span>${formatTimestamp(safeMeta.timestamp)}</span>
        ${renderStatusBadge(safeMeta.status)}
      </div>
    `;
  }

  function renderStatusBadge(status) {
    const safeStatus = status || "missing";
    return `<span class="status-badge status-${escAttr(safeStatus)}">${esc(statusLabel(safeStatus))}</span>`;
  }

  function renderTinyStatus(status) {
    return `<span class="tiny-status status-${escAttr(status || "missing")}" aria-label="${escAttr(statusLabel(status || "missing"))}"></span>`;
  }

  function renderSymbolChip(symbol) {
    return `<button class="chip" type="button" data-symbol="${escAttr(symbol)}">${esc(symbol)}</button>`;
  }

  function renderEmptyState(text) {
    return `<div class="empty-state">${esc(text)}</div>`;
  }

  function makeMeta(source, status, timestamp, message = "") {
    return {
      source,
      status: status || "missing",
      timestamp: timestamp || Date.now(),
      message
    };
  }

  function getOverallDataStatus() {
    const quotes = Object.values(state.quotes);
    if (quotes.some((quote) => quote.meta.status === "live")) {
      return "live";
    }
    if (quotes.some((quote) => quote.meta.status === "stale")) {
      return "stale";
    }
    return "fallback";
  }

  function getOverallDataStatusText() {
    const status = getOverallDataStatus();
    if (status === "live") {
      return "Live-Daten aktiv, Fallbacks bleiben als Schutz bereit.";
    }
    if (status === "stale") {
      return "Veraltete Cache-Daten aktiv, API wird später erneut versucht.";
    }
    return "Fallback-Daten aktiv. Live-Daten laufen über serverseitige Quellen, sobald das Deployment korrekt konfiguriert ist.";
  }

  function countLiveQuotes() {
    return Object.values(state.quotes).filter((quote) => quote.meta.status === "live").length;
  }

  function statusLabel(status) {
    if (status === "live") {
      return "Live";
    }
    if (status === "stale") {
      return "Veraltet";
    }
    if (status === "missing") {
      return "Fehlt";
    }
    if (status === "prepared") {
      return "Zugeordnet";
    }
    if (status === "hybrid") {
      return "Hybrid";
    }
    if (status === "local") {
      return "Lokal";
    }
    if (status === "offline") {
      return "Offline";
    }
    if (status === "unknown") {
      return "Unbekannt";
    }
    if (status === "mapped" || status === "notUsed") {
      return "Aktuell nicht genutzt";
    }
    if (status === "disabled") {
      return "Deaktiviert";
    }
    if (status === "error") {
      return "Fehler";
    }
    return "Fallback-Daten aktiv";
  }

  function applyTheme() {
    document.body.classList.toggle("light", state.theme === "light");
    const label = document.getElementById("themeLabel");
    if (label) {
      label.textContent = state.theme === "light" ? "Light" : "Dark";
    }
  }

  function getAsset(symbol) {
    return assetMap.get(normalizeSymbol(symbol)) || assetMap.get("NVDA");
  }

  function normalizeSymbol(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");
  }

  function cleanKey(value) {
    return String(value || "").trim();
  }

  function storageGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      logError(error);
      return fallback;
    }
  }

  function sanitizeProviderHealth(savedHealth) {
    const next = {};
    Object.entries(savedHealth || {}).forEach(([providerId, health]) => {
      if (!PUBLIC_PROVIDER_IDS.includes(providerId) && !OPTIONAL_INTERNAL_PROVIDER_IDS.includes(providerId)) {
        return;
      }
      if (!health || typeof health !== "object") {
        return;
      }
      const status = health.status === "live" || health.status === "stale" ? "notUsed" : health.status;
      next[providerId] = {
        ...health,
        status,
        message: status === "notUsed" ? "Noch kein erfolgreicher Live-Abruf in dieser Sitzung." : health.message,
        timestamp: BOOT_TIME
      };
    });
    return next;
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      logError(error);
    }
  }

  function removeLegacyBrowserApiKeys() {
    try {
      localStorage.removeItem("mh.apiKeys.v2");
    } catch (error) {
      logError(error);
    }
  }

  function trimCache(cache) {
    const entries = Object.entries(cache).sort((a, b) => b[1].timestamp - a[1].timestamp).slice(0, 80);
    return Object.fromEntries(entries);
  }

  function getInputValue(selector) {
    if (!selector) {
      return "";
    }
    const input = document.querySelector(selector);
    return input ? input.value : "";
  }

  function logError(error) {
    console.warn("[MH Analytics]", error && error.message ? error.message : error);
  }

  function toast(message) {
    if (!toastStack) {
      return;
    }
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    toastStack.appendChild(node);
    window.setTimeout(() => node.remove(), 3600);
  }

  function classifyNewsSentiment(text) {
    const lower = String(text || "").toLowerCase();
    const positive = ["beat", "raises", "growth", "upgrade", "record", "strong", "profit"];
    const negative = ["miss", "cuts", "downgrade", "weak", "probe", "loss", "warning"];
    const pos = positive.some((word) => lower.includes(word));
    const neg = negative.some((word) => lower.includes(word));
    if (pos && !neg) {
      return "Bullish";
    }
    if (neg && !pos) {
      return "Bearish";
    }
    return "Neutral";
  }

  function sentimentValue(label) {
    if (label === "Bullish") {
      return 72;
    }
    if (label === "Bearish") {
      return 34;
    }
    return 52;
  }

  function trendText(delta) {
    if (Math.abs(delta) < 0.05) {
      return "Nahezu unverändert";
    }
    return delta > 0 ? `Steigt um ${formatNumber(delta)} Punkte` : `Fällt um ${formatNumber(Math.abs(delta))} Punkte`;
  }

  function toneClass(value) {
    const number = Number(value || 0);
    if (number > 0.05) {
      return "bull";
    }
    if (number < -0.05) {
      return "bear";
    }
    return "neutral";
  }

  function heatStyle(change) {
    const intensity = Math.min(Math.abs(change) / 2, 1);
    if (change >= 0) {
      return `background: linear-gradient(135deg, rgba(67, 209, 141, ${0.1 + intensity * 0.35}), rgba(16,16,15,0.9));`;
    }
    return `background: linear-gradient(135deg, rgba(239, 95, 114, ${0.1 + intensity * 0.35}), rgba(16,16,15,0.9));`;
  }

  function formatMoney(value, currency = "USD") {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return "--";
    }
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency,
      maximumFractionDigits: number >= 1000 ? 0 : 2
    }).format(number);
  }

  function formatCompactMoney(value, currency = "USD") {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return "--";
    }
    const compact = new Intl.NumberFormat("de-DE", {
      notation: "compact",
      maximumFractionDigits: 2
    }).format(number);
    return `${compact} ${currency}`;
  }

  function formatPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return "--";
    }
    return `${number >= 0 ? "+" : ""}${formatNumber(number)}%`;
  }

  function formatNumber(value, suffix = "") {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return "--";
    }
    return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(number)}${suffix}`;
  }

  function formatTimestamp(timestamp) {
    const time = timestamp ? new Date(timestamp) : new Date();
    return time.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatRelativeTime(timestamp) {
    const diff = Date.now() - Number(timestamp || Date.now());
    const hours = Math.max(1, Math.round(diff / (60 * 60 * 1000)));
    if (hours < 24) {
      return `vor ${hours}h`;
    }
    return `vor ${Math.round(hours / 24)}d`;
  }

  function toIsoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function parseEventDate(value) {
    if (!value) {
      return new Date();
    }
    const parsed = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function valueOr(primary, fallback) {
    return primary !== null && primary !== undefined && primary !== "" ? primary : fallback;
  }

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function firstNumber(...values) {
    for (const value of values) {
      const number = numberOrNull(value);
      if (number !== null) {
        return number;
      }
    }
    return null;
  }

  function normalizeFinnhubMarketCap(value) {
    const number = numberOrNull(value);
    if (number === null) {
      return null;
    }
    return number < 100000000 ? number * 1000000 : number;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean).map(normalizeSymbol))];
  }

  function tradingViewUrl(asset) {
    return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(asset.tv)}`;
  }

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function parseCsv(text) {
    const rows = String(text || "").trim().split(/\r?\n/).filter(Boolean).map(parseCsvLine);
    if (rows.length < 2) {
      return [];
    }
    const headers = rows[0].map((header) => String(header || "").trim());
    return rows.slice(1).map((row) => {
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = row[index] || "";
      });
      return entry;
    });
  }

  function parseCsvLine(line) {
    const cells = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && quoted && next === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  }

  function statusRank(status) {
    const ranks = { live: 4, stale: 3, fallback: 2, missing: 1, error: 0 };
    return ranks[status || ""] ?? 0;
  }

  function bestDataStatus(statuses) {
    return statuses.filter(Boolean).sort((a, b) => statusRank(b) - statusRank(a))[0] || "fallback";
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escAttr(value) {
    return esc(value);
  }

  init();
})();
