import { useEffect, useState, type ReactNode } from "react";

import {
  fetchDemoTransactionInjectionStatus,
  startDemoTransactionInjection,
  type DemoTransactionCount,
  type DemoTransactionInjectionStatus,
} from "../../features/demo/demoApi";
import "./AppLayout.css";

type NavigationId = "dashboard" | "analysis" | "rules" | "model" | "monitoring";

type NavigationItem = {
  id: NavigationId;
  label: string;
  href: string;
};

type AppLayoutProps = {
  activeNav: NavigationId;
  children: ReactNode;
  className?: string;
};

const navigationGroups: { label: string; items: NavigationItem[] }[] = [
  {
    label: "MONITORING",
    items: [
      { id: "dashboard", label: "이상거래 감시", href: "/#main" },
      { id: "analysis", label: "이상거래 분석", href: "/#queue" },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { id: "rules", label: "룰 관리", href: "/#rules" },
      { id: "model", label: "모델 관리", href: "/models" },
    ],
  },
  {
    label: "SYSTEM OPERATIONS",
    items: [
      { id: "monitoring", label: "서버 모니터링", href: "/models/monitoring" },
    ],
  },
];

const navigation = navigationGroups.flatMap((group) => group.items);

const pageTitles = {
  dashboard: "이상거래 감시",
  analysis: "이상거래 분석",
  rules: "룰 관리",
  model: "모델 관리",
  monitoring: "서버 모니터링",
} as const;

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "fds.theme";
const DEMO_TRANSACTION_COUNTS = [100, 500, 1000] as const;

function BrandMark() {
  return <span aria-hidden="true" className="app-brand-mark"><img alt="" src="/fdshield-mark.png" /></span>;
}

function demoStatusText(status: DemoTransactionInjectionStatus | null) {
  if (status?.state === "RUNNING") {
    return `${status.processed_count}/${status.total_count}`;
  }
  if (status?.state === "COMPLETED") return "완료";
  if (status?.state === "FAILED") return "실패";
  return "대기";
}

// 모든 화면에서 같은 사이드바와 화면 폭을 사용한다.
export function AppLayout({ activeNav, children, className }: AppLayoutProps) {
  const [theme, setTheme] = useState<Theme>(() => (
    localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark"
  ));
  const [demoStatus, setDemoStatus] = useState<DemoTransactionInjectionStatus | null>(
    null,
  );
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoTransactionCount, setDemoTransactionCount] =
    useState<DemoTransactionCount>(100);
  const [demoTransactionsPerSecond, setDemoTransactionsPerSecond] = useState(1);

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

  useEffect(() => {
    if (demoStatus?.state !== "RUNNING") return;
    setDemoTransactionCount(demoStatus.total_count);
    setDemoTransactionsPerSecond(demoStatus.transactions_per_second);
  }, [demoStatus]);

  const startDemo = async () => {
    setDemoError(null);
    try {
      setDemoStatus(await startDemoTransactionInjection({
        transaction_count: demoTransactionCount,
        transactions_per_second: demoTransactionsPerSecond,
      }));
    } catch (cause) {
      setDemoError(
        cause instanceof Error
          ? cause.message
          : "시연 테스트를 시작하지 못했습니다.",
      );
    }
  };

  return (
    <main className={`app-layout${className ? ` ${className}` : ""}`}>
      <a className="app-skip-link" href="#app-content">본문으로 건너뛰기</a>
      <aside className="app-sidebar">
        <a aria-label="FDShield 이상거래 감시" className="app-brand" href="/#main">
          <BrandMark />
          <span className="app-brand-copy"><b>FDShield</b><small>FRAUD DETECTION SYSTEM</small></span>
        </a>
        <nav aria-label="주요 메뉴" className="app-sidebar-navigation">
          {navigationGroups.map((group) => (
            <section className="app-nav-group" key={group.label}>
              <p className="app-nav-title">{group.label}</p>
              <div className="app-nav-items">
                {group.items.map((item) => (
                  <a className={item.id === activeNav ? "active" : undefined} href={item.href} key={item.id}>
                    {item.label}
                  </a>
                ))}
              </div>
            </section>
          ))}
        </nav>
        <div className="app-sidebar-controls">
          <section aria-label="시연 테스트 설정" className="app-demo-test-panel">
            <div className="app-demo-test-heading">
              <b>시연 테스트</b>
              <em aria-live="polite">
                {demoError ? "오류" : demoStatusText(demoStatus)}
              </em>
            </div>
            <fieldset
              className="app-demo-count-fieldset"
              disabled={demoStatus?.state === "RUNNING"}
            >
              <legend>건수</legend>
              <div className="app-demo-count-options">
                {DEMO_TRANSACTION_COUNTS.map((count) => (
                  <button
                    aria-pressed={demoTransactionCount === count}
                    key={count}
                    onClick={() => setDemoTransactionCount(count)}
                    type="button"
                  >
                    {count.toLocaleString()}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="app-demo-speed-control">
              <label htmlFor="demo-transactions-per-second">
                최대 속도
                <output>{demoTransactionsPerSecond}건/초</output>
              </label>
              <input
                disabled={demoStatus?.state === "RUNNING"}
                id="demo-transactions-per-second"
                max="5"
                min="1"
                onInput={(event) => (
                  setDemoTransactionsPerSecond(Number(event.currentTarget.value))
                )}
                step="1"
                type="range"
                value={demoTransactionsPerSecond}
              />
            </div>
            <button
              className="app-demo-test-button"
              disabled={demoStatus?.state === "RUNNING"}
              onClick={() => void startDemo()}
              title={demoError ?? `테스트 거래 ${demoTransactionCount.toLocaleString()}건을 최대 초당 ${demoTransactionsPerSecond}건씩 주입합니다.`}
              type="button"
            >
              {demoStatus?.state === "RUNNING" ? "주입 중" : "시연 시작"}
            </button>
          </section>
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
