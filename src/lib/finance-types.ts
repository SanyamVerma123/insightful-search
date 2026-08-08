import type { Candle, SeriesPoint, StatementTable } from "./finance-normalize";

export type Quote = {
  symbol: string;
  name: string;
  exchange: string | null;
  currency: string | null;
  price: number | null;
  previousClose: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  marketCap: number | null;
  changePercent: number | null;
  change: number | null;
};

export type KeyRatios = {
  sector: string | null;
  industry: string | null;
  country: string | null;
  summary: string | null;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  enterpriseToEbitda: number | null;
  profitMargins: number | null;
  operatingMargins: number | null;
  returnOnEquity: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  beta: number | null;
  targetMeanPrice: number | null;
  recommendationKey: string | null;
  numberOfAnalystOpinions: number | null;
};

export type StockSummary = { quote: Quote; ratios: KeyRatios };

export type NewsItem = {
  title: string;
  publisher: string | null;
  link: string;
  pubDate: string | null;
  summary: string | null;
};

export type SearchResult = {
  symbol: string;
  name: string;
  exchange: string | null;
  type: string | null;
  sector: string | null;
};

export type AnalystSummary = {
  distribution: { period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }[];
  targets: { current: number | null; low: number | null; mean: number | null; median: number | null; high: number | null };
  earningsHistory: { date: string; actual: number | null; estimate: number | null; surprisePercent: number | null }[];
};

export type CalendarInfo = {
  earningsDate: string | null;
  exDividendDate: string | null;
  dividendDate: string | null;
  earningsLow: number | null;
  earningsAverage: number | null;
  earningsHigh: number | null;
  revenueAverage: number | null;
};

export type CorporateActions = {
  dividends: { date: string; amount: number }[];
  splits: { date: string; ratio: number }[];
};

export type CompareSeries = { symbol: string; points: SeriesPoint[] };

export type IndexQuote = {
  key: string;
  label: string;
  points: SeriesPoint[];
  last: number | null;
  changePercent: number | null;
};

export type { Candle, SeriesPoint, StatementTable };

export const RANGES = [
  { key: "1d", label: "1D", period: "1d", interval: "5m" },
  { key: "5d", label: "5D", period: "5d", interval: "30m" },
  { key: "1mo", label: "1M", period: "1mo", interval: "1d" },
  { key: "6mo", label: "6M", period: "6mo", interval: "1d" },
  { key: "ytd", label: "YTD", period: "ytd", interval: "1d" },
  { key: "1y", label: "1Y", period: "1y", interval: "1d" },
  { key: "5y", label: "5Y", period: "5y", interval: "1wk" },
  { key: "max", label: "MAX", period: "max", interval: "1mo" },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

export const MARKET_INDICES = [
  { key: "NIFTY50", label: "NIFTY 50" },
  { key: "SENSEX", label: "SENSEX" },
  { key: "BANKNIFTY", label: "BANK NIFTY" },
  { key: "SP500", label: "S&P 500" },
] as const;

export const TRENDING = [
  { symbol: "RELIANCE.NS", name: "Reliance Industries" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services" },
  { symbol: "INFY.NS", name: "Infosys" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank" },
  { symbol: "AAPL", name: "Apple" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "TSLA", name: "Tesla" },
] as const;
