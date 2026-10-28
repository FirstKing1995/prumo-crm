// Testes da versão 1.1: SDR/closer, economia na API oficial, Flows, Instagram,
// Hotmart/Kiwify, ActiveCampaign, Lead Ads, API e arquivo mensal.
// Roda dentro de testar.js (mesma plataforma em memória).
module.exports = function ({ L, t, cfg, enviados, api, ok, lanca, arq }) {
  const ultimo = () => enviados[enviados.length - 1];
  const login = (email, senha) => { const s = L.rotear({ action: 'login', email, senha }); return (action, b) => L.rotear(Object.assign({ action, token: s.token }, b || {})); };
  const contato = (id) => t('Contatos').find((c) => c.id === id);
  const kWa = cfg.WEBHOOK_CHAVE, kEnt = cfg.ENTRADA_CHAVE;

  /* ---------------- SDR e closer ---------------- */
  api('usuario.salvar', { usuario: { nome: 'Sara SDR', email: 'sdr@teste.com', perfil: 'sdr', senha: 'senha-sdr-1', recebe_leads: 'SIM', meta_reunioes: 10 } });
  api('usuario.salvar', { usuario: { nome: 'Caio Closer', email: 'closer@teste.com', perfil: 'closer', senha: 'senha-closer-1', recebe_leads: 'SIM', meta_valor: 5000 } });
  const sdr = t('Usuarios').find((u) => u.email === 'sdr@teste.com'), closer = t('Usuarios').find((u) => u.email === 'closer@teste.com');
  ok(sdr.perfil === 'sdr' && closer.meta_valor === '5000', 'cria SDR e closer com metas');
  const apiS = login('sdr@teste.com', 'senha-sdr-1'), apiC = login('closer@teste.com', 'senha-closer-1');
  const lead = api('contato.salvar', { contato: { nome: 'Lia Lead', telefone: '11955554444', responsavel_id: '' } });
  api('contato.massa', { ids: [lead.id], acao: 'atribuir', valor: '' });
  ok(!!apiS('contato.ver', { id: lead.id }), 'SDR vê lead sem dono');
  lanca(() => apiC('contato.ver', { id: lead.id }), 'closer não vê lead sem dono');
  lanca(() => apiC('negocio.passar', { contato_id: lead.id }), 'closer não passa lead');
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  const neg = apiS('negocio.passar', { contato_id: lead.id, reuniao_em: amanha, nota: 'Quer começar já', valor: '1500' });
  ok(neg.responsavel_id === closer.id && neg.sdr_id === sdr.id && neg.reuniao_status === 'agendada' && neg.valor === '1500', 'SDR passa para o closer do rodízio com reunião');
  ok(contato(lead.id).responsavel_id === closer.id && contato(lead.id).sdr_id === sdr.id, 'contato fica com o closer e guarda o SDR');
  ok(t('Tarefas').some((x) => x.responsavel_id === closer.id && x.tipo === 'reuniao'), 'tarefa de reunião para o closer');
  const lemb = t('Fila').find((f) => f.tipo === 'lembrete' && f.ref_id === neg.id);
  ok(lemb && lemb.status === 'pendente' && /Lia/.test(lemb.texto), 'lembrete da reunião agendado para o lead');
  ok(!!apiC('contato.ver', { id: lead.id }) && !!apiS('contato.ver', { id: lead.id }), 'closer e SDR continuam vendo o lead');
  apiC('negocio.reuniao', { id: neg.id, status: 'no_show' });
  lemb.enviar_em = '2000-01-01T00:00:00'; L.salvarCfg({ PROX_TRABALHO: '' });
  L.trabalhar(4);
  ok(t('Fila').find((f) => f.id === lemb.id).status === 'cancelado', 'falta na reunião cancela o lembrete');
  const rel = api('relatorio', {});
  const rs = rel.usuarios.find((u) => u.id === sdr.id), rc = rel.usuarios.find((u) => u.id === closer.id);
  ok(rs.passados === 1 && rs.reunioes === 1 && rc.recebidos === 1, 'relatório conta passagens e reuniões');

  /* ---------------- API oficial da Meta ---------------- */
  api('config.salvar', { config: { WA_PROVEDOR: 'meta', META_TOKEN: 'tok', META_PHONE_ID: '123', META_VERIFY: 'verifica123' } });
  const fria = api('contato.salvar', { contato: { nome: 'Fria', telefone: '11944443333' } });
  lanca(() => api('mensagem.enviar', { id: fria.id, texto: 'oi' }), 'janela fechada bloqueia texto livre na Meta');
  api('mensagem.enviar', { id: fria.id, texto: '', meta_modelo: { nome: 'retomar', variaveis: '{primeiro_nome}', categoria: 'utility' } });
  ok(ultimo().body.type === 'template' && ultimo().body.template.components[0].parameters[0].text === 'Fria', 'modelo da Meta com variável');
  ok(t('Mensagens').filter((m) => m.contato_id === fria.id).pop().cobranca === 'utility', 'custo do modelo classificado');
  const metaMsg = (from, extra) => ({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { contacts: [{ wa_id: from, profile: { name: 'Beto' } }], messages: [Object.assign({ from, id: 'mm' + Math.random(), type: 'text', text: { body: 'oi' } }, extra || {})] } }] }] });
  // menu do robô vira botões
  L.receberWebhook({ src: 'wa', k: kWa }, metaMsg('5511933332222'));
  ok(ultimo().body.type === 'interactive' && ultimo().body.interactive.type === 'button' && ultimo().body.interactive.action.buttons.length === 3, 'menu vira botões na API oficial');
  ok(!/\*1\*/.test(ultimo().body.interactive.body.text), 'botões sem a lista numerada no texto');
  L.receberWebhook({ src: 'wa', k: kWa }, metaMsg('5511933332222', { type: 'interactive', text: undefined, interactive: { type: 'button_reply', button_reply: { id: 'op3', title: 'Falar com uma pessoa' } } }));
  const beto = t('Contatos').find((c) => c.telefone === '5511933332222');
  ok(beto.bot_pausado_ate > new Date().toISOString().slice(0, 19), 'botão escolhido leva ao caminho certo');
  ok(t('Mensagens').filter((m) => m.contato_id === beto.id && m.direcao === 'out').every((m) => m.cobranca === 'servico'), 'respostas na janela contam como atendimento');
  // clique em anúncio: período grátis
  L.receberWebhook({ src: 'wa', k: kWa }, metaMsg('5511922221111', { referral: { source_id: 'AD1', headline: 'Promo verão', source_type: 'ad' } }));
  const anun = t('Contatos').find((c) => c.telefone === '5511922221111');
  ok(anun.gratis_ate > anun.janela_ate.slice(0, 10) && /Anúncio/.test(anun.origem) && /Promo/.test(anun.campos), 'anúncio marca período grátis e origem');
  ok(t('Mensagens').filter((m) => m.contato_id === anun.id && m.direcao === 'out').pop().cobranca === 'gratis', 'mensagem no período grátis');
  // economia no disparo: janela aberta recebe texto, fechada recebe modelo
  const camp = api('campanha.salvar', { campanha: { nome: 'Meta eco', destino: 'contatos', filtro: { busca: '933332222' }, texto: 'Oi {primeiro_nome}', meta_modelo: { nome: 'promo', variaveis: ['{primeiro_nome}'] } } });
  const custo = api('campanha.custo', { filtro: { busca: '933332222' } });
  ok(custo.total === 1 && custo.janela === 1 && custo.com_economia < custo.sem_economia, 'estimativa de custo do disparo');
  api('campanha.iniciar', { id: camp.id }); L.salvarCfg({ PROX_TRABALHO: '' });
  L.trabalhar(4);
  ok(ultimo().body.type === 'text' && ultimo().body.text.body === 'Oi Beto', 'disparo econômico usa texto comum na janela aberta');

  // WhatsApp Flow: formulário numa mensagem só
  api('automacao.salvar', { automacao: { nome: 'Form flow', ativo: 'SIM', gatilho: { tipo: 'palavra', palavras: 'cadastro' }, passos: [{ id: 'f1', tipo: 'formulario', texto: 'Preencha', flow_id: '999', perguntas: [{ campo: 'nome', texto: 'Nome?' }] }, { id: 'f2', tipo: 'mensagem', texto: 'Valeu {primeiro_nome}' }] } });
  L.receberWebhook({ src: 'wa', k: kWa }, metaMsg('5511911110000', { text: { body: 'quero fazer cadastro' } }));
  const fl = enviados.filter((e) => e.body && e.body.interactive && e.body.interactive.type === 'flow').pop();
  ok(fl && fl.body.interactive.action.parameters.flow_id === '999', 'passo formulário envia o WhatsApp Flow');
  L.receberWebhook({ src: 'wa', k: kWa }, metaMsg('5511911110000', { type: 'interactive', text: undefined, interactive: { type: 'nfm_reply', nfm_reply: { response_json: JSON.stringify({ nome: 'Gabi Souza', email: 'gabi@x.com', flow_token: 'x' }) } } }));
  const gabi = t('Contatos').find((c) => c.telefone === '5511911110000');
  ok(gabi.nome === 'Gabi Souza' && gabi.email === 'gabi@x.com' && ultimo().body.text.body === 'Valeu Gabi', 'respostas do Flow gravadas no contato');

  /* ---------------- formulário pergunta a pergunta (Evolution) ---------------- */
  api('config.salvar', { config: { WA_PROVEDOR: 'evolution' } });
  const evo = (tel, texto) => ({ event: 'messages.upsert', data: { key: { remoteJid: tel + '@s.whatsapp.net', fromMe: false, id: 'E' + Math.random() }, pushName: 'X', message: { conversation: texto } } });
  api('automacao.salvar', { automacao: { nome: 'Form evo', ativo: 'SIM', gatilho: { tipo: 'palavra', palavras: 'inscrever' }, passos: [{ id: 'g1', tipo: 'formulario', perguntas: [{ campo: 'empresa', texto: 'Qual a empresa?' }, { campo: 'email', texto: 'E o e-mail?', validar: 'email' }] }, { id: 'g2', tipo: 'tag', acao: 'add', tag: 'Inscrito' }] } });
  L.receberWebhook({ src: 'wa', k: kWa }, evo('5511900009999', 'quero me inscrever'));
  ok(/empresa/.test(ultimo().body.text), 'formulário pergunta o primeiro campo');
  L.receberWebhook({ src: 'wa', k: kWa }, evo('5511900009999', 'Padaria Sol'));
  L.receberWebhook({ src: 'wa', k: kWa }, evo('5511900009999', 'errado'));
  ok(/responder de novo/.test(ultimo().body.text), 'formulário valida o e-mail');
  L.receberWebhook({ src: 'wa', k: kWa }, evo('5511900009999', 'sol@padaria.com'));
  const sol = t('Contatos').find((c) => c.telefone === '5511900009999');
  ok(sol.empresa === 'Padaria Sol' && sol.email === 'sol@padaria.com' && /Inscrito/.test(sol.tags), 'formulário completo segue o fluxo');

  /* ---------------- Hotmart e Kiwify ---------------- */
  api('automacao.salvar', { automacao: { nome: 'Carrinho', ativo: 'SIM', gatilho: { tipo: 'evento', evento: 'carrinho_abandonado' }, passos: [{ id: 'c1', tipo: 'esperar', valor: 1, unidade: 'dias' }, { id: 'c2', tipo: 'mensagem', texto: 'Volte!' }] } });
  const hot = (ev, extra) => Object.assign({ event: ev, version: '2.0.0', data: { buyer: { name: 'Hugo Compra', email: 'hugo@x.com', checkout_phone: '11988880000' }, product: { name: 'Curso Pro' }, purchase: { price: { value: 497 } } } }, extra || {});
  const kVen = cfg.VENDAS_CHAVE;
  L.receberWebhook({ src: 'entrada', k: kEnt, fonte: 'hotmart' }, Object.assign(hot('PURCHASE_APPROVED'), { data: { buyer: { name: 'Falso', email: 'falso@x.com' }, purchase: { price: { value: 999 } } } }));
  const falso = t('Contatos').find((c) => c.email === 'falso@x.com');
  ok(falso && falso.status === 'lead' && !t('Negocios').some((n) => n.contato_id === falso.id), 'URL pública não registra compra (venda falsa)');
  lanca(() => L.receberWebhook({ src: 'vendas', k: kEnt }, hot('PURCHASE_APPROVED')), 'chave de captação não serve para vendas');
  L.receberWebhook({ src: 'vendas', k: kVen, fonte: 'hotmart' }, hot('PURCHASE_OUT_OF_SHOPPING_CART'));
  const hugo = t('Contatos').find((c) => c.email === 'hugo@x.com');
  ok(/Hotmart: Carrinho abandonado/.test(hugo.tags) && hugo.origem === 'Hotmart', 'Hotmart: carrinho vira tag e origem');
  ok(t('Execucoes').some((e) => e.contato_id === hugo.id && e.status === 'esperando_tempo'), 'carrinho abandonado inicia automação');
  L.receberWebhook({ src: 'vendas', k: kVen }, hot('PURCHASE_APPROVED'));
  const h2 = contato(hugo.id);
  const ganho = t('Negocios').find((n) => n.contato_id === hugo.id && n.status === 'ganho');
  ok(h2.status === 'cliente' && ganho && ganho.valor === '497' && /Comprou/.test(h2.tags), 'compra aprovada: cliente e negócio ganho com valor');
  ok(!t('Execucoes').some((e) => e.contato_id === hugo.id && /esperando/.test(e.status)), 'compra tira a pessoa da recuperação de carrinho');
  L.receberWebhook({ src: 'vendas', k: kVen }, { order_id: 'K1', order_status: 'paid', webhook_event_type: 'order_approved', Product: { product_name: 'Mentoria' }, Customer: { full_name: 'Kátia Kiwi', email: 'katia@x.com', mobile: '+5511977770000' }, Commissions: { charge_amount: 19700 } });
  const katia = t('Contatos').find((c) => c.email === 'katia@x.com');
  ok(katia && /Kiwify: Comprou/.test(katia.tags) && t('Negocios').some((n) => n.contato_id === katia.id && n.valor === '197'), 'Kiwify: compra reconhecida com valor em reais');

  /* ---------------- Lead Ads, TikTok e ActiveCampaign ---------------- */
  L.receberWebhook({ src: 'entrada', k: kEnt, fonte: 'facebook', origem: 'Anúncio Facebook' }, { field_data: [{ name: 'full_name', values: ['Fabi Ads'] }, { name: 'phone_number', values: ['+5511966660000'] }, { name: 'email', values: ['fabi@x.com'] }] });
  ok(t('Contatos').some((c) => c.nome === 'Fabi Ads' && c.telefone === '5511966660000' && c.origem === 'Anúncio Facebook'), 'Lead Ads: pares nome/valor');
  L.receberWebhook({ src: 'entrada', k: kEnt, fonte: 'tiktok' }, { lead: { answers: [{ question: 'name', answer: 'Tati Tok' }, { question: 'phone_number', answer: '11955550000' }] } });
  ok(t('Contatos').some((c) => c.nome === 'Tati Tok' && c.origem === 'TikTok'), 'TikTok: respostas do formulário');
  L.receberWebhook({ src: 'entrada', k: kEnt, fonte: 'activecampaign' }, { type: 'subscribe', 'contact[email]': 'ana@ac.com', 'contact[first_name]': 'Ana', 'contact[last_name]': 'Campos', 'contact[phone]': '11944440000' });
  ok(t('Contatos').some((c) => c.email === 'ana@ac.com' && c.nome === 'Ana Campos' && c.origem === 'ActiveCampaign'), 'ActiveCampaign: formato de formulário');

  /* ---------------- API do sistema ---------------- */
  lanca(() => L.receberWebhook({ src: 'api', k: '' }, { acao: 'contato.buscar', email: 'ana@ac.com' }), 'API desligada sem chave');
  const cf = api('config.chave', { qual: 'api' });
  const kApi = cfg.API_CHAVE;
  ok(kApi && kApi.length > 40 && /src=api/.test(cf.URL_API) && cf.API_CHAVE === undefined, 'chave da API gerada e não exposta');
  lanca(() => L.receberWebhook({ src: 'api', k: kEnt }, { acao: 'contato.buscar', email: 'ana@ac.com' }), 'chave de captação não abre a API');
  const rb = L.receberWebhook({ src: 'api', k: kApi }, { acao: 'contato.buscar', email: 'ana@ac.com' });
  ok(rb.contato.nome === 'Ana Campos', 'API busca contato');
  L.receberWebhook({ src: 'api', k: kApi }, { acao: 'tag.adicionar', email: 'ana@ac.com', tags: 'VIP' });
  L.receberWebhook({ src: 'api', k: kApi }, { acao: 'mensagem.enviar', email: 'ana@ac.com', texto: 'Olá {primeiro_nome}' });
  ok(/VIP/.test(t('Contatos').find((c) => c.email === 'ana@ac.com').tags) && ultimo().body.text === 'Olá Ana', 'API aplica tag e envia mensagem');

  /* ---------------- Instagram ---------------- */
  api('config.salvar', { config: { IG_TOKEN: 'igtok', IG_ID: '17841400000000000' } });
  api('automacao.salvar', { automacao: { nome: 'Comentário', ativo: 'SIM', gatilho: { tipo: 'comentario', palavras: 'eu quero' }, passos: [{ id: 'i1', tipo: 'responder_comentario', texto: 'Te chamei no Direct!' }, { id: 'i2', tipo: 'mensagem', texto: 'Aqui está o link' }] } });
  L.receberWebhook({ src: 'wa', k: kWa }, { object: 'instagram', entry: [{ changes: [{ field: 'comments', value: { id: 'CM1', text: 'Eu quero!', from: { id: 'IGU1', username: 'maria.ig' }, media: { id: 'POST1' } } }] }] });
  const maria = t('Contatos').find((c) => c.ig_id === 'IGU1');
  ok(maria && maria.canal === 'instagram' && maria.ig_usuario === 'maria.ig', 'comentário cria contato do Instagram');
  const rep = enviados.find((e) => /CM1\/replies/.test(e.url));
  const dm = enviados.filter((e) => /graph\.instagram\.com/.test(e.url) && /\/messages$/.test(e.url)).pop();
  ok(rep && rep.body.message === 'Te chamei no Direct!', 'responde o comentário em público');
  ok(dm && dm.body.recipient.comment_id === 'CM1' && dm.body.message.text === 'Aqui está o link', 'manda a resposta privada no Direct');
  L.receberWebhook({ src: 'wa', k: kWa }, { object: 'instagram', entry: [{ messaging: [{ sender: { id: 'IGU1' }, recipient: { id: '17841400000000000' }, message: { mid: 'MID1', text: 'Obrigada!' } }] }] });
  ok(t('Mensagens').some((m) => m.contato_id === maria.id && m.direcao === 'in' && m.canal === 'instagram'), 'Direct entra na caixa de entrada');
  api('mensagem.enviar', { id: maria.id, texto: 'De nada!' });
  ok(ultimo().body.recipient.id === 'IGU1' && ultimo().body.message.text === 'De nada!', 'resposta manual sai pelo Direct');

  /* ---------------- robô pontua e passa para o closer ---------------- */
  const auto = api('automacao.salvar', { automacao: { nome: 'Pontua e passa', ativo: 'SIM', gatilho: { tipo: 'manual' }, passos: [{ id: 'p1', tipo: 'pontos', acao: 'somar', valor: 50 }, { id: 'p2', tipo: 'condicao', se: 'campo', campo: 'pontos', op: 'maior', valor: '40', sim: 'p3', nao: 'fim' }, { id: 'p3', tipo: 'passar', modo: 'rodizio', nota: 'Pronto: {nome}' }] } });
  const quente = api('contato.salvar', { contato: { nome: 'Quente Silva', email: 'quente@x.com' } });
  api('automacao.testar', { id: auto.id, contato_id: quente.id });
  const q2 = contato(quente.id);
  ok(q2.pontos === '50' && q2.responsavel_id === closer.id, 'robô pontua e passa o lead para o closer');
  ok(t('Historico').some((h) => h.contato_id === quente.id && h.acao === 'nota' && /Pronto: Quente Silva/.test(h.detalhe)), 'resumo do robô vai para o closer');

  /* ---------------- arquivo mensal ---------------- */
  const mesPassado = new Date(); mesPassado.setDate(1); mesPassado.setMonth(mesPassado.getMonth() - 1);
  const velho = mesPassado.toISOString().slice(0, 7) + '-15T10:00:00';
  t('Mensagens').push({ id: 'MOLD1', contato_id: maria.id, direcao: 'in', tipo: 'texto', texto: 'mensagem antiga', criado_em: velho });
  t('Historico').push({ id: 'HOLD1', data: velho, contato_id: maria.id, acao: 'nota', detalhe: 'nota antiga' });
  t('Negocios').push({ id: 'NOLD1', contato_id: maria.id, titulo: 'Venda antiga', status: 'ganho', valor: '300', fechado_em: velho, responsavel_id: '' });
  t('Negocios').push({ id: 'NOPEN', contato_id: maria.id, titulo: 'Aberto antigo', status: 'aberto', valor: '0', criado_em: velho, fechado_em: '' });
  const antes = t('Mensagens').length;
  L.salvarCfg({ ARQUIVO_FEITO: '' });
  const r = L.arquivar(null);
  ok(r.total >= 3 && !r.parcial && cfg.ARQUIVO_FEITO === new Date().toISOString().slice(0, 7), 'arquivo mensal roda e marca o mês');
  ok(t('Mensagens').length === antes - 1 && !t('Mensagens').some((m) => m.id === 'MOLD1'), 'principal fica só com o mês atual');
  ok(t('Negocios').some((n) => n.id === 'NOPEN') && !t('Negocios').some((n) => n.id === 'NOLD1'), 'negócio aberto fica, fechado vai para o arquivo');
  const reg = t('Arquivos')[0];
  ok(reg && reg.mes === velho.slice(0, 7) && /Arquivo \d{4}-\d\d \(/.test(arq[reg.planilha_id].nome), 'planilha do mês nomeada com mês e ano');
  const ac = api('arquivo.contato', { contato_id: maria.id });
  ok(ac.mensagens.length === 1 && ac.historico.length === 1 && ac.negocios.length === 1, 'conversa antiga carregada do arquivo');
  const rel2 = api('relatorio', { de: velho.slice(0, 10), ate: new Date().toISOString().slice(0, 10) });
  ok(rel2.arquivados === 1 && rel2.dias.some((d) => d.dia === velho.slice(0, 10) && d.valor === 300), 'relatório soma o mês arquivado');
  const r2 = L.arquivar(null);
  ok(r2.total === 0 && arq[reg.planilha_id].t.Mensagens.length === 1, 'arquivar de novo não duplica');
};
