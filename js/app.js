// FinanTic 1.1 · Pantallas de la app: Inicio, Movimientos, Reportes, Presupuestos y Perfil.
// Los datos viven en memoria mientras la app está desbloqueada y cada cambio se guarda
// cifrado en la base de datos local (FT.repo).
window.FT = window.FT || {};
FT.app = (() => {
  'use strict';
  const { MESES, MES3, DIAS, iso, parse, hoy, addDays, esc, money0, $, short, fechaLarga, uid, toast } = FT.u;
  const R = FT.repo;
  const PALETA = ['#E07A5F', '#3D8BD9', '#8E6CCF', '#2A9D8F', '#D9A23D', '#D45D9A', '#5DAA4A', '#7A8A99', '#C7663A', '#4FB3C9', '#B0884C', '#6C7BD9'];
  const PRES_EJEMPLO = { Comida: 4500, Transporte: 1200, Ocio: 1500, Servicios: 900, Escuela: 600 };

  // ---------- Estado en memoria ----------
  let S = null;   // { perfil:{nombre}, categorias, presupuestos, preferencias:{ejemplo}, movimientos:[] }
  const categoriasBase = () => ({
    gasto: [['Comida', 0], ['Transporte', 1], ['Casa', 2], ['Servicios', 3], ['Salud', 4], ['Escuela', 5], ['Ocio', 6], ['Ropa', 8], ['Otros', 7]].map(([n, c]) => ({ nombre: n, color: PALETA[c] })),
    ingreso: [['Salario', 3], ['Beca', 1], ['Ventas', 4], ['Regalo', 5], ['Otros ingresos', 7]].map(([n, c]) => ({ nombre: n, color: PALETA[c] })),
  });
  // Datos para un perfil nuevo; si hay datos de la versión 1.0 se conservan
  function datosIniciales(legado) {
    const d = { categorias: categoriasBase(), presupuestos: {}, preferencias: { ejemplo: false }, movimientos: [] };
    if (legado && Array.isArray(legado.movimientos)) {
      d.movimientos = legado.movimientos; d.presupuestos = legado.presupuestos || {};
      if (legado.categorias) d.categorias = legado.categorias;
      d.preferencias.ejemplo = !!legado.ejemplo;
    }
    return d;
  }
  const paraGuardar = () => ({ categorias: S.categorias, presupuestos: S.presupuestos, preferencias: S.preferencias, movimientos: S.movimientos });
  const fallo = () => toast('No se pudo guardar el cambio');

  function ejemplo() {
    // Datos de ejemplo de los últimos ~3 meses, siempre iguales (semilla fija)
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const movs = []; const fin = hoy(); let d = addDays(fin, -95);
    const gastos = [['Comida', 60, 220, .9], ['Transporte', 12, 60, .7], ['Ocio', 80, 450, .18], ['Ropa', 250, 900, .05], ['Salud', 90, 400, .05], ['Escuela', 40, 300, .12], ['Otros', 30, 200, .1]];
    while (d <= fin) {
      const dd = parse(d).getDate();
      if (dd === 1 || dd === 15) movs.push({ tipo: 'ingreso', categoria: 'Salario', monto: 7500, fecha: d, nota: 'Pago quincenal' });
      if (dd === 5) movs.push({ tipo: 'ingreso', categoria: 'Beca', monto: 1800, fecha: d, nota: 'Beca mensual' });
      if (dd === 3) movs.push({ tipo: 'gasto', categoria: 'Casa', monto: 4200, fecha: d, nota: 'Renta' });
      if (dd === 10) movs.push({ tipo: 'gasto', categoria: 'Servicios', monto: 389, fecha: d, nota: 'Internet' });
      if (dd === 12) movs.push({ tipo: 'gasto', categoria: 'Servicios', monto: 230 + Math.round(rnd() * 120), fecha: d, nota: 'Luz' });
      if (dd === 20 && rnd() < .6) movs.push({ tipo: 'ingreso', categoria: 'Ventas', monto: 300 + Math.round(rnd() * 900), fecha: d, nota: 'Venta en línea' });
      gastos.forEach(([c, a, b, p]) => { if (rnd() < p) movs.push({ tipo: 'gasto', categoria: c, monto: Math.round(a + rnd() * (b - a)), fecha: d, nota: '' }); });
      d = addDays(d, 1);
    }
    movs.forEach((m) => { m.id = uid(); m.creado = Date.now(); });
    return movs;
  }

  const cats = (tipo) => S.categorias[tipo];
  const catInfo = (tipo, nombre) => cats(tipo).find((c) => c.nombre === nombre) || { nombre, color: PALETA[7] };

  // ---------- Periodos ----------
  const UI = { tab: 'inicio', per: { modo: 'mes', ref: hoy(), desde: addDays(hoy(), -29), hasta: hoy() }, filtroTipo: 'todos', editBud: false, panel: null, respaldo: null };
  function rango(p) {
    const d = parse(p.ref);
    if (p.modo === 'dia') return [p.ref, p.ref];
    if (p.modo === 'mes') return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
    if (p.modo === 'anio') return [`${d.getFullYear()}-01-01`, `${d.getFullYear()}-12-31`];
    return p.desde <= p.hasta ? [p.desde, p.hasta] : [p.hasta, p.desde];
  }
  function etiqueta(p) {
    const d = parse(p.ref);
    if (p.modo === 'dia') return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`;
    if (p.modo === 'mes') return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
    if (p.modo === 'anio') return String(d.getFullYear());
    const [a, b] = rango(p); return `${fechaLarga(a)} – ${fechaLarga(b)}`;
  }
  function mover(p, n) {
    const d = parse(p.ref);
    if (p.modo === 'dia') d.setDate(d.getDate() + n);
    if (p.modo === 'mes') { d.setDate(1); d.setMonth(d.getMonth() + n); }
    if (p.modo === 'anio') d.setFullYear(d.getFullYear() + n);
    p.ref = iso(d);
  }
  const enRango = ([a, b]) => S.movimientos.filter((m) => m.fecha >= a && m.fecha <= b);
  const suma = (arr, tipo) => arr.filter((m) => m.tipo === tipo).reduce((s, m) => s + m.monto, 0);
  const ordenar = (arr) => arr.slice().sort((x, y) => (y.fecha.localeCompare(x.fecha)) || (y.creado - x.creado));

  function periodoHTML(conRango = true) {
    const p = UI.per;
    const modos = [['dia', 'Día'], ['mes', 'Mes'], ['anio', 'Año']].concat(conRango ? [['rango', 'Periodo']] : []);
    return `<div class="card">
      <div class="seg" role="group" aria-label="Tipo de periodo" ${conRango ? '' : 'hidden'}>${modos.map(([k, l]) => `<button data-act="modo" data-v="${k}" aria-pressed="${p.modo === k}">${l}</button>`).join('')}</div>
      ${p.modo === 'rango'
        ? `<div class="rng"><label>Desde<input type="date" id="rng-desde" value="${p.desde}"></label><label>Hasta<input type="date" id="rng-hasta" value="${p.hasta}"></label></div>`
        : `<div class="pnav"><button data-act="prev" aria-label="Periodo anterior">‹</button><span class="plabel">${etiqueta(p)}</span><button data-act="next" aria-label="Periodo siguiente">›</button></div>`}
    </div>`;
  }

  // ---------- Gráficas (SVG propio, sin internet) ----------
  function donut(items, total) {
    const Ro = 60, Ri = 40, C = 75; let a0 = -Math.PI / 2; let paths = '';
    if (!total) paths = `<circle cx="${C}" cy="${C}" r="${(Ro + Ri) / 2}" fill="none" stroke="var(--surface2)" stroke-width="${Ro - Ri}"/>`;
    items.forEach((it) => {
      const frac = it.v / total; if (frac <= 0) return;
      if (frac > 0.9999) { paths += `<circle cx="${C}" cy="${C}" r="${(Ro + Ri) / 2}" fill="none" stroke="${it.color}" stroke-width="${Ro - Ri}"/>`; return; }
      const a1 = a0 + frac * Math.PI * 2; const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad, ang) => `${(C + rad * Math.cos(ang)).toFixed(2)} ${(C + rad * Math.sin(ang)).toFixed(2)}`;
      paths += `<path d="M ${p(Ro, a0)} A ${Ro} ${Ro} 0 ${large} 1 ${p(Ro, a1)} L ${p(Ri, a1)} A ${Ri} ${Ri} 0 ${large} 0 ${p(Ri, a0)} Z" fill="${it.color}" stroke="var(--surface)" stroke-width="1.5"><title>${esc(it.k)}: ${$(it.v)}</title></path>`;
      a0 = a1;
    });
    return `<svg class="chart" viewBox="0 0 150 150" role="img" aria-label="Gastos por categoría">${paths}
      <text x="75" y="70" text-anchor="middle" style="font-size:10px">Gastos</text>
      <text x="75" y="88" text-anchor="middle" style="font-size:14px;font-weight:800;fill:var(--fg)">${short(total)}</text></svg>`;
  }
  function porCategoria(arr, tipo) {
    const m = new Map(); arr.filter((x) => x.tipo === tipo).forEach((x) => m.set(x.categoria, (m.get(x.categoria) || 0) + x.monto));
    return [...m].map(([k, v]) => ({ k, v, color: catInfo(tipo, k).color })).sort((a, b) => b.v - a.v);
  }
  function leyenda(items, total, max = 99, vacio = 'Sin gastos en este periodo.') {
    const shown = items.slice(0, max);
    return `<div class="legend">${shown.map((it) => `<div class="li"><i style="background:${it.color}"></i><span>${esc(it.k)}</span><span class="muted small num">${total ? Math.round(it.v / total * 100) : 0}%</span><b class="num">${money0.format(it.v)}</b></div>`).join('') || `<span class="muted small">${vacio}</span>`}</div>`;
  }
  function cubetas(p) {
    let [a, b] = rango(p); let modo = 'dia';
    if (p.modo === 'dia') a = addDays(b, -6);
    if (p.modo === 'anio') modo = 'mes';
    if (p.modo === 'rango' && (parse(b) - parse(a)) / 864e5 > 45) modo = 'mes';
    const out = [];
    if (modo === 'dia') { for (let d = a; d <= b; d = addDays(d, 1)) out.push({ a: d, b: d, lbl: String(parse(d).getDate()), full: fechaLarga(d) }); }
    else { const d = parse(a); d.setDate(1); while (iso(d) <= b) { const s = iso(d), e = iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); out.push({ a: s < a ? a : s, b: e > b ? b : e, lbl: MES3[d.getMonth()], full: `${MESES[d.getMonth()]} ${d.getFullYear()}` }); d.setMonth(d.getMonth() + 1); } }
    out.forEach((c) => { const arr = enRango([c.a, c.b]); c.in = suma(arr, 'ingreso'); c.out = suma(arr, 'gasto'); });
    return out;
  }
  function barras(cs, W) {
    const H = 180, L = 40, Rm = 6, T = 10, B = 22;
    const max = Math.max(1, ...cs.map((c) => Math.max(c.in, c.out)));
    const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); return [1, 2, 2.5, 5, 10].map((k) => k * p).find((v) => v >= max); })();
    const y = (v) => T + (H - T - B) * (1 - v / nice);
    const bw = (W - L - Rm) / cs.length; const g = Math.max(1, Math.min(bw * 0.38, 12)); const gap = Math.max(1, bw * 0.08);
    let s = '';
    [0, .5, 1].forEach((f) => { const v = nice * f; s += `<line x1="${L}" x2="${W - Rm}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`; });
    const every = Math.ceil(cs.length / Math.max(1, Math.floor((W - L) / 34)));
    cs.forEach((c, i) => {
      const cx = L + bw * i + bw / 2;
      s += `<rect x="${cx - g - gap / 2}" y="${y(c.in)}" width="${g}" height="${Math.max(0, y(0) - y(c.in))}" rx="${Math.min(3, g / 2)}" fill="var(--in)"/>`;
      s += `<rect x="${cx + gap / 2}" y="${y(c.out)}" width="${g}" height="${Math.max(0, y(0) - y(c.out))}" rx="${Math.min(3, g / 2)}" fill="var(--out)"/>`;
      s += `<rect x="${L + bw * i}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent" data-act="bar" data-i="${i}"/>`;
      if (i % every === 0) s += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${c.lbl}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Ingresos y gastos por periodo">${s}</svg>`;
  }

  // ---------- Pantallas ----------
  const ICO = (tipo, cat) => { const c = catInfo(tipo, cat); return `<span class="ico" style="background:${c.color}">${esc(cat.slice(0, 1).toUpperCase())}</span>`; };
  const movHTML = (m, conFecha) => `<button class="mov" data-act="edit" data-id="${m.id}">${ICO(m.tipo, m.categoria)}
    <span class="txt"><b>${esc(m.categoria)}</b><span>${esc(m.nota || (conFecha ? '' : (m.tipo === 'gasto' ? 'Gasto' : 'Ingreso')))}${conFecha ? (m.nota ? ' · ' : '') + fechaLarga(m.fecha) : ''}</span></span>
    <span class="amt num ${m.tipo === 'gasto' ? 'out' : 'in'}">${m.tipo === 'gasto' ? '−' : '+'}${$(m.monto)}</span></button>`;
  const bannerEj = () => S.preferencias.ejemplo ? `<div class="banner"><span>Estás viendo <b>datos de ejemplo</b> para conocer la app.</span><button data-act="borrar-ejemplo">Empezar desde cero</button></div>` : '';

  function inicio() {
    const r = rango({ modo: 'mes', ref: hoy() }); const arr = enRango(r);
    const ing = suma(arr, 'ingreso'), gas = suma(arr, 'gasto');
    const total = S.movimientos.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0);
    const cat = porCategoria(arr, 'gasto');
    const presTotal = Object.values(S.presupuestos).reduce((a, b) => a + (+b || 0), 0);
    const presGastado = Object.keys(S.presupuestos).reduce((s, k) => s + arr.filter((m) => m.tipo === 'gasto' && m.categoria === k).reduce((a, m) => a + m.monto, 0), 0);
    const pct = presTotal ? presGastado / presTotal : 0;
    const ult = ordenar(S.movimientos).slice(0, 5);
    const nombre = S.perfil.nombre ? `, ${esc(S.perfil.nombre)}` : '';
    return `${bannerEj()}
    <h1 class="screen">Hola${nombre}</h1>
    <section class="hero" aria-label="Resumen del mes">
      <div><div class="lbl">Balance de ${MESES[parse(r[0]).getMonth()]}</div><div class="big num">${$(ing - gas)}</div></div>
      <div class="row"><div class="pill"><span class="lbl">Ingresos</span><b class="num">${$(ing)}</b></div><div class="pill"><span class="lbl">Gastos</span><b class="num">${$(gas)}</b></div></div>
      <div class="lbl">Saldo acumulado: <b class="num">${$(total)}</b></div>
    </section>
    ${presTotal ? `<h2 class="sec">Presupuesto del mes</h2><div class="card stack" data-act="tab" data-v="presupuestos" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between"><span class="num"><b>${money0.format(presGastado)}</b> <span class="muted">de ${money0.format(presTotal)}</span></span><span class="muted num">${Math.round(pct * 100)}%</span></div>
      <div class="bar"><span class="${pct > 1 ? 'o' : pct > .8 ? 'w' : ''}" style="width:${Math.min(100, pct * 100)}%"></span></div></div>` : ''}
    <h2 class="sec">Gastos del mes por categoría</h2>
    <div class="card"><div class="donut-wrap">${donut(cat, gas)}${leyenda(cat, gas, 5)}</div></div>
    <h2 class="sec">Últimos movimientos</h2>
    <div class="card list">${ult.map((m) => movHTML(m, true)).join('') || `<div class="empty"><b>Aún no hay movimientos</b>Toca el botón + para registrar tu primer ingreso o gasto.</div>`}</div>
    ${ult.length ? `<p style="text-align:center"><button class="btn ghost" data-act="tab" data-v="movimientos">Ver todos los movimientos</button></p>` : ''}`;
  }

  function movimientos() {
    const arr = enRango(rango(UI.per)).filter((m) => UI.filtroTipo === 'todos' || m.tipo === UI.filtroTipo);
    const grupos = new Map(); ordenar(arr).forEach((m) => { if (!grupos.has(m.fecha)) grupos.set(m.fecha, []); grupos.get(m.fecha).push(m); });
    const ing = suma(arr, 'ingreso'), gas = suma(arr, 'gasto');
    let lista = '';
    grupos.forEach((ms, f) => {
      const neto = ms.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0);
      lista += `<div class="day-h"><span style="text-transform:capitalize">${fechaLarga(f)}</span><span class="num">${neto >= 0 ? '+' : '−'}${$(Math.abs(neto))}</span></div><div class="card list">${ms.map((m) => movHTML(m, false)).join('')}</div>`;
    });
    return `${bannerEj()}<h1 class="screen">Movimientos</h1>
    <div class="stack">${periodoHTML()}
    <div class="chips" role="group" aria-label="Filtrar por tipo">${[['todos', 'Todos'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos']].map(([k, l]) => `<button class="chip" data-act="filtro" data-v="${k}" aria-pressed="${UI.filtroTipo === k}">${l}</button>`).join('')}</div>
    <div class="tiles"><div class="tile"><span class="lbl">Ingresos</span><b class="num" style="color:var(--in)">${money0.format(ing)}</b></div><div class="tile"><span class="lbl">Gastos</span><b class="num" style="color:var(--out)">${money0.format(gas)}</b></div><div class="tile"><span class="lbl">Balance</span><b class="num">${money0.format(ing - gas)}</b></div></div>
    </div>
    ${lista || `<div class="card empty" style="margin-top:12px"><b>Sin movimientos en este periodo</b>Cambia el periodo o registra uno con el botón +.</div>`}`;
  }

  function reportes() {
    const arr = enRango(rango(UI.per)); const ing = suma(arr, 'ingreso'), gas = suma(arr, 'gasto');
    const cat = porCategoria(arr, 'gasto'); const catI = porCategoria(arr, 'ingreso');
    const ahorro = ing ? (ing - gas) / ing : 0;
    return `${bannerEj()}<h1 class="screen">Reportes</h1>
    <div class="stack">${periodoHTML()}
    <div class="tiles"><div class="tile"><span class="lbl">Ingresos</span><b class="num" style="color:var(--in)">${money0.format(ing)}</b></div><div class="tile"><span class="lbl">Gastos</span><b class="num" style="color:var(--out)">${money0.format(gas)}</b></div><div class="tile"><span class="lbl">Balance</span><b class="num">${money0.format(ing - gas)}</b></div></div>
    <div class="card"><h2 class="sec" style="margin-top:0">Ingresos y gastos${UI.per.modo === 'dia' ? ' · últimos 7 días' : ''}</h2>
      <div id="bars"></div>
      <div class="cap" id="bars-cap"><span style="color:var(--in)">■</span> Ingresos &nbsp; <span style="color:var(--out)">■</span> Gastos · toca una barra para ver el detalle</div></div>
    <div class="card"><h2 class="sec" style="margin-top:0">Gastos por categoría</h2><div class="donut-wrap">${donut(cat, gas)}${leyenda(cat, gas)}</div></div>
    <div class="card"><h2 class="sec" style="margin-top:0">Ingresos por fuente</h2>${leyenda(catI, ing, 99, 'Sin ingresos en este periodo.')}</div>
    <div class="card"><h2 class="sec" style="margin-top:0">Tasa de ahorro</h2><p style="margin:0"><b class="num" style="font-size:22px">${ing ? Math.round(ahorro * 100) + '%' : '—'}</b> <span class="muted small">de tus ingresos ${ahorro >= 0 ? 'te quedaron libres' : 'se excedieron'} en este periodo.</span></p></div>
    </div>`;
  }

  function presupuestos() {
    UI.per = { ...UI.per, modo: 'mes' };
    const arr = enRango(rango(UI.per));
    const gasto = (c) => arr.filter((m) => m.tipo === 'gasto' && m.categoria === c).reduce((s, m) => s + m.monto, 0);
    const con = cats('gasto').filter((c) => +S.presupuestos[c.nombre] > 0);
    const tot = con.reduce((s, c) => s + +S.presupuestos[c.nombre], 0), totG = con.reduce((s, c) => s + gasto(c.nombre), 0);
    const items = con.map((c) => {
      const lim = +S.presupuestos[c.nombre], g = gasto(c.nombre), f = g / lim;
      return `<div class="bud"><div class="top2"><span class="tag"><i style="background:${c.color}"></i>${esc(c.nombre)}</span><span class="num small"><b>${money0.format(g)}</b> <span class="muted">/ ${money0.format(lim)}</span></span></div>
      <div class="bar"><span class="${f > 1 ? 'o' : f > .8 ? 'w' : ''}" style="width:${Math.min(100, f * 100)}%"></span></div>
      <span class="small ${f > 1 ? '' : 'muted'}" style="${f > 1 ? 'color:var(--out)' : ''}">${f > 1 ? `Te excediste por ${money0.format(g - lim)}` : f > .8 ? `Cuidado: llevas el ${Math.round(f * 100)}%. Te quedan ${money0.format(lim - g)}` : `Te quedan ${money0.format(lim - g)}`}</span></div>`;
    }).join('');
    const edit = cats('gasto').map((c, i) => `<label class="bud-edit"><span class="tag"><i style="background:${c.color}"></i>${esc(c.nombre)}</span><input type="number" inputmode="decimal" min="0" step="50" id="bud-${i}" data-cat="${esc(c.nombre)}" value="${S.presupuestos[c.nombre] || ''}" placeholder="Sin límite"></label>`).join('');
    return `${bannerEj()}<h1 class="screen">Presupuestos</h1>
    <div class="stack">${periodoHTML(false)}
    ${UI.editBud ? `<div class="card"><h2 class="sec" style="margin-top:0">Límite mensual por categoría</h2>${edit}<div class="row2" style="margin-top:10px"><button class="btn ghost" data-act="bud-cancel">Cancelar</button><button class="btn" data-act="bud-save">Guardar límites</button></div></div>`
    : `<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span class="muted small">Total del mes</span><span class="num"><b>${money0.format(totG)}</b> <span class="muted">de ${money0.format(tot)}</span></span></div>
      <div class="bar" style="margin-top:8px"><span class="${tot && totG / tot > 1 ? 'o' : tot && totG / tot > .8 ? 'w' : ''}" style="width:${tot ? Math.min(100, totG / tot * 100) : 0}%"></span></div></div>
      <div class="card">${items || `<div class="empty"><b>Sin presupuestos</b>Define cuánto quieres gastar al mes en cada categoría.</div>`}</div>
      <button class="btn block" data-act="bud-edit">${con.length ? 'Editar límites' : 'Definir presupuestos'}</button>`}
    </div>`;
  }

  // Paneles que se abren dentro de Perfil
  function panelHTML() {
    if (UI.panel === 'pin') return `<div class="panel-extra">
        <label class="field"><span>PIN actual</span><input type="password" inputmode="numeric" maxlength="4" id="pin-actual" autocomplete="off"></label>
        <div class="row2"><label class="field"><span>PIN nuevo</span><input type="password" inputmode="numeric" maxlength="4" id="pin-nuevo" autocomplete="off"></label>
        <label class="field"><span>Confirmar</span><input type="password" inputmode="numeric" maxlength="4" id="pin-conf" autocomplete="off"></label></div>
        <div class="err" id="pin-err"></div>
        <div class="row2"><button class="btn ghost" data-act="panel-cerrar">Cancelar</button><button class="btn" data-act="pin-guardar">Guardar PIN</button></div></div>`;
    if (UI.panel === 'restaurar') {
      const r = UI.respaldo;
      return `<div class="panel-extra">
        <p class="small" style="margin:0">Archivo: <b>${esc(r.nombre)}</b>${r.fecha ? ` · creado el ${esc(r.fecha)}` : ''}</p>
        ${r.cifrado ? `<label class="field"><span>PIN con el que se creó el respaldo</span><input type="password" inputmode="numeric" maxlength="4" id="resp-pin" autocomplete="off"></label>` : ''}
        <div class="aviso-mini">Se reemplazará toda la información actual por la del respaldo.</div>
        <div class="err" id="resp-err"></div>
        <div class="row2"><button class="btn ghost" data-act="panel-cerrar">Cancelar</button><button class="btn" data-act="resp-aplicar">Restaurar</button></div></div>`;
    }
    if (UI.panel === 'borrar') return `<div class="confirm" style="margin-top:10px"><span>¿Borrar todos tus movimientos y presupuestos? No se puede deshacer.</span><span style="display:flex;gap:6px"><button class="btn ghost" data-act="panel-cerrar">No</button><button class="btn danger" data-act="borrar-si">Sí, borrar</button></span></div>`;
    return '';
  }

  function perfil() {
    const tags = (tipo) => cats(tipo).map((c) => `<span class="tag"><i style="background:${c.color}"></i>${esc(c.nombre)}</span>`).join(' ');
    const puedeCompartir = !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] }));
    return `<h1 class="screen">Perfil</h1>
    <div class="stack">
    <div class="card stack"><label class="field"><span>Tu nombre</span><input type="text" id="perfil-nombre" maxlength="40" value="${esc(S.perfil.nombre)}" placeholder="¿Cómo te llamamos?"></label>
      <div class="small muted">Tu información se guarda solo en este celular, cifrada con tu PIN. La app funciona sin internet.</div></div>

    <div class="card settings"><h2 class="sec" style="margin:0 0 4px">Seguridad</h2>
      <div class="item"><span>Bloquear la app ahora</span><button class="btn ghost" data-act="bloquear">Bloquear</button></div>
      <div class="item"><span>Cambiar PIN</span><button class="btn ghost" data-act="panel" data-v="pin">Cambiar</button></div>
      ${UI.panel === 'pin' ? panelHTML() : ''}
      <div class="item"><span>Aviso de privacidad</span><button class="btn ghost" data-act="aviso">Ver</button></div></div>

    <div class="card stack"><h2 class="sec" style="margin:0">Categorías de gasto</h2><div class="chips">${tags('gasto')}</div>
      <h2 class="sec" style="margin:4px 0 0">Categorías de ingreso</h2><div class="chips">${tags('ingreso')}</div>
      <div class="row2"><select id="nueva-tipo" aria-label="Tipo de categoría"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select><input type="text" id="nueva-cat" maxlength="20" placeholder="Nueva categoría"></div>
      <button class="btn ghost" data-act="add-cat">Agregar categoría</button><div class="err" id="cat-err"></div></div>

    <div class="card settings"><h2 class="sec" style="margin:0 0 4px">Tus datos</h2>
      <div class="item"><span>Movimientos guardados</span><b class="num">${S.movimientos.length}</b></div>
      <div class="item"><span>Copia de seguridad</span><span class="acts"><button class="btn ghost" data-act="resp-guardar">Guardar archivo</button>${puedeCompartir ? '<button class="btn ghost" data-act="resp-compartir">Compartir</button>' : ''}</span></div>
      <div class="item"><span>Restaurar respaldo</span><button class="btn ghost" data-act="resp-elegir">Elegir archivo</button></div>
      ${UI.panel === 'restaurar' ? panelHTML() : ''}
      <div class="item"><span>Datos de ejemplo</span><button class="btn ghost" data-act="cargar-ejemplo">Cargar</button></div>
      <div class="item"><span>Borrar movimientos y presupuestos</span><button class="btn danger" data-act="panel" data-v="borrar">Borrar</button></div>
      ${UI.panel === 'borrar' ? panelHTML() : ''}
      <input type="file" id="resp-archivo" accept=".json,application/json" hidden></div>

    <div class="card settings"><h2 class="sec" style="margin:0 0 4px">Ayuda</h2>
      <div class="item"><span>Guía de uso</span><button class="btn ghost" data-act="guia">Ver guía</button></div></div>
    <p class="small muted" style="text-align:center">FinanTic 1.1 · Lions Vanguard Solutions</p>
    </div>`;
  }

  const VIEWS = { inicio, movimientos, reportes, presupuestos, perfil };
  const view = document.getElementById('view');
  function render() {
    if (!S) { view.innerHTML = ''; return; }
    view.innerHTML = VIEWS[UI.tab]();
    document.querySelectorAll('.nav button').forEach((b) => { if (b.dataset.tab === UI.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const bars = document.getElementById('bars');
    if (bars) { UI.cs = cubetas(UI.per); bars.innerHTML = barras(UI.cs, Math.max(260, bars.clientWidth || 320)); }
  }
  function go(tab) { UI.tab = tab; UI.editBud = false; UI.panel = null; if (tab === 'presupuestos') UI.per.modo = 'mes'; render(); window.scrollTo(0, 0); try { history.replaceState(null, '', '#' + tab); } catch (e) {} }

  // ---------- Hoja para registrar / editar ----------
  const root = document.getElementById('sheet-root');
  function abrirHoja(mov) {
    const ed = !!mov; const st = { tipo: mov ? mov.tipo : 'gasto', cat: mov ? mov.categoria : null };
    root.innerHTML = `<div class="overlay" id="ov"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">
      <div class="grab"></div>
      <div style="display:flex;justify-content:space-between;align-items:center"><h3 id="sh-t">${ed ? 'Editar movimiento' : 'Nuevo movimiento'}</h3><button class="btn ghost" data-act="cerrar" style="padding:6px 12px">Cerrar</button></div>
      <div class="seg" role="group" aria-label="Tipo"><button data-act="tipo" data-v="gasto">Gasto</button><button data-act="tipo" data-v="ingreso">Ingreso</button></div>
      <label class="amount"><span>$</span><input id="f-monto" inputmode="decimal" autocomplete="off" placeholder="0.00" aria-label="Monto" value="${mov ? mov.monto : ''}"></label>
      <div class="cats" id="f-cats"></div>
      <div class="row2"><label class="field"><span>Fecha</span><input type="date" id="f-fecha" value="${mov ? mov.fecha : hoy()}" max="2099-12-31"></label>
      <label class="field"><span>Nota (opcional)</span><input type="text" id="f-nota" maxlength="60" value="${esc(mov ? mov.nota : '')}" placeholder="Ej. comida con amigos"></label></div>
      <div class="err" id="f-err"></div>
      <button class="btn block" data-act="guardar">${ed ? 'Guardar cambios' : 'Guardar'}</button>
      ${ed ? `<div id="del-zone"><button class="btn danger block" data-act="pre-eliminar">Eliminar movimiento</button></div>` : ''}
    </div></div>`;
    const pintar = () => {
      root.querySelectorAll('[data-act="tipo"]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === st.tipo));
      root.querySelector('#f-cats').innerHTML = cats(st.tipo).map((c) => `<button class="cat" data-act="cat" data-v="${esc(c.nombre)}" aria-pressed="${st.cat === c.nombre}"><i style="background:${c.color}">${esc(c.nombre.slice(0, 1))}</i>${esc(c.nombre)}</button>`).join('');
    };
    pintar();
    root.querySelector('.sheet').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
      if (a === 'tipo') { if (st.tipo !== b.dataset.v) { st.tipo = b.dataset.v; st.cat = null; } pintar(); }
      if (a === 'cat') { st.cat = b.dataset.v; pintar(); }
      if (a === 'cerrar') cerrarHoja();
      if (a === 'pre-eliminar') root.querySelector('#del-zone').innerHTML = `<div class="confirm"><span>¿Eliminar este movimiento?</span><span style="display:flex;gap:6px"><button class="btn ghost" data-act="no-eliminar">No</button><button class="btn danger" data-act="eliminar">Sí, eliminar</button></span></div>`;
      if (a === 'no-eliminar') root.querySelector('#del-zone').innerHTML = `<button class="btn danger block" data-act="pre-eliminar">Eliminar movimiento</button>`;
      if (a === 'eliminar') { S.movimientos = S.movimientos.filter((m) => m.id !== mov.id); R.borrarMovimiento(mov.id).catch(fallo); cerrarHoja(); render(); toast('Movimiento eliminado'); }
      if (a === 'guardar') {
        const err = root.querySelector('#f-err');
        const monto = Math.round(Number(String(root.querySelector('#f-monto').value).replace(/[$,\s]/g, '')) * 100) / 100;
        const fecha = root.querySelector('#f-fecha').value; const nota = root.querySelector('#f-nota').value.trim();
        if (!(monto > 0)) { err.textContent = 'Escribe un monto mayor a cero.'; root.querySelector('#f-monto').focus(); return; }
        if (!st.cat) { err.textContent = 'Elige una categoría.'; return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) { err.textContent = 'Elige una fecha válida.'; return; }
        let m = mov;
        if (ed) Object.assign(m, { tipo: st.tipo, categoria: st.cat, monto, fecha, nota });
        else { m = { id: uid(), tipo: st.tipo, categoria: st.cat, monto, fecha, nota, creado: Date.now() }; S.movimientos.push(m); }
        R.guardarMovimiento(m).catch(fallo);
        cerrarHoja(); render(); toast(ed ? 'Cambios guardados' : (st.tipo === 'gasto' ? 'Gasto guardado' : 'Ingreso guardado'));
      }
    });
    root.querySelector('#ov').addEventListener('click', (e) => { if (e.target.id === 'ov') cerrarHoja(); });
    setTimeout(() => { const i = root.querySelector('#f-monto'); if (i && !ed) i.focus(); }, 60);
  }
  function cerrarHoja() { root.innerHTML = ''; const f = document.getElementById('fab'); if (f) f.focus(); }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.innerHTML) cerrarHoja(); });

  // ---------- Respaldo ----------
  async function armarRespaldo() {
    const pf = FT.acceso.perfil();
    const datos = { perfil: { nombre: S.perfil.nombre }, ...paraGuardar() };
    const sobre = { app: 'FinanTic', formato: 2, creado: new Date().toISOString(), sal: pf.sal, iteraciones: pf.iteraciones, ...(await FT.cifrado.cifrar(R.clave(), datos)) };
    return new File([JSON.stringify(sobre)], `finantic-respaldo-${hoy()}.json`, { type: 'application/json' });
  }
  async function guardarRespaldo() {
    const archivo = await armarRespaldo();
    const a = document.createElement('a'); a.href = URL.createObjectURL(archivo); a.download = archivo.name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Respaldo guardado en Descargas');
  }
  async function compartirRespaldo() {
    const archivo = await armarRespaldo();
    try { await navigator.share({ files: [archivo], title: 'Respaldo de FinanTic' }); }
    catch (e) { if (e.name !== 'AbortError') guardarRespaldo(); }
  }
  async function leerArchivo(file) {
    try {
      const d = JSON.parse(await file.text());
      if (d && d.app === 'FinanTic' && d.formato === 2 && d.ct) UI.respaldo = { nombre: file.name, cifrado: true, sobre: d, fecha: (d.creado || '').slice(0, 10) };
      else if (d && Array.isArray(d.movimientos) && d.categorias) UI.respaldo = { nombre: file.name, cifrado: false, datos: d };   // respaldo de la versión 1.0
      else throw new Error();
      UI.panel = 'restaurar'; render();
    } catch (e) { toast('El archivo no es un respaldo de FinanTic'); }
  }
  async function aplicarRespaldo() {
    const r = UI.respaldo, err = view.querySelector('#resp-err');
    let d;
    if (r.cifrado) {
      const pin = view.querySelector('#resp-pin').value;
      if (!/^\d{4}$/.test(pin)) { err.textContent = 'Escribe el PIN de 4 dígitos del respaldo.'; return; }
      try { const k = await FT.cifrado.derivarClave(pin, r.sobre.sal, r.sobre.iteraciones); d = await FT.cifrado.descifrar(k, r.sobre); }
      catch (e) { err.textContent = 'El PIN no corresponde a este respaldo.'; return; }
    } else d = r.datos;
    const nuevo = datosIniciales(null);
    S.movimientos = Array.isArray(d.movimientos) ? d.movimientos : [];
    S.categorias = d.categorias || nuevo.categorias;
    S.presupuestos = d.presupuestos || {};
    S.preferencias = d.preferencias || { ejemplo: !!d.ejemplo };
    await R.escribirTodo(paraGuardar()).catch(fallo);
    UI.panel = null; UI.respaldo = null; go('inicio'); toast('Respaldo restaurado');
  }

  // ---------- Eventos de la vista ----------
  document.querySelector('.nav').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); });
  document.getElementById('fab').addEventListener('click', () => abrirHoja(null));
  document.getElementById('btn-bloquear').addEventListener('click', () => FT.acceso.bloquear());
  view.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
    if (a === 'tab') go(b.dataset.v);
    if (a === 'edit') { const m = S.movimientos.find((x) => x.id === b.dataset.id); if (m) abrirHoja(m); }
    if (a === 'modo') { UI.per.modo = b.dataset.v; if (b.dataset.v === 'rango') { UI.per.hasta = hoy(); UI.per.desde = addDays(hoy(), -29); } render(); }
    if (a === 'prev') { mover(UI.per, -1); render(); }
    if (a === 'next') { mover(UI.per, 1); render(); }
    if (a === 'filtro') { UI.filtroTipo = b.dataset.v; render(); }
    if (a === 'bar') { const c = UI.cs[+b.dataset.i]; document.getElementById('bars-cap').innerHTML = `<b style="text-transform:capitalize">${c.full}</b> · <span style="color:var(--in)">Ingresos ${$(c.in)}</span> · <span style="color:var(--out)">Gastos ${$(c.out)}</span>`; }
    if (a === 'borrar-ejemplo') { S.movimientos = []; S.presupuestos = {}; S.preferencias.ejemplo = false; R.escribirTodo(paraGuardar()).catch(fallo); render(); toast('Listo, empieza a registrar'); }
    if (a === 'bud-edit') { UI.editBud = true; render(); }
    if (a === 'bud-cancel') { UI.editBud = false; render(); }
    if (a === 'bud-save') {
      view.querySelectorAll('[data-cat]').forEach((i) => { const v = Number(i.value); if (v > 0) S.presupuestos[i.dataset.cat] = v; else delete S.presupuestos[i.dataset.cat]; });
      R.guardarAjuste('presupuestos', S.presupuestos).catch(fallo); UI.editBud = false; render(); toast('Presupuestos guardados');
    }
    if (a === 'add-cat') {
      const tipo = view.querySelector('#nueva-tipo').value; const n = view.querySelector('#nueva-cat').value.trim(); const err = view.querySelector('#cat-err');
      if (!n) { err.textContent = 'Escribe el nombre de la categoría.'; return; }
      if (cats(tipo).some((c) => c.nombre.toLowerCase() === n.toLowerCase())) { err.textContent = 'Esa categoría ya existe.'; return; }
      cats(tipo).push({ nombre: n, color: PALETA[cats(tipo).length % PALETA.length] }); R.guardarAjuste('categorias', S.categorias).catch(fallo); render(); toast('Categoría agregada');
    }
    if (a === 'bloquear') FT.acceso.bloquear();
    if (a === 'aviso') FT.acceso.aviso();
    if (a === 'guia') FT.acceso.guia();
    if (a === 'panel') { UI.panel = UI.panel === b.dataset.v ? null : b.dataset.v; render(); const f = view.querySelector('.panel-extra input'); if (f) f.focus(); }
    if (a === 'panel-cerrar') { UI.panel = null; UI.respaldo = null; render(); }
    if (a === 'pin-guardar') {
      const act = view.querySelector('#pin-actual').value, nu = view.querySelector('#pin-nuevo').value, co = view.querySelector('#pin-conf').value, err = view.querySelector('#pin-err');
      if (![act, nu, co].every((p) => /^\d{4}$/.test(p))) { err.textContent = 'Los PIN deben tener 4 dígitos.'; return; }
      if (nu !== co) { err.textContent = 'El PIN nuevo y su confirmación no coinciden.'; return; }
      b.disabled = true; err.textContent = '';
      try { await FT.acceso.cambiarPin(act, nu, paraGuardar()); UI.panel = null; render(); toast('PIN actualizado'); }
      catch (er) { err.textContent = er.message || 'No se pudo cambiar el PIN.'; b.disabled = false; }
    }
    if (a === 'resp-guardar') guardarRespaldo().catch(() => toast('No se pudo crear el respaldo'));
    if (a === 'resp-compartir') compartirRespaldo().catch(() => toast('No se pudo crear el respaldo'));
    if (a === 'resp-elegir') { const inp = view.querySelector('#resp-archivo'); inp.value = ''; inp.click(); }
    if (a === 'resp-aplicar') { b.disabled = true; await aplicarRespaldo(); b.disabled = false; }
    if (a === 'cargar-ejemplo') { await cargarEjemplo(); go('inicio'); toast('Datos de ejemplo cargados'); }
    if (a === 'borrar-si') { const d = datosIniciales(null); d.categorias = S.categorias; Object.assign(S, d); R.escribirTodo(paraGuardar()).catch(fallo); UI.panel = null; go('inicio'); toast('Datos borrados'); }
  });
  view.addEventListener('change', (e) => {
    if (e.target.id === 'rng-desde' || e.target.id === 'rng-hasta') { if (e.target.value) { UI.per[e.target.id === 'rng-desde' ? 'desde' : 'hasta'] = e.target.value; render(); } }
    if (e.target.id === 'perfil-nombre') { const n = e.target.value.trim(); if (!n) return; S.perfil.nombre = n; FT.acceso.cambiarNombre(n).catch(fallo); toast('Nombre guardado'); }
    if (e.target.id === 'resp-archivo' && e.target.files[0]) leerArchivo(e.target.files[0]);
  });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (S && UI.tab === 'reportes') render(); }, 150); });

  async function cargarEjemplo() {
    S.movimientos = ejemplo(); S.presupuestos = { ...PRES_EJEMPLO }; S.preferencias.ejemplo = true;
    await R.escribirTodo(paraGuardar()).catch(fallo);
  }

  // ---------- API para el módulo de acceso ----------
  return {
    datosIniciales,
    iniciar(datos, nombre) {
      S = { perfil: { nombre }, categorias: datos.categorias || categoriasBase(), presupuestos: datos.presupuestos || {}, preferencias: datos.preferencias || { ejemplo: false }, movimientos: datos.movimientos || [] };
      UI.panel = null; UI.respaldo = null;
      const h = location.hash.slice(1); UI.tab = VIEWS[h] ? h : 'inicio';
      render();
    },
    cerrar() { S = null; cerrarHoja(); render(); },   // al bloquear, los datos salen de la memoria
    cargarEjemplo, render,
  };
})();
