export type ModelLoadingStatusProps = {
  description: string;
  label: string;
  title: string;
};

export function ModelLoadingStatus({
  description,
  label,
  title,
}: ModelLoadingStatusProps) {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="model-loading-status"
      role="status"
    >
      <span aria-hidden="true" className="model-loading-signal">
        <i /><i /><i /><i />
      </span>
      <div className="model-loading-copy">
        <small>{label}</small>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <em><i aria-hidden="true" />응답 대기 중</em>
      <span aria-hidden="true" className="model-loading-track"><i /></span>
    </section>
  );
}
