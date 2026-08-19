// 모델 관리 하위 화면의 공통 제목과 내부 메뉴를 그린다.

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { AppLayout } from "../../../components/layout/AppLayout";
import { PageHeading } from "../../../components/layout/PageHeading";
import "../../admin/AdminWorkspace.css";

type ModelSection = "overview" | "labeling" | "training" | "monitoring";

type ModelPageShellProps = {
  activeSection: ModelSection;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
};

const sections: { id: ModelSection; label: string; to: string }[] = [
  { id: "overview", label: "운영 현황", to: "/models" },
  { id: "labeling", label: "거래 라벨링", to: "/models/labeling" },
  { id: "training", label: "학습 · Run", to: "/models/training" },
  { id: "monitoring", label: "성능 모니터링", to: "/models/monitoring" },
];

export function ModelPageShell({
  activeSection,
  title,
  actions,
  children,
}: ModelPageShellProps) {
  return (
    <AppLayout activeNav="model">
      <section className="admin-page model-section-page">
        <header className="app-page-header admin-header">
          <PageHeading eyebrow="MODEL OPERATIONS" title={title} />
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
