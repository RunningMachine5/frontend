import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeading } from "../../components/layout/PageHeading";
import {
  activateRuleSet,
  createRuleDraft,
  createRuleType,
  deleteRuleDraft,
  deleteRuleType,
  fetchRuleFeatures,
  fetchRulePatternStatistics,
  fetchRuleSet,
  fetchRuleSets,
  replayRuleSet,
  saveRuleComponents,
  validateRuleSet,
} from "./ruleApi";
import type {
  FraudRule,
  FraudRuleTypeInput,
  RuleComponentInput,
  RuleExpression,
  RuleFeature,
  RulePatternStatistics,
  RuleReplay,
  RuleSet,
  RuleSetSummary,
  RuleValidation,
} from "./ruleTypes";
import { CreateFraudTypeDialog } from "./CreateFraudTypeDialog";
import { RulePatternDialog } from "./RulePatternDialog";
import { RuleReplayReport, RuleReplaySummary } from "./RuleReplayReport";
import "../admin/AdminWorkspace.css";
import "./RuleManagementPage.css";

type WorkspaceTab = "edit" | "verify";

const REPLAY_SAMPLE_OPTIONS = [100, 300, 500, 1000];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value));
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

const numberFormat = new Intl.NumberFormat("ko-KR");

function formatRuleValue(value: RuleExpression["value"]): string {
  if (Array.isArray(value)) return value.map(formatRuleValue).join(", ");
  if (typeof value === "boolean") return value ? "예" : "아니오";
  if (typeof value === "number") return numberFormat.format(value);
  return String(value ?? "값 없음");
}

function isBinaryFeature(feature: RuleFeature | undefined) {
  if (feature?.value_type === "boolean") return true;
  return feature?.allowed_values?.length === 2
    && feature.allowed_values.includes(0)
    && feature.allowed_values.includes(1);
}

function formatExpression(
  expression: RuleExpression,
  featureByField: Map<string, RuleFeature>,
): string {
  if (expression.conditions?.length) {
    const conditions = expression.conditions.map((condition) =>
      formatExpression(condition, featureByField));
    const guide = expression.operator === "OR" ? "하나 이상 충족" : "모두 충족";
    return `${conditions.join(" · ")} (${guide})`;
  }

  const feature = expression.field ? featureByField.get(expression.field) : undefined;
  const fieldName = feature?.display_name ?? expression.field ?? "조건";
  const value = expression.value;

  if (
    isBinaryFeature(feature)
    && ["EQ", "NE"].includes(expression.operator)
    && (typeof value === "boolean" || value === 0 || value === 1)
  ) {
    const positiveValue = value === true || value === 1;
    const isMatched = expression.operator === "EQ" ? positiveValue : !positiveValue;
    const label = feature?.value_type === "boolean"
      ? isMatched ? "감지" : "미감지"
      : isMatched ? "예" : "아니오";
    return `${fieldName}: ${label}`;
  }

  const displayValue = formatRuleValue(value);
  const operatorLabel: Record<string, string> = {
    EQ: "같음",
    NE: "제외",
    GT: "초과",
    GTE: "이상",
    LT: "미만",
    LTE: "이하",
    IN: "중 하나",
  };

  if (expression.operator === "BETWEEN" && Array.isArray(value)) {
    return `${fieldName}: ${value.map(formatRuleValue).join("~")}`;
  }
  return `${fieldName}: ${displayValue} ${operatorLabel[expression.operator] ?? expression.operator}`;
}

