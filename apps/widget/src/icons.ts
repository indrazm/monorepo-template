// Inline SVG icons for notification media tiles. Emojis render differently per
// OS/font and cannot inherit the notification accent color, so the pixel ships
// small vector icons instead.

const SVG_NS = "http://www.w3.org/2000/svg";

type IconPart =
  | { tag: "path"; d: string }
  | { tag: "circle"; cx: number; cy: number; r: number }
  | { tag: "rect"; x: number; y: number; width: number; height: number; rx: number };

const ICONS: Record<string, IconPart[]> = {
  recent_sales: [
    {
      tag: "path",
      d: "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",
    },
    { tag: "circle", cx: 8, cy: 21, r: 1 },
    { tag: "circle", cx: 19, cy: 21, r: 1 },
  ],
  counter: [
    { tag: "path", d: "M16 7h6v6" },
    { tag: "path", d: "m22 7-8.5 8.5-5-5L2 17" },
  ],
  combo: [
    { tag: "path", d: "M5 21V15" },
    { tag: "path", d: "M12 21V9" },
    { tag: "path", d: "M19 21V3" },
  ],
  live_visitors: [
    {
      tag: "path",
      d: "M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0",
    },
    { tag: "circle", cx: 12, cy: 12, r: 3 },
  ],
  review: [
    {
      tag: "path",
      d: "M11.53 2.3a.53.53 0 0 1 .95 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0l-4.62 2.43a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .29-.9l5.17-.76a2.12 2.12 0 0 0 1.6-1.16z",
    },
  ],
  social_counter: [
    { tag: "path", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" },
    { tag: "circle", cx: 9, cy: 7, r: 4 },
    { tag: "path", d: "M22 21v-2a4 4 0 0 0-3-3.87" },
    { tag: "path", d: "M16 3.13a4 4 0 0 1 0 7.75" },
  ],
  youtube: [{ tag: "path", d: "M6 3l14 9-14 9V3z" }],
  custom: [{ tag: "path", d: "M7.9 20A9 9 0 1 0 4 16.1L2 22z" }],
  low_stock: [
    {
      tag: "path",
      d: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z",
    },
  ],
  countdown: [
    { tag: "circle", cx: 12, cy: 12, r: 10 },
    { tag: "path", d: "M12 6v6l4 2" },
  ],
  popup: [
    { tag: "path", d: "m5.8 11.3-3.8 10.7 10.7-3.8" },
    { tag: "path", d: "M4 3h.01M22 8h.01M15 2h.01M22 20h.01" },
    {
      tag: "path",
      d: "M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2z",
    },
  ],
  bar: [
    { tag: "path", d: "m3 11 18-5v12L3 14v-3z" },
    { tag: "path", d: "M11.6 16.8a3 3 0 1 1-5.8-1.6" },
  ],
  spin_to_win: [
    { tag: "rect", x: 3, y: 8, width: 18, height: 4, rx: 1 },
    { tag: "path", d: "M12 8v13" },
    { tag: "path", d: "M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" },
    {
      tag: "path",
      d: "M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5",
    },
  ],
  default: [
    { tag: "path", d: "M10.27 21a2 2 0 0 0 3.46 0" },
    {
      tag: "path",
      d: "M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33",
    },
  ],
};

export function createTypeIcon(type: string, accent: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("stroke", accent);
  svg.setAttribute("width", "22");
  svg.setAttribute("height", "22");
  svg.classList.add("tacto-type-icon");

  for (const part of ICONS[type] ?? ICONS.default ?? []) {
    const element = document.createElementNS(SVG_NS, part.tag);
    if (part.tag === "path") element.setAttribute("d", part.d);
    if (part.tag === "circle") {
      element.setAttribute("cx", String(part.cx));
      element.setAttribute("cy", String(part.cy));
      element.setAttribute("r", String(part.r));
    }
    if (part.tag === "rect") {
      element.setAttribute("x", String(part.x));
      element.setAttribute("y", String(part.y));
      element.setAttribute("width", String(part.width));
      element.setAttribute("height", String(part.height));
      element.setAttribute("rx", String(part.rx));
    }
    svg.appendChild(element);
  }
  return svg;
}
