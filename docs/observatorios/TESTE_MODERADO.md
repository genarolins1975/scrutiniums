# Teste moderado com pessoas: protocolo da Onda 2

Item da Onda 2 do roadmap (`docs/BANCA_2026-10-19.md`): "Teste moderado com 8 pessoas: 3 clientes de banco endividados, 2 jornalistas, 2 servidores e 1 pesquisador. Critério de aceite: taxa de conclusão de 5 tarefas por persona; achados priorizados e publicados."

Este documento é o roteiro pronto para aplicar. O teste ainda não foi feito: recrutamento, compensação e gravação dependem de decisão do dono (seção "Decisões do dono", no fim).

## Objetivo

Medir se o público principal consegue responder sozinho às perguntas que a plataforma promete responder, na camada aberta e com conta, e encontrar onde a página atrapalha. O teste não avalia a pessoa nem o seu conhecimento do tema.

## Participantes

| Perfil | Quantidade | Critério de recrutamento | Exclusão |
|---|---|---|---|
| Cliente de banco com dívida em atraso ou renegociada nos últimos 12 meses | 3 | Pelo menos um com escolaridade até o ensino médio; pelo menos um que use só o celular | Quem trabalha em banco, fintech ou órgão regulador |
| Jornalista que cobre economia, energia ou contas públicas | 2 | Publicou matéria com dado oficial no último ano | Quem já usou a Scrutiniums em trabalho |
| Servidor público (municipal, estadual ou federal) | 2 | Um da área de orçamento ou controle; um de serviço público (saneamento, energia, saúde) | Servidor do BCB, da ANEEL ou da STN com acesso aos dados internos |
| Pesquisador (pós-graduação ou instituto) | 1 | Usa dados públicos em pesquisa | Quem participou do desenho da plataforma |

Metade das sessões no celular (390 px ou o aparelho da pessoa) e metade no computador. Cada perfil com pelo menos uma sessão em cada tipo de tela, quando houver duas pessoas ou mais.

## Formato

- Sessão individual de 50 minutos, remota (videochamada com compartilhamento de tela) ou presencial.
- Um moderador e um observador que anota. O moderador não ajuda a encontrar nada; responde "o que você faria se estivesse sozinho?".
- Pensar em voz alta. Ambiente de produção (`https://scrutiniums.com`), com uma conta de teste criada na hora pela própria pessoa na tarefa de cadastro, ou com conta preparada quando a tarefa pede sessão antes do cadastro.
- Sem tarefa de aquecimento que ensine a navegação.

## Roteiro da sessão

1. Abertura (5 min): apresentação, termo de consentimento (abaixo), explicação de que se testa a plataforma, não a pessoa.
2. Primeira impressão (3 min): a pessoa abre a home e diz, sem clicar, o que acha que dá para fazer ali.
3. Tarefas (35 min): as cinco do perfil, na ordem. Limite de 6 minutos por tarefa; passado o limite, a tarefa conta como não concluída e se segue para a próxima.
4. Encerramento (7 min): três perguntas abertas: o que foi mais difícil; em que confiaria para tomar uma decisão; o que faltou.

## Tarefas por perfil

Cada tarefa tem a pergunta dita à pessoa, o destino esperado e o critério de conclusão. A resposta certa é conferida no dia do teste contra o dado publicado, com a data de referência anotada.

### Cliente de banco endividado

| Nº | Pergunta à pessoa | Destino esperado | Concluída quando |
|---|---|---|---|
| C1 | "Quanto o seu banco cobra de juros no crédito pessoal? E os outros bancos?" | `/observatorio-do-credito/quanto-meu-banco-cobra` | Diz a taxa do banco e a compara com a mediana, e reconhece que taxa não é o custo total |
| C2 | "Se você pegasse R$ 5.000 em 24 meses, quanto pagaria por mês e no total?" | `/observatorio-do-credito/simulador-da-parcela` | Diz a parcela e o total, e de onde veio a taxa usada |
| C3 | "Quanto custa a conta de luz de quem gasta 150 kWh na sua cidade?" | `/setor-eletrico/conta-de-luz` | Diz o valor estimado e a bandeira considerada |
| C4 | "A sua cidade tem coleta de esgoto? Para quantas pessoas?" | `/saneamento/municipio/[id]` | Diz o percentual atendido e o ano |
| C5 | "Crie uma conta e volte para a página em que estava." | Cadastro com `?de=` | Conta criada e retorno à página de origem |

### Jornalista

| Nº | Pergunta à pessoa | Destino esperado | Concluída quando |
|---|---|---|---|
| J1 | "Quanto custou a energia no mercado de curto prazo no último dia publicado? Qual a data?" | `/setor-eletrico/pld` | Diz o PLD médio, o submercado e a data de referência |
| J2 | "Compare duas capitais nos resultados da Eficiência Estatal." | `/eficiencia-estatal` e `/eficiencia-estatal/indice-de-resultados` | Diz as posições e o ano de cada indicador |
| J3 | "Os dados do Setor Elétrico estão em dia? Desde quando?" | Linha "Atualização dos dados" da entrada | Diz a data de referência e se há atraso |
| J4 | "Baixe a série que você usaria numa matéria e diga a fonte." | Página "Dados" do observatório | Arquivo baixado e fonte original nomeada |
| J5 | "Como você citaria esta página na matéria?" | Botão "Citar" | Copia a referência com data de acesso e fonte |

### Servidor público

