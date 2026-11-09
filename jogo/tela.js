/* Dunkelkrieg — tela do jogo (menus, arena, mão, alvos, animações).
   Lê as cartas e as artes da Oficina pelas funções globais cartas() e arteDe(id).
   As regras ficam em motor.js e o adversário em robo.js. */
(function (g) {
  "use strict";
  const M = g.DKJ.Motor, Rb = g.DKJ.Robo;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const reduzido = () => g.matchMedia && g.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CASA_INFO = {
    Morvhal: "Agressão. Cavalaria com Investida, Vazios descartáveis e magias que ficam mais fortes quando consomem um lacaio seu.",
    Hauksval: "Precisão. A melhor remoção de alvo único do jogo e arqueiros que atacam sem levar dano.",
    Valdoren: "Resistência. Paredes de lanças e Provocar, muita cura e um jogo longo em que a cura vira ataque.",
    Durnheim: "Peso. Começo lento, armadura, o melhor dano em área e máquinas de cerco difíceis de derrubar.",
    Aethelmar: "Frota e tempo. Lacaios eficientes, magias que devolvem lacaios à mão e seleção de cartas.",
  };
  const VEL = { normal: { pensa: 700, passo: 750, anuncio: 1300 }, rapida: { pensa: 250, passo: 300, anuncio: 700 } };
  const ICONE = {
    menu: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    deck: '<svg viewBox="0 0 12 15" aria-hidden="true"><rect x="2.5" y=".5" width="9" height="12" rx="1" fill="none" stroke="currentColor"/><rect x=".5" y="2.5" width="9" height="12" rx="1" fill="#15130f" stroke="currentColor"/></svg>',
    "Distância": '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 17 L16 4 M11 4 h5 v5 M5 12 l3 3" stroke="#e8d6a4" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    "Fogo Negro": '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2 C13 6 16 8 15 12 C14.5 15.5 12 18 10 18 C7 18 5 15.5 5 12.5 C5 10 7 9 7 6 C8.5 7.5 9 8.5 9 10 C10.5 8 11 5 10 2 Z" fill="#c4544b"/></svg>',
    "Falange": '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2 L13 7 H11 V18 H9 V7 H7 Z" fill="#7fac79"/></svg>',
    "Couraça": '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4 H16 V10 Q16 15 10 18 Q4 15 4 10 Z" fill="none" stroke="#c3c7cf" stroke-width="2"/><path d="M7 8 H13" stroke="#c3c7cf" stroke-width="2"/></svg>',
    "Gatilho": '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2 L12.4 7.6 L18 10 L12.4 12.4 L10 18 L7.6 12.4 L2 10 L7.6 7.6 Z" fill="#c9a961"/></svg>',
  };
  const COSTAS = (rot = "ESCOLHA") => {
    let o = `<svg viewBox="0 0 63 88" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="63" height="88" rx="2.6" fill="#0f0e0c"/><rect x="2.2" y="2.2" width="58.6" height="83.6" rx="1.4" fill="#1b1812" stroke="#c9a961" stroke-width=".4"/><rect x="3.6" y="3.6" width="55.8" height="80.8" rx=".9" fill="none" stroke="#c9a961" stroke-opacity=".5" stroke-width=".15"/>`;
    for (let y = 8; y < 82; y += 6) for (let x = 8 + ((y / 6) % 2) * 3; x < 57; x += 6) o += `<path d="M${x} ${y - .5} l.5 .5 l-.5 .5 l-.5 -.5 Z" fill="#c9a961" opacity=".2"/>`;
    return o + `<circle cx="31.5" cy="40" r="14" fill="#0f0e0c" stroke="#c9a961" stroke-width=".35"/><text x="31.5" y="47" text-anchor="middle" font-family="'TeX Gyre Pagella', Palatino, Georgia, serif" font-weight="700" font-size="20" fill="#c9a961">?</text><text x="31.5" y="69" text-anchor="middle" font-family="'TeX Gyre Pagella', Palatino, Georgia, serif" font-weight="700" font-size="4.2" letter-spacing="1" fill="#c9a961">${rot}</text></svg>`;
  };

  // ---------- dados da Oficina (ou do pacote publicado, com DKJ_CARTAS e DKJ_ARTE) ----------
  const SEM_OFICINA = !!g.DKJ_SEM_OFICINA;
  function listaCartas() { try { if (typeof cartas === "function") return cartas(); } catch (e) {} return g.DKJ_CARTAS || []; }
  function arteDaCarta(id) { try { if (typeof arteDe === "function") return arteDe(id); } catch (e) {} return g.DKJ_ARTE ? g.DKJ_ARTE(id) : null; }
  function bgArte(id, heroi) {
    const a = arteDaCarta(id); if (!a || !a.url) return "";
    return `background-image:url('${String(a.url).replace(/'/g, "%27")}');background-position:${50 - (a.dx || 0) * 50}% ${heroi ? 30 : 50 - (a.dy || 0) * 50}%;`;
  }
  const brasaoSvg = casa => `<svg viewBox="0 0 100 120" aria-hidden="true">${g.DK.brasao(casa, 0, 0, 100, g.DK.PALETAS.escuro, "b")}</svg>`;
  const cache = new Map();
  function svgCarta(c, chave) {
    const k = chave + "|" + (c.nome || "") + "|" + c.custo + "|" + c.atk + "|" + c.vida;
    if (!cache.has(k)) cache.set(k, g.DK.renderCard(c, { id: chave.replace(/[^a-z0-9-]/gi, "").toLowerCase(), arte: arteDaCarta(c.id), size: ["100%", "auto"] }));
    return cache.get(k);
  }

  // ---------- estado ----------
  let raiz = null, arena = null, G = null;
  const S = { modo: "robo", escolha: "sorteio", vel: "normal" };
  try { const v = JSON.parse(localStorage.getItem("dkj-cfg") || "{}"); Object.assign(S, v); } catch (e) {}
  const salvarCfg = () => { try { localStorage.setItem("dkj-cfg", JSON.stringify(S)); } catch (e) {} };
  const ui = { eu: 0, ocupado: false, alvo: null, sel: null, foto: new Map(), vistos: new Set(), maoVista: new Set(), sessao: 0, casas: null, cfg: null, camada: null };
  const vel = () => VEL[(ui.cfg && ui.cfg.vel) || S.vel] || VEL.normal;
  class Abortado extends Error {}
  const checar = s => { if (s !== ui.sessao) throw new Abortado(); };

  // ---------- telas de menu ----------
  function tela(html) { if (arena) { arena.remove(); arena = null; } fecharCamada(); fecharFaixa(); raiz.querySelectorAll(".tela, .passe").forEach(x => x.remove()); raiz.insertAdjacentHTML("beforeend", `<div class="tela"><div>${html}</div></div>`); return raiz.querySelector(".tela"); }
  function seg(k, opcoes) {
    return `<div class="seg" data-k="${k}">${opcoes.map(([v, b, s]) => `<button type="button" data-v="${v}" aria-pressed="${S[k] === v}"><b>${b}</b><small>${s}</small></button>`).join("")}</div>`;
  }
  function telaMenu() {
    const emCurso = G && !G.fim;
    const t = tela(`
      <div class="eyebrow-j">Partida piloto · regras v0.5</div>
      <h1>DUNKELKRIEG</h1>
      <p class="sub">Cinco casas de Gaeno se enfrentam através do Vau de Cinza. Vence quem derrubar o herói inimigo.</p>
      <div class="grupo"><span>Adversário</span>${seg("modo", [["robo", "Contra o robô", "Você joga contra o computador."], ["dois", "Dois jogadores", "No mesmo aparelho, passando a vez. A mão de cada um fica escondida."]])}</div>
      <div class="grupo"><span>Casas</span>${seg("escolha", [["sorteio", "Sorteio", "Recomendado. Cada jogador puxa uma carta de escolha às cegas."], ["livre", "Escolha livre", "Para partidas casuais ou para aprender um deck."]])}</div>
      <div class="grupo" id="g-vel"><span>Velocidade do robô</span>${seg("vel", [["normal", "Normal", "Dá para acompanhar cada jogada."], ["rapida", "Rápida", "Para quem já conhece as cartas."]])}</div>
      <div class="acoes"><button class="btn-j" type="button" id="j-comecar">${emCurso ? "Nova partida" : "Começar"}</button>${emCurso ? `<button class="btn-j sec" type="button" id="j-continuar">Continuar a partida</button>` : ""}</div>
      ${SEM_OFICINA ? `<p class="nota">Dunkelkrieg · protótipo ${esc(g.DKJ_VERSAO || "")}</p>` : `<div class="acoes"><button class="btn-j sec" type="button" id="j-oficina">Voltar à Oficina</button></div>
      <p class="nota">As cartas, as artes e as edições vêm da Oficina. Cartas do Laboratório entram quando estão marcadas "na caixa".</p>`}`);
    const velG = t.querySelector("#g-vel"); velG.hidden = S.modo !== "robo";
    t.querySelectorAll(".seg").forEach(sg => sg.querySelectorAll("button").forEach(b => b.onclick = () => {
      S[sg.dataset.k] = b.dataset.v; salvarCfg();
      sg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      velG.hidden = S.modo !== "robo";
    }));
    t.querySelector("#j-comecar").onclick = () => novaPartida(null);
    if (emCurso) t.querySelector("#j-continuar").onclick = () => retomar();
    if (!SEM_OFICINA) t.querySelector("#j-oficina").onclick = sair;
  }
  function sair() { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} g.dispatchEvent(new HashChangeEvent("hashchange")); }

  function heroiDe(lista, casa) { return lista.find(c => c.tipo === "Herói" && c.casa === casa); }
  function telaSorteio(nomes, tipos, s) {
    return new Promise(res => {
      const ordem = [...M.CASAS].sort(() => Math.random() - 0.5), pegas = [null, null]; let k = 0;
      const lista = listaCartas();
      const t = tela(`<div class="eyebrow-j">Sorteio das casas</div><h2 id="s-tit"></h2><p class="sub">As cinco cartas de escolha estão viradas para baixo, embaralhadas.</p>
        <div class="sorteio">${ordem.map((c, i) => `<button type="button" data-i="${i}" aria-label="Carta de escolha ${i + 1}"><div class="vira"><div>${COSTAS()}</div><div class="frente">${g.DK.renderVerso(c, { size: ["100%", "100%"] })}</div></div><span class="rot"></span></button>`).join("")}</div>
        <p class="sub" id="s-res"></p><div class="acoes" id="s-acoes"></div>`);
      const tit = t.querySelector("#s-tit");
      const atualiza = () => { tit.textContent = k < 2 ? (tipos[k] === "robo" ? `${nomes[k]} está puxando uma carta…` : `${nomes[k]}, toque em uma carta`) : "Casas sorteadas"; };
      const pegar = i => {
        checar(s);
        const b = t.querySelector(`[data-i="${i}"]`); if (!b || b.classList.contains("aberta") || k > 1) return;
        pegas[k] = ordem[i]; b.classList.add("aberta"); b.querySelector(".rot").textContent = nomes[k]; b.setAttribute("aria-label", `${ordem[i]}, de ${nomes[k]}`); k++; atualiza();
        if (k < 2 && tipos[k] === "robo") setTimeout(() => { try { const livres = ordem.map((_, j) => j).filter(j => !t.querySelector(`[data-i="${j}"]`).classList.contains("aberta")); pegar(livres[Math.floor(Math.random() * livres.length)]); } catch (e) {} }, 900);
        if (k === 2) {
          t.querySelector("#s-res").innerHTML = pegas.map((c, j) => `${esc(nomes[j])}: <b>${esc(c)}</b>${heroiDe(lista, c) ? ` (${esc(heroiDe(lista, c).nome)})` : ""}`).join(" · ");
          t.querySelector("#s-acoes").innerHTML = `<button class="btn-j" type="button" id="s-ok">Continuar</button>`;
          t.querySelector("#s-ok").onclick = () => res(pegas);
        }
      };
      t.querySelectorAll(".sorteio button").forEach(b => b.onclick = () => { if (k < 2 && tipos[k] !== "robo") pegar(+b.dataset.i); });
      atualiza();
    });
  }
  function telaLivre(nomes, tipos, s) {
    return new Promise(res => {
      const lista = listaCartas(), pegas = [null, null];
      const passo = k => {
        checar(s);
        if (k > 1) return res(pegas);
        if (tipos[k] === "robo") { const outras = M.CASAS.filter(c => c !== pegas[0]); pegas[k] = outras[Math.floor(Math.random() * outras.length)]; return passo(k + 1); }
        let sel = null;
        const t = tela(`<div class="eyebrow-j">Escolha livre</div><h2>${esc(nomes[k])}, escolha sua casa</h2>
          ${tipos[1] === "robo" ? `<p class="sub">O robô fica com uma das outras casas, sorteada.</p>` : k === 1 ? `<p class="sub">${esc(nomes[0])} escolheu ${esc(pegas[0])}. No jogo digital as duas podem ser a mesma casa.</p>` : ""}
          <div class="casas">${M.CASAS.map(c => { const h = heroiDe(lista, c);
            return `<button class="casa-op" type="button" data-c="${c}" aria-pressed="false">${brasaoSvg(c)}<span><b>${c}</b><span class="quem">${esc(h ? h.nome : "")}</span><small>${esc(CASA_INFO[c])}</small></span></button>`; }).join("")}</div>
          <div class="acoes"><button class="btn-j" type="button" id="l-ok" disabled>Confirmar</button><button class="btn-j sec" type="button" id="l-volta">Voltar</button></div>`);
        t.querySelectorAll(".casa-op").forEach(b => b.onclick = () => { sel = b.dataset.c; t.querySelectorAll(".casa-op").forEach(x => x.setAttribute("aria-pressed", String(x === b))); t.querySelector("#l-ok").disabled = false; });
        t.querySelector("#l-ok").onclick = () => { pegas[k] = sel; passo(k + 1); };
        t.querySelector("#l-volta").onclick = () => telaMenu();
      };
      passo(0);
    });
  }
  function telaDados(nomes, tipos, s) {
    return new Promise(res => {
      const t = tela(`<div class="eyebrow-j">Quem começa</div><h2>Rolando os dados</h2>
        <div class="dados">${[0, 1].map(i => `<div class="dado" id="d${i}"><div class="face">–</div><b>${esc(nomes[i])}</b></div>`).join("")}</div>
        <p class="sub" id="d-res" aria-live="polite"></p><div class="acoes" id="d-acoes"></div>`);
      const rolar = async () => {
        let a, b;
        for (let n = 0; n < (reduzido() ? 1 : 10); n++) { a = 1 + Math.floor(Math.random() * 6); b = 1 + Math.floor(Math.random() * 6); t.querySelector("#d0 .face").textContent = a; t.querySelector("#d1 .face").textContent = b; await espera(70); }
        checar(s);
        if (a === b) { t.querySelector("#d-res").textContent = "Empate nos dados. Rolando de novo…"; await espera(900); return rolar(); }
        const v = a > b ? 0 : 1; t.querySelector("#d" + v).classList.add("venceu");
        if (tipos[v] === "robo") {
          t.querySelector("#d-res").textContent = `${nomes[v]} ganhou nos dados e escolheu começar.`;
          t.querySelector("#d-acoes").innerHTML = `<button class="btn-j" type="button" id="d-ok">Continuar</button>`;
          t.querySelector("#d-ok").onclick = () => res(v);
        } else {
          t.querySelector("#d-res").textContent = `${nomes[v]} ganhou nos dados. Quem começa?`;
          t.querySelector("#d-acoes").innerHTML = `<button class="btn-j" type="button" id="d-1">${esc(nomes[v])} começa</button><button class="btn-j sec" type="button" id="d-2">${esc(nomes[1 - v])} começa</button>`;
          t.querySelector("#d-1").onclick = () => res(v); t.querySelector("#d-2").onclick = () => res(1 - v);
        }
      };
      rolar().catch(() => {});
    });
  }
  function telaMulligan(i, s) {
    return new Promise(res => {
      const p = G.p[i], troca = new Set(), segundo = i !== G.vez;
      const t = tela(`<div class="eyebrow-j">Mulligan</div><h2>Mão inicial de ${esc(p.nome)}</h2>
        <p class="sub">Toque nas cartas que quer devolver ao deck. Você compra o mesmo número de cartas, uma vez só.${segundo ? " Como você é o segundo a jogar, recebe a Vela depois do mulligan." : " Você começa a partida."}</p>
        <div class="mull">${p.mao.map(h => `<button type="button" data-u="${h.uid}" aria-pressed="false" aria-label="${esc(h.c.nome)}">${svgCarta(h.c, "mu" + h.uid)}</button>`).join("")}</div>
        <div class="acoes"><button class="btn-j" type="button" id="m-ok">Ficar com estas cartas</button></div>`);
      const ok = t.querySelector("#m-ok");
      t.querySelectorAll(".mull button").forEach(b => b.onclick = () => {
        const u = +b.dataset.u; troca.has(u) ? troca.delete(u) : troca.add(u); b.setAttribute("aria-pressed", String(troca.has(u)));
        ok.textContent = troca.size ? `Trocar ${troca.size} ${troca.size === 1 ? "carta" : "cartas"}` : "Ficar com estas cartas";
      });
      ok.onclick = () => { checar(s); res([...troca]); };
    });
  }
  function passe(nome, texto) {
    return new Promise(res => {
      raiz.querySelectorAll(".passe").forEach(x => x.remove());
      raiz.insertAdjacentHTML("beforeend", `<div class="passe"><div><div class="eyebrow-j">Dois jogadores</div><h2>Vez de ${esc(nome)}</h2><p class="sub">${esc(texto || "Passe o aparelho. As cartas da sua mão aparecem quando você tocar no botão.")}</p><button class="btn-j" type="button">Estou pronto</button></div></div>`);
      const el = raiz.querySelector(".passe");
      el.querySelector("button").onclick = () => { el.remove(); res(); };
      el.querySelector("button").focus();
    });
  }

  // ---------- partida ----------
  async function novaPartida(casasFixas) {
    const s = ++ui.sessao;
    const modo = casasFixas ? ui.cfg.modo : S.modo;
    const tipos = modo === "robo" ? ["humano", "robo"] : ["humano", "humano"];
    const nomes = modo === "robo" ? ["Você", "Robô"] : ["Jogador 1", "Jogador 2"];
    ui.cfg = { modo, vel: S.vel, escolha: S.escolha };
    try {
      const lista = listaCartas();
      if (!lista.length) { tela(`<h2>Não encontrei as cartas</h2><p class="sub">Abra o jogo pela Oficina de Cartas.</p>`); return; }
      const casas = casasFixas || await (S.escolha === "sorteio" ? telaSorteio(nomes, tipos, s) : telaLivre(nomes, tipos, s));
      checar(s); ui.casas = casas;
      const primeiro = await telaDados(nomes, tipos, s); checar(s);
      cache.clear(); ui.vistos.clear(); ui.maoVista.clear();
      G = M.criarJogo({ cartas: lista, casas, tipos, nomes, primeiro, escolher });
      ui.eu = 0;
      for (const i of [G.vez, 1 - G.vez]) {
        if (tipos[i] === "robo") M.mulligan(G, i, Rb.mulligan(G, i));
        else { if (modo === "dois") await passe(nomes[i], "Passe o aparelho para ver a sua mão inicial."); checar(s); M.mulligan(G, i, await telaMulligan(i, s)); }
        checar(s);
      }
      M.comecar(G);
      montarArena();
      await comecarTurno(s);
    } catch (e) { if (!(e instanceof Abortado)) { console.error(e); erro(e); } }
  }
  function erro(e) { tela(`<h2>Algo deu errado</h2><p class="sub">${esc(e && e.message || e)}</p><div class="acoes"><button class="btn-j" type="button" id="e-ok">Voltar ao menu</button></div>`).querySelector("#e-ok").onclick = telaMenu; }
  function retomar() {
    montarArena(); desenhar(); ui.foto = foto();
  }
  function montarArena() {
    raiz.querySelectorAll(".tela").forEach(x => x.remove());
    if (!arena) { raiz.insertAdjacentHTML("afterbegin", `<div class="arena" role="application" aria-label="Arena de Dunkelkrieg"></div>`); arena = raiz.querySelector(".arena"); }
  }
  async function comecarTurno(s) {
    if (G.fim) return fimDeJogo();
    const p = G.p[G.vez];
    ui.ocupado = true; ui.sel = null;
    if (ui.cfg.modo === "dois") { ui.eu = G.vez; fecharCamada(); await passe(p.nome); checar(s); ui.maoVista = new Set(p.mao.map(h => h.uid)); }
    desenhar(); ui.foto = foto();
    await M.iniciarTurno(G); checar(s);
    await atualizar(); checar(s);
    if (G.fim) return fimDeJogo();
    if (p.tipo === "robo") return turnoRobo(s);
    banner(ui.cfg.modo === "dois" ? `Vez de ${p.nome}` : "Seu turno");
    ui.ocupado = false; desenhar();
  }
  async function turnoRobo(s) {
    const i = G.vez;
    await espera(vel().pensa); checar(s);
    await Rb.jogarTurno(G, i, async () => { checar(s); await atualizar(); await espera(vel().passo); checar(s); });
    await atualizar(); checar(s);
    if (G.fim) return fimDeJogo();
    await passarTurno(s);
  }
  async function passarTurno(s) {
    ui.ocupado = true; fecharCamada(); ui.sel = null;
    await M.encerrarTurno(G); checar(s);
    await atualizar(); checar(s);
    if (G.fim) return fimDeJogo();
    await comecarTurno(s);
  }
  function encerrar() {
    if (ui.ocupado || !G || G.fim || G.vez !== ui.eu) return;
    const s = ui.sessao;
    passarTurno(s).catch(e => { if (!(e instanceof Abortado)) { console.error(e); erro(e); } });
  }
  async function acao(fn) {
    if (ui.ocupado) return;
    const s = ui.sessao;
    ui.ocupado = true; fecharCamada();
    try { await fn(); checar(s); await atualizar(); checar(s); }
    catch (e) { if (e instanceof Abortado) return; console.error(e); }
    ui.ocupado = false; desenhar();
    if (G.fim) fimDeJogo();
  }

  // ---------- escolhas do motor (meio de um efeito) ----------
  function escolher(G0, i, sp) {
    if (G0.p[i].tipo === "robo") return Rb.escolher(G0, i, sp);
    return escolherHumano(i, sp);
  }
  async function escolherHumano(i, sp) {
    await atualizar();
    if (sp.tipo === "alvo") return escolherAlvo({ cands: sp.alvos, titulo: sp.titulo, cancelavel: false });
    if (sp.tipo === "mao_cheia") return escolherCartas({ titulo: sp.titulo, texto: "Sua mão já tem 8 cartas. A carta comprada está marcada como nova.", cartas: [sp.nova, ...sp.mao], marca: { [sp.nova.uid]: "Nova" }, confirmar: "Descartar esta" });
    if (sp.tipo === "mare" || sp.tipo === "ver") return escolherCartas({ titulo: sp.titulo, cartas: sp.cartas, confirmar: "Ficar com esta" });
    if (sp.tipo === "pescador") { const r = await perguntar({ titulo: sp.titulo, carta: sp.carta.c, chave: "pe" + sp.carta.uid, texto: "Você pode deixá-la no topo ou colocá-la no fundo do deck.", opcoes: [{ id: "topo", rot: "Deixar no topo" }, { id: "fundo", rot: "Colocar no fundo", sec: true }] }); return r === "fundo"; }
    return null;
  }

  // ---------- desenho da arena ----------
  const refDe = s => s[0] === "h" ? s : +s;
  function heroiHtml(p) {
    const bg = bgArte(p.heroi.id, true);
    return `<button class="heroi" type="button" data-r="h${p.i}" style="${bg}" aria-label="${esc(p.heroi.nome)}, ${p.hp} de vida${p.armadura ? `, ${p.armadura} de armadura` : ""}">${bg ? "" : `<span class="bra">${brasaoSvg(p.casa)}</span>`}<span class="vida-h">${p.hp}</span>${p.armadura ? `<span class="arm-h">${p.armadura}</span>` : ""}</button>`;
  }
  function lacHtml(m) {
    const eu = m.dono === ui.eu, A = M.ataque(G, m);
    const cls = ["lac"];
    if (M.temKw(G, m, "Provocar")) cls.push("prov");
    if (eu && G.vez === ui.eu && !ui.ocupado && !ui.alvo && M.podeAtacar(G, m)) cls.push("pode");
    if (ui.sel === m.uid) cls.push("sel");
    if (m.naoAtaca) cls.push("preso");
    if (eu && m.enjoo && G.vez === ui.eu && !M.temKw(G, m, "Investida")) cls.push("enjoo");
    if (m.kws.includes("Fogo Negro")) cls.push("fogo");
    if (!ui.vistos.has(m.uid)) cls.push("entrou");
    const ic = ["Distância", "Fogo Negro", "Falange", "Couraça"].filter(k => M.temKw(G, m, k)).map(k => `<i title="${k}">${ICONE[k]}</i>`);
    if (M.PASSIVOS.has(m.c.id) && !m.ficha) ic.push(`<i title="Efeito">${ICONE.Gatilho}</i>`);
    const bg = bgArte(m.c.id);
    const vc = m.hp < m.maxhp ? "ferido" : m.maxhp > (+m.c.vida || 0) ? "forte" : "";
    const ac = A > (+m.c.atk || 0) ? "forte" : A < (+m.c.atk || 0) ? "ferido" : "";
    return `<button class="${cls.join(" ")}" type="button" data-r="${m.uid}" aria-label="${esc(m.c.nome)}, ataque ${A}, vida ${m.hp}${m.naoAtaca ? ", não pode atacar" : ""}">
      <span class="arte-l" style="${bg}">${bg ? "" : `<span class="bra">${brasaoSvg(m.c.casa === "*" ? "Morvhal" : m.c.casa)}</span>`}</span>
      <span class="nome-l">${esc(m.c.nome)}</span>${ic.length ? `<span class="icones">${ic.join("")}</span>` : ""}
      <span class="st atk ${ac}">${A}</span><span class="st vida ${vc}">${m.hp}</span></button>`;
  }
  function semJogadas(p) {
    if (G.vez !== p.i) return false;
    if (p.mao.some(h => M.infoCarta(G, p.i, h.uid).pode)) return false;
    if (M.vivos(p.mesa).some(m => M.podeAtacar(G, m))) return false;
    if (M.infoDecreto(G, p.i).pode) return false;
    return true;
  }
  function desenhar() {
    if (!arena || !G) return;
    const eu = G.p[ui.eu], op = G.p[1 - ui.eu];
    const meuTurno = G.vez === ui.eu, dec = M.infoDecreto(G, eu.i);
    const decNome = eu.heroi.decreto || M.DECRETOS[eu.casa].nome;
    const dev = []; for (let k = 0; k < Math.max(eu.max, eu.mana); k++) dev.push(`<i class="${k < eu.mana ? (k >= eu.max ? "cheio extra" : "cheio") : ""}"></i>`);
    const versos = Array.from({ length: Math.min(op.mao.length, 8) }, () => `<span class="verso">${g.DK.renderVerso(op.casa, { size: ["100%", "100%"] })}</span>`).join("");
    const vistosAgora = new Set();
    const mesa = (p, lado) => { const vs = M.vivos(p.mesa); vs.forEach(m => vistosAgora.add(m.uid));
      return `<div class="mesa-j ${lado}" aria-label="Mesa de ${esc(p.nome)}">${vs.map(lacHtml).join("") || `<span class="vazio-j">${lado === "op" ? "Mesa do adversário vazia" : meuTurno ? "Sua mesa: jogue lacaios da mão" : "Sua mesa"}</span>`}</div>`; };
    const fimTxt = meuTurno ? "Encerrar turno" : op.tipo === "robo" ? "Turno do robô" : "Turno do adversário";
    arena.innerHTML = `
      <div class="barra-j op">
        <button class="menu-j" type="button" data-acao="menu" aria-label="Menu da partida">${ICONE.menu}</button>
        ${heroiHtml(op)}
        <div class="meio"><div class="nome-j">${esc(op.nome)}<small>${esc(op.casa)} · ${esc(op.heroi.nome)}</small></div>
          <div class="info-j"><span>Devoção <b>${op.mana}/${op.max}</b></span><span class="contagem">${ICONE.deck}<b>${op.deck.length}</b></span><span>Mão <b>${op.mao.length}</b></span>${op.casa === "Morvhal" ? `<span>Vazios <b>${op.aux}</b></span>` : ""}<span>Decreto <b>${op.decretoUsado ? "usado" : "pronto"}</b></span></div></div>
        <div class="mao-op" aria-hidden="true">${versos}</div>
      </div>
      ${mesa(op, "op")}
      <div class="rio" aria-hidden="true"><span>Vau de Cinza</span></div>
      ${mesa(eu, "eu")}
      <div class="barra-j eu">
        ${heroiHtml(eu)}
        <div class="meio"><div class="nome-j">${esc(eu.nome)}<small>${esc(eu.casa)} · ${esc(eu.heroi.nome)}</small></div>
          <div class="dev" aria-label="Devoção ${eu.mana} de ${eu.max}">${dev.join("")}<span>${eu.mana}/${eu.max}</span></div>
          <div class="info-j"><span class="contagem">${ICONE.deck}<b>${eu.deck.length}</b> no deck</span>${eu.casa === "Morvhal" ? `<span>Vazios <b>${eu.aux}</b></span>` : ""}</div></div>
        <div class="lado-d">
          <button class="decreto ${dec.pode && !ui.ocupado ? "pronto" : ""} ${eu.decretoUsado ? "usado" : ""}" type="button" data-acao="decreto" aria-label="Decreto ${esc(decNome)}, custo 2"><span class="custo-d">2</span><b>${esc(decNome)}</b></button>
          <button class="fim-turno ${meuTurno && !ui.ocupado && semJogadas(eu) ? "pulsa" : ""}" type="button" data-acao="fim" ${!meuTurno || ui.ocupado ? "disabled" : ""}>${fimTxt}</button>
        </div>
      </div>
      <div class="mao" aria-label="Sua mão">${eu.mao.map(h => {
        const pode = meuTurno && !ui.ocupado && M.infoCarta(G, eu.i, h.uid).pode;
        return `<button class="carta-m ${pode ? "jogavel" : ""} ${ui.maoVista.has(h.uid) ? "" : "nova"}" type="button" data-mao="${h.uid}" aria-label="${esc(h.c.nome)}, custo ${h.c.custo ?? 0}">${svgCarta(h.c, "h" + h.uid)}</button>`; }).join("")}</div>`;
    ui.vistos = vistosAgora; eu.mao.forEach(h => ui.maoVista.add(h.uid));
    posicionarMao(); marcarAlvos();
  }
  function posicionarMao() {
    const mao = arena && arena.querySelector(".mao"); if (!mao) return;
    const cs = [...mao.children], n = cs.length; if (!n) return;
    const W = mao.clientWidth, cw = cs[0].offsetWidth || 100;
    const passo = n > 1 ? Math.min(cw * 0.9, (W - cw) / (n - 1)) : 0, total = cw + passo * (n - 1), ini = (W - total) / 2, meio = (n - 1) / 2;
    cs.forEach((b, k) => { const d = k - meio; b.style.left = (ini + k * passo) + "px"; b.style.transform = `rotate(${d * (n > 5 ? 2.5 : 4)}deg) translateY(${Math.abs(d) * Math.abs(d) * 1.6}px)`; b.style.zIndex = String(k + 1); });
  }
  function marcarAlvos() {
    if (!arena) return;
    const al = ui.alvo;
    arena.querySelectorAll("[data-r]").forEach(el => {
      el.classList.remove("alvo", "amigo", "apagado");
      if (!al) return;
      const r = refDe(el.dataset.r);
      if (al.cands.includes(r)) { el.classList.add("alvo"); const dono = typeof r === "string" ? +r.slice(1) : (M.lacaio(G, r) || {}).dono; if (dono === ui.eu) el.classList.add("amigo"); }
      else if (!(al.marcados || []).includes(r) && r !== ui.sel) el.classList.add("apagado");
    });
    arena.querySelectorAll(".carta-m").forEach(el => el.classList.toggle("apagado", !!al));
  }

  // ---------- animações ----------
  function relRect(el) { const a = raiz.getBoundingClientRect(), b = el.getBoundingClientRect(); return { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height }; }
  function foto() { const f = new Map(); if (arena) arena.querySelectorAll("[data-r]").forEach(el => f.set(String(el.dataset.r), { r: relRect(el), html: el.outerHTML })); return f; }
  function elDe(r) { return arena && arena.querySelector(`[data-r="${r}"]`); }
  function centro(r, ant) { const el = elDe(r); const q = el ? relRect(el) : ant.get(String(r)) && ant.get(String(r)).r; return q ? { x: q.x + q.w / 2, y: q.y + q.h / 2 } : null; }
  function flutua(r, txt, tipo, ant) {
    const c = centro(r, ant); if (!c) return;
    raiz.insertAdjacentHTML("beforeend", `<span class="flutua ${tipo}" style="left:${c.x}px;top:${c.y}px">${esc(txt)}</span>`);
    const el = raiz.lastElementChild; setTimeout(() => el.remove(), 1050);
  }
  function fantasma(r, ant, tipo) {
    if (elDe(r) || !ant.has(String(r))) return;
    const { r: q, html } = ant.get(String(r));
    raiz.insertAdjacentHTML("beforeend", `<div class="fantasma" style="left:${q.x}px;top:${q.y}px;width:${q.w}px;height:${q.h}px">${html}</div>`);
    const el = raiz.lastElementChild; const filho = el.firstElementChild; if (filho) { filho.classList.remove("entrou", "sel", "pode", "alvo"); filho.style.margin = "0"; }
    const k = tipo === "volta" ? [{ transform: "none", opacity: 1 }, { transform: "translateY(-30px) scale(.8)", opacity: 0 }] : [{ transform: "none", opacity: 1, filter: "none" }, { transform: "scale(.6) rotate(-8deg)", opacity: 0, filter: "grayscale(1) brightness(.4)" }];
    const an = el.animate ? el.animate(k, { duration: reduzido() ? 1 : 520, easing: "ease-in", fill: "forwards" }) : null;
    setTimeout(() => el.remove(), 560); return an;
  }
  async function golpe(de, para, ant) {
    const a = centro(de, ant), b = centro(para, ant); if (!a || !b || reduzido()) return;
    let el = elDe(de), temp = null;
    if (!el && ant.has(String(de))) { const { r: q, html } = ant.get(String(de)); raiz.insertAdjacentHTML("beforeend", `<div class="fantasma" style="left:${q.x}px;top:${q.y}px;width:${q.w}px;height:${q.h}px">${html}</div>`); temp = el = raiz.lastElementChild; }
    if (!el || !el.animate) { if (temp) temp.remove(); return; }
    const dx = (b.x - a.x) * 0.72, dy = (b.y - a.y) * 0.72;
    el.style.zIndex = "15";
    const an = el.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(1.08)`, offset: 0.55 }, { transform: "none" }], { duration: 380, easing: "ease-in-out" });
    try { await an.finished; } catch (e) {}
    el.style.zIndex = ""; if (temp) temp.remove();
  }
  function anuncio(c, rot) {
    return new Promise(res => {
      const d = vel().anuncio;
      raiz.insertAdjacentHTML("beforeend", `<div class="anuncio" style="--dur:${d}ms"><span>${esc(rot)}</span>${g.DK.renderCard(c, { id: "an" + Math.random().toString(36).slice(2, 7), arte: arteDaCarta(c.id), size: ["100%", "auto"] })}</div>`);
      const el = raiz.lastElementChild; setTimeout(() => { el.remove(); res(); }, reduzido() ? 600 : d);
    });
  }
  function banner(txt) { raiz.insertAdjacentHTML("beforeend", `<div class="banner-turno">${esc(txt)}</div>`); const el = raiz.lastElementChild; setTimeout(() => el.remove(), 1350); }
  async function atualizar() {
    const ant = ui.foto || new Map(), evs = G.ev.splice(0);
    desenhar();
    for (const ev of evs) {
      switch (ev.t) {
        case "jogou": if (ev.i !== ui.eu) await anuncio(ev.c, `${G.p[ev.i].nome} jogou`); break;
        case "decreto": if (ev.i !== ui.eu) { flutua("h" + ev.i, G.p[ev.i].heroi.decreto || "Decreto", "info", ant); await espera(350); } break;
        case "ataque": await golpe(ev.de, ev.para, ant); break;
        case "dano": flutua(ev.r, "−" + ev.n, "dano", ant); { const el = elDe(ev.r); if (el && el.animate && !reduzido()) el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }], { duration: 220 }); } break;
        case "cura": flutua(ev.r, "+" + ev.n, "cura", ant); break;
        case "armadura": flutua(ev.r, (ev.n > 0 ? "+" : "−") + Math.abs(ev.n) + " armadura", "info", ant); break;
        case "bloqueio": flutua(ev.r, "Couraça", "info", ant); break;
        case "destruido": flutua(ev.r, "Destruído", "info", ant); break;
        case "preso": flutua(ev.r, "Não ataca", "info", ant); break;
        case "morte": fantasma(ev.r, ant, "morte"); break;
        case "volta": fantasma(ev.r, ant, "volta"); break;
        case "queima": flutua("h" + ev.i, `${ev.c.nome}: descartada`, "info", ant); break;
        case "fadiga": flutua("h" + ev.i, "Fadiga", "info", ant); break;
        case "mana": if (ev.i === ui.eu) flutua("h" + ev.i, "+Devoção", "info", ant); break;
      }
    }
    if (evs.some(e => e.t === "dano" || e.t === "morte")) await espera(reduzido() ? 0 : 380);
    ui.foto = foto();
  }

  // ---------- camadas: folha, escolhas, faixa de alvo ----------
  function fecharCamada() { if (!raiz) return; raiz.querySelectorAll(".camada").forEach(x => x.remove()); ui.camada = null; }
  function fecharFaixa() { if (!raiz) return; raiz.querySelectorAll(".faixa-alvo").forEach(x => x.remove()); }
  function camada(html, aoFechar) {
    fecharCamada();
    raiz.insertAdjacentHTML("beforeend", `<div class="camada" role="dialog" aria-modal="true"><div class="folha">${html}</div></div>`);
    const el = raiz.lastElementChild; ui.camada = el;
    el.addEventListener("click", e => { if (e.target === el && aoFechar) { fecharCamada(); aoFechar(); } });
    el.addEventListener("keydown", e => { if (e.key === "Escape" && aoFechar) { fecharCamada(); aoFechar(); } });
    setTimeout(() => { const f = el.querySelector("button"); if (f) f.focus({ preventScroll: true }); }, 30);
    return el;
  }
  function escolherAlvo(o) {
    return new Promise(res => {
      ui.alvo = { cands: o.cands, cancelavel: !!o.cancelavel, marcados: o.marcados || [], resolve: r => { ui.alvo = null; fecharFaixa(); marcarAlvos(); res(r); } };
      fecharFaixa();
      raiz.insertAdjacentHTML("beforeend", `<div class="faixa-alvo" role="status"><p>${esc(o.titulo)}</p>${o.pronto ? `<button class="btn-j" type="button" data-f="pronto">${esc(o.pronto)}</button>` : ""}${o.cancelavel ? `<button class="btn-j sec" type="button" data-f="cancelar">Cancelar</button>` : ""}</div>`);
      const f = raiz.lastElementChild;
      const rio = arena && arena.querySelector(".rio"); if (rio) f.style.setProperty("--rio-y", (relRect(rio).y + relRect(rio).h / 2) + "px");
      f.querySelectorAll("button").forEach(b => b.onclick = e => { e.stopPropagation(); const al = ui.alvo; if (al) al.resolve(b.dataset.f === "pronto" ? "pronto" : null); });
      marcarAlvos();
    });
  }
  function escolherCartas(o) {
    return new Promise(res => {
      let sel = null;
      const el = camada(`<div class="escolha"><h3>${esc(o.titulo)}</h3>${o.texto ? `<p class="sub" style="text-align:left">${esc(o.texto)}</p>` : ""}
        <div class="cartas-e">${o.cartas.map(h => `<button type="button" data-u="${h.uid}" aria-pressed="false" aria-label="${esc(h.c.nome)}">${svgCarta(h.c, "e" + h.uid)}${o.marca && o.marca[h.uid] ? `<small>${esc(o.marca[h.uid])}</small>` : ""}</button>`).join("")}</div>
        <div class="acoes"><button class="btn-j" type="button" data-a="ok" disabled>${esc(o.confirmar || "Confirmar")}</button>${o.cancelavel ? `<button class="btn-j sec" type="button" data-a="x">Cancelar</button>` : ""}</div></div>`, o.cancelavel ? () => res(null) : null);
      const ok = el.querySelector('[data-a="ok"]');
      el.querySelectorAll(".cartas-e button").forEach(b => b.onclick = () => { sel = +b.dataset.u; el.querySelectorAll(".cartas-e button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); ok.disabled = false; });
      ok.onclick = () => { fecharCamada(); res(sel); };
      const x = el.querySelector('[data-a="x"]'); if (x) x.onclick = () => { fecharCamada(); res(null); };
    });
  }
  function perguntar(o) {
    return new Promise(res => {
      const el = camada(`${o.carta ? `<div class="carta-g">${g.DK.renderCard(o.carta, { id: o.chave || "pq", arte: arteDaCarta(o.carta.id), size: ["100%", "auto"] })}</div>` : ""}<h3>${esc(o.titulo)}</h3>${o.texto ? `<p>${esc(o.texto)}</p>` : ""}
        <div class="acoes">${o.opcoes.map(x => `<button class="btn-j ${x.sec ? "sec" : ""}" type="button" data-o="${esc(x.id)}">${esc(x.rot)}</button>`).join("")}${o.cancelar ? `<button class="btn-j sec" type="button" data-o="">Cancelar</button>` : ""}</div>`, o.cancelar ? () => res(null) : null);
      el.querySelectorAll("[data-o]").forEach(b => b.onclick = () => { fecharCamada(); res(b.dataset.o || null); });
    });
  }
  function kwExplica(kws, extra = []) {
    const linhas = [...new Set(kws)].filter(k => M.KW_TXT[k]).map(k => `<p><b>${esc(k)}.</b> ${esc(M.KW_TXT[k])}</p>`).concat(extra);
    return linhas.length ? `<div class="kw-ex">${linhas.join("")}</div>` : "";
  }
  function abrirCartaMao(uid) {
    const p = G.p[ui.eu], h = p.mao.find(x => x.uid === uid); if (!h) return;
    const info = M.infoCarta(G, ui.eu, uid), c = h.c;
    const extra = [];
    if (info.ef && info.ef.brasa) extra.push(`<p><b>Brasa.</b> Ao lançar, você pode sacrificar um lacaio seu para usar a segunda linha da carta.</p>`);
    if (!info.programado) extra.push(`<p class="motivo">O efeito escrito nesta carta ainda não foi programado no jogo digital. Ela entra só com custo, ataque, vida e palavras-chave.</p>`);
    const el = camada(`<div class="carta-g">${svgCarta(c, "pv" + uid)}</div>
      <div class="estado"><span>Custo <b>${c.custo ?? 0}</b> · você tem <b>${p.mana}</b> de Devoção</span></div>
      ${info.pode ? "" : `<p class="motivo">${esc(info.motivo)}</p>`}${kwExplica(c.kws || [], extra)}
      <div class="acoes">${info.pode && !ui.ocupado ? `<button class="btn-j" type="button" data-a="jogar">Jogar</button>` : ""}<button class="btn-j sec" type="button" data-a="x">Fechar</button></div>`, () => {});
    const j = el.querySelector('[data-a="jogar"]'); if (j) j.onclick = () => fluxoJogar(uid);
    el.querySelector('[data-a="x"]').onclick = fecharCamada;
  }
  function abrirLacaio(uid) {
    const m = M.lacaio(G, uid); if (!m) return;
    const A = M.ataque(G, m), kws = [...m.kws]; if (M.temKw(G, m, "Couraça") && !kws.includes("Couraça")) kws.push("Couraça");
    const est = [`<span>Agora: ataque <b>${A}</b> · vida <b>${m.hp}</b> de ${m.maxhp}${m.hp < m.maxhp ? " (ferido)" : ""}</span>`];
    if (m.naoAtaca) est.push(`<span>Não pode atacar no próximo turno do dono.</span>`);
    if (M.temKw(G, m, "Couraça") && !m.kws.includes("Couraça")) est.push(`<span>Tem Couraça por causa de Hagen.</span>`);
    const mot = m.dono === ui.eu && G.vez === ui.eu ? M.motivoNaoAtaca(G, m) : "";
    const pode = m.dono === ui.eu && M.podeAtacar(G, m) && !ui.ocupado;
    const el = camada(`<div class="carta-g">${svgCarta(m.c, "pl" + uid)}</div><div class="estado">${est.join("")}</div>${mot ? `<p class="motivo">${esc(mot)}</p>` : ""}${kwExplica(kws)}
      <div class="acoes">${pode ? `<button class="btn-j" type="button" data-a="atk">Atacar</button>` : ""}<button class="btn-j sec" type="button" data-a="x">Fechar</button></div>`, () => {});
    const a = el.querySelector('[data-a="atk"]'); if (a) a.onclick = () => { fecharCamada(); fluxoAtaque(uid); };
    el.querySelector('[data-a="x"]').onclick = fecharCamada;
  }
  function abrirHeroi(i) {
    const p = G.p[i], dec = M.infoDecreto(G, i), meu = i === ui.eu;
    const el = camada(`<div class="carta-g">${svgCarta(p.heroi, "ph" + i)}</div>
      <div class="estado"><span>Vida <b>${p.hp}</b> de 20${p.armadura ? ` · armadura <b>${p.armadura}</b>` : ""} · Devoção <b>${p.mana}/${p.max}</b></span><span>Deck <b>${p.deck.length}</b> · mão <b>${p.mao.length}</b>${p.casa === "Morvhal" ? ` · Vazios <b>${p.aux}</b>` : ""}${p.fadiga ? ` · fadiga ${p.fadiga}×` : ""}</span></div>
      <p><b>Decreto: ${esc(p.heroi.decreto || dec.d.nome)}.</b> ${esc(p.heroi.decreto_txt || dec.d.txt)} Custa 2 de Devoção, uma vez por turno.</p>
      ${meu && !dec.pode ? `<p class="motivo">${esc(dec.motivo)}</p>` : ""}
      <div class="acoes">${meu && dec.pode && !ui.ocupado ? `<button class="btn-j" type="button" data-a="dec">Usar o Decreto</button>` : ""}<button class="btn-j sec" type="button" data-a="x">Fechar</button></div>`, () => {});
    const d = el.querySelector('[data-a="dec"]'); if (d) d.onclick = () => fluxoDecreto();
    el.querySelector('[data-a="x"]').onclick = fecharCamada;
  }
  function abrirMenu() {
    const regras = Object.entries(M.KW_TXT).map(([k, t]) => `<p><b>${esc(k)}.</b> ${esc(t)}</p>`).join("") +
      `<p><b>Brasa.</b> Magias de Morvhal ficam mais fortes se você sacrificar um lacaio seu ao lançá-las.</p><p><b>Ferido.</b> Lacaio com menos vida que o máximo.</p><p><b>Combate.</b> Atacante e defensor causam dano um ao outro ao mesmo tempo. O herói atacado não revida. A armadura absorve o dano antes da vida.</p>`;
    const log = G ? [...G.log].reverse().slice(0, 120).map(l => `<p><span class="t">T${Math.ceil(l.turno / 2) || 0}</span>${esc(l.t)}</p>`).join("") : "";
    const el = camada(`<h3>Menu da partida</h3>
      <div class="acoes"><button class="btn-j" type="button" data-a="x">Continuar</button><button class="btn-j sec" type="button" data-a="log">Registro</button><button class="btn-j sec" type="button" data-a="reg">Regras rápidas</button></div>
      <div data-p="log" hidden><div class="registro">${log || "<p>Nada ainda.</p>"}</div></div>
      <div data-p="reg" hidden><div class="regras-r">${regras}</div></div>
      <div class="acoes"><button class="btn-j perigo" type="button" data-a="sair">Abandonar a partida</button>${SEM_OFICINA ? "" : `<button class="btn-j sec" type="button" data-a="ofc">Voltar à Oficina</button>`}</div>
      ${SEM_OFICINA ? "" : `<p class="nota" style="text-align:left">Voltar à Oficina guarda a partida: ela continua quando você abrir o jogo de novo.</p>`}`, () => {});
    el.querySelector('[data-a="x"]').onclick = fecharCamada;
    el.querySelector('[data-a="log"]').onclick = () => { const p = el.querySelector('[data-p="log"]'); p.hidden = !p.hidden; };
    el.querySelector('[data-a="reg"]').onclick = () => { const p = el.querySelector('[data-p="reg"]'); p.hidden = !p.hidden; };
    const s = el.querySelector('[data-a="sair"]');
    s.onclick = () => { if (!s.dataset.ok) { s.dataset.ok = "1"; s.textContent = "Confirmar: abandonar"; return; } ui.sessao++; G = null; telaMenu(); };
    if (!SEM_OFICINA) el.querySelector('[data-a="ofc"]').onclick = () => { fecharCamada(); sair(); };
  }

  // ---------- fluxos do jogador ----------
  async function fluxoJogar(uid) {
    fecharCamada();
    if (ui.ocupado) return;
    const i = ui.eu, p = G.p[i], info = M.infoCarta(G, i, uid); if (!info.pode) return;
    const esc_ = {}, c = info.c;
    if (info.ef.brasa && info.sacs.length) {
      const r = await perguntar({ titulo: `${c.nome}: usar brasa?`, texto: `Com brasa: ${c.brasa_txt || "o efeito sobe um degrau."} O preço é sacrificar um lacaio seu.`, opcoes: [{ id: "nao", rot: "Sem brasa", sec: true }, { id: "sim", rot: "Sacrificar um lacaio" }], cancelar: true });
      if (r == null) return;
      if (r === "sim") { const s = await escolherAlvo({ cands: info.sacs, titulo: "Brasa: escolha o lacaio seu que será sacrificado", cancelavel: true }); if (s == null) return; esc_.sac = s; }
    }
    if (info.modos) { const r = await perguntar({ titulo: c.nome, texto: "Você tem 6 de armadura ou mais. Como quer usar o contrato?", opcoes: info.modos.map(m => ({ id: m.id, rot: m.rot })), cancelar: true }); if (r == null) return; esc_.modo = r; }
    if (info.ef.descarte && info.descartes.length) {
      const r = await escolherCartas({ titulo: info.ef.descarte === "custo" ? "Custo adicional: escolha uma carta da mão para descartar" : "Escolha uma carta da mão para descartar", cartas: p.mao.filter(h => h.uid !== uid), confirmar: "Descartar esta", cancelavel: true });
      if (r == null) return; esc_.descarte = r;
    }
    const spec = info.spec({ brasa: esc_.sac != null });
    if (spec) {
      const cands = M.candidatos(G, p, spec, esc_.sac != null ? [esc_.sac] : []);
      if (cands.length) {
        const alvos = [];
        if (spec.auto && cands.length === 1) alvos.push(cands[0]);
        else for (let k = 0; k < (spec.n || 1); k++) {
          const rest = cands.filter(r => !alvos.includes(r)); if (!rest.length) break;
          const r = await escolherAlvo({ cands: rest, titulo: spec.titulo + ((spec.n || 1) > 1 ? ` · ${k + 1} de ${spec.n}` : ""), cancelavel: true, pronto: alvos.length >= (spec.min || 1) ? "Pronto" : null, marcados: alvos });
          if (r === "pronto") break; if (r == null) { desenhar(); return; } alvos.push(r);
        }
        esc_.alvos = alvos;
      } else if (spec.obrig) return;
    }
    await acao(() => M.jogarCarta(G, i, uid, esc_));
  }
  async function fluxoDecreto() {
    fecharCamada();
    if (ui.ocupado) return;
    const i = ui.eu, p = G.p[i], info = M.infoDecreto(G, i);
    if (!info.pode) { abrirHeroi(i); return; }
    const esc_ = {};
    if (info.d.descarte) { const r = await escolherCartas({ titulo: `${p.heroi.decreto || info.d.nome}: escolha uma carta da mão para descartar`, cartas: [...p.mao], confirmar: "Descartar e comprar outra", cancelavel: true }); if (r == null) return; esc_.descarte = r; }
    if (info.spec) { const r = await escolherAlvo({ cands: M.candidatos(G, p, info.spec), titulo: info.spec.titulo, cancelavel: true }); if (r == null) return; esc_.alvos = [r]; }
    await acao(() => M.usarDecreto(G, i, esc_));
  }
  async function fluxoAtaque(uid) {
    const m = M.lacaio(G, uid); if (!m || !M.podeAtacar(G, m) || ui.ocupado) return;
    const cands = M.alvosDeAtaque(G, m), prov = cands.length && !cands.some(r => typeof r === "string");
    ui.sel = uid; desenhar();
    const r = await escolherAlvo({ cands, titulo: `${m.c.nome}: escolha o alvo do ataque${prov ? ". Há lacaios com Provocar: eles precisam ser atacados primeiro" : ""}`, cancelavel: true });
    ui.sel = null;
    if (r == null) { desenhar(); return; }
    await acao(() => M.atacar(G, ui.eu, uid, r));
  }

  function fimDeJogo() {
    ui.ocupado = true; ui.alvo = null; fecharFaixa(); desenhar();
    const v = G.vencedor;
    const robo = ui.cfg.modo === "robo";
    const res = v === "empate" ? "Empate" : robo ? (v === 0 ? "Vitória" : "Derrota") : `${G.p[v].nome} venceu`;
    const sub = v === "empate" ? "Os dois heróis caíram ao mesmo tempo." : `${G.p[v].casa} derrubou ${G.p[1 - v].heroi.nome} em ${Math.ceil(G.turno / 2)} ${Math.ceil(G.turno / 2) === 1 ? "turno" : "turnos"}.`;
    const el = camada(`<div class="fim"><p class="resultado">${esc(res)}</p></div><p class="sub" style="text-align:center">${esc(sub)}</p>
      <div class="acoes"><button class="btn-j" type="button" data-a="rev">Revanche (mesmas casas)</button><button class="btn-j sec" type="button" data-a="novo">Nova partida</button></div>
      <div class="acoes"><button class="btn-j sec" type="button" data-a="log">Ver registro</button>${SEM_OFICINA ? "" : `<button class="btn-j sec" type="button" data-a="ofc">Voltar à Oficina</button>`}</div>
      <div data-p="log" hidden><div class="registro">${[...G.log].reverse().map(l => `<p><span class="t">T${Math.ceil(l.turno / 2) || 0}</span>${esc(l.t)}</p>`).join("")}</div></div>`, null);
    el.querySelector('[data-a="rev"]').onclick = () => { const casas = ui.casas; G = null; novaPartida(casas); };
    el.querySelector('[data-a="novo"]').onclick = () => { ui.sessao++; G = null; telaMenu(); };
    el.querySelector('[data-a="log"]').onclick = () => { const p = el.querySelector('[data-p="log"]'); p.hidden = !p.hidden; };
    if (!SEM_OFICINA) el.querySelector('[data-a="ofc"]').onclick = () => { G = null; fecharCamada(); sair(); };
  }

  // ---------- cliques ----------
  function aoClicar(e) {
    if (e.target.closest(".camada, .passe, .faixa-alvo, .tela")) return;
    const t = e.target.closest("[data-r], [data-mao], [data-acao]");
    if (ui.alvo) {
      if (t && t.dataset.r != null) { const r = refDe(t.dataset.r); if (ui.alvo.cands.includes(r)) { ui.alvo.resolve(r); return; } }
      if (ui.alvo.cancelavel) ui.alvo.resolve(null);
      return;
    }
    if (!t || !G) return;
    if (t.dataset.acao === "menu") return abrirMenu();
    if (t.dataset.acao === "fim") return encerrar();
    if (t.dataset.acao === "decreto") { if (!ui.ocupado && G.vez === ui.eu && M.infoDecreto(G, ui.eu).pode) fluxoDecreto(); else abrirHeroi(ui.eu); return; }
    if (t.dataset.mao != null) return abrirCartaMao(+t.dataset.mao);
    if (t.dataset.r != null) {
      const r = refDe(t.dataset.r);
      if (typeof r === "string") return abrirHeroi(+r.slice(1));
      const m = M.lacaio(G, r);
      if (m && m.dono === ui.eu && G.vez === ui.eu && !ui.ocupado && M.podeAtacar(G, m)) return fluxoAtaque(r);
      return abrirLacaio(r);
    }
  }

  function abrir(el) {
    raiz = el; raiz.hidden = false;
    if (!raiz.dataset.pronto) {
      raiz.dataset.pronto = "1";
      raiz.addEventListener("click", aoClicar);
      g.addEventListener("resize", () => { if (arena) posicionarMao(); });
    }
    if (G && !G.fim && arena) { raiz.querySelectorAll(".tela").forEach(x => x.remove()); desenhar(); return; }
    if (!raiz.querySelector(".tela")) telaMenu();
  }
  function fechar() { if (raiz) raiz.hidden = true; }
  g.DKJ.Tela = { abrir, fechar, _estado: () => ({ G, ui }) };
})(typeof window !== "undefined" ? window : globalThis);
