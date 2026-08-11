export type MarketId = "US" | "IN";

export type MarketConfig = {
  id: MarketId;
  label: string;
  region: string;
  currency: string;
  indices: { key: string; label: string }[];
  equities: string[];
  etfs: string[];
  supportsFilings: boolean;
};

export const MARKETS: Record<MarketId, MarketConfig> = {
  US: {
    id: "US",
    label: "United States",
    region: "us",
    currency: "USD",
    indices: [
      { key: "^GSPC", label: "S&P 500" },
      { key: "^IXIC", label: "Nasdaq" },
      { key: "^DJI", label: "Dow Jones" },
      { key: "^RUT", label: "Russell 2000" },
    ],
    equities: ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM", "JNJ", "XOM", "KO", "PG"],
    etfs: ["SPY", "QQQ", "IWM", "VTI", "DIA", "ARKK"],
    supportsFilings: true,
  },
  IN: {
    id: "IN",
    label: "India",
    region: "in",
    currency: "INR",
    indices: [
      { key: "^NSEI", label: "NIFTY 50" },
      { key: "^BSESN", label: "SENSEX" },
      { key: "^NSEBANK", label: "BANK NIFTY" },
      { key: "^CNXIT", label: "NIFTY IT" },
    ],
    equities: [
      "RELIANCE.NS",
      "TCS.NS",
      "INFY.NS",
      "HDFCBANK.NS",
      "ICICIBANK.NS",
      "ITC.NS",
      "SBIN.NS",
      "BHARTIARTL.NS",
      "LT.NS",
      "HINDUNILVR.NS",
      "AXISBANK.NS",
      "MARUTI.NS",
    ],
    etfs: ["NIFTYBEES.NS", "BANKBEES.NS", "JUNIORBEES.NS", "GOLDBEES.NS", "ITBEES.NS", "SETFNIF50.NS"],
    supportsFilings: false,
  },
};

export const CRYPTO_SYMS = ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "DOGE-USD"];
export const FOREX_SYMS = ["EURUSD=X", "USDINR=X", "GBPUSD=X", "USDJPY=X"];

/** Yahoo screener sector values (Title Case) keyed by the lowercase-hyphen sector key. */
export const SECTOR_KEYS = [
  "basic-materials",
  "communication-services",
  "consumer-cyclical",
  "consumer-defensive",
  "energy",
  "financial-services",
  "healthcare",
  "industrials",
  "real-estate",
  "technology",
  "utilities",
] as const;

export function sectorLabel(key: string) {
  return key
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/** Industries per sector (yfinance industry keys). */
export const SECTOR_INDUSTRIES: Record<string, string[]> = {
  technology: [
    "software-infrastructure",
    "software-application",
    "semiconductors",
    "semiconductor-equipment-materials",
    "consumer-electronics",
    "information-technology-services",
    "computer-hardware",
    "communication-equipment",
    "electronic-components",
    "solar",
  ],
  "financial-services": [
    "banks-diversified",
    "banks-regional",
    "capital-markets",
    "insurance-diversified",
    "insurance-life",
    "asset-management",
    "credit-services",
    "financial-data-stock-exchanges",
    "mortgage-finance",
  ],
  healthcare: [
    "drug-manufacturers-general",
    "drug-manufacturers-specialty-generic",
    "biotechnology",
    "medical-devices",
    "medical-instruments-supplies",
    "healthcare-plans",
    "diagnostics-research",
    "medical-care-facilities",
  ],
  "consumer-cyclical": [
    "internet-retail",
    "auto-manufacturers",
    "auto-parts",
    "restaurants",
    "apparel-retail",
    "specialty-retail",
    "travel-services",
    "lodging",
    "residential-construction",
    "footwear-accessories",
  ],
  "consumer-defensive": [
    "discount-stores",
    "beverages-non-alcoholic",
    "household-personal-products",
    "packaged-foods",
    "tobacco",
    "grocery-stores",
    "farm-products",
    "confectioners",
  ],
  "communication-services": [
    "internet-content-information",
    "telecom-services",
    "entertainment",
    "electronic-gaming-multimedia",
    "advertising-agencies",
    "broadcasting",
    "publishing",
  ],
  energy: [
    "oil-gas-integrated",
    "oil-gas-e-p",
    "oil-gas-midstream",
    "oil-gas-refining-marketing",
    "oil-gas-equipment-services",
    "thermal-coal",
    "uranium",
  ],
  industrials: [
    "aerospace-defense",
    "railroads",
    "airlines",
    "building-products-equipment",
    "engineering-construction",
    "specialty-industrial-machinery",
    "farm-heavy-construction-machinery",
    "integrated-freight-logistics",
    "waste-management",
    "conglomerates",
  ],
  "basic-materials": [
    "specialty-chemicals",
    "chemicals",
    "gold",
    "steel",
    "copper",
    "aluminum",
    "agricultural-inputs",
    "building-materials",
    "paper-paper-products",
  ],
  "real-estate": [
    "reit-industrial",
    "reit-residential",
    "reit-retail",
    "reit-office",
    "reit-healthcare-facilities",
    "reit-specialty",
    "real-estate-services",
    "real-estate-development",
  ],
  utilities: [
    "utilities-regulated-electric",
    "utilities-regulated-gas",
    "utilities-regulated-water",
    "utilities-renewable",
    "utilities-diversified",
    "utilities-independent-power-producers",
  ],
};
