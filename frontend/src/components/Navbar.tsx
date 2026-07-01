"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "/dashboard",  label: "Dashboard" },
  { href: "/companies",  label: "Companies" },
  { href: "/drives",     label: "Drives" },
  { href: "/placements", label: "Placements" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <nav className="app-nav">
      <Link href="/dashboard" className="app-nav-logo">
        <Image
          src="/logo.jpeg"
          alt="CAR Progress Tracking Logo"
          width={36}
          height={36}
          style={{ borderRadius: 6, border: "2px solid var(--card-border)", objectFit: "contain" }}
          priority
        />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--foreground)" }}>
            CAR Progress
          </span>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.62rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
            Tracking
          </span>
        </div>
      </Link>

      <ul className="app-nav-links">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={`app-nav-link${pathname === link.href ? " active" : ""}`}
            >
              {link.label}
            </Link>
          </li>
        ))}
        {/* @ts-ignore */}
        {session && (session.user.role === "admin" || session.user.email === "puneethasshankarbtech24@rvu.edu.in") && (
          <li>
            <Link href="/admin" className={`app-nav-link${pathname === "/admin" ? " active" : ""}`}>
              Admin
            </Link>
          </li>
        )}
      </ul>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <ThemeToggle />
        {!isPending && session ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {session.user.image && (
                <Image 
                  src={session.user.image} 
                  alt={session.user.name} 
                  width={24} height={24} 
                  style={{ borderRadius: "50%", border: "1px solid var(--card-border)" }}
                />
              )}
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--foreground)",
                }}
              >
                {session.user.name}
              </span>
            </div>
            <button 
              onClick={handleSignOut}
              className="neo-button btn-ghost" 
              style={{ padding: "4px 10px", fontSize: "0.65rem" }}
            >
              Sign Out
            </button>
          </>
        ) : (
          <span className="badge badge-ghost">Loading...</span>
        )}
      </div>
    </nav>
  );
}
