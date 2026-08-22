// 학습이 완료되어 MLflow에 등록된 모델을 운영·처리 이력과 함께 찾는다.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AdminAlert } from "../admin/AdminAlert";
import { ModelLoadingStatus } from "./components/ModelLoadingStatus";
import { ModelPageShell } from "./components/ModelPageShell";
import { formatDate, STATUS_LABELS } from "./modelOperations";
import { fetchModelVersions } from "./mlopsApi";
import type { ModelVersionSummary } from "./mlopsTypes";

const PAGE_SIZE = 10;
const numberFormat = new Intl.NumberFormat("ko-KR");

type CatalogFilter = "ALL" | "OPERATED" | "PROCESSED" | "LABELED";
type CatalogSort = "LATEST" | "PROCESSED" | "AGREEMENT";

const filters: { value: CatalogFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "OPERATED", label: "운영 이력 있음" },
  { value: "PROCESSED", label: "처리 이력 있음" },
  { value: "LABELED", label: "라벨 비교 가능" },
];

function matchesFilter(model: ModelVersionSummary, filter: CatalogFilter) {
  if (filter === "OPERATED") {
    return model.status === "PRODUCTION" || model.status === "RETIRED";
  }
  if (filter === "PROCESSED") return model.usage.processed_transaction_count > 0;
  if (filter === "LABELED") return model.usage.labeled_transaction_count > 0;
  return true;
}

function usageText(model: ModelVersionSummary) {
  return model.usage.processed_transaction_count > 0
    ? `${numberFormat.format(model.usage.processed_transaction_count)}건`
    : "운영 이력 없음";
}

function agreementText(model: ModelVersionSummary) {
  const agreement = model.usage.label_agreement_percent;
  return agreement === null
    ? "라벨 없음"
    : `${agreement.toFixed(1)}% · ${numberFormat.format(model.usage.labeled_transaction_count)}건`;
}

