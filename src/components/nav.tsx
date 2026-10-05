"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function linksFor({ admin }: { admin: boolean; departmentName?: string | null }) {
  const links = [{ href: "/today", label: "1-5's" }];
  if (admin) {
    links.push({ href: "/board", label: "Admin board" }, { href: "/kpi", label: "KPI" }, { href: "/updates", label: "Updates" });
  } else {
    links.push({ href: "/board", label: "My board" }, { href: "/updates", label: "My updates" });
  }
  return links;
}

type SessionUser = {
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export function Nav({
  user,
  unreadUpdates = 0,
  admin = false,
  departmentName = null,
}: {
  user: SessionUser;
  unreadUpdates?: number;
  admin?: boolean;
  departmentName?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = linksFor({ admin, departmentName });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const initial = (user.name ?? user.username ?? "?").slice(0, 1).toUpperCase();

  return (
    <nav className="site-nav" data-open={open || undefined}>
      <Link href="/today" className="site-nav__brand" aria-label="Silverleaf Academy">
        <img src="/assets/branding/brandmark-electric-blue.svg" alt="Silverleaf Academy" height={52} style={{ height: 52, width: "auto" }} />
      </Link>

      <button
        type="button"
        className="site-nav__toggle"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="site-nav__bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      <div className="site-nav__links">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
            {link.href === "/updates" && unreadUpdates > 0 ? (
              <span className="site-nav__badge">{unreadUpdates > 9 ? "9+" : unreadUpdates}</span>
            ) : null}
          </Link>
        ))}
        <Link href="/profile" className="site-nav__profile">
          <span className="site-nav__avatar">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initial}
          </span>
          {user.name ?? user.username}
        </Link>
        <LogoutControl />
      </div>

      <button type="button" className="site-nav__scrim" aria-hidden="true" tabIndex={-1} onClick={() => setOpen(false)} />
    </nav>
  );
}

function LogoutControl() {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <button type="button" className="site-nav__logout" disabled={pending} onClick={() => void logout()}>
      Sign out
    </button>
  );
}
