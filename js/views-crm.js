/* ==========================================================================
   PRUMO CRM — Painel, Contatos (ficha), Negócios (kanban) e Tarefas
   ========================================================================== */
(function () {
  'use strict';
  var S = C.S, esc = C.esc, ic = C.ic;

  /* ================================================================ PAINEL */
  C.views.painel = {
    titulo: 'Painel',
    render: function (el) {
      var hoje = C.hoje(), d7 = C.diasAtras(7), d30 = C.diasAtras(30);
      var cs = S.contatos;
      var novos7 = cs.filter(function (c) { return c.criado_em.slice(0, 10) >= d7; }).length;
      var novos30 = cs.filter(function (c) { return c.criado_em.slice(0, 10) >= d30; }).length;
      var naoLidas = cs.filter(function (c) { return C.num(c.nao_lidas) > 0; }).length;
      var abertos = S.negocios.filter(function (n) { return n.status === 'aberto'; });
      var ganhosMes = S.negocios.filter(function (n) { return n.status === 'ganho' && n.fechado_em.slice(0, 7) === hoje.slice(0, 7); });
      var fech30 = S.negocios.filter(function (n) { return n.status !== 'aberto' && n.fechado_em.slice(0, 10) >= d30; });
      var ganhos30 = fech30.filter(function (n) { return n.status === 'ganho'; });
      var agora = C.isoLocal();
      var atrasadas = S.tarefas.filter(function (t) { return t.feita !== 'SIM' && t.vence_em && t.vence_em < agora && (!t.responsavel_id || t.responsavel_id === S.user.id || C.pode('todos')); });
      var semResp = cs.filter(function (c) { return c.ultima_direcao === 'in' && C.num(c.nao_lidas) > 0; }).sort(function (a, b) { return a.ultima_msg_em < b.ultima_msg_em ? -1 : 1; });
      var sla = C.num(S.config.sla_minutos) || 15;
      var foraSla = semResp.filter(function (c) { return C.foraDoPrazo(c); });

      var dias = [];
      for (var i = 29; i >= 0; i--) dias.push(C.diasAtras(i));
      var porDia = {};
      cs.forEach(function (c) { var k = c.criado_em.slice(0, 10); porDia[k] = (porDia[k] || 0) + 1; });
      var max = Math.max.apply(null, dias.map(function (k) { return porDia[k] || 0; }).concat([1]));

      var funil = S.funis[0];
      var h = '';
      if (S.waStatus && S.waStatus.provedor === 'link' && C.pode('integracoes')) {
        h += '<div class="aviso info">' + ic('info') + '<div>O WhatsApp está no <b>modo link</b>: as mensagens abrem no seu WhatsApp para você enviar. Para responder pelo sistema, usar robôs e disparos automáticos, <a href="#" data-ir-integ>conecte uma API</a>.</div></div>';
      }
      h += '<div class="kpis">' +
        kpi('contatos', 'Novos contatos (7 dias)', C.inteiro(novos7), C.inteiro(novos30) + ' nos últimos 30 dias') +
        kpi('estrela', 'Clientes ativos', C.inteiro(cs.filter(function (c) { return c.status === 'cliente'; }).length), 'de ' + C.inteiro(cs.length) + ' contatos na base') +
        kpi('conversas', 'Conversas aguardando', C.inteiro(naoLidas), foraSla.length ? '<span style="color:var(--vermelho);font-weight:700">' + foraSla.length + ' há mais de ' + sla + ' min</span>' : 'com mensagem não lida') +
        kpi('negocios', 'Em negociação', C.brlCurto(abertos.reduce(function (s, n) { return s + C.num(n.valor); }, 0)), abertos.length + ' negócios abertos') +
        kpi('trofeu', 'Vendido no mês', C.brlCurto(ganhosMes.reduce(function (s, n) { return s + C.num(n.valor); }, 0)), ganhosMes.length + ' negócios ganhos') +
        kpi('raio', 'Taxa de conversão', C.pct(ganhos30.length, fech30.length) + '%', 'negócios fechados em 30 dias') +
        kpi('tarefas', 'Tarefas atrasadas', C.inteiro(atrasadas.length), atrasadas.length ? 'precisam de atenção' : 'tudo em dia') +
        '</div>';
      h += avisoSuporte() + '<div id="p-fin"></div>' + painelEquipe();
      h += '<div class="grid-3"><div class="card"><div class="card-cab"><h3>Novos contatos por dia</h3><span class="acoes small muted">últimos 30 dias</span></div><div class="card-pad">' +
        '<div class="barras">' + dias.map(function (k) { var v = porDia[k] || 0; return '<div class="b" style="height:' + Math.max(2, v / max * 100) + '%" data-t="' + k.slice(8, 10) + '/' + k.slice(5, 7) + ': ' + v + '"></div>'; }).join('') + '</div>' +
        '<div class="eixo"><span>' + C.fmtData(dias[0], false) + '</span><span>hoje</span></div></div></div>';
      h += '<div class="card"><div class="card-cab"><h3>Funil: ' + esc(funil ? funil.nome : '') + '</h3></div><div class="card-pad funil-v">';
      if (funil) {
        var porEt = {};
        S.negocios.forEach(function (n) { if (n.funil_id === funil.id && (n.status === 'aberto' || n.fechado_em.slice(0, 10) >= d30)) porEt[n.etapa_id] = (porEt[n.etapa_id] || 0) + 1; });
        var maxE = Math.max.apply(null, funil.etapas.map(function (e) { return porEt[e.id] || 0; }).concat([1]));
        h += funil.etapas.map(function (e) {
          var v = porEt[e.id] || 0;
          return '<div class="etapa"><div class="faixa" style="background:' + esc(e.cor) + ';width:' + Math.max(14, v / maxE * 62) + '%">' + v + '</div><span class="small muted trunc">' + esc(e.nome) + '</span></div>';
        }).join('');
      }
      h += '</div></div></div>';
      h += '<div class="grid-2" style="margin-top:16px"><div class="card"><div class="card-cab"><h3>Esperando resposta</h3><span class="acoes"><button class="btn peq" data-ir2="conversas">Abrir conversas</button></span></div>';
      h += semResp.length ? '<div>' + semResp.slice(0, 6).map(function (c) {
        return '<button class="ib-item' + (C.foraDoPrazo(c) ? ' atrasada' : '') + '" data-conv="' + c.id + '">' + C.av(c.nome) + '<div class="meio"><div class="l1"><b>' + esc(c.nome) + '</b><span class="hora">' + C.rel(c.ultima_msg_em) + '</span></div><div class="l2"><span>' + esc(c.ultima_msg) + '</span></div></div></button>';
      }).join('') + '</div>' : '<div class="vazio">' + ic('check2') + '<h3>Ninguém esperando</h3><p>Todas as conversas foram respondidas.</p></div>';
      h += '</div><div class="card"><div class="card-cab"><h3>Minhas tarefas</h3><span class="acoes"><button class="btn peq" data-nova-tarefa>' + ic('plus') + ' Nova</button></span></div>';
      var minhas = S.tarefas.filter(function (t) { return t.feita !== 'SIM' && (t.responsavel_id === S.user.id || !t.responsavel_id); }).sort(function (a, b) { return (a.vence_em || '9') < (b.vence_em || '9') ? -1 : 1; }).slice(0, 7);
      h += minhas.length ? '<div>' + minhas.map(linhaTarefa).join('') + '</div>' : '<div class="vazio">' + ic('tarefas') + '<h3>Sem tarefas pendentes</h3></div>';
      h += '</div></div>';
      el.innerHTML = h;
      ligarTarefas(el, function () { C.render(); });
      painelFinanceiro();
      C.$$('[data-reu]', el).forEach(function (b) { b.onclick = function () { C.acoesReuniao(S.negocios.filter(function (n) { return n.id === b.dataset.reu; })[0], function () { C.recarregar(); }); }; });
      C.$$('[data-conv]', el).forEach(function (b) { b.onclick = function () { C.abrirConversa(b.dataset.conv); }; });
      C.$$('[data-ir2]', el).forEach(function (b) { b.onclick = function () { C.ir(b.dataset.ir2); }; });
      var ii = C.$('[data-ir-integ]', el); if (ii) ii.onclick = function (e) { e.preventDefault(); C.ir('integracoes'); };
      var nt = C.$('[data-nova-tarefa]', el); if (nt) nt.onclick = function () { C.formTarefa({}, function () { C.render(); }); };
    },
    aoSincronizar: function (r) { if (r.contatosMudaram || r.completo) { if (!C.$('.modal-bg')) C.render(); } }
  };
  /** Painel da equipe comercial: meta do mês e próximas reuniões (para SDR, closer e quem gerencia). */
  function painelEquipe() {
    var eu = S.user, mes = C.hoje().slice(0, 7), agora = C.isoLocal();
    var ehSdr = eu.perfil === 'sdr' || eu.perfil === 'atendente';
    var reunioes = S.negocios.filter(function (n) { return n.reuniao_em && n.reuniao_status === 'agendada' && (C.pode('todos') || n.responsavel_id === eu.id || n.sdr_id === eu.id); })
      .sort(function (a, b) { return a.reuniao_em < b.reuniao_em ? -1 : 1; });
    if (!ehSdr && eu.perfil !== 'closer' && !reunioes.length) return '';
    var meta, feito, rot;
    if (ehSdr) { meta = C.num(eu.meta_reunioes); feito = S.negocios.filter(function (n) { return n.sdr_id === eu.id && n.reuniao_em && (n.passado_em || '').slice(0, 7) === mes; }).length; rot = 'reuniões marcadas'; }
    else { meta = C.num(eu.meta_valor); feito = S.negocios.filter(function (n) { return n.responsavel_id === eu.id && n.status === 'ganho' && (n.fechado_em || '').slice(0, 7) === mes; }).reduce(function (s, n) { return s + C.num(n.valor); }, 0); rot = 'vendidos'; }
    var p = meta ? Math.min(100, Math.round(feito / meta * 100)) : 0;
    var h = '<div class="grid-2" style="margin-bottom:16px">';
    h += '<div class="card card-pad"><div class="rot">' + ic('alvo') + ' Minha meta do mês</div>' + (meta ? '<div style="display:flex;align-items:baseline;gap:8px;margin:8px 0"><b style="font-size:24px">' + (ehSdr ? feito : C.brlCurto(feito)) + '</b><span class="muted">de ' + (ehSdr ? meta : C.brlCurto(meta)) + ' ' + rot + '</span></div><div class="meta-barra grande"><div style="width:' + p + '%"></div></div><div class="small muted" style="margin-top:6px">' + p + '% da meta</div>' : '<p class="small muted">' + (C.pode('equipe') ? 'Defina metas em Equipe e acessos.' : 'O administrador ainda não definiu a sua meta.') + '</p>') + '</div>';
    h += '<div class="card"><div class="card-cab"><h3>' + ic('calendario') + ' Próximas reuniões</h3></div>' + (reunioes.length ? reunioes.slice(0, 5).map(function (n) {
      var c = C.contato(n.contato_id), uc = C.usuario(n.responsavel_id), passou = n.reuniao_em < agora;
      return '<button class="ib-item" data-reu="' + n.id + '">' + C.av(c ? c.nome : '?') + '<div class="meio"><div class="l1"><b>' + esc(c ? c.nome : n.titulo) + '</b><span class="hora' + (passou ? '" style="color:var(--vermelho)' : '') + '">' + C.fmtData(n.reuniao_em) + '</span></div><div class="l2"><span>' + (passou ? 'Marque se aconteceu' : 'com ' + esc(uc ? uc.nome : '')) + '</span></div></div></button>';
    }).join('') : '<div class="vazio" style="padding:20px"><p>Nenhuma reunião marcada.</p></div>') + '</div></div>';
    return h;
  }
  /** Aviso do plano de suporte para o administrador (vencendo ou vencido). */
  function avisoSuporte() {
    var sp = S.suporte || {};
    if (!C.pode('equipe')) return '';
    if (!sp.tem) return '<div class="aviso info">' + ic('escudo') + '<div>Cole o <b>código de suporte</b> que veio com a sua compra em Ajustes > Sistema para ver o seu plano e o contato do suporte.</div></div>';
    if (sp.dias < 0) return '<div class="aviso">' + ic('info') + '<div>O seu plano de suporte terminou em ' + sp.ate.split('-').reverse().join('/') + '. O sistema continua funcionando normalmente, mas sem novas atualizações e correções.' + (sp.contato ? ' Para renovar: <b>' + esc(sp.contato) + '</b>.' : '') + '</div></div>';
    if (sp.dias <= 15) return '<div class="aviso">' + ic('relogio') + '<div>O seu plano de suporte termina em ' + sp.dias + ' dia' + (sp.dias === 1 ? '' : 's') + '.' + (sp.contato ? ' Para renovar: <b>' + esc(sp.contato) + '</b>.' : '') + '</div></div>';
    return '';
  }
  /** Linha do financeiro no painel (para quem tem acesso ao financeiro). */
  function painelFinanceiro() {
    var box = C.$('#p-fin');
    if (!box || !C.pode('financeiro')) return;
    C.api('financeiro.resumo', {}).then(function (r) {
      if (!box.isConnected || (!r.recebido && !r.a_receber && !r.atraso)) return;
      box.innerHTML = '<div class="kpis">' + kpi('dinheiro', 'Entrou no mês', C.brlCurto(r.liquido), r.recebido_qtd + ' pagamentos') + kpi('calendario', 'A receber', C.brlCurto(r.a_receber), 'parcelas futuras') +
        kpi('alerta', 'Inadimplentes', C.inteiro(r.inadimplentes), C.brl(r.atraso) + ' em atraso') + kpi('relogio', 'Vence em 7 dias', C.brlCurto(r.vencendo7), r.vencendo7_qtd + ' parcelas') + '</div>';
      C.$$('.kpi', box).forEach(function (k) { k.style.cursor = 'pointer'; k.onclick = function () { C.ir('financeiro'); }; });
    }).catch(function () { });
  }
  function kpi(i, rot, val, sub) { return '<div class="card kpi"><div class="rot">' + ic(i) + rot + '</div><div class="val">' + val + '</div><div class="sub">' + sub + '</div></div>'; }

  /* ============================================================== CONTATOS */
  var F = { busca: '', tag: '', status: '', origem: '', resp: '', etapa: '', ordem: 'recentes', limite: 100 };
  var selecionados = {};

  function contatosFiltrados() {
    var b = C.norm(F.busca);
    var negPorContato = {};
    if (F.etapa) S.negocios.forEach(function (n) { if (n.status === 'aberto' && n.etapa_id === F.etapa) negPorContato[n.contato_id] = 1; });
    var l = S.contatos.filter(function (c) {
      if (b && C.norm([c.nome, c.telefone, c.email, c.empresa, c.tags].join(' ')).indexOf(b) < 0) return false;
      if (F.tag && C.tags(c.tags).indexOf(F.tag) < 0) return false;
      if (F.status && c.status !== F.status) return false;
      if (F.origem && c.origem !== F.origem) return false;
      if (F.resp && (F.resp === '_sem' ? c.responsavel_id : c.responsavel_id !== F.resp)) return false;
      if (F.etapa && !negPorContato[c.id]) return false;
      return true;
    });
    var ord = {
      recentes: function (a, b2) { return a.criado_em < b2.criado_em ? 1 : -1; },
      nome: function (a, b2) { return a.nome.localeCompare(b2.nome, 'pt-BR'); },
      conversa: function (a, b2) { return (a.ultima_msg_em || '') < (b2.ultima_msg_em || '') ? 1 : -1; }
    };
    return l.sort(ord[F.ordem] || ord.recentes);
  }

  C.views.contatos = {
    titulo: 'Contatos',
    acoes: function () {
      return '<button class="btn" data-a="importar">' + ic('upload') + '<span class="txt"> Importar</span></button>' +
        '<button class="btn" data-a="exportar">' + ic('download') + '<span class="txt"> Exportar</span></button>' +
        '<button class="btn pri" data-a="novo">' + ic('plus') + '<span class="txt"> Novo contato</span></button>';
    },
    ligarAcoes: function (el) {
      el.querySelector('[data-a=novo]').onclick = function () { C.formContato({}, function (c) { C.abrirContato(c.id); C.render(); }); };
      el.querySelector('[data-a=importar]').onclick = abrirImportar;
      el.querySelector('[data-a=exportar]').onclick = exportar;
    },
    render: function (el) {
      var origens = {}; S.contatos.forEach(function (c) { if (c.origem) origens[c.origem] = 1; });
      var opt = function (v, r, atual) { return '<option value="' + esc(v) + '"' + (v === atual ? ' selected' : '') + '>' + esc(r) + '</option>'; };
      var etapasOpt = '';
      S.funis.forEach(function (f) { etapasOpt += '<optgroup label="' + esc(f.nome) + '">' + f.etapas.map(function (e) { return opt(e.id, e.nome, F.etapa); }).join('') + '</optgroup>'; });
      el.innerHTML = '<div class="barra-ferr">' +
        '<div class="busca">' + ic('busca') + '<input class="inp" id="f-busca" placeholder="Buscar nome, telefone, e-mail, tag" value="' + esc(F.busca) + '"></div>' +
        '<select class="inp" style="width:auto" id="f-tag"><option value="">Todas as tags</option>' + C.todasTags().map(function (t) { return opt(t, t, F.tag); }).join('') + '</select>' +
        '<select class="inp" style="width:auto" id="f-status"><option value="">Todos os status</option>' + opt('lead', 'Lead', F.status) + opt('cliente', 'Cliente', F.status) + opt('inativo', 'Inativo', F.status) + '</select>' +
        '<select class="inp" style="width:auto" id="f-etapa"><option value="">Qualquer etapa</option>' + etapasOpt + '</select>' +
        '<select class="inp" style="width:auto" id="f-origem"><option value="">Todas as origens</option>' + Object.keys(origens).sort().map(function (o) { return opt(o, o, F.origem); }).join('') + '</select>' +
        (C.pode('todos') ? '<select class="inp" style="width:auto" id="f-resp"><option value="">Todos os responsáveis</option>' + opt('_sem', 'Sem responsável', F.resp) + S.usuarios.map(function (u) { return opt(u.id, u.nome, F.resp); }).join('') + '</select>' : '') +
        '<div class="dir"><select class="inp" style="width:auto" id="f-ordem">' + opt('recentes', 'Mais recentes', F.ordem) + opt('conversa', 'Última conversa', F.ordem) + opt('nome', 'Nome A-Z', F.ordem) + '</select></div>' +
        '</div><div id="massa"></div><div class="card" id="lista-contatos"></div>';
      var re = C.debounce(function () { F.busca = C.$('#f-busca').value; F.limite = 100; pintarLista(); }, 200);
      C.$('#f-busca').oninput = re;
      ['tag', 'status', 'etapa', 'origem', 'resp', 'ordem'].forEach(function (k) { var s = C.$('#f-' + k); if (s) s.onchange = function () { F[k] = s.value; F.limite = 100; pintarLista(); }; });
      pintarLista();
    },
    aoSincronizar: function (r) { if (r.contatosMudaram || r.completo) pintarLista(); }
  };

  function pintarLista() {
    var box = C.$('#lista-contatos');
    if (!box) return;
    var l = contatosFiltrados();
    if (!S.contatos.length) {
      box.innerHTML = '<div class="vazio">' + ic('contatos') + '<h3>Nenhum contato ainda</h3><p>Importe sua lista, cadastre manualmente ou conecte o WhatsApp para os contatos entrarem sozinhos.</p><button class="btn pri" id="v-imp">' + ic('upload') + ' Importar planilha</button></div>';
      C.$('#v-imp').onclick = abrirImportar;
      pintarMassa();
      return;
    }
    var vis = l.slice(0, F.limite);
    box.innerHTML = '<div class="tabela-wrap"><table class="tab"><thead><tr><th class="sel-col"><input type="checkbox" id="sel-todos" aria-label="Selecionar todos"></th><th>Contato</th><th class="esconde-mob">Telefone</th><th>Tags</th><th class="esconde-mob">Status</th><th class="esconde-mob">Responsável</th><th class="esconde-mob">Criado</th></tr></thead><tbody>' +
      vis.map(function (c) {
        var u = C.usuario(c.responsavel_id);
        return '<tr data-id="' + c.id + '"><td class="sel-col" data-sel><input type="checkbox" ' + (selecionados[c.id] ? 'checked' : '') + ' aria-label="Selecionar"></td>' +
          '<td><div class="pessoa">' + C.av(c.nome) + '<div class="trunc"><b class="trunc">' + esc(c.nome) + '</b><span class="small muted trunc">' + esc(c.email || c.empresa || c.origem) + '</span></div></div></td>' +
          '<td class="esconde-mob nowrap">' + esc(C.tel(c.telefone)) + (c.optout === 'SIM' ? ' <span class="status st-erro" title="Pediu para não receber mensagens">saiu</span>' : '') + '</td>' +
          '<td><div class="chips">' + C.tags(c.tags).slice(0, 3).map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('') + (C.tags(c.tags).length > 3 ? '<span class="chip">+' + (C.tags(c.tags).length - 3) + '</span>' : '') + '</div></td>' +
          '<td class="esconde-mob"><span class="status st-' + c.status + '">' + ({ lead: 'Lead', cliente: 'Cliente', inativo: 'Inativo' }[c.status] || c.status) + '</span></td>' +
          '<td class="esconde-mob">' + (u ? '<div class="pessoa">' + C.av(u.nome, 'peq', u.cor) + '<span class="small trunc">' + esc(C.primeiroNome(u.nome)) + '</span></div>' : '<span class="fraco small">—</span>') + '</td>' +
          '<td class="esconde-mob small muted nowrap">' + C.fmtData(c.criado_em, false) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div style="padding:12px 16px;display:flex;gap:10px;align-items:center;border-top:1px solid var(--borda)" class="small muted">' + C.inteiro(l.length) + ' contatos' + (l.length !== S.contatos.length ? ' (de ' + C.inteiro(S.contatos.length) + ')' : '') +
      (l.length > F.limite ? '<button class="btn peq" id="mais" style="margin-left:auto">Mostrar mais</button>' : '') + '</div>';
    box.querySelectorAll('tbody tr').forEach(function (tr) {
      tr.onclick = function (e) {
        if (e.target.closest('[data-sel]')) {
          var cb = tr.querySelector('input');
          if (e.target !== cb) cb.checked = !cb.checked;
          if (cb.checked) selecionados[tr.dataset.id] = 1; else delete selecionados[tr.dataset.id];
          pintarMassa(); return;
        }
        C.abrirContato(tr.dataset.id);
      };
    });
    C.$('#sel-todos').onchange = function () {
      var on = this.checked;
      l.forEach(function (c) { if (on) selecionados[c.id] = 1; else delete selecionados[c.id]; });
      pintarLista();
    };
    if (C.$('#mais')) C.$('#mais').onclick = function () { F.limite += 200; pintarLista(); };
    pintarMassa();
  }

  function pintarMassa() {
    var box = C.$('#massa');
    if (!box) return;
    var ids = Object.keys(selecionados).filter(function (id) { return C.contato(id); });
    if (!ids.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="massa"><b>' + ids.length + ' selecionados</b>' +
      '<button class="btn peq" data-m="tag_add">' + ic('tag') + ' Adicionar tag</button><button class="btn peq" data-m="tag_rem">Remover tag</button>' +
      '<button class="btn peq" data-m="etapa">' + ic('negocios') + ' Mover para etapa</button>' +
      (C.pode('automacoes') ? '<button class="btn peq" data-m="automacao">' + ic('automacoes') + ' Iniciar automação</button>' : '') +
      (C.pode('todos') ? '<button class="btn peq" data-m="atribuir">' + ic('equipe') + ' Atribuir</button>' : '') +
      '<button class="btn peq" data-m="status">Status</button>' +
      (C.pode('excluir') ? '<button class="btn peq" data-m="excluir">' + ic('lixo') + ' Excluir</button>' : '') +
      '<button class="btn peq" data-m="limpar" style="margin-left:auto">' + ic('x') + ' Limpar</button></div>';
    C.$$('[data-m]', box).forEach(function (b) { b.onclick = function () { acaoMassa(b.dataset.m, ids); }; });
  }

  function acaoMassa(acao, ids) {
    if (acao === 'limpar') { selecionados = {}; pintarLista(); return; }
    var pedir;
    if (acao === 'tag_add' || acao === 'tag_rem') pedir = C.pedirTexto(acao === 'tag_add' ? 'Adicionar tag' : 'Remover tag', 'Tag', '', { lista: C.todasTags() });
    else if (acao === 'etapa') { var ops = []; S.funis.forEach(function (f) { f.etapas.forEach(function (e) { ops.push([e.id, f.nome + ' > ' + e.nome]); }); }); pedir = C.pedirTexto('Mover para etapa', 'Etapa do funil', '', { opcoes: ops }); }
    else if (acao === 'automacao') pedir = C.pedirTexto('Iniciar automação', 'Automação', '', { opcoes: S.automacoes.map(function (a) { return [a.id, a.nome + (a.ativo === 'SIM' ? '' : ' (desativada)')]; }) });
    else if (acao === 'atribuir') pedir = C.pedirTexto('Atribuir responsável', 'Responsável', '', { opcoes: [['', 'Ninguém']].concat(S.usuarios.filter(function (u) { return u.ativo === 'SIM'; }).map(function (u) { return [u.id, u.nome]; })) });
    else if (acao === 'status') pedir = C.pedirTexto('Mudar status', 'Status', '', { opcoes: [['lead', 'Lead'], ['cliente', 'Cliente'], ['inativo', 'Inativo']] });
    else if (acao === 'excluir') pedir = C.confirmar('Excluir <b>' + ids.length + '</b> contatos? As conversas continuam na planilha, mas os contatos somem do sistema.', { perigo: true, botao: 'Excluir' }).then(function (ok) { return ok ? 'sim' : null; });
    pedir.then(function (v) {
      if (v === null || (v === '' && acao !== 'atribuir')) return;
      return C.api('contato.massa', { ids: ids, acao: acao, valor: v }).then(function (r) {
        C.toast((r.afetados || ids.length) + ' contatos atualizados', 'ok');
        selecionados = {};
        return C.recarregar();
      });
    }).catch(function (e) { C.toast(e.message, 'erro'); });
  }

  function exportar() {
    var l = contatosFiltrados();
    var campos = S.config.campos || [];
    C.baixarCsv('contatos-' + C.hoje() + '.csv',
      ['nome', 'telefone', 'email', 'empresa', 'cargo', 'cidade', 'origem', 'tags', 'status', 'responsavel', 'criado_em'].concat(campos.map(function (c) { return c.chave; })),
      l.map(function (c) {
        var cp = C.json(c.campos, {});
        var u = C.usuario(c.responsavel_id);
        return [c.nome, c.telefone, c.email, c.empresa, c.cargo, c.cidade, c.origem, c.tags, c.status, u ? u.nome : '', c.criado_em].concat(campos.map(function (x) { return cp[x.chave] || ''; }));
      }));
  }

  /* ------------------------------------------------------------ importar */
  var MAPA_COLS = {
    nome: ['nome', 'name', 'nome completo', 'cliente', 'contato', 'full name'],
    telefone: ['telefone', 'celular', 'whatsapp', 'phone', 'fone', 'tel', 'mobile', 'numero'],
    email: ['email', 'e-mail', 'mail'],
    empresa: ['empresa', 'company', 'organizacao'],
    cidade: ['cidade', 'city'],
    cargo: ['cargo', 'funcao', 'job title'],
    tags: ['tags', 'etiquetas', 'marcadores', 'tag'],
    origem: ['origem', 'source', 'fonte'],
    notas: ['observacao', 'observacoes', 'notas', 'obs']
  };
  function abrirImportar() {
    var linhas = null, cab = [], mapa = {};
    var el = C.modal({
      titulo: 'Importar contatos', tamanho: 'largo',
      corpo: '<div class="aviso info">' + ic('info') + '<div>Envie um arquivo <b>CSV</b> (no Excel ou Google Planilhas: Arquivo > Fazer download > CSV). A primeira linha deve ter os nomes das colunas. Contatos repetidos (mesmo telefone ou e-mail) são atualizados, não duplicados.</div></div>' +
        '<div class="campo"><label>Arquivo CSV</label><input type="file" class="inp" id="i-arq" accept=".csv,.txt,text/csv"></div><div id="i-mapa"></div>',
      pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn" id="i-sim" disabled data-carregando=" Conferindo...">Conferir</button><button class="btn pri" id="i-ok" disabled data-carregando=" Importando...">Importar</button>'
    });
    el.querySelector('#i-arq').onchange = function () {
      var f = this.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var t = C.lerCsv(String(fr.result));
        if (t.length < 2) { C.toast('O arquivo não tem linhas suficientes', 'erro'); return; }
        cab = t[0]; linhas = t.slice(1);
        mapa = {};
        Object.keys(MAPA_COLS).forEach(function (k) {
          var i = cab.findIndex(function (h) { return MAPA_COLS[k].indexOf(C.norm(h).trim()) >= 0; });
          if (i < 0) i = cab.findIndex(function (h) { return MAPA_COLS[k].some(function (a) { return C.norm(h).indexOf(a) >= 0; }); });
          mapa[k] = i;
        });
        pintarMapa();
      };
      fr.readAsText(f, 'utf-8');
    };
    function pintarMapa() {
      var ops = function (sel) { return '<option value="-1">não usar</option>' + cab.map(function (c, i) { return '<option value="' + i + '"' + (sel === i ? ' selected' : '') + '>' + esc(c || 'coluna ' + (i + 1)) + '</option>'; }).join(''); };
      el.querySelector('#i-mapa').innerHTML = '<p class="small muted">' + C.inteiro(linhas.length) + ' linhas encontradas. Confira qual coluna é cada campo:</p><div class="grade3">' +
        Object.keys(MAPA_COLS).map(function (k) { return '<div class="campo"><label>' + k.charAt(0).toUpperCase() + k.slice(1) + '</label><select class="inp" data-k="' + k + '">' + ops(mapa[k]) + '</select></div>'; }).join('') + '</div>' +
        '<div class="grade2"><div class="campo"><label>Adicionar tag em todos (opcional)</label><input class="inp" id="i-tag" placeholder="Ex.: Lista antiga"></div>' +
        '<div class="campo"><label>Origem padrão</label><input class="inp" id="i-origem" value="Importação"></div></div><div id="i-res"></div>';
      C.$$('[data-k]', el).forEach(function (s) { s.onchange = function () { mapa[s.dataset.k] = Number(s.value); }; });
      el.querySelector('#i-sim').disabled = false; el.querySelector('#i-ok').disabled = false;
    }
    var montar = function () {
      return linhas.map(function (r) {
        var o = {};
        Object.keys(mapa).forEach(function (k) { if (mapa[k] >= 0) o[k] = String(r[mapa[k]] || '').trim(); });
        return o;
      });
    };
    var enviar = function (simular) {
      return function () {
        var btn = this;
        C.comBotao(btn, function () {
          if (mapa.telefone < 0 && mapa.email < 0) throw new Error('Escolha a coluna de telefone ou de e-mail.');
          return C.api('contato.importar', { linhas: montar(), tags: el.querySelector('#i-tag').value, origem: el.querySelector('#i-origem').value, simular: simular }).then(function (r) {
            var txt = '<b>' + r.novos + '</b> novos, <b>' + r.atualizados + '</b> já existiam e serão atualizados, <b>' + r.ignorados + '</b> sem telefone nem e-mail.';
            if (simular) { el.querySelector('#i-res').innerHTML = '<div class="aviso ok">' + ic('check') + '<div>' + txt + '</div></div>'; return; }
            C.toast('Importação concluída: ' + r.novos + ' novos', 'ok');
            el.fechar();
            return C.recarregar();
          });
        });
      };
    };
    el.querySelector('#i-sim').onclick = enviar(true);
    el.querySelector('#i-ok').onclick = enviar(false);
  }

  /* --------------------------------------------------------- form contato */
  C.formContato = function (c, depois) {
    c = c || {};
    var cp = C.json(c.campos, {});
    var campos = S.config.campos || [];
    var el = C.modal({
      titulo: c.id ? 'Editar contato' : 'Novo contato', tamanho: 'largo',
      corpo: '<div class="grade2">' +
        '<div class="campo"><label>Nome</label><input class="inp" id="c-nome" value="' + esc(c.nome) + '"></div>' +
        '<div class="campo"><label>WhatsApp / telefone</label><input class="inp" id="c-tel" inputmode="tel" placeholder="(11) 99999-9999" value="' + esc(c.telefone ? C.tel(c.telefone) : '') + '"></div>' +
        '<div class="campo"><label>E-mail</label><input class="inp" id="c-email" type="email" value="' + esc(c.email) + '"></div>' +
        '<div class="campo"><label>Empresa</label><input class="inp" id="c-empresa" value="' + esc(c.empresa) + '"></div>' +
        '<div class="campo"><label>Cargo</label><input class="inp" id="c-cargo" value="' + esc(c.cargo) + '"></div>' +
        '<div class="campo"><label>Cidade</label><input class="inp" id="c-cidade" value="' + esc(c.cidade) + '"></div>' +
        '<div class="campo"><label>Origem</label><input class="inp" id="c-origem" list="l-origens" value="' + esc(c.origem || '') + '"><datalist id="l-origens">' + (S.config.origens || []).map(function (o) { return '<option value="' + esc(o) + '">'; }).join('') + '</datalist></div>' +
        '<div class="campo"><label>Status</label><select class="inp" id="c-status">' + [['lead', 'Lead'], ['cliente', 'Cliente'], ['inativo', 'Inativo']].map(function (s) { return '<option value="' + s[0] + '"' + ((c.status || 'lead') === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></div>' +
        (C.pode('todos') ? '<div class="campo"><label>Responsável</label><select class="inp" id="c-resp"><option value="">Ninguém</option>' + S.usuarios.filter(function (u) { return u.ativo === 'SIM'; }).map(function (u) { return '<option value="' + u.id + '"' + (c.responsavel_id === u.id ? ' selected' : '') + '>' + esc(u.nome) + '</option>'; }).join('') + '</select></div>' : '') +
        campos.map(function (f) { return '<div class="campo"><label>' + esc(f.rotulo) + '</label><input class="inp" data-cp="' + esc(f.chave) + '" type="' + (f.tipo === 'data' ? 'date' : f.tipo === 'numero' ? 'number' : 'text') + '" value="' + esc(cp[f.chave] || '') + '"></div>'; }).join('') +
        '</div><div class="campo"><label>Tags</label><div id="c-tags"></div></div>' +
        '<div class="campo"><label>Observações</label><textarea class="inp" id="c-notas">' + esc(c.notas || '') + '</textarea></div>',
      pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="c-ok" data-carregando=" Salvando...">Salvar</button>'
    });
    var tg = C.campoTags(el.querySelector('#c-tags'), C.tags(c.tags), C.todasTags());
    el.querySelector('#c-ok').onclick = function () {
      C.comBotao(this, function () {
        var novos = {};
        C.$$('[data-cp]', el).forEach(function (i) { novos[i.dataset.cp] = i.value; });
        var d = {
          id: c.id, nome: el.querySelector('#c-nome').value, telefone: el.querySelector('#c-tel').value, email: el.querySelector('#c-email').value,
          empresa: el.querySelector('#c-empresa').value, cargo: el.querySelector('#c-cargo').value, cidade: el.querySelector('#c-cidade').value,
          origem: el.querySelector('#c-origem').value || 'Manual', status: el.querySelector('#c-status').value, tags: tg.valor(),
          notas: el.querySelector('#c-notas').value, campos: Object.assign(cp, novos)
        };
        if (el.querySelector('#c-resp')) d.responsavel_id = el.querySelector('#c-resp').value;
        return C.api('contato.salvar', { contato: d }).then(function (salvo) {
          var i = S.contatos.findIndex(function (x) { return x.id === salvo.id; });
          if (i >= 0) S.contatos[i] = salvo; else S.contatos.push(salvo);
          C.toast('Contato salvo', 'ok');
          el.fechar();
          if (depois) depois(salvo);
        });
      });
    };
  };

  /* ---------------------------------------------------------- ficha (gaveta) */
  C.abrirContato = function (id) {
    C.$$('.gaveta,.gaveta-bg').forEach(function (x) { x.remove(); });
    var bg = document.createElement('div'); bg.className = 'gaveta-bg';
    var g = document.createElement('aside'); g.className = 'gaveta';
    g.innerHTML = '<div style="display:grid;place-items:center;height:100%"><span class="spin" style="width:26px;height:26px;color:var(--pri)"></span></div>';
    document.body.appendChild(bg); document.body.appendChild(g);
    document.body.style.overflow = 'hidden';
    var fechar = function () { g.remove(); bg.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', esc1); };
    var esc1 = function (e) { if (e.key === 'Escape' && !C.$('.modal-bg')) fechar(); };
    document.addEventListener('keydown', esc1);
    bg.onclick = fechar;
    var aba = 'resumo';
    var dados = null;
    var carregar = function () {
      return C.api('contato.ver', { id: id }).then(function (d) { dados = d; pintar(); }).catch(function (e) { C.toast(e.message, 'erro'); fechar(); });
    };
    var pintar = function () {
      var c = dados.contato, cp = C.json(c.campos, {});
      var u = C.usuario(c.responsavel_id);
      var campos = S.config.campos || [];
      var h = '<div class="modal-cab">' + C.av(c.nome, 'gde') + '<div class="trunc"><h2 class="trunc">' + esc(c.nome) + '</h2><div class="small muted">' + esc(C.tel(c.telefone)) + (c.ig_usuario ? (c.telefone ? ' · ' : '') + '@' + esc(c.ig_usuario) : '') + (c.email ? ' · ' + esc(c.email) : '') + '</div></div><button class="btn fantasma ic peq x" data-x aria-label="Fechar">' + ic('x') + '</button></div>' +
        '<div style="display:flex;gap:8px;padding:12px 20px;border-bottom:1px solid var(--borda);flex-wrap:wrap">' +
        (c.telefone || c.ig_id ? '<button class="btn verde peq" data-f="conversa">' + ic(c.canal === 'instagram' ? 'instagram' : 'conversas') + ' Conversa</button>' : '') +
        (C.pode('passar') ? '<button class="btn peq acc" data-f="passar">' + ic('passar') + ' Passar para closer</button>' : '') +
        '<button class="btn peq" data-f="editar">' + ic('lapis') + ' Editar</button><button class="btn peq" data-f="negocio">' + ic('plus') + ' Negócio</button><button class="btn peq" data-f="tarefa">' + ic('plus') + ' Tarefa</button>' +
        (C.pode('automacoes') ? '<button class="btn peq" data-f="automacao">' + ic('automacoes') + ' Automação</button>' : '') +
        (C.pode('excluir') ? '<button class="btn peq perigo" data-f="excluir" style="margin-left:auto" aria-label="Excluir contato">' + ic('lixo') + '</button>' : '') + '</div>' +
        '<div style="padding:0 20px"><div class="abas" style="margin:0">' + [['resumo', 'Resumo'], ['historico', 'Histórico']].map(function (a) { return '<button data-aba="' + a[0] + '" class="' + (aba === a[0] ? 'on' : '') + '">' + a[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="modal-corpo" style="flex:1">';
      if (aba === 'resumo') {
        h += '<div class="chips" style="margin-bottom:14px"><span class="status st-' + c.status + '">' + ({ lead: 'Lead', cliente: 'Cliente', inativo: 'Inativo' }[c.status] || '') + '</span>' + C.tags(c.tags).map(function (t) { return '<span class="chip">' + ic('tag') + esc(t) + '</span>'; }).join('') +
          (c.optout === 'SIM' ? '<span class="status st-erro">Não recebe mensagens automáticas</span>' : '') + (c.email_optout === 'SIM' ? '<span class="status st-erro">Não recebe e-mails</span>' : '') + (c.ultima_visita ? '<span class="chip">' + ic('olho') + 'Visitou o site ' + C.rel(c.ultima_visita) + '</span>' : '') + '</div>';
        h += '<div class="grade2">' + [['empresa', 'predio', c.empresa], ['cidade', 'mapa', c.cidade], ['origem', 'bandeira', 'Origem: ' + (c.origem || '—')], ['resp', 'equipe', 'Responsável: ' + (u ? u.nome : 'ninguém')], ['sdr', 'passar', c.sdr_id && C.usuario(c.sdr_id) ? 'SDR: ' + C.usuario(c.sdr_id).nome : ''], ['pontos', 'estrela', C.num(c.pontos) ? 'Pontuação: ' + C.num(c.pontos) : ''], ['criado', 'calendario', 'Desde ' + C.fmtData(c.criado_em, false)], ['cargo', 'nota', c.cargo]]
          .filter(function (x) { return x[2]; }).map(function (x) { return '<div class="dado">' + ic(x[1]) + '<span class="trunc">' + esc(x[2]) + '</span></div>'; }).join('') + '</div>';
        if (campos.length) h += '<h4 class="rot" style="margin:16px 0 6px">Campos personalizados</h4><div class="grade2">' + campos.map(function (f) { return '<div class="dado"><span class="fraco">' + esc(f.rotulo) + ':</span> <span class="trunc">' + esc(cp[f.chave] || '—') + '</span></div>'; }).join('') + '</div>';
        var extras = Object.keys(cp).filter(function (k) { return !campos.some(function (f) { return f.chave === k; }); });
        if (extras.length) h += '<h4 class="rot" style="margin:16px 0 6px">Outras informações</h4><div class="grade2">' + extras.map(function (k) { return '<div class="dado"><span class="fraco">' + esc(k) + ':</span> <span class="trunc">' + esc(cp[k]) + '</span></div>'; }).join('') + '</div>';
        if (c.notas) h += '<h4 class="rot" style="margin:16px 0 6px">Observações</h4><p style="margin:0;white-space:pre-wrap">' + esc(c.notas) + '</p>';
        h += '<h4 class="rot" style="margin:20px 0 8px">Negócios</h4>' + (dados.negocios.length ? dados.negocios.map(function (n) {
          var et = C.etapa(n.etapa_id);
          return '<div class="card" style="padding:10px 12px;margin-bottom:8px;display:flex;gap:10px;align-items:center;cursor:pointer" data-neg="' + n.id + '"><span class="col-cab"><span class="bol" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + esc(et ? et.cor : '#999') + '"></span></span><div class="trunc" style="flex:1"><b>' + esc(n.titulo) + '</b><div class="small muted">' + esc(et ? et.nome : '') + ' · ' + C.brl(n.valor) + (n.reuniao_em ? ' · reunião ' + C.fmtData(n.reuniao_em) + ' (' + ({ agendada: 'marcada', realizada: 'realizada', no_show: 'faltou', cancelada: 'cancelada' }[n.reuniao_status] || '') + ')' : '') + '</div></div>' + (n.reuniao_em && n.reuniao_status === 'agendada' ? '<button class="btn peq" data-reuniao="' + n.id + '">' + ic('calendario') + '</button>' : '') + '<span class="status ' + (n.status === 'ganho' ? 'st-on' : n.status === 'perdido' ? 'st-erro' : 'st-lead') + '">' + n.status + '</span></div>';
        }).join('') : '<p class="small muted" style="margin:0">Nenhum negócio.</p>');
        h += '<div id="fc-box"></div>';
        var tars = dados.tarefas.filter(function (t) { return t.feita !== 'SIM'; });
        h += '<h4 class="rot" style="margin:20px 0 8px">Tarefas abertas</h4>' + (tars.length ? '<div class="card">' + tars.map(linhaTarefa).join('') + '</div>' : '<p class="small muted" style="margin:0">Nenhuma tarefa aberta.</p>');
        var ativas = dados.execucoes.filter(function (e) { return /esperando|rodando/.test(e.status); });
        if (ativas.length) h += '<h4 class="rot" style="margin:20px 0 8px">Em automação</h4>' + ativas.map(function (e) { var a = S.automacoes.filter(function (x) { return x.id === e.automacao_id; })[0]; return '<div class="dado">' + ic('robo') + esc(a ? a.nome : e.automacao_id) + ' <span class="status st-aviso">' + (e.status === 'esperando_resposta' ? 'esperando resposta' : 'aguardando tempo') + '</span></div>'; }).join('');
      } else {
        h += '<div class="campo"><label>Nova anotação</label><textarea class="inp" id="h-nota" placeholder="Ex.: Ligou pedindo desconto, retornar sexta"></textarea></div><button class="btn peq" id="h-salvar" data-carregando=" Salvando...">Salvar anotação</button>';
        h += '<div style="margin-top:18px">' + (dados.historico.length ? dados.historico.map(function (x) {
          return '<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--borda)"><div class="small muted nowrap" style="width:84px">' + C.fmtData(x.data) + '</div><div style="flex:1;min-width:0"><b class="small">' + esc(rotuloAcao(x.acao)) + '</b> <span class="small muted">por ' + esc(x.usuario_nome) + '</span>' + (x.detalhe ? '<div style="white-space:pre-wrap;font-size:13.5px">' + esc(x.detalhe) + '</div>' : '') + '</div></div>';
        }).join('') : '<p class="muted">Sem histórico ainda.</p>') + '</div>';
        if (S.config.arquivo) h += '<div id="h-arq" style="margin-top:14px">' + (dados.arq || []).map(function (a) { return '<h4 class="rot" style="margin:16px 0 6px">' + ic('arquivo') + ' ' + esc(a.nome_mes || a.mes) + ' (arquivo)</h4>' + a.historico.slice().reverse().map(function (x) { return '<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--borda)"><div class="small muted nowrap" style="width:84px">' + C.fmtData(x.data) + '</div><div class="small"><b>' + esc(rotuloAcao(x.acao)) + '</b> ' + esc(x.detalhe || '') + '</div></div>'; }).join('') + a.negocios.map(function (n) { return '<div class="dado small">' + ic('negocios') + esc(n.titulo) + ' · ' + C.brl(n.valor) + ' · ' + esc(n.status) + '</div>'; }).join(''); }).join('') + (dados.arqFim ? '<p class="small muted">Não há mais meses arquivados para este contato.</p>' : '<button class="btn peq" id="h-mais" data-carregando=" Buscando...">' + ic('arquivo') + ' Ver meses anteriores</button>') + '</div>';
      }
      h += '</div>';
      g.innerHTML = h;
      g.querySelector('[data-x]').onclick = fechar;
      C.$$('[data-aba]', g).forEach(function (b) { b.onclick = function () { aba = b.dataset.aba; pintar(); }; });
      C.$$('[data-neg]', g).forEach(function (b) { b.onclick = function () { C.formNegocio(dados.negocios.filter(function (n) { return n.id === b.dataset.neg; })[0], function () { carregar(); }); }; });
      ligarTarefas(g, carregar);
      var fcb = g.querySelector('#fc-box'); if (fcb) C.financeiroDoContato(fcb, c, carregar);
      C.$$('[data-reuniao]', g).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); C.acoesReuniao(dados.negocios.filter(function (n) { return n.id === b.dataset.reuniao; })[0], carregar); }; });
      var hm = g.querySelector('#h-mais');
      if (hm) hm.onclick = function () {
        C.comBotao(hm, function () {
          return C.api('arquivo.contato', { contato_id: c.id, antes_de: dados.arqAntes || '' }).then(function (r) {
            if (r.historico.length || r.negocios.length) dados.arq = (dados.arq || []).concat([r]);
            dados.arqAntes = r.mes; dados.arqFim = !r.mais;
            if (!r.historico.length && !r.negocios.length && r.mais) C.toast('Nada nos meses buscados. Clique de novo para ir mais para trás.');
            pintar();
          });
        });
      };
      var acoes = {
        passar: function () { C.passarLead(c, function () { carregar(); C.recarregar(); }); },
        conversa: function () { fechar(); C.abrirConversa(c.id); },
        editar: function () { C.formContato(c, function () { carregar(); if (S.view === 'contatos') pintarLista(); }); },
        negocio: function () { C.formNegocio({ contato_id: c.id }, function () { carregar(); }); },
        tarefa: function () { C.formTarefa({ contato_id: c.id }, function () { carregar(); }); },
        automacao: function () {
          C.pedirTexto('Iniciar automação para ' + C.primeiroNome(c.nome), 'Automação', '', { opcoes: S.automacoes.map(function (a) { return [a.id, a.nome + (a.ativo === 'SIM' ? '' : ' (desativada)')]; }), botao: 'Iniciar' }).then(function (aid) {
            if (!aid) return;
            return C.api('automacao.testar', { id: aid, contato_id: c.id }).then(function (r) { C.toast(r.ok ? 'Automação iniciada' : 'Não foi possível iniciar (contato sem telefone ou fluxo vazio)', r.ok ? 'ok' : 'erro'); carregar(); });
          }).catch(function (e) { C.toast(e.message, 'erro'); });
        },
        excluir: function () {
          C.confirmar('Excluir <b>' + esc(c.nome) + '</b>?', { perigo: true, botao: 'Excluir' }).then(function (ok) {
            if (!ok) return;
            return C.api('contato.excluir', { id: c.id }).then(function () { S.contatos = S.contatos.filter(function (x) { return x.id !== c.id; }); fechar(); C.toast('Contato excluído', 'ok'); C.render(); });
          }).catch(function (e) { C.toast(e.message, 'erro'); });
        }
      };
      C.$$('[data-f]', g).forEach(function (b) { b.onclick = acoes[b.dataset.f]; });
      var hs = g.querySelector('#h-salvar');
      if (hs) hs.onclick = function () {
        var t = g.querySelector('#h-nota').value.trim();
        if (!t) return;
        C.comBotao(hs, function () { return C.api('contato.nota', { id: c.id, texto: t }).then(carregar); });
      };
    };
    carregar();
  };
  function rotuloAcao(a) {
    return { email_enviado: 'E-mail enviado', email_aberto: 'Abriu e-mail', email_clicou: 'Clicou no e-mail', email_descadastro: 'Saiu da lista de e-mails', visitou: 'Visitou o site', passado: 'Passado para closer', reuniao: 'Reunião', compra: 'Venda', comentario: 'Comentou no Instagram', integracao: 'Integração', arquivo: 'Arquivo mensal', contato_criado: 'Contato criado', contato_atualizado: 'Dados atualizados', tag: 'Tag', nota: 'Anotação', negocio_criado: 'Negócio criado', etapa: 'Mudou de etapa', tarefa: 'Tarefa criada', automacao: 'Automação', automacao_erro: 'Erro na automação', optout: 'Saiu da lista', atribuido: 'Atribuído', importacao: 'Importação' }[a] || a;
  }

  /* ============================================================= NEGÓCIOS */
  var funilAtual = null;
  var verFechados = false;
  C.views.negocios = {
    titulo: 'Negócios',
    acoes: function () { return '<button class="btn pri" data-a="novo">' + ic('plus') + '<span class="txt"> Novo negócio</span></button>'; },
    ligarAcoes: function (el) { el.querySelector('[data-a=novo]').onclick = function () { C.formNegocio({ funil_id: funilAtual }, function () { C.render(); }); }; },
    render: function (el) {
      if (!S.funis.length) { el.innerHTML = '<div class="vazio">Nenhum funil configurado.</div>'; return; }
      if (!C.funil(funilAtual)) funilAtual = S.funis[0].id;
      var f = C.funil(funilAtual);
      var lim = C.diasAtras(30);
      var negs = S.negocios.filter(function (n) { return n.funil_id === f.id && (n.status === 'aberto' || verFechados || (n.fechado_em || '').slice(0, 10) >= lim); });
      var total = negs.filter(function (n) { return n.status === 'aberto'; }).reduce(function (s, n) { return s + C.num(n.valor); }, 0);
      el.innerHTML = '<div class="barra-ferr">' + (S.funis.length > 1 ? '<div class="seg">' + S.funis.map(function (x) { return '<button data-fu="' + x.id + '" class="' + (x.id === f.id ? 'on' : '') + '">' + esc(x.nome) + '</button>'; }).join('') + '</div>' : '<b>' + esc(f.nome) + '</b>') +
        '<span class="muted small">' + C.brl(total) + ' em aberto</span><label class="check" style="margin:0 0 0 auto"><input type="checkbox" id="k-fech"' + (verFechados ? ' checked' : '') + '> Mostrar fechados antigos</label></div>' +
        '<div class="kanban">' + f.etapas.map(function (e) {
          var ns = negs.filter(function (n) { return n.etapa_id === e.id; }).sort(function (a, b) { return a.atualizado_em < b.atualizado_em ? 1 : -1; });
          return '<div class="col"><div class="col-cab"><div class="t"><span class="bol" style="background:' + esc(e.cor) + '"></span>' + esc(e.nome) + '<span class="fraco" style="margin-left:auto;font-weight:600">' + ns.length + '</span></div><div class="s">' + C.brl(ns.reduce(function (s, n) { return s + C.num(n.valor); }, 0)) + '</div></div>' +
            '<div class="col-cards" data-etapa="' + e.id + '">' + ns.map(cardNeg).join('') + '</div></div>';
        }).join('') + '</div>';
      C.$$('[data-fu]', el).forEach(function (b) { b.onclick = function () { funilAtual = b.dataset.fu; C.render(); }; });
      C.$('#k-fech').onchange = function () { verFechados = this.checked; C.render(); };
      ligarKanban(el);
    }
  };
  function cardNeg(n) {
    var c = C.contato(n.contato_id), u = C.usuario(n.responsavel_id);
    var parado = Math.round((Date.now() - (C.data(n.atualizado_em) || new Date()).getTime()) / 86400000);
    var reu = n.reuniao_em && n.reuniao_status === 'agendada' ? '<div class="small reu-badge">' + ic('calendario') + ' ' + C.fmtData(n.reuniao_em) + '</div>' : n.reuniao_status === 'no_show' ? '<div class="small reu-badge falta">' + ic('alerta') + ' Faltou na reunião</div>' : '';
    var sdr = n.sdr_id && C.usuario(n.sdr_id);
    return '<div class="neg" draggable="true" data-neg="' + n.id + '"><b>' + esc(n.titulo) + '</b><div class="small muted trunc">' + esc(c ? c.nome : '') + (sdr ? ' · SDR ' + esc(C.primeiroNome(sdr.nome)) : '') + '</div>' + reu +
      '<div class="r"><span class="v">' + C.brl(n.valor) + '</span><span style="display:flex;gap:6px;align-items:center">' + (n.status === 'aberto' && parado >= 7 ? '<span class="status st-aviso" title="Sem movimento">' + parado + 'd</span>' : '') + (u ? C.av(u.nome, 'peq', u.cor) : '') + '</span></div></div>';
  }
  function ligarKanban(el) {
    var arrastando = null;
    C.$$('.neg', el).forEach(function (card) {
      card.addEventListener('dragstart', function (e) { arrastando = card.dataset.neg; card.classList.add('arrastando'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', arrastando); } catch (x) { /* nada */ } });
      card.addEventListener('dragend', function () { card.classList.remove('arrastando'); });
      card.addEventListener('click', function () { var n = S.negocios.filter(function (x) { return x.id === card.dataset.neg; })[0]; C.formNegocio(n, function () { C.render(); }); });
    });
    C.$$('.col-cards', el).forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('sobre'); });
      col.addEventListener('dragleave', function () { col.classList.remove('sobre'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault(); col.classList.remove('sobre');
        var n = S.negocios.filter(function (x) { return x.id === arrastando; })[0];
        if (!n || n.etapa_id === col.dataset.etapa) return;
        moverNeg(n, col.dataset.etapa);
      });
    });
  }
  function moverNeg(n, etapaId) {
    var et = C.etapa(etapaId);
    var motivo = Promise.resolve('');
    if (et.tipo === 'perdido') motivo = C.pedirTexto('Por que perdeu?', 'Motivo', '', { opcoes: (S.config.motivos_perda || ['Outro']).map(function (m) { return [m, m]; }), botao: 'Marcar como perdido' });
    motivo.then(function (m) {
      if (m === null) return;
      var antes = n.etapa_id;
      n.etapa_id = etapaId; n.status = et.tipo === 'ganho' ? 'ganho' : et.tipo === 'perdido' ? 'perdido' : 'aberto';
      n.atualizado_em = C.isoLocal(); if (n.status !== 'aberto') n.fechado_em = C.isoLocal();
      C.render();
      return C.api('negocio.mover', { id: n.id, etapa_id: etapaId, motivo: m }).then(function (r) {
        Object.assign(n, r);
        if (r.status === 'ganho') C.toast('Negócio ganho. Parabéns!', 'ok');
      }).catch(function (e) { n.etapa_id = antes; C.render(); throw e; });
    }).catch(function (e) { C.toast(e.message, 'erro'); });
  }

  C.formNegocio = function (n, depois) {
    n = n || {};
    var f = C.funil(n.funil_id) || S.funis[0];
    var opsEtapas = function (fid) { var ff = C.funil(fid); return ff ? ff.etapas.map(function (e) { return '<option value="' + e.id + '"' + (n.etapa_id === e.id ? ' selected' : '') + '>' + esc(e.nome) + '</option>'; }).join('') : ''; };
    var contatosOps = S.contatos.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    var c0 = C.contato(n.contato_id);
    var el = C.modal({
      titulo: n.id ? 'Negócio' : 'Novo negócio',
      corpo: '<div class="campo"><label>Contato</label>' + (n.id || c0 ? '<input class="inp" readonly value="' + esc(c0 ? c0.nome : '') + '">' :
        '<input class="inp" id="n-busca" list="n-contatos" placeholder="Digite o nome do contato"><datalist id="n-contatos">' + contatosOps.map(function (c) { return '<option value="' + esc(c.nome + ' · ' + C.tel(c.telefone)) + '">'; }).join('') + '</datalist>') + '</div>' +
        '<div class="campo"><label>Título</label><input class="inp" id="n-titulo" value="' + esc(n.titulo || '') + '" placeholder="Ex.: Pacote mensal"></div>' +
        '<div class="grade2"><div class="campo"><label>Valor (R$)</label><input class="inp" id="n-valor" inputmode="decimal" value="' + (n.valor ? C.num(n.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '') + '"></div>' +
        '<div class="campo"><label>Previsão de fechamento</label><input class="inp" type="date" id="n-prev" value="' + esc(n.previsao || '') + '"></div>' +
        '<div class="campo"><label>Funil</label><select class="inp" id="n-funil">' + S.funis.map(function (x) { return '<option value="' + x.id + '"' + (x.id === f.id ? ' selected' : '') + '>' + esc(x.nome) + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label>Etapa</label><select class="inp" id="n-etapa">' + opsEtapas(f.id) + '</select></div>' +
        '<div class="campo"><label>Responsável</label><select class="inp" id="n-resp">' + S.usuarios.filter(function (u) { return u.ativo === 'SIM'; }).map(function (u) { return '<option value="' + u.id + '"' + ((n.responsavel_id || S.user.id) === u.id ? ' selected' : '') + '>' + esc(u.nome) + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="campo"><label>Anotações</label><textarea class="inp" id="n-notas">' + esc(n.notas || '') + '</textarea></div>' +
        (n.status === 'perdido' && n.motivo_perda ? '<div class="aviso erro">' + ic('info') + '<div>Perdido: ' + esc(n.motivo_perda) + '</div></div>' : ''),
      pe: (n.id && C.pode('excluir') ? '<button class="btn perigo esq" id="n-exc">' + ic('lixo') + '</button>' : '') + '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="n-ok" data-carregando=" Salvando...">Salvar</button>'
    });
    el.querySelector('#n-funil').onchange = function () { el.querySelector('#n-etapa').innerHTML = opsEtapas(this.value); };
    el.querySelector('#n-ok').onclick = function () {
      C.comBotao(this, function () {
        var cid = n.contato_id;
        if (!cid) {
          var v = el.querySelector('#n-busca').value;
          var achado = contatosOps.filter(function (c) { return v === c.nome + ' · ' + C.tel(c.telefone) || C.norm(v) === C.norm(c.nome); })[0];
          if (!achado) throw new Error('Escolha um contato da lista (ou cadastre o contato antes).');
          cid = achado.id;
        }
        var d = { id: n.id, contato_id: cid, titulo: el.querySelector('#n-titulo').value, valor: el.querySelector('#n-valor').value, previsao: el.querySelector('#n-prev').value, funil_id: el.querySelector('#n-funil').value, etapa_id: el.querySelector('#n-etapa').value, responsavel_id: el.querySelector('#n-resp').value, notas: el.querySelector('#n-notas').value };
        return C.api('negocio.salvar', { negocio: d }).then(function () {
          el.fechar(); C.toast('Negócio salvo', 'ok');
          return C.api('bootstrap').then(function (b) { C.aplicarDados(b); if (depois) depois(); });
        });
      });
    };
    var ex = el.querySelector('#n-exc');
    if (ex) ex.onclick = function () {
      C.confirmar('Excluir este negócio?', { perigo: true, botao: 'Excluir' }).then(function (ok) {
        if (!ok) return;
        return C.api('negocio.excluir', { id: n.id }).then(function () { S.negocios = S.negocios.filter(function (x) { return x.id !== n.id; }); el.fechar(); if (depois) depois(); });
      }).catch(function (e) { C.toast(e.message, 'erro'); });
    };
  };

  /* ============================================================== TAREFAS */
  var TIPOS_TAREFA = { whatsapp: ['conversas', 'WhatsApp'], ligacao: ['fone', 'Ligação'], reuniao: ['calendario', 'Reunião'], email: ['email', 'E-mail'], outro: ['tarefas', 'Outro'] };
  function linhaTarefa(t) {
    var c = C.contato(t.contato_id);
    var atrasada = t.feita !== 'SIM' && t.vence_em && t.vence_em < C.isoLocal();
    var tp = TIPOS_TAREFA[t.tipo] || TIPOS_TAREFA.outro;
    return '<div style="display:flex;gap:10px;align-items:center;padding:10px 16px;border-bottom:1px solid #F1F5F9">' +
      '<input type="checkbox" data-feita="' + t.id + '"' + (t.feita === 'SIM' ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--pri)" aria-label="Concluir">' +
      '<div style="flex:1;min-width:0;cursor:pointer" data-tarefa="' + t.id + '"><div class="trunc" style="' + (t.feita === 'SIM' ? 'text-decoration:line-through;color:var(--txt-3)' : '') + '">' + ic(tp[0]) + ' ' + esc(t.titulo) + '</div>' +
      '<div class="small ' + (atrasada ? '' : 'muted') + '" style="' + (atrasada ? 'color:var(--vermelho);font-weight:600' : '') + '">' + (t.vence_em ? C.fmtData(t.vence_em) : 'sem prazo') + (c ? ' · ' + esc(c.nome) : '') + '</div></div></div>';
  }
  function ligarTarefas(raiz, depois) {
    C.$$('[data-feita]', raiz).forEach(function (cb) {
      cb.onchange = function () {
        var t = S.tarefas.filter(function (x) { return x.id === cb.dataset.feita; })[0];
        if (t) t.feita = cb.checked ? 'SIM' : 'NAO';
        C.api('tarefa.feita', { id: cb.dataset.feita, feita: cb.checked ? 'SIM' : 'NAO' }).then(function () { C.renderNav(); if (depois) setTimeout(depois, 300); }).catch(function (e) { C.toast(e.message, 'erro'); });
      };
    });
    C.$$('[data-tarefa]', raiz).forEach(function (d) {
      d.onclick = function () { var t = S.tarefas.filter(function (x) { return x.id === d.dataset.tarefa; })[0]; if (t) C.formTarefa(t, depois); };
    });
  }
  C.formTarefa = function (t, depois) {
    t = t || {};
    var c0 = C.contato(t.contato_id);
    var amanha = C.isoLocal(new Date(Date.now() + 86400000)).slice(0, 10) + 'T09:00';
    var el = C.modal({
      titulo: t.id ? 'Tarefa' : 'Nova tarefa',
      corpo: '<div class="campo"><label>O que precisa ser feito</label><input class="inp" id="t-tit" value="' + esc(t.titulo || '') + '"></div>' +
        '<div class="grade2"><div class="campo"><label>Tipo</label><select class="inp" id="t-tipo">' + Object.keys(TIPOS_TAREFA).map(function (k) { return '<option value="' + k + '"' + (t.tipo === k ? ' selected' : '') + '>' + TIPOS_TAREFA[k][1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label>Prazo</label><input class="inp" type="datetime-local" id="t-vence" value="' + esc((t.vence_em || amanha).slice(0, 16)) + '"></div>' +
        '<div class="campo"><label>Responsável</label><select class="inp" id="t-resp">' + S.usuarios.filter(function (u) { return u.ativo === 'SIM'; }).map(function (u) { return '<option value="' + u.id + '"' + ((t.responsavel_id || S.user.id) === u.id ? ' selected' : '') + '>' + esc(u.nome) + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label>Contato</label><input class="inp" readonly value="' + esc(c0 ? c0.nome : 'Nenhum') + '"></div></div>' +
        '<div class="campo"><label>Detalhes</label><textarea class="inp" id="t-notas">' + esc(t.notas || '') + '</textarea></div>',
      pe: (t.id ? '<button class="btn perigo esq" id="t-exc">' + ic('lixo') + '</button>' : '') + '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="t-ok" data-carregando=" Salvando...">Salvar</button>'
    });
    el.querySelector('#t-ok').onclick = function () {
      C.comBotao(this, function () {
        var d = { id: t.id, titulo: el.querySelector('#t-tit').value, tipo: el.querySelector('#t-tipo').value, vence_em: el.querySelector('#t-vence').value ? el.querySelector('#t-vence').value + ':00' : '', responsavel_id: el.querySelector('#t-resp').value, contato_id: t.contato_id || '', negocio_id: t.negocio_id || '', notas: el.querySelector('#t-notas').value, feita: t.feita };
        return C.api('tarefa.salvar', { tarefa: d }).then(function (r) {
          var i = S.tarefas.findIndex(function (x) { return x.id === r.id; });
          if (i >= 0) S.tarefas[i] = Object.assign(S.tarefas[i], r); else S.tarefas.push(r);
          el.fechar(); C.toast('Tarefa salva', 'ok'); C.renderNav();
          if (depois) depois();
        });
      });
    };
    var ex = el.querySelector('#t-exc');
    if (ex) ex.onclick = function () {
      C.api('tarefa.excluir', { id: t.id }).then(function () { S.tarefas = S.tarefas.filter(function (x) { return x.id !== t.id; }); el.fechar(); C.renderNav(); if (depois) depois(); }).catch(function (e) { C.toast(e.message, 'erro'); });
    };
  };

  var filtroT = 'abertas', pessoaT = '';
  C.views.tarefas = {
    titulo: 'Tarefas',
    acoes: function () { return '<button class="btn pri" data-a="nova">' + ic('plus') + '<span class="txt"> Nova tarefa</span></button>'; },
    ligarAcoes: function (el) { el.querySelector('[data-a=nova]').onclick = function () { C.formTarefa({}, function () { C.render(); }); }; },
    render: function (el) {
      var agora = C.isoLocal(), hoje = C.hoje();
      // cada pessoa vê as próprias tarefas; quem gerencia escolhe de quem ver
      if (!pessoaT || !C.pode('todos')) pessoaT = S.user.id;
      var minhas = S.tarefas.filter(function (t) { return pessoaT === '_todas' || t.responsavel_id === pessoaT || (!t.responsavel_id && pessoaT === S.user.id); });
      var grupos = {
        abertas: [['Atrasadas', minhas.filter(function (t) { return t.feita !== 'SIM' && t.vence_em && t.vence_em < agora; })],
        ['Hoje', minhas.filter(function (t) { return t.feita !== 'SIM' && t.vence_em >= agora && t.vence_em.slice(0, 10) === hoje; })],
        ['Próximas', minhas.filter(function (t) { return t.feita !== 'SIM' && (!t.vence_em || t.vence_em.slice(0, 10) > hoje); })]],
        feitas: [['Concluídas', minhas.filter(function (t) { return t.feita === 'SIM'; }).slice(-100).reverse()]]
      }[filtroT];
      el.innerHTML = '<div class="barra-ferr"><div class="seg"><button data-ft="abertas" class="' + (filtroT === 'abertas' ? 'on' : '') + '">Abertas</button><button data-ft="feitas" class="' + (filtroT === 'feitas' ? 'on' : '') + '">Concluídas</button></div>' +
        (C.pode('todos') ? '<select class="inp" id="t-pessoa" style="max-width:240px" aria-label="Tarefas de"><option value="' + S.user.id + '">Minhas tarefas</option>' + S.usuarios.filter(function (u) { return u.id !== S.user.id && u.ativo === 'SIM'; }).map(function (u) { return '<option value="' + u.id + '"' + (pessoaT === u.id ? ' selected' : '') + '>Tarefas de ' + esc(u.nome) + '</option>'; }).join('') + '<option value="_todas"' + (pessoaT === '_todas' ? ' selected' : '') + '>Toda a equipe</option></select>' : '') + '</div>' +
        grupos.map(function (g) {
          var l = g[1].sort(function (a, b) { return (a.vence_em || '9') < (b.vence_em || '9') ? -1 : 1; });
          return '<div class="card" style="margin-bottom:14px"><div class="card-cab"><h3>' + g[0] + '</h3><span class="acoes small muted">' + l.length + '</span></div>' + (l.length ? l.map(linhaTarefa).join('') : '<div class="small muted" style="padding:14px 16px">Nada aqui.</div>') + '</div>';
        }).join('');
      C.$$('[data-ft]', el).forEach(function (b) { b.onclick = function () { filtroT = b.dataset.ft; C.render(); }; });
      var tp = C.$('#t-pessoa', el); if (tp) tp.onchange = function () { pessoaT = tp.value; C.render(); };
      ligarTarefas(el, function () { C.render(); });
    }
  };

  /* ---------------------------------------------------- SDR passa para closer */
  C.passarLead = function (c, depois) {
    var closers = S.usuarios.filter(function (u) { return u.perfil === 'closer' && u.ativo === 'SIM'; });
    if (!closers.length) { C.toast(C.pode('equipe') ? 'Crie pelo menos um closer em Equipe e acessos.' : 'Ainda não há closers cadastrados. Fale com o administrador.', 'erro'); return; }
    var aberto = S.negocios.filter(function (n) { return n.contato_id === c.id && n.status === 'aberto'; })[0];
    var el = C.modal({
      titulo: 'Passar ' + C.primeiroNome(c.nome) + ' para um closer',
      corpo: '<p class="small muted" style="margin-top:0">O closer vira o responsável pelo contato e pelo negócio, recebe uma tarefa e você continua vendo o lead.</p>' +
        '<div class="campo"><label>Closer</label><select class="inp" id="pl-closer"><option value="">Rodízio (quem tem menos leads em aberto)</option>' + closers.map(function (u) { return '<option value="' + u.id + '">' + esc(u.nome) + (u.recebe_leads === 'SIM' ? '' : ' (fora do rodízio)') + '</option>'; }).join('') + '</select></div>' +
        '<div class="grade2"><div class="campo"><label>Reunião (opcional)</label><input class="inp" type="datetime-local" id="pl-reu"></div><div class="campo"><label>Valor estimado (R$)</label><input class="inp" id="pl-valor" inputmode="decimal" value="' + esc(aberto && C.num(aberto.valor) ? aberto.valor : '') + '"></div></div>' +
        '<div class="campo"><label>Resumo da qualificação para o closer</label><textarea class="inp" id="pl-nota" rows="4" placeholder="Ex.: Tem orçamento, decide sozinho, quer começar este mês. Dor principal: ..."></textarea></div>' +
        (S.config.passar_etapa && C.etapa(S.config.passar_etapa) ? '<p class="small muted">O negócio vai para a etapa <b>' + esc(C.etapa(S.config.passar_etapa).nome) + '</b>.</p>' : ''),
      pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="pl-ok" data-carregando=" Passando...">' + ic('passar') + ' Passar lead</button>'
    });
    el.querySelector('#pl-ok').onclick = function () {
      C.comBotao(this, function () {
        return C.api('negocio.passar', { contato_id: c.id, closer_id: el.querySelector('#pl-closer').value, reuniao_em: el.querySelector('#pl-reu').value, valor: el.querySelector('#pl-valor').value, nota: el.querySelector('#pl-nota').value }).then(function (n) {
          var u = C.usuario(n.responsavel_id);
          el.fechar();
          C.toast('Lead passado para ' + (u ? u.nome : 'o closer') + (n.reuniao_em ? '. Reunião marcada.' : ''), 'ok');
          if (depois) depois(n);
        });
      });
    };
  };

  /** Resultado da reunião (realizada / faltou / cancelada) ou remarcar. */
  C.acoesReuniao = function (n, depois) {
    if (!n) return;
    var c = C.contato(n.contato_id);
    var el = C.modal({
      titulo: 'Reunião com ' + (c ? C.primeiroNome(c.nome) : ''),
      corpo: '<p style="margin-top:0">Marcada para <b>' + C.fmtData(n.reuniao_em) + '</b>.</p><div style="display:grid;gap:8px">' +
        '<button class="btn" data-st="realizada">' + ic('check') + ' Aconteceu</button><button class="btn" data-st="no_show">' + ic('usuarioX') + ' A pessoa faltou</button><button class="btn" data-st="cancelada">' + ic('x') + ' Foi cancelada</button></div>' +
        '<div class="campo" style="margin-top:16px"><label>Ou remarcar para</label><div class="linha"><input class="inp" type="datetime-local" id="ra-q"><button class="btn pri" id="ra-ok" style="flex:0 0 auto" data-carregando=" Salvando...">Remarcar</button></div><span class="ajuda">O lead recebe um novo lembrete.</span></div>',
      pe: '<button class="btn" data-fechar>Fechar</button>'
    });
    var feito = function (r) { el.fechar(); C.toast('Reunião atualizada', 'ok'); var i = S.negocios.findIndex(function (x) { return x.id === r.id; }); if (i >= 0) S.negocios[i] = r; if (depois) depois(r); };
    C.$$('[data-st]', el).forEach(function (b) { b.onclick = function () { C.comBotao(b, function () { return C.api('negocio.reuniao', { id: n.id, status: b.dataset.st }).then(feito); }); }; });
    el.querySelector('#ra-ok').onclick = function () { var q = el.querySelector('#ra-q').value; var b = this; C.comBotao(b, function () { if (!q) throw new Error('Escolha a nova data.'); return C.api('negocio.reuniao', { id: n.id, quando: q }).then(feito); }); };
  };
})();
