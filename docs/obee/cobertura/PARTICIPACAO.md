# Participação Saeb — integração preparada, dados pendentes

Entrega de 11/10/2026, segundo lote da etapa 4. O conciliador está implementado; nenhum percentual real foi incorporado. A auditoria continua com 96 valores brutos elegíveis em 104 posições e zero participações preenchidas. A obtenção dos arquivos oficiais permanece pendente: o acesso pelo terminal falhou na resolução DNS e a ferramenta de pesquisa não resolveu o link de download. Isso não é evidência de indisponibilidade pública do Inep.

## Contrato de entrada

O CSV intermediário é uma extração revisada, **não um suposto layout oficial**. Após baixar e inspecionar a planilha original, mapear explicitamente as colunas oficiais para:

| Campo | Regra |
|---|---|
| territory | Código IBGE de sete dígitos; uma das 26 capitais da auditoria |
| year | 2023, a mesma edição dos valores brutos |
| stage | Nome exato da etapa usado na auditoria |
| subject | portugues ou matematica; não replicar entre disciplinas sem suporte da fonte |
| network | municipal; dados estaduais não substituem rede municipal |
| participants | Inteiro não negativo; zero é valor, não ausência |
| eligible_students | Inteiro positivo, universo efetivamente usado no denominador |
| reported_pct | Percentual publicado, opcional; deve conciliar com as contagens |
| denominator_definition | Definição textual da população do denominador |
| source_locator | Arquivo, aba e linha/células de origem |

Não inferir população elegível a partir da matrícula total. A tolerância de 0,051 ponto percentual cobre arredondamento a uma casa decimal; é uma decisão do conciliador, não um critério de divulgação do Inep. Outro grau de arredondamento exige revisão explícita.

O manifesto JSON exige `source_url`, `source_sha256`, `extraction_sha256`, `reviewer`, `reviewed_at` e `review_status: REVIEWED`. Os dois hashes são conferidos contra os arquivos efetivamente fornecidos. O estado REVIEWED registra a declaração do responsável: o software não comprova sozinho a autenticidade da fonte ou a qualidade da revisão.

## Execução após aquisição e revisão

```sh
python3 -m pipeline.eficiencia_escores.participacao \
  --source /caminho/arquivo-oficial.xlsx \
  --extraction /caminho/participacao-revisada.csv \
  --manifest /caminho/manifesto.json \
  --output docs/obee/cobertura/cobertura-com-participacao.json
```

A saída é um diagnóstico interno separado; não altera o CSV público, as fichas ou a página. Conciliação parcial mantém todas as 104 posições e as ausências restantes. Chaves incompatíveis, duplicatas, conflitos, denominadores inválidos e divergências de hash interrompem o processo antes da gravação. Nenhum limiar de participação ou referência de normalização foi aprovado nesta entrega; escores continuam nulos.

## Verificação

```sh
python3 -m unittest pipeline.eficiencia_escores.test_participacao pipeline.eficiencia_escores.test_cobertura pipeline.eficiencia_escores.test_fundacao -v
```

22 testes locais aprovados, incluindo seis de conciliação. As contagens usadas nos testes são sintéticas e ficam exclusivamente nas fixtures; não constituem evidência empírica.

## Próximo marco de dados

1. Obter a planilha pelo [portal oficial Saeb 2023](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/saeb/resultados/2023), preservar bytes e hash.
2. Inspecionar dicionário, unidade territorial, rede, população e regras específicas de divulgação de 2023.
3. Extrair e revisar numeradores e denominadores; registrar localizadores e conciliar os valores de proficiência também.
4. Rodar o conciliador e revisar o diagnóstico. Só então atualizar a fonte pública e o indicador de disponibilidade.
5. Validar referências OBEE e completar os pilares de acesso/resposta antes de liberar nota de Educação.
