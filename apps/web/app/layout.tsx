import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: "MaaS Pipeline",
  description: "Merge-as-a-Service OTIO Pipeline",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen">
        <Toaster position="top-right" toastOptions={{ style: { background: '#171717', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />
        {children}
      </body>
    </html>
  );
}
