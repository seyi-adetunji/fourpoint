import type { Metadata } from "next";
import "./globals.css";
import { SidebarClient } from "@/components/Sidebar";
import { Providers } from "@/components/Providers";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "WorkforceOps — Hotel Workforce Manager",
  description: "Enterprise hotel workforce scheduling, attendance, and reporting platform by Four Points.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <SidebarClient />
            <div className="flex-1 flex flex-col overflow-hidden">
              <TopBar />
              <main className="flex-1 overflow-y-auto">
                <div className="p-6 lg:p-8">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
