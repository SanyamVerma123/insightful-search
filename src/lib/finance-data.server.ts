import { callMcpTool } from "./mcp.server";
import {
  isRecord,
  num,
  str,
  toCandles,
  toRecords,
  toSeries,
  toStatementTable,
} from "./finance-normalize";
import type {
  AnalystSummary,
  CalendarInfo,
  Candle,
  CompareSeries,
  CorporateActions,
  IndexQuote,
  KeyRatios,
  NewsItem,
  Quote,
  SearchResult,
  StatementTable,
  StockSummary,
} from "./finance-types";
import { MARKET_INDICES } from "./finance-types";

const INCOME_ORDER = [
  "Total Revenue",
  "Cost Of Revenue",
  "Gross Profit",
  "Operating Expense",
  "Research And Development",
  "Operating Income",
  "EBITDA",
  "EBIT",
  "Pretax Income",
  "Tax Provision",
  "Net Income",
  "Diluted EPS",
  "Basic EPS",
];
const BALANCE_ORDER = [
  "Total Assets",
  "Current Assets",
  "Cash And Cash Equivalents",
  "Inventory",
  "Total Liabilities Net Minority Interest",
  "Current Liabilities",
  "Total Debt",
  "Stockholders Equity",
  "Working Capital",
];
const CASHFLOW_ORDER = [
  "Operating Cash Flow",
  "Investing Cash Flow",
  "Financing Cash Flow",
  "Free Cash Flow",
  "Capital Expenditure",
  "Repurchase Of Capital Stock",
  "Cash Dividends Paid",
  "End Cash Position",
];

function buildQuote(symbol: string, snapshot: unknown, ratios: unknown): Quote {
  const s = isRecord(snapshot) ? snapshot : {};
  const r = isRecord(ratios) ? ratios : {};
  const price = num(r["currentPrice"]) ?? num(s["lastPrice"]) ?? num(s["open"]);
  const prev = num(s["previousClose"]);
  const change = price !== null && prev !== null ? price - prev : null;
  return {
    symbol,
    name: str(r["shortName"]) ?? symbol,
    exchange: str(s["exchange"]),
    currency: str(s["currency"]),
    price,
    previousClose: prev,
    open: num(s["open"]),
    dayHigh: num(s["dayHigh"]),
    dayLow: num(s["dayLow"]),
    yearHigh: num(s["yearHigh"]) ?? num(r["fiftyTwoWeekHigh"]),
    yearLow: num(s["yearLow"]) ?? num(r["fiftyTwoWeekLow"]),
    marketCap: num(s["marketCap"]),
    change,
    changePercent: change !== null && prev ? (change / prev) * 100 : num(s["yearChange"]),
  };
}

function buildRatios(ratios: unknown): KeyRatios {
  const r = isRecord(ratios) ? ratios : {};
  return {
    sector: str(r["sector"]),
    industry: str(r["industry"]),
    country: str(r["country"]),
    summary: str(r["longBusinessSummary"]),
    trailingPE: num(r["trailingPE"]),
    forwardPE: num(r["forwardPE"]),
    priceToBook: num(r["priceToBook"]),
    enterpriseToEbitda: num(r["enterpriseToEbitda"]),
    profitMargins: num(r["profitMargins"]),
    operatingMargins: num(r["operatingMargins"]),
    returnOnEquity: num(r["returnOnEquity"]),
    revenueGrowth: num(r["revenueGrowth"]),
    earningsGrowth: num(r["earningsGrowth"]),
    debtToEquity: num(r["debtToEquity"]),
    dividendYield: num(r["dividendYield"]),
    beta: num(r["beta"]),
    targetMeanPrice: num(r["targetMeanPrice"]),
    recommendationKey: str(r["recommendationKey"]),
    numberOfAnalystOpinions: num(r["numberOfAnalystOpinions"]),
  };
}

export async function fetchSummary(symbol: string): Promise<StockSummary> {
  const raw = await callMcpTool<Record<string, unknown>>("get_all_data_summary", { symbol });
  const snapshot = isRecord(raw) ? raw["price_snapshot"] : null;
  const ratios = isRecord(raw) ? raw["key_ratios"] : null;
  return { quote: buildQuote(symbol, snapshot, ratios), ratios: buildRatios(ratios) };
}

export async function fetchHistory(
  symbol: string,
  period: string,
  interval: string,
): Promise<Candle[]> {
  const raw = await callMcpTool("get_price_history", { symbol, period, interval });
  return toCandles(raw);
}

export async function fetchIndex(key: string, label: string, period = "1mo"): Promise<IndexQuote> {
  const raw = await callMcpTool<Record<string, unknown>>("get_index_data", {
    index: key,
    period,
    interval: period === "1d" ? "5m" : "1d",
  });
  const candles = toCandles(isRecord(raw) ? raw["data"] : raw);
  const points = candles.map((c) => ({ t: c.t, c: c.c }));
  const first = points[0]?.c ?? null;
  const last = points[points.length - 1]?.c ?? null;
  return {
    key,
    label,
    points,
    last,
    changePercent: first && last ? ((last - first) / first) * 100 : null,
  };
}

export async function fetchMarketStrip(): Promise<IndexQuote[]> {
  const results = await Promise.allSettled(
    MARKET_INDICES.map((i) => fetchIndex(i.key, i.label, "1mo")),
  );
  return results.flatMap((r, i) =>
    r.status === "fulfilled"
      ? [r.value]
      : [{ key: MARKET_INDICES[i]!.key, label: MARKET_INDICES[i]!.label, points: [], last: null, changePercent: null }],
  );
}

