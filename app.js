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
    apiKeys: "mh.apiKeys.v2",
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
    { id: "usMacro", label: "Makro USA" },
    { id: "euroMacro", label: "Makro Europa" },
    { id: "rates", label: "Zinsen / Yield Curve" },
    { id: "filings", label: "Filings / Fundamentals" },
    { id: "energy", label: "Energie / Rohstoffe" },
    { id: "globalMacro", label: "Globale Länderdaten" }
  ];

  const PROVIDERS = [
    {
      id: "finnhub",
      name: "Finnhub",
      group: "market",
      categories: ["Market Data", "News", "Events / Earnings"],
      status: "active",
      keyMode: "required",
      security: "backend-recommended",
      description: "Aktien-Quotes, Firmenprofile, Company News, Basic Financials und Earnings/Events.",
      usage: "Primärquelle im Datenlayer für Aktien, News und Earnings. Live-Status entsteht erst nach erfolgreichem Abruf.",
      testHint: "Testet AAPL Quote über Finnhub.",
      testRequest: (key) => ({ url: `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(key)}`, responseType: "json" }),
      validateTest: validateFinnhubQuote
    },
    {
      id: "alphaVantage",
      name: "Alpha Vantage",
      group: "alpha",
      categories: ["FX", "Rohstoffe", "Indikatoren", "Fallback"],
      status: "active",
      keyMode: "required",
      security: "backend-recommended",
      description: "FX, Rohstoffe, technische Indikatoren, IPO-/Earnings-Zusatz und optionaler Aktienkurs-Fallback.",
      usage: "Eigener Zuständigkeitsbereich für FX/Rohstoffe/Indikatoren; bei Aktien als Fallback nach Finnhub.",
      testHint: "Testet GLOBAL_QUOTE für AAPL.",
      testRequest: (key) => ({ url: `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${encodeURIComponent(key)}`, responseType: "json" }),
      validateTest: validateAlphaVantageQuote
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
      keyMode: "required",
      security: "browser-ok-private",
      description: "US-Makrodaten wie Fed Funds, CPI, Arbeitslosenquote, Geldmengen, Zinsserien und Spreads.",
      usage: "Zuständig für US-Makro und Geldmengen. Der Test erzwingt JSON, weil FRED sonst XML liefert.",
      testHint: "Isolierter Minimaltest: /fred/series/updates mit file_type=json.",
      testRequest: buildFredMinimalTestRequest,
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
      status: "optional",
      keyMode: "optional",
      security: "proxy-recommended",
      description: "Krypto-Preise für BTC/ETH. Public/Demo nutzbar; produktionsnah besser mit Key oder Proxy.",
      usage: "Optionaler Krypto-Prototyp, nicht Kernbestandteil des öffentlichen Provider-Stacks.",
      testHint: "Testet Public/Demo Simple Price für Bitcoin.",
      testUrl: () => "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
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
      status: "mapped",
      keyMode: "none",
      security: "browser-ok-public",
      description: "Offizielle Open-Data-Quelle für US-Arbeitsmarkt, CPI und Labor-Daten.",
      usage: "Kein Key nötig. Wird als Open-Data-Ergänzung für CPI und Arbeitsmarkt genutzt, besonders wenn FRED fehlt oder als Plausibilitätsquelle.",
      testHint: "Open-Data-Test: Latest CPI-Serie.",
      testRequest: () => ({ url: "https://api.bls.gov/publicAPI/v2/timeseries/data/CUSR0000SA0?latest=true", responseType: "json" }),
      validateTest: validateBlsSeries
    },
    {
      id: "treasury",
      name: "U.S. Treasury Fiscal Data",
      group: "rates",
      categories: ["Yield Curve", "Treasury Rates", "Zinsstruktur"],
      status: "mapped",
      keyMode: "none",
      security: "browser-ok-public",
      description: "Offizielle Open-Data-Quelle für Treasury-Rates, Yield Curve und Zinsstruktur.",
      usage: "Kein Key nötig. Wird für 10Y-Rendite und 2Y-10Y-Zinskurve als offizielle Open-Data-Ergänzung genutzt.",
      testHint: "Open-Data-Test: Treasury Average Interest Rates.",
      testRequest: () => ({ url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=1", responseType: "json" }),
      validateTest: validateFiscalData
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
      status: "mapped",
      keyMode: "required",
      security: "browser-ok-private",
      description: "Offizielle Energiequelle für Öl, Gas, Strom und Energiemarktdaten.",
      usage: "Key nötig. Wird für Öl/Energie als offizieller Datenpfad genutzt, sobald ein erfolgreicher EIA-Abruf vorliegt.",
      testHint: "Browser-Test: EIA APIv2 Root-Metadaten mit API-Key.",
      testRequest: (key) => ({ url: `https://api.eia.gov/v2/?api_key=${encodeURIComponent(key)}`, responseType: "json" }),
      validateTest: validateEiaResponse
    },
    {
      id: "worldBank",
      name: "World Bank",
      group: "globalMacro",
      categories: ["Länderprofile", "Globale Makro"],
      status: "mapped",
      keyMode: "none",
      security: "browser-ok-public",
      description: "Open-Data-Quelle für globale Länder-, Entwicklungs- und Strukturdaten.",
      usage: "Kein Key nötig. Wird im Makro-Dashboard für globale BIP-/Ländervergleiche genutzt, wenn der Browserabruf erfolgreich ist.",
      testHint: "Open-Data-Test: US GDP-Indikator im JSON-Format.",
      testRequest: () => ({ url: "https://api.worldbank.org/v2/country/US/indicator/NY.GDP.MKTP.CD?format=json&per_page=1", responseType: "json" }),
      validateTest: validateWorldBankResponse
    },
    {
      id: "imf",
      name: "IMF DataMapper",
      group: "globalMacro",
      categories: ["Internationale Makro", "Länder"],
      status: "mapped",
      keyMode: "none",
      security: "browser-ok-public",
      description: "Offizielle internationale Makroergänzung über IMF DataMapper und IMF APIs.",
      usage: "Kein Key nötig für DataMapper. Ergänzt globale Makrovergleiche, wenn der Browserabruf erfolgreich ist; World Bank bleibt der stabilere Primärpfad.",
      testHint: "Open-Data-Test: IMF DataMapper Real GDP Growth USA.",
      testRequest: () => ({ url: "https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH/USA", responseType: "json" }),
      validateTest: validateImfResponse
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
    }
  ];

  const DEFAULT_WATCHLIST = ["NVDA", "MSFT", "AAPL", "SPY", "BTC"];
  const HOME_TICKER = ["SPY", "QQQ", "DAX", "NVDA", "MSFT", "AAPL", "BTC", "ETH", "GOLD"];
  const PUBLIC_PROVIDER_IDS = ["finnhub", "alphaVantage", "fred", "ecb", "bls", "treasury", "sec", "eia", "worldBank", "imf", "oecd"];
  const REMOVED_PUBLIC_PROVIDER_IDS = ["newsApi", "gnews", "fmp", "twelveData", "coincap", "eodhd", "marketaux", "exchangeRateApi", "openExchangeRates", "metalsApi", "reddit", "brevo", "supabase", "finnhubNews"];
  const OPTIONAL_INTERNAL_PROVIDER_IDS = ["coingecko"];
  const PRIORITY_PROVIDER_IDS = ["finnhub", "alphaVantage", "fred", "ecb", "bls", "treasury", "sec", "eia", "worldBank", "imf", "oecd"];
  const DATA_HEALTH_PROVIDER_IDS = [
    "finnhub",
    "alphaVantage",
    "fred",
    "ecb",
    "bls",
    "treasury",
    "sec",
    "eia",
    "worldBank",
    "imf",
    "oecd"
  ];

  const PROVIDER_MODULE_USAGE = {
    finnhub: ["Aktien-Quotes", "Unternehmensprofile", "Company News", "Earnings Calendar", "Asset-Seiten"],
    alphaVantage: ["Quote-Fallback", "FX", "Rohstoffe", "technische Indikatoren", "IPO/Earnings-Zusatz"],
    fred: ["US-Makro", "Fed Funds", "CPI/Inflation", "Arbeitslosenquote", "Geldmengen/Zinsen"],
    ecb: ["Eurozone", "EZB-Zinsen", "EUR-FX", "Euro-Makro"],
    bls: ["CPI", "Arbeitsmarkt", "US-Labor"],
    treasury: ["Yield Curve", "Treasury Rates", "Zinsstruktur"],
    sec: ["Filings", "Submissions", "XBRL", "Fundamentaldatenbasis"],
    eia: ["Energie", "Öl", "Gas", "Rohstoffdaten"],
    worldBank: ["Länderprofile", "globale Makrodaten", "Strukturdaten"],
    imf: ["internationale Makroergänzung", "Ländervergleiche"],
    oecd: ["OECD-Vergleiche", "Wirtschaftsstruktur"]
  };

  const API_ONBOARDING_GUIDE = [
    {
      providerId: "finnhub",
      title: "1. Finnhub zuerst",
      text: "Primärquelle für Aktien-Quotes, Profile, Company News und Earnings. Das ist der wichtigste Key für den öffentlichen Start."
    },
    {
      providerId: "alphaVantage",
      title: "2. Alpha Vantage als Zusatz",
      text: "Quote-Fallback, FX, Rohstoffe, technische Indikatoren sowie IPO-/Earnings-Zusatz. Nicht Primärprovider für Aktien."
    },
    {
      providerId: "fred",
      title: "3. FRED für US-Makro",
      text: "Fed Funds, CPI, Arbeitslosenquote, Geldmengen, Zinsserien und Spreads. Der Test erzwingt JSON."
    },
    {
      providerId: "eia",
      title: "4. EIA für Energie",
      text: "Offizielle Quelle für Öl, Gas und Energiedaten. Key nötig, aber klar auf Energie begrenzt."
    },
    {
      providerId: "worldBank",
      title: "5. Open Data Quellen",
      text: "ECB, BLS, Treasury, SEC, World Bank, IMF und OECD brauchen keine API-Key-Felder. Sie werden nach Aufgaben zugeordnet."
    }
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
      coverage: "Earnings Calendar, Company News und Asset-Termine über denselben Finnhub-Key",
      source: "Finnhub API Slot"
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
      coverage: "Earnings, Dividenden, Splits und Makrotermine bleiben ohne Key sichtbar",
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
    { title: "Bitcoin Network / ETF Flow Check", dateOffset: 15, type: "Krypto", symbol: "BTC", detail: "ETF-Flows und Liquidität bleiben kurzfristige Kurstreiber." },
    { title: "SPY Ex-Dividend Reminder", dateOffset: 42, type: "Dividende", symbol: "SPY", detail: "ETF-spezifischer Dividenden-Termin als lokaler Fallback." },
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
    apiKeys: storageGet(STORAGE_KEYS.apiKeys, {}),
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
      window: "week"
    },
    alertFilter: "all",
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
      contribution: 500
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

    const saveKeys = event.target.closest("[data-save-api-keys]");
    if (saveKeys) {
      saveApiKeys();
      return;
    }

    const deleteProviderKey = event.target.closest("[data-delete-provider-key]");
    if (deleteProviderKey) {
      deleteProviderKeyById(deleteProviderKey.dataset.deleteProviderKey);
      return;
    }

    const testProviderButton = event.target.closest("[data-test-provider]");
    if (testProviderButton) {
      testProviderById(testProviderButton.dataset.testProvider);
      return;
    }

    const testAllProvidersButton = event.target.closest("[data-test-all-providers]");
    if (testAllProvidersButton) {
      testConfiguredProviders();
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

    const alertDone = event.target.closest("[data-alert-done]");
    if (alertDone) {
      markAlertDone(alertDone.dataset.alertDone);
      return;
    }

    const alertSnooze = event.target.closest("[data-alert-snooze]");
    if (alertSnooze) {
      snoozeAlert(alertSnooze.dataset.alertSnooze);
      return;
    }

    const alertFilter = event.target.closest("[data-alert-filter]");
    if (alertFilter) {
      state.alertFilter = alertFilter.dataset.alertFilter || "all";
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

    const scenarioInput = event.target.closest("[data-portfolio-scenario]");
    if (scenarioInput) {
      updatePortfolioScenario(scenarioInput);
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

    const scenarioInput = event.target.closest("[data-portfolio-scenario]");
    if (scenarioInput) {
      updatePortfolioScenario(scenarioInput);
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
            <button class="ghost-button" type="button" data-route="settings">API Keys eintragen</button>
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
                  <span class="pill">${esc(eventItem.type)}</span>
                  <span><strong>${esc(eventItem.title)}</strong><small>${eventItem.date.toLocaleDateString("de-DE")} | ${esc(eventItem.symbol)}</small></span>
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
      <section class="section compact-section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Tages-Recap</p>
            <h2>Was habe ich heute verpasst?</h2>
            <p>Ein kurzer Rückblick aus Marktbewegungen, Watchlist-Hinweisen, News und Events. Live-Daten werden genutzt, Fallbacks bleiben sichtbar.</p>
          </div>
          <button class="ghost-button" type="button" data-route="events">Event-Hub öffnen</button>
        </div>
        <div class="grid four recap-grid">
          <article class="card">
            <span class="card-label">Marktbewegungen</span>
            <div class="stack-list">
              ${recap.moves.map((item) => `
                <button class="brief-row" type="button" data-symbol="${escAttr(item.symbol)}">
                  <span><strong>${esc(item.symbol)}</strong><small>${esc(item.name)}</small></span>
                  <span class="${toneClass(item.changePct)}">${formatPercent(item.changePct)}</span>
                </button>
              `).join("") || renderEmptyState("Keine größeren Bewegungen geladen.")}
            </div>
          </article>
          <article class="card">
            <span class="card-label">Wichtige News</span>
            <div class="stack-list">
              ${recap.news.map((item) => `
                <button class="brief-event-row" type="button" data-symbol="${escAttr(item.symbol)}">
                  <span class="pill">${esc(item.symbol)}</span>
                  <span><strong>${esc(item.headline)}</strong><small>${esc(item.source)} | ${esc(item.sentiment)}</small></span>
                </button>
              `).join("") || renderEmptyState("Keine News im aktuellen Feed.")}
            </div>
          </article>
          <article class="card">
            <span class="card-label">Events</span>
            <div class="stack-list">
              ${recap.events.map((eventItem) => `
                <button class="brief-event-row" type="button" ${assetMap.has(eventItem.symbol) ? `data-symbol="${escAttr(eventItem.symbol)}"` : ""}>
                  <span class="pill">${esc(eventItem.type)}</span>
                  <span><strong>${esc(eventItem.title)}</strong><small>${eventItem.date.toLocaleDateString("de-DE")} | ${esc(eventItem.symbol)}</small></span>
                </button>
              `).join("") || renderEmptyState("Keine heutigen Termine.")}
            </div>
          </article>
          <article class="card">
            <span class="card-label">Watchlist</span>
            <h3>${esc(recap.watchlistTone.label)}</h3>
            <p>${esc(recap.watchlistTone.text)}</p>
            <div class="metric-grid">
              ${renderMiniMetric("Hinweise", String(recap.watchlistItems.length))}
              ${renderMiniMetric("Alerts offen", String(state.alerts.filter((alert) => normalizeAlertStatus(alert) === "open").length))}
            </div>
          </article>
        </div>
      </section>
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

  function renderQuickCompareSection() {
    const leftSymbol = assetMap.has(state.compare.left) ? state.compare.left : "NVDA";
    const rightSymbol = assetMap.has(state.compare.right) ? state.compare.right : "MSFT";
    ensureAssetData(leftSymbol);
    ensureAssetData(rightSymbol);
    return `
      <section class="section compact-section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Quick Compare</p>
            <h2>Zwei Assets direkt vergleichen</h2>
            <p>Preis, Tagesbewegung, Market Cap, KGV, Sektor, Rating, Chancen und Risiken nebeneinander. Für Aktien und ETFs nutzbar.</p>
          </div>
          ${renderDataMeta(makeMeta("Hybrid: Finnhub, Alpha Vantage, lokale Heuristik", compareStatusFor(leftSymbol, rightSymbol), Date.now()), true)}
        </div>
        <article class="card compare-card">
          <div class="form-grid compare-controls">
            <label class="field">
              <span>Asset A</span>
              <select data-compare-control name="left">${compareOptions(leftSymbol)}</select>
            </label>
            <label class="field">
              <span>Asset B</span>
              <select data-compare-control name="right">${compareOptions(rightSymbol)}</select>
            </label>
          </div>
          <div class="grid two compare-grid">
            ${renderCompareAssetCard(leftSymbol)}
            ${renderCompareAssetCard(rightSymbol)}
          </div>
          ${renderCompareVerdict(leftSymbol, rightSymbol)}
        </article>
      </section>
    `;
  }

  function compareOptions(selected) {
    return ASSETS
      .filter((asset) => ["Stock", "ETF", "Index", "Commodity", "Crypto"].includes(asset.type))
      .map((asset) => `<option value="${escAttr(asset.symbol)}" ${selected === asset.symbol ? "selected" : ""}>${esc(asset.symbol)} - ${esc(asset.name)}</option>`)
      .join("");
  }

  function renderCompareAssetCard(symbol) {
    const asset = getAsset(symbol);
    const quote = quoteFor(symbol);
    const profile = profileFor(symbol);
    const fundamentals = fundamentalsFor(symbol);
    const technical = technicalFor(symbol, quote);
    return `
      <div class="compare-asset-panel">
        <div class="card-topline">
          <div>
            <span class="card-label">${esc(asset.type)}</span>
            <h3>${esc(symbol)} <small>${esc(profile.name || asset.name)}</small></h3>
          </div>
          <span class="score-pill ${technical.tone}">${esc(technical.rating)}</span>
        </div>
        <div class="metric-grid">
          ${renderMiniMetric("Preis", formatMoney(quote.price, asset.currency))}
          ${renderMiniMetric("Heute", formatPercent(quote.changePct))}
          ${renderMiniMetric("Market Cap", formatCompactMoney(valueOr(profile.marketCap, fundamentals.marketCap), asset.currency))}
          ${renderMiniMetric("KGV", formatNumber(valueOr(fundamentals.pe, asset.fallback.pe), "x"))}
          ${renderMiniMetric("Sektor", profile.sector || asset.sector)}
          ${renderMiniMetric("Rating", `${technical.probability}%`)}
        </div>
        <div class="grid two">
          <div class="insight-row"><span class="pill">Chance</span><p>${esc(asset.thesis)}</p></div>
          <div class="insight-row"><span class="pill">Risiko</span><p>${esc(asset.risks)}</p></div>
        </div>
        ${renderDataMeta(quote.meta)}
      </div>
    `;
  }

  function renderCompareVerdict(leftSymbol, rightSymbol) {
    const left = snapshotFor(leftSymbol);
    const right = snapshotFor(rightSymbol);
    const winner = left.score === right.score ? null : left.score > right.score ? left : right;
    const text = winner
      ? `${winner.symbol} hat im aktuellen Hybrid-Score den stärkeren Mix aus Rating, Momentum, Value/Growth und Datenlage.`
      : "Beide Assets liegen im aktuellen Hybrid-Score nahezu gleichauf. Der Zweck im Portfolio entscheidet.";
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
      quoteFor(rightSymbol).meta.status,
      profileFor(rightSymbol).meta.status,
      fundamentalsFor(rightSymbol).meta.status
    ];
    return bestDataStatus(statuses);
  }

  function renderMacroSection() {
    const macro = macroForView();
    const liquidity = liquidityNarrativeForView();
    return `
      <section class="section">
        <div class="section-head">
          <div>
            <h2>Makro-Schnellblick</h2>
            <p>FRED-Daten, wenn ein Key hinterlegt ist. Ohne Key bleibt die Seite stabil mit klar markierten Fallback-Werten.</p>
          </div>
          <button class="ghost-button" type="button" data-route="settings">FRED-Key setzen</button>
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
          <button class="ghost-button" type="button" data-route="portfolio">Verwalten</button>
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
            <p>Filtere ein erweitertes Universum mit ${ASSETS.length} Assets nach Momentum, Value, Growth, Market Cap, Sektor und Performance. Der Screener nutzt Finnhub-Quotes/Profile/Fundamentals und Alpha-Vantage-Zeitreihen, sobald Keys vorhanden sind; die Heuristik bleibt stabil hybrid.</p>
          </div>
          <button class="ghost-button" type="button" data-screener-reset>Filter zurücksetzen</button>
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
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Event- / Earnings-Hub</p>
            <h1>Termine, Earnings, IPOs und Watchlist-Ereignisse.</h1>
            <p>Events sind klar zugeordnet: Finnhub liefert Earnings, Alpha Vantage ergänzt Earnings- und IPO-Kalender als CSV-Livepfad, SEC/EDGAR bleibt die offizielle Filings-Basis. Dividenden, Splits und Makrotermine bleiben lokal transparent abgesichert.</p>
          </div>
        </div>
        ${renderEventProviderPanel()}
        ${renderEventHubFilters(events)}
        <div class="grid two">
          <article class="card">
            <div class="card-topline">
              <div>
                <span class="card-label">Gefilterte Termine</span>
                <h3>${filtered.length} Events</h3>
              </div>
              ${renderStatusBadge(eventStatus)}
            </div>
            <div class="event-list">
              ${filtered.map(renderEventCard).join("") || renderEmptyState("Keine Termine für diesen Filter. Zeitraum oder Typ erweitern.")}
            </div>
          </article>
          <article class="card">
            <div class="card-topline">
              <div>
                <span class="card-label">Watchlist-Relevanz</span>
                <h3>Was betrifft dich direkt?</h3>
              </div>
              ${renderStatusBadge(eventStatus)}
            </div>
            <div class="event-list">
              ${events.filter(isWatchlistRelevantEvent).slice(0, 8).map(renderEventCard).join("") || renderEmptyState("Keine Watchlist-relevanten Termine im aktuellen Fenster.")}
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
    return `
      <article class="card event-filter-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Filter</span>
            <h3>Typ und Zeitraum</h3>
          </div>
          ${renderDataMeta(makeMeta("Event-Hub Filter", bestDataStatus(events.map((eventItem) => eventItem.meta.status)), Date.now()), true)}
        </div>
        <div class="chip-row">
          ${typeFilters.map(([value, label, count]) => `<button class="chip ${state.eventHub.type === value ? "active" : ""}" type="button" data-event-filter="${escAttr(value)}">${esc(label)} ${count}</button>`).join("")}
        </div>
        <div class="chip-row">
          ${windowFilters.map(([value, label]) => `<button class="chip ${state.eventHub.window === value ? "active" : ""}" type="button" data-event-window="${escAttr(value)}">${esc(label)}</button>`).join("")}
        </div>
      </article>
    `;
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
            <p>FRED-Daten werden genutzt, wenn ein Key vorhanden ist. ECB, BLS, Treasury und lokale Fallbacks ergänzen das Bild für Zinsen, Geldmengen, Realzins und Yield Curve.</p>
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
        ${renderDataMeta(makeMeta("Lokaler ETF-Overlap-Fallback", "fallback", BOOT_TIME))}
      </article>
    `;
  }

  function renderAlertsPage() {
    ensureHomeData();
    checkAlerts(false);
    const filteredAlerts = alertsForView();
    const inbox = alertInboxForView();
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Alerts V2</p>
            <h1>Lokale Signale mit Priorität, Status und Snooze.</h1>
            <p>Preis-, Watchlist-, Sentiment- und Event-Hinweise bleiben vollständig lokal im Browser. Neu: offen/ausgelöst/erledigt, Priorität, Snooze und Historie.</p>
          </div>
          <button class="ghost-button" type="button" data-alert-check>Jetzt prüfen</button>
        </div>
        <div class="grid two">
          <article class="card">
            <h3>Alert anlegen</h3>
            <form class="alert-form" data-alert-form>
              <label class="field">
                <span>Asset</span>
                <select name="symbol">
                  ${ASSETS.map((asset) => `<option value="${escAttr(asset.symbol)}">${esc(asset.symbol)} - ${esc(asset.name)}</option>`).join("")}
                </select>
              </label>
              <label class="field">
                <span>Typ</span>
                <select name="type">
                  <option value="price">Preis-Alert</option>
                  <option value="watchlist">Watchlist-Alert</option>
                  <option value="sentiment">News-/Sentiment-Hinweis</option>
                  <option value="earnings">Earnings-Reminder</option>
                  <option value="event">Event-Hinweis</option>
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
                <input name="target" type="number" step="0.01" placeholder="z. B. 900 oder 3">
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
            <p class="small">Preis-Alerts prüfen Kurslevel. Watchlist-, Sentiment- und Event-Hinweise nutzen lokal verfügbare Kurs-, News- und Kalenderdaten.</p>
          </article>
          <article class="card">
            <div class="card-topline">
              <div>
                <span class="card-label">Alert Inbox</span>
                <h3>${inbox.length} Hinweise</h3>
              </div>
              <button class="ghost-button" type="button" data-alert-clear-inbox>Leeren</button>
            </div>
            <div class="stack-list">
              ${inbox.slice(0, 8).map((item) => `
                <div class="alert-inbox-row">
                  <div>
                    <strong>${esc(item.title)}</strong>
                    <span class="small">${esc(item.message)} | ${formatTimestamp(item.timestamp)}</span>
                  </div>
                  <span class="pill ${item.priority === "high" ? "bear" : item.priority === "low" ? "neutral" : ""}">${esc(priorityLabel(item.priority))}</span>
                </div>
              `).join("") || renderEmptyState("Noch keine Hinweise. Alerts prüfen sich lokal anhand der verfügbaren Daten.")}
            </div>
            <div class="metric-grid">
              ${renderMiniMetric("Offen", String(state.alerts.filter((alert) => normalizeAlertStatus(alert) === "open").length))}
              ${renderMiniMetric("Ausgelöst", String(state.alerts.filter((alert) => normalizeAlertStatus(alert) === "triggered").length))}
              ${renderMiniMetric("Erledigt", String(state.alerts.filter((alert) => normalizeAlertStatus(alert) === "done").length))}
            </div>
          </article>
        </div>
      </section>
      <section class="section">
        <article class="card">
          <div class="card-topline">
            <div>
              <span class="card-label">Gespeicherte Alerts</span>
              <h3>${filteredAlerts.length} Regeln im Filter</h3>
            </div>
            ${renderDataMeta(makeMeta("Lokaler Browser-Speicher", "live", Date.now()), true)}
          </div>
          ${renderAlertFilters()}
          <div class="alert-list">
            ${filteredAlerts.map(renderAlertRow).join("") || renderEmptyState("Keine Alerts in diesem Filter.")}
          </div>
        </article>
      </section>
    `;
  }

  function renderAlertFilters() {
    const filters = [
      ["all", "Alle"],
      ["price", "Preis"],
      ["earnings", "Earnings"],
      ["event", "Event"],
      ["watchlist", "Watchlist"]
    ];
    return `
      <div class="chip-row alert-filter-row">
        ${filters.map(([value, label]) => `<button class="chip ${state.alertFilter === value ? "active" : ""}" type="button" data-alert-filter="${escAttr(value)}">${esc(label)}</button>`).join("")}
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

    ensureAssetData(symbol);
    ensureEventData();

    app.innerHTML = `
      <section class="asset-hero">
        <div class="asset-main">
          <p class="eyebrow">Einzelaktien-Seite</p>
          <h1>${esc(symbol)} <span>${esc(profile.name || asset.name)}</span></h1>
          <p>${esc(asset.thesis)}</p>
          <div class="asset-actions">
            <button class="primary-button" type="button" data-watch-add="${escAttr(symbol)}">Zur Watchlist</button>
            <button class="ghost-button" type="button" data-favorite-symbol="${escAttr(symbol)}">${isFavoriteSymbol(symbol) ? "Favorit entfernen" : "Favorit"}</button>
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

      ${renderAssetTabContent(activeTab, { symbol, asset, quote, profile, fundamentals, news, sentiment, technical, events })}
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
      <section class="section">
        ${renderAssetResearchSnapshot(context)}
      </section>
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

  function renderAssetResearchSnapshot(context) {
    const { symbol, asset, quote, fundamentals, news, sentiment, technical, events } = context;
    const fundamental = fundamentalInterpretation(asset, fundamentals);
    const nextEvent = events[0];
    return `
      <article class="card asset-research-snapshot">
        <div class="card-topline">
          <div>
            <span class="card-label">5-Minuten-Analyse</span>
            <h3>${esc(symbol)} Mini-Research-Seite</h3>
            <p>Preis, Chart, Technik, Fundamentales, News, Events, Chancen und Risiken in einem Ablauf.</p>
          </div>
          ${renderDataMeta(makeMeta("Lokale Research-Zusammenfassung", quote.meta.status, Date.now()), true)}
        </div>
        <div class="grid four">
          <div class="snapshot-tile">
            <span>Technisch</span>
            <strong class="${technical.tone}">${esc(technical.rating)} ${technical.probability}%</strong>
            <p>${esc(technical.reason)}</p>
          </div>
          <div class="snapshot-tile">
            <span>Fundamental</span>
            <strong>${esc(fundamental.label)}</strong>
            <p>${esc(fundamental.text)}</p>
          </div>
          <div class="snapshot-tile">
            <span>News / Sentiment</span>
            <strong>${esc(sentiment.label)} ${sentiment.score}</strong>
            <p>${esc(news.items[0]?.headline || "Keine aktuelle Meldung im Feed.")}</p>
          </div>
          <div class="snapshot-tile">
            <span>Nächster Trigger</span>
            <strong>${esc(nextEvent ? nextEvent.type : "Watchlist")}</strong>
            <p>${esc(nextEvent ? `${nextEvent.title} am ${nextEvent.date.toLocaleDateString("de-DE")}` : "Kein Event im lokalen Kalender.")}</p>
          </div>
        </div>
        <div class="grid two">
          <div class="insight-row"><span class="pill">Chance</span><p>${esc(asset.thesis)}</p></div>
          <div class="insight-row"><span class="pill">Risiko</span><p>${esc(asset.risks)}</p></div>
        </div>
      </article>
    `;
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

    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Portfolio Analyse 2C</p>
            <h1>Lokale Portfolios mit Exposure und Rebalancing.</h1>
            <p>Mehrere Echtgeld- und Testportfolios laufen lokal im Browser. Cash, Sektor-, Land- und Währungs-Exposure werden transparent berechnet.</p>
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
        <div class="grid two">
          <article class="card">
            <div class="card-topline">
              <div>
                <span class="card-label">${portfolio.type === "real" ? "Echtgeld" : "Testportfolio"}</span>
                <h3>${esc(portfolio.name)}</h3>
              </div>
              ${renderDataMeta(makeMeta("Lokaler Portfolio-Speicher", "live", Date.now()), true)}
            </div>
            <div class="metric-grid">
              ${renderMiniMetric("Gesamtwert", formatMoney(analysis.totalValue, "USD"))}
              ${renderMiniMetric("Performance", `${formatMoney(analysis.performanceAbs, "USD")} / ${formatPercent(analysis.performancePct)}`)}
              ${renderMiniMetric("Cash", `${formatMoney(portfolio.cash, "USD")} (${formatNumber(analysis.cashPct)}%)`)}
              ${renderMiniMetric("Positionen", String(portfolio.positions.length))}
              ${renderMiniMetric("Risiko-Score", `${formatNumber(analysis.riskScore)} / 100`)}
            </div>
            <div class="insight-row"><span class="pill">Klarblick</span><p>${esc(analysis.priorityHint)}</p></div>
            <div class="portfolio-positions">
              ${portfolio.positions.map((position) => renderPortfolioPosition(position)).join("") || renderEmptyState("Noch kein Portfolio angelegt oder keine Positionen vorhanden.")}
            </div>
          </article>
          <article class="card">
            <h3>Exposure & Hinweise</h3>
            ${renderExposureBlock("Sektor", analysis.sectorExposure)}
            ${renderExposureBlock("Land", analysis.countryExposure)}
            ${renderExposureBlock("Währung", analysis.currencyExposure)}
            <div class="insight-row"><span class="pill">Klumpenrisiko</span><p>${esc(analysis.concentrationHint)}</p></div>
            <div class="insight-row"><span class="pill">Diversifikation</span><p>${esc(analysis.diversificationHint)}</p></div>
            <div class="insight-row"><span class="pill">Rebalancing</span><p>${esc(analysis.rebalanceHint)}</p></div>
            <div class="insight-row"><span class="pill">Priorität</span><p>${esc(analysis.priorityHint)}</p></div>
            ${renderDataMeta(makeMeta("Lokale Portfolio Engine", "live", Date.now()))}
          </article>
        </div>
      </section>
      <section class="section">
        <div class="grid two">
          <article class="card">
            <h3>Portfolio anlegen</h3>
            <form class="form-grid" data-portfolio-form>
              <label class="field"><span>Name</span><input name="name" placeholder="z. B. Dividenden Depot"></label>
              <label class="field"><span>Typ</span><select name="type"><option value="real">Echtgeld</option><option value="test">Testportfolio</option></select></label>
              <label class="field"><span>Cash</span><input name="cash" type="number" placeholder="5000"></label>
              <button class="primary-button" type="submit">Portfolio speichern</button>
            </form>
          </article>
          <article class="card">
            <h3>Position hinzufügen</h3>
            <form class="form-grid" data-position-form>
              <label class="field"><span>Symbol</span><input name="symbol" placeholder="NVDA"></label>
              <label class="field"><span>Anzahl</span><input name="quantity" type="number" step="0.0001"></label>
              <label class="field"><span>Kaufkurs</span><input name="avgPrice" type="number" step="0.01"></label>
              <button class="primary-button" type="submit">Position speichern</button>
            </form>
          </article>
        </div>
      </section>
      <section class="section">
        <div class="grid two">
          <article class="card">
            <h3>Was-wäre-wenn Simulation</h3>
            <div class="form-grid">
              <label class="field"><span>Marktschock %</span><input data-portfolio-scenario name="shock" type="number" value="${escAttr(state.portfolioScenario.shock)}"></label>
              <label class="field"><span>Monatlicher Beitrag</span><input data-portfolio-scenario name="contribution" type="number" value="${escAttr(state.portfolioScenario.contribution)}"></label>
            </div>
            ${renderScenarioResult(analysis)}
          </article>
          <article class="card">
            <h3>Portfolio-Kommentare</h3>
            <form data-portfolio-notes-form>
              <label class="field"><span>Notiz / These</span><textarea name="notes">${esc(portfolio.notes || "")}</textarea></label>
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
    const keys = { ...state.apiKeys };
    const publicProviders = visibleProviders();
    const keyBasedCount = publicProviders.filter((provider) => provider.keyMode !== "none").length;
    const openDataCount = publicProviders.filter((provider) => provider.keyMode === "none").length;
    const browserCriticalCount = publicProviders.filter((provider) => provider.security === "browser-critical").length;
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Data Providers / API Keys</p>
            <h1>Öffentlicher Kernstack für MH Analytics.</h1>
            <p>Die aktive Provider-Seite zeigt nur noch die elf sinnvollen Kernquellen für den öffentlichen Start. Alte Free-Plan- oder Backend-only-Slots werden hier nicht mehr als Pflichtanbieter beworben.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-test-all-providers>Konfigurierte testen</button>
            <button class="ghost-button" type="button" data-clear-cache>Daten-Cache leeren</button>
            <button class="ghost-button" type="button" data-route="data-health">Data Health öffnen</button>
          </div>
        </div>
        <div class="provider-summary-grid">
          ${renderProviderSummary("Kernquellen", publicProviders.length, "Aktive öffentliche Providerliste")}
          ${renderProviderSummary("Key-basiert", keyBasedCount, "Finnhub, Alpha Vantage, FRED, EIA")}
          ${renderProviderSummary("Open Data", openDataCount, "Kein Key-Feld nötig")}
          ${renderProviderSummary("Browserkritisch", browserCriticalCount, "Nicht als Live-Frontendquelle versprechen")}
        </div>
        ${renderApiOnboardingGuide()}
        ${renderProviderHealthPreview()}
        <article class="card provider-warning-card">
          <div>
            <h3>Browser-sicher vs. Backend</h3>
            <p>Für private lokale Tests ist localStorage okay. Produktiv gehören geheime Provider-Keys in ein Backend, Proxy oder Edge Functions. Service-Role-Keys niemals im Browser speichern.</p>
          </div>
          ${renderDataMeta(makeMeta("Lokaler Browser-Speicher", "live", BOOT_TIME), true)}
        </article>
      </section>
      <section class="section">
        ${PROVIDER_GROUPS.map((group) => renderProviderGroup(group, keys)).join("")}
      </section>
      <section class="section">
        <article class="card">
          <div class="card-topline">
            <div>
              <span class="card-label">Provider-Konfiguration</span>
              <h3>Alle API Keys speichern</h3>
            </div>
            ${renderStatusBadge(getConfiguredProviderCount() ? "fallback" : "missing")}
          </div>
          <p>Die aktiven Key-Felder sind bewusst begrenzt: Finnhub, Alpha Vantage, FRED und EIA. Open-Data-Quellen erhalten kein sinnloses Key-Feld und werden erst nach echtem Abruf als live markiert.</p>
          <div class="card-actions settings-actions">
            <button class="primary-button" type="button" data-save-api-keys>Alle API Keys speichern</button>
            <button class="ghost-button" type="button" data-test-all-providers>Konfigurierte Provider testen</button>
          </div>
        </article>
      </section>
    `;
  }

  function renderDataHealthPage() {
    ensureHomeData();
    ensureEventData();
    const summary = providerHealthSummary();
    const rows = DATA_HEALTH_PROVIDER_IDS
      .map(providerById)
      .filter(Boolean);
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Data Health</p>
            <h1>Provider, Fallbacks und Live-Abrufe im Blick.</h1>
            <p>Dieses Dashboard zeigt transparent, welche Datenquellen aktiv genutzt werden, wo Keys fehlen und welche Module gerade mit Fallbacks arbeiten.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-test-all-providers>Konfigurierte testen</button>
            <button class="ghost-button" type="button" data-route="settings">API Keys verwalten</button>
          </div>
        </div>
        <div class="provider-summary-grid">
          ${renderProviderSummary("Live erfolgreich", summary.live, "Provider mit erfolgreichem Abruf")}
          ${renderProviderSummary("Fallback/Vorbereitet", summary.fallback, "Sicherheitsnetz oder Slot")}
          ${renderProviderSummary("Veralteter Cache", summary.stale, "Cache statt frischer API")}
          ${renderProviderSummary("Fehler/fehlend", summary.error + summary.missing, "Handlungsbedarf")}
        </div>
        ${renderDataHealthSourcesOverview()}
        <article class="card">
          <div class="card-topline">
            <div>
              <span class="card-label">Provider Health Matrix</span>
              <h3>Welche Quelle bedient welches Modul?</h3>
            </div>
            ${renderDataMeta(makeMeta("Lokaler Provider-Health-Status", getOverallDataStatus(), Date.now()), true)}
          </div>
          <div class="health-table">
            ${rows.map(renderProviderHealthRow).join("")}
          </div>
        </article>
      </section>
    `;
  }

  function renderDataHealthSourcesOverview() {
    const rows = dataHealthModuleRows();
    return `
      <article class="card data-health-overview-card">
        <div class="card-topline">
          <div>
            <span class="card-label">Quellenübersicht</span>
            <h3>Module, Provider und Datenstatus</h3>
          </div>
          ${renderDataMeta(makeMeta("Lokale Quellenmatrix + Provider Health", getOverallDataStatus(), Date.now()), true)}
        </div>
        <p>Diese Übersicht trennt bewusst Live-Daten, Fallback-Daten und Hybrid-Logik. Ein Modul wird nur als live markiert, wenn mindestens eine zugeordnete Quelle in dieser Sitzung erfolgreich geliefert hat.</p>
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
            <span class="card-label">${esc(row.mode)}</span>
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
          <span><strong>Letzter Abruf:</strong> ${esc(formatTimestamp(row.timestamp))}</span>
          <span><strong>Status:</strong> ${esc(row.statusText)}</span>
        </div>
      </div>
    `;
  }

  function dataHealthModuleRows() {
    return [
      dataHealthModuleRow("Screener", ["finnhub", "alphaVantage"], "Hybrid", "Quotes und Profile kommen bevorzugt live; Scoring bleibt Produktlogik mit Fallback-Sicherheitsnetz."),
      dataHealthModuleRow("Asset-Seiten", ["finnhub", "sec", "alphaVantage"], "Hybrid", "Preis, Profil, News und Events nutzen Live-Daten, sofern verfügbar; Research-Snapshot bleibt kuratiert."),
      dataHealthModuleRow("Events / Earnings", ["finnhub", "alphaVantage"], "Live/Fallback", "Earnings und IPOs werden providerbasiert geladen; lokaler Kalender bleibt Backup."),
      dataHealthModuleRow("Makro / Geldmengen", ["fred", "bls", "treasury"], "Live/Fallback", "US-Makro, Geldmengen, CPI, Arbeitsmarkt und Renditen laufen über offizielle Quellen mit Fallback."),
      dataHealthModuleRow("Euro-Makro", ["ecb"], "Open Data", "ECB ist als offene Quelle ohne Key vorgesehen und wird nur nach erfolgreichem Abruf live gezählt."),
      dataHealthModuleRow("Energie / Rohstoffe / FX", ["eia", "alphaVantage"], "Live/Fallback", "EIA liefert Energiedaten, Alpha Vantage ergänzt Rohstoffe und Währungen."),
      dataHealthModuleRow("Globale Länderdaten", ["worldBank", "imf", "oecd"], "Open Data", "World Bank ist Primärpfad; IMF/OECD sind ergänzende offene Makroquellen."),
      dataHealthModuleRow("Portfolio / Journal / Reports", ["finnhub"], "Hybrid", "Nutzer- und App-Logik bleibt lokal; Marktdaten werden soweit möglich aus Live-Quotes gespeist.")
    ];
  }

  function dataHealthModuleRow(moduleName, providerIds, mode, note) {
    const healthItems = providerIds.map(providerHealthFor);
    const statuses = healthItems.map((health) => health.status);
    const status = aggregateHealthStatus(statuses);
    const timestamp = Math.max(...healthItems.map((health) => Number(health.lastSuccess || health.timestamp || BOOT_TIME)), BOOT_TIME);
    return {
      module: moduleName,
      providers: providerIds,
      mode,
      note,
      status,
      timestamp,
      statusText: moduleStatusText(statuses)
    };
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
      return "Für mindestens eine Key-Quelle fehlt noch ein Key.";
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
      missing: "Key fehlt",
      error: "Fehler",
      disabled: "deaktiviert"
    };
    return labels[status] || status || "unklar";
  }

  function renderProviderHealthRow(provider) {
    const health = providerHealthFor(provider.id);
    const test = providerTestFor(provider.id);
    const keyState = providerKeyState(provider);
    const modules = PROVIDER_MODULE_USAGE[provider.id] || provider.categories;
    const lastSuccess = health.lastSuccess ? formatTimestamp(health.lastSuccess) : "Noch kein erfolgreicher Live-Abruf";
    return `
      <div class="health-row">
        <div>
          <span class="card-label">${esc(provider.categories.join(" / "))}</span>
          <strong>${esc(provider.name)}</strong>
          <p>${esc(provider.description)}</p>
        </div>
        <div class="provider-readiness">
          ${renderProviderKeyBadge(keyState)}
          ${renderProviderTestBadge(test)}
          ${renderProviderLiveBadge(health)}
        </div>
        <div class="module-chip-row">
          ${modules.map((moduleName) => `<span class="module-chip">${esc(moduleName)}</span>`).join("")}
        </div>
        <div class="data-health-meta">
          <span><strong>Letzter Erfolg:</strong> ${esc(lastSuccess)}</span>
          <span><strong>Status:</strong> ${esc(health.message || "Noch keine Abrufhistorie.")}</span>
          <span><strong>Letzter Check:</strong> ${esc(formatTimestamp(health.timestamp))}</span>
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

  function renderApiOnboardingGuide() {
    return `
      <article class="card api-onboarding-card">
        <div class="card-topline">
          <div>
            <span class="card-label">API-Key Einstieg</span>
            <h3>Welche Keys lohnen sich zuerst?</h3>
          </div>
          ${renderStatusBadge(getConfiguredProviderCount() ? "fallback" : "missing")}
        </div>
        <p>MH Analytics funktioniert ohne Keys mit Fallback-Daten. Diese Reihenfolge hilft Anfängern, schnell sichtbare Verbesserungen zu bekommen.</p>
        <div class="onboarding-steps">
          ${API_ONBOARDING_GUIDE.map((item) => {
            const provider = providerById(item.providerId);
            const keyState = providerKeyState(provider);
            return `
              <div class="onboarding-step">
                <strong>${esc(item.title)}</strong>
                <p>${esc(item.text)}</p>
                <div class="chip-row">
                  <span class="pill">${esc(provider ? provider.name : item.providerId)}</span>
                  ${renderProviderKeyBadge(keyState)}
                  ${renderProviderLiveBadge(providerHealthFor(item.providerId))}
                </div>
              </div>
            `;
          }).join("")}
        </div>
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

  function renderProviderGroup(group, keys) {
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
          ${providers.map((provider) => renderProviderCard(provider, providerKeyValue(provider.id, keys))).join("")}
        </div>
      </div>
    `;
  }

  function renderProviderCard(provider, keyValue) {
    const test = providerTestFor(provider.id);
    const security = providerSecurityLabel(provider.security);
    const keyState = providerKeyState(provider);
    const health = providerHealthFor(provider.id);
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
          ${renderProviderKeyBadge(keyState)}
          ${renderProviderTestBadge(test)}
          ${renderProviderLiveBadge(health)}
        </div>
        <div class="provider-module-row">
          ${(PROVIDER_MODULE_USAGE[provider.id] || provider.categories).map((moduleName) => `<span class="module-chip">${esc(moduleName)}</span>`).join("")}
        </div>
        <div class="provider-key-row">
          ${renderProviderKeyField(provider, keyValue)}
        </div>
        <div class="provider-test-row">
          <span class="provider-test-status ${test.className}">${esc(test.label)}</span>
          <span class="small">${esc(test.message || provider.testHint)}</span>
        </div>
        ${renderProviderDebugDetails(provider, test)}
        <div class="card-actions provider-actions">
          <button class="ghost-button" type="button" data-test-provider="${escAttr(provider.id)}">Testen</button>
          ${provider.keyMode !== "none" ? `<button class="ghost-button" type="button" data-delete-provider-key="${escAttr(provider.id)}">Key löschen</button>` : ""}
        </div>
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
    const rows = [
      ["Codepfad", details.codePath],
      ["Endpoint", details.endpoint],
      ["HTTP-Methode", details.method],
      ["Pfad", details.path],
      ["Seiten-Origin", details.pageOrigin],
      ["Browser online", details.browserOnline],
      ["api_key gesetzt", details.apiKeyParamPresent ? "ja" : "nein"],
      ["file_type", details.fileTypeJson ? "json gesetzt" : `nicht json (${details.fileType || "fehlt"})`],
      ["Key im Feld", keyShapeText(details.inputKey)],
      ["Key gespeichert", keyShapeText(details.savedKey)],
      ["Key aus Storage", keyShapeText(details.storageKey)],
      ["Key gesendet", keyShapeText(details.sentKey)],
      ["Gespeichert = gesendet", details.savedEqualsSent ? "ja" : "nein"],
      ["Storage = gespeichert", details.storageEqualsSaved ? "ja" : "nein"],
      ["Stage", details.stage],
      ["HTTP-Status", details.httpStatus],
      ["Content-Type", details.contentType],
      ["Response-Format", details.responseFormat],
      ["Parsing", details.parseStatus],
      ["Browser-Fetch-Fehler", details.browserFetchError || "kein Browser-Fetch-Fehler"],
      ["FRED-Fehler", details.fredError || "kein FRED-error_message Feld"]
    ];
    return `
      <details class="provider-debug">
        <summary>FRED Diagnose anzeigen</summary>
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

  function keyShapeText(shape) {
    if (!shape) {
      return "nicht verfügbar";
    }
    return `${shape.mask}; roh ${shape.rawLength}, getrimmt ${shape.trimmedLength}; trim ${shape.trimChanged ? "ja" : "nein"}; Whitespace ${shape.hasWhitespace ? "ja" : "nein"}; 32 Kleinbuchstaben/Zahlen ${shape.lowercaseAlnum32 ? "ja" : "nein"}`;
  }

  function renderProviderKeyField(provider, keyValue) {
    if (provider.keyMode === "none") {
      return `
        <div class="keyless-provider">
          <span class="pill">Kein Key nötig</span>
          <span class="small">Offizielle Open-Data-Quelle. Kein API-Key-Feld erforderlich.</span>
        </div>
      `;
    }
    const placeholder = provider.keyMode === "optional" ? "Optionaler API Key / Demo Key" : provider.keyMode === "oauth" ? "OAuth Client/Token später via Backend" : provider.keyMode === "anon" ? "Anon/Public Key oder URL" : `${provider.name} API Key`;
    return `
      <label class="field provider-field">
        <span>${esc(keyModeLabel(provider.keyMode))}</span>
        <input data-api-key="${escAttr(provider.id)}" type="password" value="${escAttr(keyValue)}" placeholder="${escAttr(placeholder)}">
      </label>
    `;
  }

  function providersByStatus(status) {
    return visibleProviders().filter((provider) => provider.status === status);
  }

  function providersBySecurity(security) {
    return visibleProviders().filter((provider) => provider.security === security);
  }

  function getConfiguredProviderCount() {
    return visibleProviders().filter((provider) => provider.keyMode !== "none" && cleanKey(providerKeyValue(provider.id))).length;
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
    return cleanKey(providerKeyValue(provider.id)) ? "present" : "missing";
  }

  function providerKeyValue(providerId, keySource = state.apiKeys) {
    if (providerId === "finnhubNews") {
      return keySource.finnhubNews || keySource.finnhub || "";
    }
    return keySource[providerId] || "";
  }

  function renderProviderKeyBadge(stateName) {
    const labels = {
      none: "Kein Key nötig",
      present: "Key vorhanden",
      missing: "Key fehlt"
    };
    const status = stateName === "present" || stateName === "none" ? "fallback" : "missing";
    return `<span class="status-badge status-${status}">${esc(labels[stateName] || "Key unklar")}</span>`;
  }

  function renderProviderTestBadge(test) {
    const status = test.className === "test-ok" ? "live" : test.className === "test-error" ? "missing" : "fallback";
    return `<span class="status-badge status-${status}">${esc(test.label)}</span>`;
  }

  function renderProviderLiveBadge(health) {
    const status = health.status || "notUsed";
    const labels = {
      live: "Aktuell live genutzt",
      stale: "Cache veraltet",
      fallback: "Fallback aktiv",
      prepared: "Zugeordnet",
      mapped: "Zugeordnet",
      notUsed: "Aktuell nicht genutzt",
      missing: "Key fehlt",
      error: "Live-Abruf fehlgeschlagen",
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
    if (provider.keyMode !== "none" && !cleanKey(providerKeyValue(providerId)) && provider.keyMode !== "optional") {
      return { status: "missing", timestamp: BOOT_TIME, message: "Noch kein Key hinterlegt." };
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
      "proxy-recommended": "Proxy empfohlen",
      "backend-ready": "Backend-ready"
    };
    const className = security === "backend-only" || security === "browser-critical" ? "status-stale" : security.includes("recommended") ? "status-fallback" : "status-live";
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
    if (mode === "optional") {
      return "Optionaler Key";
    }
    if (mode === "oauth") {
      return "OAuth / Token Slot";
    }
    if (mode === "anon") {
      return "Anon/Public Key Slot";
    }
    return "API Key";
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
        return fallbackQuote(symbol, "Kein Rohstoff-Key oder API-Fehler. Lokaler Commodity-Fallback aktiv.");
      }

      if (asset.type === "Index") {
        const indexQuote = await this.getAlphaQuote(symbol);
        if (indexQuote) {
          return indexQuote;
        }
        return fallbackQuote(symbol, "Index-Livequelle nicht sauber verfügbar. Lokaler Index-Fallback aktiv.");
      }

      const finnhubKey = cleanKey(state.apiKeys.finnhub);
      if (finnhubKey) {
        try {
          const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(finnhubKey)}`;
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
        recordProviderHealth("finnhub", "missing", "Kein Finnhub Key hinterlegt. Quotes nutzen Fallback oder Alpha Vantage.");
      }

      const alphaKey = cleanKey(state.apiKeys.alphaVantage);
      if (alphaKey) {
        try {
          const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(alphaKey)}`;
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
        recordProviderHealth("alphaVantage", "missing", "Kein Alpha Vantage Key hinterlegt. Quote-Fallback bleibt lokal.");
      }

      return fallbackQuote(symbol, "Kein Quote-Key oder API-Fehler.");
    },

    async getAlphaQuote(symbol) {
      const alphaKey = cleanKey(state.apiKeys.alphaVantage);
      if (!alphaKey) {
        return null;
      }
      try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(alphaKey)}`;
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
      const alphaKey = cleanKey(state.apiKeys.alphaVantage);
      if (alphaKey) {
        const alphaQuote = await this.getAlphaCommodityQuote(symbol, alphaKey);
        if (alphaQuote) {
          return alphaQuote;
        }
      } else {
        recordProviderHealth("alphaVantage", "missing", "Kein Alpha Vantage Key für Gold/Silber/WTI hinterlegt.");
      }

      if (symbol === "OIL") {
        const eiaKey = cleanKey(state.apiKeys.eia);
        if (eiaKey) {
          const eiaQuote = await this.getEiaOilQuote(eiaKey);
          if (eiaQuote) {
            return eiaQuote;
          }
        } else {
          recordProviderHealth("eia", "missing", "Kein EIA Key für Öl/Energie hinterlegt.");
        }
      }
      return null;
    },

    async getAlphaCommodityQuote(symbol, key) {
      const config = {
        GOLD: { fn: "GOLD_SILVER_SPOT", symbol: "GOLD", source: "Alpha Vantage GOLD_SILVER_SPOT" },
        SILVER: { fn: "GOLD_SILVER_SPOT", symbol: "SILVER", source: "Alpha Vantage GOLD_SILVER_SPOT" },
        OIL: { fn: "WTI", source: "Alpha Vantage WTI" }
      }[symbol];
      if (!config) {
        return null;
      }
      try {
        const url = config.fn === "WTI"
          ? `https://www.alphavantage.co/query?function=WTI&interval=daily&apikey=${encodeURIComponent(key)}`
          : `https://www.alphavantage.co/query?function=GOLD_SILVER_SPOT&symbol=${encodeURIComponent(config.symbol)}&apikey=${encodeURIComponent(key)}`;
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

    async getEiaOilQuote(key) {
      try {
        const url = `https://api.eia.gov/v2/petroleum/pri/spt/data/?frequency=daily&data[0]=value&facets[series][]=RWTC&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=1&api_key=${encodeURIComponent(key)}`;
        const result = await cachedJson("eia:oil:wti", url, CACHE_TTL.quote, "eia");
        const row = result.data && Array.isArray(result.data.response?.data) ? result.data.response.data[0] : null;
        const price = row ? Number(row.value) : NaN;
        if (!Number.isFinite(price)) {
          throw new Error("EIA Ölantwort ohne Preis");
        }
        return {
          symbol: "OIL",
          price,
          changePct: commodityChangeFromFallback("OIL", price),
          changeAbs: 0,
          meta: makeMeta("EIA APIv2 WTI Spot", result.status, result.timestamp)
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
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(asset.coingeckoId)}&vs_currencies=usd&include_market_cap=true&include_24hr_change=true`;
        const result = await cachedJson(`coingecko:quote:${symbol}`, url, CACHE_TTL.quote, "coingecko");
        const data = result.data && result.data[asset.coingeckoId];
        if (!data || !Number(data.usd)) {
          throw new Error("CoinGecko Quote ohne Preis");
        }
        return {
          symbol,
          price: Number(data.usd),
          changePct: Number(data.usd_24h_change || 0),
          marketCap: numberOrNull(data.usd_market_cap),
          meta: makeMeta("CoinGecko Simple Price API (Public/Demo)", result.status, result.timestamp, "Public/Demo nutzbar; produktionsnah besser mit Key oder Proxy.")
        };
      } catch (error) {
        logError(error);
        recordProviderHealth("coingecko", "fallback", "CoinGecko nicht erreichbar, Rate Limit oder CORS.");
        return fallbackQuote(symbol, "CoinGecko Public/Demo nicht erreichbar, Rate Limit oder CORS. Produktionsnah besser Key/Proxy nutzen.");
      }
    },

    async getProfile(symbol) {
      const asset = getAsset(symbol);
      const base = fallbackProfile(symbol, "Kein Profil-Key oder API-Fehler.");
      if (!["Stock", "ETF"].includes(asset.type)) {
        return base;
      }

      const finnhubKey = cleanKey(state.apiKeys.finnhub);
      if (finnhubKey) {
        try {
          const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(finnhubKey)}`;
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
        recordProviderHealth("finnhub", "missing", "Kein Finnhub Key für Profil/Asset-Seite hinterlegt.");
      }

      return base;
    },

    async getFundamentals(symbol) {
      const asset = getAsset(symbol);
      if (!["Stock", "ETF"].includes(asset.type)) {
        return fallbackFundamentals(symbol, "Fundamentals für diesen Asset-Typ lokal gemappt.");
      }

      const finnhubKey = cleanKey(state.apiKeys.finnhub);
      if (finnhubKey) {
        try {
          const url = `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${encodeURIComponent(finnhubKey)}`;
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
        recordProviderHealth("finnhub", "missing", "Kein Finnhub Key für Basic Financials hinterlegt.");
      }

      return fallbackFundamentals(symbol, "Kein Fundamentals-Key oder API-Fehler.");
    },

    async getCompanyNews(symbol) {
      const asset = getAsset(symbol);
      if (!["Stock", "ETF"].includes(asset.type)) {
        return fallbackNews(symbol, "Company News für diesen Asset-Typ lokal gemappt.");
      }

      const finnhubKey = cleanKey(state.apiKeys.finnhub);
      if (finnhubKey) {
        try {
          const to = toIsoDate(new Date());
          const from = toIsoDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));
          const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${encodeURIComponent(finnhubKey)}`;
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
        recordProviderHealth("finnhub", "missing", "Kein Finnhub Key für Company News hinterlegt.");
      }

      return fallbackNews(symbol, "Kein Finnhub News-Key oder API-Fehler.");
    },

    async getDailyStats(symbol) {
      const asset = getAsset(symbol);
      if (!["Stock", "ETF"].includes(asset.type)) {
        return null;
      }
      const alphaKey = cleanKey(state.apiKeys.alphaVantage);
      if (!alphaKey) {
        recordProviderHealth("alphaVantage", "missing", "Kein Alpha Vantage Key für Zeitreihen/Performance hinterlegt.");
        return null;
      }
      try {
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${encodeURIComponent(alphaKey)}`;
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
      const fredKey = cleanKey(state.apiKeys.fred);

      if (fredKey) {
        try {
          const fredRows = await Promise.all(FRED_MACRO_SERIES.map((item) => fetchFredSeries(item, fredKey)));
          rows.push(...fredRows);
        } catch (error) {
          logError(error);
          recordProviderHealth("fred", "fallback", error.message || "FRED Live-Abruf fehlgeschlagen.");
        }
      } else {
        recordProviderHealth("fred", "missing", "Kein FRED Key hinterlegt. Makro nutzt BLS/Treasury/Open-Data und Fallbacks.");
      }

      const openDataRows = await Promise.allSettled([
        fetchBlsMacroRows(),
        fetchTreasuryRows()
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

      const finnhubKey = cleanKey(state.apiKeys.finnhub);
      if (finnhubKey) {
        try {
          const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${encodeURIComponent(finnhubKey)}`;
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
        recordProviderHealth("finnhub", "missing", "Kein Finnhub Key für Earnings Calendar hinterlegt.");
      }

      const alphaKey = cleanKey(state.apiKeys.alphaVantage);
      if (alphaKey) {
        const alphaEvents = await fetchAlphaCalendarEvents(alphaKey);
        liveEvents.push(...alphaEvents);
      } else {
        recordProviderHealth("alphaVantage", "missing", "Kein Alpha Vantage Key für Earnings-/IPO-Kalender hinterlegt.");
      }

      const fallback = fallbackEvents(liveEvents.length ? "Fallback ergänzt Live-Kalender für Dividenden, Splits und Makrotermine." : "Kein Live-Event-Feed aktiv. Lokaler Kalender aktiv.");
      return dedupeEvents([...liveEvents, ...fallback]).sort((a, b) => a.date - b.date).slice(0, 34);
    }
  };

  async function fetchFredSeries(item, key) {
    const seriesId = item.seriesId || item.id;
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(seriesId)}&api_key=${encodeURIComponent(key)}&file_type=json&sort_order=desc&limit=24`;
    const result = await cachedJson(`fred:${seriesId}`, url, CACHE_TTL.macro, "fred");
    const observations = (result.data.observations || [])
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
      meta: makeMeta(`FRED ${seriesId}`, result.status, result.timestamp || Date.parse(latest.date))
    };
  }

  async function fetchBlsMacroRows() {
    const currentYear = new Date().getFullYear();
    const rows = [];
    try {
      const cpiUrl = `https://api.bls.gov/publicAPI/v2/timeseries/data/CUSR0000SA0?startyear=${currentYear - 2}&endyear=${currentYear}`;
      const cpiResult = await cachedJson("bls:cpi:history", cpiUrl, CACHE_TTL.openData, "bls");
      const cpiRows = parseBlsSeries(cpiResult.data);
      const latest = cpiRows[0];
      const yearAgo = latest ? yearAgoObservation(cpiRows, latest) : null;
      if (latest && yearAgo) {
        const inflation = ((latest.value / yearAgo.value) - 1) * 100;
        rows.push({
          id: "CPIAUCSL",
          label: "US CPI / Inflation",
          value: inflation,
          display: `${formatNumber(inflation)}%`,
          trend: "Live aus BLS CPI-Serie berechnet",
          meta: makeMeta("BLS CPI Public API", cpiResult.status, cpiResult.timestamp || Date.now())
        });
      }
    } catch (error) {
      logError(error);
      recordProviderHealth("bls", "fallback", "BLS CPI nicht erreichbar, FRED/Fallback bleibt aktiv.");
    }

    try {
      const unrateUrl = "https://api.bls.gov/publicAPI/v2/timeseries/data/LNS14000000?latest=true";
      const unrateResult = await cachedJson("bls:unrate:latest", unrateUrl, CACHE_TTL.openData, "bls");
      const latest = parseBlsSeries(unrateResult.data)[0];
      if (latest) {
        rows.push({
          id: "UNRATE",
          label: "Arbeitslosenquote",
          value: latest.value,
          display: `${formatNumber(latest.value)}%`,
          trend: "Live aus BLS Labor-Serie",
          meta: makeMeta("BLS Labor Public API", unrateResult.status, unrateResult.timestamp || Date.now())
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
      const url = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/daily_treasury_rates?sort=-record_date&page[size]=1";
      const result = await cachedJson("treasury:daily-rates", url, CACHE_TTL.openData, "treasury");
      const row = result.data && Array.isArray(result.data.data) ? result.data.data[0] : null;
      const y2 = firstNumber(row?.bc_2year, row?.tc_2year);
      const y10 = firstNumber(row?.bc_10year, row?.tc_10year);
      const rows = [];
      if (y10 !== null) {
        rows.push({
          id: "DGS10",
          label: "US 10Y Yield",
          value: y10,
          display: `${formatNumber(y10)}%`,
          trend: "Live aus Treasury Daily Rates",
          meta: makeMeta("U.S. Treasury Fiscal Data", result.status, result.timestamp)
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
          meta: makeMeta("U.S. Treasury Daily Rates", result.status, result.timestamp)
        });
      }
      return rows;
    } catch (error) {
      logError(error);
      recordProviderHealth("treasury", "fallback", "Treasury Daily Rates nicht erreichbar, FRED/Fallback bleibt aktiv.");
      return [];
    }
  }

  async function fetchWorldBankGrowthRows() {
    try {
      const url = "https://api.worldbank.org/v2/country/US;DE;CN/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=60";
      const result = await cachedJson("worldbank:gdp-growth", url, CACHE_TTL.openData, "worldBank");
      const rows = Array.isArray(result.data) && Array.isArray(result.data[1]) ? result.data[1] : [];
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
        source: "World Bank Indicators API",
        status: result.status,
        meta: makeMeta("World Bank Indicators API", result.status, result.timestamp)
      }));
    } catch (error) {
      logError(error);
      recordProviderHealth("worldBank", "fallback", "World Bank API nicht erreichbar, globaler Fallback aktiv.");
      return [];
    }
  }

  async function fetchImfGrowthRows() {
    try {
      const url = "https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH/USA/DEU/CHN";
      const result = await cachedJson("imf:ngdp-rpch", url, CACHE_TTL.openData, "imf");
      const values = result.data?.values?.NGDP_RPCH || {};
      const labels = { USA: "USA", DEU: "Deutschland", CHN: "China" };
      return Object.entries(values).map(([code, series]) => {
        const years = Object.keys(series || {}).sort((a, b) => Number(b) - Number(a));
        const year = years[0];
        return {
          country: labels[code] || code,
          indicator: "IMF reales BIP-Wachstum",
          value: Number(series[year]),
          display: `${formatPercent(Number(series[year]))}`,
          source: "IMF DataMapper API",
          status: result.status,
          meta: makeMeta("IMF DataMapper API", result.status, result.timestamp)
        };
      }).filter((row) => Number.isFinite(row.value));
    } catch (error) {
      logError(error);
      recordProviderHealth("imf", "fallback", "IMF DataMapper nicht erreichbar, World-Bank/Fallback bleibt aktiv.");
      return [];
    }
  }

  async function fetchAlphaCalendarEvents(key) {
    const events = [];
    try {
      const earningsText = await cachedText("alpha:events:earnings", `https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=${encodeURIComponent(key)}`, CACHE_TTL.events, "alphaVantage");
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
      const ipoText = await cachedText("alpha:events:ipo", `https://www.alphavantage.co/query?function=IPO_CALENDAR&apikey=${encodeURIComponent(key)}`, CACHE_TTL.events, "alphaVantage");
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
    const todayEvents = eventsForView()
      .filter((eventItem) => matchesEventWindow(eventItem, "today"))
      .sort((a, b) => eventRelevance(b) - eventRelevance(a))
      .slice(0, 4);
    const news = unique([...state.watchlist, ...dashboardPrefs().favorites, state.activeSymbol])
      .flatMap((symbol) => newsFor(symbol).items.slice(0, 1).map((item) => ({ ...item, symbol })))
      .sort((a, b) => Number(b.relevance || 0) - Number(a.relevance || 0))
      .slice(0, 4);
    const watchlistItems = watchlistNewsForView();
    return {
      moves: briefing.marketMoves.slice(0, 4),
      news,
      events: todayEvents.length ? todayEvents : briefing.upcomingEvents.slice(0, 4),
      watchlistItems,
      watchlistTone: recapWatchlistTone(watchlistItems)
    };
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
      return {
        ...eventItem,
        date,
        meta: makeMeta("Lokaler Event-Fallback", "fallback", BOOT_TIME, message)
      };
    }).sort((a, b) => a.date - b.date);
  }

  function eventsForSymbol(symbol) {
    return eventsForView().filter((eventItem) => eventItem.symbol === symbol || eventItem.symbol === "Macro").slice(0, 6);
  }

  function filteredEventHubEvents(events) {
    return events
      .filter((eventItem) => matchesEventType(eventItem, state.eventHub.type))
      .filter((eventItem) => matchesEventWindow(eventItem, state.eventHub.window))
      .sort((a, b) => eventRelevance(b) - eventRelevance(a) || a.date - b.date);
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

  function renderEventCard(eventItem) {
    const symbolButton = assetMap.has(eventItem.symbol) ? `data-symbol="${escAttr(eventItem.symbol)}"` : "";
    const relevance = eventRelevance(eventItem);
    const watchlistBadge = isWatchlistRelevantEvent(eventItem) ? `<span class="pill bull">Watchlist</span>` : "";
    return `
      <button class="event-card" type="button" ${symbolButton}>
        <span class="pill">${esc(eventItem.type)}</span>
        ${watchlistBadge}
        <strong>${esc(eventItem.title)}</strong>
        <span class="small">${eventItem.date.toLocaleDateString("de-DE")} ${eventItem.date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} | ${esc(eventItem.symbol)} | Relevanz ${relevance}/100</span>
        <p>${esc(eventItem.detail)}</p>
        ${renderDataMeta(eventItem.meta, true)}
      </button>
    `;
  }

  function renderAssetEventsCard(symbol, events) {
    const status = events.some((eventItem) => eventItem.meta.status === "live") ? "live" : events.some((eventItem) => eventItem.meta.status === "stale") ? "stale" : "fallback";
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Events</span>
              <h3>${esc(symbol)} Termine</h3>
            </div>
          ${renderStatusBadge(status)}
        </div>
        <div class="event-list">
          ${events.map(renderEventCard).join("") || renderEmptyState("Keine Events für dieses Asset im lokalen Kalender.")}
        </div>
        ${renderDataMeta(events[0] ? events[0].meta : makeMeta("Event-Kalender", "fallback", BOOT_TIME))}
      </article>
    `;
  }

  function renderAlertRow(alert) {
    const asset = getAsset(alert.symbol);
    const quote = quoteFor(alert.symbol);
    const status = normalizeAlertStatus(alert);
    const snoozed = isAlertSnoozed(alert);
    const statusLabel = alertStatusLabel(alert);
    const statusClass = status === "triggered" ? "bull" : status === "done" ? "neutral" : "muted";
    return `
      <div class="alert-row">
        <button class="symbol-button" type="button" data-symbol="${escAttr(alert.symbol)}">
          <strong>${esc(alert.symbol)} - ${esc(asset.name)}</strong>
          <span>${esc(alertLabel(alert))}</span>
        </button>
        <span class="right-cell">
          <strong>${formatMoney(quote.price, asset.currency)}</strong>
          <span class="${statusClass}">${esc(statusLabel)}</span>
        </span>
        <span class="right-cell">
          <strong>${esc(priorityLabel(alert.priority))}</strong>
          <span class="small">Priorität</span>
        </span>
        <span class="right-cell">
          <strong>${alert.lastCheckedAt ? formatTimestamp(alert.lastCheckedAt) : "noch offen"}</strong>
          <span class="small">${snoozed ? `Pausiert bis ${formatTimestamp(alert.snoozedUntil)}` : "Letzter Check"}</span>
        </span>
        <button class="tiny-button" type="button" data-alert-snooze="${escAttr(alert.id)}">Snooze</button>
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
    if (state.route === "home") {
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
      targetCash: 10,
      notes: "",
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
    const invested = positions.reduce((sum, position) => sum + position.quantity * position.avgPrice, 0);
    const current = positions.reduce((sum, position) => sum + position.quantity * quoteFor(position.symbol).price, 0);
    const totalValue = current + Number(portfolio.cash || 0);
    const performanceAbs = current - invested;
    const performancePct = invested ? performanceAbs / invested * 100 : 0;
    const cashPct = totalValue ? Number(portfolio.cash || 0) / totalValue * 100 : 0;
    const sectorExposure = exposureBy(positions, totalValue, (position) => getAsset(position.symbol).sector);
    const countryExposure = exposureBy(positions, totalValue, (position) => position.country || countryFor(position.symbol));
    const currencyExposure = exposureBy(positions, totalValue, (position) => getAsset(position.symbol).currency);
    const maxSector = maxExposure(sectorExposure);
    const maxCountry = maxExposure(countryExposure);
    const riskScore = clamp((maxSector.value * 0.75) + (maxCountry.value * 0.2) + Math.max(0, 12 - cashPct) + (positions.length < 4 ? 12 : 0), 0, 100);
    return {
      totalValue,
      performanceAbs,
      performancePct,
      cashPct,
      sectorExposure,
      countryExposure,
      currencyExposure,
      riskScore,
      concentrationHint: maxSector.value > 45 ? `Klumpenrisiko: ${maxSector.label} liegt bei ${formatNumber(maxSector.value)}%.` : "Kein extremes Sektor-Klumpenrisiko im lokalen Modell.",
      diversificationHint: positions.length < 4 ? "Diversifikation ist noch gering; weitere Bausteine prüfen." : "Diversifikation wirkt für ein lokales Modell solide.",
      rebalanceHint: cashPct > (portfolio.targetCash + 8) ? "Cash liegt über Ziel: Reinvestition oder Zielquote prüfen." : cashPct < Math.max(0, portfolio.targetCash - 5) ? "Cash liegt unter Ziel: Liquiditätspuffer prüfen." : "Cash-Anteil nahe Zielallokation.",
      priorityHint: riskScore >= 65 ? "Erste Priorität: Klumpenrisiko oder Cash-Puffer prüfen." : riskScore >= 40 ? "Portfolio wirkt nutzbar, sollte aber regelmäßig gegen Zielallokation geprüft werden." : "Risiko wirkt im lokalen Modell kontrolliert."
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

  function maxExposure(items) {
    return items.reduce((max, item) => item.value > max.value ? item : max, { label: "n/a", value: 0 });
  }

  function renderPortfolioPosition(position) {
    const asset = getAsset(position.symbol);
    const quote = quoteFor(position.symbol);
    const value = position.quantity * quote.price;
    const perf = position.avgPrice ? ((quote.price / position.avgPrice) - 1) * 100 : 0;
    return `
      <div class="portfolio-position-row">
        <button class="symbol-button" type="button" data-symbol="${escAttr(position.symbol)}"><strong>${esc(position.symbol)}</strong><span>${esc(asset.name)}</span></button>
        <span>${formatMoney(value, asset.currency)}</span>
        <span class="${toneClass(perf)}">${formatPercent(perf)}</span>
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
    state.portfolioScenario[input.name] = Number(input.value || 0);
    if (state.route === "portfolio") {
      render();
    }
  }

  function renderScenarioResult(analysis) {
    const shock = Number(state.portfolioScenario.shock || 0);
    const contribution = Number(state.portfolioScenario.contribution || 0);
    const shocked = analysis.totalValue * (1 + shock / 100);
    const oneYear = shocked + contribution * 12;
    return `
      <div class="metric-grid">
        ${renderMiniMetric("Nach Schock", formatMoney(shocked, "USD"))}
        ${renderMiniMetric("12M mit Beitrag", formatMoney(oneYear, "USD"))}
        ${renderMiniMetric("Differenz", formatMoney(oneYear - analysis.totalValue, "USD"))}
      </div>
      ${renderDataMeta(makeMeta("Lokale Was-wäre-wenn Simulation", "live", Date.now()))}
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

  function createAlertFromForm(form) {
    const formData = new FormData(form);
    const symbol = normalizeSymbol(formData.get("symbol"));
    const type = String(formData.get("type") || "price");
    const condition = String(formData.get("condition") || "above");
    const rawTarget = String(formData.get("target") ?? "").trim();
    const target = rawTarget === "" ? NaN : Number(rawTarget);
    const priority = String(formData.get("priority") || "medium");
    const createdAt = Date.now();

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

    const alert = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      symbol,
      type,
      condition,
      target: Number.isFinite(target) ? target : null,
      priority: ["high", "medium", "low"].includes(priority) ? priority : "medium",
      status: "open",
      createdAt,
      lastCheckedAt: null,
      snoozedUntil: null,
      history: [
        {
          status: "open",
          message: "Alert angelegt",
          timestamp: createdAt
        }
      ]
    };
    state.alerts = [alert, ...state.alerts].slice(0, 40);
    saveAlerts();
    toast("Alert gespeichert.");
    form.reset();
    checkAlerts(false);
    render();
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
      return eventsForSymbol(alert.symbol).some((eventItem) => eventItem.type === "Earnings" && eventItem.date >= startOfToday() && eventItem.date <= daysFromNow(14));
    }
    if (alert.type === "event") {
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
      return "Earnings-/Event-Reminder in den nächsten 14 Tagen";
    }
    if (alert.type === "event") {
      return "Event-Hinweis in den nächsten 14 Tagen";
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
      .filter((alert) => alertMatchesFilter(alert, state.alertFilter))
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

  function alertMatchesFilter(alert, filter) {
    if (!filter || filter === "all") {
      return true;
    }
    if (filter === "price") {
      return alert.type === "price";
    }
    if (filter === "earnings") {
      return alert.type === "earnings";
    }
    if (filter === "event") {
      return alert.type === "event" || alert.type === "sentiment";
    }
    if (filter === "watchlist") {
      return alert.type === "watchlist";
    }
    return true;
  }

  function alertSortRank(alert) {
    const statusRank = { triggered: 0, open: 1, done: 3 };
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

  function snoozeAlert(id) {
    let changed = false;
    const until = Date.now() + 24 * 60 * 60 * 1000;
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
          { status: "open", message: "Für 24 Stunden pausiert", timestamp: Date.now() },
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
      toast("Alert für 24 Stunden pausiert.");
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

  function saveApiKeys() {
    const next = collectApiKeysFromInputs();
    state.apiKeys = next;
    storageSet(STORAGE_KEYS.apiKeys, state.apiKeys);
    storageSet(STORAGE_KEYS.cache, {});
    state.lastHomeRefresh = 0;
    state.lastScreenerRefresh = 0;
    state.lastEventsRefresh = 0;
    state.assetLoadedAt = {};
    toast("API Keys gespeichert. Cache geleert, Live-Daten werden erneut versucht.");
    render();
  }

  function collectApiKeysFromInputs() {
    const next = { ...state.apiKeys };
    document.querySelectorAll("[data-api-key]").forEach((input) => {
      next[input.dataset.apiKey] = input.value.trim();
    });
    return next;
  }

  function deleteProviderKeyById(providerId) {
    const provider = providerById(providerId);
    if (!provider) {
      return;
    }
    state.apiKeys = { ...state.apiKeys, [providerId]: "" };
    state.providerTests = {
      ...state.providerTests,
      [providerId]: {
        status: "warn",
        timestamp: Date.now(),
        message: "Key gelöscht. Provider nutzt Fallback oder ist nur vorbereitet."
      }
    };
    storageSet(STORAGE_KEYS.apiKeys, state.apiKeys);
    storageSet(STORAGE_KEYS.providerTests, state.providerTests);
    storageSet(STORAGE_KEYS.cache, {});
    recordProviderHealth(providerId, "missing", "Key gelöscht. Provider nutzt Fallback oder bleibt vorbereitet.");
    toast(`${provider.name} Key gelöscht.`);
    render();
  }

  function buildFredMinimalTestRequest(key) {
    const url = new URL("https://api.stlouisfed.org/fred/series/updates");
    url.searchParams.set("api_key", key);
    url.searchParams.set("file_type", "json");
    return {
      url: url.toString(),
      responseType: "json",
      providerId: "fred",
      method: "GET"
    };
  }

  function fredRequestDiagnostics(rawInput, savedKey, storageKey, request, responseInfo = {}) {
    const url = new URL(request.url);
    const sentKey = url.searchParams.get("api_key") || "";
    const fileType = url.searchParams.get("file_type") || "";
    return {
      codePath: "testProviderById > runFredMinimalProviderTest > buildFredMinimalTestRequest > fetchProviderTestPayload",
      method: request.method || "GET",
      endpoint: maskFredEndpoint(request.url, sentKey),
      path: url.pathname,
      pageOrigin: window.location.origin || "file://",
      browserOnline: navigator.onLine ? "ja" : "nein",
      apiKeyParamPresent: Boolean(sentKey),
      fileType,
      fileTypeJson: fileType === "json",
      inputKey: describeKeyShape(rawInput),
      savedKey: describeKeyShape(savedKey),
      storageKey: describeKeyShape(storageKey),
      sentKey: describeKeyShape(sentKey),
      savedEqualsSent: cleanKey(savedKey) === sentKey,
      storageEqualsSaved: storageKey === savedKey,
      ...responseInfo
    };
  }

  function describeKeyShape(value) {
    const raw = String(value ?? "");
    const trimmed = raw.trim();
    return {
      rawLength: raw.length,
      trimmedLength: trimmed.length,
      trimChanged: raw !== trimmed,
      mask: maskSecret(trimmed),
      lowercaseAlnum32: /^[a-z0-9]{32}$/.test(trimmed),
      hasWhitespace: /\s/.test(raw)
    };
  }

  function maskSecret(value) {
    const text = String(value || "");
    if (!text) {
      return "leer";
    }
    if (text.length <= 6) {
      return `${text.slice(0, 1)}…${text.slice(-1)} (${text.length} Zeichen)`;
    }
    return `${text.slice(0, 3)}…${text.slice(-3)} (${text.length} Zeichen)`;
  }

  function maskFredEndpoint(url, key) {
    const displayUrl = new URL(url);
    if (!key) {
      displayUrl.searchParams.set("api_key", "leer");
      return displayUrl.toString();
    }
    displayUrl.searchParams.set("api_key", maskSecretShort(key));
    return displayUrl.toString().replace(/%E2%80%A6/g, "…");
  }

  function maskSecretShort(value) {
    const text = String(value || "");
    if (!text) {
      return "leer";
    }
    if (text.length <= 6) {
      return `${text.slice(0, 1)}…${text.slice(-1)}`;
    }
    return `${text.slice(0, 3)}…${text.slice(-3)}`;
  }

  function providerInputValue(providerId) {
    const input = Array.from(document.querySelectorAll("[data-api-key]")).find((item) => item.dataset.apiKey === providerId);
    return input ? input.value : "";
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
    if (data && data.error_code) {
      throw new Error(`FRED API-Fehler ${data.error_code}: ${data.error_message || "Antwort ungültig."}`);
    }
    const series = data && Array.isArray(data.seriess) ? data.seriess : [];
    if (!series.length) {
      throw new Error("FRED-Antwort ungültig: JSON ist erreichbar, aber `seriess` fehlt oder ist leer.");
    }
    return "Test erfolgreich: FRED Minimaltest `/fred/series/updates?api_key=…&file_type=json` liefert JSON.";
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
      await runFredMinimalProviderTest(provider);
      return;
    }

    state.apiKeys = collectApiKeysFromInputs();
    storageSet(STORAGE_KEYS.apiKeys, state.apiKeys);
    setProviderTest(providerId, "warn", "Test läuft lokal im Browser...");
    render();

    const key = cleanKey(providerKeyValue(providerId));
    if (provider.security === "backend-only" || (provider.security === "browser-critical" && !provider.testRequest && !provider.testUrl)) {
      setProviderTest(providerId, "warn", provider.security === "browser-critical" ? "Browser-Test bewusst nicht implementiert: Quelle ist browserkritisch." : "Backend-only: Test im Browser bewusst nicht ausgeführt.");
      toast(`${provider.name}: Browser-Test hier nicht sinnvoll.`);
      render();
      return;
    }
    if (["required", "oauth", "anon"].includes(provider.keyMode) && !key) {
      setProviderTest(providerId, "warn", "Kein Key hinterlegt. Slot bleibt vorbereitet oder nutzt Fallbacks.");
      toast(`${provider.name}: kein Key gespeichert.`);
      render();
      return;
    }
    const requestFactory = provider.testRequest || (provider.testUrl ? ((savedKey) => ({ url: provider.testUrl(savedKey), responseType: "json" })) : null);
    if (!requestFactory) {
      setProviderTest(providerId, "warn", "Kein Browser-Test implementiert. Quelle ist nur zugeordnet, nicht als Browser-Livetest versprochen.");
      toast(`${provider.name}: kein Browser-Test implementiert.`);
      render();
      return;
    }

    try {
      const request = requestFactory(key);
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

  async function runFredMinimalProviderTest(provider) {
    const rawInput = providerInputValue("fred");
    state.apiKeys = collectApiKeysFromInputs();
    storageSet(STORAGE_KEYS.apiKeys, state.apiKeys);
    const savedKey = providerKeyValue("fred");
    const storedKey = providerKeyValue("fred", storageGet(STORAGE_KEYS.apiKeys, {}));
    const key = cleanKey(savedKey);

    if (!key) {
      const emptyRequest = buildFredMinimalTestRequest("");
      setProviderTest("fred", "warn", "Kein FRED-Key gespeichert. Test wurde nicht gesendet.", fredRequestDiagnostics(rawInput, savedKey, storedKey, emptyRequest, {
        stage: "nicht gesendet",
        httpStatus: "kein Request",
        responseFormat: "keine Antwort",
        parseStatus: "nicht ausgeführt"
      }));
      toast("FRED: kein Key gespeichert.");
      render();
      return;
    }

    const request = buildFredMinimalTestRequest(key);
    setProviderTest("fred", "warn", "FRED Minimaltest läuft: Request gebaut, file_type=json gesetzt.", fredRequestDiagnostics(rawInput, savedKey, storedKey, request, {
      stage: "Request gebaut",
      httpStatus: "wartet",
      responseFormat: "wartet",
      parseStatus: "wartet"
    }));
    render();

    try {
      const testResult = await fetchProviderTestPayload(request);
      let message = "FRED hat im Browser-Test geantwortet.";
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
      const details = fredRequestDiagnostics(rawInput, savedKey, storedKey, request, {
        stage: "Response erhalten",
        httpStatus: testResult.response.status,
        contentType: testResult.contentType || "unbekannt",
        responseFormat: "JSON",
        parseStatus: testResult.parseOk ? "Parsing erfolgreich" : "Parsing fehlgeschlagen",
        fredError: ""
      });
      setProviderTest("fred", "ok", message, details);
      toast("FRED: Minimaltest erfolgreich.");
    } catch (error) {
      const details = fredRequestDiagnostics(rawInput, savedKey, storedKey, request, {
        stage: error.httpStatus ? "Response erhalten" : "Fetch fehlgeschlagen",
        httpStatus: error.httpStatus || "keine HTTP-Antwort",
        contentType: error.contentType || "unbekannt",
      responseFormat: error.parseOk === false ? "nicht JSON" : error.responseData ? "JSON" : "unbekannt",
      parseStatus: error.parseOk === false ? "Parsing fehlgeschlagen" : error.responseData ? "Parsing erfolgreich" : "nicht ausgeführt",
      fredError: error.apiMessage || "",
        browserFetchError: error.browserMessage || error.message || "",
        responseBody: error.responseText ? String(error.responseText).slice(0, 420) : ""
      });
      const message = error.kind === "browser"
        ? "FRED Browser-Test: keine lesbare HTTP-Antwort erhalten. Keypfad OK; der Browser hat den Fetch vor dem Response blockiert oder der Netzwerkzugriff wurde lokal verhindert."
        : describeProviderTestError(error);
      setProviderTest("fred", "error", message, details);
      toast("FRED: Minimaltest fehlgeschlagen.");
      logError(error);
    }
    render();
  }

  async function testConfiguredProviders() {
    state.apiKeys = collectApiKeysFromInputs();
    storageSet(STORAGE_KEYS.apiKeys, state.apiKeys);
    const testable = visibleProviders().filter((provider) => {
      const hasTest = Boolean(provider.testRequest || provider.testUrl);
      if (!hasTest || provider.security === "backend-only" || provider.security === "browser-critical") {
        return false;
      }
      if (["none", "optional"].includes(provider.keyMode)) {
        return true;
      }
      return Boolean(cleanKey(providerKeyValue(provider.id)));
    });
    if (!testable.length) {
      toast("Keine testbaren Provider konfiguriert. Public/Demo Slots oder Keys eintragen.");
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
    return "Fallback-Daten aktiv. Trage API Keys ein für Live-Daten.";
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
