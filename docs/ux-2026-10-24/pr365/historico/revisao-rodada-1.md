# Parecer independente provisório — PR #365

Revisor separado da implementação; nenhuma edição no checkout. Build examinado: `flnjhzmx0hqyM9lsdCCmm`, em `/workspace/scrutiniums-pr365-final`. Parecer ainda não encerra a homologação: falta corrigir a quebra das setas do índice móvel e inspecionar novas capturas do build correspondente. A suíte oficial e a consolidação de navegação pertencem ao relatório técnico do implementador.

## Conclusão desta rodada

A hierarquia melhorou de forma demonstrável. Nas contas recorrentes, o H1 passou de y=633 para134px em390, e de479 para183px em1440. Conta nova mantém134/183px. O índice dos seis observatórios agora aparece na primeira tela nas quatro configurações; o usuário deixa de precisar atravessar recomendações para localizar um tema. A continuidade permanece disponível depois da abertura. O único ajuste visual necessário identificado nesta rodada para alcançar as metas é manter a seta do índice na mesma linha flexível do rótulo em390px. Não identifiquei necessidade adicional de alteração de tipografia, didática ou hierarquia antes da próxima suíte.

## Notas desta rodada

| Dimensão | Anterior fornecida | Esta rodada | Meta | Evidência e fundamento |
|---|---:|---:|---:|---|
| Direção de arte |8|8|8|Papel, serifas nos títulos, texto de interface sem serifa, filetes e cores por observatório; tratamento editorial coerente com capturas reais de Crédito, Energia e OBEE. Sem elementos decorativos gratuitos.|
| Hierarquia visual |8|9|9|H1/busca precedem histórico também em conta recorrente; seis destinos na abertura em390/1440; títulos de observatório, coleção e metadados têm níveis distintos. Medidas de H1 e quatro capturas oficiais sustentam a nota.|
| Tipografia |7|8|8|Escala consistente; piso medido12px; títulos de resultados quebram com legibilidade; metadados em12px são pequenos mas legíveis. Não há evidência para9.|
| Densidade informacional |8|8|8|Lista editorial compacta, páginas e fontes sob expansão, índice evita percorrer toda a página. Área de histórico desktop ainda tem espaço vazio lateral devido aos três recortes; é secundária e não esconde mais a abertura.|
| Didática |7|8|8|Perguntas dos observatórios e recomendações explicam destinos; expansão lista páginas concretas; método distingue123publicadas,13parciais,4previstas e explica atualização/ausência de referência. Não se exige inventar descrições por coleção para atingir8.|
| Comparabilidade |8|8|8|As seis seções compartilham nome, pergunta, coleções, estado e atualização. Ausência de fonte única é declarada no método; não se simula atualização inexistente.|
| Interação e acessibilidade |8|9 provisório|9|Foco visível, navegação por setas/Escape, expansão por teclado, estado na URL, alvos44×44 e piso12; axe0 nos estados medidos; continuidade normal e cinco cenários de atraso confirmados. Ratificar após correção CSS/build e consolidação de navegação.|
| Responsividade |8|8|9|Sem overflow nas quatro configurações e nos estados abertos; porém setas de Serviços Públicos e Energia descem sozinhas no índice390. Exige nowrap específico e recaptura antes de9.|

As notas são avaliação profissional sustentada por evidências, não resultados calculados por axe. Não constituem garantia universal de ausência de regressões.

## Problema concreto que permanece

- Página `/app/observatorios`, índice de observatórios,390px, conta nova e recorrente.
- Evidência: `/tmp/pr365-depois/nova/app_observatorios-390-com-sessao-primeira-tela.jpg` e equivalente `volta`.
- Achado: Serviços Públicos e Energia e Infraestrutura deixam seta isolada numa linha abaixo; aumenta altura e enfraquece consistência do índice.
- Causa observada: `.alvo` aplica `flex-wrap: wrap`; `.indice a` ainda herda essa regra.
- Correção indicada: impedir quebra entre o bloco do rótulo e a seta especificamente no índice, permitindo que o texto quebre dentro de seu próprio bloco. Preservar alvo44×44 e ausência de overflow.
- Aceitação: novas capturas390 das duas contas mostram seta ao lado do texto; confirmar1440 e medidas. Até lá, responsividade permanece8 e PR pendente da meta visual.

## Evidências examinadas