export async function fetchNews(symbol: string): Promise<NewsItem[]> {
  const raw = await callMcpTool<Record<string, unknown>>("get_news", { symbol });
  const list = isRecord(raw) && Array.isArray(raw["data"]) ? raw["data"] : [];
  return list.filter(isRecord).map((n) => ({
    title: str(n["title"]) ?? "Untitled",
    publisher: str(n["publisher"]),
    link: str(n["link"]) ?? "#",
    pubDate: str(n["pubDate"]),
    summary: str(n["summary"]),
  }));
}

export async function fetchSearch(query: string): Promise<SearchResult[]> {
  const raw = await callMcpTool<Record<string, unknown>>("lookup_ticker", { query });
  const list = isRecord(raw) && Array.isArray(raw["quotes"]) ? raw["quotes"] : [];
  return list
    .filter(isRecord)
    .map((q) => ({
      symbol: str(q["symbol"]) ?? "",
      name: str(q["longname"]) ?? str(q["shortname"]) ?? "",
      exchange: str(q["exchDisp"]) ?? str(q["exchange"]),
      type: str(q["typeDisp"]),
      sector: str(q["sectorDisp"]),
    }))
    .filter((q) => q.symbol.length > 0)
    .slice(0, 8);
}

export async function fetchFinancials(
  symbol: string,
  statement: "income" | "balance" | "cash",
  quarterly: boolean,
): Promise<StatementTable> {
  const raw = await callMcpTool("get_financials", { symbol, statement, quarterly });
  const order =
    statement === "income" ? INCOME_ORDER : statement === "balance" ? BALANCE_ORDER : CASHFLOW_ORDER;
  return toStatementTable(raw, order);
}

export async function fetchAnalyst(symbol: string): Promise<AnalystSummary> {
  const raw = await callMcpTool<Record<string, unknown>>("get_analyst_summary", { symbol });
  const rec = isRecord(raw) ? raw["recommendations"] : null;
  const distribution = toRecords(rec, 6).map((row) => ({
    period: row["period"] ?? "",
    strongBuy: Number(row["strongBuy"] ?? 0),
    buy: Number(row["buy"] ?? 0),
    hold: Number(row["hold"] ?? 0),
    sell: Number(row["sell"] ?? 0),
    strongSell: Number(row["strongSell"] ?? 0),
  }));

  const pt = isRecord(raw) && isRecord(raw["price_targets"]) ? raw["price_targets"] : {};
  const hist = isRecord(raw) ? raw["earnings_history"] : null;
  const earningsHistory = toRecords(hist, 8)
    .map((row) => ({
      date: row["date"] ?? "",
      actual: row["epsActual"] ? Number(row["epsActual"]) : null,
      estimate: row["epsEstimate"] ? Number(row["epsEstimate"]) : null,
      surprisePercent: row["surprisePercent"] ? Number(row["surprisePercent"]) * 100 : null,
    }))
    .reverse();

  return {
    distribution,
    targets: {
      current: num(pt["current"]),
      low: num(pt["low"]),
      mean: num(pt["mean"]),
      median: num(pt["median"]),
      high: num(pt["high"]),
    },
    earningsHistory,
  };
}

export async function fetchUpgrades(symbol: string) {
  const raw = await callMcpTool("get_upgrades_downgrades", { symbol });
  return toRecords(raw, 15).map((row) => ({
    date: row["date"] ?? "",
    firm: row["Firm"] ?? "",
    fromGrade: row["FromGrade"] ?? "",
    toGrade: row["ToGrade"] ?? "",
    action: row["Action"] ?? "",
  }));
}

export async function fetchCalendar(symbol: string): Promise<CalendarInfo> {
  const raw = await callMcpTool<Record<string, unknown>>("get_calendar", { symbol });
  const r = isRecord(raw) ? raw : {};
  const earnings = r["Earnings Date"];
  return {
    earningsDate: Array.isArray(earnings) ? str(earnings[0]) : str(earnings),
    exDividendDate: str(r["Ex-Dividend Date"]),
    dividendDate: str(r["Dividend Date"]),
    earningsLow: num(r["Earnings Low"]),
    earningsAverage: num(r["Earnings Average"]),
    earningsHigh: num(r["Earnings High"]),
    revenueAverage: num(r["Revenue Average"]),
  };
}

export async function fetchCorporateActions(symbol: string): Promise<CorporateActions> {
  const raw = await callMcpTool<Record<string, unknown>>("get_corporate_actions", { symbol });
  const divRaw = isRecord(raw) ? raw["Dividends"] : null;
  const splitRaw = isRecord(raw) ? raw["Stock Splits"] ?? raw["Splits"] : null;
  const dividends = toSeries(divRaw)
    .map((p) => ({ date: p.t, amount: p.c }))
    .reverse()
    .slice(0, 12);
  const splits = toSeries(splitRaw)
    .map((p) => ({ date: p.t, ratio: p.c }))
    .reverse()
    .slice(0, 8);
  return { dividends, splits };
}

export async function fetchCompare(
  symbols: string,
  period: string,
  interval: string,
): Promise<CompareSeries[]> {
  const raw = await callMcpTool<Record<string, unknown>>("compare_stocks", {
    symbols,
    period,
    interval,
  });
  if (!isRecord(raw)) return [];
  return Object.keys(raw).map((symbol) => ({ symbol, points: toSeries(raw[symbol]) }));
}

/** Batch snapshot for table views — resilient to individual ticker failures. */
export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  const results = await Promise.allSettled(symbols.map((s) => fetchSummary(s)));
  return results.flatMap((r) => (r.status === "fulfilled" ? [r.value.quote] : []));
}
