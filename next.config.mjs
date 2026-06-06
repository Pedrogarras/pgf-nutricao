/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://zftxjpvaynshrsgpacxl.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmdHhqcHZheW5zaHJzZ3BhY3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTA2MTYsImV4cCI6MjA5NjI2NjYxNn0.VSII-pwJ6dwA9aAuCOaCsSDqU0FgtSeO5vdgQZPztNw',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pedro-garrastazu-emagrecimento.vercel.app',
  },
}

export default nextConfig
