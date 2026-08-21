// 학습 데이터셋 버전과 Cloud Run 학습 실행 이력을 관리한다.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AdminAlert } from "../admin/AdminAlert";
import {
  ModelLoadingStatus,
  type ModelLoadingStatusProps,
} from "./components/ModelLoadingStatus";
import { ModelPageShell } from "./components/ModelPageShell";
import {
  ACTIVE_RUN_STATUSES,
  findCurrentProductionRun,
  formatDate,
  STATUS_LABELS,
  trainingDisplayStatus,
} from "./modelOperations";
import {
  buildDataset,
  deleteDataset,
  fetchDatasetPreview,
  fetchDatasets,
  fetchTrainingRuns,
  prepareTrainingRun,
  reconcileTrainingRun,
} from "./mlopsApi";
import type {
  DatasetPeriodSummary,
  DatasetVersion,
  TrainingRun,
} from "./mlopsTypes";

const TRAINING_REFRESH_MS = 5_000;
const DEFAULT_DATASET_PERIOD_START = "2026-08-01";
const DATASETS_PER_PAGE = 3;

const todayInputValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatPeriodDate = (value: string | null) =>
  value ? value.replaceAll("-", ".") : "기간 정보 없음";

function TrainingWorkspaceSkeleton() {
  return (
    <section aria-hidden="true" className="training-workspace training-workspace-skeleton">
      <aside className="admin-panel">
        <div className="training-skeleton-heading"><i /><i /></div>
        <div className="training-skeleton-cards">
          {Array.from({ length: 3 }, (_, index) => <i key={index} />)}
        </div>
      </aside>
      <article className="admin-panel">
        <div className="training-skeleton-heading"><i /><i /></div>
        <div className="training-skeleton-rows">
          {Array.from({ length: 6 }, (_, index) => <i key={index} />)}
        </div>
      </article>
    </section>
  );
}

