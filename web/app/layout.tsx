import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const SITE = process.env.NEXT_PUBLIC_SITE_NAME || "RapidSale";

export const metadata: Metadata = {
  title: { default: `${SITE} — Buy & Sell Anything in Pakistan`, template: `%s | ${SITE}` },
  description: "Buy and sell mobiles, cars, property, electronics, bikes, jobs and more near you.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b8a5b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <AuthProvider>
          <Header />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
