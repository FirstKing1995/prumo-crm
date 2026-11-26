# Instalação do Prumo CRM

Tempo: cerca de 5 minutos. Custo: zero. Você precisa só de uma conta Google (pode ser um Gmail comum).

O sistema tem duas partes:

| Parte | Onde fica | Para que serve |
|---|---|---|
| Servidor e dados | Uma planilha Google na **sua** conta, com o servidor (Apps Script) dentro | Guarda contatos, conversas e negócios. Recebe as mensagens do WhatsApp. Envia disparos e roda os robôs. |
| Telas do sistema | Já estão no ar, no endereço que veio na sua compra | O que a equipe abre no computador ou no celular. As telas não guardam dados: tudo fica na sua planilha. |

Você recebeu na compra:

- o link da **planilha modelo**;
- o endereço das **telas do sistema**;
- o **pacote ZIP** (opcional: só para quem quiser publicar as telas no próprio GitHub, veja o fim deste guia).

---

## Passo 1. Copiar a planilha modelo

1. Abra o link da planilha modelo, com a sua conta Google.
2. Clique em **Fazer uma cópia** (ou no menu **Arquivo > Fazer uma cópia**). Dê o nome que quiser.

O servidor do sistema vem junto, dentro da cópia. A aba **Comece aqui** mostra os próximos passos.

## Passo 2. Implantar o servidor

1. Na sua cópia, menu **Extensões > Apps Script**. O editor abre em outra aba.
2. No canto de cima, à direita: **Implantar > Nova implantação**.
3. Na engrenagem ao lado de "Selecione o tipo", escolha **App da Web**.
4. Confira:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
5. Clique em **Implantar**.
6. O Google pede autorização: **Autorizar acesso > escolha a sua conta**. Se aparecer "O Google não verificou este app", clique em **Avançado > Acessar (não seguro) > Permitir**.
   Esse aviso aparece em todo script pessoal. O servidor roda só na sua conta e acessa esta planilha, cria as planilhas do arquivo mensal numa pasta do seu Drive, envia os e-mails de marketing pelo seu Gmail, fala com o WhatsApp e cria um gatilho que roda a cada minuto.
7. Copie a **URL do app da Web** (começa com `https://script.google.com/macros/s/` e termina em `/exec`).

> "Qualquer pessoa" é necessário para as telas e o WhatsApp conseguirem falar com o servidor. Ninguém vê seus dados sem e-mail e senha: toda chamada passa pelo login do sistema, e os webhooks exigem uma chave secreta.

## Passo 3. Ligar o sistema

1. Abra o endereço das telas do sistema.
2. Na tela **Ligar o sistema**, cole a URL do Passo 2 e clique em **Conectar**.
3. Crie o seu acesso de administrador (nome, e-mail e senha). Na primeira vez o servidor prepara a planilha: pode levar até um minuto.
4. O assistente pede nome, logo, cores e o tipo do seu negócio. Pronto.

Nos outros computadores e celulares da equipe, o endereço é o mesmo. Cada aparelho pede a URL do servidor uma vez (ou use o link que aparece em **Ajustes > Sistema e arquivo**, que já vem com ela). No celular, use **Adicionar à tela inicial** do navegador para ter o sistema como aplicativo.

---

## Depois de ligar

- **WhatsApp:** em **Integrações**, escolha a forma de conexão. Cada uma tem tutorial dentro do sistema: Evolution API (`docs/WHATSAPP_EVOLUTION.md`), WAHA (`docs/WHATSAPP_WAHA.md`), API oficial da Meta (leia também `docs/ECONOMIA_API_OFICIAL.md`) ou modo link, que funciona sem instalar nada mas sem robôs.
- **Equipe:** em **Equipe e acessos**, crie uma conta para cada pessoa. O sistema monta a mensagem com o endereço, o e-mail e a senha. Como funciona SDR e closer: `docs/EQUIPE_COMERCIAL.md`.
- **Sua marca:** em **Ajustes > Marca e cores** você troca nome, logo, cores e os textos da tela de entrada quando quiser.
- **Integrações com outros sistemas:** webhooks de saída (avisam n8n, Make, Zapier e afins sobre eventos), chave de API para outros sistemas enviarem dados, Hotmart, Kiwify, ActiveCampaign, Mercado Pago, formulários e anúncios: `docs/INTEGRACOES.md`.
- **Arquivo mensal** (`docs/ARQUIVO_MENSAL.md`), **e-mail marketing** (`docs/EMAIL_MARKETING.md`), **financeiro** (`docs/FINANCEIRO.md`) e **chat do site** (`docs/CHAT_DO_SITE.md`).
- **Suporte:** cole o código de suporte da compra em **Ajustes > Sistema** (`docs/SUPORTE_E_ATUALIZACOES.md`).

