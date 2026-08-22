type ModelLoadErrorProps = {
  description: string;
  label: string;
  onRetry: () => void;
  title: string;
};

export function ModelLoadError({
  description,
  label,
  onRetry,
  title,
}: ModelLoadErrorProps) {
  return (
    <section aria-live="assertive" className="model-load-error" role="alert">
      <div>
        <small>{label}</small>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <button className="admin-button" onClick={onRetry} type="button">
        다시 불러오기
      </button>
    </section>
  );
}
