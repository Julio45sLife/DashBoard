/**
 * ui-components.js — v2.0
 * ══════════════════════════════════════════════════════════════════════════
 * Composants UI partagés — Suite numérique Vilar DS 2026
 * SARL Vilar DS · SIREN 495 126 344 · Semoy 45400
 *
 * RESPONSABILITÉS :
 *   - CSS design system complet (absorbe TOUT le CSS des modules)
 *   - mountModule() : génère et injecte sidebar, header, modal, banner
 *   - Composants HTML : kpi(), badge(), progressBar(), avatar(), card()
 *   - Aucune logique métier ici → tout dans vilar-core.js
 * ══════════════════════════════════════════════════════════════════════════
 */

'use strict';

window.VilarUI = (function () {

  /* ──────────────────────────────────────────────────────────────────────
     DESIGN SYSTEM — CSS complet
     Injecté une seule fois dans <head>, couvre l'intégralité des styles.
     Les modules HTML n'ont plus besoin de <style> propre.
  ────────────────────────────────────────────────────────────────────── */

  const CSS = /* css */`

/* ════════════════════════════════════════════
   RESET & BASE
════════════════════════════════════════════ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  height: 100%;
  font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
  background: var(--bg2);
  color: var(--ac);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ════════════════════════════════════════════
   DESIGN TOKENS
════════════════════════════════════════════ */
:root {
  /* Couleurs principales */
  --bn:   #1C2B3A;   /* Bleu Nuit — fond sidebar */
  --ba:   #2E4A6B;   /* Bleu Acier */
  --bc:   #4A7BA8;   /* Bleu Ciel — accents */
  --af:   #7A8FA6;   /* Argent Foncé — textes secondaires */
  --am:   #B8C8D8;   /* Argent Moyen */
  --ac:   #E8EEF4;   /* Argent Clair — texte principal */
  --or:   #C8A84B;   /* Or Accent — boutons, titres clés */
  --or2:  #DFC06A;   /* Or clair */
  --vl:   #1A6B3A;   /* Vert Foncé */
  --vll:  #4ADE80;   /* Vert Clair — OK, actif */
  --rl:   #8B1A1A;   /* Rouge Foncé */
  --rll:  #F87171;   /* Rouge Clair — erreurs, alertes */
  --jn:   #EAB308;   /* Jaune — avertissements */
  --ojl:  #FB923C;   /* Orange — dépenses, charges */

  /* Fonds */
  --bg:   #182738;   /* Fond cards */
  --bg2:  #0F1C28;   /* Fond page */
  --bg3:  #0A1520;   /* Fond modal, plus sombre */

  /* Bordures & effets */
  --bd:   rgba(184,200,216,0.12);
  --bd2:  rgba(184,200,216,0.22);

  /* Géométrie */
  --radius:    12px;
  --radius-sm: 7px;
  --radius-xs: 5px;

  /* Transitions */
  --trans:      all .2s cubic-bezier(.4,0,.2,1);
  --trans-slow: all .35s cubic-bezier(.4,0,.2,1);

  /* Ombres */
  --shadow:      0 4px 16px rgba(0,0,0,.25);
  --shadow-lg:   0 10px 28px rgba(0,0,0,.35);
  --shadow-card: 0 2px 8px rgba(0,0,0,.2);
}

/* ════════════════════════════════════════════
   SCROLLBAR
════════════════════════════════════════════ */
::-webkit-scrollbar       { width: 3px; height: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(74,123,168,.25); border-radius: 2px; }

/* ════════════════════════════════════════════
   ANIMATIONS
════════════════════════════════════════════ */
@keyframes fadeIn   { from { opacity: 0; transform: translateY(7px) } to { opacity: 1; transform: translateY(0) } }
@keyframes fadeInFast { from { opacity: 0 } to { opacity: 1 } }
@keyframes pulse    { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
@keyframes spin     { to { transform: rotate(360deg) } }
@keyframes slideIn  { from { transform: translateX(-100%) } to { transform: translateX(0) } }

/* ════════════════════════════════════════════
   LAYOUT PRINCIPAL
════════════════════════════════════════════ */
#sb {
  position: fixed; top: 0; left: 0;
  width: 248px; height: 100vh;
  background: linear-gradient(180deg, #070E18 0%, #0F1C28 100%);
  border-right: 1px solid var(--bd);
  z-index: 100;
  display: flex; flex-direction: column;
  overflow-y: auto;
  transition: transform .3s cubic-bezier(.4,0,.2,1);
}

#hdr {
  position: fixed; top: 0; left: 248px; right: 0;
  height: 56px;
  background: rgba(7,14,24,.97);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--bd);
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 90;
  gap: 8px;
}

#main {
  margin-left: 248px;
  padding-top: 56px;
  min-height: 100vh;
}

/* Overlay mobile sidebar */
#movr {
  display: none;
  position: fixed; inset: 0;
  background: rgba(0,0,0,.65);
  z-index: 99;
}

/* Persist banner */
#pbanner {
  background: rgba(200,168,75,.05);
  border-bottom: 1px solid rgba(200,168,75,.1);
  padding: 5px 20px;
  font-size: 10.5px; color: var(--or);
  display: flex; align-items: center;
  justify-content: space-between;
  gap: 8px; flex-wrap: wrap;
}
#pbanner button {
  background: transparent;
  border: 1px solid rgba(200,168,75,.28);
  color: var(--or); padding: 3px 9px;
  border-radius: var(--radius-xs);
  font-size: 10px; cursor: pointer;
  transition: var(--trans);
}
#pbanner button:hover { background: rgba(200,168,75,.1); }

/* ════════════════════════════════════════════
   VUES
════════════════════════════════════════════ */
.view {
  display: none;
  padding: 20px 22px;
  animation: fadeIn .22s ease;
}
.view.active { display: block; }

/* ════════════════════════════════════════════
   SIDEBAR — ÉLÉMENTS
════════════════════════════════════════════ */
.sb-logo {
  padding: 16px;
  border-bottom: 1px solid var(--bd);
  flex-shrink: 0;
}
.sb-logo-t {
  font-family: 'Syne', sans-serif;
  font-size: 17px; font-weight: 800; color: var(--or);
}
.sb-logo-s {
  font-size: 9px; color: var(--af);
  letter-spacing: 2px; text-transform: uppercase; margin-top: 1px;
}

.sb-save {
  margin: 8px 12px 0;
  padding: 6px 10px;
  background: rgba(200,168,75,.07);
  border: 1px solid rgba(200,168,75,.18);
  border-radius: var(--radius-sm);
  font-size: 10px; color: var(--or);
  display: flex; align-items: center; gap: 5px;
}

.sdot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--bc); flex-shrink: 0;
  transition: background .3s;
}
.sdot.dirty { background: var(--or); animation: pulse 1s infinite; }

/* Navigation sections et items */
.ns {
  padding: 11px 0 4px 14px;
  font-size: 9px; letter-spacing: 2px;
  color: rgba(122,143,166,.4);
  text-transform: uppercase;
}

.ni {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 14px; color: var(--af);
  cursor: pointer; font-size: 12.5px; font-weight: 500;
  border-left: 2px solid transparent;
  user-select: none; transition: var(--trans);
}
.ni:hover {
  color: var(--ac);
  background: rgba(74,123,168,.08);
  border-left-color: var(--bc);
}
.ni.active {
  color: var(--or);
  background: rgba(200,168,75,.07);
  border-left-color: var(--or);
}

/* Pills de comptage */
.ni .pill {
  margin-left: auto; font-size: 9px;
  padding: 2px 6px; border-radius: 9px; font-weight: 700;
}
.pv  { background: rgba(74,222,128,.15); color: var(--vll); }
.pr  { background: rgba(248,113,113,.15); color: var(--rll); }
.pj  { background: rgba(234,179,8,.15);  color: var(--jn);  }
.pb  { background: rgba(74,123,168,.15); color: var(--bc);  }
.por { background: rgba(200,168,75,.15); color: var(--or);  }

/* Pied de sidebar */
.sb-bot {
  margin-top: auto; padding: 11px 14px;
  border-top: 1px solid var(--bd); flex-shrink: 0;
}
.sb-bot-text    { font-size: 10.5px; color: var(--af); }
.sb-bot-version { font-size: 9px; color: rgba(122,143,166,.3); margin-top: 3px; }

/* ════════════════════════════════════════════
   HEADER — ÉLÉMENTS
════════════════════════════════════════════ */
.ht {
  font-family: 'Syne', sans-serif;
  font-size: 13px; font-weight: 800; white-space: nowrap;
}
.ht span { color: var(--or); }
.ht .dim { color: var(--af); font-size: 10.5px; font-weight: 400; }

.av {
  width: 30px; height: 30px; border-radius: 50%;
  background: linear-gradient(135deg, var(--ba), var(--or));
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 10px; color: #060E17;
  flex-shrink: 0; cursor: pointer;
}

/* Hamburger mobile */
#hbg {
  display: none;
  width: 30px; height: 30px;
  align-items: center; justify-content: center;
  background: rgba(255,255,255,.05);
  border: 1px solid var(--bd);
  border-radius: 6px; cursor: pointer;
  color: var(--ac); font-size: 15px;
  user-select: none;
}

/* ════════════════════════════════════════════
   TOASTS (container)
════════════════════════════════════════════ */
#toasts {
  position: fixed; top: 64px; right: 13px;
  z-index: 9999; display: flex;
  flex-direction: column; gap: 7px;
  pointer-events: none;
}

/* ════════════════════════════════════════════
   BOUTONS
════════════════════════════════════════════ */
.bo {
  background: linear-gradient(135deg, #C8A84B, #9A7828);
  color: #060E17; padding: 8px 14px;
  border-radius: var(--radius-sm); font-weight: 700; font-size: 12px;
  cursor: pointer; border: none;
  display: inline-flex; align-items: center; gap: 5px;
  transition: var(--trans); white-space: nowrap;
  font-family: 'DM Sans', sans-serif;
}
.bo:hover   { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(200,168,75,.25); }
.bo:active  { transform: translateY(0); }

.bou {
  background: rgba(74,123,168,.1);
  border: 1px solid rgba(74,123,168,.25);
  color: var(--bc); padding: 7px 13px;
  border-radius: var(--radius-sm); font-weight: 600; font-size: 12px;
  cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
  transition: var(--trans); white-space: nowrap;
  font-family: 'DM Sans', sans-serif;
}
.bou:hover { background: rgba(74,123,168,.18); }

.bv {
  background: rgba(26,107,58,.1);
  border: 1px solid rgba(26,107,58,.25);
  color: var(--vll); padding: 7px 13px;
  border-radius: var(--radius-sm); font-weight: 600; font-size: 12px;
  cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
  transition: var(--trans); font-family: 'DM Sans', sans-serif;
}
.bv:hover { background: rgba(26,107,58,.2); }

.hb {
  background: linear-gradient(135deg, #C8A84B, #9A7828);
  color: #060E17; padding: 7px 12px;
  border-radius: var(--radius-sm); font-weight: 700; font-size: 11.5px;
  cursor: pointer; border: none; transition: var(--trans);
  display: inline-flex; align-items: center; gap: 5px;
  font-family: 'DM Sans', sans-serif;
}
.hb:hover { transform: translateY(-1px); }
.hb.sec {
  background: rgba(74,123,168,.12);
  border: 1px solid rgba(74,123,168,.25);
  color: var(--bc);
}

/* Ghost & Danger */
.bg2 {
  background: transparent; border: 1px solid var(--bd);
  color: var(--af); padding: 6px 11px;
  border-radius: 6px; font-size: 11px; cursor: pointer;
  transition: var(--trans); font-family: 'DM Sans', sans-serif;
}
.bg2:hover { color: var(--ac); border-color: var(--bd2); }

.bd2 {
  background: rgba(139,26,26,.1);
  border: 1px solid rgba(139,26,26,.18);
  color: var(--rll); padding: 5px 9px;
  border-radius: 6px; font-size: 11px; cursor: pointer;
  transition: var(--trans); font-family: 'DM Sans', sans-serif;
}
.bd2:hover { background: rgba(139,26,26,.22); }

/* ════════════════════════════════════════════
   SECTIONS / CARDS
════════════════════════════════════════════ */
.sec {
  background: var(--bg); border: 1px solid var(--bd);
  border-radius: var(--radius); padding: 15px;
  margin-bottom: 13px; transition: var(--trans);
}
.sec:hover { border-color: rgba(200,168,75,.15); }

/* Header de section avec actions */
.sec-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px; padding-bottom: 8px;
  border-bottom: 1px solid var(--bd); gap: 8px;
}
.sec-header h3, .sec h3 {
  font-size: 10px; text-transform: uppercase;
  letter-spacing: 1px; color: var(--af); font-weight: 600;
  margin: 0;
}
.sec-actions { display: flex; gap: 6px; flex-shrink: 0; }

/* Row utilitaire */
.sh {
  display: flex; align-items: center;
  justify-content: space-between;
  margin-bottom: 14px; flex-wrap: wrap; gap: 9px;
}
.st {
  font-family: 'Syne', sans-serif;
  font-size: 15.5px; font-weight: 800;
}

/* Dual & Tri grids */
.dual { display: grid; grid-template-columns: 1fr 1fr; gap: 13px; margin-bottom: 13px; }
.tri  { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 13px; margin-bottom: 13px; }

/* ════════════════════════════════════════════
   KPI GRID
════════════════════════════════════════════ */
.kg {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
  gap: 11px; margin-bottom: 18px;
}

.kpi {
  background: var(--bg); border: 1px solid var(--bd);
  border-radius: var(--radius); padding: 14px 15px;
  transition: var(--trans); cursor: default;
}
.kpi:hover { border-color: rgba(200,168,75,.22); transform: translateY(-1px); }

.kl {
  font-size: 9.5px; text-transform: uppercase;
  letter-spacing: 1.2px; color: var(--af); font-weight: 600;
}
.kv {
  font-family: 'Syne', sans-serif;
  font-size: 23px; font-weight: 800;
  margin-top: 5px; line-height: 1;
}
.ks { font-size: 10.5px; color: var(--af); margin-top: 3px; }

/* Couleurs KPI */
.co  .kv { color: var(--or);  }
.cv  .kv { color: var(--vll); }
.cr  .kv { color: var(--rll); }
.cb  .kv { color: var(--bc);  }
.cj  .kv { color: var(--jn);  }
.col .kv { color: var(--ojl); }

/* ════════════════════════════════════════════
   TABLEAUX
════════════════════════════════════════════ */
.htab {
  width: 100%; border-collapse: collapse;
}
.htab th {
  font-size: 9.5px; text-transform: uppercase;
  letter-spacing: 1px; color: var(--af);
  padding: 9px 12px; text-align: left;
  font-weight: 600; border-bottom: 1px solid var(--bd);
}
.htab td {
  padding: 9px 12px; font-size: 12.5px;
  border-bottom: 1px solid rgba(184,200,216,.06);
  vertical-align: middle;
}
.htab tr:last-child td { border-bottom: none; }
.htab tr:hover    td { background: rgba(74,123,168,.04); }
.htab td.montant  { font-weight: 600; font-family: 'Syne', sans-serif; color: var(--or); }
.htab td.num      { font-weight: 600; color: var(--or); }
.htab tr.total-row td, .htab tr.total td {
  background: rgba(200,168,75,.08);
  font-weight: 700; color: var(--or);
}

/* Tableau détail (clé-valeur) */
.dtb { width: 100%; border-collapse: collapse; }
.dtb td {
  padding: 8px 11px; font-size: 12px;
  border-bottom: 1px solid rgba(184,200,216,.06);
  vertical-align: top;
}
.dtb tr:last-child td { border-bottom: none; }
.dtb td:first-child    { color: var(--af); width: 42%; }

/* ════════════════════════════════════════════
   TABS
════════════════════════════════════════════ */
.tabs {
  display: flex; gap: 3px;
  background: rgba(0,0,0,.2); padding: 3px;
  border-radius: 9px; margin-bottom: 14px; flex-wrap: wrap;
}
.tab {
  padding: 7px 13px; border-radius: 7px;
  font-size: 11.5px; font-weight: 500;
  cursor: pointer; color: var(--af);
  transition: var(--trans); border: none; background: transparent;
  font-family: 'DM Sans', sans-serif;
}
.tab.active { background: var(--ba); color: white; }
.tab:hover:not(.active) { color: var(--ac); background: rgba(255,255,255,.05); }
.tc        { display: none; animation: fadeIn .2s ease; }
.tc.active { display: block; }

/* ════════════════════════════════════════════
   FORMULAIRES
════════════════════════════════════════════ */
.fg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 11px;
}
.f1 {
  display: flex; flex-direction: column; gap: 4px;
}
.f1.full { grid-column: 1 / -1; }

.fl {
  font-size: 9.5px; text-transform: uppercase;
  letter-spacing: 1px; color: var(--af); font-weight: 600;
}

.fi, .fi-select, .fi-area {
  background: rgba(255,255,255,.04);
  border: 1px solid var(--bd);
  border-radius: var(--radius-sm);
  padding: 8px 11px; color: var(--ac);
  font-size: 12.5px; font-family: 'DM Sans', sans-serif;
  outline: none; width: 100%;
  transition: var(--trans);
}
.fi:focus, .fi-select:focus, .fi-area:focus {
  border-color: var(--bc);
  background: rgba(74,123,168,.05);
}
.fi.err      { border-color: rgba(248,113,113,.5); }
.fi option, .fi-select option { background: #0A1520; }
.fi-area     { resize: vertical; min-height: 65px; }

/* ════════════════════════════════════════════
   MODAL
════════════════════════════════════════════ */
#modalOv {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.78);
  z-index: 200; display: none;
  align-items: flex-start; justify-content: center;
  padding: 13px; overflow-y: auto;
}
#modalOv.open { display: flex; }

.mdl {
  background: var(--bg3);
  border: 1px solid rgba(200,168,75,.18);
  border-radius: 14px;
  width: 100%; max-width: 680px;
  margin: auto; animation: fadeIn .2s ease;
}
.mh {
  padding: 18px 21px 0;
  display: flex; align-items: flex-start; justify-content: space-between;
}
.mh h2 {
  font-family: 'Syne', sans-serif;
  font-size: 16px; font-weight: 800;
}
.mh .msub {
  font-size: 9px; color: var(--af);
  text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;
}
.mx {
  width: 27px; height: 27px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--af);
  background: rgba(255,255,255,.05);
  border: 1px solid var(--bd); font-size: 14px;
  flex-shrink: 0;
  user-select: none;
}
.mx:hover { color: var(--ac); }
.mb  { padding: 14px 21px; }
.mf  { padding: 0 21px 17px; display: flex; justify-content: flex-end; gap: 8px; }

/* Section label dans un modal form */
.msec {
  font-size: 10px; text-transform: uppercase;
  letter-spacing: 1px; color: var(--or); font-weight: 700;
  grid-column: 1 / -1; padding-top: 6px;
  border-top: 1px solid var(--bd); margin-top: 4px;
}

/* ════════════════════════════════════════════
   BADGES
════════════════════════════════════════════ */
.sbadge {
  padding: 3px 8px; border-radius: 18px;
  font-size: 9.5px; font-weight: 700;
  display: inline-flex; align-items: center; gap: 3px;
}
.s-or  { background: rgba(200,168,75,.15);   color: var(--or);  border: 1px solid rgba(200,168,75,.2);  }
.s-vl  { background: rgba(74,222,128,.12);   color: var(--vll); border: 1px solid rgba(74,222,128,.2);  }
.s-rl  { background: rgba(248,113,113,.12);  color: var(--rll); border: 1px solid rgba(248,113,113,.2); }
.s-bc  { background: rgba(74,123,168,.15);   color: var(--bc);  border: 1px solid rgba(74,123,168,.2);  }
.s-jn  { background: rgba(234,179,8,.15);    color: var(--jn);  border: 1px solid rgba(234,179,8,.2);   }
.s-pur { background: rgba(167,139,250,.15);  color: #A78BFA;    border: 1px solid rgba(167,139,250,.2); }
.s-af  { background: rgba(122,143,166,.15);  color: var(--am);  border: 1px solid rgba(122,143,166,.2); }

/* ════════════════════════════════════════════
   BARRES DE PROGRESSION
════════════════════════════════════════════ */
.prog-track {
  height: 6px; background: rgba(255,255,255,.07);
  border-radius: 3px; overflow: hidden;
}
.prog-fill {
  height: 100%; border-radius: 3px;
  transition: width .7s cubic-bezier(.4,0,.2,1);
}
.pf-or { background: linear-gradient(90deg, var(--bc), var(--or)); }
.pf-vl { background: linear-gradient(90deg, #1A6B3A, var(--vll)); }
.pf-rl { background: rgba(248,113,113,.5); }
.pf-jn { background: linear-gradient(90deg, var(--jn), var(--ojl)); }
.pf-bc { background: linear-gradient(90deg, var(--ba), var(--bc)); }

/* ════════════════════════════════════════════
   NAVIGATION — back button
════════════════════════════════════════════ */
.back {
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--af); font-size: 12px; cursor: pointer;
  background: rgba(255,255,255,.04);
  border: 1px solid var(--bd); padding: 6px 12px;
  border-radius: var(--radius-sm); margin-bottom: 15px;
  transition: var(--trans); user-select: none;
}
.back:hover { color: var(--ac); border-color: var(--bd2); }

/* ════════════════════════════════════════════
   ÉTAT VIDE
════════════════════════════════════════════ */
.empty {
  color: var(--af); font-size: 12.5px;
  padding: 20px 0; text-align: center;
}
.empty-ok { color: var(--vll); }

/* ════════════════════════════════════════════
   PLANNING GRID (RH)
════════════════════════════════════════════ */
.pg-wrap { overflow-x: auto; }

.pg-cell {
  background: #0D1B27; padding: 7px 5px;
  font-size: 9.5px; text-align: center;
}
.pg-cell.hdr      { background: #111E2D; color: var(--af); font-weight: 600; font-size: 8.5px; text-transform: uppercase; }
.pg-cell.hdr-name { text-align: left; padding-left: 10px; }
.pg-cell.pg-name  { text-align: left; font-weight: 600; font-size: 11.5px; padding-left: 10px; }
.pg-cell.travail  { background: rgba(74,123,168,.2);   color: var(--bc);  }
.pg-cell.conge    { background: rgba(234,179,8,.15);   color: var(--jn);  }
.pg-cell.rtt      { background: rgba(167,139,250,.15); color: #A78BFA;    }
.pg-cell.maladie  { background: rgba(248,113,113,.15); color: var(--rll); }
.pg-cell.formation{ background: rgba(200,168,75,.15);  color: var(--or);  }
.pg-cell.weekend  { background: rgba(122,143,166,.05); color: rgba(122,143,166,.3); }

/* ════════════════════════════════════════════
   CARDS SPÉCIAUX
════════════════════════════════════════════ */
/* Card salarié / SST */
.sal-card {
  background: var(--bg); border: 1px solid var(--bd);
  border-radius: var(--radius); overflow: hidden;
  cursor: pointer; transition: var(--trans);
}
.sal-card:hover {
  transform: translateY(-2px);
  border-color: rgba(200,168,75,.28);
  box-shadow: var(--shadow-lg);
}
.sal-card-bar    { height: 3px; }
.sal-card-body   { padding: 15px; }
.sal-card-meta   { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 10px; }
.sal-meta-item   { font-size: 11px; color: var(--af); display: flex; align-items: center; gap: 4px; }
.sal-meta-item b { color: var(--ac); font-weight: 500; }
.sal-card-foot   { padding: 10px 15px; border-top: 1px solid var(--bd); display: flex; align-items: center; justify-content: space-between; }

/* Congés bar (RH) */
.conges-row    { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.conges-label  { font-size: 12px; font-weight: 500; width: 140px; flex-shrink: 0; }
.conges-count  { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 800; color: var(--or); width: 50px; text-align: right; }

/* Tiles Dashboard (Hub) */
.tile {
  background: var(--bg); border: 1px solid var(--bd);
  border-radius: var(--radius); padding: 20px;
  cursor: pointer; transition: var(--trans);
  position: relative; overflow: hidden;
  display: flex; flex-direction: column; gap: 8px;
}
.tile:hover {
  transform: translateY(-3px);
  border-color: rgba(200,168,75,.3);
  box-shadow: var(--shadow-lg);
}
.tile-icon  { font-size: 28px; }
.tile-title { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 800; }
.tile-desc  { font-size: 11.5px; color: var(--af); }
.tile-badge {
  position: absolute; top: 12px; right: 12px;
  font-size: 9px; font-weight: 700; padding: 2px 8px;
  border-radius: 9px;
}
.tb-prod { background: rgba(74,222,128,.15); color: var(--vll); border: 1px solid rgba(74,222,128,.2); }
.tb-dev  { background: rgba(234,179,8,.12);  color: var(--jn);  border: 1px solid rgba(234,179,8,.2);  }

/* ════════════════════════════════════════════
   CONTRAT BADGES (RH)
════════════════════════════════════════════ */
.cb-cdi         { background: rgba(74,222,128,.12); color: var(--vll); border: 1px solid rgba(74,222,128,.2); }
.cb-cdd         { background: rgba(234,179,8,.15);  color: var(--jn);  border: 1px solid rgba(234,179,8,.2);  }
.cb-apprentissage{ background: rgba(167,139,250,.15);color: #A78BFA;   border: 1px solid rgba(167,139,250,.2);}
.cb-interimaire { background: rgba(74,123,168,.15); color: var(--bc);  border: 1px solid rgba(74,123,168,.2);  }

/* ════════════════════════════════════════════
   PHOTO VIEWER (Chantiers)
════════════════════════════════════════════ */
#photoViewer {
  position: fixed; inset: 0; background: rgba(0,0,0,.93);
  z-index: 300; display: none;
  align-items: center; justify-content: center;
}
#photoViewer.open { display: flex; }
#pvImg { max-width: 95vw; max-height: 90vh; border-radius: 8px; }
.pv-close {
  position: absolute; top: 16px; right: 20px;
  color: white; font-size: 28px; cursor: pointer;
  background: rgba(0,0,0,.4); border-radius: 50%;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
}

/* ════════════════════════════════════════════
   ALERT ITEMS
════════════════════════════════════════════ */
.alert-item {
  display: flex; align-items: flex-start; gap: 11px;
  padding: 10px 12px;
  background: var(--bg); border: 1px solid var(--bd);
  border-radius: 9px; margin-bottom: 8px;
  transition: var(--trans);
}
.alert-item:hover { border-color: rgba(200,168,75,.2); }
.alert-item.urgent { border-left: 3px solid var(--rll); }
.alert-item.warn   { border-left: 3px solid var(--jn);  }
.alert-item.info   { border-left: 3px solid var(--bc);  }

/* ════════════════════════════════════════════
   PRINT
════════════════════════════════════════════ */
@media print {
  #sb, #hdr, #pbanner, #hbg, #movr,
  .bo, .bou, .hb, .bg2, .bd2, .bv,
  .back { display: none !important; }

  #main { margin-left: 0 !important; padding-top: 0 !important; }
  body  { background: white !important; color: black !important; }
  .sec  { border: 1px solid #ccc !important; }
}

/* ════════════════════════════════════════════
   RESPONSIVE MOBILE
════════════════════════════════════════════ */
@media (max-width: 768px) {
  #sb          { transform: translateX(-100%); }
  #sb.open     { transform: translateX(0); }
  #movr.open   { display: block; }
  #hdr         { left: 0; }
  #main        { margin-left: 0; }
  #hbg         { display: flex; }

  .view        { padding: 13px; }
  .dual, .tri  { grid-template-columns: 1fr; }
  .fg          { grid-template-columns: 1fr; }
  .f1.full     { grid-column: 1; }
  .kg          { grid-template-columns: repeat(2, 1fr); }
  .sal-card-meta { grid-template-columns: 1fr; }
}

@media (max-width: 480px) {
  .kg { grid-template-columns: 1fr; }
}
`;

  /* ──────────────────────────────────────────────────────────────────────
     INJECTION CSS — une seule fois
  ────────────────────────────────────────────────────────────────────── */
  function injectCSS() {
    const id = 'vilar-ui-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = CSS;
    document.head.insertBefore(style, document.head.firstChild);
  }


  /* ──────────────────────────────────────────────────────────────────────
     TEMPLATES HTML
  ────────────────────────────────────────────────────────────────────── */

  /**
   * Génère le HTML de la sidebar.
   * @param {object} cfg
   * @param {string} cfg.moduleName     - ex: 'Chantiers & Projets 2026'
   * @param {string} cfg.moduleVersion  - ex: 'v2.0 — IndexedDB + PWA'
   * @param {Array}  cfg.navItems       - [{type:'section',label} | {id,icon,label,pill?,pillId?,pillClass?}]
   * @param {Array}  [cfg.dataActions]  - [{label, onClick}] — section Données en bas
   */
  function buildSidebar(cfg) {
    const { moduleName = '', moduleVersion = '', navItems = [], dataActions = [] } = cfg;

    const navHTML = navItems.map(item => {
      if (item.type === 'section') {
        return `<div class="ns">${item.label}</div>`;
      }
      const pill = item.pill !== undefined
        ? `<span class="pill ${item.pillClass || 'pv'}" id="${item.pillId || ''}">${item.pill}</span>`
        : '';
      return `
        <div class="ni" id="nav-${item.id}"
             onclick="VilarCore.nav.go('${item.id}')"
             role="button" tabindex="0"
             onkeydown="if(event.key==='Enter')VilarCore.nav.go('${item.id}')">
          <span class="ni-icon">${item.icon || ''}</span>
          <span>${item.label}</span>
          ${pill}
        </div>`;
    }).join('');

    const dataHTML = dataActions.map(a => `
      <div class="ni" onclick="${a.onClick}" id="${a.id || ''}"
           role="button" tabindex="0">
        <span>${a.icon || ''}</span>
        <span>${a.label}</span>
      </div>`).join('');

    const dataSectionHTML = dataActions.length
      ? `<div class="ns">Données</div>${dataHTML}`
      : '';

    return `
      <aside id="sb">
        <div class="sb-logo">
          <div class="sb-logo-t">VILAR DS</div>
          <div class="sb-logo-s">${moduleName}</div>
        </div>
        <div class="sb-save" id="saveStatus">
          <span class="sdot" id="saveDot"></span>
          <span id="saveText">Chargement…</span>
        </div>
        <nav>${navHTML}${dataSectionHTML}</nav>
        <div class="sb-bot">
          <div class="sb-bot-text">SIREN 495 126 344 · Semoy 45400</div>
          <div class="sb-bot-version">${moduleVersion}</div>
        </div>
      </aside>
      <div id="movr" onclick="VilarCore.ui.closeSidebar()"></div>`;
  }

  /**
   * Génère le HTML du header.
   * @param {object} cfg
   * @param {string} cfg.title     - ex: 'Chantiers & Projets'
   * @param {string} [cfg.year]    - ex: '2026'
   * @param {Array}  [cfg.actions] - [{label, icon?, class?, onClick}]
   * @param {string} [cfg.avatar]  - initiales, ex: 'JV'
   */
  function buildHeader(cfg) {
    const { title = '', year = '2026', actions = [], avatar = 'JV' } = cfg;

    const actionsHTML = actions.map(a => `
      <button class="hb ${a.class || ''}" onclick="${a.onClick}">
        ${a.icon ? `<span>${a.icon}</span>` : ''}<span>${a.label}</span>
      </button>`).join('');

    return `
      <header id="hdr">
        <div style="display:flex;align-items:center;gap:9px;">
          <div id="hbg" onclick="VilarCore.ui.toggleSidebar()" aria-label="Menu">☰</div>
          <div class="ht">
            Vilar DS — <span>${title}</span>
            <span class="dim">${year}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${actionsHTML}
          <div class="av" title="Gérant">${avatar}</div>
        </div>
      </header>`;
  }

  /** Génère le HTML du banner de persistance */
  function buildBanner(moduleName = '') {
    return `
      <div id="pbanner">
        <span>🔒 <strong>Données ${moduleName} sauvegardées localement</strong> (IndexedDB).</span>
        <div style="display:flex;gap:6px;">
          <button id="btn-export">↓ JSON</button>
          <button id="btn-import">↑ Importer</button>
        </div>
      </div>`;
  }

  /** Génère le HTML du modal (structure statique, contenu injecté dynamiquement) */
  function buildModal(subtitle = 'Vilar DS') {
    return `
      <div id="modalOv" onclick="VilarCore.modal.backdropClick(event)">
        <div class="mdl">
          <div class="mh">
            <div>
              <div class="msub">${subtitle}</div>
              <h2 id="mTitle">Modal</h2>
            </div>
            <div class="mx" onclick="VilarCore.modal.close()" title="Fermer (Esc)">✕</div>
          </div>
          <div class="mb" id="modalBody"></div>
          <div class="mf">
            <button class="bg2" id="mCancelBtn">Annuler</button>
            <button class="bo"  id="mSaveBtn">💾 Enregistrer</button>
          </div>
        </div>
      </div>`;
  }

  /** Container des toasts */
  function buildToasts() {
    return `<div id="toasts"></div>`;
  }


  /* ──────────────────────────────────────────────────────────────────────
     mountModule() — Point d'entrée principal pour chaque module HTML
  ────────────────────────────────────────────────────────────────────── */
  /**
   * Monte la sidebar, le header, le banner et le modal dans les points de montage.
   *
   * Le HTML du module doit contenir :
   *   <div id="sb-mount"></div>
   *   <div id="hdr-mount"></div>
   *   <div id="banner-mount"></div>
   *   <div id="modal-mount"></div>
   *   <div id="toasts-mount"></div>  (optionnel)
   *   <main id="main">…</main>
   *
   * @param {object} cfg
   * @param {object} cfg.sidebar  — passé à buildSidebar()
   * @param {object} cfg.header   — passé à buildHeader()
   * @param {string} [cfg.bannerModuleName] — nom affiché dans le banner
   * @param {string} [cfg.modalSubtitle]    — sous-titre du modal
   */
  function mountModule(cfg = {}) {
    injectCSS();

    const {
      sidebar = {},
      header  = {},
      bannerModuleName = sidebar.moduleName || '',
      modalSubtitle    = 'Vilar DS',
    } = cfg;

    // Helper d'injection dans un mount point
    function inject(mountId, html) {
      const el = document.getElementById(mountId);
      if (el) el.outerHTML = html;
    }

    inject('sb-mount',     buildSidebar(sidebar));
    inject('hdr-mount',    buildHeader(header));
    inject('banner-mount', buildBanner(bannerModuleName));
    inject('modal-mount',  buildModal(modalSubtitle));

    // Toasts — injection optionnelle
    const toastMount = document.getElementById('toasts-mount');
    if (toastMount) toastMount.outerHTML = buildToasts();
    else if (!document.getElementById('toasts')) {
      document.body.insertAdjacentHTML('afterbegin', buildToasts());
    }

    // Activer le premier nav item correspondant à 'dashboard' ou premier item
    const firstNav = document.querySelector('.ni[id]');
    if (firstNav) firstNav.classList.add('active');

    // Init sidebar mobile
    VilarCore.ui.closeSidebar();
  }


  /* ──────────────────────────────────────────────────────────────────────
     HELPERS HTML (utilisables dans les templates des modules)
  ────────────────────────────────────────────────────────────────────── */

  /** Génère une card KPI */
  function kpi(label, value, sub = '', colorClass = 'co') {
    return `
      <div class="kpi ${colorClass}">
        <div class="kl">${label}</div>
        <div class="kv">${value}</div>
        ${sub ? `<div class="ks">${sub}</div>` : ''}
      </div>`;
  }

  /** Génère un badge */
  function badge(label, colorClass = 's-or') {
    return `<span class="sbadge ${colorClass}">${label}</span>`;
  }

  /** Génère une barre de progression */
  function progressBar(pct, colorClass = 'pf-or', height = '6px') {
    const c = Math.min(100, Math.max(0, Math.round(pct)));
    return `
      <div class="prog-track" style="height:${height}">
        <div class="prog-fill ${colorClass}" style="width:${c}%"></div>
      </div>`;
  }

  /** Génère un avatar avec initiales */
  function avatar(initials, color = '#C8A84B', size = '34px') {
    return `
      <div style="
        width:${size};height:${size};border-radius:50%;
        background:${color}20;border:2px solid ${color};color:${color};
        display:inline-flex;align-items:center;justify-content:center;
        font-family:'Syne',sans-serif;font-size:${parseInt(size) <= 34 ? '11' : '14'}px;
        font-weight:800;flex-shrink:0;vertical-align:middle;"
      >${initials}</div>`;
  }

  /** Génère une ligne de tableau vide */
  function emptyRow(colspan, msg = 'Aucun élément.') {
    return `<tr><td colspan="${colspan}" class="empty">${msg}</td></tr>`;
  }


  /* ──────────────────────────────────────────────────────────────────────
     API PUBLIQUE
  ────────────────────────────────────────────────────────────────────── */
  return Object.freeze({
    // Montage
    injectCSS,
    mountModule,

    // Builders (utilisables hors mountModule)
    buildSidebar,
    buildHeader,
    buildBanner,
    buildModal,

    // Helpers templates
    kpi,
    badge,
    progressBar,
    avatar,
    emptyRow,
  });

})();
