/* ==========================================================================
   PRUMO CRM — Automações (robôs e fluxos de mensagens)
   ========================================================================== */
(function () {
  'use strict';
  var S = C.S, esc = C.esc, ic = C.ic;
  var editando = null; // cópia da automação em edição

  var GATILHOS = {
    primeira_mensagem: ['Primeira mensagem no WhatsApp', 'Quando um número novo manda a primeira mensagem'],
    palavra: ['Palavra-chave', 'Quando a mensagem recebida contém certas palavras'],
    novo_contato: ['Novo contato', 'Quando um contato é criado (formulário, cadastro, webhook)'],
    webhook: ['Formulário / webhook', 'Quando chega um lead por webhook de uma origem'],
    tag: ['Tag adicionada', 'Quando um contato recebe uma tag'],
    etapa: ['Mudou de etapa', 'Quando um negócio entra numa etapa do funil'],
    comentario: ['Comentou no Instagram', 'Quando alguém comenta uma palavra num post: a resposta vai para o Direct'],
    evento: ['Evento de venda', 'Hotmart ou Kiwify: compra, carrinho abandonado, boleto, Pix, reembolso'],
    email_aberto: ['Abriu um e-mail', 'Quando o contato abre um e-mail (de campanha ou de automação)'],
    email_clicou: ['Clicou num e-mail', 'Quando o contato clica num link de e-mail'],
    visitou: ['Visitou o site', 'Quando um contato conhecido visita uma página do seu site'],
    manual: ['Manual', 'Só quando alguém inicia (na ficha, em massa ou por outra automação)']
  };
  var TIPOS = {
    mensagem: ['Enviar mensagem', 'conversas', 'c-msg', 'Texto, imagem, áudio ou documento'],
    pergunta: ['Fazer pergunta', 'pergunta', 'c-perg', 'Espera a resposta e salva num campo'],
    menu: ['Menu de opções', 'lista', 'c-perg', 'Opções que levam a caminhos diferentes (botões na API oficial e no Instagram)'],
    formulario: ['Formulário', 'nota', 'c-perg', 'Coleta vários dados: numa mensagem só na API oficial (WhatsApp Flow) ou uma pergunta por vez'],
    esperar: ['Esperar', 'relogio', 'c-tempo', 'Minutos, horas ou dias'],
    condicao: ['Condição', 'bifurca', 'c-cond', 'Se/senão por tag, campo, etapa ou horário'],
    tag: ['Tag', 'tag', 'c-acao', 'Adicionar ou remover tag'],
    etapa: ['Mover no funil', 'negocios', 'c-acao', 'Cria ou move o negócio de etapa'],
    atribuir: ['Atribuir atendente', 'equipe', 'c-acao', 'Rodízio ou pessoa fixa'],
    campo: ['Salvar campo', 'nota', 'c-acao', 'Grava um valor no contato'],
    status: ['Mudar status', 'bandeira', 'c-acao', 'Lead, cliente ou inativo'],
    tarefa: ['Criar tarefa', 'tarefas', 'c-acao', 'Lembrete para a equipe'],
    humano: ['Passar para humano', 'usuarioMais', 'c-humano', 'Pausa o robô e avisa a equipe'],
    passar: ['Passar para closer', 'passar', 'c-humano', 'Entrega o lead qualificado a um closer (rodízio ou fixo)'],
    pontos: ['Pontuar lead', 'estrela', 'c-acao', 'Soma pontos para saber quem está mais pronto para comprar'],
    responder_comentario: ['Responder comentário', 'instagram', 'c-msg', 'Resposta pública no post do Instagram'],
    email: ['Enviar e-mail', 'email', 'c-msg', 'Manda um e-mail pronto (feito em E-mail marketing)'],
    activecampaign: ['Enviar ao ActiveCampaign', 'email', 'c-acao', 'Cria ou atualiza o contato lá e aplica tags'],
    webhook: ['Enviar webhook', 'webhook', 'c-acao', 'Avisa outro sistema (n8n, Make, Zapier)'],
    ir: ['Ir para passo', 'seta', 'c-cond', 'Pula para outro passo do fluxo'],
    fim: ['Encerrar', 'x', 'c-acao', 'Termina o fluxo aqui']
  };

  var EVENTOS = { compra_aprovada: 'Compra aprovada', carrinho_abandonado: 'Carrinho abandonado', boleto_gerado: 'Boleto gerado', pix_gerado: 'Pix gerado', reembolso: 'Reembolso ou chargeback', cancelado: 'Cancelamento', recusado: 'Pagamento recusado' };

  var MODELOS = [
    { id: 'branco', nome: 'Em branco', desc: 'Comece do zero', a: { nome: 'Nova automação', gatilho: { tipo: 'manual' }, passos: [] } },
    { id: 'boasvindas', nome: 'Boas-vindas para lead de formulário', desc: 'Mensagem automática quando um lead chega pelo site ou anúncio', a: { nome: 'Boas-vindas para novo lead', gatilho: { tipo: 'webhook', origem: '' }, uma_vez: 'SIM', passos: [
      { tipo: 'mensagem', texto: '{saudacao}, {primeiro_nome}! Aqui é da {minha_empresa}. Recebemos seu cadastro e já vamos te atender por aqui.' },
      { tipo: 'esperar', valor: 2, unidade: 'minutos' },
      { tipo: 'pergunta', texto: 'Para agilizar: o que você está buscando hoje?', campo: 'interesse', validar: 'texto', expira_horas: 24 },
      { tipo: 'atribuir', modo: 'rodizio' },
      { tipo: 'tarefa', titulo: 'Atender {nome} (lead do site)', prazo_horas: 1 }] } },
    { id: 'qualificacao', nome: 'Qualificação com perguntas', desc: 'Coleta nome, e-mail e interesse e marca como lead quente', a: { nome: 'Qualificação de lead', gatilho: { tipo: 'palavra', palavras: 'quero, tenho interesse, orçamento', modo: 'contem' }, passos: [
      { tipo: 'pergunta', texto: 'Que bom! Para eu te ajudar melhor, qual é o seu nome?', campo: 'nome', validar: 'texto' },
      { tipo: 'pergunta', texto: 'Prazer, {primeiro_nome}! Qual o seu e-mail?', campo: 'email', validar: 'email', erro_texto: 'Esse e-mail parece incompleto. Pode conferir?' },
      { tipo: 'menu', texto: 'Qual opção combina mais com você?', campo: 'interesse', opcoes: [{ rotulo: 'Quero comprar agora', ir: '' }, { rotulo: 'Estou pesquisando', ir: '' }] },
      { tipo: 'tag', acao: 'add', tag: 'Lead quente' },
      { tipo: 'humano', horas: 24, titulo: 'Lead qualificado: {nome}' },
      { tipo: 'mensagem', texto: 'Perfeito! Um especialista já vai falar com você.' }] } },
    { id: 'foraexpediente', nome: 'Fora do horário de atendimento', desc: 'Avisa o horário quando alguém escreve fora do expediente', a: { nome: 'Fora do expediente', gatilho: { tipo: 'palavra', qualquer: true, palavras: '', modo: 'contem' }, passos: [
      { tipo: 'condicao', se: 'horario', inicio: '08:00', fim: '18:00', dias: '1,2,3,4,5', sim: 'fim', nao: '' },
      { tipo: 'mensagem', texto: 'Oi {primeiro_nome}! Nosso atendimento é de segunda a sexta, das 8h às 18h. Assim que abrirmos, respondemos sua mensagem.' }] } },
    { id: 'recuperacao', nome: 'Recuperar quem sumiu', desc: 'Sequência de lembretes para quem não respondeu', a: { nome: 'Recuperação de contato parado', gatilho: { tipo: 'tag', tag: 'Retornar' }, passos: [
      { tipo: 'mensagem', texto: 'Oi {primeiro_nome}, tudo bem? Vi que a gente não conseguiu concluir nossa conversa. Posso te ajudar com algo?' },
      { tipo: 'esperar', valor: 2, unidade: 'dias' },
      { tipo: 'mensagem', texto: '{primeiro_nome}, separei uma condição especial para você esta semana. Quer que eu te explique?' },
      { tipo: 'esperar', valor: 3, unidade: 'dias' },
      { tipo: 'tag', acao: 'remover', tag: 'Retornar' },
      { tipo: 'status', valor: 'inativo' }] } },
    { id: 'posvenda', nome: 'Pós-venda e indicação', desc: 'Agradece, pede avaliação e indicação depois da venda', a: { nome: 'Pós-venda', gatilho: { tipo: 'etapa', etapa_id: '' }, uma_vez: 'SIM', passos: [
      { tipo: 'mensagem', texto: 'Muito obrigado pela confiança, {primeiro_nome}! Qualquer dúvida, estamos por aqui.' },
      { tipo: 'esperar', valor: 7, unidade: 'dias' },
      { tipo: 'menu', texto: 'De 1 a 3, como foi sua experiência com a {minha_empresa}?', campo: 'avaliacao', opcoes: [{ rotulo: 'Excelente', ir: '' }, { rotulo: 'Boa', ir: '' }, { rotulo: 'Pode melhorar', ir: '' }] },
      { tipo: 'mensagem', texto: 'Obrigado pela resposta! Se conhecer alguém que precise, indique a gente. Isso ajuda muito.' }] } },
    { id: 'sdr', nome: 'Qualificação e passagem para closer', desc: 'O robô pontua o lead pelas respostas e entrega os prontos para um closer', a: { nome: 'Qualificar e passar para closer', gatilho: { tipo: 'primeira_mensagem' }, passos: [
      { id: 'q1', tipo: 'formulario', texto: '{saudacao}! Para te atender melhor, preciso de 2 informações rápidas.', perguntas: [{ campo: 'nome', texto: 'Qual é o seu nome?', validar: 'texto' }, { campo: 'email', texto: 'E o seu melhor e-mail?', validar: 'email' }], expira_horas: 12 },
      { id: 'q2', tipo: 'menu', texto: 'Quando você pretende começar, {primeiro_nome}?', campo: 'prazo', opcoes: [{ rotulo: 'Agora, este mês', ir: 'q3' }, { rotulo: 'Nos próximos 3 meses', ir: 'q4' }, { rotulo: 'Só pesquisando', ir: 'q6' }] },
      { id: 'q3', tipo: 'pontos', acao: 'somar', valor: 50 },
      { id: 'q4', tipo: 'pontos', acao: 'somar', valor: 20 },
      { id: 'q5', tipo: 'condicao', se: 'campo', campo: 'pontos', op: 'maior', valor: '40', sim: 'q8', nao: 'q6' },
      { id: 'q6', tipo: 'mensagem', texto: 'Combinado! Vou te mandar alguns conteúdos para ajudar na sua decisão. Qualquer dúvida, é só chamar.' },
      { id: 'q7', tipo: 'fim' },
      { id: 'q8', tipo: 'passar', modo: 'rodizio', nota: 'Lead quer começar este mês. Interesse: {interesse}' },
      { id: 'q9', tipo: 'mensagem', texto: 'Perfeito! Um especialista vai falar com você em instantes para montar a melhor opção.' }] } },
    { id: 'carrinho', nome: 'Recuperar carrinho abandonado', desc: 'Hotmart ou Kiwify: lembra quem não finalizou a compra', a: { nome: 'Recuperar carrinho abandonado', gatilho: { tipo: 'evento', evento: 'carrinho_abandonado' }, uma_vez: 'NAO', passos: [
      { tipo: 'esperar', valor: 20, unidade: 'minutos' },
      { tipo: 'mensagem', texto: 'Oi {primeiro_nome}, vi que você começou sua inscrição mas não finalizou. Ficou alguma dúvida? Posso te ajudar por aqui.' },
      { tipo: 'esperar', valor: 1, unidade: 'dias' },
      { tipo: 'mensagem', texto: '{primeiro_nome}, sua vaga ainda está separada. Se quiser, te mando o link de novo para concluir.' },
      { tipo: 'tarefa', titulo: 'Ligar para {nome} (carrinho abandonado)', prazo_horas: 4 }] } },
    { id: 'boleto', nome: 'Lembrete de boleto e Pix', desc: 'Hotmart ou Kiwify: ajuda a pessoa a concluir o pagamento', a: { nome: 'Lembrete de boleto e Pix', gatilho: { tipo: 'evento', evento: 'boleto_gerado' }, passos: [
      { tipo: 'esperar', valor: 2, unidade: 'horas' },
      { tipo: 'mensagem', texto: 'Oi {primeiro_nome}! Seu boleto já foi gerado. Assim que o pagamento compensar, você recebe o acesso. Precisa de ajuda com alguma coisa?' },
      { tipo: 'esperar', valor: 1, unidade: 'dias' },
      { tipo: 'mensagem', texto: '{primeiro_nome}, passando para lembrar que o boleto vence em breve. Se preferir, posso gerar um Pix para você.' }] } },
    { id: 'comprador', nome: 'Boas-vindas ao comprador', desc: 'Mensagem quando a compra é aprovada', a: { nome: 'Boas-vindas ao comprador', gatilho: { tipo: 'evento', evento: 'compra_aprovada' }, uma_vez: 'NAO', passos: [
      { tipo: 'mensagem', texto: 'Parabéns pela compra, {primeiro_nome}! Seja muito bem-vindo(a). Seu acesso chega no seu e-mail. Qualquer dúvida, fale com a gente por aqui.' },
      { tipo: 'tag', acao: 'add', tag: 'Cliente' }] } },
    { id: 'emailwhats', nome: 'E-mail e WhatsApp juntos', desc: 'Manda um e-mail; quem não abrir em 2 dias recebe no WhatsApp', a: { nome: 'E-mail com reforço no WhatsApp', gatilho: { tipo: 'webhook', origem: '' }, uma_vez: 'SIM', passos: [
      { id: 'w1', tipo: 'email', email_id: '' },
      { id: 'w2', tipo: 'esperar', valor: 2, unidade: 'dias' },
      { id: 'w3', tipo: 'condicao', se: 'email', op: 'nao_abriu', valor: '', sim: 'w4', nao: 'fim' },
      { id: 'w4', tipo: 'mensagem', texto: 'Oi {primeiro_nome}! Te mandei um e-mail com os detalhes. Quer que eu te mande por aqui mesmo?' }] } },
    { id: 'visita', nome: 'Visitou a página de preços', desc: 'Quem clicou num e-mail e voltou à página de preços ganha pontos e um contato', a: { nome: 'Visitou a página de preços', gatilho: { tipo: 'visitou', url: 'preco' }, uma_vez: 'SIM', passos: [
      { tipo: 'pontos', acao: 'somar', valor: 30 },
      { tipo: 'tag', acao: 'add', tag: 'Viu preços' },
      { tipo: 'tarefa', titulo: 'Ligar para {nome} (viu a página de preços)', prazo_horas: 2 }] } },
    { id: 'comentario', nome: 'Comentou no post, recebe no Direct', desc: 'Instagram: quem comenta a palavra recebe o link no privado', a: { nome: 'Comentário no Instagram para Direct', gatilho: { tipo: 'comentario', palavras: 'eu quero, quero, link', modo: 'contem' }, passos: [
      { tipo: 'responder_comentario', texto: '{Te chamei no Direct!|Olha seu Direct!|Enviei no seu Direct}' },
      { tipo: 'mensagem', texto: 'Oi! Vi seu comentário. Aqui está o que você pediu: https://seusite.com.br' },
      { tipo: 'tag', acao: 'add', tag: 'Comentou no Instagram' }] } }
  ];

  function novoId() { return 's' + Math.random().toString(36).slice(2, 8); }

  C.views.automacoes = {
    titulo: 'Automações',
    acoes: function () { return editando ? '' : '<button class="btn pri" data-a="nova">' + ic('plus') + '<span class="txt"> Nova automação</span></button>'; },
    ligarAcoes: function (el) { var b = el.querySelector('[data-a=nova]'); if (b) b.onclick = escolherModelo; },
    sair: function () { editando = null; },
    render: function (el) { if (editando) renderEditor(el); else renderLista(el); }
  };

  function resumoGatilho(g) {
    g = g || {};
    var n = (GATILHOS[g.tipo] || ['?'])[0];
    if (g.tipo === 'palavra') return n + ': ' + (g.qualquer && !g.palavras ? 'qualquer mensagem' : '"' + (g.palavras || '') + '"');
    if (g.tipo === 'tag') return n + ': ' + (g.tag || '?');
    if (g.tipo === 'etapa') { var e = C.etapa(g.etapa_id); return n + ': ' + (e ? e.nome : 'escolha a etapa'); }
    if ((g.tipo === 'webhook' || g.tipo === 'novo_contato') && g.origem) return n + ' (origem: ' + g.origem + ')';
    if (g.tipo === 'comentario') return n + ': ' + (g.palavras ? '"' + g.palavras + '"' : 'qualquer comentário');
    if (g.tipo === 'evento') return n + ': ' + (EVENTOS[g.evento] || 'escolha o evento') + (g.produto ? ' (' + g.produto + ')' : '');
    if (g.tipo === 'email_aberto' || g.tipo === 'email_clicou') return n + ': ' + (g.email_id ? nomeEmail(g.email_id) : 'qualquer e-mail') + (g.link ? ' (link com "' + g.link + '")' : '');
    if (g.tipo === 'visitou') return n + (g.url ? ': página com "' + g.url + '"' : ': qualquer página');
    return n;
  }

  function nomeEmail(id) { var e = (S.emails || []).filter(function (x) { return x.id === id; })[0]; return e ? e.nome : '(e-mail removido)'; }
  function opcoesEmails(atual, vazio) {
    return (vazio ? '<option value="">' + vazio + '</option>' : '') + (S.emails || []).map(function (e) { return '<option value="' + e.id + '"' + (atual === e.id ? ' selected' : '') + '>' + esc(e.nome) + (e.tipo === 'automacao' ? '' : ' (campanha)') + '</option>'; }).join('');
  }

  function renderLista(el) {
    if (!S.automacoes.length) {
      el.innerHTML = '<div class="card vazio">' + ic('automacoes') + '<h3>Nenhuma automação</h3><p>Automações respondem, qualificam e acompanham seus contatos sozinhas, 24 horas por dia.</p><button class="btn pri" id="v-nova">' + ic('plus') + ' Criar a primeira</button></div>';
      C.$('#v-nova').onclick = escolherModelo;
      return;
    }
    var semApi = S.waStatus && S.waStatus.provedor === 'link';
    el.innerHTML = (semApi ? '<div class="aviso">' + ic('alerta') + '<div>As automações que enviam mensagens precisam de uma API de WhatsApp conectada. No modo link, só as ações internas (tags, funil, tarefas) funcionam.</div></div>' : '') +
      '<div class="lista-cards">' + S.automacoes.map(function (a) {
        var passos = C.json(a.passos, []);
        return '<div class="card item-card"><div class="passo-ic c-msg" style="width:42px;height:42px">' + ic('robo') + '</div><div class="meio"><h3 class="trunc">' + esc(a.nome) + '</h3>' +
          '<div class="small muted trunc">' + ic('raio').replace('class="i ', 'style="width:13px;height:13px;vertical-align:-2px" class="i ') + ' ' + esc(resumoGatilho(C.json(a.gatilho, {}))) + ' · ' + passos.length + ' passos</div>' +
          '<div class="small muted">' + C.inteiro(a.disparos) + ' entradas · ' + C.inteiro(a.concluidas) + ' concluídas</div></div>' +
          '<label class="check" style="margin:0" title="Ativar ou desativar"><input type="checkbox" data-ativo="' + a.id + '"' + (a.ativo === 'SIM' ? ' checked' : '') + '> <span class="small">' + (a.ativo === 'SIM' ? 'Ativa' : 'Desligada') + '</span></label>' +
          '<button class="btn peq" data-exec="' + a.id + '">' + ic('olho') + '<span class="txt"> Execuções</span></button>' +
          '<button class="btn peq pri" data-edit="' + a.id + '">' + ic('lapis') + ' Editar</button></div>';
      }).join('') + '</div>';
    C.$$('[data-ativo]', el).forEach(function (cb) {
      cb.onchange = function () {
        var a = S.automacoes.filter(function (x) { return x.id === cb.dataset.ativo; })[0];
        var v = cb.checked ? 'SIM' : 'NAO';
        C.api('automacao.ativar', { id: a.id, ativo: v }).then(function () { a.ativo = v; C.toast(v === 'SIM' ? 'Automação ativada' : 'Automação desligada', 'ok'); renderLista(el); }).catch(function (e) { cb.checked = !cb.checked; C.toast(e.message, 'erro'); });
      };
    });
    C.$$('[data-edit]', el).forEach(function (b) { b.onclick = function () { abrirEditor(S.automacoes.filter(function (x) { return x.id === b.dataset.edit; })[0]); }; });
    C.$$('[data-exec]', el).forEach(function (b) { b.onclick = function () { verExecucoes(b.dataset.exec); }; });
  }

  function escolherModelo() {
    var el = C.modal({
      titulo: 'Nova automação', tamanho: 'largo',
      corpo: '<p class="muted" style="margin-top:0">Escolha um modelo pronto e ajuste o texto, ou comece em branco.</p><div class="tipos-passo">' + MODELOS.map(function (m) {
        return '<button class="tipo-passo" data-mod="' + m.id + '"><span class="passo-ic c-msg">' + ic(m.id === 'branco' ? 'plus' : 'robo') + '</span><div><b>' + esc(m.nome) + '</b><span>' + esc(m.desc) + '</span></div></button>';
      }).join('') + '</div>'
    });
    C.$$('[data-mod]', el).forEach(function (b) {
      b.onclick = function () {
        var m = MODELOS.filter(function (x) { return x.id === b.dataset.mod; })[0];
        var a = JSON.parse(JSON.stringify(m.a));
        a.passos.forEach(function (p) { p.id = p.id || novoId(); });
        a.ativo = 'NAO';
        el.fechar();
        abrirEditor(a);
      };
    });
  }

  function abrirEditor(a) {
    editando = {
      id: a.id, nome: a.nome, ativo: a.ativo || 'NAO', uma_vez: a.uma_vez || 'NAO',
      gatilho: JSON.parse(JSON.stringify(C.json(a.gatilho, { tipo: 'manual' }))),
      passos: JSON.parse(JSON.stringify(C.json(a.passos, [])))
    };
    C.render();
  }

  function rotuloPasso(id) {
    if (!id) return 'próximo passo';
    if (id === 'fim') return 'encerrar';
    var i = editando.passos.findIndex(function (p) { return p.id === id; });
    return i >= 0 ? 'passo ' + (i + 1) : '(passo removido)';
  }

  function resumoPasso(p) {
    switch (p.tipo) {
      case 'mensagem': return (p.midia_url ? '[' + (p.midia_tipo || 'mídia') + '] ' : '') + (p.texto || '') + (p.meta_modelo ? '\n> janela fechada: modelo ' + p.meta_modelo : '');
      case 'formulario': return (p.flow_id ? 'WhatsApp Flow ' + p.flow_id + ' (API oficial). ' : '') + (p.perguntas || []).map(function (q) { return q.texto; }).join(' / ');
      case 'passar': return p.modo === 'usuario' ? 'Para ' + ((C.usuario(p.usuario_id) || {}).nome || '?') : 'Rodízio entre os closers';
      case 'pontos': return p.acao === 'zerar' ? 'Zerar pontuação' : (Number(p.valor) >= 0 ? '+' : '') + (p.valor || 0) + ' pontos';
      case 'responder_comentario': return p.texto || '';
      case 'activecampaign': return 'Tags: ' + (p.tags || 'nenhuma');
      case 'email': return p.email_id ? nomeEmail(p.email_id) : 'Escolha o e-mail';
      case 'pergunta': return (p.texto || '') + '\n> salva em: ' + (p.campo || '(não salva)') + (p.validar && p.validar !== 'texto' ? ' · valida ' + p.validar : '');
      case 'menu': return p.texto || '';
      case 'esperar': return p.valor + ' ' + p.unidade;
      case 'condicao': return descCond(p);
      case 'tag': return (p.acao === 'remover' ? 'Remover ' : 'Adicionar ') + '"' + (p.tag || '') + '"';
      case 'etapa': var e = C.etapa(p.etapa_id); return e ? 'Para "' + e.nome + '"' : 'Escolha a etapa';
      case 'atribuir': return p.modo === 'usuario' ? 'Para ' + ((C.usuario(p.usuario_id) || {}).nome || '?') : p.modo === 'closer' ? 'Rodízio entre closers' : 'Rodízio entre quem recebe leads';
      case 'campo': return (p.campo || '?') + ' = ' + (p.valor || '');
      case 'status': return 'Status: ' + (p.valor || '');
      case 'tarefa': return (p.titulo || '') + ' (prazo ' + (p.prazo_horas || 24) + 'h)';
      case 'humano': return 'Robô pausado por ' + (p.horas || 24) + 'h e tarefa criada para a equipe';
      case 'webhook': return p.url || 'sem URL';
      case 'ir': return 'Vai para o ' + rotuloPasso(p.passo);
      case 'fim': return 'Fim do fluxo';
    }
    return '';
  }
  function descCond(p) {
    if (p.se === 'tag') return 'Se ' + (p.op === 'nao_tem' ? 'NÃO tem' : 'tem') + ' a tag "' + (p.valor || '') + '"';
    if (p.se === 'etapa') { var e = C.etapa(p.valor); return 'Se ' + (p.op === 'nao_tem' ? 'NÃO está' : 'está') + ' na etapa "' + (e ? e.nome : '?') + '"'; }
    if (p.se === 'email') return 'Se ' + ({ abriu: 'abriu', nao_abriu: 'NÃO abriu', clicou: 'clicou em', nao_clicou: 'NÃO clicou em' }[p.op] || 'abriu') + ' ' + (p.valor ? '"' + nomeEmail(p.valor) + '"' : 'algum e-mail');
    if (p.se === 'horario') return 'Se agora está entre ' + (p.inicio || '08:00') + ' e ' + (p.fim || '18:00') + ' (dias ' + (p.dias || '1-5') + ')';
    return 'Se o campo "' + (p.campo || '?') + '" ' + ({ igual: 'é igual a', diferente: 'é diferente de', contem: 'contém', vazio: 'está vazio', preenchido: 'está preenchido', maior: 'é maior que', menor: 'é menor que' }[p.op] || p.op) + (['vazio', 'preenchido'].indexOf(p.op) >= 0 ? '' : ' "' + (p.valor || '') + '"');
  }

  function renderEditor(el) {
    var e = editando;
    var g = e.gatilho;
    var h = '<div class="barra-ferr"><button class="btn" id="ed-volta">' + ic('esq') + ' Voltar</button>' +
      '<input class="inp" id="ed-nome" style="max-width:380px;font-weight:600" value="' + esc(e.nome) + '" aria-label="Nome da automação">' +
      '<div class="dir"><label class="check" style="margin:0"><input type="checkbox" id="ed-ativo"' + (e.ativo === 'SIM' ? ' checked' : '') + '> Ativa</label>' +
      (e.id ? '<button class="btn" id="ed-testar">' + ic('play') + ' Testar</button><button class="btn perigo" id="ed-exc" aria-label="Excluir">' + ic('lixo') + '</button>' : '') +
      '<button class="btn pri" id="ed-salvar" data-carregando=" Salvando...">Salvar</button></div></div>';
    h += '<div class="fluxo"><div class="passo passo-gat"><div class="passo-cab"><span class="passo-ic" style="background:var(--pri);color:var(--pri-txt)">' + ic('raio') + '</span><div><div class="passo-num">QUANDO</div><b>' + esc(resumoGatilho(g)) + '</b></div>' +
      '<div class="acoes"><button class="btn peq" id="ed-gat">' + ic('lapis') + ' Alterar</button></div></div>' +
      '<div class="passo-res"><label class="check" style="margin:6px 0 0"><input type="checkbox" id="ed-umavez"' + (e.uma_vez === 'SIM' ? ' checked' : '') + '> Cada contato entra só uma vez nesta automação</label></div></div>';
    h += conector(0);
    e.passos.forEach(function (p, i) {
      var t = TIPOS[p.tipo] || ['?', 'info', 'c-acao'];
      h += '<div class="passo" id="p-' + p.id + '"><div class="passo-cab"><span class="passo-ic ' + t[2] + '">' + ic(t[1]) + '</span><div><div class="passo-num">PASSO ' + (i + 1) + '</div><b>' + t[0] + '</b></div>' +
        '<div class="acoes"><button class="btn fantasma ic peq" data-up="' + i + '" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>' + ic('cima') + '</button><button class="btn fantasma ic peq" data-down="' + i + '" aria-label="Descer"' + (i === e.passos.length - 1 ? ' disabled' : '') + '>' + ic('baixo') + '</button>' +
        '<button class="btn fantasma ic peq" data-edp="' + i + '" aria-label="Editar">' + ic('lapis') + '</button><button class="btn fantasma ic peq perigo" data-del="' + i + '" aria-label="Remover">' + ic('lixo') + '</button></div></div>' +
        '<div class="passo-res">' + esc(resumoPasso(p)) +
        (p.tipo === 'menu' ? '<div>' + (p.opcoes || []).map(function (o, k) { return '<span class="ramo op">' + (k + 1) + '. ' + esc(o.rotulo) + ' > ' + rotuloPasso(o.ir) + '</span>'; }).join('') + '</div>' : '') +
        (p.tipo === 'condicao' ? '<div><span class="ramo sim">Sim > ' + rotuloPasso(p.sim) + '</span><span class="ramo nao">Não > ' + rotuloPasso(p.nao) + '</span></div>' : '') +
        ((p.tipo === 'pergunta' || p.tipo === 'menu' || p.tipo === 'formulario') && p.expira_horas ? '<div><span class="ramo nao">Sem resposta em ' + p.expira_horas + 'h > ' + rotuloPasso(p.sem_resposta || 'fim') + '</span></div>' : '') +
        '</div></div>' + conector(i + 1);
    });
    if (!e.passos.length) h += '<p class="small muted" style="text-align:center">Clique no + para adicionar o primeiro passo.</p>';
    h += '<div class="aviso info" style="margin-top:20px">' + ic('info') + '<div>Variáveis que você pode usar nos textos: <b>{primeiro_nome}</b>, <b>{nome}</b>, <b>{saudacao}</b> (bom dia/boa tarde), <b>{minha_empresa}</b>, <b>{atendente}</b>, <b>{empresa}</b>, <b>{email}</b> e os campos personalizados. Para variar o texto e evitar bloqueio: <b>{Oi|Olá|E aí}</b> sorteia uma das opções.</div></div></div>';
    el.innerHTML = h;
    var ler = function () { e.nome = C.$('#ed-nome').value; e.ativo = C.$('#ed-ativo').checked ? 'SIM' : 'NAO'; e.uma_vez = C.$('#ed-umavez').checked ? 'SIM' : 'NAO'; };
    C.$('#ed-volta').onclick = function () { editando = null; C.render(); };
    C.$('#ed-gat').onclick = function () { ler(); editarGatilho(); };
    C.$$('[data-add]', el).forEach(function (b) { b.onclick = function () { ler(); escolherTipo(Number(b.dataset.add)); }; });
    C.$$('[data-edp]', el).forEach(function (b) { b.onclick = function () { ler(); editarPasso(Number(b.dataset.edp)); }; });
    C.$$('[data-del]', el).forEach(function (b) { b.onclick = function () { ler(); e.passos.splice(Number(b.dataset.del), 1); C.render(); }; });
    C.$$('[data-up]', el).forEach(function (b) { b.onclick = function () { ler(); var i = Number(b.dataset.up); var x = e.passos.splice(i, 1)[0]; e.passos.splice(i - 1, 0, x); C.render(); }; });
    C.$$('[data-down]', el).forEach(function (b) { b.onclick = function () { ler(); var i = Number(b.dataset.down); var x = e.passos.splice(i, 1)[0]; e.passos.splice(i + 1, 0, x); C.render(); }; });
    C.$('#ed-salvar').onclick = function () {
      ler();
      C.comBotao(this, function () {
        if (!e.passos.length) throw new Error('Adicione pelo menos um passo.');
        if (e.gatilho.tipo === 'etapa' && !e.gatilho.etapa_id) throw new Error('Escolha a etapa do gatilho.');
        if (e.gatilho.tipo === 'tag' && !e.gatilho.tag) throw new Error('Escolha a tag do gatilho.');
        var semEmail = e.passos.findIndex(function (p) { return p.tipo === 'email' && !p.email_id; });
        if (semEmail >= 0) throw new Error('Escolha o e-mail no passo ' + (semEmail + 1) + '.');
        return C.api('automacao.salvar', { automacao: e }).then(function (r) {
          var i = S.automacoes.findIndex(function (x) { return x.id === r.id; });
          if (i >= 0) S.automacoes[i] = r; else S.automacoes.push(r);
          e.id = r.id;
          C.toast('Automação salva', 'ok');
          editando = null; C.render();
        });
      });
    };
    var ex = C.$('#ed-exc');
    if (ex) ex.onclick = function () {
      C.confirmar('Excluir a automação <b>' + esc(e.nome) + '</b>? Quem estiver no meio do fluxo para de receber as mensagens.', { perigo: true, botao: 'Excluir' }).then(function (ok) {
        if (!ok) return;
        return C.api('automacao.excluir', { id: e.id }).then(function () { S.automacoes = S.automacoes.filter(function (x) { return x.id !== e.id; }); editando = null; C.render(); });
      }).catch(function (er) { C.toast(er.message, 'erro'); });
    };
    var ts = C.$('#ed-testar');
    if (ts) ts.onclick = function () { ler(); testar(); };
  }
  function conector(pos) { return '<div class="conector"><span class="linha-v"></span><button class="add-passo" data-add="' + pos + '" aria-label="Adicionar passo">' + ic('plus') + '</button><span class="linha-v"></span></div>'; }

  function editarGatilho() {
    var g = editando.gatilho;
    var etapas = '';
    S.funis.forEach(function (f) { etapas += '<optgroup label="' + esc(f.nome) + '">' + f.etapas.map(function (x) { return '<option value="' + x.id + '"' + (g.etapa_id === x.id ? ' selected' : '') + '>' + esc(x.nome) + '</option>'; }).join('') + '</optgroup>'; });
    var el = C.modal({
      titulo: 'Quando a automação começa', tamanho: 'largo',
      corpo: '<div class="tipos-passo" style="margin-bottom:16px">' + Object.keys(GATILHOS).map(function (k) { return '<button class="tipo-passo" data-g="' + k + '" style="' + (g.tipo === k ? 'border-color:var(--pri);background:var(--pri-soft)' : '') + '"><div><b>' + GATILHOS[k][0] + '</b><span>' + GATILHOS[k][1] + '</span></div></button>'; }).join('') + '</div>' +
        '<div id="g-extra"></div>',
      pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="g-ok">Aplicar</button>'
    });
    var tipo = g.tipo;
    var extra = function () {
      var x = el.querySelector('#g-extra');
      if (tipo === 'palavra') x.innerHTML = '<div class="campo"><label>Palavras (separadas por vírgula)</label><input class="inp" id="g-pal" value="' + esc(g.palavras || '') + '" placeholder="preço, valor, quanto custa"><span class="ajuda">Maiúsculas e acentos não importam.</span></div>' +
        '<div class="grade2"><div class="campo"><label>Como comparar</label><select class="inp" id="g-modo"><option value="contem"' + (g.modo !== 'exata' ? ' selected' : '') + '>A mensagem contém a palavra</option><option value="exata"' + (g.modo === 'exata' ? ' selected' : '') + '>A mensagem é exatamente a palavra</option></select></div>' +
        '<div class="campo"><label>&nbsp;</label><label class="check"><input type="checkbox" id="g-qq"' + (g.qualquer ? ' checked' : '') + '> Sem palavras = responde qualquer mensagem</label></div></div>';
      else if (tipo === 'tag') x.innerHTML = '<div class="campo"><label>Tag</label><input class="inp" id="g-tag" list="g-tags" value="' + esc(g.tag || '') + '"><datalist id="g-tags">' + C.todasTags().map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist></div>';
      else if (tipo === 'etapa') x.innerHTML = '<div class="campo"><label>Etapa</label><select class="inp" id="g-etapa"><option value="">Escolha</option>' + etapas + '</select></div>';
      else if (tipo === 'webhook' || tipo === 'novo_contato') x.innerHTML = '<div class="campo"><label>Só para a origem (opcional)</label><input class="inp" id="g-origem" value="' + esc(g.origem || '') + '" placeholder="Ex.: Site, Anúncio, Typebot"><span class="ajuda">Vazio = qualquer origem. A origem vem do parâmetro <b>origem=</b> na URL do webhook.</span></div>';
      else if (tipo === 'comentario') x.innerHTML = '<div class="campo"><label>Palavras no comentário (separadas por vírgula)</label><input class="inp" id="g-pal" value="' + esc(g.palavras || '') + '" placeholder="eu quero, link, preço"><span class="ajuda">Vazio = qualquer comentário.</span></div>' +
        '<div class="campo"><label>Só neste post (opcional)</label><input class="inp" id="g-post" value="' + esc(g.post || '') + '" placeholder="ID do post"><span class="ajuda">Vazio = todos os posts. O ID aparece no histórico do contato depois do primeiro comentário.</span></div>' +
        (S.config.instagram ? '' : '<div class="aviso">' + ic('alerta') + '<div>Conecte o Instagram em Integrações para este gatilho funcionar.</div></div>');
      else if (tipo === 'evento') x.innerHTML = '<div class="grade2"><div class="campo"><label>Evento</label><select class="inp" id="g-ev">' + Object.keys(EVENTOS).map(function (k) { return '<option value="' + k + '"' + (g.evento === k ? ' selected' : '') + '>' + EVENTOS[k] + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label>Só para o produto (opcional)</label><input class="inp" id="g-prod" value="' + esc(g.produto || '') + '" placeholder="Parte do nome do produto"></div></div><p class="small muted">Os eventos chegam pelas integrações da Hotmart e da Kiwify.</p>';
      else if (tipo === 'email_aberto' || tipo === 'email_clicou') x.innerHTML = '<div class="campo"><label>Qual e-mail</label><select class="inp" id="g-email">' + opcoesEmails(g.email_id, 'Qualquer e-mail') + '</select></div>' +
        (tipo === 'email_clicou' ? '<div class="campo"><label>Só links que contêm (opcional)</label><input class="inp" id="g-link" value="' + esc(g.link || '') + '" placeholder="agendar"></div>' : '');
      else if (tipo === 'visitou') x.innerHTML = '<div class="campo"><label>Página com este trecho no endereço (opcional)</label><input class="inp" id="g-url" value="' + esc(g.url || '') + '" placeholder="/precos"><span class="ajuda">Precisa do script de rastreio no site (Integrações > Rastreio do site). Só contatos que já clicaram num e-mail são reconhecidos.</span></div>';
      else if (tipo === 'primeira_mensagem') x.innerHTML = '<div class="aviso info">' + ic('info') + '<div>Dispara quando um número que nunca falou com você manda mensagem. Ideal para menu de boas-vindas.</div></div>';
      else x.innerHTML = '';
    };
    extra();
    C.$$('[data-g]', el).forEach(function (b) {
      b.onclick = function () { tipo = b.dataset.g; C.$$('[data-g]', el).forEach(function (y) { y.style.cssText = y === b ? 'border-color:var(--pri);background:var(--pri-soft)' : ''; }); extra(); };
    });
    el.querySelector('#g-ok').onclick = function () {
      var n = { tipo: tipo };
      var v = function (id) { var i = el.querySelector('#' + id); return i ? (i.type === 'checkbox' ? i.checked : i.value.trim()) : ''; };
      if (tipo === 'palavra') { n.palavras = v('g-pal'); n.modo = v('g-modo'); n.qualquer = v('g-qq'); if (!n.palavras && !n.qualquer) { C.toast('Informe as palavras', 'erro'); return; } }
      if (tipo === 'tag') n.tag = v('g-tag');
      if (tipo === 'etapa') n.etapa_id = v('g-etapa');
      if (tipo === 'webhook' || tipo === 'novo_contato') n.origem = v('g-origem');
      if (tipo === 'comentario') { n.palavras = v('g-pal'); n.modo = 'contem'; n.post = v('g-post'); }
      if (tipo === 'evento') { n.evento = v('g-ev'); n.produto = v('g-prod'); }
      if (tipo === 'email_aberto' || tipo === 'email_clicou') { n.email_id = v('g-email'); n.link = v('g-link'); }
      if (tipo === 'visitou') n.url = v('g-url');
      editando.gatilho = n;
      el.fechar(); C.render();
    };
  }

  function escolherTipo(pos) {
    var el = C.modal({
      titulo: 'Adicionar passo', tamanho: 'largo',
      corpo: '<div class="tipos-passo">' + Object.keys(TIPOS).map(function (k) { var t = TIPOS[k]; return '<button class="tipo-passo" data-t="' + k + '"><span class="passo-ic ' + t[2] + '">' + ic(t[1]) + '</span><div><b>' + t[0] + '</b><span>' + t[3] + '</span></div></button>'; }).join('') + '</div>'
    });
    C.$$('[data-t]', el).forEach(function (b) {
      b.onclick = function () {
        var p = { id: novoId(), tipo: b.dataset.t };
        if (p.tipo === 'esperar') { p.valor = 1; p.unidade = 'horas'; }
        if (p.tipo === 'menu') p.opcoes = [{ rotulo: 'Opção 1', ir: '' }, { rotulo: 'Opção 2', ir: '' }];
        if (p.tipo === 'condicao') { p.se = 'tag'; p.op = 'tem'; }
        if (p.tipo === 'tag') p.acao = 'add';
        if (p.tipo === 'atribuir' || p.tipo === 'passar') p.modo = 'rodizio';
        if (p.tipo === 'formulario') p.perguntas = [{ campo: 'nome', texto: 'Qual é o seu nome?', validar: 'texto' }, { campo: 'email', texto: 'Qual o seu e-mail?', validar: 'email' }];
        if (p.tipo === 'pontos') { p.acao = 'somar'; p.valor = 10; }
        if (p.tipo === 'humano') p.horas = 24;
        editando.passos.splice(pos, 0, p);
        el.fechar();
        if (['fim'].indexOf(p.tipo) >= 0) C.render(); else editarPasso(pos, true);
      };
    });
  }

  function opcoesPassos(atual, inclusivoFim, excluirId) {
    var o = '<option value=""' + (!atual ? ' selected' : '') + '>Próximo passo</option>' + (inclusivoFim !== false ? '<option value="fim"' + (atual === 'fim' ? ' selected' : '') + '>Encerrar</option>' : '');
    editando.passos.forEach(function (p, i) {
      if (p.id === excluirId) return;
      o += '<option value="' + p.id + '"' + (atual === p.id ? ' selected' : '') + '>Passo ' + (i + 1) + ': ' + esc((TIPOS[p.tipo] || ['?'])[0]) + ' - ' + esc(String(resumoPasso(p)).slice(0, 40)) + '</option>';
    });
    return o;
  }

  function campoTexto(p, rot) {
    return '<div class="campo"><label>' + (rot || 'Mensagem') + '</label><textarea class="inp" id="p-texto" rows="4">' + esc(p.texto || '') + '</textarea>' +
      '<div class="chips" style="margin-top:4px">' + ['primeiro_nome', 'nome', 'saudacao', 'minha_empresa', 'atendente'].map(function (v) { return '<button type="button" class="chip" data-var="{' + v + '}">{' + v + '}</button>'; }).join('') + '</div></div>';
  }
  function camposDestino() {
    var l = [['', 'Não salvar'], ['nome', 'Nome'], ['email', 'E-mail'], ['empresa', 'Empresa'], ['cidade', 'Cidade'], ['cargo', 'Cargo'], ['notas', 'Observações']];
    (S.config.campos || []).forEach(function (f) { l.push([f.chave, f.rotulo + ' (personalizado)']); });
    return l;
  }

  function editarPasso(i, novo) {
    var p = editando.passos[i];
    var t = TIPOS[p.tipo];
    var corpo = '';
    var sel = function (id, ops, v) { return '<select class="inp" id="' + id + '">' + ops.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v || '') === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
    var etapasOps = [['', 'Escolha']];
    S.funis.forEach(function (f) { f.etapas.forEach(function (e) { etapasOps.push([e.id, f.nome + ' > ' + e.nome]); }); });
    var midia = '<div class="grade2"><div class="campo"><label>Mídia (opcional)</label>' + sel('p-mtipo', [['', 'Só texto'], ['image', 'Imagem'], ['video', 'Vídeo'], ['audio', 'Áudio'], ['document', 'Documento']], p.midia_tipo) + '</div><div class="campo"><label>Link público da mídia</label><input class="inp" id="p-murl" value="' + esc(p.midia_url || '') + '" placeholder="https://..."></div></div>';
    var modeloMeta = '<details style="margin-top:6px"' + (p.meta_modelo ? ' open' : '') + '><summary class="small"><b>API oficial: modelo para quando a janela de 24h estiver fechada</b></summary><p class="small muted">Útil em passos depois de uma espera longa. Sem modelo, a mensagem não sai se a janela estiver fechada.</p><div class="grade3"><div class="campo"><label>Nome do modelo</label><input class="inp" id="p-mmod" value="' + esc(p.meta_modelo || '') + '"></div><div class="campo"><label>Variáveis</label><input class="inp" id="p-mvars" value="' + esc(p.meta_variaveis || '{primeiro_nome}') + '"></div><div class="campo"><label>Categoria</label>' + sel('p-mcat', [['marketing', 'Marketing'], ['utility', 'Utilidade']], p.meta_categoria) + '</div></div></details>';
    var expira = '<div class="grade2"><div class="campo"><label>Se não responder em (horas)</label><input class="inp" type="number" min="0" id="p-exp" value="' + esc(p.expira_horas || '') + '" placeholder="vazio = espera para sempre"></div><div class="campo"><label>Sem resposta, ir para</label><select class="inp" id="p-semresp">' + opcoesPassos(p.sem_resposta || 'fim', true, p.id).replace('<option value=""', '<option value="" disabled') + '</select></div></div>';
    switch (p.tipo) {
      case 'mensagem': corpo = campoTexto(p) + midia + modeloMeta; break;
      case 'formulario':
        corpo = campoTexto(p, 'Mensagem de abertura (opcional)') + '<label class="rot">Perguntas (uma por vez no WhatsApp comum e no Instagram)</label><div id="p-qs" style="margin:6px 0 10px"></div><button class="btn peq" id="p-addq">' + ic('plus') + ' Adicionar pergunta</button>' +
          '<details style="margin-top:14px"' + (p.flow_id ? ' open' : '') + '><summary><b>API oficial: tudo numa mensagem só (WhatsApp Flow)</b></summary><p class="small muted">Crie o formulário no Gerenciador do WhatsApp > Flows e publique. Dê aos campos os mesmos nomes dos campos do contato (nome, email, empresa, cidade ou a chave de um campo personalizado). Na API oficial, o Flow substitui as perguntas acima e gasta só uma mensagem.</p>' +
          '<div class="grade3"><div class="campo"><label>ID do Flow</label><input class="inp" id="p-flow" value="' + esc(p.flow_id || '') + '"></div><div class="campo"><label>Texto do botão</label><input class="inp" id="p-botao" value="' + esc(p.botao || 'Preencher') + '"></div><div class="campo"><label>Primeira tela (opcional)</label><input class="inp" id="p-tela" value="' + esc(p.tela || '') + '"></div></div></details>' + expira;
        break;
      case 'passar': corpo = '<div class="grade2"><div class="campo"><label>Closer</label>' + sel('p-modo', [['rodizio', 'Rodízio entre closers'], ['usuario', 'Closer fixo']], p.modo) + '</div><div class="campo"><label>Closer fixo</label>' + sel('p-usuario', [['', '—']].concat(S.usuarios.filter(function (u) { return u.perfil === 'closer'; }).map(function (u) { return [u.id, u.nome]; })), p.usuario_id) + '</div></div>' +
        '<div class="campo"><label>Resumo para o closer</label><textarea class="inp" id="p-nota" rows="2">' + esc(p.nota || '') + '</textarea><span class="ajuda">Pode usar {nome}, {interesse} e outros campos.</span></div>'; break;
      case 'pontos': corpo = '<div class="grade2"><div class="campo"><label>Ação</label>' + sel('p-acao', [['somar', 'Somar (use número negativo para tirar)'], ['zerar', 'Zerar pontuação']], p.acao) + '</div><div class="campo"><label>Pontos</label><input class="inp" type="number" id="p-valor" value="' + esc(p.valor || 10) + '"></div></div><p class="small muted">Use uma Condição com o campo Pontuação para separar quem está pronto para comprar.</p>'; break;
      case 'responder_comentario': corpo = campoTexto(p, 'Resposta pública no comentário') + '<p class="small muted">Só funciona em automações com o gatilho Comentou no Instagram. Varie o texto com {opção A|opção B} para não parecer repetido.</p>'; break;
      case 'email': corpo = (S.emails || []).length ? '<div class="campo"><label>E-mail</label><select class="inp" id="p-email">' + opcoesEmails(p.email_id, 'Escolha') + '</select><span class="ajuda">Crie e edite os e-mails em E-mail marketing > E-mails de automação.</span></div>' : '<div class="aviso">' + ic('info') + '<div>Crie primeiro um e-mail em <b>E-mail marketing > E-mails de automação</b>.</div></div>'; break;
      case 'activecampaign': corpo = '<div class="campo"><label>Tags para aplicar no ActiveCampaign</label><input class="inp" id="p-tags" value="' + esc(p.tags || '') + '" placeholder="Lead WhatsApp, Qualificado"><span class="ajuda">O contato precisa ter e-mail. A lista padrão é a escolhida em Integrações > ActiveCampaign.</span></div>'; break;
      case 'pergunta':
        corpo = campoTexto(p, 'Pergunta') + '<div class="grade2"><div class="campo"><label>Salvar a resposta em</label>' + sel('p-campo', camposDestino(), p.campo) + '</div>' +
          '<div class="campo"><label>Validar resposta</label>' + sel('p-validar', [['texto', 'Qualquer texto'], ['email', 'E-mail'], ['telefone', 'Telefone'], ['numero', 'Número']], p.validar) + '</div></div>' +
          '<div class="campo"><label>Mensagem se a resposta for inválida</label><input class="inp" id="p-erro" value="' + esc(p.erro_texto || '') + '" placeholder="Não entendi. Pode responder de novo?"></div>' + expira;
        break;
      case 'menu':
        corpo = campoTexto(p, 'Texto antes das opções') + '<label class="rot">Opções (o cliente responde com o número)</label><div id="p-ops" style="margin:6px 0 10px"></div><button class="btn peq" id="p-addop">' + ic('plus') + ' Adicionar opção</button>' +
          '<div class="grade2" style="margin-top:14px"><div class="campo"><label>Salvar a escolha em</label>' + sel('p-campo', camposDestino(), p.campo) + '</div><div class="campo"><label>Mensagem se responder errado</label><input class="inp" id="p-erro" value="' + esc(p.erro_texto || '') + '" placeholder="Responda só com o número da opção"></div></div>' + expira;
        break;
      case 'esperar': corpo = '<div class="grade2"><div class="campo"><label>Quanto tempo</label><input class="inp" type="number" min="1" id="p-valor" value="' + esc(p.valor || 1) + '"></div><div class="campo"><label>Unidade</label>' + sel('p-unid', [['minutos', 'Minutos'], ['horas', 'Horas'], ['dias', 'Dias']], p.unidade) + '</div></div><p class="small muted">A espera é conferida a cada minuto pelo servidor.</p>'; break;
      case 'condicao':
        corpo = '<div class="grade2"><div class="campo"><label>Verificar</label>' + sel('p-se', [['tag', 'Tag do contato'], ['campo', 'Campo do contato'], ['etapa', 'Etapa do funil'], ['email', 'Abriu ou clicou e-mail'], ['horario', 'Horário de agora']], p.se) + '</div><div id="p-condx"></div></div><div id="p-condy"></div>' +
          '<div class="grade2"><div class="campo"><label>Se SIM, ir para</label><select class="inp" id="p-sim">' + opcoesPassos(p.sim, true, p.id) + '</select></div><div class="campo"><label>Se NÃO, ir para</label><select class="inp" id="p-nao">' + opcoesPassos(p.nao, true, p.id) + '</select></div></div>';
        break;
      case 'tag': corpo = '<div class="grade2"><div class="campo"><label>Ação</label>' + sel('p-acao', [['add', 'Adicionar tag'], ['remover', 'Remover tag']], p.acao) + '</div><div class="campo"><label>Tag</label><input class="inp" id="p-tag" list="p-tags" value="' + esc(p.tag || '') + '"><datalist id="p-tags">' + C.todasTags().map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist></div></div>'; break;
      case 'etapa': corpo = '<div class="campo"><label>Etapa</label>' + sel('p-etapa', etapasOps, p.etapa_id) + '<span class="ajuda">Se o contato ainda não tem negócio neste funil, um é criado.</span></div>'; break;
      case 'atribuir': corpo = '<div class="grade2"><div class="campo"><label>Como</label>' + sel('p-modo', [['rodizio', 'Rodízio de SDRs (quem tem menos leads)'], ['closer', 'Rodízio de closers'], ['usuario', 'Pessoa fixa']], p.modo) + '</div><div class="campo"><label>Pessoa</label>' + sel('p-usuario', [['', '—']].concat(S.usuarios.map(function (u) { return [u.id, u.nome]; })), p.usuario_id) + '</div></div>'; break;
      case 'campo': corpo = '<div class="grade2"><div class="campo"><label>Campo</label>' + sel('p-campo', camposDestino().slice(1), p.campo) + '</div><div class="campo"><label>Valor</label><input class="inp" id="p-valor" value="' + esc(p.valor || '') + '"></div></div>'; break;
      case 'status': corpo = '<div class="campo"><label>Novo status</label>' + sel('p-valor', [['lead', 'Lead'], ['cliente', 'Cliente'], ['inativo', 'Inativo']], p.valor) + '</div>'; break;
      case 'tarefa': corpo = '<div class="campo"><label>Título da tarefa</label><input class="inp" id="p-titulo" value="' + esc(p.titulo || 'Retornar {nome}') + '"></div><div class="campo"><label>Prazo (horas)</label><input class="inp" type="number" id="p-prazo" value="' + esc(p.prazo_horas || 24) + '"></div>'; break;
      case 'humano': corpo = '<div class="aviso info">' + ic('info') + '<div>O robô para de responder este contato pelo tempo abaixo e uma tarefa é criada para o responsável (ou para a equipe, se não tiver).</div></div><div class="grade2"><div class="campo"><label>Pausar o robô por (horas)</label><input class="inp" type="number" id="p-horas" value="' + esc(p.horas || 24) + '"></div><div class="campo"><label>Título da tarefa</label><input class="inp" id="p-titulo" value="' + esc(p.titulo || '') + '" placeholder="Atender contato"></div></div>'; break;
      case 'webhook': corpo = '<div class="campo"><label>URL que vai receber os dados (POST)</label><input class="inp" id="p-url" value="' + esc(p.url || '') + '" placeholder="https://..."><span class="ajuda">Envia nome, telefone, e-mail, tags e campos do contato em JSON.</span></div>'; break;
      case 'ir': corpo = '<div class="campo"><label>Ir para</label><select class="inp" id="p-passo">' + opcoesPassos(p.passo, true, p.id).replace('<option value=""', '<option value="" disabled') + '</select></div>'; break;
    }
    var el = C.modal({
      titulo: t[0], tamanho: 'largo', corpo: corpo,
      pe: '<button class="btn" data-fechar>' + (novo ? 'Cancelar' : 'Fechar') + '</button><button class="btn pri" id="p-ok">Aplicar</button>',
      aoFechar: function () { if (novo && !aplicado) { editando.passos.splice(i, 1); } C.render(); }
    });
    var aplicado = false;
    C.$$('[data-var]', el).forEach(function (b) {
      b.onclick = function () { var ta = el.querySelector('#p-texto'); var s = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, s) + b.dataset.var + ta.value.slice(s); ta.focus(); };
    });
    var qs = (p.perguntas || []).map(function (q) { return Object.assign({}, q); });
    var pintaQs = function () {
      var box = el.querySelector('#p-qs');
      if (!box) return;
      box.innerHTML = qs.map(function (q, k) {
        return '<div class="card" style="padding:10px;margin-bottom:8px"><div class="linha" style="align-items:center"><b style="flex:0 0 22px">' + (k + 1) + '.</b><input class="inp" data-qt="' + k + '" value="' + esc(q.texto) + '" placeholder="Pergunta"><button class="btn fantasma ic peq perigo" data-qd="' + k + '" style="flex:0 0 30px" aria-label="Remover pergunta">' + ic('x') + '</button></div>' +
          '<div class="grade2" style="margin-top:8px"><div class="campo" style="margin:0"><label>Salvar em</label>' + sel('qc' + k, camposDestino().slice(1), q.campo).replace('id="qc' + k + '"', 'data-qc="' + k + '"') + '</div><div class="campo" style="margin:0"><label>Validar</label>' + sel('qv' + k, [['texto', 'Qualquer texto'], ['email', 'E-mail'], ['telefone', 'Telefone'], ['numero', 'Número']], q.validar).replace('id="qv' + k + '"', 'data-qv="' + k + '"') + '</div></div></div>';
      }).join('');
      C.$$('[data-qt]', box).forEach(function (x) { x.oninput = function () { qs[x.dataset.qt].texto = x.value; }; });
      C.$$('[data-qc]', box).forEach(function (x) { x.onchange = function () { qs[x.dataset.qc].campo = x.value; }; });
      C.$$('[data-qv]', box).forEach(function (x) { x.onchange = function () { qs[x.dataset.qv].validar = x.value; }; });
      C.$$('[data-qd]', box).forEach(function (x) { x.onclick = function () { qs.splice(Number(x.dataset.qd), 1); pintaQs(); }; });
    };
    pintaQs();
    var addq = el.querySelector('#p-addq');
    if (addq) addq.onclick = function () { qs.push({ campo: (camposDestino()[1] || [''])[0], texto: '', validar: 'texto' }); pintaQs(); };
    var ops = (p.opcoes || []).slice();
    var pintaOps = function () {
      var box = el.querySelector('#p-ops');
      if (!box) return;
      box.innerHTML = ops.map(function (o, k) {
        return '<div class="linha" style="margin-bottom:8px;align-items:center"><b style="flex:0 0 22px">' + (k + 1) + '.</b><input class="inp" data-or="' + k + '" value="' + esc(o.rotulo) + '"><select class="inp" data-oi="' + k + '">' + opcoesPassos(o.ir, true, p.id) + '</select><button class="btn fantasma ic peq perigo" data-od="' + k + '" style="flex:0 0 30px" aria-label="Remover opção">' + ic('x') + '</button></div>';
      }).join('');
      C.$$('[data-or]', box).forEach(function (x) { x.oninput = function () { ops[x.dataset.or].rotulo = x.value; }; });
      C.$$('[data-oi]', box).forEach(function (x) { x.onchange = function () { ops[x.dataset.oi].ir = x.value; }; });
      C.$$('[data-od]', box).forEach(function (x) { x.onclick = function () { ops.splice(Number(x.dataset.od), 1); pintaOps(); }; });
    };
    pintaOps();
    var addop = el.querySelector('#p-addop');
    if (addop) addop.onclick = function () { ops.push({ rotulo: 'Opção ' + (ops.length + 1), ir: '' }); pintaOps(); };
    var pintaCond = function () {
      var se = el.querySelector('#p-se'); if (!se) return;
      var x = el.querySelector('#p-condx'), y = el.querySelector('#p-condy');
      if (se.value === 'tag') { x.innerHTML = '<div class="campo"><label>Condição</label>' + sel('p-op', [['tem', 'Tem a tag'], ['nao_tem', 'Não tem a tag']], p.op) + '</div>'; y.innerHTML = '<div class="campo"><label>Tag</label><input class="inp" id="p-valor" value="' + esc(p.valor || '') + '"></div>'; }
      else if (se.value === 'etapa') { x.innerHTML = '<div class="campo"><label>Condição</label>' + sel('p-op', [['tem', 'Está na etapa'], ['nao_tem', 'Não está na etapa']], p.op) + '</div>'; y.innerHTML = '<div class="campo"><label>Etapa</label>' + sel('p-valor', etapasOps, p.valor) + '</div>'; }
      else if (se.value === 'email') { x.innerHTML = '<div class="campo"><label>Condição</label>' + sel('p-op', [['abriu', 'Abriu'], ['nao_abriu', 'Não abriu'], ['clicou', 'Clicou'], ['nao_clicou', 'Não clicou']], p.op) + '</div>'; y.innerHTML = '<div class="campo"><label>E-mail</label><select class="inp" id="p-valor">' + opcoesEmails(p.valor, 'Qualquer e-mail') + '</select></div>'; }
      else if (se.value === 'horario') { x.innerHTML = ''; y.innerHTML = '<div class="grade3"><div class="campo"><label>Das</label><input class="inp" type="time" id="p-ini" value="' + esc(p.inicio || '08:00') + '"></div><div class="campo"><label>Até</label><input class="inp" type="time" id="p-fim" value="' + esc(p.fim || '18:00') + '"></div><div class="campo"><label>Dias (0=dom ... 6=sáb)</label><input class="inp" id="p-dias" value="' + esc(p.dias || '1,2,3,4,5') + '"></div></div><p class="small muted" style="margin-top:0">SIM = dentro do horário.</p>'; }
      else { x.innerHTML = '<div class="campo"><label>Campo</label>' + sel('p-campo', camposDestino().slice(1).concat([['origem', 'Origem'], ['status', 'Status'], ['pontos', 'Pontuação']]), p.campo) + '</div>'; y.innerHTML = '<div class="grade2"><div class="campo"><label>Comparação</label>' + sel('p-op', [['igual', 'É igual a'], ['diferente', 'É diferente de'], ['contem', 'Contém'], ['vazio', 'Está vazio'], ['preenchido', 'Está preenchido'], ['maior', 'Maior que'], ['menor', 'Menor que']], p.op) + '</div><div class="campo"><label>Valor</label><input class="inp" id="p-valor" value="' + esc(p.valor || '') + '"></div></div>'; }
    };
    var se = el.querySelector('#p-se'); if (se) { se.onchange = pintaCond; pintaCond(); }

    el.querySelector('#p-ok').onclick = function () {
      var v = function (id) { var x = el.querySelector('#' + id); return x ? x.value.trim() : undefined; };
      var set = function (k, id, num) { var x = v(id); if (x !== undefined) p[k] = num ? Number(x) || 0 : x; };
      set('texto', 'p-texto'); set('midia_tipo', 'p-mtipo'); set('midia_url', 'p-murl'); set('campo', 'p-campo'); set('validar', 'p-validar'); set('erro_texto', 'p-erro');
      set('valor', 'p-valor'); set('unidade', 'p-unid'); set('se', 'p-se'); set('op', 'p-op'); set('sim', 'p-sim'); set('nao', 'p-nao');
      set('acao', 'p-acao'); set('tag', 'p-tag'); set('etapa_id', 'p-etapa'); set('modo', 'p-modo'); set('usuario_id', 'p-usuario');
      set('titulo', 'p-titulo'); set('prazo_horas', 'p-prazo', true); set('horas', 'p-horas', true); set('url', 'p-url'); set('passo', 'p-passo');
      set('inicio', 'p-ini'); set('fim', 'p-fim'); set('dias', 'p-dias'); set('expira_horas', 'p-exp', true); set('sem_resposta', 'p-semresp');
      set('meta_modelo', 'p-mmod'); set('meta_variaveis', 'p-mvars'); set('meta_categoria', 'p-mcat'); set('flow_id', 'p-flow'); set('botao', 'p-botao'); set('tela', 'p-tela'); set('nota', 'p-nota'); set('tags', 'p-tags'); set('email_id', 'p-email');
      if (p.tipo === 'email' && !p.email_id) { C.toast('Escolha o e-mail', 'erro'); return; }
      if (p.tipo === 'formulario') { p.perguntas = qs.filter(function (q) { return q.texto.trim(); }); if (!p.perguntas.length && !p.flow_id) { C.toast('Adicione pelo menos uma pergunta ou o ID do Flow', 'erro'); return; } }
      if (p.tipo === 'pontos') p.valor = Number(p.valor) || 0;
      if (p.midia_url) p.midia_url = C.driveDireto ? C.driveDireto(p.midia_url) : p.midia_url;
      if (p.tipo === 'menu') { p.opcoes = ops.filter(function (o) { return o.rotulo.trim(); }); if (p.opcoes.length < 2) { C.toast('O menu precisa de pelo menos 2 opções', 'erro'); return; } }
      if ((p.tipo === 'mensagem' || p.tipo === 'pergunta' || p.tipo === 'menu') && !p.texto && !p.midia_url) { C.toast('Escreva a mensagem', 'erro'); return; }
      if (p.tipo === 'webhook' && !/^https:\/\//.test(p.url || '')) { C.toast('A URL precisa começar com https://', 'erro'); return; }
      aplicado = true;
      el.fechar();
    };
  }

  function testar() {
    var e = editando;
    var cs = S.contatos.filter(function (c) { return c.telefone; }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    C.pedirTexto('Testar automação', 'Rodar o fluxo salvo para qual contato? (use o seu próprio número de teste)', '', { opcoes: cs.map(function (c) { return [c.id, c.nome + ' · ' + C.tel(c.telefone)]; }), botao: 'Rodar agora' }).then(function (cid) {
      if (!cid) return;
      return C.api('automacao.testar', { id: e.id, contato_id: cid }).then(function (r) { C.toast(r.ok ? 'Fluxo iniciado. Veja na conversa do contato.' : 'Não iniciou. Salve antes de testar.', r.ok ? 'ok' : 'erro'); });
    }).catch(function (er) { C.toast(er.message, 'erro'); });
  }

  function verExecucoes(id) {
    var a = S.automacoes.filter(function (x) { return x.id === id; })[0];
    var el = C.modal({ titulo: 'Execuções: ' + a.nome, tamanho: 'largo', corpo: '<div style="text-align:center"><span class="spin" style="color:var(--pri)"></span></div>' });
    C.api('automacao.execucoes', { id: id }).then(function (l) {
      var rot = { concluida: ['Concluída', 'st-on'], esperando_tempo: ['Aguardando tempo', 'st-aviso'], esperando_resposta: ['Esperando resposta', 'st-aviso'], rodando: ['Rodando', 'st-lead'], cancelada: ['Cancelada', 'st-off'], substituida: ['Substituída', 'st-off'], interrompida: ['Interrompida', 'st-erro'], pausada: ['Pausada', 'st-off'] };
      el.querySelector('.modal-corpo').innerHTML = l.length ? '<div class="tabela-wrap"><table class="tab"><thead><tr><th>Contato</th><th>Situação</th><th>Início</th><th>Última ação</th></tr></thead><tbody>' + l.map(function (x) {
        var r = rot[x.status] || [x.status, 'st-off'];
        return '<tr data-c="' + x.contato_id + '"><td>' + esc(x.contato_nome) + '</td><td><span class="status ' + r[1] + '">' + r[0] + '</span>' + (x.acordar_em ? '<div class="small muted">até ' + C.fmtData(x.acordar_em) + '</div>' : '') + '</td><td class="small">' + C.fmtData(x.criado_em) + '</td><td class="small">' + C.fmtData(x.atualizado_em) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="vazio">Ninguém passou por esta automação ainda.</div>';
      C.$$('tr[data-c]', el).forEach(function (tr) { tr.onclick = function () { el.fechar(); C.abrirContato(tr.dataset.c); }; });
    }).catch(function (e) { C.toast(e.message, 'erro'); el.fechar(); });
  }
})();
