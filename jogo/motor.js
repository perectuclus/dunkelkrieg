/* Dunkelkrieg — motor de regras v0.5 (jogo digital).
   Regras da partida e efeitos das cartas. Não desenha nada: a tela (tela.js) e o robô (robo.js) usam estas funções.
   Os efeitos ficam ligados ao identificador da carta (id), que não muda quando a carta é renomeada na Oficina.
   Custo, ataque, vida e palavras-chave vêm dos dados da carta, então edições da Oficina valem na hora.
   Números dentro dos textos (ex.: "cause 3 de dano") estão aqui no motor. */
(function (g) {
  "use strict";
  const slug = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const ID = (casa, nome) => slug(casa) + "-" + slug(nome);
  const CASAS = ["Morvhal", "Hauksval", "Valdoren", "Durnheim", "Aethelmar"];
  const R = { VIDA: 20, MESA: 5, MAO: 8, DEV_MAX: 8, FADIGA: 2, VAZIOS: 10, DECRETO: 2 };
  const KW_TXT = {
    "Investida": "Pode atacar no turno em que entra na mesa.",
    "Provocar": "O adversário precisa atacar este lacaio antes do herói ou de outros lacaios.",
    "Fogo Negro": "Qualquer dano que este lacaio causar a um lacaio o destrói.",
    "Distância": "Ao atacar um lacaio, não recebe o dano de volta.",
    "Falange": "Quando é atacado por um lacaio, causa seu dano primeiro. Se o atacante morrer, não recebe dano.",
    "Couraça": "Recebe 1 de dano a menos de cada ataque de lacaio. Magias e efeitos causam o dano inteiro.",
    "Maré": "Ao entrar na mesa, olhe as 2 cartas do topo do seu deck: uma vai para a mão, a outra para o fundo.",
  };

  // ---------- utilidades ----------
  function rngDe(seed) {
    let a = seed >>> 0;
    return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function embaralhar(G, arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(G.rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  const inst = (G, c) => ({ uid: G.uid++, c });
  const vivos = mesa => mesa.filter(m => m.hp > 0);
  function log(G, t) { G.log.push({ turno: G.turno, t }); if (G.log.length > 400) G.log.shift(); }
  const nomeP = p => p.nome;

  function naCaixa(c) { return !c._lab || c.na_caixa; }
  function montarDeck(lista, casa) {
    const d = [];
    for (const c of lista) if (c.casa === casa && c.tipo !== "Herói" && naCaixa(c)) for (let k = 0; k < (+c.base || 0); k++) d.push(c);
    return d;
  }
  const FICHA_VAZIO = { id: "fichas-vazio", casa: "*", nome: "Vazio", tipo: "Lacaio", custo: 0, atk: 1, vida: 1, kws: [], texto: "" };
  const FICHA_VELA = { id: "fichas-vela", casa: "*", nome: "Vela", tipo: "Magia", custo: 0, kws: [], texto: "Ganhe 1 de Devoção neste turno." };

  // ---------- consultas ----------
  function lacaio(G, uid) { for (const p of G.p) { const m = p.mesa.find(x => x.uid === uid); if (m) return m; } return null; }
  function achar(G, r) {
    if (typeof r === "string" && r[0] === "h") return { heroi: G.p[+r.slice(1)] };
    const m = lacaio(G, r); return m && m.hp > 0 ? { m } : null;
  }
  function temKw(G, m, k) {
    if (m.kws.includes(k)) return true;
    if (k === "Couraça") return G.p[m.dono].mesa.some(x => x !== m && x.hp > 0 && x.c.id === C.HAGEN);
    return false;
  }
  function ataque(G, m) {
    let a = m.atk + m.tmp;
    if (G.p[m.dono].mesa.some(x => x !== m && x.hp > 0 && x.c.id === C.CAPITA)) a += 1;
    return Math.max(0, a);
  }
  const ferido = m => m.hp < m.maxhp;

  // ---------- dano, cura e mesa ----------
  function danoLacaio(G, m, n, o = {}) {
    if (!m || n <= 0 || m.hp <= 0) return 0;
    if (o.combate && temKw(G, m, "Couraça")) n -= 1;
    if (n <= 0) { G.ev.push({ t: "bloqueio", r: m.uid }); return 0; }
    m.hp -= n; if (o.fogo) m.hp = Math.min(m.hp, 0);
    G.ev.push({ t: "dano", r: m.uid, n, fogo: !!o.fogo }); return n;
  }
  function danoHeroi(G, p, n) {
    if (n <= 0) return;
    const a = Math.min(p.armadura, n); p.armadura -= a; p.hp -= (n - a);
    G.ev.push({ t: "dano", r: "h" + p.i, n }); checarFim(G);
  }
  function dano(G, r, n, o) { const x = achar(G, r); if (!x) return 0; if (x.m) return danoLacaio(G, x.m, n, o); danoHeroi(G, x.heroi, n); return n; }
  function destruir(G, m) { if (!m || m.hp <= 0) return; m.hp = 0; G.ev.push({ t: "destruido", r: m.uid }); }
  function curarHeroi(G, p, n) {
    const act = Math.min(n, R.VIDA - p.hp);
    if (act > 0) {
      p.hp += act; G.ev.push({ t: "cura", r: "h" + p.i, n: act });
      for (const m of p.mesa) if (m.hp > 0 && m.c.id === C.PEREGRINO) { m.atk++; m.hp++; m.maxhp++; G.ev.push({ t: "buff", r: m.uid }); }
    }
    return act;
  }
  function curarLacaio(G, m, n) { if (!m || m.hp <= 0) return 0; const act = Math.min(n, m.maxhp - m.hp); if (act > 0) { m.hp += act; G.ev.push({ t: "cura", r: m.uid, n: act }); } return act; }
  function curar(G, r, n) { const x = achar(G, r); if (!x) return 0; return x.m ? curarLacaio(G, x.m, n) : curarHeroi(G, x.heroi, n); }
  function fortalecer(G, m, a, v) { if (!m || m.hp <= 0) return; m.atk += a; m.hp += v; m.maxhp += v; G.ev.push({ t: "buff", r: m.uid }); }
  function armadura(G, p, n) { p.armadura += n; G.ev.push({ t: "armadura", r: "h" + p.i, n }); }

  function invocar(G, p, c, ficha = false) {
    if (vivos(p.mesa).length >= R.MESA) return null;
    if (ficha) { if (p.aux <= 0) return null; p.aux--; }
    const m = { uid: G.uid++, c, dono: p.i, atk: +c.atk || 0, hp: Math.max(1, +c.vida || 1), maxhp: Math.max(1, +c.vida || 1), kws: [...(c.kws || [])],
      enjoo: true, atacou: false, naoAtaca: false, tmp: 0, ficha };
    p.mesa.push(m); G.ev.push({ t: "entra", r: m.uid }); return m;
  }
  function invocarVazio(G, p) { const m = invocar(G, p, G.vazio, true); if (m) log(G, `${nomeP(p)} invocou um Vazio.`); return m; }

  async function comprar(G, p, n = 1) {
    for (let k = 0; k < n; k++) {
      if (G.fim) return;
      if (!p.deck.length) {
        p.fadiga++; log(G, `${nomeP(p)} está sem cartas no deck: fadiga, 2 de dano no herói.`);
        G.ev.push({ t: "fadiga", i: p.i }); danoHeroi(G, p, R.FADIGA); continue;
      }
      const h = p.deck.pop();
      if (p.mao.length >= R.MAO) {
        let fora = h.uid;
        if (G.vez === p.i && G.fase === "jogo") {
          const r = await G.escolher(G, p.i, { tipo: "mao_cheia", nova: h, mao: [...p.mao], titulo: "Mão cheia: escolha a carta que vai para o descarte" });
          if (r != null && (r === h.uid || p.mao.some(x => x.uid === r))) fora = r;
        }
        if (fora === h.uid) { log(G, `${nomeP(p)} comprou com a mão cheia e descartou ${h.c.nome}.`); G.ev.push({ t: "queima", i: p.i, c: h.c }); continue; }
        const x = p.mao.find(y => y.uid === fora); p.mao.splice(p.mao.indexOf(x), 1);
        log(G, `${nomeP(p)} descartou ${x.c.nome} para ficar com a carta comprada.`);
      }
      p.mao.push(h); G.ev.push({ t: "compra", i: p.i, uid: h.uid });
    }
  }
  function paraMao(G, m) {
    const p = G.p[m.dono], k = p.mesa.indexOf(m);
    if (k < 0 || m.hp <= 0) return;
    p.mesa.splice(k, 1); G.ev.push({ t: "volta", r: m.uid, i: p.i });
    if (m.ficha) { p.aux++; log(G, `O Vazio de ${nomeP(p)} voltou ao deck auxiliar.`); return; }
    if (p.mao.length < R.MAO) { p.mao.push(inst(G, m.c)); log(G, `${m.c.nome} voltou à mão de ${nomeP(p)}.`); }
    else log(G, `${m.c.nome} voltaria à mão de ${nomeP(p)}, mas a mão está cheia: foi para o descarte.`);
  }
  function aoMorrer(G, m) {
    const p = G.p[m.dono];
    if (m.c.id === C.ANDARILHO) invocarVazio(G, p);
    if (m.c.id === C.PORTADOR) for (const e of [...G.p[1 - m.dono].mesa]) danoLacaio(G, e, 1);
  }
  function limpar(G) {
    let mud = true;
    while (mud) {
      mud = false;
      for (const p of G.p) {
        const mortos = p.mesa.filter(m => m.hp <= 0);
        for (const m of mortos) {
          p.mesa.splice(p.mesa.indexOf(m), 1); mud = true;
          if (m.ficha) p.aux++;
          G.ev.push({ t: "morte", r: m.uid, i: p.i }); log(G, `${m.c.nome} (${nomeP(p)}) morreu.`);
          aoMorrer(G, m);
        }
      }
    }
    checarFim(G);
  }
  async function sacrificar(G, p, m) {
    const k = p.mesa.indexOf(m); if (k < 0 || m.hp <= 0) return false;
    p.mesa.splice(k, 1); if (m.ficha) p.aux++;
    G.ev.push({ t: "morte", r: m.uid, i: p.i, sac: true }); log(G, `${nomeP(p)} sacrificou ${m.c.nome}.`);
    aoMorrer(G, m);
    for (const x of p.mesa) if (x.hp > 0 && x.c.id === C.OUVINTE) fortalecer(G, x, 1, 1);
    const vesnas = p.mesa.filter(x => x.hp > 0 && x.c.id === C.VESNA).length;
    if (vesnas) await comprar(G, p, vesnas);
    limpar(G); return true;
  }
  function checarFim(G) {
    if (G.fim) return;
    const a = G.p[0].hp <= 0, b = G.p[1].hp <= 0;
    if (a || b) { G.fim = true; G.vencedor = a && b ? "empate" : a ? 1 : 0; G.ev.push({ t: "fim" }); log(G, a && b ? "Os dois heróis caíram: empate." : `${nomeP(G.p[G.vencedor])} venceu.`); }
  }
  async function olharTopo(G, p, k, tipo, titulo) {
    const top = []; for (let j = 0; j < k && p.deck.length; j++) top.push(p.deck.pop());
    if (!top.length) return;
    let fica = top[0].uid;
    if (top.length > 1) { const r = await G.escolher(G, p.i, { tipo, cartas: top, titulo }); if (top.some(x => x.uid === r)) fica = r; }
    const h = top.find(x => x.uid === fica);
    if (p.mao.length < R.MAO) { p.mao.push(h); G.ev.push({ t: "compra", i: p.i, uid: h.uid }); } else log(G, `${h.c.nome} foi para o descarte: mão cheia.`);
    for (const x of top) if (x !== h) p.deck.unshift(x);
    log(G, `${nomeP(p)} olhou ${top.length} cartas do topo, ficou com uma e pôs ${top.length - 1 === 1 ? "a outra" : "as outras"} no fundo.`);
  }
  const mare = (G, p) => olharTopo(G, p, 2, "mare", "Maré: escolha a carta que vai para a mão (a outra vai para o fundo do deck)");

  // ---------- alvos ----------
  // spec: { tipos: "lacaio" | "personagem", lado: "todos" | "inimigo" | "aliado", filtro(G,p,m), n, min, titulo, obrig }
  function candidatos(G, p, s, excl = []) {
    if (!s) return [];
    const o = G.p[1 - p.i]; let ms = [];
    if (s.lado !== "aliado") ms.push(...o.mesa);
    if (s.lado !== "inimigo") ms.push(...p.mesa);
    const r = ms.filter(m => m.hp > 0 && !excl.includes(m.uid) && (!s.filtro || s.filtro(G, p, m))).map(m => m.uid);
    if (s.tipos === "personagem") { if (s.lado !== "aliado") r.push("h" + o.i); if (s.lado !== "inimigo") r.push("h" + p.i); }
    return r;
  }
  const LAC = (titulo, lado = "todos", extra = {}) => ({ tipos: "lacaio", lado, n: 1, min: 1, titulo, ...extra });
  const PERS = (titulo, lado = "todos", extra = {}) => ({ tipos: "personagem", lado, n: 1, min: 1, titulo, ...extra });
  const alvo1 = (G, ctx) => { const r = ctx.alvos[0]; const x = r != null ? achar(G, r) : null; return x && x.m ? x.m : null; };

  // ---------- identificadores das cartas com efeito ----------
  const C = {};
  const def = (k, casa, nome) => { C[k] = ID(casa, nome); };
  [["ANDARILHO", "Morvhal", "Andarilho do Eco"], ["OUVINTE", "Morvhal", "Ouvinte do Poço"], ["CORO", "Morvhal", "Coro dos Ouvintes"], ["POCO", "Morvhal", "Poço da Lua"],
   ["VESNA", "Morvhal", "Vesna, a Ouvinte de Cinza"], ["DRAVEK", "Morvhal", "Mestre Dravek"], ["GOLPE_BRASA", "Morvhal", "Golpe da Brasa"], ["CEIFAR", "Morvhal", "Ceifar"],
   ["SUSSURRO", "Morvhal", "Sussurro"], ["DIZIMO", "Morvhal", "Dízimo de Sangue"], ["APAGAR", "Morvhal", "Apagar a Vela Negra"], ["CARGA", "Morvhal", "Carga Noturna"],
   ["OLHAR", "Morvhal", "Olhar do Rei"], ["JURAMENTO", "Morvhal", "Juramento da Brasa"], ["NOITE", "Morvhal", "Noite das Lâmpadas Apagadas"], ["CHAMAS", "Morvhal", "Chamas do Exunus"],
   ["PATRULHEIRO", "Hauksval", "Patrulheiro da Floresta"], ["CACADOR_OUV", "Hauksval", "Caçador de Ouvintes"], ["PORTADOR", "Hauksval", "Portador da Lanterna"],
   ["OLHO", "Hauksval", "Olho de Hadric"], ["YSRA", "Hauksval", "Ysra Vorhalt"], ["FLECHA_LUZ", "Hauksval", "Flecha de Luz"], ["TIRO", "Hauksval", "Tiro Certeiro"],
   ["PERFURANTE", "Hauksval", "Flecha Perfurante"], ["DUPLO", "Hauksval", "Disparo Duplo"], ["CHUVA", "Hauksval", "Chuva de Flechas"], ["VEMOS", "Hauksval", "Vemos Antes"],
   ["MARCA", "Hauksval", "Marca do Caçador"], ["LANTERNA", "Hauksval", "Flecha da Lanterna"], ["RAJADA", "Hauksval", "Rajada Final"],
   ["CAMPONESA", "Valdoren", "Camponesa de Brennholt"], ["PEREGRINO", "Valdoren", "Peregrino de Lúmen"], ["CLERIGO", "Valdoren", "Clérigo de Valdoren"],
   ["PORTADORA", "Valdoren", "Portadora da Lâmpada"], ["DEFENSOR", "Valdoren", "Defensor do Forte do Senn"], ["LAMPADA", "Valdoren", "A Lâmpada de Lúmen"],
   ["CAMPEAO", "Valdoren", "Campeão do Celeiro"], ["BENCAO", "Valdoren", "Bênção da Luz"], ["ESCUDO_FE", "Valdoren", "Escudo da Fé"], ["PAO", "Valdoren", "Pão da Colheita"],
   ["JULGAMENTO", "Valdoren", "Julgamento da Luz"], ["SENTENCA", "Valdoren", "Sentença do Concílio"], ["LANCAS", "Valdoren", "Lanças Erguidas"],
   ["LUZ_LUMEN", "Valdoren", "Luz de Lúmen"], ["LAMPADAS_ACESAS", "Valdoren", "Lâmpadas Acesas"], ["VIGILIA", "Valdoren", "Vigília no Templo"],
   ["FERREIRO", "Durnheim", "Ferreiro da Forja"], ["DESERTOR", "Durnheim", "Desertor de Durnheim"], ["SARGENTO", "Durnheim", "Sargento Veterano"],
   ["NOBRE", "Durnheim", "Nobre do Meio-Convite"], ["FORJADOR", "Durnheim", "Forjador de Lâminas"], ["CATAPULTA", "Durnheim", "Catapulta"],
   ["HAGEN", "Durnheim", "Hagen, o Sargento do Vau"], ["ESCUDO_ACO", "Durnheim", "Escudo de Aço"], ["DESMORONAMENTO", "Durnheim", "Desmoronamento"],
   ["ESCUDADA", "Durnheim", "Escudada"], ["MARTELO", "Durnheim", "Golpe de Martelo"], ["BARRAGEM", "Durnheim", "Barragem de Cerco"],
   ["QUEDA", "Durnheim", "Queda da Montanha"], ["CONTRATO", "Durnheim", "Contrato de Ferro"], ["FORJA_REI", "Durnheim", "Forja do Rei"],
   ["PESCADOR", "Aethelmar", "Pescador do Mar de Maren"], ["CONTRABANDISTA", "Aethelmar", "Contrabandista da Fronteira"], ["CORSARIO", "Aethelmar", "Corsário da Coroa"],
   ["CACADOR_CONTRA", "Aethelmar", "Caçador de Contrabandistas"], ["CAPITA", "Aethelmar", "Capitã da Frota"], ["PALADINA", "Aethelmar", "A Paladina da Fenda"],
   ["MARE_ALTA", "Aethelmar", "Maré Alta"], ["ABORDAGEM", "Aethelmar", "Abordagem"], ["SALVA", "Aethelmar", "Salva de Canhões"], ["CARGA_SUL", "Aethelmar", "Carga do Sul"],
   ["CAMBIO", "Aethelmar", "Câmbio do Cais"], ["LANTERNAS", "Aethelmar", "Lanternas sob Panos Negros"], ["BLOQUEIO", "Aethelmar", "Bloqueio Naval"],
   ["CASCO", "Aethelmar", "Reforçar o Casco"], ["CORRENTE", "Aethelmar", "Corrente de Maren"], ["MAR_COBRA", "Aethelmar", "O Mar Cobra"],
  ].forEach(x => def(...x));
  C.VELA = "fichas-vela";
  // cartas cujo texto é um gatilho tratado direto nas regras (ao morrer, início/fim de turno, auras)
  const PASSIVOS = new Set([C.ANDARILHO, C.OUVINTE, C.POCO, C.VESNA, C.PORTADOR, C.PEREGRINO, C.PORTADORA, C.LAMPADA, C.CATAPULTA, C.HAGEN, C.CAPITA, "fichas-vazio"]);

  // ---------- efeitos ----------
  // alvo(G,p,ctx): spec ou null · bc(G,p,m,ctx): ao entrar · fx(G,p,ctx): magia · brasa: magia de Morvhal com versão de sacrifício
  // descarte: "custo" (obrigatório) ou "efeito" · modos(G,p): lista de modos
  const EF = {};
  const danoUm = (n, titulo) => ({ alvo: () => LAC(titulo, "todos", { obrig: true }), fx: (G, p, ctx) => { danoLacaio(G, alvo1(G, ctx), n); } });
  const bcDano = (n, titulo) => ({ alvo: () => LAC(titulo), bc: (G, p, m, ctx) => { danoLacaio(G, alvo1(G, ctx), n); } });
  const area = (n, lado) => ({ fx: (G, p) => { const o = G.p[1 - p.i]; const ms = lado === "inimigo" ? [...o.mesa] : [...o.mesa, ...p.mesa]; for (const m of ms) danoLacaio(G, m, n); } });
  const curaHeroiBc = n => ({ bc: (G, p) => { curarHeroi(G, p, n); } });
  const buffUm = (a, v, titulo, kw) => ({ alvo: () => LAC(titulo, "todos", { obrig: true }), fx: (G, p, ctx) => { const m = alvo1(G, ctx); fortalecer(G, m, a, v); if (m && kw && !m.kws.includes(kw)) m.kws.push(kw); } });

  // Morvhal
  EF[C.CORO] = { alvo: () => LAC("Coro dos Ouvintes: escolha um lacaio inimigo, ele perde 2 de ataque", "inimigo"), bc: (G, p, m, ctx) => { const t = alvo1(G, ctx); if (t) { t.atk -= 2; G.ev.push({ t: "debuff", r: t.uid }); } } };
  EF[C.DRAVEK] = { bc: async (G, p, m) => {
    const outros = p.mesa.filter(x => x !== m && x.hp > 0); const k = outros.length;
    for (const x of outros) await sacrificar(G, p, x);
    for (let j = 0; j < k && !G.fim; j++) {
      const vs = vivos(G.p[1 - p.i].mesa); if (!vs.length) break;
      const r = await G.escolher(G, p.i, { tipo: "alvo", alvos: vs.map(x => x.uid), titulo: `Mestre Dravek: escolha um lacaio inimigo para receber 2 de dano (${j + 1} de ${k})`, dano: 2 });
      danoLacaio(G, lacaio(G, r) || vs[0], 2); limpar(G);
    }
  } };
  EF[C.GOLPE_BRASA] = { brasa: true, alvo: () => LAC("Golpe da Brasa: escolha um lacaio", "todos", { obrig: true }), fx: (G, p, ctx) => { danoLacaio(G, alvo1(G, ctx), ctx.brasa ? 5 : 3); } };
  EF[C.CEIFAR] = { brasa: true, alvo: () => LAC("Ceifar: escolha um lacaio", "todos", { obrig: true }), fx: (G, p, ctx) => { const t = alvo1(G, ctx); if (ctx.brasa) destruir(G, t); else danoLacaio(G, t, 2); } };
  EF[C.SUSSURRO] = { brasa: true, alvo: () => LAC("Sussurro: escolha um lacaio inimigo", "inimigo", { obrig: true }), fx: (G, p, ctx) => { const t = alvo1(G, ctx); if (t) { t.atk -= ctx.brasa ? 3 : 1; G.ev.push({ t: "debuff", r: t.uid }); } } };
  EF[C.DIZIMO] = { brasa: true, fx: (G, p, ctx) => comprar(G, p, ctx.brasa ? 2 : 1) };
  EF[C.APAGAR] = { brasa: true, fx: (G, p, ctx) => { p.mana += ctx.brasa ? 2 : 1; G.ev.push({ t: "mana", i: p.i }); } };
  EF[C.CARGA] = { brasa: true, fx: (G, p, ctx) => { for (const m of p.mesa) if (m.hp > 0) { m.tmp += ctx.brasa ? 2 : 1; G.ev.push({ t: "buff", r: m.uid }); } } };
  EF[C.OLHAR] = { brasa: true, alvo: (G, p, ctx) => ctx.brasa ? null : LAC("Olhar do Rei: escolha um lacaio inimigo que não poderá atacar", "inimigo", { obrig: true }),
    fx: (G, p, ctx) => { const ms = ctx.brasa ? vivos(G.p[1 - p.i].mesa) : [alvo1(G, ctx)].filter(Boolean); for (const m of ms) { m.naoAtaca = true; G.ev.push({ t: "preso", r: m.uid }); } } };
  EF[C.JURAMENTO] = { brasa: true, alvo: () => LAC("Juramento da Brasa: escolha um lacaio", "todos", { obrig: true }), fx: (G, p, ctx) => { const k = ctx.brasa ? 4 : 2; fortalecer(G, alvo1(G, ctx), k, k); } };
  EF[C.NOITE] = { brasa: true, fx: (G, p, ctx) => { for (const m of [...G.p[1 - p.i].mesa]) danoLacaio(G, m, ctx.brasa ? 3 : 2); } };
  EF[C.CHAMAS] = { brasa: true, fx: (G, p, ctx) => { danoHeroi(G, G.p[1 - p.i], ctx.brasa ? 4 : 2); } };

  // Hauksval
  EF[C.PATRULHEIRO] = bcDano(1, "Patrulheiro da Floresta: escolha um lacaio para receber 1 de dano");
  EF[C.CACADOR_OUV] = bcDano(2, "Caçador de Ouvintes: escolha um lacaio para receber 2 de dano");
  EF[C.OLHO] = bcDano(2, "Olho de Hadric: escolha um lacaio para receber 2 de dano");
  EF[C.YSRA] = { alvo: () => LAC("Ysra Vorhalt: destrua o lacaio inimigo com mais ataque", "inimigo", { auto: true, filtro: (G, p, m) => ataque(G, m) === Math.max(...vivos(G.p[1 - p.i].mesa).map(x => ataque(G, x))) }),
    bc: (G, p, m, ctx) => { destruir(G, alvo1(G, ctx)); } };
  EF[C.FLECHA_LUZ] = danoUm(2, "Flecha de Luz: escolha um lacaio para receber 2 de dano");
  EF[C.TIRO] = danoUm(3, "Tiro Certeiro: escolha um lacaio para receber 3 de dano");
  EF[C.PERFURANTE] = danoUm(4, "Flecha Perfurante: escolha um lacaio para receber 4 de dano");
  EF[C.DUPLO] = { alvo: () => LAC("Disparo Duplo: escolha dois lacaios diferentes (2 de dano em cada)", "todos", { n: 2, min: 1, obrig: true }),
    fx: (G, p, ctx) => { for (const r of ctx.alvos.slice(0, 2)) { const x = achar(G, r); if (x && x.m) danoLacaio(G, x.m, 2); } } };
  EF[C.CHUVA] = area(1, "inimigo");
  EF[C.VEMOS] = { fx: (G, p) => olharTopo(G, p, 3, "ver", "Vemos Antes: escolha a carta que vai para a mão (as outras vão para o fundo do deck)") };
  EF[C.MARCA] = { alvo: () => LAC("Marca do Caçador: escolha um lacaio inimigo, a vida dele passa a ser 1", "inimigo", { obrig: true }), fx: (G, p, ctx) => { const t = alvo1(G, ctx); if (t && t.hp > 1) { t.hp = 1; G.ev.push({ t: "debuff", r: t.uid }); } } };
  EF[C.LANTERNA] = { alvo: () => LAC("Flecha da Lanterna: escolha um lacaio ferido", "todos", { obrig: true, filtro: (G, p, m) => ferido(m) }), fx: (G, p, ctx) => { destruir(G, alvo1(G, ctx)); } };
  EF[C.RAJADA] = { alvo: () => LAC("Rajada Final: escolha um lacaio para receber 3 de dano", "todos"), fx: (G, p, ctx) => { danoHeroi(G, G.p[1 - p.i], 3); danoLacaio(G, alvo1(G, ctx), 3); } };

  // Valdoren
  EF[C.CAMPONESA] = curaHeroiBc(2);
  EF[C.CLERIGO] = { alvo: () => PERS("Clérigo de Valdoren: escolha um personagem para restaurar 3 de vida"), bc: (G, p, m, ctx) => { if (ctx.alvos[0] != null) curar(G, ctx.alvos[0], 3); } };
  EF[C.DEFENSOR] = curaHeroiBc(4);
  EF[C.CAMPEAO] = curaHeroiBc(5);
  EF[C.BENCAO] = { alvo: () => PERS("Bênção da Luz: escolha um personagem para restaurar 5 de vida", "todos", { obrig: true }), fx: (G, p, ctx) => { curar(G, ctx.alvos[0], 5); } };
  EF[C.ESCUDO_FE] = buffUm(0, 3, "Escudo da Fé: escolha um lacaio para receber +0/+3");
  EF[C.PAO] = { fx: async (G, p) => { curarHeroi(G, p, 3); await comprar(G, p, 1); } };
  EF[C.JULGAMENTO] = { alvo: () => LAC("Julgamento da Luz: escolha um lacaio com 5 ou mais de ataque", "todos", { obrig: true, filtro: (G, p, m) => ataque(G, m) >= 5 }), fx: (G, p, ctx) => { destruir(G, alvo1(G, ctx)); } };
  EF[C.SENTENCA] = { alvo: () => LAC("Sentença do Concílio: escolha um lacaio para destruir", "todos", { obrig: true }), fx: (G, p, ctx) => { destruir(G, alvo1(G, ctx)); } };
  EF[C.LANCAS] = { fx: (G, p) => { for (const m of p.mesa) if (m.hp > 0 && m.kws.includes("Falange")) fortalecer(G, m, 1, 1); } };
  EF[C.LUZ_LUMEN] = area(2, "inimigo");
  EF[C.LAMPADAS_ACESAS] = { fx: (G, p) => { curarHeroi(G, p, 8); for (const m of p.mesa) fortalecer(G, m, 1, 1); } };
  EF[C.VIGILIA] = { fx: async (G, p) => { curarHeroi(G, p, 6); for (const m of p.mesa) curarLacaio(G, m, 6); await comprar(G, p, 2); } };

  // Durnheim
  EF[C.FERREIRO] = { bc: (G, p) => armadura(G, p, 2) };
  EF[C.SARGENTO] = { bc: (G, p) => armadura(G, p, 2) };
  EF[C.DESERTOR] = { bc: (G, p) => comprar(G, G.p[1 - p.i], 1) };
  EF[C.NOBRE] = { bc: (G, p) => danoHeroi(G, p, 2) };
  EF[C.FORJADOR] = { alvo: () => LAC("Forjador de Lâminas: escolha um lacaio para receber +2 de ataque"), bc: (G, p, m, ctx) => { fortalecer(G, alvo1(G, ctx), 2, 0); } };
  EF[C.ESCUDO_ACO] = { fx: (G, p) => armadura(G, p, 5) };
  EF[C.DESMORONAMENTO] = area(1, "todos");
  EF[C.ESCUDADA] = { alvo: () => LAC("Escudada: escolha um lacaio para receber dano igual à sua armadura", "todos", { obrig: true }), fx: (G, p, ctx) => { danoLacaio(G, alvo1(G, ctx), p.armadura); } };
  EF[C.MARTELO] = danoUm(3, "Golpe de Martelo: escolha um lacaio para receber 3 de dano");
  EF[C.BARRAGEM] = area(2, "todos");
  EF[C.QUEDA] = area(4, "todos");
  EF[C.CONTRATO] = { alvo: () => LAC("Contrato de Ferro: escolha um lacaio", "todos", { obrig: true }),
    modos: (G, p) => p.armadura >= 6 ? [{ id: "dano", rot: "Causar 3 de dano" }, { id: "destruir", rot: "Perder 6 de armadura e destruir" }] : null,
    fx: (G, p, ctx) => { const t = alvo1(G, ctx); if (ctx.modo === "destruir" && p.armadura >= 6) { p.armadura -= 6; G.ev.push({ t: "armadura", r: "h" + p.i, n: -6 }); destruir(G, t); } else danoLacaio(G, t, 3); } };
  EF[C.FORJA_REI] = buffUm(2, 2, "Forja do Rei: escolha um lacaio para receber +2/+2 e Couraça", "Couraça");

  // Aethelmar
  EF[C.PESCADOR] = { bc: async (G, p) => { if (!p.deck.length) return; const top = p.deck[p.deck.length - 1];
    const r = await G.escolher(G, p.i, { tipo: "pescador", carta: top, titulo: "Pescador do Mar de Maren: a carta do topo do seu deck" });
    if (r === true) { p.deck.unshift(p.deck.pop()); log(G, `${nomeP(p)} pôs a carta do topo no fundo do deck.`); } } };
  EF[C.CONTRABANDISTA] = { bc: async (G, p) => { await comprar(G, p, 1); await comprar(G, G.p[1 - p.i], 1); } };
  EF[C.CORSARIO] = { alvo: () => LAC("Corsário da Coroa: escolha um lacaio inimigo de custo 2 ou menos para devolver à mão", "inimigo", { filtro: (G, p, m) => (+m.c.custo || 0) <= 2 }),
    bc: (G, p, m, ctx) => { const t = alvo1(G, ctx); if (t) paraMao(G, t); } };
  EF[C.CACADOR_CONTRA] = bcDano(1, "Caçador de Contrabandistas: escolha um lacaio para receber 1 de dano");
  EF[C.PALADINA] = { bc: (G, p, m) => { for (const x of [...p.mesa, ...G.p[1 - p.i].mesa]) if (x !== m) paraMao(G, x); } };
  EF[C.MARE_ALTA] = { alvo: () => LAC("Maré Alta: escolha um lacaio de custo 4 ou menos para devolver à mão", "todos", { obrig: true, filtro: (G, p, m) => (+m.c.custo || 0) <= 4 }), fx: (G, p, ctx) => { const t = alvo1(G, ctx); if (t) paraMao(G, t); } };
  EF[C.ABORDAGEM] = danoUm(2, "Abordagem: escolha um lacaio para receber 2 de dano");
  EF[C.SALVA] = { alvo: () => LAC("Salva de Canhões: escolha o lacaio que recebe 3 de dano e depois outro que recebe 1", "todos", { n: 2, min: 1, obrig: true }),
    fx: (G, p, ctx) => { const [a, b] = ctx.alvos; const x = a != null && achar(G, a), y = b != null && achar(G, b); if (x && x.m) danoLacaio(G, x.m, 3); if (y && y.m) danoLacaio(G, y.m, 1); } };
  EF[C.CARGA_SUL] = { fx: (G, p) => comprar(G, p, 2) };
  EF[C.CAMBIO] = { descarte: "efeito", fx: (G, p) => comprar(G, p, 2) };
  EF[C.LANTERNAS] = area(2, "inimigo");
  EF[C.BLOQUEIO] = { alvo: () => LAC("Bloqueio Naval: escolha um lacaio inimigo que não poderá atacar", "inimigo", { obrig: true }),
    fx: async (G, p, ctx) => { const t = alvo1(G, ctx); if (t) { t.naoAtaca = true; G.ev.push({ t: "preso", r: t.uid }); } await comprar(G, p, 1); } };
  EF[C.CASCO] = buffUm(1, 3, "Reforçar o Casco: escolha um lacaio para receber +1/+3");
  EF[C.CORRENTE] = { alvo: () => LAC("Corrente de Maren: escolha até dois lacaios inimigos de custo 4 ou menos", "inimigo", { n: 2, min: 1, obrig: true, filtro: (G, p, m) => (+m.c.custo || 0) <= 4 }),
    fx: (G, p, ctx) => { for (const r of ctx.alvos.slice(0, 2)) { const x = achar(G, r); if (x && x.m) paraMao(G, x.m); } } };
  EF[C.MAR_COBRA] = { descarte: "custo", alvo: () => LAC("O Mar Cobra: escolha um lacaio para destruir", "todos", { obrig: true }), fx: (G, p, ctx) => { destruir(G, alvo1(G, ctx)); } };
  EF[C.VELA] = { fx: (G, p) => { p.mana += 1; G.ev.push({ t: "mana", i: p.i }); } };

  // ---------- Decretos ----------
  const DECRETOS = {
    Morvhal: { nome: "Erguer Vazio", txt: "Invoca um Vazio 1/1.", pode: (G, p) => vivos(p.mesa).length < R.MESA && p.aux > 0 ? "" : (p.aux <= 0 ? "Acabaram as fichas de Vazio." : "A mesa está cheia."),
      fx: (G, p) => { invocarVazio(G, p); } },
    Valdoren: { nome: "Bênção do Celeiro", txt: "Restaura 2 de vida a um personagem.", alvo: () => PERS("Bênção do Celeiro: escolha um personagem para restaurar 2 de vida", "todos", { obrig: true }),
      fx: (G, p, ctx) => { curar(G, ctx.alvos[0], 2); } },
    Hauksval: { nome: "Flecha Certeira", txt: "Causa 1 de dano a qualquer alvo.", alvo: () => PERS("Flecha Certeira: escolha um alvo para receber 1 de dano", "todos", { obrig: true }),
      fx: (G, p, ctx) => { dano(G, ctx.alvos[0], 1); } },
    Durnheim: { nome: "Forja", txt: "O herói ganha 2 de armadura.", fx: (G, p) => armadura(G, p, 2) },
    Aethelmar: { nome: "Rota de Comércio", txt: "Descarte uma carta da mão e compre outra.", descarte: "custo", pode: (G, p) => p.mao.length ? "" : "Você não tem cartas na mão para descartar.",
      fx: (G, p) => comprar(G, p, 1) },
  };

  // ---------- criação da partida ----------
  function criarJogo(o) {
    const lista = o.cartas;
    const G = { rng: rngDe(o.semente != null ? o.semente : Math.floor(Math.random() * 4294967296)), p: [], vez: o.primeiro || 0, primeiro: o.primeiro || 0, turno: 0,
      fim: false, vencedor: null, ev: [], log: [], uid: 1, fase: "mulligan", escolher: o.escolher,
      vazio: lista.find(c => c.id === "fichas-vazio") || FICHA_VAZIO, vela: lista.find(c => c.id === "fichas-vela") || FICHA_VELA };
    for (let i = 0; i < 2; i++) {
      const casa = o.casas[i];
      const heroi = lista.find(c => c.tipo === "Herói" && c.casa === casa) || { nome: casa, casa, tipo: "Herói", decreto: DECRETOS[casa].nome, decreto_txt: DECRETOS[casa].txt };
      G.p.push({ i, casa, heroi, nome: o.nomes ? o.nomes[i] : "Jogador " + (i + 1), tipo: o.tipos ? o.tipos[i] : "robo", hp: R.VIDA, armadura: 0, max: 0, mana: 0,
        deck: embaralhar(G, montarDeck(lista, casa).map(c => inst(G, c))), mao: [], mesa: [], aux: R.VAZIOS, decretoUsado: false, fadiga: 0, jogadas: 0, jogou: {} });
    }
    const pr = G.p[G.vez], se = G.p[1 - G.vez];
    for (let k = 0; k < 3 && pr.deck.length; k++) pr.mao.push(pr.deck.pop());
    for (let k = 0; k < 4 && se.deck.length; k++) se.mao.push(se.deck.pop());
    return G;
  }
  function mulligan(G, i, uids) {
    const p = G.p[i], volta = p.mao.filter(x => uids.includes(x.uid));
    if (!volta.length) return;
    p.mao = p.mao.filter(x => !uids.includes(x.uid)); p.deck.push(...volta); embaralhar(G, p.deck);
    for (let k = 0; k < volta.length && p.deck.length; k++) p.mao.push(p.deck.pop());
    log(G, `${nomeP(p)} trocou ${volta.length} ${volta.length === 1 ? "carta" : "cartas"} no mulligan.`);
  }
  function comecar(G) {
    const se = G.p[1 - G.vez]; se.mao.push(inst(G, G.vela));
    G.fase = "jogo"; log(G, `${nomeP(G.p[G.vez])} começa. ${nomeP(se)} recebe a Vela.`);
  }
  async function iniciarTurno(G) {
    if (G.fim) return;
    const p = G.p[G.vez]; G.turno++;
    p.max = Math.min(R.DEV_MAX, p.max + 1); p.mana = p.max; p.decretoUsado = false;
    for (const m of p.mesa) { m.enjoo = false; m.atacou = false; }
    G.ev.push({ t: "turno", i: p.i });
    await comprar(G, p, 1);
    if (G.fim) return;
    for (const m of [...p.mesa]) if (m.hp > 0 && m.c.id === C.POCO && p.mesa.includes(m)) invocarVazio(G, p);
  }
  async function encerrarTurno(G) {
    if (G.fim) return;
    const p = G.p[G.vez], o = G.p[1 - G.vez];
    for (const m of [...p.mesa]) {
      if (G.fim) return;
      if (!p.mesa.includes(m) || m.hp <= 0) continue;
      const id = m.c.id;
      if (id === C.CATAPULTA) {
        const vs = vivos(o.mesa);
        if (vs.length) {
          const r = await G.escolher(G, p.i, { tipo: "alvo", alvos: vs.map(x => x.uid), titulo: "Catapulta: escolha um lacaio inimigo para receber 2 de dano", dano: 2 });
          danoLacaio(G, lacaio(G, r) || vs[0], 2); log(G, `A Catapulta de ${nomeP(p)} disparou.`);
        }
      }
      if (id === C.PORTADORA) { curarHeroi(G, p, 2); for (const x of p.mesa) curarLacaio(G, x, 2); }
      if (id === C.LAMPADA) { curarHeroi(G, p, 4); for (const x of p.mesa) curarLacaio(G, x, 2); }
      limpar(G);
    }
    for (const m of p.mesa) { m.tmp = 0; m.naoAtaca = false; }
    for (const m of o.mesa) m.tmp = 0;
    G.vez = 1 - G.vez;
  }

  // ---------- jogar cartas ----------
  function ctxs(G, p, ef) {
    const lista = [{ brasa: false }];
    if (ef.brasa && vivos(p.mesa).length) lista.push({ brasa: true });
    return lista;
  }
  function infoCarta(G, i, uid) {
    const p = G.p[i], h = p.mao.find(x => x.uid === uid);
    if (!h) return { pode: false, motivo: "Carta não encontrada." };
    const c = h.c, ef = EF[c.id] || {};
    const r = { h, c, ef, custo: +c.custo || 0, pode: true, motivo: "", programado: !!EF[c.id] || PASSIVOS.has(c.id) || !String(c.texto || "").trim() };
    r.sacs = ef.brasa ? vivos(p.mesa).map(m => m.uid) : [];
    r.descartes = ef.descarte ? p.mao.filter(x => x.uid !== uid).map(x => x.uid) : [];
    r.modos = ef.modos ? ef.modos(G, p) : null;
    r.spec = ctx => ef.alvo ? ef.alvo(G, p, ctx) : null;
    if (G.fim || G.fase !== "jogo") { r.pode = false; r.motivo = "A partida não está em andamento."; }
    else if (G.vez !== i) { r.pode = false; r.motivo = "Não é o seu turno."; }
    else if (r.custo > p.mana) { r.pode = false; r.motivo = `Falta Devoção: custa ${r.custo}, você tem ${p.mana}.`; }
    else if (c.tipo === "Lacaio" && vivos(p.mesa).length >= R.MESA) { r.pode = false; r.motivo = "A mesa está cheia (5 lacaios)."; }
    else if (ef.descarte === "custo" && !r.descartes.length) { r.pode = false; r.motivo = "Precisa de outra carta na mão para descartar."; }
    else if (c.tipo === "Magia" && ef.alvo) {
      const ok = ctxs(G, p, ef).some(ctx => { const s = ef.alvo(G, p, ctx); return !s || !s.obrig || candidatos(G, p, s).length > 0; });
      if (!ok) { r.pode = false; r.motivo = "Não há alvo válido para esta carta."; }
    }
    return r;
  }
  // esc: { alvos: [ref], sac: uid, descarte: uid, modo }
  async function jogarCarta(G, i, uid, esc = {}) {
    const info = infoCarta(G, i, uid); if (!info.pode) return false;
    const p = G.p[i], c = info.c, ef = info.ef;
    p.mao.splice(p.mao.indexOf(info.h), 1); p.mana -= info.custo; p.jogadas++; p.jogou[c.id] = (p.jogou[c.id] || 0) + 1;
    const ctx = { brasa: false, modo: esc.modo, alvos: (esc.alvos || []).filter(x => x != null) };
    G.ev.push({ t: "jogou", i, c, alvos: ctx.alvos });
    log(G, `${nomeP(p)} jogou ${c.nome}.`);
    if (ef.descarte && esc.descarte != null) {
      const d = p.mao.find(x => x.uid === esc.descarte);
      if (d) { p.mao.splice(p.mao.indexOf(d), 1); log(G, `${nomeP(p)} descartou ${d.c.nome}.`); G.ev.push({ t: "descarte", i, c: d.c }); }
    }
    if (ef.brasa && esc.sac != null) {
      const m = p.mesa.find(x => x.uid === esc.sac && x.hp > 0);
      if (m) { ctx.brasa = true; log(G, "Com brasa."); await sacrificar(G, p, m); }
    }
    if (c.tipo === "Lacaio") {
      const m = invocar(G, p, c, false);
      if (m) {
        if (ef.bc) await ef.bc(G, p, m, ctx);
        limpar(G);
        if (!G.fim && m.kws.includes("Maré") && p.mesa.includes(m)) await mare(G, p);
      }
    } else if (ef.fx) await ef.fx(G, p, ctx);
    limpar(G);
    return true;
  }
  function infoDecreto(G, i) {
    const p = G.p[i], d = DECRETOS[p.casa];
    const r = { d, pode: true, motivo: "", spec: d.alvo ? d.alvo(G, p) : null, descartes: d.descarte ? p.mao.map(x => x.uid) : [] };
    if (G.fim || G.fase !== "jogo" || G.vez !== i) { r.pode = false; r.motivo = "Não é o seu turno."; }
    else if (p.decretoUsado) { r.pode = false; r.motivo = "O Decreto já foi usado neste turno."; }
    else if (p.mana < R.DECRETO) { r.pode = false; r.motivo = `O Decreto custa ${R.DECRETO} de Devoção.`; }
    else if (d.pode) { const m = d.pode(G, p); if (m) { r.pode = false; r.motivo = m; } }
    return r;
  }
  async function usarDecreto(G, i, esc = {}) {
    const info = infoDecreto(G, i); if (!info.pode) return false;
    const p = G.p[i], d = info.d;
    p.mana -= R.DECRETO; p.decretoUsado = true;
    const ctx = { alvos: (esc.alvos || []).filter(x => x != null) };
    G.ev.push({ t: "decreto", i, alvos: ctx.alvos }); log(G, `${nomeP(p)} usou o Decreto ${p.heroi.decreto || d.nome}.`);
    if (d.descarte && esc.descarte != null) {
      const x = p.mao.find(y => y.uid === esc.descarte);
      if (x) { p.mao.splice(p.mao.indexOf(x), 1); log(G, `${nomeP(p)} descartou ${x.c.nome}.`); G.ev.push({ t: "descarte", i, c: x.c }); }
    }
    await d.fx(G, p, ctx); limpar(G); return true;
  }

  // ---------- ataques ----------
  function motivoNaoAtaca(G, m) {
    if (G.fim || G.fase !== "jogo") return "A partida não está em andamento.";
    if (m.dono !== G.vez) return "Só ataca no turno do dono.";
    if (m.naoAtaca) return "Não pode atacar neste turno.";
    if (m.atacou) return "Já atacou neste turno.";
    if (m.enjoo && !temKw(G, m, "Investida")) return "Acabou de entrar: ataca a partir do próximo turno.";
    if (ataque(G, m) <= 0) return "Sem ataque.";
    return "";
  }
  const podeAtacar = (G, m) => m.hp > 0 && !motivoNaoAtaca(G, m);
  function alvosDeAtaque(G, m) {
    const o = G.p[1 - m.dono];
    const prov = vivos(o.mesa).filter(x => temKw(G, x, "Provocar"));
    if (prov.length) return prov.map(x => x.uid);
    return [...vivos(o.mesa).map(x => x.uid), "h" + o.i];
  }
  async function atacar(G, i, uid, alvo) {
    const a = lacaio(G, uid); if (!a || a.dono !== i || !podeAtacar(G, a)) return false;
    if (!alvosDeAtaque(G, a).includes(alvo)) return false;
    const x = achar(G, alvo); if (!x) return false;
    a.atacou = true; G.ev.push({ t: "ataque", de: uid, para: alvo });
    const A = ataque(G, a);
    if (x.heroi) { log(G, `${a.c.nome} atacou o herói de ${nomeP(x.heroi)} (${A} de dano).`); danoHeroi(G, x.heroi, A); }
    else {
      const d = x.m, D = ataque(G, d);
      log(G, `${a.c.nome} atacou ${d.c.nome}.`);
      const fa = temKw(G, a, "Fogo Negro"), fd = temKw(G, d, "Fogo Negro");
      if (temKw(G, d, "Falange")) { danoLacaio(G, a, D, { fogo: fd, combate: true }); if (a.hp > 0) danoLacaio(G, d, A, { fogo: fa, combate: true }); }
      else { danoLacaio(G, d, A, { fogo: fa, combate: true }); if (!temKw(G, a, "Distância")) danoLacaio(G, a, D, { fogo: fd, combate: true }); }
    }
    limpar(G); return true;
  }

  g.DKJ = g.DKJ || {};
  g.DKJ.Motor = { R, CASAS, KW_TXT, C, EF, PASSIVOS, DECRETOS, ID, slug, criarJogo, mulligan, comecar, iniciarTurno, encerrarTurno, infoCarta, jogarCarta, infoDecreto, usarDecreto,
    atacar, podeAtacar, motivoNaoAtaca, alvosDeAtaque, candidatos, achar, lacaio, temKw, ataque, ferido, vivos, montarDeck, naCaixa, ctxs };
})(typeof window !== "undefined" ? window : globalThis);
