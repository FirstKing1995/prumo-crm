# E-mail marketing

O sistema tem e-mail marketing próprio, no estilo do ActiveCampaign: campanhas, e-mails dentro das automações, relatório de aberturas e cliques, teste A/B de assunto, descadastro automático e rastreio das visitas ao site. Tudo sem mensalidade.

## De onde saem os e-mails (custo zero)

| Opção | Limite grátis por dia | Como ligar |
|---|---|---|
| Gmail da sua conta Google | Cerca de 100 (Gmail comum) ou 1.500 (Google Workspace) | Já vem ligado. É a mesma conta da planilha. |
| Brevo, plano grátis | 300 | Integrações > Envio de e-mails > Brevo |
| Gmail e Brevo juntos | A soma dos dois | Escolha "Gmail e Brevo" |

Os limites são do Google e do Brevo e podem mudar. O sistema deixa uma margem abaixo do limite do Gmail (95 por padrão; mude para 1450 se usa Google Workspace).

Quando a lista é maior que o limite do dia, nada se perde: o restante fica na fila e sai sozinho nos dias seguintes, às 8h. Antes de enviar, o sistema avisa quantos dias vai levar.

Exemplo: com Gmail comum e Brevo, uma lista de 2.000 contatos é enviada em 5 dias.

## Configurar (uma vez)

Em **Integrações > Envio de e-mails (Gmail e Brevo)**:

1. **Nome do remetente** e **Responder para** (o e-mail que recebe as respostas).
2. **Rodapé:** nome da empresa e endereço. Aparece em todo e-mail, ajuda a não cair no spam e atende às boas práticas da LGPD.
3. **Brevo (opcional):** crie a conta grátis, cadastre e confirme o remetente, gere a chave da API e cole aqui.
4. Clique em **Testar** e confira a caixa de entrada (e o spam).

Na primeira vez, o Google pede autorização para o script "enviar e-mail como você". Isso acontece quando você roda **instalar** depois de atualizar o código.

## Campanhas

Em **E-mail marketing > Novo e-mail**:

- **Assunto** com variáveis, como `{primeiro_nome}`.
- **Teste A/B:** escreva um segundo assunto; metade da lista recebe cada um e o relatório mostra o vencedor.
- **Conteúdo por blocos:** título, texto (use `*asteriscos*` para negrito), botão, imagem (link https), divisor e espaço. A prévia ao lado mostra o e-mail com a sua marca e cores.
- **Quem recebe:** por tags, status e origem. Só entram contatos com e-mail válido que não pediram para sair.
- **Agendar** para outra data, ou enviar na hora.
- **Enviar teste** para o seu e-mail antes do envio de verdade.

## E-mails de automação

Na aba **E-mails de automação**, crie e-mails que as automações mandam sozinhas (boas-vindas, sequência de nutrição, carrinho abandonado). Nas automações:

| Peça | O que faz |
|---|---|
| Passo **Enviar e-mail** | Manda um desses e-mails para o contato |
| Gatilho **Abriu um e-mail** | Começa quando o contato abre um e-mail (um específico ou qualquer um) |
| Gatilho **Clicou num e-mail** | Começa quando ele clica, podendo filtrar pelo link (ex.: "agendar") |
| Gatilho **Visitou o site** | Começa quando ele visita uma página do seu site (ex.: "/precos") |
| Condição **Abriu ou clicou e-mail** | Separa quem abriu de quem não abriu |

Modelos prontos: **E-mail e WhatsApp juntos** (quem não abre o e-mail em 2 dias recebe no WhatsApp) e **Visitou a página de preços** (pontua e cria tarefa para o vendedor).

## Relatório

Cada campanha mostra enviados, aberturas, cliques, descadastros e erros, a lista de quem abriu e clicou e o resultado do teste A/B. Na ficha do contato, o histórico mostra cada e-mail enviado, aberto e clicado.

As aberturas são aproximadas: alguns programas bloqueiam imagens (não contam) e outros abrem sozinhos para proteger a privacidade (contam a mais). Cliques são o número mais confiável. Um clique sempre conta também como abertura.

## Descadastro

Todo e-mail tem o link "Não quero mais receber". A pessoa confirma numa página e sai da lista na hora: não recebe mais campanhas nem e-mails de automação. A ficha mostra "Não recebe e-mails". O WhatsApp é separado e continua funcionando.

## Rastreio do site

Em **Integrações > Rastreio do site**, copie o código e cole no seu site, antes de `</body>`. Depois disso, quem clicar num link de e-mail do sistema e navegar no site tem as páginas visitadas registradas no histórico, e o gatilho **Visitou o site** passa a funcionar.

Visitantes anônimos não são rastreados: só quem já é contato e chegou por um link de e-mail. Informe isso na política de privacidade do site.

## Boas práticas para chegar na caixa de entrada

- Mande só para quem se cadastrou. Lista comprada derruba a reputação da conta.
- Comece com envios menores e vá aumentando.
- Com domínio próprio no Brevo, autentique o domínio (SPF e DKIM, o Brevo mostra o passo a passo).
- Evite assunto todo em maiúsculas e excesso de imagens.
