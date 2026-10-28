/* ==========================================================================
   PRUMO CRM — Disparos (campanhas) e Grupos (links inteligentes)
   ========================================================================== */
(function () {
  'use strict';
  var S = C.S, esc = C.esc, ic = C.ic;

  var ST = {
    rascunho: ['Rascunho', 'st-off'], agendada: ['Agendado', 'st-roxo'], enviando: ['Enviando', 'st-lead'], pausada: ['Pausado', 'st-aviso'],
    concluida: ['Concluído', 'st-on'], cancelada: ['Cancelado', 'st-off'], erro: ['Erro', 'st-erro'], assistido: ['Envio assistido', 'st-aviso']
  };
  var VEL = { lenta: ['Lenta (mais segura)', '~1 mensagem a cada 90 s'], normal: ['Normal', '~1 mensagem a cada 45 s'], rapida: ['Rápida', '~1 mensagem a cada 25 s'] };

  /* ============================================================== DISPAROS */
  C.views.disparos = {
    titulo: 'Disparos',
    acoes: function () { return '<button class="btn pri" data-a="novo">' + ic('plus') + '<span class="txt"> Novo disparo</span></button>'; },
    ligarAcoes: function (el) { el.querySelector('[data-a=novo]').onclick = function () { formCampanha({}); }; },
    render: function (el) {
      var l = S.campanhas.slice().sort(function (a, b) { return a.criado_em < b.criado_em ? 1 : -1; });
      var h = '<div class="aviso">' + ic('escudo') + '<div><b>Boas práticas para não ter o número bloqueado:</b> envie só para quem conhece sua empresa, use a velocidade lenta em listas grandes ou números novos, varie o texto com <b>{Oi|Olá}</b> e dê sempre a opção de sair (quem responder SAIR não recebe mais). Disparos só saem no horário configurado em Ajustes.</div></div>';
      if (!l.length) h += '<div class="card vazio">' + ic('disparos') + '<h3>Nenhum disparo ainda</h3><p>Envie uma mensagem para um público filtrado por tags, etapa ou origem, com intervalo automático entre cada envio.</p></div>';
      else h += '<div class="lista-cards">' + l.map(function (c) {
        var st = ST[c.status] || [c.status, 'st-off'];
        var tot = C.num(c.total), env = C.num(c.enviados) + C.num(c.erros);
        var dest = c.destino === 'grupos' ? (C.json(c.grupos, []).length + ' grupos') : resumoFiltro(C.json(c.filtro, {}));
        return '<div class="card item-card" style="flex-wrap:wrap"><div class="passo-ic c-msg" style="width:42px;height:42px">' + ic(c.destino === 'grupos' ? 'grupos' : 'disparos') + '</div>' +
          '<div class="meio"><h3 class="trunc">' + esc(c.nome) + ' <span class="status ' + st[1] + '">' + st[0] + '</span></h3>' +
          '<div class="small muted trunc">' + esc(dest) + (c.agendar_em && c.status === 'agendada' ? ' · agendado para ' + C.fmtData(c.agendar_em) : '') + '</div>' +
          (tot ? '<div style="display:flex;gap:10px;align-items:center;margin-top:6px"><div class="progresso" style="flex:1;max-width:320px"><div style="width:' + Math.min(100, env / tot * 100) + '%"></div></div><span class="small muted num">' + C.num(c.enviados) + '/' + tot + (C.num(c.erros) ? ' · ' + c.erros + ' erros' : '') + (C.num(c.respostas) ? ' · ' + c.respostas + ' responderam' : '') + '</span></div>' : '') + '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap">' + botoes(c) + '</div></div>';
      }).join('') + '</div>';
      el.innerHTML = h;
      C.$$('[data-ac]', el).forEach(function (b) { b.onclick = function () { acao(b.dataset.ac, b.dataset.id, b); }; });
    },
    aoSincronizar: function (r) { if (r.campanhas && r.campanhas.length && !C.$('.modal-bg')) C.render(); }
  };

  function botoes(c) {
    var b = function (ac, rot, cls, i) { return '<button class="btn peq ' + (cls || '') + '" data-ac="' + ac + '" data-id="' + c.id + '">' + (i ? ic(i) : '') + ' ' + rot + '</button>'; };
    var h = '';
    if (c.status === 'rascunho' || c.status === 'agendada') h += b('editar', 'Editar', '', 'lapis') + b('iniciar', c.agendar_em && c.agendar_em > C.isoLocal() && c.status === 'rascunho' ? 'Agendar' : 'Enviar', 'pri', 'play');
    if (c.status === 'agendada') h += b('agora', 'Enviar agora', '', 'raio');
    if (c.status === 'enviando') h += b('pausar', 'Pausar', '', 'pause') + b('processar', 'Enviar próximos', '', 'atualizar');
    if (c.status === 'pausada') h += b('retomar', 'Retomar', 'pri', 'play');
    if (c.status === 'assistido') h += b('assistido', 'Continuar envio', 'pri', 'play');
    if (['enviando', 'pausada', 'agendada'].indexOf(c.status) >= 0) h += b('cancelar', 'Cancelar', 'perigo', 'x');
    if (C.num(c.total)) h += b('relatorio', 'Envios', '', 'lista');
    h += b('duplicar', '', 'ic', 'duplicar');
    if (c.status !== 'enviando') h += b('excluir', '', 'ic perigo', 'lixo');
    return h;
  }

  function resumoFiltro(f) {
    var p = [];
    if (f.tags && f.tags.length) p.push('tags: ' + f.tags.join(', '));
    if (f.sem_tags && f.sem_tags.length) p.push('sem: ' + f.sem_tags.join(', '));
    if (f.etapas && f.etapas.length) p.push(f.etapas.length + ' etapas');
    if (f.status && f.status.length) p.push(f.status.join('/'));
    if (f.origens && f.origens.length) p.push('origem: ' + f.origens.join(', '));
    if (f.criado_dias) p.push('criados há até ' + f.criado_dias + ' dias');
    if (f.sem_conversa_dias) p.push('sem conversa há ' + f.sem_conversa_dias + ' dias');
    return p.length ? p.join(' · ') : 'Todos os contatos';
  }

  function acao(ac, id, btn) {
    var c = S.campanhas.filter(function (x) { return x.id === id; })[0];
    var recarrega = function () { return C.api('bootstrap').then(function (d) { C.aplicarDados(d); C.render(); }); };
    if (ac === 'editar') return formCampanha(c);
    if (ac === 'relatorio') return verEnvios(c);
    if (ac === 'assistido') return envioAssistido(c, null);
    var simples = { pausar: 'campanha.pausar', retomar: 'campanha.retomar', duplicar: 'campanha.duplicar', processar: 'fila.processar' };
    if (simples[ac]) return C.comBotao(btn, function () { return C.api(simples[ac], { id: id }).then(function (r) { if (ac === 'processar') C.toast((r.enviados || 0) + ' enviados agora', 'ok'); return recarrega(); }); });
    if (ac === 'iniciar' || ac === 'agora') {
      return C.api('contato.publico', { filtro: C.json(c.filtro, {}) }).then(function (r) {
        var n = c.destino === 'grupos' ? C.json(c.grupos, []).length : r.total;
        var vel = VEL[c.velocidade] || VEL.normal;
        var mins = Math.ceil(n * ({ lenta: 90, normal: 45, rapida: 25 }[c.velocidade] || 45) / 60);
        var agendar = ac === 'iniciar' && c.agendar_em && c.agendar_em > C.isoLocal();
        return C.confirmar((agendar ? 'Agendar' : 'Enviar') + ' <b>' + esc(c.nome) + '</b> para <b>' + n + '</b> ' + (c.destino === 'grupos' ? 'grupos' : 'contatos') + '?' +
          (S.waStatus && S.waStatus.provedor === 'link' ? '<br><br>Sem API conectada, o envio é <b>assistido</b>: o sistema abre cada conversa no seu WhatsApp e você aperta enviar.' : '<br><br>Velocidade ' + vel[0].toLowerCase() + ': cerca de ' + mins + ' minutos no total, dentro do horário de envio.'), { botao: agendar ? 'Agendar' : 'Enviar' }).then(function (ok) {
          if (!ok) return;
          return C.api('campanha.iniciar', { id: id, agora: ac === 'agora' }).then(function (r2) {
            if (r2.assistido) { recarrega(); return envioAssistido(c, r2.lista); }
            C.toast(r2.agendada ? 'Disparo agendado' : r2.total + ' mensagens na fila', 'ok');
            return recarrega();
          });
        });
      }).catch(function (e) { C.toast(e.message, 'erro'); });
    }
    if (ac === 'cancelar') return C.confirmar('Cancelar o disparo? As mensagens que ainda não saíram não serão enviadas.', { perigo: true, botao: 'Cancelar disparo' }).then(function (ok) { if (ok) return C.api('campanha.cancelar', { id: id }).then(recarrega); }).catch(function (e) { C.toast(e.message, 'erro'); });
    if (ac === 'excluir') return C.confirmar('Excluir o disparo <b>' + esc(c.nome) + '</b>?', { perigo: true, botao: 'Excluir' }).then(function (ok) { if (ok) return C.api('campanha.excluir', { id: id }).then(recarrega); }).catch(function (e) { C.toast(e.message, 'erro'); });
  }

  function formCampanha(c) {
    c = c || {};
    var f = C.json(c.filtro, {});
    var meta = C.json(c.meta_modelo, null) || {};
    var destino = c.destino || 'contatos';
    var gruposSel = C.json(c.grupos, []);
    var etapas = '';
    S.funis.forEach(function (fu) { etapas += fu.etapas.map(function (e) { return '<label class="check" style="margin:0 12px 6px 0;display:inline-flex"><input type="checkbox" data-et="' + e.id + '"' + ((f.etapas || []).indexOf(e.id) >= 0 ? ' checked' : '') + '> ' + esc((S.funis.length > 1 ? fu.nome + ' > ' : '') + e.nome) + '</label>'; }).join(''); });
    var origens = {}; S.contatos.forEach(function (x) { if (x.origem) origens[x.origem] = 1; });
    var ehMeta = S.waStatus && S.waStatus.provedor === 'meta';
    var el = C.modal({
      titulo: c.id ? 'Editar disparo' : 'Novo disparo', tamanho: 'xl',
      corpo: '<div class="grid-2" style="align-items:start"><div>' +
        '<div class="campo"><label>Nome interno</label><input class="inp" id="d-nome" value="' + esc(c.nome || '') + '" placeholder="Ex.: Promoção de novembro"></div>' +
        '<div class="campo"><label>Enviar para</label><div class="seg"><button type="button" data-dest="contatos" class="' + (destino === 'contatos' ? 'on' : '') + '">Contatos</button><button type="button" data-dest="grupos" class="' + (destino === 'grupos' ? 'on' : '') + '">Grupos do WhatsApp</button></div></div>' +
        '<div id="d-pub-contatos"' + (destino === 'grupos' ? ' class="hidden"' : '') + '>' +
        '<div class="campo"><label>Que tenham alguma destas tags</label><div id="d-tags"></div><label class="check" style="margin-top:6px"><input type="checkbox" id="d-todas"' + (f.tags_modo === 'todas' ? ' checked' : '') + '> Precisa ter todas as tags</label></div>' +
        '<div class="campo"><label>Excluir quem tem estas tags</label><div id="d-semtags"></div></div>' +
        '<div class="campo"><label>Que estejam nestas etapas (opcional)</label><div>' + etapas + '</div></div>' +
        '<div class="grade2"><div class="campo"><label>Status</label><select class="inp" id="d-status"><option value="">Todos</option>' + [['lead', 'Leads'], ['cliente', 'Clientes'], ['inativo', 'Inativos']].map(function (s) { return '<option value="' + s[0] + '"' + ((f.status || [])[0] === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label>Origem</label><select class="inp" id="d-origem"><option value="">Todas</option>' + Object.keys(origens).sort().map(function (o) { return '<option' + ((f.origens || [])[0] === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label>Criados nos últimos (dias)</label><input class="inp" type="number" min="0" id="d-criado" value="' + esc(f.criado_dias || '') + '"></div>' +
        '<div class="campo"><label>Sem conversa há pelo menos (dias)</label><input class="inp" type="number" min="0" id="d-semconv" value="' + esc(f.sem_conversa_dias || '') + '"></div></div>' +
        '<div class="aviso ok" id="d-total" style="margin-bottom:0">' + ic('contatos') + '<div>Calculando público...</div></div></div>' +
        '<div id="d-pub-grupos"' + (destino === 'contatos' ? ' class="hidden"' : '') + '>' + (S.grupos.filter(function (g) { return g.jid; }).length ? S.grupos.filter(function (g) { return g.jid; }).map(function (g) { return '<label class="check"><input type="checkbox" data-gr="' + g.id + '"' + (gruposSel.indexOf(g.id) >= 0 ? ' checked' : '') + '> ' + esc(g.nome) + '</label>'; }).join('') : '<div class="aviso">' + ic('info') + '<div>Nenhum grupo com ID do WhatsApp. Em Grupos e links, clique em Importar do WhatsApp.</div></div>') + '</div>' +
        '</div><div>' +
        '<div class="campo"><label>Mensagem</label><textarea class="inp" id="d-texto" rows="6" placeholder="{Oi|Olá} {primeiro_nome}! ...">' + esc(c.texto || '') + '</textarea>' +
        '<div class="chips" style="margin-top:4px">' + ['{primeiro_nome}', '{saudacao}', '{minha_empresa}', '{Oi|Olá|E aí}'].map(function (v) { return '<button type="button" class="chip" data-var="' + v + '">' + v + '</button>'; }).join('') + '</div></div>' +
        '<div class="grade2"><div class="campo"><label>Mídia (opcional)</label><select class="inp" id="d-mtipo">' + [['', 'Só texto'], ['image', 'Imagem'], ['video', 'Vídeo'], ['audio', 'Áudio'], ['document', 'Documento']].map(function (o) { return '<option value="' + o[0] + '"' + ((c.midia_tipo || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label>Link público da mídia</label><input class="inp" id="d-murl" value="' + esc(c.midia_url || '') + '" placeholder="https://..."></div></div>' +
        (ehMeta ? '<div class="campo"><label>Modelo aprovado na Meta (obrigatório fora da janela de 24h)</label><div class="grade2"><input class="inp" id="d-meta" placeholder="nome_do_modelo" value="' + esc(meta.nome || '') + '"><input class="inp" id="d-metaidioma" placeholder="pt_BR" value="' + esc(meta.idioma || 'pt_BR') + '"></div><input class="inp" style="margin-top:6px" id="d-metavars" placeholder="Variáveis {{1}}, {{2}}... separadas por ; ex.: {primeiro_nome};{minha_empresa}" value="' + esc((meta.variaveis || []).join(';')) + '"></div>' : '') +
        '<div class="grade2"><div class="campo"><label>Velocidade</label><select class="inp" id="d-vel">' + Object.keys(VEL).map(function (k) { return '<option value="' + k + '"' + ((c.velocidade || 'normal') === k ? ' selected' : '') + '>' + VEL[k][0] + '</option>'; }).join('') + '</select><span class="ajuda" id="d-velaj"></span></div>' +
        '<div class="campo"><label>Agendar para (opcional)</label><input class="inp" type="datetime-local" id="d-agenda" value="' + esc((c.agendar_em || '').slice(0, 16)) + '"></div></div>' +
        '<span class="rot">Prévia</span><div class="preview-wa" style="margin-top:6px"><div class="msg out" id="d-prev" style="max-width:100%"></div></div>' +
        '</div></div>',
      pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="d-ok" data-carregando=" Salvando...">Salvar rascunho</button>'
    });
    var tgInc = C.campoTags(el.querySelector('#d-tags'), f.tags || [], C.todasTags());
    var tgExc = C.campoTags(el.querySelector('#d-semtags'), f.sem_tags || [], C.todasTags());
    var ler = function () {
      return {
        tags: tgInc.valor(), sem_tags: tgExc.valor(), tags_modo: el.querySelector('#d-todas').checked ? 'todas' : 'alguma',
        etapas: C.$$('[data-et]', el).filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.et; }),
        status: el.querySelector('#d-status').value ? [el.querySelector('#d-status').value] : [],
        origens: el.querySelector('#d-origem').value ? [el.querySelector('#d-origem').value] : [],
        criado_dias: el.querySelector('#d-criado').value, sem_conversa_dias: el.querySelector('#d-semconv').value
      };
    };
    var contar = C.debounce(function () {
      var box = el.querySelector('#d-total');
      if (!box || !box.isConnected) return;
      C.api('contato.publico', { filtro: ler() }).then(function (r) { box.innerHTML = ic('contatos') + '<div><b>' + C.inteiro(r.total) + '</b> contatos vão receber (com telefone e sem pedido de saída).</div>'; }).catch(function () { });
    }, 400);
    el.addEventListener('input', function (e) { if (e.target.closest('#d-pub-contatos')) contar(); });
    el.addEventListener('change', function (e) { if (e.target.closest('#d-pub-contatos')) contar(); });
    el.addEventListener('keyup', function (e) { if (e.key === 'Enter' && e.target.closest('#d-pub-contatos')) contar(); });
    contar();
    C.$$('[data-dest]', el).forEach(function (b) {
      b.onclick = function () {
        destino = b.dataset.dest;
        C.$$('[data-dest]', el).forEach(function (x) { x.classList.toggle('on', x === b); });
        el.querySelector('#d-pub-contatos').classList.toggle('hidden', destino !== 'contatos');
        el.querySelector('#d-pub-grupos').classList.toggle('hidden', destino !== 'grupos');
      };
    });
    var ta = el.querySelector('#d-texto');
    var prev = function () {
      var ex = S.contatos[0] || { nome: 'Maria Silva' };
      var t = ta.value.replace(/\{([^{}|]+\|[^{}]*)\}/g, function (m, o) { return o.split('|')[0]; })
        .replace(/\{primeiro_nome\}/g, C.primeiroNome(ex.nome)).replace(/\{nome\}/g, ex.nome).replace(/\{minha_empresa\}/g, (S.config.marca || {}).nome || '')
        .replace(/\{saudacao\}/g, new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite');
      el.querySelector('#d-prev').textContent = t || 'Sua mensagem aparece aqui.';
      el.querySelector('#d-velaj').textContent = (VEL[el.querySelector('#d-vel').value] || VEL.normal)[1];
    };
    ta.oninput = prev; el.querySelector('#d-vel').onchange = prev; prev();
    C.$$('[data-var]', el).forEach(function (b) { b.onclick = function () { var s = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, s) + b.dataset.var + ta.value.slice(s); prev(); ta.focus(); }; });
    el.querySelector('#d-ok').onclick = function () {
      C.comBotao(this, function () {
        var ag = el.querySelector('#d-agenda').value;
        var d = {
          id: c.id, nome: el.querySelector('#d-nome').value, destino: destino, filtro: ler(),
          grupos: C.$$('[data-gr]', el).filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.gr; }),
          texto: ta.value, midia_tipo: el.querySelector('#d-mtipo').value, midia_url: C.driveDireto(el.querySelector('#d-murl').value.trim()),
          velocidade: el.querySelector('#d-vel').value, agendar_em: ag ? ag + ':00' : ''
        };
        if (d.midia_url && !/^https:\/\//.test(d.midia_url)) throw new Error('O link da mídia precisa começar com https://');
        if (d.midia_url && !d.midia_tipo) d.midia_tipo = 'image';
        if (destino === 'grupos' && !d.grupos.length) throw new Error('Escolha pelo menos um grupo.');
        if (el.querySelector('#d-meta') && el.querySelector('#d-meta').value.trim()) d.meta_modelo = { nome: el.querySelector('#d-meta').value.trim(), idioma: el.querySelector('#d-metaidioma').value.trim() || 'pt_BR', variaveis: el.querySelector('#d-metavars').value.split(';').map(function (x) { return x.trim(); }).filter(Boolean) };
        return C.api('campanha.salvar', { campanha: d }).then(function (r) {
          var i = S.campanhas.findIndex(function (x) { return x.id === r.id; });
          if (i >= 0) S.campanhas[i] = r; else S.campanhas.push(r);
          el.fechar(); C.toast('Disparo salvo. Clique em Enviar quando estiver pronto.', 'ok'); C.render();
        });
      });
    };
  }

  /** Sem API: abre cada conversa no WhatsApp do atendente, um por um. */
  function envioAssistido(c, lista) {
    var carregar = lista ? Promise.resolve(lista) : C.api('campanha.envios', { id: c.id }).then(function () {
      return C.api('contato.publico', { filtro: C.json(c.filtro, {}) }).then(function () { return null; });
    });
    carregar.then(function (l) {
      if (!l) {
        var f = C.json(c.filtro, {});
        l = S.contatos.filter(function (x) { return x.telefone && x.optout !== 'SIM'; }).filter(function (x) {
          var t = C.tags(x.tags);
          if (f.tags && f.tags.length && !f.tags.some(function (y) { return t.indexOf(y) >= 0; })) return false;
          if (f.sem_tags && f.sem_tags.some(function (y) { return t.indexOf(y) >= 0; })) return false;
          return true;
        }).map(function (x) { return { id: x.id, nome: x.nome, telefone: x.telefone, texto: c.texto.replace(/\{primeiro_nome\}/g, C.primeiroNome(x.nome)).replace(/\{([^{}|]+\|[^{}]*)\}/g, function (m, o) { return o.split('|')[0]; }) }; }).slice(C.num(c.enviados));
      }
      var i = 0;
      var el = C.modal({ titulo: 'Envio assistido: ' + c.nome, tamanho: 'largo', corpo: '<div id="as"></div>' });
      var pinta = function () {
        var box = el.querySelector('#as');
        if (i >= l.length) { box.innerHTML = '<div class="vazio">' + ic('check2') + '<h3>Envio concluído</h3><p>Todas as conversas foram abertas.</p></div>'; return; }
        var x = l[i];
        box.innerHTML = '<p class="muted" style="margin-top:0">' + (i + 1) + ' de ' + l.length + '</p><div class="progresso" style="margin-bottom:14px"><div style="width:' + (i / l.length * 100) + '%"></div></div>' +
          '<div class="pessoa" style="margin-bottom:10px">' + C.av(x.nome) + '<div><b>' + esc(x.nome) + '</b><span class="small muted">' + esc(C.tel(x.telefone)) + '</span></div></div>' +
          '<div class="preview-wa"><div class="msg out" style="max-width:100%">' + esc(x.texto) + '</div></div>' +
          '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end"><button class="btn" id="as-pula">Pular</button><button class="btn verde" id="as-abre">' + ic('whats') + ' Abrir no WhatsApp e ir para o próximo</button></div>';
        box.querySelector('#as-pula').onclick = function () { i++; pinta(); };
        box.querySelector('#as-abre').onclick = function () {
          window.open('https://wa.me/' + String(x.telefone).replace(/\D/g, '') + '?text=' + encodeURIComponent(x.texto), '_blank', 'noopener');
          C.api('campanha.assistido', { id: c.id, contato_id: x.id }).catch(function () { });
          i++; pinta();
        };
      };
      pinta();
    }).catch(function (e) { C.toast(e.message, 'erro'); });
  }

  function verEnvios(c) {
    var el = C.modal({ titulo: 'Envios: ' + c.nome, tamanho: 'largo', corpo: '<div style="text-align:center"><span class="spin" style="color:var(--pri)"></span></div>' });
    C.api('campanha.envios', { id: c.id }).then(function (l) {
      var rot = { pendente: ['Na fila', 'st-off'], enviado: ['Enviado', 'st-on'], erro: ['Erro', 'st-erro'], cancelado: ['Cancelado', 'st-off'] };
      el.querySelector('.modal-corpo').innerHTML = '<div class="barra-ferr"><button class="btn peq" id="ev-csv">' + ic('download') + ' Baixar CSV</button></div><div class="tabela-wrap"><table class="tab"><thead><tr><th>Destino</th><th>Situação</th><th>Previsto</th><th>Enviado</th></tr></thead><tbody>' + l.map(function (x) {
        var r = rot[x.status] || [x.status, 'st-off'];
        return '<tr><td>' + esc(x.nome) + '</td><td><span class="status ' + r[1] + '">' + r[0] + '</span>' + (x.erro ? '<div class="small" style="color:var(--vermelho)">' + esc(x.erro) + '</div>' : '') + '</td><td class="small">' + C.fmtData(x.enviar_em) + '</td><td class="small">' + C.fmtData(x.enviado_em) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
      el.querySelector('#ev-csv').onclick = function () { C.baixarCsv('envios-' + c.nome.replace(/\W+/g, '-') + '.csv', ['destino', 'telefone', 'status', 'erro', 'previsto', 'enviado'], l.map(function (x) { return [x.nome, x.destino, x.status, x.erro, x.enviar_em, x.enviado_em]; })); };
    }).catch(function (e) { C.toast(e.message, 'erro'); el.fechar(); });
  }

  /* =============================================================== GRUPOS */
  C.views.grupos = {
    titulo: 'Grupos e links',
    acoes: function () {
      return '<button class="btn" data-a="importar">' + ic('download') + '<span class="txt"> Importar do WhatsApp</span></button><button class="btn pri" data-a="novo">' + ic('plus') + '<span class="txt"> Adicionar grupo</span></button>';
    },
    ligarAcoes: function (el) {
      el.querySelector('[data-a=novo]').onclick = function () { formGrupo({}); };
      el.querySelector('[data-a=importar]').onclick = function () {
        var b = this;
        C.comBotao(b, function () { return C.api('grupo.importar').then(function (r) { C.toast(r.encontrados + ' grupos encontrados, ' + r.novos + ' novos', 'ok'); return C.recarregar(); }); });
      };
    },
    render: function (el) {
      var porSlug = {};
      S.grupos.forEach(function (g) { if (g.slug) (porSlug[g.slug] = porSlug[g.slug] || []).push(g); });
            var h = '<div class="aviso info">' + ic('link') + '<div><b>Link inteligente de grupos:</b> dê o mesmo "nome do link" para vários grupos. Quem clica no link entra no primeiro grupo que ainda tem vaga; quando ele lota, o link passa a mandar para o próximo. Use esse link nos anúncios, bio e página de captura.</div></div>';
      var slugs = Object.keys(porSlug);
      if (slugs.length) {
        h += '<div class="card" style="margin-bottom:16px"><div class="card-cab"><h3>Seus links inteligentes</h3></div><div class="card-pad">' + slugs.map(function (s) {
          var gs = porSlug[s];
          var vagas = gs.filter(function (g) { return g.ativo === 'SIM' && C.num(g.cliques) < C.num(g.limite); }).length;
          return '<div style="margin-bottom:14px"><div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><b>' + esc(s) + '</b><span class="small muted">' + gs.length + ' grupos · ' + (vagas ? vagas + ' com vaga' : '<span style="color:var(--vermelho)">todos cheios</span>') + '</span></div>' + C.copiavel(linkGrupo(s)) + '</div>';
        }).join('') + '</div></div>';
      }
      if (!S.grupos.length) h += '<div class="card vazio">' + ic('grupos') + '<h3>Nenhum grupo cadastrado</h3><p>Importe os grupos do seu WhatsApp (Evolution API ou WAHA) ou cadastre manualmente com o link de convite.</p></div>';
      else h += '<div class="card"><div class="tabela-wrap"><table class="tab"><thead><tr><th>Grupo</th><th>Link inteligente</th><th>Entradas pelo link</th><th class="esconde-mob">Situação</th><th></th></tr></thead><tbody>' +
        S.grupos.slice().sort(function (a, b) { return (a.slug || 'zz').localeCompare(b.slug || 'zz') || C.num(a.ordem) - C.num(b.ordem); }).map(function (g) {
          var cheio = C.num(g.cliques) >= C.num(g.limite);
          return '<tr data-g="' + g.id + '"><td><b>' + esc(g.nome) + '</b><div class="small muted">' + (g.link ? 'com link de convite' : 'sem link de convite') + (g.jid ? ' · disparos liberados' : '') + '</div></td><td>' + (g.slug ? '<span class="chip">' + esc(g.slug) + '</span>' : '<span class="fraco small">—</span>') + '</td>' +
            '<td><div style="display:flex;gap:8px;align-items:center"><div class="progresso" style="width:90px"><div style="width:' + Math.min(100, C.num(g.cliques) / Math.max(1, C.num(g.limite)) * 100) + '%"></div></div><span class="small num">' + g.cliques + '/' + g.limite + '</span></div></td>' +
            '<td class="esconde-mob"><span class="status ' + (g.ativo !== 'SIM' ? 'st-off' : cheio ? 'st-erro' : 'st-on') + '">' + (g.ativo !== 'SIM' ? 'Pausado' : cheio ? 'Cheio' : 'Recebendo') + '</span></td>' +
            '<td style="text-align:right"><button class="btn peq" data-zera="' + g.id + '" title="Zerar contador">' + ic('atualizar') + '</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';
      el.innerHTML = h;
      C.$$('tr[data-g]', el).forEach(function (tr) {
        tr.onclick = function (e) {
          if (e.target.closest('[data-zera]')) {
            C.api('grupo.zerar', { id: tr.dataset.g }).then(function () { var g = S.grupos.filter(function (x) { return x.id === tr.dataset.g; })[0]; g.cliques = '0'; C.render(); }).catch(function (er) { C.toast(er.message, 'erro'); });
            return;
          }
          formGrupo(S.grupos.filter(function (x) { return x.id === tr.dataset.g; })[0]);
        };
      });
    }
  };

  /** Link público do grupo: página g.html do próprio site, que descobre o grupo com vaga. */
  function linkGrupo(slug) {
    var pasta = location.origin + location.pathname.replace(/[^/]*$/, '');
    var u = C.apiUrl();
    var m = String(u).match(/\/macros\/s\/([\w-]+)\/exec/);
    return pasta + 'g.html?' + (m ? 's=' + m[1] : 'demo=1') + '&g=' + encodeURIComponent(slug);
  }

  function formGrupo(g) {
    g = g || {};
    var slugs = {}; S.grupos.forEach(function (x) { if (x.slug) slugs[x.slug] = 1; });
    var el = C.modal({
      titulo: g.id ? 'Editar grupo' : 'Adicionar grupo',
      corpo: '<div class="campo"><label>Nome</label><input class="inp" id="g-nome" value="' + esc(g.nome || '') + '"></div>' +
        '<div class="campo"><label>Link de convite</label><input class="inp" id="g-link" value="' + esc(g.link || '') + '" placeholder="https://chat.whatsapp.com/..."><span class="ajuda">No WhatsApp: dados do grupo > Convidar via link > Copiar link.</span></div>' +
        '<div class="grade2"><div class="campo"><label>Nome do link inteligente</label><input class="inp" id="g-slug" list="g-slugs" value="' + esc(g.slug || '') + '" placeholder="ex.: promocoes"><datalist id="g-slugs">' + Object.keys(slugs).map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist></div>' +
        '<div class="campo"><label>Limite de entradas</label><input class="inp" type="number" id="g-limite" value="' + esc(g.limite || 1000) + '"><span class="ajuda">Ao chegar nesse número, o link vai para o próximo grupo.</span></div>' +
        '<div class="campo"><label>Ordem</label><input class="inp" type="number" id="g-ordem" value="' + esc(g.ordem || 0) + '"></div>' +
        '<div class="campo"><label>ID no WhatsApp (para disparos)</label><input class="inp" id="g-jid" value="' + esc(g.jid || '') + '" placeholder="preenchido ao importar"></div></div>' +
        '<label class="check"><input type="checkbox" id="g-ativo"' + (g.ativo !== 'NAO' ? ' checked' : '') + '> Recebendo pessoas pelo link</label>',
      pe: (g.id ? '<button class="btn perigo esq" id="g-exc">' + ic('lixo') + '</button>' : '') + '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="g-ok" data-carregando=" Salvando...">Salvar</button>'
    });
    el.querySelector('#g-ok').onclick = function () {
      C.comBotao(this, function () {
        var d = { id: g.id, nome: el.querySelector('#g-nome').value, link: el.querySelector('#g-link').value, slug: el.querySelector('#g-slug').value, limite: el.querySelector('#g-limite').value, ordem: el.querySelector('#g-ordem').value, jid: el.querySelector('#g-jid').value, ativo: el.querySelector('#g-ativo').checked ? 'SIM' : 'NAO' };
        return C.api('grupo.salvar', { grupo: d }).then(function () { el.fechar(); C.toast('Grupo salvo', 'ok'); return C.recarregar(); });
      });
    };
    var ex = el.querySelector('#g-exc');
    if (ex) ex.onclick = function () { C.api('grupo.excluir', { id: g.id }).then(function () { el.fechar(); return C.recarregar(); }).catch(function (e) { C.toast(e.message, 'erro'); }); };
  }
})();
