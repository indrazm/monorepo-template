<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tacto Design System</title>
<meta name="description" content="Design system for the Tacto social-proof dashboard — tokens, typography and components.">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>
  :root{
    --bg:#F4F5F7; --surface:#FFFFFF; --surface-2:#F3F4F8; --surface-3:#ECEEF3;
    --fg:#17181C; --muted:#5B606E; --faint:#8A90A0;
    --line:#E7E9F0; --line-soft:#EEF0F5;
    --link:#2563EB; --accent:#3B82F6; --accent-strong:#2f6fe0; --accent-2:#22D3EE;
    --tint:#E9F1FE;
    --ok:#0E9F6E; --ok-tint:#E3F5EE; --warn:#D97706; --danger:#E5484D;
    --ring:rgba(59,130,246,.35);
    --radius:20px; --radius-md:14px; --radius-sm:11px;
    --sh-xs:0 1px 2px rgba(23,30,60,.05);
    --sh-sm:0 2px 10px -4px rgba(23,30,60,.10), 0 1px 2px rgba(23,30,60,.04);
    --sh-md:0 18px 40px -20px rgba(23,30,60,.28);
    --f:"Plus Jakarta Sans", ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    --maxw:1080px;
    color-scheme:light;
  }
  @media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
    --bg:#0D0E12; --surface:#15171E; --surface-2:#1A1D26; --surface-3:#222633;
    --fg:#F2F3F0; --muted:#9BA1B0; --faint:#6D7484; --line:#262A35; --line-soft:#20242E;
    --link:#7FB0FF; --accent:#3B82F6; --accent-strong:#5a95f7; --accent-2:#22D3EE;
    --tint:#141E31; --ok:#2BBE8A; --ok-tint:#15291F; --ring:rgba(123,176,255,.4);
    --sh-xs:0 1px 2px rgba(0,0,0,.4); --sh-sm:0 2px 12px -4px rgba(0,0,0,.5); --sh-md:0 20px 44px -20px rgba(0,0,0,.7);
    color-scheme:dark;
  }}
  :root[data-theme="dark"]{
    --bg:#0D0E12; --surface:#15171E; --surface-2:#1A1D26; --surface-3:#222633;
    --fg:#F2F3F0; --muted:#9BA1B0; --faint:#6D7484; --line:#262A35; --line-soft:#20242E;
    --link:#7FB0FF; --accent:#3B82F6; --accent-strong:#5a95f7; --accent-2:#22D3EE;
    --tint:#141E31; --ok:#2BBE8A; --ok-tint:#15291F; --ring:rgba(123,176,255,.4);
    --sh-xs:0 1px 2px rgba(0,0,0,.4); --sh-sm:0 2px 12px -4px rgba(0,0,0,.5); --sh-md:0 20px 44px -20px rgba(0,0,0,.7);
    color-scheme:dark;
  }

*{box-sizing:border-box}
body{margin:0; background:var(--bg); color:var(--fg); font-family:var(--f); font-size:15px; line-height:1.55; letter-spacing:-.005em; -webkit-font-smoothing:antialiased}
.wrap{max-width:var(--maxw); margin-inline:auto; padding-inline:24px}
.tnum{font-variant-numeric:tabular-nums; letter-spacing:0}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.86em; background:var(--surface-3); padding:2px 6px; border-radius:6px; color:var(--fg)}

/* top bar */
header.bar{position:sticky; top:0; z-index:20; background:color-mix(in srgb,var(--bg) 80%,transparent); backdrop-filter:saturate(1.3) blur(12px); border-bottom:1px solid var(--line)}
.bar .wrap{display:flex; align-items:center; gap:12px; padding-block:13px}
.bar .brand{display:flex; align-items:center; gap:10px; font-weight:800; font-size:17px; letter-spacing:-.02em}
.bar .brand svg{width:30px; height:30px; border-radius:9px}
.bar .tag{font-size:12.5px; color:var(--faint); font-weight:600}
.bar .spacer{flex:1}
.toggle{font:inherit; font-size:13px; font-weight:600; cursor:pointer; color:var(--fg); background:var(--surface); border:1px solid var(--line); border-radius:999px; padding:8px 15px; display:inline-flex; gap:8px; align-items:center}
.toggle:hover{border-color:var(--accent)}

