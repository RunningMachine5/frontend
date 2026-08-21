// 추론, 학습 작업, 운영 VM을 한곳에서 보되 선택한 영역의 지표만 조회한다.

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeading } from "../../components/layout/PageHeading";
import { AdminAlert } from "../admin/AdminAlert";
import "../admin/AdminWorkspace.css";
import { ModelLoadingStatus } from "./components/ModelLoadingStatus";
import { MetricChart } from "./components/MetricChart";
import { formatClock, formatDate, latestRevisionTraffic, resourceName, STATUS_LABELS } from "./modelOperations";
import {
  fetchPlatformMonitoring,
  fetchPlatformStatus,
  fetchServingMonitoring,
  fetchServingStatus,
  fetchTrainingExecution,
  fetchTrainingMonitoring,
  fetchTrainingRuns,
} from "./mlopsApi";
import type {
  PlatformMonitoring,
  PlatformStatus,
  ServingMonitoring,
  ServingStatus,
  TrainingExecution,
  TrainingMonitoring,
  TrainingRun,
} from "./mlopsTypes";

type MonitoringTarget = "serving" | "training" | "platform";

const MONITORING_REFRESH_MS = 60_000;
const WINDOWS = [15, 60, 360, 1440] as const;
const EXECUTION_OUTCOME_LABELS: Record<TrainingExecution["outcome"], string> = {
  RUNNING: "실행 중",
  SUCCEEDED: "완료",
  FAILED: "실패",
  UNKNOWN: "확인 불가",
};

function numberText(value: number | null | undefined, decimals = 0) {
  return value === null || value === undefined ? "—" : value.toFixed(decimals);
}

function windowLabel(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  if (minutes === 1440) return "1일";
  return `${minutes / 60}시간`;
}

function durationText(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  const seconds = Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (seconds < 60) return `${Math.round(seconds)}초`;
  return `${Math.round(seconds / 60)}분`;
}

function SummaryCard({
  label,
  value,
  unit,
  description,
  tone,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  description: string;
  tone?: "positive" | "negative" | "accent";
}) {
  return (
    <article>
      <span>{label}</span>
      <strong className={tone}>{value}{unit && <small>{unit}</small>}</strong>
      <p>{description}</p>
    </article>
  );
}

function MonitoringSkeleton({ target }: { target: MonitoringTarget }) {
  const label = target === "serving"
    ? "추론 서비스"
    : target === "training"
      ? "학습 작업"
      : "VM · DB";

  return (
    <>
      <ModelLoadingStatus
        description="Cloud Monitoring에서 선택한 구간의 최신 시계열을 조회합니다."
        label="CLOUD METRICS"
        title={`${label} 지표를 불러오고 있습니다`}
      />
      <section aria-hidden="true" className="monitoring-summary-grid monitoring-summary-skeleton">
        {Array.from({ length: 6 }, (_, index) => (
          <article key={index}><i /><i /><i /></article>
        ))}
      </section>
      <section aria-hidden="true" className="monitoring-chart-grid monitoring-chart-skeleton">
        {Array.from({ length: 4 }, (_, index) => (
          <article className="monitoring-chart-panel monitoring-chart-skeleton-panel" key={index}>
            <i /><i /><i />
          </article>
        ))}
      </section>
    </>
  );
}

