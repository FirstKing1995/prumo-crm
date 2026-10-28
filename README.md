# Prumo CRM

CRM para pequenas empresas com WhatsApp, robôs de atendimento, disparos, grupos e funil de vendas. Licença de pagamento único: o servidor roda na conta Google do cliente (Planilhas + Apps Script) e as telas ficam no GitHub Pages do próprio cliente. Custo de infraestrutura zero.

Sistema white label: cada empresa troca nome, logo e cores pelo próprio sistema.

## O que tem

| Área | Recursos |
|---|---|
| Equipe | Contas por papel (administrador, gestor, SDR, closer) criadas pelo administrador, metas do mês, passagem do lead do SDR para o closer com reunião e lembrete automático, prazo de resposta |
| Conversas | Caixa de entrada do WhatsApp e do Instagram Direct para a equipe, janela de 24h da API oficial, respostas rápidas com `/atalho`, mídia por link, responsável por conversa, pausa do robô quando um humano responde |
| Contatos | Tags, campos personalizados, origem, filtros, ações em massa, importação CSV com detecção de colunas, exportação, ficha com histórico |
| Negócios | Vários funis, kanban com arrastar e soltar, ganho/perdido com motivo, negócios parados |
| Tarefas | Prazos, atrasadas, tarefas criadas pelos robôs |
| Automações | Gatilhos (primeira mensagem, palavra-chave, novo contato, webhook, tag, etapa, comentário no Instagram, evento de venda, manual) e 20 tipos de passo, incluindo menu com botões, formulário (WhatsApp Flows na API oficial), pontuação de lead, passar para closer, responder comentário e enviar ao ActiveCampaign. 11 modelos prontos |
| Disparos | Público por tags/etapas/status/origem/datas, spintax `{Oi\|Olá}`, mídia, agendamento, velocidade anti-bloqueio, horário comercial, descadastro automático (SAIR), envio assistido sem API, modelos da Meta |
| Grupos | Importação dos grupos do WhatsApp, disparo para grupos, link inteligente que troca de grupo quando lota |
| Relatórios | Contatos por origem, mensagens por dia, tempo de resposta, conversão, motivos de perda, SDRs e closers com metas, custo estimado da API oficial, disparos e automações. Inclui meses arquivados |
| Arquivo mensal | Todo mês os dados fechados vão para uma planilha própria no Drive do cliente ("Nome - Arquivo AAAA-MM"), consultável pelo sistema |
| Integrações | Evolution API, WAHA, API oficial da Meta (com economia de custo), modo link, Instagram; Hotmart e Kiwify com chave própria; ActiveCampaign nos dois sentidos; Lead Ads do Facebook, Instagram e TikTok; webhook de captação universal; formulário pronto; webhooks de saída; API do sistema com chave secreta |
| Ajustes | Marca e cores com prévia, funis e etapas, campos e listas, respostas rápidas, regras de envio, equipe com perfis (admin, gestor, atendente) |

## Estrutura

```
app/                 telas do sistema (HTML, CSS e JS puros, sem build)
  js/logica.js       regras de negócio, usadas no servidor E no modo demonstração
  js/demo.js         backend simulado no navegador (dados de exemplo)
  js/core.js         estado, API, componentes, tema
  js/app.js          conexão, login, assistente inicial, menu, sincronização
  js/views-*.js      telas
  g.html             página pública do link inteligente de grupos
backend/
  plataforma.gs      servidor Apps Script (planilha, webhooks, gatilho de 1 minuto)
  Codigo.gs          arquivo único para colar no Apps Script (gerado)
docs/                instalação, WhatsApp e integrações (vão para o cliente)
ferramentas/         montar.js, testar.js (+ testar-novos.js) e empacotar.js
```

## Comandos

```bash
node ferramentas/montar.js
```
Gera `backend/Codigo.gs` juntando `backend/plataforma.gs` e `app/js/logica.js`. Rode sempre que mexer nesses arquivos.

```bash
node ferramentas/testar.js
```
Testa a lógica do servidor (webhooks reais da Evolution, WAHA e Meta, robô, disparos, permissões).

Para ver localmente: sirva a pasta `app` (ex.: `python -m http.server 5180 --directory app`) e abra `http://localhost:5180/?demo=1`.

## Entrega para o cliente

```bash
node ferramentas/empacotar.js
```
Monta o código do servidor, roda os testes e gera `dist/prumo-crm-vX.Y.Z.zip` limpo: `site/` (sobe no GitHub Pages do cliente), `planilha/Codigo.gs` (vai no Apps Script da planilha), `docs/` e um `LEIA-ME.txt`. Sem histórico do git, sem testes e sem dados do vendedor.

A página de vendas e o pagamento ficam fora deste projeto, na pasta `prumo-vendas`.

## Documentação

- [Instalação para o cliente](docs/INSTALACAO.md)
- [WhatsApp com Evolution API](docs/WHATSAPP_EVOLUTION.md)
- [WhatsApp com WAHA](docs/WHATSAPP_WAHA.md)
- [Integrações](docs/INTEGRACOES.md)
- [Equipe comercial: SDR e closer](docs/EQUIPE_COMERCIAL.md)
- [Economia na API oficial da Meta](docs/ECONOMIA_API_OFICIAL.md)
- [Arquivo mensal](docs/ARQUIVO_MENSAL.md)
- [Análise de concorrentes e próximos passos](ANALISE_CONCORRENTES.md) (interno)

## Referências estudadas

CRMs de código aberto: Twenty, EspoCRM, Krayin, SuiteCRM (funil, campos personalizados, painel administrável) e Chatwoot (caixa de entrada multiatendente). Ferramentas de WhatsApp: ManyChat (fluxos com gatilhos e passos), SendFlow (grupos e link de redirecionamento) e Unnichat (menus de atendimento e funis no WhatsApp).
