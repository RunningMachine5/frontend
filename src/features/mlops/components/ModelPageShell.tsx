// 모델 관리 하위 화면의 공통 제목과 내부 메뉴를 그린다.

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { AppLayout } from "../../../components/layout/AppLayout";
import { PageHeading } from "../../../components/layout/PageHeading";
import "../../admin/AdminWorkspace.css";

type ModelSection = "overview" | "labeling" | "training" | "monitoring";

type ModelPageShellProps = {
  activeSection: ModelSection;
  actions?: ReactNode;
  children: ReactNode;
};

const sections: { id: ModelSection; label: string; to: string }[] = [
  { id: "overview", label: "운영 현황", to: "/models" },
  { id: "labeling", label: "거래 라벨링", to: "/models/labeling" },
  { id: "training", label: "학습 · 배포", to: "/models/training" },
  { id: "monitoring", label: "서버 모니터링", to: "/models/monitoring" },
];

export function ModelPageShell({
  activeSection,
  actions,
  children,
}: ModelPageShellProps) {
  const isOverview = activeSection === "overview";

  return (
    <AppLayout activeNav="model" className={isOverview ? "model-overview-layout" : undefined}>
      <section className={`admin-page model-section-page${isOverview ? " model-overview-page" : ""}`}>
        <header className="app-page-header admin-header">
          <PageHeading eyebrow="MODEL MANAGEMENT" title="모델 관리" />
          {actions && <div className="admin-actions">{actions}</div>}
        </header>
        <nav aria-label="모델 관리 메뉴" className="model-section-nav">
          {sections.map((section) => (
            <Link
              className={section.id === activeSection ? "active" : undefined}
              key={section.id}
              to={section.to}
            >
              {section.label}
            </Link>
          ))}
        </nav>
        <div className="model-section-content">{children}</div>
      </section>
    </AppLayout>
  );
}
