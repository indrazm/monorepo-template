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
.tacto-stack[data-pos="center"] { inset: 0; align-items: center; justify-content: center; pointer-events: none; }
.tacto-stack[data-pos="top-bar"] { top: 0; left: 0; right: 0; align-items: stretch; }
.tacto-stack[data-pos="bottom-bar"] { bottom: 0; left: 0; right: 0; align-items: stretch; }
.tacto-card {
  display: flex; align-items: center; gap: 14px; max-width: 360px;
  background: #fff; color: #17181c; border: 1px solid #e7e9f0; border-radius: 16px;
  padding: 14px 16px; box-shadow: 0 18px 40px -20px rgba(23,30,60,.28);
  opacity: 0; transform: translateY(10px); transition: opacity .2s ease, transform .2s ease;
}
.tacto-card[data-shown="1"] { opacity: 1; transform: translateY(0); }
.tacto-card[data-shape="square"] { border-radius: 8px; }
.tacto-media {
  width: 48px; height: 48px; border-radius: 11px; flex: none; display: grid; place-items: center;
  background: #f3f4f8; font-size: 21px; overflow: hidden;
}
.tacto-media img { width: 100%; height: 100%; object-fit: cover; }
.tacto-body { min-width: 0; }
.tacto-msg { font-weight: 700; font-size: 14.5px; line-height: 1.35; }
.tacto-sub { font-size: 12.5px; color: #5b606e; margin-top: 2px; }
.tacto-verified { display: inline-flex; align-items: center; gap: 4px; margin-top: 5px; font-size: 11px; font-weight: 700; color: #0e9f6e; }
.tacto-countdown { margin-top: 4px; font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; color: #17181c; }
.tacto-close {
  position: absolute; top: 6px; right: 8px; border: 0; background: transparent; cursor: pointer;
  color: #8a90a0; font-size: 15px; line-height: 1; padding: 2px;
}
.tacto-badge { margin-top: 2px; font-size: 10px; color: #8a90a0; }
.tacto-badge a { color: #8a90a0; text-decoration: none; }
.tacto-bar {
  display: flex; align-items: center; gap: 12px; width: 100%; background: #3b82f6; color: #fff;
  padding: 12px 20px; font-weight: 700; font-size: 14px;
  opacity: 0; transform: translateY(-8px); transition: opacity .2s ease, transform .2s ease;
}
.tacto-stack[data-pos="bottom-bar"] .tacto-bar { transform: translateY(8px); }
.tacto-bar[data-shown="1"] { opacity: 1; transform: translateY(0); }
.tacto-bar[data-shape="square"] { border-radius: 0; }
.tacto-bar-icon { font-size: 18px; flex: none; }
.tacto-bar-msg { flex: 1; min-width: 0; }
.tacto-bar .tacto-verified { color: #eafff5; margin: 0; }
.tacto-bar .tacto-badge { margin: 0; }
.tacto-bar .tacto-badge a { color: rgba(255,255,255,.75); }
.tacto-bar .tacto-close { position: static; color: rgba(255,255,255,.85); margin-left: 4px; }
.tacto-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(17,20,30,.5); pointer-events: auto; padding: 20px;
  opacity: 0; transition: opacity .2s ease;
}
.tacto-overlay[data-shown="1"] { opacity: 1; }
.tacto-modal {
  position: relative; width: min(360px, 92vw); background: #fff; color: #17181c;
  border-radius: 18px; padding: 26px 22px; text-align: center;
  box-shadow: 0 30px 60px -24px rgba(20,28,60,.5);
  transform: scale(.96); transition: transform .2s ease;
}
.tacto-overlay[data-shown="1"] .tacto-modal { transform: scale(1); }
.tacto-modal[data-shape="square"] { border-radius: 10px; }
.tacto-modal-icon { width: 54px; height: 54px; border-radius: 14px; display: grid; place-items: center; margin: 0 auto 12px; font-size: 26px; }
.tacto-modal-title { font-weight: 800; font-size: 16px; line-height: 1.35; margin: 0 0 6px; }
.tacto-modal .tacto-verified, .tacto-modal .tacto-badge { justify-content: center; }
.tacto-wheel-wrap { position: relative; width: 180px; height: 180px; margin: 14px auto; }
.tacto-wheel { width: 100%; height: 100%; border-radius: 50%; border: 6px solid #fff; box-shadow: 0 0 0 1px #e7e9f0, 0 12px 30px -12px rgba(20,28,60,.4); transition: transform 3s cubic-bezier(.17,.67,.2,1); }
.tacto-spin-pointer { position: absolute; top: -8px; left: 50%; transform: translateX(-50%); font-size: 20px; color: #17181c; }
.tacto-spin-btn { margin-top: 6px; border: 0; border-radius: 10px; padding: 10px 18px; color: #fff; font-weight: 800; cursor: pointer; font-size: 14px; }
.tacto-spin-btn[disabled] { cursor: default; opacity: .85; }
.tacto-spin-result { margin: 10px 0 0; font-weight: 800; font-size: 14px; opacity: 0; transform: translateY(6px); transition: opacity .25s ease, transform .25s ease; }
.tacto-spin-result[data-shown="1"] { opacity: 1; transform: none; }
.tacto-spin-reward { margin-top: 10px; }
.tacto-spin-code {
  display: inline-block; padding: 6px 12px; border: 1px dashed #c4c8d4; border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 800; font-size: 15px;
  letter-spacing: .04em; color: #17181c; background: #f8f9fc; user-select: all;
}
.tacto-spin-redeem {
  display: inline-block; margin-left: 8px; padding: 7px 14px; border-radius: 8px;
  background: #17181c; color: #fff; font-weight: 800; font-size: 13px; text-decoration: none;
}
.tacto-card[data-size="sm"] { padding: 10px 12px; gap: 10px; max-width: 300px; }
.tacto-card[data-size="sm"] .tacto-media { width: 38px; height: 38px; font-size: 17px; }
.tacto-card[data-size="sm"] .tacto-msg { font-size: 13px; }
.tacto-card[data-size="lg"] { padding: 18px 20px; gap: 16px; max-width: 420px; }
.tacto-card[data-size="lg"] .tacto-media { width: 56px; height: 56px; font-size: 25px; }
.tacto-card[data-size="lg"] .tacto-msg { font-size: 16px; }
.tacto-card[data-font="rounded"] { font-family: ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Quicksand", system-ui, sans-serif; }
.tacto-card[data-font="serif"] { font-family: "Iowan Old Style", Georgia, Cambria, "Times New Roman", serif; }
.tacto-card[data-font="mono"] { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.tacto-card[data-clickable="1"] { cursor: pointer; }
.tacto-inline { position: static; display: flex; justify-content: center; width: 100%; }
.tacto-inline .tacto-card { max-width: 100%; width: 100%; opacity: 1; transform: none; box-shadow: 0 8px 24px -16px rgba(23,30,60,.28); }
.tacto-stars { font-size: 15px; letter-spacing: 1px; line-height: 1; }
@media (prefers-reduced-motion: reduce) { .tacto-card, .tacto-bar, .tacto-overlay, .tacto-modal, .tacto-wheel { transition: none; } }
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

// Inline host (feedback T8): a shadow host appended INTO a target element, so an
// embedded proof block flows with the page instead of floating over it. Styles
// stay isolated in the shadow root exactly like the floating host.
export function createInlineHost(target: Element): ShadowHost {
  const host = document.createElement("div");
  host.setAttribute("data-tacto-inline", "");
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = BASE_CSS;
  const stack = document.createElement("div");
  stack.className = "tacto-inline";
  root.append(style, stack);
  target.appendChild(host);
  return { root, stack, destroy: () => host.remove() };
}
