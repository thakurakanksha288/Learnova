// ─── Next.js core & React ────────────────────────────────────────────────────
import React from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

// ─── Third-party libraries ───────────────────────────────────────────────────
import { Toaster } from "react-hot-toast";
import NextTopLoader from "nextjs-toploader";

// ─── Global styles ───────────────────────────────────────────────────────────
import "./globals.css";

// ─── Layout & structural components ─────────────────────────────────────────
import ClientLayout from "@/components/ClientLayout";
import Footer from "@/components/Footer";
import PageTransition from "@/components/PageTransition";
import ScrollToTop from "@/components/ScrollToTop";
import BackToTop from "@/components/ui/BackToTop";
import OfflineIndicator from "@/components/OfflineIndicator";
import ScrollProgress from "@/components/ui/ScrollProgress";
import RouteAnnouncer from "@/components/RouteAnnouncer";
import ErrorBoundary from "@/components/ErrorBoundary";

// ─── Command palette (wrapper owns isOpen state via useCommandPalette hook) ──
// Conflict resolved: use CommandPaletteWrapper, NOT CommandPalette directly.
// CommandPalette requires isOpen + onClose props — it has no internal state.
// CommandPaletteWrapper wires the hook so the palette responds to Ctrl+K.
import CommandPaletteWrapper from "@/components/CommandPaletteWrapper";

// ─── Context providers (all wrapped inside AllProviders) ─────────────────────
// AllProviders composes: ThemeProvider → AuthProvider → FirestoreProvider → NotificationProvider
import AllProviders from "./providers/AllProviders";

// ─── SEO metadata & structured data ─────────────────────────────────────────
export { metadata } from "@/lib/seo/siteMetadata";
import { siteStructuredData } from "@/lib/seo/siteStructuredData";

// ─── Environment validation (server-side only, runs once at startup) ─────────
// Kept outside the component so it runs at module load time, not per-render.
// throwOnError:false keeps local dev working even without all secrets set.
if (typeof window === "undefined") {
  try {
    const { validateEnv } = require("@/lib/env");
    validateEnv({
      throwOnError: false, // Avoid failing the build during local/CI evaluation
      warnOnce: true,
    });
  } catch (error) {
    console.error("Environment validation failed:", error.message);
    throw error;
  }
}

// ─── Font configuration ───────────────────────────────────────────────────────
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// ─── Viewport export (Next.js 14+ metadata API) ──────────────────────────────
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

// ─── Root layout ──────────────────────────────────────────────────────────────
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* ── Favicons ── */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* ── Sitemap ── */}
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />

        {/* ── JSON-LD structured data for SEO ── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteStructuredData) }}
        />
      </head>

      <body
        suppressHydrationWarning
        className={`font-sans ${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen transition-colors duration-300`}
      >
        {/* ── Accessibility: skip-to-content link ── */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-[9999] focus:p-4 focus:bg-blue-600 focus:text-white focus:font-bold focus:outline-none focus:ring-2"
        >
          Skip to Main Content
        </a>

        {/* ── All context providers (Theme, Auth, Firestore, Notifications) ── */}
        <AllProviders>

          {/* ── Page scroll progress bar (top of viewport) ── */}
          <ScrollProgress />

          {/* ── Route-change loading bar ── */}
          <NextTopLoader
            color="#4f46e5"
            initialPosition={0.08}
            crawlSpeed={200}
            height={3}
            crawl={true}
            showSpinner={false}
            easing="ease"
            speed={200}
            shadow="0 0 10px #4f46e5,0 0 5px #4f46e5"
          />

          <Suspense fallback={null}>

            {/* ── Main page content with error boundary + page transitions ── */}
            <main id="main-content" className="outline-none" tabIndex="-1">
              <ErrorBoundary>
                <PageTransition>{children}</PageTransition>
              </ErrorBoundary>
            </main>

            {/* ── Scroll restoration on route change ── */}
            <ScrollToTop />

            {/* ── Global footer (rendered on all pages) ── */}
            <Footer />

            {/* ── Client-only layout: modals, chatbot, PWA install, streak sync ── */}
            <ClientLayout />

            {/* ── Back-to-top floating button ── */}
            <BackToTop />

            {/* ── Screen-reader route announcer for accessibility ── */}
            <RouteAnnouncer />

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { fontWeight: 600 },
            }}
          />

          <OfflineIndicator />
          <CommandPaletteWrapper />
          </Suspense>
          </AllProviders>
                      
      </body>
    </html>
  );
}
