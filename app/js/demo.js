/* ==========================================================================
   PRUMO CRM — modo demonstração
   Roda a MESMA lógica do servidor (logica.js) dentro do navegador, guardando
   os dados no localStorage. Serve para apresentar o sistema a clientes sem
   instalar nada. O WhatsApp é simulado: contatos "respondem" sozinhos.
   ========================================================================== */
(function () {
  'use strict';
  var CHAVE = 'prumo_demo_v1';
  var db = null;

  function carregar() {
    try { db = JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { db = null; }
    if (!db || !db.t) { db = { t: {}, cfg: {}, cache: {} }; semearDemo(); }
  }
  var salvarPend = null;
  function salvar() {
    clearTimeout(salvarPend);
    salvarPend = setTimeout(function () { try { localStorage.setItem(CHAVE, JSON.stringify(db)); } catch (e) { /* cheio */ } }, 150);
  }
  function t(nome) { if (!db.t[nome]) db.t[nome] = []; return db.t[nome]; }
  var pad = function (n) { return ('0' + n).slice(-2); };
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  var seq = 0;
  function hashSimples(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return 'd' + h.toString(16); }
  function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }
  function limpa(o) { var c = {}; Object.keys(o).forEach(function (k) { c[k] = o[k] === undefined || o[k] === null ? '' : String(o[k]); }); return c; }

  var respostasPendentes = [];
  var P = {
    tabela: function (n) { return t(n); },
    filtrar: function (n, campo, v) { return t(n).filter(function (o) { return o[campo] === v; }); },
    inserir: function (n, o) { t(n).push(limpa(o)); salvar(); },
    inserirVarios: function (n, arr) { arr.forEach(function (o) { t(n).push(limpa(o)); }); salvar(); },
    atualizar: function (n, id, campos) { var m = {}; m[id] = campos; P.atualizarVarios(n, m); },
    atualizarVarios: function (n, mapa) {
      t(n).forEach(function (o) {
        var c = mapa[o.id];
        if (c) Object.keys(c).forEach(function (k) { o[k] = c[k] === undefined || c[k] === null ? '' : String(c[k]); });
      });
      salvar();
    },
    excluir: function (n, id) { P.excluirVarios(n, [id]); },
    excluirVarios: function (n, ids) { var s = {}; ids.forEach(function (i) { s[i] = 1; }); db.t[n] = t(n).filter(function (o) { return !s[o.id]; }); salvar(); },
    config: function () { return db.cfg; },
    salvarConfig: function (o) { Object.keys(o).forEach(function (k) { db.cfg[k] = String(o[k]); }); salvar(); },
    agora: function () { return iso(new Date()); },
    id: function (p) { return p + Date.now().toString(36).toUpperCase() + (++seq); },
    uuid: uuid,
    hash: function (s, salt) { return hashSimples(salt + '|' + s); },
    cache: {
      get: function (k) { var v = db.cache[k]; if (!v) return null; if (v.e < Date.now()) { delete db.cache[k]; return null; } return v.v; },
      put: function (k, v, s) { db.cache[k] = { v: String(v), e: Date.now() + (s || 600) * 1000 }; salvar(); },
      del: function (k) { delete db.cache[k]; salvar(); }
    },
    // WhatsApp simulado: toda URL "responde" como uma Evolution API conectada.
    http: function (url, o) {
      if (/connectionState/.test(url)) return { code: 200, text: JSON.stringify({ instance: { state: 'open' } }) };
      if (/fetchAllGroups/.test(url)) return { code: 200, text: JSON.stringify([{ id: '120363000000001@g.us', subject: 'Clientes VIP', size: 87 }, { id: '120363000000002@g.us', subject: 'Comunidade - Turma 2', size: 214 }]) };
      if (/inviteCode/.test(url)) return { code: 200, text: JSON.stringify({ inviteUrl: 'https://chat.whatsapp.com/DEMO' + Math.random().toString(36).slice(2, 8) }) };
      if (/\/instance\/(create|connect)/.test(url)) return { code: 200, text: JSON.stringify({ instance: { state: 'open' } }) };
      if (/\/message\//.test(url)) {
        var corpo = {}; try { corpo = JSON.parse(o.body || '{}'); } catch (e) { /* nada */ }
        if (corpo.number && !/@g\.us$/.test(corpo.number)) agendarResposta(corpo.number, corpo.text || corpo.caption || '');
        return { code: 200, text: JSON.stringify({ key: { id: 'DEMO' + Date.now() + Math.random().toString(36).slice(2, 6) }, status: 'PENDING' }) };
      }
      return { code: 200, text: '{}' };
    },
    urlApp: function () { return 'https://script.google.com/macros/s/SEU-ID-DEMO/exec'; }
  };

  var L = null;
  var RESPOSTAS = ['Oi! Tudo bem sim', 'Quero saber mais', 'Qual o valor?', '1', 'Pode me mandar mais detalhes?', 'Obrigado!', 'Vou ver e te retorno', 'Tenho interesse sim'];
  function agendarResposta(numero, texto) {
    if (Math.random() < 0.35) return;
    var c = L && L.filtrarContatos({}).filter(function (x) { return L.U.telChave(x.telefone) === L.U.telChave(numero); })[0];
    if (!c) return;
    var resp;
    if (/\*1\*/.test(texto)) resp = String(1 + Math.floor(Math.random() * 3));
    else if (/e-?mail/i.test(texto)) resp = L.U.primeiroNome(c.nome).toLowerCase() + '@exemplo.com.br';
    else if (/seu nome|qual é o seu nome/i.test(texto)) resp = c.nome;
    else resp = RESPOSTAS[Math.floor(Math.random() * RESPOSTAS.length)];
    respostasPendentes.push({ em: Date.now() + 3000 + Math.random() * 5000, m: { telefone: numero, nome: c.nome, texto: resp, tipo: 'texto', wa_id: 'IN' + Date.now() + Math.random() } });
  }
  setInterval(function () {
    if (!L) return;
    var agora = Date.now();
    var prontas = respostasPendentes.filter(function (r) { return r.em <= agora; });
    respostasPendentes = respostasPendentes.filter(function (r) { return r.em > agora; });
    prontas.forEach(function (r) { try { L.receber(r.m); } catch (e) { console.warn(e); } });
  }, 1500);
  setInterval(function () { if (L) try { L.trabalhar(4); } catch (e) { console.warn(e); } }, 8000);

  /* ------------------------------------------------- dados de exemplo */
  function semearDemo() {
    L = PrumoLogica(P);
    P.salvarConfig({
      NOME: 'Studio Aurora', SLOGAN: 'Estética e bem-estar', COR_PRIMARIA: '#0F766E', COR_DESTAQUE: '#F59E0B', CONFIGURADO: 'SIM', SEGMENTO: 'servicos',
      WA_PROVEDOR: 'evolution', EVOLUTION_URL: 'https://evolution.demo', EVOLUTION_APIKEY: 'demo', EVOLUTION_INSTANCIA: 'demo',
      HORARIO_INICIO: '00:00', HORARIO_FIM: '23:59', DIAS_ENVIO: '0,1,2,3,4,5,6',
      CAMPOS_PERSONALIZADOS: JSON.stringify([{ chave: 'interesse', rotulo: 'Interesse', tipo: 'texto' }, { chave: 'aniversario', rotulo: 'Aniversário', tipo: 'data' }]),
      TAGS: 'Lead quente, Cliente, Indicação, Retornar, Pacote mensal'
    });
    L.semear({ nome: 'Marina Costa', email: 'demo@prumo.app', senha: 'demo1234' });
    var salt = uuid();
    P.inserirVarios('Usuarios', [
      { id: 'U2', nome: 'Rafael Lima', email: 'rafael@prumo.app', senha_hash: P.hash('demo1234', salt), salt: salt, perfil: 'atendente', ativo: 'SIM', recebe_leads: 'SIM', cor: '#7C3AED', criado_em: P.agora() },
      { id: 'U3', nome: 'Juliana Prado', email: 'juliana@prumo.app', senha_hash: P.hash('demo1234', salt), salt: salt, perfil: 'gestor', ativo: 'SIM', recebe_leads: 'SIM', cor: '#DB2777', criado_em: P.agora() }
    ]);
    // aplica o funil do segmento
    var mod = PRUMO_MODELOS_SEGMENTO.servicos;
    P.excluirVarios('Etapas', t('Etapas').map(function (e) { return e.id; }));
    P.atualizar('Funis', 'FU1', { nome: mod.funil });
    P.inserirVarios('Etapas', mod.etapas.map(function (e, i) { return { id: 'ET' + (i + 1), funil_id: 'FU1', nome: e[0], cor: e[1], ordem: i + 1, tipo: e[2] || 'aberto' }; }));
    P.inserir('Funis', { id: 'FU2', nome: 'Pós-venda', ordem: 2 });
    [['Primeira sessão', '#0EA5E9'], ['Acompanhamento', '#8B5CF6'], ['Renovou', '#16A34A', 'ganho'], ['Não renovou', '#DC2626', 'perdido']]
      .forEach(function (e, i) { P.inserir('Etapas', { id: 'EP' + (i + 1), funil_id: 'FU2', nome: e[0], cor: e[1], ordem: i + 1, tipo: e[2] || 'aberto' }); });

    var nomes = ['Ana Beatriz Souza', 'Carlos Henrique', 'Fernanda Alves', 'Gustavo Pereira', 'Helena Martins', 'Igor Santos', 'Juliana Rocha', 'Leonardo Dias',
      'Mariana Freitas', 'Natália Gomes', 'Otávio Ribeiro', 'Paula Teixeira', 'Rodrigo Nunes', 'Sabrina Lopes', 'Thiago Barros', 'Vanessa Cardoso',
      'Bruno Azevedo', 'Camila Duarte', 'Diego Moreira', 'Eduarda Campos', 'Felipe Araújo', 'Gabriela Pinto', 'Hugo Fernandes', 'Isabela Ramos',
      'João Victor Melo', 'Larissa Cunha', 'Marcelo Viana', 'Patrícia Lemos', 'Renata Farias', 'Sérgio Castro', 'Tatiane Moura', 'Vinícius Rezende'];
    var origens = ['WhatsApp', 'Instagram', 'Site', 'Indicação', 'Anúncio'];
    var tagsPool = ['Lead quente', 'Cliente', 'Indicação', 'Retornar', 'Pacote mensal'];
    var conversas = [
      ['in', 'Oi, vi o anúncio de vocês no Instagram'], ['out', 'Oi! Que bom que nos encontrou. Como posso te ajudar?'], ['in', 'Queria saber o valor da limpeza de pele'],
      ['out', 'Temos a sessão avulsa e o pacote mensal. Posso te mandar os detalhes?'], ['in', 'Pode sim!']
    ];
    var agora = Date.now();
    var r = 11;
    var rnd = function () { r = (r * 16807) % 2147483647; return r / 2147483647; };
    nomes.forEach(function (n, i) {
      var dias = Math.floor(rnd() * 40);
      var criado = iso(new Date(agora - dias * 86400000 - rnd() * 36000000));
      var tags = tagsPool.filter(function () { return rnd() < 0.25; });
      var tel = '55' + ['11', '21', '31', '41', '48', '61', '71', '85'][i % 8] + '9' + String(80000000 + Math.floor(rnd() * 19999999));
      var c = {
        id: 'C' + (100 + i), nome: n, telefone: tel, email: n.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + i + '@exemplo.com.br',
        empresa: rnd() < 0.3 ? 'Empresa ' + n.split(' ').pop() : '', cargo: '', cidade: ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Florianópolis'][i % 5],
        origem: origens[Math.floor(rnd() * origens.length)], tags: tags.join(', '), responsavel_id: ['U1', 'U2', 'U3', ''][i % 4], status: tags.indexOf('Cliente') >= 0 ? 'cliente' : 'lead',
        campos: JSON.stringify({ interesse: ['Limpeza de pele', 'Massagem', 'Depilação', 'Pacote mensal'][i % 4] }), notas: '', optout: 'NAO', bot_pausado_ate: '',
        ultima_msg: '', ultima_msg_em: '', ultima_direcao: '', nao_lidas: '0', total_msgs: '0', criado_em: criado, atualizado_em: criado
      };
      var nMsg = i < 14 ? 2 + Math.floor(rnd() * 4) : 0;
      var base = new Date(agora - Math.min(dias, 6) * 86400000 - rnd() * 20000000);
      for (var k = 0; k < nMsg; k++) {
        var cv = conversas[k];
        var quando = iso(new Date(base.getTime() + k * 420000));
        t('Mensagens').push(limpa({ id: 'M' + i + '_' + k, contato_id: c.id, direcao: cv[0], tipo: 'texto', texto: cv[1].replace('{n}', n), status: cv[0] === 'in' ? 'recebida' : 'enviada', usuario_id: cv[0] === 'out' ? (c.responsavel_id || 'U1') : '', origem: cv[0] === 'out' ? 'manual' : 'whatsapp', criado_em: quando }));
        c.ultima_msg = cv[1]; c.ultima_msg_em = quando; c.ultima_direcao = cv[0]; c.atualizado_em = quando;
      }
      c.total_msgs = String(nMsg);
      c.nao_lidas = nMsg && c.ultima_direcao === 'in' && i % 3 === 0 ? '1' : '0';
      t('Contatos').push(limpa(c));
      if (i < 22) {
        var et = ['ET1', 'ET2', 'ET3', 'ET4', 'ET5', 'ET6'][Math.floor(rnd() * 6)];
        var tipo = et === 'ET5' ? 'ganho' : et === 'ET6' ? 'perdido' : 'aberto';
        t('Negocios').push(limpa({
          id: 'N' + (100 + i), titulo: ['Pacote mensal', 'Limpeza de pele', 'Massagem relaxante', 'Depilação a laser'][i % 4] + ' - ' + n.split(' ')[0], contato_id: c.id, funil_id: 'FU1', etapa_id: et,
          valor: String([890, 180, 220, 1450][i % 4] * (1 + Math.floor(rnd() * 2))), responsavel_id: c.responsavel_id || 'U1', status: tipo,
          motivo_perda: tipo === 'perdido' ? ['Preço', 'Sem resposta', 'Comprou do concorrente'][i % 3] : '', previsao: '', notas: '',
          criado_em: criado, atualizado_em: criado, fechado_em: tipo !== 'aberto' ? iso(new Date(agora - Math.floor(rnd() * 25) * 86400000)) : ''
        }));
      }
    });
    var hoje = iso(new Date()).slice(0, 10);
    P.inserirVarios('Tarefas', [
      { id: 'T1', titulo: 'Enviar orçamento do pacote', tipo: 'whatsapp', contato_id: 'C100', responsavel_id: 'U1', vence_em: hoje + 'T10:00:00', feita: 'NAO', criado_em: P.agora() },
      { id: 'T2', titulo: 'Ligar para confirmar horário', tipo: 'ligacao', contato_id: 'C103', responsavel_id: 'U2', vence_em: iso(new Date(agora - 86400000)), feita: 'NAO', criado_em: P.agora() },
      { id: 'T3', titulo: 'Reunião de alinhamento da equipe', tipo: 'reuniao', contato_id: '', responsavel_id: 'U1', vence_em: iso(new Date(agora + 2 * 86400000)), feita: 'NAO', criado_em: P.agora() }
    ]);
    P.inserirVarios('Grupos', [
      { id: 'G1', nome: 'Promoções Studio Aurora 1', jid: '120363000000011@g.us', link: 'https://chat.whatsapp.com/DEMOGRUPO1', slug: 'promocoes', limite: '250', cliques: '250', ordem: '1', ativo: 'SIM', criado_em: P.agora() },
      { id: 'G2', nome: 'Promoções Studio Aurora 2', jid: '120363000000012@g.us', link: 'https://chat.whatsapp.com/DEMOGRUPO2', slug: 'promocoes', limite: '250', cliques: '96', ordem: '2', ativo: 'SIM', criado_em: P.agora() }
    ]);
    P.inserir('Campanhas', {
      id: 'D1', nome: 'Promoção de aniversário', destino: 'contatos', filtro: JSON.stringify({ tags: ['Cliente'] }), grupos: '[]',
      texto: '{Oi|Olá} {primeiro_nome}! Este mês a {minha_empresa} faz aniversário e você ganhou 20% de desconto em qualquer sessão. Responda QUERO para garantir.',
      velocidade: 'normal', status: 'concluida', total: '9', enviados: '9', erros: '0', respostas: '4', criado_por: 'Marina Costa',
      criado_em: iso(new Date(agora - 5 * 86400000)), iniciada_em: iso(new Date(agora - 5 * 86400000)), concluida_em: iso(new Date(agora - 5 * 86400000 + 900000))
    });
    // deixa as automações de exemplo ligadas na demonstração
    t('Automacoes').forEach(function (a, i) { if (i < 2) a.ativo = 'SIM'; });
    salvar();
  }

  carregar();
  L = PrumoLogica(P);

  window.PrumoDemo = {
    call: function (body) {
      return new Promise(function (ok) {
        setTimeout(function () {
          try { ok({ ok: true, data: JSON.parse(JSON.stringify(L.rotear(body))) }); }
          catch (e) { ok({ ok: false, error: e.message, auth: e.message === 'SESSAO_EXPIRADA' }); }
        }, 120 + Math.random() * 180);
      });
    },
    /** Simula uma mensagem chegando pelo WhatsApp (botão na tela de conversas). */
    simularEntrada: function (telefone, nome, texto) { L.receber({ telefone: telefone, nome: nome, texto: texto, tipo: 'texto', wa_id: 'SIM' + Date.now() }); },
    resetar: function () { localStorage.removeItem(CHAVE); location.reload(); }
  };
})();