export function ModelMonitoringPage() {
  const [target, setTarget] = useState<MonitoringTarget>("serving");
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [servingMonitoring, setServingMonitoring] = useState<ServingMonitoring | null>(null);
  const [trainingMonitoring, setTrainingMonitoring] = useState<TrainingMonitoring | null>(null);
  const [platformMonitoring, setPlatformMonitoring] = useState<PlatformMonitoring | null>(null);
  const [serving, setServing] = useState<ServingStatus | null>(null);
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [execution, setExecution] = useState<TrainingExecution | null>(null);
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    setIsRefreshing(true);
    setError(null);

    const [servingStatus, trainingRuns, currentPlatformStatus] = await Promise.all([
      fetchServingStatus().catch(() => null),
      fetchTrainingRuns().catch(() => []),
      fetchPlatformStatus().catch(() => null),
    ]);
    setServing(servingStatus);
    setRuns(trainingRuns);
    setPlatformStatus(currentPlatformStatus);

    try {
      if (target === "serving") {
        setServingMonitoring(await fetchServingMonitoring(windowMinutes));
      }

      if (target === "training") {
        const latestRun = trainingRuns[0] ?? null;
        const [metrics, latestExecution] = await Promise.all([
          fetchTrainingMonitoring(windowMinutes),
          latestRun?.cloud_run_execution_name
            ? fetchTrainingExecution(latestRun.id).catch(() => null)
            : Promise.resolve(null),
        ]);
        setTrainingMonitoring(metrics);
        setExecution(latestExecution);
      }

      if (target === "platform") {
        setPlatformMonitoring(await fetchPlatformMonitoring(windowMinutes));
      }
    } catch (cause) {
      if (target === "serving") setServingMonitoring(null);
      if (target === "training") setTrainingMonitoring(null);
      if (target === "platform") setPlatformMonitoring(null);
      setError(cause instanceof Error ? cause.message : "서버 지표를 불러오지 못했습니다.");
    } finally {
      setUpdatedAt(new Date());
      setIsRefreshing(false);
    }
  }, [target, windowMinutes]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), MONITORING_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const latestRun = runs[0] ?? null;
  const latestRevision = resourceName(serving?.latest_ready_revision);
  const trafficPercent = latestRevisionTraffic(serving);
  const servingSummary = servingMonitoring?.summary;
  const trainingSummary = trainingMonitoring?.summary;
  const platformSummary = platformMonitoring?.summary;
  const mlflowLatency = platformMonitoring?.dependencies.mlflow_latency_ms;
  const certificateDays = platformMonitoring?.dependencies
    .https_certificate_days_remaining;
  const certificateTone = certificateDays === null || certificateDays === undefined
    ? "negative"
    : certificateDays < 14
      ? "negative"
      : certificateDays < 30
        ? "accent"
        : "positive";
  const currentMonitoring = target === "serving"
    ? servingMonitoring
    : target === "training"
      ? trainingMonitoring
      : platformMonitoring;
  const isInitialLoading = isRefreshing
    && currentMonitoring?.window_minutes !== windowMinutes;
  const instanceCount = servingSummary?.active_instances === null
    || servingSummary?.active_instances === undefined
    ? null
    : servingSummary.active_instances + (servingSummary.idle_instances ?? 0);
  const showDate = windowMinutes === 1440;
  const sampleAt = target === "serving"
    ? servingMonitoring?.latest_sample_at
    : target === "training"
      ? trainingMonitoring?.latest_sample_at
      : platformMonitoring?.latest_sample_at;
  const dataDelay = target === "serving"
    ? servingMonitoring?.data_delay_seconds
    : target === "training"
      ? trainingMonitoring?.data_delay_seconds
      : platformMonitoring?.data_delay_seconds;
  const activeResource = target === "serving"
    ? latestRevision ?? "준비된 버전 없음"
    : target === "training"
      ? trainingMonitoring?.job_name ?? "학습 작업"
      : platformMonitoring?.instance_name ?? "운영 VM";

  return (
    <AppLayout activeNav="monitoring">
      <section className="admin-page model-section-page server-monitoring-page">
        <header className="app-page-header admin-header">
          <PageHeading eyebrow="SYSTEM MONITORING" title="서버 모니터링" />
          <div className="admin-actions">
            <div aria-label="조회 구간" className="monitoring-range-control">
              {WINDOWS.map((minutes) => (
                <button
                  aria-pressed={windowMinutes === minutes}
                  className={windowMinutes === minutes ? "active" : undefined}
                  key={minutes}
                  onClick={() => setWindowMinutes(minutes)}
                  type="button"
                >
                  {windowLabel(minutes)}
                </button>
              ))}
            </div>
          </div>
        </header>
        <div className="model-section-content">
      <section aria-label="모델 운영 서버 선택" className="monitoring-service-rail">
        <button className={target === "serving" ? "active" : undefined} onClick={() => setTarget("serving")} type="button">
          <small>01 · ML INFERENCE</small>
          <strong>ML 추론 서버</strong>
          <span>{serving?.reconciling ? "트래픽 전환 중" : serving ? "정상 운영" : "확인 불가"}</span>
          <em>{serving ? `${trafficPercent}% 트래픽` : "Cloud Run 추론"}</em>
        </button>
        <button className={target === "training" ? "active" : undefined} onClick={() => setTarget("training")} type="button">
          <small>02 · ML TRAINING</small>
          <strong>ML 학습 서버</strong>
          <span>{latestRun ? STATUS_LABELS[latestRun.status] : "실행 이력 없음"}</span>
          <em>{latestRun ? `최근 학습 #${latestRun.id}` : "Cloud Run 작업"}</em>
        </button>
        <button className={target === "platform" ? "active" : undefined} onClick={() => setTarget("platform")} type="button">
          <small>03 · PLATFORM VM</small>
          <strong>운영 VM</strong>
          <span>{platformStatus?.database_status === "UP" ? "정상 운영" : "확인 필요"}</span>
          <em>백엔드 · MLflow · PostgreSQL</em>
        </button>
      </section>

      {error && <AdminAlert message={error} onDismiss={() => setError(null)} tone="error" />}

      <section className="monitoring-freshness">
        <div>
          <i aria-hidden="true" className={error ? "error" : isInitialLoading ? "loading" : "online"} />
          <span>{target === "serving" ? "추론" : target === "training" ? "학습" : "플랫폼"}</span>
          <strong>{activeResource}</strong>
        </div>
        <p>
          최근 샘플 <strong>{sampleAt ? formatClock(sampleAt) : "—"}</strong>
          <span>수집 지표는 최대 {dataDelay ?? (target === "platform" ? 240 : 120)}초 늦게 표시될 수 있습니다.</span>
          <em>{updatedAt ? `${formatClock(updatedAt)} 화면 갱신` : "지표 확인 중"}</em>
        </p>
        <button className="admin-button compact" disabled={isRefreshing} onClick={() => void load()} type="button">
          {isRefreshing ? "갱신 중…" : "지금 갱신"}
        </button>
      </section>

      {isInitialLoading && <MonitoringSkeleton target={target} />}

      {!isInitialLoading && target === "serving" && (
        <>
          <section aria-label="추론 서비스 핵심 지표" className="monitoring-summary-grid">
            <SummaryCard description={`최근 ${windowLabel(windowMinutes)} 합계`} label="요청 수" unit="건" value={servingSummary?.request_count.toLocaleString("ko-KR") ?? "—"} />
            <SummaryCard description="느린 상위 5%의 경계" label="응답 P95" unit="ms" value={numberText(servingSummary?.p95_latency_ms)} />
            <SummaryCard description="가장 느린 상위 1%의 경계" label="응답 P99" unit="ms" value={numberText(servingSummary?.p99_latency_ms)} />
            <SummaryCard description="인스턴스 대기 구간" label="대기 P95" unit="ms" value={numberText(servingSummary?.pending_p95_latency_ms)} />
            <SummaryCard description="서버 오류 응답" label="오류율" tone={(servingSummary?.error_rate_percent ?? 0) > 0 ? "negative" : "positive"} unit="%" value={numberText(servingSummary?.error_rate_percent, 2)} />
            <SummaryCard description={`활성 ${numberText(servingSummary?.active_instances)} · 유휴 ${numberText(servingSummary?.idle_instances)}`} label="인스턴스" unit="개" value={numberText(instanceCount)} />
          </section>
          <section className="monitoring-chart-grid">
            <MetricChart
              description={`${(servingMonitoring?.alignment_seconds ?? 60) / 60}분 단위 Cloud Run 요청 수`}
              series={[{ label: "요청", color: "#6f8fe6", points: servingMonitoring?.series.request_count ?? [] }]}
              showDate={showDate}
              title="요청 처리량"
              unit="건"
            />
            <MetricChart
              description="처리 지연과 인스턴스 대기 시간을 함께 비교합니다."
              series={[
                { label: "P95", color: "#f1b54a", points: servingMonitoring?.series.p95_latency_ms ?? [] },
                { label: "P99", color: "#ff7d89", points: servingMonitoring?.series.p99_latency_ms ?? [] },
                { label: "대기 P95", color: "#9b7cff", points: servingMonitoring?.series.pending_p95_latency_ms ?? [] },
              ]}
              showDate={showDate}
              title="응답 지연"
              unit="ms"
            />
            <MetricChart
              decimals={1}
              description="요청을 처리 중인 Cloud Run 인스턴스"
              series={[{ label: "활성", color: "#45d49a", points: servingMonitoring?.series.active_instances ?? [] }]}
              showDate={showDate}
              title="활성 인스턴스"
              unit="개"
            />
            <MetricChart
              decimals={1}
              description="Cloud Run 인스턴스의 자원 사용률 중앙값"
              series={[
                { label: "CPU", color: "#6ca9ff", points: servingMonitoring?.series.cpu_utilization_percent ?? [] },
                { label: "메모리", color: "#6f8fe6", points: servingMonitoring?.series.memory_utilization_percent ?? [] },
              ]}
              showDate={showDate}
              title="자원 사용률"
              unit="%"
            />
          </section>
        </>
      )}

      {!isInitialLoading && target === "training" && (
        <>
          <section aria-label="학습 작업 핵심 지표" className="monitoring-summary-grid">
            <SummaryCard description={latestRun ? STATUS_LABELS[latestRun.status] : "실행 이력 없음"} label="최근 학습" value={latestRun ? `학습 #${latestRun.id}` : "—"} />
            <SummaryCard description="현재 실행 중인 학습" label="실행 중" tone={(trainingSummary?.running_executions ?? 0) > 0 ? "accent" : undefined} unit="개" value={numberText(trainingSummary?.running_executions)} />
            <SummaryCard description={`최근 ${windowLabel(windowMinutes)} 합계`} label="완료 실행" unit="개" value={trainingSummary?.completed_executions.toLocaleString("ko-KR") ?? "—"} />
            <SummaryCard description="청구 대상 인스턴스 시간" label="사용 시간" unit="분" value={trainingSummary ? Math.round(trainingSummary.billable_instance_seconds / 60) : "—"} />
            <SummaryCard description="학습 컨테이너 중앙값" label="CPU" unit="%" value={numberText(trainingSummary?.cpu_utilization_percent, 1)} />
            <SummaryCard description="학습 컨테이너 중앙값" label="메모리" unit="%" value={numberText(trainingSummary?.memory_utilization_percent, 1)} />
          </section>
          <section className="monitoring-chart-grid">
            <MetricChart
              description="실행 중인 학습과 구간별 완료 수"
              series={[
                { label: "실행 중", color: "#f1b54a", points: trainingMonitoring?.series.running_executions ?? [] },
                { label: "완료", color: "#45d49a", points: trainingMonitoring?.series.completed_executions ?? [] },
              ]}
              showDate={showDate}
              title="학습 실행 현황"
              unit="개"
            />
            <MetricChart
              decimals={1}
              description="학습 작업 컨테이너의 자원 사용률"
              series={[
                { label: "CPU", color: "#6ca9ff", points: trainingMonitoring?.series.cpu_utilization_percent ?? [] },
                { label: "메모리", color: "#6f8fe6", points: trainingMonitoring?.series.memory_utilization_percent ?? [] },
              ]}
              showDate={showDate}
              title="학습 자원 사용률"
              unit="%"
            />
            <MetricChart
              decimals={1}
              description="구간별 청구 대상 인스턴스 시간"
              series={[{ label: "사용 시간", color: "#9b7cff", points: trainingMonitoring?.series.billable_instance_seconds ?? [] }]}
              showDate={showDate}
              title="청구 대상 사용 시간"
              unit="초"
            />
            <article className="monitoring-detail-panel">
              <header><div><h2>최근 학습 실행</h2><p>가장 최근 학습의 실제 실행 결과</p></div><em className={`status ${(execution?.outcome ?? "unknown").toLowerCase()}`}>{execution ? EXECUTION_OUTCOME_LABELS[execution.outcome] : "정보 없음"}</em></header>
              {execution ? (
                <>
                  <strong>{resourceName(execution.name)}</strong>
                  <dl>
                    <div><dt>실행 시간</dt><dd>{durationText(execution.start_time, execution.completion_time)}</dd></div>
                    <div><dt>완료 작업</dt><dd>{execution.succeeded_count}</dd></div>
                    <div><dt>실패 작업</dt><dd>{execution.failed_count}</dd></div>
                    <div><dt>재시도</dt><dd>{execution.retried_count}</dd></div>
                  </dl>
                  {execution.failure_reason && <p className="negative">{execution.failure_reason}</p>}
                </>
              ) : <div className="monitoring-detail-empty">최근 학습에 연결된 실행 정보가 없습니다.</div>}
            </article>
          </section>
        </>
      )}

      {!isInitialLoading && target === "platform" && (
        <>
          <section aria-label="운영 VM과 서비스 핵심 지표" className="monitoring-summary-grid">
            <SummaryCard
              description="CPU · 메모리 (%)"
              label="VM 자원"
              value={`${numberText(platformSummary?.cpu_utilization_percent, 1)} · ${numberText(platformSummary?.memory_utilization_percent, 1)}`}
            />
            <SummaryCard description="Ops Agent 수집 지표" label="디스크" unit="%" value={numberText(platformSummary?.disk_utilization_percent, 1)} />
            <SummaryCard
              description="백엔드에서 PostgreSQL까지"
              label="DB 응답"
              tone={platformStatus?.database_latency_ms === null || platformStatus?.database_latency_ms === undefined ? "negative" : "positive"}
              unit="ms"
              value={numberText(platformStatus?.database_latency_ms, 1)}
            />
            <SummaryCard
              description="인증된 Registry 조회"
              label="MLflow 응답"
              tone={mlflowLatency === null || mlflowLatency === undefined ? "negative" : "positive"}
              unit="ms"
              value={numberText(mlflowLatency, 1)}
            />
            <SummaryCard
              description={`정상 ${platformSummary?.normal_analysis_count?.toLocaleString("ko-KR") ?? "—"} · 사기 ${platformSummary?.fraud_analysis_count?.toLocaleString("ko-KR") ?? "—"}`}
              label="분석 완료"
              unit="건"
              value={platformSummary?.analysis_completed_count?.toLocaleString("ko-KR") ?? "—"}
            />
            <SummaryCard
              description={`${formatDate(platformMonitoring?.dependencies.https_certificate_expires_at ?? null)} 만료`}
              label="HTTPS 인증서"
              tone={certificateTone}
              unit={certificateDays === null || certificateDays === undefined ? undefined : "일"}
              value={certificateDays ?? "—"}
            />
          </section>
          <section className="monitoring-chart-grid">
            <MetricChart
              decimals={1}
              description="거래 처리 VM의 CPU와 메모리를 함께 비교합니다."
              series={[
                { label: "CPU", color: "#6ca9ff", points: platformMonitoring?.series.cpu_utilization_percent ?? [] },
                { label: "메모리", color: "#6f8fe6", points: platformMonitoring?.series.memory_utilization_percent ?? [] },
              ]}
              showDate={showDate}
              title="VM 자원 사용률"
              unit="%"
            />
            <MetricChart
              decimals={1}
              description="Ops Agent가 수집한 파일시스템 사용률"
              series={[{ label: "디스크", color: "#f1b54a", points: platformMonitoring?.series.disk_utilization_percent ?? [] }]}
              showDate={showDate}
              title="디스크 사용률"
              unit="%"
            />
            <MetricChart
              decimals={1}
              description="운영 VM의 전체 수신·송신 트래픽을 비교합니다."
              series={[
                { label: "수신", color: "#45d49a", points: platformMonitoring?.series.network_received_kilobytes_per_second ?? [] },
                { label: "송신", color: "#9b7cff", points: platformMonitoring?.series.network_sent_kilobytes_per_second ?? [] },
              ]}
              showDate={showDate}
              title="네트워크 송수신"
              unit="KB/s"
            />
            <MetricChart
              description="분석을 마치고 DB에 저장된 정상·사기 판정 건수입니다."
              series={[
                { label: "정상", color: "#6f8fe6", points: platformMonitoring?.series.normal_analysis_count ?? [] },
                { label: "사기", color: "#ff7d89", points: platformMonitoring?.series.fraud_analysis_count ?? [] },
              ]}
              showDate={showDate}
              title="거래 분석 처리량"
              unit="건"
            />
          </section>
        </>
      )}
        </div>
      </section>
    </AppLayout>
  );
}
