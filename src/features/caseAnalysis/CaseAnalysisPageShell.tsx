import type { ReactNode } from "react";

import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeading } from "../../components/layout/PageHeading";
import "./CaseAnalysisPageShell.css";

type AnalysisSection = "search" | "detail";

type CaseAnalysisPageShellProps = {
  activeSection: AnalysisSection;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName: string;
  headerClassName?: string;
};

const sections: { id: AnalysisSection; label: string; href: string }[] = [
  { id: "search", label: "거래 탐색", href: "/#queue" },
  { id: "detail", label: "상세 분석", href: "/#case" },
];

// 거래 탐색과 상세 분석이 같은 업무 흐름임을 공통 제목과 탭으로 보여준다.
export function CaseAnalysisPageShell({
  activeSection,
  actions,
  children,
  contentClassName,
  headerClassName,
}: CaseAnalysisPageShellProps) {
  const headerClasses = ["app-page-header", "case-analysis-header", headerClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <AppLayout activeNav="analysis">
      <section className={contentClassName}>
        <header className={headerClasses}>
          <PageHeading eyebrow="FRAUD ANALYSIS" title="이상거래 분석" />
          {actions}
        </header>
        <nav aria-label="이상거래 분석 메뉴" className="case-analysis-nav">
          {sections.map((section) => (
            <a
              aria-current={section.id === activeSection ? "page" : undefined}
              className={section.id === activeSection ? "active" : undefined}
              href={section.href}
              key={section.id}
            >
              {section.label}
            </a>
          ))}
        </nav>
        {children}
      </section>
    </AppLayout>
  );
}
