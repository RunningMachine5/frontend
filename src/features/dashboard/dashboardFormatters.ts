export function formatNumber(value: number) {
  return value.toLocaleString("ko-KR");
}

export function formatMoney(value: number) {
  return `${formatNumber(value)}원`;
}

export function formatCompactMoney(value: number) {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(2)}억원`;
  }
  return formatMoney(value);
}

export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.getMonth() + 1}/${date.getDate()}`;
}
