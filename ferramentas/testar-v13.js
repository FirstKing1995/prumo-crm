// Testes da versão 1.3: financeiro (parcelas, atraso, lembrete, reembolso), Mercado Pago,
// chat do site, acessos personalizados, tarefas por usuário, plano de suporte e limites.
module.exports = function ({ L, t, enviados, api, ok, lanca, mpPagamentos }) {
  const contato = (id) => t('Contatos').find((c) => c.id === id);
  const hoje = new Date().toISOString().slice(0, 10);
  const dia = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const login = (email, senha) => { const s = L.rotear({ action: 'login', email, senha }); return (action, b) => L.rotear(Object.assign({ action, token: s.token }, b || {})); };

  /* ---------------- parcelas e faturamento ---------------- */
  const cli = api('contato.salvar', { contato: { nome: 'Fabio Parcela', email: 'fabio@x.com', telefone: '11977001100' } });
  const parcelas = api('cobranca.criar', { contato_id: cli.id, valor_total: 1000, parcelas: 3, primeiro_vencimento: dia(-40), descricao: 'Mentoria', entrada_paga: true });
  ok(parcelas.length === 3 && parcelas.map((x) => x.valor).join('|') === '333.33|333.33|333.34', 'parcelas com centavos ajustados na última');
  ok(parcelas[0].status === 'paga' && contato(cli.id).status === 'cliente', 'entrada paga deixa o contato como cliente');
  ok(parcelas[1].vencimento.slice(5, 7) !== parcelas[0].vencimento.slice(5, 7), 'vencimentos mês a mês');

  // automações de cobrança
  api('automacao.salvar', { automacao: { nome: 'Lembrete', ativo: 'SIM', gatilho: { tipo: 'cobranca_vencendo' }, passos: [{ id: 'l1', tipo: 'tag', acao: 'add', tag: 'Lembrado' }, { id: 'l2', tipo: 'campo', campo: 'ultimo_lembrete', valor: '{valor_parcela} vence {vencimento}' }] } });
  api('automacao.salvar', { automacao: { nome: 'Recuperação', ativo: 'SIM', gatilho: { tipo: 'cobranca_atrasada' }, passos: [{ id: 'r1', tipo: 'campo', campo: 'divida', valor: '{valor_parcela} ({parcela})' }] } });
  api('automacao.salvar', { automacao: { nome: 'Pagou', ativo: 'SIM', gatilho: { tipo: 'pagamento' }, passos: [{ id: 'p1', tipo: 'tag', acao: 'add', tag: 'Pagou' }] } });
  // a parcela 2 está atrasada (venceu há ~10 dias) e a 3 fica para daqui a 2 dias
  const p2 = t('Cobrancas').find((x) => x.id === parcelas[1].id), p3 = t('Cobrancas').find((x) => x.id === parcelas[2].id);
  p2.vencimento = dia(-10); p3.vencimento = dia(2);
  L.salvarCfg({ FIN_VERIFICADO: '', PROX_TRABALHO: '' });
  L.trabalhar(4);
  const f1 = contato(cli.id);
  ok(/Inadimplente/.test(f1.tags) && /"divida":"R\$ 333,33 \(2\/3\)"/.test(f1.campos), 'atraso: tag Inadimplente e automação com os dados da parcela');
  ok(/Lembrado/.test(f1.tags) && /R\$ 333,34 vence/.test(f1.campos), 'perto de vencer: lembrete com valor e data');
  const quant = t('Execucoes').length;
  L.salvarCfg({ PROX_TRABALHO: '' }); L.trabalhar(4);
  ok(t('Execucoes').length === quant, 'verificação das cobranças roda uma vez por dia');

  const res = api('financeiro.resumo', {});
  ok(Math.abs(res.recebido - (333.33 + 497 + 197)) < 0.01 && res.formas.Hotmart === 497 && res.atraso === 333.33 && res.inadimplentes >= 1 && res.a_receber === 666.67 && res.vencendo7 === 333.34, 'resumo: recebido, a receber, atraso e a vencer');
  ok(res.clientes >= 1 && res.base === t('Contatos').length, 'clientes ativos e total da base');
  ok(api('cobranca.listar', { filtro: 'atraso' }).some((x) => x.id === p2.id && x.contato_nome === 'Fabio Parcela'), 'lista de inadimplentes');

  api('cobranca.pagar', { id: p2.id, forma: 'Pix' });
  ok(!/Inadimplente/.test(contato(cli.id).tags) && /Pagou/.test(contato(cli.id).tags), 'pagou: sai da inadimplência e dispara automação');
  api('cobranca.reembolsar', { id: p2.id, valor: 100, motivo: 'Desistiu' });
  const r2 = api('financeiro.resumo', {});
  ok(t('Cobrancas').find((x) => x.id === p2.id).status === 'reembolsada' && r2.reembolsos === 100 && /Reembolso/.test(contato(cli.id).tags), 'reembolso registrado');
  lanca(() => api('cobranca.reembolsar', { id: p3.id }), 'não reembolsa parcela não paga');

  /* ---------------- Mercado Pago ---------------- */
  lanca(() => api('cobranca.link', { id: p3.id }), 'sem token do Mercado Pago não gera link');
  api('config.salvar', { config: { MP_TOKEN: 'APP_USR-teste' } });
  const kMp = L.cfg().MP_CHAVE;
  const lk = api('cobranca.link', { id: p3.id });
  const pref = enviados.filter((e) => /checkout\/preferences/.test(e.url)).pop();
  ok(/mercadopago/.test(lk.link) && pref.body.external_reference === p3.id && /src=mp&k=/.test(pref.body.notification_url) && pref.body.items[0].unit_price === 333.34, 'link de pagamento da parcela');
  mpPagamentos['555'] = { id: 555, status: 'approved', external_reference: p3.id, transaction_amount: 333.34, payment_method_id: 'pix' };
  lanca(() => L.receberWebhook({ src: 'mp', k: 'errada' }, { type: 'payment', data: { id: '555' } }), 'aviso do Mercado Pago com chave errada');
  L.receberWebhook({ src: 'mp', k: kMp }, { type: 'payment', data: { id: '555' } });
  ok(t('Cobrancas').find((x) => x.id === p3.id).status === 'paga', 'pagamento aprovado confirmado na API dá baixa');
  mpPagamentos['556'] = { id: 556, status: 'pending', external_reference: p3.id };
  ok(L.receberWebhook({ src: 'mp', k: kMp }, { type: 'payment', data: { id: '556' } }).status === 'pending', 'pagamento pendente não dá baixa');
  // link de venda reutilizável: cada compra vira contato, tag, entrada e evento de venda
  const venda = api('venda.link', { descricao: 'Ebook', valor: 47 });
  api('automacao.salvar', { automacao: { nome: 'Comprou ebook', ativo: 'SIM', gatilho: { tipo: 'evento', evento: 'compra_aprovada', produto: 'ebook' }, passos: [{ id: 'e1', tipo: 'tag', acao: 'add', tag: 'Aluno' }] } });
  mpPagamentos['777'] = { id: 777, status: 'approved', external_reference: venda.id, transaction_amount: 47, payment_method_id: 'credit_card', payer: { email: 'leitor@x.com', first_name: 'Lia', last_name: 'Leitora' } };
  L.receberWebhook({ src: 'mp', k: kMp }, { type: 'payment', data: { id: '777' } });
  L.receberWebhook({ src: 'mp', k: kMp }, { type: 'payment', data: { id: '777' } });
  const leitor = t('Contatos').find((c) => c.email === 'leitor@x.com');
  ok(leitor && /Comprou: Ebook/.test(leitor.tags) && /Aluno/.test(leitor.tags) && t('Cobrancas').filter((x) => x.mp_id === '777').length === 1, 'link de venda: comprador, tag, automação e sem duplicar');
  mpPagamentos['777'].status = 'refunded';
  L.receberWebhook({ src: 'mp', k: kMp }, { type: 'payment', data: { id: '777' } });
  ok(t('Cobrancas').find((x) => x.mp_id === '777').status === 'reembolsada', 'reembolso no Mercado Pago chega no sistema');
  ok(api('config.ver').MP_TOKEN.indexOf('••') === 0 && api('config.ver').MP_CHAVE === undefined && /src=mp/.test(api('config.ver').URL_WEBHOOK_MP), 'token do Mercado Pago protegido');

  /* ---------------- chat do site ---------------- */
  const kEnt = L.cfg().ENTRADA_CHAVE, v = 'visitante-abc123xyz';
  lanca(() => L.rotear({ action: 'publico.chat.iniciar', k: kEnt, v, nome: 'Ana' }), 'chat desligado não abre');
  api('config.salvar', { config: { CHAT_ATIVO: 'SIM', CHAT_PEDIR: 'nome, whatsapp' } });
  lanca(() => L.rotear({ action: 'publico.chat.iniciar', k: kEnt, v, nome: 'Ana' }), 'chat pede o WhatsApp');
  const ini = L.rotear({ action: 'publico.chat.iniciar', k: kEnt, v, nome: 'Ana Site', telefone: '11966001122', pagina: 'https://loja.com/precos' });
  const ana = t('Contatos').find((c) => c.chat_id === v);
  ok(ini.t && ana && ana.canal === 'site' && ana.telefone === '5511966001122' && ana.origem === 'Chat do site', 'chat cria o lead com os dados');
  lanca(() => L.rotear({ action: 'publico.chat.enviar', k: kEnt, v, t: 'falso', texto: 'oi' }), 'chat com sessão falsa recusado');
  L.rotear({ action: 'publico.chat.enviar', k: kEnt, v, t: ini.t, texto: 'Quero saber o preço' });
  api('mensagem.enviar', { id: ana.id, texto: 'Oi Ana! Te explico já.' });
  const rec = L.rotear({ action: 'publico.chat.receber', k: kEnt, v, t: ini.t });
  ok(rec.mensagens.some((m) => m.de === 'eu') && rec.mensagens.some((m) => m.de === 'equipe' && m.autor === 'Admin'), 'conversa do site vai e volta pela caixa de entrada');
  ok(t('Mensagens').filter((m) => m.contato_id === ana.id && m.canal === 'site').length >= 2 && contato(ana.id).nao_lidas !== '', 'mensagens guardadas no canal site');

  /* ---------------- acessos personalizados ---------------- */
  api('usuario.salvar', { usuario: { nome: 'Tito Tráfego', email: 'trafego@teste.com', perfil: 'personalizado', permissoes: 'relatorios, todos, integracoes, inexistente', senha: 'senha-traf-1' } });
  const apiT = login('trafego@teste.com', 'senha-traf-1');
  const bt = apiT('bootstrap');
  ok(bt.permissoes.relatorios && bt.permissoes.integracoes && !bt.permissoes.disparos && !bt.permissoes.inexistente, 'perfil personalizado só com o que foi liberado');
  ok(!!apiT('relatorio', {}) && !!apiT('contato.ver', { id: cli.id }), 'gestor de tráfego vê relatórios e todos os contatos');
  lanca(() => apiT('campanha.salvar', { campanha: { nome: 'x', texto: 'y' } }), 'sem permissão de disparo');
  lanca(() => apiT('financeiro.resumo', {}), 'sem permissão de financeiro');

  /* ---------------- tarefas por usuário ---------------- */
  const sdr = t('Usuarios').find((u) => u.email === 'sdr@teste.com');
  api('tarefa.salvar', { tarefa: { titulo: 'Tarefa do admin', contato_id: cli.id } });
  api('tarefa.salvar', { tarefa: { titulo: 'Tarefa da SDR', responsavel_id: sdr.id } });
  const apiS = login('sdr@teste.com', 'senha-sdr-1');
  const ts = apiS('bootstrap').tarefas;
  ok(ts.some((x) => x.titulo === 'Tarefa da SDR') && !ts.some((x) => x.titulo === 'Tarefa do admin'), 'cada pessoa vê as próprias tarefas');

  /* ---------------- plano de suporte ---------------- */
  const SUP = L.SUP;
  const json = JSON.stringify({ p: 'anual', a: dia(200), c: 'wa.me/5511999990000', n: 'Studio Teste', d: hoje });
  const codigo = SUP.b64(json, true) + '.' + SUP.soma(json);
  ok(api('suporte.ver').tem === false, 'sem código: sem plano informado');
  lanca(() => api('suporte.salvar', { codigo: codigo.slice(0, -1) + 'x' }), 'código adulterado recusado');
  const est = api('suporte.salvar', { codigo });
  ok(est.tem && est.ativo && est.plano === 'anual' && est.dias === 200 && est.contato === 'wa.me/5511999990000', 'código de suporte lido: plano, validade e contato');
  const j2 = JSON.stringify({ p: 'mensal', a: dia(-3), c: 'suporte@x.com', n: 'Antigo', d: dia(-33) });
  const venc = api('suporte.salvar', { codigo: SUP.b64(j2, true) + '.' + SUP.soma(j2) });
  ok(venc.tem && !venc.ativo && venc.dias === -3, 'suporte vencido aparece como encerrado');
  lanca(() => apiS('suporte.salvar', { codigo }), 'só o administrador troca o código');

  /* ---------------- limites e construtor visual ---------------- */
  const lim = api('limites');
  ok(lim.contatos === t('Contatos').length && lim.usuarios >= 1 && lim.email.por_dia > 0 && lim.chamadas_hoje > 0, 'painel de limites');
  const auto = api('automacao.salvar', { automacao: { nome: 'Visual', ativo: 'SIM', gatilho: { tipo: 'manual' }, passos: [{ id: 'a', tipo: 'tag', acao: 'add', tag: 'A', prox: 'c' }, { id: 'b', tipo: 'tag', acao: 'add', tag: 'B' }, { id: 'c', tipo: 'tag', acao: 'add', tag: 'C', prox: 'fim' }, { id: 'd', tipo: 'tag', acao: 'add', tag: 'D' }] } });
  const alvo = api('contato.salvar', { contato: { nome: 'Fluxo Visual', email: 'fv@x.com' } });
  api('automacao.testar', { id: auto.id, contato_id: alvo.id });
  ok(contato(alvo.id).tags === 'A, C', 'ligações do construtor visual (próximo passo explícito)');
};
