import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Beacon", template: "%s | Beacon" },
  description:
    "Add an AI support chat to your website. It answers from your own documents and says so when it doesn't know.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
