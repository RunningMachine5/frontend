import type { ReactNode } from "react";

import "./AppLayout.css";

type AppLayoutProps = {
  activeNav: "dashboard" | "queue" | "case" | "rules" | "model";
  children: ReactNode;
};

const navigation = [
  { id: "dashboard", label: "통합 모니터링", href: "/#main" },
  { id: "queue", label: "이상거래 탐색", href: "/#queue" },
  { id: "case", label: "이상거래 분석", href: "/#case" },
  { id: "rules", label: "룰 규칙 관리", href: "/#rules" },
  { id: "model", label: "모델 관리", href: "/models" },
] as const;

// 모든 화면에서 같은 사이드바와 화면 폭을 사용한다.
export function AppLayout({ activeNav, children }: AppLayoutProps) {
  return (
    <main className="app-layout">
      <a className="app-skip-link" href="#app-content">본문으로 건너뛰기</a>
      <aside className="app-sidebar">
        <a className="app-brand" href="/#main"><span>F</span><b>FDS Monitor</b></a>
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
      <nav aria-label="모바일 메뉴" className="app-mobile-nav">
        {navigation.map((item) => (
          <a className={item.id === activeNav ? "active" : undefined} href={item.href} key={item.id}>{item.label}</a>
        ))}
      </nav>
      <div className="app-content-root" id="app-content">{children}</div>
    </main>
  );
}