export function ModelVersionsPage() {
  const [models, setModels] = useState<ModelVersionSummary[]>([]);
  const [filter, setFilter] = useState<CatalogFilter>("ALL");
  const [sort, setSort] = useState<CatalogSort>("LATEST");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchModelVersions()
      .then((response) => {
        if (!active) return;
        setModels(response);
        setError(null);
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "모델 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => setPage(1), [filter, search, sort]);

  const visibleModels = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return models
      .filter((model) => matchesFilter(model, filter))
      .filter((model) => !keyword || [
        `v${model.model_version}`,
        `model v${model.model_version}`,
        `run #${model.training_run_id}`,
        model.model_name,
        model.dataset_version,
      ].some((value) => value.toLowerCase().includes(keyword)))
      .sort((left, right) => {
        if (sort === "PROCESSED") {
          return right.usage.processed_transaction_count - left.usage.processed_transaction_count;
        }
        if (sort === "AGREEMENT") {
          return (right.usage.label_agreement_percent ?? -1)
            - (left.usage.label_agreement_percent ?? -1);
        }
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });
  }, [filter, models, search, sort]);

  const pageCount = Math.max(1, Math.ceil(visibleModels.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageModels = visibleModels.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const operatedCount = models.filter((model) =>
    model.status === "PRODUCTION" || model.status === "RETIRED").length;
  const processedCount = models.filter((model) =>
    model.usage.processed_transaction_count > 0).length;
  const labeledCount = models.filter((model) =>
    model.usage.labeled_transaction_count > 0).length;

  return (
    <ModelPageShell activeSection="versions">
      {error && <AdminAlert message={error} onDismiss={() => setError(null)} tone="error" />}
      {isLoading ? (
        <ModelLoadingStatus
          description="MLflow 등록 버전과 실제 거래 처리 이력을 연결하고 있습니다."
          label="MODEL CATALOG"
          title="저장된 모델을 불러오고 있습니다"
        />
      ) : (
        <section className="model-catalog-workspace">
          <header className="model-catalog-intro">
            <div>
              <p className="admin-eyebrow">MODEL CATALOG</p>
              <h2>저장된 모델</h2>
              <p>학습된 모델의 성능과 실제 운영 이력을 찾아 비교합니다.</p>
            </div>
            <dl>
              <div><dt>등록 모델</dt><dd>{numberFormat.format(models.length)}</dd></div>
              <div><dt>운영 이력</dt><dd>{numberFormat.format(operatedCount)}</dd></div>
              <div><dt>처리 이력</dt><dd>{numberFormat.format(processedCount)}</dd></div>
              <div><dt>라벨 비교</dt><dd>{numberFormat.format(labeledCount)}</dd></div>
            </dl>
          </header>

          <section className="admin-panel model-catalog-panel">
            <div className="model-catalog-toolbar">
              <div aria-label="모델 목록 필터" className="model-catalog-filters" role="group">
                {filters.map((item) => (
                  <button
                    aria-pressed={filter === item.value}
                    className={filter === item.value ? "active" : undefined}
                    key={item.value}
                    onClick={() => setFilter(item.value)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="model-catalog-search">
                <label>
                  <span>모델 검색</span>
                  <input
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="버전, Run, 데이터셋"
                    type="search"
                    value={search}
                  />
                </label>
                <label>
                  <span>정렬</span>
                  <select onChange={(event) => setSort(event.target.value as CatalogSort)} value={sort}>
                    <option value="LATEST">최신 모델순</option>
                    <option value="PROCESSED">처리 건수순</option>
                    <option value="AGREEMENT">라벨 일치율순</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="model-catalog-table-wrap">
              <table className="model-catalog-table">
                <thead>
                  <tr>
                    <th>모델 버전</th>
                    <th>학습 정보</th>
                    <th>학습 데이터셋</th>
                    <th>실제 처리</th>
                    <th>라벨 비교</th>
                    <th>상세</th>
                  </tr>
                </thead>
                <tbody>
                  {pageModels.map((model) => (
                    <tr key={model.training_run_id}>
                      <td data-label="모델 버전">
                        <div className="model-version-name">
                          <strong>model v{model.model_version}</strong>
                          <em className={`status ${model.status.toLowerCase()}`}>
                            {STATUS_LABELS[model.status] ?? model.status}
                          </em>
                        </div>
                      </td>
                      <td data-label="학습 정보">
                        <strong>Run #{model.training_run_id}</strong>
                        <small>{formatDate(model.created_at)}</small>
                      </td>
                      <td data-label="학습 데이터셋">
                        <span className="model-catalog-dataset" title={model.dataset_version}>
                          {model.dataset_version}
                        </span>
                      </td>
                      <td data-label="실제 처리">
                        <strong>{usageText(model)}</strong>
                        <small>
                          {model.usage.latest_inference_at
                            ? `최근 ${formatDate(model.usage.latest_inference_at)}`
                            : "운영 요청을 처리한 기록이 없습니다."}
                        </small>
                      </td>
                      <td data-label="라벨 비교">
                        <strong>{agreementText(model)}</strong>
                        <small>담당자 확정 라벨 기준</small>
                      </td>
                      <td data-label="상세">
                        <Link className="model-catalog-open" to={`/models/versions/${model.training_run_id}`}>
                          열기 →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pageModels.length === 0 && (
                <div className="model-catalog-empty">
                  <strong>조건에 맞는 모델이 없습니다.</strong>
                  <span>필터나 검색어를 바꿔보세요.</span>
                </div>
              )}
            </div>

            <footer className="model-catalog-pagination">
              <span>총 {numberFormat.format(visibleModels.length)}개 모델</span>
              <div>
                <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} type="button">이전</button>
                <strong>{currentPage} / {pageCount}</strong>
                <button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} type="button">다음</button>
              </div>
            </footer>
          </section>
        </section>
      )}
    </ModelPageShell>
  );
}
