# Entradas de Eficiência Estatal e Contas Públicas

Implementação em 13/10/2026. Referência de código: `main` em
`07eee32daa031a4cafdf207b436edb2c7ff50f88`. Escopo: as entradas
`/eficiencia-estatal`, `/contas-publicas` e `/contas-publicas-estaduais`.

## Direção e tarefa de cada página

A linguagem acompanha Crédito e Energia: papel claro, títulos em serifa,
contraste em petróleo, números tabulares, linhas discretas e uma figura útil
na abertura. As ilustrações de navegação representam recursos, território e
serviços; não representam quantidades ou relações causais.

| Entrada | Tarefa principal | Nova abertura |
| --- | --- | --- |
| Eficiência Estatal | Escolher um tema e comparar condições no território | Duas capitais em uma medida de educação, saúde, renda ou mobilidade; alternativa regional para situação alimentar |
| Federal | Entender o percurso contábil e escolher uma pergunta | Dotação atualizada, empenho, liquidação e pagamento, na mesma escala e no mesmo exercício |
| Estadual | Escolher um ente e situar sua execução e dívida | Índice alfabético com as 27 bandeiras; duas medidas da UF e do exercício selecionados |

## Mudanças e preservação do conteúdo

- OBEE: substituição da órbita numerada por comparação substantiva. Controles
  territoriais dentro do bloco que atualizam; quatro perspectivas com escalas,
  unidades, períodos, fonte e ressalva. O parâmetro `perspectiva` complementa os
  parâmetros territoriais e acompanha voltar/avançar. O panorama completo,
  referências, distribuições, comparação por idade/Saeb, catálogo, downloads,
  fontes e disponibilidade dos escores permanecem acessíveis.
- Federal: abertura com quatro estágios contábeis, ano próprio e valores exatos
  em expansão; indicação explícita de que os estágios não se somam. Três
  percursos de leitura, respostas iniciais com hierarquia, régua de R$ 100 e
  ciclo de gestão preservados. O índice completo ganhou busca sem acentos e
  filtros de disponibilidade; capítulos sem integração são identificados.
- Estadual: bandeiras selecionam a mesma UF usada no panorama e na ficha.
  Mudanças do ano continuam propagadas pelo estado compartilhado existente.
  A abertura usa apenas observações conferidas, com ausência textual nos anos
  sem conferência. DF mantém ressalva própria. Panorama, ficha, execução,
  financiamento, composição, educação, provas, série, CSV e métodos preservados.
  Contagens do catálogo/base foram aproximadas da seção de cobertura.
- Componentes compartilhados limitam-se à composição de abertura, ícones de
  navegação e percursos. Nenhuma biblioteca, fonte ou dependência foi adicionada.

## Verificações executadas

- `npm run lint`: aprovado, sem avisos.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado, 564 páginas geradas.
- `EXIGIR_BUILD_HTML=1 npx vitest run`: 215 arquivos aprovados; 4.850 testes
  aprovados e 1 ignorado. A verificação de alterações após a suíte passou.
- 61 casos novos conferem estágios federais, valores das 27 UFs, ausência
  versus zero, ressalva do DF, educação nas 26 capitais, quatro perspectivas,
  situação alimentar regional e acesso a todos os capítulos federais.
- HTML gerado de OBEE e Federal: um H1 por página; nenhum ID duplicado e
  nenhuma âncora local sem destino. Respectivamente, 118 e 50 links examinados.
- Contraste calculado: seis combinações de texto entre 5,63:1 e 13,35:1;
  bordas de seleção, botões de medida e bandeiras a 4,59:1 sobre petróleo.
- SHA-256 dos 54 arquivos do pacote OBEE v3 conferidos e preservados. Nenhuma
  mudança de pesos, fontes, normalização, status, pareceres ou chaves de acesso.

O ambiente local usa Node 25.9.0; o CI do repositório usa Node 22. A revisão
foi feita em checkout isolado para preservar arquivos locais de outra tarefa.
Como a rede do shell não resolveu GitHub, os fontes atuais da main foram
obtidos pelo conector e conferidos pelo hash de blob. As quatro imagens de
documentação de Energia não são usadas pelo aplicativo e não foram copiadas
para esse checkout; a árvore remota do PR é construída sobre a main completa,
preservando-as. Nenhum commit de sincronização local integra o PR.

## Revisão visual e acessibilidade: limite da evidência

O navegador local não pôde ser inspecionado: o Mac estava bloqueado e a
conexão do Chrome expirou; o navegador integrado estava indisponível. A
execução local também não permitiu abrir servidor de desenvolvimento ou
iniciar Chromium. Não há capturas antes/depois produzidas nesta rodada.

O CSS contempla reflow em telas estreitas, controles nativos, foco visível,
seleção por texto/estado acessível, alternativas textuais aos gráficos,
movimento reduzido e cores forçadas. Isso é evidência de implementação,
**não comprovação de comportamento visual ou conformidade integral**.

| Critério da skill de layout | OBEE | Federal | Estadual |
| --- | --- | --- | --- |
| Direção de arte | Revisão visual pendente | Revisão visual pendente | Revisão visual pendente |
| Hierarquia | Código reorganizado; visual pendente | Código reorganizado; visual pendente | Código reorganizado; visual pendente |
| Tipografia e acabamento | Não verificado no navegador | Não verificado no navegador | Não verificado no navegador |
| Densidade e profundidade | Conteúdo preservado; visual pendente | Conteúdo preservado; visual pendente | Conteúdo preservado; visual pendente |
| Didática visual | Contratos e ressalvas conferidos; visual pendente | Contratos e ressalvas conferidos; visual pendente | Contratos e ressalvas conferidos; visual pendente |
| Comparabilidade | Testes de valores e universos aprovados | Testes de estágios e período aprovados | Testes das 27 UFs e ausências aprovados |
| Interação e acessibilidade | Verificação manual pendente | Verificação manual pendente | Verificação manual pendente |
| Responsividade | Verificação manual pendente | Verificação manual pendente | Verificação manual pendente |

Não se atribui nota estética 9/10 sem inspecionar o resultado. Para concluir
a revisão: abrir as três rotas em 320, 390, 768 e 1440 px; percorrer início,
meio e fim; conferir zoom 200%, teclado e contraste; testar seleção, busca,
filtros, links, voltar/avançar e downloads. Comparar as notas de fontes e os
valores com as fichas já existentes.

Esta proposta de interface não amplia a divulgação do laboratório de cesta,
não modifica seus gates e não transforma a candidata v3 em escore aprovado.
