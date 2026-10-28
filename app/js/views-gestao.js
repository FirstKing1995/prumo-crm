/* ==========================================================================
   PRUMO CRM — Relatórios, Integrações (com tutoriais) e Ajustes
   ========================================================================== */
(function () {
  'use strict';
  var S = C.S, esc = C.esc, ic = C.ic;

  /* ============================================================ RELATÓRIOS */
  var periodo = 30;
  C.views.relatorios = {
    titulo: 'Relatórios',
    render: function (el) {
      el.innerHTML = '<div class="barra-ferr"><div class="seg">' + [[7, '7 dias'], [30, '30 dias'], [90, '90 dias'], [365, '12 meses']].map(function (p) { return '<button data-p="' + p[0] + '" class="' + (periodo === p[0] ? 'on' : '') + '">' + p[1] + '</button>'; }).join('') + '</div>' +
        '<div class="dir"><button class="btn" id="r-csv">' + ic('download') + ' Exportar negócios</button></div></div><div id="rel"><div style="text-align:center;padding:40px"><span class="spin" style="color:var(--pri)"></span></div></div>';
      C.$$('[data-p]', el).forEach(function (b) { b.onclick = function () { periodo = Number(b.dataset.p); C.render(); }; });
      C.$('#r-csv').onclick = function () {
        C.baixarCsv('negocios-' + C.hoje() + '.csv', ['titulo', 'contato', 'funil', 'etapa', 'valor', 'status', 'motivo_perda', 'responsavel', 'criado_em', 'fechado_em'], S.negocios.map(function (n) {
          var c = C.contato(n.contato_id), e = C.etapa(n.etapa_id), f = C.funil(n.funil_id), u = C.usuario(n.responsavel_id);
          return [n.titulo, c ? c.nome : '', f ? f.nome : '', e ? e.nome : '', String(C.num(n.valor)).replace('.', ','), n.status, n.motivo_perda, u ? u.nome : '', n.criado_em, n.fechado_em];
        }));
      };
      C.api('relatorio', { de: C.diasAtras(periodo), ate: C.hoje() }).then(function (r) { pintar(r); }).catch(function (e) { C.toast(e.message, 'erro'); });
    }
  };

  function pintar(r) {
    var box = C.$('#rel');
    if (!box) return;
    var soma = function (k) { return r.dias.reduce(function (s, d) { return s + d[k]; }, 0); };
    var ganhos = soma('ganhos'), valor = soma('valor'), recebidas = soma('recebidas'), enviadas = soma('enviadas'), novos = soma('contatos');
    var perdidos = Object.keys(r.motivos).reduce(function (s, k) { return s + r.motivos[k]; }, 0);
    var h = '<div class="kpis">' +
      kpi('contatos', 'Novos contatos', C.inteiro(novos)) + kpi('trofeu', 'Negócios ganhos', C.inteiro(ganhos)) + kpi('dinheiro', 'Faturado', C.brlCurto(valor)) +
      kpi('raio', 'Conversão', C.pct(ganhos, ganhos + perdidos) + '%') + kpi('conversas', 'Mensagens recebidas', C.inteiro(recebidas)) + kpi('relogio', 'Tempo médio de resposta', r.tempo_resposta_min ? (r.tempo_resposta_min < 60 ? r.tempo_resposta_min + ' min' : Math.round(r.tempo_resposta_min / 60 * 10) / 10 + ' h') : '—') + '</div>';
    h += '<div class="grid-2"><div class="card"><div class="card-cab"><h3>Mensagens por dia</h3><span class="acoes small muted">recebidas · enviadas</span></div><div class="card-pad">' + barrasDuplas(r.dias, periodo) + '</div></div>';
    h += '<div class="card"><div class="card-cab"><h3>De onde vêm os contatos</h3></div><div class="card-pad">' + hbars(r.origens) + '</div></div></div>';
    var sdrs = r.usuarios.filter(function (u) { return u.perfil === 'sdr' || u.perfil === 'atendente'; });
    var closers = r.usuarios.filter(function (u) { return u.perfil !== 'sdr' && u.perfil !== 'atendente'; });
    var barraMeta = function (feito, meta) { if (!meta) return '<span class="muted small">sem meta</span>'; var p = Math.min(100, Math.round(feito / meta * 100)); return '<div class="meta-barra" title="' + p + '%"><div style="width:' + p + '%"></div></div><span class="small">' + p + '%</span>'; };
    if (sdrs.length) {
      h += '<div class="card" style="margin-top:16px"><div class="card-cab"><h3>' + ic('passar') + ' SDRs: qualificação e reuniões</h3></div><div class="tabela-wrap"><table class="tab"><thead><tr><th>SDR</th><th>Mensagens</th><th>Leads passados</th><th>Reuniões marcadas</th><th>Realizadas</th><th>Faltas</th><th>Meta de reuniões</th></tr></thead><tbody>' +
        sdrs.sort(function (a, b) { return b.passados - a.passados; }).map(function (u) { return '<tr style="cursor:default"><td>' + esc(u.nome) + '</td><td class="num">' + u.enviadas + '</td><td class="num">' + u.passados + '</td><td class="num">' + u.reunioes + '</td><td class="num">' + u.realizadas + '</td><td class="num">' + u.faltas + (u.realizadas + u.faltas ? ' <span class="small muted">(' + C.pct(u.faltas, u.realizadas + u.faltas) + '%)</span>' : '') + '</td><td><div class="meta-cel">' + barraMeta(u.reunioes, u.meta_reunioes) + '</div></td></tr>'; }).join('') + '</tbody></table></div></div>';
    }
    h += '<div class="grid-2" style="margin-top:16px"><div class="card"><div class="card-cab"><h3>' + (sdrs.length ? 'Closers e vendas' : 'Desempenho da equipe') + '</h3></div><div class="tabela-wrap"><table class="tab"><thead><tr><th>Pessoa</th><th>Recebidos</th><th>Ganhos</th><th>Valor</th><th>Em aberto</th><th>Meta</th></tr></thead><tbody>' +
      closers.sort(function (a, b) { return b.valor - a.valor; }).map(function (u) { return '<tr style="cursor:default"><td>' + esc(u.nome) + '<div class="small muted">' + esc((C.PERFIS[u.perfil] || {}).nome || '') + '</div></td><td class="num">' + u.recebidos + '</td><td class="num">' + u.ganhos + (u.ganhos + u.perdidos ? ' <span class="small muted">(' + C.pct(u.ganhos, u.ganhos + u.perdidos) + '%)</span>' : '') + '</td><td class="num">' + C.brl(u.valor) + '</td><td class="num">' + u.abertos + '</td><td><div class="meta-cel">' + barraMeta(u.valor, u.meta_valor * Math.max(1, Math.round(periodo / 30))) + '</div></td></tr>'; }).join('') + '</tbody></table></div></div>';
    h += '<div class="card"><div class="card-cab"><h3>Motivos de perda</h3></div><div class="card-pad">' + (perdidos ? hbars(r.motivos, 'var(--vermelho)') : '<p class="muted" style="margin:0">Nenhum negócio perdido no período.</p>') + '</div></div></div>';
    h += '<div class="grid-2" style="margin-top:16px"><div class="card"><div class="card-cab"><h3>Disparos</h3></div><div class="tabela-wrap"><table class="tab"><thead><tr><th>Disparo</th><th>Enviados</th><th>Respostas</th><th>Taxa</th></tr></thead><tbody>' +
      (r.campanhas.length ? r.campanhas.map(function (c) { return '<tr style="cursor:default"><td>' + esc(c.nome) + '</td><td class="num">' + c.enviados + '/' + c.total + '</td><td class="num">' + c.respostas + '</td><td class="num">' + C.pct(c.respostas, c.enviados) + '%</td></tr>'; }).join('') : '<tr><td colspan="4" class="muted">Nenhum disparo no período.</td></tr>') + '</tbody></table></div></div>';
    h += '<div class="card"><div class="card-cab"><h3>Automações</h3></div><div class="tabela-wrap"><table class="tab"><thead><tr><th>Automação</th><th>Entradas</th><th>Concluídas</th><th>Situação</th></tr></thead><tbody>' +
      r.automacoes.map(function (a) { return '<tr style="cursor:default"><td>' + esc(a.nome) + '</td><td class="num">' + a.disparos + '</td><td class="num">' + a.concluidas + '</td><td><span class="status ' + (a.ativo === 'SIM' ? 'st-on' : 'st-off') + '">' + (a.ativo === 'SIM' ? 'Ativa' : 'Desligada') + '</span></td></tr>'; }).join('') + '</tbody></table></div></div></div>';
    var cu = r.custo || {};
    if (cu.provedor === 'meta' || cu.marketing || cu.servico || cu.utility || cu.gratis) {
      h += '<div class="card" style="margin-top:16px"><div class="card-cab"><h3>' + ic('dinheiro') + ' Custo estimado da API oficial da Meta</h3></div><div class="card-pad"><div class="kpis" style="margin:0">' +
        kpi('conversas', 'Atendimento (janela aberta)', C.inteiro(cu.servico)) + kpi('disparos', 'Modelos de marketing', C.inteiro(cu.marketing)) + kpi('nota', 'Modelos de utilidade', C.inteiro(cu.utility)) + kpi('estrela', 'Grátis (anúncio)', C.inteiro(cu.gratis)) +
        kpi('dinheiro', 'Custo estimado', C.brl(cu.estimado || 0)) + kpi('trofeu', 'Economia estimada', C.brl(Math.max(0, (cu.sem_economia || 0) - (cu.estimado || 0)))) + '</div>' +
        '<p class="small muted" style="margin:10px 0 0">Estimativa com os preços de Integrações > API oficial. A economia compara com mandar tudo como modelo de marketing. O valor cobrado de verdade aparece no Gerenciador do WhatsApp da Meta.</p></div></div>';
    }
    if (r.arquivados) h += '<p class="small muted" style="margin-top:12px">' + ic('arquivo') + ' Este período inclui ' + r.arquivados + ' mês(es) que já estão no arquivo mensal do Drive.</p>';
    box.innerHTML = h;
  }
  function kpi(i, rot, val) { return '<div class="card kpi"><div class="rot">' + ic(i) + rot + '</div><div class="val">' + val + '</div></div>'; }
  function hbars(obj, cor) {
    var ks = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }).slice(0, 8);
    if (!ks.length) return '<p class="muted" style="margin:0">Sem dados no período.</p>';
    var max = obj[ks[0]] || 1;
    return ks.map(function (k) { return '<div class="hbar"><span class="trunc">' + esc(k) + '</span><div class="trilho"><div style="width:' + (obj[k] / max * 100) + '%;' + (cor ? 'background:' + cor : '') + '"></div></div><b class="num small">' + obj[k] + '</b></div>'; }).join('');
  }
  function barrasDuplas(dias, n) {
    var mapa = {}; dias.forEach(function (d) { mapa[d.dia] = d; });
    var lista = [];
    var passo = n > 90 ? 7 : 1;
    for (var i = n - 1; i >= 0; i -= passo) {
      var r = 0, e = 0, rot = C.diasAtras(i);
      for (var k = 0; k < passo; k++) { var d = mapa[C.diasAtras(i - k)]; if (d) { r += d.recebidas; e += d.enviadas; } }
      lista.push({ d: rot, r: r, e: e });
    }
    var max = Math.max.apply(null, lista.map(function (x) { return Math.max(x.r, x.e); }).concat([1]));
    return '<div class="barras" style="gap:2px">' + lista.map(function (x) {
      return '<div style="flex:1;display:flex;gap:1px;align-items:flex-end;height:100%"><div class="b" style="height:' + Math.max(2, x.r / max * 100) + '%;background:var(--whats)" data-t="' + x.d.slice(8) + '/' + x.d.slice(5, 7) + ': ' + x.r + ' recebidas"></div><div class="b" style="height:' + Math.max(2, x.e / max * 100) + '%" data-t="' + x.e + ' enviadas"></div></div>';
    }).join('') + '</div><div class="eixo"><span>' + C.fmtData(lista[0].d, false) + '</span><span>hoje</span></div>';
  }

  /* ============================================================ INTEGRAÇÕES */
  var CFGA = null; // configuração completa (só admin)
  function carregarCfg() { return C.api('config.ver').then(function (c) { CFGA = c; return c; }); }

  C.views.integracoes = {
    titulo: 'Integrações',
    render: function (el) {
      el.innerHTML = '<div style="text-align:center;padding:40px"><span class="spin" style="color:var(--pri)"></span></div>';
      carregarCfg().then(function () { pintarIntegracoes(el); }).catch(function (e) { C.toast(e.message, 'erro'); });
    }
  };

  var INTEG = [
    { id: 'evolution', grupo: 'WhatsApp', nome: 'Evolution API', cor: '#16A34A', ic: 'whats', tag: 'Recomendado', desc: 'Gratuita e de código aberto. Conecta pelo QR Code, como o WhatsApp Web. Envia, recebe, grupos e mídia.' },
    { id: 'waha', grupo: 'WhatsApp', nome: 'WAHA', cor: '#0EA5E9', ic: 'whats', tag: 'Gratuito', desc: 'Alternativa gratuita (versão Core) à Evolution. Também conecta pelo QR Code.' },
    { id: 'meta', grupo: 'WhatsApp', nome: 'API oficial da Meta', cor: '#2563EB', ic: 'escudo', tag: 'Oficial', desc: 'WhatsApp Cloud API. Sem risco de bloqueio por uso de API não oficial. A Meta cobra por mensagem iniciada pela empresa.' },
    { id: 'link', grupo: 'WhatsApp', nome: 'Modo link (sem API)', cor: '#64748B', ic: 'link', tag: 'Sem instalar nada', desc: 'O sistema abre a conversa no seu WhatsApp com o texto pronto e você aperta enviar. Não recebe mensagens nem usa robôs.' },
    { id: 'instagram', grupo: 'Instagram', nome: 'Instagram Direct e comentários', cor: '#C13584', ic: 'instagram', tag: 'API oficial', desc: 'Receba e responda o Direct na mesma caixa de entrada. Quem comentar uma palavra no post recebe a mensagem no Direct, sozinho.' },
    { id: 'mercadopago', grupo: 'Pagamentos', nome: 'Mercado Pago', cor: '#009EE3', ic: 'dinheiro', desc: 'Links de pagamento para parcelas e produtos. Quando a pessoa paga, a baixa é automática, com tags e automações.' },
    { id: 'chat', grupo: 'Chat do site', nome: 'Chat do site', cor: '#7C3AED', ic: 'conversas', desc: 'Uma janela de conversa no seu site. O visitante deixa nome e WhatsApp e a conversa chega na sua caixa de entrada.' },
    { id: 'email', grupo: 'E-mail marketing', nome: 'Envio de e-mails (Gmail e Brevo)', cor: '#EA4335', ic: 'email', tag: 'Grátis', desc: 'Campanhas e e-mails de automação saem pelo Gmail da sua conta Google. Para mandar mais por dia, some o plano grátis do Brevo.' },
    { id: 'rastreio', grupo: 'E-mail marketing', nome: 'Rastreio do site', cor: '#0891B2', ic: 'olho', desc: 'Saiba quais páginas do seu site os contatos visitam depois de clicar num e-mail e dispare automações por isso.' },
    { id: 'hotmart', grupo: 'Vendas e cursos', nome: 'Hotmart', cor: '#F04E23', ic: 'carrinho', desc: 'Compra aprovada, carrinho abandonado, boleto, reembolso e cancelamento viram tags, negócio ganho e gatilho de automação.' },
    { id: 'kiwify', grupo: 'Vendas e cursos', nome: 'Kiwify', cor: '#16A34A', ic: 'carrinho', desc: 'Mesmo funcionamento da Hotmart: recupere carrinho, boleto e Pix pelo WhatsApp e marque quem comprou.' },
    { id: 'activecampaign', grupo: 'E-mail marketing', nome: 'ActiveCampaign', cor: '#356AE6', ic: 'email', desc: 'Leads do ActiveCampaign chegam aqui, e as automações daqui mandam contatos e tags para o ActiveCampaign.' },
    { id: 'leadads', grupo: 'Captação', nome: 'Anúncios de cadastro', cor: '#0F172A', ic: 'alvo', desc: 'Formulários de anúncios do Facebook, Instagram e TikTok direto para o CRM, com origem e tags.' },
    { id: 'entrada', grupo: 'Captação', nome: 'Formulários e sites', cor: '#7C3AED', ic: 'webhook', desc: 'Receba leads de Elementor, WordPress, Typebot, RD Station, Google Forms e qualquer ferramenta que envie webhook.' },
    { id: 'form', grupo: 'Captação', nome: 'Formulário pronto', cor: '#DB2777', ic: 'nota', desc: 'Código de formulário para colar no seu site ou página. Cada envio vira contato e pode iniciar uma automação.' },
    { id: 'saida', grupo: 'Automação externa', nome: 'n8n, Make e Zapier', cor: '#EA580C', ic: 'raio', desc: 'Avise outros sistemas quando um contato é criado, uma mensagem chega, um lead é passado ou uma venda acontece.' },
    { id: 'api', grupo: 'Automação externa', nome: 'API do sistema', cor: '#334155', ic: 'api', desc: 'Outros sistemas criam contatos, mandam mensagens, colocam tags e iniciam automações por uma URL com chave secreta.' },
    { id: 'planilha', grupo: 'Dados', nome: 'Google Planilhas', cor: '#15803D', ic: 'planilha', tag: 'Conectado', desc: 'Todos os dados ficam numa planilha na sua conta Google. Você é dono deles e pode abrir, filtrar e fazer backup.' }
  ];

  function pintarIntegracoes(el) {
    var prov = CFGA.WA_PROVEDOR;
    var h = '<div class="aviso info">' + ic('info') + '<div>WhatsApp em uso agora: <b>' + esc((INTEG.filter(function (i) { return i.id === prov; })[0] || {}).nome || prov) + '</b>. ' + esc(S.waStatus ? S.waStatus.texto || '' : '') + '</div></div>';
    var grupos = {};
    INTEG.forEach(function (i) { (grupos[i.grupo] = grupos[i.grupo] || []).push(i); });
    Object.keys(grupos).forEach(function (g) {
      h += '<h3 style="font-size:14px;margin:22px 0 10px;color:var(--txt-2)">' + g + '</h3><div class="integ-grade">' + grupos[g].map(function (i) {
        var ativo = (i.grupo === 'WhatsApp' && prov === i.id) || (i.id === 'instagram' && S.config.instagram) || (i.id === 'activecampaign' && S.config.activecampaign) || (i.id === 'mercadopago' && S.config.mercadopago) || (i.id === 'chat' && S.config.chat);
        return '<div class="card integ"><div class="integ-cab"><span class="integ-logo" style="background:' + i.cor + '1A;color:' + i.cor + '">' + ic(i.ic) + '</span><div><b>' + i.nome + '</b>' + (ativo ? ' <span class="status st-on">Em uso</span>' : i.tag ? ' <span class="status st-off">' + i.tag + '</span>' : '') + '</div></div>' +
          '<p>' + i.desc + '</p><button class="btn ' + (ativo ? 'pri' : '') + '" data-in="' + i.id + '">' + (i.grupo === 'WhatsApp' ? (ativo ? 'Configurar' : 'Usar e configurar') : 'Abrir') + ' ' + ic('dir') + '</button></div>';
      }).join('') + '</div>';
    });
    el.innerHTML = h;
    C.$$('[data-in]', el).forEach(function (b) { b.onclick = function () { abrirIntegracao(b.dataset.in); }; });
  }

  function salvarCfg(dados) {
    return C.api('config.salvar', { config: dados }).then(function (c) { CFGA = c; C.atualizarWa(); return c; });
  }

  function abrirIntegracao(id) {
    var i = INTEG.filter(function (x) { return x.id === id; })[0];
    var corpo = '', pe = '<button class="btn" data-fechar>Fechar</button>';
    var urlWa = CFGA.URL_WEBHOOK_WA, urlEnt = CFGA.URL_WEBHOOK_ENTRADA;
    var semUrl = !CFGA.URL_APP ? '<div class="aviso erro">' + ic('alerta') + '<div>O servidor ainda não sabe o próprio endereço. No Apps Script, rode a função <b>definirUrlDoApp</b> com a URL que termina em /exec (veja o guia de instalação).</div></div>' : '';
    if (id === 'evolution') {
      corpo = semUrl + '<div class="grid-2" style="align-items:start"><div><h3 style="font-size:15px;margin-bottom:12px">Tutorial</h3><ol class="passos-tut">' +
        '<li><b>Tenha um servidor com a Evolution API</b>A Evolution é gratuita, mas precisa ficar ligada 24 horas num servidor. Opções: uma VPS barata (Hostinger, Contabo, Hetzner, a partir de uns R$ 25/mês) com o instalador de 1 clique da Evolution, ou um parceiro que já hospeda para você. O guia <b>docs/WHATSAPP_EVOLUTION.md</b> tem o passo a passo com Docker.</li>' +
        '<li><b>Copie 2 dados do servidor</b>O endereço (ex.: https://api.suaempresa.com.br) e a chave global (variável AUTHENTICATION_API_KEY).</li>' +
        '<li><b>Preencha ao lado e salve</b>O nome da instância pode ser qualquer palavra sem espaço, como "atendimento".</li>' +
        '<li><b>Clique em Conectar e leia o QR Code</b>No celular: WhatsApp > Aparelhos conectados > Conectar aparelho. O webhook é configurado sozinho.</li>' +
        '<li><b>Teste</b>Envie uma mensagem de teste para o seu celular e mande um "oi" do seu celular para o número conectado. Ela deve aparecer em Conversas.</li></ol></div>' +
        '<div><div class="campo"><label>URL da Evolution API</label><input class="inp" id="e-url" value="' + esc(CFGA.EVOLUTION_URL) + '" placeholder="https://api.suaempresa.com.br"></div>' +
        '<div class="campo"><label>Chave global (apikey)</label><input class="inp" id="e-key" value="' + esc(CFGA.EVOLUTION_APIKEY) + '" autocomplete="off"></div>' +
        '<div class="campo"><label>Nome da instância</label><input class="inp" id="e-inst" value="' + esc(CFGA.EVOLUTION_INSTANCIA || 'atendimento') + '"></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="e-salvar" data-carregando=" Salvando...">Salvar e usar Evolution</button><button class="btn" id="e-con" data-carregando=" Gerando QR...">' + ic('qr') + ' Conectar</button></div>' +
        '<div id="e-qr" style="margin-top:14px"></div>' + blocoTeste() +
        '<details style="margin-top:14px"><summary class="small muted">Webhook (configurado automaticamente)</summary><div style="margin-top:8px">' + C.copiavel(urlWa) + '<p class="small muted">Eventos: MESSAGES_UPSERT e CONNECTION_UPDATE. Só configure manualmente se o automático falhar.</p></div></details></div></div>';
    } else if (id === 'waha') {
      corpo = semUrl + '<div class="grid-2" style="align-items:start"><div><h3 style="font-size:15px;margin-bottom:12px">Tutorial</h3><ol class="passos-tut">' +
        '<li><b>Suba o WAHA num servidor</b>Com Docker: <code>docker run -it -p 3000:3000 -e WHATSAPP_API_KEY=suachave devlikeapro/waha</code>. Coloque um domínio com HTTPS na frente (o guia docs/WHATSAPP_WAHA.md mostra como).</li>' +
        '<li><b>Preencha URL e chave</b>A chave é o valor de WHATSAPP_API_KEY. A versão gratuita (Core) usa a sessão "default".</li>' +
        '<li><b>Clique em Conectar</b>O sistema cria a sessão, aponta o webhook e mostra o QR Code.</li>' +
        '<li><b>Leia o QR Code e teste</b>WhatsApp > Aparelhos conectados > Conectar aparelho.</li></ol></div>' +
        '<div><div class="campo"><label>URL do WAHA</label><input class="inp" id="w-url" value="' + esc(CFGA.WAHA_URL) + '" placeholder="https://waha.suaempresa.com.br"></div>' +
        '<div class="campo"><label>Chave (X-Api-Key)</label><input class="inp" id="w-key" value="' + esc(CFGA.WAHA_APIKEY) + '" autocomplete="off"></div>' +
        '<div class="campo"><label>Sessão</label><input class="inp" id="w-ses" value="' + esc(CFGA.WAHA_SESSAO || 'default') + '"></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="w-salvar" data-carregando=" Salvando...">Salvar e usar WAHA</button><button class="btn" id="w-con" data-carregando=" Gerando QR...">' + ic('qr') + ' Conectar</button></div>' +
        '<div id="w-qr" style="margin-top:14px"></div>' + blocoTeste() +
        '<details style="margin-top:14px"><summary class="small muted">Webhook</summary><div style="margin-top:8px">' + C.copiavel(urlWa) + '<p class="small muted">Eventos: message e message.any.</p></div></details></div></div>';
    } else if (id === 'meta') {
      corpo = semUrl + '<div class="grid-2" style="align-items:start"><div><h3 style="font-size:15px;margin-bottom:12px">Tutorial</h3><ol class="passos-tut">' +
        '<li><b>Crie o app na Meta</b>Em developers.facebook.com > Meus apps > Criar app > tipo Empresa. Adicione o produto WhatsApp.</li>' +
        '<li><b>Adicione o número</b>Em WhatsApp > Configuração da API, cadastre e verifique o número da empresa (ele não pode estar em uso no app do WhatsApp).</li>' +
        '<li><b>Gere um token permanente</b>Configurações do negócio > Usuários do sistema > Adicionar (admin) > Gerar token com as permissões whatsapp_business_messaging e whatsapp_business_management.</li>' +
        '<li><b>Copie o ID do número</b>Em Configuração da API aparece o "Identificação do número de telefone" (Phone number ID).</li>' +
        '<li><b>Configure o webhook</b>Em WhatsApp > Configuração > Webhook: cole a URL de retorno e o token de verificação mostrados aqui. Depois assine o campo <b>messages</b>.</li>' +
        '<li><b>Modelos de mensagem</b>Para iniciar conversa (disparos), a Meta exige modelos aprovados. Crie em Gerenciador do WhatsApp > Modelos e use o nome deles nos disparos.</li></ol>' +
        '<h3 style="font-size:15px;margin:18px 0 8px">Como o sistema economiza na Meta</h3><ul class="small" style="padding-left:18px;margin-top:0">' +
        '<li><b>Janela de 24 horas.</b> Cada conversa mostra se a janela está aberta. Dentro dela, respostas são mensagens de atendimento (as primeiras 1.000 do mês são grátis por número). Fora dela, o sistema avisa e pede um modelo.</li>' +
        '<li><b>Disparos econômicos.</b> Quem está com a janela aberta recebe texto comum; só quem está com a janela fechada recebe o modelo pago. A tela de disparo mostra a estimativa antes de enviar.</li>' +
        '<li><b>Botões e listas.</b> Menus dos robôs viram botões tocáveis, então a pessoa responde certo de primeira e a conversa gasta menos mensagens.</li>' +
        '<li><b>Formulário em uma mensagem (WhatsApp Flows).</b> O passo Formulário das automações coleta nome, e-mail e outros dados numa tela só, em vez de várias perguntas.</li>' +
        '<li><b>Anúncios que levam ao WhatsApp.</b> Quem chega por um anúncio de clique para o WhatsApp abre uma janela grátis (o sistema conta 72 horas; se a Meta mudar o prazo, ajuste em Preços abaixo). O contato fica marcado e as mensagens nesse período não são cobradas.</li></ul></div>' +
        '<div><div class="campo"><label>Token de acesso</label><input class="inp" id="m-token" value="' + esc(CFGA.META_TOKEN) + '" autocomplete="off"></div>' +
        '<div class="campo"><label>Phone number ID</label><input class="inp" id="m-phone" value="' + esc(CFGA.META_PHONE_ID) + '"></div>' +
        '<div class="campo"><label>Token de verificação do webhook (invente uma senha)</label><input class="inp" id="m-verify" value="' + esc(CFGA.META_VERIFY || '') + '"></div>' +
        '<details style="margin-bottom:12px"><summary class="small"><b>Preços para a estimativa de custo (R$ por mensagem)</b></summary><p class="small muted">Valores aproximados. Confira a tabela atual da Meta para o Brasil e ajuste aqui.</p><div class="grade2">' +
        '<div class="campo"><label>Marketing</label><input class="inp" id="m-pm" value="' + esc(CFGA.META_PRECO_MARKETING) + '"></div><div class="campo"><label>Utilidade</label><input class="inp" id="m-pu" value="' + esc(CFGA.META_PRECO_UTILITY) + '"></div>' +
        '<div class="campo"><label>Atendimento (após a franquia)</label><input class="inp" id="m-ps" value="' + esc(CFGA.META_PRECO_SERVICO) + '"></div><div class="campo"><label>Franquia grátis de atendimento por mês</label><input class="inp" id="m-pf" value="' + esc(CFGA.META_FRANQUIA_SERVICO) + '"></div>' +
        '<div class="campo"><label>Horas grátis após clique em anúncio</label><input class="inp" id="m-pg" value="' + esc(CFGA.META_GRATIS_HORAS) + '"></div></div></details>' +
        '<button class="btn pri" id="m-salvar" data-carregando=" Salvando...">Salvar e usar API oficial</button>' +
        '<div style="margin-top:16px"><span class="rot">URL de retorno (webhook)</span>' + C.copiavel(urlWa) + '</div>' + blocoTeste() + '</div></div>';
    } else if (id === 'link') {
      corpo = '<p style="margin-top:0">No modo link o sistema não precisa de servidor nem de API. Ao enviar uma mensagem, o WhatsApp abre no seu celular ou computador com o texto pronto.</p><ul class="muted"><li>Funciona na hora, sem configurar nada.</li><li>Não recebe mensagens no sistema (as conversas ficam só no seu WhatsApp).</li><li>Robôs e disparos automáticos não funcionam. Disparos viram envio assistido, um por um.</li></ul>' +
        '<div class="campo"><label>Número do WhatsApp da empresa (opcional)</label><input class="inp" id="l-num" value="' + esc(CFGA.WA_NUMERO) + '" placeholder="5511999999999"></div>';
      pe = '<button class="btn" data-fechar>Fechar</button><button class="btn pri" id="l-salvar" data-carregando=" Salvando...">Usar modo link</button>';
    } else if (id === 'entrada') {
      var ex = urlEnt + '&origem=Site&tags=Lead%20site';
      corpo = '<p style="margin-top:0">Toda ferramenta que envia <b>webhook</b> (POST com JSON ou formulário) pode criar contatos aqui. O sistema reconhece sozinho os campos de nome, e-mail, telefone, empresa e cidade, mesmo com nomes diferentes (name, phone, whatsapp, celular...).</p>' +
        '<span class="rot">Sua URL de webhook</span>' + C.copiavel(urlEnt) +
        '<h3 style="font-size:14.5px;margin:18px 0 8px">Parâmetros opcionais (coloque no fim da URL)</h3><ul class="small" style="margin-top:0;padding-left:18px">' +
        '<li><b>&amp;origem=Site</b> registra a origem do lead (e pode filtrar automações)</li><li><b>&amp;tags=Lead%20site,Promo</b> adiciona tags</li>' +
        '<li><b>&amp;automacao=ID</b> inicia uma automação específica</li><li><b>&amp;etapa=ID</b> cria o negócio já numa etapa do funil</li></ul>' +
        '<span class="rot">Exemplo completo</span>' + C.copiavel(ex) +
        '<h3 style="font-size:14.5px;margin:18px 0 8px">IDs úteis</h3><div class="grade2 small"><div><b>Automações</b>' + S.automacoes.map(function (a) { return '<div class="trunc">' + esc(a.nome) + ': <code>' + a.id + '</code></div>'; }).join('') + '</div><div><b>Etapas</b>' + S.funis.map(function (f) { return f.etapas.map(function (e) { return '<div class="trunc">' + esc(f.nome + ' > ' + e.nome) + ': <code>' + e.id + '</code></div>'; }).join(''); }).join('') + '</div></div>' +
        '<h3 style="font-size:14.5px;margin:18px 0 8px">Onde colar em cada ferramenta</h3><ol class="passos-tut">' +
        '<li><b>Elementor (WordPress)</b>No formulário: Ações após envio > Webhook. Cole a URL. Marque "Avançado" para mandar os campos com nome.</li>' +
        '<li><b>Typebot</b>Adicione o bloco HTTP request (POST) no fim do fluxo, com corpo JSON contendo nome, telefone e email.</li>' +
        '<li><b>Hotmart / Kiwify / Eduzz</b>Em Ferramentas > Webhooks (Postback), cole a URL com &amp;origem=Hotmart e as tags que quiser, como Comprador.</li>' +
        '<li><b>RD Station / ActiveCampaign</b>Na automação, use a ação Enviar webhook (ou Integração por webhook) com a URL.</li>' +
        '<li><b>Anúncios de cadastro do Facebook/Instagram</b>Use Make ou Zapier: gatilho "New Lead (Facebook Lead Ads)" e ação "HTTP / Webhook POST" para a URL.</li>' +
        '<li><b>Google Forms</b>Use o script pronto em docs/INTEGRACOES.md (copiar e colar no editor de script do formulário).</li></ol>' +
        '<h3 style="font-size:14.5px;margin:18px 0 8px">Testar agora</h3><textarea class="inp" id="t-json" rows="4">{"nome": "Teste Webhook", "email": "teste@exemplo.com", "telefone": "11999998888"}</textarea>' +
        '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn" id="t-env" data-carregando=" Enviando...">' + ic('play') + ' Enviar teste</button>' +
        '<button class="btn perigo" id="t-chave">' + ic('atualizar') + ' Gerar nova chave</button></div>';
    } else if (id === 'form') {
      var codigo = codigoFormulario();
      corpo = '<p style="margin-top:0">Cole este código no seu site (Elementor: widget HTML; WordPress: bloco HTML personalizado; Wix: Incorporar código). O visual usa as cores do sistema e você pode trocar os textos à vontade.</p>' +
        '<div class="grade2"><div class="campo"><label>Origem</label><input class="inp" id="f-origem" value="Site"></div><div class="campo"><label>Tags</label><input class="inp" id="f-tags" value="Lead site"></div>' +
        '<div class="campo"><label>Iniciar automação</label><select class="inp" id="f-auto"><option value="">Nenhuma</option>' + S.automacoes.map(function (a) { return '<option value="' + a.id + '">' + esc(a.nome) + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label>Mensagem de sucesso</label><input class="inp" id="f-ok" value="Recebemos seus dados. Em instantes falamos com você no WhatsApp."></div></div>' +
        '<span class="rot">Código</span><textarea class="inp" id="f-cod" rows="9" readonly style="font-family:ui-monospace,Consolas,monospace;font-size:12px">' + esc(codigo) + '</textarea>' +
        '<button class="btn" id="f-copia" style="margin-top:8px">' + ic('copiar') + ' Copiar código</button>';
    } else if (id === 'saida') {
      var lista = C.json(CFGA.WEBHOOKS_SAIDA, []);
      corpo = '<p style="margin-top:0">Cadastre URLs que recebem um POST em JSON quando algo acontece. No n8n use o nó Webhook; no Make, o módulo Custom webhook; no Zapier, "Catch Hook".</p><div id="s-lista"></div><button class="btn peq" id="s-add">' + ic('plus') + ' Adicionar URL</button>' +
        '<h3 style="font-size:14px;margin:18px 0 6px">Exemplo do que chega</h3><code class="bloco">{\n  "evento": "contato.criado",\n  "sistema": "' + esc((S.config.marca || {}).nome) + '",\n  "data": "2026-10-27T14:30:00",\n  "dados": { "contato": { "nome": "...", "telefone": "...", "tags": [] } }\n}</code>';
      pe = '<button class="btn" data-fechar>Fechar</button><button class="btn pri" id="s-salvar" data-carregando=" Salvando...">Salvar</button>';
      var EVS = [['contato.criado', 'Contato criado'], ['mensagem.recebida', 'Mensagem recebida'], ['negocio.ganho', 'Negócio ganho'], ['negocio.perdido', 'Negócio perdido'], ['lead.passado', 'Lead passado para closer'], ['reuniao.agendada', 'Reunião agendada'], ['compra.compra_aprovada', 'Compra aprovada'], ['compra.carrinho_abandonado', 'Carrinho abandonado']];
      var el0;
      setTimeout(function () {
        el0 = C.$('#s-lista');
        if (!el0) return; // janela fechada antes de montar
        var pinta = function () {
          el0.innerHTML = lista.map(function (w, k) {
            return '<div class="card" style="padding:12px;margin-bottom:10px"><div class="linha" style="align-items:center"><input class="inp" data-su="' + k + '" value="' + esc(w.url || '') + '" placeholder="https://..."><button class="btn fantasma ic perigo" data-sd="' + k + '" style="flex:0 0 38px" aria-label="Remover">' + ic('lixo') + '</button></div>' +
              '<div style="margin-top:8px">' + EVS.map(function (ev) { return '<label class="check" style="display:inline-flex;margin:0 14px 0 0"><input type="checkbox" data-se="' + k + '" value="' + ev[0] + '"' + (!w.eventos || !w.eventos.length || w.eventos.indexOf(ev[0]) >= 0 ? ' checked' : '') + '> ' + ev[1] + '</label>'; }).join('') + '</div></div>';
          }).join('') || '<p class="muted">Nenhuma URL cadastrada.</p>';
          C.$$('[data-su]', el0).forEach(function (x) { x.oninput = function () { lista[x.dataset.su].url = x.value.trim(); }; });
          C.$$('[data-sd]', el0).forEach(function (x) { x.onclick = function () { lista.splice(Number(x.dataset.sd), 1); pinta(); }; });
          C.$$('[data-se]', el0).forEach(function (x) { x.onchange = function () { var k = x.dataset.se; lista[k].eventos = C.$$('[data-se="' + k + '"]', el0).filter(function (y) { return y.checked; }).map(function (y) { return y.value; }); }; });
        };
        pinta();
        C.$('#s-add').onclick = function () { lista.push({ url: '', eventos: [] }); pinta(); };
        C.$('#s-salvar').onclick = function () { var b = this; C.comBotao(b, function () { return salvarCfg({ WEBHOOKS_SAIDA: JSON.stringify(lista.filter(function (w) { return w.url; })) }).then(function () { C.toast('Webhooks salvos', 'ok'); }); }); };
      }, 0);
    } else if (id === 'instagram') {
      corpo = semUrl + '<div class="grid-2" style="align-items:start"><div><h3 style="font-size:15px;margin-bottom:12px">Tutorial</h3><ol class="passos-tut">' +
        '<li><b>Conta profissional</b>No app do Instagram: Configurações > Tipo de conta > mude para Profissional (Empresa ou Criador de conteúdo).</li>' +
        '<li><b>Crie o app na Meta</b>developers.facebook.com > Meus apps > Criar app > tipo Empresa. Adicione o produto <b>Instagram</b> e escolha "API com login do Instagram".</li>' +
        '<li><b>Gere o token</b>Em Instagram > Configuração da API, adicione a sua conta e clique em Gerar token. Copie o token e o ID da conta do Instagram (aparece logo acima).</li>' +
        '<li><b>Configure o webhook</b>Na mesma tela, em Webhooks: cole a URL de retorno e o token de verificação mostrados aqui (o mesmo da API oficial do WhatsApp; se não usa a API oficial, invente um e salve abaixo). Assine os campos <b>messages</b> e <b>comments</b>.</li>' +
        '<li><b>Libere as mensagens</b>No app do Instagram: Configurações > Mensagens e respostas > Ferramentas conectadas > Permitir acesso às mensagens.</li>' +
        '<li><b>Crie a automação</b>Em Automações, use o gatilho <b>Comentou no Instagram</b> com a palavra (ex.: EU QUERO). A primeira mensagem vai como resposta privada no Direct.</li></ol>' +
        '<p class="small muted">O Instagram só deixa responder no Direct até 24 horas depois da última mensagem da pessoa. Enquanto o app da Meta estiver em modo de desenvolvimento, só contas de teste conseguem conversar.</p></div>' +
        '<div><div class="campo"><label>Token de acesso do Instagram</label><input class="inp" id="ig-token" value="' + esc(CFGA.IG_TOKEN) + '" autocomplete="off"></div>' +
        '<div class="campo"><label>ID da conta do Instagram</label><input class="inp" id="ig-id" value="' + esc(CFGA.IG_ID) + '"></div>' +
        '<div class="campo"><label>Token de verificação do webhook</label><input class="inp" id="ig-verify" value="' + esc(CFGA.META_VERIFY || '') + '"></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="ig-salvar" data-carregando=" Salvando...">Salvar</button><button class="btn" id="ig-testar" data-carregando=" Testando...">' + ic('play') + ' Testar conexão</button></div>' +
        '<div id="ig-res" style="margin-top:10px"></div><div style="margin-top:16px"><span class="rot">URL de retorno (webhook)</span>' + C.copiavel(urlWa) + '</div></div></div>';
    } else if (id === 'mercadopago') {
      corpo = semUrl + '<div class="grid-2" style="align-items:start"><div><h3 style="font-size:15px;margin-bottom:12px">Tutorial</h3><ol class="passos-tut">' +
        '<li><b>Entre no painel de desenvolvedor</b>Em mercadopago.com.br/developers, faça login com a conta que vai receber os pagamentos e clique em Suas integrações > Criar aplicação (tipo Checkout Pro).</li>' +
        '<li><b>Copie o Access Token de produção</b>Na aplicação: Credenciais de produção > Access Token (começa com APP_USR-). Para testar antes, use o de teste (TEST-).</li>' +
        '<li><b>Cole ao lado e teste</b>O sistema confirma a conta.</li>' +
        '<li><b>Pronto</b>As notificações de pagamento já vão no próprio link (não precisa configurar webhook no painel do Mercado Pago).</li></ol>' +
        '<h3 style="font-size:15px;margin:16px 0 8px">O que você ganha</h3><ul class="small" style="padding-left:18px;margin-top:0"><li>Link de pagamento em cada parcela das cobranças (Pix, cartão e boleto, conforme a sua conta).</li><li>Links de venda de produtos para divulgar em qualquer lugar.</li><li>Pagou: baixa automática, tag e gatilho "Pagamento recebido". Reembolso ou chargeback também chegam sozinhos.</li><li>Nas mensagens, use {link_pagamento}, {valor_parcela} e {vencimento}.</li></ul>' +
        '<p class="small muted">O Mercado Pago cobra as tarifas normais dele por venda. O sistema não cobra nada a mais.</p></div>' +
        '<div><div class="campo"><label>Access Token</label><input class="inp" id="mp-tk" value="' + esc(CFGA.MP_TOKEN) + '" autocomplete="off" placeholder="APP_USR-..."></div>' +
        '<div class="campo"><label>Página de agradecimento (opcional)</label><input class="inp" id="mp-ret" value="' + esc(CFGA.MP_RETORNO) + '" placeholder="https://seusite.com.br/obrigado"><span class="ajuda">Para onde a pessoa volta depois de pagar.</span></div>' +
        '<div class="campo"><label>Avisar quantos dias antes do vencimento</label><input class="inp" type="number" min="1" id="mp-dias" value="' + esc(CFGA.LEMBRETE_COBRANCA_DIAS) + '"><span class="ajuda">Usado pelo gatilho "Cobrança perto de vencer".</span></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="mp-salvar" data-carregando=" Salvando...">Salvar</button><button class="btn" id="mp-testar" data-carregando=" Testando...">' + ic('play') + ' Testar conexão</button></div><div id="mp-res" style="margin-top:10px"></div>' +
        (CFGA.URL_WEBHOOK_MP ? '<details style="margin-top:14px"><summary class="small muted">Endereço de notificação (já vai em cada link)</summary><div style="margin-top:8px">' + C.copiavel(CFGA.URL_WEBHOOK_MP) + '</div></details>' : '') + '</div></div>';
    } else if (id === 'chat') {
      var chave = (String(CFGA.URL_WEBHOOK_ENTRADA).match(/k=([^&]+)/) || [])[1] || '';
      var codigoC = '<script src="' + location.origin + location.pathname.replace(/[^/]*$/, '') + 'chat.js" data-api="' + (CFGA.URL_APP || 'URL_DO_APPS_SCRIPT') + '" data-k="' + chave + '" async></' + 'script>';
      var pedir = C.tags(CFGA.CHAT_PEDIR || '');
      corpo = '<div class="grid-2" style="align-items:start"><div>' +
        '<label class="check"><input type="checkbox" id="ch-at"' + (CFGA.CHAT_ATIVO === 'SIM' ? ' checked' : '') + '> Chat ligado</label>' +
        '<div class="campo"><label>Título da janela</label><input class="inp" id="ch-tit" value="' + esc(CFGA.CHAT_TITULO) + '"></div>' +
        '<div class="campo"><label>Mensagem de boas-vindas</label><textarea class="inp" id="ch-sau" rows="2">' + esc(CFGA.CHAT_SAUDACAO) + '</textarea></div>' +
        '<div class="campo"><label>Antes de começar, pedir</label>' + [['nome', 'Nome'], ['whatsapp', 'WhatsApp'], ['email', 'E-mail']].map(function (x) { return '<label class="check" style="display:inline-flex;margin-right:14px"><input type="checkbox" data-ped="' + x[0] + '"' + (pedir.indexOf(x[0]) >= 0 ? ' checked' : '') + '> ' + x[1] + '</label>'; }).join('') + '<span class="ajuda">Assim todo visitante que conversa vira um lead com contato. Recomendado: nome e WhatsApp.</span></div>' +
        '<button class="btn pri" id="ch-salvar" data-carregando=" Salvando...">Salvar</button></div>' +
        '<div><span class="rot">Código para o seu site</span><p class="small muted" style="margin-top:4px">Cole antes de <code>&lt;/body&gt;</code> (WordPress: plugin de inserir código no rodapé; Elementor: widget HTML).</p><textarea class="inp" id="ch-cod" rows="3" readonly style="font-family:ui-monospace,Consolas,monospace;font-size:12px">' + esc(codigoC) + '</textarea>' +
        '<button class="btn" id="ch-copia" style="margin-top:8px">' + ic('copiar') + ' Copiar código</button>' +
        '<ul class="small" style="padding-left:18px"><li>As conversas aparecem em <b>Conversas</b> com o ícone do site e ficam guardadas no histórico do contato.</li><li>Os robôs (automações) também respondem no chat.</li><li>A cor e o nome seguem a sua marca.</li></ul></div></div>';
    } else if (id === 'email') {
      corpo = '<div class="grid-2" style="align-items:start"><div><h3 style="font-size:15px;margin-bottom:10px">Como funciona, sem custo</h3><ul class="small" style="padding-left:18px;margin-top:0">' +
        '<li><b>Gmail da sua conta Google:</b> o servidor (o Apps Script da sua planilha) manda os e-mails pelo seu Gmail. O Google libera cerca de <b>100 por dia</b> em conta Gmail comum e <b>1.500 por dia</b> no Google Workspace. Deixamos uma margem abaixo do limite.</li>' +
        '<li><b>Brevo (opcional):</b> o plano grátis manda <b>300 por dia</b>. Escolha "Gmail e Brevo" para somar os dois.</li>' +
        '<li>Passou do limite do dia? O resto fica na fila e sai sozinho no dia seguinte, às 8h.</li>' +
        '<li>Todo e-mail leva o link para a pessoa sair da lista, como pede a LGPD. Quem sai não recebe mais nenhum e-mail.</li></ul>' +
        '<h3 style="font-size:15px;margin:16px 0 10px">Brevo em 4 passos</h3><ol class="passos-tut"><li><b>Crie a conta grátis</b>Em brevo.com, plano Free.</li><li><b>Cadastre o remetente</b>Remetentes, domínios e IPs > Remetentes > Adicionar. Confirme o e-mail. Com domínio próprio, autentique o domínio (melhora a entrega).</li><li><b>Gere a chave</b>SMTP e API > Chaves de API > Gerar nova chave.</li><li><b>Cole ao lado</b>Chave e e-mail do remetente cadastrado.</li></ol></div>' +
        '<div><div class="campo"><label>Enviar por</label><select class="inp" id="em-prov">' + [['gmail', 'Gmail da conta Google (grátis)'], ['brevo', 'Só Brevo'], ['ambos', 'Gmail e Brevo (soma os limites)']].map(function (o) { return '<option value="' + o[0] + '"' + (CFGA.EMAIL_PROVEDOR === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="grade2"><div class="campo"><label>Nome do remetente</label><input class="inp" id="em-nome" value="' + esc(CFGA.EMAIL_NOME || CFGA.NOME) + '"></div><div class="campo"><label>Responder para (opcional)</label><input class="inp" id="em-resp" value="' + esc(CFGA.EMAIL_RESPONDER) + '" placeholder="contato@suaempresa.com.br"></div></div>' +
        '<div class="campo"><label>Rodapé: nome da empresa e endereço</label><input class="inp" id="em-rod" value="' + esc(CFGA.EMAIL_RODAPE) + '" placeholder="Sua Empresa Ltda - Rua X, 100 - Cidade/UF"><span class="ajuda">Exigido pelas boas práticas contra spam e ajuda os e-mails a chegarem na caixa de entrada.</span></div>' +
        '<div class="campo"><label>Limite diário no Gmail</label><input class="inp" type="number" min="1" id="em-lg" value="' + esc(CFGA.EMAIL_LIMITE_GMAIL) + '"><span class="ajuda">95 para Gmail comum. Use 1450 se a sua conta é Google Workspace.</span></div>' +
        '<details' + (CFGA.BREVO_APIKEY ? ' open' : '') + '><summary class="small"><b>Brevo</b></summary><div class="campo" style="margin-top:8px"><label>Chave da API</label><input class="inp" id="em-bk" value="' + esc(CFGA.BREVO_APIKEY) + '" autocomplete="off"></div><div class="grade2"><div class="campo"><label>E-mail do remetente cadastrado</label><input class="inp" id="em-br" value="' + esc(CFGA.BREVO_REMETENTE) + '"></div><div class="campo"><label>Limite diário</label><input class="inp" type="number" id="em-bl" value="' + esc(CFGA.BREVO_LIMITE) + '"></div></div></details>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn pri" id="em-salvar" data-carregando=" Salvando...">Salvar</button></div>' +
        '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--borda)"><span class="rot">Enviar e-mail de teste</span><div class="linha" style="margin-top:6px"><input class="inp" id="em-tpara" value="' + esc(S.user.email) + '"><button class="btn" id="em-teste" style="flex:0 0 auto" data-carregando=" Enviando...">' + ic('enviar') + ' Testar</button></div></div></div></div>';
    } else if (id === 'rastreio') {
      var codigoR = '<script src="' + location.origin + location.pathname.replace(/[^/]*$/, '') + 'rastreio.js" data-api="' + (CFGA.URL_APP || 'URL_DO_APPS_SCRIPT') + '" data-k="' + ((String(CFGA.URL_WEBHOOK_ENTRADA).match(/k=([^&]+)/) || [])[1] || '') + '" async></' + 'script>';
      corpo = '<p style="margin-top:0">Cole este código no seu site, antes de <code>&lt;/body&gt;</code> (WordPress: plugin de inserir código no rodapé; Elementor: widget HTML no rodapé). A partir daí, quando um contato clica num link de e-mail e navega pelo site, as páginas que ele visita aparecem no histórico dele.</p>' +
        '<span class="rot">Código</span><textarea class="inp" id="rs-cod" rows="3" readonly style="font-family:ui-monospace,Consolas,monospace;font-size:12px">' + esc(codigoR) + '</textarea><button class="btn" id="rs-copia" style="margin-top:8px">' + ic('copiar') + ' Copiar código</button>' +
        '<h3 style="font-size:14.5px;margin:18px 0 8px">O que dá para fazer</h3><ul class="small" style="padding-left:18px;margin-top:0"><li>Automação com o gatilho <b>Visitou o site</b> (ex.: quem visitou a página de preços ganha pontos e vira tarefa para o vendedor).</li><li>Ver na ficha do contato as páginas visitadas.</li></ul>' +
        '<div class="aviso info">' + ic('escudo') + '<div>Privacidade: visitantes anônimos não são rastreados. Só quem já é contato e chegou por um link de e-mail do sistema é reconhecido. Informe isso na política de privacidade do site.</div></div>';
    } else if (id === 'hotmart' || id === 'kiwify') {
      var plat = id === 'hotmart' ? 'Hotmart' : 'Kiwify';
      var urlP = (CFGA.URL_WEBHOOK_VENDAS || '(rode a função instalar de novo no Apps Script para gerar esta URL)') + '&fonte=' + id + '&origem=' + plat;
      corpo = '<p style="margin-top:0">Cada evento de venda da ' + plat + ' cria ou atualiza o contato, coloca uma tag e pode iniciar uma automação de WhatsApp. Compra aprovada vira negócio ganho com o valor da venda e tira a pessoa das automações de recuperação.</p>' +
        '<span class="rot">URL para colar na ' + plat + '</span>' + C.copiavel(urlP) + '<p class="small muted">Esta URL é só para as plataformas de venda: não use no site nem em formulários. Pela URL de formulários, eventos de compra são ignorados, para ninguém conseguir registrar uma venda falsa.</p>' +
        '<h3 style="font-size:14.5px;margin:18px 0 8px">Onde colar</h3><ol class="passos-tut">' +
        (id === 'hotmart' ? '<li><b>Hotmart</b>Ferramentas > Webhook (API e notificações) > Cadastrar webhook. Cole a URL, escolha o produto e marque os eventos: Compra aprovada, Compra completa, Abandono de carrinho, Boleto impresso, Reembolso, Chargeback e Cancelamento. Versão 2.0.</li>'
          : '<li><b>Kiwify</b>Apps > Webhooks > Criar webhook. Cole a URL, escolha o produto e marque: Compra aprovada, Carrinho abandonado, Boleto gerado, Pix gerado, Compra recusada, Reembolso, Chargeback e Assinatura cancelada.</li>') +
        '<li><b>Crie as automações</b>Em Automações > Usar um modelo: <b>Recuperar carrinho abandonado</b>, <b>Lembrete de boleto e Pix</b> e <b>Boas-vindas ao comprador</b>. Elas já usam o gatilho Evento de venda.</li>' +
        '<li><b>Teste</b>As duas plataformas têm um botão de enviar teste na tela do webhook. O contato aparece em Contatos com a tag "' + plat + ': ..."</li></ol>' +
        '<h3 style="font-size:14.5px;margin:18px 0 8px">Tags que o sistema coloca</h3><div class="chips">' + ['Comprou', 'Carrinho abandonado', 'Boleto gerado', 'Pix gerado', 'Reembolso', 'Cancelou', 'Pagamento recusado'].map(function (t) { return '<span class="chip">' + plat + ': ' + t + '</span>'; }).join('') + '</div>';
    } else if (id === 'activecampaign') {
      corpo = '<div class="grid-2" style="align-items:start"><div><h3 style="font-size:15px;margin-bottom:10px">Do ActiveCampaign para cá</h3><p class="small" style="margin-top:0">Na automação do ActiveCampaign, adicione a ação <b>Webhook</b> com esta URL. O contato chega com nome, e-mail, telefone e tags.</p>' + C.copiavel(urlEnt + '&fonte=activecampaign&origem=ActiveCampaign') +
        '<p class="small muted">Você também pode usar Configurações > Desenvolvedor > Webhooks do ActiveCampaign para avisar em toda inscrição numa lista.</p>' +
        '<h3 style="font-size:15px;margin:18px 0 10px">Daqui para o ActiveCampaign</h3><ol class="passos-tut"><li><b>Pegue a URL e a chave</b>No ActiveCampaign: Configurações > Desenvolvedor. Copie a URL da API e a chave.</li><li><b>Cole ao lado e teste</b>O teste mostra as suas listas para você escolher.</li><li><b>Use nas automações</b>O passo <b>Enviar ao ActiveCampaign</b> cria ou atualiza o contato, coloca na lista e aplica as tags que você escolher (ex.: Lead qualificado no WhatsApp).</li></ol></div>' +
        '<div><div class="campo"><label>URL da API</label><input class="inp" id="ac-url" value="' + esc(CFGA.AC_URL) + '" placeholder="https://suaconta.api-us1.com"></div>' +
        '<div class="campo"><label>Chave da API</label><input class="inp" id="ac-token" value="' + esc(CFGA.AC_TOKEN) + '" autocomplete="off"></div>' +
        '<div class="campo"><label>Lista padrão (opcional)</label><select class="inp" id="ac-lista"><option value="">Nenhuma</option>' + (CFGA.AC_LISTA ? '<option value="' + esc(CFGA.AC_LISTA) + '" selected>Lista ' + esc(CFGA.AC_LISTA) + '</option>' : '') + '</select></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="ac-salvar" data-carregando=" Salvando...">Salvar</button><button class="btn" id="ac-testar" data-carregando=" Testando...">' + ic('play') + ' Testar e carregar listas</button></div><div id="ac-res" style="margin-top:10px"></div></div></div>';
    } else if (id === 'leadads') {
      corpo = '<p style="margin-top:0">Quem preenche o formulário de um anúncio vira contato aqui na hora, com a origem certa, e pode receber a primeira mensagem no WhatsApp em segundos. O sistema entende o formato das respostas do Facebook, do Instagram e do TikTok.</p>' +
        '<h3 style="font-size:14.5px;margin:14px 0 8px">Facebook e Instagram (Lead Ads)</h3><ol class="passos-tut"><li><b>Make ou Zapier</b>Gatilho "Facebook Lead Ads > New Lead". Ação "HTTP > Make a request" (Make) ou "Webhooks by Zapier > POST", método POST, corpo JSON com os campos do lead.</li><li><b>Cole a URL</b>' + C.copiavel(urlEnt + '&fonte=facebook&origem=Anúncio%20Facebook&tags=Lead%20anúncio') + '</li></ol>' +
        '<h3 style="font-size:14.5px;margin:14px 0 8px">TikTok (Formulário instantâneo)</h3><ol class="passos-tut"><li><b>Direto pelo TikTok</b>No TikTok Ads Manager, na área de Leads (formulário instantâneo), procure a integração com CRM por webhook. Cole a URL abaixo e envie um teste. Se a sua conta não mostrar essa opção, use o caminho seguinte.</li><li><b>Ou por Make/Zapier</b>Gatilho "TikTok Lead Generation > New Lead" e ação de webhook POST para a mesma URL.</li><li><b>URL</b>' + C.copiavel(urlEnt + '&fonte=tiktok&origem=Anúncio%20TikTok&tags=Lead%20TikTok') + '</li></ol>' +
        '<p class="small muted">Dica: crie a automação "Boas-vindas para lead de anúncio" com o gatilho Webhook recebido e a origem do anúncio. Responder nos primeiros 5 minutos aumenta muito a chance de conversa.</p>';
    } else if (id === 'api') {
      corpo = '<p style="margin-top:0">Para programadores e ferramentas como n8n, Make, Zapier ou seu próprio site. Toda chamada é um POST em JSON para a URL abaixo. <b>Não publique esta URL</b>: quem tiver a chave consegue mandar mensagens pelo seu WhatsApp.</p>' +
        (CFGA.URL_API ? '<span class="rot">URL da API</span>' + C.copiavel(CFGA.URL_API) : '<div class="aviso">' + ic('info') + '<div>A API ainda está desligada. Gere a chave para ligar.</div></div>') +
        '<button class="btn ' + (CFGA.URL_API ? 'perigo' : 'pri') + '" id="api-chave" style="margin:10px 0">' + ic('atualizar') + (CFGA.URL_API ? ' Gerar nova chave (a antiga para de funcionar)' : ' Gerar chave e ligar a API') + '</button>' +
        '<h3 style="font-size:14.5px;margin:14px 0 8px">Ações</h3><table class="tab"><tbody>' + [
          ['contato.salvar', 'Cria ou atualiza: nome, telefone, email, empresa, cidade, origem, tags, campos'],
          ['contato.buscar', 'Busca por contato_id, telefone ou email'],
          ['tag.adicionar / tag.remover', 'telefone ou email + tags'],
          ['mensagem.enviar', 'telefone ou email + texto (aceita {primeiro_nome})'],
          ['automacao.iniciar', 'telefone ou email + automacao (nome) ou automacao_id'],
          ['negocio.etapa', 'telefone ou email + etapa_id']
        ].map(function (a) { return '<tr style="cursor:default"><td><code>' + a[0] + '</code></td><td class="small">' + a[1] + '</td></tr>'; }).join('') + '</tbody></table>' +
        '<span class="rot" style="margin-top:12px;display:block">Exemplo</span><code class="bloco">POST ' + esc(CFGA.URL_API || 'URL_DA_API') + '\nContent-Type: application/json\n\n{ "acao": "mensagem.enviar", "telefone": "11999998888", "texto": "Oi {primeiro_nome}, seu pedido saiu!" }</code>';
    } else if (id === 'planilha') {
      corpo = '<p style="margin-top:0">O sistema guarda tudo numa planilha do Google Planilhas na conta de quem instalou. Cada aba é uma tabela: Contatos, Negocios, Mensagens, Automacoes, Campanhas e assim por diante.</p><ul><li>Para fazer backup: Arquivo > Fazer uma cópia (ou Fazer download em Excel).</li><li>Evite apagar colunas ou mudar o nome das abas.</li><li>Pode criar abas novas com gráficos e fórmulas à vontade.</li></ul>' +
        (CFGA.URL_PLANILHA ? '<a class="btn pri" href="' + esc(CFGA.URL_PLANILHA) + '" target="_blank" rel="noopener">' + ic('externo') + ' Abrir minha planilha</a>' : '<p class="muted">No modo demonstração não existe planilha.</p>');
    }
    var el = C.modal({ titulo: i.nome, tamanho: 'xl', corpo: corpo, pe: pe });
    var on = function (sel, fn) { var x = el.querySelector(sel); if (x) x.onclick = fn; };
    var mostrarQr = function (box, r) {
      box.innerHTML = r.conectado ? '<div class="aviso ok">' + ic('check') + '<div>' + esc(r.texto || 'Conectado') + '</div></div>' :
        r.qr ? '<div class="qr"><img src="' + esc(r.qr.indexOf('data:') === 0 ? r.qr : 'data:image/png;base64,' + r.qr) + '" alt="QR Code"></div><p class="small muted" style="text-align:center">Leia com o WhatsApp do celular. O código expira em cerca de 40 segundos; clique em Conectar de novo se precisar.</p>' :
          r.codigo ? '<div class="aviso info">' + ic('info') + '<div>Código de pareamento: <b style="font-size:18px;letter-spacing:2px">' + esc(r.codigo) + '</b></div></div>' : '<div class="aviso">' + ic('alerta') + '<div>' + esc(r.texto || 'Não recebi o QR Code. Confira a URL e a chave.') + '</div></div>';
      if (!r.conectado) setTimeout(function () { if (box.isConnected) C.api('wa.status').then(function (s) { S.waStatus = s; if (s.conectado) { box.innerHTML = '<div class="aviso ok">' + ic('check') + '<div>WhatsApp conectado!</div></div>'; C.atualizarWa(); } }); }, 20000);
    };
    on('#e-salvar', function () { var b = this; C.comBotao(b, function () { return salvarCfg({ WA_PROVEDOR: 'evolution', EVOLUTION_URL: el.querySelector('#e-url').value.trim(), EVOLUTION_APIKEY: el.querySelector('#e-key').value.trim(), EVOLUTION_INSTANCIA: el.querySelector('#e-inst').value.trim().replace(/\s+/g, '-') }).then(function () { C.toast('Evolution salva. Agora clique em Conectar.', 'ok'); }); }); });
    on('#e-con', function () { var b = this; C.comBotao(b, function () { return C.api('wa.conectar').then(function (r) { mostrarQr(el.querySelector('#e-qr'), r); }); }); });
    on('#w-salvar', function () { var b = this; C.comBotao(b, function () { return salvarCfg({ WA_PROVEDOR: 'waha', WAHA_URL: el.querySelector('#w-url').value.trim(), WAHA_APIKEY: el.querySelector('#w-key').value.trim(), WAHA_SESSAO: el.querySelector('#w-ses').value.trim() || 'default' }).then(function () { C.toast('WAHA salvo. Agora clique em Conectar.', 'ok'); }); }); });
    on('#w-con', function () { var b = this; C.comBotao(b, function () { return C.api('wa.conectar').then(function (r) { mostrarQr(el.querySelector('#w-qr'), r); }); }); });
    on('#m-salvar', function () { var b = this; C.comBotao(b, function () { var v = el.querySelector('#m-verify').value.trim(); if (v.length < 8) throw new Error('Invente um token de verificação com pelo menos 8 caracteres.'); return salvarCfg({ WA_PROVEDOR: 'meta', META_TOKEN: el.querySelector('#m-token').value.trim(), META_PHONE_ID: el.querySelector('#m-phone').value.trim(), META_VERIFY: v, META_PRECO_MARKETING: el.querySelector('#m-pm').value.replace(',', '.'), META_PRECO_UTILITY: el.querySelector('#m-pu').value.replace(',', '.'), META_PRECO_SERVICO: el.querySelector('#m-ps').value.replace(',', '.'), META_FRANQUIA_SERVICO: el.querySelector('#m-pf').value, META_GRATIS_HORAS: el.querySelector('#m-pg').value }).then(function () { C.toast('API oficial salva', 'ok'); }); }); });
    on('#mp-salvar', function () { var b = this; C.comBotao(b, function () { return salvarCfg({ MP_TOKEN: el.querySelector('#mp-tk').value.trim(), MP_RETORNO: el.querySelector('#mp-ret').value.trim(), LEMBRETE_COBRANCA_DIAS: el.querySelector('#mp-dias').value }).then(function () { S.config.mercadopago = !!el.querySelector('#mp-tk').value.trim(); C.toast('Mercado Pago salvo', 'ok'); }); }); });
    on('#mp-testar', function () { var b = this; C.comBotao(b, function () { return salvarCfg({ MP_TOKEN: el.querySelector('#mp-tk').value.trim() }).then(function () { return C.api('mp.testar'); }).then(function (r) { S.config.mercadopago = true; el.querySelector('#mp-res').innerHTML = '<div class="aviso ok">' + ic('check') + '<div>' + esc(r.texto) + '</div></div>'; }); }); });
    on('#ch-salvar', function () { var b = this; C.comBotao(b, function () { return salvarCfg({ CHAT_ATIVO: el.querySelector('#ch-at').checked ? 'SIM' : 'NAO', CHAT_TITULO: el.querySelector('#ch-tit').value, CHAT_SAUDACAO: el.querySelector('#ch-sau').value, CHAT_PEDIR: C.$$('[data-ped]', el).filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.ped; }).join(', ') }).then(function () { S.config.chat = el.querySelector('#ch-at').checked; C.toast('Chat salvo', 'ok'); }); }); });
    on('#ch-copia', function () { C.copiar(el.querySelector('#ch-cod').value); });
    on('#em-salvar', function () { var b = this; C.comBotao(b, function () { var v = function (x) { return el.querySelector(x).value.trim(); }; if (v('#em-prov') !== 'gmail' && (!v('#em-bk') || !v('#em-br'))) throw new Error('Para usar o Brevo, preencha a chave e o e-mail do remetente.'); return salvarCfg({ EMAIL_PROVEDOR: v('#em-prov'), EMAIL_NOME: v('#em-nome'), EMAIL_RESPONDER: v('#em-resp'), EMAIL_RODAPE: v('#em-rod'), EMAIL_LIMITE_GMAIL: v('#em-lg'), BREVO_APIKEY: v('#em-bk'), BREVO_REMETENTE: v('#em-br'), BREVO_LIMITE: v('#em-bl') }).then(function () { C.toast('Envio de e-mail salvo', 'ok'); }); }); });
    on('#em-teste', function () { var b = this; C.comBotao(b, function () { return C.api('email.testar', { para: el.querySelector('#em-tpara').value, email: { assunto: 'Teste de envio do ' + ((S.config.marca || {}).nome || 'CRM'), blocos: [{ tipo: 'titulo', texto: 'Funcionou!' }, { tipo: 'texto', texto: 'Se você recebeu este e-mail, o envio está configurado.' }] } }).then(function (r) { C.toast('Teste enviado pelo ' + (r.via === 'brevo' ? 'Brevo' : 'Gmail') + '. Confira também a caixa de spam.', 'ok'); }); }); });
    on('#rs-copia', function () { C.copiar(el.querySelector('#rs-cod').value); });
    on('#ig-salvar', function () { var b = this; C.comBotao(b, function () { var v = el.querySelector('#ig-verify').value.trim(); if (v.length < 8) throw new Error('Invente um token de verificação com pelo menos 8 caracteres.'); return salvarCfg({ IG_TOKEN: el.querySelector('#ig-token').value.trim(), IG_ID: el.querySelector('#ig-id').value.trim(), META_VERIFY: v }).then(function () { S.config.instagram = !!el.querySelector('#ig-id').value.trim(); C.toast('Instagram salvo', 'ok'); }); }); });
    on('#ig-testar', function () { var b = this; C.comBotao(b, function () { return C.api('integracao.testar', { qual: 'instagram' }).then(function (r) { el.querySelector('#ig-res').innerHTML = '<div class="aviso ' + (r.conectado ? 'ok' : 'erro') + '">' + ic(r.conectado ? 'check' : 'alerta') + '<div>' + esc(r.texto) + '</div></div>'; }); }); });
    on('#ac-salvar', function () { var b = this; C.comBotao(b, function () { return salvarCfg({ AC_URL: el.querySelector('#ac-url').value.trim(), AC_TOKEN: el.querySelector('#ac-token').value.trim(), AC_LISTA: el.querySelector('#ac-lista').value }).then(function () { S.config.activecampaign = true; C.toast('ActiveCampaign salvo', 'ok'); }); }); });
    on('#ac-testar', function () {
      var b = this;
      C.comBotao(b, function () {
        return salvarCfg({ AC_URL: el.querySelector('#ac-url').value.trim(), AC_TOKEN: el.querySelector('#ac-token').value.trim() }).then(function () { return C.api('integracao.testar', { qual: 'activecampaign' }); }).then(function (r) {
          var sel = el.querySelector('#ac-lista'), atual = sel.value;
          sel.innerHTML = '<option value="">Nenhuma</option>' + r.listas.map(function (l) { return '<option value="' + esc(l.id) + '"' + (String(l.id) === atual ? ' selected' : '') + '>' + esc(l.nome) + '</option>'; }).join('');
          el.querySelector('#ac-res').innerHTML = '<div class="aviso ok">' + ic('check') + '<div>Conectado. ' + r.listas.length + ' listas encontradas. Escolha a lista e salve.</div></div>';
        });
      });
    });
    on('#api-chave', function () {
      C.confirmar(CFGA.URL_API ? 'Gerar uma nova chave? Tudo que usa a chave atual para de funcionar.' : 'Ligar a API do sistema?', { perigo: !!CFGA.URL_API, botao: 'Gerar chave' }).then(function (ok) {
        if (!ok) return;
        return C.api('config.chave', { qual: 'api' }).then(function (c) { CFGA = c; el.fechar(); abrirIntegracao('api'); });
      }).catch(function (e) { C.toast(e.message, 'erro'); });
    });
    on('#l-salvar', function () { var b = this; C.comBotao(b, function () { return salvarCfg({ WA_PROVEDOR: 'link', WA_NUMERO: el.querySelector('#l-num').value.replace(/\D/g, '') }).then(function () { C.toast('Modo link ativado', 'ok'); el.fechar(); C.render(); }); }); });
    on('#wt-env', function () { var b = this; C.comBotao(b, function () { return C.api('wa.testar', { telefone: el.querySelector('#wt-num').value }).then(function () { C.toast('Mensagem de teste enviada', 'ok'); }); }); });
    on('#t-env', function () { var b = this; C.comBotao(b, function () { return C.api('webhook.testar', { json: el.querySelector('#t-json').value }).then(function (r) { C.toast('Funcionou: contato ' + (r.novo ? 'criado' : 'atualizado'), 'ok'); C.recarregar(); }); }); });
    on('#t-chave', function () {
      C.confirmar('Gerar uma nova chave? <b>A URL dos formulários e webhooks de captação muda</b> e você precisa colar a nova em cada ferramenta e atualizar o código do formulário pronto. O WhatsApp não é afetado.', { perigo: true, botao: 'Gerar nova chave' }).then(function (ok) {
        if (!ok) return;
        return C.api('config.chave', { qual: 'entrada' }).then(function (c) { CFGA = c; el.fechar(); abrirIntegracao('entrada'); C.toast('Nova chave gerada', 'ok'); });
      }).catch(function (e) { C.toast(e.message, 'erro'); });
    });
    if (id === 'form') {
      var atual = function () { el.querySelector('#f-cod').value = codigoFormulario(el.querySelector('#f-origem').value, el.querySelector('#f-tags').value, el.querySelector('#f-auto').value, el.querySelector('#f-ok').value); };
      ['#f-origem', '#f-tags', '#f-auto', '#f-ok'].forEach(function (s) { el.querySelector(s).addEventListener('input', atual); el.querySelector(s).addEventListener('change', atual); });
      atual();
      on('#f-copia', function () { C.copiar(el.querySelector('#f-cod').value); });
    }
  }
  function blocoTeste() {
    return '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--borda)"><span class="rot">Enviar mensagem de teste</span><div class="linha" style="margin-top:6px"><input class="inp" id="wt-num" placeholder="Seu WhatsApp com DDD"><button class="btn" id="wt-env" style="flex:0 0 auto" data-carregando=" Enviando...">' + ic('enviar') + ' Testar</button></div></div>';
  }
  function codigoFormulario(origem, tags, auto, ok) {
    var m = S.config.marca || {};
    var chave = (String(CFGA.URL_WEBHOOK_ENTRADA).match(/k=([^&]+)/) || [])[1] || '';
    var api = CFGA.URL_APP || 'URL_DO_SEU_APPS_SCRIPT';
    return '<form id="prumo-form" style="max-width:420px;font-family:system-ui,sans-serif;display:grid;gap:10px">\n' +
      '  <input name="nome" placeholder="Seu nome" required style="padding:12px;border:1px solid #ccc;border-radius:8px">\n' +
      '  <input name="telefone" placeholder="WhatsApp com DDD" required style="padding:12px;border:1px solid #ccc;border-radius:8px">\n' +
      '  <input name="email" type="email" placeholder="Seu e-mail" style="padding:12px;border:1px solid #ccc;border-radius:8px">\n' +
      '  <button style="padding:14px;border:0;border-radius:8px;background:' + (m.cor || '#1F6FEB') + ';color:#fff;font-weight:700;cursor:pointer">Quero ser atendido</button>\n' +
      '  <p id="prumo-ok" style="display:none;color:#15803D">' + esc(ok || 'Recebemos seus dados.') + '</p>\n</form>\n<script>\n' +
      'document.getElementById("prumo-form").addEventListener("submit", function (e) {\n  e.preventDefault();\n  var f = e.target, b = f.querySelector("button");\n  b.disabled = true; b.textContent = "Enviando...";\n' +
      '  fetch("' + api + '", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({\n    action: "publico.form", k: "' + chave + '", origem: ' + JSON.stringify(origem || 'Site') + ', tags: ' + JSON.stringify(tags || '') + ', automacao: ' + JSON.stringify(auto || '') + ',\n    nome: f.nome.value, telefone: f.telefone.value, email: f.email.value\n  }) }).then(function () {\n' +
      '    f.querySelectorAll("input,button").forEach(function (x) { x.style.display = "none"; });\n    document.getElementById("prumo-ok").style.display = "block";\n  }).catch(function () { b.disabled = false; b.textContent = "Tentar de novo"; });\n});\n</' + 'script>';
  }

  /* ================================================================ AJUSTES */
  var abaAj = 'marca';
  C.views.ajustes = {
    titulo: 'Ajustes',
    render: function (el) {
      var abas = [['marca', 'Marca e cores'], ['funis', 'Funis'], ['campos', 'Campos e listas'], ['modelos', 'Respostas rápidas'], ['regras', 'Regras'], ['sistema', 'Sistema e arquivo']];
      el.innerHTML = '<div class="abas">' + abas.map(function (a) { return '<button data-aj="' + a[0] + '" class="' + (abaAj === a[0] ? 'on' : '') + '">' + a[1] + '</button>'; }).join('') + '</div><div id="aj"><div style="text-align:center;padding:40px"><span class="spin" style="color:var(--pri)"></span></div></div>';
      C.$$('[data-aj]', el).forEach(function (b) { b.onclick = function () { abaAj = b.dataset.aj; C.render(); }; });
      carregarCfg().then(function () { ({ marca: ajMarca, funis: ajFunis, campos: ajCampos, modelos: ajModelos, regras: ajRegras, sistema: ajSistema })[abaAj](C.$('#aj')); }).catch(function (e) { C.toast(e.message, 'erro'); });
    }
  };

  function botaoSalvar(id) { return '<button class="btn pri" id="' + id + '" data-carregando=" Salvando...">Salvar alterações</button>'; }

  function ajMarca(box) {
    var d = { NOME: CFGA.NOME, SLOGAN: CFGA.SLOGAN, COR_PRIMARIA: CFGA.COR_PRIMARIA, COR_DESTAQUE: CFGA.COR_DESTAQUE, LOGO_URL: CFGA.LOGO_URL };
    var cores = ['#1F6FEB', '#0F766E', '#16A34A', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#0EA5E9', '#334155', '#9A3412'];
    var pinta = function () {
      box.innerHTML = '<div class="grid-2" style="align-items:start"><div class="card card-pad">' +
        '<div class="campo"><label>Nome do sistema</label><input class="inp" id="mk-nome" maxlength="40" value="' + esc(d.NOME) + '"></div>' +
        '<div class="campo"><label>Frase curta</label><input class="inp" id="mk-slogan" maxlength="60" value="' + esc(d.SLOGAN) + '"></div>' +
        '<div class="campo"><label>Logo</label><div style="display:flex;gap:10px;align-items:center">' + C.logoHtml({ nome: d.NOME, logo: d.LOGO_URL }).replace('marca-logo', 'marca-logo" style="width:48px;height:48px;border-radius:12px') + '<input type="file" class="inp" id="mk-logo" accept="image/*">' + (d.LOGO_URL ? '<button class="btn peq" id="mk-tira">Remover</button>' : '') + '</div></div>' +
        '<div class="campo"><label>Cor principal</label><div class="cores-prontas">' + cores.map(function (c) { return '<button type="button" data-cor="' + c + '" style="background:' + c + '" class="' + (c.toLowerCase() === String(d.COR_PRIMARIA).toLowerCase() ? 'on' : '') + '" aria-label="' + c + '"></button>'; }).join('') + '<input type="color" class="inp-cor" id="mk-cor" value="' + esc(d.COR_PRIMARIA) + '"></div></div>' +
        '<div class="campo"><label>Cor de destaque</label><input type="color" class="inp-cor" id="mk-acc" value="' + esc(d.COR_DESTAQUE) + '"></div>' +
        botaoSalvar('mk-ok') + '</div><div><span class="rot">Prévia ao vivo</span><div class="previa-marca" style="margin-top:6px"><div class="ps"><i class="on"></i><i></i><i></i><i></i></div><div class="pc"><div class="card" style="padding:10px"><b style="font-size:12px">Vendido no mês</b><div style="font-size:20px;font-weight:800">R$ 18,4 mil</div></div><div style="display:flex;gap:6px"><span class="btn pri peq">Principal</span><span class="btn acc peq">Destaque</span></div></div></div>' +
        '<p class="small muted">As cores são aplicadas para toda a equipe assim que você salvar.</p></div></div>';
      var ler = function () { d.NOME = box.querySelector('#mk-nome').value.trim(); d.SLOGAN = box.querySelector('#mk-slogan').value.trim(); d.COR_DESTAQUE = box.querySelector('#mk-acc').value; };
      var previa = function () { C.aplicarMarca({ nome: d.NOME, slogan: d.SLOGAN, cor: d.COR_PRIMARIA, destaque: d.COR_DESTAQUE, logo: d.LOGO_URL }); };
      C.$$('[data-cor]', box).forEach(function (b) { b.onclick = function () { ler(); d.COR_PRIMARIA = b.dataset.cor; previa(); pinta(); }; });
      box.querySelector('#mk-cor').onchange = function () { ler(); d.COR_PRIMARIA = this.value; previa(); pinta(); };
      box.querySelector('#mk-acc').onchange = function () { ler(); previa(); };
      box.querySelector('#mk-logo').onchange = function () { ler(); C.reduzirImagem(this.files[0], 160).then(function (u) { d.LOGO_URL = u; previa(); pinta(); }).catch(function (e) { C.toast(e.message, 'erro'); }); };
      if (box.querySelector('#mk-tira')) box.querySelector('#mk-tira').onclick = function () { ler(); d.LOGO_URL = ''; previa(); pinta(); };
      box.querySelector('#mk-ok').onclick = function () {
        ler();
        var b = this;
        C.comBotao(b, function () {
          if (!d.NOME) throw new Error('Dê um nome ao sistema.');
          return salvarCfg(d).then(function () { S.config.marca = { nome: d.NOME, slogan: d.SLOGAN, cor: d.COR_PRIMARIA, destaque: d.COR_DESTAQUE, logo: d.LOGO_URL, configurado: true }; C.aplicarMarca(S.config.marca); C.renderNav(); C.toast('Marca salva', 'ok'); });
        });
      };
    };
    pinta();
  }

  function ajFunis(box) {
    box.innerHTML = '<div class="barra-ferr"><p class="muted" style="margin:0">Crie quantos funis precisar (ex.: Vendas, Pós-venda, Parcerias). Etapas do tipo Ganho e Perdido fecham o negócio.</p><div class="dir"><button class="btn pri" id="fu-novo">' + ic('plus') + ' Novo funil</button></div></div>' +
      S.funis.map(function (f) { return '<div class="card item-card" style="margin-bottom:10px"><div class="meio"><h3>' + esc(f.nome) + '</h3><div class="chips" style="margin-top:6px">' + f.etapas.map(function (e) { return '<span class="chip"><span style="width:8px;height:8px;border-radius:50%;background:' + esc(e.cor) + '"></span>' + esc(e.nome) + (e.tipo !== 'aberto' ? ' (' + e.tipo + ')' : '') + '</span>'; }).join('') + '</div></div><button class="btn peq" data-fu="' + f.id + '">' + ic('lapis') + ' Editar</button></div>'; }).join('');
    C.$('#fu-novo').onclick = function () { formFunil({ nome: '', etapas: [{ nome: 'Novo', cor: '#3B82F6', tipo: 'aberto' }, { nome: 'Ganho', cor: '#16A34A', tipo: 'ganho' }, { nome: 'Perdido', cor: '#DC2626', tipo: 'perdido' }] }); };
    C.$$('[data-fu]', box).forEach(function (b) { b.onclick = function () { formFunil(JSON.parse(JSON.stringify(C.funil(b.dataset.fu)))); }; });
  }
  function formFunil(f) {
    var el = C.modal({
      titulo: f.id ? 'Editar funil' : 'Novo funil', tamanho: 'largo',
      corpo: '<div class="campo"><label>Nome do funil</label><input class="inp" id="ff-nome" value="' + esc(f.nome) + '"></div><span class="rot">Etapas (na ordem)</span><div id="ff-et" style="margin-top:8px"></div><button class="btn peq" id="ff-add">' + ic('plus') + ' Adicionar etapa</button>',
      pe: (f.id ? '<button class="btn perigo esq" id="ff-exc">' + ic('lixo') + ' Excluir funil</button>' : '') + '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="ff-ok" data-carregando=" Salvando...">Salvar</button>'
    });
    var pinta = function () {
      el.querySelector('#ff-et').innerHTML = f.etapas.map(function (e, i) {
        return '<div class="linha" style="margin-bottom:8px;align-items:center"><input type="color" class="inp-cor" data-ec="' + i + '" value="' + esc(e.cor || '#64748B') + '" style="flex:0 0 46px"><input class="inp" data-en="' + i + '" value="' + esc(e.nome) + '"><select class="inp" data-et="' + i + '" style="flex:0 0 130px">' + [['aberto', 'Em andamento'], ['ganho', 'Ganho'], ['perdido', 'Perdido']].map(function (t) { return '<option value="' + t[0] + '"' + ((e.tipo || 'aberto') === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>' +
          '<button class="btn fantasma ic peq" data-eu="' + i + '" style="flex:0 0 30px" aria-label="Subir">' + ic('cima') + '</button><button class="btn fantasma ic peq perigo" data-ed="' + i + '" style="flex:0 0 30px" aria-label="Remover">' + ic('x') + '</button></div>';
      }).join('');
      C.$$('[data-en]', el).forEach(function (x) { x.oninput = function () { f.etapas[x.dataset.en].nome = x.value; }; });
      C.$$('[data-ec]', el).forEach(function (x) { x.onchange = function () { f.etapas[x.dataset.ec].cor = x.value; }; });
      C.$$('[data-et]', el).forEach(function (x) { x.onchange = function () { f.etapas[x.dataset.et].tipo = x.value; }; });
      C.$$('[data-ed]', el).forEach(function (x) { x.onclick = function () { f.etapas.splice(Number(x.dataset.ed), 1); pinta(); }; });
      C.$$('[data-eu]', el).forEach(function (x) { x.onclick = function () { var i = Number(x.dataset.eu); if (!i) return; var t = f.etapas.splice(i, 1)[0]; f.etapas.splice(i - 1, 0, t); pinta(); }; });
    };
    pinta();
    el.querySelector('#ff-add').onclick = function () { var i = f.etapas.findIndex(function (e) { return e.tipo !== 'aberto'; }); f.etapas.splice(i < 0 ? f.etapas.length : i, 0, { nome: 'Nova etapa', cor: '#8B5CF6', tipo: 'aberto' }); pinta(); };
    el.querySelector('#ff-ok').onclick = function () {
      f.nome = el.querySelector('#ff-nome').value;
      C.comBotao(this, function () { return C.api('funil.salvar', { funil: f }).then(function (r) { S.funis = r; el.fechar(); C.toast('Funil salvo', 'ok'); C.render(); }); });
    };
    var ex = el.querySelector('#ff-exc');
    if (ex) ex.onclick = function () {
      C.confirmar('Excluir o funil <b>' + esc(f.nome) + '</b>?', { perigo: true, botao: 'Excluir' }).then(function (ok) { if (ok) return C.api('funil.excluir', { id: f.id }).then(function (r) { S.funis = r; el.fechar(); C.render(); }); }).catch(function (e) { C.toast(e.message, 'erro'); });
    };
  }

  function ajCampos(box) {
    var campos = C.json(CFGA.CAMPOS_PERSONALIZADOS, []);
    var pinta = function () {
      box.innerHTML = '<div class="grid-2" style="align-items:start"><div class="card card-pad"><h3 style="font-size:15px;margin-bottom:4px">Campos personalizados</h3><p class="small muted" style="margin-top:0">Informações extras do contato (ex.: data de aniversário, plano, CPF). Use nas mensagens com {chave}.</p><div id="cp-l"></div><button class="btn peq" id="cp-add">' + ic('plus') + ' Adicionar campo</button></div>' +
        '<div class="card card-pad"><div class="campo"><label>Tags sugeridas</label><textarea class="inp" id="ls-tags" rows="3">' + esc(CFGA.TAGS) + '</textarea><span class="ajuda">Separadas por vírgula. Novas tags também podem ser criadas na hora.</span></div>' +
        '<div class="campo"><label>Origens dos contatos</label><textarea class="inp" id="ls-orig" rows="2">' + esc(CFGA.ORIGENS) + '</textarea></div>' +
        '<div class="campo"><label>Motivos de perda</label><textarea class="inp" id="ls-mot" rows="3">' + esc(CFGA.MOTIVOS_PERDA) + '</textarea></div></div></div><div style="margin-top:14px">' + botaoSalvar('cp-ok') + '</div>';
      box.querySelector('#cp-l').innerHTML = campos.map(function (c, i) {
        return '<div class="linha" style="margin-bottom:8px;align-items:center"><input class="inp" data-cr="' + i + '" placeholder="Rótulo" value="' + esc(c.rotulo) + '"><input class="inp" data-ck="' + i + '" placeholder="chave" value="' + esc(c.chave) + '" style="flex:0 0 120px"><select class="inp" data-ct="' + i + '" style="flex:0 0 100px">' + [['texto', 'Texto'], ['numero', 'Número'], ['data', 'Data']].map(function (t) { return '<option value="' + t[0] + '"' + (c.tipo === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select><button class="btn fantasma ic peq perigo" data-cd="' + i + '" style="flex:0 0 30px" aria-label="Remover">' + ic('x') + '</button></div>';
      }).join('') || '<p class="small muted">Nenhum campo.</p>';
      C.$$('[data-cr]', box).forEach(function (x) { x.oninput = function () { var c = campos[x.dataset.cr]; var autoKey = !c.chave || c.chave === slug(c.rotulo); c.rotulo = x.value; if (autoKey) { c.chave = slug(x.value); box.querySelector('[data-ck="' + x.dataset.cr + '"]').value = c.chave; } }; });
      C.$$('[data-ck]', box).forEach(function (x) { x.oninput = function () { campos[x.dataset.ck].chave = slug(x.value); }; });
      C.$$('[data-ct]', box).forEach(function (x) { x.onchange = function () { campos[x.dataset.ct].tipo = x.value; }; });
      C.$$('[data-cd]', box).forEach(function (x) { x.onclick = function () { campos.splice(Number(x.dataset.cd), 1); pinta(); }; });
      box.querySelector('#cp-add').onclick = function () { campos.push({ rotulo: '', chave: '', tipo: 'texto' }); pinta(); };
      box.querySelector('#cp-ok').onclick = function () {
        var b = this;
        C.comBotao(b, function () {
          var limpos = campos.filter(function (c) { return c.rotulo && c.chave; });
          return salvarCfg({ CAMPOS_PERSONALIZADOS: JSON.stringify(limpos), TAGS: box.querySelector('#ls-tags').value, ORIGENS: box.querySelector('#ls-orig').value, MOTIVOS_PERDA: box.querySelector('#ls-mot').value })
            .then(function () { return C.recarregar(); }).then(function () { C.toast('Salvo', 'ok'); });
        });
      };
    };
    pinta();
  }
  function slug(s) { return C.norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30); }

  function ajModelos(box) {
    box.innerHTML = '<div class="barra-ferr"><p class="muted" style="margin:0">Na conversa, digite <b>/</b> e o atalho para usar uma resposta pronta.</p><div class="dir"><button class="btn pri" id="md-novo">' + ic('plus') + ' Nova resposta</button></div></div>' +
      '<div class="card">' + (S.modelos.length ? S.modelos.map(function (m) { return '<div style="display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--borda);cursor:pointer" data-md="' + m.id + '"><span class="chip">/' + esc(m.atalho || '—') + '</span><div class="trunc" style="flex:1"><b>' + esc(m.titulo) + '</b><div class="small muted trunc">' + esc(m.texto) + '</div></div>' + ic('dir') + '</div>'; }).join('') : '<div class="vazio">Nenhuma resposta rápida.</div>') + '</div>';
    C.$('#md-novo').onclick = function () { formModelo({}); };
    C.$$('[data-md]', box).forEach(function (b) { b.onclick = function () { formModelo(S.modelos.filter(function (m) { return m.id === b.dataset.md; })[0]); }; });
  }
  function formModelo(m) {
    var el = C.modal({
      titulo: m.id ? 'Editar resposta rápida' : 'Nova resposta rápida',
      corpo: '<div class="grade2"><div class="campo"><label>Título</label><input class="inp" id="mo-tit" value="' + esc(m.titulo || '') + '"></div><div class="campo"><label>Atalho (sem espaço)</label><input class="inp" id="mo-at" value="' + esc(m.atalho || '') + '" placeholder="preco"></div></div>' +
        '<div class="campo"><label>Texto</label><textarea class="inp" id="mo-txt" rows="5">' + esc(m.texto || '') + '</textarea><span class="ajuda">Pode usar {primeiro_nome}, {atendente}, {saudacao}...</span></div>' +
        '<div class="grade2"><div class="campo"><label>Mídia (opcional)</label><select class="inp" id="mo-mt">' + [['', 'Nenhuma'], ['image', 'Imagem'], ['document', 'Documento'], ['video', 'Vídeo'], ['audio', 'Áudio']].map(function (o) { return '<option value="' + o[0] + '"' + ((m.midia_tipo || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div><div class="campo"><label>Link da mídia</label><input class="inp" id="mo-mu" value="' + esc(m.midia_url || '') + '"></div></div>',
      pe: (m.id ? '<button class="btn perigo esq" id="mo-exc">' + ic('lixo') + '</button>' : '') + '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="mo-ok" data-carregando=" Salvando...">Salvar</button>'
    });
    el.querySelector('#mo-ok').onclick = function () {
      C.comBotao(this, function () {
        return C.api('modelo.salvar', { modelo: { id: m.id, titulo: el.querySelector('#mo-tit').value, atalho: el.querySelector('#mo-at').value, texto: el.querySelector('#mo-txt').value, midia_tipo: el.querySelector('#mo-mt').value, midia_url: C.driveDireto(el.querySelector('#mo-mu').value.trim()) } }).then(function (r) {
          var i = S.modelos.findIndex(function (x) { return x.id === r.id; });
          if (i >= 0) S.modelos[i] = r; else S.modelos.push(r);
          el.fechar(); C.render();
        });
      });
    };
    var ex = el.querySelector('#mo-exc');
    if (ex) ex.onclick = function () { C.api('modelo.excluir', { id: m.id }).then(function () { S.modelos = S.modelos.filter(function (x) { return x.id !== m.id; }); el.fechar(); C.render(); }).catch(function (e) { C.toast(e.message, 'erro'); }); };
  }

  function ajRegras(box) {
    var dias = C.tags(CFGA.DIAS_ENVIO.replace(/\s/g, ''));
    var nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    box.innerHTML = '<div class="grid-2" style="align-items:start"><div class="card card-pad"><h3 style="font-size:15px;margin-bottom:12px">Horário dos disparos</h3>' +
      '<div class="grade2"><div class="campo"><label>Começa às</label><input class="inp" type="time" id="rg-ini" value="' + esc(CFGA.HORARIO_INICIO) + '"></div><div class="campo"><label>Para às</label><input class="inp" type="time" id="rg-fim" value="' + esc(CFGA.HORARIO_FIM) + '"></div></div>' +
      '<div class="campo"><label>Dias</label><div class="chips">' + nomes.map(function (n, i) { return '<label class="chip" style="cursor:pointer"><input type="checkbox" data-dia="' + i + '"' + (dias.indexOf(String(i)) >= 0 ? ' checked' : '') + ' style="accent-color:var(--pri)"> ' + n + '</label>'; }).join('') + '</div></div>' +
      '<p class="small muted">Fora deste horário as mensagens de disparo ficam na fila e saem no próximo horário permitido. Respostas de robôs e mensagens manuais não são afetadas.</p></div>' +
      '<div class="card card-pad"><h3 style="font-size:15px;margin-bottom:12px">Atendimento</h3>' +
      '<div class="campo"><label>Quando um atendente responde, pausar o robô por (horas)</label><input class="inp" type="number" min="0" id="rg-pausa" value="' + esc(CFGA.BOT_PAUSA_HORAS) + '"></div>' +
      '<label class="check"><input type="checkbox" id="rg-dist"' + (CFGA.DISTRIBUIR_AUTO === 'SIM' ? ' checked' : '') + '> Distribuir novos contatos em rodízio entre quem "recebe leads"</label>' +
      '<label class="check"><input type="checkbox" id="rg-vertodos"' + (CFGA.ATENDENTE_VE_TODOS === 'SIM' ? ' checked' : '') + '> Atendentes veem todos os contatos (desmarcado: só os seus e os sem responsável)</label>' +
      '<div class="campo"><label>Palavras para sair da lista</label><input class="inp" id="rg-out" value="' + esc(CFGA.OPTOUT_PALAVRAS) + '"></div>' +
      '<div class="campo"><label>Resposta para quem pede para sair</label><textarea class="inp" id="rg-outr" rows="2">' + esc(CFGA.OPTOUT_RESPOSTA) + '</textarea></div></div></div>' +
      '<div class="card card-pad" style="margin-top:16px"><h3 style="font-size:15px;margin-bottom:4px">Equipe comercial (SDR e closer)</h3><p class="small muted" style="margin-top:0">Novos leads entram no rodízio dos SDRs. Quando o SDR passa o lead, o negócio vai para o closer.</p><div class="grid-2" style="align-items:start"><div>' +
      '<div class="campo"><label>Etapa do funil quando o SDR passa o lead</label><select class="inp" id="rg-etapa"><option value="">Mantém a etapa atual (ou a primeira)</option>' + S.funis.map(function (f) { return '<optgroup label="' + esc(f.nome) + '">' + f.etapas.filter(function (e) { return e.tipo === 'aberto'; }).map(function (e) { return '<option value="' + e.id + '"' + (CFGA.PASSAR_ETAPA === e.id ? ' selected' : '') + '>' + esc(e.nome) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Responder um lead em até (minutos)</label><input class="inp" type="number" min="1" id="rg-sla" value="' + esc(CFGA.SLA_MINUTOS) + '"><span class="ajuda">Passou disso, a conversa aparece em vermelho no painel e na caixa de entrada.</span></div></div><div>' +
      '<label class="check"><input type="checkbox" id="rg-lemb"' + (CFGA.LEMBRETE_REUNIAO === 'SIM' ? ' checked' : '') + '> Mandar lembrete automático da reunião para o lead</label>' +
      '<div class="grade2"><div class="campo"><label>Quantas horas antes</label><input class="inp" type="number" min="1" id="rg-lh" value="' + esc(CFGA.LEMBRETE_HORAS) + '"></div><div class="campo"><label>Modelo da Meta (só API oficial)</label><input class="inp" id="rg-lm" value="' + esc(CFGA.LEMBRETE_MODELO) + '" placeholder="lembrete_reuniao"></div></div>' +
      '<div class="campo"><label>Texto do lembrete</label><textarea class="inp" id="rg-lt" rows="2">' + esc(CFGA.LEMBRETE_TEXTO) + '</textarea><span class="ajuda">Use {primeiro_nome}, {hora_reuniao} e {data_reuniao}.</span></div></div></div></div>' +
      '<div style="margin-top:14px">' + botaoSalvar('rg-ok') + '</div>';
    C.$('#rg-ok').onclick = function () {
      var b = this;
      C.comBotao(b, function () {
        return salvarCfg({
          HORARIO_INICIO: C.$('#rg-ini').value, HORARIO_FIM: C.$('#rg-fim').value, DIAS_ENVIO: C.$$('[data-dia]').filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.dia; }).join(','),
          BOT_PAUSA_HORAS: C.$('#rg-pausa').value, DISTRIBUIR_AUTO: C.$('#rg-dist').checked ? 'SIM' : 'NAO', ATENDENTE_VE_TODOS: C.$('#rg-vertodos').checked ? 'SIM' : 'NAO',
          OPTOUT_PALAVRAS: C.$('#rg-out').value, OPTOUT_RESPOSTA: C.$('#rg-outr').value,
          PASSAR_ETAPA: C.$('#rg-etapa').value, SLA_MINUTOS: C.$('#rg-sla').value, LEMBRETE_REUNIAO: C.$('#rg-lemb').checked ? 'SIM' : 'NAO',
          LEMBRETE_HORAS: C.$('#rg-lh').value, LEMBRETE_MODELO: C.$('#rg-lm').value.trim(), LEMBRETE_TEXTO: C.$('#rg-lt').value
        }).then(function () { S.config.sla_minutos = C.num(C.$('#rg-sla').value); C.toast('Regras salvas', 'ok'); });
      });
    };
  }

  /* ======================================================= EQUIPE (só admin) */
  C.views.equipe = {
    titulo: 'Equipe e acessos',
    render: function (el) {
      var cont = {};
      S.usuarios.forEach(function (u) { cont[u.perfil] = (cont[u.perfil] || 0) + (u.ativo === 'SIM' ? 1 : 0); });
      var ordem = ['admin', 'gestor', 'sdr', 'closer', 'personalizado'];
      el.innerHTML = '<div class="barra-ferr"><p class="muted" style="margin:0">Crie uma conta para cada pessoa. Sem limite de usuários. Só o administrador vê esta tela.</p><div class="dir"><button class="btn pri" id="eq-novo">' + ic('usuarioMais') + ' Criar conta</button></div></div>' +
        '<div class="perfis-grade">' + ordem.map(function (k) {
          return '<div class="card perfil-card"><div class="perfil-cab"><b>' + C.PERFIS[k].nome + '</b><span class="chip">' + (cont[k] || 0) + ' ativo' + ((cont[k] || 0) === 1 ? '' : 's') + '</span></div><p>' + C.PERFIS[k].desc + '</p><button class="btn peq" data-criar="' + k + '">' + ic('plus') + ' Criar ' + C.PERFIS[k].nome + '</button></div>';
        }).join('') + '</div>' +
        '<div class="card" style="margin-top:16px"><div class="tabela-wrap"><table class="tab"><thead><tr><th>Pessoa</th><th>Perfil</th><th class="esconde-mob">Meta do mês</th><th class="esconde-mob">Recebe leads</th><th class="esconde-mob">Último acesso</th><th>Situação</th></tr></thead><tbody>' +
        S.usuarios.slice().sort(function (a, b) { return ordem.indexOf(a.perfil) - ordem.indexOf(b.perfil); }).map(function (u) {
          var meta = u.perfil === 'closer' || u.perfil === 'admin' || u.perfil === 'gestor' ? (C.num(u.meta_valor) ? C.brl(C.num(u.meta_valor)) : '—') : (C.num(u.meta_reunioes) ? u.meta_reunioes + ' reuniões' : '—');
          return '<tr data-u="' + u.id + '"><td><div class="pessoa">' + C.av(u.nome, '', u.cor) + '<div class="trunc"><b>' + esc(u.nome) + '</b><span class="small muted">' + esc(u.email) + '</span></div></div></td><td><span class="chip perfil-' + esc(u.perfil) + '">' + esc((C.PERFIS[u.perfil] || {}).nome || u.perfil) + '</span></td><td class="esconde-mob">' + meta + '</td><td class="esconde-mob">' + (u.recebe_leads === 'SIM' ? 'Sim' : 'Não') + '</td><td class="esconde-mob small muted">' + (u.ultimo_acesso ? C.fmtData(u.ultimo_acesso) : 'nunca') + '</td><td><span class="status ' + (u.ativo === 'SIM' ? 'st-on' : 'st-off') + '">' + (u.ativo === 'SIM' ? 'Ativo' : 'Bloqueado') + '</span></td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        '<div class="aviso info" style="margin-top:16px">' + ic('info') + '<div><b>Como funciona a passagem de leads.</b> O lead novo cai para um SDR (em rodízio, se ligado em Ajustes > Regras). Quando o SDR qualifica, ele usa <b>Passar para closer</b> na conversa ou no contato, escolhe o closer (ou deixa no rodízio) e marca a reunião. O closer recebe a tarefa e o lead recebe um lembrete automático antes da reunião.</div></div>';
      C.$('#eq-novo').onclick = function () { formPessoa({ perfil: 'sdr', recebe_leads: 'SIM' }); };
      C.$$('[data-criar]', el).forEach(function (b) { b.onclick = function () { formPessoa({ perfil: b.dataset.criar, recebe_leads: b.dataset.criar === 'sdr' || b.dataset.criar === 'closer' ? 'SIM' : 'NAO' }); }; });
      C.$$('tr[data-u]', el).forEach(function (tr) { tr.onclick = function () { formPessoa(C.usuario(tr.dataset.u)); }; });
    }
  };

  function formPessoa(u) {
    u = u || {};
    var senhaSugerida = Math.random().toString(36).slice(2, 7) + '-' + Math.random().toString(36).slice(2, 7);
    var el = C.modal({
      titulo: u.id ? 'Editar conta' : 'Criar conta',
      corpo: '<div class="grade2"><div class="campo"><label>Nome</label><input class="inp" id="u-nome" value="' + esc(u.nome || '') + '"></div><div class="campo"><label>E-mail (login)</label><input class="inp" type="email" id="u-email" value="' + esc(u.email || '') + '"></div></div>' +
        '<div class="campo"><label>Perfil</label><div class="perfil-opcoes">' + ['sdr', 'closer', 'gestor', 'personalizado', 'admin'].map(function (k) { return '<label class="perfil-op"><input type="radio" name="u-perfil" value="' + k + '"' + ((u.perfil === 'atendente' ? 'sdr' : u.perfil || 'sdr') === k ? ' checked' : '') + '><span><b>' + C.PERFIS[k].nome + '</b><small>' + C.PERFIS[k].desc + '</small></span></label>'; }).join('') + '</div></div>' +
        '<div class="campo" id="u-areas-box"><label>O que esta pessoa pode acessar</label><div class="chips" style="margin-bottom:8px">' + Object.keys(C.PERFIS_PRONTOS).map(function (k) { return '<button type="button" class="chip" data-pronto="' + k + '">' + ic('raio') + C.PERFIS_PRONTOS[k].nome + '</button>'; }).join('') + '</div>' +
        '<div class="areas-grade">' + Object.keys(S.areas || {}).map(function (k) { return '<label class="check"><input type="checkbox" data-area="' + k + '"' + (C.tags(u.permissoes || '').indexOf(k) >= 0 ? ' checked' : '') + '> ' + esc(S.areas[k]) + '</label>'; }).join('') + '</div><span class="ajuda">Conversas, contatos dela, negócios e tarefas sempre ficam liberados.</span></div>' +
        '<div class="grade2"><div class="campo" id="u-meta-v"><label>Meta de vendas no mês (R$)</label><input class="inp" type="number" min="0" id="u-mv" value="' + esc(u.meta_valor || '') + '"></div><div class="campo" id="u-meta-r"><label>Meta de reuniões no mês</label><input class="inp" type="number" min="0" id="u-mr" value="' + esc(u.meta_reunioes || '') + '"></div></div>' +
        '<div class="campo"><label>' + (u.id ? 'Nova senha (deixe em branco para manter)' : 'Senha inicial') + '</label><div class="linha"><input class="inp" type="text" id="u-senha" autocomplete="new-password" value="' + (u.id ? '' : senhaSugerida) + '"><button class="btn" id="u-gerar" style="flex:0 0 auto">' + ic('atualizar') + ' Gerar</button></div><span class="ajuda">Mínimo 8 caracteres. A pessoa pode trocar depois no menu com o nome dela.</span></div>' +
        '<div class="grade2"><label class="check"><input type="checkbox" id="u-recebe"' + (u.recebe_leads === 'SIM' ? ' checked' : '') + '> Recebe leads no rodízio</label><label class="check"><input type="checkbox" id="u-ativo"' + (u.ativo !== 'NAO' ? ' checked' : '') + '> Acesso liberado</label></div>' +
        '<div class="campo"><label>Cor do avatar</label><input type="color" class="inp-cor" id="u-cor" value="' + esc(u.cor || C.corDe(u.nome || 'x')) + '"></div>',
      pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="u-ok" data-carregando=" Salvando...">' + (u.id ? 'Salvar' : 'Criar conta') + '</button>'
    });
    var perfilSel = function () { var r = el.querySelector('[name="u-perfil"]:checked'); return r ? r.value : 'sdr'; };
    var metas = function () { var p = perfilSel(); el.querySelector('#u-meta-r').style.display = p === 'sdr' ? '' : 'none'; el.querySelector('#u-meta-v').style.display = p === 'sdr' || p === 'personalizado' ? 'none' : ''; el.querySelector('#u-areas-box').style.display = p === 'personalizado' ? '' : 'none'; };
    C.$$('[data-pronto]', el).forEach(function (b) { b.onclick = function () { var a = C.PERFIS_PRONTOS[b.dataset.pronto].areas; C.$$('[data-area]', el).forEach(function (x) { x.checked = a.indexOf(x.dataset.area) >= 0; }); }; });
    C.$$('[name="u-perfil"]', el).forEach(function (r) { r.onchange = metas; });
    metas();
    el.querySelector('#u-gerar').onclick = function () { el.querySelector('#u-senha').value = Math.random().toString(36).slice(2, 7) + '-' + Math.random().toString(36).slice(2, 7); };
    el.querySelector('#u-ok').onclick = function () {
      var dados = { id: u.id, nome: el.querySelector('#u-nome').value, email: el.querySelector('#u-email').value, perfil: perfilSel(), senha: el.querySelector('#u-senha').value.trim(), recebe_leads: el.querySelector('#u-recebe').checked ? 'SIM' : 'NAO', ativo: el.querySelector('#u-ativo').checked ? 'SIM' : 'NAO', cor: el.querySelector('#u-cor').value, meta_valor: el.querySelector('#u-mv').value, meta_reunioes: el.querySelector('#u-mr').value, permissoes: C.$$('[data-area]', el).filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.area; }).join(',') };
      if (dados.perfil === 'personalizado' && !dados.permissoes) { C.toast('Marque pelo menos um acesso ou use um dos atalhos.', 'erro'); return; }
      C.comBotao(this, function () {
        return C.api('usuario.salvar', { usuario: dados }).then(function () {
          el.fechar();
          if (dados.senha) {
            var link = location.origin + location.pathname + (C.apiUrl() && C.apiUrl() !== 'demo' ? '?api=' + encodeURIComponent(C.apiUrl()) : '?demo=1');
            var txt = 'Seu acesso ao ' + ((S.config.marca || {}).nome || 'CRM') + ':\nEndereço: ' + link + '\nE-mail: ' + dados.email.trim().toLowerCase() + '\nSenha: ' + dados.senha;
            C.modal({ titulo: 'Conta pronta', corpo: '<p style="margin-top:0">Envie estes dados para a pessoa (por WhatsApp ou e-mail):</p><textarea class="inp" rows="5" readonly id="u-txt">' + esc(txt) + '</textarea>', pe: '<button class="btn" data-fechar>Fechar</button><button class="btn pri" id="u-cop">' + ic('copiar') + ' Copiar</button>' })
              .querySelector('#u-cop').onclick = function () { C.copiar(txt); };
          } else C.toast('Conta atualizada', 'ok');
          return C.recarregar();
        });
      });
    };
  }
  function ajSistema(box) {
    box.innerHTML = '<div class="grid-2" style="align-items:start"><div class="card card-pad"><h3 style="font-size:15px;margin-bottom:10px">Sobre este sistema</h3>' +
      '<div class="dado">Versão: <b>' + esc(CFGA.VERSAO) + '</b></div><div class="dado">Servidor:</div>' + (CFGA.URL_APP ? C.copiavel(CFGA.URL_APP) : '<p class="small muted">Modo demonstração</p>') +
      '<p class="small muted">Para abrir o sistema em outro computador já conectado, use o link:</p>' + C.copiavel(location.origin + location.pathname + (CFGA.URL_APP ? '?api=' + encodeURIComponent(CFGA.URL_APP) : '?demo=1')) +
      (CFGA.URL_PLANILHA ? '<a class="btn" style="margin-top:12px" href="' + esc(CFGA.URL_PLANILHA) + '" target="_blank" rel="noopener">' + ic('planilha') + ' Abrir planilha de dados</a>' : '') + '</div>' +
      '<div class="card card-pad"><h3 style="font-size:15px;margin-bottom:10px">Manutenção</h3><p class="small muted" style="margin-top:0">Com o tempo a fila de envios e o registro das automações crescem. Limpar deixa o sistema mais rápido. Contatos, conversas e negócios não são apagados.</p>' +
      '<button class="btn" id="sy-limpa" data-carregando=" Limpando...">' + ic('lixo') + ' Limpar registros com mais de 90 dias</button>' +
      '<h3 style="font-size:15px;margin:20px 0 10px">Backup</h3><p class="small muted" style="margin-top:0">Exporte contatos em Contatos > Exportar e negócios em Relatórios. A cópia completa é feita na própria planilha (Arquivo > Fazer uma cópia).</p>' +
      (C.ehDemo() ? '<button class="btn perigo" id="sy-reset">' + ic('atualizar') + ' Reiniciar dados da demonstração</button>' : '') + '</div></div>' +
      '<div class="card card-pad" style="margin-top:16px" id="sy-sup"></div><div class="card card-pad" style="margin-top:16px" id="sy-lim"><div style="text-align:center;padding:20px"><span class="spin" style="color:var(--pri)"></span></div></div>' +
      '<div class="card card-pad" style="margin-top:16px" id="sy-arq"><div style="text-align:center;padding:20px"><span class="spin" style="color:var(--pri)"></span></div></div>';
    C.$('#sy-limpa').onclick = function () { var b = this; C.comBotao(b, function () { return C.api('historico.limpar', { dias: 90 }).then(function (r) { C.toast(r.fila + ' envios e ' + r.execucoes + ' execuções antigas removidos', 'ok'); }); }); };
    if (C.$('#sy-reset')) C.$('#sy-reset').onclick = function () { window.PrumoDemo.resetar(); };
    pintarSuporte(C.$('#sy-sup'), S.suporte || {});
    C.api('limites').then(function (r) { pintarLimites(C.$('#sy-lim'), r); }).catch(function (e) { C.$('#sy-lim').innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; });
    C.api('arquivo.listar').then(function (r) { pintarArquivo(C.$('#sy-arq'), r); }).catch(function (e) { C.$('#sy-arq').innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; });
  }

  function nomeMes(m) { var n = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']; return n[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4); }
  function pintarSuporte(box, sp) {
    if (!box) return;
    var st = !sp.tem ? ['Sem código', 'st-off'] : sp.ativo ? ['Ativo', 'st-on'] : ['Encerrado', 'st-erro'];
    box.innerHTML = '<div class="card-cab" style="padding:0 0 10px;border:0"><h3 style="font-size:15px">' + ic('escudo') + ' Plano de suporte e atualizações</h3><span class="status ' + st[1] + '" style="margin-left:auto">' + st[0] + '</span></div>' +
      (sp.tem ? '<div class="grade2"><div class="dado">Plano: <b>' + esc(sp.nome_plano) + '</b></div><div class="dado">Válido até: <b>' + sp.ate.split('-').reverse().join('/') + '</b>' + (sp.ativo ? ' (' + sp.dias + ' dias)' : '') + '</div>' + (sp.cliente ? '<div class="dado">Licenciado para: <b>' + esc(sp.cliente) + '</b></div>' : '') + (sp.contato ? '<div class="dado">Suporte: <b>' + esc(sp.contato) + '</b></div>' : '') + '</div>' : '') +
      '<p class="small muted">Você pagou uma vez e o sistema é seu para sempre. O plano de suporte define até quando você recebe atualizações, novas funções e correções. Depois disso o sistema continua funcionando como está; integrações de terceiros (Meta, Mercado Pago, Evolution) podem mudar com o tempo e precisar de atualização.</p>' +
      (C.pode('equipe') ? '<div class="campo"><label>Código de suporte (veio na sua compra)</label><div class="linha"><input class="inp" id="sp-cod" placeholder="Cole o código aqui"><button class="btn" id="sp-ok" style="flex:0 0 auto" data-carregando=" Conferindo...">Salvar código</button></div></div>' : '') +
      '<div class="dado small">Versão instalada: <b>' + esc(sp.versao || '') + '</b></div>';
    var b = box.querySelector('#sp-ok');
    if (b) b.onclick = function () { C.comBotao(b, function () { return C.api('suporte.salvar', { codigo: box.querySelector('#sp-cod').value }).then(function (r) { S.suporte = r; pintarSuporte(box, r); C.toast(r.tem ? 'Código de suporte salvo' : 'Código removido', 'ok'); }); }); };
  }
  function barraUso(rot, usado, limite, nota) {
    var p = limite ? Math.min(100, Math.round(usado / limite * 100)) : 0;
    return '<div class="uso"><div class="uso-cab"><b>' + rot + '</b><span class="small">' + (limite ? C.inteiro(usado) + ' de ' + C.inteiro(limite) : C.inteiro(usado)) + '</span></div>' + (limite ? '<div class="meta-barra' + (p > 85 ? ' alerta' : '') + '"><div style="width:' + p + '%"></div></div>' : '') + (nota ? '<div class="small muted">' + nota + '</div>' : '') + '</div>';
  }
  function pintarLimites(box, r) {
    if (!box) return;
    var wa = { evolution: 'Evolution API: sem limite fixo. Para não ser bloqueado, recomendamos até ~200 contatos novos por dia por número, com intervalo entre mensagens.', waha: 'WAHA: sem limite fixo. Mesma recomendação da Evolution (até ~200 contatos novos por dia).', meta: 'API oficial: a Meta define quantos clientes novos por dia você pode chamar (começa em 250 e sobe com a qualidade do número). Veja no Gerenciador do WhatsApp.', link: 'Modo link: cada mensagem é enviada à mão.' }[r.provedor] || '';
    box.innerHTML = '<div class="card-cab" style="padding:0 0 10px;border:0"><h3 style="font-size:15px">' + ic('relatorios') + ' Limites e uso</h3></div>' +
      '<p class="small muted" style="margin-top:0">O sistema não limita usuários, contatos nem conversas. Os limites abaixo são do Google, da Meta e dos serviços gratuitos que ele usa.</p><div class="usos">' +
      barraUso('Usuários ativos', r.usuarios, 0, 'Sem limite.') +
      (r.planilha ? barraUso('Espaço da planilha (células)', r.planilha.celulas, r.planilha.limite, 'Limite do Google Planilhas. O arquivo mensal mantém o uso baixo. Cabem ainda cerca de ' + C.inteiro(r.contatos_capacidade) + ' contatos.') : barraUso('Contatos', r.contatos, 0, 'Sem limite próprio (no servidor, o limite é o espaço da planilha).')) +
      barraUso('Contatos na base', r.contatos, 0, '') +
      barraUso('Mensagens neste mês', r.mensagens_mes, 0, 'Os meses anteriores vão para o arquivo mensal.') +
      barraUso('E-mails hoje', r.email.enviados_hoje, r.email.por_dia, 'Gmail: cerca de 100 por dia (1.500 no Google Workspace). Brevo grátis: 300 por dia. O que passar sai no dia seguinte.') +
      barraUso('Disparos de WhatsApp hoje', r.disparos_hoje, 0, wa) +
      barraUso('Chamadas externas hoje (aprox.)', r.chamadas_hoje, r.workspace ? 100000 : 20000, 'Cota diária do Google para o servidor falar com WhatsApp, Instagram, e-mail e Mercado Pago.') +
      (r.instagram ? barraUso('Instagram', 0, 0, 'A Meta limita as mensagens automáticas no Direct (na prática, cerca de 200 por hora por conta).') : '') +
      '</div>';
  }
  function mesAnterior(m) { var a = Number(m.slice(0, 4)), n = Number(m.slice(5, 7)) - 1; if (!n) { n = 12; a--; } return a + '-' + ('0' + n).slice(-2); }
  function pintarArquivo(box, r) {
    if (!box) return;
    box.innerHTML = '<div class="card-cab" style="padding:0 0 10px;border:0"><h3 style="font-size:15px">' + ic('arquivo') + ' Arquivo mensal no Google Drive</h3></div>' +
      '<p class="small muted" style="margin-top:0">Todo mês, as mensagens, o histórico, os envios e os negócios fechados do mês anterior vão para uma planilha própria no seu Google Drive (pasta <b>' + esc((S.config.marca || {}).nome || '') + ' - Arquivos</b>), com o nome do mês e do ano. A planilha principal fica leve, só com o mês atual, e nunca chega no limite do Google. Os dados antigos continuam aparecendo no sistema: nos relatórios e no botão <b>Ver meses anteriores</b> de cada conversa.</p>' +
      '<label class="check"><input type="checkbox" id="ar-auto"' + (r.auto === 'SIM' ? ' checked' : '') + '> Arquivar sozinho na virada do mês (de madrugada)</label>' +
      '<div class="dado small">Arquivado até: <b>' + (r.feito ? nomeMes(mesAnterior(r.feito)) : 'nenhum mês ainda') + '</b></div>' +
      (r.arquivos.length ? '<div class="tabela-wrap" style="margin:10px 0"><table class="tab"><thead><tr><th>Mês</th><th>Linhas guardadas</th><th></th></tr></thead><tbody>' + r.arquivos.map(function (a) { return '<tr style="cursor:default"><td>' + nomeMes(a.mes) + '</td><td class="num">' + C.inteiro(C.num(a.linhas)) + '</td><td>' + (a.url ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener" class="btn peq">' + ic('externo') + ' Abrir planilha</a>' : '<span class="small muted">guardado no navegador (demonstração)</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="small muted">Nenhum mês arquivado ainda.</p>') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="ar-ja" data-carregando=" Arquivando...">' + ic('arquivo') + ' Arquivar meses anteriores agora</button><button class="btn pri" id="ar-salvar" data-carregando=" Salvando...">Salvar</button></div>' +
      '<p class="small muted">Arquivar agora pode levar alguns minutos e, enquanto isso, o sistema fica mais lento. Prefira fora do horário de atendimento.</p>';
    box.querySelector('#ar-salvar').onclick = function () { var b = this; C.comBotao(b, function () { return salvarCfg({ ARQUIVO_AUTO: box.querySelector('#ar-auto').checked ? 'SIM' : 'NAO' }).then(function () { C.toast('Salvo', 'ok'); }); }); };
    box.querySelector('#ar-ja').onclick = function () {
      var b = this;
      C.comBotao(b, function () {
        return C.api('arquivo.arquivar').then(function (x) {
          C.toast(x.total ? C.inteiro(x.total) + ' linhas movidas para o arquivo' + (x.parcial ? '. Clique de novo para continuar.' : '') : 'Nada para arquivar: só há dados do mês atual.', 'ok');
          return C.api('arquivo.listar').then(function (r2) { pintarArquivo(box, r2); });
        });
      });
    };
  }
})();
