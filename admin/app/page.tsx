import Link from 'next/link';

export default function Page() {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Öğretmenevi Admin</h1>
      <nav className="grid gap-2">
        <Link className="text-blue-600 underline" href="/admin/ulasim">Ulaşım</Link>
        <Link className="text-blue-600 underline" href="/admin/yemek">Yemek</Link>
        <Link className="text-blue-600 underline" href="/admin/explore">Explore</Link>
        <Link className="text-blue-600 underline" href="/admin/sliders">Sliders</Link>
        <Link className="text-blue-600 underline" href="/admin/feedback">Feedback</Link>
      </nav>
    </main>
  );
}