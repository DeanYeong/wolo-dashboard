// The Supabase URL and anon key are meant to be public (row level security protects the data).
// Vercel variables named SUPABASE_URL / SUPABASE_ANON_KEY are copied into the NEXT_PUBLIC_ names
// the code reads, so either naming works. They are written in at build time: redeploy after changing them.
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
  },
};
export default nextConfig;
