/* ==========================================================================
   PRUMO CRM — Conversas (caixa de entrada do WhatsApp)
   ========================================================================== */
(function () {
  'use strict';
  var S = C.S, esc = C.esc, ic = C.ic;
  var aberto = null;      // id do contato aberto
  var msgs = [];
  var filtro = 'todas', busca = '', infoAberta = false;

  C.abrirConversa = function (id) {
    aberto = id;
    if (S.view !== 'conversas') C.ir('conversas'); else C.render();
  };

  C.views.conversas = {
    titulo: 'Conversas',
    cheio: true,
    contatoAberto: function () { return aberto; },
    sair: function () { },
    render: function (el) {
      el.innerHTML = '<div class="inbox ' + (aberto ? 'com-chat' : '') + '" id="inbox">' +
        '<section class="ib-lista"><div class="cab"><div class="busca" style="max-width:none">' + ic('busca') + '<input class="inp" id="ib-busca" placeholder="Buscar conversa" value="' + esc(busca) + '"></div>' +
        '<div class="seg" style="width:100%">' + [['todas', 'Todas'], ['naolidas', 'Não lidas'], ['minhas', 'Minhas'], ['sem', 'Sem dono']].map(function (f) { return '<button style="flex:1" data-fi="' + f[0] + '" class="' + (filtro === f[0] ? 'on' : '') + '">' + f[1] + '</button>'; }).join('') + '</div>' +
        (C.ehDemo() ? '<button class="btn peq" id="ib-sim">' + ic('raio') + ' Simular mensagem chegando</button>' : '') +
        '</div><div class="ib-itens" id="ib-itens"></div></section>' +
        '<section class="chat" id="chat"></section><aside class="ib-info" id="ib-info"></aside></div>';
      C.$('#ib-busca').oninput = C.debounce(function () { busca = this.value; pintarLista(); }.bind(C.$('#ib-busca')), 150);
      C.$$('[data-fi]', el).forEach(function (b) { b.onclick = function () { filtro = b.dataset.fi; C.$$('[data-fi]', el).forEach(function (x) { x.classList.toggle('on', x === b); }); pintarLista(); }; });
      if (C.$('#ib-sim')) C.$('#ib-sim').onclick = simular;
      pintarLista();
      if (aberto) abrir(aberto); else pintarChatVazio();
    },
    aoSincronizar: function (r) {
      if (r.contatosMudaram || r.completo) pintarLista();
      if (aberto && r.mensagens && r.mensagens.length) {
        var novas = r.mensagens.filter(function (m) { return !msgs.some(function (x) { return x.id === m.id; }); });
        if (novas.length) {
          msgs = msgs.concat(novas);
          pintarMsgs(true);
          var c = C.contato(aberto);
          if (c && C.num(c.nao_lidas)) { c.nao_lidas = '0'; C.api('conversa.lida', { id: aberto }).catch(function () { }); pintarLista(); C.renderNav(); }
        }
      }
      if (r.completo && aberto) pintarInfo();
    }
  };

  function lista() {
    var b = C.norm(busca);
    return S.contatos.filter(function (c) {
      if (!c.ultima_msg_em && c.id !== aberto) return false;
      if (b && C.norm([c.nome, c.telefone, c.ultima_msg].join(' ')).indexOf(b) < 0) return false;
      if (filtro === 'naolidas' && !C.num(c.nao_lidas)) return false;
      if (filtro === 'minhas' && c.responsavel_id !== S.user.id) return false;
      if (filtro === 'sem' && c.responsavel_id) return false;
      return true;
    }).sort(function (a, b2) { return (a.ultima_msg_em || '') < (b2.ultima_msg_em || '') ? 1 : -1; });
  }

  function pintarLista() {
    var box = C.$('#ib-itens');
    if (!box) return;
    var l = lista();
    if (!l.length) {
      box.innerHTML = '<div class="vazio">' + ic('conversas') + '<h3>Nenhuma conversa</h3><p class="small">' + (S.waStatus && S.waStatus.provedor !== 'link' ? 'Quando alguém mandar mensagem para o seu WhatsApp, ela aparece aqui.' : 'Conecte uma API de WhatsApp em Integrações para receber as mensagens aqui.') + '</p></div>';
      return;
    }
    box.innerHTML = l.slice(0, 300).map(function (c) {
      var nl = C.num(c.nao_lidas);
      var u = C.usuario(c.responsavel_id);
      return '<button class="ib-item ' + (c.id === aberto ? 'on' : '') + (C.foraDoPrazo(c) ? ' atrasada' : '') + '" data-c="' + c.id + '">' + C.av(c.nome) + '<div class="meio"><div class="l1"><b>' + (c.canal === 'instagram' ? '<span class="canal-ig" title="Instagram">' + ic('instagram') + '</span>' : '') + esc(c.nome) + '</b><span class="hora">' + C.rel(c.ultima_msg_em) + '</span></div>' +
        '<div class="l2"><span>' + (c.ultima_direcao === 'out' ? ic('check2').replace('class="i ', 'class="i " style="width:14px;height:14px;color:#53BDEB" data-x="') : '') + esc(c.ultima_msg) + '</span>' + (nl ? '<span class="naolidas">' + nl + '</span>' : '') + '</div>' +
        (u || C.tags(c.tags).length ? '<div class="l2" style="margin-top:4px">' + (u ? '<span class="chip" style="flex:none">' + esc(C.primeiroNome(u.nome)) + '</span>' : '') + C.tags(c.tags).slice(0, 2).map(function (t) { return '<span class="chip" style="flex:none">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
        '</div></button>';
    }).join('');
    C.$$('[data-c]', box).forEach(function (b) { b.onclick = function () { abrir(b.dataset.c); }; });
  }

  function pintarChatVazio() {
    var ch = C.$('#chat');
    if (ch) ch.innerHTML = '<div class="vazio" style="margin:auto">' + ic('conversas') + '<h3>Escolha uma conversa</h3><p>As mensagens do WhatsApp aparecem aqui em tempo real.</p></div>';
    var inf = C.$('#ib-info'); if (inf) inf.innerHTML = '';
    var ib = C.$('#inbox'); if (ib) ib.classList.add('sem-info');
  }

  var antigasAntes = '', antigasFim = false;
  function abrir(id) {
    aberto = id;
    msgs = [];
    antigasAntes = ''; antigasFim = false;
    var ib = C.$('#inbox');
    ib.classList.add('com-chat');
    ib.classList.remove('sem-info');
    C.$$('.ib-item').forEach(function (x) { x.classList.toggle('on', x.dataset.c === id); });
    var c = C.contato(id);
    if (!c) { pintarChatVazio(); return; }
    pintarChat(c);
    pintarInfo();
    C.api('conversa.abrir', { id: id }).then(function (r) {
      if (aberto !== id) return;
      msgs = r.mensagens || [];
      var i = S.contatos.findIndex(function (x) { return x.id === id; });
      if (i >= 0) S.contatos[i] = Object.assign(S.contatos[i], r.contato, { nao_lidas: '0' });
      pintarMsgs();
      pintarLista();
      C.renderNav();
      pintarCabRobo();
    }).catch(function (e) { C.toast(e.message, 'erro'); });
  }

  function pintarChat(c) {
    var ch = C.$('#chat');
    ch.innerHTML = '<div class="chat-cab"><button class="btn fantasma ic peq" id="ch-volta" aria-label="Voltar">' + ic('esq') + '</button>' + C.av(c.nome) +
      '<div class="trunc" style="flex:1;cursor:pointer" id="ch-nome"><b class="trunc" style="display:block">' + esc(c.nome) + '</b><span class="small muted">' + (c.canal === 'instagram' ? ic('instagram') + ' @' + esc(c.ig_usuario || 'Instagram') : esc(C.tel(c.telefone))) + '</span></div>' +
      (C.pode('passar') ? '<button class="btn peq" id="ch-passar" title="Passar para um closer">' + ic('passar') + '<span class="txt"> Passar</span></button>' : '') +
      '<button class="btn peq" id="ch-robo"></button>' +
      '<button class="btn fantasma ic" id="ch-info" aria-label="Detalhes do contato">' + ic('info') + '</button></div>' +
      '<div id="ch-aviso"></div><div class="chat-msgs" id="ch-msgs"><div style="margin:auto"><span class="spin" style="color:var(--pri)"></span></div></div>' +
      '<div class="chat-pe"><div class="rapidas hidden" id="ch-rap"></div>' +
      '<button class="btn fantasma ic" id="ch-anexo" aria-label="Anexar mídia">' + ic('clipe') + '</button>' +
      '<button class="btn fantasma ic" id="ch-mod" aria-label="Respostas rápidas">' + ic('raio') + '</button>' +
      '<textarea class="inp" id="ch-txt" rows="1" placeholder="Digite a mensagem. Use / para respostas rápidas"></textarea>' +
      '<button class="btn verde ic" id="ch-env" aria-label="Enviar">' + ic('enviar') + '</button></div>';
    var w = window.innerWidth > 900;
    C.$('#ch-volta').style.display = w ? 'none' : '';
    C.$('#ch-volta').onclick = function () { aberto = null; C.$('#inbox').classList.remove('com-chat'); pintarChatVazio(); pintarLista(); };
    C.$('#ch-nome').onclick = function () { C.abrirContato(c.id); };
    C.$('#ch-info').onclick = function () { infoAberta = !infoAberta; C.$('#ib-info').classList.toggle('aberta', infoAberta); };
    var ta = C.$('#ch-txt');
    ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; rapidas(); });
    ta.addEventListener('keydown', function (e) {
      var rap = C.$('#ch-rap');
      if (!rap.classList.contains('hidden')) {
        var itens = C.$$('button', rap), atual = itens.findIndex(function (b) { return b.classList.contains('on'); });
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var n = (atual + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length; itens.forEach(function (b, i) { b.classList.toggle('on', i === n); }); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); (itens[atual] || itens[0]).click(); return; }
        if (e.key === 'Escape') { rap.classList.add('hidden'); return; }
      }
      if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 900) { e.preventDefault(); enviar(); }
    });
    C.$('#ch-env').onclick = function () { enviar(); };
    C.$('#ch-mod').onclick = function () { ta.value = '/'; rapidas(); ta.focus(); };
    C.$('#ch-anexo').onclick = anexar;
    if (C.$('#ch-passar')) C.$('#ch-passar').onclick = function () { C.passarLead(c, function () { C.recarregar(); }); };
    pintarCabRobo();
    if (w) setTimeout(function () { ta.focus(); }, 50);
  }

  function pintarCabRobo() {
    var c = C.contato(aberto);
    var b = C.$('#ch-robo');
    if (!c || !b) return;
    var pausado = c.bot_pausado_ate && c.bot_pausado_ate > C.isoLocal();
    b.innerHTML = ic('robo') + '<span class="txt"> ' + (pausado ? 'Robô pausado' : 'Robô ativo') + '</span>';
    b.title = pausado ? 'O robô não responde este contato até ' + C.fmtData(c.bot_pausado_ate) + '. Clique para reativar.' : 'Clique para pausar o robô e atender só manualmente.';
    b.style.color = pausado ? 'var(--amarelo)' : 'var(--verde)';
    b.onclick = function () {
      C.api('contato.robo', { id: c.id, pausar: !pausado }).then(function (r) { c.bot_pausado_ate = r.bot_pausado_ate; pintarCabRobo(); C.toast(r.bot_pausado_ate ? 'Robô pausado para este contato' : 'Robô reativado', 'ok'); }).catch(function (e) { C.toast(e.message, 'erro'); });
    };
    var av = C.$('#ch-aviso');
    if (av) av.innerHTML = (c.optout === 'SIM' ? '<div class="robo-pausado">' + ic('alerta') + ' Este contato pediu para não receber mensagens automáticas. Você ainda pode responder manualmente.</div>' : '') + avisoJanela(c);
    var bm = C.$('#ch-modelo'); if (bm) bm.onclick = function () { enviarModelo(c); };
  }

  /** Janela de 24h: na API oficial da Meta e no Instagram só dá para responder livremente dentro dela. */
  function avisoJanela(c) {
    var meta = S.waStatus && S.waStatus.provedor === 'meta';
    var ig = c.canal === 'instagram';
    if (!meta && !ig) return '';
    var agora = C.isoLocal();
    var ult = C.data(c.ultima_msg_em);
    var ate = c.janela_ate || (c.ultima_direcao === 'in' && ult ? C.isoLocal(new Date(ult.getTime() + 86400000)) : '');
    if (!ig && c.gratis_ate && c.gratis_ate > agora) return '<div class="janela gratis">' + ic('estrela') + ' Veio de anúncio: mensagens grátis até ' + C.fmtData(c.gratis_ate) + '</div>';
    if (ate && ate > agora) return '<div class="janela aberta">' + ic('relogio') + ' Janela de 24h aberta até ' + C.fmtData(ate) + (ig ? '' : '. Respostas aqui são mensagens de atendimento, as mais baratas.') + '</div>';
    if (ig) return '<div class="janela fechada">' + ic('alerta') + ' O Instagram só deixa responder até 24 horas depois da última mensagem da pessoa. Espere ela escrever de novo.</div>';
    return '<div class="janela fechada">' + ic('alerta') + ' Janela de 24h fechada. Para falar com esta pessoa, envie um modelo aprovado pela Meta. <button class="btn peq" id="ch-modelo">' + ic('nota') + ' Enviar modelo</button></div>';
  }
  function enviarModelo(c) {
    var el = C.modal({
      titulo: 'Enviar modelo da Meta',
      corpo: '<p class="small muted" style="margin-top:0">Use o nome exato do modelo aprovado no Gerenciador do WhatsApp. Quando a pessoa responder, a janela de 24h abre e você conversa normalmente.</p>' +
        '<div class="grade2"><div class="campo"><label>Nome do modelo</label><input class="inp" id="mm-nome" placeholder="retomar_contato"></div><div class="campo"><label>Idioma</label><input class="inp" id="mm-idioma" value="pt_BR"></div></div>' +
        '<div class="campo"><label>Variáveis do modelo, na ordem (separe por vírgula)</label><input class="inp" id="mm-vars" value="{primeiro_nome}"></div>' +
        '<div class="campo"><label>Categoria</label><select class="inp" id="mm-cat"><option value="utility">Utilidade (mais barato: confirmação, lembrete, retorno de pedido)</option><option value="marketing">Marketing (oferta, novidade)</option></select></div>',
      pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn verde" id="mm-ok" data-carregando=" Enviando...">' + ic('enviar') + ' Enviar</button>'
    });
    el.querySelector('#mm-ok').onclick = function () {
      var nome = el.querySelector('#mm-nome').value.trim();
      C.comBotao(this, function () {
        if (!nome) throw new Error('Informe o nome do modelo.');
        return C.api('mensagem.enviar', { id: c.id, texto: '', meta_modelo: { nome: nome, idioma: el.querySelector('#mm-idioma').value.trim() || 'pt_BR', variaveis: el.querySelector('#mm-vars').value, categoria: el.querySelector('#mm-cat').value } })
          .then(function () { el.fechar(); C.toast('Modelo enviado', 'ok'); abrir(c.id); });
      });
    };
  }

  function pintarMsgs(rolar) {
    var box = C.$('#ch-msgs');
    if (!box) return;
    var noFim = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    var dia = '';
    var h = '';
    if (S.config.arquivo && !antigasFim) h += '<div style="text-align:center;margin:4px 0 10px"><button class="btn peq" id="ch-antigas" data-carregando=" Buscando...">' + ic('arquivo') + ' Ver meses anteriores</button></div>';
    if (!msgs.length) h += '<div class="dia-sep">Nenhuma mensagem ainda. Envie a primeira.</div>';
    msgs.forEach(function (m) {
      var d = (m.criado_em || '').slice(0, 10);
      if (d !== dia) { dia = d; h += '<div class="dia-sep">' + (d === C.hoje() ? 'Hoje' : d === C.diasAtras(1) ? 'Ontem' : C.fmtData(m.criado_em, false)) + '</div>'; }
      var robo = m.origem === 'robo' || m.origem === 'campanha';
      var cls = 'msg ' + (m.direcao === 'out' ? 'out' : '') + (robo && m.direcao === 'out' ? ' robo' : '') + (m.status === 'erro' ? ' erro' : '');
      var u = m.usuario_id ? C.usuario(m.usuario_id) : null;
      var autor = m.direcao === 'out' ? (robo ? (m.origem === 'campanha' ? 'Disparo' : 'Robô') : u ? C.primeiroNome(u.nome) : m.origem === 'celular' ? 'Celular' : '') : '';
      var midia = '';
      if (m.midia_url && m.tipo === 'imagem') midia = '<img src="' + esc(m.midia_url) + '" alt="" loading="lazy">';
      else if (m.midia_url) midia = '<a href="' + esc(m.midia_url) + '" target="_blank" rel="noopener">' + ic('clipe') + ' ' + esc(m.tipo) + '</a><br>';
      else if (m.tipo && m.tipo !== 'texto' && !m.texto) midia = '<i class="muted">[' + esc(m.tipo) + ']</i>';
      var st = m.direcao === 'out' ? (m.status === 'erro' ? '<span title="' + esc(m.erro) + '" style="color:var(--vermelho)">' + ic('alerta') + '</span>' : m.status === 'link' || m.status === 'pendente_link' ? '<span title="Enviado pelo modo link">' + ic('link') + '</span>' : ic('check2')) : '';
      h += '<div class="' + cls + '">' + midia + linkify(esc(m.texto)) + '<div class="meta">' + (autor ? '<span>' + esc(autor) + '</span>' : '') + '<span>' + (m.criado_em || '').slice(11, 16) + '</span>' + st + '</div>' +
        (m.status === 'erro' ? '<div class="small" style="color:var(--vermelho)">Não enviada: ' + esc(m.erro) + '</div>' : '') + '</div>';
    });
    box.innerHTML = h;
    if (!rolar || noFim) box.scrollTop = box.scrollHeight;
    var ba = C.$('#ch-antigas');
    if (ba) ba.onclick = function () {
      var id = aberto;
      C.comBotao(ba, function () {
        return C.api('arquivo.contato', { contato_id: id, antes_de: antigasAntes }).then(function (r) {
          if (aberto !== id) return;
          antigasAntes = r.mes; antigasFim = !r.mais;
          if (r.mensagens.length) { msgs = r.mensagens.concat(msgs); pintarMsgs(true); C.$('#ch-msgs').scrollTop = 0; }
          else { C.toast(r.mais ? 'Nada nesses meses. Clique de novo para ir mais para trás.' : 'Não há mensagens mais antigas.'); pintarMsgs(true); }
        });
      });
    };
  }
  /** Links clicáveis e a formatação do WhatsApp (*negrito* e _itálico_). Recebe texto já escapado. */
  function linkify(s) {
    return s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/(^|[\s>])\*([^*\n]+)\*(?=$|[\s<.,!?])/g, '$1<b>$2</b>')
      .replace(/(^|[\s>])_([^_\n]+)_(?=$|[\s<.,!?])/g, '$1<i>$2</i>');
  }

  function rapidas() {
    var ta = C.$('#ch-txt'), rap = C.$('#ch-rap');
    var v = ta.value;
    if (v.indexOf('/') !== 0 || /\s/.test(v.slice(1).trim()) && v.length > 25) { rap.classList.add('hidden'); return; }
    var q = C.norm(v.slice(1));
    var l = S.modelos.filter(function (m) { return !q || C.norm(m.atalho + ' ' + m.titulo).indexOf(q) >= 0; }).slice(0, 12);
    if (!l.length) { rap.innerHTML = '<div class="small muted" style="padding:10px 12px">Nenhuma resposta rápida. Crie em Ajustes > Respostas rápidas.</div>'; rap.classList.remove('hidden'); return; }
    rap.innerHTML = l.map(function (m, i) { return '<button data-m="' + m.id + '" class="' + (i === 0 ? 'on' : '') + '"><b>/' + esc(m.atalho || '') + '</b> ' + esc(m.titulo) + '<div class="small muted trunc">' + esc(m.texto) + '</div></button>'; }).join('');
    rap.classList.remove('hidden');
    C.$$('[data-m]', rap).forEach(function (b) {
      b.onclick = function () {
        var m = S.modelos.filter(function (x) { return x.id === b.dataset.m; })[0];
        ta.value = m.texto;
        ta.dataset.midia = m.midia_url || '';
        ta.dataset.midiaTipo = m.midia_tipo || '';
        rap.classList.add('hidden');
        ta.dispatchEvent(new Event('input'));
        ta.focus();
      };
    });
  }

  function enviar(midiaUrl, midiaTipo) {
    var ta = C.$('#ch-txt');
    var texto = ta.value.trim();
    midiaUrl = midiaUrl || ta.dataset.midia || '';
    midiaTipo = midiaTipo || ta.dataset.midiaTipo || '';
    if (!texto && !midiaUrl) return;
    var c = C.contato(aberto);
    var temp = { id: 'tmp' + Date.now(), contato_id: aberto, direcao: 'out', tipo: midiaUrl ? (midiaTipo === 'image' ? 'imagem' : midiaTipo) : 'texto', texto: texto, midia_url: midiaUrl, status: 'enviando', usuario_id: S.user.id, origem: 'manual', criado_em: C.isoLocal() };
    msgs.push(temp);
    pintarMsgs();
    ta.value = ''; ta.dataset.midia = ''; ta.dataset.midiaTipo = ''; ta.style.height = 'auto';
    C.api('mensagem.enviar', { id: aberto, texto: texto, midia_url: midiaUrl, midia_tipo: midiaTipo }).then(function (r) {
      if (r && r.link) window.open(r.link, '_blank', 'noopener');
      return C.api('conversa.abrir', { id: aberto });
    }).then(function (r) {
      if (!r) return;
      msgs = r.mensagens || [];
      if (c) Object.assign(c, r.contato, { nao_lidas: '0' });
      pintarMsgs(); pintarLista(); pintarCabRobo();
    }).catch(function (e) {
      temp.status = 'erro'; temp.erro = e.message; pintarMsgs();
      C.toast(e.message, 'erro');
    });
  }

  function anexar() {
    var el = C.modal({
      titulo: 'Enviar mídia',
      corpo: '<div class="aviso info">' + ic('info') + '<div>Cole o link público do arquivo (Google Drive com acesso público, site, Dropbox...). O WhatsApp baixa o arquivo direto desse link.</div></div>' +
        '<div class="campo"><label>Tipo</label><select class="inp" id="a-tipo"><option value="image">Imagem</option><option value="document">Documento (PDF etc.)</option><option value="video">Vídeo</option><option value="audio">Áudio</option></select></div>' +
        '<div class="campo"><label>Link do arquivo</label><input class="inp" id="a-url" placeholder="https://..."></div>' +
        '<div class="campo"><label>Legenda (opcional)</label><textarea class="inp" id="a-leg">' + esc(C.$('#ch-txt').value) + '</textarea></div>',
      pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn verde" id="a-ok">' + ic('enviar') + ' Enviar</button>'
    });
    el.querySelector('#a-ok').onclick = function () {
      var url = el.querySelector('#a-url').value.trim();
      if (!/^https:\/\//.test(url)) { C.toast('O link precisa começar com https://', 'erro'); return; }
      C.$('#ch-txt').value = el.querySelector('#a-leg').value;
      var tipo = el.querySelector('#a-tipo').value;
      el.fechar();
      enviar(driveDireto(url), tipo);
    };
  }
  /** Converte link de compartilhamento do Google Drive em link de download direto. */
  function driveDireto(u) {
    var m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/) || u.match(/drive\.google\.com\/open\?id=([\w-]+)/);
    return m ? 'https://drive.google.com/uc?export=download&id=' + m[1] : u;
  }
  C.driveDireto = driveDireto;

  function pintarInfo() {
    var box = C.$('#ib-info');
    var c = C.contato(aberto);
    if (!box || !c) return;
    var negs = S.negocios.filter(function (n) { return n.contato_id === c.id && n.status === 'aberto'; });
    var cp = C.json(c.campos, {});
    box.innerHTML = '<div style="text-align:center">' + C.av(c.nome, 'gde') + '<h3 style="margin-top:8px;font-size:16px">' + esc(c.nome) + '</h3><div class="small muted">' + esc(C.tel(c.telefone)) + (c.ig_usuario ? ' @' + esc(c.ig_usuario) : '') + '</div>' +
      '<button class="btn peq" style="margin-top:10px" id="in-ficha">' + ic('externo') + ' Abrir ficha completa</button></div>' +
      (C.pode('passar') ? '<button class="btn peq acc bloco" style="margin-top:12px" id="in-passar">' + ic('passar') + ' Passar para closer</button>' : '') +
      negs.filter(function (n) { return n.reuniao_em && n.reuniao_status === 'agendada'; }).map(function (n) { return '<div class="reu-badge" style="margin-top:10px;cursor:pointer" data-reu="' + n.id + '">' + ic('calendario') + ' Reunião ' + C.fmtData(n.reuniao_em) + '</div>'; }).join('') +
      '<h4>Responsável</h4><select class="inp" id="in-resp"' + (C.pode('todos') ? '' : ' disabled') + '><option value="">Ninguém</option>' + S.usuarios.filter(function (u) { return u.ativo === 'SIM'; }).map(function (u) { return '<option value="' + u.id + '"' + (c.responsavel_id === u.id ? ' selected' : '') + '>' + esc(u.nome) + '</option>'; }).join('') + '</select>' +
      '<h4>Tags</h4><div id="in-tags"></div><button class="btn peq" style="margin-top:6px" id="in-salvatags">Salvar tags</button>' +
      '<h4>Funil</h4>' + (negs.length ? negs.map(function (n) {
        var f = C.funil(n.funil_id);
        return '<div class="campo"><label>' + esc(n.titulo) + '</label><select class="inp" data-neg="' + n.id + '">' + (f ? f.etapas.map(function (e) { return '<option value="' + e.id + '"' + (e.id === n.etapa_id ? ' selected' : '') + '>' + esc(e.nome) + '</option>'; }).join('') : '') + '</select></div>';
      }).join('') : '<button class="btn peq" id="in-neg">' + ic('plus') + ' Criar negócio</button>') +
      ((S.config.campos || []).length ? '<h4>Informações</h4>' + S.config.campos.map(function (f) { return '<div class="dado"><span class="fraco">' + esc(f.rotulo) + ':</span> ' + esc(cp[f.chave] || '—') + '</div>'; }).join('') : '') +
      (c.email ? '<h4>Contato</h4><div class="dado">' + ic('email') + '<span class="trunc">' + esc(c.email) + '</span></div>' : '') +
      '<div style="height:20px"></div>';
    var tg = C.campoTags(box.querySelector('#in-tags'), C.tags(c.tags), C.todasTags());
    box.querySelector('#in-ficha').onclick = function () { C.abrirContato(c.id); };
    var ip = box.querySelector('#in-passar'); if (ip) ip.onclick = function () { C.passarLead(c, function () { C.recarregar(); }); };
    C.$$('[data-reu]', box).forEach(function (b) { b.onclick = function () { C.acoesReuniao(S.negocios.filter(function (n) { return n.id === b.dataset.reu; })[0], function () { pintarInfo(); }); }; });
    box.querySelector('#in-salvatags').onclick = function () {
      var btn = this;
      C.comBotao(btn, function () { return C.api('contato.salvar', { contato: { id: c.id, tags: tg.valor() } }).then(function (s) { Object.assign(c, s); C.toast('Tags salvas', 'ok'); pintarLista(); }); });
    };
    box.querySelector('#in-resp').onchange = function () {
      var v = this.value;
      C.api('contato.massa', { ids: [c.id], acao: 'atribuir', valor: v }).then(function () { c.responsavel_id = v; pintarLista(); C.toast('Responsável alterado', 'ok'); }).catch(function (e) { C.toast(e.message, 'erro'); });
    };
    C.$$('[data-neg]', box).forEach(function (s) {
      s.onchange = function () {
        C.api('negocio.mover', { id: s.dataset.neg, etapa_id: s.value }).then(function (r) { var n = S.negocios.filter(function (x) { return x.id === r.id; })[0]; if (n) Object.assign(n, r); C.toast('Etapa alterada', 'ok'); pintarInfo(); }).catch(function (e) { C.toast(e.message, 'erro'); });
      };
    });
    var bn = box.querySelector('#in-neg');
    if (bn) bn.onclick = function () { C.formNegocio({ contato_id: c.id }, pintarInfo); };
  }

  function simular() {
    var cs = S.contatos.filter(function (c) { return c.telefone; });
    var c = cs[Math.floor(Math.random() * cs.length)];
    var frases = ['Oi, ainda tem horário essa semana?', 'Quanto custa o pacote mensal?', 'Bom dia! Queria um orçamento', 'Vocês atendem sábado?'];
    window.PrumoDemo.simularEntrada(c.telefone, c.nome, frases[Math.floor(Math.random() * frases.length)]);
    C.toast('Mensagem simulada de ' + c.nome + '. Ela aparece em alguns segundos.');
    setTimeout(C.syncAgora, 600);
  }
})();
