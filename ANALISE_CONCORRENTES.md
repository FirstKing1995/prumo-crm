# Análise de concorrentes e próximos passos

Documento interno de produto (não vai no pacote do cliente). Atualizado em 28/10/2026, versão 1.2.

## Ferramentas olhadas

| Ferramenta | Forte em | O que trouxemos |
|---|---|---|
| Unnichat | API oficial do WhatsApp e Instagram, fluxos, CRM simples, modelos prontos | Canal Instagram, comentário para Direct, menus com botões, formulário em uma mensagem (Flows), economia na API oficial |
| ManyChat | Automação no Instagram: palavra no comentário vira conversa no Direct | Gatilho "Comentou no Instagram", resposta pública e resposta privada |
| SendFlow | Grupos de WhatsApp, links que trocam de grupo quando lota | Já tinha na 1.0 (link inteligente de grupos) |
| Kommo (amoCRM) | Funil visual, Salesbot, várias pessoas no mesmo número | Pontuação de lead e passagem automática para closer dentro dos robôs |
| Clint, RD Station CRM | Operação de vendas B2B: SDR, closer, reuniões, metas | Perfis SDR e closer, passagem com reunião, lembrete anti-falta, metas e relatório por papel |
| ActiveCampaign | E-mail marketing com automação, lead scoring, rastreio do site, CRM de vendas | E-mail marketing completo na versão 1.2 (ver abaixo), com envio grátis pelo Gmail e Brevo |
| Mautic e listmonk (código aberto) | Mautic: automação, formulários, pontuação e rastreio de visitantes. listmonk: newsletters leves | Ideias de rastreio de visitas só de contatos conhecidos e relatório por campanha |
| Chatwoot, Respond.io | Caixa de entrada multiatendente, prazo de resposta | Alerta de tempo de resposta (SLA) na caixa e no painel |
| Hotmart, Kiwify (integrações nativas de concorrentes) | Recuperação de carrinho e boleto pelo WhatsApp | Eventos de venda viram tag, negócio ganho e gatilho de automação, com modelos prontos |

Observação de preço: os concorrentes cobram mensalidade por usuário ou por contato. O Prumo segue com pagamento único e infraestrutura na conta do cliente, que é o argumento central de venda.

## Entrou na versão 1.1

1. Contas por papel (administrador, gestor, SDR, closer) criadas numa área só do administrador, com metas.
2. Passagem SDR para closer com reunião, tarefa, resumo da qualificação e lembrete automático para o lead.
3. Painel com meta do mês e próximas reuniões; relatório de SDRs e de closers.
4. Prazo de resposta (SLA) com destaque em vermelho.
5. API oficial: janela de 24h visível, envio de modelo pela conversa, disparo econômico com estimativa, menus em botões, formulário em uma mensagem (WhatsApp Flows), período grátis de anúncio, modelo de reserva nos robôs, relatório de custo.
6. Instagram: Direct na caixa de entrada, comentário para Direct, resposta pública.
7. Hotmart e Kiwify com chave própria (evita venda falsa), ActiveCampaign nos dois sentidos, Lead Ads do Facebook, Instagram e TikTok, API do sistema com chave secreta.
8. Arquivo mensal em planilhas no Drive do cliente, consultável pelo sistema.
9. Pontuação de lead e novos passos de robô: formulário, pontuar, passar para closer, responder comentário, enviar ao ActiveCampaign.

## Entrou na versão 1.2 (funções do ActiveCampaign)

| ActiveCampaign | Prumo 1.2 | Custo para o comprador |
|---|---|---|
| Campanhas de e-mail com editor | Editor por blocos com prévia na marca do cliente | Zero |
| Envio | Gmail da conta (100/dia comum, 1.500/dia Workspace) + Brevo grátis (300/dia), fila para os dias seguintes | Zero |
| Teste A/B | Teste A/B de assunto | Zero |
| Automações com e-mail | Passo Enviar e-mail, gatilhos Abriu e Clicou, condição Abriu/Não abriu | Zero |
| Site tracking | Script de rastreio que reconhece quem veio de um e-mail, gatilho Visitou o site | Zero |
| Lead scoring | Pontuação já existia (1.1) e agora soma com e-mail e visitas | Zero |
| Descadastro e listas | Descadastro com link assinado, segmentos por tags e filtros | Zero |
| Relatórios | Aberturas, cliques, descadastros, A/B e lista por contato | Zero |

