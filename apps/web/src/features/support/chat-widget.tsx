import { useEffect } from "react";
import { env } from "../../api";

// Live chat loader (feedback T16). Injects the Crisp widget only when
// VITE_CRISP_WEBSITE_ID is configured; otherwise renders nothing, so the app
// works without a chat provider. Loaded once from the app shell.
export function ChatWidget() {
  const websiteId = env.VITE_CRISP_WEBSITE_ID;
  useEffect(() => {
    if (!websiteId) return;
    if (document.getElementById("tacto-crisp")) return;
    const globalWindow = window as unknown as {
      $crisp?: unknown[];
      CRISP_WEBSITE_ID?: string;
    };
    globalWindow.$crisp = globalWindow.$crisp ?? [];
    globalWindow.CRISP_WEBSITE_ID = websiteId;
    const script = document.createElement("script");
    script.id = "tacto-crisp";
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    document.head.appendChild(script);
  }, [websiteId]);
  return null;
}
