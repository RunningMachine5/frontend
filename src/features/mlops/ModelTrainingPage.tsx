// 학습 데이터셋 버전과 Cloud Run 학습 실행 이력을 관리한다.

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AdminAlert } from "../admin/AdminAlert";
import { ModelPageShell } from "./components/ModelPageShell";
import {
  ACTIVE_RUN_STATUSES,
  formatDate,
  STATUS_LABELS,
} from "./modelOperations";
import {
  buildDataset,
  fetchDatasets,
  fetchTrainingRuns,
  reconcileTrainingRun,
  startTraining,
} from "./mlopsApi";
import type { DatasetVersion, TrainingRun } from "./mlopsTypes";

const TRAINING_REFRESH_MS = 5_000;

export function ModelTrainingPage() {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<DatasetVersion[]>([]);
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [dialog, setDialog] = useState<"dataset" | "training" | null>(null);
  const [trainingDatasetId, setTrainingDatasetId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const [datasetRows, trainingRows] = await Promise.all([
        fetchDatasets(),
        fetchTrainingRuns(),
      ]);
      setDatasets(datasetRows);
      setRuns(trainingRows);
      setTrainingDatasetId((current) => current ?? datasetRows[0]?.id ?? null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "학습 이력을 불러오지 못했습니다.");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const hasActiveRun = runs.some((run) => ACTIVE_RUN_STATUSES.has(run.status));

  useEffect(() => {
    if (!hasActiveRun) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, TRAINING_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [hasActiveRun, load]);

  useEffect(() => {
    if (!dialog) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [dialog]);

  const runAction = async (action: () => Promise<void>) => {
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.");
    } finally {
      setIsBusy(false);
    }
  };

  const createDataset = () => runAction(async () => {
    const created = await buildDataset();
    setDialog(null);
    setNotice(`${created.version} 데이터셋을 생성했습니다.`);
    await load();
  });

  const launchTraining = () => runAction(async () => {
    if (!trainingDatasetId) return;
    const result = await startTraining(trainingDatasetId);
    setDialog(null);
    setNotice(`학습 Run #${result.training_run.id}을 시작했습니다.`);
    await load();
  });

  const reconcile = (run: TrainingRun) => runAction(async () => {
    const result = await reconcileTrainingRun(run.id);
    setNotice(`Run #${run.id} 상태 확인: ${result.execution_outcome}`);
    await load();
  });

  const openRun = (runId: number) => {
    navigate(`/models/runs/${runId}`);
  };

  return (
    <ModelPageShell
      activeSection="training"
      actions={<><button className="admin-button" onClick={() => setDialog("dataset")} type="button">새 데이터셋</button><button className="admin-button primary" disabled={datasets.length === 0} onClick={() => setDialog("training")} type="button">학습 실행</button></>}
      title="학습 · Run 관리"
    >
      {error && <AdminAlert message={error} onDismiss={() => setError(null)} tone="error" />}
      {notice && <AdminAlert message={notice} onDismiss={() => setNotice(null)} tone="success" />}

      <section className="training-workspace">
        <aside className="admin-panel dataset-ledger">
          <div className="panel-title split">
            <div><p className="admin-eyebrow">DATASET VERSIONS</p><h2>학습 데이터셋</h2><small>확정 라벨을 합친 불변 GCS 객체입니다.</small></div>
            <strong>{datasets.length}</strong>
          </div>
          <div className="dataset-ledger-list">
            {datasets.length === 0 && !isLoading ? (
              <div className="model-empty-state"><strong>데이터셋이 없습니다.</strong><span>새 버전을 만들어 학습을 준비하세요.</span></div>
            ) : datasets.map((dataset, index) => (
              <article className={index === 0 ? "latest" : undefined} key={dataset.id}>
                <header><strong>{dataset.version}</strong>{index === 0 && <em>최신</em>}</header>
                <dl><div><dt>행 수</dt><dd>{dataset.row_count.toLocaleString("ko-KR")}</dd></div><div><dt>생성</dt><dd>{formatDate(dataset.created_at)}</dd></div></dl>
                <small title={dataset.gcs_uri}>{dataset.gcs_uri.replace(/^gs:\/\/[^/]+\//, "GCS · ")}</small>
              </article>
            ))}
          </div>
        </aside>

        <article className="admin-panel training-runs-panel">
          <div className="panel-title split">
            <div><p className="admin-eyebrow">TRAINING RUNS</p><h2>학습 실행 이력</h2><small>행을 선택하면 Run 상세를 열고, 진행 중 Run만 5초마다 갱신합니다.</small></div>
            <button className="admin-button compact" disabled={isLoading || isBusy} onClick={() => void load(true)} type="button">상태 새로고침</button>
          </div>
          <div className="admin-table-wrap">
            <table>
              <thead><tr><th>Run</th><th>데이터셋</th><th>상태</th><th>실행 시각</th><th>실패 원인</th><th>작업</th></tr></thead>
              <tbody>
                {runs.map((run) => (
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
                    <td>{datasets.find((dataset) => dataset.id === run.dataset_version_id)?.version ?? `#${run.dataset_version_id}`}</td>
                    <td><em className={`status ${run.status.toLowerCase()}`}>{STATUS_LABELS[run.status]}</em></td>
                    <td>{formatDate(run.created_at)}</td>
                    <td className="run-error-cell" title={run.error_message ?? undefined}>{run.error_message ?? "—"}</td>
                    <td>
                      {["REQUESTED", "RUNNING"].includes(run.status) ? (
                        <button
                          className="table-action-button"
                          disabled={isBusy}
                          onClick={(event) => {
                            event.stopPropagation();
                            void reconcile(run);
                          }}
                          type="button"
                        >
                          상태 확인
                        </button>
                      ) : (
                        <span aria-hidden="true" className="row-open-hint">열기 →</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {runs.length === 0 && !isLoading && <div className="table-empty">학습 실행 이력이 없습니다.</div>}
          </div>
        </article>
      </section>

      {dialog === "dataset" && <div className="admin-dialog-backdrop" onMouseDown={() => setDialog(null)} role="presentation"><section aria-modal="true" className="admin-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header><div><p className="admin-eyebrow">DATASET VERSION</p><h2>새 학습 데이터셋</h2></div><button onClick={() => setDialog(null)} type="button">닫기</button></header><p className="dialog-help">기존 train1 학습 데이터와 DB의 확정 라벨을 합칩니다. 버전명과 GCS 객체 경로는 생성 시각을 기준으로 자동 결정됩니다.</p><button className="admin-button primary" disabled={isBusy} onClick={() => void createDataset()} type="button">{isBusy ? "생성 중…" : "데이터셋 생성"}</button></section></div>}
      {dialog === "training" && <div className="admin-dialog-backdrop" onMouseDown={() => setDialog(null)} role="presentation"><section aria-modal="true" className="admin-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header><div><p className="admin-eyebrow">CLOUD RUN JOB</p><h2>학습 실행</h2></div><button onClick={() => setDialog(null)} type="button">닫기</button></header><label><span>학습 데이터셋</span><select autoComplete="off" name="training-dataset" onChange={(event) => setTrainingDatasetId(Number(event.target.value))} value={trainingDatasetId ?? ""}>{datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.version} · {dataset.row_count.toLocaleString("ko-KR")}행</option>)}</select></label><p className="dialog-help">학습은 비동기로 실행되며 완료 후 후보 검토 단계로 이동합니다.</p><button className="admin-button primary" disabled={!trainingDatasetId || isBusy} onClick={() => void launchTraining()} type="button">학습 시작</button></section></div>}
    </ModelPageShell>
  );
}
