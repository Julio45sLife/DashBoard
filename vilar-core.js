/**
 * vilar-core.js — v2.0
 * ══════════════════════════════════════════════════════════════════════════
 * Noyau partagé — Suite numérique Vilar DS 2026
 * SARL Vilar DS · SIREN 495 126 344 · Semoy 45400
 *
 * RESPONSABILITÉS :
 *   - Base de données unifiée (VilarDS_Main)
 *   - Persistance, dirty-state, auto-save
 *   - AppBus (pub/sub inter-modules)
 *   - Navigation (gv, goBack, register)
 *   - Toasts, Modal générique
 *   - Export / Import JSON
 *   - PWA / Service Worker
 *   - Utilitaires partagés
 *   - ModuleRegistry (mountApp)
 * ══════════════════════════════════════════════════════════════════════════
 */

'use strict';

window.VilarCore = (function () {

  /* ──────────────────────────────────────────────────────────────────────
     CONSTANTES GLOBALES
  ────────────────────────────────────────────────────────────────────── */
  const VERSION   = '2.0.0';
  const DB_NAME   = 'VilarDS_Main';
  const DB_VER    = 2;
  const DB_STORES = ['vilarDS', 'shared', 'meta'];

  const TODAY = new Date('2026-04-28');

  const MOIS = [
    'Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
  ];
  const MA = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const JOURS_SEMAINE = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];


  /* ──────────────────────────────────────────────────────────────────────
     UTILITAIRES
  ────────────────────────────────────────────────────────────────────── */
  const utils = {
    /** Formate un nombre en euros : 12 500 € */
    fmt(n, decimals = 0) {
      return Number(n || 0).toLocaleString('fr-FR', {
        minimumFractionDigits:  decimals,
        maximumFractionDigits:  decimals,
      }) + ' €';
    },

    /** Formate une date ISO → "28 avr. 2026" */
    fmtD(d) {
      if (!d) return '—';
      try {
        return new Date(d).toLocaleDateString('fr-FR', {
          day: '2-digit', month: 'short', year: 'numeric',
        });
      } catch { return '—'; }
    },

    /** Formate une date ISO → "28/04/2026" */
    fmtDShort(d) {
      if (!d) return '—';
      try { return new Date(d).toLocaleDateString('fr-FR'); }
      catch { return '—'; }
    },

    /** Jours restants avant date (négatif si dépassé) */
    daysUntil(d) {
      if (!d) return null;
      return Math.ceil((new Date(d) - TODAY) / 864e5);
    },

    /** Pourcentage sécurisé, arrondi entier */
    pct(val, total) {
      return total > 0 ? Math.round((val / total) * 100) : 0;
    },

    /** Clamp une valeur entre min et max */
    clamp(v, min, max) { return Math.min(max, Math.max(min, v)); },

    /** getElementById raccourci */
    $(id) { return document.getElementById(id); },

    /** querySelector */
    q(sel, parent = document) { return parent.querySelector(sel); },

    /** querySelectorAll → Array */
    qa(sel, parent = document) { return Array.from(parent.querySelectorAll(sel)); },

    /** Debounce */
    debounce(fn, ms = 300) {
      let t;
      return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    },

    /** Génère un ID alphanumérique court */
    uid(prefix = '') {
      return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    },

    /** Deep clone JSON-safe */
    clone(obj) {
      try { return JSON.parse(JSON.stringify(obj)); }
      catch { return obj; }
    },

    /** Échappe HTML basique */
    esc(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
  };


  /* ──────────────────────────────────────────────────────────────────────
     BASE DE DONNÉES — VilarDS_Main (unifiée)
     Deux stores :
       • vilarDS  → données de chaque module (clé = nom du module)
       • shared   → données publiées inter-modules
       • meta     → métadonnées globales (version, migrations)
  ────────────────────────────────────────────────────────────────────── */
  const db = (() => {
    let _idb = null;

    /** Ouvre (ou récupère) la connexion IndexedDB principale */
    function open() {
      if (_idb) return Promise.resolve(_idb);
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VER);

        req.onupgradeneeded = (e) => {
          const database = e.target.result;
          // Créer les stores manquants
          DB_STORES.forEach(name => {
            if (!database.objectStoreNames.contains(name)) {
              database.createObjectStore(name);
            }
          });
          // Migration v1 → v2 : importer les anciennes DBs isolées si présentes
          // (géré côté module lors du premier loadData)
        };

        req.onsuccess  = (e) => { _idb = e.target.result; resolve(_idb); };
        req.onerror    = ()  => reject(new Error(`IDB open failed: ${req.error}`));
        req.onblocked  = ()  => {
          console.warn('[VilarCore] DB bloquée — fermez les autres onglets Vilar DS');
        };
      });
    }

    /** Exécute une transaction */
    async function _tx(storeName, mode, fn) {
      const database = await open();
      return new Promise((resolve, reject) => {
        let tx;
        try {
          tx = database.transaction(storeName, mode);
        } catch (e) {
          // Store absent → réouvrir avec version incrémentée (cas migration)
          reject(new Error(`Store "${storeName}" introuvable: ${e.message}`));
          return;
        }
        const store = tx.objectStore(storeName);
        const req   = fn(store);
        tx.oncomplete = () => resolve(req?.result ?? undefined);
        tx.onerror    = () => reject(tx.error);
        if (req) {
          req.onsuccess = () => {};
          req.onerror   = () => reject(req.error);
        }
      });
    }

    return {
      /** Sauvegarde une valeur */
      async set(store, key, value) {
        return _tx(store, 'readwrite', s => s.put(value, key));
      },

      /** Lit une valeur (null si absente) */
      async get(store, key) {
        const database = await open();
        return new Promise((resolve, reject) => {
          const tx  = database.transaction(store, 'readonly');
          const req = tx.objectStore(store).get(key);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror   = () => reject(req.error);
        });
      },

      /** Supprime une clé */
      async delete(store, key) {
        return _tx(store, 'readwrite', s => s.delete(key));
      },

      /** Liste toutes les clés d'un store */
      async keys(store) {
        const database = await open();
        return new Promise((resolve, reject) => {
          const tx  = database.transaction(store, 'readonly');
          const req = tx.objectStore(store).getAllKeys();
          req.onsuccess = () => resolve(req.result ?? []);
          req.onerror   = () => reject(req.error);
        });
      },

      /**
       * Lit depuis une DB externe (migration v1 → v2, ou modules tiers)
       * @param {string} dbName - nom de l'ancienne DB
       * @param {string} storeName - nom du store
       * @param {string} key
       */
      async getExternal(dbName, storeName, key) {
        return new Promise(resolve => {
          try {
            const req = indexedDB.open(dbName);
            req.onsuccess = (e) => {
              const extDb = e.target.result;
              if (!extDb.objectStoreNames.contains(storeName)) {
                resolve(null); return;
              }
              const tx   = extDb.transaction(storeName, 'readonly');
              const getR = tx.objectStore(storeName).get(key);
              getR.onsuccess = () => resolve(getR.result ?? null);
              getR.onerror   = () => resolve(null);
              extDb.close();
            };
            req.onerror = () => resolve(null);
          } catch { resolve(null); }
        });
      },

      // ── Raccourcis store-spécifiques ──────────────────────────────────

      /** Sauvegarde les données d'un module (store vilarDS) */
      setModule: (moduleKey, data) => db.set('vilarDS', moduleKey, data),

      /** Lit les données d'un module */
      getModule: (moduleKey) => db.get('vilarDS', moduleKey),

      /** Publie une clé partagée inter-modules (store shared) */
      publish: (key, data) => db.set('shared', key, data),

      /** Lit une clé partagée publiée par un autre module */
      subscribe: (key) => db.get('shared', key),
    };
  })();


  /* ──────────────────────────────────────────────────────────────────────
     APP BUS — Pub/Sub inter-modules
     Remplace les clés *_module manuelles par un système centralisé.
     Les modules publient des snapshots normalisés que les autres lisent.
  ────────────────────────────────────────────────────────────────────── */
  const bus = {
    /**
     * Publie un snapshot normalisé d'un module.
     * @param {string} moduleName - ex: 'chantiers'
     * @param {object} snapshot   - données synthétiques à partager
     */
    async publish(moduleName, snapshot) {
      await db.publish(moduleName + '_snapshot', {
        ...snapshot,
        _module:    moduleName,
        _publishedAt: new Date().toISOString(),
      });
    },

    /**
     * Lit le dernier snapshot publié par un module.
     * @param {string} moduleName
     * @returns {object|null}
     */
    async read(moduleName) {
      return db.subscribe(moduleName + '_snapshot');
    },

    /**
     * Lit les snapshots de plusieurs modules d'un coup.
     * @param {string[]} moduleNames
     * @returns {object} { moduleName: snapshot|null, ... }
     */
    async readAll(moduleNames) {
      const results = await Promise.all(
        moduleNames.map(name => bus.read(name).then(data => [name, data]))
      );
      return Object.fromEntries(results);
    },
  };


  /* ──────────────────────────────────────────────────────────────────────
     PERSISTANCE — Dirty state + Auto-save + Indicateur sidebar
  ────────────────────────────────────────────────────────────────────── */
  const persistence = (() => {
    let _dirty     = false;
    let _lastSaved = null;
    let _autoTimer = null;
    let _watchdog  = null;
    let _saveFn    = null;
    let _onDirty   = null;
    const AUTO_SAVE_MS = 8000;
    const WATCHDOG_MS  = 8000;

    return {
      /**
       * Initialise la persistance pour un module.
       * @param {Function} saveFn      - async () => void, appelée pour sauvegarder
       * @param {Function} [onDirty]   - (isDirty, lastSaved) => void, pour l'indicateur
       */
      init(saveFn, onDirty = null) {
        _saveFn   = saveFn;
        _onDirty  = onDirty;

        // Ctrl/Cmd + S
        document.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.save(false);
          }
        });

        // Alerte avant fermeture si données non sauvegardées
        window.addEventListener('beforeunload', (e) => {
          if (_dirty) {
            e.preventDefault();
            e.returnValue = 'Modifications non sauvegardées. Quitter quand même ?';
          }
        });

        // Watchdog auto-save toutes les 8s
        if (_watchdog) clearInterval(_watchdog);
        _watchdog = setInterval(() => {
          if (_dirty) this.save(true);
        }, WATCHDOG_MS);
      },

      /** Marque l'état comme modifié (déclenche debounce 8s) */
      mark() {
        _dirty = true;
        if (_onDirty) _onDirty(true, _lastSaved);
        if (_autoTimer) clearTimeout(_autoTimer);
        _autoTimer = setTimeout(() => this.save(true), AUTO_SAVE_MS);
      },

      /** Sauvegarde immédiate */
      async save(silent = false) {
        if (!_saveFn) return;
        try {
          await _saveFn();
          _dirty     = false;
          _lastSaved = new Date().toISOString();
          if (_onDirty) _onDirty(false, _lastSaved);
          if (!silent) toast.show('Sauvegardé ✓', 'sv', 1800);
        } catch (err) {
          console.error('[VilarCore] Erreur sauvegarde:', err);
          toast.show('Erreur de sauvegarde !', 'err');
        }
      },

      get isDirty()   { return _dirty;     },
      get lastSaved() { return _lastSaved; },
    };
  })();


  /* ──────────────────────────────────────────────────────────────────────
     SAVE INDICATOR — Indicateur sidebar (dot + texte)
  ────────────────────────────────────────────────────────────────────── */
  const saveIndicator = {
    /** Met à jour l'indicateur sidebar */
    update(isDirty, lastSavedISO) {
      const dot = utils.$('saveDot');
      const txt = utils.$('saveText');
      if (!dot || !txt) return;

      if (isDirty) {
        dot.className     = 'sdot dirty';
        txt.textContent   = 'Modifié — auto-save 8s';
      } else {
        dot.className     = 'sdot';
        dot.style.background = 'var(--vll)';
        const t = lastSavedISO
          ? new Date(lastSavedISO).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : '';
        txt.textContent = `Sauvegardé ${t}`;
      }
    },

    setLoading() {
      const dot = utils.$('saveDot');
      const txt = utils.$('saveText');
      if (!dot || !txt) return;
      dot.style.background = 'var(--bc)';
      txt.textContent = 'Chargement…';
    },
  };


  /* ──────────────────────────────────────────────────────────────────────
     TOASTS
  ────────────────────────────────────────────────────────────────────── */
  const toast = (() => {
    let _container = null;

    // Injection CSS keyframes (une seule fois)
    const _styleId = 'vc-toast-css';
    if (!document.getElementById(_styleId)) {
      const s = document.createElement('style');
      s.id = _styleId;
      s.textContent = `
        @keyframes vcTIn  { from{opacity:0;transform:translateX(18px)} to{opacity:1;transform:translateX(0)} }
        @keyframes vcTOut { from{opacity:1} to{opacity:0;transform:translateX(18px)} }
      `;
      document.head.appendChild(s);
    }

    function getContainer() {
      if (!_container) {
        _container = document.getElementById('toasts') || (() => {
          const d = document.createElement('div');
          d.id = 'toasts';
          d.style.cssText = [
            'position:fixed', 'top:64px', 'right:13px', 'z-index:9999',
            'display:flex', 'flex-direction:column', 'gap:7px', 'pointer-events:none',
          ].join(';');
          document.body.appendChild(d);
          return d;
        })();
      }
      return _container;
    }

    const STYLES = {
      ok:   { border: 'rgba(74,222,128,.35)',  bg: 'rgba(15,28,40,.97)',     color: '#E8EEF4', ico: '✅' },
      err:  { border: 'rgba(248,113,113,.35)', bg: 'rgba(15,28,40,.97)',     color: '#E8EEF4', ico: '❌' },
      sv:   { border: 'rgba(200,168,75,.25)',  bg: 'rgba(200,168,75,.07)',   color: '#C8A84B', ico: '💾' },
      info: { border: 'rgba(74,123,168,.35)',  bg: 'rgba(15,28,40,.97)',     color: '#4A7BA8', ico: 'ℹ️' },
      warn: { border: 'rgba(234,179,8,.35)',   bg: 'rgba(15,28,40,.97)',     color: '#EAB308', ico: '⚠️' },
    };

    return {
      /**
       * Affiche un toast.
       * @param {string} msg
       * @param {'ok'|'err'|'sv'|'info'|'warn'} type
       * @param {number} duration - ms
       */
      show(msg, type = 'sv', duration = 3000) {
        const st = STYLES[type] || STYLES.info;
        const el = document.createElement('div');
        el.style.cssText = [
          `background:${st.bg}`,
          `border:1px solid ${st.border}`,
          `color:${st.color}`,
          'padding:10px 14px',
          'border-radius:9px',
          'font-size:12px',
          "font-family:'DM Sans',system-ui,sans-serif",
          'box-shadow:0 6px 20px rgba(0,0,0,.4)',
          'animation:vcTIn .22s ease',
          'max-width:280px',
          'pointer-events:auto',
          'display:flex',
          'align-items:center',
          'gap:7px',
        ].join(';');
        el.innerHTML = `<span>${st.ico}</span><span>${utils.esc(msg)}</span>`;
        getContainer().appendChild(el);
        setTimeout(() => {
          el.style.animation = 'vcTOut .22s ease forwards';
          setTimeout(() => el.remove(), 230);
        }, duration);
      },
    };
  })();


  /* ──────────────────────────────────────────────────────────────────────
     MODAL GÉNÉRIQUE
  ────────────────────────────────────────────────────────────────────── */
  const modal = {
    _saveFn: null,

    /**
     * Ouvre le modal.
     * @param {object} cfg
     * @param {string}   cfg.title
     * @param {string}   cfg.body      - HTML interne
     * @param {string}   [cfg.saveLabel]
     * @param {Function} cfg.onSave
     * @param {Function} [cfg.onCancel]
     */
    open({ title, body, saveLabel = '💾 Enregistrer', onSave, onCancel } = {}) {
      this._saveFn = onSave;
      const overlay = utils.$('modalOv');
      if (!overlay) { console.error('[VilarCore] #modalOv introuvable'); return; }

      const titleEl  = utils.$('mTitle');
      const bodyEl   = utils.$('modalBody');
      const saveBtn  = utils.$('mSaveBtn');
      const cancelBtn= utils.$('mCancelBtn');

      if (titleEl)  titleEl.textContent = title;
      if (bodyEl)   bodyEl.innerHTML    = body;
      if (saveBtn)  { saveBtn.textContent = saveLabel; saveBtn.onclick = () => this._saveFn?.(); }
      if (cancelBtn){ cancelBtn.onclick = () => { this.close(); onCancel?.(); }; }

      overlay.classList.add('open');
    },

    close() {
      utils.$('modalOv')?.classList.remove('open');
      this._saveFn = null;
    },

    /** Ferme si clic sur le fond */
    backdropClick(e) {
      if (e.target === e.currentTarget) modal.close();
    },
  };

  // Fermeture sur Escape (global)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.close(); });


  /* ──────────────────────────────────────────────────────────────────────
     NAVIGATION — gv() centralisé
  ────────────────────────────────────────────────────────────────────── */
  const nav = (() => {
    let _current  = null;
    let _previous = null;
    const _renderFns = {};

    return {
      /**
       * Enregistre la fonction de rendu d'une vue.
       * Appelé par le module : nav.register('dashboard', () => Render.dashboard())
       */
      register(viewId, fn) { _renderFns[viewId] = fn; },

      /**
       * Navigue vers une vue.
       * Met à jour DOM + appelle la fonction de rendu enregistrée.
       */
      go(viewId) {
        if (_current === viewId) return;

        // Désactiver toutes les vues et nav items
        utils.qa('.view, .vc-view').forEach(v => v.classList.remove('active'));
        utils.qa('.ni, .vc-nav-item').forEach(n => n.classList.remove('active'));

        // Activer la vue cible
        const el  = utils.$(`view-${viewId}`) || utils.$(`vc-view-${viewId}`);
        const nav = utils.$(`nav-${viewId}`)  || utils.$(`vc-nav-${viewId}`);
        if (el)  el.classList.add('active');
        if (nav) nav.classList.add('active');

        _previous = _current;
        _current  = viewId;

        // Fermer sidebar mobile
        ui.closeSidebar();

        // Appeler le renderer enregistré
        _renderFns[viewId]?.();
      },

      /** Retourne à la vue précédente */
      back() { if (_previous) this.go(_previous); },

      get current()  { return _current;  },
      get previous() { return _previous; },
    };
  })();


  /* ──────────────────────────────────────────────────────────────────────
     UI — Sidebar mobile, icônes
  ────────────────────────────────────────────────────────────────────── */
  const ui = {
    toggleSidebar() {
      const sb  = utils.$('sb') || utils.$('vc-sidebar');
      const ovr = utils.$('movr') || utils.$('vc-sidebar-overlay');
      sb?.classList.toggle('open');
      ovr?.classList.toggle('open');
    },

    closeSidebar() {
      const sb  = utils.$('sb') || utils.$('vc-sidebar');
      const ovr = utils.$('movr') || utils.$('vc-sidebar-overlay');
      sb?.classList.remove('open');
      ovr?.classList.remove('open');
    },
  };


  /* ──────────────────────────────────────────────────────────────────────
     EXPORT / IMPORT JSON
  ────────────────────────────────────────────────────────────────────── */
  const io = {
    /**
     * Exporte des données en fichier JSON téléchargeable.
     * @param {object} data       - payload à exporter
     * @param {string} moduleName - ex: 'Chantiers'
     */
    exportJSON(data, moduleName) {
      const payload = {
        _meta: {
          app: `VilarDS ${moduleName}`,
          version: '2.0',
          exportedAt: new Date().toISOString(),
          siren: '495 126 344',
        },
        ...data,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `VilarDS_${moduleName}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.show(`Export ${moduleName} ✓`, 'ok');
    },

    /**
     * Ouvre un sélecteur de fichier JSON et appelle onImport avec les données parsées.
     * @param {Function} onImport  - (parsedData) => void
     * @param {Function} [validate]- (data) => boolean — valide le fichier avant import
     */
    triggerImport(onImport, validate = null) {
      const input    = document.createElement('input');
      input.type     = 'file';
      input.accept   = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!confirm(
          `Importer "${file.name}" ?\n\nLes données actuelles seront remplacées.\nCette action est irréversible.`
        )) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const parsed = JSON.parse(ev.target.result);
            if (validate && !validate(parsed)) {
              toast.show('Fichier JSON invalide ou incompatible', 'err');
              return;
            }
            onImport(parsed);
          } catch {
            toast.show('Fichier JSON illisible', 'err');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    },
  };


  /* ──────────────────────────────────────────────────────────────────────
     PWA — Service Worker
  ────────────────────────────────────────────────────────────────────── */
  const pwa = {
    register() {
      if (!('serviceWorker' in navigator)) return;
      const sw = `
        const C='vilar-ds-v2';
        self.addEventListener('install',  e => e.waitUntil(caches.open(C).then(c => c.addAll(['./']))));
        self.addEventListener('fetch',    e => e.respondWith(
          caches.match(e.request).then(r => r || fetch(e.request).catch(() => new Response('',{status:200})))
        ));
        self.addEventListener('activate', e => e.waitUntil(
          caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== C).map(k => caches.delete(k))
          ))
        ));
      `;
      const blob = new Blob([sw], { type: 'application/javascript' });
      navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(() => {});
    },
  };


  /* ──────────────────────────────────────────────────────────────────────
     ICÔNES LUCIDE
  ────────────────────────────────────────────────────────────────────── */
  function safeIcons() {
    try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (_) {}
  }
  window.addEventListener('load', safeIcons);


  /* ──────────────────────────────────────────────────────────────────────
     MODULE REGISTRY — mountApp()
     Centralise l'initialisation complète d'un module.
     Chaque module appelle VilarCore.mountApp(config) depuis son IIFE.
  ────────────────────────────────────────────────────────────────────── */

  /**
   * @typedef {object} ModuleConfig
   * @property {string}   name          - Nom du module ('Dashboard', 'Chantiers', …)
   * @property {string}   dbKey         - Clé IndexedDB (ex: 'chantiers')
   * @property {string}   [dbKeyLegacy] - Ancienne clé v1 pour migration auto
   * @property {string}   [dbLegacyDB]  - Ancienne DB v1 pour migration auto
   * @property {object}   defaults      - Données par défaut (STATE initial)
   * @property {Function} onLoad        - (savedData) => void — applique les données chargées
   * @property {Function} onSave        - () => object — retourne l'objet à sauvegarder
   * @property {Function} [onBusPublish]- () => object — snapshot pour AppBus
   * @property {Function} [onImportValidate] - (data) => boolean
   * @property {Function} firstRender   - () => void — premier rendu après chargement
   * @property {object}   [sidebar]     - config sidebar (pour VilarUI)
   * @property {object}   [header]      - config header (pour VilarUI)
   * @property {string}   [logColor]    - couleur console.log
   */

  async function mountApp(cfg) {
    const {
      name, dbKey, dbKeyLegacy, dbLegacyDB,
      defaults, onLoad, onSave, onBusPublish,
      onImportValidate, firstRender,
      sidebar, header, logColor = '#C8A84B',
    } = cfg;

    // ── 1. Monter les composants UI ──────────────────────────────────────
    if (window.VilarUI && (sidebar || header)) {
      window.VilarUI.mountModule({ sidebar, header });
    }

    // ── 2. Charger les données ───────────────────────────────────────────
    let savedAt = null;
    try {
      let saved = await db.getModule(dbKey);

      // Migration v1 → v2 : si pas de données en v2 mais données en v1
      if (!saved && dbKeyLegacy && dbLegacyDB) {
        saved = await db.getExternal(dbLegacyDB, dbLegacyDB.replace('VilarDS_', '').toLowerCase() + 'data', dbKeyLegacy)
          || await db.getExternal(dbLegacyDB, 'data', dbKeyLegacy)
          || await db.getExternal(dbLegacyDB, 'rhdata', dbKeyLegacy);

        if (saved) {
          toast.show(`Migration ${name} v1 → v2 ✓`, 'info', 3000);
          // Immédiatement persister en v2
          await _doSave(cfg, saved, true);
        }
      }

      if (saved) {
        onLoad(saved);
        savedAt = saved.savedAt ?? null;
        saveIndicator.update(false, savedAt);
        toast.show(`${name} restauré ✓`, 'ok', 2000);
      } else {
        saveIndicator.update(false, null);
      }
    } catch (e) {
      console.error(`[VilarCore] Chargement ${name} échoué:`, e);
      saveIndicator.setLoading();
    }

    // ── 3. Configurer la persistance ─────────────────────────────────────
    persistence.init(
      () => _doSave(cfg),
      (isDirty, ls) => saveIndicator.update(isDirty, ls),
    );
    if (savedAt) persistence._lastSaved = savedAt;

    // ── 4. Premier rendu ─────────────────────────────────────────────────
    firstRender();

    // ── 5. PWA + icônes ──────────────────────────────────────────────────
    pwa.register();
    safeIcons();

    // ── 6. Animations d'entrée KPI ──────────────────────────────────────
    _animateKpis();

    // ── 7. Watchers globaux ──────────────────────────────────────────────
    // Export JSON : btn sidebar standard
    const exportBtn = utils.$('btn-export');
    if (exportBtn) {
      exportBtn.onclick = () => io.exportJSON(onSave(), name);
    }
    // Import JSON : btn sidebar standard
    const importBtn = utils.$('btn-import');
    if (importBtn) {
      importBtn.onclick = () => io.triggerImport(
        (data) => { onLoad(data); persistence.mark(); firstRender(); },
        onImportValidate,
      );
    }

    console.log(`%c🏗 VilarDS ${name} v2.0 — PWA Ready`, `color:${logColor};font-size:12px;font-weight:bold;`);
  }

  /** Exécute la sauvegarde complète d'un module */
  async function _doSave(cfg, override = null, silent = true) {
    const data = override ?? cfg.onSave();
    const payload = {
      ...data,
      savedAt: new Date().toISOString(),
      _version: '2.0',
    };
    await db.setModule(cfg.dbKey, payload);

    // Publier sur le bus si le module le supporte
    if (cfg.onBusPublish) {
      const snapshot = cfg.onBusPublish();
      if (snapshot) await bus.publish(cfg.dbKey, snapshot);
    }
  }

  /** Animation d'entrée sur les KPIs */
  function _animateKpis() {
    setTimeout(() => {
      utils.qa('.kpi, .tile').forEach((el, i) => {
        el.style.opacity   = '0';
        el.style.transform = 'translateY(9px)';
        setTimeout(() => {
          el.style.transition = 'opacity .28s ease, transform .28s ease';
          el.style.opacity    = '1';
          el.style.transform  = 'translateY(0)';
        }, i * 40 + 60);
      });
    }, 80);
  }


  /* ──────────────────────────────────────────────────────────────────────
     HELPERS RENDER — Réduisent les gros innerHTML dans les modules
  ────────────────────────────────────────────────────────────────────── */
  const render = {
    /**
     * Génère le HTML d'une grille de KPIs.
     * @param {Array<{label,value,sub?,color?}>} items
     */
    kpiGrid(items) {
      const cards = items.map(({ label, value, sub = '', color = 'co' }) => `
        <div class="kpi ${color}">
          <div class="kl">${utils.esc(label)}</div>
          <div class="kv">${value}</div>
          ${sub ? `<div class="ks">${utils.esc(sub)}</div>` : ''}
        </div>`).join('');
      return `<div class="kg">${cards}</div>`;
    },

    /**
     * Génère le HTML d'un tableau.
     * @param {string[]} headers
     * @param {Array<string[]>} rows  - chaque cellule est du HTML brut
     * @param {object} [opts]
     * @param {string} [opts.extraClass]
     * @param {boolean} [opts.hasTotalRow]
     */
    table(headers, rows, opts = {}) {
      const { extraClass = '', emptyMsg = 'Aucune donnée.' } = opts;
      if (!rows.length) return `<div class="empty">${emptyMsg}</div>`;
      const ths = headers.map(h => `<th>${h}</th>`).join('');
      const trs = rows.map(cells =>
        `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`
      ).join('');
      return `<table class="htab ${extraClass}"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    },

    /**
     * Génère un badge coloré.
     * @param {string} label
     * @param {string} colorClass - ex: 's-vl', 's-rl', 's-or', 's-jn', 's-bc', 's-pur'
     */
    badge(label, colorClass = 's-or') {
      return `<span class="sbadge ${colorClass}">${utils.esc(label)}</span>`;
    },

    /**
     * Génère une barre de progression.
     * @param {number} pct   - 0–100
     * @param {string} color - 'pf-or' | 'pf-vl' | 'pf-rl' | 'pf-jn'
     */
    progressBar(pct, color = 'pf-or') {
      const clamped = utils.clamp(Math.round(pct), 0, 100);
      return `<div class="prog-track"><div class="prog-fill ${color}" style="width:${clamped}%"></div></div>`;
    },

    /**
     * Génère un avatar circulaire avec initiales.
     * @param {string} initials
     * @param {string} color    - couleur hex (#RRGGBB)
     * @param {string} [size]   - ex: '34px'
     */
    avatar(initials, color = '#C8A84B', size = '34px') {
      return `<div style="
        width:${size};height:${size};border-radius:50%;
        background:${color}20;border:2px solid ${color};color:${color};
        display:inline-flex;align-items:center;justify-content:center;
        font-family:'Syne',sans-serif;font-size:11px;font-weight:800;
        flex-shrink:0;vertical-align:middle;"
      >${utils.esc(initials)}</div>`;
    },

    /**
     * Génère une section card (équivalent <div class="sec">).
     * @param {string} title
     * @param {string} body  - HTML interne
     * @param {object} [opts]
     * @param {string} [opts.extra]   - attributs HTML supplémentaires sur la div
     * @param {string} [opts.actions] - HTML boutons dans le header
     */
    card(title, body, opts = {}) {
      const { extra = '', actions = '' } = opts;
      return `
        <div class="sec" ${extra}>
          <div class="sec-header">
            <h3>${utils.esc(title)}</h3>
            ${actions ? `<div class="sec-actions">${actions}</div>` : ''}
          </div>
          ${body}
        </div>`;
    },

    /** Génère une ligne vide (état vide d'une liste) */
    empty(msg = 'Aucun élément.') {
      return `<div class="empty">${utils.esc(msg)}</div>`;
    },
  };


  /* ──────────────────────────────────────────────────────────────────────
     API PUBLIQUE
  ────────────────────────────────────────────────────────────────────── */
  return Object.freeze({
    VERSION,
    TODAY,
    MOIS,
    MA,
    JOURS_SEMAINE,

    // Sous-modules
    utils,
    db,
    bus,
    persistence,
    saveIndicator,
    toast,
    modal,
    nav,
    ui,
    io,
    pwa,
    render,

    // Initialisation module
    mountApp,

    // Exposé pour compat legacy (modules non encore refactorés)
    safeIcons,
  });

})();
