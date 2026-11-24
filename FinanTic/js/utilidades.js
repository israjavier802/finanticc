// FinanTic 1.1 · Utilidades compartidas (fechas, formato de dinero, avisos)
window.FT = window.FT || {};
FT.u = (() => {
  'use strict';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const hoy = () => iso(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money0 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  const $ = (v) => money.format(v);
  const short = (v) => Math.abs(v) >= 1000 ? '$' + (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.0', '') + 'k' : '$' + Math.round(v);
  const fechaLarga = (s) => { const d = parse(s); return `${DIAS[d.getDay()]} ${d.getDate()} ${MES3[d.getMonth()]}`; };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.append(t); setTimeout(() => t.remove(), 2000);
  }
  return { MESES, MES3, DIAS, pad, iso, parse, hoy, addDays, esc, money, money0, $, short, fechaLarga, uid, toast };
})();
