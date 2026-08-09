import { createServerFn } from "@tanstack/react-start";
import {
  fetchAnalyst,
  fetchCalendar,
  fetchCompare,
  fetchCorporateActions,
  fetchFinancials,
  fetchHistory,
  fetchMarketStrip,
  fetchNews,
  fetchQuotes,
  fetchSearch,
  fetchSummary,
  fetchUpgrades,
} from "./finance-data.server";

export const getSummary = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(({ data }) => fetchSummary(data.symbol));

export const getHistory = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string; period: string; interval: string }) => d)
  .handler(({ data }) => fetchHistory(data.symbol, data.period, data.interval));

export const getMarketStrip = createServerFn({ method: "GET" }).handler(() => fetchMarketStrip());

export const getNews = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(({ data }) => fetchNews(data.symbol));

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