export function RuleManagementPage() {
  const [summaries, setSummaries] = useState<RuleSetSummary[]>([]);
  const [draftSourceId, setDraftSourceId] = useState<number | null>(null);
  const [selectedSet, setSelectedSet] = useState<RuleSet | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);
  const [editingRule, setEditingRule] = useState<FraudRule | null>(null);
  const [features, setFeatures] = useState<RuleFeature[]>([]);
  const [patternStatistics, setPatternStatistics] = useState<RulePatternStatistics | null>(null);
  const [validation, setValidation] = useState<RuleValidation | null>(null);
  const [replay, setReplay] = useState<RuleReplay | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("edit");
  const [replaySampleSize, setReplaySampleSize] = useState(100);
  const [dialog, setDialog] = useState<"features" | "pattern" | "fraudType" | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const temporaryComponentId = useRef(-1);

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
    setPatternStatistics(null);
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
      setDraftSourceId((current) => {
        const availableSources = sets.filter((set) => set.status !== "DRAFT");
        if (current && availableSources.some((set) => set.id === current)) return current;
        return availableSources.find((set) => set.version === 1)?.id
          ?? availableSources.find((set) => set.status === "ACTIVE")?.id
          ?? availableSources[0]?.id
          ?? null;
      });
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
    setPatternStatistics(null);
  }, [selectedRuleId, selectedSet]);

  const activeSet = summaries.find((set) => set.status === "ACTIVE");
  const draftSet = summaries.find((set) => set.status === "DRAFT");
  const copySources = summaries.filter((set) => set.status !== "DRAFT");
  const selectedSource = copySources.find((set) => set.id === draftSourceId);
  const featureByField = useMemo(
    () => new Map(features.map((feature) => [feature.field, feature])),
    [features],
  );
  const componentTotal = editingRule?.components.reduce((sum, item) => sum + item.weight, 0) ?? 0;
  const patternStatisticsByKey = useMemo(
    () => new Map(
      patternStatistics?.patterns.map((item) => [item.component_key, item]) ?? [],
    ),
    [patternStatistics],
  );
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

  const addPattern = (component: RuleComponentInput) => {
    const id = temporaryComponentId.current;
    temporaryComponentId.current -= 1;
    const now = new Date().toISOString();
    setEditingRule((current) => current ? {
      ...current,
      components: [
        ...current.components,
        { ...component, id, created_at: now, updated_at: now },
      ],
    } : current);
    setPatternStatistics(null);
    setDialog(null);
  };

  const removePattern = (componentId: number) => {
    setEditingRule((current) => current ? {
      ...current,
      components: current.components
        .filter((component) => component.id !== componentId)
        .map((component, index) => ({ ...component, sort_order: index })),
    } : current);
    setPatternStatistics(null);
  };

  const saveCurrentRule = () => runAction(async () => {
    if (!selectedSet || !editingRule) return;
    const saved = await saveRuleComponents(selectedSet.id, editingRule);
    setEditingRule(saved);
    await loadRuleSet(selectedSet.id);
    setNotice("패턴과 가중치를 DRAFT에 저장했습니다. 운영 반영 전 다시 검증하세요.");
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

  const addFraudType = (input: FraudRuleTypeInput) => {
    if (!selectedSet || selectedSet.status !== "DRAFT") return;
    void runAction(async () => {
      const created = await createRuleType(selectedSet.id, input);
      await loadRuleSet(selectedSet.id);
      setSelectedRuleId(created.id);
      setDialog(null);
      setNotice(`${created.display_name} 유형을 추가했습니다. 탐지 패턴을 구성해 주세요.`);
    });
  };

  const removeFraudType = () => {
    if (!selectedSet || !editingRule || selectedSet.status !== "DRAFT" || isBusy) return;
    const patternCount = editingRule.components.length;
    const message = [
      `${editingRule.display_name} 유형을 DRAFT에서 삭제할까요?`,
      patternCount > 0 ? `이 유형의 패턴 ${patternCount}개도 함께 삭제됩니다.` : "",
      "현재 운영 중인 룰셋에는 영향을 주지 않습니다.",
    ].filter(Boolean).join("\n");
    if (!window.confirm(message)) return;

    void runAction(async () => {
      const deletedName = editingRule.display_name;
      await deleteRuleType(selectedSet.id, editingRule.id);
      await loadRuleSet(selectedSet.id);
      setNotice(`${deletedName} 유형을 DRAFT에서 삭제했습니다.`);
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
        <header className="app-page-header admin-header">
          <PageHeading eyebrow="RULE MANAGEMENT" title="룰 관리" />
          <div className="admin-actions">
            <button className="admin-button" onClick={() => setDialog("features")} type="button">Feature 목록</button>
            <label className="draft-source-control">
              <span>복사 기준</span>
              <select
                aria-label="새 DRAFT 복사 기준"
                disabled={Boolean(draftSet) || isBusy || copySources.length === 0}
                onChange={(event) => setDraftSourceId(Number(event.target.value))}
                value={draftSourceId ?? ""}
              >
                {copySources.length === 0 && <option value="">서버 기본 설정</option>}
                {copySources.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.version === 1
                      ? "기본 설정 · v1"
                      : set.status === "ACTIVE"
                        ? `현재 운영 · v${set.version}`
                        : `이전 버전 · v${set.version}`}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="admin-button primary"
              disabled={Boolean(draftSet) || isBusy}
              onClick={() => void runAction(async () => {
                const created = await createRuleDraft(draftSourceId ?? undefined);
                await refresh();
                await loadRuleSet(created.id);
                setWorkspaceTab("edit");
                const sourceName = selectedSource?.version === 1
                  ? "기본 설정 v1"
                  : selectedSource
                    ? `v${selectedSource.version}`
                    : "서버 기본 설정";
                setNotice(`${sourceName}에서 DRAFT v${created.version}을 만들었습니다.`);
              })}
              type="button"
            >새 초안 만들기</button>
          </div>
        </header>

        {error && (
          <div className="admin-alert error dismissible">
            <span role="alert">{error}</span>
            <button
              aria-label="오류 알림 닫기"
              className="admin-alert-dismiss"
              onClick={() => setError(null)}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}
        {notice && (
          <div className="admin-alert success dismissible">
            <span role="status">{notice}</span>
            <button
              aria-label="성공 알림 닫기"
              className="admin-alert-dismiss"
              onClick={() => setNotice(null)}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}

        <nav aria-label="룰 관리 메뉴" className="rule-section-nav" role="tablist">
          <button
            aria-controls="rule-edit-workspace"
            aria-selected={workspaceTab === "edit"}
            className={workspaceTab === "edit" ? "active" : ""}
            id="rule-edit-tab"
            onClick={() => openWorkspaceTab("edit")}
            role="tab"
            type="button"
          >
            룰 편집
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
            검증 및 영향 비교
          </button>
        </nav>

        {workspaceTab === "edit" && (
          <section aria-labelledby="rule-edit-tab" className="rule-workspace rule-edit-workspace" id="rule-edit-workspace" role="tabpanel">
            <aside className="admin-panel version-panel">
              <div className="panel-title"><p className="admin-eyebrow">VERSIONS</p><h2>룰셋 버전</h2></div>
              <div className="version-list">
                {summaries.map((set) => (
                  <button className={selectedSet?.id === set.id ? "selected" : ""} key={set.id} onClick={() => void loadRuleSet(set.id)} type="button">
                    <span><strong>v{set.version}{set.version === 1 && <b className="default-version-badge">기본</b>}</strong><em className={`status ${set.status.toLowerCase()}`}>{set.status}</em></span>
                    <small>{set.version === 1 ? `서버 시작 기본값${set.status === "ACTIVE" ? " · 현재 운영 중" : ""}` : set.status === "ACTIVE" ? "현재 운영 중" : formatDate(set.updated_at)}</small>
                  </button>
                ))}
              </div>
              {draftSet && <div className="version-panel-actions"><button className="admin-button danger-button compact" disabled={isBusy} onClick={discardDraft} type="button">DRAFT v{draftSet.version} 폐기</button><small>폐기하면 저장한 변경을 복구할 수 없습니다.</small></div>}
            </aside>

            <section className="admin-panel rule-editor">
              <div className="panel-title split">
                <div><p className="admin-eyebrow">{selectedSet?.status ?? "RULE SET"} v{selectedSet?.version ?? "—"}</p><h2>사기유형별 패턴 편집</h2><small>DRAFT에서 사기유형과 패턴을 구성합니다. 활성 유형의 가중치 합계는 1.000이어야 합니다.</small></div>
                <div className="pattern-editor-actions">
                  <button
                    className="admin-button compact"
                    disabled={!editingRule?.components.length || isBusy}
                    onClick={() => void runAction(async () => {
                      if (editingRule) {
                        setPatternStatistics(
                          await fetchRulePatternStatistics(editingRule.components),
                        );
                      }
                    })}
                    type="button"
                  >
                    {patternStatistics ? "통계 다시 계산" : "표본 통계 계산"}
                  </button>
                  {canEdit && editingRule && (
                    <button
                      className="admin-button danger-button compact"
                      disabled={isBusy}
                      onClick={removeFraudType}
                      type="button"
                    >
                      유형 삭제
                    </button>
                  )}
                  <button
                    className="admin-button compact"
                    disabled={!canEdit || !editingRule || isBusy}
                    onClick={() => setDialog("pattern")}
                    type="button"
                  >
                    + 패턴 추가
                  </button>
                </div>
              </div>
              <div aria-label="사기유형 선택" className="rule-tabs" role="tablist">
                {selectedSet?.rules.map((rule) => (
                  <button aria-selected={selectedRuleId === rule.id} className={selectedRuleId === rule.id ? "active" : ""} key={rule.id} onClick={() => setSelectedRuleId(rule.id)} role="tab" type="button">
                    <span>{rule.display_name}</span>
                    {!rule.enabled && <em>준비 중</em>}
                  </button>
                ))}
                <button
                  aria-label="새 사기유형 추가"
                  className="rule-type-add-button"
                  disabled={!canEdit || isBusy}
                  onClick={() => {
                    setError(null);
                    setDialog("fraudType");
                  }}
                  role="button"
                  title={canEdit ? "DRAFT에 새 사기유형을 추가합니다." : "DRAFT에서만 유형을 추가할 수 있습니다."}
                  type="button"
                >
                  <span aria-hidden="true">＋</span> 사기유형
                </button>
              </div>
              <div className="component-list">
                {editingRule?.components.map((component) => {
                  const statistics = patternStatisticsByKey.get(component.component_key);
                  return (
                    <article className="component-row" key={component.id}>
                      <div className="component-description">
                        <strong>{component.name}</strong>
                        <span className="component-logic-label">적용 조건</span>
                        <p className="condition-summary">{formatExpression(component.condition_expression, featureByField)}</p>
                        {statistics ? (
                          <div className="component-statistics">
                            <span>
                              {patternStatistics?.has_more
                                ? `최신 ML 양성 ${patternStatistics.sample_count.toLocaleString("ko-KR")}건 기준`
                                : `ML 양성 ${patternStatistics?.sample_count.toLocaleString("ko-KR")}건 전체 기준`}
                            </span>
                            <strong>
                              조건 충족 {statistics.matched_count.toLocaleString("ko-KR")}건
                              <em>{formatPercent(statistics.matched_rate)}</em>
                            </strong>
                            <i><b style={{ width: `${(statistics.matched_rate ?? 0) * 100}%` }} /></i>
                          </div>
                        ) : (
                          <p className="component-statistics-empty">표본 통계를 계산하면 적용 범위를 표시합니다.</p>
                        )}
                      </div>
                      <div className="component-controls">
                        {canEdit && (
                          <button
                            className="component-remove-button"
                            disabled={editingRule.components.length === 1}
                            onClick={() => removePattern(component.id)}
                            title={editingRule.components.length === 1 ? "유형에는 패턴이 하나 이상 필요합니다." : "이 패턴을 목록에서 제거합니다."}
                            type="button"
                          >
                            삭제
                          </button>
                        )}
                        <label>
                          <span>가중치</span>
                          <input
                            disabled={!canEdit}
                            max="1"
                            min="0.001"
                            onChange={(event) => updateWeight(component.id, Number(event.target.value))}
                            step="0.01"
                            type="number"
                            value={component.weight}
                          />
                        </label>
                        <div className="weight-track"><i style={{ width: `${Math.min(component.weight * 100, 100)}%` }} /></div>
                      </div>
                    </article>
                  );
                })}
                {editingRule && editingRule.components.length === 0 && (
                  <div className="rule-type-empty">
                    <div>
                      <strong>아직 탐지 패턴이 없습니다.</strong>
                      <p>첫 패턴을 추가하면 이 유형의 조건과 가중치를 설정할 수 있습니다.</p>
                    </div>
                    {canEdit && (
                      <button className="admin-button compact" onClick={() => setDialog("pattern")} type="button">
                        + 첫 패턴 추가
                      </button>
                    )}
                  </div>
                )}
              </div>
              <footer className="rule-total"><span>{editingRule?.display_name ?? "선택된 유형 없음"} 구성요소 합계</span><strong className={Math.abs(componentTotal - 1) < 0.0001 ? "positive" : "danger"}>{componentTotal.toFixed(3)} · {Math.abs(componentTotal - 1) < 0.0001 ? "정상" : "확인 필요"}</strong></footer>
              <div className="editor-actions"><small>{canEdit ? editingRule?.enabled ? "패턴 추가·삭제는 저장 버튼을 누르면 DRAFT에 반영됩니다." : "새 유형은 Agent 대응 정책 연결 전까지 준비 중 상태로 유지됩니다." : `${selectedSet?.status ?? "선택한"} 버전은 조회만 가능합니다.`}</small><button className="admin-button primary" disabled={!canEdit || isBusy || !editingRule?.components.length} onClick={saveCurrentRule} type="button">DRAFT 패턴 저장</button></div>
            </section>
          </section>
        )}

        {workspaceTab === "verify" && (
          <section aria-busy={isBusy} aria-labelledby="rule-verify-tab" className="rule-verify-workspace" id="rule-verify-workspace" role="tabpanel">
            <article className="admin-panel verify-control-panel">
              <div className="panel-title"><p className="admin-eyebrow">VERIFY FLOW</p><h2>운영 반영 전 확인</h2><small>현재 운영 룰과 DRAFT를 같은 거래 표본으로 비교합니다.</small></div>
              <RuleReplaySummary replay={replay} />
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

        {dialog === "features" && <div className="admin-dialog-backdrop" role="presentation" onMouseDown={() => setDialog(null)}><section aria-modal="true" className="admin-dialog feature-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header><div><p className="admin-eyebrow">RULE FEATURES</p><h2>사용 가능한 Feature</h2></div><button onClick={() => setDialog(null)} type="button">닫기</button></header><div className="feature-list">{features.map((feature) => <article key={feature.field}><strong>{feature.display_name}</strong><code>{feature.field}</code><span>{feature.value_type}{feature.derived ? " · 파생값" : ""}</span></article>)}</div></section></div>}
        {dialog === "fraudType" && (
          <CreateFraudTypeDialog
            error={error}
            isBusy={isBusy}
            onClose={() => setDialog(null)}
            onCreate={addFraudType}
          />
        )}
        {dialog === "pattern" && editingRule && (
          <RulePatternDialog
            existingKeys={editingRule.components.map((component) => component.component_key)}
            features={features}
            nextSortOrder={editingRule.components.length}
            onAdd={addPattern}
            onClose={() => setDialog(null)}
          />
        )}
      </section>
    </AppLayout>
  );
}
