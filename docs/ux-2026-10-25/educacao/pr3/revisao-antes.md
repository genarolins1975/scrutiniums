# PR3 — revisão independente do antes e comparação visual

Data: 25/10/2026. O relatório final PR2 cobria explicitamente 30 casos municipais e excluía as 18 imagens das capitais. Completei agora essa lacuna abrindo as 18 páginas completas de `../pr2/depois`, base anterior ao PR3, sem executar testes, navegador ou build e sem editar worktrees.

## Inventário aberto

Cada prefixo foi aberto em 390, 768 e 1440 px, com e sem sessão, usando o sufixo `-{largura}-{com|sem}-sessao.jpg`:

- `eficiencia_estatal_educacao_municipal_capitais`: panorama sem capital selecionada, seis imagens.
- `eficiencia_estatal_educacao_municipal_capitais_cap_recife`: panorama com Recife, seis imagens.
- `eficiencia_estatal_educacao_municipal_capitais_metodos`: Método, seis imagens.

As seis imagens anônimas do panorama mostram Entrar: acesso bloqueado. Método é público nas seis imagens. Não reabri as outras 30 capturas PR2 nem as 48 PR3 por rotina. A comparação depois usa a inspeção já registrada em `/tmp/revisao-educacao-pr3-visual.md`, build `QdEQE89Q3AcugwG-WUe-N`, anterior à correção simétrica de arredondamento e ao ajuste de cadastro de busca. O novo build anunciado ainda não está certificado por esta revisão.

## O que o antes demonstra

O panorama tem identidade editorial coerente, pergunta central, seletor de capital, três medidas de abertura, escala do gasto e três análises separadas. No estado Recife a faixa azul identifica a capital selecionada. Fontes, períodos e notas estão próximos da leitura; a ressalva de ausência de causalidade aparece desde a abertura. Não observei sobreposição, sumiço estrutural ou troca de identidade entre larguras.

Os gráficos anteriores resumem poucas barras: gasto exibe mínimo, mediana e máximo, mais Recife quando selecionada; turma e Ideb exibem mediana das capitais e agregado Brasil, mais Recife. As 26 capitais permanecem disponíveis pelo resumo em tabela recolhido, mas não são examináveis em conjunto no gráfico. A limitação concreta é de profundidade da leitura visual: não se identifica ali a distribuição completa nem a distância de cada capital à mediana. Isso não significa que a base perca os dados.

Há uma limitação concreta de comparabilidade visual nas barras de turma e Ideb: mediana das capitais e agregado Brasil recebem o mesmo tratamento gráfico. Os nomes e o texto abaixo explicitam que são agregações distintas, portanto não há ocultação; ainda assim, a equivalência visual facilita lê-las como referências intercambiáveis. O depois mantém Brasil como contexto textual e usa somente capitais e a mediana correspondente no gráfico.

O bloco de escores pendentes ocupa o fim do panorama, apesar de não haver escore calculável. A ausência é declarada e não vira zero, mas o módulo oferece links «Educação» e «Metodologia, referências e memória de cálculo». Trata-se de conteúdo de preparação misturado à leitura principal de resultados. O PR3 o restringe a Método e retira a aparência de resultado navegável. Não alego ter clicado nos links anteriores; a inspeção confirma sua aparência visual sublinhada.

Método já organiza famílias de medidas, fichas, conferências, matriz de referências, fontes, validações, reprodução e glossário. A maior parte é preservada no depois. Suas capturas completas são extremamente longas: cerca de 30.500 px em 390, reduzidas para 77 × 6.000 na inspeção; não é possível certificar cada célula ou parágrafo. Essa insuficiência é NV, não defeito tipográfico presumido.

## Rubrica antes

A = arte; H = hierarquia; T = tipografia/acabamento; D = densidade/profundidade; V = didática visual; C = comparabilidade; I = interação/acessibilidade; R = responsividade. Cada linha cobre as três larguras indicadas. Notas de panorama referem-se ao conteúdo visível nas capturas; não certificam tabelas recolhidas nem interações.

