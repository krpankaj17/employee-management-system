import type { Metadata, Viewport } from "next";
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Employee Management System",
  description: "Employee Management System for attendance tracking, leave requests, payroll disbursements, projects and performance evaluations.",
};

export const viewport: Viewport = {
  themeColor: "#f7f5ee",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" className={`light ${inter.variable} ${outfit.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('ems_theme');
                  var theme = (saved === 'dark' || saved === 'light') ? saved : 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                    document.documentElement.style.backgroundColor = '#0f121a';
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.add('light');
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.backgroundColor = '#f8f8f6';
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch (e) {}

                function isBackendConnectionError(err) {
                  if (!err) return false;
                  var msg = (typeof err === 'string' ? err : (err.message || err.reason || '')).toString().toLowerCase();
                  return msg.includes('failed to connect') ||
                         msg.includes('is the server running') ||
                         msg.includes('failed to fetch') ||
                         msg.includes('econnrefused') ||
                         msg.includes('network error') ||
                         msg.includes('networkerror') ||
                         msg.includes('err_connection_refused');
                }

                window.addEventListener('unhandledrejection', function(event) {
                  if (isBackendConnectionError(event.reason)) {
                    console.warn('[EMS System Guard] Gracefully suppressed unhandled connection error:', event.reason);
                    event.preventDefault();
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('ems_backend_offline', { 
                        detail: { reason: event.reason && event.reason.message ? event.reason.message : String(event.reason) } 
                      }));
                    }
                  }
                });

                window.addEventListener('error', function(event) {
                  if (isBackendConnectionError(event.error) || isBackendConnectionError(event.message)) {
                    console.warn('[EMS System Guard] Gracefully suppressed runtime connection error:', event.message);
                    event.preventDefault();
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('ems_backend_offline', { 
                        detail: { reason: event.message } 
                      }));
                    }
                  }
                });
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
