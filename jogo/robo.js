/* Dunkelkrieg — robô adversário.
   Mesma inteligência do simulador das rodadas de equilíbrio: avalia cada jogada possível com uma nota,
   escolhe o melhor conjunto que cabe na Devoção do turno e depois decide os ataques (troca ou rosto). */
(function (g) {
  "use strict";
  const M = g.DKJ.Motor, C = M.C, viv = M.vivos;
  const AGGRO = { Morvhal: 2.0, Aethelmar: 1.0, Hauksval: 0.5, Valdoren: -0.5, Durnheim: -0.5 };
  const ENGINE = { [C.VESNA]: 4, [C.LAMPADA]: 6, [C.HAGEN]: 5, [C.POCO]: 4, [C.CAPITA]: 3, [C.CATAPULTA]: 4, [C.PORTADORA]: 3, [C.OUVINTE]: 1, [C.PEREGRINO]: 1 };
  const FODDER = new Set(["fichas-vazio", C.ANDARILHO]);
  const op = (G, p) => G.p[1 - p.i];
  const agg = p => AGGRO[p.casa] ?? 0;
  const maxBy = (a, f) => a.reduce((x, y) => f(y) > f(x) ? y : x);
  const minBy = (a, f) => a.reduce((x, y) => f(y) < f(x) ? y : x);

  function mval(G, m) {
    return M.ataque(G, m) + m.hp + (ENGINE[m.c.id] || 0) + (M.temKw(G, m, "Provocar") ? 1 : 0) + (m.kws.includes("Fogo Negro") ? 2 : 0)
      + (m.kws.includes("Distância") ? 1.5 : 0) + (M.temKw(G, m, "Couraça") ? 1.5 : 0);
  }
  const effHp = p => p.hp + p.armadura;
  const killNeeded = (G, m, n, comb) => n - (comb && M.temKw(G, m, "Couraça") ? 1 : 0) >= m.hp;
  function bestKill(G, E, n, excl = []) {
    let best = null, bv = 0;
    for (const m of E) { if (excl.includes(m)) continue; const v = killNeeded(G, m, n) ? mval(G, m) : 0.4 * Math.min(n, m.hp); if (v > bv) { best = m; bv = v; } }
    return [best, bv];
  }
  function aoeValue(G, p, n, both) {
    let v = 0;
    for (const m of viv(op(G, p).mesa)) v += killNeeded(G, m, n) ? mval(G, m) : 0.4 * n;
    if (both) for (const m of viv(p.mesa)) v -= killNeeded(G, m, n) ? mval(G, m) : 0.3 * n;
    return v;
  }
  function faceValue(G, p, n) { const o = op(G, p); if (effHp(o) <= n) return 1000; return n * (effHp(o) <= 10 ? 1.3 : 0.8) * (1 + Math.max(0, agg(p)) * 0.25); }
  function healValue(G, p, n) { const act = Math.min(n, 20 - p.hp); if (act <= 0) return 0; return act * (p.hp <= 10 ? 0.9 : 0.45) + viv(p.mesa).filter(m => m.c.id === C.PEREGRINO).length; }
  function fodder(G, p) {
    let c = viv(p.mesa).filter(m => FODDER.has(m.c.id));
    if (!c.length) c = viv(p.mesa).filter(m => mval(G, m) <= 3 && !ENGINE[m.c.id]);
    return c.length ? minBy(c, m => mval(G, m)) : null;
  }
  const sacBonus = (G, p) => viv(p.mesa).reduce((s, x) => s + (x.c.id === C.VESNA ? 2 : 0) + (x.c.id === C.OUVINTE ? 1.5 : 0), 0);
  const bounceV = m => mval0(m) * (m.ficha ? 1 : 0.55) + (+m.c.custo || 0) * 0.4;
  let G0 = null; const mval0 = m => mval(G0, m);

  // ---------- opções de cada carta: [{ v, custo, exec, needHp }] ----------
  function opcoes(G, p, h) {
    G0 = G;
    const c = h.c, id = c.id, o = op(G, p), E = viv(o.mesa), R = [];
    const jog = esc => () => M.jogarCarta(G, p.i, h.uid, esc);
    const add = (v, exec, custo = +c.custo || 0, needHp = false) => { if (v > 0) R.push({ v, exec, custo, needHp }); };
    if (c.tipo === "Lacaio") {
      if (viv(p.mesa).length >= M.R.MESA) return R;
      const base = (+c.atk || 0) + (+c.vida || 0) + (ENGINE[id] || 0) + 0.5 * (c.kws || []).length;
      let bc = 0, esc = {};
      const dmgBc = { [C.PATRULHEIRO]: 1, [C.CACADOR_OUV]: 2, [C.OLHO]: 2, [C.CACADOR_CONTRA]: 1 }[id];
      if (id === C.CORO && E.length) { const t = maxBy(E, m => M.ataque(G, m)); bc = Math.min(2, M.ataque(G, t)) * 0.8; esc.alvos = [t.uid]; }
      else if (dmgBc) { const [t, v] = bestKill(G, E, dmgBc); bc = v; if (t) esc.alvos = [t.uid]; }
      else if (id === C.YSRA && E.length) { const mx = Math.max(...E.map(m => M.ataque(G, m))); const t = maxBy(E.filter(m => M.ataque(G, m) === mx), m => mval(G, m)); bc = mval(G, t); esc.alvos = [t.uid]; }
      else if (id === C.DRAVEK) {
        const outros = viv(p.mesa), k = outros.length, sim = new Map(E.map(m => [m, m.hp])); let gain = 0;
        for (let j = 0; j < k; j++) {
          const alive = E.filter(m => sim.get(m) > 0); if (!alive.length) break;
          const need = m => M.temKw(G, m, "Couraça") ? 1 : 2;
          const t = maxBy(alive, m => need(m) >= sim.get(m) ? mval(G, m) : mval(G, m) / (sim.get(m) / need(m) + 1));
          sim.set(t, sim.get(t) - need(t)); if (sim.get(t) <= 0) gain += mval(G, t);
        }
        bc = gain - outros.reduce((s, m) => s + mval(G, m), 0);
      }
      else if (id === C.CAMPONESA) bc = healValue(G, p, 2);
      else if (id === C.CLERIGO) { bc = healValue(G, p, 3); esc.alvos = ["h" + p.i]; }
      else if (id === C.DEFENSOR) bc = healValue(G, p, 4);
      else if (id === C.CAMPEAO) bc = healValue(G, p, 5);
      else if (id === C.FERREIRO || id === C.SARGENTO) bc = 1.5;
      else if (id === C.DESERTOR) bc = -2;
      else if (id === C.NOBRE) bc = -1.5;
      else if (id === C.FORJADOR) { const own = viv(p.mesa).filter(m => M.ataque(G, m) > 0 || m.hp > 2); if (own.length) { const t = maxBy(own, m => (m.enjoo ? 0 : 100) + m.hp); bc = 1.6; esc.alvos = [t.uid]; } }
      else if (id === C.PESCADOR) bc = 0.5;
      else if ((c.kws || []).includes("Maré")) bc = 3;
      else if (id === C.CORSARIO) { const cs = E.filter(m => (+m.c.custo || 0) <= 2); if (cs.length) { const t = maxBy(cs, m => mval(G, m)); bc = mval(G, t) * (t.ficha ? 1 : 0.6); esc.alvos = [t.uid]; } }
      else if (id === C.PALADINA) {
        bc = E.reduce((s, m) => s + mval(G, m) * (m.ficha ? 1 : 0.55), 0) - viv(p.mesa).reduce((s, m) => s + mval(G, m) * (m.ficha ? 1 : 0.6) - (m.kws.includes("Maré") ? 3 : 0), 0);
        if (bc > 2) add(base + bc, jog({}));
        return R;
      }
      add(base + bc, jog(esc)); return R;
    }

    // ---------- magias ----------
    const custo = +c.custo || 0;
    if (M.EF[id] && M.EF[id].brasa) {
      for (const [v, esc, br] of morvhal(G, p, h)) {
        if (!br) { add(v, jog(esc)); continue; }
        const fd = fodder(G, p), bonus = sacBonus(G, p);
        if (fd) add(v - (FODDER.has(fd.c.id) ? 0.5 : mval(G, fd)) + bonus, jog({ ...esc, sac: fd.uid }));
        else if (!p.decretoUsado && p.casa === "Morvhal" && viv(p.mesa).length < M.R.MESA && p.aux > 0) {
          add(v - 0.5 + bonus - 2.5, async () => {
            if (!await M.usarDecreto(G, p.i, {})) return false;
            const vz = [...p.mesa].reverse().find(m => m.ficha && m.hp > 0);
            return M.jogarCarta(G, p.i, h.uid, { ...esc, sac: vz ? vz.uid : null });
          }, custo + 2, true);
        }
      }
      return R;
    }
    const dmg = { [C.FLECHA_LUZ]: 2, [C.ABORDAGEM]: 2, [C.TIRO]: 3, [C.MARTELO]: 3, [C.PERFURANTE]: 4 }[id];
    if (dmg) { const [t, v] = bestKill(G, E, dmg); if (t) add(v, jog({ alvos: [t.uid] })); return R; }
    switch (id) {
      case C.DUPLO: { const [t1, v1] = bestKill(G, E, 2), [t2, v2] = bestKill(G, E, 2, [t1]); if (t1) add(v1 + v2, jog({ alvos: [t1.uid, t2 ? t2.uid : null] })); break; }
      case C.SALVA: { const [t1, v1] = bestKill(G, E, 3), [t2, v2] = bestKill(G, E, 1, [t1]); if (t1) add(v1 + v2, jog({ alvos: [t1.uid, t2 ? t2.uid : null] })); break; }
      case C.CHUVA: add(aoeValue(G, p, 1, false), jog({})); break;
      case C.LUZ_LUMEN: case C.LANTERNAS: add(aoeValue(G, p, 2, false), jog({})); break;
      case C.DESMORONAMENTO: add(aoeValue(G, p, 1, true), jog({})); break;
      case C.BARRAGEM: add(aoeValue(G, p, 2, true), jog({})); break;
      case C.QUEDA: add(aoeValue(G, p, 4, true), jog({})); break;
      case C.VEMOS: add(2.8, jog({})); break;
      case C.MARCA: if (E.length) { const t = maxBy(E, m => mval(G, m)); if (mval(G, t) >= 6) add(mval(G, t) * 0.6, jog({ alvos: [t.uid] })); } break;
      case C.RAJADA: { const [t, v] = bestKill(G, E, 3); add(v + faceValue(G, p, 3), jog({ alvos: t ? [t.uid] : [] })); break; }
      case C.BENCAO: add(healValue(G, p, 5), jog({ alvos: ["h" + p.i] })); break;
      case C.PAO: add(healValue(G, p, 3) + 2, jog({})); break;
      case C.VIGILIA: add(healValue(G, p, 6) + 4 + 0.3 * viv(p.mesa).reduce((s, m) => s + m.maxhp - m.hp, 0), jog({})); break;
      case C.LAMPADAS_ACESAS: add(healValue(G, p, 8) + 1.6 * viv(p.mesa).length, jog({})); break;
      case C.ESCUDO_FE: case C.CASCO: case C.FORJA_REI: {
        if (viv(p.mesa).length) { const t = maxBy(viv(p.mesa), m => mval(G, m)); const [a, hh, kw] = id === C.ESCUDO_FE ? [0, 3, 0] : id === C.CASCO ? [1, 3, 0] : [2, 2, 1];
          add((a + hh) * 0.85 + (kw ? 1.5 : 0), jog({ alvos: [t.uid] })); }
        break;
      }
      case C.LANCAS: add(1.7 * viv(p.mesa).filter(m => m.kws.includes("Falange")).length, jog({})); break;
      case C.LANTERNA: {
        const fer = E.filter(M.ferido);
        if (fer.length) { const t = maxBy(fer, m => mval(G, m)); add(mval(G, t), jog({ alvos: [t.uid] })); }
        else if (p.casa === "Hauksval" && !p.decretoUsado) {
          const alvo = E.filter(m => m.hp > 1 && !M.temKw(G, m, "Couraça") || m.hp > 1);
          if (alvo.length) { const t = maxBy(alvo, m => mval(G, m));
            add(mval(G, t) - 1.5, async () => { if (!await M.usarDecreto(G, p.i, { alvos: [t.uid] })) return false; if (t.hp <= 0) return true; return M.jogarCarta(G, p.i, h.uid, { alvos: [t.uid] }); }, custo + 2, true); }
        }
        break;
      }
      case C.SENTENCA: if (E.length) { const t = maxBy(E, m => mval(G, m)); add(mval(G, t) - 1, jog({ alvos: [t.uid] })); } break;
      case C.CONTRATO: {
        const [t, v] = bestKill(G, E, 3); if (t) add(v, jog({ alvos: [t.uid], modo: "dano" }));
        if (p.armadura >= 6 && E.length) { const t2 = maxBy(E, m => mval(G, m)); add(mval(G, t2) - 3, jog({ alvos: [t2.uid], modo: "destruir" })); }
        break;
      }
      case C.MAR_COBRA: {
        const outras = p.mao.filter(x => x !== h);
        if (E.length && outras.length) { const t = maxBy(E, m => mval(G, m)); const d = maxBy(outras, x => ((+x.c.custo || 0) > p.max + 2 ? 100 : 0) - Math.abs((+x.c.custo || 0) - p.max));
          add(mval(G, t) - 2.5, jog({ alvos: [t.uid], descarte: d.uid })); }
        break;
      }
      case C.JULGAMENTO: { const cs = E.filter(m => M.ataque(G, m) >= 5); if (cs.length) { const t = maxBy(cs, m => mval(G, m)); add(mval(G, t), jog({ alvos: [t.uid] })); } break; }
      case C.ESCUDO_ACO: add(p.hp < 18 ? 4 : 2.5, jog({})); break;
      case C.ESCUDADA: { const [t, v] = bestKill(G, E, p.armadura); if (t && p.armadura >= 2) add(v, jog({ alvos: [t.uid] })); break; }
      case C.MARE_ALTA: { const cs = E.filter(m => (+m.c.custo || 0) <= 4); if (cs.length) { const t = maxBy(cs, m => mval(G, m) * (m.ficha ? 1 : 0.55) + (+m.c.custo || 0) * 0.5); add(bounceV(t), jog({ alvos: [t.uid] })); } break; }
      case C.CORRENTE: { const cs = E.filter(m => (+m.c.custo || 0) <= 4); if (cs.length) { const ts = [...cs].sort((a, b) => ((+b.c.custo || 0) + (b.ficha ? 5 : 0)) - ((+a.c.custo || 0) + (a.ficha ? 5 : 0))).slice(0, 2);
        add(ts.reduce((s, m) => s + bounceV(m), 0), jog({ alvos: ts.map(m => m.uid) })); } break; }
      case C.CARGA_SUL: add(4, jog({})); break;
      case C.CAMBIO: { const outras = p.mao.filter(x => x !== h); add(2.2, jog({ descarte: outras.length ? maxBy(outras, x => +x.c.custo || 0).uid : null })); break; }
      case C.BLOQUEIO: if (E.length) { const t = maxBy(E, m => M.ataque(G, m)); add(M.ataque(G, t) * 0.6 + 2, jog({ alvos: [t.uid] })); } break;
      default: break; // magias do Laboratório sem efeito programado: o robô não joga
    }
    return R;
  }
  function morvhal(G, p, h) {
    const o = op(G, p), E = viv(o.mesa), id = h.c.id, out = [];
    if (id === C.GOLPE_BRASA || id === C.CEIFAR) {
      const [d1, d2] = id === C.GOLPE_BRASA ? [3, 5] : [2, 99];
      const [t, v] = bestKill(G, E, d1); if (t) out.push([v, { alvos: [t.uid] }, false]);
      if (E.length) {
        if (d2 === 99) { const t2 = maxBy(E, m => mval(G, m)); out.push([mval(G, t2), { alvos: [t2.uid] }, true]); }
        else { const [t2, v2] = bestKill(G, E, d2); if (t2) out.push([v2, { alvos: [t2.uid] }, true]); }
      }
    } else if (id === C.SUSSURRO) {
      if (E.length) { const t = maxBy(E, m => M.ataque(G, m)); out.push([Math.min(1, M.ataque(G, t)) * 0.8, { alvos: [t.uid] }, false]); out.push([Math.min(3, M.ataque(G, t)) * 0.8, { alvos: [t.uid] }, true]); }
    } else if (id === C.DIZIMO) { out.push([2, {}, false]); out.push([4, {}, true]); }
    else if (id === C.CARGA) {
      const ready = viv(p.mesa).filter(m => (!m.enjoo || M.temKw(G, m, "Investida")) && !m.naoAtaca && !m.atacou);
      if (ready.length >= 2 && !E.some(m => M.temKw(G, m, "Provocar"))) { out.push([faceValue(G, p, ready.length), {}, false]); out.push([faceValue(G, p, 2 * ready.length), {}, true]); }
    } else if (id === C.OLHAR) {
      if (E.length) { const t = maxBy(E, m => M.ataque(G, m)); out.push([M.ataque(G, t) * 0.7, { alvos: [t.uid] }, false]); out.push([E.reduce((s, m) => s + M.ataque(G, m), 0) * 0.7, {}, true]); }
    } else if (id === C.JURAMENTO) {
      if (viv(p.mesa).length) { const t = maxBy(viv(p.mesa), m => mval(G, m)); out.push([3.4, { alvos: [t.uid] }, false]); out.push([6.8, { alvos: [t.uid] }, true]); }
    } else if (id === C.NOITE) { out.push([aoeValue(G, p, 2, false), {}, false]); out.push([aoeValue(G, p, 3, false), {}, true]); }
    else if (id === C.CHAMAS) { out.push([faceValue(G, p, 2), {}, false]); out.push([faceValue(G, p, 4), {}, true]); }
    return out;
  }
  function heroPower(G, p) {
    const o = op(G, p), dec = esc => () => M.usarDecreto(G, p.i, esc);
    switch (p.casa) {
      case "Morvhal": if (viv(p.mesa).length < M.R.MESA && p.aux > 0) return [2.3, dec({})]; break;
      case "Valdoren": {
        const v = healValue(G, p, 2), dm = viv(p.mesa).filter(M.ferido);
        if (v >= 0.8) return [v, dec({ alvos: ["h" + p.i] })];
        if (dm.length) return [1.2, dec({ alvos: [maxBy(dm, m => mval(G, m)).uid] })];
        if (viv(p.mesa).some(m => m.c.id === C.PEREGRINO) && p.hp < 20) return [1, dec({ alvos: ["h" + p.i] })];
        break;
      }
      case "Hauksval": { const [t, v] = bestKill(G, viv(o.mesa), 1); if (t && killNeeded(G, t, 1)) return [Math.max(v, 1.5), dec({ alvos: [t.uid] })]; return [faceValue(G, p, 1) * 1.2, dec({ alvos: ["h" + o.i] })]; }
      case "Durnheim": return [2.0, dec({})];
      case "Aethelmar": { const bad = p.mao.filter(x => (+x.c.custo || 0) >= p.max + 3); if (bad.length) return [1.5, dec({ descarte: maxBy(bad, x => +x.c.custo || 0).uid })]; break; }
    }
    return [0, null];
  }

  // ---------- planejamento ----------
  function itens(G, p) {
    const items = [];
    for (const h of p.mao) {
      const id = h.c.id;
      if (id === C.APAGAR) {
        items.push({ custo: -1, v: 0.05, g: h.uid, exec: () => M.jogarCarta(G, p.i, h.uid, {}), ordem: 0 });
        const fd = fodder(G, p);
        if (fd) items.push({ custo: -2, v: 0.1 - (FODDER.has(fd.c.id) ? 0.5 : mval(G, fd)) + sacBonus(G, p), g: h.uid, exec: () => M.jogarCarta(G, p.i, h.uid, { sac: fd.uid }), ordem: 0 });
        continue;
      }
      if (id === C.VELA) { items.push({ custo: -1, v: 0.05, g: h.uid, exec: () => M.jogarCarta(G, p.i, h.uid, {}), ordem: 0 }); continue; }
      if (M.EF[id] && M.EF[id].descarte === "custo" && p.mao.length < 2) continue;
      for (const o of opcoes(G, p, h)) items.push({ ...o, g: h.uid, ordem: h.c.tipo === "Magia" ? 1 : 2 });
    }
    if (!p.decretoUsado) { const [hv, hx] = heroPower(G, p); if (hx && hv > 0) items.push({ custo: 2, v: hv, g: "HP", exec: hx, ordem: 3 }); }
    return items;
  }
  function planStep(G, p) {
    const items = itens(G, p); let best = { v: 0, ch: [] }, nos = 0;
    const used = new Set(), ch = [];
    (function dfs(idx, mana, val, hpTaken) {
      if (++nos > 60000) return;
      if (val > best.v) best = { v: val, ch: [...ch] };
      for (let j = idx; j < items.length; j++) {
        const it = items[j];
        if (used.has(it.g)) continue;
        if (it.needHp && (hpTaken || used.has("HP"))) continue;
        if (it.g === "HP" && hpTaken) continue;
        if (mana - it.custo < 0 || (it.v <= 0 && it.custo >= 0)) continue;
        if (it.custo < 0 && mana - it.custo > 10) continue;
        used.add(it.g); ch.push(j); dfs(j + 1, mana - it.custo, val + it.v, hpTaken || it.needHp); ch.pop(); used.delete(it.g);
      }
    })(0, p.mana, 0, false);
    if (!best.ch.length) return null;
    const chosen = best.ch.map(j => items[j]);
    if (chosen.every(it => it.custo < 0)) return null;
    chosen.sort((a, b) => a.ordem - b.ordem || b.v - a.v);
    return chosen[0];
  }

  // ---------- ataques ----------
  function tradeScore(G, a, d) {
    const A = M.ataque(G, a), D = M.ataque(G, d);
    const fogo = (x, y, n) => M.temKw(G, x, "Fogo Negro") && n - (M.temKw(G, y, "Couraça") ? 1 : 0) > 0;
    const kills = fogo(a, d, A) || killNeeded(G, d, A, true);
    let dies;
    if (M.temKw(G, d, "Falange")) { if (fogo(d, a, D) || killNeeded(G, a, D, true)) return -mval(G, a); dies = false; }
    else dies = M.temKw(G, a, "Distância") ? false : (fogo(d, a, D) || killNeeded(G, a, D, true));
    return (kills ? mval(G, d) : 0.3 * Math.min(A, d.hp)) - (dies ? mval(G, a) : 0);
  }
  function proximoAtaque(G, p) {
    const o = op(G, p), atk = viv(p.mesa).filter(m => M.podeAtacar(G, m));
    if (!atk.length) return null;
    const taunts = viv(o.mesa).filter(m => M.temKw(G, m, "Provocar"));
    const total = atk.reduce((s, m) => s + M.ataque(G, m), 0);
    const m = maxBy(atk, x => M.ataque(G, x));
    if (!taunts.length && total >= effHp(o)) return [m.uid, "h" + o.i];
    const pool = taunts.length ? taunts : viv(o.mesa);
    let best = null, bs = -99;
    for (const e of pool) { const sc = tradeScore(G, m, e); if (sc > bs) { best = e; bs = sc; } }
    if (best && (taunts.length || bs > agg(p))) return [m.uid, best.uid];
    return [m.uid, "h" + o.i];
  }

  // ---------- escolhas no meio de um efeito ----------
  function escolher(G, i, s) {
    const p = G.p[i];
    switch (s.tipo) {
      case "mao_cheia": { const all = [...s.mao, s.nova]; const w = p.max < 6 ? maxBy(all, x => +x.c.custo || 0) : minBy(all, x => +x.c.custo || 0); return w.uid; }
      case "mare": case "ver": { const alvo = Math.min(p.max + 1, 8); return minBy(s.cartas, x => Math.abs((+x.c.custo || 0) - alvo) + (x.c.tipo === "Lacaio" ? 0 : 0.5)).uid; }
      case "pescador": return (+s.carta.c.custo || 0) > p.max + 3;
      case "alvo": {
        const ms = s.alvos.map(u => M.lacaio(G, u)).filter(Boolean);
        if (!ms.length) return s.alvos[0];
        if (s.dano) { const [t] = bestKill(G, ms, s.dano); return (t || maxBy(ms, m => mval(G, m))).uid; }
        return maxBy(ms, m => mval(G, m)).uid;
      }
    }
    return null;
  }
  function mulligan(G, i) { const p = G.p[i], lim = agg(p) > 0.6 ? 4 : 5; return p.mao.filter(h => (+h.c.custo || 0) >= lim).map(h => h.uid); }

  async function jogarTurno(G, i, passo = async () => {}) {
    const p = G.p[i];
    for (let fase = 0; fase < 2; fase++) {
      for (let guard = 0; guard < 20 && !G.fim; guard++) {
        const it = planStep(G, p); if (!it) break;
        const ok = await it.exec(); if (ok === false) break;
        await passo("jogada");
      }
      if (G.fim) return;
      for (let k = 0; k < 12 && !G.fim; k++) {
        const a = proximoAtaque(G, p); if (!a) break;
        if (!await M.atacar(G, i, a[0], a[1])) break;
        await passo("ataque");
      }
      if (G.fim) return;
    }
  }

  g.DKJ.Robo = { jogarTurno, escolher, mulligan, mval, planStep, proximoAtaque };
})(typeof window !== "undefined" ? window : globalThis);