/* hero */
.hero{border-bottom:1px solid var(--line); background:radial-gradient(130% 150% at 0% 0%, var(--tint), transparent 55%)}
.hero .wrap{padding-block:52px 44px}
.hero h1{font-weight:800; font-size:clamp(2rem,5vw,3rem); letter-spacing:-.035em; margin:18px 0 10px}
.hero p{max-width:60ch; color:var(--muted); font-size:1.06rem; margin:0}
.hero .logo{display:flex; align-items:center; gap:14px}
.hero .logo svg{width:52px; height:52px; border-radius:15px; box-shadow:var(--sh-sm)}
.hero .logo .n{font-weight:800; font-size:1.5rem; letter-spacing:-.03em}
.hero .meta{display:flex; gap:10px; margin-top:22px; flex-wrap:wrap; font-size:13px; color:var(--muted)}
.hero .meta span{background:var(--surface); border:1px solid var(--line); padding:5px 12px; border-radius:999px; font-weight:600}

section{padding-block:48px; border-bottom:1px solid var(--line)}
.sec-head{display:flex; align-items:baseline; gap:14px; margin-bottom:26px}
.sec-head .no{font-weight:800; font-size:13px; color:var(--accent); font-variant-numeric:tabular-nums}
.sec-head h2{font-weight:800; font-size:1.5rem; letter-spacing:-.03em; margin:0}
.sec-head p{margin:4px 0 0; color:var(--muted); font-size:14px; max-width:64ch}

.card{background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:24px; box-shadow:var(--sh-sm)}
.grid{display:grid; gap:16px}
.lbl{font-size:11.5px; font-weight:700; letter-spacing:.04em; color:var(--faint); margin:0 0 14px}

