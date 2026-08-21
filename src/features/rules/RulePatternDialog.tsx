import { useState, type FormEvent } from "react";

import type {
  RuleComponentInput,
  RuleExpression,
  RuleFeature,
} from "./ruleTypes";

const OPERATOR_LABELS: Record<string, string> = {
  EQ: "같음",
  NE: "같지 않음",
  GT: "초과",
  GTE: "이상",
  LT: "미만",
  LTE: "이하",
  IN: "목록 중 하나",
  BETWEEN: "범위 안",
};

type RulePatternDialogProps = {
  existingKeys: string[];
  features: RuleFeature[];
  nextSortOrder: number;
  onAdd: (component: RuleComponentInput) => void;
  onClose: () => void;
};

function defaultValueText(feature: RuleFeature | undefined) {
  if (!feature) return "";
  const value = feature.allowed_values?.[0]
    ?? (feature.value_type === "boolean" ? true : "");
  return String(value);
}

function parseScalarValue(value: string, feature: RuleFeature) {
  if (feature.value_type === "boolean") return value === "true";
  if (feature.value_type === "integer" || feature.value_type === "number") {
    return Number(value);
  }
  return feature.allowed_values?.find((allowed) => String(allowed) === value) ?? value;
}

function createComponentKey(field: string, existingKeys: string[]) {
  let number = 1;
  while (true) {
    const suffix = `_custom_${number}`;
    const key = `${field.slice(0, 64 - suffix.length)}${suffix}`;
    if (!existingKeys.includes(key)) return key;
    number += 1;
  }
}

function createExpression(
  feature: RuleFeature,
  operator: string,
  valueText: string,
  endValueText: string,
): RuleExpression {
  if (operator === "IN") {
    return {
      field: feature.field,
      operator,
      value: valueText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => parseScalarValue(value, feature)),
    };
  }
  if (operator === "BETWEEN") {
    return {
      field: feature.field,
      operator,
      value: [
        parseScalarValue(valueText, feature),
        parseScalarValue(endValueText, feature),
      ],
    };
  }
  return {
    field: feature.field,
    operator,
    value: parseScalarValue(valueText, feature),
  };
}

