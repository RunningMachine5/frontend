// 학습이 완료되어 MLflow에 등록된 모델을 운영·처리 이력과 함께 찾는다.

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ModelLoadError } from "./components/ModelLoadError";
import { ModelLoadingStatus } from "./components/ModelLoadingStatus";
import { ModelPageShell } from "./components/ModelPageShell";
import {
  formatDate,
  hasEnoughLabelSample,
  labelCoveragePercent,
  STATUS_LABELS,
} from "./modelOperations";
import { fetchModelVersions } from "./mlopsApi";
import type { ModelVersionSummary } from "./mlopsTypes";

const PAGE_SIZE = 10;
const numberFormat = new Intl.NumberFormat("ko-KR");

type CatalogFilter = "ALL" | "OPERATED" | "PROCESSED" | "LABELED";
type CatalogSort = "LATEST" | "PROCESSED" | "AGREEMENT";

const filters: { value: CatalogFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "OPERATED", label: "운영 이력 있음" },
  { value: "PROCESSED", label: "처리 기록 있음" },
  { value: "LABELED", label: "라벨 비교 가능" },
];

function catalogSearchParams(
  filter: CatalogFilter,
  sort: CatalogSort,
  search: string,
  page: number,
) {
  const params = new URLSearchParams();
  if (filter !== "ALL") params.set("filter", filter);
  if (sort !== "LATEST") params.set("sort", sort);
  if (search) params.set("search", search);
  if (page > 1) params.set("page", String(page));
  return params;
}

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
    : "처리 기록 없음";
}

function agreementText(model: ModelVersionSummary) {
  const agreement = model.usage.label_agreement_percent;
  return agreement === null ? "라벨 없음" : `${agreement.toFixed(1)}%`;
}

function labelSampleText(model: ModelVersionSummary) {
  const labelCount = model.usage.labeled_transaction_count;
  if (labelCount === 0) return "담당자 확정 라벨이 없습니다.";
  const coverage = labelCoveragePercent(model.usage);
  const prefix = hasEnoughLabelSample(model.usage) ? "" : "표본 적음 · ";
  return `${prefix}${numberFormat.format(labelCount)}건 · 적용률 ${coverage?.toFixed(1)}%`;
}

export function ModelVersionsPage() {
  const [urlParams, setUrlParams] = useSearchParams();
  const [models, setModels] = useState<ModelVersionSummary[]>([]);
  const [filter, setFilter] = useState<CatalogFilter>(() => {
    const value = urlParams.get("filter");
    return filters.some((item) => item.value === value) ? value as CatalogFilter : "ALL";
  });
  const [sort, setSort] = useState<CatalogSort>(() => {
    const value = urlParams.get("sort");
    return value === "PROCESSED" || value === "AGREEMENT" ? value : "LATEST";
  });
  const [search, setSearch] = useState(() => urlParams.get("search") ?? "");
  const [page, setPage] = useState(() => {
    const value = Number(urlParams.get("page"));
    return Number.isInteger(value) && value > 0 ? value : 1;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    void fetchModelVersions(loadAttempt > 0)
      .then((response) => {
        if (!active) return;
        setModels(response);
      })
      .catch((cause) => {
        if (!active) return;
        setLoadError(cause instanceof Error ? cause.message : "모델 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [loadAttempt]);

  useEffect(() => {
    setUrlParams(catalogSearchParams(filter, sort, search, page), { replace: true });
  }, [filter, page, search, setUrlParams, sort]);

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
          const sampleOrder = Number(hasEnoughLabelSample(right.usage))
            - Number(hasEnoughLabelSample(left.usage));
          if (sampleOrder !== 0) return sampleOrder;
          const agreementOrder = (right.usage.label_agreement_percent ?? -1)
            - (left.usage.label_agreement_percent ?? -1);
          if (agreementOrder !== 0) return agreementOrder;
          return right.usage.labeled_transaction_count - left.usage.labeled_transaction_count;
        }
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });
  }, [filter, models, search, sort]);

  const pageCount = Math.max(1, Math.ceil(visibleModels.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [currentPage, page]);
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
  const catalogQuery = catalogSearchParams(filter, sort, search, currentPage).toString();

  return (
    <ModelPageShell activeSection="versions">
      {isLoading ? (
        <ModelLoadingStatus
          description="MLflow 등록 버전과 실제 거래 처리 이력을 연결하고 있습니다."
          label="MODEL CATALOG"
          title="저장된 모델을 불러오고 있습니다"
        />
      ) : loadError ? (
        <ModelLoadError
          description={loadError}
          label="MODEL CATALOG"
          onRetry={() => setLoadAttempt((current) => current + 1)}
          title="저장된 모델을 불러오지 못했습니다"
        />
      ) : (
        <section className="model-catalog-workspace">
          <header className="model-catalog-intro">
            <div>
              <p className="admin-eyebrow">MODEL CATALOG</p>
              <h2>저장된 모델</h2>
              <p>학습된 모델의 성능과 실제 처리 기록을 찾아 비교합니다.</p>
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
                    onClick={() => { setFilter(item.value); setPage(1); }}
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
                    autoComplete="off"
                    name="model-search"
                    onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                    placeholder="버전, Run, 데이터셋…"
                    type="search"
                    value={search}
                  />
                </label>
                <label>
                  <span>정렬</span>
                  <select onChange={(event) => { setSort(event.target.value as CatalogSort); setPage(1); }} value={sort}>
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
                            : "처리 기록이 없습니다."}
                        </small>
                      </td>
                      <td data-label="라벨 비교">
                        <strong>{agreementText(model)}</strong>
                        <small className={hasEnoughLabelSample(model.usage) ? undefined : "model-label-sample low"}>
                          {labelSampleText(model)}
                        </small>
                      </td>
                      <td data-label="상세">
                        <Link
                          className="model-catalog-open"
                          state={{ catalogSearch: catalogQuery ? `?${catalogQuery}` : "" }}
                          to={`/models/versions/${model.training_run_id}`}
                        >
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
