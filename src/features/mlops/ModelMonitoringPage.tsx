// Cloud Monitoring의 Cloud Run 지표와 DB에 저장된 최근 추론 성능을 함께 보여준다.

import { useCallback, useEffect, useState } from "react";

import { AdminAlert } from "../admin/AdminAlert";
import { MetricChart } from "./components/MetricChart";
import { ModelPageShell } from "./components/ModelPageShell";
import { formatClock, latestRevisionTraffic, resourceName } from "./modelOperations";
import {
  fetchInferencePerformance,
  fetchServingMonitoring,
  fetchServingStatus,
} from "./mlopsApi";
import type {
  InferencePerformance,
  ServingMonitoring,
  ServingStatus,
} from "./mlopsTypes";

const MONITORING_REFRESH_MS = 60_000;
const WINDOWS = [15, 60, 360] as const;

function numberText(value: number | null, decimals = 0) {
  return value === null ? "—" : value.toFixed(decimals);
}

export function ModelMonitoringPage() {
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [monitoring, setMonitoring] = useState<ServingMonitoring | null>(null);
  const [performance, setPerformance] = useState<InferencePerformance | null>(null);
  const [serving, setServing] = useState<ServingStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsRefreshing(true);
    const [monitoringResult, inference, servingStatus] = await Promise.all([
      fetchServingMonitoring(windowMinutes)
        .then((value) => ({ value, error: null }))
        .catch((cause: unknown) => ({
          value: null,
          error: cause instanceof Error ? cause.message : "Cloud Monitoring 지표를 불러오지 못했습니다.",
        })),
      fetchInferencePerformance().catch(() => null),
      fetchServingStatus().catch(() => null),
    ]);
    setMonitoring(monitoringResult.value);
    setPerformance(inference);
    setServing(servingStatus);
    setError(monitoringResult.error);
    setIsRefreshing(false);
  }, [windowMinutes]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, MONITORING_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const summary = monitoring?.summary;
  const instanceCount = summary?.active_instances === null || summary?.active_instances === undefined
    ? null
    : summary.active_instances + (summary.idle_instances ?? 0);
  const latestRevision = resourceName(serving?.latest_ready_revision);
  const trafficPercent = latestRevisionTraffic(serving);

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
              {minutes < 60 ? `${minutes}분` : `${minutes / 60}시간`}
            </button>
          ))}
        </div>
      )}
      title="Serving 성능 모니터링"
    >
      {error && <AdminAlert message={error} onDismiss={() => setError(null)} tone="error" />}

      <section className="monitoring-freshness">
        <div>
          <i aria-hidden="true" className={serving?.reconciling ? "changing" : serving ? "online" : undefined} />
          <span>{serving?.reconciling ? "트래픽 전환 중" : serving ? "Serving 정상" : "Serving 확인 불가"}</span>
          <strong>{latestRevision ?? "Ready 리비전 없음"}</strong>
          <em>{serving ? `${trafficPercent}% 트래픽` : "—"}</em>
        </div>
        <p>
          최근 샘플 <strong>{monitoring?.latest_sample_at ? formatClock(monitoring.latest_sample_at) : "—"}</strong>
          <span>Cloud Monitoring 특성상 최대 {monitoring?.data_delay_seconds ?? 120}초 늦게 표시될 수 있습니다.</span>
        </p>
        <button className="admin-button compact" disabled={isRefreshing} onClick={() => void load()} type="button">
          {isRefreshing ? "갱신 중…" : "지금 갱신"}
        </button>
      </section>

      <section aria-label="Serving 핵심 지표" className="monitoring-summary-grid">
        <article><span>Cloud 요청</span><strong>{summary?.request_count.toLocaleString("ko-KR") ?? "—"}<small>건</small></strong><p>최근 {monitoring?.window_minutes ?? windowMinutes}분</p></article>
        <article><span>응답 P95</span><strong>{numberText(summary?.p95_latency_ms ?? null)}<small>ms</small></strong><p>Cloud Run 요청 지연</p></article>
        <article><span>5xx 오류율</span><strong className={(summary?.error_rate_percent ?? 0) > 0 ? "negative" : "positive"}>{numberText(summary?.error_rate_percent ?? null, 2)}<small>%</small></strong><p>서버 오류 응답 비율</p></article>
        <article><span>인스턴스</span><strong>{numberText(instanceCount)}<small>개</small></strong><p>활성 {numberText(summary?.active_instances ?? null)} · 유휴 {numberText(summary?.idle_instances ?? null)}</p></article>
        <article><span>CPU 사용률</span><strong>{numberText(summary?.cpu_utilization_percent ?? null, 1)}<small>%</small></strong><p>인스턴스 중앙값</p></article>
        <article><span>메모리 사용률</span><strong>{numberText(summary?.memory_utilization_percent ?? null, 1)}<small>%</small></strong><p>인스턴스 중앙값</p></article>
      </section>

      <section className="monitoring-chart-grid">
        <MetricChart
          description="Cloud Run이 처리한 분당 요청 수"
          series={[{ label: "요청", color: "#de3deb", points: monitoring?.series.requests_per_minute ?? [] }]}
          title="요청 처리량"
          unit="건"
        />
        <MetricChart
          description="전체 요청 중 느린 상위 5%의 경계"
          series={[{ label: "P95", color: "#f1b54a", points: monitoring?.series.p95_latency_ms ?? [] }]}
          title="응답 지연"
          unit="ms"
        />
        <MetricChart
          description="요청을 처리 중인 Cloud Run 인스턴스"
          series={[{ label: "활성", color: "#45d49a", points: monitoring?.series.active_instances ?? [] }]}
          title="활성 인스턴스"
          unit="개"
          decimals={1}
        />
        <MetricChart
          description="Cloud Run 인스턴스 자원 사용률 중앙값"
          series={[
            { label: "CPU", color: "#6ca9ff", points: monitoring?.series.cpu_utilization_percent ?? [] },
            { label: "메모리", color: "#de3deb", points: monitoring?.series.memory_utilization_percent ?? [] },
          ]}
          title="자원 사용률"
          unit="%"
          decimals={1}
        />
      </section>

      <footer className="monitoring-inference-note">
        <span>Backend 저장 기준 최근 {performance?.window_minutes ?? 5}분</span>
        <strong>{performance?.inference_count.toLocaleString("ko-KR") ?? "—"}건 추론</strong>
        <strong>P95 {performance?.p95_latency_ms ?? "—"}ms</strong>
        <em>마지막 요청 {performance?.latest_inference_at ? formatClock(performance.latest_inference_at) : "대기 중"}</em>
      </footer>
    </ModelPageShell>
  );
}
