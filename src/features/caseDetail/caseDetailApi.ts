import type {
  CaseDetailApiResponse,
  CaseDetailResponse,
  CaseReviewApiResponse,
  CaseReviewUpsertRequest,
  CaseReviewView,
} from "./caseDetailTypes";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) throw new Error("서버가 응답 데이터를 반환하지 않았습니다.");

  return JSON.parse(text) as T;
}

export async function fetchCaseDetail(transactionId: number): Promise<CaseDetailResponse> {
  const response = await fetch(`/api/transactions/${transactionId}/detail`);
  const result = await readJson<CaseDetailApiResponse>(response);

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message ?? "사건 상세 정보를 불러오지 못했습니다.");
  }

  return result.data;
}

export async function saveCaseReview(
  caseId: string,
  request: CaseReviewUpsertRequest,
): Promise<CaseReviewView> {
  const response = await fetch(`/api/cases/${caseId}/review`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const result = await readJson<CaseReviewApiResponse>(response);

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message ?? "최종 판정을 저장하지 못했습니다.");
  }

  return result.data;
}
