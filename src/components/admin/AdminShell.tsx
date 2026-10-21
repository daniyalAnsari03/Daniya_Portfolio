"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/actions";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/homepage", label: "Homepage" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/about", label: "About" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/settings", label: "Settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminShell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#E8E8E8] text-[#111111]">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-charcoal px-4 text-white lg:hidden">
        <span className="text-sm font-medium tracking-[-0.02em]">Admin</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="rounded-md p-2 transition-colors hover:bg-white/10"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-charcoal text-white lg:flex">
        <SidebarBody pathname={pathname} email={email} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-charcoal/50"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-charcoal text-white">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-sm font-medium tracking-[-0.02em]">
                Admin
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-2 transition-colors hover:bg-white/10"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M4 4l10 10M14 4L4 14"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <SidebarBody
              pathname={pathname}
              email={email}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      )}

      <main className="px-5 py-8 sm:px-8 lg:ml-64 lg:px-12 lg:py-12">
        {children}
      </main>
    </div>
  );
}

function SidebarBody({
  pathname,
  email,
  onNavigate,
}: {
  pathname: string;
  email: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="px-5 py-6">
        <span className="text-sm font-medium tracking-[-0.02em]">Admin</span>
      </div>

      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`block rounded-lg border-l-2 px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "border-accent-on-dark bg-white/5 text-accent-on-dark"
                      : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p
          className="mb-3 truncate text-xs text-white/50"
          title={email || undefined}
        >
          {email || "—"}
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
