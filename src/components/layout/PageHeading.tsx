type PageHeadingProps = {
  eyebrow: string;
  title: string;
};

// 운영 화면의 최상단 제목 모양을 모든 페이지에서 동일하게 사용한다.
export function PageHeading({ eyebrow, title }: PageHeadingProps) {
  return (
    <div className="app-page-heading">
      <p className="app-page-eyebrow">{eyebrow}</p>
      <h1 className="app-page-title">{title}</h1>
    </div>
  );
}
