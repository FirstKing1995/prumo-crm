/* ==========================================================================
   PRUMO CRM — E-mail marketing (campanhas, e-mails de automação, relatório)
   ========================================================================== */
(function () {
  'use strict';
  var S = C.S, esc = C.esc, ic = C.ic;
  var aba = 'campanha';

  var BLOCOS = {
    titulo: ['Título', 'lista'],
    texto: ['Texto', 'nota'],
    botao: ['Botão', 'externo'],
    imagem: ['Imagem', 'imagem'],
    divisor: ['Divisor', 'menu'],
    espaco: ['Espaço', 'mais']
  };
  var ST = { rascunho: ['Rascunho', 'st-off'], agendada: ['Agendado', 'st-aviso'], enviando: ['Enviando', 'st-lead'], pausada: ['Pausado', 'st-aviso'], concluida: ['Enviado', 'st-on'], cancelada: ['Cancelado', 'st-erro'], erro: ['Erro', 'st-erro'], ativo: ['Em uso nas automações', 'st-on'] };

  C.views.email = {
    titulo: 'E-mail marketing',
    acoes: function () { return '<button class="btn pri" data-a="novo">' + ic('plus') + '<span class="txt"> Novo e-mail</span></button>'; },
    ligarAcoes: function (el) { el.querySelector('[data-a=novo]').onclick = function () { editar({ tipo: aba, blocos: modeloInicial() }); }; },
    render: function (el) {
      var lista = (S.emails || []).filter(function (e) { return (e.tipo || 'campanha') === aba; }).sort(function (a, b) { return (a.criado_em || '') < (b.criado_em || '') ? 1 : -1; });
      el.innerHTML = '<div class="abas">' + [['campanha', 'Campanhas'], ['automacao', 'E-mails de automação']].map(function (a) { return '<button data-ab="' + a[0] + '" class="' + (aba === a[0] ? 'on' : '') + '">' + a[1] + '</button>'; }).join('') + '</div>' +
        '<div id="em-cota"></div>' +
        (aba === 'automacao' ? '<p class="muted small" style="margin:0 0 12px">Estes e-mails são usados no passo <b>Enviar e-mail</b> das automações (boas-vindas, sequência de nutrição, carrinho abandonado...). Os números somam todos os envios.</p>' : '') +
        (lista.length ? '<div class="lista-cards">' + lista.map(cartao).join('') + '</div>' :
          '<div class="card vazio">' + ic('email') + '<h3>' + (aba === 'campanha' ? 'Nenhuma campanha de e-mail' : 'Nenhum e-mail de automação') + '</h3><p>' + (aba === 'campanha' ? 'Mande newsletters, promoções e novidades para a sua lista, com relatório de aberturas e cliques.' : 'Crie e-mails para as automações mandarem sozinhas.') + '</p><button class="btn pri" id="em-novo">' + ic('plus') + ' Criar e-mail</button></div>');
      C.$$('[data-ab]', el).forEach(function (b) { b.onclick = function () { aba = b.dataset.ab; C.render(); }; });
      var nv = C.$('#em-novo', el); if (nv) nv.onclick = function () { editar({ tipo: aba, blocos: modeloInicial() }); };
      C.$$('[data-ea]', el).forEach(function (b) { b.onclick = function () { acao(b.dataset.ea, b.dataset.id, b); }; });
      C.api('email.cota').then(function (q) { var box = C.$('#em-cota'); if (box) box.innerHTML = avisoCota(q); }).catch(function () { });
    },
    aoSincronizar: function (r) { if (r.emails && !C.$('.modal-bg')) { mesclar(r.emails); C.render(); } }
  };

  function mesclar(lista) {
    lista.forEach(function (e) { var i = (S.emails || []).findIndex(function (x) { return x.id === e.id; }); if (i >= 0) S.emails[i] = e; else S.emails.push(e); });
  }
  function avisoCota(q) {
    var prov = { gmail: 'Gmail da conta', brevo: 'Brevo', ambos: 'Gmail + Brevo' }[q.provedor] || q.provedor;
    return '<div class="aviso info">' + ic('email') + '<div>Envio por <b>' + esc(prov) + '</b>. Hoje: <b>' + C.inteiro(q.enviados_hoje) + '</b> enviados, <b>' + C.inteiro(q.total) + '</b> ainda disponíveis' +
      (q.por_dia ? ' (limite grátis de ' + C.inteiro(q.por_dia) + ' por dia; o que passar sai no dia seguinte)' : '') + '.' + (C.pode('integracoes') ? ' <a href="#" id="em-cfg">Configurar envio</a>' : '') + '</div></div>';
  }
  document.addEventListener('click', function (e) { if (e.target && e.target.id === 'em-cfg') { e.preventDefault(); C.ir('integracoes'); setTimeout(function () { var b = document.querySelector('[data-in=email]'); if (b) b.click(); }, 400); } });

  function taxa(a, b) { return b ? C.pct(a, b) + '%' : '—'; }
  function cartao(e) {
    var st = ST[e.status] || [e.status, 'st-off'];
    var env = C.num(e.enviados);
    var botoes = '';
    if (e.tipo === 'automacao') botoes = '<button class="btn peq" data-ea="editar" data-id="' + e.id + '">' + ic('lapis') + ' Editar</button>';
    else if (e.status === 'rascunho' || e.status === 'agendada') botoes = '<button class="btn peq" data-ea="editar" data-id="' + e.id + '">' + ic('lapis') + ' Editar</button><button class="btn peq pri" data-ea="enviar" data-id="' + e.id + '">' + ic('enviar') + ' ' + (e.agendar_em ? 'Agendar' : 'Enviar') + '</button>';
    else if (e.status === 'enviando') botoes = '<button class="btn peq" data-ea="pausar" data-id="' + e.id + '">' + ic('pause') + ' Pausar</button>';
    else if (e.status === 'pausada') botoes = '<button class="btn peq" data-ea="retomar" data-id="' + e.id + '">' + ic('play') + ' Retomar</button><button class="btn peq perigo" data-ea="cancelar" data-id="' + e.id + '">Cancelar</button>';
    if (env) botoes += '<button class="btn peq" data-ea="relatorio" data-id="' + e.id + '">' + ic('relatorios') + ' Relatório</button>';
    botoes += '<button class="btn fantasma ic peq" data-ea="duplicar" data-id="' + e.id + '" aria-label="Duplicar">' + ic('duplicar') + '</button>';
    if (e.status !== 'enviando') botoes += '<button class="btn fantasma ic peq perigo" data-ea="excluir" data-id="' + e.id + '" aria-label="Excluir">' + ic('lixo') + '</button>';
    return '<div class="card item-card"><div class="passo-ic c-msg" style="width:42px;height:42px">' + ic('email') + '</div><div class="meio"><h3 class="trunc">' + esc(e.nome) + ' <span class="status ' + st[1] + '">' + st[0] + '</span></h3>' +
      '<div class="small muted trunc">Assunto: ' + esc(e.assunto) + (e.assunto_b ? ' · teste A/B' : '') + '</div>' +
      (env || C.num(e.total) ? '<div class="em-nums"><span><b>' + C.inteiro(env) + '</b>' + (e.tipo === 'automacao' ? '' : '/' + C.inteiro(e.total)) + ' enviados</span><span><b>' + taxa(C.num(e.aberturas), env) + '</b> abriram</span><span><b>' + taxa(C.num(e.cliques), env) + '</b> clicaram</span><span><b>' + C.inteiro(e.descadastros) + '</b> saíram</span>' + (C.num(e.erros) ? '<span style="color:var(--vermelho)"><b>' + C.inteiro(e.erros) + '</b> erros</span>' : '') + '</div>' : '') +
      (e.agendar_em && e.status !== 'concluida' ? '<div class="small muted">Agendado para ' + C.fmtData(e.agendar_em) + '</div>' : '') + '</div>' +
      '<div class="em-botoes">' + botoes + '</div></div>';
  }

  function acao(a, id, btn) {
    var e = (S.emails || []).filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    var depois = function (r) { if (r && r.id) mesclar([r]); return C.recarregar(); };
    if (a === 'editar') return editar(JSON.parse(JSON.stringify(e)));
    if (a === 'relatorio') return relatorio(e);
    if (a === 'enviar') {
      return C.api('email.publico', { filtro: C.json(e.filtro, {}) }).then(function (r) {
        var dias = r.cota.por_dia ? Math.ceil(Math.max(0, r.total - r.cota.total) / r.cota.por_dia) : 0;
        return C.confirmar((e.agendar_em ? 'Agendar' : 'Enviar') + ' <b>' + esc(e.nome) + '</b> para <b>' + C.inteiro(r.total) + '</b> contatos?' +
          (r.total > r.cota.total ? '<br><br>O limite grátis de hoje é de ' + C.inteiro(r.cota.total) + ' e-mails. O restante sai automaticamente nos próximos ' + (dias || 1) + ' dia(s), às 8h.' : ''), { botao: e.agendar_em ? 'Agendar' : 'Enviar agora' });
      }).then(function (ok) {
        if (!ok) return;
        return C.comBotao(btn, function () { return C.api('email.iniciar', { id: id }).then(function (r) { C.toast(r.agendada ? 'E-mail agendado' : 'Envio iniciado para ' + C.inteiro(r.total) + ' contatos', 'ok'); return C.recarregar(); }); });
      }).catch(function (er) { C.toast(er.message, 'erro'); });
    }
    if (a === 'excluir') return C.confirmar('Excluir o e-mail <b>' + esc(e.nome) + '</b>?', { perigo: true, botao: 'Excluir' }).then(function (ok) { if (ok) return C.api('email.excluir', { id: id }).then(function () { S.emails = S.emails.filter(function (x) { return x.id !== id; }); C.render(); }); }).catch(function (er) { C.toast(er.message, 'erro'); });
    if (a === 'cancelar') return C.confirmar('Cancelar o envio? Quem ainda não recebeu não vai receber.', { perigo: true, botao: 'Cancelar envio' }).then(function (ok) { if (ok) return C.api('email.cancelar', { id: id }).then(depois); }).catch(function (er) { C.toast(er.message, 'erro'); });
    C.comBotao(btn, function () { return C.api('email.' + a, { id: id }).then(depois); });
  }

  function modeloInicial() {
    return [{ tipo: 'titulo', texto: 'Olá, {primeiro_nome}!' }, { tipo: 'texto', texto: 'Escreva aqui a sua mensagem. Use *asteriscos* para negrito.' }, { tipo: 'botao', texto: 'Saiba mais', url: 'https://' }];
  }

  /* --------------------------------------------------------------- editor */
  function editar(e) {
    var blocos = C.json(e.blocos, []);
    if (!Array.isArray(blocos)) blocos = [];
    var f = C.json(e.filtro, {}) || {};
    var campanha = (e.tipo || 'campanha') === 'campanha';
    var origens = {}; S.contatos.forEach(function (x) { if (x.origem) origens[x.origem] = 1; });
    var el = C.modal({
      titulo: e.id ? 'Editar e-mail' : (campanha ? 'Nova campanha de e-mail' : 'Novo e-mail de automação'), tamanho: 'xl',
      corpo: '<div class="em-editor"><div class="em-esq">' +
        '<div class="campo"><label>Nome interno</label><input class="inp" id="e-nome" value="' + esc(e.nome || '') + '" placeholder="Ex.: Newsletter de novembro"></div>' +
        '<div class="campo"><label>Assunto</label><input class="inp" id="e-ass" value="' + esc(e.assunto || '') + '" placeholder="{primeiro_nome}, ..."></div>' +
        (campanha ? '<details class="campo"' + (e.assunto_b ? ' open' : '') + '><summary class="small"><b>Teste A/B de assunto</b></summary><input class="inp" id="e-assb" style="margin-top:6px" value="' + esc(e.assunto_b || '') + '" placeholder="Assunto B (metade da lista recebe este)"><span class="ajuda">O relatório mostra qual assunto teve mais aberturas.</span></details>' : '') +
        '<div class="campo"><label>Texto de prévia (aparece ao lado do assunto)</label><input class="inp" id="e-pre" value="' + esc(e.preheader || '') + '"></div>' +
        '<span class="rot">Conteúdo</span><div id="e-blocos" style="margin-top:6px"></div>' +
        '<div class="chips" style="margin:8px 0 16px">' + Object.keys(BLOCOS).map(function (k) { return '<button type="button" class="chip" data-add="' + k + '">' + ic('plus') + ' ' + BLOCOS[k][0] + '</button>'; }).join('') + '</div>' +
        (campanha ? '<span class="rot">Quem recebe</span><div class="card" style="padding:12px;margin-top:6px">' +
          '<div class="campo"><label>Com alguma destas tags (vazio = todos)</label><div id="e-tags"></div></div>' +
          '<div class="campo"><label>Sem estas tags</label><div id="e-semtags"></div></div>' +
          '<div class="grade2"><div class="campo"><label>Status</label><select class="inp" id="e-status"><option value="">Todos</option>' + [['lead', 'Leads'], ['cliente', 'Clientes'], ['inativo', 'Inativos']].map(function (s) { return '<option value="' + s[0] + '"' + ((f.status || [])[0] === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></div>' +
          '<div class="campo"><label>Origem</label><select class="inp" id="e-origem"><option value="">Todas</option>' + Object.keys(origens).sort().map(function (o) { return '<option' + ((f.origens || [])[0] === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></div></div>' +
          '<div class="aviso ok" id="e-total" style="margin:0">' + ic('contatos') + '<div>Calculando...</div></div></div>' +
          '<div class="campo" style="margin-top:12px"><label>Agendar para (opcional)</label><input class="inp" type="datetime-local" id="e-ag" value="' + esc((e.agendar_em || '').slice(0, 16)) + '"></div>' : '') +
        '</div><div class="em-dir"><div class="em-previa-cab"><span class="rot">Prévia</span><span class="small muted" id="e-prev-ass"></span></div><iframe id="e-prev" title="Prévia do e-mail" sandbox=""></iframe>' +
        '<div class="linha" style="margin-top:10px"><input class="inp" id="e-teste" type="email" value="' + esc(S.user.email || '') + '" placeholder="seu@email.com"><button class="btn" id="e-envteste" style="flex:0 0 auto" data-carregando=" Enviando...">' + ic('enviar') + ' Enviar teste</button></div></div></div>',
      pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="e-ok" data-carregando=" Salvando...">Salvar</button>'
    });
    var tgI = campanha ? C.campoTags(el.querySelector('#e-tags'), f.tags || [], C.todasTags()) : null;
    var tgE = campanha ? C.campoTags(el.querySelector('#e-semtags'), f.sem_tags || [], C.todasTags()) : null;
    var filtro = function () {
      if (!campanha) return {};
      return { tags: tgI.valor(), sem_tags: tgE.valor(), status: el.querySelector('#e-status').value ? [el.querySelector('#e-status').value] : [], origens: el.querySelector('#e-origem').value ? [el.querySelector('#e-origem').value] : [] };
    };
    var dados = function () {
      return { id: e.id, tipo: e.tipo || 'campanha', nome: el.querySelector('#e-nome').value, assunto: el.querySelector('#e-ass').value, assunto_b: el.querySelector('#e-assb') ? el.querySelector('#e-assb').value : '',
        preheader: el.querySelector('#e-pre').value, blocos: blocos, filtro: filtro(), agendar_em: el.querySelector('#e-ag') && el.querySelector('#e-ag').value ? el.querySelector('#e-ag').value + ':00' : '' };
    };
    var previa = C.debounce(function () {
      if (!el.isConnected) return;
      C.api('email.previa', { email: dados() }).then(function (r) { el.querySelector('#e-prev').srcdoc = r.html; el.querySelector('#e-prev-ass').textContent = r.assunto ? 'Assunto: ' + r.assunto : ''; }).catch(function () { });
    }, 500);
    var contar = C.debounce(function () {
      var box = el.querySelector('#e-total');
      if (!box || !box.isConnected) return;
      C.api('email.publico', { filtro: filtro() }).then(function (r) {
        box.innerHTML = ic('contatos') + '<div><b>' + C.inteiro(r.total) + '</b> contatos com e-mail válido e sem descadastro.' + (r.total > r.cota.total ? ' Hoje cabem ' + C.inteiro(r.cota.total) + '; o restante sai nos dias seguintes.' : '') + '</div>';
      }).catch(function () { });
    }, 400);
    var pintar = function () {
      var box = el.querySelector('#e-blocos');
      box.innerHTML = blocos.map(function (b, i) {
        var t = BLOCOS[b.tipo] || ['?', 'info'];
        var campos = '';
        if (b.tipo === 'titulo') campos = '<input class="inp" data-k="texto" data-i="' + i + '" value="' + esc(b.texto || '') + '">';
        else if (b.tipo === 'texto') campos = '<textarea class="inp" rows="4" data-k="texto" data-i="' + i + '">' + esc(b.texto || '') + '</textarea>';
        else if (b.tipo === 'botao') campos = '<div class="grade2"><input class="inp" data-k="texto" data-i="' + i + '" value="' + esc(b.texto || '') + '" placeholder="Texto do botão"><input class="inp" data-k="url" data-i="' + i + '" value="' + esc(b.url || '') + '" placeholder="https://"></div>';
        else if (b.tipo === 'imagem') campos = '<div class="grade2"><input class="inp" data-k="url" data-i="' + i + '" value="' + esc(b.url || '') + '" placeholder="Link https da imagem"><input class="inp" data-k="link" data-i="' + i + '" value="' + esc(b.link || '') + '" placeholder="Abrir ao clicar (opcional)"></div>';
        return '<div class="em-bloco"><div class="em-bloco-cab">' + ic(t[1]) + '<b>' + t[0] + '</b><span style="margin-left:auto;display:flex;gap:2px"><button type="button" class="btn fantasma ic peq" data-up="' + i + '" aria-label="Subir"' + (i ? '' : ' disabled') + '>' + ic('cima') + '</button><button type="button" class="btn fantasma ic peq" data-down="' + i + '" aria-label="Descer"' + (i < blocos.length - 1 ? '' : ' disabled') + '>' + ic('baixo') + '</button><button type="button" class="btn fantasma ic peq perigo" data-del="' + i + '" aria-label="Remover">' + ic('x') + '</button></span></div>' + campos + '</div>';
      }).join('') || '<p class="small muted">Adicione blocos abaixo.</p>';
      C.$$('[data-k]', box).forEach(function (x) { x.oninput = function () { blocos[x.dataset.i][x.dataset.k] = x.value; previa(); }; });
      C.$$('[data-del]', box).forEach(function (x) { x.onclick = function () { blocos.splice(Number(x.dataset.del), 1); pintar(); previa(); }; });
      C.$$('[data-up]', box).forEach(function (x) { x.onclick = function () { var i = Number(x.dataset.up); blocos.splice(i - 1, 0, blocos.splice(i, 1)[0]); pintar(); previa(); }; });
      C.$$('[data-down]', box).forEach(function (x) { x.onclick = function () { var i = Number(x.dataset.down); blocos.splice(i + 1, 0, blocos.splice(i, 1)[0]); pintar(); previa(); }; });
    };
    pintar(); previa(); if (campanha) contar();
    C.$$('[data-add]', el).forEach(function (b) { b.onclick = function () { var n = { tipo: b.dataset.add }; if (n.tipo === 'botao') { n.texto = 'Saiba mais'; n.url = 'https://'; } if (n.tipo === 'texto' || n.tipo === 'titulo') n.texto = ''; blocos.push(n); pintar(); previa(); }; });
    ['#e-ass', '#e-pre'].forEach(function (s) { el.querySelector(s).addEventListener('input', previa); });
    if (campanha) { el.addEventListener('change', function (ev) { if (ev.target.closest('.card')) contar(); }); el.addEventListener('input', function (ev) { if (ev.target.closest('.card')) contar(); }); }
    el.querySelector('#e-envteste').onclick = function () {
      var b = this;
      C.comBotao(b, function () { return C.api('email.testar', { email: dados(), para: el.querySelector('#e-teste').value }).then(function (r) { C.toast('Teste enviado' + (r.via === 'brevo' ? ' pelo Brevo' : ' pelo Gmail') + (C.ehDemo() ? ' (na demonstração nada sai de verdade)' : ''), 'ok'); }); });
    };
    el.querySelector('#e-ok').onclick = function () {
      var d = dados();
      C.comBotao(this, function () {
        if (d.blocos.some(function (b) { return b.tipo === 'botao' && !/^https?:\/\/.+\..+/.test(b.url || ''); })) throw new Error('Confira o link dos botões (precisa começar com https://).');
        if (d.blocos.some(function (b) { return b.tipo === 'imagem' && !/^https:\/\//.test(b.url || ''); })) throw new Error('A imagem precisa de um link que comece com https://');
        return C.api('email.salvar', { email: d }).then(function (r) { mesclar([r]); el.fechar(); C.toast('E-mail salvo', 'ok'); C.render(); });
      });
    };
  }

  /* ------------------------------------------------------------- relatório */
  function relatorio(e) {
    var env = C.num(e.enviados);
    var el = C.modal({
      titulo: 'Relatório: ' + e.nome, tamanho: 'xl',
      corpo: '<div class="kpis" style="margin-top:0">' + [['enviar', 'Enviados', C.inteiro(env)], ['olho', 'Abriram', taxa(C.num(e.aberturas), env)], ['externo', 'Clicaram', taxa(C.num(e.cliques), env)], ['usuarioX', 'Descadastros', C.inteiro(e.descadastros)], ['alerta', 'Erros', C.inteiro(e.erros)]].map(function (k) { return '<div class="card kpi"><div class="rot">' + ic(k[0]) + k[1] + '</div><div class="val">' + k[2] + '</div></div>'; }).join('') + '</div>' +
        (e.assunto_b && C.num(e.enviados_b) ? (function () {
          var envA = env - C.num(e.enviados_b), abA = C.num(e.aberturas) - C.num(e.aberturas_b);
          var tA = envA ? abA / envA : 0, tB = C.num(e.aberturas_b) / C.num(e.enviados_b);
          return '<div class="card card-pad" style="margin-bottom:14px"><b>Teste A/B de assunto</b><div class="grade2" style="margin-top:8px"><div class="dado' + (tA >= tB ? ' vencedor' : '') + '">A: ' + esc(e.assunto) + ' <b>' + Math.round(tA * 100) + '%</b></div><div class="dado' + (tB > tA ? ' vencedor' : '') + '">B: ' + esc(e.assunto_b) + ' <b>' + Math.round(tB * 100) + '%</b></div></div></div>';
        })() : '') +
        '<p class="small muted">Aberturas são aproximadas: alguns programas de e-mail bloqueiam imagens (não contam) e outros abrem sozinhos para proteger a privacidade (contam a mais). Cliques são o número mais confiável.</p>' +
        '<div class="card"><div class="tabela-wrap" id="er-tab" style="max-height:380px"><div style="text-align:center;padding:30px"><span class="spin" style="color:var(--pri)"></span></div></div></div>'
    });
    C.api('email.envios', { id: e.id }).then(function (l) {
      var box = el.querySelector('#er-tab');
      if (!box) return;
      box.innerHTML = '<table class="tab"><thead><tr><th>Contato</th><th>Situação</th><th>Abriu</th><th>Clicou</th></tr></thead><tbody>' + l.map(function (x) {
        return '<tr style="cursor:default"><td>' + esc(x.nome) + '<div class="small muted">' + esc(x.email) + (x.variante === 'B' ? ' · assunto B' : '') + '</div></td><td><span class="status ' + (x.status === 'enviado' ? 'st-on' : x.status === 'erro' ? 'st-erro' : 'st-off') + '"' + (x.erro ? ' title="' + esc(x.erro) + '"' : '') + '>' + esc({ enviado: 'Enviado', pendente: 'Na fila', erro: 'Erro', cancelado: 'Cancelado' }[x.status] || x.status) + '</span></td><td class="small">' + (x.aberto_em ? C.fmtData(x.aberto_em) : '—') + '</td><td class="small">' + (x.clicado_em ? C.fmtData(x.clicado_em) : '—') + '</td></tr>';
      }).join('') + '</tbody></table>';
    }).catch(function (er) { C.toast(er.message, 'erro'); });
  }
})();
