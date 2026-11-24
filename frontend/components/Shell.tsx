"use client";
import { Activity, BookOpen, Code2, FileStack, FolderGit2, GitCompareArrows, LayoutDashboard, Lock, Menu, Search, ShieldCheck, Upload, Workflow, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { API_URL, getJSON, lockDemo, REPO_URL, Stats } from "@/lib/api";
import { useAccess, useCodeRequired } from "@/components/Gate";

const NAV = [
  { group: "Work", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/upload", label: "Upload", icon: Upload },
    { href: "/documents", label: "Documents", icon: FileStack },
    { href: "/review", label: "Review queue", icon: ShieldCheck, badge: true },
    { href: "/search", label: "Search", icon: Search },
    { href: "/cross-checks", label: "Cross-checks", icon: GitCompareArrows },
  ] },
  { group: "Operations", items: [
    { href: "/system", label: "System health", icon: Activity },
  ] },
  { group: "Help", items: [
    { href: "/guide", label: "How to use", icon: BookOpen },
    { href: "/how-it-works", label: "How it works", icon: Workflow },
  ] },
];

/** DocIntel mark (a document with a magnifier, cyan on ink) next to the product name. */
export function Logo() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
          <path d="M14 2v5a1 1 0 0 0 1 1h5" />
          <circle cx="11.5" cy="14.5" r="2.5" />
          <path d="M13.3 16.3 15 18" />
        </svg>
      </span>
      <span className="brand-name">DocIntel</span>
    </span>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const code = useAccess();
  const openDemo = useCodeRequired() === false;   // the server has no access code set
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const on = (e: Event) => {
      const ok = (e as CustomEvent<boolean>).detail;
      if (ok) { if (timer) clearTimeout(timer); setOffline(false); }
      else if (!timer) timer = setTimeout(() => { setOffline(true); timer = null; }, 1200);
    };
    window.addEventListener("docintel-health", on);
    return () => window.removeEventListener("docintel-health", on);
  }, []);

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!code && !openDemo) return;   // locked: nothing to load until the code is entered
    let alive = true;
    const load = () => getJSON<Stats>("/stats").then((s) => alive && setReview(s.invoices.needs_review)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    window.addEventListener("docintel-refresh", load);
    return () => { alive = false; clearInterval(t); window.removeEventListener("docintel-refresh", load); };
  }, [code, openDemo]);

  const side = (
    <aside className={`side ${open ? "open" : ""}`} aria-label="Main navigation">
      <Link href="/" aria-label="DocIntel home"><Logo /></Link>
      {NAV.map((g) => (
        <nav className="nav" key={g.group}>
          <div className="nav-group">{g.group}</div>
          {g.items.map(({ href, label, icon: Icon, badge }) => (
            <Link key={href} href={href} className={path === href || path.startsWith(href + "/") ? "active" : ""}>
              <Icon size={18} strokeWidth={1.75} />
              {label}
              {badge && review ? <span className="count num">{review}</span> : null}
            </Link>
          ))}
        </nav>
      ))}
      <div className="side-foot">
        {code && !openDemo ? (
          <button type="button" className="lock-btn" onClick={() => { lockDemo(); setReview(null); router.push("/dashboard"); }}>
            <Lock size={15} /> Lock demo
          </button>
        ) : null}
        <a href={`${API_URL}/api/docs`} target="_blank" rel="noreferrer" className="row" style={{ gap: 8 }}><Code2 size={15} /> API reference</a>
        {REPO_URL && <a href={REPO_URL} target="_blank" rel="noreferrer" className="row" style={{ gap: 8 }}><FolderGit2 size={15} /> Source code</a>}
        <span>Built by Md Asif</span>
      </div>
    </aside>
  );

  return (
    <div className="shell">
      {side}
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div style={{ minWidth: 0 }}>
        <header className="topbar">
          <Link href="/"><Logo /></Link>
          <button className="btn icon-btn" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </header>
        {offline && (
          <div className="conn-banner" role="status"><span className="spinner" /> Reconnecting to the processing server… Your work is safe; this page continues by itself.</div>
        )}
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
