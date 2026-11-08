# Captura de dados: Saneamento e Setor Elétrico

Análise e correções locais em 7 de novembro de 2026. Escopo: coleta,
integridade da importação e sinalização de falhas antes da publicação.

## Defeitos reproduzidos e correções

| Etapa | Falha | Comportamento corrigido |
|---|---|---|
| CadÚnico | Resposta truncada, vazia, duplicada ou de outro mês substituía o seed. | Confere `numFound`, presença de registros, código municipal, unicidade e mês; falha preserva o arquivo anterior, inclusive quando ocorre no segundo mês. |
| SINISA | Falha ao extrair uma planilha tardia ocorria depois de gravar as primeiras. | Extrai todas as planilhas exigidas antes de iniciar a substituição. |
| Seeds do saneamento | Escrita direta podia truncar o arquivo anterior. | Comprime em temporário e substitui cada arquivo atomicamente; mantém gzip determinístico. |
| ONS e CCEE | HTML, CSV vazio ou erro de parsing podiam interromper a coleta e deixar uma vintage parcial. | Valida a resposta, importa sob savepoint, desfaz a importação inválida e continua nos demais recursos; registra a falha. Catálogo sem recursos compatíveis também falha. |
| Histórico ONS | A janela de 30 dias usava a primeira captura dos bytes; arquivos idênticos voltavam a ser baixados diariamente. | Usa a última coleta bem-sucedida e observa o `last_modified` conferido, sem alterar a data da vintage. Bronze ausente exige recaptura. |
| Seleção de grupos | Espaços ou IDs incorretos podiam resultar em coleta parcial/vazia com sucesso. | Normaliza espaços e rejeita IDs desconhecidos/vazios antes de modificar arquivos; seleção omitida/vazia continua significando todos. |
| Workflow elétrico | `tee` escondia o código de erro do Python. | `set -euo pipefail` preserva a falha e impede que a execução prossiga como se a coleta tivesse concluído. |

Os novos testes de coleta foram exercitados contra o código anterior e reproduziram
falhas. A suíte do workflow executa o bloco real do YAML com um pipeline sintético
que termina com erro ou sucesso, nos modos com e sem coleta. A seleção de grupos é
testada pela CLI, incluindo a preservação de relatórios e arquivos anteriores.

## Reprodução local

Resultado da rodada integrada: **215 testes Python e 63 testes Vitest passaram**;
`git diff --check` passou. A revisão independente dos coletores não encontrou
regressões materiais. Seeds e golds permaneceram sem alterações.

Na raiz do repositório, com Python 3.12, `pyarrow` e `openpyxl` disponíveis:

```bash
export NODE_OPTIONS=--max-old-space-size=4096
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium
bash scripts/preparar-sessao.sh
python -m unittest \
  pipeline.tests.test_energia_coleta pipeline.tests.test_energia \
  pipeline.tests.test_energia_infra pipeline.tests.test_energia_workflow_coleta \
  pipeline.tests.test_energia_meta pipeline.tests.test_atualizacao_por_grupo \
  pipeline.tests.test_observatorio_saneamento pipeline.tests.test_coleta_saneamento \
  pipeline.tests.test_saude pipeline.tests.test_controle pipeline.tests.test_jmp \
  pipeline.tests.test_ods pipeline.tests.test_saneamento pipeline.tests.test_vigilancia_saneamento
npx vitest run src/tests/saneamento-gold.test.ts src/tests/energia-dados-interface.test.ts --maxWorkers=2
git diff --check
```

O novo teste de coleta do saneamento integra também a bateria do ciclo mensal em
`config/atualizacao/saneamento.json`. Os testes de energia entram na descoberta
Python já usada pelo workflow.

## Limites da validação

- Consultas ao catálogo do ONS e à página do SINISA foram bloqueadas pelo proxy
  deste ambiente (`CONNECT 403`). Isso não demonstra falha das fontes. Não houve
  recoleta ao vivo, avanço das referências nem alteração dos dados publicados.
- Edições do SINISA, meses do CadÚnico e anos do SISAGUA continuam seguindo a
  integração deliberada documentada em `OPERACOES.md`.
- A substituição atômica do SINISA é por arquivo. Uma falha de disco durante a
  substituição do lote ainda depende da reversão do grupo no runner; a coleta
  direta não é uma transação entre todos os arquivos.
- Testes locais não comprovam execução no GitHub Actions nem implantação em
  produção. Para validar a captura externa, executar o workflow com as correções
  em ambiente autorizado a acessar as fontes e conferir o relatório antes da publicação.
