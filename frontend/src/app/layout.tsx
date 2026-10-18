import type { Metadata } from "next";
import { AppProviders } from "@/providers/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "RusSra — Hệ thống học nhóm trực tuyến",
  description:
    "Hệ thống học nhóm trực tuyến dựa trên WebRTC, tích hợp bảng vẽ cộng tác thông minh.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
