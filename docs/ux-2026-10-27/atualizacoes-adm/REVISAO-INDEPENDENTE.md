# Parecer independente final — atualização e tarefas do ADM

**Veredito: SHIP no escopo revisado.** Não identifiquei defeito bloqueante pendente nas áreas alteradas. Os dois P2 funcionais e o P2 visual reportados anteriormente foram corrigidos e reconferidos. Os dois P3 de apresentação também foram resolvidos. Este parecer não autoriza publicação, merge ou alteração de acessos; não representa homologação humana nem conformidade WCAG integral.

Revisão em **27/10/2026**, sobre o build local **`mXMizLsighsc8Sf0SmbFi`**, branch `feat/atualizacoes-adm`, comparada com `origin/main`. Revisão executada por agente separado do implementador, com inspeção do código, das capturas e uma jornada própria em conta e banco descartáveis. Nenhum código do repositório foi alterado pelo revisor; não foi iniciado build nem suíte global.

## Escopo e evidências

- `/app/admin`: resumo novo de atualização, acesso ao quadro e correções localizadas de contraste/foco. Não atribuo aprovação integral ao painel administrativo legado.
- `/app/admin/atualizacoes`: quadro das 13 áreas, distinção entre publicação/referência/execução, filtro, detalhes de automação e fila de tarefas.
- Capturas finais: `depois`, com primeiras telas a 320, 390, 768 e 1440 px, com e sem sessão. Inspecionei a abertura nas quatro larguras, o quadro completo a 390 e 1440 px e os formulários capturados nas quatro larguras.
- Comparação visual: `antes/quadro-rodada-inicial-320.jpg`, build anterior `zV4ZVR8ZkaYZCegyuGPiE`.
- Relatório automatizado do implementador: `depois/evidencias.json`; registra axe sem violações e ausência de rolagem horizontal nas duas rotas e quatro larguras. É evidência automatizada complementar.
- Jornada completa do implementador: `jornadas/jornadas.json`, com 11 verificações. Inclui erro 503 com preservação de texto, foco por teclado, texto ampliado e conta comum recusada com 404.
- **Jornada independente efetivamente executada:** `revisao-independente/jornada.json`, iniciada em `2026-10-27T10:14:57Z` e aprovada em `2026-10-27T10:15:12Z`. Capturas próprias: `tarefa-320.png` e `tarefa-1440.png` na mesma pasta.
- As telas usam conta sintética e consulta de monitor preservada para auditoria; não comprovam estado atual de produção nem execução do novo workflow em produção.

## Resolução dos achados

| Before | After | Evidência e conclusão |
| --- | --- | --- |
| **P2 funcional:** datas sem horário eram convertidas para o dia anterior em Brasília | `dataOperacional` preserva a precisão da data simples e normaliza instantes pelo contrato comum | Agronegócio mostra 17/10/2026; Contas estaduais, 12/10/2026. Reprodução isolada reconferiu também fuso diferente no ambiente. Resolvido. |
| **P2 funcional:** nova tentativa do mesmo run herdava tarefa concluída | Collector preserva tentativa e início da tentativa; tarefa usa execução + tentativa e link de evidência próprio | Reprodução das funções reais confirmou nova tentativa aberta e tentativa anterior preservada no histórico. Quatro testes Python isolados aprovados na reconferência anterior. Resolvido. |
| **P2 visual:** primeira tela móvel inteira sem área ou situação do quadro | Abertura mais curta, resumo factual de 2/13 áreas e navegação compacta | Crédito e sua situação cabem na primeira tela de 320×800; a 390×844 também aparecem as datas. Confirmado por captura e navegador independente. Resolvido. |
| **P3 visual:** responsável e prazo escondidos na tarefa recolhida | Resumo da tarefa mostra os campos preenchidos | Jornada própria criou responsável e prazo, recarregou e conferiu ambos no summary. Resolvido. |
| **P3 visual:** Energia repetia datas que pareciam iguais | Parte mais recente aparece apenas quando o texto formatado difere | Captura final mostra uma única data para Energia; a distinção continua visível quando relevante, como em Crédito e Conectividade. Resolvido. |
| Foco das tabelas e contraste do funil geravam violações automatizadas no ADM | Regiões de tabela receberam nome e foco; bronze escurecido nos elementos apontados | Diff localizado e relatório final sem aquelas violações. Não equivale a auditoria completa do ADM legado. |

