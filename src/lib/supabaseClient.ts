import { createBrowserClient } from '@supabase/ssr'

// Menggunakan createBrowserClient agar Dashboard & Menu lain
// bisa membaca COOKIE login yang sudah dibuat di halaman Login.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)