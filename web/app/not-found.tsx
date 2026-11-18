import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-lg p-10 text-center">
      <p className="text-5xl">🔎</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-gray-500">The ad may have been sold or removed.</p>
      <Link href="/" className="btn-primary mt-6">Back to home</Link>
    </div>
  );
}