O que o ActiveCampaign tem e ainda não trouxemos: editor arrastar e soltar com modelos visuais, conteúdo condicional dentro do e-mail, envio no melhor horário por contato, páginas de captura e formulários com várias etapas. Entram na lista abaixo.

Limite real a deixar claro na venda: quem precisa de dezenas de milhares de e-mails por dia precisa de um provedor pago (Brevo, Amazon SES); o sistema já fala com o Brevo, então basta trocar o plano lá.

## Próximos passos sugeridos (por prioridade)

| Prioridade | Melhoria | Por quê | Esforço |
|---|---|---|---|
| 1 | Link público de agendamento (o lead escolhe o horário livre do closer) | Tira o vai e vem de "qual horário você pode?" e alimenta a reunião sozinho | Médio |
| 2 | Sincronizar reuniões com o Google Agenda do closer | O Apps Script já tem acesso nativo ao Calendar | Baixo |
| 3 | Respostas sugeridas por IA na conversa (chave de IA do próprio cliente) | Os concorrentes vendem IA como diferencial; aqui o custo fica com o cliente | Médio |
| 4 | Filas por departamento (Vendas, Suporte, Financeiro) com transferência | Pedido comum de quem tem mais de um setor no mesmo número | Médio |
| 5 | Pesquisa de satisfação (NPS) automática após a venda | Fácil com os passos atuais; falta o relatório | Baixo |
| 6 | Proposta em PDF gerada a partir do negócio | Closers mandam proposta todo dia; o Apps Script gera PDF pelo Docs | Médio |
| 7 | Vários números de WhatsApp no mesmo sistema | Empresas com unidades diferentes | Alto |
| 8 | Notificações no celular (PWA com push) | Hoje o aviso depende da tela aberta | Médio |
| 9 | Modelos visuais prontos de e-mail e páginas de captura | Fecha a lacuna mais visível em relação ao ActiveCampaign | Médio |
| 10 | Envio no melhor horário de cada contato (pelo histórico de aberturas) | Aumenta a taxa de abertura | Baixo |

## Riscos a acompanhar

- **Preços da Meta mudam a cada trimestre.** Em 1º de outubro de 2026 as mensagens de atendimento acima de 1.000 por mês passaram a ser cobradas. Os preços da estimativa são editáveis pelo cliente.
- **Instagram em modo de desenvolvimento** só conversa com contas de teste; o cliente precisa publicar o app da Meta. Vale um vídeo curto no curso.
- **Cotas do Apps Script** em contas Gmail comuns: o arquivo mensal e o gatilho de 1 minuto foram feitos para gastar pouco, mas operações muito grandes pedem Google Workspace.

## Fontes

- [Preços da plataforma WhatsApp Business (Meta)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- [WhatsApp Flows (Meta)](https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides)
- [Cotas do Google Apps Script (e-mail)](https://developers.google.com/apps-script/guides/services/quotas)
- [Brevo: plano grátis](https://www.techradar.com/pro/software-services/brevo-review)
- [Alternativas de código aberto ao ActiveCampaign](https://openalternative.co/alternatives/activecampaign)
- [Mautic e listmonk](https://sequenzy.com/versus/listmonk-vs-mautic)
- [Unnichat](https://lp.unnichat.com.br/en)
- [Comparativo de CRMs com WhatsApp no Brasil (JivoChat)](https://www.jivochat.com.br/blog/ferramentas/melhores-ferramentas-de-crm-com-whatsapp-para-empresas-brasileiras-em-2026.html)
- [Comparativo de CRMs para WhatsApp 2026 (Aurora Inbox)](https://www.aurorainbox.com/2026/01/23/mejores-crm-whatsapp-2025/)
