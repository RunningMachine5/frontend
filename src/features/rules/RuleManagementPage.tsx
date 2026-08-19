import { useCallback, useEffect, useState } from "react";

import { AppLayout } from "../../components/layout/AppLayout";
import {
  activateRuleSet,
  createRuleDraft,
  deleteRuleDraft,
  fetchRuleFeatures,
  fetchRuleSet,
  fetchRuleSets,
  replayRuleSet,
  saveRule,
  validateRuleSet,
} from "./ruleApi";
import type {
  FraudRule,
  RuleExpression,
  RuleFeature,
  RuleReplay,
  RuleSet,
  RuleSetSummary,
  RuleValidation,
} from "./ruleTypes";
import { RuleReplayReport } from "./RuleReplayReport";
import "../admin/AdminWorkspace.css";

type WorkspaceTab = "edit" | "verify";

const REPLAY_SAMPLE_OPTIONS = [100, 300, 500, 1000];

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

function formatPercent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

export function RuleManagementPage() {
  const [summaries, setSummaries] = useState<RuleSetSummary[]>([]);
  const [selectedSet, setSelectedSet] = useState<RuleSet | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);
  const [editingRule, setEditingRule] = useState<FraudRule | null>(null);
  const [features, setFeatures] = useState<RuleFeature[]>([]);
  const [validation, setValidation] = useState<RuleValidation | null>(null);
  const [replay, setReplay] = useState<RuleReplay | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("edit");
  const [replaySampleSize, setReplaySampleSize] = useState(100);
  const [dialog, setDialog] = useState<"features" | "rule" | null>(null);
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
      else setSelectedSet(null);
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

  const openWorkspaceTab = (tab: WorkspaceTab) => {
    setWorkspaceTab(tab);
    if (tab === "verify" && draftSet && selectedSet?.id !== draftSet.id) {
      void loadRuleSet(draftSet.id);
    }
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
    setNotice("가중치와 유형 정보를 DRAFT에 저장했습니다. 운영 반영 전 다시 검증하세요.");
  });

  const discardDraft = () => {
    if (!draftSet || isBusy) return;
    if (!window.confirm(`DRAFT v${draftSet.version}과 저장한 변경을 모두 폐기할까요?`)) return;
    void runAction(async () => {
      await deleteRuleDraft(draftSet.id);
      setWorkspaceTab("edit");
      await refresh();
      setNotice(`DRAFT v${draftSet.version}을 폐기했습니다.`);
    });
  };

  const canEdit = selectedSet?.status === "DRAFT";
  const canVerify = selectedSet?.status === "DRAFT" && Boolean(activeSet);
  const activationGuide = !draftSet
    ? "새 DRAFT를 만든 뒤 검증할 수 있습니다."
    : !validation
      ? "규칙 검증을 먼저 실행하세요."
      : !validation.valid
        ? "검증 오류를 수정하고 다시 검증하세요."
        : !replay
          ? "Replay 비교를 실행해 운영 영향을 확인하세요."
          : "검증과 Replay를 완료했습니다. 운영 반영 여부를 결정하세요.";

  return (
    <AppLayout activeNav="rules">
      <section className="admin-page rule-admin-page">
        <header className="admin-header">
          <div>
            <p className="admin-eyebrow">RULE GOVERNANCE</p>
            <h1>룰 규칙 관리</h1>
            <p>사기유형별 조건과 가중치를 수정하고 운영 반영 전 영향을 비교합니다.</p>
          </div>
          <div className="admin-actions rule-header-actions">
            <button className="admin-button" onClick={() => setDialog("features")} type="button">Feature 목록</button>
            <div>
              <button
                className="admin-button primary"
                disabled={Boolean(draftSet) || isBusy}
                onClick={() => void runAction(async () => {
                  const created = await createRuleDraft(activeSet?.id);
                  await refresh();
                  await loadRuleSet(created.id);
                  setWorkspaceTab("edit");
                  setNotice(`DRAFT v${created.version}을 만들었습니다.`);
                })}
                type="button"
              >새 DRAFT 만들기</button>
              {draftSet && <small>DRAFT v{draftSet.version} 편집을 완료하거나 폐기해야 새로 만들 수 있습니다.</small>}
            </div>
          </div>
        </header>

        {error && <div className="admin-alert error" role="alert">{error}</div>}
        {notice && <div className="admin-alert success" role="status">{notice}</div>}

        <section className="admin-metrics">
          <article><span>운영 룰셋</span><strong className="positive">{activeSet ? `ACTIVE v${activeSet.version}` : "없음"}</strong><small>{formatDate(activeSet?.activated_at ?? null)} 활성화</small></article>
          <article><span>관리 사기유형</span><strong>{enabledRules}종</strong><small>선택 룰셋의 활성 유형</small></article>
          <article><span>DRAFT 상태</span><strong className="accent">{draftSet ? `v${draftSet.version} 편집 중` : "대기 중"}</strong><small>{draftSet ? "운영 반영 전 검토" : "새 DRAFT 생성 가능"}</small></article>
          <article><span>최근 Replay</span><strong>{replay ? `${replay.changed_transaction_count}건 변경` : "미실행"}</strong><small>{replay ? `평가 ${replay.evaluated_count}건 · 변경률 ${formatPercent(replay.changed_transaction_rate)}` : "검증 및 영향 비교에서 실행"}</small></article>
        </section>

        <nav aria-label="룰 관리 작업" className="rule-workspace-switch" role="tablist">
          <button
            aria-controls="rule-edit-workspace"
            aria-selected={workspaceTab === "edit"}
            className={workspaceTab === "edit" ? "active" : ""}
            id="rule-edit-tab"
            onClick={() => openWorkspaceTab("edit")}
            role="tab"
            type="button"
          >
            <span><strong>룰 편집</strong><small>버전과 가중치 관리</small></span>
            <em>{draftSet ? `DRAFT v${draftSet.version}` : "준비"}</em>
          </button>
          <button
            aria-controls="rule-verify-workspace"
            aria-selected={workspaceTab === "verify"}
            className={workspaceTab === "verify" ? "active" : ""}
            id="rule-verify-tab"
            onClick={() => openWorkspaceTab("verify")}
            role="tab"
            type="button"
          >
            <span><strong>검증 및 영향 비교</strong><small>ACTIVE 대비 Replay</small></span>
            <em className={replay || validation?.valid ? "complete" : ""}>{replay ? "Replay 완료" : validation?.valid ? "검증 통과" : "대기"}</em>
          </button>
        </nav>

        {workspaceTab === "edit" && (
          <section aria-labelledby="rule-edit-tab" className="rule-workspace rule-edit-workspace" id="rule-edit-workspace" role="tabpanel">
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
              {draftSet && <div className="version-panel-actions"><button className="admin-button danger-button compact" disabled={isBusy} onClick={discardDraft} type="button">DRAFT v{draftSet.version} 폐기</button><small>폐기하면 저장한 변경을 복구할 수 없습니다.</small></div>}
            </aside>

            <section className="admin-panel rule-editor">
              <div className="panel-title split">
                <div><p className="admin-eyebrow">{selectedSet?.status ?? "RULE SET"} v{selectedSet?.version ?? "—"}</p><h2>사기유형별 가중치 편집</h2><small>구성요소 가중치 합계는 유형별 1.000이어야 합니다.</small></div>
                <button className="admin-button compact" disabled={!editingRule} onClick={() => setDialog("rule")} type="button">유형 설정</button>
              </div>
              <div aria-label="사기유형 선택" className="rule-tabs" role="tablist">
                {selectedSet?.rules.map((rule) => <button aria-selected={selectedRuleId === rule.id} className={selectedRuleId === rule.id ? "active" : ""} key={rule.id} onClick={() => setSelectedRuleId(rule.id)} role="tab" type="button">{rule.display_name}</button>)}
              </div>
              <div className="component-list">
                {editingRule?.components.map((component) => <article className="component-row" key={component.id}><div><strong>{component.name}</strong><code>{formatExpression(component.condition_expression)}</code></div><label><span>가중치</span><input disabled={!canEdit} max="1" min="0.001" onChange={(event) => updateWeight(component.id, Number(event.target.value))} step="0.01" type="number" value={component.weight} /></label><div className="weight-track"><i style={{ width: `${Math.min(component.weight * 100, 100)}%` }} /></div></article>)}
              </div>
              <footer className="rule-total"><span>{editingRule?.display_name ?? "선택된 유형 없음"} 구성요소 합계</span><strong className={Math.abs(componentTotal - 1) < 0.0001 ? "positive" : "danger"}>{componentTotal.toFixed(3)} · {Math.abs(componentTotal - 1) < 0.0001 ? "정상" : "확인 필요"}</strong></footer>
              <div className="editor-actions"><small>{canEdit ? "저장하면 기존 검증과 Replay 결과가 초기화됩니다." : `${selectedSet?.status ?? "선택한"} 버전은 조회만 가능합니다.`}</small><button className="admin-button primary" disabled={!canEdit || isBusy || !editingRule} onClick={saveCurrentRule} type="button">DRAFT 변경 저장</button></div>
            </section>
          </section>
        )}

        {workspaceTab === "verify" && (
          <section aria-busy={isBusy} aria-labelledby="rule-verify-tab" className="rule-verify-workspace" id="rule-verify-workspace" role="tabpanel">
            <article className="admin-panel verify-control-panel">
              <div className="panel-title"><p className="admin-eyebrow">VERIFY FLOW</p><h2>운영 반영 전 확인</h2><small>현재 운영 룰과 DRAFT를 같은 거래 표본으로 비교합니다.</small></div>
              <div className="rule-version-compare" aria-label="비교할 룰셋 버전"><div><span>현재 운영</span><strong>{activeSet ? `ACTIVE v${activeSet.version}` : "운영 룰 없음"}</strong><small>{formatDate(activeSet?.updated_at ?? null)}</small></div><i aria-hidden="true">→</i><div><span>검토 대상</span><strong>{draftSet ? `DRAFT v${draftSet.version}` : "DRAFT 없음"}</strong><small>{formatDate(draftSet?.updated_at ?? null)}</small></div></div>

              <ol className="verification-flow">
                <li className={validation?.valid ? "complete" : validation ? "error" : "active"}><span>01</span><div><strong>규칙 검증</strong><small>{validation ? (validation.valid ? "모든 조건 통과" : `${validation.issues.length}건 수정 필요`) : "구조와 가중치 확인"}</small></div></li>
                <li className={replay ? "complete" : validation?.valid ? "active" : ""}><span>02</span><div><strong>Replay 비교</strong><small>{replay ? `${replay.evaluated_count}건 평가 완료` : "운영 영향 확인"}</small></div></li>
                <li className={validation?.valid && replay ? "active" : ""}><span>03</span><div><strong>운영 활성화</strong><small>ACTIVE 버전 교체</small></div></li>
              </ol>

              {validation && !validation.valid && <section className="validation-report" aria-label="검증 오류"><strong>수정이 필요한 항목</strong><ul>{validation.issues.map((issue) => <li key={`${issue.path}:${issue.message}`}><code>{issue.path}</code><span>{issue.message}</span></li>)}</ul></section>}

              <div className="replay-config"><label htmlFor="replay-sample-size"><span>Replay 표본</span><select id="replay-sample-size" onChange={(event) => setReplaySampleSize(Number(event.target.value))} value={replaySampleSize}>{REPLAY_SAMPLE_OPTIONS.map((size) => <option key={size} value={size}>최신 ML 양성 {size.toLocaleString("ko-KR")}건</option>)}</select></label><p>거래와 기존 결과는 수정하지 않으며, ACTIVE와 DRAFT의 점수·근거 차이만 계산합니다.</p></div>

              <div className="verify-actions">
                <button className="admin-button" disabled={!canVerify || isBusy} onClick={() => void runAction(async () => { if (selectedSet) setValidation(await validateRuleSet(selectedSet.id)); })} type="button">1. 검증 실행</button>
                <button className="admin-button" disabled={!canVerify || !validation?.valid || isBusy} onClick={() => void runAction(async () => { if (selectedSet) setReplay(await replayRuleSet(selectedSet.id, replaySampleSize, 20)); })} type="button">2. Replay 비교</button>
                <button className="admin-button primary" disabled={!canVerify || !validation?.valid || !replay || isBusy} onClick={() => { if (selectedSet && window.confirm(`DRAFT v${selectedSet.version}을 운영 룰셋으로 활성화할까요?`)) void runAction(async () => { await activateRuleSet(selectedSet.id); await refresh(); setWorkspaceTab("edit"); setNotice("DRAFT를 ACTIVE 룰셋으로 반영했습니다."); }); }} type="button">3. DRAFT 활성화</button>
              </div>
              <p className="action-guide"><strong>현재 상태</strong>{activationGuide}</p>
            </article>

            <RuleReplayReport replay={replay} />
          </section>
        )}

        {dialog === "features" && <div className="admin-dialog-backdrop" role="presentation" onMouseDown={() => setDialog(null)}><section aria-modal="true" className="admin-dialog feature-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header><div><p className="admin-eyebrow">RULE FEATURES</p><h2>사용 가능한 Feature</h2></div><button onClick={() => setDialog(null)} type="button">닫기</button></header><div className="feature-list">{features.map((feature) => <article key={feature.field}><strong>{feature.display_name}</strong><code>{feature.field}</code><span>{feature.value_type} · {feature.derived ? "파생값" : "원본값"} · {feature.operators.length ? feature.operators.join(", ") : "조건식 직접 사용 불가"}</span></article>)}</div></section></div>}
        {dialog === "rule" && editingRule && <div className="admin-dialog-backdrop" role="presentation" onMouseDown={() => setDialog(null)}><section aria-modal="true" className="admin-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header><div><p className="admin-eyebrow">FRAUD TYPE</p><h2>사기유형 정보</h2></div><button onClick={() => setDialog(null)} type="button">닫기</button></header><label><span>유형 코드</span><input disabled value={editingRule.type_code} /></label><label><span>표시 이름</span><input disabled={!canEdit} onChange={(event) => setEditingRule({ ...editingRule, display_name: event.target.value })} value={editingRule.display_name} /></label><label><span>설명</span><textarea className="short-textarea" disabled={!canEdit} onChange={(event) => setEditingRule({ ...editingRule, description: event.target.value })} value={editingRule.description ?? ""} /></label><label className="checkbox-field"><input checked={editingRule.enabled} disabled={!canEdit} onChange={(event) => setEditingRule({ ...editingRule, enabled: event.target.checked })} type="checkbox" /><span>실시간 점수 계산에 이 유형 포함</span></label><button className="admin-button primary" disabled={!canEdit || isBusy} onClick={() => { setDialog(null); void saveCurrentRule(); }} type="button">유형 정보 저장</button></section></div>}
      </section>
    </AppLayout>
  );
}
