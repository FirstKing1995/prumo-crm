# Arquivo mensal no Google Drive

Uma planilha do Google aceita até 10 milhões de células. Para o sistema nunca chegar perto disso, os dados já fechados vão, todo mês, para uma planilha própria no **seu** Google Drive.

## Como funciona

- Na virada do mês, de madrugada, o sistema cria a planilha **"Nome do sistema - Arquivo AAAA-MM (Mês Ano)"**, por exemplo "Studio Aurora - Arquivo 2026-10 (Outubro 2026)", dentro da pasta **"Nome do sistema - Arquivos"**.
- Vão para essa planilha: mensagens, histórico, envios de disparos já feitos, execuções de robôs encerradas, tarefas concluídas e negócios ganhos ou perdidos daquele mês.
- Ficam na planilha principal: todos os contatos, negócios em aberto, tarefas pendentes, automações, configurações e tudo do mês atual.
- O trabalho é feito aos poucos, a cada minuto, para não travar o atendimento. Se parar no meio, continua na rodada seguinte sem duplicar nada.

## Consultar dados antigos

- **Conversa:** botão **Ver meses anteriores** no topo das mensagens.
- **Ficha do contato:** aba Histórico > **Ver meses anteriores** (histórico e negócios fechados).
- **Relatórios:** períodos que incluem meses arquivados carregam as planilhas do arquivo sozinhos.
- **Direto no Drive:** em Ajustes > Sistema e arquivo, cada mês tem o botão **Abrir planilha**.

## Configurar

Em **Ajustes > Sistema e arquivo**:

- **Arquivar sozinho na virada do mês:** ligado por padrão.
- **Arquivar meses anteriores agora:** adianta o trabalho (útil na primeira atualização para a versão 1.1, se você já tem meses de dados). Pode levar alguns minutos.

No editor do Apps Script também existe a função **arquivarAgora**, que faz o mesmo.

## Permissão do Google

Na primeira vez, o Google pede autorização para o script criar planilhas no seu Drive. Rode a função **instalar** de novo depois de atualizar o código e aceite a permissão. As planilhas ficam só na sua conta: ninguém mais tem acesso.

Não apague nem renomeie a aba de um mês arquivado. Se apagar uma planilha do arquivo, os dados daquele mês somem do sistema.
