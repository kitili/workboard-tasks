import type { Metadata } from "next";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/bai-jamjuree/400.css";
import "@fontsource/bai-jamjuree/600.css";
import { Nav } from "@/components/nav";
import { getSessionUser } from "@/lib/auth/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Silverleaf Tasks",
  description: "Silverleaf Academy daily tasks",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser();

  return (
    <html lang="en" className="h-full antialiased">
      <body>
        {user ? (
          <Nav
            user={{
              name: user.name,
              username: user.username,
              avatarUrl: user.avatarUrl,
            }}
          />
        ) : null}
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
