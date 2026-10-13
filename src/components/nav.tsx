"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SessionUser = {
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export function Nav({
  user,
  unreadUpdates = 0,
  admin = false,
  desks = [],
}: {
  user: SessionUser;
  unreadUpdates?: number;
  admin?: boolean;
  desks?: Array<{ href: string; label: string }>;
  departmentName?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [desksOpen, setDesksOpen] = useState(false);
  const links = admin
    ? [
        { href: "/today", label: "1-5's" },
        { href: "/board", label: "Admin board" },
        { href: "/kpi", label: "KPI" },
        { href: "/updates", label: "Updates" },
      ]
    : [
        { href: "/today", label: "1-5's" },
        ...(desks.length === 1 ? desks : []),
        { href: "/board", label: "My board" },
        { href: "/updates", label: "My updates" },
      ];
  const deskMenu = desks.length > 1 ? desks : [];
  const deskHere = deskMenu.some((desk) => pathname === desk.href || pathname.startsWith(`${desk.href}/`));

  useEffect(() => {
    setOpen(false);
    setDesksOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!desksOpen) return;
    function close() {
      setDesksOpen(false);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [desksOpen]);

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
        {links.slice(0, 1).map((link) => (
          <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
            {link.label}
          </Link>
        ))}
        {deskMenu.length ? (
          <div className="site-nav__menu" data-open={desksOpen || undefined}>
            <button
              type="button"
              className="site-nav__menu-button"
              aria-expanded={desksOpen}
              aria-current={deskHere ? "page" : undefined}
              onClick={(event) => {
                event.stopPropagation();
                setDesksOpen((value) => !value);
              }}
            >
              Departments
            </button>
            <div className="site-nav__menu-panel">
              {deskMenu.map((desk) => (
                <Link key={desk.href} href={desk.href} aria-current={pathname === desk.href ? "page" : undefined}>
                  {desk.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {links.slice(1).map((link) => (
          <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
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
