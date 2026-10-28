# Instalação do Prumo CRM

Tempo: cerca de 20 minutos. Custo: zero. Você precisa de uma conta Google (pode ser Gmail comum) e de uma conta no GitHub (gratuita).

O sistema tem duas partes, e as duas ficam nas **suas** contas:

| Parte | Onde fica | Para que serve |
|---|---|---|
| Servidor e dados | Uma planilha Google com um script (Apps Script) | Guarda contatos, conversas e negócios. Recebe as mensagens do WhatsApp. Envia disparos e roda os robôs. |
| Telas do sistema | Um site gratuito no GitHub Pages | O que a equipe abre no computador ou no celular. |

Conteúdo do pacote:

```
site/               arquivos do site (vão para o GitHub)
planilha/Codigo.gs  código do servidor (vai para o Apps Script da planilha)
docs/               este guia e os tutoriais de WhatsApp e integrações
```

---

# Parte 1. Planilha e servidor

## Passo 1. Ter a planilha com o script

**Recebeu o link da planilha pronta?** Abra o link, clique em **Fazer uma cópia** e vá para o Passo 2. O script já vem dentro.

Montando do zero:

1. Acesse [sheets.new](https://sheets.new) para criar uma planilha em branco. Dê o nome que quiser.
2. No menu: **Extensões > Apps Script**.
3. Apague o código que aparece e cole todo o conteúdo do arquivo `planilha/Codigo.gs`.
4. Clique no ícone de disquete (Salvar).

## Passo 2. Definir o primeiro acesso

Na planilha: **Extensões > Apps Script**. No topo do código, troque o e-mail e a senha do administrador:

```js
var ADMIN_INICIAL = {
  nome: 'Seu nome',
  email: 'voce@suaempresa.com.br',
  senha: 'uma-senha-forte-aqui'
};
```

Salve.

## Passo 3. Instalar

1. No menu de cima do editor, escolha a função **instalar** e clique em **Executar**.
2. O Google pede autorização: **Revisar permissões > escolha sua conta > Avançado > Acessar (não seguro) > Permitir**.
   Esse aviso aparece em todo script pessoal. O script acessa esta planilha, cria as planilhas do arquivo mensal numa pasta do seu Drive, envia mensagens para os endereços que você configurar e cria um gatilho que roda a cada minuto.
3. Espere aparecer "Pronto!" no registro de execução. As abas da planilha serão criadas.

## Passo 4. Publicar o servidor

1. Clique em **Implantar > Nova implantação**.
2. Na engrenagem, escolha **App da Web**.
3. Preencha:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
4. Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`). Guarde essa URL.

> "Qualquer pessoa" é necessário para o site e o WhatsApp conseguirem falar com o servidor. Ninguém vê seus dados sem login e senha: toda chamada passa pela autenticação do sistema, e os webhooks exigem uma chave secreta.

---

# Parte 2. Site no GitHub Pages

## Passo 5. Criar o repositório

1. Entre em [github.com](https://github.com) (crie a conta se ainda não tiver).
2. No canto superior direito: **+ > New repository**.
3. Em **Repository name**, escreva um nome curto, por exemplo `crm`.
4. Marque **Public**. O plano gratuito do GitHub só publica sites de repositórios públicos. Isso é seguro: o repositório tem só as telas, nenhum dado da empresa e nenhuma senha.
5. Clique em **Create repository**.

## Passo 6. Enviar os arquivos

1. Na página do repositório novo, clique no link **uploading an existing file**.
2. Abra a pasta `site` do pacote no seu computador, selecione **tudo o que está dentro dela** (não a pasta em si) e arraste para a página.
3. Espere terminar o envio e clique em **Commit changes**.

Confira: na lista de arquivos do repositório precisa aparecer o `index.html` direto, sem estar dentro de outra pasta.

## Passo 7. Ligar o GitHub Pages

1. No repositório: **Settings > Pages**.
2. Em **Source**, escolha **Deploy from a branch**.
3. Em **Branch**, escolha **main** e a pasta **/ (root)**. Clique em **Save**.
4. Espere 1 ou 2 minutos e atualize a página. Aparece o endereço do seu sistema, por exemplo:
   `https://seu-usuario.github.io/crm/`

## Passo 8 (opcional). Deixar o servidor gravado no site

Assim ninguém da equipe precisa colar a URL na primeira vez:

1. No repositório, clique no arquivo `config.js` e depois no lápis (Edit).
2. Cole a URL do Passo 4 entre as aspas de `API_URL`:
   ```js
   window.PRUMO = {
     API_URL: 'https://script.google.com/macros/s/.../exec'
   };
   ```
3. **Commit changes**. O site atualiza em cerca de 1 minuto.

---

# Parte 3. Primeiro acesso

## Passo 9. Abrir o sistema

1. Abra o endereço do Passo 7.
2. Se pular o Passo 8, cole a URL `/exec` na tela **Vamos ligar o seu sistema** e clique em **Conectar**.
3. Entre com o e-mail e a senha do Passo 2.
4. O assistente pede nome, logo, cores e o tipo de negócio. Pronto.

Para abrir em outro computador, use o link que aparece em **Ajustes > Sistema**. No celular, use a opção **Adicionar à tela inicial** do navegador para ter o sistema como aplicativo.

## Passo 10. Conectar o WhatsApp

Vá em **Integrações** e escolha uma opção. Cada uma tem tutorial dentro do sistema:

- **Evolution API** (gratuita, precisa de servidor próprio): `docs/WHATSAPP_EVOLUTION.md`
- **WAHA** (gratuito, precisa de servidor próprio): `docs/WHATSAPP_WAHA.md`
- **API oficial da Meta**: tutorial dentro do sistema
- **Modo link**: funciona sem instalar nada, mas sem robôs e sem receber mensagens

Para receber leads do site, formulários, Hotmart, Kiwify, ActiveCampaign, anúncios e Instagram: `docs/INTEGRACOES.md`. Usando a API oficial da Meta, leia também `docs/ECONOMIA_API_OFICIAL.md`.

## Passo 11. Criar as contas da equipe

Em **Equipe e acessos** (só o administrador vê), crie uma conta para cada pessoa: SDRs, closers e gestores. O sistema mostra a mensagem pronta com o endereço, o e-mail e a senha para você enviar. Como a passagem de leads entre SDR e closer funciona: `docs/EQUIPE_COMERCIAL.md`.

## Arquivo mensal

Todo mês os dados fechados do mês anterior vão para uma planilha própria no seu Google Drive, e a planilha principal fica leve. Detalhes: `docs/ARQUIVO_MENSAL.md`.

---

## Atualizar para uma versão nova

**Servidor:** Apps Script > cole o `Codigo.gs` novo por cima (mantenha o seu `ADMIN_INICIAL`) > **Implantar > Gerenciar implantações > lápis > Versão: Nova versão > Implantar**. A URL `/exec` continua a mesma. Rode **instalar** de novo se a versão pedir (ele só cria o que falta, não apaga dados).

**Site:** no GitHub, envie os arquivos novos da pasta `site` do mesmo jeito do Passo 6. Se você editou o `config.js`, não envie o `config.js` novo por cima.

**Da versão 1.0 para a 1.1:** depois de colar o `Codigo.gs` novo, rode **instalar** de novo. Ele cria as colunas e a aba novas (Arquivos) e pede uma permissão a mais do Google, para criar as planilhas do arquivo mensal no seu Drive. Aceite e publique a nova versão. Se você já tem meses de uso, em Ajustes > Sistema e arquivo clique em **Arquivar meses anteriores agora** fora do horário de atendimento.

## Problemas comuns

| Sintoma | Solução |
|---|---|
| "O servidor respondeu algo inesperado" | A implantação não está como "Qualquer pessoa", ou a URL não termina em `/exec`. |
| O site do GitHub mostra erro 404 | O `index.html` ficou dentro de uma pasta. Ele precisa estar na raiz do repositório (Passo 6). |
| Esqueci a senha do administrador | No Apps Script, troque a senha em `ADMIN_INICIAL` e execute **redefinirSenhaAdmin**. |
| Integrações mostra "o servidor ainda não sabe o próprio endereço" | Em `definirUrlDoApp`, cole a URL `/exec` e execute a função. |
| Disparos não saem | Confira o horário em Ajustes > Regras de envio, e em Apps Script > Acionadores se existe o gatilho `trabalhar` (rode **instalarGatilho** se não existir). |
| Erros de webhook | A planilha ganha uma aba **Erros** com o que chegou e o motivo. |

## Limites do plano gratuito do Google

Contas Gmail comuns têm cotas diárias no Apps Script (por exemplo, 20 mil chamadas externas por dia e 90 minutos por dia de gatilhos). Para uma pequena empresa isso cobre com folga milhares de mensagens por dia. O gatilho de 1 minuto só trabalha quando há algo na fila. Contas Google Workspace têm cotas maiores.
