import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function App() {
  return <div>FDS Dashboard Frontend</div>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
