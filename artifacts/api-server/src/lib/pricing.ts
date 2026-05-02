import { type ProductVariant } from "@workspace/db";

export type PricingChannel = "RETAIL" | "WHOLESALE" | "AGENT" | "ONLINE" | "POS";

export interface PriceResolutionResult {
  resolvedPrice: number;
  tier: string;
  resolutionReason: string;
  bulkRateApplied: boolean;
  thresholdUsed: number;
}

export function resolvePrice(
  variant: ProductVariant,
  qty: number,
  channel: PricingChannel,
  wholesaleThreshold = 10
): PriceResolutionResult {
  const prices = variant.prices;

  if (channel === "WHOLESALE" || channel === "AGENT") {
    if (qty >= wholesaleThreshold) {
      return {
        resolvedPrice: prices.wholesaleBulk,
        tier: "wholesaleBulk",
        resolutionReason: `Bulk rate: qty ${qty} >= threshold ${wholesaleThreshold}`,
        bulkRateApplied: true,
        thresholdUsed: wholesaleThreshold,
      };
    }
    if (channel === "AGENT") {
      return {
        resolvedPrice: prices.agent,
        tier: "agent",
        resolutionReason: "Agent price tier",
        bulkRateApplied: false,
        thresholdUsed: wholesaleThreshold,
      };
    }
    return {
      resolvedPrice: prices.retailEst,
      tier: "retailEst",
      resolutionReason: "Wholesale below bulk threshold — retail estimate rate",
      bulkRateApplied: false,
      thresholdUsed: wholesaleThreshold,
    };
  }

  if (channel === "ONLINE") {
    return {
      resolvedPrice: prices.retailOnline,
      tier: "retailOnline",
      resolutionReason: "Online retail price",
      bulkRateApplied: false,
      thresholdUsed: wholesaleThreshold,
    };
  }

  // RETAIL / POS
  if (qty >= wholesaleThreshold) {
    return {
      resolvedPrice: prices.wholesaleBulk,
      tier: "wholesaleBulk",
      resolutionReason: `Bulk rate applied at POS/Retail: qty ${qty} >= ${wholesaleThreshold}`,
      bulkRateApplied: true,
      thresholdUsed: wholesaleThreshold,
    };
  }
  return {
    resolvedPrice: prices.retailEst,
    tier: "retailEst",
    resolutionReason: "Standard retail price",
    bulkRateApplied: false,
    thresholdUsed: wholesaleThreshold,
  };
}
