import { useEffect, type ReactNode } from "react";

import "./AppLayout.css";

type AppLayoutProps = {
  activeNav: "dashboard" | "analysis" | "rules" | "model";
  children: ReactNode;
};

const navigation = [
  { id: "dashboard", label: "통합 모니터링", href: "/#main" },
  { id: "analysis", label: "이상거래 분석", href: "/#queue" },
  { id: "rules", label: "룰 규칙 관리", href: "/#rules" },
  { id: "model", label: "모델 관리", href: "/models" },
] as const;

const pageTitles = {
  dashboard: "통합 모니터링",
  analysis: "이상거래 분석",
  rules: "룰 규칙 관리",
  model: "모델 관리",
} as const;

function BrandMark() {
  return <span aria-hidden="true" className="app-brand-mark"><img alt="" src="/fdshield-logo.png" /></span>;
}

// 모든 화면에서 같은 사이드바와 화면 폭을 사용한다.
export function AppLayout({ activeNav, children }: AppLayoutProps) {
  useEffect(() => {
    document.title = `${pageTitles[activeNav]} | FDShield`;
  }, [activeNav]);

  return (
    <main className="app-layout">
      <a className="app-skip-link" href="#app-content">본문으로 건너뛰기</a>
      <aside className="app-sidebar">
        <a aria-label="FDShield 통합 모니터링" className="app-brand" href="/#main">
          <BrandMark />
          <span className="app-brand-copy"><b>FDShield</b><small>FRAUD DEFENSE SYSTEM</small></span>
        </a>
        <p className="app-nav-title">MONITORING</p>
        <nav>
          {navigation.map((item) => (
            <a className={item.id === activeNav ? "active" : undefined} href={item.href} key={item.id}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="app-system-status"><i />데이터 스트림 연결됨<small>SSE 실시간 갱신</small></div>
      </aside>
      <a aria-label="FDShield 통합 모니터링" className="app-mobile-brand" href="/#main">
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
