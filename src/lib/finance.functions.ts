import { createServerFn } from "@tanstack/react-start";
import {
  fetchAnalyst,
  fetchCalendar,
  fetchClassify,
  fetchCompare,
  fetchCorporateActions,
  fetchEarningsDates,
  fetchEstimates,
  fetchFinancials,
  fetchHistory,
  fetchIndustryOverview,
  fetchMarketCalendar,
  fetchMarketStatus,
  fetchMarketStrip,
  fetchMarketSummary,
  fetchNews,
  fetchOptionChain,
  fetchOptionExpirations,
  fetchOwnership,
  fetchPredefinedScreeners,
  fetchQuotes,
  fetchScreenEquities,
  fetchScreenEtfs,
  fetchScreenFunds,
  fetchScreenPredefined,
  fetchSearch,
  fetchSearchNews,
  fetchSecFilings,
  fetchSectorOverview,
  fetchSectors,
  fetchSummary,
  fetchSustainability,
  fetchUpgrades,
  fetchValuationMeasures,
  fetchWatchlistNews,
} from "./finance-data.server";

export const getSummary = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(({ data }) => fetchSummary(data.symbol));

export const getHistory = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string; period: string; interval: string }) => d)
  .handler(({ data }) => fetchHistory(data.symbol, data.period, data.interval));

export const getMarketStrip = createServerFn({ method: "GET" })
  .inputValidator((d: { indices?: { key: string; label: string }[] }) => d)
  .handler(({ data }) => fetchMarketStrip(data.indices));

export const getNews = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(({ data }) => fetchNews(data.symbol));

export const searchNews = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string }) => d)
  .handler(({ data }) => fetchSearchNews(data.query));

export const searchTickers = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string }) => d)
  .handler(({ data }) => fetchSearch(data.query));

export const getFinancials = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string; statement: "income" | "balance" | "cash"; quarterly: boolean }) => d)
  .handler(({ data }) => fetchFinancials(data.symbol, data.statement, data.quarterly));

export const getAnalyst = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(({ data }) => fetchAnalyst(data.symbol));

export const getUpgrades = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(({ data }) => fetchUpgrades(data.symbol));

export const getCalendar = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(({ data }) => fetchCalendar(data.symbol));

export const getCorporateActions = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(({ data }) => fetchCorporateActions(data.symbol));

export const getCompare = createServerFn({ method: "GET" })
  .inputValidator((d: { symbols: string; period: string; interval: string }) => d)
  .handler(({ data }) => fetchCompare(data.symbols, data.period, data.interval));

export const getQuotes = createServerFn({ method: "GET" })
  .inputValidator((d: { symbols: string }) => d)
  .handler(({ data }) =>
    fetchQuotes(
      data.symbols
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );

/* ---- Discovery ---- */

export const listPredefinedScreeners = createServerFn({ method: "GET" }).handler(() =>
  fetchPredefinedScreeners(),
);

export const runPredefinedScreener = createServerFn({ method: "GET" })
  .inputValidator((d: { name: string; size?: number }) => d)
  .handler(({ data }) => fetchScreenPredefined(data.name, data.size ?? 25));

export const runEquityScreener = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      region?: string;
      minMarketCap?: number;
      maxPe?: number;
      minGrowth?: number;
      minDividendYield?: number;
      sector?: string;
      size?: number;
    }) => d,
  )
  .handler(({ data }) => fetchScreenEquities(data));

export const runEtfScreener = createServerFn({ method: "GET" })
  .inputValidator((d: { region?: string; size?: number }) => d)
  .handler(({ data }) => fetchScreenEtfs(data.region ?? "us", data.size ?? 25));

export const runFundScreener = createServerFn({ method: "GET" })
  .inputValidator((d: { size?: number }) => d)
  .handler(({ data }) => fetchScreenFunds(data.size ?? 25));

export const getMarketSummary = createServerFn({ method: "GET" })
  .inputValidator((d: { market?: string }) => d)
  .handler(({ data }) => fetchMarketSummary(data.market ?? "US"));

export const getMarketStatus = createServerFn({ method: "GET" })
  .inputValidator((d: { market?: string }) => d)
  .handler(({ data }) => fetchMarketStatus(data.market ?? "US"));

export const listSectors = createServerFn({ method: "GET" }).handler(() => fetchSectors());

export const getSectorOverview = createServerFn({ method: "GET" })
  .inputValidator((d: { sectorKey: string; region?: string }) => d)
  .handler(({ data }) => fetchSectorOverview(data.sectorKey, data.region ?? "US"));

export const getIndustryOverview = createServerFn({ method: "GET" })
  .inputValidator((d: { industryKey: string; region?: string }) => d)
  .handler(({ data }) => fetchIndustryOverview(data.industryKey, data.region ?? "US"));

export const getMarketCalendar = createServerFn({ method: "GET" })
  .inputValidator((d: { kind: "earnings" | "ipo" | "splits" | "economic" }) => d)
  .handler(({ data }) => fetchMarketCalendar(data.kind));

/* ---- Per-ticker deep tools ---- */

export const getOptionExpirations = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(({ data }) => fetchOptionExpirations(data.symbol));

export const getOptionChain = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string; expiration: string }) => d)
  .handler(({ data }) => fetchOptionChain(data.symbol, data.expiration));

export const getOwnership = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(({ data }) => fetchOwnership(data.symbol));

export const getEstimates = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(({ data }) => fetchEstimates(data.symbol));

export const getValuationMeasures = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(({ data }) => fetchValuationMeasures(data.symbol));

export const getSustainability = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(({ data }) => fetchSustainability(data.symbol));

export const getSecFilings = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(({ data }) => fetchSecFilings(data.symbol));

export const getEarningsDates = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(({ data }) => fetchEarningsDates(data.symbol));

/* ---- Watchlist support ---- */

export const classifySymbols = createServerFn({ method: "GET" })
  .inputValidator((d: { symbols: string }) => d)
  .handler(({ data }) =>
    fetchClassify(
      data.symbols
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );

export const getWatchlistNews = createServerFn({ method: "GET" })
  .inputValidator((d: { symbols: string }) => d)
  .handler(({ data }) =>
    fetchWatchlistNews(
      data.symbols
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