Capturas oficiais antes/depois em `/tmp/pr365-antes/{nova,volta}` e `/tmp/pr365-depois/{nova,volta}`: primeiras telas e páginas inteiras390/1440. Quatro estados finais desta rodada: HTTP200, axe0, console0, nenhum login inesperado, nenhuma rolagem horizontal.

Capturas adicionais em `/tmp/pr365-depois/revisao`: `busca-foco-{390,1440}.png`, `colecao-{390,1440}.png`, `metodo-{390,1440}.png`. Inspecionadas diretamente. Busca mostra foco e resultado selecionado; método tem contorno3px `rgb(0,105,127)` sobre papel `rgb(250,248,242)`; lista expandida mantém texto legível e linhas de toque. JSON `detalhes.json` confirma sem overflow nas duas larguras.

Medições do implementador inspecionadas em `/tmp/pr365-depois/funcional/resultado.json`:390/1440, lista de alvos menores vazia, piso12px, axe0, nenhuma rolagem horizontal. Esse arquivo também contém timeout de harness ao clicar link SPA oculto: não tratá-lo como suíte integralmente verde. A continuidade foi reexecutada após abrir o seletor correto, com `/tmp/pr365-depois/continuidade/resultado.json` sem erros. O próprio teste independente de rede lenta também clicou o link real depois de abrir `#obsTrocar`.

Referências editoriais reais inspecionadas no checkout:
- `docs/ux-2026-10-21/iniciativa-2/bloco-2/observatorio-do-credito_quanto-meu-banco-cobra-1440-depois.jpg`
- `docs/ux-2026-10-21/iniciativa-2/bloco-4/setor-eletrico-1440-depois.jpg`
- `docs/obee/capturas/entrada-perguntas/depois-1440-topo.jpg`

São referências históricas do repositório, não novas capturas destas rotas. Compartilham tratamento tipográfico, dados acompanhados de referência e separadores; o mapa aplica essa linguagem à tarefa de navegação, sem copiar gráficos ou ornamentos.

## Rede lenta — executado independentemente

Comando: `PATH=/workspace/.onboarding-tools/node_modules/.bin:$PATH node /tmp/pr365-rede-lenta.mjs`. JSON: `/tmp/pr365-depois/rede-lenta/resultado.json`. Resultado final:5/5casos, nenhum pageerror.

| Caso | Evidência observada |
|---|---|
| Next, POST retido1000ms e retorno ao mapa | Continuar em Setor Elétrico; nenhuma navegação de documento adicional |
| SPA Pix, POST retido1000ms e saída ao mapa | Continuar em Pagamentos; saída953ms |
| SPA Pix, resposta retida6000ms | Abortou atualização auxiliar; saída2354ms; permaneceu cookie anterior Crédito |
| NextA, resposta retida1800ms, navegação documento GásB | Cookie final Gás; respostaA não sobrescreveuB |
| SPAA, resposta retida1800ms, navegação documento GásB | Cookie final Gás; respostaA não sobrescreveuB |

Método: interceptação chama endpoint real com sessão temporária usando fetch sem cookie jar, retém entrega da resposta e entrega Set-Cookie ao navegador. Não usa route.fetch para evitar alteração antecipada do cookie pelo cliente de testes. `delivered:true` no log significa chamada route.fulfill concluída; não significa que um fetch cancelado consumiu a resposta. Os cookies finais comprovam o efeito observado.

Limitação explícita: falha/timeout de rede pode preservar a coleção anterior em Continuar em. É comportamento de falha tolerada, sem impedir sair da página. Não afirmar que continuidade é garantida offline. A primeira execução teve problemas de harness (cookie codificado e link oculto); resultados preservados em `resultado-harness-inicial.json`, depois corrigidos e reexecutados. Não houve alteração do produto para contornar os testes.

## Pendências para ratificação final

1. Corrigir índice390 e inspecionar capturas reais do novo build. Não atribuir9 antecipadamente.
2. Consolidar suíte oficial integral e navegação34destinos. Rajada sintética ultrapassou limite existente40eventos/min da telemetria; repetição com espaçamento está a cargo do implementador, sem mudar política. Não esconder429 nem declará-lo regressão sem evidência.
3. Atualizar caminhos das evidências ao incorporá-las ao PR, mantendo BUILD_ID e comandos correspondentes.

Copy nova por coleção não é pendência decisiva desta revisão: o conteúdo existente fornece orientação suficiente para a meta8 de didática. Melhorias editoriais futuras exigem aprovação de escopo e não foram inventadas pelo revisor.