| Nº | Pergunta à pessoa | Destino esperado | Concluída quando |
|---|---|---|---|
| S1 | "Quanto do orçamento federal deste ano já foi pago?" | `/contas-publicas` (Execução) | Diz o valor ou o percentual e o mês de referência |
| S2 | "Como está a despesa com pessoal do seu estado em relação ao limite?" | `/contas-publicas-estaduais` | Diz o percentual, o limite e o quadrimestre |
| S3 | "Quem presta o serviço de água no seu município e qual a tarifa?" | Ficha do município e simulador do Saneamento | Diz o prestador e a tarifa com a data da tabela |
| S4 | "Guarde esta comparação para mandar a um colega." | Botão "Salvar recorte" e "Meus recortes" | Recorte salvo e link copiado |
| S5 | "Como esse indicador é calculado?" | Método recolhido no fim da página | Encontra a fórmula ou a ficha do indicador |

### Pesquisador

| Nº | Pergunta à pessoa | Destino esperado | Concluída quando |
|---|---|---|---|
| P1 | "Encontre os arquivos e o manifesto para reproduzir os números do Setor Elétrico." | `/setor-eletrico/dados/reproducao` | Encontra o manifesto e o identificador da publicação |
| P2 | "Baixe a série horária completa do PLD." | `/setor-eletrico/dados` | Arquivo baixado com dicionário de colunas |
| P3 | "O que os modelos de previsão do PLD conseguem prever e quais os limites?" | `/setor-eletrico/pld/previsoes` | Explica o estado dos modelos (pesquisa, referência experimental) |
| P4 | "Peça para ser avisado quando os dados do Saneamento forem atualizados." | Botão "Avisar quando atualizar" | Assinatura feita e visível na conta |
| P5 | "Gere a referência em BibTeX." | Botão "Citar" | Arquivo .bib baixado |

Os destinos das tarefas C1, C2, J5, S4, P4 e P5 dependem das entregas da Onda 2. Se algum não estiver no ar na data do teste, a tarefa sai do roteiro e o relatório registra a troca; não se testa funcionalidade inexistente.

## O que medir

| Medida | Como | Registro |
|---|---|---|
| Conclusão | Concluída, concluída com ajuda do moderador ou não concluída | Por tarefa |
| Tempo | Do fim da leitura da pergunta até a resposta | Em segundos, por tarefa |
| Caminho | Páginas visitadas, na ordem | Por tarefa |
| Erros | Clique em destino errado, retorno, busca sem resultado | Contagem e descrição |
| Confiança | "De 1 a 5, quanto você confia nessa resposta?" | Por tarefa |
| Compreensão do dado | Repete com as próprias palavras a unidade, o período e a fonte | Sim, parcial, não |

Critério de aceite da banca: taxa de conclusão sem ajuda por perfil e por tarefa. Meta proposta, a confirmar com o dono: 80% das tarefas concluídas sem ajuda em cada perfil; nenhuma tarefa com conclusão abaixo de 50% fica sem achado priorizado.

## Classificação dos achados

| Gravidade | Definição | Prazo proposto |
|---|---|---|
| Crítica | Impede a tarefa ou leva a uma resposta errada com confiança alta | Correção antes do fim da Onda 2 |
| Alta | Impede a tarefa para parte das pessoas ou exige ajuda | Correção na Onda 3 |
| Média | Atrasa ou confunde, mas a pessoa conclui | Fila da Onda 3 |
| Baixa | Preferência ou acabamento | Registro |

Cada achado entra com: tarefa, perfil, quantas pessoas, evidência (trecho da fala ou do caminho), página e proposta. Os achados são publicados num relatório em `docs/observatorios/TESTE_MODERADO_RESULTADO.md`, sem nome, rosto ou voz das pessoas.

## Termo de consentimento (texto proposto)

> Você está participando de um teste da plataforma Scrutiniums. O objetivo é saber se as páginas são fáceis de usar; quem está sendo avaliada é a plataforma, não você. A sessão dura cerca de 50 minutos. Vamos pedir que você realize algumas tarefas e diga em voz alta o que está pensando.
>
> Com a sua autorização, a tela e a voz serão gravadas só para a equipe revisar as anotações. A gravação será apagada em até 30 dias depois do relatório, e nenhum trecho será publicado. O relatório usa só anotações sem o seu nome.
>
> Se você criar uma conta durante o teste, ela poderá ser apagada a seu pedido ao final da sessão. Você pode parar a qualquer momento, sem precisar explicar o motivo.
>
> Base legal: consentimento (Lei nº 13.709/2018, art. 7º, I). Responsável: [nome do controlador]. Contato para dúvidas e para pedir a exclusão: [e-mail].
>
> ( ) Autorizo a gravação de tela e voz. ( ) Participo sem gravação.

## Ficha do observador

| Campo | Exemplo |
|---|---|
| Sessão | 03 |
| Perfil | Cliente de banco |
| Tela | Celular, 390 px |
| Tarefa | C2 |
| Resultado | Concluída sem ajuda |
| Tempo | 142 s |
| Caminho | Home → Crédito → Simulador |
| Erros | Abriu "Juros" na aplicação do Crédito antes de achar o simulador |
| Confiança | 4 |
| Compreensão | Parcial: não citou a data da taxa |
| Citação | "Esse número é do meu banco ou de todos?" |

Os valores do exemplo são ilustrativos e não vêm de nenhuma sessão.

## Decisões do dono

1. Recrutamento: canal (rede própria, painel pago, associação de jornalistas, escola de governo) e prazo.
2. Compensação por sessão: valor e forma, ou nenhuma.
3. Gravação: permitida com consentimento ou só anotações.
4. Moderador: interno ou externo. Um moderador externo reduz o viés de quem construiu a plataforma.
5. Meta de conclusão: confirmar os 80% propostos.
6. Controlador e contato que aparecem no termo de consentimento.
