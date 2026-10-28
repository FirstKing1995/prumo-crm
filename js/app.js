/* ==========================================================================
   PRUMO CRM — aplicação: conexão, login, assistente, menu e sincronização
   ========================================================================== */
(function () {
  'use strict';
  var S = C.S, esc = C.esc, ic = C.ic;
  var $app = document.getElementById('app');

  var NAV = [
    { sec: 'Atendimento' },
    { id: 'painel', rot: 'Painel', ic: 'painel' },
    { id: 'conversas', rot: 'Conversas', ic: 'conversas', cont: function () { return S.contatos.filter(function (c) { return C.num(c.nao_lidas) > 0; }).length; } },
    { id: 'contatos', rot: 'Contatos', ic: 'contatos' },
    { id: 'negocios', rot: 'Negócios', ic: 'negocios' },
    { id: 'tarefas', rot: 'Tarefas', ic: 'tarefas', cont: function () { var h = C.isoLocal(); return S.tarefas.filter(function (t) { return t.feita !== 'SIM' && t.vence_em && t.vence_em <= h && (!t.responsavel_id || t.responsavel_id === S.user.id); }).length; } },
    { sec: 'Marketing', perm: 'automacoes' },
    { id: 'automacoes', rot: 'Automações', ic: 'automacoes', perm: 'automacoes' },
    { id: 'disparos', rot: 'Disparos', ic: 'disparos', perm: 'disparos' },
    { id: 'email', rot: 'E-mail marketing', ic: 'email', perm: 'disparos' },
    { id: 'grupos', rot: 'Grupos e links', ic: 'grupos', perm: 'disparos' },
    { sec: 'Gestão', perm: 'relatorios' },
    { id: 'relatorios', rot: 'Relatórios', ic: 'relatorios', perm: 'relatorios' },
    { id: 'equipe', rot: 'Equipe e acessos', ic: 'usuarioMais', perm: 'equipe' },
    { id: 'integracoes', rot: 'Integrações', ic: 'integracoes', perm: 'integracoes' },
    { id: 'ajustes', rot: 'Ajustes', ic: 'ajustes', perm: 'ajustes' }
  ];

  /* ------------------------------------------------------ primeiro acesso */
  function telaConectar() {
    $app.innerHTML = '<div class="login"><div class="login-arte">' + arteLogin({ nome: 'Prumo CRM' }) + '</div>' +
      '<div class="login-form"><div class="caixa">' +
      '<h1>Vamos ligar o seu sistema</h1><p class="muted" style="margin:0 0 20px">Cole o endereço do seu servidor (a URL do Apps Script que termina em <b>/exec</b>). Você só faz isso uma vez neste aparelho.</p>' +
      '<div class="campo"><label for="c-url">Endereço do servidor</label><input class="inp" id="c-url" placeholder="https://script.google.com/macros/s/.../exec"></div>' +
      '<button class="btn pri bloco" id="c-ok" data-carregando=" Conectando...">Conectar</button>' +
      '<p class="small muted" style="margin:16px 0 0">Ainda não instalou? Siga o guia <b>docs/INSTALACAO.md</b> que veio com o sistema. Leva uns 10 minutos.</p>' +
      '<div style="margin-top:22px;padding-top:18px;border-top:1px solid var(--borda)"><button class="btn bloco" id="c-demo">' + ic('olho') + ' Ver demonstração com dados de exemplo</button></div>' +
      '</div></div></div>';
    C.$('#c-ok').onclick = function () {
      var url = C.$('#c-url').value.trim();
      C.comBotao(this, function () {
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) throw new Error('A URL precisa ser do Apps Script e terminar em /exec.');
        C.store.set('prumo_api', url);
        return C.api('publico.marca').then(function (m) { C.aplicarMarca(m); renderLogin(); })
          .catch(function (e) { C.store.del('prumo_api'); throw e; });
      });
    };
    C.$('#c-demo').onclick = function () { C.store.set('prumo_api', 'demo'); location.reload(); };
  }

  function arteLogin(m) {
    return '<div class="marca" style="padding:0">' + C.logoHtml(m) + '<div><b>' + esc(m.nome || 'Prumo CRM') + '</b><small>' + esc(m.slogan || '') + '</small></div></div>' +
      '<div><h2>Todo cliente acompanhado, do primeiro oi até a venda.</h2><ul>' +
      ['Conversas do WhatsApp em um só lugar', 'Robôs que respondem e qualificam sozinhos', 'Disparos com intervalo seguro', 'Funil de vendas e relatórios da equipe']
        .map(function (t) { return '<li>' + ic('check') + t + '</li>'; }).join('') + '</ul></div><div class="small" style="color:#64748B">Seus dados ficam na sua própria conta Google.</div>';
  }

  /* ------------------------------------------------------------- login */
  function renderLogin() {
    var m = C.store.get('prumo_marca', {});
    $app.innerHTML = '<div class="login"><div class="login-arte">' + arteLogin(m) + '</div><div class="login-form"><form id="f-login" autocomplete="on">' +
      '<div class="marca" style="color:var(--txt);padding:0 0 22px">' + C.logoHtml(m) + '<div><b>' + esc(m.nome || 'Prumo CRM') + '</b></div></div>' +
      '<h1>Entrar</h1><p class="muted" style="margin:0 0 20px">Use o e-mail e a senha que o administrador cadastrou.</p>' +
      '<div class="campo"><label for="l-email">E-mail</label><input class="inp" id="l-email" type="email" autocomplete="username" required></div>' +
      '<div class="campo"><label for="l-senha">Senha</label><input class="inp" id="l-senha" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn pri bloco" type="submit" data-carregando=" Entrando...">Entrar</button>' +
      (C.ehDemo() ? '<div class="demo-dica"><b>Demonstração.</b> Administrador: <code>demo@prumo.app</code><br>SDR: <code>rafael@prumo.app</code> · Closer: <code>camila@prumo.app</code><br>Senha de todos: <code>demo1234</code></div>' : '') +
      '<p class="small" style="margin-top:18px;text-align:center"><a href="#" id="l-trocar">Trocar servidor</a>' + (C.ehDemo() ? ' · <a href="#" id="l-reset">Reiniciar demonstração</a>' : '') + '</p>' +
      '</form></div></div>';
    if (C.ehDemo()) { C.$('#l-email').value = 'demo@prumo.app'; C.$('#l-senha').value = 'demo1234'; }
    C.$('#l-trocar').onclick = function (e) { e.preventDefault(); C.store.del('prumo_api'); C.store.del('prumo_marca'); location.reload(); };
    if (C.$('#l-reset')) C.$('#l-reset').onclick = function (e) { e.preventDefault(); window.PrumoDemo.resetar(); };
    C.$('#f-login').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var btn = this.querySelector('button[type=submit]');
      C.comBotao(btn, function () {
        return C.api('login', { email: C.$('#l-email').value, senha: C.$('#l-senha').value }).then(function (d) {
          S.token = d.token; S.user = d.usuario;
          C.store.set('prumo_sessao', { token: d.token });
          return iniciarSessao();
        });
      });
    });
    if (!C.ehDemo()) C.api('publico.marca').then(function (mm) { if (JSON.stringify(mm) !== JSON.stringify(m)) { C.aplicarMarca(mm); renderLogin(); } }).catch(function () { /* offline */ });
  }

  C.sairLocal = function () {
    S.token = null; S.user = null; S.carregado = false;
    C.store.del('prumo_sessao');
    pararSync();
    C.$$('.modal-bg,.gaveta,.gaveta-bg').forEach(function (x) { x.remove(); });
    document.body.style.overflow = '';
    renderLogin();
  };

  /* ------------------------------------------------------------ dados */
  C.aplicarDados = function (d) {
    S.user = d.usuario; S.perm = d.permissoes || {}; S.config = d.config || {};
    S.usuarios = d.usuarios || []; S.funis = d.funis || []; S.contatos = d.contatos || []; S.negocios = d.negocios || [];
    S.tarefas = d.tarefas || []; S.modelos = d.modelos || []; S.automacoes = d.automacoes || []; S.campanhas = d.campanhas || []; S.emails = d.emails || [];
    S.grupos = d.grupos || []; S.ultimaSync = d.agora; S.carregado = true;
    C.aplicarMarca(S.config.marca);
  };
  C.recarregar = function () {
    return C.api('bootstrap').then(function (d) { C.aplicarDados(d); renderNav(); C.render(); });
  };

  function iniciarSessao() {
    return C.api('bootstrap').then(function (d) {
      C.aplicarDados(d);
      if (!S.config.marca.configurado && S.perm.ajustes) return assistente();
      var salva = C.store.get('prumo_view', 'painel');
      S.view = permitido(salva) ? salva : 'painel';
      renderShell();
      iniciarSync();
      registrarSite();
    });
  }

  function registrarSite() {
    if (!C.pode('ajustes') || C.ehDemo() || location.protocol !== 'https:') return;
    var url = location.origin + location.pathname.replace(/[^/]*$/, '');
    if (S.config.site_url !== url) C.api('site.registrar', { url: url }).then(function () { S.config.site_url = url; }).catch(function () { });
  }

  function permitido(v) {
    var n = NAV.filter(function (x) { return x.id === v; })[0];
    return !!n && (!n.perm || C.pode(n.perm));
  }

  /* ------------------------------------------------------------ assistente */
  var CORES = ['#1F6FEB', '#0F766E', '#16A34A', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#0EA5E9', '#334155', '#9A3412'];
  var SEGMENTOS = [
    ['geral', 'Vendas em geral', 'Novo lead, conversa, proposta, negociação'],
    ['servicos', 'Serviços e orçamentos', 'Pedido, visita, orçamento, aprovação'],
    ['saude', 'Clínicas e saúde', 'Contato, agendado, confirmado, compareceu'],
    ['imoveis', 'Imobiliária', 'Lead, qualificado, visita, proposta, contrato'],
    ['infoprodutos', 'Infoprodutos e cursos', 'Inscrito, engajado, carrinho, comprou'],
    ['varejo', 'Loja e varejo', 'Interessado, orçamento, pedido, entregue']
  ];
  function assistente() {
    var m = S.config.marca || {};
    var d = { NOME: m.nome === 'Prumo CRM' ? '' : m.nome, SLOGAN: m.slogan || '', COR_PRIMARIA: m.cor || CORES[0], COR_DESTAQUE: m.destaque || '#F2A900', LOGO_URL: m.logo || '', SEGMENTO: S.config.segmento || 'geral' };
    var passo = 0;
    var pinta = function () {
      C.aplicarMarca({ nome: d.NOME || 'Seu sistema', cor: d.COR_PRIMARIA, destaque: d.COR_DESTAQUE, logo: d.LOGO_URL });
      var corpo = '';
      if (passo === 0) {
        corpo = '<h1 style="font-size:24px;margin-bottom:6px">Deixe o sistema com a cara da sua empresa</h1><p class="muted" style="margin:0 0 22px">Você pode mudar tudo isso depois em Ajustes.</p>' +
          '<div class="grid-2"><div>' +
          '<div class="campo"><label>Nome que aparece no sistema</label><input class="inp" id="w-nome" maxlength="40" placeholder="Ex.: Studio Aurora" value="' + esc(d.NOME) + '"></div>' +
          '<div class="campo"><label>Frase curta (opcional)</label><input class="inp" id="w-slogan" maxlength="60" placeholder="Ex.: Estética e bem-estar" value="' + esc(d.SLOGAN) + '"></div>' +
          '<div class="campo"><label>Logo (opcional)</label><div class="linha" style="align-items:center"><input type="file" id="w-logo" accept="image/*" class="inp">' + (d.LOGO_URL ? '<button class="btn peq" id="w-tira">Remover</button>' : '') + '</div><span class="ajuda">Quadrada fica melhor. Reduzimos o tamanho automaticamente.</span></div>' +
          '<div class="campo"><label>Cor principal</label><div class="cores-prontas">' + CORES.map(function (c) { return '<button type="button" data-cor="' + c + '" style="background:' + c + '" class="' + (c === d.COR_PRIMARIA ? 'on' : '') + '" aria-label="Cor ' + c + '"></button>'; }).join('') +
          '<input type="color" class="inp-cor" id="w-cor" value="' + d.COR_PRIMARIA + '" title="Outra cor"></div></div>' +
          '<div class="campo"><label>Cor de destaque</label><input type="color" class="inp-cor" id="w-acc" value="' + d.COR_DESTAQUE + '"></div>' +
          '</div><div><span class="rot">Prévia</span><div class="previa-marca" style="margin-top:6px"><div class="ps"><div class="marca" style="padding:0 0 6px;gap:6px">' + C.logoHtml({ nome: d.NOME || 'S', logo: d.LOGO_URL }).replace('marca-logo', 'marca-logo" style="width:24px;height:24px;font-size:10px;border-radius:6px') + '<b style="font-size:11px">' + esc(d.NOME || 'Seu sistema') + '</b></div><i class="on"></i><i></i><i></i><i></i></div>' +
          '<div class="pc"><div class="card card-pad" style="padding:10px"><b style="font-size:12px">Novos contatos</b><div style="font-size:20px;font-weight:800">128</div></div><div style="display:flex;gap:6px"><span class="btn pri peq">Botão principal</span><span class="btn acc peq">Destaque</span></div></div></div></div></div>';
      } else if (passo === 1) {
        corpo = '<h1 style="font-size:24px;margin-bottom:6px">Qual é o tipo do seu negócio?</h1><p class="muted" style="margin:0 0 22px">Montamos o funil de vendas inicial para você. Dá para editar as etapas depois.</p>' +
          '<div class="segmentos">' + SEGMENTOS.map(function (s) { return '<button type="button" class="segmento ' + (d.SEGMENTO === s[0] ? 'on' : '') + '" data-seg="' + s[0] + '"><b>' + s[1] + '</b><span>' + s[2] + '</span></button>'; }).join('') + '</div>';
      } else {
        corpo = '<h1 style="font-size:24px;margin-bottom:6px">Tudo pronto para começar</h1><p class="muted" style="margin:0 0 18px">Próximos passos recomendados:</p>' +
          '<ol class="passos-tut"><li><b>Conectar o WhatsApp</b>Em Integrações, escolha a forma de conexão. Há tutorial passo a passo para cada uma.</li>' +
          '<li><b>Cadastrar a equipe</b>Em Ajustes > Equipe, crie um acesso para cada atendente.</li>' +
          '<li><b>Importar seus contatos</b>Em Contatos > Importar, envie a planilha (CSV) que você já tem.</li>' +
          '<li><b>Ligar uma automação</b>Já deixamos três modelos prontos em Automações. É só revisar o texto e ativar.</li></ol>';
      }
      $app.innerHTML = '<div class="wizard"><div class="wizard-passos">' + [0, 1, 2].map(function (i) { return '<div class="' + (i <= passo ? 'on' : '') + '"></div>'; }).join('') + '</div>' +
        '<div class="card card-pad" style="padding:28px">' + corpo + '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:26px">' +
        (passo ? '<button class="btn" id="w-volta">' + ic('esq') + ' Voltar</button>' : '<span></span>') +
        '<button class="btn pri" id="w-vai" data-carregando=" Salvando...">' + (passo < 2 ? 'Continuar ' + ic('dir') : 'Entrar no sistema') + '</button></div></div></div>';
      var ler = function () {
        if (C.$('#w-nome')) { d.NOME = C.$('#w-nome').value.trim(); d.SLOGAN = C.$('#w-slogan').value.trim(); d.COR_DESTAQUE = C.$('#w-acc').value; }
      };
      C.$$('[data-cor]').forEach(function (b) { b.onclick = function () { ler(); d.COR_PRIMARIA = b.dataset.cor; pinta(); }; });
      if (C.$('#w-cor')) C.$('#w-cor').onchange = function () { ler(); d.COR_PRIMARIA = this.value; pinta(); };
      if (C.$('#w-acc')) C.$('#w-acc').onchange = function () { ler(); pinta(); };
      if (C.$('#w-nome')) C.$('#w-nome').oninput = C.debounce(function () { ler(); var p = C.$('.previa-marca b'); if (p) p.textContent = d.NOME || 'Seu sistema'; }, 200);
      if (C.$('#w-logo')) C.$('#w-logo').onchange = function () { ler(); C.reduzirImagem(this.files[0], 160).then(function (u) { d.LOGO_URL = u; pinta(); }).catch(function (e) { C.toast(e.message, 'erro'); }); };
      if (C.$('#w-tira')) C.$('#w-tira').onclick = function () { ler(); d.LOGO_URL = ''; pinta(); };
      C.$$('[data-seg]').forEach(function (b) { b.onclick = function () { d.SEGMENTO = b.dataset.seg; pinta(); }; });
      if (C.$('#w-volta')) C.$('#w-volta').onclick = function () { ler(); passo--; pinta(); };
      C.$('#w-vai').onclick = function () {
        ler();
        if (passo === 0 && !d.NOME) { C.toast('Dê um nome ao sistema', 'erro'); return; }
        if (passo < 2) { passo++; pinta(); return; }
        C.comBotao(this, function () {
          return C.api('setup.concluir', { dados: d }).then(function (r) {
            C.aplicarDados(r); S.view = 'painel'; renderShell(); iniciarSync();
          });
        });
      };
    };
    pinta();
  }

  /** Reduz uma imagem para caber numa célula da planilha. */
  C.reduzirImagem = function (file, lado) {
    return new Promise(function (ok, erro) {
      if (!file) return erro(new Error('Escolha uma imagem.'));
      if (!/^image\//.test(file.type)) return erro(new Error('O arquivo precisa ser uma imagem.'));
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var cv = document.createElement('canvas');
          var e = Math.min(1, lado / Math.max(img.width, img.height));
          cv.width = Math.round(img.width * e); cv.height = Math.round(img.height * e);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          var url = cv.toDataURL('image/png');
          if (url.length > 45000) url = cv.toDataURL('image/jpeg', .85);
          if (url.length > 45000) return erro(new Error('Imagem grande demais. Use uma menor.'));
          ok(url);
        };
        img.onerror = function () { erro(new Error('Não consegui ler esta imagem.')); };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };

  /* --------------------------------------------------------------- shell */
  function renderShell() {
    $app.innerHTML = '<div class="shell"><aside class="side" id="side"></aside><div class="main">' +
      '<header class="top"><button class="btn fantasma ic menu-mob" id="b-menu" aria-label="Menu">' + ic('menu') + '</button><h1 id="titulo"></h1><div class="acoes" id="top-acoes"></div></header>' +
      '<main class="conteudo" id="conteudo"></main></div><nav class="bnav" id="bnav"></nav></div>';
    C.$('#b-menu').onclick = function () { abrirMenuMob(); };
    renderNav();
    C.render();
    atualizarWa();
  }

  function abrirMenuMob() {
    var side = C.$('#side');
    side.classList.add('aberta');
    var bg = document.createElement('div');
    bg.className = 'gaveta-bg'; bg.style.zIndex = 79;
    bg.onclick = function () { side.classList.remove('aberta'); bg.remove(); };
    document.body.appendChild(bg);
  }

  function renderNav() {
    var side = C.$('#side');
    if (!side) return;
    var m = S.config.marca || {};
    var h = '<div class="marca">' + C.logoHtml(m) + '<div class="trunc"><b class="trunc">' + esc(m.nome) + '</b><small class="trunc">' + esc(m.slogan || '') + '</small></div></div>';
    NAV.forEach(function (n) {
      if (n.perm && !C.pode(n.perm)) return;
      if (n.sec) { h += '<div class="nav-sec">' + n.sec + '</div>'; return; }
      var cont = n.cont ? n.cont() : 0;
      h += '<button class="nav-a ' + (S.view === n.id ? 'on' : '') + '" data-ir="' + n.id + '">' + ic(n.ic) + '<span>' + n.rot + '</span>' + (cont ? '<span class="cont">' + cont + '</span>' : '') + '</button>';
    });
    h += '<div class="side-pe"><button class="eu" id="b-eu">' + C.av(S.user.nome, 'peq', S.user.cor) + '<div class="trunc"><b class="trunc" style="font-size:13.5px">' + esc(S.user.nome) + '</b><small>' + (C.PERFIS[S.user.perfil] || {}).nome || '' + '</small></div></button></div>';
    side.innerHTML = h;
    C.$$('[data-ir]', side).forEach(function (b) { b.onclick = function () { C.ir(b.dataset.ir); }; });
    C.$('#b-eu').onclick = menuUsuario;
    var unread = NAV[2].cont();
    var bn = [['painel', 'Painel', 'painel'], ['conversas', 'Conversas', 'conversas', unread], ['contatos', 'Contatos', 'contatos'], ['negocios', 'Negócios', 'negocios'], ['_mais', 'Mais', 'mais']];
    C.$('#bnav').innerHTML = bn.map(function (b) { return '<button data-bn="' + b[0] + '" class="' + (S.view === b[0] ? 'on' : '') + '">' + ic(b[2]) + b[1] + (b[3] ? '<span class="cont">' + b[3] + '</span>' : '') + '</button>'; }).join('');
    C.$$('[data-bn]').forEach(function (b) { b.onclick = function () { if (b.dataset.bn === '_mais') abrirMenuMob(); else C.ir(b.dataset.bn); }; });
  }
  C.renderNav = renderNav;

  function menuUsuario() {
    var el = C.modal({
      titulo: S.user.nome,
      corpo: '<p class="muted" style="margin-top:0">' + esc(S.user.email) + '</p>' +
        '<h3 style="font-size:14px;margin:16px 0 10px">Trocar senha</h3>' +
        '<div class="campo"><label>Senha atual</label><input class="inp" type="password" id="s-atual" autocomplete="current-password"></div>' +
        '<div class="campo"><label>Nova senha (mínimo 8 caracteres)</label><input class="inp" type="password" id="s-nova" autocomplete="new-password"></div>' +
        '<button class="btn" id="s-salvar" data-carregando=" Salvando...">Salvar nova senha</button>',
      pe: '<button class="btn perigo esq" id="s-sair">' + ic('sair') + ' Sair</button><button class="btn" data-fechar>Fechar</button>',
      semFoco: true
    });
    el.querySelector('#s-sair').onclick = function () { C.api('logout').catch(function () { }); el.fechar(); C.sairLocal(); };
    el.querySelector('#s-salvar').onclick = function () {
      C.comBotao(this, function () {
        return C.api('perfil.senha', { atual: el.querySelector('#s-atual').value, nova: el.querySelector('#s-nova').value }).then(function () { C.toast('Senha alterada', 'ok'); el.fechar(); });
      });
    };
  }

  C.ir = function (v) {
    if (!permitido(v)) v = 'painel';
    if (C.views[S.view] && C.views[S.view].sair) C.views[S.view].sair();
    S.view = v;
    C.store.set('prumo_view', v);
    var side = C.$('#side'); if (side) side.classList.remove('aberta');
    C.$$('.gaveta-bg').forEach(function (x) { x.remove(); });
    renderNav();
    C.render();
    window.scrollTo(0, 0);
  };

  C.render = function () {
    var v = C.views[S.view];
    var el = C.$('#conteudo');
    if (!el || !v) return;
    el.className = 'conteudo' + (v.cheio ? ' cheio' : '');
    C.$('#titulo').textContent = v.titulo;
    C.$('#top-acoes').innerHTML = (v.acoes ? v.acoes() : '') + waPill();
    if (v.ligarAcoes) v.ligarAcoes(C.$('#top-acoes'));
    ligarWaPill();
    v.render(el);
  };

  /* ------------------------------------------------------- status WhatsApp */
  function waPill() {
    var st = S.waStatus;
    if (!st) return '<span class="wa-pill" id="wa-pill"><span class="ponto"></span><span class="txt">WhatsApp</span></span>';
    var cls = st.provedor === 'link' ? '' : st.conectado ? 'ok' : 'erro';
    var txt = st.provedor === 'link' ? 'Modo link' : st.conectado ? 'Conectado' : 'Desconectado';
    return '<button class="wa-pill ' + cls + '" id="wa-pill" title="' + esc(st.texto || '') + '"><span class="ponto"></span><span class="txt">' + txt + '</span></button>';
  }
  function ligarWaPill() {
    var p = C.$('#wa-pill');
    if (p && p.tagName === 'BUTTON') p.onclick = function () { if (C.pode('integracoes')) C.ir('integracoes'); else C.toast(S.waStatus.texto || ''); };
  }
  function atualizarWa() {
    C.api('wa.status').then(function (s) {
      S.waStatus = s;
      var p = C.$('#wa-pill');
      if (p) { p.outerHTML = waPill(); ligarWaPill(); }
    }).catch(function () { /* silencioso */ });
  }
  C.atualizarWa = atualizarWa;

  /* -------------------------------------------------------- sincronização */
  var timer = null, cont = 0;
  function iniciarSync() {
    pararSync();
    timer = setInterval(sync, 7000);
  }
  function pararSync() { if (timer) clearInterval(timer); timer = null; }
  function sync() {
    if (!S.token || document.hidden || C.syncOcupado) return;
    cont++;
    if (cont % 30 === 0) { atualizarWa(); }
    if (cont % 26 === 0) { // a cada ~3 min recarrega tudo (pega exclusões e mudanças de outros)
      C.syncOcupado = true;
      C.api('bootstrap').then(function (d) {
        C.aplicarDados(d); renderNav();
        if (C.views[S.view] && C.views[S.view].aoSincronizar) C.views[S.view].aoSincronizar({ completo: true });
      }).catch(function () { }).then(function () { C.syncOcupado = false; });
      return;
    }
    var v = C.views[S.view];
    if (S.view !== 'conversas' && S.view !== 'painel' && S.view !== 'disparos' && cont % 3 !== 0) return;
    C.syncOcupado = true;
    var aberto = v && v.contatoAberto ? v.contatoAberto() : '';
    C.api('sync', { desde: S.ultimaSync, contato_id: aberto }).then(function (r) {
      S.ultimaSync = r.agora;
      var mudou = false;
      (r.contatos || []).forEach(function (c) {
        var i = S.contatos.findIndex(function (x) { return x.id === c.id; });
        if (i >= 0) { if (JSON.stringify(S.contatos[i]) !== JSON.stringify(c)) { S.contatos[i] = c; mudou = true; } }
        else { S.contatos.push(c); mudou = true; }
      });
      if (r.campanhas) r.campanhas.forEach(function (c) { var i = S.campanhas.findIndex(function (x) { return x.id === c.id; }); if (i >= 0) S.campanhas[i] = c; });
      var mudouEmail = false;
      if (r.emails) r.emails.forEach(function (e) { var i = (S.emails || []).findIndex(function (x) { return x.id === e.id; }); if (i >= 0 && JSON.stringify(S.emails[i]) !== JSON.stringify(e)) { S.emails[i] = e; mudouEmail = true; } });
      if (mudou) renderNav();
      if (v && v.aoSincronizar) v.aoSincronizar({ contatosMudaram: mudou, mensagens: r.mensagens || [], campanhas: r.campanhas, emails: S.view === 'email' && mudouEmail ? r.emails : null });
    }).catch(function () { }).then(function () { C.syncOcupado = false; });
  }
  C.syncAgora = sync;

  /* --------------------------------------------------------------- início */
  function iniciar() {
    if (!C.apiUrl()) return telaConectar();
    var ses = C.store.get('prumo_sessao', null);
    if (ses && ses.token) {
      S.token = ses.token;
      $app.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center"><span class="spin" style="width:28px;height:28px;color:var(--pri)"></span></div>';
      iniciarSessao().catch(function () { C.sairLocal(); });
    } else renderLogin();
  }
  document.addEventListener('DOMContentLoaded', iniciar);
})();