/* color */
.swatches{grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
.sw{border:1px solid var(--line); border-radius:var(--radius-md); overflow:hidden; background:var(--surface); box-shadow:var(--sh-xs)}
.sw .chip{height:92px; display:flex; align-items:flex-end; padding:12px; cursor:pointer}
.sw .chip .role{font-weight:700; font-size:14px}
.sw .meta{padding:11px 13px}
.sw .meta .hex{font-family:ui-monospace,monospace; font-size:13px; font-weight:600}
.sw .meta .tok{font-family:ui-monospace,monospace; font-size:11px; color:var(--accent)}
.sw .meta .use{font-size:12px; color:var(--muted); margin-top:3px}
.scale-row{display:flex; gap:0; border-radius:var(--radius-md); overflow:hidden; border:1px solid var(--line); margin-top:4px}
.scale-row div{flex:1; height:46px; display:grid; place-items:center; font-size:10.5px; font-weight:700; color:#fff}

/* elevation + radius */
.trio{grid-template-columns:repeat(3,1fr)}
@media (max-width:640px){.trio{grid-template-columns:1fr}}
.elev{height:96px; border-radius:var(--radius-md); background:var(--surface); border:1px solid var(--line); display:grid; place-items:center; font-weight:700; color:var(--muted); font-size:12.5px}
.radbox{height:64px; background:color-mix(in srgb,var(--accent) 12%,transparent); border:1.5px solid color-mix(in srgb,var(--accent) 35%,transparent); display:grid; place-items:center; font-weight:700; font-size:12px; color:var(--accent)}

/* spacing */
.space-row{display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap}
.space-row .s{text-align:center; color:var(--muted); font-size:11.5px}
.space-row .s .b{background:var(--accent); border-radius:4px; margin:0 auto 7px}

/* type scale */
.type-row{display:flex; justify-content:space-between; align-items:baseline; gap:18px; padding:15px 0; border-top:1px solid var(--line-soft); flex-wrap:wrap}
.type-row:first-child{border-top:0}
.type-row .spec{color:var(--faint); font-size:11.5px; font-family:ui-monospace,monospace; white-space:nowrap}
.t-d1{font-weight:800; font-size:2.4rem; letter-spacing:-.035em}
.t-d2{font-weight:800; font-size:1.8rem; letter-spacing:-.03em}
.t-h{font-weight:700; font-size:1.3rem; letter-spacing:-.02em}
.t-sub{font-weight:700; font-size:1.08rem; letter-spacing:-.02em}
.t-bd{font-weight:400; font-size:1rem; max-width:48ch}
.t-sm{font-weight:500; font-size:.875rem; color:var(--muted)}
.t-lbl{font-weight:700; font-size:11.5px; letter-spacing:.04em; color:var(--faint)}
.t-num{font-weight:800; font-size:1.95rem; letter-spacing:-.03em; font-variant-numeric:tabular-nums}

/* component demos */
.demo{display:flex; gap:14px; flex-wrap:wrap; align-items:center}
.demo-col{display:flex; flex-direction:column; gap:16px}
.two{grid-template-columns:1fr 1fr}
@media (max-width:720px){.two{grid-template-columns:1fr}}

.btn{font-family:var(--f); font-weight:700; font-size:14px; border-radius:12px; padding:10px 17px; border:1px solid transparent; cursor:pointer; display:inline-flex; align-items:center; gap:8px; letter-spacing:-.01em; transition:background .15s, border-color .15s}
.btn:focus-visible{outline:2px solid var(--ring); outline-offset:2px}
.btn.primary{background:var(--accent); color:#fff; box-shadow:0 6px 16px -8px color-mix(in srgb,var(--accent) 80%,transparent)}
.btn.primary:hover{background:var(--accent-strong)}
.btn.ghost{background:var(--surface); color:var(--fg); border-color:var(--line)}
.btn.ghost:hover{border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
.btn.sm{padding:7px 13px; font-size:13px; border-radius:10px}
.btn.danger{background:var(--danger); color:#fff}

.pill{font-size:11.5px; font-weight:700; padding:4px 11px; border-radius:999px; display:inline-flex; align-items:center; gap:6px; white-space:nowrap}
.pill::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.pill.sales{color:#2563EB; background:color-mix(in srgb,#2563EB 12%,transparent)}
.pill.counter{color:#0891B2; background:color-mix(in srgb,#0891B2 13%,transparent)}
.pill.visitors{color:#0E9F6E; background:color-mix(in srgb,#0E9F6E 13%,transparent)}
.pill.review{color:#C2690B; background:color-mix(in srgb,#D97706 14%,transparent)}
.pill.custom{color:var(--muted); background:var(--surface-3)}

.delta{font-size:11.5px; font-weight:700; display:inline-flex; align-items:center; gap:3px; padding:2px 8px; border-radius:999px}
.delta.up{color:var(--ok); background:var(--ok-tint)}
.delta.down{color:var(--danger); background:color-mix(in srgb,var(--danger) 12%,transparent)}
.count{font-size:11px; font-weight:700; color:var(--accent-strong); background:color-mix(in srgb,var(--accent) 15%,transparent); padding:1px 8px; border-radius:999px}

.sw-toggle{position:relative; width:40px; height:23px; display:inline-block}
.sw-toggle input{position:absolute; opacity:0; width:100%; height:100%; margin:0; cursor:pointer}
.sw-toggle .track{position:absolute; inset:0; border-radius:999px; background:var(--surface-3); border:1px solid var(--line); transition:.18s}
.sw-toggle .knob{position:absolute; top:2px; left:2px; width:17px; height:17px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.25); transition:.18s}
.sw-toggle input:checked + .track{background:var(--accent); border-color:var(--accent)}
.sw-toggle input:checked + .track + .knob{left:20px}

.field{display:flex; flex-direction:column; gap:7px; max-width:320px}
.field label{font-size:12.5px; font-weight:600; color:var(--muted)}
.input{background:var(--surface); border:1px solid var(--line); border-radius:11px; padding:10px 13px; font:inherit; font-size:14px; color:var(--fg); outline:none; transition:border-color .15s, box-shadow .15s}
.input:focus{border-color:var(--accent); box-shadow:0 0 0 3px var(--ring)}
.search{display:flex; align-items:center; gap:9px; background:var(--surface); border:1px solid var(--line); border-radius:999px; padding:9px 15px; color:var(--faint); font-size:13.5px; max-width:320px}
.search input{border:0; background:none; outline:none; color:var(--fg); font:inherit; font-size:13.5px; width:100%}
.search kbd{font-family:var(--f); font-size:11px; color:var(--faint); border:1px solid var(--line); border-radius:6px; padding:1px 6px; background:var(--surface-2)}

/* stat tile demo */
.tile{position:relative; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:18px; box-shadow:var(--sh-sm); max-width:260px}
.tile .lab{font-size:12.5px; color:var(--muted); font-weight:600; display:flex; align-items:center; gap:9px}
.tile .ic{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 13%,transparent); color:var(--accent)}
.tile .ic svg{width:15px;height:15px}
.tile .val{font-weight:800; font-size:1.95rem; letter-spacing:-.03em; margin:12px 0 0; line-height:1; font-variant-numeric:tabular-nums}
.tile .foot{display:flex; align-items:center; gap:9px; margin-top:9px}
.tile .vs{font-size:11.5px; color:var(--faint)}

/* nav item demo */
.navdemo{max-width:260px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-md); padding:10px; box-shadow:var(--sh-xs)}
.navitem{position:relative; display:flex; align-items:center; gap:12px; padding:9.5px 12px; border-radius:11px; color:var(--muted); font-weight:500; font-size:14px}
.navitem svg{width:19px;height:19px}
.navitem .c{margin-left:auto}
.navitem.active{background:color-mix(in srgb,var(--accent) 11%,transparent); color:var(--accent-strong); font-weight:700}
.navitem.active::before{content:"";position:absolute; left:-10px; top:9px; bottom:9px; width:3px; border-radius:0 3px 3px 0; background:var(--accent)}

/* table demo */
table.tbl{width:100%; border-collapse:collapse}
.tbl th{text-align:left; font-size:11px; font-weight:700; color:var(--faint); padding:0 12px 12px}
.tbl td{padding:13px 12px; border-top:1px solid var(--line-soft); font-size:14px}
.tbl tbody tr:hover td{background:var(--surface-2)}
.nname{font-weight:700; display:flex; align-items:center; gap:11px}
.tico{width:32px;height:32px;border-radius:9px;display:grid;place-items:center; background:color-mix(in srgb,#3B82F6 13%,transparent); color:#3B82F6}
.tico svg{width:16px;height:16px}

/* avatars */
.ava{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;font-weight:700;font-size:13px}
.ava.grad{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff}
.ava.buy{background:color-mix(in srgb,var(--accent) 12%,transparent)}
.ava.signup{background:color-mix(in srgb,#8b5cf6 13%,transparent)}
.ava.review{background:color-mix(in srgb,var(--warn) 15%,transparent)}

/* live notification */
.livecard{position:relative; background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:14px 16px; display:flex; align-items:center; gap:14px; box-shadow:var(--sh-md); max-width:360px}
.livecard .ph{width:48px;height:48px;border-radius:11px;background:var(--surface-2);display:grid;place-items:center;font-size:22px;flex:none}
.livecard .h{font-weight:700; font-size:13.5px}
.livecard .h b{color:var(--accent)}
.livecard .s{font-size:12px; color:var(--muted); margin-top:2px}
.livecard .v{font-size:11px; color:var(--ok); font-weight:700; display:inline-flex; align-items:center; gap:4px; margin-top:5px}

.callout{display:inline-block; background:var(--fg); color:var(--bg); font-size:12px; font-weight:700; padding:6px 12px; border-radius:9px; box-shadow:var(--sh-md)}

/* principle + voice */
.voice{grid-template-columns:1fr 1fr}
@media (max-width:640px){.voice{grid-template-columns:1fr}}
.voice h4{margin:0 0 10px; font-size:13px; letter-spacing:.03em; font-weight:700}
.voice.say h4,.voice .say h4{color:var(--ok)} .voice .dont h4{color:var(--danger)}
.voice ul{margin:0; padding-left:18px; display:flex; flex-direction:column; gap:8px; font-size:14px}

footer{padding-block:38px; color:var(--muted); font-size:13px}
footer .wrap{display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap}

.toast{position:fixed; left:50%; bottom:22px; transform:translateX(-50%) translateY(16px); background:var(--fg); color:var(--bg); font-size:13px; font-weight:700; padding:9px 16px; border-radius:999px; opacity:0; transition:.2s; pointer-events:none; z-index:40}
.toast.show{opacity:1; transform:translateX(-50%) translateY(0)}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="tacto-tile" viewBox="0 0 256 256">
    <rect x="0" y="0" width="256" height="256" rx="58" fill="#3B82F6"/>
    <g transform="translate(8.42,6.55) scale(0.9342)">
      <path fill="#fff" d="M 70 54 h 116 a 26 26 0 0 1 26 26 a 26 26 0 0 1 -26 26 h -116 a 26 26 0 0 1 -26 -26 a 26 26 0 0 1 26 -26 Z"/>
      <path fill="#fff" d="M 128 54 a 26 26 0 0 1 26 26 v 100 a 26 26 0 0 1 -26 26 a 26 26 0 0 1 -26 -26 v -100 a 26 26 0 0 1 26 -26 Z"/>
      <circle cx="128" cy="150" r="13" fill="#22D3EE"/>
    </g>
  </symbol>
</svg>

<header class="bar">
  <div class="wrap">
    <span class="brand"><svg viewBox="0 0 256 256"><use href="#tacto-tile"/></svg>Tacto</span>
    <span class="tag">Design System</span>
    <span class="spacer"></span>
    <button class="toggle" id="themeBtn"><span id="themeIcon">○</span><span id="themeLbl">Light</span></button>
  </div>
</header>

<div class="hero">
  <div class="wrap">
    <div class="logo"><svg viewBox="0 0 256 256"><use href="#tacto-tile"/></svg><span class="n">Tacto</span></div>
    <h1>Design system</h1>
    <p>The building blocks behind the Tacto dashboard — tokens, type, and components tuned for a calm, legible product that shows real-time social proof. Everything here is light-first and dark-ready from the same variables.</p>
    <div class="meta"><span>Plus Jakarta Sans</span><span>Blue #3B82F6</span><span>Cyan #22D3EE</span><span>Light &amp; dark</span><span>WCAG-minded</span></div>
  </div>
</div>

<main>
  <!-- FOUNDATIONS: COLOR -->
  <section>
    <div class="wrap">
      <div class="sec-head"><span class="no">01</span><div><h2>Color</h2><p>Four brand colors plus a quiet set of surfaces, text and semantic tones. Blue carries the brand and every primary action; Cyan is reserved for the one accent moment — the “point of contact”. Click a swatch to copy its hex.</p></div></div>

      <p class="lbl">Brand</p>
      <div class="grid swatches" id="swatches">
        <div class="sw"><div class="chip" data-hex="#3B82F6" style="background:#3B82F6;color:#fff"><span class="role">Blue</span></div><div class="meta"><div class="hex">#3B82F6</div><div class="tok">--accent</div><div class="use">Brand, primary buttons, active state, data line 1</div></div></div>
        <div class="sw"><div class="chip" data-hex="#22D3EE" style="background:#22D3EE;color:#063b45"><span class="role">Cyan</span></div><div class="meta"><div class="hex">#22D3EE</div><div class="tok">--accent-2</div><div class="use">Single accent — contact dot, highlight, data line 2</div></div></div>
        <div class="sw"><div class="chip" data-hex="#17181C" style="background:#17181C;color:#fff"><span class="role">Ink</span></div><div class="meta"><div class="hex">#17181C</div><div class="tok">--fg</div><div class="use">Primary text, wordmark</div></div></div>
        <div class="sw"><div class="chip" data-hex="#F4F5F7" style="background:#F4F5F7;color:#17181C"><span class="role">Paper</span></div><div class="meta"><div class="hex">#F4F5F7</div><div class="tok">--bg</div><div class="use">App background (light)</div></div></div>
      </div>

      <p class="lbl" style="margin-top:28px">Surfaces &amp; text</p>
      <div class="grid swatches">
        <div class="sw"><div class="chip" data-hex="#FFFFFF" style="background:#FFFFFF;color:#17181C;border-bottom:1px solid var(--line)"><span class="role">Surface</span></div><div class="meta"><div class="hex">#FFFFFF</div><div class="tok">--surface</div><div class="use">Cards, sidebar, inputs</div></div></div>
        <div class="sw"><div class="chip" data-hex="#F3F4F8" style="background:#F3F4F8;color:#17181C"><span class="role">Surface 2</span></div><div class="meta"><div class="hex">#F3F4F8</div><div class="tok">--surface-2</div><div class="use">Hover rows, subtle fills</div></div></div>
        <div class="sw"><div class="chip" data-hex="#ECEEF3" style="background:#ECEEF3;color:#17181C"><span class="role">Surface 3</span></div><div class="meta"><div class="hex">#ECEEF3</div><div class="tok">--surface-3</div><div class="use">Tracks, chips, divid's fill</div></div></div>
        <div class="sw"><div class="chip" data-hex="#5B606E" style="background:#5B606E;color:#fff"><span class="role">Muted</span></div><div class="meta"><div class="hex">#5B606E</div><div class="tok">--muted</div><div class="use">Secondary text</div></div></div>
        <div class="sw"><div class="chip" data-hex="#8A90A0" style="background:#8A90A0;color:#fff"><span class="role">Faint</span></div><div class="meta"><div class="hex">#8A90A0</div><div class="tok">--faint</div><div class="use">Tertiary text, captions</div></div></div>
        <div class="sw"><div class="chip" data-hex="#E7E9F0" style="background:#E7E9F0;color:#17181C"><span class="role">Line</span></div><div class="meta"><div class="hex">#E7E9F0</div><div class="tok">--line</div><div class="use">Borders, hairlines</div></div></div>
      </div>

      <p class="lbl" style="margin-top:28px">Semantic &amp; notification types</p>
      <div class="grid swatches">
        <div class="sw"><div class="chip" data-hex="#0E9F6E" style="background:#0E9F6E;color:#fff"><span class="role">Success</span></div><div class="meta"><div class="hex">#0E9F6E</div><div class="tok">--ok</div><div class="use">Active, positive delta, verified</div></div></div>
        <div class="sw"><div class="chip" data-hex="#D97706" style="background:#D97706;color:#fff"><span class="role">Warning</span></div><div class="meta"><div class="hex">#D97706</div><div class="tok">--warn</div><div class="use">Review type, caution</div></div></div>
        <div class="sw"><div class="chip" data-hex="#E5484D" style="background:#E5484D;color:#fff"><span class="role">Danger</span></div><div class="meta"><div class="hex">#E5484D</div><div class="tok">--danger</div><div class="use">Negative delta, destructive</div></div></div>
        <div class="sw"><div class="chip" data-hex="#8B5CF6" style="background:#8B5CF6;color:#fff"><span class="role">Violet</span></div><div class="meta"><div class="hex">#8B5CF6</div><div class="tok">(signup / CTR)</div><div class="use">Signup events, extra series</div></div></div>
      </div>

      <div class="card" style="margin-top:22px">
        <p class="lbl">Usage ratio — Paper &amp; Ink dominate, Blue for action, Cyan sparingly</p>
        <div class="scale-row">
          <div style="background:#F4F5F7;color:#17181C;flex:7">Paper 60%</div>
          <div style="background:#17181C;flex:4">Ink 25%</div>
          <div style="background:#3B82F6;flex:2">Blue 12%</div>
          <div style="background:#22D3EE;color:#063b45;flex:1">Cyan 3%</div>
        </div>
      </div>
    </div>

  </section>

  <!-- TYPOGRAPHY -->
  <section>
    <div class="wrap">
      <div class="sec-head"><span class="no">02</span><div><h2>Typography</h2><p>One family — <b>Plus Jakarta Sans</b> — across the whole product. Hierarchy comes from weight and size, never a second face. Headings use tight negative tracking (-.02 to -.035em); all metrics use tabular figures so numbers stay aligned.</p></div></div>
      <div class="card">
        <div class="type-row"><div class="t-d1">48,920 impressions</div><span class="spec">ExtraBold 800 · 2.4rem · -.035em</span></div>
        <div class="type-row"><div class="t-d2">Overview</div><span class="spec">ExtraBold 800 · 1.8rem · -.03em · page title</span></div>
        <div class="type-row"><div class="t-h">Your notifications</div><span class="spec">Bold 700 · 1.3rem · -.02em</span></div>
        <div class="type-row"><div class="t-sub">Impressions &amp; clicks</div><span class="spec">Bold 700 · 1.08rem · card title</span></div>
        <div class="type-row"><div class="t-bd">Tacto shows real-time social proof — recent sales, live visitors and reviews — so new visitors trust you faster and convert.</div><span class="spec">Regular 400 · 1rem · 1.55</span></div>
        <div class="type-row"><div class="t-sm">Last 7 days · vs last week</div><span class="spec">Medium 500 · .875rem · muted</span></div>
        <div class="type-row"><div class="t-lbl">SOURCES</div><span class="spec">Bold 700 · 11.5px · +.04em · nav group</span></div>
        <div class="type-row"><div class="t-num">6.4%</div><span class="spec">ExtraBold 800 · tabular · stat value</span></div>
      </div>
      <div class="card" style="margin-top:16px">
        <p class="lbl">Weights in use</p>
        <div style="display:flex; gap:26px; flex-wrap:wrap; font-size:1.4rem; letter-spacing:-.02em">
          <span style="font-weight:400">400 Regular</span>
          <span style="font-weight:500">500 Medium</span>
          <span style="font-weight:600">600 SemiBold</span>
          <span style="font-weight:700">700 Bold</span>
          <span style="font-weight:800">800 ExtraBold</span>
        </div>
      </div>
    </div>
  </section>

  <!-- SPACING / RADIUS / ELEVATION -->
  <section>
    <div class="wrap">
      <div class="sec-head"><span class="no">03</span><div><h2>Spacing, radius &amp; elevation</h2><p>A 4-point spacing base keeps rhythm consistent. Radius grows with surface size. Shadows are cool-toned (blue-biased), never flat grey — used to lift cards gently, not to decorate.</p></div></div>

      <p class="lbl">Spacing scale — multiples of 4px</p>
      <div class="card">
        <div class="space-row">
          <div class="s"><div class="b" style="width:4px;height:4px"></div>4</div>
          <div class="s"><div class="b" style="width:8px;height:8px"></div>8</div>
          <div class="s"><div class="b" style="width:12px;height:12px"></div>12</div>
          <div class="s"><div class="b" style="width:16px;height:16px"></div>16</div>
          <div class="s"><div class="b" style="width:20px;height:20px"></div>20</div>
          <div class="s"><div class="b" style="width:24px;height:24px"></div>24</div>
          <div class="s"><div class="b" style="width:30px;height:30px"></div>30</div>
          <div class="s"><div class="b" style="width:48px;height:48px"></div>48</div>
        </div>
      </div>

      <div class="grid two" style="margin-top:16px">
        <div class="card">
          <p class="lbl">Radius</p>
          <div class="grid" style="grid-template-columns:repeat(4,1fr); gap:12px">
            <div class="radbox" style="border-radius:8px">8<br>pill-in</div>
            <div class="radbox" style="border-radius:11px">11<br>--sm</div>
            <div class="radbox" style="border-radius:14px">14<br>--md</div>
            <div class="radbox" style="border-radius:20px">20<br>card</div>
          </div>
          <p style="color:var(--muted); font-size:12.5px; margin:14px 0 0">Pills &amp; toggles use <code>999px</code>. Bigger the surface, bigger the radius.</p>
        </div>
        <div class="card">
          <p class="lbl">Elevation</p>
          <div class="grid trio">
            <div class="elev" style="box-shadow:var(--sh-xs)">xs</div>
            <div class="elev" style="box-shadow:var(--sh-sm)">sm · cards</div>
            <div class="elev" style="box-shadow:var(--sh-md)">md · popovers</div>
          </div>
        </div>
      </div>
    </div>

  </section>

  <!-- COMPONENTS -->
  <section>
    <div class="wrap">
      <div class="sec-head"><span class="no">04</span><div><h2>Components</h2><p>The core kit assembled from the tokens above. Every interactive element has a visible focus ring and a calm hover; motion is limited to what confirms an action.</p></div></div>

      <div class="grid two">
        <div class="card demo-col">
          <p class="lbl">Buttons</p>
          <div class="demo">
            <button class="btn primary">New notification</button>
            <button class="btn ghost">Cancel</button>
            <button class="btn primary sm">Save</button>
            <button class="btn ghost sm">Edit</button>
            <button class="btn danger sm">Delete</button>
          </div>
          <p style="color:var(--muted); font-size:12.5px; margin:0">Primary = Blue, one per view. Ghost for secondary. Labels say the action: “Save changes”, not “Submit”.</p>
        </div>

        <div class="card demo-col">
          <p class="lbl">Notification type pills</p>
          <div class="demo">
            <span class="pill sales">Sales pop</span>
            <span class="pill counter">Counter</span>
            <span class="pill visitors">Live visitors</span>
            <span class="pill review">Review</span>
            <span class="pill custom">Custom</span>
          </div>
          <p class="lbl" style="margin:8px 0 0">Deltas, counts &amp; toggle</p>
          <div class="demo">
            <span class="delta up">↑ 12.4%</span>
            <span class="delta down">↓ 0.3%</span>
            <span class="count">5</span>
            <label class="sw-toggle"><input type="checkbox" checked><span class="track"></span><span class="knob"></span></label>
            <label class="sw-toggle"><input type="checkbox"><span class="track"></span><span class="knob"></span></label>
          </div>
        </div>

        <div class="card demo-col">
          <p class="lbl">Inputs</p>
          <div class="field"><label>Notification name</label><input class="input" value="Recent purchases"></div>
          <div class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg><input placeholder="Search…"><kbd>⌘K</kbd></div>
        </div>

        <div class="card demo-col">
          <p class="lbl">Navigation item</p>
          <div class="navdemo">
            <div class="navitem active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>Overview</div>
            <div class="navitem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>Notifications <span class="count c">5</span></div>
            <div class="navitem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18"/><path d="M7 14l3-4 3 3 4-6"/></svg>Analytics</div>
          </div>
        </div>

        <div class="card demo-col">
          <p class="lbl">Stat tile</p>
          <div class="tile">
            <span class="lab"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></span>Impressions</span>
            <div class="val">48,920</div>
            <div class="foot"><span class="delta up">↑ 12.4%</span><span class="vs">vs last week</span></div>
          </div>
        </div>

        <div class="card demo-col">
          <p class="lbl">Avatars</p>
          <div class="demo">
            <span class="ava grad">ZD</span>
            <span class="ava buy">🛒</span>
            <span class="ava signup">✦</span>
            <span class="ava review">★</span>
          </div>
          <p class="lbl" style="margin:8px 0 0">Callout &amp; verified</p>
          <div class="demo">
            <span class="callout tnum">7,210 impressions</span>
            <span style="font-size:11px;color:var(--ok);font-weight:700;display:inline-flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>Verified by Tacto</span>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <p class="lbl">Table row</p>
        <div style="overflow-x:auto">
          <table class="tbl">
            <thead><tr><th>Notification</th><th>Type</th><th>Status</th><th style="text-align:right">Impr.</th><th style="text-align:right">CTR</th></tr></thead>
            <tbody>
              <tr>
                <td><span class="nname"><span class="tico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></span>Recent purchases</span></td>
                <td><span class="pill sales">Sales pop</span></td>
                <td><label class="sw-toggle"><input type="checkbox" checked><span class="track"></span><span class="knob"></span></label></td>
                <td style="text-align:right" class="tnum">21,430</td><td style="text-align:right" class="tnum">7.6%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <p class="lbl">Signature component — the live notification</p>
        <div class="livecard">
          <div class="ph">👟</div>
          <div>
            <div class="h"><b>Mike</b> from London just purchased</div>
            <div class="s">Nike Air Presto · 12 minutes ago</div>
            <div class="v"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>Verified by Tacto</div>
          </div>
        </div>
        <p style="color:var(--muted); font-size:12.5px; margin:14px 0 0">The one piece every visitor sees. Keep it to one fact, a timestamp, and the verified line. Only verified events (from a real webhook/integration) may show the ✓ badge.</p>
      </div>
    </div>

  </section>

  <!-- MOTION + A11Y -->
  <section>
    <div class="wrap">
      <div class="sec-head"><span class="no">05</span><div><h2>Motion &amp; accessibility</h2><p>Motion confirms, it doesn’t decorate. Accessibility is a floor, not a feature.</p></div></div>
      <div class="grid two">
        <div class="card">
          <h4 style="margin:0 0 10px; font-size:14px; font-weight:700">Motion</h4>
          <ul style="margin:0; padding-left:18px; display:flex; flex-direction:column; gap:8px; font-size:14px; color:var(--fg)">
            <li>One orchestrated entrance per page load (staggered 40–270ms), nothing on scroll.</li>
            <li>Hover &amp; state changes: 120–180ms ease.</li>
            <li>The live notification rises once (opacity + 10px).</li>
            <li>All motion disabled under <code>prefers-reduced-motion</code>.</li>
          </ul>
        </div>
        <div class="card">
          <h4 style="margin:0 0 10px; font-size:14px; font-weight:700">Accessibility</h4>
          <ul style="margin:0; padding-left:18px; display:flex; flex-direction:column; gap:8px; font-size:14px; color:var(--fg)">
            <li>Visible focus ring: 2px <code>--ring</code> + 2px offset.</li>
            <li>Body text ≥ AA contrast on its surface; never Cyan text on white.</li>
            <li>Status shown by label + color, never color alone.</li>
            <li>Full light &amp; dark parity from the same tokens.</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- VOICE -->
  <section style="border-bottom:0">
    <div class="wrap">
      <div class="sec-head"><span class="no">06</span><div><h2>Voice</h2><p>Plain, warm, and specific. Name things the way the user would, and keep an action’s name through the whole flow.</p></div></div>
      <div class="grid voice">
        <div class="card say">
          <h4>Do</h4>
          <ul>
            <li>“New notification” → toast “Notification published”.</li>
            <li>Say what it is: “Live visitors”, “Recent purchases”.</li>
            <li>Empty states invite action: “No events yet — install the pixel to start.”</li>
          </ul>
        </div>
        <div class="card dont">
          <h4>Don't</h4>
          <ul>
            <li>System terms in the UI (“configure webhook payload”).</li>
            <li>Vague errors — always say what failed and the fix.</li>
            <li>Changing a label mid-flow (“Submit” then “Saved”).</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap">
    <span class="brand" style="display:flex;align-items:center;gap:10px;font-weight:800"><svg viewBox="0 0 256 256" style="width:24px;height:24px;border-radius:7px"><use href="#tacto-tile"/></svg>Tacto Design System</span>
    <span>Blue #3B82F6 · Cyan #22D3EE · Ink #17181C · Paper #F4F5F7 · Plus Jakarta Sans</span>
  </div>
</footer>

<div class="toast" id="toast">Copied</div>

<script>
  (function(){
    var root=document.documentElement, btn=document.getElementById('themeBtn'), icon=document.getElementById('themeIcon'), lbl=document.getElementById('themeLbl');
    function apply(t){
      if(t==='light'||t==='dark'){root.setAttribute('data-theme',t);} else {root.removeAttribute('data-theme');}
      icon.textContent = t==='dark'?'●':(t==='light'?'○':'◑');
      lbl.textContent = t==='dark'?'Dark':(t==='light'?'Light':'System');
    }
    var saved='light'; try{saved=localStorage.getItem('tacto-theme')||'light';}catch(e){}
    apply(saved);
    btn.addEventListener('click',function(){
      var cur='light'; try{cur=localStorage.getItem('tacto-theme')||'light';}catch(e){}
      var next=cur==='light'?'dark':(cur==='dark'?'system':'light');
      try{localStorage.setItem('tacto-theme',next);}catch(e){}
      apply(next);
    });
  })();
  (function(){
    var toast=document.getElementById('toast'), t;
    document.getElementById('swatches').addEventListener('click',function(e){
      var chip=e.target.closest('.chip'); if(!chip)return;
      var hex=chip.getAttribute('data-hex');
      function ok(){toast.textContent=hex+' copied'; toast.classList.add('show'); clearTimeout(t); t=setTimeout(function(){toast.classList.remove('show')},1300);}
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(hex).then(ok).catch(ok);} else {ok();}
    });
  })();
</script>
</body>
</html>
