/**
 * Finance capability identity.
 *
 * Finance reads the Dugong Ledger and nothing else. The statement-parsing path
 * that predated the ledger integration is gone — two ways of producing the same
 * report is two sources of truth.
 */

export const CAPABILITY_ID = "finance";
