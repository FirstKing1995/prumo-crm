/* ==========================================================================
   PRUMO CRM — núcleo da interface (estado, API, utilitários, componentes)
   ========================================================================== */
(function () {
  'use strict';
  var C = window.C = {};
  var CFG = window.PRUMO || {};

  /* ------------------------------------------------------- armazenamento */
  C.store = {
    get: function (k, p) { try { var v = localStorage.getItem(k); return v === null ? p : JSON.parse(v); } catch (e) { return p; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* modo privado */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }
  };

  /* ---------------------------------------------------- servidor / demo */
  var qs = new URLSearchParams(location.search);
  if (qs.get('api') && /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(qs.get('api'))) {
    C.store.set('prumo_api', qs.get('api'));
    history.replaceState(null, '', location.pathname);
  }
  if (qs.get('demo') === '1') C.store.set('prumo_api', 'demo');
  C.apiUrl = function () { return CFG.API_URL || C.store.get('prumo_api', ''); };
  C.ehDemo = function () { return C.apiUrl() === 'demo'; };

  /* -------------------------------------------------------------- estado */
  C.S = {
    token: null, user: null, perm: {}, config: {}, usuarios: [], funis: [], contatos: [], negocios: [], tarefas: [],
    modelos: [], automacoes: [], campanhas: [], grupos: [], view: 'painel', ultimaSync: '', waStatus: null, carregado: false
  };
  var S = C.S;

  /* ---------------------------------------------------------- utilitários */
  C.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  C.norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  C.num = function (v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    var s = String(v).replace(/[R$\s]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = Number(s); return isNaN(n) ? 0 : n;
  };
  C.brl = function (v) { return C.num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
  C.brlCurto = function (v) {
    var n = C.num(v);
    if (n >= 1e6) return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
    if (n >= 1e4) return 'R$ ' + (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    return C.brl(n);
  };
  C.inteiro = function (n) { return Number(n || 0).toLocaleString('pt-BR'); };
  /** Lead esperando resposta há mais tempo que o combinado em Ajustes > Regras. */
  C.foraDoPrazo = function (c) {
    if (c.ultima_direcao !== 'in' || !C.num(c.nao_lidas)) return false;
    var d = C.data(c.ultima_msg_em);
    return !!d && (Date.now() - d.getTime()) / 60000 > (C.num(S.config.sla_minutos) || 15);
  };
  C.data = function (s) { if (!s) return null; var d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? null : d; };
  C.fmtData = function (s, hora) {
    var d = C.data(s); if (!d) return '—';
    var o = { day: '2-digit', month: '2-digit' };
    if (hora !== false) { o.hour = '2-digit'; o.minute = '2-digit'; }
    return d.toLocaleString('pt-BR', o);
  };
  C.rel = function (s) {
    var d = C.data(s); if (!d) return '';
    var min = Math.round((Date.now() - d.getTime()) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return min + ' min';
    var h = Math.round(min / 60);
    if (h < 24 && d.getDate() === new Date().getDate()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (h < 48) return 'ontem';
    if (h < 24 * 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };
  C.isoLocal = function (d) {
    d = d || new Date();
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  };
  C.hoje = function () { return C.isoLocal().slice(0, 10); };
  C.diasAtras = function (n) { return C.isoLocal(new Date(Date.now() - n * 86400000)).slice(0, 10); };
  C.primeiroNome = function (n) { return String(n || '').trim().split(/\s+/)[0] || ''; };
  C.iniciais = function (n) { var p = String(n || '?').replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/); return (((p[0] || '?')[0] || '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); };
  C.corDe = function (s) { var cores = ['#2563EB', '#0891B2', '#7C3AED', '#DB2777', '#EA580C', '#059669', '#4F46E5', '#B45309', '#0F766E', '#9333EA']; var h = 0; String(s || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return cores[h % cores.length]; };
  C.tel = function (t) {
    var d = String(t || '').replace(/\D/g, '');
    if (d.length === 13 && d.indexOf('55') === 0) return '(' + d.slice(2, 4) + ') ' + d.slice(4, 9) + '-' + d.slice(9);
    if (d.length === 12 && d.indexOf('55') === 0) return '(' + d.slice(2, 4) + ') ' + d.slice(4, 8) + '-' + d.slice(8);
    return d ? '+' + d : '';
  };
  C.tags = function (s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); };
  C.json = function (s, p) { if (s && typeof s === 'object') return s; try { var v = JSON.parse(s); return v == null ? p : v; } catch (e) { return p; } };
  C.pct = function (a, b) { return b ? Math.round(a / b * 1000) / 10 : 0; };
  C.$ = function (sel, el) { return (el || document).querySelector(sel); };
  C.$$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  C.usuario = function (id) { return S.usuarios.filter(function (u) { return u.id === id; })[0] || null; };
  C.contato = function (id) { return S.contatos.filter(function (c) { return c.id === id; })[0] || null; };
  C.etapa = function (id) { var e = null; S.funis.forEach(function (f) { f.etapas.forEach(function (x) { if (x.id === id) e = x; }); }); return e; };
  C.funil = function (id) { return S.funis.filter(function (f) { return f.id === id; })[0] || null; };
  C.pode = function (area) { return !!S.perm[area]; };
  /** Perfis de acesso (o servidor confere as permissões de verdade). */
  C.PERFIS = {
    admin: { nome: 'Administrador', desc: 'Cria as contas da equipe, configura integrações, marca e regras. Vê tudo.' },
    gestor: { nome: 'Gestor', desc: 'Vê toda a operação, faz disparos, automações e relatórios. Não mexe em equipe nem integrações.' },
    sdr: { nome: 'SDR', desc: 'Atende os leads novos (os sem dono e os seus), qualifica e passa para um closer, com reunião se quiser.' },
    closer: { nome: 'Closer', desc: 'Recebe os leads qualificados e fecha a venda. Vê só os contatos e negócios dele.' },
    atendente: { nome: 'Atendente', desc: 'Atende conversas e os seus contatos. Funciona como o SDR.' }
  };
  C.av = function (nome, cls, cor) { return '<span class="av ' + (cls || '') + '" style="background:' + (cor || C.corDe(nome)) + '">' + C.esc(C.iniciais(nome)) + '</span>'; };
  C.todasTags = function () {
    var set = {};
    (S.config.tags || []).forEach(function (t) { set[t] = 1; });
    S.contatos.forEach(function (c) { C.tags(c.tags).forEach(function (t) { set[t] = 1; }); });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  };
  C.debounce = function (fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; };

  /* ------------------------------------------------------------- ícones (Lucide) */
  var P = {
    painel: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    conversas: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    contatos: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    negocios: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v7M12 7v4M16 7v9"/>',
    tarefas: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    automacoes: '<rect x="3" y="3" width="8" height="8" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
    disparos: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    grupos: '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>',
    relatorios: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    integracoes: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
    ajustes: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    equipe: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    mais: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    busca: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    filtro: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    tag: '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5"/>',
    fone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    lixo: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    lapis: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    check2: '<path d="M18 6 7 17l-5-5M22 10l-7.5 7.5L13 16"/>',
    dir: '<path d="m9 18 6-6-6-6"/>',
    esq: '<path d="m15 18-6-6 6-6"/>',
    baixo: '<path d="m6 9 6 6 6-6"/>',
    cima: '<path d="m18 15-6-6-6 6"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
    relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    raio: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    copiar: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    atualizar: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    imagem: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    clipe: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    enviar: '<path d="m22 2-7 20-4-9-9-4Z"/>',
    robo: '<path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>',
    alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    olho: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    externo: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
    calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    whats: '<path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/>',
    usuarioMais: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    pergunta: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
    lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    bifurca: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><path d="M6 9v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9M12 12v3"/>',
    seta: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    bandeira: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
    webhook: '<path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"/>',
    planilha: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M8 13h8M8 17h8M10 9H8"/>',
    paleta: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C21.96 6 17.46 2 12 2"/>',
    escudo: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    dinheiro: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    trofeu: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    usuarioX: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5M22 8l-5 5"/>',
    arrastar: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
    duplicar: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    nota: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/>',
    mapa: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    arquivo: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
    passar: '<path d="M16 3h5v5M21 3l-7 7"/><path d="M8 21H3v-5M3 21l7-7"/>',
    alvo: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    estrela: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
    carrinho: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    api: '<path d="m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16"/>',
    predio: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>'
  };
  C.ic = function (n, cls) { return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || P.info) + '</svg>'; };

  /* ------------------------------------------------------------------ API */
  C.api = function (acao, dados) {
    var body = Object.assign({ action: acao, token: S.token }, dados || {});
    var url = C.apiUrl();
    var p;
    if (url === 'demo') p = window.PrumoDemo.call(body);
    else p = fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' })
      .catch(function () { throw new Error('Sem conexão com o servidor. Confira sua internet.'); })
      .then(function (r) { return r.json().catch(function () { throw new Error('O servidor respondeu algo inesperado. Confira se a URL do Apps Script está certa e publicada para "Qualquer pessoa".'); }); });
    return p.then(function (r) {
      if (!r.ok) {
        if (r.auth) { C.sairLocal(); throw new Error('Sua sessão expirou. Entre novamente.'); }
        throw new Error(r.error || 'Erro desconhecido');
      }
      return r.data;
    });
  };

  /* --------------------------------------------------------- componentes */
  C.toast = function (msg, tipo) {
    var raiz = C.$('#toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + (tipo || '');
    el.textContent = msg;
    raiz.appendChild(el);
    setTimeout(function () { el.remove(); }, tipo === 'erro' ? 5000 : 2800);
  };

  C.comBotao = function (btn, fn) {
    if (btn && btn.disabled) return Promise.resolve();
    var html = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span>' + (btn.dataset.carregando || ''); }
    return Promise.resolve().then(fn).catch(function (e) { C.toast(e.message, 'erro'); })
      .then(function (r) { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = html; } return r; });
  };

  var pilhaModais = [];
  /** Abre um modal. o = { titulo, corpo, pe, tamanho: ''|'largo'|'xl', aoAbrir(el), aoFechar } */
  C.modal = function (o) {
    var bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal ' + (o.tamanho || '') + '" role="dialog" aria-modal="true" aria-label="' + C.esc(o.titulo) + '">' +
      '<div class="modal-cab"><h2>' + C.esc(o.titulo) + '</h2><button class="btn fantasma ic peq x" data-fechar aria-label="Fechar">' + C.ic('x') + '</button></div>' +
      '<div class="modal-corpo">' + (o.corpo || '') + '</div>' + (o.pe ? '<div class="modal-pe">' + o.pe + '</div>' : '') + '</div>';
    document.body.appendChild(bg);
    document.body.style.overflow = 'hidden';
    var el = bg.firstElementChild;
    var fechar = function () {
      bg.remove();
      pilhaModais = pilhaModais.filter(function (x) { return x !== fechar; });
      if (!pilhaModais.length && !C.$('.gaveta')) document.body.style.overflow = '';
      if (o.aoFechar) o.aoFechar();
    };
    el.fechar = fechar;
    pilhaModais.push(fechar);
    bg.addEventListener('mousedown', function (ev) { if (ev.target === bg) bg.dataset.fora = '1'; });
    bg.addEventListener('click', function (ev) {
      if ((ev.target === bg && bg.dataset.fora) || ev.target.closest('[data-fechar]')) fechar();
      bg.dataset.fora = '';
    });
    if (o.aoAbrir) o.aoAbrir(el);
    var f = el.querySelector('input:not([type=hidden]):not([readonly]),textarea,select');
    if (f && !o.semFoco && window.innerWidth > 900) setTimeout(function () { f.focus(); }, 30);
    return el;
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pilhaModais.length) pilhaModais[pilhaModais.length - 1](); });

  C.confirmar = function (texto, opc) {
    opc = opc || {};
    return new Promise(function (ok) {
      var resp = false;
      C.modal({
        titulo: opc.titulo || 'Confirmar', corpo: '<p style="margin:0">' + texto + '</p>',
        pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn ' + (opc.perigo ? 'perigo cheio' : 'pri') + '" data-sim>' + C.esc(opc.botao || 'Confirmar') + '</button>',
        semFoco: true,
        aoAbrir: function (el) { el.querySelector('[data-sim]').onclick = function () { resp = true; el.fechar(); }; },
        aoFechar: function () { ok(resp); }
      });
    });
  };

  C.pedirTexto = function (titulo, rotulo, valor, opc) {
    opc = opc || {};
    return new Promise(function (ok) {
      var resp = null;
      C.modal({
        titulo: titulo,
        corpo: '<div class="campo"><label>' + C.esc(rotulo) + '</label>' + (opc.lista ? '<input class="inp" list="pt-lista" id="pt-v" value="' + C.esc(valor || '') + '"><datalist id="pt-lista">' + opc.lista.map(function (x) { return '<option value="' + C.esc(x) + '">'; }).join('') + '</datalist>' :
          opc.opcoes ? '<select class="inp" id="pt-v">' + opc.opcoes.map(function (x) { return '<option value="' + C.esc(x[0]) + '">' + C.esc(x[1]) + '</option>'; }).join('') + '</select>' :
            '<input class="inp" id="pt-v" value="' + C.esc(valor || '') + '">') + '</div>',
        pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" data-sim>' + C.esc(opc.botao || 'OK') + '</button>',
        aoAbrir: function (el) {
          var go = function () { resp = el.querySelector('#pt-v').value.trim(); el.fechar(); };
          el.querySelector('[data-sim]').onclick = go;
          el.querySelector('#pt-v').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
        },
        aoFechar: function () { ok(resp); }
      });
    });
  };

  C.copiar = function (txt) {
    var fim = function () { C.toast('Copiado', 'ok'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(fim, function () { fallback(); });
    else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); fim(); } catch (e) { C.toast('Não foi possível copiar', 'erro'); }
      ta.remove();
    }
  };
  C.copiavel = function (txt) {
    return '<div class="copiavel"><code>' + C.esc(txt) + '</code><button class="btn peq" type="button" data-copiar="' + C.esc(txt) + '">' + C.ic('copiar') + ' Copiar</button></div>';
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copiar]');
    if (b) { e.preventDefault(); C.copiar(b.getAttribute('data-copiar')); }
  });

  /** Campo de tags com sugestões. Devolve { el, valor() } */
  C.campoTags = function (raiz, iniciais, sugestoes) {
    var lista = (iniciais || []).slice();
    var id = 'tg' + Math.random().toString(36).slice(2, 7);
    raiz.innerHTML = '<div class="tag-inp"><span class="chips"></span><input list="' + id + '" placeholder="Digite e tecle Enter"><datalist id="' + id + '">' +
      (sugestoes || []).map(function (t) { return '<option value="' + C.esc(t) + '">'; }).join('') + '</datalist></div>';
    var chips = raiz.querySelector('.chips'), inp = raiz.querySelector('input');
    var pinta = function () {
      chips.innerHTML = lista.map(function (t, i) { return '<span class="chip">' + C.esc(t) + '<button type="button" class="x" data-i="' + i + '" aria-label="Remover">' + C.ic('x') + '</button></span>'; }).join('');
      C.$$('.x svg', chips).forEach(function (s) { s.style.width = '12px'; s.style.height = '12px'; });
    };
    var add = function () { var v = inp.value.replace(/,/g, '').trim(); if (v && lista.indexOf(v) < 0) lista.push(v); inp.value = ''; pinta(); };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } else if (e.key === 'Backspace' && !inp.value && lista.length) { lista.pop(); pinta(); } });
    inp.addEventListener('change', add);
    chips.addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) { lista.splice(Number(b.dataset.i), 1); pinta(); } });
    pinta();
    return { valor: function () { if (inp.value.trim()) add(); return lista.slice(); } };
  };

  C.baixarCsv = function (nome, cab, linhas) {
    var cel = function (v) { var s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var txt = '﻿' + [cab].concat(linhas).map(function (l) { return l.map(cel).join(';'); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
    a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
  };

  /** Lê CSV com separador ; ou , e aspas. */
  C.lerCsv = function (txt) {
    txt = txt.replace(/^﻿/, '');
    var prim = txt.split(/\r?\n/)[0] || '';
    var sep = (prim.match(/;/g) || []).length >= (prim.match(/,/g) || []).length ? ';' : ',';
    if ((prim.match(/\t/g) || []).length > (prim.match(new RegExp(sep, 'g')) || []).length) sep = '\t';
    var linhas = [], linha = [], cel = '', asp = false;
    for (var i = 0; i < txt.length; i++) {
      var ch = txt[i];
      if (asp) { if (ch === '"') { if (txt[i + 1] === '"') { cel += '"'; i++; } else asp = false; } else cel += ch; }
      else if (ch === '"') asp = true;
      else if (ch === sep) { linha.push(cel); cel = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; linha.push(cel); linhas.push(linha); linha = []; cel = ''; }
      else cel += ch;
    }
    if (cel || linha.length) { linha.push(cel); linhas.push(linha); }
    return linhas.filter(function (l) { return l.some(function (c) { return String(c).trim(); }); });
  };

  /* ------------------------------------------------------------ tema/marca */
  function hexRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function rgbHex(r) { return '#' + r.map(function (x) { return ('0' + Math.max(0, Math.min(255, Math.round(x))).toString(16)).slice(-2); }).join(''); }
  function mistura(h, alvo, p) { var a = hexRgb(h), b = hexRgb(alvo); return rgbHex(a.map(function (v, i) { return v + (b[i] - v) * p; })); }
  function luz(h) { var c = hexRgb(h).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
  C.aplicarMarca = function (m) {
    m = m || {};
    var pri = /^#[0-9a-f]{6}$/i.test(m.cor) ? m.cor : '#1F6FEB';
    var acc = /^#[0-9a-f]{6}$/i.test(m.destaque) ? m.destaque : '#F2A900';
    var r = document.documentElement.style;
    r.setProperty('--pri', pri);
    r.setProperty('--pri-txt', luz(pri) > .45 ? '#0F172A' : '#FFFFFF');
    r.setProperty('--pri-soft', mistura(pri, '#FFFFFF', .88));
    r.setProperty('--pri-escuro', mistura(pri, '#000000', .18));
    r.setProperty('--acc', acc);
    r.setProperty('--acc-soft', mistura(acc, '#FFFFFF', .85));
    r.setProperty('--side', mistura(pri, '#0B1120', .86));
    if (m.nome) document.title = m.nome;
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = pri;
    var fav = document.querySelector('link[rel=icon]');
    if (fav) {
      if (m.logo) fav.href = m.logo;
      else fav.href = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="' + pri + '"/><text x="32" y="42" font-family="Arial" font-weight="700" font-size="28" text-anchor="middle" fill="' + (luz(pri) > .45 ? '#0F172A' : '#FFFFFF') + '">' + C.iniciais(m.nome || 'P').slice(0, 2) + '</text></svg>');
    }
    C.store.set('prumo_marca', m);
  };
  C.logoHtml = function (m) {
    m = m || (S.config && S.config.marca) || {};
    return '<span class="marca-logo">' + (m.logo ? '<img src="' + C.esc(m.logo) + '" alt="">' : C.esc(C.iniciais(m.nome || 'P').slice(0, 2))) + '</span>';
  };
  C.aplicarMarca(C.store.get('prumo_marca', {}));

  C.views = {};
})();
