# Guia do vendedor: como vender e entregar o Prumo CRM

Este guia é para você (dono do produto), não para o cliente.

## O modelo

- O cliente paga **uma vez** e usa para sempre.
- Os dados e o servidor ficam **na conta Google do cliente** (planilha + Apps Script). Seu custo por cliente é zero.
- As telas do sistema ficam num único site seu no **GitHub Pages**. Todos os clientes usam o mesmo endereço; cada um conecta o próprio servidor na primeira tela. Atualizar o site atualiza todos.
- O WhatsApp: o cliente escolhe. Modo link (grátis, sem instalar), Evolution/WAHA (grátis, precisa de servidor) ou API oficial da Meta (paga por mensagem para a Meta).

## Preparar uma vez

### 1. Publicar o site no GitHub Pages
1. Crie um repositório (pode ser privado se sua conta tiver GitHub Pages para privados; senão, público só com a pasta `app`).
2. Envie o projeto. Em **Settings > Pages > Source**, escolha **GitHub Actions**. A Action `.github/workflows/pages.yml` publica a página de vendas na raiz e o sistema em `/app`.
3. Endereços: vendas em `https://SEU_USUARIO.github.io/prumo-crm/` e sistema em `https://SEU_USUARIO.github.io/prumo-crm/app/`.

A demonstração para mostrar a clientes: `https://SEU_USUARIO.github.io/prumo-crm/app/?demo=1`

### 2. Criar a planilha-modelo
1. Crie uma planilha nova, cole o `backend/Codigo.gs` em Extensões > Apps Script e salve. **Não rode o instalar.**
2. Compartilhe a planilha como "Qualquer pessoa com o link: Leitor".
3. Troque o final do link de `/edit...` por `/copy`. Exemplo:
   `https://docs.google.com/spreadsheets/d/ID_DA_PLANILHA/copy`
4. Esse é o link que o cliente recebe: ao abrir, ele faz uma cópia com o script junto.

### 3. Página de vendas
A pasta `vendas/` tem a landing page. Troque o link do botão de compra pelo seu link de pagamento do Mercado Pago (Seu negócio > Link de pagamento) no arquivo `vendas/index.html` (variável `LINK_PAGAMENTO`).

## Entregar para um cliente (checklist)

1. Enviar o link `/copy` da planilha-modelo.
2. Enviar o link do sistema (GitHub Pages).
3. Enviar o `docs/INSTALACAO.md` (ou fazer a instalação por chamada de vídeo, 15 minutos).
4. Se o cliente quiser WhatsApp com robôs: indicar a Evolution API (`docs/WHATSAPP_EVOLUTION.md`) ou oferecer a instalação como serviço extra.

## Sugestão de ofertas

| Oferta | O que inclui | Faixa de preço sugerida |
|---|---|---|
| Licença | Sistema completo, instalação guiada por documento, atualizações | pagamento único |
| Licença + instalação | Você instala por chamada e deixa o funil e as automações configurados | pagamento único maior |
| Servidor de WhatsApp gerenciado (opcional) | Você hospeda a Evolution para o cliente | mensal (custo da VPS dividido entre clientes) |

O último item é o único recorrente e é opcional. A promessa "sem mensalidade" continua valendo para o CRM.

## Termos que valem deixar claros na venda

- O uso do WhatsApp por API não oficial (Evolution/WAHA) segue as regras do WhatsApp; abuso pode bloquear o número.
- Cotas gratuitas do Google atendem pequenas empresas. Volume muito alto pede conta Google Workspace.
- O cliente é o controlador dos dados dos contatos dele (LGPD). O sistema tem descadastro automático (palavra SAIR).
