# Educação estadual: contrato de integração — fase 4A

Situação em 12/10/2026: regras de elegibilidade implementadas; nenhuma observação educacional promovida. A página continua com as 162 observações fiscais da fase 3. CE-34 e CE-35 permanecem preliminares e sem observações publicadas.

## Pergunta e recorte

Quanto o governo estadual liquidou para uma rede e etapa de ensino, quantas matrículas essa rede atende e quais resultados educacionais foram observados?

O primeiro recorte proposto é o ensino médio regular da rede estadual, com abrangência de toda a UF. Anos iniciais e finais do ensino fundamental têm contratos separados. A base de educação municipal das capitais não será agregada, renomeada ou extrapolada para representar governos estaduais.

A primeira janela candidata é 2025, sujeita à verificação dos arquivos originais. A página oficial de resultados do Inep consultada em 12/10/2026 apresenta a edição 2025. Calendário divulgado não demonstra completude dos dados de todas as redes. Ano de referência, publicação e captura serão campos separados; não haverá substituição silenciosa de uma edição ausente pela anterior.

## Três medidas diferentes

| Medida | Publicação pretendida | Condição |
|---|---|---|
| Despesa | Liquidada anual nominal em reais, rede e etapa conciliadas | Contas, exercício, estágio, transferências, inativos, rateios e demais exclusões documentados |
| Atendimento | Matrículas do Censo Escolar, mesma rede e etapa | Abrangência estadual completa; modalidade e data do Censo explícitas |
| Resultado | Ideb oficial e, quando disponíveis, componentes de aprendizagem e fluxo | Mesma rede/etapa, critérios de divulgação e participação registrados |

CE-34 será despesa liquidada / matrículas compatíveis, em R$/matrícula. Não é custo completo por estudante único. Despesa da função Educação ou da subfunção Ensino Médio, isoladamente, não comprova atendimento exclusivo da rede e etapa: transferências, rateios, outras modalidades e outros beneficiários precisam ser conciliados.

CE-35 manterá o Ideb na escala oficial. O gasto e o resultado podem ser apresentados separadamente mesmo quando não forem elegíveis para um gráfico conjunto. A visualização conjunta exige igualdade de UF, ano, rede, etapa, abrangência e universo documentado; a coincidência de ano não demonstra que o gasto daquele exercício causou o resultado.

## O que o código verifica

O módulo `pipeline/contas_estaduais/educacao.py` fornece:

- `avaliar_despesa_por_matricula`: razão somente com recortes compatíveis, matrícula inteira positiva, despesa finita não negativa, estágio liquidado, exercício completo, base monetária nominal e evidência da conciliação.
- `avaliar_ideb`: recorte estadual elegível, identificação do indicador, proveniência preenchida, valor finito entre zero e dez.
- `avaliar_pareamento`: duas avaliações independentes e motivos explícitos para autorizar ou impedir a apresentação conjunta.

Ausência, zero real e incompatibilidade são diferentes. Nenhuma função preenche valores ausentes, seleciona um ano alternativo, calcula nota de eficiência, divide Ideb por despesa ou classifica governos.

A evidência exige URL HTTPS, hash SHA-256 com formato válido, arquivo e campo de origem. Essa checagem é estrutural: não autentica a fonte nem comprova o hash. A ingestão ainda deve preservar os bytes, recalcular hashes, validar o demonstrativo e conferir as regras da fonte. O identificador de universo e o documento de conciliação precisam de revisão; rótulos iguais sozinhos não certificam comparabilidade.

O DF pode ser avaliado individualmente. Sua inclusão em referências agregadas continua opcional e explícita, por causa de suas competências estaduais e municipais.

## Fontes e reaproveitamento

- [Inep — resultados do Ideb](https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados): localizar pacote de UF/rede estadual, etapas, edição, notas de divulgação e componentes.
- [Inep — Sinopse da Educação Básica](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/sinopses-estatisticas/educacao-basica): matrículas por UF, dependência, etapa e modalidade; conferir quadro e denominador.
- [Inep — microdados do Censo Escolar](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar): alternativa para reprodução por escola. Mudanças de layout entre edições devem ser tratadas explicitamente.
- [FNDE — indicadores estaduais do SIOPE](https://www.fnde.gov.br/siope/consultaIndicadoresEstaduais.do): examinar documentação, estágio e universo antes de adotar qualquer razão pronta.
- Tesouro/Siconfi: possível fonte de despesa por função/subfunção, inicialmente como contexto contábil. Uma classificação funcional não substitui a conciliação da rede/etapa.

O repositório já dispõe de leitores de planilha, registro de captura e verificações de integridade do Inep. Eles podem ser reaproveitados. Seus filtros de capitais, dependência municipal e sementes municipais não atendem ao novo contrato.

O exame anterior do SIOPE em `pipeline/eficiencia/fontes/siope.py` registrou ausência de documentação suficiente para reproduzir os indicadores municipais analisados. Essa limitação deve motivar investigação própria da fonte estadual; não prova que todos os relatórios estaduais sejam inutilizáveis.

## Desenho da próxima tela

Sequência editorial: recorte da rede → despesa e matrículas → aprendizagem e fluxo → comparação → metas e método.

1. Exibir lado a lado os valores de despesa, matrículas e Ideb com seus próprios anos, fontes e cobertura.
2. Mostrar a trajetória real da despesa somente após adotar deflator documentado. A regra desta fase aceita apenas a razão nominal de cada exercício.
3. Construir dispersão de despesa por matrícula e Ideb apenas para pares elegíveis, com mediana de cada eixo, cobertura, tabela equivalente e CSV. Posição na figura não recebe rótulo de eficiência.
4. Comparar redes estaduais da mesma etapa. Referências internacionais só entram quando unidade, população e método forem compatíveis; médias da OCDE não serão linhas de meta sobre Ideb ou reais nominais.
5. Para eficácia, registrar meta oficial anterior ao período, revisão, prazo, responsável e resultado observado. Máximo ou mediana dos pares não serão convertidos em meta.
6. Para eficiência, preservar múltiplos insumos, produtos e contexto. Fronteiras estatísticas exigem desenho próprio, homogeneidade, defasagens e sensibilidade; uma razão gasto/nota não atende a esse propósito.

## Verificação e pendências

Os testes usam apenas fixtures sintéticas em arquivo de testes. Cobrem incompatibilidade de cada dimensão, capitais, função 12, estágio, janela, origem incompleta, zeros, ausências, valores não finitos, denominadores e resultados de anos diferentes. Nenhuma fixture entra na aplicação.

Executar: `python3 -m unittest pipeline.contas_estaduais.test_educacao -v`.

Ainda faltam: capturar e preservar as fontes estaduais; reconciliar numerador e denominador; registrar participação e supressões do Inep; integrar resultados à ficha e revisar a interface. A queda da conexão com o ambiente local nesta retomada impediu nova inspeção visual. A implementação desta fase modifica apenas contrato, testes, documentação e verificação automática; não apresenta dados novos na página.
