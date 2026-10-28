# Prumo CRM

CRM para pequenas empresas com WhatsApp, robôs de atendimento, disparos, grupos e funil de vendas. Licença de pagamento único: o servidor roda na conta Google do cliente (Planilhas + Apps Script) e as telas ficam no GitHub Pages do próprio cliente. Custo de infraestrutura zero.

Sistema white label: cada empresa troca nome, logo e cores pelo próprio sistema.

## O que tem

| Área | Recursos |
|---|---|
| Conversas | Caixa de entrada do WhatsApp para a equipe, respostas rápidas com `/atalho`, mídia por link, responsável por conversa, pausa do robô quando um humano responde |
| Contatos | Tags, campos personalizados, origem, filtros, ações em massa, importação CSV com detecção de colunas, exportação, ficha com histórico |
| Negócios | Vários funis, kanban com arrastar e soltar, ganho/perdido com motivo, negócios parados |
| Tarefas | Prazos, atrasadas, tarefas criadas pelos robôs |
| Automações | Gatilhos (primeira mensagem, palavra-chave, novo contato, webhook, tag, etapa, manual) e 15 tipos de passo: mensagem, pergunta com validação, menu numerado, espera, condição, tag, funil, rodízio, campo, status, tarefa, passar para humano, webhook, ir para, encerrar. 6 modelos prontos |
| Disparos | Público por tags/etapas/status/origem/datas, spintax `{Oi\|Olá}`, mídia, agendamento, velocidade anti-bloqueio, horário comercial, descadastro automático (SAIR), envio assistido sem API, modelos da Meta |
| Grupos | Importação dos grupos do WhatsApp, disparo para grupos, link inteligente que troca de grupo quando lota |
| Relatórios | Contatos por origem, mensagens por dia, tempo de resposta, conversão, motivos de perda, equipe, disparos e automações |
| Integrações | Evolution API, WAHA, API oficial da Meta, modo link; webhook de captação universal (Elementor, Typebot, Hotmart, Kiwify, RD, Google Forms, Lead Ads via Make/Zapier); formulário pronto; webhooks de saída (n8n, Make, Zapier) |
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
ferramentas/         montar.js, testar.js e empacotar.js
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
- [Integrações de captação](docs/INTEGRACOES.md)

## Referências estudadas

CRMs de código aberto: Twenty, EspoCRM, Krayin, SuiteCRM (funil, campos personalizados, painel administrável) e Chatwoot (caixa de entrada multiatendente). Ferramentas de WhatsApp: ManyChat (fluxos com gatilhos e passos), SendFlow (grupos e link de redirecionamento) e Unnichat (menus de atendimento e funis no WhatsApp).
