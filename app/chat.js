/* ==========================================================================
   Chat do site. Cole no site da empresa, antes de </body>:
   <script src="ENDERECO_DO_SISTEMA/chat.js" data-api="URL_DO_APPS_SCRIPT" data-k="CHAVE_DE_CAPTACAO" async></script>
   O visitante deixa nome e contato, conversa por aqui e a equipe responde pela
   caixa de Conversas do sistema. Tudo fica guardado no histórico do contato.
   ========================================================================== */
(function () {
  'use strict';
  var tag = document.currentScript;
  if (!tag || window.__prumoChat) return;
  window.__prumoChat = true;
  var API = tag.getAttribute('data-api') || '', K = tag.getAttribute('data-k') || '';
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(API) || !K) return;

  var CH = 'prumo_chat';
  var est = {};
  try { est = JSON.parse(localStorage.getItem(CH) || '{}') || {}; } catch (e) { est = {}; }
  if (!est.v) est.v = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  var salvar = function () { try { localStorage.setItem(CH, JSON.stringify(est)); } catch (e) { /* sem armazenamento */ } };
  salvar();

  function api(corpo) {
    corpo.k = K; corpo.v = est.v; if (est.t) corpo.t = est.t;
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(corpo) })
      .then(function (r) { return r.json(); }).then(function (r) { if (!r.ok) throw new Error(r.error || 'Erro'); return r.data; });
  }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  api({ action: 'publico.chat.config' }).then(function (cfg) {
    if (!cfg || !cfg.ativo) return;
    montar(cfg);
  }).catch(function () { /* chat indisponível: não aparece */ });

  function montar(cfg) {
    var cor = /^#[0-9a-f]{6}$/i.test(cfg.cor || '') ? cfg.cor : '#1F6FEB';
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483000';
    document.body.appendChild(host);
    var raiz = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    raiz.innerHTML = '<style>' +
      '*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
      '.bolha{width:60px;height:60px;border-radius:50%;border:0;background:' + cor + ';color:#fff;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.25);display:grid;place-items:center;transition:transform .2s;position:relative}' +
      '.bolha:hover{transform:scale(1.06)}.bolha svg{width:28px;height:28px}' +
      '.ponto{position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;background:#EF4444;border:2px solid #fff;display:none}' +
      '.jan{position:absolute;right:0;bottom:74px;width:min(370px,calc(100vw - 36px));height:min(540px,calc(100vh - 110px));background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;animation:sobe .22s ease-out}' +
      '@keyframes sobe{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}' +
      '.jan.aberta{display:flex}.cab{background:' + cor + ';color:#fff;padding:16px 18px;display:flex;align-items:center;gap:10px}.cab img{width:34px;height:34px;border-radius:8px;background:#fff;object-fit:contain}' +
      '.cab b{display:block;font-size:15px}.cab small{opacity:.85;font-size:12px}.cab button{margin-left:auto;background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1}' +
      '.corpo{flex:1;overflow-y:auto;padding:14px;background:#F3F4F6;display:flex;flex-direction:column;gap:8px}' +
      '.m{max-width:82%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;color:#111827;background:#fff;align-self:flex-start;box-shadow:0 1px 1px rgba(0,0,0,.05)}' +
      '.m.eu{align-self:flex-end;background:' + cor + ';color:#fff}.m small{display:block;font-size:11px;opacity:.7;margin-bottom:2px}' +
      '.pe{display:flex;gap:8px;padding:10px;border-top:1px solid #E5E7EB;background:#fff}.pe textarea{flex:1;resize:none;border:1px solid #D1D5DB;border-radius:10px;padding:9px 10px;font-size:14px;max-height:100px;outline:none}' +
      '.pe button,.form button{background:' + cor + ';color:#fff;border:0;border-radius:10px;padding:0 16px;font-weight:700;cursor:pointer}' +
      '.form{padding:18px;display:flex;flex-direction:column;gap:10px;overflow-y:auto}.form p{margin:0 0 4px;color:#374151;font-size:14px}.form input{border:1px solid #D1D5DB;border-radius:10px;padding:11px 12px;font-size:14px;outline:none}' +
      '.form button{padding:12px}.erro{color:#DC2626;font-size:13px;min-height:16px}.cred{text-align:center;font-size:11px;color:#9CA3AF;padding:4px 0 8px;background:#fff}' +
      '</style>' +
      '<div class="jan" role="dialog" aria-label="Chat"><div class="cab">' + (cfg.logo ? '<img src="' + esc(cfg.logo) + '" alt="">' : '') + '<div><b>' + esc(cfg.titulo || cfg.nome) + '</b><small>' + esc(cfg.nome) + '</small></div><button type="button" class="x" aria-label="Fechar">&times;</button></div><div class="conteudo" style="flex:1;display:flex;flex-direction:column;min-height:0"></div></div>' +
      '<button type="button" class="bolha" aria-label="Abrir chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg><span class="ponto"></span></button>';
    var $ = function (s) { return raiz.querySelector(s); };
    var jan = $('.jan'), conteudo = $('.conteudo'), ponto = $('.ponto');
    var msgs = [], desde = '', timer = null, aberta = false;

    var abrir = function () { aberta = true; jan.classList.add('aberta'); ponto.style.display = 'none'; est.t ? telaChat() : telaForm(); agendar(); };
    var fechar = function () { aberta = false; jan.classList.remove('aberta'); agendar(); };
    $('.bolha').onclick = function () { aberta ? fechar() : abrir(); };
    $('.x').onclick = fechar;

    function telaForm() {
      var pedir = cfg.pedir || [];
      conteudo.innerHTML = '<form class="form"><p>' + esc(cfg.saudacao || 'Oi! Como podemos ajudar?') + '</p>' +
        (pedir.indexOf('nome') >= 0 ? '<input name="nome" placeholder="Seu nome" autocomplete="name">' : '') +
        (pedir.indexOf('whatsapp') >= 0 ? '<input name="telefone" placeholder="WhatsApp com DDD" inputmode="tel" autocomplete="tel">' : '') +
        (pedir.indexOf('email') >= 0 ? '<input name="email" type="email" placeholder="Seu e-mail" autocomplete="email">' : '') +
        '<div class="erro"></div><button type="submit">Começar conversa</button></form><div class="cred">Seus dados ficam só com ' + esc(cfg.nome) + '.</div>';
      var f = conteudo.querySelector('form');
      f.onsubmit = function (e) {
        e.preventDefault();
        var b = f.querySelector('button'); b.disabled = true; b.textContent = 'Abrindo...';
        api({ action: 'publico.chat.iniciar', nome: f.nome ? f.nome.value : '', telefone: f.telefone ? f.telefone.value : '', email: f.email ? f.email.value : '', pagina: location.href })
          .then(function (r) { est.t = r.t; est.nome = r.nome; salvar(); telaChat(); })
          .catch(function (er) { f.querySelector('.erro').textContent = er.message; b.disabled = false; b.textContent = 'Começar conversa'; });
      };
    }
    function telaChat() {
      conteudo.innerHTML = '<div class="corpo"></div><form class="pe"><textarea rows="1" placeholder="Escreva sua mensagem" aria-label="Mensagem"></textarea><button type="submit">Enviar</button></form>';
      var f = conteudo.querySelector('form'), ta = f.querySelector('textarea');
      ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit ? f.requestSubmit() : f.onsubmit(e); } };
      f.onsubmit = function (e) {
        e.preventDefault();
        var t = ta.value.trim();
        if (!t) return;
        ta.value = '';
        msgs.push({ de: 'eu', texto: t, tmp: true });
        pintar();
        api({ action: 'publico.chat.enviar', texto: t }).then(function () { buscar(); }).catch(function (er) { msgs.push({ de: 'aviso', texto: er.message }); pintar(); });
      };
      if (!msgs.length) msgs.push({ de: 'equipe', autor: '', texto: cfg.saudacao ? 'Oi' + (est.nome ? ', ' + est.nome : '') + '! Pode mandar sua dúvida que já respondemos.' : 'Pode mandar sua mensagem.', fixa: true });
      pintar();
      buscar();
    }
    function pintar() {
      var c = conteudo.querySelector('.corpo');
      if (!c) return;
      c.innerHTML = msgs.map(function (m) { return '<div class="m ' + (m.de === 'eu' ? 'eu' : '') + '">' + (m.de !== 'eu' && m.autor ? '<small>' + esc(m.autor) + '</small>' : '') + esc(m.texto) + '</div>'; }).join('');
      c.scrollTop = c.scrollHeight;
    }
    function buscar() {
      if (!est.t) return Promise.resolve();
      return api({ action: 'publico.chat.receber', desde: desde }).then(function (r) {
        if (!r) return;
        var novas = r.mensagens || [];
        if (!desde) msgs = msgs.filter(function (m) { return m.fixa; });
        else msgs = msgs.filter(function (m) { return !m.tmp; });
        novas.forEach(function (m) { msgs.push(m); });
        if (novas.length) desde = novas[novas.length - 1].em;
        if (novas.some(function (m) { return m.de !== 'eu'; }) && !aberta) ponto.style.display = 'block';
        pintar();
      }).catch(function (er) { if (/inválida|não encontrada/.test(er.message)) { est.t = ''; salvar(); } });
    }
    function agendar() {
      clearTimeout(timer);
      if (!est.t) return;
      timer = setTimeout(function () { buscar().then(agendar, agendar); }, aberta ? 4000 : 30000);
    }
    agendar();
  }
})();