A distinção entre publicação, referência e resultado da rotina continua clara nas colunas e nos estados móveis. A aprovação de uma tarefa não altera as datas publicadas. Avisos de monitor indisponível/parcial permanecem no código, e notas privadas continuam restritas ao banco e às respostas administrativas.

## Jornada independente

Executei pelo servidor local do projeto, Chromium e conta descartável:

1. Abrir `/app/admin`, acionar o link do novo resumo e chegar ao quadro; Crédito aparece antes de 800 px a 320 px de largura.
2. Abrir a criação por teclado, criar tarefa com nota, responsável e prazo, recarregar e conferir os valores persistidos e os metadados no resumo.
3. Concluir a tarefa, verificar seu desaparecimento de Pendentes e o foco devolvido ao filtro; localizar em Concluídas e reabrir.
4. Aplicar `situacao=atencao`, voltar, avançar e recarregar. A seleção permaneceu e o quadro mostrou exatamente as duas áreas correspondentes à fixture utilizada.
5. Conferir ausência de rolagem horizontal a 320 px e ausência de erros JavaScript durante essa jornada.
6. Enviar POST autenticado com Origin externo: resposta 403. Acessar a página sem sessão: redirecionamento 307 para login.

A repetição própria usou `domcontentloaded` e controles visíveis, sem `networkidle`. Não reproduzi falha funcional do filtro ou histórico. O timeout de `networkidle` da rodada anterior do implementador é compatível com instabilidade da espera do driver; a repetição integral dele e a jornada própria passaram. Não concluo que toda possibilidade de lentidão esteja eliminada.

## Rubrica por rota, limitada ao escopo alterado

Notas para o estado observado, sem média compensatória. 9 significa execução excelente demonstrada no recorte; 10 não foi atribuído.

| Critério | `/app/admin`, bloco novo e correções localizadas | `/app/admin/atualizacoes` | Evidência / limite |
| --- | ---: | ---: | --- |
| Direção de arte | 9 | 9 | Tipografia, papel, links e controles coerentes com a plataforma; sem decoração concorrente. |
| Hierarquia | 9 | 9 | Resumo e destino visíveis no ADM; situação operacional já na abertura da página nova. |
| Tipografia e acabamento | 9 | 9 | Valores e rótulos legíveis; alinhamento desktop e quebras móveis sem sobreposição observada. |
| Densidade e profundidade | 8 | 9 | No ADM, ainda há dois filetes próximos e respiro redundante entre o cabeçalho existente e o resumo novo; é acabamento não bloqueante. Na página nova, conteúdo das 13 áreas preservado, detalhes recolhidos e acesso direto à fila. |
| Didática visual | 9 | 9 | Datas de publicação e referência separadas; estado da rotina e encaminhamento não são apresentados como publicação realizada. |
| Comparabilidade | 9 | 9 | Mesma regra de frescor, datas corretas, ausências explícitas e nenhum verde de rotina usado para atualizar a data publicada. |
| Interação e acessibilidade | 9 | 9 | Navegação e jornada essencial verificadas; foco após conclusão, teclado, mensagens e relatórios axe complementares. Sem teste de leitor de tela ou homologação humana. |
| Responsividade | 9 | 9 | Capturas a 320/390/768/1440 e controles preenchidos; sem corte ou alargamento observado. Ampliação de texto consta da jornada do implementador, não de uma execução independente de zoom nativo. |

## Limites remanescentes

- Parecer restrito ao build local identificado. Não verifiquei deploy, monitor publicado no GitHub, credenciais de produção ou comportamento no Postgres de produção nesta rodada.
- Não executei leitores de tela, navegação em dispositivos físicos, Safari/Firefox ou uma auditoria WCAG completa. O input nativo de data pode apresentar a ordem de dia/mês conforme o idioma do navegador; as datas de resumo usam o formato brasileiro conferido.
- Os relatórios de axe e de jornadas do implementador são identificados como tais; a jornada própria está separada. Não atribuo à revisão independente verificações que apenas li nesses relatórios.
- O detalhe de espaçamento do resumo no ADM permanece como melhoria opcional de acabamento, sem impedir leitura ou acesso. Não recomendo outra rodada cosmética para esta entrega.
- A revisão de autorização, CSRF, atualização otimista e gates não encontrou bypass concreto. Isso não substitui auditoria de segurança integral, e o parecer não faz afirmação sobre CI ou testes globais ainda executados pelo implementador.

**Conclusão:** escopo alterado apto a seguir o fluxo de revisão e entrega autorizado pelo dono, sem correção bloqueante adicional identificada por este revisor.
