/* Dunkelkrieg — renderizador de cartas (SVG em milímetros, 63 × 88).
   Usado igual no gerador de PDFs e na Oficina de Cartas. */
(function (global) {
  const W = 63, H = 88;
  const ART = { x: 4.2, y: 13.2, w: 54.6, h: 33.2 };          // janela de arte (mm)
  const HERO_ART = { x: 4.2, y: 13.2, w: 54.6, h: 40.2 };
  const F_DISPLAY = "'TeX Gyre Pagella', 'Palatino Linotype', Palatino, Georgia, serif";
  const F_BODY = "Lora, Georgia, 'Times New Roman', serif";

  const CASAS = {
    Morvhal:   { campo: "#6e1c1a", acento: "#c4544b", acentoClaro: "#8e2a24", sigla: "MOR" },
    Hauksval:  { campo: "#454a52", acento: "#a6afb9", acentoClaro: "#4d5560", sigla: "HAU" },
    Valdoren:  { campo: "#22422a", acento: "#7fac79", acentoClaro: "#2f5a37", sigla: "VAL" },
    Durnheim:  { campo: "#1b1b1e", acento: "#c3c7cf", acentoClaro: "#3a3c42", sigla: "DUR", veio: "#b9bec7" },
    Aethelmar: { campo: "#1c2b4a", acento: "#7499cf", acentoClaro: "#2a4472", sigla: "AET" },
    "*":       { campo: "#1a1814", acento: "#c9a961", acentoClaro: "#8a6d2c", sigla: "FIC" },
  };
  const PALETAS = {
    escuro:   { fundo: "#15130f", painel: "#1c1914", tinta: "#ece4cf", suave: "#a89f87", ouro: "#c9a961", ouroFraco: "rgba(201,169,97,.38)", brasa: "#e08a5a", claro: false },
    economico:{ fundo: "#f6f1e6", painel: "#efe8d8", tinta: "#1d1a14", suave: "#5f5848", ouro: "#8a6d2c", ouroFraco: "rgba(138,109,44,.45)", brasa: "#a4471f", claro: true },
  };

  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const slug = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  function rng(seedStr) {
    let h = 2166136261; for (const ch of seedStr) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  }

  // ---------- medição de texto ----------
  let ctx = null;
  function measure(text, sizeMm, family, weight = "400", style = "normal") {
    if (!ctx) ctx = (typeof document !== "undefined" ? document.createElement("canvas") : null)?.getContext("2d");
    if (!ctx) return text.length * sizeMm * 0.5;
    ctx.font = `${style} ${weight} 100px ${family}`;
    return ctx.measureText(text).width / 100 * sizeMm;
  }
  function wrap(text, maxW, size, family, weight, style) {
    const out = [];
    for (const para of String(text).split("\n")) {
      let line = "";
      for (const w of para.split(/\s+/).filter(Boolean)) {
        const t = line ? line + " " + w : w;
        if (measure(t, size, family, weight, style) <= maxW || !line) line = t; else { out.push(line); line = w; }
      }
      out.push(line);
    }
    return out;
  }

  // ---------- brasões (sistema 100 × 120) ----------
  const ESCUDO = "M6 6 H94 V58 Q94 94 50 114 Q6 94 6 58 Z";
  function emblema(casa, cor, veio) {
    const g = `fill="${cor}"`, s = `stroke="${cor}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
    switch (casa) {
      case "Morvhal": return `
        <circle ${g} cx="68" cy="27" r="13"/><circle fill="CAMPO" cx="74" cy="22" r="11.5"/>
        <path ${g} d="M30 104 L33 88 Q27 80 30 70 Q33 58 42 50 L40 38 L47 44 L49 34 L55 43 Q64 44 70 52 L78 64 Q80 70 74 71 L68 69 Q63 67 60 70 Q59 76 62 82 Q66 92 64 104 Z"/>
        <circle fill="CAMPO" cx="58" cy="51" r="2"/>`;
      case "Hauksval": return `
        <path ${s} stroke-width="3.2" d="M22 100 L78 30 M78 100 L22 30"/>
        <path ${g} d="M78 30 l-9 2 l7 7 Z M22 30 l9 2 l-7 7 Z"/>
        <path ${g} d="M50 70 L14 44 L24 58 L10 58 L28 70 L18 76 L40 76 L50 86 L60 76 L82 76 L72 70 L90 58 L76 58 L86 44 Z"/>
        <circle ${g} cx="50" cy="60" r="7"/><path ${g} d="M50 52 L54 47 L57 52 Z"/>`;
      case "Valdoren": return `
        <path ${g} d="M24 46 A26 26 0 0 1 76 46 Z"/>
        <path ${s} stroke-width="2.2" d="M50 14 V8 M30 20 L26 15 M70 20 L74 15 M18 34 L12 31 M82 34 L88 31"/>
        <path ${s} stroke-width="2.6" d="M50 104 L50 56 M50 104 L38 60 M50 104 L62 60 M50 104 L28 66 M50 104 L72 66"/>
        ${[[50, 54], [38, 58], [62, 58], [28, 64], [72, 64]].map(([x, y]) => `<ellipse ${g} cx="${x}" cy="${y}" rx="3.2" ry="6"/>`).join("")}
        <path ${s} stroke-width="3" d="M40 88 H60"/>`;
      case "Durnheim": return `
        <path ${g} d="M12 104 L50 44 L88 104 Z"/>
        <path stroke="${veio || "#b9bec7"}" stroke-width="2.6" fill="none" stroke-linejoin="round" d="M50 46 L45 62 L55 72 L46 86 L53 104"/>
        <rect ${g} x="47" y="14" width="6" height="30" rx="1"/>
        <rect ${g} x="34" y="10" width="32" height="11" rx="1.5"/>`;
      case "Aethelmar": return `
        <path ${g} d="M38 22 L40 10 L45 17 L50 8 L55 17 L60 10 L62 22 Z"/>
        <circle ${s} stroke-width="3" cx="50" cy="30" r="5"/>
        <path ${s} stroke-width="4" d="M50 35 V86 M38 44 H62 M28 70 Q32 90 50 88 Q68 90 72 70"/>
        <path ${g} d="M28 70 l-5 4 l7 1 Z M72 70 l5 4 l-7 1 Z"/>
        <path ${s} stroke-width="3.4" d="M14 98 Q23 90 32 98 T50 98 T68 98 T86 98"/>`;
      default: return `<circle ${g} cx="46" cy="52" r="24"/><circle fill="CAMPO" cx="58" cy="44" r="21"/>`;
    }
  }
  function brasao(casa, x, y, w, pal, id) {
    const c = CASAS[casa] || CASAS["*"];
    const h = w * 1.2;
    return `<g transform="translate(${x} ${y}) scale(${w / 100})">
      <path d="${ESCUDO}" fill="${c.campo}" stroke="${pal.ouro}" stroke-width="3"/>
      <path d="M12 12 H88 V57 Q88 89 50 107 Q12 89 12 57 Z" fill="none" stroke="${pal.ouro}" stroke-opacity=".45" stroke-width="1.2"/>
      ${emblema(casa, pal.claro ? "#e8d6a4" : "#d9b867", c.veio).replace(/CAMPO/g, c.campo)}
    </g>`;
  }

  // ---------- arte ornamental (placeholder) ----------
  function arteOrnamental(card, box, pal, id) {
    const casa = card.casa, r = rng(card.nome + casa), c = CASAS[casa] || CASAS["*"];
    const { x, y, w, h } = box, L = pal.claro;
    const linha = L ? c.acentoClaro : c.acento;
    const bgA = L ? "#ece5d4" : "#0e0d0b", bgB = L ? "#e2d9c4" : c.campo;
    let o = `<defs><linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/></linearGradient></defs>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#g${id})"/>`;
    const sw = 0.28, op = L ? 0.75 : 0.85;
    const stars = n => Array.from({ length: n }, () => `<circle cx="${(x + r() * w).toFixed(2)}" cy="${(y + r() * h * 0.55).toFixed(2)}" r="${(0.12 + r() * 0.22).toFixed(2)}" fill="${L ? linha : "#e9dfc6"}" opacity="${(0.3 + r() * 0.6).toFixed(2)}"/>`).join("");
    if (casa === "Morvhal") {
      const mx = x + w * (0.62 + r() * 0.2), my = y + h * 0.33, mr = h * 0.2;
      o += stars(26);
      o += `<mask id="m${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/><circle cx="${mx + mr * 0.45}" cy="${my - mr * 0.25}" r="${mr * 0.85}" fill="#000"/></mask>`;
      o += `<circle cx="${mx}" cy="${my}" r="${mr}" mask="url(#m${id})" fill="${L ? "none" : "#e8dcc0"}" stroke="${linha}" stroke-width="${L ? sw * 1.5 : 0}" opacity="${L ? 1 : 0.92}"/>`;
      let p = `M${x} ${y + h}`; for (let i = 0; i <= 8; i++) p += ` L${x + w * i / 8} ${y + h * (0.72 + r() * 0.14)}`;
      o += `<path d="${p} L${x + w} ${y + h} Z" fill="${L ? "none" : "#0b0606"}" stroke="${linha}" stroke-width="${sw}" opacity="${op}"/>`;
      for (let i = 0; i < 5; i++) { const bx = x + w * (0.1 + r() * 0.8); o += `<path d="M${bx} ${y + h} V${y + h * (0.55 + r() * 0.15)}" stroke="${linha}" stroke-width="${sw * 1.4}" opacity=".7"/><path d="M${bx - 1} ${y + h * 0.6} L${bx} ${y + h * 0.52} L${bx + 1} ${y + h * 0.6}" fill="${linha}" opacity=".7"/>`; }
    } else if (casa === "Hauksval") {
      for (let i = 0; i < 9; i++) { const tx = x + w * (i / 9 + r() * 0.06), tw = 0.8 + r() * 2.2; o += `<rect x="${tx}" y="${y}" width="${tw}" height="${h}" fill="${L ? "none" : "#1a1c20"}" stroke="${linha}" stroke-width="${L ? sw : 0}" opacity="${0.55 + r() * 0.4}"/>`; }
      for (let i = 0; i < 3; i++) { const sy = y + h * (0.2 + r() * 0.6); o += `<path d="M${x + 2} ${sy + 6} L${x + w - 2} ${sy - 6}" stroke="${L ? linha : "#d9b867"}" stroke-width="${sw}" opacity=".8"/><path d="M${x + w - 2} ${sy - 6} l-2.2 0.2 l1.3 1.6 Z" fill="${L ? linha : "#d9b867"}" opacity=".8"/>`; }
    } else if (casa === "Valdoren") {
      const sx = x + w * (0.35 + r() * 0.3), hy = y + h * 0.62, sr = h * 0.28;
      o += `<path d="M${sx - sr} ${hy} A${sr} ${sr} 0 0 1 ${sx + sr} ${hy} Z" fill="${L ? "none" : "#d9b867"}" stroke="${linha}" stroke-width="${L ? sw * 1.5 : 0}" opacity="${L ? 1 : 0.85}"/>`;
      for (let i = 0; i < 11; i++) { const a = Math.PI * (i + 0.5) / 11; o += `<path d="M${sx + Math.cos(a) * sr * 1.15} ${hy - Math.sin(a) * sr * 1.15} L${sx + Math.cos(a) * sr * 1.6} ${hy - Math.sin(a) * sr * 1.6}" stroke="${L ? linha : "#d9b867"}" stroke-width="${sw}" opacity=".7"/>`; }
      o += `<rect x="${x}" y="${hy}" width="${w}" height="${y + h - hy}" fill="${L ? "none" : "#14261a"}"/><path d="M${x} ${hy} H${x + w}" stroke="${linha}" stroke-width="${sw}"/>`;
      for (let i = 0; i < 30; i++) { const wx = x + r() * w, wh = 3 + r() * 5; o += `<path d="M${wx} ${y + h} L${wx + (r() - .5) * 2} ${y + h - wh}" stroke="${L ? linha : "#b89a52"}" stroke-width="${sw}" opacity=".75"/>`; }
    } else if (casa === "Durnheim") {
      o += stars(10);
      for (let k = 0; k < 3; k++) {
        let p = `M${x} ${y + h}`; const base = 0.35 + k * 0.17;
        for (let i = 0; i <= 6; i++) p += ` L${x + w * i / 6} ${y + h * (base + (i % 2 ? -0.12 : 0.1) * (1 + r()))}`;
        o += `<path d="${p} L${x + w} ${y + h} Z" fill="${L ? "none" : ["#26272b", "#1d1e21", "#131315"][k]}" stroke="${linha}" stroke-width="${sw}" opacity="${L ? 0.8 : 1}"/>`;
      }
      const cx = x + w * (0.4 + r() * 0.2);
      o += `<path d="M${cx} ${y + h * 0.3} L${cx - 1.5} ${y + h * 0.5} L${cx + 1.2} ${y + h * 0.64} L${cx - 0.8} ${y + h * 0.86}" stroke="${L ? linha : c.veio}" stroke-width="${sw * 1.6}" fill="none"/>`;
    } else if (casa === "Aethelmar") {
      o += stars(18);
      const mx = x + w * (0.2 + r() * 0.6);
      o += `<circle cx="${mx}" cy="${y + h * 0.28}" r="${h * 0.11}" fill="${L ? "none" : "#e8dcc0"}" stroke="${linha}" stroke-width="${L ? sw * 1.5 : 0}" opacity=".85"/>`;
      for (let k = 0; k < 6; k++) {
        const wy = y + h * (0.5 + k * 0.09), amp = 0.8 + r() * 0.8, per = 6 + r() * 4;
        let p = `M${x} ${wy}`; for (let t = 0; t <= w; t += per / 2) p += ` Q${x + t + per / 4} ${wy + (((t / (per / 2)) % 2) ? amp : -amp)} ${x + t + per / 2} ${wy}`;
        o += `<path d="${p}" stroke="${L ? linha : "#8fb0dc"}" stroke-width="${sw}" fill="none" opacity="${0.35 + k * 0.1}"/>`;
      }
    } else {
      o += stars(24);
      const mx = x + w * 0.62, my = y + h * 0.42, mr = h * 0.24;
      o += `<mask id="m${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/><circle cx="${mx + mr * 0.45}" cy="${my - mr * 0.25}" r="${mr * 0.85}" fill="#000"/></mask>`;
      o += `<circle cx="${mx}" cy="${my}" r="${mr}" mask="url(#m${id})" fill="${L ? "none" : "#e8dcc0"}" stroke="${linha}" stroke-width="${L ? sw * 1.5 : 0}"/>`;
      o += `<path d="M${x} ${y + h * 0.86} Q${x + w / 2} ${y + h * 0.78} ${x + w} ${y + h * 0.86} V${y + h} H${x} Z" fill="${L ? "none" : "#0a0908"}" stroke="${linha}" stroke-width="${sw}"/>`;
    }
    return o;
  }

  function arteImagem(art, box, id) {
    // art: { url, zoom, dx, dy, w, h } — cobre a janela; dx/dy em fração do excedente (-1..1)
    const { x, y, w, h } = box;
    const iw = art.w || w, ih = art.h || h;
    const cover = Math.max(w / iw, h / ih) * (art.zoom || 1);
    const dw = iw * cover, dh = ih * cover;
    const ox = x + (w - dw) / 2 + (art.dx || 0) * (dw - w) / 2;
    const oy = y + (h - dh) / 2 + (art.dy || 0) * (dh - h) / 2;
    return `<image href="${esc(art.url)}" x="${ox.toFixed(3)}" y="${oy.toFixed(3)}" width="${dw.toFixed(3)}" height="${dh.toFixed(3)}" preserveAspectRatio="none"/>`;
  }

  // ---------- partes ----------
  function texto(lines, x, y0, lh, attrs) {
    return `<text ${attrs}>${lines.map((l, i) => `<tspan x="${x}" y="${(y0 + i * lh).toFixed(2)}">${esc(l)}</tspan>`).join("")}</text>`;
  }
  function nomeAjustado(nome, maxW, base) {
    let s = base;
    while (s > 2.4 && measure(nome, s, F_DISPLAY, "700") > maxW) s -= 0.1;
    return s;
  }

  function corpo(card, pal, c, top, bottom) {
    // texto de regras + brasa + sabor, com redução de corpo se não couber
    const x0 = 6.4, maxW = 50.2;
    for (const k of [1, 0.93, 0.86, 0.8, 0.74]) {
      const S = 2.55 * k, LH = S * 1.28, SS = 2.2 * k, SLH = SS * 1.28;
      let y = top + S;
      let out = "";
      const regras = card.texto ? wrap(card.texto, maxW, S, F_BODY, "400") : [];
      if (regras.length) { out += texto(regras, x0, y, LH, `font-family="${F_BODY}" font-size="${S.toFixed(2)}" fill="${pal.tinta}"`); y += regras.length * LH; }
      if (card.brasa_txt) {
        y += LH * 0.25;
        out += `<path d="M${x0} ${(y - S * 0.6).toFixed(2)} H${x0 + maxW}" stroke="${pal.ouroFraco}" stroke-width=".15"/>`;
        y += LH * 0.35;
        const lab = "BRASA · ";
        const lw = measure(lab, S * 0.82, F_DISPLAY, "700");
        const txt = "Se você sacrificar um lacaio seu ao lançar: " + card.brasa_txt.charAt(0).toLowerCase() + card.brasa_txt.slice(1);
        const linhas = wrap(txt, maxW, S, F_BODY, "400");
        // primeira linha recuada para o rótulo
        const first = wrap(txt, maxW - lw, S, F_BODY, "400");
        const firstLine = first[0];
        const rest = wrap(txt.slice(firstLine.length).trim(), maxW, S, F_BODY, "400").filter(Boolean);
        out += `<text font-family="${F_DISPLAY}" font-weight="700" font-size="${(S * 0.82).toFixed(2)}" letter-spacing=".25" fill="${pal.brasa}" x="${x0}" y="${y.toFixed(2)}">${lab}</text>`;
        out += texto([firstLine], x0 + lw, y, LH, `font-family="${F_BODY}" font-size="${S.toFixed(2)}" fill="${pal.tinta}"`);
        if (rest.length) out += texto(rest, x0, y + LH, LH, `font-family="${F_BODY}" font-size="${S.toFixed(2)}" fill="${pal.tinta}"`);
        y += (1 + rest.length) * LH;
        void linhas;
      }
      let saborH = 0, sab = [];
      if (card.sabor) { sab = wrap(card.sabor, maxW, SS, F_BODY, "400", "italic"); saborH = sab.length * SLH + SLH * 0.5; }
      const disponivel = bottom - (y - S);
      if (y - S * 0.2 + saborH <= bottom || k === 0.74) {
        if (sab.length && y - S * 0.2 + saborH <= bottom) {
          const sy = bottom - sab.length * SLH + SS * 0.75;
          out += texto(sab, x0, sy, SLH, `font-family="${F_BODY}" font-style="italic" font-size="${SS.toFixed(2)}" fill="${pal.suave}"`);
        }
        void disponivel;
        return out;
      }
    }
    return "";
  }

  function linhaTipo(label, destaque, y, pal, c) {
    const S = 2.05;
    const full = destaque ? `${label} · ${destaque}` : label;
    const tw = measure(full, S, F_DISPLAY, "700") + full.length * 0.32;
    const cx = W / 2, x1 = cx - tw / 2 - 1.6, x2 = cx + tw / 2 + 1.6;
    const cor = pal.claro ? c.acentoClaro : c.acento;
    return `<path d="M6.4 ${y - 0.7} H${x1.toFixed(2)} M${x2.toFixed(2)} ${y - 0.7} H56.6" stroke="${pal.ouroFraco}" stroke-width=".18"/>
      <path d="M6.4 ${y - 1.25} l.55 .55 l-.55 .55 l-.55 -.55 Z M56.6 ${y - 1.25} l.55 .55 l-.55 .55 l-.55 -.55 Z" fill="${pal.ouro}"/>
      <text x="${cx}" y="${y}" text-anchor="middle" font-family="${F_DISPLAY}" font-weight="700" font-size="${S}" letter-spacing=".32" fill="${pal.suave}">${esc(label)}${destaque ? ` · <tspan fill="${cor}">${esc(destaque)}</tspan>` : ""}</text>`;
  }

  function moldura(pal, lendaria) {
    let o = `<rect x="0" y="0" width="${W}" height="${H}" rx="2.6" fill="${pal.fundo}"/>
      <rect x="1.6" y="1.6" width="${W - 3.2}" height="${H - 3.2}" rx="1.6" fill="none" stroke="${pal.ouro}" stroke-width="${lendaria ? 0.55 : 0.28}"/>
      <rect x="2.6" y="2.6" width="${W - 5.2}" height="${H - 5.2}" rx="1" fill="none" stroke="${pal.ouroFraco}" stroke-width=".15"/>`;
    if (lendaria) {
      for (const [x, y] of [[1.6, 1.6], [W - 1.6, 1.6], [1.6, H - 1.6], [W - 1.6, H - 1.6]])
        o += `<path d="M${x} ${y - 1.6} L${x + 1.6} ${y} L${x} ${y + 1.6} L${x - 1.6} ${y} Z" fill="${pal.ouro}"/>`;
      o += `<rect x="3.3" y="3.3" width="${W - 6.6}" height="${H - 6.6}" rx=".8" fill="none" stroke="${pal.ouro}" stroke-opacity=".55" stroke-width=".12"/>`;
    }
    return o;
  }

  function circulo(cx, cy, r, valor, pal, fill) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill || pal.fundo}" stroke="${pal.ouro}" stroke-width=".35"/>
      <circle cx="${cx}" cy="${cy}" r="${r - 0.6}" fill="none" stroke="${pal.ouroFraco}" stroke-width=".12"/>
      <text x="${cx}" y="${cy + r * 0.42}" text-anchor="middle" font-family="${F_DISPLAY}" font-weight="700" font-size="${(r * 1.25).toFixed(2)}" fill="${pal.ouro}">${esc(valor)}</text>`;
  }
  function escudoVida(cx, cy, valor, pal, c) {
    const s = 0.085;
    return `<g transform="translate(${cx - 50 * s} ${cy - 60 * s}) scale(${s})"><path d="${ESCUDO}" fill="${pal.claro ? c.acentoClaro : c.campo}" stroke="${pal.ouro}" stroke-width="4"/></g>
      <text x="${cx}" y="${cy + 1.7}" text-anchor="middle" font-family="${F_DISPLAY}" font-weight="700" font-size="5" fill="${pal.claro ? "#f6f1e6" : "#ece4cf"}">${esc(valor)}</text>`;
  }

  // ---------- carta ----------
  function renderCard(card, opts = {}) {
    const pal = PALETAS[opts.paleta || "escuro"];
    const c = CASAS[card.casa] || CASAS["*"];
    const id = (opts.id || slug(card.casa + "-" + card.nome)).replace(/[^a-z0-9-]/g, "");
    const lend = card.especial === "Lendária";
    const heroi = card.tipo === "Herói";
    const box = heroi ? HERO_ART : ART;
    let o = moldura(pal, lend);
    // cabeçalho
    const temCusto = card.custo !== undefined && card.custo !== null && !heroi;
    if (temCusto) o += circulo(8.3, 8.4, 4.0, card.custo, pal);
    const nx = temCusto ? 13.6 : 6.4, nmax = 53.4 - nx;
    const ns = nomeAjustado(card.nome, nmax, 3.9);
    o += `<text x="${nx}" y="9.85" font-family="${F_DISPLAY}" font-weight="700" font-size="${ns.toFixed(2)}" fill="${pal.tinta}">${esc(card.nome)}</text>`;
    o += brasao(card.casa, 54.3, 4.4, 5.4, pal, id);
    // arte
    o += `<clipPath id="a${id}"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"/></clipPath>`;
    o += `<g id="arte" clip-path="url(#a${id})">${opts.arte ? arteImagem(opts.arte, box, id) : arteOrnamental(card, box, pal, id)}</g>`;
    o += `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="none" stroke="${pal.ouro}" stroke-width=".28"/>`;
    // tipo
    const yTipo = box.y + box.h + 3.2;
    if (heroi) {
      o += linhaTipo("HERÓI", (card.heroi_titulo || "").toUpperCase(), yTipo, pal, c);
      // decreto
      const top = yTipo + 2.4;
      o += `<rect x="5.6" y="${top}" width="51.8" height="${77.2 - top}" rx=".8" fill="${pal.painel}" stroke="${pal.ouroFraco}" stroke-width=".15"/>`;
      o += circulo(9.6, top + 4.1, 2.6, 2, pal, pal.painel);
      o += `<text x="13.4" y="${top + 3.3}" font-family="${F_DISPLAY}" font-weight="700" font-size="1.7" letter-spacing=".3" fill="${pal.suave}">DECRETO · UMA VEZ POR TURNO</text>`;
      o += `<text x="13.4" y="${top + 6.2}" font-family="${F_DISPLAY}" font-weight="700" font-size="2.9" fill="${pal.tinta}">${esc(card.decreto)}</text>`;
      const dl = wrap(card.decreto_txt, 48, 2.5, F_BODY, "400");
      o += texto(dl, 7.4, top + 10.2, 3.2, `font-family="${F_BODY}" font-size="2.5" fill="${pal.tinta}"`);
      o += `<text x="31.5" y="${77.2 - 1.6}" text-anchor="middle" font-family="${F_BODY}" font-style="italic" font-size="2.1" fill="${pal.suave}">“${esc(card.lema)}”</text>`;
      o += escudoVida(54.6, 81.9, 20, pal, c);
      o += `<text x="31.5" y="82.6" text-anchor="middle" font-family="${F_DISPLAY}" font-weight="700" font-size="1.75" letter-spacing=".45" fill="${pal.suave}">${esc(card.casa.toUpperCase())}</text>
      <text x="31.5" y="85.0" text-anchor="middle" font-family="${F_DISPLAY}" font-size="1.45" letter-spacing=".35" fill="${pal.suave}">${esc((card.titulo_casa || "").toUpperCase())}</text>`;
      return wrapSvg(o, opts);
    }
    const tipoLabel = card.ficha ? `FICHA · ${card.tipo.toUpperCase()}` : card.tipo.toUpperCase();
    o += linhaTipo(tipoLabel, (card.kws || []).join(" · ").toUpperCase(), yTipo, pal, c);
    o += corpo(card, pal, c, yTipo + 2.1, 77.4);
    // rodapé
    if (card.tipo === "Lacaio") {
      o += circulo(8.6, 81.7, 4.0, card.atk, pal);
      o += escudoVida(54.4, 81.9, card.vida, pal, c);
    }
    const rod = lend ? "✦ LENDÁRIA ✦" : card.ficha ? "FICHA" : `${c.sigla} ${String(card.num || "").padStart(2, "0")}`;
    o += `<text x="31.5" y="82.6" text-anchor="middle" font-family="${F_DISPLAY}" font-weight="700" font-size="1.75" letter-spacing=".45" fill="${lend ? pal.ouro : pal.suave}">${esc(card.casa === "*" ? "DUNKELKRIEG" : card.casa.toUpperCase())}</text>
      <text x="31.5" y="85.0" text-anchor="middle" font-family="${F_DISPLAY}" font-size="1.45" letter-spacing=".35" fill="${lend ? pal.ouro : pal.suave}">${esc(rod)}${card.versao ? " · " + esc(card.versao) : ""}</text>`;
    return wrapSvg(o, opts);
  }

  function renderVerso(casa, opts = {}) {
    const pal = PALETAS[opts.paleta || "escuro"];
    const c = CASAS[casa] || CASAS["*"];
    const L = pal.claro;
    const campo = L ? "#f6f1e6" : c.campo;
    let o = `<rect width="${W}" height="${H}" rx="2.6" fill="${L ? "#f6f1e6" : "#0f0e0c"}"/>
      <rect x="2.2" y="2.2" width="${W - 4.4}" height="${H - 4.4}" rx="1.4" fill="${campo}" stroke="${pal.ouro}" stroke-width=".4"/>
      <rect x="3.6" y="3.6" width="${W - 7.2}" height="${H - 7.2}" rx=".9" fill="none" stroke="${pal.ouro}" stroke-opacity=".5" stroke-width=".15"/>`;
    // padrão de losangos
    for (let yy = 8; yy < H - 6; yy += 6) for (let xx = 8 + ((yy / 6) % 2) * 3; xx < W - 6; xx += 6)
      o += `<path d="M${xx} ${yy - 0.5} l.5 .5 l-.5 .5 l-.5 -.5 Z" fill="${pal.ouro}" opacity="${L ? 0.35 : 0.22}"/>`;
    o += `<circle cx="${W / 2}" cy="40" r="17" fill="${L ? "#f6f1e6" : "#0f0e0c"}" stroke="${pal.ouro}" stroke-width=".35"/>
      <circle cx="${W / 2}" cy="40" r="15.8" fill="none" stroke="${pal.ouro}" stroke-opacity=".5" stroke-width=".15"/>`;
    o += brasao(casa === "*" ? "*" : casa, W / 2 - 10.5, 27.6, 21, pal, "v" + slug(casa));
    o += `<text x="${W / 2}" y="69" text-anchor="middle" font-family="${F_DISPLAY}" font-weight="700" font-size="4.6" letter-spacing="1.1" fill="${pal.ouro}">DUNKELKRIEG</text>
      <path d="M17 72.2 H46" stroke="${pal.ouro}" stroke-opacity=".6" stroke-width=".15"/>
      <text x="${W / 2}" y="76" text-anchor="middle" font-family="${F_DISPLAY}" font-weight="700" font-size="2.1" letter-spacing=".7" fill="${pal.ouro}" opacity=".85">${esc(casa === "*" ? "FICHAS" : casa.toUpperCase())}</text>`;
    return wrapSvg(o, opts);
  }

  function wrapSvg(inner, opts) {
    if (opts.raw) return inner;
    const sz = opts.size ? `width="${opts.size[0]}"` + (opts.size[1] && opts.size[1] !== "auto" ? ` height="${opts.size[1]}"` : "") : `width="${W}mm" height="${H}mm"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" ${sz}>${opts.fontCss ? `<style>${opts.fontCss}</style>` : ""}${inner}</svg>`;
  }

  global.DK = { renderCard, renderVerso, slug, CASAS, PALETAS, ART, HERO_ART, W, H, brasao, emblema, ESCUDO };
})(typeof window !== "undefined" ? window : globalThis);
