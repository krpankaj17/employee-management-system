import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Employee Management System",
  description: "Employee Management System for attendance tracking, leave requests, payroll disbursements, projects and performance evaluations.",
};

export const viewport: Viewport = {
  themeColor: "#080914",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('ems_theme_preference');
                  if (saved === 'light') {
                    // Recover from all-white UI to sleek dark mode
                    localStorage.setItem('ems_theme_preference', 'dark');
                    saved = 'dark';
                  }
                  document.documentElement.setAttribute('data-theme', 'dark');
                  document.documentElement.classList.remove('light');
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.backgroundColor = '#080914';
                  document.documentElement.style.colorScheme = 'dark';
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
