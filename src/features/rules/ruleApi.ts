import { adminRequest } from "../admin/adminApi";
import type {
  FraudRule,
  RuleComponentInput,
  RuleFeature,
  RulePatternStatistics,
  RuleReplay,
  RuleSet,
  RuleSetSummary,
  RuleValidation,
} from "./ruleTypes";

export const fetchRuleSets = () =>
  adminRequest<RuleSetSummary[]>("/rule-sets");

export const fetchRuleSet = (id: number) =>
  adminRequest<RuleSet>(`/rule-sets/${id}`);

export const fetchRuleFeatures = () =>
  adminRequest<RuleFeature[]>("/rule-features");

export const fetchRulePatternStatistics = (
  patterns: RuleComponentInput[],
  sampleSize = 1000,
) =>
  adminRequest<RulePatternStatistics>("/rule-pattern-statistics", {
    method: "POST",
    body: JSON.stringify({
      sample_size: sampleSize,
      patterns: patterns.map((pattern) => ({
        component_key: pattern.component_key,
        condition_expression: pattern.condition_expression,
      })),
    }),
  });

export const createRuleDraft = (sourceId?: number) =>
  adminRequest<RuleSet>("/rule-sets/drafts", {
    method: "POST",
    body: JSON.stringify(sourceId ? { source_rule_set_id: sourceId } : {}),
  });

export const deleteRuleDraft = (id: number) =>
  adminRequest<void>(`/rule-sets/${id}`, { method: "DELETE" });

export const saveRuleComponents = (ruleSetId: number, rule: FraudRule) =>
  adminRequest<FraudRule>(`/rule-sets/${ruleSetId}/rules/${rule.id}/components`, {
    method: "PUT",
    body: JSON.stringify({
      components: rule.components.map((component, index) => ({
        component_key: component.component_key,
        name: component.name,
        condition_expression: component.condition_expression,
        weight: component.weight,
        sort_order: index,
      })),
    }),
  });

export const validateRuleSet = (id: number) =>
  adminRequest<RuleValidation>(`/rule-sets/${id}/validate`, { method: "POST" });

export const replayRuleSet = (id: number, sampleSize = 100, detailLimit = 20) =>
  adminRequest<RuleReplay>(`/rule-sets/${id}/replay`, {
    method: "POST",
    body: JSON.stringify({ sample_size: sampleSize, detail_limit: detailLimit }),
  });

export const activateRuleSet = (id: number) =>
  adminRequest<RuleSet>(`/rule-sets/${id}/activate`, { method: "POST" });
