/**
 * server/pricing.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for Gimbiya Mall's financial logic.
 *
 * MANDATE: This is the ONLY file where platform fees, merchant splits, and
 * Monnify payload construction are calculated. No other file may perform
 * financial arithmetic on order totals.
 *
 * All input values MUST be in Kobo (integer). All output values are in Kobo
 * unless explicitly suffixed with `Naira`. This eliminates JavaScript
 * floating-point errors on currency operations.
 *
 * Calculation Sequence (from spec §6):
 *   1. Gross Order Total  = Σ (priceKobo × quantity)
 *   2. Platform Fee (1.5%)= Math.round(grossTotal × 0.015)
 *   3. Merchant Net       = grossTotal − platformFee
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { MonnifyPaymentPayload, PricingResult } from './types';
/** Platform service fee rate — 1.5% as specified in §6 */
export declare const PLATFORM_FEE_RATE = 0.015;
/** Minimum order value requiring escrow (in Kobo). Default: ₦500 = 50,000 Kobo */
export declare const ESCROW_MIN_AMOUNT_KOBO: number;
/**
 * calculateOrderPricing
 * Computes the complete financial breakdown for an order.
 *
 * @param items   Array of { unitPriceKobo, quantity } — prices are snapshots
 *                from the product document at time of checkout.
 * @returns       PricingResult with all values in both Kobo and Naira.
 *
 * GEF Explanation (§8 mandate):
 *   - Step 1: Reduce items to a gross total by multiplying unit price by
 *     quantity for each line item and summing them.
 *   - Step 2: Multiply gross by 0.015 and round to nearest integer (Kobo).
 *     Math.round is used — not floor or ceil — to correctly handle the
 *     "round to nearest Kobo" rule from the spec.
 *   - Step 3: Subtract fee from gross. This is exact integer arithmetic.
 *   - Step 4: Derive Naira values by dividing by 100. These are for display
 *     and Monnify API calls only — never stored in the database.
 */
export declare function calculateOrderPricing(items: Array<{
    unitPriceKobo: number;
    quantity: number;
}>): PricingResult;
/**
 * generateRawOtp
 * Produces a cryptographically random 4-digit numeric string.
 * IMPORTANT: This raw value is shown ONLY to the buyer's UI. It is NEVER
 * stored in the database. Only the bcrypt hash is persisted.
 */
export declare function generateRawOtp(): string;
/**
 * generateOrderRef
 * Creates a human-readable order reference like GM-KN-240001.
 * Format: GM-{STATE_CODE}-{YYMMDD}{SEQ}
 */
export declare function generateOrderRef(state: string, sequenceNum: number): string;
/**
 * buildMonnifyPayload
 * Constructs the payment initialization payload for the Monnify API.
 * The incomeSplitConfig injects the merchant's sub-account to trigger
 * automated settlement splitting at the gateway level.
 *
 * @param pricing               Output from calculateOrderPricing
 * @param orderRef              Human-readable order reference
 * @param merchantSubAccountCode Merchant's Monnify sub-account code
 * @param customerName          Buyer's display name
 * @param customerEmail         Buyer's email
 * @param paymentMethod         Card, transfer, or USSD
 *
 * GEF Explanation (§8):
 *   - feePercentage on the merchant sub-account = (merchantNet / grossTotal) × 100
 *     This tells Monnify "give this percentage of every payment to the merchant".
 *   - The remaining percentage (i.e., platform fee) stays in the main account.
 *   - feeBearer: false means Monnify's own processing fee is NOT charged to
 *     the merchant sub-account — it comes from the platform's share.
 */
export declare function buildMonnifyPayload(pricing: PricingResult, orderRef: string, merchantSubAccountCode: string, customerName: string, customerEmail: string, paymentMethod: 'CARD' | 'ACCOUNT_TRANSFER' | 'USSD'): MonnifyPaymentPayload;
/** Format Kobo integer as a Nigerian Naira string e.g. ₦1,250.00 */
export declare function formatNaira(kobo: number): string;
/** Convert Naira float to Kobo integer — for inbound Monnify webhook amounts */
export declare function nairaToKobo(naira: number): number;
//# sourceMappingURL=pricing.d.ts.map