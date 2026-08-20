import type { RuleReplay } from "./ruleTypes";

type RuleReplayProps = {
  replay: RuleReplay | null;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatScore(value: number | null) {
  return value === null ? "—" : value.toFixed(3);
}

function formatSigned(value: number, digits = 0) {
  if (value === 0) return digits ? value.toFixed(digits) : "0";
  return `${value > 0 ? "+" : ""}${digits ? value.toFixed(digits) : value}`;
}

function deltaTone(value: number | null) {
  if (value === null || value === 0) return "same";
  return value > 0 ? "increase" : "decrease";
}

function transactionDeltaSummary(deltas: Record<string, number>) {
  const changed = Object.entries(deltas).filter(([, value]) => value !== 0);
  if (changed.length === 0) return "점수 동일 · 근거만 변경";

  return changed
    .map(([typeCode, value]) => `${typeCode} ${formatSigned(value, 3)}`)
    .join(" · ");
}

export function RuleReplaySummary({ replay }: RuleReplayProps) {
  return (
    <section aria-label="Replay 요약" className="verification-summary">
      <div className="verification-summary-title">
        <div>
          <p className="admin-eyebrow">REPLAY SUMMARY</p>
          <strong>운영 영향 요약</strong>
        </div>
        {replay && (
          <em className="report-scope">
            평가 {replay.evaluated_count.toLocaleString("ko-KR")}건
          </em>
        )}
      </div>

      {!replay ? (
        <p className="verification-summary-empty">
          Replay 비교를 실행하면 변경 거래와 평가 오류를 요약해 보여줍니다.
        </p>
      ) : (
        <dl className="verification-summary-grid">
          <div className="summary-primary">
            <dt>변경 거래</dt>
            <dd>{replay.changed_transaction_count.toLocaleString("ko-KR")}건</dd>
            <small>평가 거래 중 {formatPercent(replay.changed_transaction_rate)}</small>
          </div>
          <div>
            <dt>점수 변경</dt>
            <dd>{replay.score_changed_transaction_count.toLocaleString("ko-KR")}건</dd>
            <small>유형 점수 기준</small>
          </div>
          <div>
            <dt>근거 변경</dt>
            <dd>{replay.evidence_changed_transaction_count.toLocaleString("ko-KR")}건</dd>
            <small>구성요소 기준</small>
          </div>
          <div>
            <dt>미매칭 증감</dt>
            <dd className={deltaTone(replay.no_match_count_delta)}>
              {formatSigned(replay.no_match_count_delta)}건
            </dd>
            <small>ACTIVE {replay.active_no_match_count} → DRAFT {replay.draft_no_match_count}</small>
          </div>
          <div>
            <dt>평가 오류</dt>
            <dd className={replay.error_count ? "danger" : "positive"}>
              {replay.error_count.toLocaleString("ko-KR")}건
            </dd>
            <small>정상 {replay.evaluated_count.toLocaleString("ko-KR")}건</small>
          </div>
        </dl>
      )}
    </section>
  );
}

export function RuleReplayReport({ replay }: RuleReplayProps) {
  const changedComponents = replay?.component_impacts.filter((item) =>
    item.definition_changed || item.matched_transaction_count_delta !== 0,
  ) ?? [];

  return (
    <article className="admin-panel replay-report-panel">
      <div className="panel-title">
        <div>
          <p className="admin-eyebrow">IMPACT REPORT</p>
          <h2>ACTIVE 대비 영향 분석</h2>
          <small>유형, 구성요소, 변경 거래 순으로 확인합니다.</small>
        </div>
      </div>

      {!replay && (
        <div className="replay-empty">
          <strong>아직 비교 결과가 없습니다.</strong>
          <p>왼쪽에서 규칙 검증을 통과한 뒤 Replay를 실행하면 운영 룰 대비 변화가 여기에 표시됩니다.</p>
        </div>
      )}

      {replay && (
        <div className="replay-report-content">
          <section className="report-section">
            <div className="report-section-title">
              <div><h3>사기유형별 점수 변화</h3><p>평균 점수와 매칭 거래가 어느 방향으로 움직였는지 비교합니다.</p></div>
            </div>
            <div className="admin-table-wrap">
              <table className="impact-table">
                <thead><tr><th>사기유형</th><th>ACTIVE 평균</th><th>DRAFT 평균</th><th>점수 차이</th><th>매칭 거래 차이</th><th>최대 변화</th></tr></thead>
                <tbody>{replay.type_summaries.map((item) => (
                  <tr key={item.type_code}>
                    <td><strong>{item.display_name}</strong><small>{item.type_code}</small></td>
                    <td>{formatScore(item.active_average_score)}</td>
                    <td>{formatScore(item.draft_average_score)}</td>
                    <td><em className={deltaTone(item.average_score_delta)}>{item.average_score_delta === null ? "—" : formatSigned(item.average_score_delta, 3)}</em></td>
                    <td><em className={deltaTone(item.matched_transaction_count_delta)}>{formatSigned(item.matched_transaction_count_delta)}건</em></td>
                    <td>{formatScore(item.max_absolute_score_delta)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>

          <section className="report-section">
            <div className="report-section-title">
              <div><h3>영향받은 구성요소</h3><p>정의가 바뀌었거나 매칭 건수에 변화가 있는 항목만 표시합니다.</p></div>
              <em>{changedComponents.length}개</em>
            </div>
            {changedComponents.length === 0 ? (
              <p className="report-empty-row">변화가 감지된 구성요소가 없습니다.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="impact-table">
                  <thead><tr><th>구성요소</th><th>유형</th><th>가중치</th><th>매칭 차이</th><th>신규 매칭</th><th>매칭 제외</th></tr></thead>
                  <tbody>{changedComponents.map((item) => (
                    <tr key={`${item.type_code}:${item.component_key}`}>
                      <td><strong>{item.display_name}</strong><small>{item.component_key}</small></td>
                      <td>{item.type_code}</td>
                      <td>{formatScore(item.active_weight)} → {formatScore(item.draft_weight)}</td>
                      <td><em className={deltaTone(item.matched_transaction_count_delta)}>{formatSigned(item.matched_transaction_count_delta)}건</em></td>
                      <td>{item.newly_matched_transaction_count}건</td>
                      <td>{item.no_longer_matched_transaction_count}건</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>

          <section className="report-section">
            <div className="report-section-title">
              <div><h3>변경 거래 상세</h3><p>점수 또는 매칭 근거가 달라진 최근 거래입니다.</p></div>
              <em>최대 {replay.detail_limit}건</em>
            </div>
            {replay.changed_transaction_details.length === 0 ? (
              <p className="report-empty-row">변경된 거래가 없습니다.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="impact-table transaction-impact-table">
                  <thead><tr><th>거래 ID</th><th>거래 시각</th><th>변경 유형</th><th>최대 점수 변화</th><th>유형별 점수 차이</th></tr></thead>
                  <tbody>{replay.changed_transaction_details.map((item) => (
                    <tr key={item.transaction_id}>
                      <td>#{item.transaction_id}</td>
                      <td>{formatDateTime(item.transaction_datetime)}</td>
                      <td>{item.score_changed && item.evidence_changed ? "점수·근거" : item.score_changed ? "점수" : "근거"}</td>
                      <td>{item.max_absolute_score_delta.toFixed(3)}</td>
                      <td className="transaction-delta">{transactionDeltaSummary(item.score_deltas)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {(replay.has_more || replay.changed_details_truncated) && <p className="report-footnote">표본 또는 상세 표시 한도를 초과한 거래가 있습니다. 더 큰 표본으로 다시 실행할 수 있습니다.</p>}
          </section>

          {replay.error_details.length > 0 && (
            <section className="report-section error-report">
              <div className="report-section-title">
                <div><h3>평가 오류</h3><p>Replay 중 계산하지 못한 거래입니다.</p></div>
                <em>{replay.error_count}건</em>
              </div>
              <ul>{replay.error_details.map((item) => <li key={item.transaction_id}><strong>#{item.transaction_id}</strong><span>{item.error}</span></li>)}</ul>
            </section>
          )}
        </div>
      )}
    </article>
  );
}
