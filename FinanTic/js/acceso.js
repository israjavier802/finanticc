// FinanTic 1.1 · Acceso: registro, inicio de sesión con PIN, bloqueo automático,
// guía de uso y aviso de privacidad.
window.FT = window.FT || {};
FT.acceso = (() => {
  'use strict';
  const { esc, toast } = FT.u;
  const C = FT.cifrado, R = FT.repo;
  const raiz = document.getElementById('acceso');
  const MAX_INTENTOS = 5;                 // después de 5 errores hay que esperar
  const INACTIVIDAD_MS = 3 * 60 * 1000;   // se bloquea tras 3 minutos sin uso
  const FUERA_MS = 30 * 1000;             // o si sales de la app más de 30 segundos
  const LEGADO = 'finantic.v1';           // datos de la versión 1.0 (localStorage)
  let perfil = null, teclaActual = null, temporizador = null, ocultoDesde = 0;

  const LOGO = `<div class="acc-logo"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="var(--accent)"/><path d="M8 21l5-5 4 3 7-8" fill="none" stroke="var(--accent-ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="11" r="2.2" fill="var(--accent-ink)"/></svg>FinanTic</div>`;

  function mostrar(html) {
    document.body.dataset.estado = 'bloqueado';
    teclaActual = null;
    raiz.hidden = false; raiz.innerHTML = `<div class="acc-in">${html}</div>`; raiz.scrollTop = 0;
  }
  function ocultar() { raiz.hidden = true; raiz.innerHTML = ''; teclaActual = null; document.body.dataset.estado = 'abierto'; armarInactividad(); }

  // ---------- Teclado numérico para el PIN ----------
  function teclado({ titulo, sub, extra = '', alCompletar }) {
    mostrar(`${LOGO}<h1>${titulo}</h1><p class="sub">${sub}</p>
      <div class="dots" id="dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="pin-msg" id="pin-msg" role="alert"></div>
      <div class="keypad" id="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}<span></span><button data-k="0">0</button><button data-k="del" class="k-del" aria-label="Borrar">⌫</button></div>
      ${extra}`);
    let pin = '', ocupado = false;
    const dots = [...raiz.querySelectorAll('#dots i')], msg = (t) => { raiz.querySelector('#pin-msg').textContent = t; };
    const pintar = () => dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
    async function tecla(k) {
      if (ocupado) return;
      if (k === 'del') pin = pin.slice(0, -1); else if (pin.length < 4) pin += k;
      pintar();
      if (pin.length === 4) {
        ocupado = true; const valor = pin;
        const aceptado = await alCompletar(valor, msg);
        ocupado = false;
        if (!aceptado && raiz.querySelector('#dots')) {
          pin = ''; pintar();
          const el = raiz.querySelector('#dots'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
        }
      } else if (pin.length) msg('');
    }
    raiz.querySelector('#keypad').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) tecla(b.dataset.k); });
    teclaActual = (e) => { if (/^\d$/.test(e.key)) tecla(e.key); else if (e.key === 'Backspace') tecla('del'); };
  }
  document.addEventListener('keydown', (e) => { if (teclaActual && !raiz.hidden && !/input|textarea/i.test(e.target.tagName)) teclaActual(e); });

  // ---------- Registro (primera vez) ----------
  function datosLegado() {
    try { const raw = localStorage.getItem(LEGADO); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function registro() {
    const legado = datosLegado();
    mostrar(`${LOGO}<h1>Crea tu perfil</h1><p class="sub">Tu información se guarda solo en este celular y se protege con un PIN.</p>
      <div class="card stack">
        <label class="field"><span>¿Cómo te llamas?</span><input type="text" id="reg-nombre" maxlength="40" autocomplete="given-name" placeholder="Tu nombre" value="${esc(legado?.perfil?.nombre || '')}"></label>
        ${legado ? `<div class="aviso-mini">Encontramos información de la versión anterior de FinanTic. Se conservará y quedará protegida con tu nuevo PIN.</div>` : ''}
        <label class="check"><input type="checkbox" id="reg-acepto"><span>Leí y acepto el <button type="button" class="link" data-act="ver-aviso" style="padding:0">aviso de privacidad</button>.</span></label>
        <div class="err" id="reg-err"></div>
        <button class="btn block" data-act="reg-continuar">Continuar</button>
      </div>`);
    raiz.querySelector('[data-act="ver-aviso"]').onclick = () => {
      const nombre = raiz.querySelector('#reg-nombre').value;
      aviso(() => { registro(); raiz.querySelector('#reg-nombre').value = nombre; });
    };
    raiz.querySelector('[data-act="reg-continuar"]').onclick = () => {
      const nombre = raiz.querySelector('#reg-nombre').value.trim(); const err = raiz.querySelector('#reg-err');
      if (!nombre) { err.textContent = 'Escribe tu nombre.'; return; }
      if (!raiz.querySelector('#reg-acepto').checked) { err.textContent = 'Para continuar, acepta el aviso de privacidad.'; return; }
      crearPin(nombre, legado);
    };
  }
  function crearPin(nombre, legado) {
    teclado({
      titulo: 'Crea tu PIN', sub: '4 dígitos. Te lo pediremos cada vez que abras FinanTic.',
      extra: `<div class="aviso-mini"><b>Importante:</b> si olvidas tu PIN no podrás recuperar tu información, porque no se guarda en ningún servidor. Haz respaldos desde tu Perfil.</div>`,
      alCompletar: async (pin1) => {
        teclado({
          titulo: 'Confirma tu PIN', sub: 'Escríbelo de nuevo.',
          alCompletar: async (pin2, msg) => {
            if (pin2 !== pin1) { msg('Los PIN no coinciden. Vuelve a crearlo.'); setTimeout(() => crearPin(nombre, legado), 1200); return false; }
            msg(''); await finalizarRegistro(nombre, pin1, legado); return true;
          },
        });
        return true;
      },
    });
  }
  async function finalizarRegistro(nombre, pin, legado) {
    const sal = C.nuevaSal();
    const clave = await C.derivarClave(pin, sal);
    perfil = { id: 'perfil', version: 2, nombre, sal, iteraciones: C.ITERACIONES, verificador: await C.cifrar(clave, { ok: 'FINANTIC' }), creado: new Date().toISOString(), intentos: 0, esperaHasta: 0 };
    const datos = FT.app.datosIniciales(legado);
    R.usarClave(clave);
    await R.escribirTodo(datos, clave, perfil);
    if (legado) { try { localStorage.removeItem(LEGADO); } catch (e) {} }
    FT.app.iniciar(datos, nombre);
    guia({ desdeRegistro: true, migrado: !!legado });
  }

  // ---------- Inicio de sesión con PIN ----------
  function desbloqueo() {
    teclado({
      titulo: `Hola, ${esc(perfil.nombre)}`, sub: 'Ingresa tu PIN',
      extra: `<p class="center"><button class="link" id="olvide">¿Olvidaste tu PIN?</button></p>`,
      alCompletar: async (pin, msg) => {
        const ahora = Date.now();
        if (perfil.esperaHasta > ahora) { msg(`Demasiados intentos. Espera ${Math.ceil((perfil.esperaHasta - ahora) / 1000)} segundos.`); return false; }
        msg('Verificando…');
        let clave = null;
        try { clave = await C.derivarClave(pin, perfil.sal, perfil.iteraciones); await C.descifrar(clave, perfil.verificador); }
        catch (e) { clave = null; }
        if (!clave) {
          perfil.intentos = (perfil.intentos || 0) + 1;
          if (perfil.intentos >= MAX_INTENTOS) {
            perfil.esperaHasta = Date.now() + 30000 * 2 ** (perfil.intentos - MAX_INTENTOS);
            msg(`PIN incorrecto. Espera ${Math.round((perfil.esperaHasta - Date.now()) / 1000)} segundos para volver a intentar.`);
          } else msg(`PIN incorrecto. Te quedan ${MAX_INTENTOS - perfil.intentos} intentos.`);
          await R.guardarPerfil(perfil); return false;
        }
        perfil.intentos = 0; perfil.esperaHasta = 0; await R.guardarPerfil(perfil);
        R.usarClave(clave);
        try { FT.app.iniciar(await R.cargar(), perfil.nombre); }
        catch (e) { msg('No se pudo leer tu información.'); return false; }
        ocultar(); return true;
      },
    });
    raiz.querySelector('#olvide').onclick = olvide;
  }
  function olvide() {
    mostrar(`${LOGO}<h1>¿Olvidaste tu PIN?</h1>
      <div class="card stack">
        <p style="margin:0">Tu información está cifrada con tu PIN y no se guarda en ningún servidor, así que <b>no hay forma de recuperarla sin él</b>.</p>
        <p style="margin:0">Puedes borrar todo y crear un perfil nuevo. Si tienes un archivo de respaldo, podrás restaurarlo después desde tu Perfil con el PIN que tenías al crearlo.</p>
        <label class="field"><span>Escribe BORRAR para confirmar</span><input type="text" id="olv-conf" autocomplete="off"></label>
        <button class="btn danger block" id="olv-borrar" disabled>Borrar todo y crear perfil nuevo</button>
        <button class="btn ghost block" id="olv-volver">Volver</button>
      </div>`);
    const conf = raiz.querySelector('#olv-conf'), btn = raiz.querySelector('#olv-borrar');
    conf.oninput = () => { btn.disabled = conf.value.trim().toUpperCase() !== 'BORRAR'; };
    btn.onclick = async () => { await R.borrarTodo(); perfil = null; R.usarClave(null); toast('Datos borrados'); registro(); };
    raiz.querySelector('#olv-volver').onclick = desbloqueo;
  }

  // ---------- Bloqueo ----------
  function bloquear() {
    if (!perfil || document.body.dataset.estado === 'bloqueado') return;
    clearTimeout(temporizador);
    R.usarClave(null); FT.app.cerrar(); desbloqueo();
  }
  function armarInactividad() { clearTimeout(temporizador); if (document.body.dataset.estado === 'abierto') temporizador = setTimeout(bloquear, INACTIVIDAD_MS); }
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((ev) => document.addEventListener(ev, () => { if (document.body.dataset.estado === 'abierto') armarInactividad(); }, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ocultoDesde = Date.now();
    else if (ocultoDesde && Date.now() - ocultoDesde > FUERA_MS) bloquear();
  });

  // ---------- Cambiar PIN (desde Perfil) ----------
  async function cambiarPin(actual, nuevo, datos) {
    try { const k = await C.derivarClave(actual, perfil.sal, perfil.iteraciones); await C.descifrar(k, perfil.verificador); }
    catch (e) { throw new Error('El PIN actual no es correcto.'); }
    const sal = C.nuevaSal(); const clave = await C.derivarClave(nuevo, sal);
    const nuevoPerfil = { ...perfil, sal, iteraciones: C.ITERACIONES, verificador: await C.cifrar(clave, { ok: 'FINANTIC' }), intentos: 0, esperaHasta: 0 };
    await R.escribirTodo(datos, clave, nuevoPerfil);   // se vuelve a cifrar todo con la clave nueva
    perfil = nuevoPerfil; R.usarClave(clave);
  }
  async function cambiarNombre(nombre) { perfil.nombre = nombre; await R.guardarPerfil(perfil); }

  // ---------- Guía de uso ----------
  const ICONOS = {
    hola: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l5-5 4 3 7-8"/><circle cx="20" cy="6" r="1.4" fill="currentColor"/><path d="M3 21h18"/></svg>',
    mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/></svg>',
    graf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    escudo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  };
  const PASOS = [
    { ico: 'hola', t: 'Bienvenido a FinanTic', p: 'Registra tus ingresos y gastos, descubre en qué se va tu dinero y controla tus presupuestos. Funciona sin internet.' },
    { ico: 'mas', t: 'Registra en segundos', lista: ['Toca el botón <b>+</b>.', 'Escribe el monto.', 'Elige si es gasto o ingreso y su categoría.', 'Toca <b>Guardar</b>.'], p: 'Para editar o eliminar un movimiento, tócalo en la lista.' },
    { ico: 'graf', t: 'Revisa y planea', lista: ['<b>Movimientos:</b> consulta por día, mes, año o un periodo.', '<b>Reportes:</b> gráficas, gastos por categoría y tasa de ahorro.', '<b>Presupuestos:</b> pon un límite mensual por categoría y te avisamos al acercarte.'] },
    { ico: 'escudo', t: 'Tu información, protegida', lista: ['Se guarda <b>solo en este celular</b>, cifrada con tu PIN.', 'La app se bloquea sola si no la usas.', 'Haz <b>respaldos</b> desde Perfil para no perder tus datos si cambias de celular.'] },
  ];
  function guia({ desdeRegistro = false, migrado = false, i = 0 } = {}) {
    const paso = PASOS[i], ultimo = i === PASOS.length - 1;
    mostrar(`<div class="slide"><div class="ill">${ICONOS[paso.ico]}</div><h1>${paso.t}</h1>
        ${paso.lista ? `<ol>${paso.lista.map((x) => `<li>${x}</li>`).join('')}</ol>` : ''}${paso.p ? `<p>${paso.p}</p>` : ''}</div>
      <div class="pag" aria-label="Paso ${i + 1} de ${PASOS.length}">${PASOS.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="acc-acts">${ultimo
        ? (desdeRegistro && !migrado
          ? `<button class="btn block" data-g="vacio">Empezar</button><button class="btn ghost block" data-g="ejemplo">Explorar con datos de ejemplo</button>`
          : `<button class="btn block" data-g="listo">${desdeRegistro ? 'Empezar' : 'Listo'}</button>`)
        : `<button class="btn block" data-g="sig">Siguiente</button><button class="link" data-g="omitir">Omitir guía</button>`}</div>`);
    raiz.querySelector('.acc-acts').onclick = async (e) => {
      const b = e.target.closest('[data-g]'); if (!b) return;
      const g = b.dataset.g;
      if (g === 'sig') return guia({ desdeRegistro, migrado, i: i + 1 });
      if (g === 'omitir') return guia({ desdeRegistro, migrado, i: PASOS.length - 1 });
      if (g === 'ejemplo') await FT.app.cargarEjemplo();
      ocultar(); FT.app.render();
      if (desdeRegistro) toast('Perfil creado');
    };
  }

  // ---------- Aviso de privacidad ----------
  function aviso(volver) {
    mostrar(`<h1 style="text-align:left">Aviso de privacidad</h1>
      <div class="card legal">
        <p><b>FinanTic</b> es una aplicación desarrollada por el equipo <b>Lions Vanguard Solutions</b> (Instituto Tecnológico de Puebla) para la administración de finanzas personales.</p>
        <h2>Datos que se registran</h2>
        <ul><li>Tu nombre, para personalizar la app.</li><li>Los ingresos y gastos que captures: monto, categoría, fecha y nota.</li><li>Tus categorías y presupuestos.</li></ul>
        <h2>Para qué se usan</h2>
        <p>Únicamente para mostrarte tus balances, reportes, gráficas y avisos de presupuesto. No se usan con fines comerciales ni publicitarios.</p>
        <h2>Dónde se guardan</h2>
        <p>Solo en este dispositivo, en una base de datos local <b>cifrada con tu PIN</b> (AES-256). FinanTic no envía tu información a ningún servidor ni la comparte con terceros. El equipo de desarrollo no tiene acceso a ella.</p>
        <h2>Tus derechos</h2>
        <p>Puedes consultar, corregir o eliminar tu información en cualquier momento desde la propia app (Movimientos y Perfil → Borrar). También puedes exportar un respaldo cifrado; su resguardo es tu responsabilidad.</p>
        <h2>Seguridad</h2>
        <p>La app se bloquea automáticamente y pide tu PIN. Si olvidas tu PIN, la información no puede recuperarse.</p>
        <p class="muted small">Este aviso atiende los principios de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares. Última actualización: noviembre de 2026.</p>
      </div>
      <button class="btn block" id="aviso-volver">Volver</button>`);
    raiz.querySelector('#aviso-volver').onclick = () => (volver ? volver() : ocultar());
  }

  // ---------- Inicio ----------
  async function iniciar() {
    document.body.dataset.estado = 'bloqueado';
    if (!C.disponible()) {
      mostrar(`${LOGO}<h1>No se puede abrir FinanTic aquí</h1><p class="sub">Abre la app desde su dirección segura (https) o instalada en tu celular, con un navegador actualizado.</p>`);
      return;
    }
    try { perfil = await R.obtenerPerfil(); }
    catch (e) { mostrar(`${LOGO}<h1>No se pudo abrir la base de datos</h1><p class="sub">Revisa que el navegador permita guardar datos de sitios y vuelve a abrir la app.</p>`); return; }
    if (perfil) desbloqueo(); else registro();
  }

  return { iniciar, bloquear, cambiarPin, cambiarNombre, guia: () => guia(), aviso: () => aviso(), perfil: () => perfil };
})();
