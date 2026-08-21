import { useEffect, useState, type ReactNode } from "react";

import {
  fetchDemoTransactionInjectionStatus,
  startDemoTransactionInjection,
  type DemoTransactionInjectionStatus,
} from "../../features/demo/demoApi";
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

function demoStatusText(status: DemoTransactionInjectionStatus | null) {
  if (status?.state === "RUNNING") {
    return `${status.processed_count}/${status.total_count}`;
  }
  if (status?.state === "COMPLETED") return "완료";
  if (status?.state === "FAILED") return "실패";
  return "실행";
}

// 모든 화면에서 같은 사이드바와 화면 폭을 사용한다.
export function AppLayout({ activeNav, children }: AppLayoutProps) {
  const [theme, setTheme] = useState<Theme>(() => (
    localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark"
  ));
  const [demoStatus, setDemoStatus] = useState<DemoTransactionInjectionStatus | null>(
    null,
  );
  const [demoError, setDemoError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${pageTitles[activeNav]} | FDShield`;
  }, [activeNav]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    void fetchDemoTransactionInjectionStatus()
      .then((status) => {
        if (!cancelled) setDemoStatus(status);
      })
      .catch(() => {
        if (!cancelled) setDemoError("상태 확인 실패");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (demoStatus?.state !== "RUNNING") return;
    const timer = window.setInterval(() => {
      void fetchDemoTransactionInjectionStatus()
        .then((status) => {
          setDemoStatus(status);
          setDemoError(status.error_message);
        })
        .catch(() => setDemoError("상태 확인 실패"));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [demoStatus?.state]);

  const startDemo = async () => {
    setDemoError(null);
    try {
      setDemoStatus(await startDemoTransactionInjection());
    } catch (cause) {
      setDemoError(
        cause instanceof Error
          ? cause.message
          : "시연 테스트를 시작하지 못했습니다.",
      );
    }
  };

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
        <div className="app-sidebar-controls">
          <button
            className="app-demo-test-button"
            disabled={demoStatus?.state === "RUNNING"}
            onClick={() => void startDemo()}
            title={demoError ?? "테스트 거래 100건을 초당 1건씩 주입합니다."}
            type="button"
          >
            <span><small>DEMO</small><b>100건 시연 테스트</b></span>
            <em>{demoError ? "오류" : demoStatusText(demoStatus)}</em>
          </button>
          <button
            aria-pressed={theme === "light"}
            className="app-theme-toggle"
            onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            type="button"
          >
            <span><small>THEME</small><b>{theme === "dark" ? "다크모드" : "화이트모드"}</b></span>
            <i aria-hidden="true" />
          </button>
        </div>
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
