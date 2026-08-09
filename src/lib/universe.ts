export type Meta = { name: string; sector: string };

export const UNIVERSE: Record<string, Meta> = {
  AAPL: { name: "Apple Inc.", sector: "Technology" },
  MSFT: { name: "Microsoft Corp.", sector: "Technology" },
  NVDA: { name: "NVIDIA Corp.", sector: "Semiconductors" },
  GOOGL: { name: "Alphabet Inc.", sector: "Communication" },
  AMZN: { name: "Amazon.com Inc.", sector: "Consumer" },
  META: { name: "Meta Platforms", sector: "Communication" },
  TSLA: { name: "Tesla Inc.", sector: "Automotive" },
  JPM: { name: "JPMorgan Chase", sector: "Financials" },
  JNJ: { name: "Johnson & Johnson", sector: "Healthcare" },
  XOM: { name: "Exxon Mobil", sector: "Energy" },
  KO: { name: "Coca-Cola Co.", sector: "Consumer Staples" },
  PG: { name: "Procter & Gamble", sector: "Consumer Staples" },
  "RELIANCE.NS": { name: "Reliance Industries", sector: "Energy" },
  "TCS.NS": { name: "Tata Consultancy Services", sector: "Technology" },
  "INFY.NS": { name: "Infosys Ltd.", sector: "Technology" },
  "HDFCBANK.NS": { name: "HDFC Bank", sector: "Financials" },
  "ICICIBANK.NS": { name: "ICICI Bank", sector: "Financials" },
  "ITC.NS": { name: "ITC Ltd.", sector: "Consumer Staples" },
  SPY: { name: "SPDR S&P 500 ETF", sector: "ETF" },
  QQQ: { name: "Invesco QQQ Trust", sector: "ETF" },
  IWM: { name: "iShares Russell 2000", sector: "ETF" },
  VTI: { name: "Vanguard Total Market", sector: "ETF" },
  "BTC-USD": { name: "Bitcoin", sector: "Crypto" },
  "ETH-USD": { name: "Ethereum", sector: "Crypto" },
  "SOL-USD": { name: "Solana", sector: "Crypto" },
  "EURUSD=X": { name: "Euro / US Dollar", sector: "Forex" },
  "USDINR=X": { name: "US Dollar / Rupee", sector: "Forex" },
  "GBPUSD=X": { name: "Pound / US Dollar", sector: "Forex" },
};

export const US_SYMS = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM"];
export const IN_SYMS = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS", "ITC.NS"];
export const SCREENER_SYMS = [...US_SYMS, ...IN_SYMS];
export const ETF_SYMS = ["SPY", "QQQ", "IWM", "VTI"];
export const CRYPTO_SYMS = ["BTC-USD", "ETH-USD", "SOL-USD"];
export const FOREX_SYMS = ["EURUSD=X", "USDINR=X", "GBPUSD=X"];

export type QuoteLike = {
  symbol: string;
  changePercent: number | null;
  price: number | null;
  yearHigh: number | null;
  marketCap: number | null;
};

export const PRESETS: Record<string, { title: string; syms: string[]; test?: (q: QuoteLike) => boolean }> = {
  "m-high": { title: "High Momentum", syms: SCREENER_SYMS, test: (q) => (q.changePercent ?? 0) > 0.5 },
  "m-breakouts": { title: "Breakouts", syms: SCREENER_SYMS, test: (q) => (q.changePercent ?? 0) > 1.5 },
  "m-52w": {
    title: "52-Week Highs",
    syms: SCREENER_SYMS,
    test: (q) => !!q.price && !!q.yearHigh && q.price >= q.yearHigh * 0.95,
  },
  "v-lowpe": { title: "Low P/E", syms: SCREENER_SYMS },
  "v-divkings": { title: "Dividend Kings", syms: ["KO", "PG", "JNJ", "XOM", "ITC.NS"] },
  "v-fcf": { title: "High FCF Yield", syms: ["AAPL", "MSFT", "XOM", "JPM", "TCS.NS"] },
  "g-revenue": { title: "Revenue Growth", syms: ["NVDA", "META", "AMZN", "TSLA", "INFY.NS"] },
  "g-roe": { title: "High ROE", syms: ["AAPL", "MSFT", "TCS.NS", "ITC.NS", "JNJ"] },
  "vol-volume": { title: "Unusual Volume", syms: SCREENER_SYMS },
  "vol-earnings": { title: "Earnings Plays", syms: US_SYMS },
};
