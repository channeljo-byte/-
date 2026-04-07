import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components";

export const metadata: Metadata = {
  title: "투자관리",
  description: "투자 포트폴리오 & 가계부 관리 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css"
        />
      </head>
      <body className="flex min-h-full bg-slate-950 text-slate-100">
        <Sidebar />
        <main className="min-h-screen flex-1 p-8 lg:ml-60">{children}</main>
      </body>
    </html>
  );
}
