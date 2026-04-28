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
    watchlist: "mh.watchlist.v2",
    portfolios: "mh.portfolios.v1",
    activePortfolioId: "mh.activePortfolioId.v1",
    dashboardPrefs: "mh.dashboardPrefs.v1",
    alerts: "mh.alerts.v2",
    alertInbox: "mh.alertInbox.v2",
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
    macro: 6 * 60 * 60 * 1000
  };

  const PROVIDER_GROUPS = [
    { id: "market", label: "Market Data" },
    { id: "fundamentals", label: "Fundamentals" },
    { id: "macro", label: "Macro" },
    { id: "news", label: "News" },
    { id: "crypto", label: "Crypto" },
    { id: "fxCommodities", label: "Forex / Commodities" },
    { id: "events", label: "Events / Earnings" },
    { id: "social", label: "Social / Sentiment" },
    { id: "crm", label: "Newsletter / CRM" },
    { id: "storage", label: "Storage / Backend-ready" }
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
      description: "Aktien-Quotes, Firmenprofile, Company News, Basic Financials und spaeter Earnings/Events.",
      usage: "Live genutzt fuer Quotes, Profile, Company News und Basic Financials.",
      testHint: "Testet AAPL Quote ueber Finnhub.",
      testUrl: (key) => `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(key)}`
    },
    {
      id: "alphaVantage",
      name: "Alpha Vantage",
      group: "market",
      categories: ["Market Data"],
      status: "active",
      keyMode: "required",
      security: "backend-recommended",
      description: "Optionaler Aktienkurs-Fallback fuer globale Quotes.",
      usage: "Live genutzt als Quote-Fallback nach Finnhub.",
      testHint: "Testet GLOBAL_QUOTE fuer AAPL.",
      testUrl: (key) => `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${encodeURIComponent(key)}`
    },
    {
      id: "twelveData",
      name: "Twelve Data",
      group: "market",
      categories: ["Market Data", "Forex / Commodities"],
      status: "prepared",
      keyMode: "required",
      security: "backend-recommended",
      description: "Vorbereiteter Slot fuer Realtime/Delayed Quotes, Indikatoren, Forex und Rohstoffe.",
      usage: "Noch nicht aktiv im Datenlayer.",
      testHint: "Slot vorbereitet; Integration spaeter."
    },
    {
      id: "fmp",
      name: "Financial Modeling Prep",
      group: "fundamentals",
      categories: ["Fundamentals", "Market Data", "Events / Earnings"],
      status: "active",
      keyMode: "required",
      security: "backend-recommended",
      description: "Profile, Fundamentaldaten, Kennzahlen und spaeter Earnings-Kalender.",
      usage: "Live genutzt fuer Profile/Fundamentals, wenn Key vorhanden.",
      testHint: "Testet Profil fuer AAPL.",
      testUrl: (key) => `https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=${encodeURIComponent(key)}`
    },
    {
      id: "eodhd",
      name: "EODHD",
      group: "fundamentals",
      categories: ["Market Data", "Fundamentals", "Events / Earnings"],
      status: "prepared",
      keyMode: "required",
      security: "backend-recommended",
      description: "Vorbereiteter Slot fuer EOD-Kurse, Fundamentaldaten, Dividenden und Earnings.",
      usage: "Noch nicht aktiv im Datenlayer.",
      testHint: "Slot vorbereitet; Integration spaeter."
    },
    {
      id: "fred",
      name: "FRED",
      group: "macro",
      categories: ["Macro"],
      status: "active",
      keyMode: "required",
      security: "browser-ok-private",
      description: "US-Makrodaten wie Fed Funds, CPI, Arbeitslosenquote und 10Y Yield.",
      usage: "Live genutzt fuer Makro-Schnellblick.",
      testHint: "Testet Fed Funds Serie.",
      testUrl: (key) => `https://api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS&api_key=${encodeURIComponent(key)}&file_type=json&sort_order=desc&limit=1`
    },
    {
      id: "ecb",
      name: "ECB",
      group: "macro",
      categories: ["Macro", "Forex / Commodities"],
      status: "prepared",
      keyMode: "none",
      security: "browser-ok-public",
      description: "Vorbereiteter Slot fuer EZB-Zinsen, FX-Referenzkurse und europaeische Makrodaten.",
      usage: "Noch nicht aktiv im Datenlayer.",
      testHint: "Oeffentliche Quelle, kein Key-Feld noetig."
    },
    {
      id: "newsApi",
      name: "NewsAPI",
      group: "news",
      categories: ["News"],
      status: "backendOnly",
      keyMode: "required",
      security: "backend-only",
      description: "Vorbereiteter Slot fuer allgemeine News-Aggregation.",
      usage: "Noch nicht aktiv. NewsAPI sollte wegen Key-Schutz und CORS spaeter serverseitig laufen.",
      testHint: "Backend-only empfohlen."
    },
    {
      id: "gnews",
      name: "GNews",
      group: "news",
      categories: ["News"],
      status: "prepared",
      keyMode: "required",
      security: "backend-recommended",
      description: "Vorbereiteter Slot fuer News-Aggregation und Asset-News.",
      usage: "Noch nicht aktiv im Datenlayer.",
      testHint: "Slot vorbereitet; Integration spaeter."
    },
    {
      id: "marketaux",
      name: "Marketaux",
      group: "news",
      categories: ["News", "Social / Sentiment"],
      status: "optional",
      keyMode: "required",
      security: "backend-recommended",
      description: "Optionaler Slot fuer Finanz-News, Entitaeten und Sentiment.",
      usage: "Noch nicht aktiv im Datenlayer.",
      testHint: "Optionaler spaeterer News/Sentiment-Anbieter."
    },
    {
      id: "coingecko",
      name: "CoinGecko",
      group: "crypto",
      categories: ["Crypto"],
      status: "active",
      keyMode: "optional",
      security: "proxy-recommended",
      description: "Krypto-Preise fuer BTC/ETH. Public/Demo nutzbar; produktionsnah besser mit Key oder Proxy.",
      usage: "Live genutzt fuer BTC/ETH Simple Price, mit lokalem Fallback.",
      testHint: "Testet Public/Demo Simple Price fuer Bitcoin.",
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
      description: "Vorbereiteter Slot fuer alternative Krypto-Preise und Market Caps.",
      usage: "Noch nicht aktiv im Datenlayer.",
      testHint: "Slot vorbereitet; Integration spaeter."
    },
    {
      id: "exchangeRateApi",
      name: "ExchangeRate-API",
      group: "fxCommodities",
      categories: ["Forex / Commodities"],
      status: "prepared",
      keyMode: "required",
      security: "backend-recommended",
      description: "Vorbereiteter Slot fuer FX-Kurse und Waehrungsrechner.",
      usage: "Noch nicht aktiv im Datenlayer.",
      testHint: "Slot vorbereitet; Integration spaeter."
    },
    {
      id: "openExchangeRates",
      name: "Open Exchange Rates",
      group: "fxCommodities",
      categories: ["Forex / Commodities"],
      status: "prepared",
      keyMode: "required",
      security: "backend-recommended",
      description: "Vorbereiteter Slot fuer FX-Kurse und Multi-Waehrungs-System.",
      usage: "Noch nicht aktiv im Datenlayer.",
      testHint: "Slot vorbereitet; Integration spaeter."
    },
    {
      id: "metalsApi",
      name: "Metals-API",
      group: "fxCommodities",
      categories: ["Forex / Commodities"],
      status: "optional",
      keyMode: "required",
      security: "backend-recommended",
      description: "Optionaler Slot fuer Gold, Silber und Rohstoffpreise.",
      usage: "Noch nicht aktiv im Datenlayer.",
      testHint: "Optionaler Rohstoffanbieter fuer spaetere Phase."
    },
    {
      id: "reddit",
      name: "Reddit",
      group: "social",
      categories: ["Social / Sentiment"],
      status: "backendOnly",
      keyMode: "oauth",
      security: "backend-only",
      description: "Vorbereiteter Slot fuer Reddit/WallStreetBets Sentiment und Mentions.",
      usage: "Noch nicht aktiv. OAuth und Token sollten spaeter serverseitig laufen.",
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
      description: "Newsletter, Listen, Double-Opt-In und spaeter CRM-Automation.",
      usage: "UI vorbereitet, API-Aufrufe spaeter nur ueber Backend.",
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
      description: "Vorbereiteter Slot fuer User-Daten, Watchlists, Kommentare, Auth und Edge Functions.",
      usage: "Noch nicht aktiv. In Phase statisch bleibt localStorage primaer.",
      testHint: "Anon Key kann spaeter genutzt werden; Service Role niemals im Browser speichern."
    }
  ];

  const DEFAULT_WATCHLIST = ["NVDA", "MSFT", "AAPL", "SPY", "BTC"];
  const HOME_TICKER = ["SPY", "QQQ", "DAX", "NVDA", "MSFT", "AAPL", "BTC", "ETH", "GOLD"];

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
      risks: "China-Abhaengigkeit, Regulierung, langsamere Hardware-Zyklen.",
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
      thesis: "Fuehrende AI-Infrastruktur, sehr starke Nachfrage nach Beschleunigern und Software-Stack.",
      risks: "Hohe Erwartungen, Zyklik bei Capex, Konkurrenz durch eigene Chips grosser Kunden.",
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
      risks: "Margendruck, Wettbewerb, starke Bewertungsabhaengigkeit von Zukunftsthemen.",
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
      risks: "Regulierung, Capex fuer AI/Metaverse, Werbezyklus.",
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
      thesis: "Cloud, Office und AI-Copilot liefern sehr robuste, wiederkehrende Umsaetze.",
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
      thesis: "Breiter US-Marktproxy mit hoher Liquiditaet.",
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
      risks: "Konzentration, Zins-Sensitivitaet, hohe Erwartungen.",
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
      risks: "Steigende Realzinsen, Dollar-Staerke, keine laufenden Cashflows.",
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
      thesis: "Digitaler Knappheits- und Liquiditaetsproxy mit hohem Beta.",
      risks: "Volatilitaet, Regulierung, Liquiditaetszyklen.",
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
      thesis: "Smart-Contract-Basisinfrastruktur mit Staking- und Layer-2-Oekosystem.",
      risks: "Wettbewerb, Regulierung, Netzwerkgebuehren und Nachfragezyklen.",
      sentiment: 63
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
      changes: [["Berkshire Hathaway", "Reduziert", "-8.5%"], ["Vanguard", "Erhoeht", "+0.7%"], ["BlackRock", "Stabil", "+0.1%"]],
      buys: [["Director", "Kauf", "18.000", "Fallback"], ["VP Services", "Kauf", "6.200", "Fallback"]],
      sells: [["CFO", "Verkauf", "24.000", "Fallback"], ["General Counsel", "Verkauf", "9.500", "Fallback"]]
    },
    NVDA: {
      insiderScore: 64,
      buySellRatio: 0.5,
      topShareholders: [["Vanguard Group", 8.1], ["BlackRock", 7.4], ["Fidelity", 4.2]],
      holdings: [["QQQ", 4.8, "+1.6%"], ["Vanguard Growth ETF", 2.7, "+1.1%"], ["iShares Semiconductor ETF", 1.8, "+2.4%"]],
      changes: [["Fidelity", "Erhoeht", "+3.8%"], ["Vanguard", "Erhoeht", "+1.2%"], ["Insider gesamt", "Reduziert", "-0.6%"]],
      buys: [["Director", "Kauf", "4.000", "Fallback"]],
      sells: [["CEO/C-Level", "Verkauf", "120.000", "Planverkauf"], ["Director", "Verkauf", "22.000", "Fallback"]]
    },
    TSLA: {
      insiderScore: 42,
      buySellRatio: 0.3,
      topShareholders: [["Elon Musk", 20.5], ["Vanguard Group", 7.2], ["BlackRock", 5.9]],
      holdings: [["ARK Innovation ETF", 6.2, "-1.8%"], ["Vanguard Total Stock Market", 1.5, "stabil"], ["QQQ", 1.2, "-0.4%"]],
      changes: [["ARK", "Reduziert", "-2.1%"], ["BlackRock", "Stabil", "+0.1%"], ["Retail Proxy", "Erhoeht", "+1.9%"]],
      buys: [["Director", "Kauf", "2.500", "Fallback"]],
      sells: [["Executive", "Verkauf", "35.000", "Fallback"], ["Director", "Verkauf", "12.000", "Fallback"]]
    },
    MSFT: {
      insiderScore: 69,
      buySellRatio: 0.9,
      topShareholders: [["Vanguard Group", 8.7], ["BlackRock", 7.2], ["State Street", 3.8]],
      holdings: [["SPY", 6.9, "+0.3%"], ["QQQ", 5.2, "+0.8%"], ["Vanguard Growth ETF", 3.1, "+0.5%"]],
      changes: [["Vanguard", "Erhoeht", "+0.8%"], ["State Street", "Stabil", "+0.1%"], ["BlackRock", "Erhoeht", "+0.4%"]],
      buys: [["Director", "Kauf", "8.400", "Fallback"], ["Executive", "Kauf", "3.100", "Fallback"]],
      sells: [["CFO", "Verkauf", "16.000", "Planverkauf"]]
    }
  };

  const ETF_DATA = [
    {
      symbol: "SPY",
      name: "SPDR S&P 500 ETF Trust",
      ter: 0.09,
      distribution: "Ausschuettend",
      currency: "USD",
      region: [["USA", 96], ["Europa", 2], ["Sonstige", 2]],
      holdings: [["MSFT", 7.1], ["AAPL", 6.4], ["NVDA", 5.8], ["AMZN", 3.7], ["META", 2.5]],
      risk: "Breiter US-Markt, aber Mega-Cap-Konzentration.",
      fxRisk: "USD-Risiko fuer EUR-Anleger"
    },
    {
      symbol: "QQQ",
      name: "Invesco QQQ Trust",
      ter: 0.20,
      distribution: "Ausschuettend",
      currency: "USD",
      region: [["USA", 97], ["Global", 3]],
      holdings: [["MSFT", 8.7], ["NVDA", 7.9], ["AAPL", 7.4], ["AMZN", 5.1], ["META", 4.8]],
      risk: "Tech- und Growth-Konzentration.",
      fxRisk: "USD-Risiko, hohe Zins-Sensitivitaet"
    },
    {
      symbol: "VTI",
      name: "Vanguard Total Stock Market ETF",
      ter: 0.03,
      distribution: "Ausschuettend",
      currency: "USD",
      region: [["USA", 99], ["Sonstige", 1]],
      holdings: [["MSFT", 6.2], ["AAPL", 5.6], ["NVDA", 5.0], ["AMZN", 3.2], ["META", 2.1]],
      risk: "US-Gesamtmarkt mit Small-/Mid-Cap-Anteil.",
      fxRisk: "USD-Risiko fuer EUR-Anleger"
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
      fxRisk: "Mehrwaehrungs-Exposure im Fonds"
    }
  ];

  const MACRO_EXTENSIONS = [
    { id: "ECB", label: "EZB / ECB Policy Rate", display: "4.00%", trend: "Restriktiv, Zinspfad wird datenabhaengig", why: "Relevant fuer EUR, DAX, Banken und Bewertungsmultiples.", meaning: "Fallende Zinsen entlasten Finanzierungskosten; steigende Zinsen druecken Risikoassets.", source: "ECB Placeholder", status: "fallback" },
    { id: "M1", label: "Geldmenge M1", display: "-4.2% YoY", trend: "Ruecklaeufige enge Liquiditaet", why: "M1 zeigt sehr liquide Geldbestaende.", meaning: "Rueckgang kann auf restriktivere Liquiditaet hindeuten.", source: "FRED/ECB vorbereitet", status: "fallback" },
    { id: "M2", label: "Geldmenge M2", display: "+1.8% YoY", trend: "Liquiditaet stabilisiert sich", why: "M2 ist ein wichtiger Liquiditaetsproxy fuer Risikoassets.", meaning: "Steigendes M2 kann Risk-on unterstuetzen; fallendes M2 wirkt bremsend.", source: "Lokaler M2-Fallback", status: "fallback" },
    { id: "M3", label: "Geldmenge M3", display: "vorbereitet", trend: "EU/ECB-Struktur vorbereitet", why: "M3 ist fuer Europa besonders relevant.", meaning: "Breites Geldwachstum zeigt Kredit- und Liquiditaetsbedingungen.", source: "ECB Slot vorbereitet", status: "fallback" },
    { id: "M4", label: "Geldmenge M4", display: "vorbereitet", trend: "UK/Global-Slot vorbereitet", why: "M4 kann fuer UK/Global-Liquiditaet genutzt werden.", meaning: "Breitere Geldmengen helfen beim Liquiditaetsbild.", source: "Provider Slot vorbereitet", status: "fallback" },
    { id: "REALYIELD", label: "Realzins", display: "1.25%", trend: "Nominalzins minus Inflation", why: "Realzinsen beeinflussen Gold, Growth-Aktien und Bewertungen.", meaning: "Steigende Realzinsen belasten Gold/Growth; fallende Realzinsen helfen oft.", source: "Lokales Makro-Modell", status: "fallback" },
    { id: "YCURVE", label: "Yield Curve 2Y-10Y", display: "-0.38%", trend: "Inversion bleibt Rezessionssignal", why: "Die Kurve ist ein klassischer Konjunkturindikator.", meaning: "Starke Inversion signalisiert Stress; Re-Steepening kann Wendepunkt anzeigen.", source: "Lokaler Spread-Fallback", status: "fallback" }
  ];

  const DASHBOARD_MODES = {
    standard: ["macro", "topPicks", "watchlist", "sentiment", "research"],
    investor: ["watchlist", "macro", "etf", "portfolio", "research"],
    trader: ["topPicks", "screener", "watchlist", "alerts", "sentiment"],
    learning: ["research", "macro", "etf", "watchlist", "sentiment"]
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
      notes: "Spielwiese fuer Szenarien und Was-waere-wenn Simulationen.",
      positions: [
        { symbol: "AAPL", quantity: 10, avgPrice: 180, country: "USA" },
        { symbol: "BTC", quantity: 0.08, avgPrice: 55000, country: "Global" }
      ]
    }
  ];

  const FALLBACK_EVENTS = [
    { title: "NVIDIA Earnings Window", dateOffset: 12, type: "Earnings", symbol: "NVDA", detail: "Markt achtet auf Data-Center-Umsatz, Margen und AI-Capex-Kommentare." },
    { title: "Microsoft Quarterly Results", dateOffset: 18, type: "Earnings", symbol: "MSFT", detail: "Azure-Wachstum und Copilot-Monetarisierung stehen im Fokus." },
    { title: "Apple Product / Services Update", dateOffset: 24, type: "Earnings", symbol: "AAPL", detail: "Services-Margen, iPhone-Zyklus und Kapitalrueckfluesse sind relevante Treiber." },
    { title: "Tesla Delivery / Margin Check", dateOffset: 9, type: "Earnings", symbol: "TSLA", detail: "Auslieferungen, Preisdruck und Bruttomarge bleiben Kernrisiken." },
    { title: "US CPI Release", dateOffset: 6, type: "Makro", symbol: "Macro", detail: "Inflation beeinflusst Zinsfantasie, Multiples und Gold/Dollar." },
    { title: "Fed Meeting / Rate Decision", dateOffset: 28, type: "Makro", symbol: "Macro", detail: "Dot Plot, Statement und Pressekonferenz bestimmen den Liquiditaetsblick." },
    { title: "EZB Zinsentscheid", dateOffset: 34, type: "Makro", symbol: "DAX", detail: "Wichtig fuer DAX, EUR/USD und europaeische Bewertungsmultiples." },
    { title: "Bitcoin Network / ETF Flow Check", dateOffset: 15, type: "Krypto", symbol: "BTC", detail: "ETF-Flows und Liquiditaet bleiben kurzfristige Kurstreiber." },
    { title: "SPY Ex-Dividend Reminder", dateOffset: 42, type: "Dividende", symbol: "SPY", detail: "ETF-spezifischer Dividenden-Termin als lokaler Placeholder." }
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
      headline: "Regulierung und Plattformgebuehren bleiben zentrale Beobachtungspunkte",
      source: "MH Local Research",
      summary: "Grossplattformen bleiben profitabel, aber politische und regulatorische Risiken steigen.",
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
      summary: "Makrodaten bleiben wichtig fuer Aktienmultiples, Gold und globale Kapitalfluesse.",
      sentiment: "Neutral",
      relevance: 88,
      ageHours: 2
    },
    {
      symbols: ["BTC", "ETH"],
      headline: "Krypto bleibt stark an Liquiditaets- und Risk-on-Phasen gekoppelt",
      source: "MH Local Research",
      summary: "Momentum ist positiv, aber hohe Volatilitaet erfordert strikte Risikosteuerung.",
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
      trend: "Inflation bleibt ueber Ziel, aber abgekuehlt",
      source: "Lokaler FRED-Fallback",
      status: "fallback"
    },
    {
      id: "UNRATE",
      label: "Arbeitslosenquote",
      value: 4.0,
      display: "4.0%",
      trend: "Arbeitsmarkt solide, leichte Abkuehlung",
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
      trend: "Placeholder, da keine saubere Free-Quelle aktiv",
      source: "Lokaler Placeholder",
      status: "fallback"
    }
  ];

  const TOP_PICKS = [
    {
      symbol: "MSFT",
      side: "Long",
      setup: "Qualitaet + AI-Optionalitaet",
      reason: "Starker Cashflow, wiederkehrende Umsaetze und defensiverer Tech-Charakter."
    },
    {
      symbol: "NVDA",
      side: "Long",
      setup: "Momentum + AI-Infrastruktur",
      reason: "Fundamentales Wachstum bleibt stark, aber Positionsgroesse wegen Bewertung kontrollieren."
    },
    {
      symbol: "GOLD",
      side: "Hedge",
      setup: "Makro-Schutz",
      reason: "Interessant bei sinkenden Realzinsen, geopolitischem Stress oder Dollar-Schwaeche."
    },
    {
      symbol: "SPY",
      side: "Core",
      setup: "Breiter Markt",
      reason: "Sauberer Benchmark-Baustein fuer Watchlist und Portfolio-Vergleich."
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
    { title: "Makro zu Micro: Was Zinsen fuer Aktien bedeuten", tag: "Macro", detail: "Uebersetzt Fed, Inflation und Renditen in Sektor- und Asset-Signale." },
    { title: "Watchlist-Disziplin statt News-Chaos", tag: "Workflow", detail: "So wird aus Research ein wiederholbarer Entscheidungsprozess." }
  ];

  const state = {
    route: "home",
    activeSymbol: storageGet(STORAGE_KEYS.activeSymbol, "NVDA"),
    theme: storageGet(STORAGE_KEYS.theme, "dark"),
    apiKeys: storageGet(STORAGE_KEYS.apiKeys, {}),
    providerTests: storageGet(STORAGE_KEYS.providerTests, {}),
    watchlist: storageGet(STORAGE_KEYS.watchlist, DEFAULT_WATCHLIST),
    portfolios: storageGet(STORAGE_KEYS.portfolios, DEFAULT_PORTFOLIOS),
    activePortfolioId: storageGet(STORAGE_KEYS.activePortfolioId, "core"),
    dashboardPrefs: storageGet(STORAGE_KEYS.dashboardPrefs, { mode: "standard", favorites: ["NVDA", "MSFT"], modules: DASHBOARD_MODES.standard }),
    alerts: storageGet(STORAGE_KEYS.alerts, []),
    alertInbox: storageGet(STORAGE_KEYS.alertInbox, []),
    recents: storageGet(STORAGE_KEYS.recents, ["NVDA", "MSFT", "AAPL", "BTC"]),
    assetTab: "overview",
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
    assetLoadedAt: {},
    lastHomeRefresh: 0,
    loadingHome: false,
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
    window.addEventListener("online", () => toast("Internetverbindung erkannt. Live-Daten werden beim naechsten Refresh erneut versucht."));
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
      toast("Dieses Asset ist noch nicht im Phase-2C-Universum.");
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
      toast("Asset nicht gefunden. Phase 2C unterstuetzt aktuell AAPL, NVDA, TSLA, META, MSFT, AMZN, GOLD, BTC, ETH, DAX, SPY und QQQ.");
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

    app.innerHTML = `
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">MH Analytics Phase 2C</p>
          <h1>Premium Research fuer klare Marktentscheidungen.</h1>
          <p class="hero-text">Ein cleanes Finanz-Cockpit fuer Makro, Aktien, Krypto, Screener, Ratings, Alerts, Watchlist, Sentiment und transparente Datenquellen.</p>
          <div class="hero-actions">
            <button class="primary-button" type="button" data-route="asset">Aktie analysieren</button>
            <button class="ghost-button" type="button" data-route="screener">Screener oeffnen</button>
            <button class="ghost-button" type="button" data-report="topPicks">Top Picks Report</button>
            <button class="ghost-button" type="button" data-route="settings">API Keys eintragen</button>
          </div>
          <div class="hero-meta">
            <div class="meta-tile">
              <strong>${state.watchlist.length}</strong>
              <span>Watchlist Assets</span>
            </div>
            <div class="meta-tile">
              <strong>${countLiveQuotes()}</strong>
              <span>Live Datenpunkte</span>
            </div>
            <div class="meta-tile">
              <strong>0</strong>
              <span>Server noetig</span>
            </div>
          </div>
        </div>
        <aside class="search-card">
          <div>
            <p class="eyebrow">Globale Suche</p>
            <h2>Asset, ETF, Krypto oder Index</h2>
            <p>Enter oder Vorschlag anklicken. Phase 2C verbindet Asset-Seiten, Screener, Ratings, Alerts, ETF, Portfolio und Reports.</p>
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
      ${renderPersonalDashboardPanel()}
      ${renderPersonalModuleStrip()}
      ${renderMacroSection()}
      ${renderTopPicksSection()}

      <section class="section">
        <div class="grid two">
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

  function renderPersonalDashboardPanel() {
    const prefs = dashboardPrefs();
    return `
      <section class="section">
        <article class="card personalization-panel">
          <div class="card-topline">
            <div>
              <span class="card-label">Personal Dashboard V1</span>
              <h3>Continue where you left off</h3>
              <p>Letztes Asset: ${esc(state.activeSymbol)}. Favoriten: ${prefs.favorites.map(esc).join(", ") || "noch keine"}.</p>
            </div>
            ${renderDataMeta(makeMeta("Lokale Dashboard-Personalisierung", "live", Date.now()), true)}
          </div>
          <div class="dashboard-mode-row">
            ${Object.keys(DASHBOARD_MODES).map((mode) => `
              <button class="chip ${prefs.mode === mode ? "active" : ""}" type="button" data-dashboard-mode="${escAttr(mode)}">${esc(capitalize(mode))}</button>
            `).join("")}
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

  function renderMacroSection() {
    const macro = macroForView();
    return `
      <section class="section">
        <div class="section-head">
          <div>
            <h2>Makro-Schnellblick</h2>
            <p>FRED-Daten, wenn ein Key hinterlegt ist. Ohne Key bleibt die Seite stabil mit klar markierten Fallback-Werten.</p>
          </div>
          <button class="ghost-button" type="button" data-route="settings">FRED Key setzen</button>
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
      </section>
    `;
  }

  function renderTopPicksSection() {
    const picks = topPicksForView();
    return `
      <section class="section">
        <div class="section-head">
          <div>
            <h2>Top Picks heute</h2>
            <p>Phase 2C rankt Picks aus Technical Rating, Momentum, Value/Growth, Risiko, Sentiment und Portfolio-Kontext. Research-Tool, keine Anlageberatung.</p>
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
        ${renderDataMeta(makeMeta("Lokales Sektor-Modell", "fallback", BOOT_TIME, "Sektor-Heatmap ist in Phase 2C ein lokales Modell."))}
      </article>
    `;
  }

  function renderWatchlistCard() {
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
          ${rows || renderEmptyState("Noch keine Watchlist. Fuege ein Asset hinzu.")}
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
          <button class="ghost-button" type="button" data-route="research">Oeffnen</button>
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
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Screener V1</p>
            <h1>Rankings statt Bauchgefuehl.</h1>
            <p>Filtere das Phase-2C-Universum nach Momentum, Value, Growth, Market Cap, Sektor und Performance. Funktioniert auch ohne API Keys mit lokaler Research-Datenbank.</p>
          </div>
          <button class="ghost-button" type="button" data-screener-reset>Filter zuruecksetzen</button>
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
            </div>
            ${renderDataMeta(makeMeta("Lokale Screener Engine + verfuegbare Quotes", getOverallDataStatus(), Date.now()), true)}
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
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderEventsPage() {
    const events = eventsForView();
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Events V1</p>
            <h1>Earnings, Dividenden und Makro-Termine.</h1>
            <p>Statische Phase-2C-Version mit professionellen lokalen Fallback-Terminen. Live-Kalender koennen spaeter ueber Finnhub/FMP erweitert werden.</p>
          </div>
        </div>
        <div class="grid two">
          <article class="card">
            <div class="card-topline">
              <div>
                <span class="card-label">Earnings Kalender</span>
                <h3>Asset Events</h3>
              </div>
              ${renderStatusBadge("fallback")}
            </div>
            <div class="event-list">
              ${events.filter((eventItem) => eventItem.type !== "Makro").map(renderEventCard).join("")}
            </div>
          </article>
          <article class="card">
            <div class="card-topline">
              <div>
                <span class="card-label">Makro Kalender</span>
                <h3>Fed / EZB / CPI</h3>
              </div>
              ${renderStatusBadge("fallback")}
            </div>
            <div class="event-list">
              ${events.filter((eventItem) => eventItem.type === "Makro").map(renderEventCard).join("")}
            </div>
          </article>
        </div>
      </section>
    `;
  }

  function renderMacroPage() {
    ensureHomeData();
    const macro = macroEnhancedForView();
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Makro Dashboard 2C</p>
            <h1>Liquiditaet, Zinsen und Risiko in einem Blick.</h1>
            <p>FRED-Daten werden genutzt, wenn ein Key vorhanden ist. ECB, DXY, M1/M3/M4, Realzins und Yield Curve sind als saubere Fallback-/Prepared-Struktur markiert.</p>
          </div>
          <button class="ghost-button" type="button" data-route="settings">Provider pruefen</button>
        </div>
        <div class="grid four macro-deep-grid">
          ${macro.map((item) => renderMacroDeepCard(item)).join("")}
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
          <p>${esc(item.why || "Relevanter Makroindikator fuer Liquiditaet, Risikoappetit und Bewertungen.")}</p>
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
            <p class="eyebrow">ETF System 2C</p>
            <h1>ETF-Kosten, Holdings und Overlap.</h1>
            <p>Lokale strukturierte ETF-Datenbasis mit TER, Regionen, Holdings, Ausschüttungstyp, Basisrisiko und Währungsrisiko. Live-ETF-Provider sind vorbereitet.</p>
          </div>
          ${renderDataMeta(makeMeta("Lokale ETF-Datenbasis", "fallback", BOOT_TIME), true)}
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
          ${renderMiniMetric("Waehrung", etf.currency)}
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
        <p><strong>Waehrungsrisiko:</strong> ${esc(etf.fxRisk)}</p>
        ${renderDataMeta(makeMeta("Lokale ETF-Datenbasis", "fallback", BOOT_TIME))}
      </article>
    `;
  }

  function renderEtfCostCalculator() {
    const amount = Number(state.etf.amount || 0);
    const years = Number(state.etf.years || 0);
    const selected = ETF_DATA.find((etf) => etf.symbol === state.etf.left) || ETF_DATA[0];
    const cost = amount * (selected.ter / 100) * years;
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">ETF Kosten Rechner</span>
            <h3>TER ueber Zeit</h3>
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
        <strong class="value">${formatMoney(cost, selected.currency)}</strong>
        <p>Grobe TER-Kosten ohne Rendite-/Tracking-Error-Effekt.</p>
        ${renderDataMeta(makeMeta("Lokaler ETF-Kostenrechner", "fallback", BOOT_TIME))}
      </article>
    `;
  }

  function renderEtfOverlapChecker() {
    const left = ETF_DATA.find((etf) => etf.symbol === state.etf.left) || ETF_DATA[0];
    const right = ETF_DATA.find((etf) => etf.symbol === state.etf.right) || ETF_DATA[1];
    const overlap = etfOverlap(left, right);
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
        <strong class="value">${formatNumber(overlap.score)}%</strong>
        <p>Geschaetzte Top-Holdings-Ueberschneidung: ${esc(overlap.names.join(", ") || "keine Top-Overlap-Holdings")}.</p>
        ${renderDataMeta(makeMeta("Lokaler ETF-Overlap-Fallback", "fallback", BOOT_TIME))}
      </article>
    `;
  }

  function renderAlertsPage() {
    ensureHomeData();
    checkAlerts(false);
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Alerts V1</p>
            <h1>Lokale Signale, ohne Backend-Zwang.</h1>
            <p>Preis-Alerts, Watchlist-Hinweise und vorbereitete News/Sentiment-Hinweise werden im Browser gespeichert und lokal geprueft.</p>
          </div>
          <button class="ghost-button" type="button" data-alert-check>Jetzt pruefen</button>
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
                </select>
              </label>
              <label class="field">
                <span>Bedingung</span>
                <select name="condition">
                  <option value="above">Preis ueber Ziel</option>
                  <option value="below">Preis unter Ziel</option>
                  <option value="move">Tagesbewegung groesser als %</option>
                </select>
              </label>
              <label class="field">
                <span>Zielwert</span>
                <input name="target" type="number" step="0.01" placeholder="z. B. 900 oder 3">
              </label>
              <button class="primary-button" type="submit">Alert speichern</button>
            </form>
          </article>
          <article class="card">
            <div class="card-topline">
              <div>
                <span class="card-label">Alert Inbox</span>
                <h3>${state.alertInbox.length} Hinweise</h3>
              </div>
              <button class="ghost-button" type="button" data-alert-clear-inbox>Leeren</button>
            </div>
            <div class="stack-list">
              ${state.alertInbox.slice(0, 6).map((item) => `
                <div class="alert-inbox-row">
                  <strong>${esc(item.title)}</strong>
                  <span class="small">${esc(item.message)} | ${formatTimestamp(item.timestamp)}</span>
                </div>
              `).join("") || renderEmptyState("Noch keine Hinweise. Alerts pruefen sich lokal anhand der verfuegbaren Daten.")}
            </div>
          </article>
        </div>
      </section>
      <section class="section">
        <article class="card">
          <div class="card-topline">
            <div>
              <span class="card-label">Gespeicherte Alerts</span>
              <h3>${state.alerts.length} aktive Regeln</h3>
            </div>
            ${renderDataMeta(makeMeta("Lokaler Browser-Speicher", "live", Date.now()), true)}
          </div>
          <div class="alert-list">
            ${state.alerts.map(renderAlertRow).join("") || renderEmptyState("Noch keine Alerts gespeichert.")}
          </div>
        </article>
      </section>
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
    const activeTab = ["overview", "technical", "fundamental", "news", "events", "insider"].includes(state.assetTab) ? state.assetTab : "overview";

    ensureAssetData(symbol);

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
      </section>

      <section class="section">
        <div class="asset-tabbar" role="tablist" aria-label="Asset Bereiche">
          ${renderAssetTab("overview", "Uebersicht", activeTab)}
          ${renderAssetTab("technical", "Technisch", activeTab)}
          ${renderAssetTab("fundamental", "Fundamental", activeTab)}
          ${renderAssetTab("news", "News", activeTab)}
          ${renderAssetTab("events", "Events", activeTab)}
          ${renderAssetTab("insider", "Insider / Institutionelle", activeTab)}
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
    return `
      <section class="section chart-card">
        <div class="chart-topbar">
          <div>
            <span class="card-label">TradingView</span>
            <h2>${esc(symbol)} Chart</h2>
            <p>Offizielles TradingView Advanced Chart Widget. Kein Fake-Chart als Hauptloesung.</p>
          </div>
          <div class="chart-actions">
            <a class="ghost-button" href="${tradingViewUrl(asset)}" target="_blank" rel="noreferrer">Direkt oeffnen</a>
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
              <a class="primary-button" href="${tradingViewUrl(asset)}" target="_blank" rel="noreferrer">Chart direkt bei TradingView oeffnen</a>
            </div>
          </div>
        </div>
      </section>
      <section class="section">
        <div class="grid two">
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
          ${renderSentimentDetail(sentiment)}
        </div>
      </section>
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
                <span class="small">${esc(item.summary || "Keine Zusammenfassung verfuegbar.")}</span>
              </span>
              <span class="pill ${item.sentiment ? item.sentiment.toLowerCase() : ""}">${esc(item.sentiment || "Neutral")}</span>
            </a>
          `).join("") || renderEmptyState("Keine News verfuegbar.")}
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
            ${renderMiniMetric("Insider Kaeufe", String(data.buys.length))}
            ${renderMiniMetric("Insider Verkaeufe", String(data.sells.length))}
          </div>
          <h4>Insider Kaeufe</h4>
          <div class="stack-list">${data.buys.map((row) => renderDataRow(row)).join("")}</div>
          <h4>Insider Verkaeufe</h4>
          <div class="stack-list">${data.sells.map((row) => renderDataRow(row)).join("")}</div>
          ${renderDataMeta(makeMeta("Lokale Insider-Fallback-Datenbank / FMP-Finnhub-EODHD vorbereitet", "fallback", BOOT_TIME))}
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
          <h4>Positionsveraenderungen</h4>
          <div class="stack-list">${data.changes.map((row) => renderDataRow(row)).join("")}</div>
          ${renderDataMeta(makeMeta("Lokale Institutionals-Fallback-Datenbank / FMP-Finnhub-EODHD vorbereitet", "fallback", BOOT_TIME))}
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
        <p>Das Rating ist eine einfache, transparente Heuristik. Es kombiniert RSI, Momentum, Volumen/Aktivitaet, Trend, Sentiment und Risiko. Es ist kein KI-Orakel und keine Anlageberatung.</p>
        <div class="stack-list">
          ${[
            { label: "BUY", text: "Score ab 64: Momentum, Trend und Sentiment sind ueberwiegend konstruktiv." },
            { label: "NEUTRAL", text: "Score 43 bis 63: gemischtes Bild, bestaetigendes Signal abwarten." },
            { label: "SELL", text: "Score bis 42: Risiko, Trend oder Momentum sind auffaellig schwach." }
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
            <p>Phase 2C erweitert Research um Reports, ETF-Analyse, Portfolio-Kontext, Insider-/Institutional-Daten und Makro-Erklaerungen.</p>
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
        <article class="card newsletter-card">
          <div>
            <span class="card-label">Newsletter</span>
            <h2>MH Weekly Research</h2>
            <p>Brevo kann spaeter angebunden werden. Lokal wird nur das Formular-Layout vorbereitet.</p>
          </div>
          <form class="form-grid" onsubmit="return false">
            <label class="field">
              <span>E-Mail</span>
              <input type="email" placeholder="dein.name@example.com">
            </label>
            <button class="primary-button" type="button">Eintragen</button>
          </form>
          ${renderDataMeta(makeMeta("Brevo Placeholder", "fallback", BOOT_TIME, "Newsletter-Backend ist in der statischen Version nicht aktiv."))}
        </article>
      </section>
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
            <p>Mehrere Echtgeld- und Testportfolios laufen lokal im Browser. Cash, Sektor-, Land- und Waehrungs-Exposure werden transparent berechnet.</p>
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
            </div>
            <div class="portfolio-positions">
              ${portfolio.positions.map((position) => renderPortfolioPosition(position)).join("") || renderEmptyState("Noch kein Portfolio angelegt oder keine Positionen vorhanden.")}
            </div>
          </article>
          <article class="card">
            <h3>Exposure & Hinweise</h3>
            ${renderExposureBlock("Sektor", analysis.sectorExposure)}
            ${renderExposureBlock("Land", analysis.countryExposure)}
            ${renderExposureBlock("Waehrung", analysis.currencyExposure)}
            <div class="insight-row"><span class="pill">Klumpenrisiko</span><p>${esc(analysis.concentrationHint)}</p></div>
            <div class="insight-row"><span class="pill">Diversifikation</span><p>${esc(analysis.diversificationHint)}</p></div>
            <div class="insight-row"><span class="pill">Rebalancing</span><p>${esc(analysis.rebalanceHint)}</p></div>
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
            <h3>Position hinzufuegen</h3>
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
            <h3>Was-waere-wenn Simulation</h3>
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
              <input data-search-input data-watch-input placeholder="Symbol hinzufuegen, z. B. META oder ETH" autocomplete="off">
              <div class="suggestions hidden" data-search-suggestions></div>
            </label>
            <button class="primary-button" type="submit">Hinzufuegen</button>
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
    app.innerHTML = `
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Data Providers / API Keys</p>
            <h1>Provider Registry fuer MH Analytics.</h1>
            <p>Zentrale Verwaltung fuer Market Data, Fundamentals, Makro, News, Krypto, Forex, Events, Social, Newsletter und Storage. Keys bleiben in dieser statischen Phase lokal im Browser.</p>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" data-test-all-providers>Konfigurierte testen</button>
            <button class="ghost-button" type="button" data-clear-cache>Daten-Cache leeren</button>
          </div>
        </div>
        <div class="provider-summary-grid">
          ${renderProviderSummary("Live genutzt", providersByStatus("active").length, "Aktive Provider im Datenlayer")}
          ${renderProviderSummary("Vorbereitet", providersByStatus("prepared").length, "Slots fuer spaetere Module")}
          ${renderProviderSummary("Optional", providersByStatus("optional").length, "Erweiterbare Anbieter")}
          ${renderProviderSummary("Backend-only", providersBySecurity("backend-only").length, "Spaeter serverseitig schuetzen")}
        </div>
        <article class="card provider-warning-card">
          <div>
            <h3>Browser-sicher vs. Backend</h3>
            <p>Fuer private lokale Tests ist localStorage okay. Produktiv gehoeren geheime Provider-Keys in ein Backend, Proxy oder Edge Functions. Service-Role-Keys niemals im Browser speichern.</p>
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
            ${renderStatusBadge(getConfiguredProviderCount() ? "live" : "fallback")}
          </div>
          <p>Du kannst mehrere Provider vorbereiten und spaeter schrittweise aktivieren. Bereits aktive Module nutzen automatisch Finnhub, Alpha Vantage, FMP, FRED und CoinGecko, sobald Daten verfuegbar sind.</p>
          <div class="card-actions settings-actions">
            <button class="primary-button" type="button" data-save-api-keys>Alle API Keys speichern</button>
            <button class="ghost-button" type="button" data-test-all-providers>Konfigurierte Provider testen</button>
          </div>
        </article>
      </section>
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

  function renderProviderGroup(group, keys) {
    const providers = PROVIDERS.filter((provider) => provider.group === group.id);
    return `
      <div class="provider-group">
        <div class="section-head compact-section-head">
          <div>
            <h2>${esc(group.label)}</h2>
            <p>${providers.length} Provider-Slots vorbereitet.</p>
          </div>
        </div>
        <div class="provider-grid">
          ${providers.map((provider) => renderProviderCard(provider, keys[provider.id] || "")).join("")}
        </div>
      </div>
    `;
  }

  function renderProviderCard(provider, keyValue) {
    const test = providerTestFor(provider.id);
    const security = providerSecurityLabel(provider.security);
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
        <div class="provider-key-row">
          ${renderProviderKeyField(provider, keyValue)}
        </div>
        <div class="provider-test-row">
          <span class="provider-test-status ${test.className}">${esc(test.label)}</span>
          <span class="small">${esc(test.message || provider.testHint)}</span>
        </div>
        <div class="card-actions provider-actions">
          <button class="ghost-button" type="button" data-test-provider="${escAttr(provider.id)}">Testen</button>
          ${provider.keyMode !== "none" ? `<button class="ghost-button" type="button" data-delete-provider-key="${escAttr(provider.id)}">Key loeschen</button>` : ""}
        </div>
        <div class="provider-security-note">
          <strong>${esc(security.label)}</strong>
          <span>${esc(security.text)}</span>
        </div>
      </article>
    `;
  }

  function renderProviderKeyField(provider, keyValue) {
    if (provider.keyMode === "none") {
      return `
        <div class="keyless-provider">
          <span class="pill">Kein Key noetig</span>
          <span class="small">Oeffentliche oder spaeter serverseitig angebundene Quelle.</span>
        </div>
      `;
    }
    const placeholder = provider.keyMode === "optional" ? "Optionaler API Key / Demo Key" : provider.keyMode === "oauth" ? "OAuth Client/Token spaeter via Backend" : provider.keyMode === "anon" ? "Anon/Public Key oder URL" : `${provider.name} API Key`;
    return `
      <label class="field provider-field">
        <span>${esc(keyModeLabel(provider.keyMode))}</span>
        <input data-api-key="${escAttr(provider.id)}" type="password" value="${escAttr(keyValue)}" placeholder="${escAttr(placeholder)}">
      </label>
    `;
  }

  function providersByStatus(status) {
    return PROVIDERS.filter((provider) => provider.status === status);
  }

  function providersBySecurity(security) {
    return PROVIDERS.filter((provider) => provider.security === security);
  }

  function getConfiguredProviderCount() {
    return Object.values(state.apiKeys).filter((value) => cleanKey(value)).length;
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
        message: "Noch kein Test ausgefuehrt."
      };
    }
    if (test.status === "ok") {
      return {
        label: "Test OK",
        className: "test-ok",
        message: test.message || "Provider hat geantwortet."
      };
    }
    if (test.status === "warn") {
      return {
        label: "Hinweis",
        className: "test-warn",
        message: test.message || "Provider ist vorbereitet, aber nicht live getestet."
      };
    }
    return {
      label: "Fehler",
      className: "test-error",
      message: test.message || "Provider-Test fehlgeschlagen."
    };
  }

  function renderProviderStatusBadge(status) {
    const labels = {
      active: "Live genutzt",
      prepared: "Vorbereitet",
      optional: "Optional",
      backendOnly: "Backend-only"
    };
    const className = status === "active" ? "status-live" : status === "optional" ? "status-fallback" : "status-stale";
    return `<span class="status-badge ${className}">${esc(labels[status] || status)}</span>`;
  }

  function renderProviderSecurityBadge(security) {
    const labels = {
      "browser-ok-private": "Browser privat OK",
      "browser-ok-public": "Public",
      "backend-recommended": "Backend empfohlen",
      "backend-only": "Backend-only",
      "proxy-recommended": "Proxy empfohlen",
      "backend-ready": "Backend-ready"
    };
    const className = security === "backend-only" ? "status-stale" : security.includes("recommended") ? "status-fallback" : "status-live";
    return `<span class="status-badge ${className}">${esc(labels[security] || security)}</span>`;
  }

  function providerSecurityLabel(security) {
    const labels = {
      "browser-ok-private": {
        label: "Browser-sicher fuer lokale private Nutzung",
        text: "Der Key kann lokal gespeichert werden, sollte aber fuer ein echtes Produkt trotzdem kontrolliert werden."
      },
      "browser-ok-public": {
        label: "Public / kein geheimer Key",
        text: "Dieser Slot ist fuer oeffentliche Daten oder keylose Anbindung vorbereitet."
      },
      "backend-recommended": {
        label: "Backend empfohlen",
        text: "Fuer Produktion besser per Backend, Proxy oder Edge Function nutzen, damit Keys nicht sichtbar werden."
      },
      "backend-only": {
        label: "Backend-only",
        text: "Nicht direkt aus dem Browser aufrufen. Key/OAuth gehoert spaeter serverseitig geschuetzt."
      },
      "proxy-recommended": {
        label: "Proxy empfohlen",
        text: "Public/Demo kann lokal funktionieren; produktionsnah besser per Key und Proxy/Backend."
      },
      "backend-ready": {
        label: "Backend-ready",
        text: "Fuer spaetere Auth, Datenbank und Edge Functions vorbereitet."
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
      state.lastHomeRefresh = Date.now();
      checkAlerts(false);
    } catch (error) {
      logError(error);
    } finally {
      state.loadingHome = false;
      if (["home", "portfolio"].includes(state.route)) {
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
      const [quote, profile, fundamentals, news] = await Promise.all([
        api.getQuote(symbol),
        api.getProfile(symbol),
        api.getFundamentals(symbol),
        api.getCompanyNews(symbol)
      ]);
      state.quotes[symbol] = quote;
      state.profiles[symbol] = profile;
      state.fundamentals[symbol] = fundamentals;
      state.news[symbol] = news;
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

  const api = {
    async getQuote(symbol) {
      const asset = getAsset(symbol);

      if (asset.type === "Crypto") {
        return this.getCryptoQuote(symbol);
      }

      if (asset.type === "Commodity" || asset.type === "Index") {
        return fallbackQuote(symbol, "Kostenlose Live-Quelle fuer dieses Asset nicht konfiguriert.");
      }

      const finnhubKey = cleanKey(state.apiKeys.finnhub);
      if (finnhubKey) {
        try {
          const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(finnhubKey)}`;
          const result = await cachedJson(`finnhub:quote:${symbol}`, url, CACHE_TTL.quote);
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
      }

      const alphaKey = cleanKey(state.apiKeys.alphaVantage);
      if (alphaKey) {
        try {
          const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(alphaKey)}`;
          const result = await cachedJson(`alpha:quote:${symbol}`, url, CACHE_TTL.quote);
          const quote = result.data && result.data["Global Quote"];
          if (!quote || !quote["05. price"]) {
            throw new Error("Alpha Vantage Quote nicht verfuegbar");
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
      }

      return fallbackQuote(symbol, "Kein Quote-Key oder API-Fehler.");
    },

    async getCryptoQuote(symbol) {
      const asset = getAsset(symbol);
      if (!asset.coingeckoId) {
        return fallbackQuote(symbol, "Kein CoinGecko Mapping.");
      }
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(asset.coingeckoId)}&vs_currencies=usd&include_market_cap=true&include_24hr_change=true`;
        const result = await cachedJson(`coingecko:quote:${symbol}`, url, CACHE_TTL.quote);
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
          const result = await cachedJson(`finnhub:profile:${symbol}`, url, CACHE_TTL.profile);
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
      }

      const fmpKey = cleanKey(state.apiKeys.fmp);
      if (fmpKey) {
        try {
          const url = `https://financialmodelingprep.com/api/v3/profile/${encodeURIComponent(symbol)}?apikey=${encodeURIComponent(fmpKey)}`;
          const result = await cachedJson(`fmp:profile:${symbol}`, url, CACHE_TTL.profile);
          const row = Array.isArray(result.data) ? result.data[0] : null;
          if (!row) {
            throw new Error("FMP Profil leer");
          }
          return {
            symbol,
            name: row.companyName || asset.name,
            exchange: row.exchangeShortName || "",
            sector: row.sector || asset.sector,
            country: row.country || "",
            marketCap: numberOrNull(row.mktCap) || asset.fallback.marketCap,
            logo: row.image || "",
            meta: makeMeta("Financial Modeling Prep Profile", result.status, result.timestamp)
          };
        } catch (error) {
          logError(error);
        }
      }

      return base;
    },

    async getFundamentals(symbol) {
      const asset = getAsset(symbol);
      if (!["Stock", "ETF"].includes(asset.type)) {
        return fallbackFundamentals(symbol, "Fundamentals fuer diesen Asset-Typ lokal gemappt.");
      }

      const fmpKey = cleanKey(state.apiKeys.fmp);
      if (fmpKey) {
        try {
          const url = `https://financialmodelingprep.com/api/v3/profile/${encodeURIComponent(symbol)}?apikey=${encodeURIComponent(fmpKey)}`;
          const result = await cachedJson(`fmp:fundamentals:${symbol}`, url, CACHE_TTL.fundamentals);
          const row = Array.isArray(result.data) ? result.data[0] : null;
          if (!row) {
            throw new Error("FMP Fundamentals leer");
          }
          return {
            symbol,
            marketCap: numberOrNull(row.mktCap) || asset.fallback.marketCap,
            pe: numberOrNull(row.pe) || asset.fallback.pe,
            eps: numberOrNull(row.eps) || asset.fallback.eps,
            revenue: asset.fallback.revenue,
            profit: analysisFor(symbol).profit,
            margin: analysisFor(symbol).margin,
            grossMargin: analysisFor(symbol).grossMargin,
            cashflow: analysisFor(symbol).cashflow,
            debt: analysisFor(symbol).debt,
            revenueGrowth: analysisFor(symbol).revenueGrowth,
            beta: numberOrNull(row.beta),
            meta: makeMeta("Financial Modeling Prep Profile", result.status, result.timestamp)
          };
        } catch (error) {
          logError(error);
        }
      }

      const finnhubKey = cleanKey(state.apiKeys.finnhub);
      if (finnhubKey) {
        try {
          const url = `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${encodeURIComponent(finnhubKey)}`;
          const result = await cachedJson(`finnhub:metric:${symbol}`, url, CACHE_TTL.fundamentals);
          const metric = result.data && result.data.metric ? result.data.metric : {};
          if (!Object.keys(metric).length) {
            throw new Error("Finnhub Metrics leer");
          }
          return {
            symbol,
            marketCap: asset.fallback.marketCap,
            pe: firstNumber(metric.peBasicExclExtraTTM, metric.peNormalizedAnnual, asset.fallback.pe),
            eps: firstNumber(metric.epsBasicExclExtraItemsTTM, metric.epsInclExtraItemsTTM, asset.fallback.eps),
            revenue: asset.fallback.revenue,
            profit: analysisFor(symbol).profit,
            margin: analysisFor(symbol).margin,
            grossMargin: analysisFor(symbol).grossMargin,
            cashflow: analysisFor(symbol).cashflow,
            debt: analysisFor(symbol).debt,
            revenueGrowth: analysisFor(symbol).revenueGrowth,
            beta: firstNumber(metric.beta, null),
            meta: makeMeta("Finnhub Basic Financials", result.status, result.timestamp)
          };
        } catch (error) {
          logError(error);
        }
      }

      return fallbackFundamentals(symbol, "Kein Fundamentals-Key oder API-Fehler.");
    },

    async getCompanyNews(symbol) {
      const asset = getAsset(symbol);
      if (!["Stock", "ETF"].includes(asset.type)) {
        return fallbackNews(symbol, "Company News fuer diesen Asset-Typ lokal gemappt.");
      }

      const finnhubKey = cleanKey(state.apiKeys.finnhub);
      if (finnhubKey) {
        try {
          const to = toIsoDate(new Date());
          const from = toIsoDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));
          const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${encodeURIComponent(finnhubKey)}`;
          const result = await cachedJson(`finnhub:news:${symbol}`, url, CACHE_TTL.news);
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
      }

      return fallbackNews(symbol, "Kein Finnhub News-Key oder API-Fehler.");
    },

    async getMacro() {
      const fredKey = cleanKey(state.apiKeys.fred);
      if (!fredKey) {
        return fallbackMacro("Kein FRED Key hinterlegt.");
      }

      try {
        const series = [
          { id: "FEDFUNDS", label: "Fed Funds Rate", suffix: "%", mode: "level" },
          { id: "CPIAUCSL", label: "US CPI / Inflation", suffix: "%", mode: "inflation" },
          { id: "UNRATE", label: "Arbeitslosenquote", suffix: "%", mode: "level" },
          { id: "DGS10", label: "US 10Y Yield", suffix: "%", mode: "level" }
        ];
        const rows = await Promise.all(series.map((item) => fetchFredSeries(item, fredKey)));
        rows.push({
          id: "DXY",
          label: "DXY Dollar Index",
          value: 104.2,
          display: "104.2",
          trend: "Placeholder, spaeter ueber Markt-API anbinden",
          meta: makeMeta("Lokaler DXY Placeholder", "fallback", BOOT_TIME)
        });
        return rows;
      } catch (error) {
        logError(error);
        return fallbackMacro("FRED API nicht erreichbar, Rate Limit oder CORS-Block.");
      }
    }
  };

  async function fetchFredSeries(item, key) {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(item.id)}&api_key=${encodeURIComponent(key)}&file_type=json&sort_order=desc&limit=14`;
    const result = await cachedJson(`fred:${item.id}`, url, CACHE_TTL.macro);
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

    if (item.mode === "inflation") {
      const yearAgo = observations.find((row) => row.date.slice(5, 7) === latest.date.slice(5, 7) && row.date.slice(0, 4) !== latest.date.slice(0, 4));
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
      meta: makeMeta(`FRED ${item.id}`, result.status, result.timestamp || Date.parse(latest.date))
    };
  }

  async function cachedJson(cacheKey, url, maxAge) {
    const cache = storageGet(STORAGE_KEYS.cache, {});
    const cached = cache[cacheKey];

    if (cached && Date.now() - cached.timestamp < maxAge) {
      return { data: cached.data, timestamp: cached.timestamp, status: "live" };
    }

    try {
      const data = await fetchJson(url);
      const entry = { timestamp: Date.now(), data };
      cache[cacheKey] = entry;
      storageSet(STORAGE_KEYS.cache, trimCache(cache));
      return { data, timestamp: entry.timestamp, status: "live" };
    } catch (error) {
      if (cached) {
        return { data: cached.data, timestamp: cached.timestamp, status: "stale" };
      }
      throw error;
    }
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
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
    return [...base, ...MACRO_EXTENSIONS.map((item) => ({
      ...item,
      meta: makeMeta(item.source, item.status, BOOT_TIME)
    }))];
  }

  function macroWhy(id) {
    const text = {
      FEDFUNDS: "Leitzinsen setzen den Takt fuer Finanzierungskosten, Bewertungsmultiples und Risk-on/Risk-off.",
      CPIAUCSL: "Inflation bestimmt, wie viel Spielraum Zentralbanken fuer Zinssenkungen haben.",
      UNRATE: "Der Arbeitsmarkt zeigt, ob Wachstum robust bleibt oder eine Abkuehlung droht.",
      DGS10: "Die 10Y-Rendite ist ein zentraler Diskontierungsanker fuer Aktien und Gold.",
      DXY: "Der Dollar beeinflusst Rohstoffe, Emerging Markets, US-Gewinne und globale Liquiditaet."
    };
    return text[id] || "Makroindikator fuer Liquiditaet, Wachstum, Inflation oder Risikoappetit.";
  }

  function macroMeaning(id) {
    const text = {
      FEDFUNDS: "Steigend wirkt restriktiv; fallend kann Risikoassets entlasten.",
      CPIAUCSL: "Steigende Inflation belastet Zinssenkungsfantasie; fallende Inflation hilft Multiples.",
      UNRATE: "Starker Anstieg kann Rezessionsrisiko signalisieren; zu niedrige Werte koennen Lohndruck bedeuten.",
      DGS10: "Steigende Renditen belasten lange Duration; fallende Renditen helfen Growth und Gold.",
      DXY: "Dollar-Staerke kann Rohstoffe und internationale Gewinne belasten."
    };
    return text[id] || "Interpretation haengt von Trend, Niveau und Marktregime ab.";
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
      meta: makeMeta("Lokales Sentiment-Modell + verfuegbare Daten", status, Date.now(), "Kein externes AI-Sentiment erforderlich.")
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
        { label: "Volumen / Aktivitaet", score: Math.round(volumeScore), text: volumeScore >= 65 ? "Aktivitaet ueberdurchschnittlich." : "Aktivitaet normal bis ruhig." },
        { label: "Trend", score: Math.round(trendScore), text: trendScore >= 65 ? "Trendstruktur konstruktiv." : trendScore <= 42 ? "Trendstruktur angeschlagen." : "Trend gemischt." },
        { label: "Sentiment", score: Math.round(sentimentScore), text: sentimentScore >= 65 ? "Sentiment unterstuetzt das Setup." : "Sentiment liefert kein klares Signal." },
        { label: "Volatilitaet / Risiko", score: Math.round(riskScore), text: analysis.volatility >= 70 ? "Erhoehtes Risiko und groessere Schwankungen." : "Risiko im Modell kontrollierbar." }
      ],
      meta: makeMeta("Lokales Regelmodell + Quote-Daten", quote.meta.status, quote.meta.timestamp, "Keine Fake-Charts, nur Kurzrating aus Datenpunkten.")
    };
  }

  function analysisFor(symbol) {
    const asset = getAsset(symbol);
    return ANALYTIC_DATA[asset.symbol] || {
      rsi: 50,
      momentum: 50,
      volume: 50,
      trend: 50,
      volatility: 50,
      value: 50,
      growth: 50,
      quality: 50,
      performance1m: asset.fallback.changePct || 0,
      performance6m: 0,
      margin: null,
      grossMargin: null,
      profit: null,
      cashflow: null,
      debt: null,
      revenueGrowth: null,
      levels: { support: asset.fallback.price * 0.94, resistance: asset.fallback.price * 1.08 }
    };
  }

  function snapshotFor(symbol) {
    const asset = getAsset(symbol);
    const quote = quoteFor(symbol);
    const fundamentals = fundamentalsFor(symbol);
    const analysis = analysisFor(symbol);
    const rating = technicalFor(symbol, quote);
    const marketCap = valueOr(valueOr(fundamentals.marketCap, quote.marketCap), asset.fallback.marketCap);
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
      name: asset.name,
      sector: asset.sector,
      type: asset.type,
      currency: asset.currency,
      quote,
      fundamentals,
      analysis,
      rating,
      marketCap,
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
        setup: row.rating.rating === "BUY" ? "Momentum bestaetigt" : "Qualitaet beobachten",
        reason: row.pickReason
      }));
    const risk = rows
      .sort((a, b) => riskRank(b) - riskRank(a))
      .slice(0, 5)
      .map((row) => ({
        symbol: row.symbol,
        direction: row.rating.rating === "SELL" ? "Bearish" : "Risk",
        score: riskRank(row),
        setup: row.rating.rating === "SELL" ? "Trend/Risiko schwach" : "Volatilitaet hoch",
        reason: row.rating.rating === "SELL" ? row.rating.reason : "Setup hat Chance, aber Risiko/Volatilitaet ist ueberdurchschnittlich."
      }));
    return { long, risk };
  }

  function eventsForView() {
    return FALLBACK_EVENTS.map((eventItem) => {
      const date = new Date(Date.now() + eventItem.dateOffset * 24 * 60 * 60 * 1000);
      return {
        ...eventItem,
        date,
        meta: makeMeta("Lokaler Event-Fallback", "fallback", BOOT_TIME, "Live-Kalender kann spaeter ueber Finnhub/FMP angebunden werden.")
      };
    }).sort((a, b) => a.date - b.date);
  }

  function eventsForSymbol(symbol) {
    return eventsForView().filter((eventItem) => eventItem.symbol === symbol || eventItem.symbol === "Macro").slice(0, 6);
  }

  function renderEventCard(eventItem) {
    const symbolButton = assetMap.has(eventItem.symbol) ? `data-symbol="${escAttr(eventItem.symbol)}"` : "";
    return `
      <button class="event-card" type="button" ${symbolButton}>
        <span class="pill">${esc(eventItem.type)}</span>
        <strong>${esc(eventItem.title)}</strong>
        <span class="small">${eventItem.date.toLocaleDateString("de-DE")} | ${esc(eventItem.symbol)}</span>
        <p>${esc(eventItem.detail)}</p>
        ${renderDataMeta(eventItem.meta, true)}
      </button>
    `;
  }

  function renderAssetEventsCard(symbol, events) {
    return `
      <article class="card">
        <div class="card-topline">
          <div>
            <span class="card-label">Events</span>
            <h3>${esc(symbol)} Termine</h3>
          </div>
          ${renderStatusBadge("fallback")}
        </div>
        <div class="event-list">
          ${events.map(renderEventCard).join("") || renderEmptyState("Keine Events fuer dieses Asset im lokalen Kalender.")}
        </div>
        ${renderDataMeta(makeMeta("Lokaler Event-Fallback", "fallback", BOOT_TIME))}
      </article>
    `;
  }

  function renderAlertRow(alert) {
    const asset = getAsset(alert.symbol);
    const quote = quoteFor(alert.symbol);
    return `
      <div class="alert-row">
        <button class="symbol-button" type="button" data-symbol="${escAttr(alert.symbol)}">
          <strong>${esc(alert.symbol)} - ${esc(asset.name)}</strong>
          <span>${esc(alertLabel(alert))}</span>
        </button>
        <span class="right-cell">
          <strong>${formatMoney(quote.price, asset.currency)}</strong>
          <span class="${alert.status === "triggered" ? "bull" : "neutral"}">${esc(alert.status === "triggered" ? "Ausgeloest" : "Aktiv")}</span>
        </span>
        <button class="icon-button danger-button" type="button" data-alert-delete="${escAttr(alert.id)}" aria-label="Alert loeschen">X</button>
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
    return {
      score: overlap.reduce((sum, [, weight]) => sum + weight, 0),
      names: overlap.map(([name]) => name)
    };
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
    return {
      totalValue,
      performanceAbs,
      performancePct,
      cashPct,
      sectorExposure,
      countryExposure,
      currencyExposure,
      concentrationHint: maxSector.value > 45 ? `Klumpenrisiko: ${maxSector.label} liegt bei ${formatNumber(maxSector.value)}%.` : "Kein extremes Sektor-Klumpenrisiko im lokalen Modell.",
      diversificationHint: positions.length < 4 ? "Diversifikation ist noch gering; weitere Bausteine pruefen." : "Diversifikation wirkt fuer ein lokales Modell solide.",
      rebalanceHint: cashPct > (portfolio.targetCash + 8) ? "Cash liegt ueber Ziel: Reinvestition oder Zielquote pruefen." : cashPct < Math.max(0, portfolio.targetCash - 5) ? "Cash liegt unter Ziel: Liquiditaetspuffer pruefen." : "Cash-Anteil nahe Zielallokation."
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
      ${renderDataMeta(makeMeta("Lokale Was-waere-wenn Simulation", "live", Date.now()))}
    `;
  }

  function countryFor(symbol) {
    if (["DAX"].includes(symbol)) {
      return "Deutschland";
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
          <button class="ghost-button" type="button" data-close-report>Schliessen</button>
          <button class="primary-button" type="button" data-print-report>Als PDF speichern / Drucken</button>
        </div>
        <article class="report-page">
          <header class="report-header">
            <span>MH Analytics Research</span>
            <h1>${esc(title)}</h1>
            <p>${new Date().toLocaleDateString("de-DE")} | Statische Report-Ansicht fuer Browser-PDF</p>
          </header>
          ${body}
          <footer class="report-footer">
            <strong>Quellen / Status</strong>
            <p>API-Daten, lokale Fallback-Daten und vorbereitete Provider-Slots sind jeweils in der App gekennzeichnet. Keine Anlageberatung.</p>
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
    return `
      <section class="report-section">
        <h2>${esc(asset.symbol)} - ${esc(asset.name)}</h2>
        <div class="report-grid">
          ${renderMiniMetric("Preis", formatMoney(quote.price, asset.currency))}
          ${renderMiniMetric("Tagesveraenderung", formatPercent(quote.changePct))}
          ${renderMiniMetric("Rating", technical.rating)}
          ${renderMiniMetric("KGV", formatNumber(valueOr(fundamentals.pe, asset.fallback.pe), "x"))}
        </div>
        <p>${esc(asset.thesis)}</p>
        <p>${esc(technical.reason)}</p>
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
        </div>
        <p>${esc(analysis.concentrationHint)} ${esc(analysis.rebalanceHint)}</p>
        ${renderDataMeta(makeMeta("Lokaler Portfolio Report", "live", Date.now()))}
      </section>
    `;
  }

  function topPicksReportBody() {
    const picks = topPicksForView();
    return `
      <section class="report-section">
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
      return `Starkes Rating, Trend ${Math.round(analysis.trend)} und Momentum ${Math.round(analysis.momentum)} sprechen fuer relative Staerke.`;
    }
    if (rating.rating === "SELL") {
      return `Rating ist schwach; Momentum und Risiko sprechen fuer Vorsicht.`;
    }
    if (score >= 65) {
      return "Qualitaet und Growth sind solide, aber das technische Signal braucht Bestaetigung.";
    }
    return "Gemischtes Setup, eher Watchlist-Kandidat als aktiver Pick.";
  }

  function createAlertFromForm(form) {
    const formData = new FormData(form);
    const symbol = normalizeSymbol(formData.get("symbol"));
    const type = String(formData.get("type") || "price");
    const condition = String(formData.get("condition") || "above");
    const target = Number(formData.get("target"));

    if (!assetMap.has(symbol)) {
      toast("Alert konnte nicht gespeichert werden: Asset fehlt.");
      return;
    }
    if (type === "price" && !Number.isFinite(target)) {
      toast("Bitte einen Zielwert fuer den Preis-Alert eintragen.");
      return;
    }
    if (condition === "move" && !Number.isFinite(target)) {
      toast("Bitte eine Prozent-Schwelle fuer die Tagesbewegung eintragen.");
      return;
    }

    const alert = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      symbol,
      type,
      condition,
      target: Number.isFinite(target) ? target : null,
      status: "active",
      createdAt: Date.now(),
      lastCheckedAt: null
    };
    state.alerts = [alert, ...state.alerts].slice(0, 40);
    storageSet(STORAGE_KEYS.alerts, state.alerts);
    toast("Alert gespeichert.");
    form.reset();
    checkAlerts(false);
    render();
  }

  function deleteAlertById(id) {
    state.alerts = state.alerts.filter((alert) => alert.id !== id);
    storageSet(STORAGE_KEYS.alerts, state.alerts);
    toast("Alert geloescht.");
    render();
  }

  function checkAlerts(showToast) {
    let triggered = 0;
    state.alerts = state.alerts.map((alert) => {
      const quote = quoteFor(alert.symbol);
      const wasTriggered = alert.status === "triggered";
      const isTriggered = evaluateAlert(alert, quote);
      if (isTriggered && !wasTriggered) {
        triggered += 1;
        state.alertInbox = [
          {
            id: `${alert.id}-${Date.now()}`,
            title: `${alert.symbol} Alert`,
            message: alertLabel(alert),
            timestamp: Date.now()
          },
          ...state.alertInbox
        ].slice(0, 30);
      }
      return {
        ...alert,
        status: isTriggered ? "triggered" : "active",
        lastCheckedAt: Date.now()
      };
    });
    storageSet(STORAGE_KEYS.alerts, state.alerts);
    storageSet(STORAGE_KEYS.alertInbox, state.alertInbox);
    if (showToast) {
      toast(triggered ? `${triggered} Alert(s) ausgeloest.` : "Keine neuen Alerts ausgeloest.");
    }
  }

  function evaluateAlert(alert, quote) {
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
      return "Watchlist-Hinweis bei groesserer Tagesbewegung";
    }
    if (alert.type === "sentiment") {
      return "News-/Sentiment-Hinweis vorbereitet";
    }
    if (alert.condition === "below") {
      return `Preis unter ${formatMoney(alert.target, getAsset(alert.symbol).currency)}`;
    }
    if (alert.condition === "move") {
      return `Tagesbewegung groesser als ${formatNumber(alert.target)}%`;
    }
    return `Preis ueber ${formatMoney(alert.target, getAsset(alert.symbol).currency)}`;
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
        text: "Qualitaet, Wachstum und Cashflow wirken im lokalen Modell konstruktiv. Bewertung und Erwartungsniveau bleiben trotzdem wichtig."
      };
    }
    if (value < 42 || quality < 50 || (debt && cashflow && debt > cashflow * 4)) {
      return {
        label: "Vorsichtig",
        text: "Das Modell sieht Bewertungs-, Qualitaets- oder Bilanzrisiken. Kennzahlen sollten vor einer Entscheidung genauer geprueft werden."
      };
    }
    return {
      label: "Neutral",
      text: "Fundamentales Bild ist gemischt: einzelne Staerken sind sichtbar, aber kein klarer Qualitaets- oder Value-Vorsprung."
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
      return "ueberhitzt";
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
      return `BUY, weil Trend (${Math.round(values.trendScore)}) und Momentum (${Math.round(values.momentumScore)}) ueberdurchschnittlich sind und das Risiko noch tragbar wirkt.`;
    }
    if (rating === "SELL") {
      return `SELL, weil Momentum, Trend oder Risiko ein schwaches Setup anzeigen. Tagesbewegung: ${formatPercent(values.change)}.`;
    }
    return `NEUTRAL, weil die Komponenten gemischt sind. Fuer ein klares Signal braucht es staerkeren Trend oder bessere Risiko-Bestaetigung.`;
  }

  function chanceRiskText(rating, volatility) {
    if (rating === "BUY" && volatility < 55) {
      return "gut";
    }
    if (rating === "SELL" || volatility > 75) {
      return "erhoehtes Risiko";
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
      toast("Asset nicht gefunden. Nutze z. B. NVDA, MSFT, AAPL, BTC, ETH, GOLD, DAX oder SPY.");
      return;
    }
    if (state.watchlist.includes(symbol)) {
      toast(`${symbol} ist bereits in der Watchlist.`);
      return;
    }
    state.watchlist = unique([...state.watchlist, symbol]);
    storageSet(STORAGE_KEYS.watchlist, state.watchlist);
    ensureHomeData(true);
    toast(`${symbol} wurde zur Watchlist hinzugefuegt.`);
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
        message: "Key geloescht. Provider nutzt Fallback oder ist nur vorbereitet."
      }
    };
    storageSet(STORAGE_KEYS.apiKeys, state.apiKeys);
    storageSet(STORAGE_KEYS.providerTests, state.providerTests);
    storageSet(STORAGE_KEYS.cache, {});
    toast(`${provider.name} Key geloescht.`);
    render();
  }

  async function testProviderById(providerId) {
    const provider = providerById(providerId);
    if (!provider) {
      return;
    }

    state.apiKeys = collectApiKeysFromInputs();
    storageSet(STORAGE_KEYS.apiKeys, state.apiKeys);
    setProviderTest(providerId, "warn", "Test laeuft lokal im Browser...");
    render();

    const key = cleanKey(state.apiKeys[providerId]);
    if (provider.security === "backend-only") {
      setProviderTest(providerId, "warn", "Backend-only: Test im Browser bewusst nicht ausgefuehrt.");
      toast(`${provider.name}: Backend-only, spaeter serverseitig testen.`);
      render();
      return;
    }
    if (["required", "oauth", "anon"].includes(provider.keyMode) && !key) {
      setProviderTest(providerId, "warn", "Kein Key hinterlegt. Slot bleibt vorbereitet oder nutzt Fallbacks.");
      toast(`${provider.name}: kein Key gespeichert.`);
      render();
      return;
    }
    if (!provider.testUrl) {
      setProviderTest(providerId, "warn", "Kein Browser-Test hinterlegt. Provider-Slot ist vorbereitet.");
      toast(`${provider.name}: Slot vorbereitet, noch kein Live-Test.`);
      render();
      return;
    }

    try {
      const url = provider.testUrl(key);
      await fetchJson(url);
      setProviderTest(providerId, "ok", "Provider hat im Browser-Test geantwortet.");
      toast(`${provider.name}: Test erfolgreich.`);
    } catch (error) {
      setProviderTest(providerId, "error", "Test fehlgeschlagen. Moeglich: falscher Key, Rate Limit, CORS oder offline.");
      toast(`${provider.name}: Test fehlgeschlagen.`);
      logError(error);
    }
    render();
  }

  async function testConfiguredProviders() {
    state.apiKeys = collectApiKeysFromInputs();
    storageSet(STORAGE_KEYS.apiKeys, state.apiKeys);
    const testable = PROVIDERS.filter((provider) => {
      if (provider.security === "backend-only") {
        return false;
      }
      if (provider.testUrl && ["none", "optional"].includes(provider.keyMode)) {
        return true;
      }
      return Boolean(provider.testUrl && cleanKey(state.apiKeys[provider.id]));
    });
    if (!testable.length) {
      toast("Keine testbaren Provider konfiguriert. Public/Demo Slots oder Keys eintragen.");
      return;
    }
    for (const provider of testable.slice(0, 6)) {
      await testProviderById(provider.id);
    }
  }

  function setProviderTest(providerId, status, message) {
    state.providerTests = {
      ...state.providerTests,
      [providerId]: {
        status,
        message,
        timestamp: Date.now()
      }
    };
    storageSet(STORAGE_KEYS.providerTests, state.providerTests);
  }

  function exportWatchlist() {
    const lines = ["Symbol,Name,Preis,Tagesveraenderung,Status,Quelle"];
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
      return "Veraltete Cache-Daten aktiv, API wird spaeter erneut versucht.";
    }
    return "Fallback-Daten aktiv. Trage API Keys ein fuer Live-Daten.";
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
      return "Nahezu unveraendert";
    }
    return delta > 0 ? `Steigt um ${formatNumber(delta)} Punkte` : `Faellt um ${formatNumber(Math.abs(delta))} Punkte`;
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
