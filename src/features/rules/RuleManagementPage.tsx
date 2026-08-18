import { useCallback, useEffect, useState } from "react";

import { AppLayout } from "../../components/layout/AppLayout";
import {
  activateRuleSet,
  createRuleDraft,
  fetchRuleFeatures,
  fetchRuleSet,
  fetchRuleSets,
  replayRuleSet,
  saveRule,
  testRuleSet,
  validateRuleSet,
} from "./ruleApi";
import type {
  FraudRule,
  RuleExpression,
  RuleFeature,
  RuleReplay,
  RuleSet,
  RuleSetSummary,
  RuleTestResult,
  RuleValidation,
} from "./ruleTypes";
import "../admin/AdminWorkspace.css";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value));
}

function formatExpression(expression: RuleExpression): string {
  if (expression.conditions?.length) {
    return expression.conditions.map(formatExpression).join(` ${expression.operator} `);
  }
  const value = Array.isArray(expression.value)
    ? expression.value.join(", ")
    : String(expression.value ?? "");
  return `${expression.field ?? "field"} ${expression.operator} ${value}`;
}

export function RuleManagementPage() {
  const [summaries, setSummaries] = useState<RuleSetSummary[]>([]);
  const [selectedSet, setSelectedSet] = useState<RuleSet | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);
  const [editingRule, setEditingRule] = useState<FraudRule | null>(null);
  const [features, setFeatures] = useState<RuleFeature[]>([]);
  const [validation, setValidation] = useState<RuleValidation | null>(null);
  const [replay, setReplay] = useState<RuleReplay | null>(null);
  const [testResult, setTestResult] = useState<RuleTestResult | null>(null);
  const [testJson, setTestJson] = useState("{}");
  const [dialog, setDialog] = useState<"features" | "rule" | "test" | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRuleSet = useCallback(async (id: number) => {
    const detail = await fetchRuleSet(id);
    setSelectedSet(detail);
    setSelectedRuleId((current) =>
      current && detail.rules.some((rule) => rule.id === current)
        ? current
        : (detail.rules[0]?.id ?? null),
    );
    setValidation(null);
    setReplay(null);
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [sets, ruleFeatures] = await Promise.all([
        fetchRuleSets(),
        fetchRuleFeatures(),
      ]);
      setSummaries(sets);
      setFeatures(ruleFeatures);
      const preferred = sets.find((set) => set.status === "DRAFT")
        ?? sets.find((set) => set.status === "ACTIVE")
        ?? sets[0];
      if (preferred) await loadRuleSet(preferred.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "룰셋을 불러오지 못했습니다.");
    }
  }, [loadRuleSet]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!dialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dialog]);

  useEffect(() => {
    const rule = selectedSet?.rules.find((item) => item.id === selectedRuleId) ?? null;
    setEditingRule(rule ? structuredClone(rule) : null);
  }, [selectedRuleId, selectedSet]);

  const activeSet = summaries.find((set) => set.status === "ACTIVE");
  const draftSet = summaries.find((set) => set.status === "DRAFT");
  const componentTotal = editingRule?.components.reduce((sum, item) => sum + item.weight, 0) ?? 0;
  const enabledRules = selectedSet?.rules.filter((rule) => rule.enabled).length ?? 0;

  const runAction = async (action: () => Promise<void>) => {
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다."); }
    finally { setIsBusy(false); }
  };

  const updateWeight = (componentId: number, weight: number) => {
    setEditingRule((current) => current ? {
      ...current,
      components: current.components.map((component) =>
        component.id === componentId ? { ...component, weight } : component,
      ),
    } : current);
  };

  const saveCurrentRule = () => runAction(async () => {
    if (!selectedSet || !editingRule) return;
    const saved = await saveRule(selectedSet.id, editingRule);
    setEditingRule(saved);
    await loadRuleSet(selectedSet.id);
    setNotice("가중치 변경을 DRAFT에 저장했습니다.");
  });

  const runTest = () => runAction(async () => {
    if (!selectedSet) return;
    const result = await testRuleSet(selectedSet.id, JSON.parse(testJson));
    setTestResult(result);
    setDialog(null);
    setNotice("입력 데이터 1건으로 룰 점수를 계산했습니다.");
  });

  return (
    <AppLayout activeNav="rules">
      <section className="admin-page">
        <header className="admin-header">
          <div><p className="admin-eyebrow">RULE GOVERNANCE</p><h1>룰 규칙 관리</h1><p>사기유형별 조건과 가중치를 수정하고 운영 반영 전 영향을 비교합니다.</p></div>
          <div className="admin-actions">
            <button className="admin-button" onClick={() => setDialog("features")} type="button">Feature 목록</button>
            <button
              className="admin-button primary"
              disabled={Boolean(draftSet) || isBusy}
              onClick={() => runAction(async () => {
                const created = await createRuleDraft(activeSet?.id);
                await refresh();
                await loadRuleSet(created.id);
                setNotice(`DRAFT v${created.version}을 만들었습니다.`);
              })}
              type="button"
            >새 DRAFT 만들기</button>
          </div>
        </header>

        {error && <div className="admin-alert error" role="alert">{error}</div>}
        {notice && <div className="admin-alert success" role="status">{notice}</div>}

            <section className="admin-metrics">
              <article><span>운영 룰셋</span><strong className="positive">{activeSet ? `ACTIVE v${activeSet.version}` : "없음"}</strong><small>{formatDate(activeSet?.activated_at ?? null)} 활성화</small></article>
              <article><span>관리 사기유형</span><strong>{enabledRules}종</strong><small>선택 룰셋의 활성 유형</small></article>
              <article><span>DRAFT 상태</span><strong className="accent">{draftSet ? `v${draftSet.version} 편집 중` : "대기 중"}</strong><small>{draftSet ? "운영 반영 전 검토" : "새 DRAFT 생성 가능"}</small></article>
              <article><span>최근 Replay</span><strong>{replay ? `${replay.changed_transaction_count}건 변경` : "미실행"}</strong><small>{replay ? `평가 ${replay.evaluated_count}건 · 오류 ${replay.error_count}건` : "DRAFT에서 실행"}</small></article>
            </section>

            <section className="rule-workspace">
              <aside className="admin-panel version-panel">
                <div className="panel-title"><p className="admin-eyebrow">VERSIONS</p><h2>룰셋 버전</h2></div>
                <div className="version-list">
                  {summaries.map((set) => (
                    <button className={selectedSet?.id === set.id ? "selected" : ""} key={set.id} onClick={() => void loadRuleSet(set.id)} type="button">
                      <span><strong>v{set.version}</strong><em className={`status ${set.status.toLowerCase()}`}>{set.status}</em></span>
                      <small>{set.status === "ACTIVE" ? "현재 운영 중" : formatDate(set.updated_at)}</small>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="admin-panel rule-editor">
                <div className="panel-title split">
                  <div><p className="admin-eyebrow">{selectedSet?.status ?? "RULE SET"} v{selectedSet?.version ?? "—"}</p><h2>사기유형별 가중치 편집</h2><small>구성요소 가중치 합계는 유형별 1.000이어야 합니다.</small></div>
                  <button className="admin-button compact" disabled={!editingRule} onClick={() => setDialog("rule")} type="button">유형 설정</button>
                </div>
                <div className="rule-tabs" role="tablist">
                  {selectedSet?.rules.map((rule) => (
                    <button aria-selected={selectedRuleId === rule.id} className={selectedRuleId === rule.id ? "active" : ""} key={rule.id} onClick={() => setSelectedRuleId(rule.id)} role="tab" type="button">{rule.display_name}</button>
                  ))}
                </div>
                <div className="component-list">
                  {editingRule?.components.map((component) => (
                    <article className="component-row" key={component.id}>
                      <div><strong>{component.name}</strong><code>{formatExpression(component.condition_expression)}</code></div>
                      <label><span>가중치</span><input disabled={selectedSet?.status !== "DRAFT"} max="1" min="0.001" onChange={(event) => updateWeight(component.id, Number(event.target.value))} step="0.01" type="number" value={component.weight} /></label>
                      <div className="weight-track"><i style={{ width: `${Math.min(component.weight * 100, 100)}%` }} /></div>
                    </article>
                  ))}
                </div>
                <footer className="rule-total"><span>{editingRule?.display_name ?? "선택된 유형 없음"} 구성요소 합계</span><strong className={Math.abs(componentTotal - 1) < 0.0001 ? "positive" : "danger"}>{componentTotal.toFixed(3)} · {Math.abs(componentTotal - 1) < 0.0001 ? "정상" : "확인 필요"}</strong></footer>
                <button className="admin-button primary editor-save" disabled={selectedSet?.status !== "DRAFT" || isBusy || !editingRule} onClick={saveCurrentRule} type="button">DRAFT 변경 저장</button>
              </section>

              <aside className="admin-panel verify-panel">
                <div className="panel-title"><p className="admin-eyebrow">VERIFY & COMPARE</p><h2>운영 반영 전 확인</h2></div>
                <ol className="verify-steps">
                  <li><span>1. 규칙 검증</span><em className={validation?.valid ? "positive" : ""}>{validation ? (validation.valid ? "통과" : `${validation.issues.length}건`) : "대기"}</em></li>
                  <li><span>2. 단건 테스트</span><em>{testResult ? "완료" : "입력 필요"}</em></li>
                  <li><span>3. Replay 비교</span><em className={replay ? "accent" : ""}>{replay ? "완료" : "대기"}</em></li>
                </ol>
                {replay && <div className="replay-result"><strong>Replay 결과 · 표본 {replay.selected_count}건</strong><dl><div><dt>점수 변경 거래</dt><dd>{replay.score_changed_transaction_count}건</dd></div><div><dt>평균 최대 변화</dt><dd>{Math.max(0, ...replay.type_summaries.map((item) => Math.abs(item.average_score_delta ?? 0))).toFixed(3)}</dd></div><div><dt>근거 변경</dt><dd>{replay.evidence_changed_transaction_count}건</dd></div><div><dt>평가 오류</dt><dd>{replay.error_count}건</dd></div></dl></div>}
                {testResult && <div className="test-result"><strong>단건 점수</strong>{testResult.type_scores.map((item) => <span key={item.type_code}>{item.display_name}<b>{item.score.toFixed(2)}</b></span>)}</div>}
                <div className="verify-actions">
                  <button className="admin-button" disabled={!selectedSet || isBusy} onClick={() => runAction(async () => { if (selectedSet) setValidation(await validateRuleSet(selectedSet.id)); })} type="button">검증 실행</button>
                  <button className="admin-button" disabled={!selectedSet || isBusy} onClick={() => setDialog("test")} type="button">단건 테스트</button>
                  <button className="admin-button" disabled={selectedSet?.status !== "DRAFT" || isBusy} onClick={() => runAction(async () => { if (selectedSet) setReplay(await replayRuleSet(selectedSet.id)); })} type="button">Replay 비교</button>
                  <button className="admin-button primary" disabled={selectedSet?.status !== "DRAFT" || !validation?.valid || isBusy} onClick={() => { if (selectedSet && window.confirm(`DRAFT v${selectedSet.version}을 운영 룰셋으로 활성화할까요?`)) void runAction(async () => { await activateRuleSet(selectedSet.id); await refresh(); setNotice("DRAFT를 ACTIVE 룰셋으로 반영했습니다."); }); }} type="button">DRAFT 활성화</button>
                </div>
              </aside>
            </section>
        {dialog === "features" && <div className="admin-dialog-backdrop" role="presentation" onMouseDown={() => setDialog(null)}><section aria-modal="true" className="admin-dialog feature-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header><div><p className="admin-eyebrow">RULE FEATURES</p><h2>사용 가능한 Feature</h2></div><button onClick={() => setDialog(null)} type="button">닫기</button></header><div className="feature-list">{features.map((feature) => <article key={feature.field}><strong>{feature.display_name}</strong><code>{feature.field}</code><span>{feature.value_type} · {feature.derived ? "파생값" : "원본값"}</span></article>)}</div></section></div>}
        {dialog === "rule" && editingRule && <div className="admin-dialog-backdrop" role="presentation" onMouseDown={() => setDialog(null)}><section aria-modal="true" className="admin-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header><div><p className="admin-eyebrow">FRAUD TYPE</p><h2>사기유형 정보</h2></div><button onClick={() => setDialog(null)} type="button">닫기</button></header><label><span>유형 코드</span><input disabled value={editingRule.type_code} /></label><label><span>표시 이름</span><input disabled={selectedSet?.status !== "DRAFT"} onChange={(event) => setEditingRule({ ...editingRule, display_name: event.target.value })} value={editingRule.display_name} /></label><label><span>설명</span><textarea className="short-textarea" disabled={selectedSet?.status !== "DRAFT"} onChange={(event) => setEditingRule({ ...editingRule, description: event.target.value })} value={editingRule.description ?? ""} /></label><label className="checkbox-field"><input checked={editingRule.enabled} disabled={selectedSet?.status !== "DRAFT"} onChange={(event) => setEditingRule({ ...editingRule, enabled: event.target.checked })} type="checkbox" /><span>실시간 점수 계산에 이 유형 포함</span></label><button className="admin-button primary" disabled={selectedSet?.status !== "DRAFT" || isBusy} onClick={() => { setDialog(null); void saveCurrentRule(); }} type="button">유형 정보 저장</button></section></div>}
        {dialog === "test" && <div className="admin-dialog-backdrop" role="presentation" onMouseDown={() => setDialog(null)}><section aria-modal="true" className="admin-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header><div><p className="admin-eyebrow">ONE TRANSACTION</p><h2>단건 룰 테스트</h2></div><button onClick={() => setDialog(null)} type="button">닫기</button></header><label className="json-field"><span>raw51 Feature JSON</span><textarea onChange={(event) => setTestJson(event.target.value)} spellCheck={false} value={testJson} /></label><button className="admin-button primary" disabled={isBusy} onClick={() => void runTest()} type="button">점수 계산</button></section></div>}
      </section>
    </AppLayout>
  );
}
