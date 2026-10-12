// Creates an isolated shadow-DOM host so the widget's styles never leak into
// (or inherit from) the customer's site (SRS section 3.4, NFR-A11Y-01).
const BASE_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.tacto-stack {
  position: fixed; z-index: 2147483000; display: flex; flex-direction: column; gap: 10px;
  font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, "Segoe UI", sans-serif;
}
.tacto-stack[data-pos$="left"] { left: 18px; align-items: flex-start; }
.tacto-stack[data-pos$="right"] { right: 18px; align-items: flex-end; }
.tacto-stack[data-pos^="top"] { top: 18px; }
.tacto-stack[data-pos^="bottom"] { bottom: 18px; }
.tacto-card {
  display: flex; align-items: center; gap: 14px; max-width: 360px;
  background: #fff; color: #17181c; border: 1px solid #e7e9f0; border-radius: 16px;
  padding: 14px 16px; box-shadow: 0 18px 40px -20px rgba(23,30,60,.28);
  opacity: 0; transform: translateY(10px); transition: opacity .2s ease, transform .2s ease;
}
.tacto-card[data-shown="1"] { opacity: 1; transform: translateY(0); }
.tacto-card[data-shape="square"] { border-radius: 8px; }
.tacto-media {
  width: 46px; height: 46px; border-radius: 11px; flex: none; display: grid; place-items: center;
  background: #f3f4f8; font-size: 20px; overflow: hidden;
}
.tacto-media img { width: 100%; height: 100%; object-fit: cover; }
.tacto-body { min-width: 0; }
.tacto-msg { font-weight: 700; font-size: 13.5px; line-height: 1.35; }
.tacto-sub { font-size: 12px; color: #5b606e; margin-top: 2px; }
.tacto-verified { display: inline-flex; align-items: center; gap: 4px; margin-top: 5px; font-size: 11px; font-weight: 700; color: #0e9f6e; }
.tacto-close {
  position: absolute; top: 6px; right: 8px; border: 0; background: transparent; cursor: pointer;
  color: #8a90a0; font-size: 15px; line-height: 1; padding: 2px;
}
.tacto-badge { margin-top: 2px; font-size: 10px; color: #8a90a0; }
.tacto-badge a { color: #8a90a0; text-decoration: none; }
@media (prefers-reduced-motion: reduce) { .tacto-card { transition: none; } }
`;

export type ShadowHost = { root: ShadowRoot; stack: HTMLElement; destroy: () => void };

export function createShadowHost(position: string): ShadowHost {
  const host = document.createElement("div");
  host.setAttribute("data-tacto", "");
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = BASE_CSS;
  const stack = document.createElement("div");
  stack.className = "tacto-stack";
  stack.setAttribute("data-pos", position);
  root.append(style, stack);
  document.body.appendChild(host);
  return { root, stack, destroy: () => host.remove() };
}
