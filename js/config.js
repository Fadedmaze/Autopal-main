// Public client config. The publishable key is safe to ship to the browser;
// Row Level Security in the database is what protects each user's data.
export const SUPABASE_URL = "https://hrcthuqltodogsglfatt.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable__Jx_pdxzT_h5Zxpggv6SSw_NmXRGu00";
export const PHOTO_BUCKET = "vehicle-photos";
export const RECEIPT_BUCKET = "receipts";
export const AVATAR_BUCKET = "avatars";
export const INSURANCE_BUCKET = "insurance-cards";

// Web Push "public key" (VAPID). Public by design, safe to ship. Its private half
// lives only in Supabase Edge Function secrets (VAPID_PRIVATE_KEY). Leave empty until
// you generate the pair (see README > Maintenance notifications); until then the
// Phone Notifications switch says notifications aren't set up yet.
export const VAPID_PUBLIC_KEY = "BIvxa5JF3pmb02g1d6FnL9a732B1z6XrqrroP-4nO8MTw2NgU61wPyU_CeAuDjyPBSMCYgPhJjSbQYN1bHcaEAs";
