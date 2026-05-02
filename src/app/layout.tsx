import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { QueryProvider } from "~/lib/query/provider";

export const metadata: Metadata = {
  title: "AI 客服",
  description: "智能客服对话窗口",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`${geist.variable}`}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