export function ModelTrainingPage() {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<DatasetVersion[]>([]);
  const [datasetPage, setDatasetPage] = useState(1);
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [dialog, setDialog] = useState<"dataset" | "training" | null>(null);
  const [trainingDatasetId, setTrainingDatasetId] = useState<number | null>(null);
  const [periodStart, setPeriodStart] = useState(DEFAULT_DATASET_PERIOD_START);
  const [periodEnd, setPeriodEnd] = useState(todayInputValue);
  const [periodPreview, setPeriodPreview] = useState<DatasetPeriodSummary | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DatasetVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [busyActivity, setBusyActivity] = useState<ModelLoadingStatusProps | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRequestId = useRef(0);

  const load = useCallback(async (showLoading = false) => {
    const requestId = ++loadRequestId.current;
    if (showLoading) setIsLoading(true);
    try {
      const [datasetRows, trainingRows] = await Promise.all([
        fetchDatasets(),
        fetchTrainingRuns(),
      ]);
      if (requestId !== loadRequestId.current) return;
      setDatasets(datasetRows);
      setRuns(trainingRows);
      setTrainingDatasetId((current) => (
        current && datasetRows.some((dataset) => dataset.id === current)
          ? current
          : datasetRows[0]?.id ?? null
      ));
      setError(null);
    } catch (cause) {
      if (requestId !== loadRequestId.current) return;
      setError(cause instanceof Error ? cause.message : "학습 이력을 불러오지 못했습니다.");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const datasetPageCount = Math.max(1, Math.ceil(datasets.length / DATASETS_PER_PAGE));

  useEffect(() => {
    if (datasetPage > datasetPageCount) setDatasetPage(datasetPageCount);
  }, [datasetPage, datasetPageCount]);

  const hasActiveRun = runs.some((run) => ACTIVE_RUN_STATUSES.has(run.status));

  useEffect(() => {
    if (!hasActiveRun) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, TRAINING_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [hasActiveRun, load]);

  useEffect(() => {
    if (!dialog && !deleteTarget) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDialog(null);
        setDeleteTarget(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [deleteTarget, dialog]);

  useEffect(() => {
    if (dialog !== "dataset") return;
    if (!periodStart || !periodEnd || periodStart > periodEnd) {
      setPeriodPreview(null);
      setPreviewError("시작일과 종료일을 확인하세요.");
      return;
    }

    let cancelled = false;
    setIsPreviewLoading(true);
    setPeriodPreview(null);
    setPreviewError(null);
    void fetchDatasetPreview(periodStart, periodEnd)
      .then((summary) => {
        if (!cancelled) setPeriodPreview(summary);
      })
      .catch((cause) => {
        if (cancelled) return;
        setPeriodPreview(null);
        setPreviewError(
          cause instanceof Error ? cause.message : "기간 집계를 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dialog, periodEnd, periodStart]);

  const runAction = async (
    activity: ModelLoadingStatusProps,
    action: () => Promise<void>,
  ) => {
    setIsBusy(true);
    setBusyActivity(activity);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.");
    } finally {
      setIsBusy(false);
      setBusyActivity(null);
    }
  };

  const createDataset = () => runAction({
    description: "확정 라벨을 모아 GCS 파일과 새 버전 정보를 생성합니다.",
    label: "DATASET BUILD",
    title: "학습 데이터셋을 만들고 있습니다",
  }, async () => {
    const created = await buildDataset(periodStart, periodEnd);
    setDialog(null);
    setDatasetPage(1);
    setNotice(`${created.version} 데이터셋을 생성했습니다.`);
    await load();
  });

  const removeDataset = () => runAction({
    description: "GCS 객체와 연결된 데이터셋 기록을 정리합니다.",
    label: "DATASET CLEANUP",
    title: "학습 데이터셋을 삭제하고 있습니다",
  }, async () => {
    if (!deleteTarget) return;
    const deletedId = deleteTarget.id;
    const deletedVersion = deleteTarget.version;
    const remainingDatasets = datasets.filter((dataset) => dataset.id !== deletedId);
    await deleteDataset(deletedId);
    setDatasets(remainingDatasets);
    setTrainingDatasetId((current) => (
      current && remainingDatasets.some((dataset) => dataset.id === current)
        ? current
        : remainingDatasets[0]?.id ?? null
    ));
    setDeleteTarget(null);
    setNotice(`${deletedVersion} 데이터셋을 삭제했습니다.`);
    await load();
  });

  const launchTraining = () => runAction({
    description: "Run 기록을 만든 뒤 진행 상태를 확인할 상세 화면으로 이동합니다.",
    label: "TRAINING RUN",
    title: "학습 Run을 준비하고 있습니다",
  }, async () => {
    if (!trainingDatasetId) return;
    const run = await prepareTrainingRun(trainingDatasetId);
    setDialog(null);
    navigate(`/models/runs/${run.id}`, { state: { executeTraining: true } });
  });

  const reconcile = (run: TrainingRun) => runAction({
    description: "Cloud Run 실행 결과와 저장된 Run 상태를 맞춥니다.",
    label: "CLOUD RUN",
    title: `Run #${run.id} 실행 상태를 확인하고 있습니다`,
  }, async () => {
    const result = await reconcileTrainingRun(run.id);
    setNotice(`Run #${run.id} 상태 확인: ${result.execution_outcome}`);
    await load();
  });

  const openRun = (runId: number) => {
    navigate(`/models/runs/${runId}`);
  };

  const usedDatasetIds = new Set(runs.map((run) => run.dataset_version_id));
  const productionRun = findCurrentProductionRun(runs);
  const datasetPageStart = (datasetPage - 1) * DATASETS_PER_PAGE;
  const visibleDatasets = datasets.slice(
    datasetPageStart,
    datasetPageStart + DATASETS_PER_PAGE,
  );

  return (
    <ModelPageShell
      activeSection="training"
      actions={(
        <>
          <button
            className="admin-button"
            onClick={() => setDialog("dataset")}
            type="button"
          >
            새 데이터셋
          </button>
          <button
            className="admin-button primary"
            disabled={datasets.length === 0}
            onClick={() => setDialog("training")}
            type="button"
          >
            학습 실행
          </button>
        </>
      )}
    >
      {error && <AdminAlert message={error} onDismiss={() => setError(null)} tone="error" />}
      {notice && <AdminAlert message={notice} onDismiss={() => setNotice(null)} tone="success" />}

      {busyActivity ? (
        <ModelLoadingStatus {...busyActivity} />
      ) : isLoading ? (
        <ModelLoadingStatus
          description="학습 데이터셋과 Run 이력을 동시에 조회합니다."
          label="TRAINING WORKSPACE"
          title="학습·배포 화면을 준비하고 있습니다"
        />
      ) : null}

      {isLoading && datasets.length === 0 && runs.length === 0 ? (
        <TrainingWorkspaceSkeleton />
      ) : (
      <section className="training-workspace">
        <aside className="admin-panel dataset-ledger">
          <div className="panel-title split">
            <div><p className="admin-eyebrow">DATASET VERSIONS</p><h2>학습 데이터셋</h2><small>기존 학습 데이터에 선택 기간의 확정 라벨을 추가해 만든 데이터입니다.</small></div>
            <strong>{datasets.length}</strong>
          </div>
          <div className="dataset-ledger-list">
            {datasets.length === 0 && !isLoading ? (
              <div className="model-empty-state"><strong>데이터셋이 없습니다.</strong><span>새 버전을 만들어 학습을 준비하세요.</span></div>
            ) : visibleDatasets.map((dataset, index) => {
              const datasetIndex = datasetPageStart + index;
              const labeledCount = (
                dataset.period_normal_count + dataset.period_fraud_count
              );
              const normalPercent = labeledCount === 0
                ? 0
                : (dataset.period_normal_count / labeledCount) * 100;
              const isUsed = usedDatasetIds.has(dataset.id);

              return (
                <article className={datasetIndex === 0 ? "latest" : undefined} key={dataset.id}>
                  <header className="dataset-card-header">
                    <div>
                      <strong title={dataset.version}>{dataset.version}</strong>
                      <span className="dataset-card-badges">
                        {datasetIndex === 0 && <em>최신</em>}
                        {isUsed && <em className="used">학습 사용됨</em>}
                      </span>
                    </div>
                    <button
                      aria-label={`${dataset.version} 삭제`}
                      className="dataset-delete-button"
                      disabled={isUsed || isBusy}
                      onClick={() => setDeleteTarget(dataset)}
                      title={isUsed ? "학습 이력이 연결된 데이터셋입니다." : "데이터셋 삭제"}
                      type="button"
                    >
                      삭제
                    </button>
                  </header>

                  <p className="dataset-period">
                    <span>추가 라벨 기간</span>
                    <strong>
                      {dataset.period_start && dataset.period_end
                        ? `${formatPeriodDate(dataset.period_start)} – ${formatPeriodDate(dataset.period_end)}`
                        : "직접 등록된 데이터셋"}
                    </strong>
                  </p>

                  <dl>
                    <div><dt>전체 행</dt><dd>{dataset.row_count.toLocaleString("ko-KR")}</dd></div>
                    <div className="normal"><dt>기간 정상</dt><dd>{dataset.period_normal_count.toLocaleString("ko-KR")}</dd></div>
                    <div className="fraud"><dt>기간 사기</dt><dd>{dataset.period_fraud_count.toLocaleString("ko-KR")}</dd></div>
                    <div><dt>생성</dt><dd>{formatDate(dataset.created_at)}</dd></div>
                  </dl>

                  {labeledCount > 0 && (
                    <div
                      aria-label={`정상 ${dataset.period_normal_count}건, 사기 ${dataset.period_fraud_count}건`}
                      className="dataset-label-mix"
                      role="img"
                    >
                      <span className="normal" style={{ width: `${normalPercent}%` }} />
                      <span className="fraud" style={{ width: `${100 - normalPercent}%` }} />
                    </div>
                  )}
                  <small title={dataset.gcs_uri}>
                    {dataset.gcs_uri.replace(/^gs:\/\/[^/]+\//, "GCS · ")}
                  </small>
                </article>
              );
            })}
          </div>
          {datasetPageCount > 1 && (
            <nav aria-label="학습 데이터셋 페이지" className="dataset-pagination">
              <button
                disabled={datasetPage === 1}
                onClick={() => setDatasetPage((page) => page - 1)}
                type="button"
              >
                이전
              </button>
              <span><strong>{datasetPage}</strong> / {datasetPageCount}</span>
              <button
                disabled={datasetPage === datasetPageCount}
                onClick={() => setDatasetPage((page) => page + 1)}
                type="button"
              >
                다음
              </button>
            </nav>
          )}
        </aside>

        <article className="admin-panel training-runs-panel">
          <div className="panel-title split">
            <div><p className="admin-eyebrow">TRAINING RUNS</p><h2>학습 실행 이력</h2><small>행을 선택하면 Run 상세를 열고, 진행 중 Run만 5초마다 갱신합니다.</small></div>
            <button className="admin-button compact" disabled={isLoading || isBusy} onClick={() => void load(true)} type="button">상태 새로고침</button>
          </div>
          <div className="admin-table-wrap">
            <table className="training-runs-table">
              <thead><tr><th>Run</th><th>데이터셋</th><th>상태</th><th>실행 시각</th><th>실패 원인</th><th>작업</th></tr></thead>
              <tbody>
                {runs.map((run) => {
                  const datasetVersion = datasets.find((dataset) => dataset.id === run.dataset_version_id)?.version ?? `#${run.dataset_version_id}`;
                  const displayStatus = trainingDisplayStatus(run, productionRun?.id ?? null);

                  return (
                    <tr
                      aria-label={`Run #${run.id} 상세 보기`}
                      className="training-run-row"
                      key={run.id}
                      onClick={() => openRun(run.id)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openRun(run.id);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td><strong className="run-id-label">#{run.id}</strong></td>
                      <td className="training-run-dataset-cell" title={datasetVersion}>{datasetVersion}</td>
                      <td><em className={`status ${displayStatus.toLowerCase()}`}>{STATUS_LABELS[displayStatus]}</em></td>
                      <td>{formatDate(run.created_at)}</td>
                      <td className="run-error-cell" title={run.error_message ?? undefined}>{run.error_message ?? "—"}</td>
                      <td>
                        {["REQUESTED", "RUNNING"].includes(run.status) ? (
                          <button
                            className="table-action-button"
                            disabled={isBusy || !run.cloud_run_execution_name}
                            onClick={(event) => {
                              event.stopPropagation();
                              void reconcile(run);
                            }}
                            type="button"
                          >
                            {run.cloud_run_execution_name ? "상태 확인" : "실행 연결 대기 중"}
                          </button>
                        ) : (
                          <span aria-hidden="true" className="row-open-hint">열기 →</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {runs.length === 0 && !isLoading && <div className="table-empty">학습 실행 이력이 없습니다.</div>}
          </div>
        </article>
      </section>
      )}

      {dialog === "dataset" && (
        <div
          className="admin-dialog-backdrop"
          onMouseDown={() => setDialog(null)}
          role="presentation"
        >
          <section
            aria-labelledby="dataset-dialog-title"
            aria-modal="true"
            className="admin-dialog dataset-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header>
              <div>
                <p className="admin-eyebrow">DATASET VERSION</p>
                <h2 id="dataset-dialog-title">새 학습 데이터셋</h2>
              </div>
              <button onClick={() => setDialog(null)} type="button">닫기</button>
            </header>

            <form
              className="dataset-build-form"
              onSubmit={(event) => {
                event.preventDefault();
                void createDataset();
              }}
            >
              <p className="dialog-help">
                기본 데이터(2026.01.01 – 2026.07.31)에 선택 기간의 판정 완료 거래를
                합쳐 새 GCS 파일을 만듭니다.
              </p>

              <div className="dataset-period-fields">
                <label>
                  <span>시작일</span>
                  <input
                    onChange={(event) => setPeriodStart(event.target.value)}
                    type="date"
                    value={periodStart}
                  />
                </label>
                <label>
                  <span>종료일</span>
                  <input
                    min={periodStart}
                    onChange={(event) => setPeriodEnd(event.target.value)}
                    type="date"
                    value={periodEnd}
                  />
                </label>
              </div>

              <section aria-live="polite" className="dataset-preview">
                <div className="dataset-preview-title">
                  <strong>선택 기간의 판정 완료 데이터</strong>
                  {periodPreview && <span>{periodPreview.labeled_count.toLocaleString("ko-KR")}건</span>}
                </div>
                {isPreviewLoading ? (
                  <p>라벨 건수를 확인하고 있습니다…</p>
                ) : previewError ? (
                  <p className="error">{previewError}</p>
                ) : periodPreview ? (
                  <dl>
                    <div><dt>전체 라벨</dt><dd>{periodPreview.labeled_count.toLocaleString("ko-KR")}</dd></div>
                    <div className="normal"><dt>정상</dt><dd>{periodPreview.normal_count.toLocaleString("ko-KR")}</dd></div>
                    <div className="fraud"><dt>사기</dt><dd>{periodPreview.fraud_count.toLocaleString("ko-KR")}</dd></div>
                  </dl>
                ) : null}
              </section>

              <p className="dataset-name-guide">
                파일명에 기간과 정상·사기 건수가 자동 기록됩니다.
              </p>
              <button
                className="admin-button primary"
                disabled={
                  isBusy
                  || isPreviewLoading
                  || !periodPreview
                  || periodPreview.labeled_count === 0
                }
                type="submit"
              >
                {isBusy ? "생성 중…" : "이 기간으로 데이터셋 생성"}
              </button>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div
          className="admin-dialog-backdrop"
          onMouseDown={() => setDeleteTarget(null)}
          role="presentation"
        >
          <section
            aria-labelledby="dataset-delete-title"
            aria-modal="true"
            className="admin-dialog dataset-delete-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header>
              <div>
                <p className="admin-eyebrow">DELETE DATASET</p>
                <h2 id="dataset-delete-title">데이터셋 삭제</h2>
              </div>
              <button onClick={() => setDeleteTarget(null)} type="button">닫기</button>
            </header>
            <p className="dataset-delete-copy">
              GCS 파일과 데이터셋 목록 기록이 함께 삭제됩니다. 이 작업은 되돌릴 수
              없습니다.
            </p>
            <div className="dataset-delete-summary">
              <strong>{deleteTarget.version}</strong>
              <small>{deleteTarget.gcs_uri}</small>
            </div>
            <div className="dialog-actions">
              <button
                className="admin-button"
                disabled={isBusy}
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                취소
              </button>
              <button
                className="admin-button danger-button"
                disabled={isBusy}
                onClick={() => void removeDataset()}
                type="button"
              >
                {isBusy ? "삭제 중…" : "GCS에서도 삭제"}
              </button>
            </div>
          </section>
        </div>
      )}
      {dialog === "training" && <div className="admin-dialog-backdrop" onMouseDown={() => setDialog(null)} role="presentation"><section aria-modal="true" className="admin-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header><div><p className="admin-eyebrow">CLOUD RUN JOB</p><h2>학습 실행</h2></div><button onClick={() => setDialog(null)} type="button">닫기</button></header><label><span>학습 데이터셋</span><select autoComplete="off" name="training-dataset" onChange={(event) => setTrainingDatasetId(Number(event.target.value))} value={trainingDatasetId ?? ""}>{datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.version} · {dataset.row_count.toLocaleString("ko-KR")}행</option>)}</select></label><p className="dialog-help">학습은 비동기로 실행되며 완료 후 후보 검토 단계로 이동합니다.</p><button className="admin-button primary" disabled={!trainingDatasetId || isBusy} onClick={() => void launchTraining()} type="button">학습 시작</button></section></div>}
    </ModelPageShell>
  );
}
