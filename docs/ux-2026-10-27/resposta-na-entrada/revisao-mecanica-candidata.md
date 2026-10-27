# Resposta na entrada — revisão mecânica do candidato

27/10/2026. Diff não commitado sobre `8a7cd80b27e5110f0024236fc73ae1fabb61de69`, em `/workspace/scrutiniums-resposta-na-entrada`. Revisão independente por leitura de fonte, estilos, contratos de dados e testes. Não executei build, testes ou navegador e não alterei o repositório.

**Resultado: corrigir os dois achados abaixo antes de entregar.** A reorganização implementa a ordem pedida no DOM e preserva os cálculos examinados. A aprovação de primeira tela, foco depois da navegação e ausência de cortes depende da conferência renderizada da execução principal.

## Achados acionáveis

| Prioridade | Before | After | Why |
| --- | --- | --- | --- |
| P2 — natureza incorreta de um número no resumo | `src/components/conectividade/PainelConectividade.tsx:168` acrescenta “informado à fonte” às três medidas, inclusive `fibra_pct`. | Definir a natureza e a fonte por medida: densidade como publicada pela Anatel; percentual de fibra calculado pela Scrutiniums sobre os acessos informados; cobertura conforme o contrato Anatel/Censo. Manter os períodos próprios. | `pipeline/conectividade/gold.py:76` calcula `fibra_pct = pct(d["fibra"], a)`. O método no próprio painel distingue percentuais calculados dos números publicados. A frase nova atribui à fonte um resultado derivado da plataforma. Não basta conservar o número correto e o nome Anatel. |
| P2 — contrato antigo de título fará o teste falhar | `src/tests/combustiveis.test.ts:91` ainda procura “Preço médio do litro: Brasil” como primeira posição, mas `PrecoNoEstado.tsx:87` usa “Custo do tanque” quando `destacarTanque` é verdadeiro. | Atualizar deliberadamente a asserção de ordem para um elemento estável da resposta inicial ou para o novo contrato, preservando a verificação de precedência em relação ao mecanismo, histórico, estados e método. | O painel passou `destacarTanque`; não existe mais aquele título nessa chamada. O índice procurado será −1 e a asserção `ordem.every(p > 0)` reprovará. É consequência direta da mudança autorizada, não motivo para remover a verificação de ordem. |

O segundo achado é uma falha prevista pela leitura, não resultado de teste executado nesta revisão.

## Conferência dos cinco caminhos

| Rota | O que o diff efetivamente preserva | Pendência específica |
| --- | --- | --- |
| `/custo-de-vida` | `useArea` e dados da gold permanecem; área e Brasil continuam na mesma janela, com diferença em p.p.; a ressalva das 16 áreas está junto ao controle. Os nove grupos continuam no HTML e agora ficam em `<details>` por opção somente desta entrada. A fonte completa continua no resumo. | Conferir quanto da resposta e da fonte aparece após a escolha a 320/390 px. O bloco grande de região viva foi reduzido à resposta principal, o que evita anunciar os nove grupos juntos. |
| `/combustiveis` | Mesmos preços, mês, postos e referências. O total usa a multiplicação já existente; o preço observado por litro continua visível, separado do custo calculado. `FonteFigura` foi movida junto, e o resumo ganhou fonte local. `null` continua “sem dado”, e litros inválidos mantêm os preços por litro. | Corrigir o teste de título. O input aceita o mesmo estado de litros de antes; recarregar continua restaurando 40 litros, pois a URL só guarda UF. É limitação preexistente, não corrigida pelo diff, e não deve ser apresentada como compartilhamento completo da conta. |
| `/conectividade` | Município é escolhido por `?ibge=` no servidor. Resumo lê os mesmos campos do detalhe; país vem da referência nacional existente; fixa e cobertura mantêm meses distintos. Detalhe, operadoras, séries, distribuição e notas continuam no HTML dentro de `Recolhido`. Uma busca apenas. | Corrigir a natureza genérica. Conferir o link `#municipio-detalhes`, cujo alvo está dentro de um `<details>` fechado, inclusive por teclado. O alvo inicial `#municipio` continua existindo. |
| `/educacao-municipal` | Busca e extrato foram reunidos. O extrato preserva município/UF, ano do Ideb, etapa, rede municipal, escala 0–10, referências nominadas, fonte, motivo de ausência e link de ficha. Continua antes da escala nacional e existe uma vez. | Conferir foco após `router.push()` da busca. O componente de busca não recebeu transferência explícita de foco; a nova posição exige observação real da navegação, não apenas `.focus()` antes de selecionar. |
| `/eficiencia-estatal` | Seletores continuam sob `ProvedorCapital`; as duas escolhas usam `retrato.condicoes`, com valores originais, unidade, período, natureza, nota e precisão. Os números da escala continuam rotulados como medianas. Régua, perguntas, recursos e índice mantêm suas localizações e links. | Os sete resultados foram acrescentados na abertura e permanecem também no aprofundamento. Medir altura total e resposta inicial; a quantidade de texto por medida pode deslocar o panorama consideravelmente, embora nada tenha sido apagado. Não inferir “cabe” apenas porque o primeiro contêiner começa acima de 900 px. |

