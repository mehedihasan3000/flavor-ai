import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AuthProvider } from "@/lib/auth-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FlavorAI — Turn Your Ingredients into Delicious Possibilities",
    template: "%s | FlavorAI",
  },
  description:
    "Generate personalized recipes from ingredients you already have with AI, then discover, rate, and share recipes with the FlavorAI community.",
};

export const viewport: Viewport = {
  themeColor: "#FDFBF7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:inline-flex focus:rounded-button focus:border focus:border-border focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-strong"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <Navbar />
          <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}

