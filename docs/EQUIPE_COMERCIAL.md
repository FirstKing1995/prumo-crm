# Equipe comercial: administrador, SDR e closer

## Perfis

| Perfil | O que faz | O que vê |
|---|---|---|
| Administrador | Cria as contas da equipe, define metas, configura integrações, marca e regras | Tudo |
| Gestor | Acompanha a operação, faz disparos, automações e relatórios | Tudo, menos Equipe, Integrações e Ajustes |
| SDR | Atende os leads novos, qualifica e passa os prontos para um closer | Leads sem dono, os seus e os que ele passou |
| Closer | Recebe os leads qualificados e fecha a venda | Só os contatos e negócios dele |
| Personalizado | O que o administrador liberar: ver todos os contatos, disparos e e-mail, automações, relatórios, financeiro, integrações, ajustes, excluir, equipe | Depende do que foi liberado |

Para o perfil personalizado há atalhos prontos: **Gestor de tráfego** (todos os contatos, relatórios e integrações, para acompanhar origens e anúncios), **Marketing** (todos os contatos, disparos, e-mail, automações e relatórios), **Financeiro** (todos os contatos, financeiro e relatórios) e **Suporte e atendimento** (fila de leads e todos os contatos).

## Tarefas de cada pessoa

Cada pessoa vê as próprias tarefas na tela Tarefas e no Painel. Quem tem acesso a todos os contatos pode escolher de quem ver as tarefas, ou a equipe inteira.

Contas criadas antes da versão 1.1 com o perfil "Atendente" continuam funcionando como SDR.

## Criar as contas

Só o administrador vê o menu **Equipe e acessos**.

1. Clique em **Criar conta** (ou no botão do perfil desejado).
2. Preencha nome e e-mail, escolha o perfil e a meta do mês (valor vendido para closer, reuniões marcadas para SDR).
3. O sistema sugere uma senha. Ao salvar, aparece a mensagem pronta com endereço, e-mail e senha para você copiar e mandar para a pessoa.
4. Marque **Recebe leads no rodízio** para quem deve receber leads automaticamente.

Para bloquear alguém que saiu da empresa, abra a conta e desmarque **Acesso liberado**. O histórico continua no sistema.

## Como o lead anda

1. **Lead novo chega** (WhatsApp, Instagram, formulário, anúncio). Com **Ajustes > Regras > Distribuir novos contatos em rodízio** ligado, ele vai para o SDR com menos leads em aberto. Sem rodízio, fica na fila sem dono, que todos os SDRs veem.
2. **SDR qualifica** na conversa. Os robôs podem ajudar: o passo **Pontuar lead** soma pontos pelas respostas e o passo **Passar para closer** entrega sozinho quem atingiu a pontuação (veja o modelo "Qualificação e passagem para closer" em Automações).
3. **SDR passa para o closer** pelo botão **Passar** na conversa ou **Passar para closer** na ficha. Escolhe o closer ou deixa no rodízio, marca a reunião (opcional) e escreve o resumo da qualificação.
4. **O closer recebe** o contato e o negócio, uma tarefa (ou a reunião na agenda) e o resumo no histórico. O SDR continua vendo o lead para acompanhar.
5. **Lembrete automático:** o lead recebe uma mensagem algumas horas antes da reunião (Ajustes > Regras > Equipe comercial). Na API oficial da Meta, cadastre um modelo de utilidade para o lembrete, porque a janela de 24h costuma estar fechada.
6. **Depois da reunião**, o closer marca se aconteceu, se a pessoa faltou ou remarca. Remarcar manda um lembrete novo.

## Metas e relatórios

- No **Painel**, cada pessoa vê a própria meta do mês e as próximas reuniões.
- Em **Relatórios**, a tabela de SDRs mostra leads passados, reuniões marcadas, realizadas e faltas. A tabela de closers mostra leads recebidos, vendas, valor, conversão e o andamento da meta.

## Tempo de resposta

Em **Ajustes > Regras**, defina em quantos minutos um lead deve ser respondido. Conversas que passarem desse tempo ficam em vermelho na caixa de entrada e aparecem em destaque no painel.
