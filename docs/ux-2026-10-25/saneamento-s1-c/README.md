# Saneamento S1, pacote C

Pedido de 25/10/2026: acrescentar o quarto número de custo à entrada, mantendo A e B no PR #385. A decisão D-S1 sobre adoção do quarto número permanece pendente antes do merge. Não houve merge nem deploy.

## O que muda para o leitor

A entrada mostra a menor e a maior conta residencial de água e esgoto para 10 m³ por mês, com a mediana logo abaixo, calculadas pelo mesmo `calcularConta` do simulador. Uma observação por tabela, incluindo variantes municipais, sem adicionais e sem ponderação por município, prestador ou população. Na base consultada, a faixa é R$ 80,84 a R$ 198,89, e a mediana apresentada é R$ 128,15.

A ressalva de amostra acompanha o valor: 12 tabelas de oito prestadores em 1.754 municípios; não é média do Brasil. Contagens, municípios deduplicados e datas de consulta vêm de `tarifas.json`. Nenhum número de resultado está escrito à mão na implementação. O link “Ver no painel” leva ao simulador.

Nenhuma tarifa, fórmula de faturamento, gold, seed ou regra de acesso foi alterada. Em amostra vazia ou sem verificação de ambos os serviços, a faixa e a mediana permanecem ausentes.

## Fonte e decisão editorial

A redação sugerida no pedido era “Atos dos reguladores; tabelas vigentes nas consultas de…”. A revisão independente encontrou registros com publicação de vigência não confirmada, ato não lido ou tabela divulgada pelo próprio prestador: COMPESA e recortes da Corsan, conforme observações preservadas em `tarifas.json`.

Por isso, a implementação usa “Reguladores e prestadores; tabelas consultadas de 14/10/2026 a 17/10/2026”, com as datas derivadas da base. O usuário aprovou expressamente essa redação em 25/10/2026. Ela evita atribuir a todas as tabelas uma verificação documental que não está demonstrada. O período é de consulta, não uma data de início de vigência inferida.

## Evidência antes e depois

A versão anterior é o commit `521bf02ab`, com A e B. Capturas do build de produção em `antes/`, nas duas rotas, a 390 e 1440 px, com e sem sessão. A versão final está em `evidencias.md` e `detalhes/`.

| Antes | Depois | Motivo |
|---|---|---|
| Título pergunta quanto custa, mas a escala traz só acesso e tratamento | Quarto número com faixa, mediana e amostra tarifária | Responder também à pergunta de custo |
| Nenhum caminho ao simulador na escala | “Ver no painel” no número de custo | Permitir conferir a conta e mudar o consumo |
| Três números na faixa | Quatro, usando o mesmo molde e componente | Preservar identidade e limites de comprimento |

A porta aberta `/perguntas/energia-e-infraestrutura` não recebeu alterações de código ou dados. Antes de C, a auditoria já registrava duas respostas 401 sem sessão e uma requisição ao login em ambas as larguras. Essa ocorrência não é tratada como regressão do quarto número. Os oito arquivos de captura da porta aberta (página inteira e primeira tela, ambas as larguras e sessões) são idênticos byte a byte aos anteriores, conforme [comparacao-porta-aberta.json](comparacao-porta-aberta.json).

## Verificação

- `bash scripts/preparar-sessao.sh`: aprovado, antes dos testes.
- Testes focados de conta e novo resumo: 18 aprovados.
- `npm run verificar:pr`: aprovado integralmente na versão com a fonte aprovada. Vitest: 405 arquivos e 9.633 testes aprovados; 12 ignorados e um pendente já existentes. Lint, tipos, build, pipelines Python, OBEE, cobertura bilíngue, 224 verificações em 68 telas do Judiciário e guarda da árvore passaram. Uma execução anterior foi interrompida durante Python para ajustar a fonte antes de reiniciar a verificação completa; não é contada como aprovada.
- Medição do build final: 9.621 px a 390 px (limite 11.000) e 5.303 px a 1440 px (limite 6.500), sem rolagem horizontal. O primeiro número começa em 569,5 px no desktop (limite 900). O link do quarto número abriu o simulador com a tecla Enter nas duas larguras. [Medidas](detalhes/medidas.json).
- `VITEST_MAX_WORKERS=2 npm run verificar:rapido`: aprovado; 164 arquivos e 4.277 testes passaram, com sete ignorados e um pendente já existentes. A primeira rodada, com o paralelismo padrão, teve dois timeouts de 5 s em `saneamento-gold` e `saneamento-controle`; ambos já haviam passado na suíte completa e passaram novamente com dois processos. Nenhuma asserção ou timeout foi alterado.
- `npm run evidencias -- --rotas /saneamento /perguntas/energia-e-infraestrutura --larguras 390,1440 --saida docs/ux-2026-10-25/saneamento-s1-c`: concluído, oito combinações. Zero violações axe e zero rolagem horizontal; Saneamento sem erros de console ou requisições de recursos ao login. A porta aberta mantém exatamente as ocorrências de antes: duas respostas 401 sem sessão e uma requisição ao login.
- `git diff --check`: aprovado. Nenhum teste existente foi alterado no pacote C.

## Limites

As quatro skills obrigatórias permanecem aplicadas. Os executáveis auxiliares de impeccable e design-taste-frontend não estão no repositório, conforme seus arquivos ORIGEM.md; a conferência usa o Playwright existente. Não houve teste com leitor de tela ou aparelho físico. As capturas são locais e não comprovam implantação.

## Revisão visual da entrada

Autoavaliação sobre as capturas finais a 390 e 1440 px; a revisão independente de código conferiu cálculo, amostra e proveniência.

| Critério | Nota | Evidência e limite |
|---|---:|---|
| Direção de arte | 9 | Mesmo molde, tipografia, filetes e componente dos outros três números |
| Hierarquia | 9 | Custo na escala da pergunta de abertura; mediana e universo junto da faixa |
| Tipografia e acabamento | 8 | Moeda e valor não se separam; a fonte e a ressalva continuam em corpo menor, conforme o molde |
| Densidade e profundidade | 8 | Análise preservada; o quarto número tem mais texto material e aumenta a altura da linha no desktop |
| Didática visual | 9 | Consumo, categoria, ausência de adicionais e peso igual por tabela explícitos |
| Comparabilidade | 9 | Mesmo consumo e motor do simulador; amostra não confundida com média nacional |
| Interação e acessibilidade | 8 | Link ao simulador testado com teclado e auditoria automatizada; leitor de tela não verificado |
| Responsividade | 9 | Sem cortes ou rolagem horizontal nas larguras medidas; limites de comprimento atendidos |
