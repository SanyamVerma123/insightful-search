const SECTOR_ALIASES: Record<string, string> = {
  basicmaterials: "basic-materials",
  materials: "basic-materials",
  communication: "communication-services",
  communications: "communication-services",
  communicationservices: "communication-services",
  consumer: "consumer-cyclical",
  consumerdiscretionary: "consumer-cyclical",
  consumercyclical: "consumer-cyclical",
  consumerstaples: "consumer-defensive",
  consumerdefensive: "consumer-defensive",
  financial: "financial-services",
  financials: "financial-services",
  financialservices: "financial-services",
  healthcare: "healthcare",
  health: "healthcare",
  industrials: "industrials",
  industrial: "industrials",
  realestate: "real-estate",
  technology: "technology",
  informationtechnology: "technology",
  utilities: "utilities",
  energy: "energy",
  etf: "etf",
  crypto: "crypto",
  forex: "forex",
};

const INDUSTRY_ALIASES: Record<string, string> = {
  softwareinfrastructure: "software-infrastructure",
  softwareapplication: "software-application",
  semiconductors: "semiconductors",
  semiconductorequipmentmaterials: "semiconductor-equipment-materials",
  consumerelectronics: "consumer-electronics",
  informationtechnologyservices: "information-technology-services",
  computerhardware: "computer-hardware",
  communicationequipment: "communication-equipment",
  electroniccomponents: "electronic-components",
  pharmaceuticals: "pharmaceuticals",
  banks: "banks",
  diversifiedbanks: "banks",
  oilgasintegrated: "oil-gas-integrated",
  automobiles: "automobiles",
};

function clean(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function canonicalSectorKey(value: string | null | undefined) {
  if (!value) return "";
  const normalized = clean(value);
  return SECTOR_ALIASES[normalized] ?? slug(value);
}

export function canonicalIndustryKey(value: string | null | undefined) {
  if (!value) return "";
  const normalized = clean(value);
  return INDUSTRY_ALIASES[normalized] ?? slug(value);
}

export function providerTaxonomyLabel(
  value: string | null | undefined,
  kind: "sector" | "industry",
) {
  if (!value) return "";
  return kind === "sector" ? canonicalSectorKey(value) : canonicalIndustryKey(value);
}

export function taxonomyMatches(
  left: string | null | undefined,
  right: string | null | undefined,
  kind: "sector" | "industry",
) {
  if (!left || !right) return false;
  const canonicalLeft = kind === "sector" ? canonicalSectorKey(left) : canonicalIndustryKey(left);
  const canonicalRight =
    kind === "sector" ? canonicalSectorKey(right) : canonicalIndustryKey(right);
  return (
    canonicalLeft === canonicalRight ||
    canonicalLeft.includes(canonicalRight) ||
    canonicalRight.includes(canonicalLeft)
  );
}
