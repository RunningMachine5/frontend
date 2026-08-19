import { adminRequest } from "../admin/adminApi";
import type {
  FraudRule,
  RuleFeature,
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

export const createRuleDraft = (sourceId?: number) =>
  adminRequest<RuleSet>("/rule-sets/drafts", {
    method: "POST",
    body: JSON.stringify(sourceId ? { source_rule_set_id: sourceId } : {}),
  });

export const deleteRuleDraft = (id: number) =>
  adminRequest<void>(`/rule-sets/${id}`, { method: "DELETE" });

export const saveRule = (ruleSetId: number, rule: FraudRule) =>
  adminRequest<FraudRule>(`/rule-sets/${ruleSetId}/rules/${rule.id}`, {
    method: "PUT",
    body: JSON.stringify({
      type_code: rule.type_code,
      display_name: rule.display_name,
      description: rule.description,
      enabled: rule.enabled,
      sort_order: rule.sort_order,
      components: rule.components.map((component) => ({
        component_key: component.component_key,
        name: component.name,
        condition_expression: component.condition_expression,
        weight: component.weight,
        sort_order: component.sort_order,
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
