// 추론, 학습 Job, 운영 VM을 한곳에서 보되 선택한 영역의 지표만 조회한다.

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { AdminAlert } from "../admin/AdminAlert";
import { MetricChart } from "./components/MetricChart";
import { ModelPageShell } from "./components/ModelPageShell";
import { formatClock, latestRevisionTraffic, resourceName, STATUS_LABELS } from "./modelOperations";
import {
  fetchInferencePerformance,
  fetchPlatformMonitoring,
  fetchPlatformStatus,
  fetchServingMonitoring,
  fetchServingStatus,
  fetchTrainingExecution,
  fetchTrainingMonitoring,
  fetchTrainingRuns,
} from "./mlopsApi";
import type {
  InferencePerformance,
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

export function ModelMonitoringPage() {
  const [target, setTarget] = useState<MonitoringTarget>("serving");
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [servingMonitoring, setServingMonitoring] = useState<ServingMonitoring | null>(null);
  const [trainingMonitoring, setTrainingMonitoring] = useState<TrainingMonitoring | null>(null);
  const [platformMonitoring, setPlatformMonitoring] = useState<PlatformMonitoring | null>(null);
  const [performance, setPerformance] = useState<InferencePerformance | null>(null);
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
        const [metrics, inference] = await Promise.all([
          fetchServingMonitoring(windowMinutes),
          fetchInferencePerformance().catch(() => null),
        ]);
        setServingMonitoring(metrics);
        setPerformance(inference);
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
    ? latestRevision ?? "Ready 리비전 없음"
    : target === "training"
      ? trainingMonitoring?.job_name ?? "Training Job"
      : platformMonitoring?.instance_name ?? "운영 VM";

  return (
    <ModelPageShell
      activeSection="monitoring"
      actions={(
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
      )}
    >
      <section aria-label="모델 운영 서버 선택" className="monitoring-service-rail">
        <button className={target === "serving" ? "active" : undefined} onClick={() => setTarget("serving")} type="button">
          <small>01 · ONLINE INFERENCE</small>
          <strong>추론 서비스</strong>
          <span>{serving?.reconciling ? "트래픽 전환 중" : serving ? "정상 운영" : "확인 불가"}</span>
          <em>{serving ? `${trafficPercent}% 트래픽` : "Cloud Run Serving"}</em>
        </button>
        <button className={target === "training" ? "active" : undefined} onClick={() => setTarget("training")} type="button">
          <small>02 · BATCH TRAINING</small>
          <strong>학습 Job</strong>
          <span>{latestRun ? STATUS_LABELS[latestRun.status] : "실행 이력 없음"}</span>
          <em>{latestRun ? `최근 Run #${latestRun.id}` : "Cloud Run Job"}</em>
        </button>
        <button className={target === "platform" ? "active" : undefined} onClick={() => setTarget("platform")} type="button">
          <small>03 · APPLICATION CORE</small>
          <strong>VM · DB</strong>
          <span>{platformStatus?.database_status === "UP" ? "정상 운영" : "확인 필요"}</span>
          <em>Backend · PostgreSQL</em>
        </button>
      </section>

      {error && <AdminAlert message={error} onDismiss={() => setError(null)} tone="error" />}

      <section className="monitoring-freshness">
        <div>
          <i aria-hidden="true" className={error ? "error" : "online"} />
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

      {target === "serving" && (
        <>
          <section aria-label="추론 서비스 핵심 지표" className="monitoring-summary-grid">
            <SummaryCard description={`최근 ${windowLabel(windowMinutes)} 합계`} label="Cloud 요청" unit="건" value={servingSummary?.request_count.toLocaleString("ko-KR") ?? "—"} />
            <SummaryCard description="느린 상위 5%의 경계" label="응답 P95" unit="ms" value={numberText(servingSummary?.p95_latency_ms)} />
            <SummaryCard description="가장 느린 상위 1%의 경계" label="응답 P99" unit="ms" value={numberText(servingSummary?.p99_latency_ms)} />
            <SummaryCard description="인스턴스 대기 구간" label="대기 P95" unit="ms" value={numberText(servingSummary?.pending_p95_latency_ms)} />
            <SummaryCard description="Cloud Run 5xx 응답" label="오류율" tone={(servingSummary?.error_rate_percent ?? 0) > 0 ? "negative" : "positive"} unit="%" value={numberText(servingSummary?.error_rate_percent, 2)} />
            <SummaryCard description={`활성 ${numberText(servingSummary?.active_instances)} · 유휴 ${numberText(servingSummary?.idle_instances)}`} label="인스턴스" unit="개" value={numberText(instanceCount)} />
          </section>
          <section className="monitoring-chart-grid">
            <MetricChart
              description={`${(servingMonitoring?.alignment_seconds ?? 60) / 60}분 단위 Cloud Run 요청 수`}
              series={[{ label: "요청", color: "#de3deb", points: servingMonitoring?.series.request_count ?? [] }]}
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
                { label: "메모리", color: "#de3deb", points: servingMonitoring?.series.memory_utilization_percent ?? [] },
              ]}
              showDate={showDate}
              title="자원 사용률"
              unit="%"
            />
          </section>
          <footer className="monitoring-context-note">
            <span>Backend 저장 기준 최근 {performance?.window_minutes ?? 5}분</span>
            <strong>{performance?.inference_count.toLocaleString("ko-KR") ?? "—"}건 추론</strong>
            <strong>P95 {performance?.p95_latency_ms ?? "—"}ms</strong>
            <em>마지막 요청 {performance?.latest_inference_at ? formatClock(performance.latest_inference_at) : "대기 중"}</em>
          </footer>
        </>
      )}

      {target === "training" && (
        <>
          <section aria-label="학습 Job 핵심 지표" className="monitoring-summary-grid">
            <SummaryCard description={latestRun ? STATUS_LABELS[latestRun.status] : "실행 이력 없음"} label="최근 학습" value={latestRun ? `Run #${latestRun.id}` : "—"} />
            <SummaryCard description="현재 실행 중인 Execution" label="실행 중" tone={(trainingSummary?.running_executions ?? 0) > 0 ? "accent" : undefined} unit="개" value={numberText(trainingSummary?.running_executions)} />
            <SummaryCard description={`최근 ${windowLabel(windowMinutes)} 합계`} label="완료 실행" unit="개" value={trainingSummary?.completed_executions.toLocaleString("ko-KR") ?? "—"} />
            <SummaryCard description="청구 대상 인스턴스 시간" label="사용 시간" unit="분" value={trainingSummary ? Math.round(trainingSummary.billable_instance_seconds / 60) : "—"} />
            <SummaryCard description="Job 컨테이너 중앙값" label="CPU" unit="%" value={numberText(trainingSummary?.cpu_utilization_percent, 1)} />
            <SummaryCard description="Job 컨테이너 중앙값" label="메모리" unit="%" value={numberText(trainingSummary?.memory_utilization_percent, 1)} />
          </section>
          <section className="monitoring-chart-grid">
            <MetricChart
              description="실행 중인 Job과 구간별 완료 수"
              series={[
                { label: "실행 중", color: "#f1b54a", points: trainingMonitoring?.series.running_executions ?? [] },
                { label: "완료", color: "#45d49a", points: trainingMonitoring?.series.completed_executions ?? [] },
              ]}
              showDate={showDate}
              title="Execution 활동"
              unit="개"
            />
            <MetricChart
              decimals={1}
              description="Training Job 컨테이너 자원 사용률"
              series={[
                { label: "CPU", color: "#6ca9ff", points: trainingMonitoring?.series.cpu_utilization_percent ?? [] },
                { label: "메모리", color: "#de3deb", points: trainingMonitoring?.series.memory_utilization_percent ?? [] },
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
              title="Billable time"
              unit="초"
            />
            <article className="monitoring-detail-panel">
              <header><div><h2>최근 Execution</h2><p>가장 최근 학습 Run의 실제 실행 결과</p></div><em className={`status ${(execution?.outcome ?? "unknown").toLowerCase()}`}>{execution?.outcome ?? "정보 없음"}</em></header>
              {execution ? (
                <>
                  <strong>{resourceName(execution.name)}</strong>
                  <dl>
                    <div><dt>실행 시간</dt><dd>{durationText(execution.start_time, execution.completion_time)}</dd></div>
                    <div><dt>성공 Task</dt><dd>{execution.succeeded_count}</dd></div>
                    <div><dt>실패 Task</dt><dd>{execution.failed_count}</dd></div>
                    <div><dt>재시도</dt><dd>{execution.retried_count}</dd></div>
                  </dl>
                  {execution.failure_reason && <p className="negative">{execution.failure_reason}</p>}
                  {execution.log_uri && <a href={execution.log_uri} rel="noreferrer" target="_blank">Cloud Logging 열기</a>}
                </>
              ) : <div className="monitoring-detail-empty">최근 Run에 연결된 실행 정보가 없습니다.</div>}
            </article>
          </section>
        </>
      )}

      {target === "platform" && (
        <>
          <section aria-label="운영 VM과 DB 핵심 지표" className="monitoring-summary-grid">
            <SummaryCard description="관리 API 응답 가능" label="Backend" tone={platformStatus ? "positive" : "negative"} value={platformStatus?.backend_status ?? "확인 불가"} />
            <SummaryCard description="SELECT 1 연결 확인" label="PostgreSQL" tone={platformStatus?.database_status === "UP" ? "positive" : "negative"} value={platformStatus?.database_status ?? "확인 불가"} />
            <SummaryCard description="Backend에서 DB까지" label="DB 응답" unit="ms" value={numberText(platformStatus?.database_latency_ms, 1)} />
            <SummaryCard description="Compute Engine 기본 지표" label="VM CPU" unit="%" value={numberText(platformSummary?.cpu_utilization_percent, 1)} />
            <SummaryCard description="Ops Agent 수집 지표" label="VM 메모리" unit="%" value={numberText(platformSummary?.memory_utilization_percent, 1)} />
            <SummaryCard description="Ops Agent 수집 지표" label="디스크" unit="%" value={numberText(platformSummary?.disk_utilization_percent, 1)} />
          </section>
          <section className="monitoring-chart-grid">
            <MetricChart
              decimals={1}
              description="Compute Engine 인스턴스 CPU 사용률"
              series={[{ label: "CPU", color: "#6ca9ff", points: platformMonitoring?.series.cpu_utilization_percent ?? [] }]}
              showDate={showDate}
              title="VM CPU"
              unit="%"
            />
            <MetricChart
              decimals={1}
              description="Ops Agent가 수집한 메모리 사용률"
              series={[{ label: "메모리", color: "#de3deb", points: platformMonitoring?.series.memory_utilization_percent ?? [] }]}
              showDate={showDate}
              title="VM 메모리"
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
            <article className="monitoring-detail-panel platform-identity-panel">
              <header><div><h2>플랫폼 연결</h2><p>거래 처리 Backend와 저장소 상태</p></div><em className={`status ${platformStatus?.database_status === "UP" ? "production" : "failed"}`}>{platformStatus?.database_status === "UP" ? "HEALTHY" : "CHECK"}</em></header>
              <strong>{platformMonitoring?.instance_name ?? "운영 VM 확인 중"}</strong>
              <dl>
                <div><dt>Zone</dt><dd>{platformMonitoring?.zone ?? "—"}</dd></div>
                <div><dt>Backend</dt><dd>{platformStatus?.backend_status ?? "—"}</dd></div>
                <div><dt>Database</dt><dd>{platformStatus?.database_status ?? "—"}</dd></div>
                <div><dt>수집 Agent</dt><dd>{platformMonitoring?.ops_agent_available ? "연결됨" : "확인 필요"}</dd></div>
              </dl>
              {!platformMonitoring?.ops_agent_available && (
                <p>메모리·디스크가 비어 있으면 VM에 Ops Agent 설치 상태를 확인하세요.</p>
              )}
            </article>
          </section>
        </>
      )}
    </ModelPageShell>
  );
}
