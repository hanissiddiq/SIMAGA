import { Suspense } from 'react'
import LoginClient from './loginclient' // Kita akan buat file ini

// Ini adalah komponen fallback sederhana selagi LoginClient dimuat
function Loading() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <div className="w-full bg-[#003366] px-8 pt-12 pb-24 text-white">
        <h1 className="text-center text-3xl font-bold">Loading...</h1>
      </div>
    </div>
  )
}

// Ini sekarang adalah Server Component
export default function LoginPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LoginClient />
    </Suspense>
  )
}
