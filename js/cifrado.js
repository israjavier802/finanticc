// FinanTic 1.1 · Cifrado
// El PIN nunca se guarda. Con el PIN y una "sal" aleatoria se deriva una clave AES-256
// (PBKDF2-SHA256). Cada registro se guarda cifrado con AES-GCM y su propio vector (iv).
// Usa la criptografía que ya trae el navegador (Web Crypto), sin librerías externas.
window.FT = window.FT || {};
FT.cifrado = (() => {
  'use strict';
  const ITERACIONES = 200000;
  const txt = new TextEncoder(), dec = new TextDecoder();

  const aleatorio = (n) => crypto.getRandomValues(new Uint8Array(n));
  const aB64 = (u8) => { let s = ''; u8.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); };
  const deB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  // PIN + sal → clave AES-GCM de 256 bits (no exportable)
  async function derivarClave(pin, salB64, iteraciones = ITERACIONES) {
    const base = await crypto.subtle.importKey('raw', txt.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: deB64(salB64), iterations: iteraciones, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  // Objeto → { iv, ct } (texto cifrado en base64)
  async function cifrar(clave, obj) {
    const iv = aleatorio(12);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, txt.encode(JSON.stringify(obj)));
    return { iv: aB64(iv), ct: aB64(new Uint8Array(ct)) };
  }

  // { iv, ct } → objeto. Falla si la clave (el PIN) no es la correcta.
  async function descifrar(clave, { iv, ct }) {
    const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(iv) }, clave, deB64(ct));
    return JSON.parse(dec.decode(plano));
  }

  const nuevaSal = () => aB64(aleatorio(16));
  const disponible = () => !!(window.crypto && crypto.subtle && window.indexedDB);

  return { ITERACIONES, derivarClave, cifrar, descifrar, nuevaSal, disponible };
})();
