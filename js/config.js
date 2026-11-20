// Public client config. The publishable key is safe to ship to the browser;
// Row Level Security in the database is what protects each user's data.
export const SUPABASE_URL = "https://ifnmafspdnyexpqnpbuh.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YxY6AEJUoqA18rQTDZRhjg_oagQBIFk";
export const PHOTO_BUCKET = "vehicle-photos";
export const RECEIPT_BUCKET = "receipts";
export const AVATAR_BUCKET = "avatars";
export const INSURANCE_BUCKET = "insurance-cards";

// Web Push "public key" (VAPID). Public by design, safe to ship. Its private half
// lives only in Supabase Edge Function secrets (VAPID_PRIVATE_KEY). Leave empty until
// you generate the pair (see README > Maintenance notifications); until then the
// Phone Notifications switch says notifications aren't set up yet.
export const VAPID_PUBLIC_KEY = "BA0JFHmX9INHcOMGBf7ei8I_CuYklssFRAUnYeTC14C5PyRLM20SBNKx6DEBTBUVPCm5_oND81fNX0wy5KZKfp0";

// Google Maps "browser key" for the Find a Mechanic map. Public by design, but restrict
// it in Google Cloud to your site's address and to the Maps JavaScript API only. Leave
// empty to keep the original OpenStreetMap map with the demo shops. The Places key that
// finds real shops is separate and lives only in Supabase (GOOGLE_PLACES_KEY).
export const GOOGLE_MAPS_KEY = "AIzaSyD5JllL2EgME6aI1tokNPfcefxTMEVZXhM";
