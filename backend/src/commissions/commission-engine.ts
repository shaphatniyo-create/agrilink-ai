import { CommissionPayer } from '@prisma/client';

export interface CommissionRuleLike {
  percentage: number | null;
  fixedFeeRwf: number | null;
  minimumFeeRwf: number | null;
  maximumFeeRwf: number | null;
  payer: CommissionPayer;
}

export interface CommissionResult {
  commissionAmount: number;
  /** Total the paying party pays on top of / netted against the gross amount. */
  buyerPays: number;
  /** Total the receiving party (seller/supplier) nets after commission. */
  sellerReceives: number;
}

/** Round to the nearest RWF (no fractional currency in circulation). */
const round = (n: number) => Math.round(n);

/**
 * Pure calculation used by marketplace orders, input orders, and any other
 * commission-bearing transaction. Kept side-effect-free and independently
 * unit-testable; CommissionsService wraps this with rule *lookup* + persistence.
 */
export function computeCommission(gross: number, rule: CommissionRuleLike): CommissionResult {
  let commission = 0;
  if (rule.percentage) commission += (gross * rule.percentage) / 100;
  if (rule.fixedFeeRwf) commission += rule.fixedFeeRwf;
  if (rule.minimumFeeRwf != null && commission < rule.minimumFeeRwf) commission = rule.minimumFeeRwf;
  if (rule.maximumFeeRwf != null && commission > rule.maximumFeeRwf) commission = rule.maximumFeeRwf;
  commission = round(commission);

  switch (rule.payer) {
    case 'SELLER':
    case 'SUPPLIER':
      return { commissionAmount: commission, buyerPays: gross, sellerReceives: gross - commission };
    case 'BUYER':
      return { commissionAmount: commission, buyerPays: gross + commission, sellerReceives: gross };
    case 'SPLIT': {
      const half = round(commission / 2);
      return {
        commissionAmount: commission,
        buyerPays: gross + half,
        sellerReceives: gross - (commission - half),
      };
    }
    default:
      // ADVERTISER / SUBSCRIBER / TRANSPORTER: commission is a direct fee, not
      // netted against a counterparty -- caller charges commissionAmount alone.
      return { commissionAmount: commission, buyerPays: gross + commission, sellerReceives: gross };
  }
}