export function RulePatternDialog({
  existingKeys,
  features,
  nextSortOrder,
  onAdd,
  onClose,
}: RulePatternDialogProps) {
  const selectableFeatures = features
    .filter((feature) => feature.operators.length > 0)
    .sort((left, right) => Number(right.derived) - Number(left.derived));
  const firstFeature = selectableFeatures[0];
  const [field, setField] = useState(firstFeature?.field ?? "");
  const [operator, setOperator] = useState(firstFeature?.operators[0] ?? "EQ");
  const [name, setName] = useState(firstFeature?.display_name ?? "");
  const [valueText, setValueText] = useState(defaultValueText(firstFeature));
  const [endValueText, setEndValueText] = useState("");
  const [weight, setWeight] = useState(0.1);
  const selectedFeature = selectableFeatures.find((feature) => feature.field === field);

  const changeFeature = (nextField: string) => {
    const feature = selectableFeatures.find((item) => item.field === nextField);
    if (!feature) return;
    setField(feature.field);
    setName(feature.display_name);
    setOperator(feature.operators[0]);
    setValueText(defaultValueText(feature));
    setEndValueText("");
  };

  const submitPattern = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFeature) return;
    onAdd({
      component_key: createComponentKey(selectedFeature.field, existingKeys),
      name: name.trim(),
      condition_expression: createExpression(
        selectedFeature,
        operator,
        valueText,
        endValueText,
      ),
      weight,
      sort_order: nextSortOrder,
    });
  };

  const valueInputType = selectedFeature
    && ["integer", "number"].includes(selectedFeature.value_type)
    ? "number"
    : "text";
  const canSubmit = Boolean(
    selectedFeature
    && name.trim()
    && valueText.trim()
    && (operator !== "BETWEEN" || endValueText.trim())
    && weight > 0
    && weight <= 1,
  );

  return (
    <div className="admin-dialog-backdrop" onMouseDown={onClose} role="presentation">
      <form
        aria-labelledby="rule-pattern-title"
        aria-modal="true"
        className="admin-dialog rule-pattern-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submitPattern}
        role="dialog"
      >
        <header>
          <div>
            <p className="admin-eyebrow">NEW PATTERN</p>
            <h2 id="rule-pattern-title">탐지 패턴 추가</h2>
          </div>
          <button onClick={onClose} type="button">닫기</button>
        </header>

        <p className="dialog-help">
          선택한 Feature가 조건을 만족하면 이 패턴의 가중치가 사기유형 점수에 반영됩니다.
        </p>

        <div className="pattern-form-grid">
          <label className="wide-field">
            <span>패턴 이름</span>
            <input
              maxLength={128}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>

          <label className="wide-field">
            <span>판단 Feature</span>
            <select onChange={(event) => changeFeature(event.target.value)} value={field}>
              <optgroup label="파생 Feature">
                {selectableFeatures.filter((feature) => feature.derived).map((feature) => (
                  <option key={feature.field} value={feature.field}>{feature.display_name}</option>
                ))}
              </optgroup>
              <optgroup label="원본 Feature">
                {selectableFeatures.filter((feature) => !feature.derived).map((feature) => (
                  <option key={feature.field} value={feature.field}>{feature.display_name}</option>
                ))}
              </optgroup>
            </select>
            {selectedFeature && (
              <small>{selectedFeature.field}{selectedFeature.derived ? " · 서버 계산값" : ""}</small>
            )}
          </label>

          <label>
            <span>비교 방식</span>
            <select onChange={(event) => setOperator(event.target.value)} value={operator}>
              {selectedFeature?.operators.map((item) => (
                <option key={item} value={item}>{OPERATOR_LABELS[item] ?? item}</option>
              ))}
            </select>
          </label>

          <label>
            <span>가중치</span>
            <input
              max="1"
              min="0.001"
              onChange={(event) => setWeight(Number(event.target.value))}
              required
              step="0.001"
              type="number"
              value={weight}
            />
          </label>

          <div className="wide-field pattern-value-field">
            <span>비교값</span>
            <div className={operator === "BETWEEN" ? "range-value-inputs" : ""}>
              {selectedFeature?.allowed_values && operator !== "IN" ? (
                <select aria-label="비교값" onChange={(event) => setValueText(event.target.value)} value={valueText}>
                  {selectedFeature.allowed_values.map((value) => (
                    <option key={String(value)} value={String(value)}>{String(value)}</option>
                  ))}
                </select>
              ) : selectedFeature?.value_type === "boolean" && operator !== "IN" ? (
                <select aria-label="비교값" onChange={(event) => setValueText(event.target.value)} value={valueText}>
                  <option value="true">감지</option>
                  <option value="false">미감지</option>
                </select>
              ) : (
                <input
                  aria-label={operator === "BETWEEN" ? "범위 최솟값" : "비교값"}
                  onChange={(event) => setValueText(event.target.value)}
                  placeholder={operator === "IN" ? "쉼표로 여러 값을 구분" : "비교할 값"}
                  required
                  step={selectedFeature?.value_type === "integer" ? "1" : "any"}
                  type={operator === "IN" ? "text" : valueInputType}
                  value={valueText}
                />
              )}
              {operator === "BETWEEN" && (
                <input
                  aria-label="범위 최댓값"
                  onChange={(event) => setEndValueText(event.target.value)}
                  placeholder="최댓값"
                  required
                  step={selectedFeature?.value_type === "integer" ? "1" : "any"}
                  type={valueInputType}
                  value={endValueText}
                />
              )}
            </div>
            {operator === "IN" && selectedFeature?.allowed_values && (
              <small>사용 가능: {selectedFeature.allowed_values.map(String).join(", ")}</small>
            )}
          </div>
        </div>

        <p className="pattern-save-guide">
          패턴을 추가한 뒤 유형별 가중치 합계를 1.000으로 맞추고 저장하세요.
        </p>

        <div className="pattern-dialog-actions">
          <button className="admin-button" onClick={onClose} type="button">취소</button>
          <button className="admin-button primary" disabled={!canSubmit} type="submit">패턴 추가</button>
        </div>
      </form>
    </div>
  );
}
