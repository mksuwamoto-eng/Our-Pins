import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Serif_JP } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from 'next-themes';
import { QueryProvider } from '@/components/providers/QueryProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'latin-ext', 'greek'], variable: '--font-sans-loaded' });
const serif = Noto_Serif_JP({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-serif-loaded',
});

export const metadata: Metadata = {
  title: 'Our Pins',
  description: 'A private, community-curated map of Japan.',
  applicationName: 'Our Pins',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Our Pins' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf8f1' },
    { media: '(prefers-color-scheme: dark)', color: '#0e152a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${serif.variable}`}>
      <body className="min-h-screen antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <QueryProvider>{children}</QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
