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
    providerHealth: "mh.providerHealth.v1",
    userPreferences: "mh.userPreferences.v1",
    watchlist: "mh.watchlist.v2",
    portfolios: "mh.portfolios.v1",
    activePortfolioId: "mh.activePortfolioId.v1",
    dashboardPrefs: "mh.dashboardPrefs.v1",
    alerts: "mh.alerts.v2",
    alertInbox: "mh.alertInbox.v2",
    journal: "mh.journal.v1",
    onboarding: "mh.onboarding.v1",
    activity: "mh.activity.v1",
    learning: "mh.learning.v1",
    level: "mh.level.v1",
    demoState: "mh.demoState.v1",
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
      usage: "Primärquelle für Aktien, Profile, News und Earnings. Läuft öffentlich nur über die eigene serverseitige Route /api/finnhub.",
      testHint: "Status entsteht über echte Modulabrufe auf /api/finnhub."
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
      usage: "Eigener Zuständigkeitsbereich für FX, Rohstoffe, Indikatoren, Zeitreihen sowie IPO-/Earnings-Zusatz. Läuft öffentlich nur über die eigene serverseitige Route /api/alphavantage.",
      testHint: "Status entsteht über echte Modulabrufe auf /api/alphavantage."
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
      usage: "Währungsdaten laufen über /api/fx. Die öffentliche App zeigt nur Daten und Status.",
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
      testHint: "Aus der öffentlichen Quellenliste entfernt."
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
      usage: "Zuständig für US-Makro und Geldmengen. FRED läuft nicht direkt im Browser, sondern über die serverseitige Route /api/fred.",
      testHint: "Status entsteht über echte Makroabrufe auf /api/fred."
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
      testHint: "Open-Data-Quelle; Status entsteht erst durch Modulabrufe."
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
      usage: "Noch nicht aktiv. NewsAPI sollte später serverseitig und geschützt laufen.",
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
      description: "Company News und Earnings Calendar. In der App durch den Hauptprovider Finnhub gebündelt.",
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
      description: "Krypto-Preise für BTC/ETH. Öffentlich über die eigene Route normalisiert.",
      usage: "Krypto-Daten laufen über /api/coingecko. Falls eine Betreiber-Konfiguration gesetzt ist, bleibt sie serverseitig.",
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
      testHint: "Backend-only; nicht öffentlich konfigurierbar."
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
      testHint: "Spätere Auth-/Storage-Konfiguration gehört nicht in die öffentliche UI."
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
      usage: "Open Data. Wird über /api/opendata normalisiert und ergänzt CPI sowie Arbeitsmarkt.",
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
      usage: "Open Data. Wird über /api/opendata normalisiert und für 10Y-Rendite sowie Yield Curve genutzt.",
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
      usage: "Open Data. data.sec.gov ist offiziell, aber im Browser CORS-kritisch; daher aktuell zugeordnet, nicht als Frontend-Livequelle beworben.",
      testHint: "Browserkritisch; später besser kontrolliert serverseitig normalisieren."
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
      usage: "EIA läuft über /api/eia. Öl wird aktiv für Rohstoffdaten genutzt; Gas/Energie sind serverseitig vorbereitet.",
      testHint: "Status entsteht über echte Modulabrufe auf /api/eia."
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
      usage: "Open Data. Wird über /api/opendata normalisiert und für globale BIP-/Ländervergleiche genutzt.",
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
      usage: "Open Data über DataMapper. Wird über /api/opendata normalisiert und ergänzt globale Makrovergleiche.",
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
      usage: "Open Data. Wegen SDMX-Komplexität und Browser-/Rate-Limit-Fragen zugeordnet, aber nicht als Live-Frontendquelle markiert.",
      testHint: "Später besser über kontrollierten Datenadapter."
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
      usage: "Open Data. In dieser Runde als transparenter Quellenstatus eingeordnet; Live-Module werden später gezielt angebunden.",
      testHint: "Status entsteht später über echte Modulabrufe."
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
      usage: "Für diese Runde nur als Datenquellenstatus eingeordnet; spätere Nutzung erfolgt kontrolliert serverseitig.",
      testHint: "Nicht als Live-Modul beworben."
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
    { id: "frankfurter", role: "Primärquelle FX", type: "Serverseitig normalisiert", category: "Währungen", description: "Offene FX-Kurse laufen zentral über /api/fx, ohne öffentliche Konfigurationsfelder.", fallback: "Bei Ausfall nutzt die App strukturierte lokale FX-Kontexte." },
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
    { id: "screener", name: "Screener / Ratings / Top Picks", providers: ["finnhub", "alphaVantage"], mode: "Hybrid / lokal transparent", quality: "mittel", description: "Ranking nutzt Quote-, Profil-, Fundamental- und Zeitreihenpfade, bleibt aber eine nachvollziehbare lokale Score-Logik mit Datenstatus je Wert." },
    { id: "watchlist", name: "Watchlist", providers: ["finnhub", "alphaVantage"], mode: "Hybrid / lokal", quality: "mittel", description: "Gespeicherte Assets sind lokal, Kurs- und Newsdaten kommen soweit möglich live." },
    { id: "alerts", name: "Alerts V2", providers: ["finnhub", "alphaVantage"], mode: "Lokal / Hybrid", quality: "mittel", description: "Regeln, Snooze und Historie sind lokal; Auslösung nutzt vorhandene Kurs- und Eventdaten." },
    { id: "macro", name: "Makro / Ländervergleich / Liquidität", providers: ["fred", "bls", "treasury", "ecb", "worldBank", "imf", "frankfurter", "eurostat", "oecd"], mode: "Hybrid / Fallback", quality: "hoch", description: "US-Makro, CPI, Arbeitsmarkt, Renditen, FX, Ländervergleich und Euro-/China-Kontext werden offiziellen Quellen zugeordnet." },
    { id: "energy", name: "Energie / Rohstoffe / FX", providers: ["eia", "alphaVantage", "frankfurter"], mode: "Hybrid", quality: "mittel", description: "EIA, Alpha Vantage und FX-Normalisierung speisen Cross-Asset-Kontexte." },
    { id: "etf", name: "ETF V2", providers: ["finnhub", "alphaVantage"], mode: "Lokal / Hybrid", quality: "mittel", description: "ETF-Struktur, TER, Holdings, Regionen, Sektoren, Overlap und Kostenrechnung sind strukturiert lokal; Marktpreise können über Quote-Pfade kommen." },
    { id: "portfolio", name: "Portfolio", providers: ["finnhub", "alphaVantage"], mode: "Lokal / Hybrid", quality: "mittel", description: "Positionen und Notizen sind lokal; Marktdaten werden soweit verfügbar live ergänzt." },
    { id: "research", name: "Research / Report", providers: ["finnhub", "fred", "sec", "worldBank", "treasury"], mode: "Hybrid / Synthese", quality: "mittel", description: "Reports kombinieren echte Inputs, lokale Fallbacks und eigene Research-Synthese inklusive Makro-Report." },
    { id: "sources", name: "Datenquellen", providers: DATA_HEALTH_PROVIDER_IDS, mode: "Transparenz", quality: "hoch", description: "Zeigt Quellen, Status, Frische, Health und betroffene Module ohne öffentliche Betreiber-Konfiguration." }
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
      symbol: "VWCE",
      name: "Vanguard FTSE All-World UCITS ETF",
      type: "ETF",
      sector: "Global Equity",
      tv: "XETR:VWCE",
      currency: "EUR",
      fallback: { price: 119.40, changePct: 0.18, marketCap: null, pe: null, eps: null, revenue: null },
      thesis: "Ein-Fonds-Weltportfolio mit breiter Länder- und Sektorstreuung.",
      risks: "USA-Gewichtung, Aktienmarktrisiko, Währungsrisiko trotz EUR-Handel.",
      sentiment: 59
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
      isin: "US78462F1030",
      category: "US Large Cap",
      role: "Core / US-Baustein",
      benchmark: "S&P 500",
      ter: 0.09,
      distribution: "Ausschüttend",
      currency: "USD",
      fundCurrency: "USD",
      domicile: "USA",
      replication: "Physisch",
      structureType: "Nicht-UCITS",
      region: [["USA", 96], ["Europa", 2], ["Sonstige", 2]],
      sectors: [["Technologie", 31], ["Finanzwerte", 13], ["Gesundheit", 12], ["Konsum", 10], ["Industrie", 8]],
      holdings: [["MSFT", 7.1], ["AAPL", 6.4], ["NVDA", 5.8], ["AMZN", 3.7], ["META", 2.5]],
      top10: 34,
      risk: "Breiter US-Markt, aber Mega-Cap-Konzentration.",
      fxRisk: "USD-Risiko für EUR-Anleger",
      useCase: "US-Kernbaustein für breite Large-Cap-Exposure.",
      structure: "Physisch replizierend, sehr liquide, stark USA-lastig.",
      dataNote: "Strukturierte lokale ETF-Datenbasis mit TER, Holdings, Regionen und Sektoren."
    },
    {
      symbol: "QQQ",
      name: "Invesco QQQ Trust",
      isin: "US46090E1038",
      category: "Nasdaq / Growth",
      role: "Satellite / Growth",
      benchmark: "Nasdaq 100",
      ter: 0.20,
      distribution: "Ausschüttend",
      currency: "USD",
      fundCurrency: "USD",
      domicile: "USA",
      replication: "Physisch",
      structureType: "Nicht-UCITS",
      region: [["USA", 97], ["Global", 3]],
      sectors: [["Technologie", 50], ["Kommunikation", 16], ["Konsum", 15], ["Gesundheit", 6], ["Industrie", 5]],
      holdings: [["MSFT", 8.7], ["NVDA", 7.9], ["AAPL", 7.4], ["AMZN", 5.1], ["META", 4.8]],
      top10: 49,
      risk: "Tech- und Growth-Konzentration.",
      fxRisk: "USD-Risiko, hohe Zins-Sensitivität",
      useCase: "Satellit für Nasdaq-, AI- und Growth-Exposure.",
      structure: "Sehr liquide, aber stärker konzentriert als ein Welt-ETF.",
      dataNote: "Lokales ETF-Modell, keine Live-Holdings."
    },
    {
      symbol: "VTI",
      name: "Vanguard Total Stock Market ETF",
      isin: "US9229087690",
      category: "US Total Market",
      role: "Core / US-Gesamtmarkt",
      benchmark: "CRSP US Total Market",
      ter: 0.03,
      distribution: "Ausschüttend",
      currency: "USD",
      fundCurrency: "USD",
      domicile: "USA",
      replication: "Physisch",
      structureType: "Nicht-UCITS",
      region: [["USA", 99], ["Sonstige", 1]],
      sectors: [["Technologie", 29], ["Finanzwerte", 12], ["Gesundheit", 12], ["Konsum", 10], ["Industrie", 9]],
      holdings: [["MSFT", 6.2], ["AAPL", 5.6], ["NVDA", 5.0], ["AMZN", 3.2], ["META", 2.1]],
      top10: 29,
      risk: "US-Gesamtmarkt mit Small-/Mid-Cap-Anteil.",
      fxRisk: "USD-Risiko für EUR-Anleger",
      useCase: "Sehr günstiger US-Gesamtmarkt-Baustein.",
      structure: "Breiter als SPY, aber weiterhin fast vollständig USA.",
      dataNote: "Lokale TER-/Regionen-/Holding-Basis."
    },
    {
      symbol: "VWCE",
      name: "Vanguard FTSE All-World UCITS ETF",
      isin: "IE00BK5BQT80",
      category: "Global / Weltportfolio",
      role: "Core / Weltportfolio",
      benchmark: "FTSE All-World",
      ter: 0.22,
      distribution: "Thesaurierend",
      currency: "EUR",
      fundCurrency: "USD",
      domicile: "Irland",
      replication: "Physisch",
      structureType: "UCITS",
      region: [["USA", 61], ["Europa", 16], ["Asien", 17], ["Sonstige", 6]],
      sectors: [["Technologie", 24], ["Finanzwerte", 15], ["Gesundheit", 11], ["Industrie", 10], ["Konsum", 10]],
      holdings: [["MSFT", 4.2], ["AAPL", 3.8], ["NVDA", 3.4], ["AMZN", 2.4], ["META", 1.6]],
      top10: 21,
      risk: "Globaler Aktienmarkt, USA trotzdem dominierend.",
      fxRisk: "Mehrwährungs-Exposure im Fonds",
      useCase: "Ein-Fonds-Weltportfolio für langfristige Kernanlage.",
      structure: "UCITS, thesaurierend, global diversifiziert.",
      dataNote: "Lokales UCITS-ETF-Modell."
    },
    {
      symbol: "IWM",
      name: "iShares Russell 2000 ETF",
      isin: "US4642876555",
      category: "US Small Cap",
      role: "Satellite / Small Caps",
      benchmark: "Russell 2000",
      ter: 0.19,
      distribution: "Ausschüttend",
      currency: "USD",
      fundCurrency: "USD",
      domicile: "USA",
      replication: "Physisch",
      structureType: "Nicht-UCITS",
      region: [["USA", 98], ["Sonstige", 2]],
      sectors: [["Finanzwerte", 18], ["Industrie", 17], ["Gesundheit", 16], ["Technologie", 14], ["Konsum", 11]],
      holdings: [["FTAI", 0.5], ["INSM", 0.4], ["VST", 0.4], ["SFM", 0.4], ["ANF", 0.3]],
      top10: 4.2,
      risk: "Sehr breit nach Einzeltiteln, aber zyklisch und zinssensitiv.",
      fxRisk: "USD-Risiko für EUR-Anleger",
      useCase: "Small-Cap-Satellit für Konjunktur- und Zinswendeszenarien.",
      structure: "Physisch replizierend, viele kleine Positionen, höhere Schwankung.",
      dataNote: "Lokale strukturierte ETF-Datenbasis; Holdings können sich stärker ändern."
    },
    {
      symbol: "DIA",
      name: "SPDR Dow Jones Industrial Average ETF",
      isin: "US78467X1090",
      category: "US Blue Chips",
      role: "Satellite / defensivere US-Blue-Chips",
      benchmark: "Dow Jones Industrial Average",
      ter: 0.16,
      distribution: "Ausschüttend",
      currency: "USD",
      fundCurrency: "USD",
      domicile: "USA",
      replication: "Physisch",
      structureType: "Nicht-UCITS",
      region: [["USA", 98], ["Sonstige", 2]],
      sectors: [["Industrie", 20], ["Finanzwerte", 18], ["Gesundheit", 17], ["Technologie", 16], ["Konsum", 13]],
      holdings: [["UNH", 8.4], ["GS", 7.0], ["MSFT", 6.8], ["HD", 5.8], ["CAT", 5.1]],
      top10: 52,
      risk: "Nur 30 Werte; dadurch deutlich konzentrierter als breite Markt-ETFs.",
      fxRisk: "USD-Risiko für EUR-Anleger",
      useCase: "Blue-Chip-Satellit mit stärkerer Einzelwertgewichtung.",
      structure: "Physisch replizierend, preisgewichteter Index, kein breiter Marktquerschnitt.",
      dataNote: "Lokale strukturierte ETF-Datenbasis."
    },
    {
      symbol: "GLD",
      name: "SPDR Gold Shares",
      isin: "US78463V1070",
      category: "Gold / Rohstoff",
      role: "Absicherung / Realzins-Hedge",
      benchmark: "Gold Spot",
      ter: 0.40,
      distribution: "Keine Ausschüttung",
      currency: "USD",
      fundCurrency: "USD",
      domicile: "USA",
      replication: "Physisch besichert",
      structureType: "Rohstoff-ETP",
      region: [["Gold", 100]],
      sectors: [["Edelmetalle", 100]],
      holdings: [["Physisches Gold", 100]],
      top10: 100,
      risk: "Keine Unternehmensdiversifikation; Preis hängt stark an Realzins, USD und Risikoappetit.",
      fxRisk: "Gold notiert in USD; EUR-Anleger haben zusätzlich Währungsbewegungen.",
      useCase: "Portfolio-Hedge gegen Realzins-, Dollar- und Stressphasen.",
      structure: "Physisch besichert, kein Aktien-ETF, kein laufender Cashflow.",
      dataNote: "Lokales Rohstoff-ETF/ETP-Modell."
    },
    {
      symbol: "SLV",
      name: "iShares Silver Trust",
      isin: "US46428Q1094",
      category: "Silber / Rohstoff",
      role: "Satellite / Edelmetall",
      benchmark: "Silver Spot",
      ter: 0.50,
      distribution: "Keine Ausschüttung",
      currency: "USD",
      fundCurrency: "USD",
      domicile: "USA",
      replication: "Physisch besichert",
      structureType: "Rohstoff-ETP",
      region: [["Silber", 100]],
      sectors: [["Edelmetalle", 100]],
      holdings: [["Physisches Silber", 100]],
      top10: 100,
      risk: "Höhere Volatilität als Gold, zusätzlich Industriezyklus- und Liquiditätsrisiko.",
      fxRisk: "Silber notiert in USD; EUR-Anleger haben zusätzlich Währungseinfluss.",
      useCase: "Taktischer Edelmetall-Satellit, nicht als breiter Core-Baustein gedacht.",
      structure: "Physisch besichert, kein Aktien-ETF, keine laufenden Ausschüttungen.",
      dataNote: "Lokales Rohstoff-ETF/ETP-Modell."
    },
    {
      symbol: "TLT",
      name: "iShares 20+ Year Treasury Bond ETF",
      isin: "US4642874329",
      category: "US Staatsanleihen",
      role: "Duration / Rezessions-Hedge",
      benchmark: "ICE U.S. Treasury 20+ Year",
      ter: 0.15,
      distribution: "Ausschüttend",
      currency: "USD",
      fundCurrency: "USD",
      domicile: "USA",
      replication: "Physisch",
      structureType: "Nicht-UCITS",
      region: [["USA", 100]],
      sectors: [["Staatsanleihen", 100]],
      holdings: [["US Treasury 20+Y", 100]],
      top10: 58,
      risk: "Sehr hohes Duration-Risiko: steigende Renditen können stark belasten.",
      fxRisk: "USD-Risiko für EUR-Anleger",
      useCase: "Zins- und Rezessionsbaustein, nicht mit Aktien-ETF-Risiko vergleichbar.",
      structure: "Langlaufende US-Staatsanleihen; stark zinssensitiv.",
      dataNote: "Lokales Anleihe-ETF-Modell."
    },
    {
      symbol: "EEM",
      name: "iShares MSCI Emerging Markets ETF",
      isin: "US4642872349",
      category: "Emerging Markets",
      role: "Satellite / Schwellenländer",
      benchmark: "MSCI Emerging Markets",
      ter: 0.70,
      distribution: "Ausschüttend",
      currency: "USD",
      fundCurrency: "USD",
      domicile: "USA",
      replication: "Physisch",
      structureType: "Nicht-UCITS",
      region: [["Asien", 76], ["Lateinamerika", 9], ["EMEA", 9], ["Sonstige", 6]],
      sectors: [["Technologie", 22], ["Finanzwerte", 21], ["Konsum", 13], ["Kommunikation", 10], ["Rohstoffe", 8]],
      holdings: [["TSM", 8.5], ["Tencent", 4.0], ["Samsung", 3.6], ["Alibaba", 2.4], ["Reliance", 1.4]],
      top10: 26,
      risk: "Schwellenländer-, China-/Taiwan-, Politik- und Währungsrisiken.",
      fxRisk: "USD-Notierung plus lokale EM-Währungen im Fonds",
      useCase: "EM-Satellit für globale Diversifikation, aber kein ruhiger Core-Ersatz.",
      structure: "Breit über Schwellenländer, aber mit Asien- und Taiwan-Schwerpunkt.",
      dataNote: "Lokale strukturierte ETF-Datenbasis."
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
    investor: {
      label: "Investor",
      description: "Research, Watchlist, Portfolio, Events, Makro und Reports werden nach vorne gezogen.",
      modules: { portfolio: "high", watchlist: "high", assetResearch: "high", events: "normal", macro: "normal", reports: "normal", dailyRecap: "normal", dataHealth: "normal" },
      shortcuts: ["watchlist", "portfolio", "asset", "events", "reports"],
      profile: { goal: "wealth", horizon: "long", risk: "medium", experience: "advanced", focus: ["stocks", "portfolio", "macro"] }
    },
    trader: {
      label: "Trader",
      description: "Tages-Recap, Bewegungen, Alerts, Events, Compare und Screener dominieren die Startseite.",
      modules: { dailyRecap: "high", dailyBriefing: "high", alerts: "high", events: "normal", quickCompare: "normal", screener: "normal", watchlist: "normal", macro: "normal" },
      shortcuts: ["today", "alerts", "events", "compare", "screener"],
      profile: { goal: "trading", horizon: "short", risk: "high", experience: "advanced", focus: ["stocks", "tech", "crypto"] }
    },
    etf: {
      label: "ETF-Anleger",
      description: "ETF V2, Portfolio-Fit, Kosten, Overlap, Makro und Reports werden priorisiert.",
      modules: { etf: "high", portfolio: "high", quickCompare: "normal", macro: "normal", reports: "normal", watchlist: "normal", dailyRecap: "normal" },
      shortcuts: ["etf", "compare", "portfolio", "reports", "macro"],
      profile: { goal: "wealth", horizon: "long", risk: "medium", experience: "beginner", focus: ["etfs", "portfolio", "macro"] }
    },
    macro: {
      label: "Makro",
      description: "Makroampel, Ländervergleich, Zinsen, FX, Liquidität und Asset-Implikationen stehen vorne.",
      modules: { macro: "high", liquidity: "high", dailyBriefing: "normal", dailyRecap: "normal", etf: "normal", reports: "normal", dataHealth: "normal" },
      shortcuts: ["macro", "dataHealth", "reports", "events", "watchlist"],
      profile: { goal: "learning", horizon: "medium", risk: "medium", experience: "advanced", focus: ["macro", "commodities", "portfolio"] }
    },
    learning: {
      label: "Anfänger / Learning",
      description: "Tagesüberblick, Research-Snapshot, einfache Kennzahlen und Erklärtexte werden sichtbarer.",
      modules: { dailyBriefing: "high", dailyRecap: "high", assetResearch: "normal", macro: "normal", etf: "normal", watchlist: "normal", reports: "normal", dataHealth: "normal" },
      shortcuts: ["today", "asset", "watchlist", "macro", "dataHealth"],
      profile: { goal: "learning", horizon: "long", risk: "low", experience: "beginner", focus: ["etfs", "macro", "portfolio"] }
    },
    portfolio: {
      label: "Portfolio-Fokus",
      description: "Portfolio, Risiko, Exposure, Rebalancing, Watchlist, Alerts und Reports werden priorisiert.",
      modules: { portfolio: "high", watchlist: "high", alerts: "normal", dailyRecap: "normal", events: "normal", macro: "normal", reports: "normal" },
      shortcuts: ["portfolio", "alerts", "watchlist", "reports", "dataHealth"],
      profile: { goal: "capital_preservation", horizon: "long", risk: "low", experience: "advanced", focus: ["portfolio", "etfs", "dividends"] }
    }
  };

  const HOME_MODULE_CATALOG = [
    { id: "dailyRecap", label: "Tages-Recap", description: "Was habe ich heute verpasst?", route: "home" },
    { id: "dailyBriefing", label: "Tagesüberblick", description: "Marktphase, Bewegungen und Termine", route: "home" },
    { id: "portfolio", label: "Portfolio", description: "Wert, Risiko, Exposure und Rebalancing", route: "portfolio" },
    { id: "watchlist", label: "Watchlist", description: "Beobachtete und favorisierte Assets", route: "portfolio" },
    { id: "events", label: "Events", description: "Earnings, Makrotermine und Kalender", route: "events" },
    { id: "alerts", label: "Alerts", description: "Offene, ausgelöste und wichtige Hinweise", route: "alerts" },
    { id: "etf", label: "ETF", description: "ETF-Kosten, Overlap und Portfolio-Fit", route: "etf" },
    { id: "macro", label: "Makro", description: "Makroampel und Ländervergleich", route: "macro" },
    { id: "liquidity", label: "Liquidität", description: "Geldmengen, Realzins und Kurve", route: "liquidity" },
    { id: "quickCompare", label: "Quick Compare", description: "Zwei Assets direkt vergleichen", route: "compare" },
    { id: "screener", label: "Screener", description: "Datengetriebene Asset-Auswahl", route: "screener" },
    { id: "reports", label: "Reports", description: "Research als Browser-PDF exportieren", route: "research" },
    { id: "assetResearch", label: "Asset-Research", description: "5-Minuten-Research für den aktiven Wert", route: "asset" },
    { id: "dataHealth", label: "Data Health", description: "Quellen, Status und Datenqualität", route: "data-health" }
  ];

  const SHORTCUT_CATALOG = [
    { id: "watchlist", label: "Meine Watchlist", route: "portfolio" },
    { id: "portfolio", label: "Mein Portfolio", route: "portfolio" },
    { id: "asset", label: "Aktives Asset", route: "asset" },
    { id: "today", label: "Heute wichtig", route: "home" },
    { id: "alerts", label: "Alerts", route: "alerts" },
    { id: "etf", label: "ETF-Bereich", route: "etf" },
    { id: "etfCompare", label: "ETF Compare", route: "etf" },
    { id: "macro", label: "Makroampel", route: "macro" },
    { id: "reports", label: "Report erstellen", route: "research" },
    { id: "events", label: "Event-Hub", route: "events" },
    { id: "compare", label: "Quick Compare", route: "compare" },
    { id: "screener", label: "Screener", route: "screener" },
    { id: "dataHealth", label: "Data Health", route: "data-health" }
  ];

  const PROFILE_OPTION_LABELS = {
    goal: {
      wealth: "Vermögensaufbau",
      trading: "Trading",
      income: "Einkommen / Dividenden",
      capital_preservation: "Kapitalerhalt",
      learning: "Lernen / Bildung"
    },
    horizon: { short: "kurzfristig", medium: "mittelfristig", long: "langfristig" },
    risk: { low: "niedrig", medium: "mittel", high: "hoch" },
    experience: { beginner: "Anfänger", advanced: "fortgeschritten", experienced: "erfahren" },
    focus: {
      stocks: "Aktien",
      etfs: "ETFs",
      macro: "Makro",
      dividends: "Dividenden",
      tech: "Tech",
      commodities: "Rohstoffe",
      crypto: "Krypto",
      portfolio: "Portfolio"
    }
  };

  const SCREENER_DEFAULT_FILTERS = {
    search: "",
    preset: "all",
    assetType: "all",
    region: "all",
    style: "all",
    dataStatus: "all",
    personal: "all",
    eventContext: "all",
    rating: "all",
    momentum: "all",
    value: "all",
    growth: "all",
    marketCap: "all",
    sector: "all",
    performance: "all",
    sort: "score"
  };

  const SCREENER_PRESETS = [
    { id: "all", label: "Alle Assets", text: "Breiter Scan ohne Spezialfilter.", filters: {} },
    { id: "momentum", label: "Momentum-Stars", text: "Starke technische und kurzfristige relative Stärke.", filters: { style: "momentum", momentum: "70", sort: "momentum" } },
    { id: "value", label: "Value-Kandidaten", text: "Bewertung wirkt im lokalen Modell attraktiver.", filters: { style: "value", value: "60", sort: "value" } },
    { id: "growth", label: "Growth-Kandidaten", text: "Wachstum und Qualität stehen im Vordergrund.", filters: { style: "growth", growth: "70", sort: "growth" } },
    { id: "quality", label: "Quality-Werte", text: "Qualität, Stabilität und Datenlage stärker gewichtet.", filters: { style: "quality", sort: "quality" } },
    { id: "risk", label: "Risk-Warnungen", text: "Volatilität, schwache Technik oder Datenlücken prüfen.", filters: { style: "highVolatility", sort: "risk" } },
    { id: "eventWeek", label: "Event-Woche", text: "Assets mit relevanten Terminen in dieser Woche.", filters: { eventContext: "week", sort: "event" } },
    { id: "watchlist", label: "Watchlist-Auffälligkeiten", text: "Persönliche Beobachtungsliste mit V2-Signalen.", filters: { personal: "watchlist", sort: "score" } },
    { id: "etf", label: "ETF-Check", text: "ETF-Struktur, Kosten, Risiko und Datenstatus.", filters: { assetType: "ETF", sort: "quality" } },
    { id: "favorites", label: "Favoriten-Scan", text: "Deine Favoriten mit transparenten Score-Treibern.", filters: { personal: "favorites", sort: "score" } }
  ];

  function defaultUserPreferences(mode = "investor") {
    const safeMode = DASHBOARD_MODES[mode] ? mode : "investor";
    const config = DASHBOARD_MODES[safeMode];
    return {
      version: 2,
      mode: safeMode,
      modules: normalizedModulePreferences(config.modules, "hidden"),
      favorites: ["NVDA", "MSFT", "SPY"],
      shortcuts: config.shortcuts.slice(0, 6),
      profile: {
        goal: config.profile.goal,
        horizon: config.profile.horizon,
        risk: config.profile.risk,
        experience: config.profile.experience,
        focus: [...config.profile.focus]
      },
      display: {
        detail: "normal",
        numberFormat: "de",
        currency: "EUR",
        performanceView: "percentFirst",
        beginnerHelp: config.profile.experience === "beginner",
        dataStatus: "normal"
      },
      defaults: {
        screener: { ...SCREENER_DEFAULT_FILTERS },
        eventHub: { window: "week", type: "all", scope: "all", relevance: "all" },
        etf: { left: "SPY", right: "QQQ", amount: 10000, monthly: 250, years: 10, returnRate: 5 },
        portfolio: { activePortfolioId: "core", view: "overview" },
        compare: { left: "NVDA", right: "MSFT" },
        reports: { type: "asset", showDataStatus: true }
      }
    };
  }

  function normalizeUserPreferences(saved, legacy = null) {
    const legacyMode = legacy?.mode === "standard" ? "investor" : legacy?.mode;
    const base = defaultUserPreferences(saved?.mode || legacyMode || "investor");
    const merged = {
      ...base,
      ...(saved && typeof saved === "object" ? saved : {}),
      favorites: sanitizeFavoriteSymbols(saved?.favorites || legacy?.favorites || base.favorites),
      shortcuts: sanitizeShortcuts(saved?.shortcuts || base.shortcuts),
      modules: normalizedModulePreferences({ ...base.modules, ...(saved?.modules || legacyModulesToPreferences(legacy?.modules) || {}) }, "hidden"),
      profile: {
        ...base.profile,
        ...(saved?.profile && typeof saved.profile === "object" ? saved.profile : {}),
        focus: sanitizeFocusList(saved?.profile?.focus || base.profile.focus)
      },
      display: {
        ...base.display,
        ...(saved?.display && typeof saved.display === "object" ? saved.display : {})
      },
      defaults: {
        ...base.defaults,
        ...(saved?.defaults && typeof saved.defaults === "object" ? saved.defaults : {}),
        screener: { ...base.defaults.screener, ...(saved?.defaults?.screener || {}) },
        eventHub: { ...base.defaults.eventHub, ...(saved?.defaults?.eventHub || {}) },
        etf: { ...base.defaults.etf, ...(saved?.defaults?.etf || {}) },
        portfolio: { ...base.defaults.portfolio, ...(saved?.defaults?.portfolio || {}) },
        compare: { ...base.defaults.compare, ...(saved?.defaults?.compare || {}) },
        reports: { ...base.defaults.reports, ...(saved?.defaults?.reports || {}) }
      }
    };
    merged.mode = DASHBOARD_MODES[merged.mode] ? merged.mode : base.mode;
    merged.display.detail = ["compact", "normal", "detailed"].includes(merged.display.detail) ? merged.display.detail : "normal";
    merged.display.numberFormat = ["de", "en"].includes(merged.display.numberFormat) ? merged.display.numberFormat : "de";
    merged.display.currency = ["EUR", "USD"].includes(merged.display.currency) ? merged.display.currency : "EUR";
    merged.display.performanceView = ["percentFirst", "amountFirst"].includes(merged.display.performanceView) ? merged.display.performanceView : "percentFirst";
    merged.display.dataStatus = ["compact", "normal", "detailed"].includes(merged.display.dataStatus) ? merged.display.dataStatus : "normal";
    merged.display.beginnerHelp = Boolean(merged.display.beginnerHelp);
    return merged;
  }

  function normalizedModulePreferences(modules = {}, fallbackPriority = "normal") {
    const source = Array.isArray(modules)
      ? Object.fromEntries(modules.map((id, index) => [id, index < 3 ? "high" : "normal"]))
      : modules;
    return HOME_MODULE_CATALOG.reduce((acc, module) => {
      const value = source?.[module.id];
      acc[module.id] = ["high", "normal", "hidden"].includes(value) ? value : fallbackPriority;
      return acc;
    }, {});
  }

  function legacyModulesToPreferences(modules) {
    if (!Array.isArray(modules)) {
      return null;
    }
    return Object.fromEntries(modules.map((id, index) => [id, index < 3 ? "high" : "normal"]));
  }

  function sanitizeFavoriteSymbols(symbols = []) {
    return unique(symbols.map(normalizeSymbol).filter((symbol) => ASSETS.some((asset) => asset.symbol === symbol))).slice(0, 12);
  }

  function sanitizeShortcuts(shortcuts = []) {
    const valid = new Set(SHORTCUT_CATALOG.map((shortcut) => shortcut.id));
    return [...new Set(shortcuts.map(String).filter((id) => valid.has(id)))].slice(0, 6);
  }

  function sanitizeFocusList(focus = []) {
    const valid = new Set(Object.keys(PROFILE_OPTION_LABELS.focus));
    return [...new Set(focus.map(String).filter((item) => valid.has(item)))].slice(0, 5);
  }

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
      id: "DGS2",
      label: "US 2Y Yield",
      value: 4.7,
      display: "4.70%",
      trend: "2Y spiegelt Leitzins- und Senkungserwartungen",
      source: "Lokaler Treasury/FRED-Fallback",
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
    { id: "DGS2", seriesId: "DGS2", label: "US 2Y Yield", suffix: "%", mode: "level" },
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
    { country: "Eurozone", indicator: "BIP-Wachstum", value: 0.8, display: "+0.8%", source: "Lokaler Eurozone-Fallback", status: "fallback" },
    { country: "Deutschland", indicator: "BIP-Wachstum", value: 0.2, display: "+0.2%", source: "Lokaler World-Bank-Fallback", status: "fallback" },
    { country: "China", indicator: "BIP-Wachstum", value: 4.8, display: "+4.8%", source: "Lokaler World-Bank-Fallback", status: "fallback" },
    { country: "USA", indicator: "Staatsverschuldung", value: 121, display: "121%", source: "Lokaler World-Bank/IMF-Fallback", status: "fallback" },
    { country: "Eurozone", indicator: "Staatsverschuldung", value: 88, display: "88%", source: "Lokaler Eurozone-Fallback", status: "fallback" },
    { country: "Deutschland", indicator: "Staatsverschuldung", value: 64, display: "64%", source: "Lokaler World-Bank/Eurostat-Fallback", status: "fallback" },
    { country: "China", indicator: "Staatsverschuldung", value: 84, display: "84%", source: "Lokaler World-Bank/IMF-Fallback", status: "fallback" }
  ];

  const MACRO_COUNTRY_BASELINES = [
    {
      id: "usa",
      name: "USA",
      currency: "USD",
      region: "Nordamerika",
      dataRole: "US-Makro live/hybrid",
      source: "FRED, BLS, Treasury, World Bank/IMF",
      gdp: 2.5,
      inflation: 3.1,
      unemployment: 4.0,
      policyRate: 4.5,
      yield2: 4.7,
      yield10: 4.35,
      debt: 121,
      liquidity: 1.8,
      fxLabel: "DXY / EURUSD",
      fxValue: 104.2,
      fxDisplay: "DXY 104,2",
      status: "hybrid"
    },
    {
      id: "eurozone",
      name: "Eurozone",
      currency: "EUR",
      region: "Europa",
      dataRole: "Euro-Makro hybrid",
      source: "ECB, Eurostat/OECD zugeordnet, lokale Strukturwerte",
      gdp: 0.8,
      inflation: 2.4,
      unemployment: 6.4,
      policyRate: 4.0,
      yield2: 2.7,
      yield10: 2.55,
      debt: 88,
      liquidity: 0.9,
      fxLabel: "EUR/USD",
      fxValue: 1.08,
      fxDisplay: "EUR/USD 1,08",
      status: "fallback"
    },
    {
      id: "germany",
      name: "Deutschland",
      currency: "EUR",
      region: "Europa",
      dataRole: "Länderprofil hybrid",
      source: "World Bank/IMF, Eurostat/OECD zugeordnet, lokale Strukturwerte",
      gdp: 0.2,
      inflation: 2.2,
      unemployment: 3.2,
      policyRate: 4.0,
      yield2: 2.55,
      yield10: 2.35,
      debt: 64,
      liquidity: 0.9,
      fxLabel: "EUR/USD",
      fxValue: 1.08,
      fxDisplay: "EUR/USD 1,08",
      status: "fallback"
    },
    {
      id: "china",
      name: "China",
      currency: "CNY",
      region: "Asien",
      dataRole: "China-Makro fallback/hybrid",
      source: "World Bank/IMF plus lokale Strukturwerte",
      gdp: 4.8,
      inflation: 0.2,
      unemployment: 5.2,
      policyRate: 3.45,
      yield2: 2.0,
      yield10: 2.4,
      debt: 84,
      liquidity: 6.2,
      fxLabel: "USD/CNY",
      fxValue: 7.2,
      fxDisplay: "USD/CNY 7,20",
      status: "fallback"
    }
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

  const JOURNAL_DECISION_TYPES = [
    { value: "buy", label: "Kauf" },
    { value: "sell", label: "Verkauf" },
    { value: "observe", label: "Beobachtung" },
    { value: "skip", label: "Nicht-Kauf / ausgelassen" },
    { value: "rebalance", label: "Rebalancing" },
    { value: "portfolio", label: "Portfolio-Änderung" }
  ];

  const JOURNAL_CATEGORIES = [
    { value: "trading", label: "Trading" },
    { value: "longterm", label: "Langfrist-Investment" },
    { value: "etf", label: "ETF / Sparplan" },
    { value: "macro", label: "Makro-/Themenentscheidung" }
  ];

  const JOURNAL_EMOTIONS = [
    { value: "calm", label: "Ruhig" },
    { value: "convinced", label: "Überzeugt" },
    { value: "unsure", label: "Unsicher" },
    { value: "fomo", label: "FOMO" },
    { value: "fear", label: "Angst" },
    { value: "stress", label: "Stress" },
    { value: "euphoria", label: "Euphorie" },
    { value: "frustration", label: "Frust" },
    { value: "neutral", label: "Neutral" }
  ];

  const JOURNAL_RULE_OPTIONS = [
    { value: "yes", label: "Ja" },
    { value: "partial", label: "Teilweise" },
    { value: "no", label: "Nein" }
  ];

  const JOURNAL_MISTAKE_TAGS = [
    { value: "fomo", label: "FOMO-Einstieg" },
    { value: "overconfidence", label: "Overconfidence" },
    { value: "loss_aversion", label: "Verlustaversion" },
    { value: "early_sell", label: "Zu früh verkauft" },
    { value: "late_reaction", label: "Zu spät reagiert" },
    { value: "position_size", label: "Positionsgröße" },
    { value: "no_thesis", label: "Fehlende These" },
    { value: "news_chasing", label: "News/Hype gejagt" },
    { value: "impatience", label: "Mangelnde Geduld" },
    { value: "rule_break", label: "Regelbruch" }
  ];

  const GUIDANCE_DEMO_SYMBOLS = ["NVDA", "AAPL", "MSFT", "TSLA", "SPY", "QQQ", "GLD", "BTC"];

  const GUIDED_START_ITEMS = [
    { id: "watchlist", label: "Watchlist anlegen", text: "Speichere 3 bis 5 Werte, die du wirklich beobachten willst.", route: "portfolio", action: "demo-add", xp: 20 },
    { id: "asset", label: "Erstes Asset analysieren", text: "Oeffne eine Asset-Seite und lies den 5-Minuten-Research-Snapshot.", route: "asset", xp: 15 },
    { id: "portfolio", label: "Testportfolio pruefen", text: "Sieh dir Risiko, Exposure und groesste Positionen im Portfolio an.", route: "portfolio", xp: 25 },
    { id: "etf", label: "ETF vergleichen", text: "Pruefe Kosten, Overlap und Portfolio-Fit zweier ETFs.", route: "etf", xp: 20 },
    { id: "alert", label: "Alert setzen", text: "Lege eine einfache Preis- oder Watchlist-Regel an.", route: "alerts", xp: 20 },
    { id: "report", label: "Report exportieren", text: "Erstelle einen Tages-, Asset- oder Portfolio-Report als Druckansicht.", route: "research", xp: 30 }
  ];

  const GLOSSARY_TERMS = [
    { id: "kgv", term: "KGV", aliases: ["pe", "price earnings"], text: "Kurs-Gewinn-Verhaeltnis: Preis im Verhaeltnis zum Gewinn je Aktie.", why: "Hilft, Bewertung grob einzuordnen, ist aber ohne Wachstum und Qualitaet unvollstaendig.", where: "Asset-Seite, Screener Value Score, Reports" },
    { id: "eps", term: "EPS", aliases: ["gewinn je aktie"], text: "Earnings per Share: Gewinn je Aktie.", why: "Zeigt, wie viel Gewinn auf eine Aktie entfaellt.", where: "Asset-Seite und Fundamentaldaten" },
    { id: "ter", term: "TER", aliases: ["kostenquote", "etf kosten"], text: "Total Expense Ratio: laufende jaehrliche Kostenquote eines ETFs.", why: "Kleine Kostenunterschiede koennen langfristig spuerbar werden.", where: "ETF V2, ETF-Report, ETF-Asset-Seiten" },
    { id: "yield-curve", term: "Yield Curve", aliases: ["zinskurve", "inverse yield curve"], text: "Vergleicht Renditen verschiedener Laufzeiten, z. B. 2J gegen 10J.", why: "Eine inverse Kurve kann Wachstumssorgen und restriktive Bedingungen signalisieren.", where: "Makro V2, Makro-Report" },
    { id: "realzins", term: "Realzins", aliases: ["real rate"], text: "Zinsniveau abzüglich Inflation, hier bewusst als Naeherung gezeigt.", why: "Hohe Realzinsen koennen Bewertungsdruck auf Gold, Growth und Krypto erhoehen.", where: "Makro V2 und Asset-Implikationen" },
    { id: "drawdown", term: "Drawdown", aliases: ["verlust vom hoch"], text: "Rueckgang vom Zwischenhoch bis zum Tief.", why: "Macht Risiko und emotionale Belastung sichtbarer als nur Rendite.", where: "Portfolio, Risiko, Research-Kontext" },
    { id: "volatilitaet", term: "Volatilitaet", aliases: ["vola", "schwankung"], text: "Schwankungsintensitaet eines Assets.", why: "Hohe Volatilitaet kann Chancen, aber auch Positionsrisiko erhoehen.", where: "Screener Risk Score, Asset-Technik, Portfolio" },
    { id: "overlap", term: "Overlap", aliases: ["ueberschneidung", "doppelt"], text: "Ueberschneidung zwischen zwei ETFs oder Positionen.", why: "Zu viel Overlap kann Diversifikation nur scheinbar verbessern.", where: "ETF V2, Quick Compare, Portfolio-Fit" },
    { id: "free-cashflow", term: "Free Cashflow", aliases: ["fcf"], text: "Geldfluss, der nach Investitionen uebrig bleibt.", why: "Wichtig fuer Qualitaet, Dividenden, Rueckkaeufe und Schuldentragfaehigkeit.", where: "Asset-Research und Quality Score, soweit Daten vorhanden" },
    { id: "debt-to-gdp", term: "Debt-to-GDP", aliases: ["staatsverschuldung", "verschuldung"], text: "Staatsschulden im Verhaeltnis zur Wirtschaftsleistung.", why: "Gibt Kontext zu fiskalischem Spielraum und Zinslast.", where: "Makro-/Laendervergleich V2" },
    { id: "momentum", term: "Momentum", aliases: ["trendstaerke"], text: "Relative Staerke aus Bewegung, Trend und Aktivitaet.", why: "Hilft, starke oder schwache Setups zu erkennen, kann aber ueberhitzen.", where: "Screener, Top Picks, Asset-Technik" },
    { id: "value", term: "Value", aliases: ["bewertung"], text: "Bewertungsorientierte Einordnung eines Assets.", why: "Kann guenstige Kandidaten zeigen, ist aber ohne Qualitaet kein Signal.", where: "Screener Value Score und Asset-Research" },
    { id: "growth", term: "Growth", aliases: ["wachstum"], text: "Wachstumsorientierte Einordnung aus Umsatz-/Gewinn- oder Modellnaehe.", why: "Starkes Wachstum kann hohe Bewertung erklaeren, aber auch Erwartungen erhoehen.", where: "Screener Growth Score und Asset-Seiten" },
    { id: "hybrid", term: "Hybrid-Daten", aliases: ["hybrid daten"], text: "Mischung aus echten Datenpfaden und lokaler Produktlogik oder Fallbacks.", why: "Zeigt transparent, dass nicht jeder Baustein voll live ist.", where: "Data Health, Reports, Asset-Seiten" },
    { id: "fallback", term: "Fallback-Daten", aliases: ["fallback"], text: "Strukturierte lokale Ersatzdaten, wenn Live-Daten fehlen.", why: "Die App bleibt nutzbar, verkauft Fallback aber nicht als Live-Wahrheit.", where: "Data Health und Status-Badges" },
    { id: "etf", term: "ETF", aliases: ["fonds"], text: "Boersengehandelter Fonds, oft als breiter Baustein fuer Regionen oder Themen.", why: "Kann Diversifikation bieten, aber Kosten, Overlap und Konzentration bleiben wichtig.", where: "ETF V2, Portfolio, Quick Compare" },
    { id: "dividende", term: "Dividende", aliases: ["ausschuettung"], text: "Ausschuettung eines Unternehmens oder Fonds an Anleger.", why: "Relevant fuer Einkommen, Termine und ETF-Ausschuettungslogik.", where: "Event-Hub, ETF V2, Alerts" },
    { id: "market-cap", term: "Marktkapitalisierung", aliases: ["market cap"], text: "Boersenwert eines Unternehmens: Aktienkurs mal Anzahl Aktien.", why: "Hilft bei Groesse, Liquiditaet und Risikoklasse.", where: "Asset-Seiten, Screener-Filter" }
  ];

  const QUIZ_QUESTIONS = [
    { id: "q-kgv", question: "Was beschreibt das KGV?", options: ["Preis im Verhaeltnis zum Gewinn", "Jaehrliche ETF-Kosten", "Schwankung eines Assets"], answer: 0, explain: "KGV steht fuer Kurs-Gewinn-Verhaeltnis." },
    { id: "q-ter", question: "Warum ist TER bei ETFs wichtig?", options: ["Sie beeinflusst laufende Kosten", "Sie ist ein Kursziel", "Sie misst die Arbeitslosenquote"], answer: 0, explain: "TER sind laufende Kosten und wirken langfristig auf das Endvermoegen." },
    { id: "q-curve", question: "Was kann eine inverse Yield Curve signalisieren?", options: ["Wachstums- oder Stresssignal", "Garantiert steigende Aktien", "Keine Aussage moeglich, weil Zinsen irrelevant sind"], answer: 0, explain: "Eine inverse Kurve ist kein Garant, aber ein relevantes Makro-Stresssignal." },
    { id: "q-realzins", question: "Was ist Realzins in der einfachen MH-Logik?", options: ["Zins minus Inflation", "Inflation plus Umsatz", "ETF-Kosten minus Dividende"], answer: 0, explain: "Realzins wird hier als grobe Naeherung aus Rendite/Zins minus Inflation genutzt." },
    { id: "q-overlap", question: "Was bedeutet ETF-Overlap?", options: ["Ueberschneidung der enthaltenen Werte", "Steuerliche Behandlung", "Chartfarbe im ETF-Modul"], answer: 0, explain: "Overlap zeigt, ob zwei ETFs aehnliche Holdings oder Regionen kaufen." },
    { id: "q-vola", question: "Was beschreibt Volatilitaet?", options: ["Schwankungsintensitaet", "Umsatzsteuer", "Dividendentermin"], answer: 0, explain: "Volatilitaet zeigt, wie stark ein Asset schwankt." }
  ];

  const FEATURE_COMMANDS = [
    { id: "asset-nvda", label: "Nvidia analysieren", text: "Oeffnet die Asset-Seite fuer NVDA.", route: "asset", symbol: "NVDA", keywords: ["nvidia", "nvda", "aktie analysieren"] },
    { id: "etf-compare", label: "ETF vergleichen", text: "Kosten, Overlap, Holdings und Portfolio-Fit pruefen.", route: "etf", keywords: ["etf", "ter", "overlap", "kosten", "vwce", "vti"] },
    { id: "report", label: "Report erstellen", text: "Oeffnet das Research-/Report-Center.", route: "research", keywords: ["report", "pdf", "drucken", "export"] },
    { id: "portfolio", label: "Portfolio pruefen", text: "Risiko, Exposure, Cash und Rebalancing ansehen.", route: "portfolio", keywords: ["portfolio", "depot", "risiko", "exposure"] },
    { id: "macro", label: "Makro ansehen", text: "Inflation, Zinsen, Yield Curve, Realzins und Laendervergleich.", route: "macro", keywords: ["makro", "zinsen", "inflation", "yield curve", "realzins"] },
    { id: "alert", label: "Alert setzen", text: "Preis-, Earnings-, Event- oder Watchlist-Alert anlegen.", route: "alerts", keywords: ["alert", "alarm", "benachrichtigung", "preis"] },
    { id: "watchlist", label: "Watchlist oeffnen", text: "Beobachtete Werte und Watchlist-Report ansehen.", route: "portfolio", keywords: ["watchlist", "beobachten"] },
    { id: "data-health", label: "Data Health ansehen", text: "Quellen, Live/Hybrid/Fallback und Modulstatus pruefen.", route: "data-health", keywords: ["data health", "daten", "quellen", "fallback", "hybrid"] },
    { id: "screener", label: "Screener starten", text: "Ratings, Top Picks, Filter und transparente Scores nutzen.", route: "screener", keywords: ["screener", "rating", "top picks", "momentum"] },
    { id: "demo-add", label: "Demo-Daten laden", text: "Lokales Beispielsetup mit Watchlist, Testportfolio und Alerts.", action: "demo-add", keywords: ["demo", "beispiel", "start"] },
    { id: "glossary-kgv", label: "KGV erklaeren", text: "Kurze Glossar-Erklaerung zu Bewertung.", glossary: "kgv", keywords: ["kgv", "pe", "erklaeren"] },
    { id: "glossary-hybrid", label: "Hybrid-Daten erklaeren", text: "Was Live, Hybrid und Fallback in MH Analytics bedeuten.", glossary: "hybrid", keywords: ["hybrid", "fallback", "datenstatus"] }
  ];

  const LEVELS = [
    { level: 1, xp: 0, label: "Starter" },
    { level: 2, xp: 50, label: "Watchlist-Nutzer" },
    { level: 3, xp: 110, label: "Researcher" },
    { level: 4, xp: 190, label: "Portfolio-Analyst" },
    { level: 5, xp: 290, label: "Macro Thinker" },
    { level: 6, xp: 420, label: "Advanced Researcher" }
  ];

  const state = {
    route: "home",
    activeSymbol: storageGet(STORAGE_KEYS.activeSymbol, "NVDA"),
    theme: storageGet(STORAGE_KEYS.theme, "dark"),
    providerHealth: sanitizeProviderHealth(storageGet(STORAGE_KEYS.providerHealth, {})),
    watchlist: storageGet(STORAGE_KEYS.watchlist, DEFAULT_WATCHLIST),
    portfolios: storageGet(STORAGE_KEYS.portfolios, DEFAULT_PORTFOLIOS),
    activePortfolioId: storageGet(STORAGE_KEYS.activePortfolioId, "core"),
    userPreferences: normalizeUserPreferences(storageGet(STORAGE_KEYS.userPreferences, null), storageGet(STORAGE_KEYS.dashboardPrefs, null)),
    dashboardPrefs: storageGet(STORAGE_KEYS.dashboardPrefs, null),
    alerts: storageGet(STORAGE_KEYS.alerts, []),
    alertInbox: storageGet(STORAGE_KEYS.alertInbox, []),
    journal: storageGet(STORAGE_KEYS.journal, []),
    onboarding: normalizeOnboardingState(storageGet(STORAGE_KEYS.onboarding, {})),
    activity: normalizeActivityState(storageGet(STORAGE_KEYS.activity, [])),
    learning: normalizeLearningState(storageGet(STORAGE_KEYS.learning, {})),
    level: normalizeLevelState(storageGet(STORAGE_KEYS.level, {})),
    demoState: storageGet(STORAGE_KEYS.demoState, { loaded: false, updatedAt: null }),
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
    journalFilters: {
      search: "",
      type: "all",
      category: "all",
      emotion: "all",
      mistake: "all",
      review: "all"
    },
    journalDraft: null,
    screener: { ...SCREENER_DEFAULT_FILTERS },
    etf: {
      left: "SPY",
      right: "QQQ",
      amount: 10000,
      monthly: 250,
      years: 10,
      returnRate: 5
    },
    portfolioScenario: {
      shock: -10,
      contribution: 500,
      symbol: "SPY",
      quantity: 0,
      avgPrice: "",
      cashChange: 0
    },
    commandQuery: "",
    helpOpen: false,
    helpQuery: "",
    helpAnswer: null,
    importPreview: null,
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
    persistUserPreferences();
    applyPreferenceDefaults();
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

    const etfPortfolioFit = event.target.closest("[data-etf-portfolio-fit]");
    if (etfPortfolioFit) {
      openEtfPortfolioFit(etfPortfolioFit.dataset.etfPortfolioFit);
      return;
    }

    const journalOpen = event.target.closest("[data-journal-open]");
    if (journalOpen) {
      openJournalDraft(journalOpen.dataset.journalOpen, journalOpen.dataset.journalContext || "");
      return;
    }

    const journalEdit = event.target.closest("[data-journal-edit]");
    if (journalEdit) {
      editJournalEntry(journalEdit.dataset.journalEdit);
      return;
    }

    const journalDelete = event.target.closest("[data-journal-delete]");
    if (journalDelete) {
      deleteJournalEntry(journalDelete.dataset.journalDelete);
      return;
    }

    const journalClearDraft = event.target.closest("[data-journal-clear-draft]");
    if (journalClearDraft) {
      state.journalDraft = null;
      render();
      return;
    }

    const compareSwap = event.target.closest("[data-compare-swap]");
    if (compareSwap) {
      swapCompareAssets();
      return;
    }

    const reportButton = event.target.closest("[data-report]");
    if (reportButton) {
      openReport(reportButton.dataset.report, reportButton.dataset.symbol || "");
      return;
    }

    const guidanceAction = event.target.closest("[data-guidance-action]");
    if (guidanceAction) {
      runGuidanceAction(guidanceAction.dataset.guidanceAction, guidanceAction.dataset);
      return;
    }

    const commandAction = event.target.closest("[data-command-action]");
    if (commandAction) {
      runCommandAction(commandAction.dataset.commandAction);
      return;
    }

    const quizAnswer = event.target.closest("[data-quiz-answer]");
    if (quizAnswer) {
      answerQuizQuestion(quizAnswer.dataset.quizAnswer, Number(quizAnswer.dataset.quizIndex || 0));
      return;
    }

    const glossaryButton = event.target.closest("[data-glossary]");
    if (glossaryButton) {
      focusGlossaryTerm(glossaryButton.dataset.glossary);
      return;
    }

    const helpPrompt = event.target.closest("[data-help-prompt]");
    if (helpPrompt) {
      state.helpQuery = helpPrompt.dataset.helpPrompt || "";
      askHelpAssistant(state.helpQuery);
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

    const modulePrefButton = event.target.closest("[data-module-pref]");
    if (modulePrefButton) {
      setHomeModulePreference(modulePrefButton.dataset.modulePref, modulePrefButton.dataset.modulePriority || "normal");
      return;
    }

    const shortcutToggle = event.target.closest("[data-shortcut-toggle]");
    if (shortcutToggle) {
      togglePreferenceShortcut(shortcutToggle.dataset.shortcutToggle);
      return;
    }

    const focusToggle = event.target.closest("[data-profile-focus]");
    if (focusToggle) {
      toggleProfileFocus(focusToggle.dataset.profileFocus);
      return;
    }

    const resetPreferences = event.target.closest("[data-preferences-reset]");
    if (resetPreferences) {
      resetUserPreferences();
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

    const tabButton = event.target.closest("[data-asset-tab]");
    if (tabButton) {
      state.assetTab = tabButton.dataset.assetTab || "overview";
      render();
      return;
    }

    const resetScreener = event.target.closest("[data-screener-reset]");
    if (resetScreener) {
      state.screener = { ...SCREENER_DEFAULT_FILTERS };
      saveModuleDefault("screener", { ...SCREENER_DEFAULT_FILTERS });
      render();
      return;
    }

    const screenerPreset = event.target.closest("[data-screener-preset]");
    if (screenerPreset) {
      applyScreenerPreset(screenerPreset.dataset.screenerPreset || "all");
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
      saveModuleDefault("eventHub", { type: state.eventHub.type });
      render();
      return;
    }

    const eventWindow = event.target.closest("[data-event-window]");
    if (eventWindow) {
      state.eventHub.window = eventWindow.dataset.eventWindow || "week";
      saveModuleDefault("eventHub", { window: state.eventHub.window });
      render();
      return;
    }

    const eventScope = event.target.closest("[data-event-scope]");
    if (eventScope) {
      state.eventHub.scope = eventScope.dataset.eventScope || "all";
      saveModuleDefault("eventHub", { scope: state.eventHub.scope });
      render();
      return;
    }

    const eventRelevance = event.target.closest("[data-event-relevance]");
    if (eventRelevance) {
      state.eventHub.relevance = eventRelevance.dataset.eventRelevance || "all";
      saveModuleDefault("eventHub", { relevance: state.eventHub.relevance });
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

    const journalInput = event.target.closest("[data-journal-control]");
    if (journalInput) {
      updateJournalFilterState(journalInput);
    }

    const prefInput = event.target.closest("[data-pref-control]");
    if (prefInput) {
      updatePreferenceControl(prefInput);
    }

    const commandInput = event.target.closest("[data-command-search]");
    if (commandInput) {
      state.commandQuery = commandInput.value;
      renderCommandResults(commandInput.value);
    }

    const helpInput = event.target.closest("[data-help-input]");
    if (helpInput) {
      state.helpQuery = helpInput.value;
      renderHelpSuggestions(helpInput.value);
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

    const journalInput = event.target.closest("[data-journal-control]");
    if (journalInput) {
      updateJournalFilterState(journalInput);
    }

    const prefInput = event.target.closest("[data-pref-control]");
    if (prefInput) {
      updatePreferenceControl(prefInput);
    }

    const setupImport = event.target.closest("[data-setup-import-file]");
    if (setupImport) {
      previewSetupImport(setupImport.files?.[0]);
    }
  }

  function handleKeydown(event) {
    const commandInput = event.target.closest("[data-command-search]");
    if (commandInput && event.key === "Enter") {
      event.preventDefault();
      const first = featureSearchResults(commandInput.value)[0];
      if (first) {
        runCommandAction(first.id);
      }
      return;
    }

    const helpInput = event.target.closest("[data-help-input]");
    if (helpInput && event.key === "Enter") {
      event.preventDefault();
      askHelpAssistant(helpInput.value);
      return;
    }

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
      return;
    }

    if (event.target.matches("[data-journal-review-form]")) {
      event.preventDefault();
      saveJournalReviewFromForm(event.target);
    }
  }

  function navigate(route) {
    const normalizedRoute = route || "home";
    recordActivity("Modul", routeLabel(normalizedRoute), { route: normalizedRoute });
    if (normalizedRoute === "etf") {
      persistOnboarding({ ...state.onboarding, etfViewed: true });
      awardXp("etf-viewed", 20, "ETF-Vergleich gestartet");
    }
    if (normalizedRoute === "portfolio") {
      awardXp("portfolio-viewed", 25, "Portfolio analysiert");
    }
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
    persistOnboarding({ ...state.onboarding, assetAnalyzed: true });
    recordActivity("Asset", `${normalized} Asset-Analyse`, { route: "asset", symbol: normalized });
    awardXp("first-asset", 15, "Erstes Asset analysiert");
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
    } else if (state.route === "journal") {
      renderJournalPage();
    } else if (state.route === "preferences") {
      renderPreferencesPage();
    } else if (state.route === "data-health") {
      renderDataHealthPage();
    } else if (state.route === "legal") {
      renderLegalPage();
    } else if (state.route === "settings") {
      renderSettingsPage();
    } else {
      renderHomePage();
    }

    renderAllSuggestions();
    renderGuidanceDock();
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
      ${renderTodayImportantHero()}
      ${renderTicker()}
      ${renderGuidedStartSection()}
      ${renderPersonalShortcuts()}
      ${renderPersonalizedHomeModules()}
      ${renderTrustStatusBar()}
      ${renderLearningLightSection()}
      ${renderActivitySetupSection()}
      ${renderPersonalDashboardPanel()}
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

  function renderTodayImportantHero() {
    const briefing = dailyBriefingForView();
    const recap = dailyRecapForView();
    const macro = macroCountryComparisonForView();
    const watchItems = recap.watchlistItems.slice(0, 3);
    return `
      <section class="hero guidance-hero today-important-hero">
        <div class="hero-copy">
          <p class="eyebrow">Heute wichtig</p>
          <h1>${esc(recap.conclusion.label)}</h1>
          <p class="hero-text">${esc(recap.conclusion.text)}</p>
          <div class="today-grid">
            <div>
              <span class="card-label">Marktbewegungen</span>
              ${briefing.marketMoves.slice(0, 3).map((item) => `
                <button class="guidance-mini-row" type="button" data-symbol="${escAttr(item.symbol)}">
                  <strong>${esc(item.symbol)}</strong><span class="${toneClass(item.changePct)}">${formatPercent(item.changePct)}</span>
                </button>
              `).join("")}
            </div>
            <div>
              <span class="card-label">Events</span>
              ${briefing.upcomingEvents.slice(0, 3).map((eventItem) => `
                <button class="guidance-mini-row" type="button" ${assetMap.has(eventItem.symbol) ? `data-symbol="${escAttr(eventItem.symbol)}"` : `data-route="events"`}>
                  <strong>${esc(eventTypeLabel(eventItem))}</strong><span>${esc(eventTimingLabel(eventItem))}</span>
                </button>
              `).join("") || `<div class="guidance-mini-row"><strong>Ruhig</strong><span>Keine Top-Events</span></div>`}
            </div>
            <div>
              <span class="card-label">Watchlist</span>
              ${watchItems.map((item) => `
                <button class="guidance-mini-row" type="button" ${item.symbol && assetMap.has(item.symbol) ? `data-symbol="${escAttr(item.symbol)}"` : `data-route="portfolio"`}>
                  <strong>${esc(item.symbol || item.kind)}</strong><span>${esc(String(item.text || "").slice(0, 38))}</span>
                </button>
              `).join("") || `<div class="guidance-mini-row"><strong>Offen</strong><span>Watchlist starten</span></div>`}
            </div>
          </div>
          <div class="hero-actions guidance-actions">
            <button class="primary-button" type="button" data-report="dailyRecap">Tagesreport erstellen</button>
            <button class="ghost-button" type="button" data-route="events">Event-Hub oeffnen</button>
            <button class="ghost-button" type="button" data-route="alerts">Alerts pruefen</button>
          </div>
        </div>
        <aside class="search-card command-card">
          <div>
            <p class="eyebrow">Was moechtest du tun?</p>
            <h2>Feature-Suche</h2>
            <p>Regelbasierte Suche ueber Module, Aktionen und Begriffe. Keine KI-API, keine Finanzberatung.</p>
          </div>
          <label class="field command-field">
            <span>Aktion oder Begriff</span>
            <input data-command-search value="${escAttr(state.commandQuery)}" placeholder="z. B. ETF vergleichen, KGV erklaeren, Report erstellen">
          </label>
          <div id="commandResults" class="command-results">
            ${renderCommandResultItems(featureSearchResults(state.commandQuery))}
          </div>
          <div class="trust-strip-inline">
            <span class="pill ${escAttr(macro.control.tone)}">${esc(macro.control.label)}</span>
            ${renderStatusBadge(getOverallDataStatus())}
          </div>
        </aside>
      </section>
    `;
  }

  function renderGuidedStartSection() {
    const items = guidedStartItemsForView();
    const done = items.filter((item) => item.done).length;
    return `
      <section class="section guidance-section" id="guided-start">
        <div class="section-head compact-section-head">
          <div>
            <p class="eyebrow">Guided Start</p>
            <h2>Starte in 60 Sekunden</h2>
            <p>Ein kurzer Produktpfad fuer neue Nutzer: Watchlist, Research, Portfolio, ETF, Alerts und Report.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-guidance-action="demo-add">Demo-Daten laden</button>
            <button class="ghost-button" type="button" data-guidance-action="demo-replace">Demo ersetzen</button>
            <button class="ghost-button" type="button" data-route="preferences">Dashboard anpassen</button>
          </div>
        </div>
        <div class="guided-start-grid">
          ${items.map(renderGuidedStartCard).join("")}
        </div>
        <article class="card setup-check-card">
          <div class="card-topline">
            <div>
              <span class="card-label">Dein Setup</span>
              <h3>${done}/${items.length} Schritte erledigt</h3>
              <p>Fortschritt wird lokal aus deinen Daten und Aktionen abgeleitet.</p>
            </div>
            ${renderLevelBadge()}
          </div>
          <div class="progress-track"><i style="width: ${Math.round(done / Math.max(items.length, 1) * 100)}%"></i></div>
          <div class="chip-row">
            ${items.filter((item) => !item.done).slice(0, 3).map((item) => `<button class="chip" type="button" data-route="${escAttr(item.route)}">${esc(item.label)}</button>`).join("") || `<span class="pill bull">Setup stark</span>`}
          </div>
        </article>
      </section>
    `;
  }

  function renderGuidedStartCard(item) {
    const actionAttrs = item.action ? `data-guidance-action="${escAttr(item.action)}"` : `data-route="${escAttr(item.route)}"`;
    return `
      <article class="card guided-start-card ${item.done ? "done" : ""}">
        <div class="card-topline">
          <span class="pill ${item.done ? "bull" : ""}">${item.done ? "erledigt" : "offen"}</span>
          <span class="small">+${item.xp} XP</span>
        </div>
        <h3>${esc(item.label)}</h3>
        <p>${esc(item.text)}</p>
        <button class="${item.done ? "ghost-button" : "primary-button"}" type="button" ${actionAttrs}>${item.done ? "Nochmals oeffnen" : "Starten"}</button>
      </article>
    `;
  }

  function renderTrustStatusBar() {
    const items = dataStatusTodayItems();
    return `
      <section class="section compact-section">
        <article class="card trust-status-card">
          <div class="card-topline">
            <div>
              <span class="card-label">Datenstatus heute</span>
              <h3>Live, Hybrid, Fallback und lokal klar getrennt</h3>
            </div>
            <button class="tiny-button" type="button" data-route="data-health">Data Health</button>
          </div>
          <div class="trust-status-grid">
            ${items.map((item) => `
              <div class="trust-status-item">
                <span>${esc(item.label)}</span>
                ${renderStatusBadge(item.status)}
                <small>${esc(item.text)}</small>
              </div>
            `).join("")}
          </div>
          <p class="small">Lokale Funktionen speichern Nutzerpraeferenzen im Browser. Keine Betreiber-Secrets, kein Login, kein Cloud-Sync.</p>
        </article>
      </section>
    `;
  }

  function renderGuidanceControlSection() {
    return `
      <section class="section guidance-control-section">
        <div class="grid two">
          ${renderOnboardingChecklistCard()}
          ${renderCommandPaletteCard()}
        </div>
      </section>
    `;
  }

  function renderOnboardingChecklistCard() {
    const items = onboardingChecklistItems();
    const done = items.filter((item) => item.done).length;
    return `
      <article class="card onboarding-check-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Onboarding</span>
            <h3>Dein Setup ${done}/${items.length}</h3>
            <p>Kleine Schritte, lokal gespeichert oder aus vorhandenen Daten abgeleitet.</p>
          </div>
          ${renderLevelBadge()}
        </div>
        <div class="progress-track"><i style="width: ${Math.round(done / Math.max(items.length, 1) * 100)}%"></i></div>
        <div class="onboarding-list">
          ${items.map((item) => `
            <button class="onboarding-item ${item.done ? "done" : ""}" type="button" data-route="${escAttr(item.route)}">
              <span>${item.done ? "✓" : "·"}</span>
              <strong>${esc(item.label)}</strong>
              <small>${esc(item.done ? "erledigt" : item.text)}</small>
            </button>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderCommandPaletteCard() {
    return `
      <article class="card command-palette-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Command Palette</span>
            <h3>Schnell zur richtigen Funktion</h3>
            <p>Suche nach Aktion, Modul oder Begriff. Alles lokal und regelbasiert.</p>
          </div>
        </div>
        <label class="field">
          <span>Was moechtest du tun?</span>
          <input data-command-search value="${escAttr(state.commandQuery)}" placeholder="Portfolio pruefen, Alert setzen, TER erklaeren">
        </label>
        <div class="command-results" id="commandResultsSecondary">
          ${renderCommandResultItems(featureSearchResults(state.commandQuery))}
        </div>
      </article>
    `;
  }

  function renderLearningLightSection() {
    return `
      <section class="section learning-light-section">
        <div class="section-head compact-section-head">
          <div>
            <p class="eyebrow">Learning Light</p>
            <h2>Begriffe verstehen, ohne Academy-Ballast</h2>
            <p>Kurze Erklaerungen, 3 Fragen des Tages und lokaler Fortschritt. Keine KI-API.</p>
          </div>
        </div>
        <div class="grid two">
          ${renderGlossaryCard()}
          ${renderQuizLightCard()}
        </div>
      </section>
    `;
  }

  function renderGlossaryCard() {
    const focus = state.learning.focusTerm || "kgv";
    const selected = glossaryTermById(focus) || GLOSSARY_TERMS[0];
    return `
      <article class="card glossary-card" id="glossary">
        <div class="card-topline">
          <div>
            <span class="card-label">Begriffe schnell erklaert</span>
            <h3>${esc(selected.term)}</h3>
            <p>${esc(selected.text)}</p>
          </div>
          <span class="pill">Glossar</span>
        </div>
        <div class="insight-row"><span class="pill">Warum wichtig?</span><p>${esc(selected.why)}</p></div>
        <div class="insight-row"><span class="pill">Wo relevant?</span><p>${esc(selected.where)}</p></div>
        <div class="glossary-chip-grid">
          ${GLOSSARY_TERMS.map((term) => `<button class="chip ${term.id === selected.id ? "active" : ""}" type="button" data-glossary="${escAttr(term.id)}">${esc(term.term)}</button>`).join("")}
        </div>
      </article>
    `;
  }

  function renderQuizLightCard() {
    const questions = quizQuestionsForToday();
    const answered = state.learning.quizAnswers || {};
    const score = questions.filter((question) => answered[question.id]?.correct).length;
    return `
      <article class="card quiz-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Quiz Light</span>
            <h3>3 Fragen des Tages</h3>
            <p>${score}/${questions.length} richtig. Feedback kommt sofort, XP nur einmal pro Tagesrunde.</p>
          </div>
          ${renderLevelBadge()}
        </div>
        <div class="quiz-list">
          ${questions.map((question, index) => renderQuizQuestion(question, index)).join("")}
        </div>
      </article>
    `;
  }

  function renderQuizQuestion(question, index) {
    const answer = state.learning.quizAnswers?.[question.id];
    return `
      <div class="quiz-question">
        <strong>${index + 1}. ${esc(question.question)}</strong>
        <div class="quiz-options">
          ${question.options.map((option, optionIndex) => `
            <button class="chip ${answer?.selected === optionIndex ? (answer.correct ? "active" : "wrong") : ""}" type="button" data-quiz-answer="${escAttr(question.id)}" data-quiz-index="${optionIndex}">${esc(option)}</button>
          `).join("")}
        </div>
        ${answer ? `<p class="small ${answer.correct ? "bull" : "bear"}">${answer.correct ? "Richtig." : "Nicht ganz."} ${esc(question.explain)}</p>` : ""}
      </div>
    `;
  }

  function renderActivitySetupSection() {
    return `
      <section class="section activity-setup-section">
        <div class="grid two">
          ${renderRecentActivitiesCard()}
          ${renderSetupTransferCard()}
        </div>
      </section>
    `;
  }

  function renderRecentActivitiesCard() {
    return `
      <article class="card activity-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Zuletzt benutzt</span>
            <h3>Lokale Aktivitaeten</h3>
            <p>Nur in diesem Browser gespeichert, kein Tracking-Backend.</p>
          </div>
        </div>
        <div class="activity-list">
          ${state.activity.slice(0, 8).map((item) => `
            <button class="activity-row" type="button" ${item.route ? `data-route="${escAttr(item.route)}"` : item.symbol ? `data-symbol="${escAttr(item.symbol)}"` : ""}>
              <span class="pill">${esc(item.kind)}</span>
              <strong>${esc(item.label)}</strong>
              <small>${esc(formatTimestamp(item.timestamp))}</small>
            </button>
          `).join("") || renderGuidedEmptyState("activity")}
        </div>
      </article>
    `;
  }

  function renderSetupTransferCard() {
    return `
      <article class="card setup-transfer-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Setup sichern</span>
            <h3>Export / Import</h3>
            <p>Exportiert lokale Nutzerpraeferenzen, Watchlist, Portfolios, Alerts, Journal, Aktivitaeten und XP. Keine Betreiber-Secrets.</p>
          </div>
          ${renderStatusBadge("local")}
        </div>
        <div class="row-actions">
          <button class="primary-button" type="button" data-guidance-action="export-setup">Setup exportieren</button>
          <button class="ghost-button" type="button" data-guidance-action="import-setup">Setup importieren</button>
          <input class="visually-hidden" type="file" accept="application/json" data-setup-import-file>
        </div>
        ${state.importPreview ? renderImportPreview() : `<p class="small">Dieser Export enthaelt lokale Nutzerdaten, aber keine Provider-Secrets oder Betreiber-Konfiguration.</p>`}
      </article>
    `;
  }

  function renderImportPreview() {
    const preview = state.importPreview;
    return `
      <div class="import-preview">
        <span class="card-label">Import-Vorschau</span>
        <p>${esc(preview.summary)}</p>
        <div class="row-actions">
          <button class="primary-button" type="button" data-guidance-action="confirm-import">Import uebernehmen</button>
          <button class="ghost-button" type="button" data-guidance-action="cancel-import">Abbrechen</button>
        </div>
      </div>
    `;
  }

  function renderModuleActionBar(module, context = {}) {
    const actions = moduleActions(module, context).slice(0, 4);
    if (!actions.length) return "";
    return `
      <section class="section compact-section">
        <article class="card module-action-bar">
          <div class="card-topline">
            <div>
              <span class="card-label">Action Bar</span>
              <h3>${esc(moduleActionTitle(module))}</h3>
            </div>
            ${renderWhyNote("Warum?", moduleActionWhy(module))}
          </div>
          <div class="shortcut-row">
            ${actions.map((action) => `<button class="${action.primary ? "primary-button" : "ghost-button"}" type="button" ${actionAttrs(action)}>${esc(action.label)}</button>`).join("")}
          </div>
        </article>
      </section>
    `;
  }

  function renderNextSteps(module, context = {}) {
    const steps = nextStepItems(module, context).slice(0, 4);
    if (!steps.length) return "";
    return `
      <section class="section compact-section">
        <article class="card next-steps-card">
          <div class="card-topline">
            <div>
              <span class="card-label">Was du als Naechstes tun kannst</span>
              <h3>${esc(nextStepTitle(module))}</h3>
              <p>Maximal vier sinnvolle Schritte, passend zum aktuellen Modul.</p>
            </div>
          </div>
          <div class="next-step-grid">
            ${steps.map((step) => `
              <button class="next-step-card" type="button" ${actionAttrs(step)}>
                <strong>${esc(step.label)}</strong>
                <span>${esc(step.text)}</span>
              </button>
            `).join("")}
          </div>
        </article>
      </section>
    `;
  }

  function renderWhyNote(label, text) {
    return `<div class="why-note"><span class="pill">Warum?</span><p>${esc(text || label)}</p></div>`;
  }

  function moduleActions(module, context = {}) {
    const symbol = context.symbol || state.activeSymbol || "NVDA";
    const map = {
      asset: [
        { label: "Watchlist", dataset: { watchAdd: symbol }, primary: true },
        { label: "Alert", dataset: { alertQuick: symbol, alertQuickType: "price" } },
        { label: "Compare", dataset: { compareOpen: symbol } },
        { label: "Report", report: "asset", symbol }
      ],
      portfolio: [
        { label: "Report", report: "portfolio", primary: true },
        { label: "What-if", route: "portfolio" },
        { label: "Risiko pruefen", route: "portfolio" },
        { label: "Data Health", route: "data-health" }
      ],
      etf: [
        { label: "Compare", route: "compare", primary: true },
        { label: "Overlap pruefen", route: "etf" },
        { label: "Portfolio-Fit", dataset: { etfPortfolioFit: state.etf.left || "SPY" } },
        { label: "Report", report: "etf" }
      ],
      macro: [
        { label: "Report", report: "macro", primary: true },
        { label: "Data Health", route: "data-health" },
        { label: "Laendervergleich", route: "macro" }
      ],
      screener: [
        { label: "Asset oeffnen", symbol: topPicksForView().long[0]?.symbol || state.activeSymbol, primary: true },
        { label: "Compare", route: "compare" },
        { label: "Alert", dataset: { alertQuick: topPicksForView().long[0]?.symbol || state.activeSymbol, alertQuickType: "price" } },
        { label: "Report", report: "screener" }
      ]
    };
    return map[module] || [];
  }

  function moduleActionTitle(module) {
    const titles = { asset: "Research-Aktionen", portfolio: "Portfolio-Aktionen", etf: "ETF-Aktionen", macro: "Makro-Aktionen", screener: "Screener-Aktionen" };
    return titles[module] || "Sinnvolle Aktionen";
  }

  function moduleActionWhy(module) {
    const text = {
      asset: "Asset-Seiten fuehren zu Watchlist, Alert, Compare und Report, weil das die naechsten natuerlichen Research-Schritte sind.",
      portfolio: "Portfolio-Hinweise werden aus lokalen Positionen, Exposure und vorhandenen Kursdaten abgeleitet.",
      etf: "ETF-Analyse ist besonders nuetzlich, wenn Kosten, Overlap und Portfolio-Fit zusammen betrachtet werden.",
      macro: "Makro-Ampeln sind heuristische Einordnung aus Inflation, Zinsen, Wachstum, FX und Liquiditaet.",
      screener: "Top Picks zeigen Score-Treiber und Gegenpunkte, damit das Ranking keine Blackbox bleibt."
    };
    return text[module] || "Diese Aktionen passen zum aktuellen Modul.";
  }

  function nextStepItems(module, context = {}) {
    const symbol = context.symbol || state.activeSymbol || "NVDA";
    const similar = similarAssetFor(symbol);
    const map = {
      asset: [
        { label: "Mit aehnlichem Asset vergleichen", text: `${symbol} vs ${similar}`, action: "compare-pair", left: symbol, right: similar },
        { label: "Alert setzen", text: "Preis- oder Event-Regel fuer dieses Asset anlegen.", dataset: { alertQuick: symbol, alertQuickType: "price" } },
        { label: "In Watchlist speichern", text: "Asset fuer Recap, Events und Alerts vormerken.", dataset: { watchAdd: symbol } },
        { label: "Asset-Report erstellen", text: "Research-Snapshot als Druckansicht exportieren.", report: "asset", symbol }
      ],
      portfolio: [
        { label: "Klumpenrisiko pruefen", text: "Groesste Positionen und Sektorlast ansehen.", route: "portfolio" },
        { label: "ETF-Fit testen", text: "ETF als moeglichen Diversifikationsbaustein pruefen.", route: "etf" },
        { label: "Portfolio-Report exportieren", text: "Risiko, Exposure und Rebalancing dokumentieren.", report: "portfolio" },
        { label: "What-if simulieren", text: "Cash, Schock und Zusatzposition lokal testen.", route: "portfolio" }
      ],
      etf: [
        { label: "Overlap pruefen", text: "Sieh, ob zwei ETFs wirklich diversifizieren.", route: "etf" },
        { label: "Kostenvergleich starten", text: "TER-Effekt langfristig simulieren.", route: "etf" },
        { label: "Portfolio-Fit pruefen", text: "ETF im Portfolio-Kontext einordnen.", dataset: { etfPortfolioFit: state.etf.left || "SPY" } },
        { label: "ETF-Report exportieren", text: "Kosten, Holdings und Struktur dokumentieren.", report: "etf" }
      ],
      macro: [
        { label: "Makro-Report exportieren", text: "Ampel, Laendervergleich und Risiken sichern.", report: "macro" },
        { label: "Asset-Implikationen ansehen", text: "Kontext fuer Aktien, Gold, Anleihen und Krypto.", route: "macro" },
        { label: "Data Health pruefen", text: "Sehen, welche Makroquellen live/hybrid/fallback sind.", route: "data-health" }
      ],
      screener: [
        { label: "Top Pick oeffnen", text: "Besten Kandidaten mit Erklaerung ansehen.", symbol: topPicksForView().long[0]?.symbol || "NVDA" },
        { label: "Compare starten", text: "Zwei Kandidaten direkt gegenueberstellen.", route: "compare" },
        { label: "Alert setzen", text: "Auffaelligen Wert beobachten.", dataset: { alertQuick: topPicksForView().long[0]?.symbol || "NVDA", alertQuickType: "price" } },
        { label: "Screener-Report exportieren", text: "Ranking und Scoremodell dokumentieren.", report: "screener" }
      ]
    };
    return map[module] || [];
  }

  function nextStepTitle(module) {
    const titles = { asset: "Vom Research zur Entscheidungsvorbereitung", portfolio: "Depot besser verstehen", etf: "Diversifikation statt Doppelung", macro: "Makro-Kontext nutzbar machen", screener: "Kandidaten gezielt weiterpruefen" };
    return titles[module] || "Naechster sinnvoller Schritt";
  }

  function actionAttrs(action) {
    if (action.report) return `data-report="${escAttr(action.report)}"${action.symbol ? ` data-symbol="${escAttr(action.symbol)}"` : ""}`;
    if (action.symbol) return `data-symbol="${escAttr(action.symbol)}"`;
    if (action.route) return `data-route="${escAttr(action.route)}"`;
    if (action.action) return `data-guidance-action="${escAttr(action.action)}"${action.left ? ` data-left="${escAttr(action.left)}"` : ""}${action.right ? ` data-right="${escAttr(action.right)}"` : ""}`;
    if (action.dataset) return Object.entries(action.dataset).map(([key, value]) => `data-${kebabCase(key)}="${escAttr(value)}"`).join(" ");
    return "";
  }

  function kebabCase(value) {
    return String(value || "").replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`).replace(/^-/, "");
  }

  function guidedStartItemsForView() {
    const checklist = onboardingChecklistState();
    return GUIDED_START_ITEMS.map((item) => ({
      ...item,
      done: Boolean(checklist[item.id] || (item.id === "alert" && checklist.alerts) || (item.id === "report" && checklist.report))
    }));
  }

  function onboardingChecklistItems() {
    const done = onboardingChecklistState();
    return [
      { id: "mode", label: "Dashboard-Modus gewaehlt", text: "Investor, Trader, ETF, Makro oder Portfolio-Fokus waehlen.", route: "preferences", done: done.mode },
      { id: "watchlist", label: "Watchlist erstellt", text: "Mindestens 3 Werte beobachten.", route: "portfolio", done: done.watchlist },
      { id: "favorites", label: "Favoriten gewaehlt", text: "Schnellzugriffe fuer wichtige Assets setzen.", route: "preferences", done: done.favorites },
      { id: "portfolio", label: "Portfolio/Testportfolio erstellt", text: "Portfolio-Modul oeffnen oder Demo laden.", route: "portfolio", done: done.portfolio },
      { id: "alert", label: "Erster Alert gesetzt", text: "Preis- oder Event-Alert anlegen.", route: "alerts", done: done.alerts },
      { id: "report", label: "Erster Report exportiert", text: "Report-Center oder Tagesreport nutzen.", route: "research", done: done.report },
      { id: "asset", label: "Erstes Asset analysiert", text: "Asset-Seite oeffnen.", route: "asset", done: done.asset },
      { id: "etf", label: "Erster ETF-Vergleich", text: "ETF V2 oeffnen.", route: "etf", done: done.etf },
      { id: "quiz", label: "Erstes Quiz abgeschlossen", text: "3 Fragen des Tages beantworten.", route: "home", done: done.quiz }
    ];
  }

  function onboardingChecklistState() {
    const prefs = dashboardPrefs();
    return {
      mode: Boolean(prefs.mode),
      watchlist: state.watchlist.length >= 3,
      favorites: prefs.favorites.length >= 2,
      portfolio: state.portfolios.some((portfolio) => (portfolio.positions || []).length || portfolio.type === "test"),
      alerts: state.alerts.length > 0,
      report: Boolean(state.onboarding.reportExported),
      asset: Boolean(state.onboarding.assetAnalyzed || state.recents.length > 0),
      etf: Boolean(state.onboarding.etfViewed || state.etf.left !== "SPY" || state.etf.right !== "QQQ"),
      quiz: Object.keys(state.learning.quizAnswers || {}).length >= 3
    };
  }

  function renderLevelBadge() {
    const current = currentLevel();
    const next = nextLevel();
    const progress = next ? Math.round((state.level.xp - current.xp) / Math.max(next.xp - current.xp, 1) * 100) : 100;
    return `
      <div class="level-badge">
        <span>Level ${current.level}</span>
        <strong>${esc(current.label)}</strong>
        <small>${state.level.xp} XP${next ? ` · ${Math.max(next.xp - state.level.xp, 0)} bis ${next.label}` : ""}</small>
        <div class="progress-track"><i style="width: ${clamp(progress, 0, 100)}%"></i></div>
      </div>
    `;
  }

  function currentLevel() {
    return LEVELS.slice().reverse().find((level) => state.level.xp >= level.xp) || LEVELS[0];
  }

  function nextLevel() {
    return LEVELS.find((level) => level.xp > state.level.xp) || null;
  }

  function awardXp(key, amount, label) {
    if (!key || state.level.awarded.includes(key)) return;
    state.level = normalizeLevelState({
      ...state.level,
      xp: Number(state.level.xp || 0) + Number(amount || 0),
      awarded: [...state.level.awarded, key]
    });
    storageSet(STORAGE_KEYS.level, state.level);
    toast(`+${amount} XP: ${label}`);
  }

  function persistOnboarding(next = state.onboarding) {
    state.onboarding = normalizeOnboardingState(next);
    storageSet(STORAGE_KEYS.onboarding, state.onboarding);
  }

  function recordActivity(kind, label, data = {}) {
    const item = {
      id: `${kind}-${Date.now()}`,
      kind,
      label,
      route: data.route || "",
      symbol: data.symbol || "",
      timestamp: Date.now()
    };
    state.activity = normalizeActivityState([item, ...state.activity]);
    storageSet(STORAGE_KEYS.activity, state.activity);
  }

  function dataStatusTodayItems() {
    const quoteStatus = getOverallDataStatus();
    const macroStatus = macroCountryComparisonForView().status || "hybrid";
    return [
      { label: "Aktien", status: quoteStatus === "live" ? "hybrid" : quoteStatus, text: "Quotes live/hybrid, Research lokal transparent." },
      { label: "Makro", status: macroStatus, text: "FRED/OpenData/Fallback je Reihe sichtbar." },
      { label: "ETF", status: "local", text: "Struktur lokal, Kurse hybrid moeglich." },
      { label: "Portfolio", status: "local", text: "Positionen lokal, Kurse hybrid." },
      { label: "Reports", status: "local", text: "Browser-PDF ohne Server-PDF." },
      { label: "Letzter Check", status: quoteStatus, text: formatTimestamp(Date.now()) }
    ];
  }

  function featureSearchResults(query = "") {
    const term = String(query || "").trim().toLowerCase();
    const mode = dashboardPrefs().mode;
    const scored = FEATURE_COMMANDS.map((command) => {
      const haystack = [command.label, command.text, ...(command.keywords || [])].join(" ").toLowerCase();
      let score = !term ? 1 : haystack.includes(term) ? 10 : term.split(/\s+/).filter((part) => haystack.includes(part)).length;
      if (mode === "trader" && ["alert", "screener"].some((word) => haystack.includes(word))) score += 1;
      if (mode === "etf" && haystack.includes("etf")) score += 2;
      if (mode === "macro" && haystack.includes("makro")) score += 2;
      return { ...command, score };
    }).filter((command) => command.score > 0);
    return scored.sort((a, b) => b.score - a.score).slice(0, 6);
  }

  function renderCommandResultItems(items = []) {
    return items.map((item) => `
      <button class="command-result" type="button" data-command-action="${escAttr(item.id)}">
        <strong>${esc(item.label)}</strong>
        <span>${esc(item.text)}</span>
      </button>
    `).join("") || renderGuidedEmptyState("command");
  }

  function renderCommandResults(query) {
    const html = renderCommandResultItems(featureSearchResults(query));
    document.querySelectorAll("#commandResults, #commandResultsSecondary").forEach((target) => {
      target.innerHTML = html;
    });
  }

  function runCommandAction(id) {
    const command = FEATURE_COMMANDS.find((item) => item.id === id);
    if (!command) return;
    state.commandQuery = "";
    recordActivity("Suche", command.label, { route: command.route || "home", symbol: command.symbol || "" });
    if (command.glossary) {
      focusGlossaryTerm(command.glossary);
      navigate("home");
      return;
    }
    if (command.action) {
      runGuidanceAction(command.action);
      return;
    }
    if (command.symbol) {
      selectAsset(command.symbol);
      return;
    }
    if (command.route) {
      navigate(command.route);
    }
  }

  function focusGlossaryTerm(id) {
    state.learning = normalizeLearningState({ ...state.learning, focusTerm: id });
    storageSet(STORAGE_KEYS.learning, state.learning);
    render();
  }

  function glossaryTermById(id) {
    return GLOSSARY_TERMS.find((term) => term.id === id) || null;
  }

  function glossaryTermForQuery(query) {
    const term = String(query || "").toLowerCase();
    return GLOSSARY_TERMS.find((item) => [item.term, item.id, ...(item.aliases || [])].some((value) => term.includes(String(value).toLowerCase())));
  }

  function quizQuestionsForToday() {
    const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    return [0, 1, 2].map((offset) => QUIZ_QUESTIONS[(day + offset) % QUIZ_QUESTIONS.length]);
  }

  function answerQuizQuestion(questionId, selected) {
    const question = QUIZ_QUESTIONS.find((item) => item.id === questionId);
    if (!question) return;
    const correct = selected === question.answer;
    state.learning = normalizeLearningState({
      ...state.learning,
      quizAnswers: {
        ...state.learning.quizAnswers,
        [questionId]: { selected, correct, timestamp: Date.now() }
      }
    });
    storageSet(STORAGE_KEYS.learning, state.learning);
    if (correct && quizQuestionsForToday().every((item) => state.learning.quizAnswers[item.id]?.correct)) {
      awardXp("quiz-first-perfect", 15, "Quiz Light abgeschlossen");
    }
    recordActivity("Quiz", question.question, { route: "home" });
    render();
  }

  function runGuidanceAction(action, dataset = {}) {
    if (action === "demo-add" || action === "demo-replace") {
      const replaces = action === "demo-replace";
      if (typeof window.confirm === "function") {
        const confirmed = window.confirm(replaces
          ? "Demo-Daten ersetzen? Bestehende lokale Demo-/Beispieldaten werden ersetzt. Betreiber-Secrets sind nicht betroffen."
          : "Demo-Daten lokal hinzufuegen? Bestehende eigene Daten bleiben erhalten. Betreiber-Secrets sind nicht enthalten.");
        if (!confirmed) return;
      }
      loadDemoSetup(replaces);
      return;
    }
    if (action === "export-setup") {
      exportLocalSetup();
      return;
    }
    if (action === "import-setup") {
      document.querySelector("[data-setup-import-file]")?.click();
      return;
    }
    if (action === "confirm-import") {
      applySetupImport();
      return;
    }
    if (action === "cancel-import") {
      state.importPreview = null;
      render();
      return;
    }
    if (action === "open-help") {
      state.helpOpen = true;
      renderGuidanceDock();
      return;
    }
    if (action === "close-help") {
      state.helpOpen = false;
      renderGuidanceDock();
      return;
    }
    if (action === "ask-help") {
      askHelpAssistant(state.helpQuery);
      return;
    }
    if (action === "compare-pair") {
      openComparePair(dataset.left || state.activeSymbol, dataset.right || similarAssetFor(state.activeSymbol));
    }
  }

  function loadDemoSetup(replace = false) {
    const demoWatchlist = GUIDANCE_DEMO_SYMBOLS.filter((symbol) => assetMap.has(symbol));
    const demoAlerts = [
      buildAlertRecord({ symbol: "NVDA", type: "price", condition: "above", target: quoteFor("NVDA").price * 1.05, priority: "high", source: "demo", note: "Demo-Preisalert fuer NVIDIA" }),
      buildAlertRecord({ symbol: "AAPL", type: "earnings", priority: "medium", source: "demo", note: "Demo-Earnings-Reminder" })
    ];
    const demoPortfolio = {
      id: "demo-guidance",
      name: "Demo Testportfolio",
      type: "test",
      cash: 7500,
      targetCash: 12,
      notes: "Demo/Testdaten fuer Onboarding. Nicht als echtes Depot verstehen.",
      positions: [
        { symbol: "NVDA", quantity: 2, avgPrice: 620, country: "USA" },
        { symbol: "MSFT", quantity: 5, avgPrice: 360, country: "USA" },
        { symbol: "QQQ", quantity: 8, avgPrice: 410, country: "USA" },
        { symbol: "GLD", quantity: 3, avgPrice: 180, country: "Global" }
      ]
    };
    state.watchlist = replace ? demoWatchlist : unique([...state.watchlist, ...demoWatchlist]);
    storageSet(STORAGE_KEYS.watchlist, state.watchlist);
    const prefs = dashboardPrefs();
    state.userPreferences = normalizeUserPreferences({ ...prefs, favorites: unique([...prefs.favorites, "NVDA", "MSFT", "SPY", "QQQ"]).slice(0, 12) });
    persistUserPreferences();
    const withoutOldDemo = state.portfolios.filter((portfolio) => portfolio.id !== demoPortfolio.id);
    state.portfolios = replace ? [demoPortfolio, ...withoutOldDemo.filter((portfolio) => portfolio.type !== "test")] : [demoPortfolio, ...withoutOldDemo];
    state.activePortfolioId = demoPortfolio.id;
    savePortfolios();
    state.alerts = replace ? demoAlerts : [...demoAlerts, ...state.alerts.filter((alert) => alert.source !== "demo")].slice(0, 60);
    saveAlerts();
    state.etf = { ...state.etf, left: "SPY", right: "QQQ", amount: 10000, monthly: 250, years: 12, returnRate: 5 };
    state.demoState = { loaded: true, updatedAt: Date.now(), mode: replace ? "replace" : "add" };
    storageSet(STORAGE_KEYS.demoState, state.demoState);
    persistOnboarding({ ...state.onboarding, demoLoaded: true, etfViewed: true });
    recordActivity("Demo", replace ? "Demo-Daten ersetzt" : "Demo-Daten geladen", { route: "home" });
    awardXp("demo-loaded", 10, "Demo-Daten geladen");
    toast(replace ? "Demo-Daten ersetzt." : "Demo-Daten lokal hinzugefuegt.");
    render();
  }

  function exportLocalSetup() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      notice: "Dieser Export enthaelt lokale Nutzerpraeferenzen und Portfoliodaten, aber keine Provider-Secrets oder Betreiber-Konfiguration.",
      userPreferences: dashboardPrefs(),
      watchlist: state.watchlist,
      portfolios: state.portfolios,
      activePortfolioId: state.activePortfolioId,
      alerts: state.alerts.map(normalizeAlertRecord),
      journal: state.journal,
      activity: state.activity,
      onboarding: state.onboarding,
      learning: state.learning,
      level: state.level
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mh-analytics-setup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    persistOnboarding({ ...state.onboarding, reportExported: true, setupExported: true });
    recordActivity("Export", "Setup exportiert", { route: "home" });
    awardXp("setup-exported", 15, "Setup gesichert");
    toast("Setup exportiert. Keine Betreiber-Secrets enthalten.");
  }

  function previewSetupImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        if (!payload || typeof payload !== "object") throw new Error("ungueltig");
        const safe = sanitizeSetupImport(payload);
        state.importPreview = {
          payload: safe,
          summary: `${safe.watchlist.length} Watchlist-Werte, ${safe.portfolios.length} Portfolios, ${safe.alerts.length} Alerts, ${safe.journal.length} Journal-Eintraege. Betreiber-Secrets werden nicht importiert.`
        };
        render();
      } catch (error) {
        logError(error);
        toast("Import-Datei konnte nicht gelesen werden.");
      }
    };
    reader.readAsText(file);
  }

  function sanitizeSetupImport(payload) {
    return {
      userPreferences: normalizeUserPreferences(payload.userPreferences || {}),
      watchlist: sanitizeFavoriteSymbols(payload.watchlist || []),
      portfolios: Array.isArray(payload.portfolios) ? payload.portfolios.filter((portfolio) => portfolio && portfolio.name && Array.isArray(portfolio.positions)).slice(0, 12) : [],
      activePortfolioId: String(payload.activePortfolioId || ""),
      alerts: Array.isArray(payload.alerts) ? payload.alerts.map(normalizeAlertRecord).slice(0, 80) : [],
      journal: Array.isArray(payload.journal) ? payload.journal.slice(0, 500) : [],
      activity: normalizeActivityState(payload.activity || []),
      onboarding: normalizeOnboardingState(payload.onboarding || {}),
      learning: normalizeLearningState(payload.learning || {}),
      level: normalizeLevelState(payload.level || {})
    };
  }

  function applySetupImport() {
    const payload = state.importPreview?.payload;
    if (!payload) return;
    state.userPreferences = payload.userPreferences;
    state.watchlist = payload.watchlist.length ? payload.watchlist : state.watchlist;
    state.portfolios = payload.portfolios.length ? payload.portfolios : state.portfolios;
    state.activePortfolioId = state.portfolios.some((portfolio) => portfolio.id === payload.activePortfolioId) ? payload.activePortfolioId : state.portfolios[0]?.id || "core";
    state.alerts = payload.alerts;
    state.journal = payload.journal;
    state.activity = payload.activity;
    state.onboarding = payload.onboarding;
    state.learning = payload.learning;
    state.level = payload.level;
    storageSet(STORAGE_KEYS.userPreferences, state.userPreferences);
    storageSet(STORAGE_KEYS.watchlist, state.watchlist);
    savePortfolios();
    saveAlerts();
    storageSet(STORAGE_KEYS.journal, state.journal);
    storageSet(STORAGE_KEYS.activity, state.activity);
    storageSet(STORAGE_KEYS.onboarding, state.onboarding);
    storageSet(STORAGE_KEYS.learning, state.learning);
    storageSet(STORAGE_KEYS.level, state.level);
    state.importPreview = null;
    applyPreferenceDefaults();
    toast("Setup importiert. Betreiber-Secrets wurden weder erwartet noch uebernommen.");
    render();
  }

  function renderGuidanceDock() {
    const existing = document.getElementById("helpAssistantDock");
    if (existing) existing.remove();
    document.body.insertAdjacentHTML("beforeend", renderHelpAssistantDock());
  }

  function renderHelpAssistantDock() {
    return `
      <div class="help-assistant-dock" id="helpAssistantDock">
        ${state.helpOpen ? `
          <article class="help-panel">
            <div class="card-topline">
              <div>
                <span class="card-label">MH Help Assistant</span>
                <h3>Navigation & Begriffe</h3>
              </div>
              <button class="tiny-button" type="button" data-guidance-action="close-help">Schliessen</button>
            </div>
            <p class="small">Regelbasiert, lokal, keine KI-API und keine Finanzberatung.</p>
            <label class="field">
              <span>Frage</span>
              <input data-help-input value="${escAttr(state.helpQuery)}" placeholder="Wo finde ich ETFs? Was bedeutet KGV?">
            </label>
            <div class="row-actions">
              <button class="primary-button" type="button" data-guidance-action="ask-help">Antwort suchen</button>
            </div>
            <div id="helpSuggestions" class="help-suggestions">
              ${renderHelpSuggestionItems(helpSuggestions(state.helpQuery))}
            </div>
            ${state.helpAnswer ? renderHelpAnswer(state.helpAnswer) : ""}
          </article>
        ` : `<button class="help-fab" type="button" data-guidance-action="open-help">?</button>`}
      </div>
    `;
  }

  function helpSuggestions(query = "") {
    const base = [
      "Ich bin neu, womit soll ich anfangen?",
      "Wo kann ich ETFs vergleichen?",
      "Wie erstelle ich einen Report?",
      "Was bedeutet Hybrid-Daten?",
      "Wo sehe ich mein Portfolio?",
      "Wie setze ich einen Alert?",
      "Wo finde ich den Screener?"
    ];
    const term = String(query || "").toLowerCase();
    return base.filter((item) => !term || item.toLowerCase().includes(term)).slice(0, 5);
  }

  function renderHelpSuggestionItems(items) {
    return items.map((item) => `<button class="chip" type="button" data-help-prompt="${escAttr(item)}">${esc(item)}</button>`).join("");
  }

  function renderHelpSuggestions(query) {
    const target = document.getElementById("helpSuggestions");
    if (target) target.innerHTML = renderHelpSuggestionItems(helpSuggestions(query));
  }

  function askHelpAssistant(query) {
    state.helpQuery = String(query || "").trim();
    state.helpAnswer = helpAnswerForQuery(state.helpQuery);
    recordActivity("Hilfe", state.helpQuery || "Help Assistant", { route: state.helpAnswer.route || "home" });
    renderGuidanceDock();
  }

  function helpAnswerForQuery(query) {
    const term = String(query || "").toLowerCase();
    const glossary = glossaryTermForQuery(term);
    if (glossary) {
      return { category: "Begriff", title: glossary.term, text: `${glossary.text} Wichtig: ${glossary.why}`, route: "home", actionLabel: "Glossar oeffnen", glossary: glossary.id };
    }
    const command = featureSearchResults(term)[0];
    if (command) {
      return { category: "Navigation", title: command.label, text: command.text, route: command.route || "home", actionLabel: command.route ? "Oeffnen" : "Ausfuehren", commandId: command.id };
    }
    return { category: "Start", title: "Starte mit Guided Start", text: "Wenn du neu bist, beginne mit Watchlist, erstem Asset, Testportfolio und Tagesreport.", route: "home", actionLabel: "Start oeffnen" };
  }

  function renderHelpAnswer(answer) {
    return `
      <div class="help-answer">
        <span class="pill">${esc(answer.category)}</span>
        <h4>${esc(answer.title)}</h4>
        <p>${esc(answer.text)}</p>
        <button class="ghost-button" type="button" ${answer.glossary ? `data-glossary="${escAttr(answer.glossary)}"` : answer.commandId ? `data-command-action="${escAttr(answer.commandId)}"` : `data-route="${escAttr(answer.route || "home")}"`}>${esc(answer.actionLabel || "Oeffnen")}</button>
      </div>
    `;
  }

  function renderGuidedEmptyState(kind) {
    const states = {
      watchlist: { text: "Du hast noch keine Watchlist.", actions: `<button class="ghost-button" type="button" data-guidance-action="demo-add">Demo-Daten laden</button><button class="ghost-button" type="button" data-watch-add="NVDA">NVDA hinzufuegen</button>` },
      alerts: { text: "Noch keine Alerts.", actions: `<button class="ghost-button" type="button" data-alert-quick="NVDA" data-alert-quick-type="price">Ersten Preis-Alert setzen</button>` },
      portfolio: { text: "Noch kein Portfolio.", actions: `<button class="ghost-button" type="button" data-guidance-action="demo-add">Demoportfolio laden</button>` },
      reports: { text: "Noch kein Report exportiert.", actions: `<button class="ghost-button" type="button" data-report="dailyRecap">Tagesreport erstellen</button>` },
      activity: { text: "Noch keine Aktivitaeten. Oeffne ein Asset, exportiere einen Report oder lade Demo-Daten.", actions: `<button class="ghost-button" type="button" data-guidance-action="demo-add">Demo-Daten laden</button>` },
      command: { text: "Keine passende Aktion gefunden. Probiere 'Portfolio', 'ETF', 'Report' oder 'KGV'.", actions: "" }
    };
    const item = states[kind] || states.activity;
    return `<div class="empty-state guided-empty"><p>${esc(item.text)}</p><div class="row-actions">${item.actions}</div></div>`;
  }

  function similarAssetFor(symbol) {
    const asset = getAsset(symbol);
    const peer = ASSETS.find((item) => item.symbol !== asset.symbol && item.type === asset.type && item.sector === asset.sector)
      || ASSETS.find((item) => item.symbol !== asset.symbol && item.type === asset.type)
      || getAsset("MSFT");
    return peer.symbol;
  }

  function routeLabel(route) {
    const labels = {
      home: "Startseite",
      asset: "Asset-Seite",
      screener: "Screener",
      compare: "Quick Compare",
      macro: "Makro",
      liquidity: "Liquiditaet",
      etf: "ETF",
      events: "Event-Hub",
      research: "Research / Reports",
      portfolio: "Portfolio / Watchlist",
      alerts: "Alerts",
      journal: "Journal",
      preferences: "Personalisierung",
      "data-health": "Data Health",
      settings: "Datenquellen"
    };
    return labels[route] || route || "Modul";
  }

  function reportTypeLabel(type) {
    const labels = {
      asset: "Asset-Report",
      portfolio: "Portfolio-Report",
      etf: "ETF-Report",
      macro: "Makro-Report",
      dailyRecap: "Tages-Recap-Report",
      watchlist: "Watchlist-Report",
      screener: "Screener-Report",
      topPicks: "Top-Picks-Report"
    };
    return labels[type] || "Report";
  }

  function normalizeOnboardingState(value = {}) {
    return {
      demoLoaded: Boolean(value.demoLoaded),
      reportExported: Boolean(value.reportExported),
      assetAnalyzed: Boolean(value.assetAnalyzed),
      etfViewed: Boolean(value.etfViewed),
      setupExported: Boolean(value.setupExported)
    };
  }

  function normalizeActivityState(value = []) {
    return (Array.isArray(value) ? value : [])
      .filter((item) => item && item.label)
      .map((item) => ({
        id: String(item.id || `activity-${Date.now()}`),
        kind: String(item.kind || "Aktivitaet"),
        label: String(item.label || ""),
        route: String(item.route || ""),
        symbol: String(item.symbol || ""),
        timestamp: Number(item.timestamp || Date.now())
      }))
      .slice(0, 40);
  }

  function normalizeLearningState(value = {}) {
    return {
      focusTerm: String(value.focusTerm || "kgv"),
      quizAnswers: value.quizAnswers && typeof value.quizAnswers === "object" ? value.quizAnswers : {}
    };
  }

  function normalizeLevelState(value = {}) {
    return {
      xp: Number(value.xp || 0),
      awarded: Array.isArray(value.awarded) ? value.awarded.map(String) : []
    };
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
            <button class="ghost-button" type="button" data-report="dailyRecap">Recap-Report</button>
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

  function renderLegacyPersonalDashboardPanel() {
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

  function renderLegacyPersonalModuleStrip() {
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

  function renderPersonalDashboardPanel() {
    const prefs = dashboardPrefs();
    const modeConfig = DASHBOARD_MODES[prefs.mode] || DASHBOARD_MODES.investor;
    const profileLine = [
      profileOptionLabel("goal", prefs.profile.goal),
      profileOptionLabel("horizon", prefs.profile.horizon),
      `Risiko ${profileOptionLabel("risk", prefs.profile.risk)}`
    ].join(" · ");
    return `
      <section class="section">
        <article class="card personalization-panel">
          <div class="card-topline">
            <div>
              <span class="card-label">Personalization V2 · lokal gespeichert</span>
              <h3>${esc(modeConfig.label)} Dashboard</h3>
              <p>${esc(modeConfig.description)} ${esc(profileLine)}.</p>
            </div>
            ${renderDataMeta(makeMeta("Lokale User Preferences", "local", Date.now(), "Es werden nur normale Nutzerpraeferenzen gespeichert, keine geheimen Betreiber-Schluessel."), true)}
          </div>
          <div class="dashboard-mode-row">
            ${Object.keys(DASHBOARD_MODES).map((mode) => `
              <button class="chip ${prefs.mode === mode ? "active" : ""}" type="button" data-dashboard-mode="${escAttr(mode)}">${esc(preferenceModeLabel(mode))}</button>
            `).join("")}
          </div>
          <div class="preference-summary-grid">
            ${renderMiniMetric("Favoriten", String(prefs.favorites.length))}
            ${renderMiniMetric("Oben", String(Object.values(prefs.modules).filter((value) => value === "high").length))}
            ${renderMiniMetric("Shortcuts", String(prefs.shortcuts.length))}
            ${renderMiniMetric("Detailgrad", profileOptionLabel("experience", prefs.profile.experience))}
          </div>
          <div class="continue-row">
            <button class="ghost-button" type="button" data-symbol="${escAttr(state.activeSymbol)}">Weiter mit ${esc(state.activeSymbol)}</button>
            ${state.recents.slice(0, 3).map((symbol) => `<button class="chip" type="button" data-symbol="${escAttr(symbol)}">${esc(symbol)}</button>`).join("")}
            <button class="ghost-button" type="button" data-route="preferences">Personalisierung öffnen</button>
          </div>
          <div class="chip-row">
            ${favoriteAssetCandidates().slice(0, 10).map((asset) => `
              <button class="chip ${isFavoriteSymbol(asset.symbol) ? "active" : ""}" type="button" data-favorite-symbol="${escAttr(asset.symbol)}">${esc(asset.symbol)}</button>
            `).join("")}
          </div>
          ${prefs.display.beginnerHelp ? `<p class="small preference-help-note">Erklaerungen sind aktiv: wichtige Begriffe und Datenstatus-Hinweise werden etwas sichtbarer gehalten.</p>` : ""}
        </article>
      </section>
    `;
  }

  function renderPersonalShortcuts() {
    const shortcuts = selectedShortcuts();
    if (!shortcuts.length) {
      return "";
    }
    return `
      <section class="section compact-section">
        <article class="card shortcut-panel">
          <div class="card-topline">
            <div>
              <span class="card-label">Persönliche Shortcuts</span>
              <h3>Schneller zu deinen wichtigsten Bereichen</h3>
            </div>
            <button class="tiny-button" type="button" data-route="preferences">Anpassen</button>
          </div>
          <div class="shortcut-row">
            ${shortcuts.map((shortcut) => `<button class="ghost-button" type="button" data-route="${escAttr(shortcut.route)}">${esc(shortcut.label)}</button>`).join("")}
          </div>
        </article>
      </section>
    `;
  }

  function renderPersonalizedHomeModules() {
    return visibleHomeModules().map(renderHomeModuleById).join("");
  }

  function visibleHomeModules() {
    const prefs = dashboardPrefs();
    const rank = { high: 0, normal: 1, hidden: 2 };
    return HOME_MODULE_CATALOG
      .map((module, index) => ({ ...module, index, priority: prefs.modules[module.id] || "normal" }))
      .filter((module) => module.priority !== "hidden")
      .sort((a, b) => rank[a.priority] - rank[b.priority] || a.index - b.index);
  }

  function renderHomeModuleById(module) {
    if (module.id === "dailyRecap") {
      return renderDailyRecapSection();
    }
    if (module.id === "dailyBriefing") {
      return renderDailyBriefingSection();
    }
    if (module.id === "quickCompare") {
      return renderQuickCompareSection();
    }
    if (module.id === "macro") {
      return renderMacroSection();
    }
    const renderers = {
      portfolio: renderHomePortfolioModule,
      watchlist: () => renderWatchlistCard(),
      events: renderHomeEventsModule,
      alerts: renderHomeAlertsModule,
      etf: renderHomeEtfModule,
      screener: renderHomeScreenerModule,
      reports: () => renderReportCenterCard(),
      assetResearch: renderHomeAssetResearchModule,
      liquidity: () => renderLiquidityImpactCard(),
      dataHealth: () => renderProviderHealthPreview()
    };
    const content = renderers[module.id] ? renderers[module.id]() : "";
    if (!content) {
      return "";
    }
    return `
      <section class="section personalized-home-module module-priority-${escAttr(module.priority)}" data-home-module="${escAttr(module.id)}">
        <div class="section-head compact-section-head">
          <div>
            <p class="eyebrow">${esc(modulePriorityLabel(module.priority))}</p>
            <h2>${esc(module.label)}</h2>
            <p>${esc(module.description)}</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-route="${escAttr(module.route)}">Öffnen</button>
            <button class="tiny-button" type="button" data-route="preferences">Anpassen</button>
          </div>
        </div>
        ${content}
      </section>
    `;
  }

  function renderHomePortfolioModule() {
    const portfolio = activePortfolio();
    const analysis = portfolioAnalysis(portfolio);
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">${esc(portfolio.name)} · ${portfolio.type === "real" ? "Echtgeld" : "Testportfolio"}</span>
            <h3>${esc(analysis.health.label)}</h3>
            <p>${esc(analysis.health.summary || analysis.priorityHint)}</p>
          </div>
          ${renderDataMeta(analysis.meta, true)}
        </div>
        <div class="metric-grid">
          ${renderMiniMetric("Gesamtwert", formatMoney(analysis.totalValue, "USD"))}
          ${renderMiniMetric("Performance", `${formatMoney(analysis.performanceAbs, "USD")} · ${formatPercent(analysis.performancePct)}`)}
          ${renderMiniMetric("Cash", formatPercent(analysis.cashPct))}
          ${renderMiniMetric("Risiko", analysis.riskLevel.label)}
        </div>
        <div class="stack-list">
          ${analysis.focusItems.slice(0, 3).map(renderPortfolioInsightRow).join("") || renderEmptyState("Keine dringenden Portfolio-Hinweise.")}
        </div>
      </article>
    `;
  }

  function renderHomeEventsModule() {
    const rows = eventsForView().filter((item) => item.date >= startOfToday()).sort(sortEventsForHub).slice(0, 5);
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Event-/Earnings-Hub</span>
            <h3>Nächste relevante Termine</h3>
          </div>
          ${renderStatusBadge(bestDataStatus(rows.map((item) => item.meta?.status)))}
        </div>
        <div class="stack-list">
          ${rows.map(renderEventFocusRow).join("") || renderEmptyState("Keine Termine im aktuellen Fenster.")}
        </div>
      </article>
    `;
  }

  function renderHomeAlertsModule() {
    const summary = alertSummary();
    const alerts = alertsForView().slice(0, 4);
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Alerts V2</span>
            <h3>Offen, ausgelöst, erledigt</h3>
          </div>
          ${renderDataMeta(makeMeta("Lokale Alerts + Event-/Preisdaten", "local", Date.now()), true)}
        </div>
        <div class="metric-grid">
          ${renderMiniMetric("Offen", String(summary.open))}
          ${renderMiniMetric("Ausgeloest", String(summary.triggered))}
          ${renderMiniMetric("Watchlist", String(summary.watchlist))}
          ${renderMiniMetric("Historie", String(alertHistoryForView().length))}
        </div>
        <div class="stack-list">
          ${alerts.map(renderAlertRow).join("") || renderGuidedEmptyState("alerts")}
        </div>
      </article>
    `;
  }

  function renderHomeEtfModule() {
    const summary = etfUniverseSummary();
    const selected = etfBySymbol(state.etf.left) || ETF_DATA[0];
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">ETF-Bereich V2</span>
            <h3>Kosten, Overlap und Diversifikation</h3>
            <p>${esc(summary.conclusion || "ETF-Strukturdaten werden lokal/hybrid transparent gekennzeichnet.")}</p>
          </div>
          ${renderDataMeta(etfDataMeta(selected), true)}
        </div>
        <div class="metric-grid">
          ${renderMiniMetric("ETF-Universum", String(ETF_DATA.length))}
          ${renderMiniMetric("Durchschn. TER", `${formatNumber(summary.avgTer)}%`)}
          ${renderMiniMetric("Guenstigster ETF", summary.cheapest?.symbol || "n/a")}
          ${renderMiniMetric("Top-Konzentration", `${formatNumber(summary.concentrated?.concentration || 0)}%`)}
        </div>
        <div class="row-actions">
          <button class="ghost-button" type="button" data-route="etf">ETF V2 öffnen</button>
          <button class="ghost-button" type="button" data-route="compare">Quick Compare</button>
        </div>
      </article>
    `;
  }

  function renderHomeScreenerModule() {
    const rows = filteredScreenerRows().slice(0, 5);
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Screener</span>
            <h3>Top-Treffer mit deinen Standardfiltern</h3>
          </div>
          ${renderDataMeta(makeMeta("Screener Defaults + lokale Heuristik", getOverallDataStatus(), Date.now()), true)}
        </div>
        <div class="stack-list">
          ${rows.map((row, index) => `
            <button class="brief-row" type="button" data-symbol="${escAttr(row.symbol)}">
              <span><strong>${index + 1}. ${esc(row.symbol)}</strong><small>${esc(row.name)} · ${esc(row.pickReason)}</small></span>
              <span class="score-pill ${escAttr(row.rating.tone)}">${row.score}%</span>
            </button>
          `).join("") || renderEmptyState("Keine Treffer mit den aktuellen Standardfiltern.")}
        </div>
      </article>
    `;
  }

  function renderHomeAssetResearchModule() {
    const symbol = assetMap.has(state.activeSymbol) ? state.activeSymbol : "NVDA";
    const asset = getAsset(symbol);
    const quote = quoteFor(symbol);
    const news = newsFor(symbol);
    const context = {
      symbol,
      asset,
      quote,
      profile: profileFor(symbol),
      fundamentals: fundamentalsFor(symbol),
      news,
      sentiment: sentimentFor(symbol, quote, news),
      technical: technicalFor(symbol, quote),
      events: eventsForSymbol(symbol)
    };
    const research = buildAssetResearchSnapshot(context);
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">5-Minuten-Research · ${esc(symbol)}</span>
            <h3>${esc(research.headline)}</h3>
            <p>${esc(research.summary)}</p>
          </div>
          <span class="score-pill ${research.score >= 70 ? "bull" : research.score <= 45 ? "bear" : ""}">${research.score}/100</span>
        </div>
        <div class="grid two">
          <div>
            <span class="card-label">Chancen</span>
            ${renderResearchBulletList(research.opportunities.slice(0, 2))}
          </div>
          <div>
            <span class="card-label">Risiken</span>
            ${renderResearchBulletList(research.risks.slice(0, 2))}
          </div>
        </div>
        ${renderDataMeta(makeMeta("Asset-Research: lokale Verdichtung + verfügbare Daten", research.dataStatus, Date.now()), true)}
      </article>
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
    const topSector = etfTopSector(etf);
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
          ${renderMiniMetric("Sektor", topSector ? `${topSector[0]} ${formatNumber(topSector[1])}%` : "offen")}
          ${renderMiniMetric("Rolle", etf.role || "ETF-Baustein")}
        </div>
        <p>${esc(etf.useCase)} ${esc(etf.fxRisk)}. Struktur: ${esc(etf.structureType || "lokal")} / ${esc(etf.replication || "nicht verfügbar")}.</p>
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
        compareRow("Ausschüttung", left.etf.distribution, right.etf.distribution, "Cashflow vs. Wiederanlage.", "none"),
        compareRow("Top-Region", etfTopRegion(left.etf)?.[0] || "offen", etfTopRegion(right.etf)?.[0] || "offen", "Regionale Konzentration ist Kontext, kein automatischer Gewinner.", "none"),
        compareRow("ETF-Rolle", left.etf.role || "ETF", right.etf.role || "ETF", "Core/Satellite-Einordnung aus lokaler Struktur.", "none")
      );
      const overlap = etfOverlap(left.etf, right.etf);
      rows.push(compareRow("ETF-Overlap", `${formatNumber(overlap.score)}% Holdings`, `${formatNumber(overlap.regionScore)}% Regionen / ${formatNumber(overlap.sectorScore)}% Sektoren`, "Zeigt Dopplung statt Gewinner.", "none"));
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
          <button class="ghost-button" type="button" data-route="data-health">Datenstatus öffnen</button>
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
    return renderTopPicksV2Section(screenerRowsForView());

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

  function renderTopPicksV2Section(rows = screenerRowsForView()) {
    const picks = topPicksForView(rows);
    return `
      <section class="section top-picks-v2-section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Top Picks V2</p>
            <h2>Long, Watch, Risk und persönliche Auffälligkeiten</h2>
            <p>Die Karten erklären die wichtigsten Treiber und zeigen bewusst auch Gegenargumente und Datenstatus.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-report="topPicks">Top-Picks-Report</button>
          </div>
        </div>
        <div class="grid four top-picks-v2-grid">
          ${renderPickGroupCard("Long-Kandidaten", "Starkes Setup, aber prüfen", picks.long, "bull")}
          ${renderPickGroupCard("Watch-Kandidaten", "Interessant, aber gemischt", picks.watch, "neutral")}
          ${renderPickGroupCard("Risk-/Short-Kandidaten", "Warnlogik, keine Short-Empfehlung", picks.risk, "bear")}
          ${renderPickGroupCard("Watchlist / Favoriten", "Persönliche Auffälligkeiten", picks.personal, "bull")}
        </div>
      </section>
    `;
  }

  function renderPickGroupCard(title, subtitle, rows, tone) {
    return `
      <article class="card pick-group-card">
        <div class="card-topline">
          <div>
            <span class="card-label">${esc(subtitle)}</span>
            <h3>${esc(title)}</h3>
          </div>
          <span class="pill ${escAttr(tone)}">${rows.length}</span>
        </div>
        <div class="stack-list">
          ${rows.map((row, index) => renderPickV2Row(row, index + 1)).join("") || renderEmptyState("Keine Treffer mit aktueller Datenlage.")}
        </div>
      </article>
    `;
  }

  function renderPickV2Row(row, index) {
    const quote = quoteFor(row.symbol);
    return `
      <button class="pick-row pick-engine-row" type="button" data-symbol="${escAttr(row.symbol)}">
        <span class="rank">${index}</span>
        <span>
          <strong>${esc(row.symbol)} - ${esc(row.pickLabel)}</strong>
          <span class="small">Score ${row.score}% · ${esc(row.scores.momentum.labelText)} · ${esc(row.scores.risk.labelText)}</span>
          <span class="small">${esc(row.explanation)}</span>
        </span>
        <span class="right-cell">
          <span class="${toneClass(quote.changePct)}">${formatPercent(quote.changePct)}</span>
          ${renderTinyStatus(row.dataStatus)}
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
    const favoriteRows = dashboardPrefs().favorites.filter((symbol) => !state.watchlist.includes(symbol)).slice(0, 6);
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
            <button class="ghost-button" type="button" data-report="watchlist">Watchlist-Report</button>
            <button class="ghost-button" type="button" data-route="alerts">Alerts</button>
            <button class="ghost-button" type="button" data-route="portfolio">Verwalten</button>
          </div>
        </div>
        <div class="stack-list">
          ${rows || renderGuidedEmptyState("watchlist")}
        </div>
        ${favoriteRows.length ? `
          <div class="watchlist-news-box">
            <span class="card-label">Favoriten als Schnellzugriff</span>
            <div class="chip-row">
              ${favoriteRows.map((symbol) => `<button class="chip active" type="button" data-symbol="${escAttr(symbol)}">${esc(symbol)}</button>`).join("")}
            </div>
          </div>
        ` : ""}
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
    ensureEventData();
    const rows = screenerRowsForView();
    const filtered = filteredScreenerRows(rows);
    const summary = screenerSummary(rows, filtered);
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Screener / Ratings / Top Picks V2</p>
            <h1>Rankings statt Bauchgefühl.</h1>
            <p>Filtere ein erweitertes Universum mit ${ASSETS.length} Assets nach Momentum, Value, Growth, Market Cap, Sektor und Performance. Der Screener nutzt Finnhub-Quotes/Profile/Fundamentals und Alpha-Vantage-Zeitreihen über serverseitige Vercel Functions, sofern sie im Deployment verfügbar sind; die Heuristik bleibt stabil hybrid.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-report="screener">Screener-Report</button>
            <button class="ghost-button" type="button" data-report="topPicks">Top-Picks-Report</button>
            <button class="ghost-button" type="button" data-route="compare">Quick Compare</button>
            <button class="ghost-button" type="button" data-screener-reset>Filter zurücksetzen</button>
          </div>
        </div>
        ${renderScreenerControlCenter(summary)}
        ${renderScreenerPresetBar()}
        ${renderScreenerFilters()}
      </section>
      ${renderModuleActionBar("screener")}
      ${renderNextSteps("screener")}
      ${renderTopPicksV2Section(rows)}
      <section class="section">
        <article class="card">
          <div class="card-topline">
            <div>
              <span class="card-label">Ranking-Liste V2</span>
              <h3><span id="screenerResultCount">${filtered.length}</span> gefilterte Assets</h3>
              <p>Jede Zeile zeigt Score-Komponenten, wichtigste Treiber, naechsten Event-Kontext und Datenstatus.</p>
            </div>
            ${renderDataMeta(makeMeta("Lokale Screener Engine + verfügbare Quotes", getOverallDataStatus(), Date.now()), true)}
          </div>
          <div id="screenerResults">
            ${renderScreenerResults(filtered)}
          </div>
        </article>
      </section>
    `;
  }

  function renderScreenerControlCenter(summary) {
    return `
      <article class="card screener-control-center">
        <div class="card-topline">
          <div>
            <span class="card-label">Kontrollzentrum</span>
            <h3>${esc(summary.comment.title)}</h3>
            <p>${esc(summary.comment.text)}</p>
          </div>
          ${renderDataMeta(makeMeta("Screener V2: lokale Scores + Live/Hybrid/Fallback Inputs", summary.status, Date.now()), true)}
        </div>
        <div class="metric-grid">
          ${renderMiniMetric("Analysiert", String(summary.total))}
          ${renderMiniMetric("Long", String(summary.longCount))}
          ${renderMiniMetric("Watch", String(summary.watchCount))}
          ${renderMiniMetric("Risk", String(summary.riskCount))}
          ${renderMiniMetric("Momentum", summary.momentum ? `${summary.momentum.symbol} ${summary.momentum.scores.momentum.score}` : "--")}
          ${renderMiniMetric("Value", summary.value ? `${summary.value.symbol} ${summary.value.scores.value.score}` : "--")}
          ${renderMiniMetric("Growth", summary.growth ? `${summary.growth.symbol} ${summary.growth.scores.growth.score}` : "--")}
          ${renderMiniMetric("Risiko-Warnung", summary.risk ? `${summary.risk.symbol} ${summary.risk.scores.risk.score}` : "--")}
        </div>
        <div class="insight-row">
          <span class="pill">Keine Blackbox</span>
          <p>Der Gesamtscore zeigt die gewichtete Mischung aus Momentum, Value, Growth, Quality, Risiko-Schutz, Event, Makro und Datenqualitaet. Der Dashboard-Modus passt die Gewichte leicht an.</p>
        </div>
      </article>
    `;
  }

  function renderScreenerPresetBar() {
    return `
      <article class="card screener-preset-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Presets</span>
            <h3>Schnelle Scans</h3>
          </div>
        </div>
        <div class="screener-preset-grid">
          ${SCREENER_PRESETS.map((preset) => `
            <button class="mode-option ${state.screener.preset === preset.id ? "active" : ""}" type="button" data-screener-preset="${escAttr(preset.id)}">
              <strong>${esc(preset.label)}</strong>
              <span>${esc(preset.text)}</span>
            </button>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderScreenerFilters() {
    return `
      <article class="card screener-controls screener-controls-v2">
        ${renderScreenerControl("search", "Suche", "input")}
        ${renderScreenerControl("assetType", "Asset-Typ", "select", screenerAssetTypeOptions())}
        ${renderScreenerControl("region", "Region", "select", screenerRegionOptions())}
        ${renderScreenerControl("sector", "Sektor", "select", screenerSectorOptions())}
        ${renderScreenerControl("style", "Stil", "select", screenerStyleOptions())}
        ${renderScreenerControl("marketCap", "Market Cap", "select", screenerMarketCapOptions())}
        ${renderScreenerControl("dataStatus", "Datenstatus", "select", screenerDataStatusOptions())}
        ${renderScreenerControl("personal", "Watchlist / Favoriten", "select", [["all", "ohne persönlichen Filter"], ["watchlist", "nur Watchlist"], ["favorites", "nur Favoriten"]])}
        ${renderScreenerControl("eventContext", "Event-Kontext", "select", screenerEventOptions())}
        ${renderScreenerControl("rating", "Rating", "select", [["all", "Alle"], ["long", "Long-Kandidat"], ["watch", "Watch"], ["neutral", "Neutral"], ["risk", "Risk / Short"]])}
        ${renderScreenerControl("momentum", "Momentum", "select", [["all", "Alle"], ["60", ">= 60"], ["70", ">= 70"], ["80", ">= 80"]])}
        ${renderScreenerControl("value", "Value", "select", [["all", "Alle"], ["50", ">= 50"], ["60", ">= 60"], ["70", ">= 70"]])}
        ${renderScreenerControl("growth", "Growth", "select", [["all", "Alle"], ["60", ">= 60"], ["70", ">= 70"], ["80", ">= 80"]])}
        ${renderScreenerControl("performance", "Performance", "select", [["all", "Alle"], ["positive", "1M positiv"], ["strong", "1M > 5%"], ["weak", "1M < 0%"]])}
        ${renderScreenerControl("sort", "Sortierung", "select", screenerSortOptions())}
      </article>
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

  function renderScreenerResults(rows = filteredScreenerRows()) {
    if (!rows.length) {
      return renderEmptyState("Keine Treffer. Filter etwas weiter stellen.");
    }
    return `
      <div class="screener-v2-list">
        ${rows.map((row, index) => renderScreenerV2Row(row, index + 1)).join("")}
      </div>
    `;
  }

  function renderScreenerV2Row(row, index) {
    const personal = row.isWatchlist ? "Watchlist" : row.isFavorite ? "Favorit" : "";
    return `
      <article class="screener-v2-row">
        <div class="screener-rank-cell">
          <span class="rank">${index}</span>
          <span class="score-pill ${escAttr(row.pickTone)}">${row.score}%</span>
        </div>
        <div class="screener-main-cell">
          <button class="symbol-button" type="button" data-symbol="${escAttr(row.symbol)}">
            <strong>${esc(row.symbol)} - ${esc(row.name)}</strong>
            <span>${esc(row.type)} · ${esc(row.region)} · ${esc(row.sector)}${personal ? ` · ${esc(personal)}` : ""}</span>
          </button>
          <p>${esc(row.explanation)}</p>
          <div class="screener-driver-row">
            ${row.drivers.slice(0, 4).map((driver) => `<span class="pill ${escAttr(driver.tone || "")}">${esc(driver.label)}</span>`).join("")}
            ${renderStatusBadge(row.dataStatus)}
          </div>
        </div>
        <div class="screener-score-grid">
          ${Object.values(row.scores).map(renderScreenerScoreChip).join("")}
        </div>
        <div class="screener-context-cell">
          <span class="pill ${escAttr(row.pickTone)}">${esc(row.pickLabel)}</span>
          <span class="small">${esc(row.eventContext.text)}</span>
          <span class="small">${esc(row.macroContext.label)}: ${esc(row.macroContext.text)}</span>
          <div class="row-actions">
            <button class="tiny-button" type="button" data-compare-open="${escAttr(row.symbol)}">Compare</button>
            <button class="tiny-button" type="button" data-alert-quick="${escAttr(row.symbol)}" data-alert-quick-type="price">Alert</button>
            <button class="tiny-button" type="button" data-report="asset" data-symbol="${escAttr(row.symbol)}">Report</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderScreenerScoreChip(component) {
    return `
      <div class="screener-score-chip ${escAttr(component.tone || "")}">
        <span>${esc(component.shortLabel || component.label)}</span>
        <strong>${component.score}</strong>
        <small>${esc(component.labelText)}</small>
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
    const snapshot = macroCountryComparisonForView();
    const macro = macroEnhancedForView();
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Makro- / Ländervergleich V2</p>
            <h1>USA, Eurozone, Deutschland und China im Makrovergleich.</h1>
            <p>Inflation, Arbeitsmarkt, Zinsen, Realzins, Yield Curve, Wachstum, Verschuldung, FX und Liquidität werden in eine nachvollziehbare Makroampel übersetzt. Live-/Hybrid-/Fallback-Status bleibt sichtbar.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-route="data-health">Data Health</button>
            <button class="ghost-button" type="button" data-report="macro">Makro-Report</button>
          </div>
        </div>
        ${renderMacroControlCenter(snapshot)}
        ${renderModuleActionBar("macro")}
        ${renderNextSteps("macro")}
        ${renderMacroCountryComparison(snapshot)}
        <div class="grid two macro-v2-grid">
          ${renderMacroIndicatorPanel("Inflationsvergleich", "Wo Preisauftrieb entspannter oder kritischer wirkt.", snapshot.countries, "inflation")}
          ${renderMacroIndicatorPanel("Arbeitsmarktvergleich", "Arbeitslosigkeit als Konjunktur- und Zentralbank-Kontext.", snapshot.countries, "unemployment")}
        </div>
        <div class="grid two macro-v2-grid">
          ${renderMacroRatesPanel(snapshot)}
          ${renderMacroGrowthDebtPanel(snapshot)}
        </div>
        <div class="grid two macro-v2-grid">
          ${renderMacroFxLiquidityPanel(snapshot)}
          ${renderMacroAssetImplications(snapshot)}
        </div>
        ${renderMacroDataHealthPanel(snapshot)}
        <div class="grid four macro-deep-grid">
          ${macro.map((item) => renderMacroDeepCard(item)).join("")}
        </div>
      </section>
    `;
  }

  function renderMacroControlCenter(snapshot) {
    const control = snapshot.control;
    return `
      <article class="card macro-control-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Makro-Kontrollzentrum</span>
            <h3>${esc(control.label)}</h3>
            <p>${esc(control.summary)}</p>
          </div>
          <span class="score-pill ${control.tone}">${formatNumber(control.score)} / 100</span>
        </div>
        <div class="grid six macro-health-strip">
          ${control.tiles.map((tile) => `
            <div class="snapshot-tile macro-health-tile">
              <span>${esc(tile.label)}</span>
              <strong>${esc(tile.value)}</strong>
              <p>${esc(tile.text)}</p>
            </div>
          `).join("")}
        </div>
        <div class="macro-driver-row">
          ${control.drivers.map((driver) => `
            <div class="insight-row">
              <span class="pill ${escAttr(driver.tone)}">${esc(driver.label)}</span>
              <p>${esc(driver.text)}</p>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderMacroCountryComparison(snapshot) {
    return `
      <article class="card macro-country-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Ländervergleich</span>
            <h3>USA vs. Eurozone vs. Deutschland vs. China</h3>
            <p>Jede Karte zeigt dieselben Kernindikatoren. Wo keine gleichwertige Live-Reihe aktiv ist, bleibt der Wert klar als Hybrid/Fallback eingeordnet.</p>
          </div>
          ${renderStatusBadge(snapshot.status)}
        </div>
        <div class="macro-country-grid">
          ${snapshot.countries.map((country) => `
            <div class="macro-country-tile">
              <div class="card-topline">
                <div>
                  <span class="card-label">${esc(country.region)} · ${esc(country.currency)}</span>
                  <h3>${esc(country.name)}</h3>
                </div>
                <span class="score-pill ${escAttr(country.risk.tone)}">${esc(country.risk.label)}</span>
              </div>
              <div class="macro-country-metrics">
                ${renderMacroCountryMetric("BIP", country.gdp)}
                ${renderMacroCountryMetric("Inflation", country.inflation)}
                ${renderMacroCountryMetric("Arbeitsmarkt", country.unemployment)}
                ${renderMacroCountryMetric("Leitzins", country.policyRate)}
                ${renderMacroCountryMetric("10Y", country.yield10)}
                ${renderMacroCountryMetric("Realzins", country.realRate)}
                ${renderMacroCountryMetric("Schulden", country.debt)}
                ${renderMacroCountryMetric("FX", country.fx)}
              </div>
              <p class="small">${esc(country.risk.summary)}</p>
              ${renderDataMeta(country.meta, true)}
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderMacroCountryMetric(label, field) {
    return `
      <div class="macro-country-metric">
        <span>${esc(label)}</span>
        <strong>${esc(field.display)}</strong>
        ${renderTinyStatus(field.meta?.status)}
      </div>
    `;
  }

  function renderMacroIndicatorPanel(title, intro, countries, fieldName) {
    return `
      <article class="card macro-signal-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Vergleich</span>
            <h3>${esc(title)}</h3>
            <p>${esc(intro)}</p>
          </div>
        </div>
        <div class="macro-signal-list">
          ${countries.map((country) => {
            const field = country[fieldName];
            return `
              <div class="macro-signal-row">
                <span><strong>${esc(country.name)}</strong><small>${esc(field.label)}</small></span>
                <div><i style="width:${clamp(Math.abs(Number(field.value || 0)) * (fieldName === "inflation" ? 12 : 9), 4, 100)}%"></i></div>
                <span class="right-cell"><strong>${esc(field.display)}</strong>${renderTinyStatus(field.meta?.status)}</span>
              </div>
              <p class="small macro-signal-note">${esc(field.comment)}</p>
            `;
          }).join("")}
        </div>
      </article>
    `;
  }

  function renderMacroRatesPanel(snapshot) {
    return `
      <article class="card macro-signal-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Zinsen / Yield Curve / Realzins</span>
            <h3>${esc(snapshot.rates.label)}</h3>
            <p>${esc(snapshot.rates.text)}</p>
          </div>
          <span class="score-pill ${escAttr(snapshot.rates.tone)}">${esc(snapshot.rates.value)}</span>
        </div>
        <div class="macro-rate-grid">
          ${snapshot.countries.map((country) => `
            <div class="snapshot-tile">
              <span>${esc(country.name)}</span>
              <strong>${esc(country.policyRate.display)} · Real ${esc(country.realRate.display)}</strong>
              <p>10Y ${esc(country.yield10.display)} · 2Y-10Y ${esc(country.yieldCurve.display)} · ${esc(country.yieldCurve.comment)}</p>
            </div>
          `).join("")}
        </div>
        <p class="small">Realzins ist eine vereinfachte Näherung: 10-jährige Rendite minus Inflation. Für die USA kann FRED/Treasury diese Sicht ergänzen.</p>
      </article>
    `;
  }

  function renderMacroGrowthDebtPanel(snapshot) {
    return `
      <article class="card macro-signal-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Wachstum / Fiskalrisiko</span>
            <h3>${esc(snapshot.growth.label)}</h3>
            <p>${esc(snapshot.growth.text)}</p>
          </div>
          <span class="score-pill ${escAttr(snapshot.growth.tone)}">${esc(snapshot.growth.value)}</span>
        </div>
        <div class="macro-signal-list">
          ${snapshot.countries.map((country) => `
            <div class="macro-signal-row">
              <span><strong>${esc(country.name)}</strong><small>BIP ${esc(country.gdp.comment)} · Schulden ${esc(country.debt.comment)}</small></span>
              <div><i style="width:${clamp(Number(country.debt.value || 0), 4, 100)}%"></i></div>
              <span class="right-cell"><strong>${esc(country.gdp.display)}</strong><small>${esc(country.debt.display)}</small></span>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderMacroFxLiquidityPanel(snapshot) {
    return `
      <article class="card macro-signal-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Währungen / Liquidität</span>
            <h3>${esc(snapshot.liquidity.label)}</h3>
            <p>${esc(snapshot.liquidity.text)}</p>
          </div>
          <span class="score-pill ${escAttr(snapshot.liquidity.tone)}">${esc(snapshot.liquidity.value)}</span>
        </div>
        <div class="grid two">
          ${snapshot.countries.map((country) => `
            <div class="snapshot-tile">
              <span>${esc(country.name)}</span>
              <strong>${esc(country.fx.display)}</strong>
              <p>Liquidität ${esc(country.liquidity.display)} · ${esc(country.liquidity.comment)}</p>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderMacroAssetImplications(snapshot) {
    return `
      <article class="card macro-signal-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Was bedeutet das für Märkte?</span>
            <h3>Asset-Implikationen als Kontextlogik</h3>
            <p>Keine Prognose und keine Anlageberatung: nur eine vorsichtige Übersetzung der aktuellen Makrobausteine in Markt-Kontext.</p>
          </div>
        </div>
        <div class="macro-implication-list">
          ${snapshot.assetImplications.map((item) => `
            <div class="insight-row">
              <span class="pill ${escAttr(item.tone)}">${esc(item.asset)}</span>
              <p><strong>${esc(item.signal)}:</strong> ${esc(item.text)}</p>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderMacroDataHealthPanel(snapshot) {
    return `
      <article class="card macro-source-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Datenstatus / Quellen</span>
            <h3>Live, Hybrid und Fallback klar getrennt</h3>
            <p>Der Makrovergleich nutzt offizielle serverseitige und Open-Data-Pfade, bleibt aber ehrlich hybrid, solange nicht jede Länderreihe live gleichwertig verfügbar ist.</p>
          </div>
          <button class="ghost-button" type="button" data-route="data-health">Quellenstatus öffnen</button>
        </div>
        <div class="grid four">
          ${snapshot.sourceRows.map((row) => `
            <div class="snapshot-tile">
              <span>${esc(row.label)}</span>
              <strong>${esc(statusLabel(row.meta.status))}</strong>
              <p>${esc(row.meta.source)} · ${esc(formatTimestamp(row.meta.timestamp))}</p>
            </div>
          `).join("")}
        </div>
      </article>
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
          <button class="ghost-button" type="button" data-route="data-health">Quellenstatus öffnen</button>
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
    const selected = etfBySymbol(state.etf.left) || ETF_DATA[0];
    const summary = etfUniverseSummary();
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">ETF Bereich V2</p>
            <h1>ETF-Kosten, Overlap, Holdings und Portfolio-Fit.</h1>
            <p>Strukturierte ETF-Analyse für langfristige Anleger: Kostenwirkung, Überschneidung, Regionen, Sektoren, Ausschüttung, Währung, Konzentration und Einsatz im Portfolio. ETF-Strukturdaten bleiben bewusst lokal/hybrid gekennzeichnet.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-report="etf">ETF-Report</button>
            ${renderDataMeta(makeMeta("Strukturierte ETF-Datenbasis", "local", BOOT_TIME, "TER, Holdings, Regionen und Struktur sind lokal gepflegt; Kurse können über bestehende Quote-Pfade live/hybrid kommen."), true)}
          </div>
        </div>
        ${renderEtfControlCenter(summary)}
      </section>
      ${renderModuleActionBar("etf")}
      ${renderNextSteps("etf")}
      <section class="section">
        <div class="grid two">
          ${renderEtfCostCalculator()}
          ${renderEtfOverlapChecker()}
        </div>
      </section>
      <section class="section">
        ${renderEtfDeepDive(selected)}
      </section>
      <section class="section">
        <div class="section-head compact-section-head">
          <div>
            <h2>ETF-Universum</h2>
            <p>Lokale strukturierte ETF-Karten mit Kosten, Rolle, Regionen, Holdings, Währungs-/Strukturhinweisen und Datenstatus.</p>
          </div>
        </div>
        <div class="grid two">
          ${ETF_DATA.map(renderEtfCard).join("")}
        </div>
      </section>
    `;
  }

  function renderEtfCard(etf) {
    const concentration = etfHoldingConcentration(etf);
    const top10 = etfTop10Concentration(etf);
    const topRegion = etfTopRegion(etf);
    const topHolding = etf.holdings[0] || ["nicht verfügbar", 0];
    const riskHints = etfRiskHints(etf).slice(0, 3);
    const assetAvailable = assetMap.has(etf.symbol);
    return `
      <article class="card etf-card">
        <div class="card-topline">
          <div>
            <span class="card-label">${esc(etf.symbol)}${etf.isin ? ` · ${esc(etf.isin)}` : ""}</span>
            <h3>${esc(etf.name)}</h3>
            <p>${esc(etf.role || etf.useCase)}</p>
          </div>
          ${renderStatusBadge("local")}
        </div>
        <div class="module-chip-row etf-tag-row">
          ${etfCategoryTags(etf).map((tag) => `<span class="module-chip">${esc(tag)}</span>`).join("")}
        </div>
        <div class="metric-grid">
          ${renderMiniMetric("TER", `${formatNumber(etf.ter)}%`)}
          ${renderMiniMetric("Ausschüttung", etf.distribution)}
          ${renderMiniMetric("Top-Region", topRegion ? `${topRegion[0]} ${formatNumber(topRegion[1])}%` : "nicht verfügbar")}
          ${renderMiniMetric("Top-5", `${formatNumber(concentration)}%`)}
          ${renderMiniMetric("Top-10", `${formatNumber(top10)}%`)}
          ${renderMiniMetric("Währung", etf.currency)}
        </div>
        <div class="grid two">
          <div class="insight-row"><span class="pill">Einsatz</span><p>${esc(etf.useCase || "ETF-Baustein für Portfolio-Exposure.")}</p></div>
          <div class="insight-row"><span class="pill">Ausschüttung</span><p>${esc(distributionExplanation(etf))}</p></div>
          <div class="insight-row"><span class="pill">Top-Holding</span><p>${esc(topHolding[0])} mit ${formatNumber(topHolding[1])}% Gewicht.</p></div>
          <div class="insight-row"><span class="pill">Währung</span><p>${esc(etfCurrencyHint(etf))}</p></div>
        </div>
        <h4>Top Holdings</h4>
        <div class="mini-bars">
          ${etf.holdings.map(([name, weight]) => renderMiniBar(name, weight)).join("")}
        </div>
        <h4>Regionen</h4>
        <div class="mini-bars">
          ${etf.region.map(([name, weight]) => renderMiniBar(name, weight)).join("")}
        </div>
        <h4>Hinweise</h4>
        <div class="etf-risk-list">
          ${riskHints.map((item) => `<div class="research-bullet"><span class="pill ${escAttr(item.tone)}">${esc(item.label)}</span><p>${esc(item.text)}</p></div>`).join("")}
        </div>
        <div class="row-actions">
          ${assetAvailable ? `<button class="ghost-button" type="button" data-symbol="${escAttr(etf.symbol)}">Asset-Seite</button>` : ""}
          ${assetAvailable ? `<button class="ghost-button" type="button" data-compare-open="${escAttr(etf.symbol)}">Quick Compare</button>` : ""}
          ${assetAvailable ? `<button class="ghost-button" type="button" data-etf-portfolio-fit="${escAttr(etf.symbol)}">Portfolio-Fit prüfen</button>` : ""}
        </div>
        ${renderDataMeta(etfDataMeta(etf))}
      </article>
    `;
  }

  function renderEtfCostCalculator() {
    const amount = Number(state.etf.amount || 0);
    const monthly = Number(state.etf.monthly || 0);
    const years = Number(state.etf.years || 0);
    const returnRate = Number(state.etf.returnRate || 0);
    const selected = etfBySymbol(state.etf.left) || ETF_DATA[0];
    const compare = etfBySymbol(state.etf.right) || ETF_DATA[1];
    const selectedCost = etfCostProjection(amount, monthly, years, selected.ter, returnRate);
    const compareCost = etfCostProjection(amount, monthly, years, compare.ter, returnRate);
    const yearlyCost = etfAnnualCostEstimate(amount, monthly, selected.ter);
    const monthlyCost = yearlyCost / 12;
    const feeDiff = selectedCost.feeDrag - compareCost.feeDrag;
    const endDiff = selectedCost.endValue - compareCost.endValue;
    return `
      <article class="card etf-tool-card">
        <div class="card-topline">
          <div>
            <span class="card-label">ETF Kosten Rechner V2</span>
            <h3>Was kostet TER langfristig?</h3>
            <p>Simulation mit Anlagebetrag, Sparplan, Laufzeit, ETF A/B und Renditeannahme. Keine Steuer- oder Anlageberatung.</p>
          </div>
          ${renderStatusBadge("local")}
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
          <label class="field">
            <span>Anlagebetrag</span>
            <input data-etf-control name="amount" type="number" value="${escAttr(amount)}">
          </label>
          <label class="field">
            <span>Monatlicher Sparplan</span>
            <input data-etf-control name="monthly" type="number" value="${escAttr(monthly)}">
          </label>
          <label class="field">
            <span>Jahre</span>
            <input data-etf-control name="years" type="number" value="${escAttr(years)}">
          </label>
          <label class="field">
            <span>Renditeannahme % p.a.</span>
            <input data-etf-control name="returnRate" type="number" step="0.1" value="${escAttr(returnRate)}">
          </label>
        </div>
        <div class="metric-grid">
          ${renderMiniMetric("pro Jahr", formatMoney(yearlyCost, selected.currency))}
          ${renderMiniMetric("pro Monat", formatMoney(monthlyCost, selected.currency))}
          ${renderMiniMetric(`${selected.symbol} TER-Effekt`, formatMoney(selectedCost.feeDrag, selected.currency))}
          ${renderMiniMetric(`${compare.symbol} TER-Effekt`, formatMoney(compareCost.feeDrag, compare.currency))}
          ${renderMiniMetric("Kostendifferenz", `${feeDiff >= 0 ? "+" : ""}${formatMoney(feeDiff, selected.currency)}`)}
          ${renderMiniMetric("Endwert-Differenz", `${endDiff >= 0 ? "+" : ""}${formatMoney(endDiff, selected.currency)}`)}
        </div>
        <div class="insight-row"><span class="pill">Warum wichtig?</span><p>TER wirkt jedes Jahr auf das investierte Vermögen. Kleine Unterschiede sehen kurz unspektakulär aus, können über lange Sparpläne aber spürbare Endwertunterschiede erzeugen.</p></div>
        ${renderDataMeta(makeMeta("Lokaler ETF-Kostenrechner V2", "local", BOOT_TIME, "Simulation aus TER und Renditeannahme; Tracking Difference, Spreads und Steuern sind nicht enthalten."))}
      </article>
    `;
  }

  function renderEtfOverlapChecker() {
    const left = etfBySymbol(state.etf.left) || ETF_DATA[0];
    const right = etfBySymbol(state.etf.right) || ETF_DATA[1];
    const overlap = etfOverlap(left, right);
    const overlapText = etfOverlapText(overlap);
    const level = etfOverlapLevel(overlap);
    return `
      <article class="card etf-tool-card">
        <div class="card-topline">
          <div>
            <span class="card-label">ETF Overlap Checker V2</span>
            <h3>${esc(left.symbol)} vs ${esc(right.symbol)}</h3>
            <p>Prüft Dopplungen in Top-Holdings, Regionen, Sektoren, TER und Konzentration auf Basis der lokalen ETF-Strukturdaten.</p>
          </div>
          ${renderStatusBadge("local")}
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
          ${renderMiniMetric("Sektoren", `${formatNumber(overlap.sectorScore)}%`)}
          ${renderMiniMetric("TER-Differenz", `${formatNumber(Math.abs(left.ter - right.ter))}%`)}
          ${renderMiniMetric("Top-5 Abstand", `${formatNumber(Math.abs(etfHoldingConcentration(left) - etfHoldingConcentration(right)))}%`)}
          ${renderMiniMetric("Einordnung", level.label)}
        </div>
        <div class="insight-row"><span class="pill">Einordnung</span><p>${esc(overlapText)}</p></div>
        <div class="grid two etf-overlap-detail-grid">
          ${renderEtfCommonRows("Gemeinsame Top-Holdings", overlap.holdingRows, "Keine Überschneidung in den lokal gepflegten Top-Holdings.")}
          ${renderEtfCommonRows("Regionen-Overlap", overlap.regionRows, "Keine erkennbare regionale Dopplung.")}
        </div>
        <div class="etf-overlap-bars">
          <span class="card-label">Sektor-/Themen-Overlap</span>
          ${overlap.sectorRows.map((row) => renderMiniBar(row.name, row.weight)).join("") || renderEmptyState("Keine sektorale Überschneidung in der lokalen Struktur.")}
        </div>
        <div class="row-actions">
          <button class="ghost-button" type="button" data-compare-pair-left="${escAttr(left.symbol)}" data-compare-pair-right="${escAttr(right.symbol)}">Im Quick Compare öffnen</button>
          <button class="ghost-button" type="button" data-etf-portfolio-fit="${escAttr(left.symbol)}">ETF A im Portfolio prüfen</button>
        </div>
        ${renderDataMeta(makeMeta("Lokaler ETF-Overlap V2", "local", BOOT_TIME, "Overlap ist eine strukturierte Schätzung aus lokalen Top-Holdings, Regionen und Sektoren."))}
      </article>
    `;
  }

  function renderEtfControlCenter(summary) {
    return `
      <article class="card etf-control-center">
        <div class="card-topline">
          <div>
            <span class="card-label">ETF-Kontrollzentrum</span>
            <h3>${esc(summary.title)}</h3>
            <p>${esc(summary.text)}</p>
          </div>
          ${renderStatusBadge("local")}
        </div>
        <div class="metric-grid">
          ${renderMiniMetric("ETF-Universum", String(summary.count))}
          ${renderMiniMetric("Ø TER", `${formatNumber(summary.avgTer)}%`)}
          ${renderMiniMetric("Günstigster ETF", `${summary.cheapest.symbol} · ${formatNumber(summary.cheapest.ter)}%`)}
          ${renderMiniMetric("Höchste Top-5", `${summary.concentrated.symbol} · ${formatNumber(summary.concentrated.concentration)}%`)}
          ${renderMiniMetric("Größte Regionenlast", `${summary.regionHeavy.symbol} · ${summary.regionHeavy.region}`)}
          ${renderMiniMetric("Stärkster Overlap", summary.overlapPair)}
        </div>
        <div class="grid three etf-guide-grid">
          <div class="insight-row"><span class="pill">Kosten</span><p>TER ist laufend und wirkt über viele Jahre auf das Endvermögen. Der Rechner zeigt ETF A gegen ETF B.</p></div>
          <div class="insight-row"><span class="pill">Overlap</span><p>Hohe Top-Holdings- oder Regionen-Dopplung kann weniger Diversifikation bringen als erwartet.</p></div>
          <div class="insight-row"><span class="pill">Portfolio-Fit</span><p>Core-ETFs senken oft Einzelwertrisiko; Satelliten können Themen-, Länder- oder Währungsrisiken erhöhen.</p></div>
        </div>
        <div class="insight-row"><span class="pill">Fazit</span><p>${esc(summary.conclusion)}</p></div>
      </article>
    `;
  }

  function renderEtfDeepDive(etf) {
    return `
      <article class="card etf-deep-dive-card">
        <div class="card-topline">
          <div>
            <span class="card-label">ETF-Analyse</span>
            <h3>${esc(etf.symbol)}: Holdings, Regionen, Struktur und Fit</h3>
            <p>${esc(etf.useCase)} Datenstatus: lokal/strukturiert, nicht als Live-Holdings verkauft.</p>
          </div>
          <label class="field compact-field">
            <span>ETF auswählen</span>
            <select data-etf-control name="left">${ETF_DATA.map((item) => `<option value="${escAttr(item.symbol)}" ${etf.symbol === item.symbol ? "selected" : ""}>${esc(item.symbol)}</option>`).join("")}</select>
          </label>
        </div>
        <div class="grid two etf-analysis-grid">
          ${renderEtfHoldingsPanel(etf)}
          ${renderEtfRegionPanel(etf)}
          ${renderEtfSectorPanel(etf)}
          ${renderEtfStructurePanel(etf)}
          ${renderEtfDistributionPanel(etf)}
          ${renderEtfPortfolioFitPanel(etf)}
        </div>
        ${renderDataMeta(etfDataMeta(etf))}
      </article>
    `;
  }

  function renderEtfHoldingsPanel(etf) {
    const top5 = etfHoldingConcentration(etf);
    const top10 = etfTop10Concentration(etf);
    const hint = top5 >= 45 ? "Stark konzentriert" : top5 >= 25 ? "Spürbare Mega-Cap-Last" : "Breiter verteilt";
    return `
      <div class="etf-analysis-panel">
        <span class="card-label">Holdings</span>
        <h4>${esc(hint)}</h4>
        <div class="metric-grid compact-metric-grid">
          ${renderMiniMetric("Top-5", `${formatNumber(top5)}%`)}
          ${renderMiniMetric("Top-10", `${formatNumber(top10)}%`)}
        </div>
        <div class="mini-bars">${etf.holdings.map(([name, weight]) => renderMiniBar(name, weight)).join("")}</div>
        <p>${esc(etfConcentrationLabel(etf))}</p>
      </div>
    `;
  }

  function renderEtfRegionPanel(etf) {
    const topRegion = etfTopRegion(etf);
    return `
      <div class="etf-analysis-panel">
        <span class="card-label">Regionen / Länder</span>
        <h4>${esc(topRegion ? `${topRegion[0]} dominiert` : "Region offen")}</h4>
        <div class="mini-bars">${etf.region.map(([name, weight]) => renderMiniBar(name, weight)).join("")}</div>
        <p>${esc(etfRegionLabel(etf))}</p>
      </div>
    `;
  }

  function renderEtfSectorPanel(etf) {
    return `
      <div class="etf-analysis-panel">
        <span class="card-label">Sektoren / Themen</span>
        <h4>${esc(etfSectorHeadline(etf))}</h4>
        <div class="mini-bars">${(etf.sectors || []).map(([name, weight]) => renderMiniBar(name, weight)).join("") || renderEmptyState("Keine sektorale Detailstruktur verfügbar.")}</div>
        <p>${esc(etfSectorHint(etf))}</p>
      </div>
    `;
  }

  function renderEtfStructurePanel(etf) {
    return `
      <div class="etf-analysis-panel">
        <span class="card-label">Währung / Struktur</span>
        <h4>${esc(etf.structureType || "Struktur offen")}</h4>
        <div class="research-metric-list">
          ${renderResearchMetricList([
            { label: "Fondswährung", value: etf.fundCurrency || etf.currency || "nicht verfügbar" },
            { label: "Handelswährung", value: etf.currency || "nicht verfügbar" },
            { label: "Domizil", value: etf.domicile || "nicht verfügbar" },
            { label: "Replikation", value: etf.replication || "nicht verfügbar" }
          ])}
        </div>
        <p>${esc(etf.fxRisk || "Währungsrisiko nicht ausreichend verfügbar.")}</p>
      </div>
    `;
  }

  function renderEtfDistributionPanel(etf) {
    return `
      <div class="etf-analysis-panel">
        <span class="card-label">Ausschüttend vs. thesaurierend</span>
        <h4>${esc(etf.distribution)}</h4>
        <p>${esc(distributionExplanation(etf))}</p>
        <p class="small">Steuerliche Behandlung hängt vom Land und persönlichen Fall ab. Diese Einordnung ist keine Steuerberatung.</p>
      </div>
    `;
  }

  function renderEtfPortfolioFitPanel(etf) {
    const hints = etfPortfolioFitHints(etf);
    return `
      <div class="etf-analysis-panel">
        <span class="card-label">Portfolio-Fit</span>
        <h4>${esc(etfPortfolioFitLabel(etf))}</h4>
        <div class="etf-risk-list">
          ${hints.map((item) => `<div class="research-bullet"><span class="pill ${escAttr(item.tone)}">${esc(item.label)}</span><p>${esc(item.text)}</p></div>`).join("")}
        </div>
        <div class="row-actions">
          ${assetMap.has(etf.symbol) ? `<button class="ghost-button" type="button" data-etf-portfolio-fit="${escAttr(etf.symbol)}">In Portfolio-Simulation prüfen</button>` : ""}
          ${assetMap.has(etf.symbol) ? `<button class="ghost-button" type="button" data-compare-open="${escAttr(etf.symbol)}">Mit ETF vergleichen</button>` : ""}
        </div>
      </div>
    `;
  }

  function renderEtfCommonRows(title, rows, emptyText) {
    return `
      <div class="etf-common-card">
        <span class="card-label">${esc(title)}</span>
        <div class="stack-list">
          ${rows.map((row) => `
            <div class="compact-row">
              <span>${esc(row.name)}</span>
              <strong>${formatNumber(row.weight)}%</strong>
              <small>${formatNumber(row.left)}% / ${formatNumber(row.right)}%</small>
            </div>
          `).join("") || renderEmptyState(emptyText)}
        </div>
      </div>
    `;
  }

  function etfBySymbol(symbol) {
    return ETF_DATA.find((item) => item.symbol === normalizeSymbol(symbol)) || null;
  }

  function etfUniverseSummary() {
    const avgTer = average(ETF_DATA.map((etf) => etf.ter));
    const cheapest = ETF_DATA.reduce((best, etf) => etf.ter < best.ter ? etf : best, ETF_DATA[0]);
    const concentrated = ETF_DATA
      .map((etf) => ({ symbol: etf.symbol, concentration: etfHoldingConcentration(etf) }))
      .sort((a, b) => b.concentration - a.concentration)[0];
    const regionHeavy = ETF_DATA
      .map((etf) => {
        const top = etfTopRegion(etf) || ["offen", 0];
        return { symbol: etf.symbol, weight: top[1], region: `${top[0]} ${formatNumber(top[1])}%` };
      })
      .sort((a, b) => b.weight - a.weight)[0];
    let strongest = { label: "nicht verfügbar", score: 0 };
    ETF_DATA.forEach((left, leftIndex) => {
      ETF_DATA.slice(leftIndex + 1).forEach((right) => {
        const overlap = etfOverlap(left, right);
        const score = overlap.score * 0.7 + overlap.regionScore * 0.2 + overlap.sectorScore * 0.1;
        if (score > strongest.score) {
          strongest = { label: `${left.symbol}/${right.symbol} · ${formatNumber(score)}%`, score };
        }
      });
    });
    const conclusion = `${cheapest.symbol} ist im lokalen Universum am günstigsten. ${concentrated.symbol} hat die höchste Top-5-Konzentration; ${regionHeavy.symbol} zeigt die stärkste Regionenlast. Overlap sollte vor ETF-Kombinationen geprüft werden.`;
    return {
      count: ETF_DATA.length,
      avgTer,
      cheapest,
      concentrated,
      regionHeavy,
      overlapPair: strongest.label,
      title: `${ETF_DATA.length} strukturierte ETF-Bausteine`,
      text: "Kosten, Konzentration, Länder-/Sektorlast und Portfolio-Rolle werden zentral sichtbar.",
      conclusion
    };
  }

  function etfDataMeta(etf) {
    return makeMeta(etf.dataNote || "Lokale ETF-Strukturdaten", "local", BOOT_TIME, "ETF-Struktur ist lokal gepflegt; Marktpreise können je nach Asset live/hybrid oder fallback sein.");
  }

  function etfCategoryTags(etf) {
    return unique([
      etf.role,
      etf.category,
      etf.structureType,
      etf.distribution,
      etfTopRegion(etf)?.[0],
      etfSectorHeadline(etf)
    ]).filter(Boolean).slice(0, 6);
  }

  function etfTopRegion(etf) {
    return (etf.region || []).slice().sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))[0] || null;
  }

  function etfTopSector(etf) {
    return (etf.sectors || []).slice().sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))[0] || null;
  }

  function etfTop10Concentration(etf) {
    if (Number.isFinite(Number(etf.top10))) {
      return Number(etf.top10);
    }
    return etfHoldingConcentration(etf);
  }

  function etfConcentrationLabel(etf) {
    const top5 = etfHoldingConcentration(etf);
    if (top5 >= 80) {
      return "Kein klassischer Aktienkorb: die Struktur konzentriert sich bewusst auf einen Rohstoff- oder Anleihebaustein.";
    }
    if (top5 >= 45) {
      return "Hohe Top-5-Konzentration. Prüfe, ob der ETF wirklich als Core taugt oder eher Satellit ist.";
    }
    if (top5 >= 25) {
      return "Spürbare Konzentration in großen Einzeltiteln, aber noch breiter als viele Themen-ETFs.";
    }
    return "Top-Holdings sind vergleichsweise moderat gewichtet; Diversifikation kommt eher über Breite und Regionen.";
  }

  function etfRegionLabel(etf) {
    const top = etfTopRegion(etf);
    if (!top) {
      return "Regionenstruktur nicht verfügbar.";
    }
    if (top[1] >= 95) {
      return `${top[0]} dominiert fast vollständig. Das ist kein global neutraler ETF.`;
    }
    if (top[1] >= 70) {
      return `${top[0]} ist stark übergewichtet. Als Satellit plausibel, als Weltportfolio begrenzt.`;
    }
    if (top[1] >= 55) {
      return `${top[0]} ist größte Region, aber weitere Regionen tragen sichtbar bei.`;
    }
    return "Regionen wirken breiter verteilt; genaue Ländergewichte bleiben lokale Strukturwerte.";
  }

  function etfSectorHeadline(etf) {
    const top = etfTopSector(etf);
    if (!top) {
      return "Sektorstruktur offen";
    }
    if (top[0] === "Edelmetalle" || top[0] === "Staatsanleihen") {
      return top[0];
    }
    return top[1] >= 40 ? `${top[0]}-lastig` : `${top[0]} größter Sektor`;
  }

  function etfSectorHint(etf) {
    const top = etfTopSector(etf);
    if (!top) {
      return "Keine belastbare Sektorstruktur verfügbar; deshalb keine harte Sektorbehauptung.";
    }
    if (top[1] >= 45) {
      return `${top[0]} prägt den ETF stark. Das kann Themenchance sein, erhöht aber Klumpenrisiko.`;
    }
    if ((etf.sectors || []).length >= 5) {
      return "Mehrere Sektoren sind sichtbar vertreten; die Einordnung bleibt eine strukturierte lokale Näherung.";
    }
    return "Sektorbild ist bewusst grob gehalten und nicht als Live-Holdings-Feed zu verstehen.";
  }

  function etfCurrencyHint(etf) {
    if (etf.currency === "EUR" && etf.fundCurrency && etf.fundCurrency !== "EUR") {
      return `Handel in EUR, Fonds-/Basiswährung ${etf.fundCurrency}; Währungsrisiko steckt weiterhin in den Basiswerten.`;
    }
    return etf.fxRisk || `${etf.currency || "Währung"}-Exposure prüfen.`;
  }

  function etfRiskHints(etf) {
    const hints = [];
    const top5 = etfHoldingConcentration(etf);
    const topRegion = etfTopRegion(etf);
    const topSector = etfTopSector(etf);
    if (etf.ter >= 0.5) {
      hints.push({ label: "Kosten", tone: "bear", text: `TER ${formatNumber(etf.ter)}% ist im lokalen Vergleich hoch. Prüfe, ob der Nutzen diese Kosten rechtfertigt.` });
    } else if (etf.ter <= 0.1) {
      hints.push({ label: "Kosten", tone: "bull", text: `TER ${formatNumber(etf.ter)}% ist sehr niedrig und langfristig ein Pluspunkt.` });
    }
    if (top5 >= 45) {
      hints.push({ label: "Konzentration", tone: "bear", text: `Top-5-Holdings bei ${formatNumber(top5)}%. Einzelwert- oder Faktorlast ist deutlich.` });
    } else {
      hints.push({ label: "Konzentration", tone: "neutral", text: `Top-5-Holdings bei ${formatNumber(top5)}%. Konzentration bleibt sichtbar, aber einordnungsabhängig.` });
    }
    if (topRegion && topRegion[1] >= 75) {
      hints.push({ label: "Region", tone: "neutral", text: `${topRegion[0]}-Anteil von ${formatNumber(topRegion[1])}% kann Länder-/Währungsrisiko bündeln.` });
    }
    if (topSector && topSector[1] >= 40) {
      hints.push({ label: "Thema", tone: "neutral", text: `${topSector[0]} ist dominant. Das spricht eher für Satellit als für neutralen Core.` });
    }
    if (etf.structureType && !String(etf.structureType).includes("UCITS")) {
      hints.push({ label: "Struktur", tone: "neutral", text: `${etf.structureType}: für europäische Anleger Struktur, Handelbarkeit und Steuerkontext separat prüfen.` });
    }
    return hints.length ? hints : [{ label: "Datenlage", tone: "neutral", text: "Strukturdaten lokal gepflegt; vor einer Entscheidung Emittentendaten prüfen." }];
  }

  function etfPortfolioFitLabel(etf) {
    const top5 = etfHoldingConcentration(etf);
    const topRegion = etfTopRegion(etf);
    if (String(etf.role || "").toLowerCase().includes("core") && top5 < 35 && (!topRegion || topRegion[1] < 75)) {
      return "eher Core-tauglich";
    }
    if (top5 >= 45 || (topRegion && topRegion[1] >= 90)) {
      return "eher Satellit / Konzentrationsbaustein";
    }
    if (String(etf.category || "").includes("Gold") || String(etf.category || "").includes("Staatsanleihen")) {
      return "eher Diversifikations-/Hedge-Baustein";
    }
    return "Core/Satellite abhängig von Gewichtung";
  }

  function etfPortfolioFitHints(etf) {
    const hints = [];
    const topRegion = etfTopRegion(etf);
    const topSector = etfTopSector(etf);
    hints.push({ label: "Rolle", tone: "neutral", text: etf.useCase || etf.role || "ETF-Baustein für Portfolio-Exposure." });
    if (topRegion) {
      hints.push({ label: "Exposure", tone: topRegion[1] >= 75 ? "bear" : "neutral", text: `${topRegion[0]} wäre der wichtigste regionale Einfluss.` });
    }
    if (topSector) {
      hints.push({ label: "Sektor", tone: topSector[1] >= 40 ? "bear" : "neutral", text: `${topSector[0]} prägt den ETF am stärksten.` });
    }
    if (etf.ter <= 0.15) {
      hints.push({ label: "Kosten", tone: "bull", text: "Kostenprofil wirkt für langfristige Nutzung günstig." });
    }
    return hints.slice(0, 4);
  }

  function etfCostProjection(amount, monthly, years, ter, annualReturnPct) {
    const months = Math.max(0, Math.round(Number(years || 0) * 12));
    const grossRate = Number(annualReturnPct || 0) / 100 / 12;
    const netRate = (Number(annualReturnPct || 0) - Number(ter || 0)) / 100 / 12;
    let gross = Math.max(0, Number(amount || 0));
    let net = gross;
    const contribution = Math.max(0, Number(monthly || 0));
    for (let index = 0; index < months; index += 1) {
      gross *= 1 + grossRate;
      net *= 1 + netRate;
      gross += contribution;
      net += contribution;
    }
    return {
      contributed: Math.max(0, Number(amount || 0)) + contribution * months,
      grossEndValue: gross,
      endValue: net,
      feeDrag: Math.max(0, gross - net)
    };
  }

  function etfAnnualCostEstimate(amount, monthly, ter) {
    const averageCapital = Math.max(0, Number(amount || 0)) + Math.max(0, Number(monthly || 0)) * 6;
    return averageCapital * Number(ter || 0) / 100;
  }

  function etfOverlapLevel(overlap) {
    if (overlap.score >= 20 || overlap.regionScore >= 90 || overlap.sectorScore >= 70) {
      return { label: "hoch", tone: "bear" };
    }
    if (overlap.score >= 8 || overlap.regionScore >= 60 || overlap.sectorScore >= 40) {
      return { label: "mittel", tone: "neutral" };
    }
    return { label: "gering", tone: "bull" };
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
    const assetEtf = research.etf;

    ensureAssetData(symbol);
    ensureEventData();

    app.innerHTML = `
      <section class="asset-hero">
        <div class="asset-main">
          <p class="eyebrow">${asset.type === "ETF" ? "ETF-Asset-Seite" : "Einzelaktien-Seite"}</p>
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
            <button class="ghost-button" type="button" data-journal-open="${escAttr(symbol)}" data-journal-context="asset">Journal-Eintrag</button>
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

      ${renderModuleActionBar("asset", { symbol })}
      ${renderNextSteps("asset", { symbol })}
      <section class="section">
        <div class="kpi-strip">
          ${assetEtf
            ? renderEtfAssetKpis(assetEtf)
            : `
              ${renderKpi("Market Cap", formatCompactMoney(valueOr(profile.marketCap, fundamentals.marketCap), asset.currency), profile.meta || fundamentals.meta)}
              ${renderKpi("KGV", formatNumber(valueOr(fundamentals.pe, asset.fallback.pe), "x"), fundamentals.meta)}
              ${renderKpi("EPS", formatMoney(valueOr(fundamentals.eps, asset.fallback.eps), asset.currency), fundamentals.meta)}
              ${renderKpi("Umsatz", formatCompactMoney(valueOr(fundamentals.revenue, asset.fallback.revenue), asset.currency), fundamentals.meta)}
            `}
        </div>
        ${renderAssetDataStatusStrip({ quote, profile, fundamentals, news, events })}
        ${renderAssetAlertStrip(symbol)}
      </section>

      <section class="section asset-research-section">
        ${renderAssetResearchSnapshot(assetContext, research)}
        ${assetEtf ? renderEtfAssetSnapshot(assetEtf) : ""}
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
          <button class="ghost-button" type="button" data-journal-open="${escAttr(symbol)}" data-journal-context="research">These festhalten</button>
          <button class="ghost-button" type="button" data-route="events">Events prüfen</button>
          <button class="ghost-button" type="button" data-route="data-health">Datenqualität ansehen</button>
        </div>
      </article>
    `;
  }

  function renderEtfAssetKpis(etf) {
    const topRegion = etfTopRegion(etf);
    return `
      ${renderKpi("TER", `${formatNumber(etf.ter)}%`, etfDataMeta(etf))}
      ${renderKpi("Ausschüttung", etf.distribution, etfDataMeta(etf))}
      ${renderKpi("Top-Region", topRegion ? `${topRegion[0]} ${formatNumber(topRegion[1])}%` : "nicht verfügbar", etfDataMeta(etf))}
      ${renderKpi("Top-5", `${formatNumber(etfHoldingConcentration(etf))}%`, etfDataMeta(etf))}
    `;
  }

  function renderEtfAssetSnapshot(etf) {
    return `
      <article class="card asset-etf-snapshot">
        <div class="card-topline">
          <div>
            <span class="card-label">ETF-Research-Snapshot</span>
            <h3>${esc(etf.symbol)} als Portfolio-Baustein</h3>
            <p>${esc(etf.useCase)} Die Struktur stammt aus der lokalen ETF-V2-Datenbasis.</p>
          </div>
          ${renderStatusBadge("local")}
        </div>
        <div class="grid three">
          ${renderEtfHoldingsPanel(etf)}
          ${renderEtfRegionPanel(etf)}
          ${renderEtfPortfolioFitPanel(etf)}
        </div>
        <div class="row-actions">
          <button class="ghost-button" type="button" data-route="etf">ETF-Bereich öffnen</button>
          <button class="ghost-button" type="button" data-compare-open="${escAttr(etf.symbol)}">Quick Compare</button>
          <button class="ghost-button" type="button" data-etf-portfolio-fit="${escAttr(etf.symbol)}">Portfolio-Fit prüfen</button>
        </div>
        ${renderDataMeta(etfDataMeta(etf))}
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
      dataStatus,
      etf
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
          ${renderDataMeta(makeMeta("Lokales Journal", "local", Date.now(), "Journal-Einträge bleiben lokal im Browser; Auswertungen sind Produktlogik."), true)}
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
          <div class="row-actions">
            <button class="primary-button" type="submit">Journal-Eintrag speichern</button>
            <button class="ghost-button" type="button" data-journal-open="${escAttr(symbol)}" data-journal-context="asset-tab">Journal V2 öffnen</button>
          </div>
        </form>
        <div class="stack-list journal-list">
          ${entries.map((entry) => `
            <div class="journal-row">
              <strong>${esc(entry.thesis)}</strong>
              <span class="small">${formatTimestamp(entry.timestamp)} | ${esc(journalEmotionLabel(entry.emotion))} | ${esc(entry.ruleCheck)}</span>
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
        ${renderReportCenterCard()}
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

  function renderReportCenterCard() {
    return `
      <article class="card report-center-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Report-Center V2</span>
            <h3>Druckbare Research-Dokumente</h3>
            <p>Erstellt strukturierte Browser-PDF-Reports aus bestehenden Modulen. Keine Server-PDFs, keine neue Bibliothek, keine externen Datenpfade.</p>
          </div>
          ${renderDataMeta(makeMeta("HTML/CSS Print Export", "local", Date.now(), "Reports nutzen vorhandene Live-, Hybrid-, Fallback- und lokale Datenstatus."), true)}
        </div>
        <div class="module-chip-row report-type-row">
          <button class="ghost-button" type="button" data-report="asset" data-symbol="${escAttr(state.activeSymbol)}">Asset-Report</button>
          <button class="ghost-button" type="button" data-report="portfolio">Portfolio-Report</button>
          <button class="ghost-button" type="button" data-report="etf">ETF-Report</button>
          <button class="ghost-button" type="button" data-report="macro">Makro-Report</button>
          <button class="ghost-button" type="button" data-report="screener">Screener-Report</button>
          <button class="ghost-button" type="button" data-report="dailyRecap">Tages-Recap</button>
          <button class="ghost-button" type="button" data-report="watchlist">Watchlist-Report</button>
        </div>
        <p class="small">Die Vorschau öffnet eine print-optimierte Report-Ansicht. Über den Browser-Dialog kann sie als PDF gespeichert werden.</p>
      </article>
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
      ${renderModuleActionBar("portfolio")}
      ${renderNextSteps("portfolio")}

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
            ${analysis.positions.map((row) => renderPortfolioPosition(row, analysis)).join("") || renderGuidedEmptyState("portfolio")}
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

  function renderPreferencesPage() {
    const prefs = dashboardPrefs();
    app.innerHTML = `
      <section class="section preferences-page">
        <div class="section-head">
          <div>
            <p class="eyebrow">Personalization V2</p>
            <h1>Dein MH-Analytics-Cockpit.</h1>
            <p>Ordne Startseite, Favoriten, Standardansichten und Hinweise nach deinem Arbeitsstil. Alles bleibt lokal im Browser, ohne Login, Cloud-Sync oder Betreiber-Konfiguration.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-route="home">Zur Startseite</button>
            <button class="ghost-button danger-button" type="button" data-preferences-reset>Zurücksetzen</button>
          </div>
        </div>

        <div class="grid two preferences-overview-grid">
          <article class="card personalization-panel">
            <div class="card-topline">
              <div>
                <span class="card-label">Dashboard-Modus</span>
                <h3>${esc(preferenceModeLabel(prefs.mode))}</h3>
                <p>${esc(DASHBOARD_MODES[prefs.mode]?.description || DASHBOARD_MODES.investor.description)}</p>
              </div>
              ${renderDataMeta(makeMeta("Lokale User Preferences", "local", Date.now(), "Nur Nutzerpraeferenzen, keine geheimen Betreiber-Schluessel."), true)}
            </div>
            <div class="mode-card-grid">
              ${Object.entries(DASHBOARD_MODES).map(([mode, config]) => `
                <button class="mode-option ${prefs.mode === mode ? "active" : ""}" type="button" data-dashboard-mode="${escAttr(mode)}">
                  <strong>${esc(config.label)}</strong>
                  <span>${esc(config.description)}</span>
                </button>
              `).join("")}
            </div>
          </article>

          <article class="card preference-storage-card">
            <span class="card-label">Lokale Speicherung</span>
            <h3>Privat im aktuellen Browser</h3>
            <p>Einstellungen, Favoriten, Modulreihenfolge und Standardansichten werden lokal gespeichert. Auf einem anderen Gerät oder in einem anderen Browser starten sie wieder mit Standardwerten.</p>
            <div class="metric-grid">
              ${renderMiniMetric("Speicher-Key", STORAGE_KEYS.userPreferences)}
              ${renderMiniMetric("Login", "nicht nötig")}
              ${renderMiniMetric("Cloud-Sync", "aus")}
              ${renderMiniMetric("Provider-Schlüssel", "nicht gespeichert")}
            </div>
          </article>
        </div>
      </section>

      <section class="section">
        <div class="grid two">
          <article class="card preference-card">
            <div class="card-topline">
              <div>
                <span class="card-label">Startseitenmodule</span>
                <h3>Oben, normal oder ausblenden</h3>
                <p>Keine Drag-and-drop-Spielerei: einfache Prioritäten sortieren die Startseite stabil.</p>
              </div>
            </div>
            <div class="module-preference-list">
              ${HOME_MODULE_CATALOG.map((module) => renderModulePreferenceRow(module, prefs.modules[module.id])).join("")}
            </div>
          </article>

          <article class="card preference-card">
            <div class="card-topline">
              <div>
                <span class="card-label">Favoriten & Shortcuts</span>
                <h3>Schneller Zugriff auf das Wichtige</h3>
                <p>Favoriten priorisieren Suche, Recap, Watchlist-Kontext und Startseite. Shortcuts beschleunigen die Navigation.</p>
              </div>
            </div>
            <div class="preference-subblock">
              <span class="card-label">Favoriten</span>
              <div class="chip-row">
                ${favoriteAssetCandidates().map((asset) => `<button class="chip ${isFavoriteSymbol(asset.symbol) ? "active" : ""}" type="button" data-favorite-symbol="${escAttr(asset.symbol)}">${esc(asset.symbol)}</button>`).join("")}
              </div>
            </div>
            <div class="preference-subblock">
              <span class="card-label">Shortcuts (${prefs.shortcuts.length}/6)</span>
              <div class="shortcut-grid">
                ${SHORTCUT_CATALOG.map((shortcut) => `
                  <button class="mode-option shortcut-option ${prefs.shortcuts.includes(shortcut.id) ? "active" : ""}" type="button" data-shortcut-toggle="${escAttr(shortcut.id)}">
                    <strong>${esc(shortcut.label)}</strong>
                    <span>${esc(routeLabel(shortcut.route))}</span>
                  </button>
                `).join("")}
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="section">
        <div class="section-head compact-section-head">
          <div>
            <h2>Standardansichten</h2>
            <p>Wichtige Modul-Defaults werden lokal gespeichert und beim nächsten Laden angewendet.</p>
          </div>
        </div>
        <div class="grid three preferences-default-grid">
          ${renderScreenerPreferences(prefs)}
          ${renderEventPreferences(prefs)}
          ${renderEtfPreferences(prefs)}
          ${renderPortfolioPreferences(prefs)}
          ${renderComparePreferences(prefs)}
          ${renderReportPreferences(prefs)}
        </div>
      </section>

      <section class="section">
        <div class="grid two">
          <article class="card preference-card">
            <span class="card-label">Anlegerprofil</span>
            <h3>Darstellung nach deinem Stil gewichten</h3>
            <p>Das Profil steuert Priorisierung und Hinweis-Tiefe. Es ist keine Empfehlung und kein Risikomodell.</p>
            <div class="form-grid">
              ${renderPreferenceSelect("profile.goal", "Ziel", prefs.profile.goal, Object.entries(PROFILE_OPTION_LABELS.goal))}
              ${renderPreferenceSelect("profile.horizon", "Zeithorizont", prefs.profile.horizon, Object.entries(PROFILE_OPTION_LABELS.horizon))}
              ${renderPreferenceSelect("profile.risk", "Risikotoleranz", prefs.profile.risk, Object.entries(PROFILE_OPTION_LABELS.risk))}
              ${renderPreferenceSelect("profile.experience", "Erfahrung", prefs.profile.experience, Object.entries(PROFILE_OPTION_LABELS.experience))}
            </div>
            <div class="preference-subblock">
              <span class="card-label">Fokusbereiche</span>
              <div class="chip-row">
                ${Object.entries(PROFILE_OPTION_LABELS.focus).map(([value, label]) => `<button class="chip ${prefs.profile.focus.includes(value) ? "active" : ""}" type="button" data-profile-focus="${escAttr(value)}">${esc(label)}</button>`).join("")}
              </div>
            </div>
          </article>

          <article class="card preference-card">
            <span class="card-label">Anzeigeeinstellungen</span>
            <h3>Kompakter oder erklärender arbeiten</h3>
            <p>Dark/Light Mode bleibt oben im Header. Diese Optionen steuern Detailgrad, Formate und Datenstatus-Hinweise.</p>
            <div class="form-grid">
              ${renderPreferenceSelect("display.detail", "Detailgrad", prefs.display.detail, [["compact", "kompakt"], ["normal", "normal"], ["detailed", "detailliert"]])}
              ${renderPreferenceSelect("display.numberFormat", "Zahlenformat", prefs.display.numberFormat, [["de", "Deutsch"], ["en", "Englisch"]])}
              ${renderPreferenceSelect("display.currency", "Hauptwährung", prefs.display.currency, [["EUR", "EUR"], ["USD", "USD"]])}
              ${renderPreferenceSelect("display.performanceView", "Darstellung", prefs.display.performanceView, [["percentFirst", "Prozent zuerst"], ["amountFirst", "Betrag zuerst"]])}
              ${renderPreferenceSelect("display.dataStatus", "Datenstatus-Hinweise", prefs.display.dataStatus, [["compact", "kompakt"], ["normal", "normal"], ["detailed", "ausführlich"]])}
              ${renderPreferenceCheckbox("display.beginnerHelp", "Anfänger-Erklärungen anzeigen", prefs.display.beginnerHelp)}
            </div>
            ${prefs.display.beginnerHelp ? renderBeginnerExplanationPreview() : `<p class="small preference-help-note">Anfänger-Erklärungen sind aus. Die Oberfläche bleibt kompakter.</p>`}
          </article>
        </div>
      </section>
    `;
  }

  function renderModulePreferenceRow(module, priority) {
    return `
      <div class="module-preference-row">
        <div>
          <strong>${esc(module.label)}</strong>
          <small>${esc(module.description)}</small>
        </div>
        <div class="segmented-actions">
          ${["high", "normal", "hidden"].map((value) => `
            <button class="chip ${priority === value ? "active" : ""}" type="button" data-module-pref="${escAttr(module.id)}" data-module-priority="${escAttr(value)}">${esc(modulePriorityLabel(value))}</button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderPreferenceSelect(name, label, value, options) {
    return `
      <label class="field">
        <span>${esc(label)}</span>
        <select data-pref-control name="${escAttr(name)}">
          ${options.map(([optionValue, optionLabel]) => `<option value="${escAttr(optionValue)}" ${String(value) === String(optionValue) ? "selected" : ""}>${esc(optionLabel)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function renderPreferenceNumber(name, label, value, attrs = "") {
    return `
      <label class="field">
        <span>${esc(label)}</span>
        <input data-pref-control name="${escAttr(name)}" type="number" value="${escAttr(value)}" ${attrs}>
      </label>
    `;
  }

  function renderPreferenceCheckbox(name, label, checked) {
    return `
      <label class="field checkbox-field">
        <span>${esc(label)}</span>
        <input data-pref-control name="${escAttr(name)}" type="checkbox" ${checked ? "checked" : ""}>
      </label>
    `;
  }

  function renderScreenerPreferences(prefs) {
    return `
      <article class="card preference-card">
        <span class="card-label">Screener</span>
        <h3>Filter & Sortierung</h3>
        <div class="form-grid one-column">
          ${renderPreferenceSelect("defaults.screener.sort", "Sortierung", prefs.defaults.screener.sort, screenerSortOptions())}
          ${renderPreferenceSelect("defaults.screener.assetType", "Asset-Typ", prefs.defaults.screener.assetType, screenerAssetTypeOptions())}
          ${renderPreferenceSelect("defaults.screener.region", "Region", prefs.defaults.screener.region, screenerRegionOptions())}
          ${renderPreferenceSelect("defaults.screener.sector", "Sektor", prefs.defaults.screener.sector, screenerSectorOptions())}
          ${renderPreferenceSelect("defaults.screener.style", "Stil", prefs.defaults.screener.style, screenerStyleOptions())}
          ${renderPreferenceSelect("defaults.screener.marketCap", "Asset-Klasse", prefs.defaults.screener.marketCap, screenerMarketCapOptions())}
          ${renderPreferenceSelect("defaults.screener.dataStatus", "Datenstatus", prefs.defaults.screener.dataStatus, screenerDataStatusOptions())}
          ${renderPreferenceSelect("defaults.screener.personal", "Watchlist / Favoriten", prefs.defaults.screener.personal, [["all", "ohne persoenlichen Filter"], ["watchlist", "nur Watchlist"], ["favorites", "nur Favoriten"]])}
          ${renderPreferenceSelect("defaults.screener.eventContext", "Event-Kontext", prefs.defaults.screener.eventContext, screenerEventOptions())}
          ${renderPreferenceSelect("defaults.screener.performance", "Performance", prefs.defaults.screener.performance, [["all", "Alle"], ["positive", "1M positiv"], ["strong", "1M > 5%"], ["weak", "1M < 0%"]])}
        </div>
      </article>
    `;
  }

  function renderEventPreferences(prefs) {
    return `
      <article class="card preference-card">
        <span class="card-label">Event-Hub</span>
        <h3>Zeitraum & Filter</h3>
        <div class="form-grid one-column">
          ${renderPreferenceSelect("defaults.eventHub.window", "Zeitraum", prefs.defaults.eventHub.window, [["today", "heute"], ["week", "diese Woche"], ["next", "nächste Woche"]])}
          ${renderPreferenceSelect("defaults.eventHub.type", "Typ", prefs.defaults.eventHub.type, [["all", "alle"], ["earnings", "Earnings"], ["dividend", "Dividenden"], ["macro", "Makro"], ["ipo", "IPO"]])}
          ${renderPreferenceSelect("defaults.eventHub.scope", "Bereich", prefs.defaults.eventHub.scope, [["all", "alle"], ["watchlist", "nur Watchlist"], ["stock", "nur Aktie"], ["macro", "nur Makro"]])}
          ${renderPreferenceSelect("defaults.eventHub.relevance", "Relevanz", prefs.defaults.eventHub.relevance, [["all", "alle"], ["high", "hoch"], ["medium", "mindestens mittel"]])}
        </div>
      </article>
    `;
  }

  function renderEtfPreferences(prefs) {
    return `
      <article class="card preference-card">
        <span class="card-label">ETF</span>
        <h3>Vergleich & Kostenannahmen</h3>
        <div class="form-grid one-column">
          ${renderPreferenceSelect("defaults.etf.left", "ETF A", prefs.defaults.etf.left, ETF_DATA.map((etf) => [etf.symbol, `${etf.symbol} - ${etf.name}`]))}
          ${renderPreferenceSelect("defaults.etf.right", "ETF B", prefs.defaults.etf.right, ETF_DATA.map((etf) => [etf.symbol, `${etf.symbol} - ${etf.name}`]))}
          ${renderPreferenceNumber("defaults.etf.amount", "Anlagebetrag", prefs.defaults.etf.amount)}
          ${renderPreferenceNumber("defaults.etf.monthly", "Sparplan monatlich", prefs.defaults.etf.monthly)}
          ${renderPreferenceNumber("defaults.etf.years", "Laufzeit Jahre", prefs.defaults.etf.years)}
          ${renderPreferenceNumber("defaults.etf.returnRate", "Renditeannahme %", prefs.defaults.etf.returnRate, `step="0.1"`)}
        </div>
      </article>
    `;
  }

  function renderPortfolioPreferences(prefs) {
    return `
      <article class="card preference-card">
        <span class="card-label">Portfolio</span>
        <h3>Standardportfolio</h3>
        <div class="form-grid one-column">
          ${renderPreferenceSelect("defaults.portfolio.activePortfolioId", "Portfolio", prefs.defaults.portfolio.activePortfolioId, state.portfolios.map((portfolio) => [portfolio.id, `${portfolio.name} (${portfolio.type === "real" ? "Echtgeld" : "Test"})`]))}
          ${renderPreferenceSelect("defaults.portfolio.view", "Ansicht", prefs.defaults.portfolio.view, [["overview", "Übersicht"], ["risk", "Risiko"], ["exposure", "Exposure"], ["positions", "Positionen"]])}
        </div>
      </article>
    `;
  }

  function renderComparePreferences(prefs) {
    return `
      <article class="card preference-card">
        <span class="card-label">Quick Compare</span>
        <h3>Bevorzugtes Paar</h3>
        <div class="form-grid one-column">
          <label class="field"><span>Asset A</span><select data-pref-control name="defaults.compare.left">${compareOptions(prefs.defaults.compare.left)}</select></label>
          <label class="field"><span>Asset B</span><select data-pref-control name="defaults.compare.right">${compareOptions(prefs.defaults.compare.right)}</select></label>
        </div>
      </article>
    `;
  }

  function renderReportPreferences(prefs) {
    return `
      <article class="card preference-card">
        <span class="card-label">Reports</span>
        <h3>Export-Standard</h3>
        <div class="form-grid one-column">
          ${renderPreferenceSelect("defaults.reports.type", "Report-Typ", prefs.defaults.reports.type, [["asset", "Asset"], ["portfolio", "Portfolio"], ["etf", "ETF"], ["macro", "Makro"], ["dailyRecap", "Tages-Recap"], ["watchlist", "Watchlist"]])}
          ${renderPreferenceCheckbox("defaults.reports.showDataStatus", "Datenstatus standardmäßig zeigen", prefs.defaults.reports.showDataStatus)}
        </div>
      </article>
    `;
  }

  function renderBeginnerExplanationPreview() {
    const terms = [
      ["KGV", "Bewertung im Verhältnis zum Gewinn."],
      ["TER", "laufende ETF-Kosten pro Jahr."],
      ["Yield Curve", "Vergleich kurzer und langer Zinsen."],
      ["Realzins", "Zins minus Inflation als grobe Näherung."],
      ["Hybrid", "Mischung aus echten Daten und lokaler Logik."]
    ];
    return `
      <div class="preference-help-list">
        ${terms.map(([term, text]) => `<div class="insight-row"><span class="pill">${esc(term)}</span><p>${esc(text)}</p></div>`).join("")}
      </div>
    `;
  }

  function routeLabel(route) {
    const module = HOME_MODULE_CATALOG.find((item) => item.route === route);
    if (module) return module.label;
    if (route === "legal") return "Rechtliches";
    if (route === "settings") return "Datenquellen";
    if (route === "data-health") return "Data Health";
    return capitalize(route);
  }

  function renderLegalPage() {
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Launch-Readiness</p>
            <h1>Rechtliches vorbereiten.</h1>
            <p>Platzhalter fuer Impressum, Datenschutz und Disclaimer. Der Betreiber muss diese Inhalte vor oeffentlicher Nutzung rechtlich pruefen und final ausfuellen.</p>
          </div>
          ${renderStatusBadge("local")}
        </div>
        <div class="legal-grid">
          <article class="card legal-card">
            <span class="card-label">Impressum</span>
            <h3>Betreiberangaben fehlen noch</h3>
            <p>Bitte vor dem Launch final ausfuellen und rechtlich pruefen lassen.</p>
            <ul class="clean-list">
              <li>Betreibername: [bitte eintragen]</li>
              <li>Adresse: [bitte eintragen]</li>
              <li>Kontakt: [bitte eintragen]</li>
              <li>Vertretungsberechtigte Person / Unternehmensangaben: [falls relevant eintragen]</li>
            </ul>
          </article>
          <article class="card legal-card">
            <span class="card-label">Datenschutz</span>
            <h3>Lokale Nutzung transparent erklaert</h3>
            <p>MH Analytics speichert normale Nutzerpraeferenzen, Watchlist, Portfolio, Alerts, Learning-Fortschritt und Exportdaten lokal im Browser. Es gibt aktuell kein Login, keinen Cloud-Sync und keine Konten.</p>
            <ul class="clean-list">
              <li>Geheime Betreiber-Konfiguration wird nicht im Browser gespeichert.</li>
              <li>Setup-Export enthaelt lokale Nutzerdaten, keine Provider-Secrets.</li>
              <li>Vercel oder ein anderer Hoster kann technisch notwendige Serverlogs fuehren.</li>
              <li>Tracking/Cookies nur ergaenzen, falls sie spaeter wirklich genutzt werden.</li>
            </ul>
          </article>
          <article class="card legal-card">
            <span class="card-label">Disclaimer</span>
            <h3>Keine Anlageberatung</h3>
            <p>Daten, Scores, Reports, Top Picks, Alerts und Einordnungen dienen nur der Information. Sie sind keine persoenliche Empfehlung und keine Aufforderung zum Kaufen, Verkaufen oder Halten.</p>
            <ul class="clean-list">
              <li>Daten koennen verzoegert, unvollstaendig oder fehlerhaft sein.</li>
              <li>Fallback-, Hybrid- und lokale Produktlogik sind im Datenstatus sichtbar.</li>
              <li>Entscheidungen liegen immer beim Nutzer.</li>
              <li>Quellen- und Datenstatus vor Entscheidungen beachten.</li>
            </ul>
          </article>
        </div>
      </section>
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
            <h1>Datenquellen und Quellenstatus.</h1>
            <p>Normale Nutzer sehen hier ausschließlich lesbare Informationen: welche Quellen welche Module bedienen, ob sie serverseitig, als Open Data oder hybrid eingeordnet sind und ob gerade Live-, Fallback- oder Teilstatus aktiv ist.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-route="data-health">Datenstatus öffnen</button>
          </div>
        </div>
        <div class="provider-summary-grid">
          ${renderProviderSummary("Kernquellen", publicProviders.length, "Öffentliche Quellenübersicht ohne Eingabefelder")}
          ${renderProviderSummary("Serverseitig", serverSideCount, "FRED, Finnhub, Alpha Vantage und EIA laufen über eigene /api/... Routen")}
          ${renderProviderSummary("Open Data", openDataCount, "Offizielle Datenquellen ohne Nutzerkonfiguration")}
          ${renderProviderSummary("Hybrid / später", hybridCount, "Eingeordnet, aber nicht vollständig live in allen Modulen")}
        </div>
        ${renderProviderHealthPreview()}
        <article class="card provider-warning-card">
          <div>
            <h3>Reine Transparenzseite</h3>
            <p>Diese öffentliche Ansicht ist bewusst nicht editierbar. Sensible Betreiber-Einstellungen bleiben außerhalb der Nutzeroberfläche; Open-Data-Quellen werden zentral normalisiert. Das Frontend erhält nur Daten und Statushinweise.</p>
          </div>
          ${renderDataMeta(makeMeta("Serverseitige Datenebene", "fallback", BOOT_TIME), true)}
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
            <p>Diese Seite zeigt f\u00fcr normale Nutzer, woher Daten kommen, wie belastbar sie gerade sind und welche Module live, hybrid oder fallback-gest\u00fctzt arbeiten. Sie ist eine reine Transparenzansicht ohne Betreiber-Konfiguration.</p>
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
          <span><strong>Sicherheit:</strong> Sensible Betreiber-Konfiguration bleibt serverseitig; normale Nutzer sehen nur Transparenzinformationen.</span>
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
    const accessState = providerAccessState(provider);
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
          ${renderProviderAccessBadge(accessState)}
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
    const security = providerSecurityLabel(provider.security);
    const accessState = providerAccessState(provider);
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
          ${renderProviderAccessBadge(accessState)}
          ${renderProviderLiveBadge(health)}
        </div>
        <div class="provider-module-row">
          ${(PROVIDER_MODULE_USAGE[provider.id] || provider.categories).map((moduleName) => `<span class="module-chip">${esc(moduleName)}</span>`).join("")}
        </div>
        <div class="provider-security-note">
          <strong>${esc(security.label)}</strong>
          <span>${esc(security.text)}</span>
        </div>
      </article>
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

  function providerAccessState(provider) {
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

  function renderProviderAccessBadge(stateName) {
    const labels = {
      none: "Open Data",
      serverEnv: "Serverseitig",
      notPublic: "Nicht öffentlich konfigurierbar",
      present: "Konfiguriert",
      missing: "Unbekannt"
    };
    const status = ["present", "none", "serverEnv", "notPublic"].includes(stateName) ? "fallback" : "missing";
    return `<span class="status-badge status-${status}">${esc(labels[stateName] || "Konfiguration unklar")}</span>`;
  }

  function renderProviderLiveBadge(health) {
    const status = health.status || "notUsed";
    const labels = {
      live: "Live",
      stale: "Hybrid",
      fallback: "Fallback",
      prepared: "Unbekannt",
      mapped: "Unbekannt",
      notUsed: "Unbekannt",
      missing: "Offline",
      error: "Offline",
      disabled: "Offline"
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
      "browser-ok-private": "Privat nicht öffentlich",
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
        label: "Nicht öffentlich genutzt",
        text: "Private Betreiber-Konfiguration ist nicht Teil der öffentlichen Website."
      },
      "browser-ok-public": {
        label: "Open Data",
        text: "Dieser Slot ist für öffentliche Daten oder offene Anbindung vorbereitet."
      },
      "browser-critical": {
        label: "Browserkritisch",
        text: "Die Quelle ist offiziell und nützlich, sollte aber nicht als garantierter Live-Abruf im öffentlichen Frontend versprochen werden."
      },
      "backend-recommended": {
        label: "Backend empfohlen",
        text: "Für Produktion besser per Backend, Proxy oder Edge Function nutzen."
      },
      "backend-only": {
        label: "Backend-only",
        text: "Nicht direkt aus dem Browser aufrufen. Betreiber-Konfiguration bleibt serverseitig geschützt."
      },
      "server-normalized": {
        label: "Serverseitig normalisiert",
        text: "Das Frontend nutzt eine eigene /api/... Route mit einheitlicher Fehlerbehandlung."
      },
      "proxy-recommended": {
        label: "Proxy empfohlen",
        text: "Public/Demo kann lokal funktionieren; produktionsnah besser per Proxy/Backend."
      },
      "backend-ready": {
        label: "Backend-ready",
        text: "Für spätere Auth, Datenbank und Edge Functions vorbereitet."
      }
    };
    return labels[security] || { label: "Sicherheitsstatus", text: security };
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
      if (["home", "portfolio", "data-health", "macro", "liquidity"].includes(state.route)) {
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
        recordProviderHealth("fred", "fallback", "FRED läuft serverseitig und ist im lokalen Datei-Modus nicht verfügbar. Makro nutzt BLS/Treasury/Open-Data und Fallbacks.");
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
      const debt = await fetchWorldBankDebtRows();
      rows.push(...debt);
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
      if (y2 !== null) {
        rows.push({
          id: "DGS2",
          label: "US 2Y Yield",
          value: y2,
          display: `${formatNumber(y2)}%`,
          trend: "Serverseitig aus Treasury Daily Rates",
          meta: makeMeta(result.data?.meta?.source || "U.S. Treasury via Vercel Open-Data-Normalisierung", result.status, result.timestamp)
        });
      }
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
      const result = await cachedJson("fx:usd:core", fxProxyUrl({ base: "USD", quotes: "EUR,JPY,GBP,CNY" }), CACHE_TTL.openData, "frankfurter");
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
      if (Number.isFinite(Number(rates.CNY))) {
        rows.push({
          id: "USDCNY",
          label: "USD/CNY",
          value: Number(rates.CNY),
          display: formatNumber(Number(rates.CNY)),
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
          const name = normalizeMacroCountryName(row.country.value);
          if (!latestByCountry[name] || Number(row.date) > Number(latestByCountry[name].date)) {
            latestByCountry[name] = { ...row, country: { value: name } };
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

  async function fetchWorldBankDebtRows() {
    try {
      const result = await cachedJson("opendata:worldbank:debt", openDataProxyUrl({ source: "worldbank-debt" }), CACHE_TTL.openData, "worldBank");
      const rows = Array.isArray(result.data?.data) ? result.data.data : [];
      const latestByCountry = {};
      rows
        .filter((row) => row.value !== null && row.country?.value)
        .forEach((row) => {
          const name = normalizeMacroCountryName(row.country.value);
          if (!latestByCountry[name] || Number(row.date) > Number(latestByCountry[name].date)) {
            latestByCountry[name] = { ...row, country: { value: name } };
          }
        });
      return Object.values(latestByCountry).map((row) => ({
        country: row.country.value,
        indicator: "Staatsverschuldung",
        value: Number(row.value),
        display: `${formatNumber(Number(row.value))}%`,
        source: result.data?.meta?.source || "World Bank via Vercel Open-Data-Normalisierung",
        status: result.status,
        meta: makeMeta(result.data?.meta?.source || "World Bank via Vercel Open-Data-Normalisierung", result.status, result.timestamp)
      }));
    } catch (error) {
      logError(error);
      recordProviderHealth("worldBank", "fallback", "World Bank Debt-to-GDP nicht erreichbar, Fallback bleibt aktiv.");
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

  function macroCountryComparisonForView() {
    const macroRows = new Map(macroEnhancedForView().map((item) => [item.id, item]));
    const globalRows = state.globalMacro.length ? state.globalMacro : fallbackGlobalMacro("Globale Open-Data-Fallbacks aktiv.");
    const countries = MACRO_COUNTRY_BASELINES.map((baseline) => macroCountryForView(baseline, macroRows, globalRows));
    const control = macroControlForView(countries);
    const status = combinedDataStatus(countries.map((country) => country.meta.status));
    const sourceRows = macroSourceRowsForView(countries, macroRows, globalRows);
    return {
      countries,
      control,
      status,
      sourceRows,
      rates: macroRatesSummary(countries),
      growth: macroGrowthSummary(countries),
      liquidity: macroLiquiditySummary(countries, macroRows),
      assetImplications: macroAssetImplicationsForView(countries, control)
    };
  }

  function macroCountryForView(baseline, macroRows, globalRows) {
    const fallbackMeta = makeMeta(baseline.source, baseline.status, BOOT_TIME, "Strukturierter Länderfallback; Live/OpenData überschreibt einzelne Felder.");
    const gdpRow = globalMacroRowFor(globalRows, baseline.name, "BIP");
    const debtRow = globalMacroRowFor(globalRows, baseline.name, "Staats");
    const country = {
      ...baseline,
      gdp: macroField("BIP-Wachstum", gdpRow?.value ?? baseline.gdp, "%", gdpRow?.meta || fallbackMeta, gdpRow?.source || baseline.source),
      inflation: macroField("Inflation", baseline.inflation, "%", fallbackMeta, baseline.source),
      unemployment: macroField("Arbeitslosenquote", baseline.unemployment, "%", fallbackMeta, baseline.source),
      policyRate: macroField("Leitzins / Zinsniveau", baseline.policyRate, "%", fallbackMeta, baseline.source),
      yield2: macroField("2-jährige Rendite", baseline.yield2, "%", fallbackMeta, baseline.source),
      yield10: macroField("10-jährige Rendite", baseline.yield10, "%", fallbackMeta, baseline.source),
      debt: macroField("Staatsverschuldung / BIP", debtRow?.value ?? baseline.debt, "%", debtRow?.meta || fallbackMeta, debtRow?.source || baseline.source),
      liquidity: macroField("Geldmenge / Liquidität", baseline.liquidity, "%", fallbackMeta, baseline.source),
      fx: macroField(baseline.fxLabel, baseline.fxValue, "", fallbackMeta, baseline.source, baseline.fxDisplay)
    };

    if (baseline.id === "usa") {
      country.inflation = macroFieldFromRow(macroRows.get("CPIAUCSL"), country.inflation);
      country.unemployment = macroFieldFromRow(macroRows.get("UNRATE"), country.unemployment);
      country.policyRate = macroFieldFromRow(macroRows.get("FEDFUNDS"), country.policyRate);
      country.yield2 = macroFieldFromRow(macroRows.get("DGS2"), country.yield2);
      country.yield10 = macroFieldFromRow(macroRows.get("DGS10"), country.yield10);
      country.liquidity = macroFieldFromRow(macroRows.get("M2"), country.liquidity);
      country.fx = macroFieldFromRow(macroRows.get("DXY"), country.fx);
    }

    if (baseline.id === "eurozone" || baseline.id === "germany") {
      country.policyRate = macroFieldFromRow(macroRows.get("ECB"), country.policyRate);
      country.liquidity = macroFieldFromRow(macroRows.get("M3"), country.liquidity);
      country.fx = macroFieldFromRow(macroRows.get("EURUSD"), country.fx);
    }

    if (baseline.id === "china") {
      country.fx = macroFieldFromRow(macroRows.get("USDCNY"), country.fx);
    }

    country.realRate = computedMacroField("Realzins-Näherung", country.yield10.value - country.inflation.value, "%", [country.yield10.meta, country.inflation.meta], "10Y-Rendite minus Inflation; vereinfachte Näherung.");
    country.yieldCurve = computedMacroField("Yield Curve 2Y-10Y", country.yield10.value - country.yield2.value, "%", [country.yield10.meta, country.yield2.meta], "10Y minus 2Y; negative Werte zeigen Inversion/Anspannung.");
    addMacroFieldComments(country);
    country.risk = macroCountryRisk(country);
    country.meta = makeMeta(country.dataRole, combinedDataStatus([
      country.gdp.meta.status,
      country.inflation.meta.status,
      country.unemployment.meta.status,
      country.policyRate.meta.status,
      country.yield10.meta.status,
      country.debt.meta.status,
      country.fx.meta.status
    ]), latestMetaTimestamp([country.gdp.meta, country.inflation.meta, country.unemployment.meta, country.policyRate.meta, country.yield10.meta, country.debt.meta, country.fx.meta]), `${country.name}: ${country.risk.summary}`);
    return country;
  }

  function macroField(label, value, suffix, meta, source, display = "") {
    const number = Number(value);
    return {
      label,
      value: Number.isFinite(number) ? number : 0,
      display: display || `${formatNumber(number)}${suffix}`,
      meta: meta || makeMeta(source || "Lokaler Makro-Fallback", "fallback", BOOT_TIME),
      source: source || meta?.source || "Lokaler Makro-Fallback",
      comment: "Datenlage eingeschränkt"
    };
  }

  function macroFieldFromRow(row, fallback) {
    if (!row || !Number.isFinite(Number(row.value))) {
      return fallback;
    }
    return {
      ...fallback,
      value: Number(row.value),
      display: row.display || fallback.display,
      meta: row.meta || fallback.meta,
      source: row.meta?.source || row.source || fallback.source,
      trend: row.trend || fallback.trend
    };
  }

  function computedMacroField(label, value, suffix, metas, message) {
    const status = combinedDataStatus((metas || []).map((meta) => meta?.status));
    return {
      label,
      value: Number.isFinite(Number(value)) ? Number(value) : 0,
      display: `${formatNumber(value)}${suffix}`,
      meta: makeMeta(message, status === "live" ? "hybrid" : status, latestMetaTimestamp(metas), message),
      source: message,
      comment: ""
    };
  }

  function addMacroFieldComments(country) {
    country.inflation.comment = inflationMacroComment(country.inflation.value);
    country.unemployment.comment = laborMacroComment(country.unemployment.value);
    country.policyRate.comment = rateMacroComment(country.policyRate.value);
    country.yield10.comment = rateMacroComment(country.yield10.value);
    country.realRate.comment = realRateMacroComment(country.realRate.value);
    country.yieldCurve.comment = yieldCurveMacroComment(country.yieldCurve.value);
    country.gdp.comment = growthMacroComment(country.gdp.value);
    country.debt.comment = debtMacroComment(country.debt.value);
    country.fx.comment = fxMacroComment(country);
    country.liquidity.comment = liquidityMacroComment(country.liquidity.value);
  }

  function macroControlForView(countries) {
    const avgRisk = average(countries.map((country) => country.risk.score));
    const avgInflation = average(countries.map((country) => country.inflation.value));
    const avgPolicy = average(countries.map((country) => country.policyRate.value));
    const avgGrowth = average(countries.map((country) => country.gdp.value));
    const avgLiquidity = average(countries.map((country) => country.liquidity.value));
    const score = clamp(100 - avgRisk, 0, 100);
    const riskTone = avgRisk >= 58 ? "bear" : avgRisk >= 38 ? "neutral" : "bull";
    const label = avgInflation >= 3.5 ? "inflationskritisch / restriktiv"
      : avgPolicy >= 4 && avgGrowth < 1.5 ? "restriktiv und wachstumssensibel"
        : avgLiquidity > 2.5 && avgRisk < 45 ? "risikofreundlicher"
          : avgGrowth < 1 ? "wachstumsschwach"
            : "neutral bis restriktiv";
    const drivers = macroRiskDrivers(countries).slice(0, 4);
    return {
      score,
      tone: riskTone,
      label,
      summary: `Makrobild heuristisch: durchschnittliches Risiko ${formatNumber(avgRisk)}/100. Die Einordnung kombiniert Inflation, Zinsen, Realzins, Wachstum, Arbeitsmarkt, Liquidität, FX und Verschuldung.`,
      drivers,
      tiles: [
        { label: "Inflation", value: inflationMacroComment(avgInflation), text: `Schnitt ${formatNumber(avgInflation)}%` },
        { label: "Zinsen", value: avgPolicy >= 4 ? "restriktiv" : avgPolicy >= 2 ? "neutral/restriktiv" : "locker", text: `Leitzins-Schnitt ${formatNumber(avgPolicy)}%` },
        { label: "Wachstum", value: growthMacroComment(avgGrowth), text: `BIP-Schnitt ${formatNumber(avgGrowth)}%` },
        { label: "Arbeitsmarkt", value: laborMacroComment(average(countries.map((country) => country.unemployment.value))), text: "Arbeitslosigkeit als Stabilitätsproxy" },
        { label: "Liquidität", value: liquidityMacroComment(avgLiquidity), text: `Geldmengen-/Liquiditätsproxy ${formatNumber(avgLiquidity)}%` },
        { label: "Risikoampel", value: macroRiskLabel(avgRisk).label, text: drivers.map((item) => item.label).join(", ") || "keine dominanten Treiber" }
      ]
    };
  }

  function macroRiskDrivers(countries) {
    const drivers = [];
    const usa = countries.find((country) => country.id === "usa");
    const weakestGrowth = countries.slice().sort((a, b) => a.gdp.value - b.gdp.value)[0];
    const highestInflation = countries.slice().sort((a, b) => b.inflation.value - a.inflation.value)[0];
    const highestDebt = countries.slice().sort((a, b) => b.debt.value - a.debt.value)[0];
    if (highestInflation) {
      drivers.push({ label: "Inflation", tone: highestInflation.inflation.value >= 3 ? "bear" : "neutral", text: `${highestInflation.name} mit ${highestInflation.inflation.display}: ${highestInflation.inflation.comment}.` });
    }
    if (usa && usa.yieldCurve.value < 0) {
      drivers.push({ label: "Yield Curve", tone: "bear", text: `US-Kurve liegt bei ${usa.yieldCurve.display}; das ist ein Wachstums-/Stresssignal, keine Prognose.` });
    }
    if (weakestGrowth) {
      drivers.push({ label: "Wachstum", tone: weakestGrowth.gdp.value < 1 ? "bear" : "neutral", text: `${weakestGrowth.name} wirkt beim Wachstum am schwächsten: ${weakestGrowth.gdp.display}.` });
    }
    if (highestDebt) {
      drivers.push({ label: "Fiskal", tone: highestDebt.debt.value >= 100 ? "bear" : "neutral", text: `${highestDebt.name} hat den höchsten Schuldenwert im Vergleich: ${highestDebt.debt.display}.` });
    }
    return drivers;
  }

  function macroRatesSummary(countries) {
    const usa = countries.find((country) => country.id === "usa") || countries[0];
    const avgReal = average(countries.map((country) => country.realRate.value));
    const label = usa.yieldCurve.value < -0.25 ? "US-Kurve invers / angespannt" : avgReal > 1 ? "Realzinsen positiv" : "Zinslage gemischt";
    return {
      label,
      value: usa ? `US 2Y-10Y ${usa.yieldCurve.display}` : "--",
      tone: usa && usa.yieldCurve.value < 0 ? "bear" : avgReal > 1 ? "neutral" : "bull",
      text: "Zinsniveau, Yield Curve und Realzins bestimmen Bewertungsdruck, Duration-Risiko und Gold-/Krypto-Kontext."
    };
  }

  function macroGrowthSummary(countries) {
    const avgGrowth = average(countries.map((country) => country.gdp.value));
    const avgDebt = average(countries.map((country) => country.debt.value));
    return {
      label: avgGrowth >= 3 ? "Wachstum solide" : avgGrowth >= 1 ? "Wachstum gemischt" : "Wachstum schwach",
      value: `BIP ${formatNumber(avgGrowth)}%`,
      tone: avgGrowth >= 3 ? "bull" : avgGrowth >= 1 ? "neutral" : "bear",
      text: `Wachstum wird mit Debt-to-GDP kombiniert. Durchschnittliche Verschuldung im Vergleich: ${formatNumber(avgDebt)}%.`
    };
  }

  function macroLiquiditySummary(countries, macroRows) {
    const liquidity = liquidityNarrativeForView();
    const dxy = macroRows.get("DXY");
    const eurusd = macroRows.get("EURUSD");
    return {
      label: liquidity.label,
      value: `${formatNumber(liquidity.score)} / 100`,
      tone: liquidity.tone,
      text: `${liquidity.summary} FX-Kontext: ${dxy?.display ? `DXY ${dxy.display}` : ""}${eurusd?.display ? `, EUR/USD ${eurusd.display}` : ""}`.replace(/^, /, "")
    };
  }

  function macroAssetImplicationsForView(countries, control) {
    const usa = countries.find((country) => country.id === "usa") || countries[0];
    const avgLiquidity = average(countries.map((country) => country.liquidity.value));
    const avgGrowth = average(countries.map((country) => country.gdp.value));
    const dollarStrong = usa.fx.value >= 104 || usa.fx.display.includes("DXY");
    return [
      {
        asset: "Aktien",
        signal: control.score >= 60 ? "Selektiv konstruktiv" : "Bewertungsdruck beachten",
        tone: control.score >= 60 ? "bull" : "neutral",
        text: "Hohe Zinsen und positive Realzinsen können Multiples bremsen; besseres Wachstum und Liquidität können Risikoassets stützen."
      },
      {
        asset: "Gold",
        signal: usa.realRate.value > 1 ? "Realzins-Gegenwind" : "Stress-/Inflationsschutz im Fokus",
        tone: usa.realRate.value > 1 ? "neutral" : "bull",
        text: "Hohe Realzinsen können Gold belasten; Inflations- oder Stressphasen können die Schutzfunktion wieder wichtiger machen."
      },
      {
        asset: "Anleihen",
        signal: usa.yieldCurve.value < 0 ? "Kurvenstress sichtbar" : "Zinsniveau beobachten",
        tone: usa.yieldCurve.value < 0 ? "neutral" : "bull",
        text: "Fallende Renditen können Duration stützen; inverse Kurven zeigen aber oft Wachstumsrisiko oder späten Zyklus."
      },
      {
        asset: "Krypto",
        signal: avgLiquidity > 2 ? "Liquidität hilft eher" : "Liquidität bleibt wichtiges Risiko",
        tone: avgLiquidity > 2 ? "bull" : "neutral",
        text: "Krypto reagiert häufig stark auf globale Liquidität und Risk-on. Hohe Realzinsen und Risk-off können belasten."
      },
      {
        asset: "Rohstoffe",
        signal: dollarStrong ? "Dollar-Gegenwind möglich" : "FX-Gegenwind moderater",
        tone: "neutral",
        text: "Ein starker Dollar kann Rohstoffe belasten; Wachstum und Energie-Nachfrage bleiben der zweite große Treiber."
      },
      {
        asset: "Währungen",
        signal: "Zinsdifferenzen dominieren",
        tone: "neutral",
        text: "EUR/USD, USD/JPY und USD/CNY helfen, internationale Aktien, ETFs, Gold und Rohstoffe im Währungskontext zu lesen."
      }
    ];
  }

  function macroSourceRowsForView(countries, macroRows, globalRows) {
    const globalStatus = combinedDataStatus(globalRows.map((row) => row.meta?.status || row.status));
    return [
      { label: "US-Makro", meta: macroRows.get("FEDFUNDS")?.meta || macroRows.get("CPIAUCSL")?.meta || makeMeta("FRED/BLS Fallback", "fallback", BOOT_TIME) },
      { label: "Treasury / Yield Curve", meta: macroRows.get("YCURVE")?.meta || macroRows.get("DGS10")?.meta || makeMeta("Treasury/FRED Fallback", "fallback", BOOT_TIME) },
      { label: "Globale Länder", meta: makeMeta("World Bank / IMF / lokale Länderbasis", globalStatus, latestMetaTimestamp(globalRows.map((row) => row.meta)), "Wachstum und Verschuldung nutzen OpenData, wo vorhanden.") },
      { label: "FX / Liquidität", meta: macroRows.get("EURUSD")?.meta || macroRows.get("DXY")?.meta || makeMeta("Frankfurter/FRED/ECB Fallback", "fallback", BOOT_TIME) }
    ];
  }

  function globalMacroRowFor(rows, country, indicator) {
    const normalizedCountry = normalizeMacroCountryName(country);
    const normalizedIndicator = String(indicator || "").toLowerCase();
    return rows
      .filter((row) => normalizeMacroCountryName(row.country) === normalizedCountry)
      .filter((row) => String(row.indicator || "").toLowerCase().includes(normalizedIndicator.toLowerCase()))
      .sort((a, b) => statusRank(b.meta?.status || b.status) - statusRank(a.meta?.status || a.status))[0] || null;
  }

  function normalizeMacroCountryName(value) {
    const name = String(value || "").toLowerCase();
    if (name.includes("united states") || name === "usa" || name === "us") return "USA";
    if (name.includes("euro") || name === "emu") return "Eurozone";
    if (name.includes("germany") || name.includes("deutschland") || name === "de") return "Deutschland";
    if (name.includes("china") || name === "cn") return "China";
    return String(value || "");
  }

  function macroCountryRisk(country) {
    let score = 18;
    if (country.inflation.value > 4) score += 18;
    else if (country.inflation.value > 3) score += 10;
    else if (country.inflation.value < 0.5) score += 7;
    if (country.policyRate.value > 4) score += 10;
    if (country.realRate.value > 1.5) score += 10;
    if (country.yieldCurve.value < -0.25) score += 12;
    if (country.gdp.value < 0) score += 16;
    else if (country.gdp.value < 1) score += 9;
    if (country.unemployment.value > 7) score += 10;
    else if (country.unemployment.value > 5.5) score += 5;
    if (country.debt.value > 110) score += 12;
    else if (country.debt.value > 80) score += 7;
    if (country.liquidity.value < 0) score += 8;
    else if (country.liquidity.value < 1) score += 4;
    const label = macroRiskLabel(score);
    return {
      score: clamp(score, 0, 100),
      ...label,
      summary: `${country.name}: ${label.label}, getrieben durch ${country.inflation.comment.toLowerCase()}, ${country.gdp.comment.toLowerCase()} und ${country.debt.comment.toLowerCase()}.`
    };
  }

  function macroRiskLabel(score) {
    if (score >= 70) return { label: "hoch", tone: "bear" };
    if (score >= 50) return { label: "erhöht", tone: "bear" };
    if (score >= 32) return { label: "moderat", tone: "neutral" };
    return { label: "niedrig", tone: "bull" };
  }

  function inflationMacroComment(value) {
    if (value >= 4) return "Inflationsdruck hoch";
    if (value >= 2.2) return "Inflation moderat bis erhöht";
    if (value < 0.5) return "Deflations-/Schwäche-Risiko";
    return "Inflation moderat";
  }

  function laborMacroComment(value) {
    if (value >= 7) return "Arbeitsmarkt schwächer";
    if (value >= 5.5) return "Arbeitsmarkt leicht angespannt";
    if (value <= 3.5) return "Arbeitsmarkt robust";
    return "Arbeitsmarkt solide";
  }

  function rateMacroComment(value) {
    if (value >= 4) return "restriktiv";
    if (value >= 2) return "neutral bis restriktiv";
    return "locker";
  }

  function realRateMacroComment(value) {
    if (value >= 1.5) return "positive Realzinsen bremsen";
    if (value >= 0) return "Realzins leicht positiv";
    return "Realzins eher locker";
  }

  function yieldCurveMacroComment(value) {
    if (value < -0.25) return "invers / angespannt";
    if (value < 0) return "leicht invers";
    if (value > 0.75) return "normal / steil";
    return "flach";
  }

  function growthMacroComment(value) {
    if (value >= 4) return "Wachstum stark";
    if (value >= 2) return "Wachstum solide";
    if (value >= 0.5) return "Wachstum schwach";
    return "Rezessionsnähe / Stagnation";
  }

  function debtMacroComment(value) {
    if (value >= 110) return "Fiskalrisiko hoch";
    if (value >= 80) return "Fiskalrisiko erhöht";
    if (value >= 60) return "Fiskalrisiko moderat";
    return "Fiskalrisiko niedriger";
  }

  function fxMacroComment(country) {
    if (country.id === "usa") return "Dollar-Stärke beeinflusst Rohstoffe und EM";
    if (country.id === "china") return "CNY-Bezug wichtig für EM und Rohstoffe";
    return "EUR/USD beeinflusst Exportwerte und globale ETFs";
  }

  function liquidityMacroComment(value) {
    if (value >= 3) return "liquiditätsfreundlich";
    if (value >= 0.5) return "neutral";
    return "liquiditätsbelastend";
  }

  function latestMetaTimestamp(metas = []) {
    return Math.max(...metas.map((meta) => Number(meta?.timestamp || 0)), BOOT_TIME);
  }

  function average(values = []) {
    const numbers = values.map(Number).filter(Number.isFinite);
    return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
  }

  function macroWhy(id) {
    const text = {
      FEDFUNDS: "Leitzinsen setzen den Takt für Finanzierungskosten, Bewertungsmultiples und Risk-on/Risk-off.",
      CPIAUCSL: "Inflation bestimmt, wie viel Spielraum Zentralbanken für Zinssenkungen haben.",
      UNRATE: "Der Arbeitsmarkt zeigt, ob Wachstum robust bleibt oder eine Abkühlung droht.",
      DGS2: "Die 2Y-Rendite reagiert stark auf Zentralbank- und Zinspfad-Erwartungen.",
      DGS10: "Die 10Y-Rendite ist ein zentraler Diskontierungsanker für Aktien und Gold.",
      YCURVE: "Die 2Y-10Y-Kurve hilft, späten Zyklus, Rezessionsrisiko und Zinsstress einzuordnen.",
      M2: "M2 zeigt die breitere US-Liquidität und ergänzt Risikoappetit und Kreditbedingungen.",
      EURUSD: "EUR/USD beeinflusst europäische Assets, Dollar-Gewinne, Rohstoffe und globale ETFs.",
      USDJPY: "USD/JPY zeigt Zinsdifferenz- und Carry-Kontext zwischen USA und Japan.",
      USDCNY: "USD/CNY hilft beim China-, Schwellenländer- und Rohstoff-Kontext.",
      DXY: "Der Dollar beeinflusst Rohstoffe, Emerging Markets, US-Gewinne und globale Liquidität."
    };
    return text[id] || "Makroindikator für Liquidität, Wachstum, Inflation oder Risikoappetit.";
  }

  function macroMeaning(id) {
    const text = {
      FEDFUNDS: "Steigend wirkt restriktiv; fallend kann Risikoassets entlasten.",
      CPIAUCSL: "Steigende Inflation belastet Zinssenkungsfantasie; fallende Inflation hilft Multiples.",
      UNRATE: "Starker Anstieg kann Rezessionsrisiko signalisieren; zu niedrige Werte können Lohndruck bedeuten.",
      DGS2: "Steigende 2Y-Renditen zeigen restriktivere Zinserwartungen.",
      DGS10: "Steigende Renditen belasten lange Duration; fallende Renditen helfen Growth und Gold.",
      YCURVE: "Inversion ist ein Stresssignal; Re-Steepening kann Wendepunkt oder Abschwächung anzeigen.",
      M2: "Mehr Liquidität kann Risikoassets stützen; schwächeres M2 wirkt eher bremsend.",
      EURUSD: "Euro-Stärke/-Schwäche wirkt auf europäische Margen, internationale ETFs und Dollarpreise.",
      USDJPY: "Hohe Werte können Carry- und Dollarstress anzeigen.",
      USDCNY: "CNY-Schwäche kann EM- und Rohstoffstress andeuten.",
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

  function screenerRowsForView() {
    return ASSETS.map((asset) => snapshotFor(asset.symbol));
  }

  function screenerScoreV2(context) {
    const { symbol, asset, quote, profile, fundamentals, analysis, rating, dataStatus } = context;
    const etf = etfDataForSymbol(symbol);
    const nextEvents = eventsForSymbol(symbol).filter((eventItem) => eventItem.date >= startOfToday()).sort(sortEventsForHub);
    const eventContext = screenerEventContext(nextEvents);
    const macroContext = screenerMacroContextFor(asset, analysis);
    const dataQuality = screenerDataQualityScore(dataStatus);
    const momentum = screenerMomentumScore(quote, analysis, rating);
    const value = screenerValueScore(asset, fundamentals, analysis, etf);
    const growth = screenerGrowthScore(asset, fundamentals, analysis, eventContext);
    const quality = screenerQualityScore(asset, fundamentals, analysis, etf, dataQuality);
    const risk = screenerRiskScore(asset, analysis, value.score, eventContext, dataQuality, etf);
    const event = {
      score: eventContext.score,
      label: "Event",
      shortLabel: "Event",
      labelText: eventContext.label,
      text: eventContext.text,
      tone: eventContext.tone
    };
    const macro = {
      score: macroContext.score,
      label: "Makro",
      shortLabel: "Makro",
      labelText: macroContext.label,
      text: macroContext.text,
      tone: macroContext.tone
    };
    const components = { momentum, value, growth, quality, risk, event, macro, dataQuality };
    const weights = screenerWeightsForMode(dashboardPrefs().mode, asset.type);
    const total = Math.round(clamp(
      momentum.score * weights.momentum +
      value.score * weights.value +
      growth.score * weights.growth +
      quality.score * weights.quality +
      (100 - risk.score) * weights.risk +
      event.score * weights.event +
      macro.score * weights.macro +
      dataQuality.score * weights.dataQuality,
      0,
      100
    ));
    const category = screenerPickCategory(total, components);
    const drivers = screenerDrivers(components, category);
    const cautions = screenerCautions(components, context);
    return {
      total,
      components,
      weights,
      category,
      drivers,
      cautions,
      eventContext,
      macroContext,
      explanation: screenerExplanation(asset.symbol, category, drivers, cautions, dataStatus)
    };
  }

  function screenerMomentumScore(quote, analysis, rating) {
    const overheatPenalty = Number(analysis.rsi || 0) >= 72 ? 12 : Number(analysis.volatility || 0) >= 78 ? 8 : 0;
    const raw = clamp(analysis.momentum * 0.42 + analysis.trend * 0.25 + analysis.performance1m * 1.2 + Number(quote.changePct || 0) * 2.4 + rating.score * 0.18 - overheatPenalty, 0, 100);
    const labelText = raw >= 72 ? "Momentum stark" : raw <= 42 ? "Momentum schwach" : "Momentum neutral";
    return { score: Math.round(raw), label: "Momentum Score", shortLabel: "Mom", labelText, text: `${formatPercent(analysis.performance1m)} 1M, Trend ${formatNumber(analysis.trend)}, RSI ${formatNumber(analysis.rsi)}.`, tone: raw >= 72 ? "bull" : raw <= 42 ? "bear" : "neutral" };
  }

  function screenerValueScore(asset, fundamentals, analysis, etf) {
    if (etf) {
      const raw = clamp(82 - Number(etf.ter || 0) * 140 - Math.max(0, etfHoldingConcentration(etf) - 20) * 0.45, 25, 88);
      return { score: Math.round(raw), label: "Value Score", shortLabel: "Value", labelText: raw >= 65 ? "Kosten attraktiv" : "Kosten/Struktur prüfen", text: `ETF TER ${formatNumber(etf.ter)}%, Top-Holdings ${formatNumber(etfHoldingConcentration(etf))}%.`, tone: raw >= 65 ? "bull" : "neutral" };
    }
    const pe = valueOr(fundamentals.pe, asset.fallback.pe);
    if (!Number.isFinite(Number(pe)) || Number(pe) <= 0) {
      return { score: Math.round(clamp(analysis.value * 0.65, 20, 55)), label: "Value Score", shortLabel: "Value", labelText: "Daten eingeschränkt", text: "KGV/Fundamentals fehlen oder sind nur fallback-basiert.", tone: "neutral" };
    }
    const raw = clamp(analysis.value * 0.62 + (pe < 20 ? 18 : pe < 35 ? 8 : pe > 55 ? -12 : 0), 15, 92);
    const labelText = raw >= 70 ? "günstiger" : raw >= 50 ? "fair/gemischt" : "ambitioniert";
    return { score: Math.round(raw), label: "Value Score", shortLabel: "Value", labelText, text: `KGV ${formatNumber(pe, "x")}; Value-Modell ${formatNumber(analysis.value)}.`, tone: raw >= 70 ? "bull" : raw < 45 ? "bear" : "neutral" };
  }

  function screenerGrowthScore(asset, fundamentals, analysis, eventContext) {
    const revenueGrowth = Number(fundamentals.revenueGrowth ?? analysis.revenueGrowth);
    const growthInput = Number.isFinite(revenueGrowth) ? clamp(50 + revenueGrowth * 1.25, 10, 90) : analysis.growth;
    const eventBoost = eventContext.type === "earnings" ? 4 : 0;
    const raw = clamp(growthInput * 0.72 + analysis.growth * 0.28 + eventBoost, 0, 100);
    const labelText = raw >= 72 ? "Growth stark" : raw >= 55 ? "Growth solide" : "Growth schwächer";
    return { score: Math.round(raw), label: "Growth Score", shortLabel: "Growth", labelText, text: Number.isFinite(revenueGrowth) ? `Wachstumsproxy ${formatNumber(revenueGrowth)}%, Modell ${formatNumber(analysis.growth)}.` : `Growth-Modell ${formatNumber(analysis.growth)}; keine harte Wachstumsrate erzwungen.`, tone: raw >= 72 ? "bull" : raw < 45 ? "bear" : "neutral" };
  }

  function screenerQualityScore(asset, fundamentals, analysis, etf, dataQuality) {
    if (etf) {
      const concentration = etfHoldingConcentration(etf);
      const raw = clamp(74 - Math.max(0, concentration - 18) * 0.65 - Number(etf.ter || 0) * 60 + dataQuality.score * 0.18, 20, 92);
      return { score: Math.round(raw), label: "Quality Score", shortLabel: "Qual", labelText: raw >= 68 ? "ETF-Struktur solide" : "ETF-Struktur prüfen", text: `TER ${formatNumber(etf.ter)}%, Konzentration ${formatNumber(concentration)}%, ${etf.structureType || "Struktur offen"}.`, tone: raw >= 68 ? "bull" : raw < 45 ? "bear" : "neutral" };
    }
    const margin = Number(fundamentals.margin ?? analysis.margin);
    const cashflow = Number(fundamentals.cashflow ?? analysis.cashflow);
    const raw = clamp(analysis.quality * 0.62 + dataQuality.score * 0.2 + (Number.isFinite(margin) && margin > 20 ? 7 : 0) + (Number.isFinite(cashflow) && cashflow > 0 ? 5 : 0), 15, 94);
    const labelText = raw >= 72 ? "Qualität hoch" : raw >= 52 ? "Qualität solide" : "Qualität gemischt";
    return { score: Math.round(raw), label: "Quality Score", shortLabel: "Qual", labelText, text: `Quality-Modell ${formatNumber(analysis.quality)}; Datenqualität ${dataQuality.labelText}.`, tone: raw >= 72 ? "bull" : raw < 45 ? "bear" : "neutral" };
  }

  function screenerRiskScore(asset, analysis, valueScore, eventContext, dataQuality, etf) {
    const valuationRisk = valueScore < 40 ? 14 : valueScore < 55 ? 6 : 0;
    const eventRisk = eventContext.score >= 75 ? 8 : eventContext.score >= 60 ? 4 : 0;
    const dataRisk = dataQuality.score < 50 ? 12 : dataQuality.score < 65 ? 5 : 0;
    const etfRisk = etf ? Math.max(0, etfHoldingConcentration(etf) - 20) * 0.65 : 0;
    const typeRisk = asset.type === "Crypto" ? 16 : asset.type === "Commodity" ? 6 : 0;
    const raw = clamp(analysis.volatility * 0.54 + Math.max(0, 55 - analysis.momentum) * 0.24 + valuationRisk + eventRisk + dataRisk + etfRisk + typeRisk, 0, 100);
    const labelText = raw >= 70 ? "Risiko hoch" : raw >= 52 ? "Risiko erhöht" : raw >= 34 ? "Risiko moderat" : "Risiko niedrig";
    return { score: Math.round(raw), label: "Risk Score", shortLabel: "Risk", labelText, text: `Volatilität ${formatNumber(analysis.volatility)}, Bewertungs-/Event-/Datenrisiko kombiniert.`, tone: raw >= 70 ? "bear" : raw >= 52 ? "neutral" : "bull" };
  }

  function screenerDataQualityScore(status) {
    const normalized = normalizeScreenerStatus(status);
    const score = normalized === "live" ? 86 : normalized === "hybrid" ? 70 : normalized === "local" ? 55 : normalized === "fallback" ? 44 : 30;
    const labelText = normalized === "live" ? "Live" : normalized === "hybrid" ? "Hybrid" : normalized === "local" ? "Lokal" : normalized === "fallback" ? "Fallback" : "eingeschränkt";
    return { score, label: "Data Quality Score", shortLabel: "Daten", labelText, text: `Datenstatus ${labelText}; Scores bleiben entsprechend vorsichtig.`, tone: score >= 75 ? "bull" : score < 50 ? "bear" : "neutral" };
  }

  function screenerEventContext(events) {
    const next = events[0] || null;
    if (!next) {
      return { score: 48, type: "none", label: "kein nahes Event", text: "Kein naher Termin im Event-Hub-Fenster.", tone: "neutral", next: null };
    }
    const type = eventTypeKey(next);
    const timing = matchesEventWindow(next, "today") ? "today" : next.date <= daysFromNow(7) ? "week" : "later";
    const relevance = eventRelevance(next);
    const score = clamp(48 + relevance * 0.42 + (timing === "today" ? 18 : timing === "week" ? 10 : 0), 0, 100);
    return { score: Math.round(score), type, timing, label: eventTypeLabel(next), text: `${eventTimingLabel(next)}: ${next.title}. Event kann Chance und Risiko sein.`, tone: score >= 75 ? "bull" : "neutral", next };
  }

  function screenerMacroContextFor(asset, analysis) {
    const control = macroCountryComparisonForView().control;
    let score = control.score;
    let label = "neutral";
    let text = control.label;
    if (control.score < 45 && (analysis.volatility >= 62 || ["Crypto", "Commodity"].includes(asset.type))) {
      score -= 12;
      label = "belastend";
      text = "Risk-off-Makro belastet volatile oder liquiditätssensitive Werte stärker.";
    } else if (control.score >= 60 && ["ETF", "Index"].includes(asset.type)) {
      score += 7;
      label = "unterstützend";
      text = "Makrobild wirkt für breite Marktbausteine etwas unterstützender.";
    } else if (asset.sector === "Precious Metals" && control.label.includes("restriktiv")) {
      score -= 5;
      label = "belastend";
      text = "Restriktive Realzinslage kann Gold zeitweise belasten.";
    }
    score = clamp(score, 0, 100);
    return { score: Math.round(score), label, text, tone: score >= 60 ? "bull" : score < 45 ? "bear" : "neutral" };
  }

  function screenerWeightsForMode(mode, assetType) {
    const base = { momentum: 0.21, value: 0.13, growth: 0.14, quality: 0.15, risk: 0.14, event: 0.08, macro: 0.08, dataQuality: 0.07 };
    if (mode === "trader") {
      return { ...base, momentum: 0.28, event: 0.12, value: 0.08, quality: 0.11 };
    }
    if (mode === "etf" || assetType === "ETF") {
      return { ...base, quality: 0.23, risk: 0.18, value: 0.16, growth: 0.08, event: 0.04 };
    }
    if (mode === "macro") {
      return { ...base, macro: 0.17, momentum: 0.17, event: 0.06 };
    }
    if (mode === "portfolio") {
      return { ...base, quality: 0.19, risk: 0.2, event: 0.06 };
    }
    return base;
  }

  function screenerPickCategory(score, components) {
    if (components.risk.score >= 72 || components.momentum.score <= 38) {
      return { key: "risk", label: "Risk-Kandidat", tone: "bear" };
    }
    if (score >= 72 && components.risk.score < 62 && components.dataQuality.score >= 50) {
      return { key: "long", label: "Long-Kandidat", tone: "bull" };
    }
    if (score >= 58 || components.event.score >= 68 || components.quality.score >= 68) {
      return { key: "watch", label: "Watch-Kandidat", tone: "neutral" };
    }
    return { key: "neutral", label: "Neutral", tone: "neutral" };
  }

  function screenerDrivers(components, category) {
    return Object.values(components)
      .filter((component) => component.shortLabel !== "Daten")
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((component) => ({ label: `${component.shortLabel} ${component.score}`, text: component.text, tone: component.tone }))
      .concat(category.key === "long" ? [{ label: "Setup prüfen", text: "Kandidat wirkt stark, aber ist keine Kaufempfehlung.", tone: "bull" }] : []);
  }

  function screenerCautions(components, context) {
    const cautions = [];
    if (components.risk.score >= 58) cautions.push({ label: `Risk ${components.risk.score}`, text: components.risk.text, tone: "bear" });
    if (components.value.score < 45) cautions.push({ label: "Bewertung", text: components.value.text, tone: "neutral" });
    if (components.dataQuality.score < 55) cautions.push({ label: "Datenlage", text: components.dataQuality.text, tone: "bear" });
    if (context.analysis.rsi >= 72) cautions.push({ label: "Überhitzung", text: "RSI/Trend wirken im Modell heiß; Momentum nicht blind als Qualität lesen.", tone: "neutral" });
    return cautions.slice(0, 3);
  }

  function screenerExplanation(symbol, category, drivers, cautions, status) {
    const driverText = drivers.slice(0, 2).map((item) => item.label).join(", ") || "gemischte Treiber";
    const cautionText = cautions[0] ? ` Gegenpunkt: ${cautions[0].label}.` : "";
    return `${symbol} ist ${category.label}, weil ${driverText} aktuell auffallen.${cautionText} Datenstatus: ${statusLabel(status)}.`;
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
    const scoreV2 = screenerScoreV2({ symbol: asset.symbol, asset, quote, profile, fundamentals, analysis, rating, dataStatus });
    const score = scoreV2.total;
    const region = screenerRegionFor(asset.symbol, asset);
    const marketCapBucket = marketCapBucketFor(marketCap, asset.type);
    const normalizedStatus = normalizeScreenerStatus(dataStatus);
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
      region,
      marketCapBucket,
      normalizedStatus,
      dataStatus,
      score,
      scores: scoreV2.components,
      scoreWeights: scoreV2.weights,
      valueScore: scoreV2.components.value.score,
      growthScore: scoreV2.components.growth.score,
      momentumScore: scoreV2.components.momentum.score,
      qualityScore: scoreV2.components.quality.score,
      riskScore: scoreV2.components.risk.score,
      eventScore: scoreV2.components.event.score,
      macroScore: scoreV2.components.macro.score,
      dataQualityScore: scoreV2.components.dataQuality.score,
      eventContext: scoreV2.eventContext,
      macroContext: scoreV2.macroContext,
      pickCategory: scoreV2.category.key,
      pickLabel: scoreV2.category.label,
      pickTone: scoreV2.category.tone,
      drivers: scoreV2.drivers,
      cautions: scoreV2.cautions,
      explanation: scoreV2.explanation,
      isWatchlist: state.watchlist.includes(asset.symbol),
      isFavorite: isFavoriteSymbol(asset.symbol),
      performance1m: analysis.performance1m,
      pickReason: scoreV2.explanation
    };
  }

  function filteredScreenerRows(rows = screenerRowsForView()) {
    const filters = { ...SCREENER_DEFAULT_FILTERS, ...state.screener };
    let next = rows.slice();
    const query = String(filters.search || "").trim().toLowerCase();
    if (query) {
      next = next.filter((row) => `${row.symbol} ${row.name} ${row.sector} ${row.type} ${row.region} ${row.explanation}`.toLowerCase().includes(query));
    }
    next = next.filter((row) => filters.assetType === "all" || row.type === filters.assetType);
    next = next.filter((row) => filters.region === "all" || row.region === filters.region);
    next = next.filter((row) => filters.sector === "all" || row.sector === filters.sector);
    next = next.filter((row) => passesStyleFilter(row, filters.style));
    next = next.filter((row) => passesMarketCapFilter(row, filters.marketCap));
    next = next.filter((row) => filters.dataStatus === "all" || row.normalizedStatus === filters.dataStatus);
    next = next.filter((row) => passesPersonalFilter(row, filters.personal));
    next = next.filter((row) => passesEventContextFilter(row, filters.eventContext));
    next = next.filter((row) => passesRatingFilter(row, filters.rating));
    next = next.filter((row) => passesNumberFilter(row.momentumScore, filters.momentum));
    next = next.filter((row) => passesNumberFilter(row.valueScore, filters.value));
    next = next.filter((row) => passesNumberFilter(row.growthScore, filters.growth));
    next = next.filter((row) => passesPerformanceFilter(row, filters.performance));
    return sortScreenerRows(next, filters.sort);
  }

  function topPicksForView() {
    const sourceRows = Array.isArray(arguments[0]) ? arguments[0] : screenerRowsForView();
    const byScore = sourceRows.slice().sort((a, b) => b.score - a.score);
    const long = byScore
      .filter((row) => row.pickCategory === "long")
      .slice(0, 5);
    const watch = byScore
      .filter((row) => row.pickCategory === "watch" || (row.pickCategory === "neutral" && row.score >= 54))
      .slice(0, 5);
    const risk = sourceRows.slice()
      .filter((row) => row.pickCategory === "risk" || row.riskScore >= 64)
      .sort((a, b) => b.riskScore - a.riskScore || a.score - b.score)
      .slice(0, 5);
    const personal = sourceRows.slice()
      .filter((row) => row.isWatchlist || row.isFavorite)
      .sort((a, b) => b.score - a.score || b.eventScore - a.eventScore)
      .slice(0, 5);
    return { long, watch, risk, personal };

    const rows = ASSETS.map((asset) => snapshotFor(asset.symbol));
    const legacyLong = rows
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
    const legacyRisk = rows
      .sort((a, b) => riskRank(b) - riskRank(a))
      .slice(0, 5)
      .map((row) => ({
        symbol: row.symbol,
        direction: row.rating.rating === "SELL" ? "Bearish" : "Risk",
        score: riskRank(row),
        setup: row.rating.rating === "SELL" ? "Trend/Risiko schwach" : "Volatilität hoch",
        reason: row.rating.rating === "SELL" ? row.rating.reason : "Setup hat Chance, aber Risiko/Volatilität ist überdurchschnittlich."
      }));
    return { long: legacyLong, risk: legacyRisk };
  }

  function screenerSummary(rows = [], filtered = rows) {
    const picks = topPicksForView(rows);
    const sortedBy = (key) => rows.slice().sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0))[0] || null;
    const status = combinedDataStatus(rows.map((row) => row.dataStatus));
    const fallbackCount = rows.filter((row) => ["fallback", "local"].includes(row.normalizedStatus)).length;
    const comment = fallbackCount > rows.length / 2
      ? {
          title: "Hybrid mit sichtbaren Fallback-Anteilen",
          text: "Der Screener nutzt vorhandene Live-/Hybrid-Daten, markiert aber Werte mit lokaler oder fallback-basierter Datenlage bewusst vorsichtiger."
        }
      : picks.risk.length >= picks.long.length
        ? {
            title: "Selektiver Markt mit Risiko-Hinweisen",
            text: "Risk- und Watch-Kandidaten sind prominent, weil Momentum, Volatilitaet oder Datenqualitaet nicht bei allen Werten sauber genug wirken."
          }
        : {
            title: "Starke Setups, aber keine Empfehlung",
            text: "Long-Kandidaten fallen durch Momentum, Growth, Quality oder Event-Kontext auf. Jede Zeile zeigt auch Gegenargumente und Datenstatus."
          };
    return {
      total: rows.length,
      filtered: filtered.length,
      longCount: picks.long.length,
      watchCount: picks.watch.length,
      riskCount: picks.risk.length,
      momentum: sortedBy("momentumScore"),
      value: sortedBy("valueScore"),
      growth: sortedBy("growthScore"),
      risk: sortedBy("riskScore"),
      status,
      comment
    };
  }

  function normalizeScreenerStatus(status) {
    if (status === "live" || status === "stale") return "live";
    if (status === "hybrid") return "hybrid";
    if (status === "local") return "local";
    return "fallback";
  }

  function screenerRegionFor(symbol, asset = getAsset(symbol)) {
    const normalized = normalizeSymbol(symbol);
    if (["DAX", "SAP"].includes(normalized)) return "Deutschland";
    if (["ASML", "NOVO", "AIR.PA"].includes(normalized)) return "Europa";
    if (["BTC", "ETH", "GOLD"].includes(normalized) || ["Crypto", "Commodity"].includes(asset.type)) return "Global";
    if (asset.sector === "Germany") return "Deutschland";
    if (asset.currency === "EUR") return "Europa";
    return "USA";
  }

  function marketCapBucketFor(marketCap, type) {
    const value = Number(marketCap || 0);
    if (!value || ["ETF", "Index", "Commodity"].includes(type)) return "unknown";
    if (value >= 1000000000000) return "mega";
    if (value >= 10000000000) return "large";
    if (value >= 2000000000) return "mid";
    return "small";
  }

  function eventTypeKey(eventItem) {
    const type = String(eventItem?.type || "").toLowerCase();
    if (type.includes("earnings")) return "earnings";
    if (type.includes("dividend") || type.includes("dividende") || type.includes("split")) return "dividend";
    if (type.includes("makro")) return "macro";
    if (type.includes("ipo")) return "ipo";
    return type || "event";
  }

  function applyScreenerPreset(id) {
    const preset = SCREENER_PRESETS.find((item) => item.id === id) || SCREENER_PRESETS[0];
    state.screener = {
      ...SCREENER_DEFAULT_FILTERS,
      ...preset.filters,
      preset: preset.id
    };
    saveModuleDefault("screener", { ...state.screener });
    render();
  }

  function passesStyleFilter(row, filter) {
    if (!filter || filter === "all") return true;
    if (filter === "momentum") return row.momentumScore >= 70;
    if (filter === "value") return row.valueScore >= 60;
    if (filter === "growth") return row.growthScore >= 70;
    if (filter === "quality") return row.qualityScore >= 68;
    if (filter === "dividend") {
      const etf = etfDataForSymbol(row.symbol);
      return String(etf?.distribution || "").toLowerCase().includes("aussch") || ["Financials", "Utilities", "Energy"].includes(row.sector);
    }
    if (filter === "riskLow") return row.riskScore <= 42;
    if (filter === "highVolatility") return row.riskScore >= 62 || Number(row.analysis?.volatility || 0) >= 68;
    if (filter === "eventDriven") return row.eventScore >= 65;
    return true;
  }

  function passesPersonalFilter(row, filter) {
    if (!filter || filter === "all") return true;
    if (filter === "watchlist") return row.isWatchlist;
    if (filter === "favorites") return row.isFavorite;
    return true;
  }

  function passesEventContextFilter(row, filter) {
    if (!filter || filter === "all") return true;
    if (filter === "none") return row.eventContext.type === "none";
    if (filter === "today") return row.eventContext.timing === "today";
    if (filter === "week") return row.eventContext.timing === "week" || row.eventContext.timing === "today";
    return row.eventContext.type === filter;
  }

  function passesRatingFilter(row, filter) {
    if (!filter || filter === "all") return true;
    if (filter === "risk") return row.pickCategory === "risk";
    if (filter === "long") return row.pickCategory === "long";
    if (filter === "watch") return row.pickCategory === "watch";
    if (filter === "neutral") return row.pickCategory === "neutral";
    return true;
  }

  function screenerAssetTypeOptions() {
    const types = unique(["Stock", "ETF", "Index", "Crypto", "Commodity", ...ASSETS.map((asset) => asset.type)]);
    const labels = { Stock: "Aktie", ETF: "ETF", Index: "Index", Crypto: "Krypto", Commodity: "Rohstoff", Currency: "Waehrung" };
    return [["all", "Alle"], ...types.map((type) => [type, labels[type] || type])];
  }

  function screenerRegionOptions() {
    return [["all", "Alle"], ["USA", "USA"], ["Europa", "Europa"], ["Deutschland", "Deutschland"], ["China", "China"], ["Global", "Global"], ["Sonstige", "Sonstige / unbekannt"]];
  }

  function screenerStyleOptions() {
    return [
      ["all", "Alle"],
      ["momentum", "Momentum"],
      ["value", "Value"],
      ["growth", "Growth"],
      ["quality", "Quality"],
      ["dividend", "Dividende"],
      ["riskLow", "risikoarm"],
      ["highVolatility", "hochvolatil"],
      ["eventDriven", "Event-getrieben"]
    ];
  }

  function screenerMarketCapOptions() {
    return [["all", "Alle"], ["mega", "Mega Cap"], ["large", "Large Cap"], ["mid", "Mid Cap"], ["small", "Small Cap"], ["unknown", "unbekannt / nicht Aktie"]];
  }

  function screenerDataStatusOptions() {
    return [["all", "Alle"], ["live", "Live"], ["hybrid", "Hybrid"], ["fallback", "Fallback"], ["local", "Lokal"]];
  }

  function screenerEventOptions() {
    return [["all", "Alle"], ["today", "Event heute"], ["week", "Event diese Woche"], ["earnings", "Earnings bald"], ["dividend", "Dividende bald"], ["macro", "Makrotermin"], ["ipo", "IPO / Corporate Action"], ["none", "keine nahen Events"]];
  }

  function screenerSortOptions() {
    return [["score", "Gesamtscore"], ["momentum", "Momentum"], ["value", "Value"], ["growth", "Growth"], ["quality", "Quality"], ["risk", "Risiko"], ["event", "Event"], ["macro", "Makro"], ["dataQuality", "Datenqualitaet"], ["performance", "1M Performance"], ["marketCap", "Market Cap"], ["name", "Name"]];
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
          ${assetMap.has(eventItem.symbol) ? `<button class="tiny-button" type="button" data-journal-open="${escAttr(eventItem.symbol)}" data-journal-context="event">Journal</button>` : ""}
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
        ${hasAsset ? `<button class="tiny-button" type="button" data-journal-open="${escAttr(alert.symbol)}" data-journal-context="alert">Journal</button>` : ""}
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
      .map(([name, weight]) => ({
        name,
        left: Number(leftMap.get(name) || 0),
        right: Number(weight || 0),
        weight: Math.min(Number(weight || 0), Number(leftMap.get(name) || 0))
      }))
      .sort((a, b) => b.weight - a.weight);
    const region = regionOverlap(left, right);
    const sector = sectorOverlap(left, right);
    return {
      score: overlap.reduce((sum, row) => sum + row.weight, 0),
      names: overlap.map((row) => row.name),
      holdingRows: overlap,
      regionScore: region.score,
      regionNames: region.names,
      regionRows: region.rows,
      sectorScore: sector.score,
      sectorNames: sector.names,
      sectorRows: sector.rows
    };
  }

  function regionOverlap(left, right) {
    const leftMap = new Map(left.region.map(([name, weight]) => [name, weight]));
    const overlap = right.region
      .filter(([name]) => leftMap.has(name))
      .map(([name, weight]) => ({
        name,
        left: Number(leftMap.get(name) || 0),
        right: Number(weight || 0),
        weight: Math.min(Number(weight || 0), Number(leftMap.get(name) || 0))
      }))
      .sort((a, b) => b.weight - a.weight);
    return {
      score: overlap.reduce((sum, row) => sum + row.weight, 0),
      names: overlap.map((row) => row.name),
      rows: overlap
    };
  }

  function sectorOverlap(left, right) {
    const leftMap = new Map((left.sectors || []).map(([name, weight]) => [name, weight]));
    const overlap = (right.sectors || [])
      .filter(([name]) => leftMap.has(name))
      .map(([name, weight]) => ({
        name,
        left: Number(leftMap.get(name) || 0),
        right: Number(weight || 0),
        weight: Math.min(Number(weight || 0), Number(leftMap.get(name) || 0))
      }))
      .sort((a, b) => b.weight - a.weight);
    return {
      score: overlap.reduce((sum, row) => sum + row.weight, 0),
      names: overlap.map((row) => row.name),
      rows: overlap
    };
  }

  function etfHoldingConcentration(etf) {
    return etf.holdings.reduce((sum, [, weight]) => sum + Number(weight || 0), 0);
  }

  function distributionExplanation(etf) {
    if (etf.distribution === "Keine Ausschüttung") {
      return "Keine laufende Ausschüttung. Der Nutzen liegt nicht im Cashflow, sondern in Preis-/Absicherungswirkung.";
    }
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
    if (["left", "right", "amount", "monthly", "years", "returnRate"].includes(name)) {
      saveModuleDefault("etf", { [name]: state.etf[name] });
    }
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
    if (["left", "right"].includes(name)) {
      saveModuleDefault("compare", { [name]: symbol });
    }
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
    recordActivity("Compare", `${state.compare.left} vs ${state.compare.right}`, { route: "compare" });
    awardXp("first-compare", 20, "Quick Compare genutzt");
    navigate("compare");
  }

  function openEtfPortfolioFit(symbol) {
    const normalized = normalizeSymbol(symbol);
    if (!assetMap.has(normalized)) {
      toast("ETF nicht im Asset-Universum gefunden.");
      return;
    }
    state.portfolioScenario.symbol = normalized;
    state.portfolioScenario.quantity = 1;
    state.portfolioScenario.avgPrice = quoteFor(normalized).price || "";
    state.portfolioScenario.cashChange = 0;
    toast(`${normalized} ist in der Portfolio-Simulation vorbereitet.`);
    navigate("portfolio");
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
    if (["window", "type", "scope", "relevance"].includes(name)) {
      saveModuleDefault("eventHub", { [name]: input.value });
    }
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
    saveModuleDefault("portfolio", { activePortfolioId: id });
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
    recordActivity("Portfolio", `${name} erstellt`, { route: "portfolio" });
    awardXp("portfolio-created", 25, "Portfolio erstellt");
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
          <button class="tiny-button" type="button" data-journal-open="${escAttr(position.symbol)}" data-journal-context="portfolio">Journal</button>
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
    return normalizeUserPreferences(state.userPreferences, state.dashboardPrefs);
  }

  function persistUserPreferences() {
    state.userPreferences = normalizeUserPreferences(state.userPreferences, state.dashboardPrefs);
    storageSet(STORAGE_KEYS.userPreferences, state.userPreferences);
  }

  function applyPreferenceDefaults() {
    const prefs = dashboardPrefs();
    state.screener = { ...state.screener, ...prefs.defaults.screener };
    state.eventHub = { ...state.eventHub, ...prefs.defaults.eventHub };
    state.etf = {
      ...state.etf,
      ...prefs.defaults.etf,
      left: etfBySymbol(prefs.defaults.etf.left) ? normalizeSymbol(prefs.defaults.etf.left) : state.etf.left,
      right: etfBySymbol(prefs.defaults.etf.right) ? normalizeSymbol(prefs.defaults.etf.right) : state.etf.right
    };
    if (assetMap.has(normalizeSymbol(prefs.defaults.compare.left))) {
      state.compare.left = normalizeSymbol(prefs.defaults.compare.left);
    }
    if (assetMap.has(normalizeSymbol(prefs.defaults.compare.right))) {
      state.compare.right = normalizeSymbol(prefs.defaults.compare.right);
    }
    if (state.portfolios.some((portfolio) => portfolio.id === prefs.defaults.portfolio.activePortfolioId)) {
      state.activePortfolioId = prefs.defaults.portfolio.activePortfolioId;
      storageSet(STORAGE_KEYS.activePortfolioId, state.activePortfolioId);
    }
    document.body.dataset.detail = prefs.display.detail;
    document.body.dataset.dataStatus = prefs.display.dataStatus;
  }

  function setDashboardMode(mode) {
    if (!DASHBOARD_MODES[mode]) {
      return;
    }
    const config = DASHBOARD_MODES[mode];
    const current = dashboardPrefs();
    state.userPreferences = normalizeUserPreferences({
      ...current,
      mode,
      modules: normalizedModulePreferences(config.modules, "hidden"),
      shortcuts: sanitizeShortcuts(config.shortcuts),
      profile: {
        ...current.profile,
        ...config.profile,
        focus: sanitizeFocusList(config.profile.focus)
      },
      display: {
        ...current.display,
        beginnerHelp: config.profile.experience === "beginner" ? true : current.display.beginnerHelp
      }
    });
    persistUserPreferences();
    applyPreferenceDefaults();
    toast(`Dashboard-Modus: ${config.label}`);
    render();
  }

  function isFavoriteSymbol(symbol) {
    return dashboardPrefs().favorites.includes(normalizeSymbol(symbol));
  }

  function toggleFavoriteSymbol(symbol) {
    const normalized = normalizeSymbol(symbol);
    if (!assetMap.has(normalized)) {
      toast("Asset nicht gefunden.");
      return;
    }
    const prefs = dashboardPrefs();
    const exists = prefs.favorites.includes(normalized);
    const favorites = exists
      ? prefs.favorites.filter((item) => item !== normalized)
      : unique([normalized, ...prefs.favorites]).slice(0, 12);
    state.userPreferences = normalizeUserPreferences({ ...prefs, favorites });
    persistUserPreferences();
    toast(exists ? `${normalized} aus Favoriten entfernt.` : `${normalized} als Favorit gespeichert.`);
    render();
  }

  function setHomeModulePreference(moduleId, priority) {
    if (!HOME_MODULE_CATALOG.some((module) => module.id === moduleId) || !["high", "normal", "hidden"].includes(priority)) {
      return;
    }
    const prefs = dashboardPrefs();
    state.userPreferences = normalizeUserPreferences({
      ...prefs,
      modules: {
        ...prefs.modules,
        [moduleId]: priority
      }
    });
    persistUserPreferences();
    render();
  }

  function togglePreferenceShortcut(shortcutId) {
    if (!SHORTCUT_CATALOG.some((shortcut) => shortcut.id === shortcutId)) {
      return;
    }
    const prefs = dashboardPrefs();
    const selected = prefs.shortcuts.includes(shortcutId);
    if (!selected && prefs.shortcuts.length >= 6) {
      toast("Maximal 6 Schnellzugriffe aktiv.");
      return;
    }
    state.userPreferences = normalizeUserPreferences({
      ...prefs,
      shortcuts: selected ? prefs.shortcuts.filter((id) => id !== shortcutId) : [...prefs.shortcuts, shortcutId]
    });
    persistUserPreferences();
    render();
  }

  function toggleProfileFocus(focusId) {
    if (!PROFILE_OPTION_LABELS.focus[focusId]) {
      return;
    }
    const prefs = dashboardPrefs();
    const selected = prefs.profile.focus.includes(focusId);
    if (!selected && prefs.profile.focus.length >= 5) {
      toast("Maximal 5 Fokusbereiche aktiv.");
      return;
    }
    state.userPreferences = normalizeUserPreferences({
      ...prefs,
      profile: {
        ...prefs.profile,
        focus: selected ? prefs.profile.focus.filter((item) => item !== focusId) : [...prefs.profile.focus, focusId]
      }
    });
    persistUserPreferences();
    render();
  }

  function resetUserPreferences() {
    state.userPreferences = defaultUserPreferences("investor");
    persistUserPreferences();
    applyPreferenceDefaults();
    toast("Personalisierung auf Standard zurueckgesetzt.");
    render();
  }

  function updatePreferenceControl(input) {
    const name = input.name;
    if (!name) {
      return;
    }
    const prefs = dashboardPrefs();
    const value = preferenceControlValue(input);
    let next = prefs;

    if (name === "mode") {
      setDashboardMode(value);
      return;
    }
    if (name.startsWith("profile.")) {
      const key = name.replace("profile.", "");
      next = { ...prefs, profile: { ...prefs.profile, [key]: value } };
    } else if (name.startsWith("display.")) {
      const key = name.replace("display.", "");
      next = { ...prefs, display: { ...prefs.display, [key]: value } };
    } else if (name.startsWith("defaults.")) {
      next = setPreferenceDefaultValue(prefs, name.replace("defaults.", ""), value);
    } else {
      return;
    }

    state.userPreferences = normalizeUserPreferences(next);
    persistUserPreferences();
    applyPreferenceDefaults();
    if (input.type === "checkbox" || input.tagName === "SELECT") {
      render();
    }
  }

  function preferenceControlValue(input) {
    if (input.type === "checkbox") {
      return input.checked;
    }
    if (input.type === "number") {
      return Number(input.value || 0);
    }
    if (["left", "right"].includes(input.name.split(".").pop())) {
      const symbol = normalizeSymbol(input.value);
      return assetMap.has(symbol) ? symbol : input.value;
    }
    return input.value;
  }

  function setPreferenceDefaultValue(prefs, path, value) {
    const [group, key] = path.split(".");
    if (!prefs.defaults[group] || !key) {
      return prefs;
    }
    return {
      ...prefs,
      defaults: {
        ...prefs.defaults,
        [group]: {
          ...prefs.defaults[group],
          [key]: value
        }
      }
    };
  }

  function saveModuleDefault(group, values = {}) {
    const prefs = dashboardPrefs();
    state.userPreferences = normalizeUserPreferences({
      ...prefs,
      defaults: {
        ...prefs.defaults,
        [group]: {
          ...prefs.defaults[group],
          ...values
        }
      }
    });
    persistUserPreferences();
  }

  function preferenceModeLabel(mode) {
    return DASHBOARD_MODES[mode]?.label || "Investor";
  }

  function modulePriorityLabel(priority) {
    const labels = { high: "oben", normal: "normal", hidden: "ausblenden" };
    return labels[priority] || "normal";
  }

  function profileOptionLabel(group, value) {
    return PROFILE_OPTION_LABELS[group]?.[value] || value || "nicht gesetzt";
  }

  function favoriteAssetCandidates() {
    const prefs = dashboardPrefs();
    return unique([...prefs.favorites, ...state.watchlist, ...state.recents, ...HOME_TICKER, "SPY", "QQQ", "GLD", "BTC"])
      .map(getAsset)
      .filter(Boolean)
      .slice(0, 18);
  }

  function selectedShortcuts() {
    const prefs = dashboardPrefs();
    return prefs.shortcuts.map((id) => SHORTCUT_CATALOG.find((shortcut) => shortcut.id === id)).filter(Boolean);
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

  function renderJournalPage() {
    ensureHomeData();
    ensureEventData();
    const entries = journalEntriesForView();
    const filteredEntries = filteredJournalEntries(entries);
    const stats = journalStats(entries);
    const draft = journalDraftForForm();

    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Journal / Psychologie / Fehleranalyse V2</p>
            <h1>Entscheidungen besser verstehen.</h1>
            <p>Lokales Investment- und Trading-Journal für These, Emotion, Regel-Check, Fehleranalyse, Review und Monatsrückblick. Keine Psychologie-Blackbox, sondern nachvollziehbare Reflexionslogik.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-journal-open="${escAttr(state.activeSymbol || "NVDA")}" data-journal-context="quick">Eintrag für ${esc(state.activeSymbol || "NVDA")}</button>
            <button class="ghost-button" type="button" data-route="asset">Aktives Asset öffnen</button>
          </div>
        </div>
      </section>

      <section class="section">
        ${renderJournalDashboard(stats)}
      </section>

      <section class="section">
        <div class="journal-layout">
          ${renderJournalEntryForm(draft)}
          <article class="card journal-list-card">
            <div class="card-topline">
              <div>
                <span class="card-label">Journal-Liste</span>
                <h3><span id="journalFilterCount">${filteredEntries.length}</span> gefilterte Entscheidungen</h3>
                <p>Suche nach Asset, These, Emotion, Fehlerklasse oder Review-Status. Alles bleibt lokal im Browser gespeichert.</p>
              </div>
              ${renderDataMeta(journalDataMeta(entries), true)}
            </div>
            ${renderJournalFilters()}
            <div class="journal-entry-list" id="journalResults">
              ${filteredEntries.map(renderJournalEntryCard).join("") || renderEmptyState("Noch keine passenden Journal-Einträge. Lege links den ersten Eintrag an.")}
            </div>
          </article>
        </div>
      </section>

      <section class="section">
        <div class="grid three">
          ${renderJournalMistakeCard(entries)}
          ${renderJournalBiasCard(entries)}
          ${renderJournalMonthlyReview(entries)}
        </div>
      </section>

      <section class="section">
        <div class="grid two">
          ${renderJournalBestWorstCard(entries, "best")}
          ${renderJournalBestWorstCard(entries, "worst")}
        </div>
      </section>
    `;
  }

  function renderJournalDashboard(stats) {
    return `
      <article class="card journal-dashboard-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Entscheidungsqualität</span>
            <h3>${esc(stats.label)}</h3>
            <p>${esc(stats.summary)}</p>
          </div>
          <div class="journal-score-badge ${escAttr(stats.tone)}">
            <strong>${stats.score}</strong>
            <span>/100</span>
          </div>
        </div>
        <div class="journal-dashboard-grid">
          ${renderMiniMetric("Einträge", String(stats.count))}
          ${renderMiniMetric("Reviewed", `${formatNumber(stats.reviewQuote)}%`)}
          ${renderMiniMetric("Regeltreue", `${formatNumber(stats.ruleAdherence)}%`)}
          ${renderMiniMetric("Emotionale Stabilität", `${formatNumber(stats.emotionalStability)}%`)}
          ${renderMiniMetric("These-Klarheit", `${formatNumber(stats.thesisClarity)}%`)}
          ${renderMiniMetric("Häufigster Fehler", stats.topMistake || "noch offen")}
        </div>
        <div class="journal-method-note">
          <span class="pill">Lokal / Produktlogik</span>
          <p>Der Score kombiniert Regeltreue, These-Klarheit, emotionale Stabilität und Review-Quote. Er bewertet Muster in deinen Eingaben, nicht deine Persönlichkeit und keine objektive Markt-Wahrheit.</p>
        </div>
      </article>
    `;
  }

  function renderJournalEntryForm(entry) {
    const isEditing = Boolean(entry.id && state.journal.some((item) => item.id === entry.id));
    return `
      <article class="card journal-form-card">
        <div class="card-topline">
          <div>
            <span class="card-label">${isEditing ? "Eintrag bearbeiten" : "Neuer Eintrag"}</span>
            <h3>${isEditing ? "Entscheidung sauber nachziehen" : "Entscheidung dokumentieren"}</h3>
            <p>These, Gefühl, Regel-Check und Fehlerklassen werden strukturiert gespeichert, damit spätere Reviews möglich werden.</p>
          </div>
          ${isEditing ? `<button class="tiny-button" type="button" data-journal-clear-draft>Neu starten</button>` : ""}
        </div>
        <form class="journal-form journal-entry-form" data-journal-form>
          <input type="hidden" name="id" value="${escAttr(isEditing ? entry.id : "")}">
          <div class="form-grid">
            <label class="field"><span>Datum / Zeitpunkt</span><input name="timestamp" type="datetime-local" value="${escAttr(toDateTimeLocal(entry.timestamp || Date.now()))}"></label>
            <label class="field"><span>Asset / Symbol</span><input name="symbol" value="${escAttr(entry.symbol || state.activeSymbol || "NVDA")}" placeholder="NVDA, SPY, BTC"></label>
            <label class="field"><span>Entscheidung</span><select name="type">${renderSelectOptions(JOURNAL_DECISION_TYPES, entry.type || "observe")}</select></label>
            <label class="field"><span>Kategorie</span><select name="category">${renderSelectOptions(JOURNAL_CATEGORIES, entry.category || "longterm")}</select></label>
            <label class="field"><span>Positionsgröße / Umfang</span><input name="size" value="${escAttr(entry.size || "")}" placeholder="z. B. 3% Portfolio, 1.000 €, Sparrate"></label>
            <label class="field"><span>Zeithorizont</span><select name="horizon">${renderSelectOptions([
              { value: "days", label: "Tage" },
              { value: "weeks", label: "Wochen" },
              { value: "months", label: "Monate" },
              { value: "years", label: "Jahre" }
            ], entry.horizon || "months")}</select></label>
          </div>

          <label class="field"><span>These / Hauptgrund</span><textarea name="thesis" placeholder="Warum treffe ich diese Entscheidung?">${esc(entry.thesis || "")}</textarea></label>
          <label class="field"><span>1–3 Kernargumente</span><textarea name="arguments" placeholder="Ein Argument pro Zeile">${esc((entry.arguments || []).join("\n"))}</textarea></label>
          <div class="form-grid">
            <label class="field"><span>Bull Case / Chance</span><textarea name="bullCase" placeholder="Was müsste positiv laufen?">${esc(entry.bullCase || "")}</textarea></label>
            <label class="field"><span>Bear Case / Risiko</span><textarea name="bearCase" placeholder="Was kann schiefgehen?">${esc(entry.bearCase || "")}</textarea></label>
            <label class="field"><span>Trigger / Beobachten</span><input name="trigger" value="${escAttr(entry.trigger || "")}" placeholder="Earnings, Support, Makrodaten, News"></label>
            <label class="field"><span>Meinung ändern, wenn...</span><input name="invalidation" value="${escAttr(entry.invalidation || "")}" placeholder="Welche Bedingung kippt die These?"></label>
            <label class="field full-field"><span>Ziel / Erwartung</span><input name="target" value="${escAttr(entry.target || "")}" placeholder="Kein Kursziel nötig: auch qualitative Erwartung reicht."></label>
          </div>

          <div class="journal-form-section">
            <div class="mini-section-head">
              <span class="card-label">Psychologie</span>
              <strong>Gefühl und Druck festhalten</strong>
            </div>
            <div class="form-grid">
              <label class="field"><span>Gefühl</span><select name="emotion">${renderSelectOptions(JOURNAL_EMOTIONS, entry.emotion || "neutral")}</select></label>
              <label class="field"><span>Emotionsstärke 1–10</span><input name="emotionStrength" type="number" min="1" max="10" value="${escAttr(entry.emotionStrength || 4)}"></label>
              <label class="field"><span>Conviction 1–10</span><input name="conviction" type="number" min="1" max="10" value="${escAttr(entry.conviction || 6)}"></label>
              <label class="field"><span>Entscheidungsdruck</span><select name="pressure">${renderSelectOptions([
                { value: "low", label: "Niedrig" },
                { value: "medium", label: "Mittel" },
                { value: "high", label: "Hoch" }
              ], entry.pressure || "medium")}</select></label>
            </div>
          </div>

          <div class="journal-form-section">
            <div class="mini-section-head">
              <span class="card-label">Regel-Check</span>
              <strong>War die Entscheidung sauber?</strong>
            </div>
            <div class="form-grid">
              ${renderJournalRuleField("plan", "Plan eingehalten?", entry.rule?.plan)}
              ${renderJournalRuleField("entry", "Setup regelkonform?", entry.rule?.entry)}
              ${renderJournalRuleField("risk", "Risiko angemessen?", entry.rule?.risk)}
              ${renderJournalRuleField("reason", "Klarer Grund?", entry.rule?.reason)}
              ${renderJournalRuleField("impulse", "Nicht impulsiv?", entry.rule?.impulse)}
              ${renderJournalRuleField("size", "Positionsgröße sinnvoll?", entry.rule?.size)}
            </div>
            <label class="field"><span>Was habe ich ignoriert?</span><textarea name="ignored" placeholder="Warnsignal, Risiko, Gegenargument oder Regelverstoß">${esc(entry.ignored || "")}</textarea></label>
          </div>

          <div class="journal-form-section">
            <div class="mini-section-head">
              <span class="card-label">Fehlerklassen</span>
              <strong>Welche Muster könnten relevant sein?</strong>
            </div>
            <div class="journal-checkbox-grid">
              ${JOURNAL_MISTAKE_TAGS.map((tag) => `
                <label class="journal-check-chip">
                  <input type="checkbox" name="mistakes" value="${escAttr(tag.value)}" ${(entry.mistakes || []).includes(tag.value) ? "checked" : ""}>
                  <span>${esc(tag.label)}</span>
                </label>
              `).join("")}
            </div>
          </div>

          <label class="field"><span>Kommentar / Kontext</span><textarea name="comment" placeholder="Was war noch wichtig?">${esc(entry.comment || "")}</textarea></label>
          <button class="primary-button" type="submit">${isEditing ? "Eintrag aktualisieren" : "Journal-Eintrag speichern"}</button>
        </form>
      </article>
    `;
  }

  function renderJournalRuleField(name, label, value = "partial") {
    return `<label class="field"><span>${esc(label)}</span><select name="rule_${escAttr(name)}">${renderSelectOptions(JOURNAL_RULE_OPTIONS, value || "partial")}</select></label>`;
  }

  function renderJournalFilters() {
    const filters = state.journalFilters;
    const mistakeOptions = [{ value: "all", label: "Alle Fehlerklassen" }, ...JOURNAL_MISTAKE_TAGS];
    return `
      <div class="journal-filter-panel">
        <label class="field"><span>Suche</span><input data-journal-control name="search" value="${escAttr(filters.search || "")}" placeholder="Symbol, These, Trigger, Kommentar"></label>
        <label class="field"><span>Entscheidung</span><select data-journal-control name="type">${renderSelectOptions([{ value: "all", label: "Alle Entscheidungen" }, ...JOURNAL_DECISION_TYPES], filters.type || "all")}</select></label>
        <label class="field"><span>Kategorie</span><select data-journal-control name="category">${renderSelectOptions([{ value: "all", label: "Alle Kategorien" }, ...JOURNAL_CATEGORIES], filters.category || "all")}</select></label>
        <label class="field"><span>Emotion</span><select data-journal-control name="emotion">${renderSelectOptions([{ value: "all", label: "Alle Emotionen" }, ...JOURNAL_EMOTIONS], filters.emotion || "all")}</select></label>
        <label class="field"><span>Fehlerklasse</span><select data-journal-control name="mistake">${renderSelectOptions(mistakeOptions, filters.mistake || "all")}</select></label>
        <label class="field"><span>Review</span><select data-journal-control name="review">${renderSelectOptions([
          { value: "all", label: "Alle" },
          { value: "open", label: "Ohne Review" },
          { value: "reviewed", label: "Reviewed" }
        ], filters.review || "all")}</select></label>
      </div>
    `;
  }

  function renderJournalEntryCard(entry) {
    const quality = journalDecisionQualityScore(entry);
    const rule = journalRuleSummary(entry);
    const asset = assetMap.has(entry.symbol) ? getAsset(entry.symbol) : null;
    const event = asset ? eventsForSymbol(entry.symbol)[0] : null;
    const status = journalReviewed(entry) ? "Reviewed" : "Offen";
    const mistakeChips = entry.mistakes.length
      ? entry.mistakes.slice(0, 4).map((tag) => `<span class="pill ${tag === "rule_break" || tag === "fomo" ? "bear" : ""}">${esc(journalMistakeLabel(tag))}</span>`).join("")
      : `<span class="pill">Keine Fehlerklasse</span>`;
    return `
      <article class="journal-entry-card">
        <div class="journal-entry-head">
          <button class="symbol-button" type="button" ${asset ? `data-symbol="${escAttr(entry.symbol)}"` : ""}>
            <strong>${esc(entry.symbol)}</strong>
            <span>${asset ? esc(asset.name) : "Thema / manuell"}</span>
          </button>
          <div class="journal-entry-meta">
            <span class="pill">${esc(journalDecisionTypeLabel(entry.type))}</span>
            <span class="pill">${esc(journalCategoryLabel(entry.category))}</span>
            <span class="pill ${journalReviewed(entry) ? "bull" : ""}">${esc(status)}</span>
          </div>
        </div>
        <div class="journal-entry-body">
          <div>
            <span class="card-label">${formatTimestamp(entry.timestamp)}</span>
            <h3>${esc(entry.thesis || "These noch nicht ausformuliert")}</h3>
            <p>${esc(entry.trigger || entry.invalidation || "Kein Trigger dokumentiert.")}</p>
            ${entry.arguments.length ? `<div class="journal-argument-list">${entry.arguments.slice(0, 3).map((item) => `<span>${esc(item)}</span>`).join("")}</div>` : ""}
          </div>
          <div class="journal-quality-panel">
            <span class="score-pill ${escAttr(quality.tone)}">${quality.score}</span>
            <strong>${esc(quality.label)}</strong>
            <small>${esc(rule.label)} · ${esc(journalEmotionLabel(entry.emotion))} · Druck ${esc(journalPressureLabel(entry.pressure))}</small>
          </div>
        </div>
        <div class="journal-chip-row">${mistakeChips}</div>
        <div class="journal-entry-context">
          <span><strong>Chance:</strong> ${esc(entry.bullCase || "nicht festgehalten")}</span>
          <span><strong>Risiko:</strong> ${esc(entry.bearCase || "nicht festgehalten")}</span>
          <span><strong>Nächster Bezug:</strong> ${esc(event ? `${eventTimingLabel(event)} · ${event.title}` : "kein Event verknüpft")}</span>
        </div>
        <details class="journal-review-card">
          <summary>Review / Lernen</summary>
          ${renderJournalReviewForm(entry)}
        </details>
        <div class="row-actions journal-entry-actions">
          ${asset ? `<button class="tiny-button" type="button" data-symbol="${escAttr(entry.symbol)}">Asset</button>` : ""}
          ${asset ? `<button class="tiny-button" type="button" data-compare-open="${escAttr(entry.symbol)}">Compare</button>` : ""}
          ${asset ? `<button class="tiny-button" type="button" data-alert-quick="${escAttr(entry.symbol)}" data-alert-quick-type="price">Alert</button>` : ""}
          <button class="tiny-button" type="button" data-journal-edit="${escAttr(entry.id)}">Bearbeiten</button>
          <button class="tiny-button danger-button" type="button" data-journal-delete="${escAttr(entry.id)}">Löschen</button>
        </div>
      </article>
    `;
  }

  function renderJournalReviewForm(entry) {
    const review = entry.review || {};
    return `
      <form class="journal-review-form" data-journal-review-form>
        <input type="hidden" name="id" value="${escAttr(entry.id)}">
        <div class="form-grid">
          <label class="field"><span>Ergebnis</span><select name="outcome">${renderSelectOptions([
            { value: "open", label: "Noch offen" },
            { value: "positive", label: "Positiv" },
            { value: "mixed", label: "Gemischt" },
            { value: "negative", label: "Negativ" }
          ], review.outcome || "open")}</select></label>
          <label class="field"><span>These aufgegangen?</span><select name="thesisWorked">${renderSelectOptions([
            { value: "open", label: "Noch offen" },
            { value: "yes", label: "Ja" },
            { value: "partial", label: "Teilweise" },
            { value: "no", label: "Nein" }
          ], review.thesisWorked || "open")}</select></label>
          <label class="field"><span>Noch einmal so handeln?</span><select name="repeat">${renderSelectOptions([
            { value: "open", label: "Noch offen" },
            { value: "yes", label: "Ja" },
            { value: "partial", label: "Teilweise" },
            { value: "no", label: "Nein" }
          ], review.repeat || "open")}</select></label>
          <label class="field"><span>Entscheidungsqualität</span><select name="quality">${renderSelectOptions([
            { value: "open", label: "Noch offen" },
            { value: "strong", label: "Gut trotz Ergebnis" },
            { value: "ok", label: "Solide" },
            { value: "weak", label: "Schwach / impulsiv" }
          ], review.quality || "open")}</select></label>
          <label class="field full-field"><span>Learning</span><textarea name="learning" placeholder="Was nehme ich aus dieser Entscheidung mit?">${esc(review.learning || "")}</textarea></label>
        </div>
        <button class="primary-button" type="submit">Review speichern</button>
      </form>
    `;
  }

  function renderJournalMistakeCard(entries) {
    const mistakes = journalMistakeStats(entries).slice(0, 6);
    return `
      <article class="card journal-insight-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Fehleranalyse</span>
            <h3>Wiederkehrende Muster</h3>
            <p>Aus Fehler-Tags, Regel-Check und Emotionen abgeleitet. Keine Diagnose, nur sichtbare Muster.</p>
          </div>
          ${renderStatusBadge("local")}
        </div>
        <div class="journal-insight-list">
          ${mistakes.map((item) => `
            <div class="journal-insight-row">
              <span class="pill ${item.count >= 3 ? "bear" : ""}">${esc(item.label)}</span>
              <strong>${item.count}x</strong>
            </div>
          `).join("") || renderEmptyState("Noch keine Fehlermuster erkennbar.")}
        </div>
      </article>
    `;
  }

  function renderJournalBiasCard(entries) {
    const hints = journalBiasHints(entries);
    return `
      <article class="card journal-insight-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Bias / Disziplin</span>
            <h3>Hinweise statt Urteil</h3>
            <p>Die App zeigt einfache Muster wie FOMO, Stress, Regelbrüche und niedrige Review-Quote.</p>
          </div>
          ${renderStatusBadge("local")}
        </div>
        <div class="journal-insight-list">
          ${hints.map((hint) => `
            <div class="insight-row">
              <span class="pill ${escAttr(hint.tone || "")}">${esc(hint.label)}</span>
              <p>${esc(hint.text)}</p>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderJournalMonthlyReview(entries) {
    const review = journalMonthlyReview(entries);
    return `
      <article class="card journal-insight-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Monatsreview</span>
            <h3>${esc(review.title)}</h3>
            <p>${esc(review.summary)}</p>
          </div>
          ${renderStatusBadge("local")}
        </div>
        <div class="metric-grid">
          ${renderMiniMetric("Einträge", String(review.count))}
          ${renderMiniMetric("Regeltreue", `${formatNumber(review.ruleAdherence)}%`)}
          ${renderMiniMetric("Top-Emotion", review.topEmotion)}
          ${renderMiniMetric("Review-Quote", `${formatNumber(review.reviewQuote)}%`)}
        </div>
        <div class="journal-method-note">
          <span class="pill">Nächster Monat</span>
          <p>${esc(review.learning)}</p>
        </div>
      </article>
    `;
  }

  function renderJournalBestWorstCard(entries, mode) {
    const rows = journalBestWorst(entries, mode);
    const isBest = mode === "best";
    return `
      <article class="card journal-rank-card">
        <div class="card-topline">
          <div>
            <span class="card-label">${isBest ? "Beste Entscheidungen" : "Schlechteste Entscheidungen"}</span>
            <h3>${isBest ? "Was gut funktioniert hat" : "Was du prüfen solltest"}</h3>
            <p>${isBest ? "Bewertet werden Qualität, Review, Regeltreue und Ergebnis-Hinweis." : "Niedrige Qualität heißt nicht automatisch Verlust, sondern oft unsauberer Prozess."}</p>
          </div>
        </div>
        <div class="journal-rank-list">
          ${rows.map((row) => `
            <button class="journal-rank-row" type="button" ${assetMap.has(row.symbol) ? `data-symbol="${escAttr(row.symbol)}"` : ""}>
              <span class="rank">${row.rank}</span>
              <span>
                <strong>${esc(row.symbol)} · ${esc(journalDecisionTypeLabel(row.type))}</strong>
                <small>${esc(row.reason)}</small>
              </span>
              <span class="${escAttr(row.tone)}">${row.score}</span>
            </button>
          `).join("") || renderEmptyState("Noch nicht genug Journal-Daten für diese Auswertung.")}
        </div>
      </article>
    `;
  }

  function journalEntriesFor(symbol) {
    return journalEntriesForView()
      .filter((entry) => entry.symbol === normalizeSymbol(symbol))
      .slice(0, 6);
  }

  function journalEntriesForView() {
    return (state.journal || [])
      .map(normalizeJournalEntry)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  function filteredJournalEntries(entries) {
    const filters = state.journalFilters || {};
    const search = String(filters.search || "").trim().toLowerCase();
    return entries.filter((entry) => {
      if (filters.type && filters.type !== "all" && entry.type !== filters.type) return false;
      if (filters.category && filters.category !== "all" && entry.category !== filters.category) return false;
      if (filters.emotion && filters.emotion !== "all" && entry.emotion !== filters.emotion) return false;
      if (filters.mistake && filters.mistake !== "all" && !entry.mistakes.includes(filters.mistake)) return false;
      if (filters.review === "open" && journalReviewed(entry)) return false;
      if (filters.review === "reviewed" && !journalReviewed(entry)) return false;
      if (!search) return true;
      return [
        entry.symbol,
        entry.thesis,
        entry.trigger,
        entry.comment,
        entry.bullCase,
        entry.bearCase,
        entry.ignored,
        entry.arguments.join(" "),
        entry.mistakes.map(journalMistakeLabel).join(" ")
      ].some((value) => String(value || "").toLowerCase().includes(search));
    });
  }

  function journalDraftForForm() {
    return state.journalDraft ? normalizeJournalEntry(state.journalDraft) : normalizeJournalEntry({
      symbol: state.activeSymbol || "NVDA",
      type: "observe",
      category: assetMap.get(state.activeSymbol)?.type === "ETF" ? "etf" : "longterm",
      timestamp: Date.now()
    });
  }

  function normalizeJournalEntry(entry = {}) {
    const rawSymbol = normalizeSymbol(entry.symbol || state.activeSymbol || "NVDA");
    const emotion = normalizeJournalEmotion(entry.emotion);
    const rule = normalizeJournalRule(entry.rule ? { ...entry, ...entry.rule } : entry);
    const mistakes = uniqueList([
      ...(Array.isArray(entry.mistakes) ? entry.mistakes : []),
      ...inferJournalMistakes({ ...entry, emotion, rule })
    ]).filter((tag) => JOURNAL_MISTAKE_TAGS.some((item) => item.value === tag));
    const review = {
      outcome: String(entry.review?.outcome || entry.outcome || "open"),
      thesisWorked: String(entry.review?.thesisWorked || entry.thesisWorked || "open"),
      repeat: String(entry.review?.repeat || entry.repeat || "open"),
      quality: String(entry.review?.quality || entry.quality || "open"),
      learning: String(entry.review?.learning || entry.learning || "").trim(),
      reviewedAt: Number(entry.review?.reviewedAt || entry.reviewedAt || 0)
    };
    const normalized = {
      id: String(entry.id || `journal-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      symbol: rawSymbol || "NVDA",
      timestamp: normalizeJournalTimestamp(entry.timestamp),
      type: normalizeOptionValue(entry.type || entry.decisionType || "observe", JOURNAL_DECISION_TYPES, "observe"),
      category: normalizeOptionValue(entry.category || "longterm", JOURNAL_CATEGORIES, "longterm"),
      size: String(entry.size || entry.positionSize || "").trim(),
      thesis: String(entry.thesis || "").trim(),
      arguments: Array.isArray(entry.arguments) ? entry.arguments.map(String).map((item) => item.trim()).filter(Boolean) : splitLines(entry.arguments || entry.argumentsText),
      invalidation: String(entry.invalidation || "").trim(),
      bullCase: String(entry.bullCase || "").trim(),
      bearCase: String(entry.bearCase || "").trim(),
      trigger: String(entry.trigger || "").trim(),
      horizon: String(entry.horizon || "months"),
      target: String(entry.target || "").trim(),
      emotion,
      emotionStrength: clamp(Number(entry.emotionStrength || 4), 1, 10),
      conviction: clamp(Number(entry.conviction || 6), 1, 10),
      pressure: ["low", "medium", "high"].includes(entry.pressure) ? entry.pressure : "medium",
      rule,
      ignored: String(entry.ignored || "").trim(),
      mistakes,
      comment: String(entry.comment || "").trim(),
      review
    };
    normalized.ruleCheck = journalRuleSummary(normalized).label;
    return normalized;
  }

  function normalizeJournalRule(source = {}) {
    const oldRuleCheck = String(source.ruleCheck || "");
    const fallback = oldRuleCheck === "ok" ? "yes" : oldRuleCheck === "risk" ? "no" : "partial";
    return {
      plan: normalizeRuleValue(source.plan || source.rule_plan || fallback),
      entry: normalizeRuleValue(source.entry || source.rule_entry || fallback),
      risk: normalizeRuleValue(source.risk || source.rule_risk || fallback),
      reason: normalizeRuleValue(source.reason || source.rule_reason || (source.thesis ? "yes" : fallback)),
      impulse: normalizeRuleValue(source.impulse || source.rule_impulse || (["fomo", "stress", "euphoria"].includes(source.emotion) ? "no" : fallback)),
      size: normalizeRuleValue(source.size || source.rule_size || fallback)
    };
  }

  function normalizeJournalTimestamp(value) {
    if (!value) return Date.now();
    if (Number.isFinite(Number(value))) return Number(value);
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function normalizeJournalEmotion(value) {
    const raw = String(value || "neutral").toLowerCase();
    const aliases = {
      rational: "calm",
      ruhig: "calm",
      "überzeugt": "convinced",
      ueberzeugt: "convinced",
      unsicher: "unsure",
      angst: "fear",
      euphorie: "euphoria",
      frust: "frustration"
    };
    const normalized = aliases[raw] || raw;
    return JOURNAL_EMOTIONS.some((item) => item.value === normalized) ? normalized : "neutral";
  }

  function normalizeRuleValue(value) {
    return ["yes", "partial", "no"].includes(value) ? value : "partial";
  }

  function normalizeOptionValue(value, options, fallback) {
    return options.some((item) => item.value === value) ? value : fallback;
  }

  function inferJournalMistakes(entry) {
    const mistakes = [];
    if (entry.emotion === "fomo") mistakes.push("fomo");
    if (["stress", "fear", "frustration"].includes(entry.emotion) && Number(entry.emotionStrength || 0) >= 7) mistakes.push("loss_aversion");
    if (entry.emotion === "euphoria" && Number(entry.conviction || 0) >= 8) mistakes.push("overconfidence");
    if (!String(entry.thesis || "").trim()) mistakes.push("no_thesis");
    if (Object.values(entry.rule || {}).some((value) => value === "no")) mistakes.push("rule_break");
    if (entry.rule?.size === "no") mistakes.push("position_size");
    if (entry.rule?.impulse === "no") mistakes.push("impatience");
    return mistakes;
  }

  function journalQualityHint(entry) {
    if (!entry) {
      return {
        label: "These offen",
        text: "Ein guter Eintrag nennt These, Trigger und Regel-Check. So wird aus Intuition später überprüfbares Lernen."
      };
    }
    const normalized = normalizeJournalEntry(entry);
    const quality = journalDecisionQualityScore(normalized);
    if (quality.score < 50 || normalized.mistakes.includes("rule_break")) {
      return {
        label: "Noch einmal prüfen",
        text: "Der letzte Eintrag zeigt Regelbruch, Stress oder schwache These. Vor der nächsten Entscheidung Setup und Positionsgröße kontrollieren."
      };
    }
    if (!journalReviewed(normalized)) {
      return {
        label: "Review offen",
        text: "Der Eintrag ist dokumentiert, aber noch nicht überprüft. Später prüfen: These aufgegangen oder nur Ergebnisglück?"
      };
    }
    return {
      label: "Plan wirkt sauber",
      text: "These, Regel-Check und Review sind nachvollziehbar dokumentiert. Das stärkt wiederholbare Entscheidungsqualität."
    };
  }

  function saveJournalEntryFromForm(form) {
    const data = new FormData(form);
    const symbol = normalizeSymbol(data.get("symbol"));
    const thesis = String(data.get("thesis") || "").trim();
    const comment = String(data.get("comment") || "").trim();
    if (!symbol || (!thesis && !comment)) {
      toast("Bitte mindestens Symbol und These oder Kommentar eintragen.");
      return;
    }
    const id = String(data.get("id") || "").trim();
    const entry = normalizeJournalEntry({
      id: id || `journal-${Date.now()}`,
      symbol,
      timestamp: data.get("timestamp"),
      type: String(data.get("type") || "observe"),
      category: String(data.get("category") || "longterm"),
      size: data.get("size"),
      thesis,
      arguments: splitLines(data.get("arguments")),
      invalidation: data.get("invalidation"),
      bullCase: data.get("bullCase"),
      bearCase: data.get("bearCase"),
      trigger: data.get("trigger"),
      horizon: data.get("horizon"),
      target: data.get("target"),
      emotion: data.get("emotion"),
      emotionStrength: data.get("emotionStrength"),
      conviction: data.get("conviction"),
      pressure: data.get("pressure"),
      ruleCheck: data.get("ruleCheck"),
      rule: {
        plan: data.get("rule_plan"),
        entry: data.get("rule_entry"),
        risk: data.get("rule_risk"),
        reason: data.get("rule_reason"),
        impulse: data.get("rule_impulse"),
        size: data.get("rule_size")
      },
      ignored: data.get("ignored"),
      mistakes: data.getAll("mistakes").map(String),
      comment
    });
    const existingIndex = state.journal.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      const previous = normalizeJournalEntry(state.journal[existingIndex]);
      state.journal[existingIndex] = { ...entry, review: previous.review };
      toast("Journal-Eintrag aktualisiert.");
    } else {
      state.journal = [entry, ...state.journal].slice(0, 220);
      toast("Journal-Eintrag gespeichert.");
    }
    state.journalDraft = null;
    storageSet(STORAGE_KEYS.journal, state.journal);
    form.reset();
    render();
  }

  function saveJournalReviewFromForm(form) {
    const data = new FormData(form);
    const id = String(data.get("id") || "").trim();
    const index = state.journal.findIndex((entry) => entry.id === id);
    if (index < 0) {
      toast("Journal-Eintrag nicht gefunden.");
      return;
    }
    const current = normalizeJournalEntry(state.journal[index]);
    current.review = {
      outcome: String(data.get("outcome") || "open"),
      thesisWorked: String(data.get("thesisWorked") || "open"),
      repeat: String(data.get("repeat") || "open"),
      quality: String(data.get("quality") || "open"),
      learning: String(data.get("learning") || "").trim(),
      reviewedAt: Date.now()
    };
    state.journal[index] = current;
    storageSet(STORAGE_KEYS.journal, state.journal);
    toast("Review gespeichert.");
    render();
  }

  function openJournalDraft(symbol, context = "") {
    const normalized = normalizeSymbol(symbol || state.activeSymbol || "NVDA");
    const asset = assetMap.get(normalized);
    state.journalDraft = normalizeJournalEntry({
      symbol: asset ? normalized : (state.activeSymbol || "NVDA"),
      type: context === "portfolio" ? "portfolio" : "observe",
      category: asset?.type === "ETF" ? "etf" : "longterm",
      trigger: context === "portfolio" ? "Portfolio-Review / Positionsentscheidung" : "",
      comment: context ? `Aus ${context} geöffnet.` : ""
    });
    if (state.route === "journal") {
      render();
    } else {
      navigate("journal");
    }
  }

  function editJournalEntry(id) {
    const entry = journalEntriesForView().find((item) => item.id === id);
    if (!entry) {
      toast("Journal-Eintrag nicht gefunden.");
      return;
    }
    state.journalDraft = entry;
    if (state.route === "journal") {
      render();
    } else {
      navigate("journal");
    }
  }

  function deleteJournalEntry(id) {
    const entry = state.journal.find((item) => item.id === id);
    if (!entry) return;
    if (!window.confirm("Journal-Eintrag wirklich löschen?")) return;
    state.journal = state.journal.filter((item) => item.id !== id);
    storageSet(STORAGE_KEYS.journal, state.journal);
    toast("Journal-Eintrag gelöscht.");
    render();
  }

  function updateJournalFilterState(input) {
    if (!input.name) return;
    state.journalFilters[input.name] = input.value;
    const target = document.getElementById("journalResults");
    if (target) {
      const entries = filteredJournalEntries(journalEntriesForView());
      const count = document.getElementById("journalFilterCount");
      target.innerHTML = entries.map(renderJournalEntryCard).join("") || renderEmptyState("Noch keine passenden Journal-Einträge. Lege links den ersten Eintrag an.");
      if (count) {
        count.textContent = String(entries.length);
      }
    } else if (state.route === "journal") {
      render();
    }
  }

  function journalStats(entries) {
    const count = entries.length;
    const ruleAdherence = count ? average(entries.map(journalRuleScore)) : 0;
    const emotionalStability = count ? average(entries.map(journalEmotionalStabilityScore)) : 0;
    const thesisClarity = count ? average(entries.map(journalThesisClarityScore)) : 0;
    const reviewQuote = count ? journalReviewedEntries(entries).length / count * 100 : 0;
    const score = count ? Math.round(clamp(ruleAdherence * 0.3 + emotionalStability * 0.22 + thesisClarity * 0.28 + reviewQuote * 0.2, 0, 100)) : 0;
    const mistakes = journalMistakeStats(entries);
    const label = !count ? "Noch kein Journal" : score >= 75 ? "Disziplin wirkt stabil" : score >= 58 ? "Solide, aber verbesserbar" : "Entscheidungsprozess prüfen";
    const tone = score >= 75 ? "bull" : score >= 58 ? "neutral" : "bear";
    const summary = !count
      ? "Starte mit einem ersten Eintrag. Der Nutzen entsteht, wenn These, Gefühl, Regel-Check und spätere Reviews zusammenkommen."
      : score >= 75
        ? "Viele Einträge wirken geplant, nachvollziehbar und reviewfähig. Achte weiter auf wiederkehrende Fehlerklassen."
        : "Die Auswertung zeigt Verbesserungspotenzial bei Regeltreue, emotionalem Druck, These-Klarheit oder Review-Disziplin.";
    return {
      count,
      score,
      label,
      tone,
      summary,
      ruleAdherence,
      emotionalStability,
      thesisClarity,
      reviewQuote,
      topMistake: mistakes[0]?.label || ""
    };
  }

  function journalDecisionQualityScore(entry) {
    const rule = journalRuleScore(entry);
    const emotion = journalEmotionalStabilityScore(entry);
    const thesis = journalThesisClarityScore(entry);
    const review = journalReviewed(entry) ? 82 : 42;
    const score = Math.round(clamp(rule * 0.33 + emotion * 0.22 + thesis * 0.3 + review * 0.15, 0, 100));
    return {
      score,
      label: score >= 76 ? "Sauberer Prozess" : score >= 58 ? "Solide dokumentiert" : score >= 42 ? "Nacharbeit nötig" : "Disziplin prüfen",
      tone: score >= 76 ? "bull" : score >= 58 ? "neutral" : "bear"
    };
  }

  function journalRuleScore(entry) {
    const values = Object.values(entry.rule || {});
    if (!values.length) return 50;
    const score = values.reduce((sum, value) => sum + (value === "yes" ? 100 : value === "partial" ? 55 : 10), 0) / values.length;
    return clamp(score, 0, 100);
  }

  function journalRuleSummary(entry) {
    const score = journalRuleScore(entry);
    if (score >= 76) return { label: "Regelkonform", tone: "bull" };
    if (score >= 55) return { label: "Teilweise sauber", tone: "neutral" };
    return { label: "Regelbruch prüfen", tone: "bear" };
  }

  function journalEmotionalStabilityScore(entry) {
    const calmBase = {
      calm: 92,
      neutral: 78,
      convinced: 74,
      unsure: 58,
      fear: 45,
      stress: 38,
      fomo: 32,
      euphoria: 42,
      frustration: 36
    }[entry.emotion] || 60;
    const pressurePenalty = entry.pressure === "high" ? 12 : entry.pressure === "medium" ? 4 : 0;
    const intensityPenalty = ["fomo", "stress", "euphoria", "fear", "frustration"].includes(entry.emotion) ? Math.max(0, Number(entry.emotionStrength || 0) - 5) * 5 : 0;
    return clamp(calmBase - pressurePenalty - intensityPenalty, 0, 100);
  }

  function journalThesisClarityScore(entry) {
    let score = 0;
    if (entry.thesis.length >= 18) score += 30;
    if (entry.arguments.length) score += Math.min(entry.arguments.length, 3) * 10;
    if (entry.bullCase) score += 10;
    if (entry.bearCase) score += 10;
    if (entry.trigger) score += 10;
    if (entry.invalidation) score += 10;
    if (entry.horizon) score += 5;
    if (entry.target) score += 5;
    return clamp(score, 0, 100);
  }

  function journalReviewed(entry) {
    const review = entry.review || {};
    return Boolean(
      review.learning ||
      ["positive", "mixed", "negative"].includes(review.outcome) ||
      ["yes", "partial", "no"].includes(review.thesisWorked) ||
      ["yes", "partial", "no"].includes(review.repeat) ||
      ["strong", "ok", "weak"].includes(review.quality)
    );
  }

  function journalReviewedEntries(entries) {
    return entries.filter(journalReviewed);
  }

  function journalMistakeStats(entries) {
    const counts = new Map();
    entries.forEach((entry) => {
      entry.mistakes.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count, label: journalMistakeLabel(tag) }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  function journalBiasHints(entries) {
    if (!entries.length) {
      return [{ label: "Startpunkt", text: "Noch keine Muster vorhanden. Dokumentiere zuerst ein paar Entscheidungen mit Emotion und Regel-Check.", tone: "neutral" }];
    }
    const hints = [];
    const stats = journalStats(entries);
    const fomoStress = entries.filter((entry) => ["fomo", "stress", "euphoria"].includes(entry.emotion)).length;
    const ruleBreaks = entries.filter((entry) => journalRuleScore(entry) < 55).length;
    const calmEntries = entries.filter((entry) => ["calm", "neutral"].includes(entry.emotion));
    const emotionalEntries = entries.filter((entry) => ["fomo", "stress", "euphoria", "fear", "frustration"].includes(entry.emotion));
    if (fomoStress >= Math.max(2, entries.length * 0.28)) {
      hints.push({ label: "Emotion", text: "Mehrere Einträge zeigen FOMO, Stress oder Euphorie. Vor schnellen Entscheidungen hilft ein kurzer Regel-Check.", tone: "bear" });
    }
    if (ruleBreaks >= Math.max(2, entries.length * 0.25)) {
      hints.push({ label: "Regelbruch", text: "Regelverstöße häufen sich. Prüfe Positionsgröße, klaren Grund und ob die Entscheidung wirklich geplant war.", tone: "bear" });
    }
    if (stats.reviewQuote < 35 && entries.length >= 4) {
      hints.push({ label: "Review", text: "Viele Einträge sind noch nicht überprüft. Ohne Review bleibt schwer erkennbar, ob These oder Ergebnis zufällig war.", tone: "neutral" });
    }
    if (calmEntries.length && emotionalEntries.length) {
      const calmScore = average(calmEntries.map((entry) => journalDecisionQualityScore(entry).score));
      const emotionalScore = average(emotionalEntries.map((entry) => journalDecisionQualityScore(entry).score));
      if (calmScore > emotionalScore + 10) {
        hints.push({ label: "Muster", text: "Ruhige Entscheidungen wirken in deinen Einträgen strukturierter als emotionale Setups.", tone: "bull" });
      }
    }
    if (!hints.length) {
      hints.push({ label: "Stabil", text: "Noch kein auffälliges Bias-Muster. Sammle weiter Reviews, damit die Auswertung belastbarer wird.", tone: "bull" });
    }
    return hints.slice(0, 4);
  }

  function journalBestWorst(entries, mode) {
    const rows = entries.map((entry) => {
      const base = journalDecisionQualityScore(entry).score;
      const outcome = { positive: 12, mixed: 0, negative: -12, open: 0 }[entry.review?.outcome || "open"] || 0;
      const reviewQuality = { strong: 14, ok: 4, weak: -18, open: 0 }[entry.review?.quality || "open"] || 0;
      const score = Math.round(clamp(base + outcome + reviewQuality, 0, 120));
      const reason = journalReviewed(entry)
        ? `${journalReviewOutcomeLabel(entry.review.outcome)} · ${journalReviewQualityLabel(entry.review.quality)} · ${journalRuleSummary(entry).label}`
        : `${journalDecisionQualityScore(entry).label} · Review noch offen`;
      return { ...entry, score, reason, tone: score >= 75 ? "bull" : score >= 55 ? "neutral" : "bear" };
    });
    const sorted = rows.sort((a, b) => mode === "best" ? b.score - a.score : a.score - b.score);
    return sorted.slice(0, 5).map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  function journalMonthlyReview(entries) {
    const now = new Date();
    const current = entries.filter((entry) => {
      const date = new Date(entry.timestamp);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
    const rows = current.length ? current : entries.slice(0, 8);
    const count = rows.length;
    const stats = count ? journalStats(rows) : { ruleAdherence: 0, reviewQuote: 0 };
    const emotions = countBy(rows.map((entry) => journalEmotionLabel(entry.emotion)));
    const topEmotion = emotions[0]?.label || "offen";
    const mistakes = journalMistakeStats(rows);
    const learning = !count
      ? "Erster sinnvoller Schritt: eine Entscheidung mit These, Emotion und Regel-Check erfassen."
      : mistakes[0]
        ? `Nächster Fokus: ${mistakes[0].label} bewusst prüfen und vor der nächsten Entscheidung eine Gegenfrage notieren.`
        : "Weiter dokumentieren und mindestens einige Entscheidungen später reviewen.";
    return {
      title: current.length ? "Aktueller Monat" : "Letzte Einträge",
      count,
      ruleAdherence: stats.ruleAdherence || 0,
      reviewQuote: stats.reviewQuote || 0,
      topEmotion,
      summary: count ? `${count} dokumentierte Entscheidungen. Häufigste Emotion: ${topEmotion}.` : "Noch keine Journal-Daten für ein Monatsreview.",
      learning
    };
  }

  function journalDataMeta(entries) {
    const latest = entries[0]?.timestamp || BOOT_TIME;
    return makeMeta("Lokales Journal + Entscheidungslogik", "local", latest, "Einträge, Reviews und Muster bleiben lokal im Browser. Keine Betreiber-Konfiguration im Journal.");
  }

  function countBy(values) {
    const counts = new Map();
    values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }

  function average(values) {
    const numbers = values.map(Number).filter(Number.isFinite);
    return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
  }

  function uniqueList(values) {
    return [...new Set(values.map(String).filter(Boolean))];
  }

  function splitLines(value) {
    return String(value || "").split(/\r?\n|;/).map((item) => item.trim()).filter(Boolean).slice(0, 5);
  }

  function toDateTimeLocal(timestamp) {
    const date = new Date(timestamp || Date.now());
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function renderSelectOptions(options, selected) {
    return options.map((option) => `<option value="${escAttr(option.value)}" ${option.value === selected ? "selected" : ""}>${esc(option.label)}</option>`).join("");
  }

  function journalDecisionTypeLabel(value) {
    return JOURNAL_DECISION_TYPES.find((item) => item.value === value)?.label || "Beobachtung";
  }

  function journalCategoryLabel(value) {
    return JOURNAL_CATEGORIES.find((item) => item.value === value)?.label || "Langfrist-Investment";
  }

  function journalEmotionLabel(value) {
    return JOURNAL_EMOTIONS.find((item) => item.value === value)?.label || "Neutral";
  }

  function journalPressureLabel(value) {
    if (value === "high") return "hoch";
    if (value === "low") return "niedrig";
    return "mittel";
  }

  function journalMistakeLabel(value) {
    return JOURNAL_MISTAKE_TAGS.find((item) => item.value === value)?.label || value;
  }

  function journalReviewOutcomeLabel(value) {
    if (value === "positive") return "Ergebnis positiv";
    if (value === "negative") return "Ergebnis negativ";
    if (value === "mixed") return "Ergebnis gemischt";
    return "Ergebnis offen";
  }

  function journalReviewQualityLabel(value) {
    if (value === "strong") return "gute Entscheidung";
    if (value === "weak") return "schwacher Prozess";
    if (value === "ok") return "solide Entscheidung";
    return "Qualität offen";
  }

  function openReport(type, symbol = "") {
    closeReport();
    const html = buildReportHtml(type, symbol);
    document.body.classList.add("report-open");
    document.body.insertAdjacentHTML("beforeend", html);
    persistOnboarding({ ...state.onboarding, reportExported: true });
    recordActivity("Report", `${reportTypeLabel(type)} geoeffnet`, { route: "research", symbol });
    awardXp(type === "macro" ? "macro-report" : "first-report", type === "macro" ? 20 : 30, `${reportTypeLabel(type)} geoeffnet`);
  }

  function closeReport() {
    const existing = document.getElementById("reportOverlay");
    if (existing) {
      existing.remove();
    }
    document.body.classList.remove("report-open");
  }

  function buildReportHtml(type, symbol) {
    const config = reportConfig(type, symbol);
    const createdAt = new Date();
    return `
      <div class="report-overlay" id="reportOverlay">
        <div class="report-actions no-print">
          <button class="ghost-button" type="button" data-close-report>Zurück zum Modul</button>
          <button class="ghost-button" type="button" data-report="${escAttr(config.type)}" ${config.symbol ? `data-symbol="${escAttr(config.symbol)}"` : ""}>Report aktualisieren</button>
          <button class="primary-button" type="button" data-print-report>Als PDF speichern / Drucken</button>
        </div>
        <article class="report-page">
          <header class="report-header">
            <span>MH Analytics Research Export V2</span>
            <h1>${esc(config.title)}</h1>
            <p>${esc(config.context)} | Erstellt: ${esc(createdAt.toLocaleString("de-DE"))}</p>
          </header>
          ${config.body}
          <footer class="report-footer">
            ${reportDisclaimer()}
          </footer>
        </article>
      </div>
    `;
  }

  function reportConfig(type, symbol = "") {
    const normalized = normalizeSymbol(symbol || state.activeSymbol);
    const configs = {
      asset: {
        type: "asset",
        symbol: normalized,
        title: `${normalized} Research Report`,
        context: "Asset-Report mit 5-Minuten-Research, Chancen, Risiken, Triggern und Datenstatus",
        body: assetReportBody(normalized)
      },
      portfolio: {
        type: "portfolio",
        title: "Portfolio / Risiko / Exposure Report",
        context: "Portfolio-Report mit Risiko, Exposure, Rebalancing und What-if",
        body: portfolioReportBody()
      },
      etf: {
        type: "etf",
        title: "ETF Analyse Report",
        context: "ETF-Report mit Kosten, Overlap, Holdings, Regionen und Portfolio-Fit",
        body: etfReportBody()
      },
      macro: {
        type: "macro",
        title: "Makro- / Ländervergleich Report",
        context: "Makroampel, Ländervergleich, Risiken, Asset-Implikationen und Quellenstatus",
        body: macroReportBody()
      },
      dailyRecap: {
        type: "dailyRecap",
        title: "Tages-Recap Report",
        context: "Was heute wichtig war, was Watchlist und Events betrifft",
        body: dailyRecapReportBody()
      },
      watchlist: {
        type: "watchlist",
        title: "Watchlist Research Report",
        context: "Bewegungen, Events, Alerts und Research-Hinweise für beobachtete Werte",
        body: watchlistReportBody()
      },
      screener: {
        type: "screener",
        title: "Screener / Ratings V2 Report",
        context: "Transparenter Screener-Report mit Score-Komponenten, Filtern, Top-Kandidaten und Datenstatus",
        body: screenerReportBody()
      },
      topPicks: {
        type: "topPicks",
        title: "Top Picks Research Report",
        context: "Ranking-Report aus technischer, fundamentaler und lokaler Produktlogik",
        body: topPicksReportBody()
      }
    };
    return configs[type] || configs.asset;
  }

  function assetReportBody(symbol) {
    const asset = getAsset(symbol);
    const quote = quoteFor(symbol);
    const profile = profileFor(symbol);
    const fundamentals = fundamentalsFor(symbol);
    const news = newsFor(symbol);
    const sentiment = sentimentFor(symbol, quote, news);
    const technical = technicalFor(symbol, quote);
    const events = eventsForSymbol(symbol);
    const context = { symbol, asset, quote, profile, fundamentals, news, sentiment, technical, events };
    const snapshot = buildAssetResearchSnapshot(context);
    const etf = snapshot.etf;
    const dataRows = [
      { label: "Preis", meta: quote.meta },
      { label: "Profil", meta: profile.meta },
      { label: "Fundamentals", meta: fundamentals.meta },
      { label: "News", meta: news.meta },
      { label: "Events", meta: events[0]?.meta || makeMeta("Event-Kalender", "fallback", BOOT_TIME) }
    ];
    return `
      ${reportExecutiveSummary(snapshot.headline, snapshot.summary, snapshot.conclusion)}
      ${reportSection("Wichtigste Kennzahlen", reportMetricGrid([
        ["Asset", `${asset.symbol} · ${assetTypeLabel(asset)}`],
        ["Preis", formatMoney(quote.price, asset.currency)],
        ["Tagesbewegung", formatPercent(quote.changePct)],
        ["Research-Score", `${snapshot.score}/100`],
        ["Technik", snapshot.technical.label],
        etf ? ["TER", `${formatNumber(etf.ter)}%`] : ["KGV", formatNumber(valueOr(fundamentals.pe, asset.fallback.pe), "x")]
      ]))}
      ${reportSection("5-Minuten-Research", `
        <div class="report-two-column">
          <div>${reportMiniBlock("Asset-Charakter", snapshot.identity.character, snapshot.identity.text)}</div>
          <div>${reportMiniBlock("Bewertung / Struktur", snapshot.valuation.label, snapshot.valuation.text)}</div>
          <div>${reportMiniBlock("Technik", snapshot.technical.label, snapshot.technical.text)}</div>
          <div>${reportMiniBlock("Datenqualität", snapshot.dataQuality.label, snapshot.dataQuality.text)}</div>
        </div>
      `)}
      ${reportSection("Chancen", reportInsightList(snapshot.opportunities))}
      ${reportSection("Risiken", reportInsightList(snapshot.risks))}
      ${reportSection("Trigger / nächste Termine", reportTriggerList(snapshot.triggers))}
      ${etf ? reportEtfAssetAddendum(etf) : reportSection("News- und Event-Hinweise", reportNewsAndEvents(news, events))}
      ${reportDataStatusSection(dataRows)}
      ${reportSourceSection([
        "Quote/Profile/Fundamentals: Finnhub, Alpha Vantage oder Fallback je nach Status",
        "Events/Earnings: Event-Hub, Finnhub/Alpha-Vantage-Pfade oder lokaler Kalender",
        etf ? "ETF-Struktur: lokale ETF-V2-Datenbasis" : "Research-Snapshot: lokale Produktlogik plus verfügbare Marktinputs"
      ])}
    `;
  }

  function portfolioReportBody() {
    const portfolio = activePortfolio();
    const analysis = portfolioAnalysis(portfolio);
    const scenario = portfolioScenarioAnalysis(portfolio, analysis);
    return `
      ${reportExecutiveSummary(`${portfolio.name}: ${analysis.health.label}`, analysis.health.summary, analysis.priorityHint)}
      ${reportSection("Portfolio-Kontrollzentrum", reportMetricGrid([
        ["Typ", portfolio.type === "real" ? "Echtgeld" : "Testportfolio"],
        ["Gesamtwert", formatMoney(analysis.totalValue, "USD")],
        ["Performance", `${formatMoney(analysis.performanceAbs, "USD")} / ${formatPercent(analysis.performancePct)}`],
        ["Cash", `${formatMoney(analysis.cashValue, "USD")} (${formatNumber(analysis.cashPct)}%)`],
        ["Positionen", String(portfolio.positions.length)],
        ["Risiko-Level", `${analysis.riskLevel.label} · ${formatNumber(analysis.riskScore)}/100`]
      ]))}
      ${reportSection("Exposure", `
        <div class="report-two-column">
          ${reportExposureList("Sektor", analysis.sectorExposure)}
          ${reportExposureList("Land / Region", analysis.countryExposure)}
          ${reportExposureList("Währung", analysis.currencyExposure)}
          ${reportExposureList("Asset-Typ", analysis.assetTypeExposure)}
        </div>
      `)}
      ${reportSection("Größte Positionen", reportPositionRows(analysis.positions.slice(0, 8)))}
      ${reportSection("Risiko / Klumpenrisiko", reportInsightList(analysis.riskItems))}
      ${reportSection("Rebalancing-Hinweise", reportInsightList(analysis.rebalancingHints))}
      ${reportSection("Was ist jetzt wichtig?", reportInsightList(analysis.focusItems))}
      ${reportSection("What-if-Simulation", reportMetricGrid([
        ["Szenario-Wert", formatMoney(scenario.projectedValue, "USD")],
        ["Nach Schock", formatMoney(scenario.shockedValue, "USD")],
        ["12M mit Beitrag", formatMoney(scenario.oneYearValue, "USD")],
        ["Risiko-Veränderung", `${scenario.riskDelta >= 0 ? "+" : ""}${formatNumber(scenario.riskDelta)} Punkte`]
      ]) + `<p>${esc(scenario.summary)}</p>`)}
      ${reportDataStatusSection([{ label: "Portfolio", meta: analysis.meta }])}
      ${reportSourceSection([
        "Positionen, Cash, Notizen und Portfolio-Typ: lokal gespeichert",
        "Kurse und Bewegungen: vorhandene Quote-Pfade live/hybrid/fallback",
        "Risiko, Exposure, Rebalancing und What-if: lokale Produktlogik"
      ])}
    `;
  }

  function etfReportBody() {
    const etf = etfBySymbol(state.etf.left) || ETF_DATA[0];
    const compare = etfBySymbol(state.etf.right) || ETF_DATA[1];
    const overlap = etfOverlap(etf, compare);
    const overlapLevel = etfOverlapLevel(overlap);
    const amount = Number(state.etf.amount || 0);
    const monthly = Number(state.etf.monthly || 0);
    const years = Number(state.etf.years || 0);
    const returnRate = Number(state.etf.returnRate || 0);
    const cost = etfCostProjection(amount, monthly, years, etf.ter, returnRate);
    const compareCost = etfCostProjection(amount, monthly, years, compare.ter, returnRate);
    return `
      ${reportExecutiveSummary(`${etf.symbol}: ${etfPortfolioFitLabel(etf)}`, etf.useCase, `${etf.symbol} hat ${formatNumber(etf.ter)}% TER, ${formatNumber(etfHoldingConcentration(etf))}% Top-5-Konzentration und ${etfTopRegion(etf)?.[0] || "offene"} Regionenlast. ETF-Daten sind lokal/strukturiert, keine Live-Holdings.`)}
      ${reportSection("ETF-Kennzahlen", reportMetricGrid([
        ["Name", etf.name],
        ["Symbol / ISIN", `${etf.symbol}${etf.isin ? ` / ${etf.isin}` : ""}`],
        ["Einsatzbereich", etf.role || etf.useCase],
        ["TER", `${formatNumber(etf.ter)}%`],
        ["Ausschüttung", etf.distribution],
        ["Währung", `${etf.currency} / Fonds ${etf.fundCurrency || etf.currency}`]
      ]))}
      ${reportSection("Holdings-Analyse", `
        ${reportMetricGrid([
          ["Top-Holding", etf.holdings[0] ? `${etf.holdings[0][0]} ${formatNumber(etf.holdings[0][1])}%` : "nicht verfügbar"],
          ["Top-5", `${formatNumber(etfHoldingConcentration(etf))}%`],
          ["Top-10", `${formatNumber(etfTop10Concentration(etf))}%`],
          ["Konzentration", etfConcentrationLabel(etf)]
        ])}
        ${reportMiniBarList(etf.holdings)}
      `)}
      ${reportSection("Regionen und Sektoren", `
        <div class="report-two-column">
          ${reportExposureList("Regionen", etf.region.map(([label, value]) => ({ label, value })))}
          ${reportExposureList("Sektoren / Themen", (etf.sectors || []).map(([label, value]) => ({ label, value })))}
        </div>
      `)}
      ${reportSection("Ausschüttung, Währung und Struktur", reportMetricGrid([
        ["Ausschüttung", distributionExplanation(etf)],
        ["Domizil", etf.domicile || "nicht verfügbar"],
        ["Replikation", etf.replication || "nicht verfügbar"],
        ["Struktur", etf.structureType || "nicht verfügbar"],
        ["Währungsrisiko", etf.fxRisk || "nicht verfügbar"],
        ["Hinweis", "Keine Steuerberatung; Struktur und Steuern separat prüfen."]
      ]))}
      ${reportSection("Overlap mit Vergleichs-ETF", `
        ${reportMetricGrid([
          ["Vergleich", `${etf.symbol} vs ${compare.symbol}`],
          ["Holdings-Overlap", `${formatNumber(overlap.score)}%`],
          ["Regionen-Overlap", `${formatNumber(overlap.regionScore)}%`],
          ["Sektoren-Overlap", `${formatNumber(overlap.sectorScore)}%`],
          ["Einordnung", overlapLevel.label],
          ["TER-Differenz", `${formatNumber(Math.abs(etf.ter - compare.ter))}%`]
        ])}
        <p>${esc(etfOverlapText(overlap))}</p>
      `)}
      ${reportSection("Kostenrechner-Ergebnis", reportMetricGrid([
        ["Anlagebetrag", formatMoney(amount, etf.currency)],
        ["Sparplan", `${formatMoney(monthly, etf.currency)} / Monat`],
        ["Laufzeit", `${formatNumber(years)} Jahre`],
        ["Renditeannahme", `${formatNumber(returnRate)}% p.a.`],
        [`${etf.symbol} TER-Effekt`, formatMoney(cost.feeDrag, etf.currency)],
        [`${compare.symbol} TER-Effekt`, formatMoney(compareCost.feeDrag, compare.currency)]
      ]) + `<p>Simulation ohne Tracking Difference, Spreads und Steuern. TER-Effekt ist eine Näherung.</p>`)}
      ${reportSection("Portfolio-Fit", reportInsightList(etfPortfolioFitHints(etf)))}
      ${reportDataStatusSection([{ label: "ETF-Struktur", meta: etfDataMeta(etf) }, { label: "ETF-Overlap", meta: makeMeta("Lokaler ETF-Overlap V2", "local", BOOT_TIME) }])}
      ${reportSourceSection([
        "ETF-Struktur, TER, Holdings, Regionen und Sektoren: lokale ETF-V2-Datenbasis",
        "Kurse: vorhandene Quote-Pfade live/hybrid/fallback, falls Asset im Universum enthalten ist",
        "Kosten und Overlap: lokale Simulation und strukturierte Schätzung"
      ])}
    `;
  }

  function macroReportBody() {
    const snapshot = macroCountryComparisonForView();
    return `
      ${reportExecutiveSummary(`Makroampel: ${snapshot.control.label}`, snapshot.control.summary, snapshot.control.drivers.map((driver) => `${driver.label}: ${driver.text}`).join(" "))}
      ${reportSection("Makro-Kontrollzentrum", reportMetricGrid([
        ["Gesamtstatus", snapshot.control.label],
        ["Makro-Score", `${formatNumber(snapshot.control.score)} / 100`],
        ["Inflation", snapshot.control.tiles[0]?.value || "--"],
        ["Zinsen", snapshot.control.tiles[1]?.value || "--"],
        ["Wachstum", snapshot.control.tiles[2]?.value || "--"],
        ["Risikoampel", snapshot.control.tiles[5]?.value || "--"]
      ]))}
      ${reportSection("Ländervergleich", reportMacroCountryRows(snapshot.countries))}
      ${reportSection("Zinsen / Yield Curve / Realzins", reportInsightList(snapshot.countries.map((country) => ({
        label: `${country.name} · ${country.policyRate.display}`,
        text: `10Y ${country.yield10.display}, Realzins ${country.realRate.display}, 2Y-10Y ${country.yieldCurve.display}: ${country.yieldCurve.comment}.`
      }))))}
      ${reportSection("Wichtigste Makro-Risiken", reportInsightList(snapshot.control.drivers))}
      ${reportSection("Asset-Implikationen", reportInsightList(snapshot.assetImplications.map((item) => ({
        label: `${item.asset} · ${item.signal}`,
        text: item.text
      }))))}
      ${reportDataStatusSection(snapshot.sourceRows)}
      ${reportSourceSection([
        "FRED: Fed Funds, CPI/FRED-Fallback, Arbeitsmarkt, US-Renditen, Geldmenge und Dollarindex, serverseitig über /api/fred.",
        "BLS/Treasury: CPI/Arbeitsmarkt und Yield-Curve-Daten über /api/opendata.",
        "World Bank/IMF: Wachstum und Debt-to-GDP über Open-Data-Normalisierung, ergänzt durch lokale Länderstrukturwerte.",
        "ECB/Eurostat/OECD: Euro-Kontext eingeordnet; nicht jede Reihe ist bereits vollständig live integriert.",
        "FX/Frankfurter: EUR/USD, USD/JPY und USD/CNY über /api/fx, falls im Deployment erreichbar."
      ])}
    `;
  }

  function dailyRecapReportBody() {
    ensureHomeData();
    ensureEventData();
    const recap = dailyRecapForView();
    return `
      ${reportExecutiveSummary(`Tagesfazit: ${recap.conclusion.label}`, recap.conclusion.text, `Priorisierte Punkte: ${recap.priorityItems.length}. Watchlist-Hinweise: ${recap.watchlistItems.length}. Events heute: ${recap.todayEventCount}.`)}
      ${reportSection("Wichtigste Marktbewegungen", reportRecapMoveRows(recap.moves.slice(0, 8)))}
      ${reportSection("Wichtigste Events", reportEventRows(recap.events.slice(0, 8)))}
      ${reportSection("Was betrifft deine Watchlist?", reportRecapWatchlistRows(recap.watchlistItems.slice(0, 8)))}
      ${reportSection("News / Treiber", reportRecapNewsRows(recap.news.slice(0, 8)))}
      ${reportSection("Alerts / relevante Hinweise", reportAlertRows(recap.alerts.slice(0, 8)))}
      ${reportDataStatusSection([{ label: "Tages-Recap", meta: makeMeta("Daily-Recap: Watchlist + Events + Alerts + News", recap.status, Date.now(), "Relevanz wird lokal aus vorhandenen Daten priorisiert.") }])}
      ${reportSourceSection([
        "Marktbewegungen: Home-Ticker, Watchlist und vorhandene Quote-Pfade",
        "Events: Event-/Earnings-Hub mit Finnhub/Alpha-Vantage-Pfaden oder Fallback",
        "News und Alerts: vorhandene App-Daten plus lokale Priorisierung"
      ])}
    `;
  }

  function watchlistReportBody() {
    ensureHomeData();
    ensureEventData();
    const watchNews = watchlistNewsForView();
    const rows = state.watchlist.map((symbol) => {
      const asset = getAsset(symbol);
      const quote = quoteFor(symbol);
      const analysis = analysisFor(symbol);
      const events = eventsForSymbol(symbol).filter((eventItem) => eventItem.date >= startOfToday()).slice(0, 2);
      const alerts = state.alerts.map(normalizeAlertRecord).filter((alert) => alert.symbol === symbol && normalizeAlertStatus(alert) !== "done");
      return { symbol, asset, quote, analysis, events, alerts };
    });
    const status = bestDataStatus(rows.map((row) => row.quote.meta?.status));
    return `
      ${reportExecutiveSummary("Watchlist-Überblick", `${state.watchlist.length} beobachtete Werte mit Bewegungen, Events, Alerts und Research-Hinweisen.`, "Dieser Report dokumentiert, was bei den gespeicherten Werten gerade wichtig ist.")}
      ${reportSection("Watchlist-Kennzahlen", reportMetricGrid([
        ["Assets", String(state.watchlist.length)],
        ["Stärkste Bewegung", rows[0] ? strongestWatchlistMove(rows) : "nicht verfügbar"],
        ["Events", String(rows.reduce((sum, row) => sum + row.events.length, 0))],
        ["Aktive Alerts", String(rows.reduce((sum, row) => sum + row.alerts.length, 0))],
        ["Datenstatus", statusLabel(status)]
      ]))}
      ${reportSection("Beobachtete Assets", reportWatchlistRows(rows))}
      ${reportSection("Watchlist-News & Events", reportWatchNewsRows(watchNews.slice(0, 10)))}
      ${reportSection("Relevante Alerts", reportAlertRows(state.alerts.map(normalizeAlertRecord).filter((alert) => state.watchlist.includes(alert.symbol)).slice(0, 10)))}
      ${reportDataStatusSection(rows.map((row) => ({ label: row.symbol, meta: row.quote.meta })))}
      ${reportSourceSection([
        "Watchlist: lokal gespeichert",
        "Kurse und Bewegungen: vorhandene Quote-Pfade live/hybrid/fallback",
        "Events und Alerts: Event-Hub, Alerts V2 und lokale Statuslogik"
      ])}
    `;
  }

  function screenerReportBody() {
    ensureHomeData();
    ensureScreenerData();
    ensureEventData();
    const rows = screenerRowsForView();
    const filtered = filteredScreenerRows(rows);
    const summary = screenerSummary(rows, filtered);
    const picks = topPicksForView(rows);
    const filters = { ...SCREENER_DEFAULT_FILTERS, ...state.screener };
    return `
      ${reportExecutiveSummary("Screener / Ratings V2", `${filtered.length} von ${rows.length} Assets im aktuellen Filter. Der Score kombiniert Momentum, Value, Growth, Quality, Risiko, Event, Makro und Datenqualitaet.`, summary.comment.text)}
      ${reportSection("Screener-Kontrollzentrum", reportMetricGrid([
        ["Analysierte Assets", String(rows.length)],
        ["Gefiltert", String(filtered.length)],
        ["Long-Kandidaten", String(summary.longCount)],
        ["Watch-Kandidaten", String(summary.watchCount)],
        ["Risk-Kandidaten", String(summary.riskCount)],
        ["Datenstatus", statusLabel(summary.status)]
      ]))}
      ${reportSection("Aktive Filter", reportMetricGrid([
        ["Preset", filters.preset || "custom"],
        ["Asset-Typ", filters.assetType],
        ["Region", filters.region],
        ["Sektor", filters.sector],
        ["Stil", filters.style],
        ["Datenstatus", filters.dataStatus],
        ["Persoenlich", filters.personal],
        ["Sortierung", filters.sort]
      ]))}
      ${reportSection("Top-Ranking im aktuellen Filter", reportScreenerRows(filtered.slice(0, 10)))}
      ${reportSection("Long-Kandidaten", reportPickRows(picks.long))}
      ${reportSection("Watch-Kandidaten", reportPickRows(picks.watch))}
      ${reportSection("Risk-/Short-Kandidaten", reportPickRows(picks.risk))}
      ${reportSection("Watchlist / Favoriten", reportPickRows(picks.personal))}
      ${reportSection("Score-Modell V2", reportInsightList([
        { label: "Momentum", text: "Tagesbewegung, 1M-Performance, Trend, RSI, Aktivitaet und Ueberhitzung werden kombiniert." },
        { label: "Value / Growth / Quality", text: "Fundamentale Inputs werden genutzt, wenn vorhanden; fehlende Daten werden als eingeschraenkt markiert statt erfunden." },
        { label: "Risk", text: "Volatilitaet, Bewertungsdruck, Event-Risiko, Datenqualitaet und ETF-Konzentration erzeugen eine transparente Warnlogik." },
        { label: "Event / Makro", text: "Event-Hub und Makro-V2 liefern Kontext. Das ist Einordnung, keine Prognose und keine Anlageberatung." }
      ]))}
      ${reportDataStatusSection(rows.slice(0, 12).map((row) => ({ label: row.symbol, meta: makeMeta("Screener V2 Datenmix", row.dataStatus, Date.now(), row.explanation) })))}
      ${reportSourceSection([
        "Quotes/Profile/Fundamentals: vorhandene serverseitige /api/... Pfade oder Fallbacks.",
        "Technik und Scores: lokale, transparente Produktlogik mit Live-/Hybrid-/Fallback-Kennzeichnung.",
        "Events: Event-/Earnings-Hub; Makro: Makro-/Laendervergleich V2.",
        "Watchlist/Favoriten: lokale User Preferences und Watchlist-Daten."
      ])}
    `;
  }

  function topPicksReportBody() {
    const picks = topPicksForView();
    return `
      ${reportExecutiveSummary("Top Picks Research V2", "Die Picks kombinieren Momentum, Value, Growth, Quality, Risiko, Event-Kontext, Makro-Kontext und Datenqualitaet.", "Research-Werkzeug, keine Anlageberatung. Jeder Pick zeigt Gruende, Gegenpunkte und Datenstatus.")}
      ${reportSection("Long Picks", reportPickRows(picks.long))}
      ${reportSection("Watch Picks", reportPickRows(picks.watch))}
      ${reportSection("Risk Picks", reportPickRows(picks.risk))}
      ${reportSection("Watchlist / Favoriten", reportPickRows(picks.personal))}
      ${reportDataStatusSection([...picks.long, ...picks.watch, ...picks.risk, ...picks.personal].slice(0, 12).map((pick) => ({ label: pick.symbol, meta: makeMeta("Top Picks V2 Datenmix", pick.dataStatus, Date.now(), pick.explanation) })))}
      ${reportSourceSection(["Screener V2 Score-Komponenten: Momentum, Value, Growth, Quality, Risiko, Event, Makro und Datenqualitaet.", "Top Picks sind transparente Kandidatenlisten, keine Kauf-/Verkaufsempfehlungen."])}
    `;

    return `
      ${reportExecutiveSummary("Top Picks Research", "Die Picks kombinieren Technical Rating, Momentum, Value/Growth, Risiko, Sentiment und verfügbare Live-/Fallback-Daten.", "Research-Werkzeug, keine Anlageberatung. Scores bleiben lokale Produktlogik.")}
      ${reportSection("Long Picks", reportPickRows(picks.long))}
      ${reportSection("Risk Picks", reportPickRows(picks.risk))}
      ${reportDataStatusSection([{ label: "Top Picks", meta: makeMeta("Lokale Top Picks Engine", "fallback", Date.now()) }])}
      ${reportSourceSection(["Technik, Momentum, Value/Growth, Risiko und Sentiment: lokale Scoring-Logik plus vorhandene Dateninputs"])}
    `;
  }

  function reportExecutiveSummary(title, text, conclusion) {
    return `
      <section class="report-section report-executive-summary">
        <span class="report-kicker">Executive Summary</span>
        <h2>${esc(title)}</h2>
        <p>${esc(text)}</p>
        <div class="report-callout">
          <strong>Kurzfazit</strong>
          <p>${esc(conclusion)}</p>
        </div>
      </section>
    `;
  }

  function reportSection(title, content) {
    return `
      <section class="report-section">
        <h2>${esc(title)}</h2>
        ${content}
      </section>
    `;
  }

  function reportMetricGrid(items) {
    return `
      <div class="report-metric-grid">
        ${items.filter(Boolean).map(([label, value]) => `
          <div class="report-metric">
            <span>${esc(label)}</span>
            <strong>${esc(value ?? "nicht verfügbar")}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  function reportMiniBlock(label, title, text) {
    return `
      <div class="report-mini-block">
        <span>${esc(label)}</span>
        <strong>${esc(title)}</strong>
        <p>${esc(text)}</p>
      </div>
    `;
  }

  function reportInsightList(items = []) {
    return `
      <div class="report-list">
        ${items.map((item) => `
          <div class="report-list-item">
            <span>${esc(item.label || item.title || "Hinweis")}</span>
            <p>${esc(item.text || item.reason || item.summary || "")}</p>
          </div>
        `).join("") || `<p class="report-muted">Keine strukturierten Hinweise verfügbar.</p>`}
      </div>
    `;
  }

  function reportTriggerList(items = []) {
    return `
      <div class="report-list">
        ${items.map((item) => `
          <div class="report-list-item">
            <span>${esc(item.label || "Trigger")} · ${esc(statusLabel(item.status || "fallback"))}</span>
            <p><strong>${esc(item.title || "")}</strong> ${esc(item.text || "")}</p>
          </div>
        `).join("") || `<p class="report-muted">Keine Trigger im aktuellen Datenfenster.</p>`}
      </div>
    `;
  }

  function reportNewsAndEvents(news, events) {
    const newsRows = (news.items || []).slice(0, 4).map((item) => ({
      label: item.source || "News",
      text: `${item.headline} ${item.sentiment ? `(${item.sentiment})` : ""}`
    }));
    const eventRows = events.slice(0, 4).map((eventItem) => ({
      label: eventTypeLabel(eventItem),
      text: `${eventItem.title} · ${formatEventDate(eventItem.date)} · ${eventSourceLabel(eventItem)}`
    }));
    return reportInsightList([...newsRows, ...eventRows]);
  }

  function reportEtfAssetAddendum(etf) {
    return `
      ${reportSection("ETF-spezifische Struktur", reportMetricGrid([
        ["TER", `${formatNumber(etf.ter)}%`],
        ["Ausschüttung", etf.distribution],
        ["Top-Region", etfTopRegion(etf) ? `${etfTopRegion(etf)[0]} ${formatNumber(etfTopRegion(etf)[1])}%` : "nicht verfügbar"],
        ["Top-5", `${formatNumber(etfHoldingConcentration(etf))}%`],
        ["Fondswährung", etf.fundCurrency || etf.currency],
        ["Struktur", `${etf.structureType || "nicht verfügbar"} · ${etf.replication || "nicht verfügbar"}`]
      ]) + `<p>${esc(etf.fxRisk)} ${esc(etfPortfolioFitLabel(etf))}.</p>`)}
      ${reportSection("ETF-Holdings und Regionen", `
        <div class="report-two-column">
          ${reportExposureList("Top Holdings", etf.holdings.map(([label, value]) => ({ label, value })))}
          ${reportExposureList("Regionen", etf.region.map(([label, value]) => ({ label, value })))}
        </div>
      `)}
      ${reportSection("Portfolio-Fit-Hinweise", reportInsightList(etfPortfolioFitHints(etf)))}
    `;
  }

  function reportDataStatusSection(rows = []) {
    return reportSection("Datenstatus / Quellenqualität", `
      <div class="report-source-grid">
        ${rows.map((row) => {
          const meta = row.meta || makeMeta("Nicht verfügbar", "unknown", BOOT_TIME);
          return `
            <div class="report-source-item">
              <span>${esc(row.label)}</span>
              <strong>${esc(statusLabel(meta.status))}</strong>
              <p>${esc(meta.source || "Quelle offen")} · ${esc(formatTimestamp(meta.timestamp))}</p>
              ${meta.message ? `<small>${esc(meta.message)}</small>` : ""}
            </div>
          `;
        }).join("") || `<p class="report-muted">Kein Datenstatus verfügbar.</p>`}
      </div>
    `);
  }

  function reportSourceSection(items = []) {
    return reportSection("Quellen / verwendete Datenbereiche", `
      <ul class="report-source-list">
        ${items.map((item) => `<li>${esc(item)}</li>`).join("")}
      </ul>
    `);
  }

  function reportDisclaimer() {
    return `
      <strong>Disclaimer</strong>
      <p>Dieser Report ist keine Anlageberatung, keine persönliche Empfehlung und keine Aufforderung zum Kauf, Verkauf oder Halten von Wertpapieren. Daten können verzögert, unvollständig oder fehlerhaft sein. Live-, Hybrid-, Fallback- und lokale Datenstände sind zu beachten. Entscheidungen liegen ausschließlich beim Nutzer.</p>
    `;
  }

  function reportExposureList(title, items = []) {
    return `
      <div class="report-exposure">
        <h3>${esc(title)}</h3>
        ${items.slice(0, 8).map((item) => `
          <div class="report-bar-row">
            <span>${esc(item.label)}</span>
            <div><i style="width:${clamp(Number(item.value || 0), 0, 100)}%"></i></div>
            <strong>${formatNumber(item.value)}%</strong>
          </div>
        `).join("") || `<p class="report-muted">Keine Exposure-Daten verfügbar.</p>`}
      </div>
    `;
  }

  function reportMiniBarList(rows = []) {
    return `
      <div class="report-mini-bars">
        ${rows.slice(0, 10).map(([label, value]) => `
          <div class="report-bar-row">
            <span>${esc(label)}</span>
            <div><i style="width:${clamp(Number(value || 0), 0, 100)}%"></i></div>
            <strong>${formatNumber(value)}%</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  function reportPositionRows(rows = []) {
    return `
      <div class="report-table">
        <div class="report-table-row report-table-head"><span>Position</span><span>Gewicht</span><span>Performance</span><span>Hinweis</span></div>
        ${rows.map((row) => `
          <div class="report-table-row">
            <span><strong>${esc(row.symbol)}</strong><small>${esc(row.asset.name)}</small></span>
            <span>${formatNumber(row.weight)}%</span>
            <span>${formatPercent(row.performancePct)}</span>
            <span>${esc(row.riskHint?.text || row.role || "prüfen")}</span>
          </div>
        `).join("") || `<p class="report-muted">Keine Positionen vorhanden.</p>`}
      </div>
    `;
  }

  function reportMacroCountryRows(rows = []) {
    return `
      <div class="report-table macro-report-table">
        <div class="report-table-row report-table-head"><span>Region</span><span>Inflation</span><span>Realzins</span><span>Makrobild</span></div>
        ${rows.map((country) => `
          <div class="report-table-row">
            <span><strong>${esc(country.name)}</strong><small>BIP ${esc(country.gdp.display)} · Schulden ${esc(country.debt.display)}</small></span>
            <span>${esc(country.inflation.display)}<small>${esc(country.inflation.comment)}</small></span>
            <span>${esc(country.realRate.display)}<small>${esc(country.yieldCurve.comment)}</small></span>
            <span>${esc(country.risk.label)}<small>${esc(country.risk.summary)}</small></span>
          </div>
        `).join("") || `<p class="report-muted">Keine Makro-Länderwerte verfügbar.</p>`}
      </div>
    `;
  }

  function reportRecapMoveRows(rows = []) {
    return reportInsightList(rows.map((item) => ({
      label: `${item.symbol} · ${formatPercent(item.changePct)}`,
      text: `${item.name || item.symbol}: ${item.reason || recapRelevanceLabel(item.score)}`
    })));
  }

  function reportEventRows(rows = []) {
    return reportInsightList(rows.map((eventItem) => ({
      label: `${eventTypeLabel(eventItem)} · ${formatEventDate(eventItem.date)}`,
      text: `${eventItem.title} · ${eventSourceLabel(eventItem)} · ${statusLabel(eventItem.meta?.status || "fallback")}`
    })));
  }

  function reportRecapWatchlistRows(rows = []) {
    return reportInsightList(rows.map((item) => ({
      label: item.symbol || item.label || "Watchlist",
      text: item.text || item.title || item.reason || "Watchlist-Hinweis"
    })));
  }

  function reportRecapNewsRows(rows = []) {
    return reportInsightList(rows.map((item) => ({
      label: `${item.symbol || "News"} · Score ${Math.round(item.score || 0)}`,
      text: item.headline || item.text || "News-Hinweis"
    })));
  }

  function reportAlertRows(rows = []) {
    return reportInsightList(rows.map((alert) => {
      const normalized = normalizeAlertRecord(alert.alert || alert);
      return {
        label: `${normalized.symbol} · ${alertTypeLabel(normalized.type)} · ${priorityLabel(normalized.priority)}`,
        text: `${alertStatusLabel(normalized)} · ${alert.message || alertLabel(normalized)}`
      };
    }));
  }

  function reportWatchlistRows(rows = []) {
    return `
      <div class="report-table">
        <div class="report-table-row report-table-head"><span>Asset</span><span>Preis</span><span>Bewegung</span><span>Research-Hinweis</span></div>
        ${rows.map((row) => `
          <div class="report-table-row">
            <span><strong>${esc(row.symbol)}</strong><small>${esc(row.asset.name)}</small></span>
            <span>${formatMoney(row.quote.price, row.asset.currency)}</span>
            <span>${formatPercent(row.quote.changePct)}</span>
            <span>${esc(row.asset.thesis)}</span>
          </div>
        `).join("") || `<p class="report-muted">Keine Watchlist-Werte vorhanden.</p>`}
      </div>
    `;
  }

  function reportWatchNewsRows(rows = []) {
    return reportInsightList(rows.map((item) => ({
      label: `${item.symbol} · ${item.kind}`,
      text: item.text
    })));
  }

  function reportPickRows(rows = []) {
    return reportInsightList(rows.map((pick) => ({
      label: `${pick.symbol} - ${pick.pickLabel || pick.direction || "Kandidat"} - ${pick.score}%`,
      text: pick.explanation || pick.reason || pick.pickReason || ""
    })));

    return reportInsightList(rows.map((pick) => ({
      label: `${pick.symbol} · ${pick.score}%`,
      text: pick.reason
    })));
  }

  function reportScreenerRows(rows = []) {
    return `
      <div class="report-table">
        <div class="report-table-row report-table-head"><span>Asset</span><span>Score</span><span>Treiber</span><span>Daten</span></div>
        ${rows.map((row) => `
          <div class="report-table-row">
            <span><strong>${esc(row.symbol)}</strong><small>${esc(row.name)}</small></span>
            <span>${row.score}%</span>
            <span>${esc(row.explanation)}</span>
            <span>${esc(statusLabel(row.dataStatus))}</span>
          </div>
        `).join("") || `<p class="report-muted">Keine Screener-Treffer im aktuellen Filter.</p>`}
      </div>
    `;
  }

  function strongestWatchlistMove(rows = []) {
    const strongest = rows.slice().sort((a, b) => Math.abs(Number(b.quote.changePct || 0)) - Math.abs(Number(a.quote.changePct || 0)))[0];
    return strongest ? `${strongest.symbol} ${formatPercent(strongest.quote.changePct)}` : "nicht verfügbar";
  }

  function capitalize(value) {
    return String(value || "").slice(0, 1).toUpperCase() + String(value || "").slice(1);
  }

  function updateScreenerState(input) {
    const name = input.name;
    if (!name) {
      return;
    }
    state.screener = { ...SCREENER_DEFAULT_FILTERS, ...state.screener, [name]: input.value };
    if (name !== "preset") {
      state.screener.preset = "custom";
    }
    saveModuleDefault("screener", { ...state.screener });
    const target = document.getElementById("screenerResults");
    if (target) {
      const filtered = filteredScreenerRows();
      target.innerHTML = renderScreenerResults(filtered);
      const count = document.getElementById("screenerResultCount");
      if (count) {
        count.textContent = String(filtered.length);
      }
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
    return row.marketCapBucket === filter || (filter === "nonEquity" && row.type !== "Stock");
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
    if (sort === "momentum") {
      return next.sort((a, b) => b.momentumScore - a.momentumScore);
    }
    if (sort === "value") {
      return next.sort((a, b) => b.valueScore - a.valueScore);
    }
    if (sort === "growth") {
      return next.sort((a, b) => b.growthScore - a.growthScore);
    }
    if (sort === "quality") {
      return next.sort((a, b) => b.qualityScore - a.qualityScore);
    }
    if (sort === "risk") {
      return next.sort((a, b) => b.riskScore - a.riskScore);
    }
    if (sort === "event") {
      return next.sort((a, b) => b.eventScore - a.eventScore);
    }
    if (sort === "macro") {
      return next.sort((a, b) => b.macroScore - a.macroScore);
    }
    if (sort === "dataQuality") {
      return next.sort((a, b) => b.dataQualityScore - a.dataQualityScore);
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
    recordActivity("Alert", `${alert.symbol || alert.displaySymbol} ${alertTypeLabel(alert.type)} angelegt`, { route: "alerts", symbol: alert.symbol });
    awardXp("first-alert", 20, "Ersten Alert gesetzt");
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
    const favorites = dashboardPrefs().favorites.map(getAsset).filter(Boolean);
    if (!query) {
      return unique([...favorites.map((asset) => asset.symbol), ...state.recents])
        .map(getAsset)
        .filter(Boolean)
        .concat(ASSETS.filter((asset) => !favorites.some((fav) => fav.symbol === asset.symbol) && !state.recents.includes(asset.symbol)))
        .slice(0, 7);
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
    const favoriteBoost = isFavoriteSymbol(asset.symbol) ? -0.5 : 0;
    if (asset.symbol.toLowerCase() === q) {
      return favoriteBoost;
    }
    if (asset.symbol.toLowerCase().startsWith(q)) {
      return 1 + favoriteBoost;
    }
    if (asset.name.toLowerCase().startsWith(q)) {
      return 2 + favoriteBoost;
    }
    return 5 + favoriteBoost;
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
    recordActivity("Watchlist", `${symbol} hinzugefuegt`, { route: "portfolio", symbol });
    awardXp("first-watchlist", 20, "Watchlist erstellt");
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

  function providerHttpMessage(response, bodyText, data, providerId = "") {
    const apiMessage = extractProviderErrorMessage(data, bodyText);
    if (apiMessage) {
      const prefix = providerId === "fred" ? "FRED API meldet" : "Provider meldet";
      return `HTTP ${response.status}: ${prefix}: ${apiMessage}`;
    }
    const body = String(bodyText || "").slice(0, 220);
    if (response.status === 401 || response.status === 403) {
      return `HTTP ${response.status}: Serverseitiger Zugriff nicht erlaubt.`;
    }
    if (response.status === 429) {
      return "Rate Limit erreicht. Bitte später erneut versuchen.";
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
      return "Fallback";
    }
    if (status === "missing") {
      return "Unbekannt";
    }
    if (status === "prepared") {
      return "Unbekannt";
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
      return "Unbekannt";
    }
    if (status === "disabled") {
      return "Offline";
    }
    if (status === "error") {
      return "Offline";
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
      [
        "mh.apiKeys.v1",
        "mh.apiKeys.v2",
        "mh.providerKeys.v1",
        "mh.providerKeys.v2",
        "mh.providerTests.v1"
      ].forEach((key) => localStorage.removeItem(key));
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
    const ranks = { live: 6, stale: 5, hybrid: 4, local: 3, fallback: 2, prepared: 2, mapped: 2, notUsed: 1, missing: 1, unknown: 1, error: 0, offline: 0 };
    return ranks[status || ""] ?? 0;
  }

  function bestDataStatus(statuses) {
    return statuses.filter(Boolean).sort((a, b) => statusRank(b) - statusRank(a))[0] || "fallback";
  }

  function combinedDataStatus(statuses) {
    const clean = statuses.filter(Boolean);
    if (!clean.length) {
      return "fallback";
    }
    const hasLive = clean.some((status) => status === "live" || status === "stale");
    const hasFallback = clean.some((status) => ["fallback", "local", "prepared", "mapped", "notUsed", "missing", "unknown"].includes(status));
    const hasError = clean.some((status) => status === "error" || status === "offline");
    if (hasLive && hasFallback) {
      return "hybrid";
    }
    if (hasLive) {
      return clean.includes("stale") && !clean.includes("live") ? "stale" : "live";
    }
    if (hasError && !hasFallback) {
      return "error";
    }
    if (clean.includes("local")) {
      return "local";
    }
    return "fallback";
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
