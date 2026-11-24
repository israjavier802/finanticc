// FinanTic 1.1 · Base de datos local (IndexedDB)
// Base de datos "finantic" con tres almacenes (tablas):
//   perfil        → { id:'perfil', nombre, sal, iteraciones, verificador, ... }  (sin datos financieros)
//   movimientos   → { id, iv, ct }   cada movimiento cifrado por separado
//   ajustes       → { clave, iv, ct } categorías, presupuestos y preferencias, cifrados
window.FT = window.FT || {};
FT.repo = (() => {
  'use strict';
  const NOMBRE_BD = 'finantic', VERSION_BD = 1;
  let bd = null, clave = null, cola = Promise.resolve();
  const C = () => FT.cifrado;

  function abrir() {
    if (bd) return Promise.resolve(bd);
    return new Promise((ok, mal) => {
      const r = indexedDB.open(NOMBRE_BD, VERSION_BD);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('perfil')) d.createObjectStore('perfil', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('movimientos')) d.createObjectStore('movimientos', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('ajustes')) d.createObjectStore('ajustes', { keyPath: 'clave' });
      };
      r.onsuccess = () => { bd = r.result; ok(bd); };
      r.onerror = () => mal(r.error);
    });
  }
  const pedir = (req) => new Promise((ok, mal) => { req.onsuccess = () => ok(req.result); req.onerror = () => mal(req.error); });
  const terminar = (tx) => new Promise((ok, mal) => { tx.oncomplete = () => ok(); tx.onerror = () => mal(tx.error); tx.onabort = () => mal(tx.error); });
  // Las escrituras se hacen en orden, una tras otra
  const encolar = (fn) => (cola = cola.catch(() => {}).then(fn));

  // ---- Perfil (no cifrado: solo nombre y datos para verificar el PIN) ----
  async function obtenerPerfil() {
    const d = await abrir();
    return (await pedir(d.transaction('perfil').objectStore('perfil').get('perfil'))) || null;
  }
  async function guardarPerfil(perfil) {
    const d = await abrir(); const tx = d.transaction('perfil', 'readwrite');
    tx.objectStore('perfil').put(perfil); return terminar(tx);
  }

  // ---- Cargar todo y descifrarlo ----
  async function cargar() {
    const d = await abrir(); const tx = d.transaction(['movimientos', 'ajustes']);
    const [movs, ajs] = await Promise.all([pedir(tx.objectStore('movimientos').getAll()), pedir(tx.objectStore('ajustes').getAll())]);
    const k = clave;
    const datos = { movimientos: await Promise.all(movs.map((r) => C().descifrar(k, r))) };
    for (const a of ajs) datos[a.clave] = await C().descifrar(k, a);
    return datos;
  }

  // ---- Escrituras puntuales ----
  function guardarMovimiento(m) {
    const k = clave;
    return encolar(async () => {
      const reg = { id: m.id, ...(await C().cifrar(k, m)) };
      const d = await abrir(); const tx = d.transaction('movimientos', 'readwrite');
      tx.objectStore('movimientos').put(reg); return terminar(tx);
    });
  }
  function borrarMovimiento(id) {
    return encolar(async () => {
      const d = await abrir(); const tx = d.transaction('movimientos', 'readwrite');
      tx.objectStore('movimientos').delete(id); return terminar(tx);
    });
  }
  function guardarAjuste(nombre, valor) {
    const k = clave;
    return encolar(async () => {
      const reg = { clave: nombre, ...(await C().cifrar(k, valor)) };
      const d = await abrir(); const tx = d.transaction('ajustes', 'readwrite');
      tx.objectStore('ajustes').put(reg); return terminar(tx);
    });
  }

  // ---- Reescribir todo (registro, datos de ejemplo, restaurar respaldo, cambio de PIN) ----
  // datos = { movimientos, categorias, presupuestos, preferencias }
  function escribirTodo(datos, k = clave, perfil = null) {
    return encolar(async () => {
      // Primero se cifra todo; luego se escribe en una sola transacción (todo o nada)
      const movs = await Promise.all(datos.movimientos.map(async (m) => ({ id: m.id, ...(await C().cifrar(k, m)) })));
      const ajs = [];
      for (const n of ['categorias', 'presupuestos', 'preferencias']) ajs.push({ clave: n, ...(await C().cifrar(k, datos[n])) });
      const d = await abrir(); const tx = d.transaction(['perfil', 'movimientos', 'ajustes'], 'readwrite');
      tx.objectStore('movimientos').clear(); tx.objectStore('ajustes').clear();
      movs.forEach((r) => tx.objectStore('movimientos').put(r));
      ajs.forEach((r) => tx.objectStore('ajustes').put(r));
      if (perfil) tx.objectStore('perfil').put(perfil);
      return terminar(tx);
    });
  }

  // ---- Borrar la base de datos completa (cuando se olvida el PIN) ----
  function borrarTodo() {
    return encolar(() => new Promise((ok, mal) => {
      if (bd) { bd.close(); bd = null; }
      const r = indexedDB.deleteDatabase(NOMBRE_BD);
      r.onsuccess = () => ok(); r.onerror = () => mal(r.error); r.onblocked = () => ok();
    }));
  }

  return {
    obtenerPerfil, guardarPerfil, cargar, guardarMovimiento, borrarMovimiento, guardarAjuste, escribirTodo, borrarTodo,
    usarClave: (k) => { clave = k; }, clave: () => clave, esperar: () => cola.catch(() => {}),
  };
})();
