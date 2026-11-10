# Setor Elétrico: publicação por módulo e destrave da gold retida

03/11/2026. Decisões do dono nesta data: publicar por módulo (reter só o que falha), restringir à edição de origem as asserções
fixadas em números de 30/09/2026 e manter o vínculo usina → empresa da última publicação com CNPJ.

## O problema

A gold de energia não é publicada desde 30/09/2026 (issue #297): a cada execução diária, algum teste reprova e a publicação
inteira fica retida. Na execução de 02/11/2026 foram 40 testes de interface e 7 do pipeline. Leitura de cada falha:

| Grupo | Exemplos | Tratamento |
|---|---|---|
| Dado novo que quebrou uma conferência de verdade | Água: a soma dos reservatórios passou a divergir do subsistema em 37.888 de 39.200 dias (eram 1.470 de 39.072); Empresas: a ANEEL tirou o CNPJ dos proprietários do SIGA | Retenção só do módulo, pela sentinela do pipeline, com aviso nas páginas |
| Defeito de interface que o dado novo revelou | frase do PLD sem forma inglesa quando os submercados empatam; "59450" sem separador; "cadência diaria"; erro técnico de coleta no nível Entender; chave composta crua na Saúde dos dados; frase "O arquivo tem 392 registros" quando a página mostra só as 14 rodadas mais recentes de 16; seletor da página inicial contando tarifa pela marca antiga de Empresas | Corrigido no código |
| Asserção fixada num número de 30/09/2026 | "42,4%", "Garibaldi", "1.379", "jul/2026", CVU da semana de 26/09 | Restrita à edição de origem, com a regra invariante ao lado (nada apagado) |

## O que mudou para o leitor

- Página de módulo retido: faixa "Atualização retida" no topo, com a data da publicação que o leitor está vendo e o motivo
  registrado pelo processamento, nas duas línguas (`AvisoRetencao`, `src/lib/energia/retencao.ts`).
- Os outros módulos voltam a atualizar todo dia.

## Evidências desta pasta

Capturas a 390 e 1440 px, com sessão, sobre um build local com a gold simulada: a gold retida da execução de 02/11/2026
(artefato `energia-retida`) com a Água, Empresas, Listadas e Leilões na publicação anterior, como a sentinela fará na próxima
execução. A gold simulada não foi versionada. axe 0, console 0 e nenhuma requisição caiu no login nas oito telas
(`evidencias.md`).

## Limites

- Leitor de tela e aparelho físico não verificados.
- A causa da divergência dos reservatórios não foi investigada: exige o silver da execução (3,3 GB na cópia durável).
- O PLD horário está parado em 24/10/2026: a coleta direta da CCEE recebe HTTP 403 do servidor do GitHub. Bloqueio de fonte,
  fora deste trabalho.
- Um teste que reprovar no futuro continua retendo a publicação inteira; a retenção por módulo vale para o que a validação do
  próprio módulo detecta.
