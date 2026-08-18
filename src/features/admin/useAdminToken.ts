import { useState } from "react";

import { readAdminToken, storeAdminToken } from "./adminApi";

const LOCAL_PROXY_TOKEN = "__local_admin_proxy__";

function initialAdminToken() {
  const storedToken = readAdminToken();
  if (storedToken) return storedToken;
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_LOCAL_ADMIN_AUTO_CONNECT === "true"
  ) {
    return LOCAL_PROXY_TOKEN;
  }
  return "";
}

export function useAdminToken() {
  const [token, setToken] = useState(initialAdminToken);
  return {
    token,
    saveToken: (value: string) => setToken(storeAdminToken(value)),
  };
}