Não encontrei alteração de cálculo, política de acesso, geolocalização, perfil inferido, gold, rotas públicas ou download no diff examinado. `resposta` é uma prop opcional e as demais chamadas de `EntradaColecao` conservam seu encadeamento. Os defaults de Brasil e Recife/Curitiba já existiam e permanecem identificados pelos nomes; a mudança não transforma esses defaults em localização detectada.

## Acessibilidade, estado e preservação

- A consulta foi retirada de `ParaVoce`, em vez de duplicada. A ordem visual pretendida corresponde à ordem de leitura do DOM.
- IDs examinados permanecem distintos: Conectividade usa `municipio` na escolha e `municipio-detalhes` no detalhe; Educação mantém um `extrato-titulo`; a resposta da capital tem `resposta-capital-titulo` separado de `retrato-titulo`.
- Os seletores de estado e área trocaram largura mínima rígida por largura preferencial com `max-w-full`. Isso trata o risco identificado a 320 px; falta comprovar o resultado renderizado e o texto longo.
- A lista da busca segue absoluta com `z-30`; o novo envelope não introduziu `overflow:hidden`. Confirmar visibilidade das sugestões, teclado e sobreposição no resultado real.
- O cálculo do tanque permanece numa região viva que contém todos os combustíveis. É comportamento preexistente; não foi acrescentada uma segunda região para repetir o mesmo total.
- O resumo de capital anuncia somente a frase do comparador. Ao trocar só a capital principal, essa frase pode ficar inalterada. Verificar como o leitor encontra os resultados seguintes pelo teclado/leitor de tela; não atribuo conformidade por fonte.
- A versão aberta de Educação e Conectividade continua em páginas próprias, fora deste molde; Eficiência Estatal também preserva sua seleção de versão. Nenhuma alteração de acesso foi necessária. A conferência com/sem sessão permanece necessária na execução principal.

## Precisão dos testes novos e fluxo de execução

O teste novo verifica geometricamente o controle inteiro no viewport, a ordem DOM da consulta antes da escala e ausência de transbordamento nas quatro larguras. As jornadas conferem escolhas reais e valores de inflação/capitais; isso é mais forte que procurar marcadores apenas.

Há limites de cobertura que não devem virar uma alegação maior:

1. `ux-orcamentos-comprimento.test.ts` agora aceita o topo de `[data-resposta-especifica]` no lugar do primeiro número. Esse topo pode ser um título, antes do valor e da fonte. A mudança é legítima para deslocar o panorama, mas não prova “número e prova na primeira tela”. Na evidência final, registrar as posições do primeiro valor e da fonte/período, além do seletor.
2. A jornada de Conectividade/Educação confere nome do município e posição do resultado, mas não confere valor, fonte e período contra a gold. O primeiro achado desta revisão passaria nesse teste. Uma asserção focalizada de natureza/fonte do resumo de Conectividade é útil; não precisa reproduzir toda a marcação nem fixar textos não decididos pelo dono.
3. O teste de combustível contém um ramo para “sem dado”, mas selecionar PE não demonstra necessariamente esse ramo. Para afirmar ausência verificada, usar uma UF/produto efetivamente ausente na gold ou fixture existente.

**Build obrigatório da jornada:** o novo arquivo exige `temBuild` sem `skip`. A coordenação informou que isso segue uma instrução explícita do usuário; não recomendo introduzir `skip`. O CI já faz `npm run build` antes de cada shard (`.github/workflows/ci.yml:248–262`). Uma invocação explícita de testes unitários continua independente. Porém `verificar:rapido` não faz build, e `scripts/testes-afetados.mjs:81` inclui todo teste alterado: nesta branch ele selecionará a jornada e exigirá build prévio. Esse é um pré-requisito real do comando nesta mudança, não uma falha do CI. Não é necessário alterar o runner para encobrir essa exigência.

## Fechamento desta revisão

Corrigir natureza do percentual de fibra e contrato de título de Combustíveis; depois conferir geometria, foco, expansão do detalhe e estados de ausência no build final. Esta passagem não certifica primeira tela, contraste, leitor de tela ou desempenho. Não há recomendação cosmética nem alteração de método.
