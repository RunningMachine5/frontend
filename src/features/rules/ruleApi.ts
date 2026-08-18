import { adminRequest } from "../admin/adminApi";
import type {
  FraudRule,
  RuleFeature,
  RuleReplay,
  RuleSet,
  RuleSetSummary,
  RuleTestResult,
  RuleValidation,
} from "./ruleTypes";

export const fetchRuleSets = (token: string) =>
  adminRequest<RuleSetSummary[]>("/rule-sets", token);

export const fetchRuleSet = (token: string, id: number) =>
  adminRequest<RuleSet>(`/rule-sets/${id}`, token);

export const fetchRuleFeatures = (token: string) =>
  adminRequest<RuleFeature[]>("/rule-features", token);

export const createRuleDraft = (token: string, sourceId?: number) =>
  adminRequest<RuleSet>("/rule-sets/drafts", token, {
    method: "POST",
    body: JSON.stringify(sourceId ? { source_rule_set_id: sourceId } : {}),
  });

export const saveRule = (token: string, ruleSetId: number, rule: FraudRule) =>
  adminRequest<FraudRule>(`/rule-sets/${ruleSetId}/rules/${rule.id}`, token, {
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

export const validateRuleSet = (token: string, id: number) =>
  adminRequest<RuleValidation>(`/rule-sets/${id}/validate`, token, { method: "POST" });

export const replayRuleSet = (token: string, id: number) =>
  adminRequest<RuleReplay>(`/rule-sets/${id}/replay`, token, {
    method: "POST",
    body: JSON.stringify({ sample_size: 100, detail_limit: 20 }),
  });

export const testRuleSet = (token: string, id: number, rawData: unknown) =>
  adminRequest<RuleTestResult>(`/rule-sets/${id}/test`, token, {
    method: "POST",
    body: JSON.stringify({ raw_data: rawData }),
  });

export const activateRuleSet = (token: string, id: number) =>
  adminRequest<RuleSet>(`/rule-sets/${id}/activate`, token, { method: "POST" });