| Estado anterior | A | H | T | D | V | C | I | R |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Panorama sem seleção, com sessão, 390/768/1440 | 9 | 8 | 9 | 8 | 8 | 8 | NV | 9* |
| Panorama Recife, com sessão, 390/768/1440 | 9 | 8 | 9 | 8 | 8 | 8 | NV | 9* |
| Panorama sem seleção, anônimo, 390/768/1440 | — | — | — | — | — | — | NV | — |
| Panorama Recife, anônimo, 390/768/1440 | — | — | — | — | — | — | NV | — |
| Método, com sessão, 390/768/1440 | 9 | 9 | NV | 9 | NV | NV | NV | NV |
| Método, anônimo, 390/768/1440 | 9 | 9 | NV | 9 | NV | NV | NV | NV |

*Responsividade 9 descreve a reorganização visível do panorama e de seus gráficos. A coluna final do escore exige rolagem interna em 390, conforme componente compartilhado conhecido; a tarefa de alcançar essa coluna na versão anterior não foi executada. Logo, isso não é aprovação de interação da tabela.

Justificativas específicas das notas abaixo de 9:

- **Hierarquia 8:** bloco de resultado não calculável permanece no panorama e oferece links visualmente ativos. Correção verificável no escopo: manter a preparação exclusivamente em Método, preservando a declaração de ausência.
- **Densidade/profundidade 8:** os gráficos mostram apenas extremos/agregados e a cidade selecionada; as demais capitais exigem abrir tabela. Correção verificável: mostrar as 26 capitais, sem remover tabela ou contexto.
- **Didática 8:** o panorama não explica visualmente a mudança de perímetro entre gasto por habitante e aplicação direta por matrícula, nem organiza os cinco elos da capital. Correção verificável: inserir modelos contextualizados, com fontes, universos e limites causais, exatamente como previsto no PR3. É lacuna perante o objetivo desta entrega, não defeito aritmético da base.
- **Comparabilidade 8:** agregado nacional e mediana das capitais aparecem como barras equivalentes apesar das notas esclarecedoras. Correção verificável: comparação gráfica entre capitais sob uma mesma referência; Brasil separado como contexto.

Arte 9 apoia-se na paleta funcional, tipografia editorial e componentes consistentes; não exige excepcionalidade de nota 10. Acabamento 9 do panorama anterior apoia-se nos rótulos e valores legíveis nas capturas maiores, quebras coerentes nas menores e ausência de conflito observado. Não se vê ali a divergência −0,2/0,3 descoberta no gráfico de pontos depois: a versão anterior mostra a frase «0,3 ponto abaixo» e não uma coluna gráfica de diferença.

## Antes/depois sustentado

| Aspecto | Antes observado | Depois já inspecionado |
|---|---|---|
| Leitura das capitais | Poucas barras e tabela recolhida | 26 linhas com observação, mediana, diferença, ordenação e destaque |
| Referência Brasil | Barra ao lado da mediana em turma/Ideb | Contexto textual separado da comparação entre capitais |
| Cinco elos e perímetro da despesa | Ausentes no panorama | Sequência com unidades/fontes/estado e ponte explicada, sem inferência causal |
| Preparação dos escores | Panorama e Método, com aparência de links | Somente Método, explicitamente em preparação |
| Identidade e cabeçalho | Já coerentes | Preservados; não há mérito em inventar uma mudança de marca |
| Arredondamento da diferença | Só frase positiva de magnitude | Divergência −0,2/0,3 observada; correção anunciada aguarda recaptura |

Para o depois já revisado, hierarquia, profundidade, didática e comparabilidade do panorama passam a 9 com evidência concreta descrita acima e nos recortes; arte permanece 9. Acabamento do estado Recife permanece **8 na versão fotografada**, pelo achado numérico, até verificar a correção. Método inteiro conserva os NV de resolução; o módulo alterado de escores dispõe de recortes legíveis e recebeu 9 nos critérios visuais. Interação global continua NV: esta comparação não transforma a execução automatizada de outro agente em interação manual independente.
