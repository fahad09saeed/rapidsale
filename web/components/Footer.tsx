import Link from "next/link";

const SITE = process.env.NEXT_PUBLIC_SITE_NAME || "RapidSale";

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-gray-600 sm:grid-cols-4">
        <div>
          <p className="mb-2 font-bold text-gray-900">Popular Categories</p>
          <ul className="space-y-1">
            <li><Link href="/search?category=cars">Cars</Link></li>
            <li><Link href="/search?category=mobile-phones">Mobile Phones</Link></li>
            <li><Link href="/search?category=property-for-sale">Property for Sale</Link></li>
            <li><Link href="/search?category=jobs">Jobs</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 font-bold text-gray-900">Popular Cities</p>
          <ul className="space-y-1">
            <li><Link href="/search?location=karachi">Karachi</Link></li>
            <li><Link href="/search?location=lahore">Lahore</Link></li>
            <li><Link href="/search?location=islamabad">Islamabad</Link></li>
            <li><Link href="/search?location=rawalpindi">Rawalpindi</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 font-bold text-gray-900">Account</p>
          <ul className="space-y-1">
            <li><Link href="/post">Post an Ad</Link></li>
            <li><Link href="/my-ads">My Ads</Link></li>
            <li><Link href="/chat">Chats</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 font-bold text-gray-900">Stay safe</p>
          <p>Meet in public places, inspect items before paying, and never share your verification code with anyone.</p>
        </div>
      </div>
      <p className="border-t border-gray-100 py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} {SITE}. All rights reserved.
      </p>
    </footer>
  );
}