## Atualizar para uma versão nova

1. Na planilha: **Extensões > Apps Script**. Apague o código do arquivo `Codigo.gs` e cole o novo.
2. **Implantar > Gerenciar implantações > lápis (Editar) > Versão: Nova versão > Implantar**. A URL `/exec` continua a mesma.
3. Se o Google pedir uma permissão nova, autorize.

As abas e colunas novas são criadas sozinhas na primeira vez que o sistema abrir. Seus dados não são apagados. As telas hospedadas já ficam na versão nova; se você publica as telas no seu GitHub, suba os arquivos novos da pasta `site` (sem sobrescrever o seu `config.js`).

---

## Opcional: publicar as telas no seu próprio GitHub Pages

Para quem quer ter tudo consigo, inclusive as telas. Precisa de uma conta gratuita no GitHub. O pacote ZIP traz:

```
site/               as telas do sistema (vão para o GitHub)
planilha/Codigo.gs  o código do servidor (o mesmo que já vem na planilha modelo)
docs/               este guia e os tutoriais
```

1. Faça os Passos 1 e 2 acima normalmente.
2. Em [github.com](https://github.com): **+ > New repository**. Nome curto (ex.: `crm`), marque **Public** (o Pages gratuito só publica repositórios públicos; o repositório tem só as telas, nenhum dado e nenhuma senha) e **Create repository**.
3. Clique em **uploading an existing file**, arraste **tudo o que está dentro** da pasta `site` (não a pasta em si) e clique em **Commit changes**. O `index.html` precisa aparecer direto na lista de arquivos.
4. **Settings > Pages > Source: Deploy from a branch > Branch: main, pasta / (root) > Save**. Em 1 ou 2 minutos aparece o endereço, por exemplo `https://seu-usuario.github.io/crm/`.
5. (Opcional) Para ninguém precisar colar a URL do servidor: no repositório, abra `config.js`, clique no lápis e cole a URL do Passo 2 entre as aspas de `API_URL`. **Commit changes**.
6. Abra o seu endereço e siga o Passo 3.

## Problemas comuns

| Sintoma | Solução |
|---|---|
| "O servidor respondeu algo inesperado" | A implantação não está como "Qualquer pessoa", ou você copiou o endereço do editor em vez da URL do app da Web. Em Implantar > Gerenciar implantações, confira e copie a URL que termina em `/exec`. |
| "Este sistema já foi ligado" | O servidor já tem administrador. Entre com o e-mail e a senha. Esqueceu? Veja a linha abaixo. |
| Esqueci a senha do administrador | Na planilha, menu **Sistema > Criar nova senha do administrador**. A senha nova aparece na tela. Troque depois em Equipe e acessos. |
| Integrações mostra "o servidor ainda não sabe o próprio endereço" | Desconecte em "Trocar servidor" e conecte de novo colando a URL `/exec`. |
| Disparos e robôs não saem | Confira o horário em Ajustes > Regras de envio. No Apps Script, em **Acionadores** (ícone de relógio), precisa existir o gatilho `trabalhar`. Se não existir, selecione a função **instalarGatilho** e clique em **Executar**. |
| O site do GitHub mostra erro 404 | O `index.html` ficou dentro de uma pasta. Ele precisa estar na raiz do repositório. |
| Erros de webhook | A planilha ganha uma aba **Erros** com o que chegou e o motivo. |

## Limites do plano gratuito do Google

Contas Gmail comuns têm cotas diárias no Apps Script (por exemplo, 20 mil chamadas externas por dia e 90 minutos por dia de gatilhos). Para uma pequena empresa isso cobre com folga milhares de mensagens por dia. O gatilho de 1 minuto só trabalha quando há algo na fila. Contas Google Workspace têm cotas maiores.
