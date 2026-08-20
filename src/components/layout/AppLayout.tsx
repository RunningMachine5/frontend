import { useEffect, useState, type ReactNode } from "react";

import "./AppLayout.css";

type AppLayoutProps = {
  activeNav: "dashboard" | "analysis" | "rules" | "model";
  children: ReactNode;
};

const navigation = [
  { id: "dashboard", label: "이상거래 감시", href: "/#main" },
  { id: "analysis", label: "이상거래 분석", href: "/#queue" },
  { id: "rules", label: "룰 관리", href: "/#rules" },
  { id: "model", label: "모델 관리", href: "/models" },
] as const;

const pageTitles = {
  dashboard: "이상거래 감시",
  analysis: "이상거래 분석",
  rules: "룰 관리",
  model: "모델 관리",
} as const;

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "fds.theme";

function BrandMark() {
  return <span aria-hidden="true" className="app-brand-mark"><img alt="" src="/fdshield-mark.png" /></span>;
}

// 모든 화면에서 같은 사이드바와 화면 폭을 사용한다.
export function AppLayout({ activeNav, children }: AppLayoutProps) {
  const [theme, setTheme] = useState<Theme>(() => (
    localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark"
  ));

  useEffect(() => {
    document.title = `${pageTitles[activeNav]} | FDShield`;
  }, [activeNav]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <main className="app-layout">
      <a className="app-skip-link" href="#app-content">본문으로 건너뛰기</a>
      <aside className="app-sidebar">
        <a aria-label="FDShield 이상거래 감시" className="app-brand" href="/#main">
          <BrandMark />
          <span className="app-brand-copy"><b>FDShield</b><small>FRAUD DETECTION SYSTEM</small></span>
        </a>
        <p className="app-nav-title">OPERATIONS</p>
        <nav>
          {navigation.map((item) => (
            <a className={item.id === activeNav ? "active" : undefined} href={item.href} key={item.id}>
              {item.label}
            </a>
          ))}
        </nav>
        <button
          aria-pressed={theme === "light"}
          className="app-theme-toggle"
          onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
          type="button"
        >
          <span><small>THEME</small><b>{theme === "dark" ? "다크모드" : "화이트모드"}</b></span>
          <i aria-hidden="true" />
        </button>
      </aside>
      <a aria-label="FDShield 이상거래 감시" className="app-mobile-brand" href="/#main">
        <BrandMark />
        <b>FDShield</b>
      </a>
      <nav aria-label="모바일 메뉴" className="app-mobile-nav">
        {navigation.map((item) => (
          <a className={item.id === activeNav ? "active" : undefined} href={item.href} key={item.id}>{item.label}</a>
        ))}
      </nav>
      <div className="app-content-root" id="app-content">{children}</div>
    </main>
  );
}
