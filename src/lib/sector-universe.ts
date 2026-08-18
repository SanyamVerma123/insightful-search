import { canonicalIndustryKey, canonicalSectorKey } from "./sector-normalize";

export type StaticSectorProfile = {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
};

const PROFILES: StaticSectorProfile[] = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "technology", industry: "consumer-electronics" },
  {
    symbol: "MSFT",
    name: "Microsoft Corp.",
    sector: "technology",
    industry: "software-infrastructure",
  },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "technology", industry: "semiconductors" },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    sector: "communication-services",
    industry: "internet-content",
  },
  {
    symbol: "AMZN",
    name: "Amazon.com Inc.",
    sector: "consumer-cyclical",
    industry: "internet-retail",
  },
  {
    symbol: "META",
    name: "Meta Platforms",
    sector: "communication-services",
    industry: "internet-content",
  },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "consumer-cyclical", industry: "automobiles" },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "financial-services", industry: "banks" },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "healthcare", industry: "pharmaceuticals" },
  { symbol: "XOM", name: "Exxon Mobil", sector: "energy", industry: "oil-gas-integrated" },
  { symbol: "KO", name: "Coca-Cola Co.", sector: "consumer-defensive", industry: "beverages" },
  {
    symbol: "PG",
    name: "Procter & Gamble",
    sector: "consumer-defensive",
    industry: "household-products",
  },
  {
    symbol: "RELIANCE.NS",
    name: "Reliance Industries",
    sector: "energy",
    industry: "oil-gas-integrated",
  },
  {
    symbol: "TCS.NS",
    name: "Tata Consultancy Services",
    sector: "technology",
    industry: "information-technology-services",
  },
  {
    symbol: "INFY.NS",
    name: "Infosys Ltd.",
    sector: "technology",
    industry: "information-technology-services",
  },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank", sector: "financial-services", industry: "banks" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank", sector: "financial-services", industry: "banks" },
  { symbol: "ITC.NS", name: "ITC Ltd.", sector: "consumer-defensive", industry: "tobacco" },
];

function normalizeRegion(region: string) {
  return region.trim().toLowerCase();
}

export function profilesForRegion(region: string): StaticSectorProfile[] {
  const normalized = normalizeRegion(region);
  const india =
    normalized === "in" || normalized === "india" || normalized === "nse" || normalized === "bse";
  return PROFILES.filter((profile) =>
    india ? profile.symbol.endsWith(".NS") : !profile.symbol.endsWith(".NS"),
  ).map((profile) => ({
    ...profile,
    sector: canonicalSectorKey(profile.sector),
    industry: canonicalIndustryKey(profile.industry),
  }));
}
