# Camada de pesquisa: nota mensal de conjuntura (piloto, degrau 1)

Opera sobre a gold publicada e fora do pipeline de números. Nada aqui escreve em `pipeline/`, `data/` ou `public/`; agentes escrevem só em `notas/`. Critério único: `docs/CONSTITUICAO.md` (versão 2). Desenho e plano: `docs/AVALIACAO_AGENTES_2026-09-24.md`.

Não há revisão humana em nenhuma etapa. O papel que seria de um editor é cumprido por três revisores agentes independentes, por unanimidade, somados a regras verificáveis por código e a um auditor mensal que também é código.

## Peças

| Módulo | Papel | Tem modelo de linguagem? |
|---|---|---|
| `fatos_conjuntura.py` | pacote de fatos: única origem de número da nota, com ponteiro para a gold e hash | não |
| `nota.py` | formato da nota com marcadores, renderizador e manifesto de reprodutibilidade | não |
| `validador.py` | validador mecânico M1 a M11; decide aprovar, devolver ou bloquear | não |
| `sentinela.py` + `sentinelas/` | casos com erro plantado; recall por categoria e falso bloqueio do validador | não |
| `verificador_fonte.py` | confere cada valor do pacote na API do SGS no dia | não |
| `registro.py` + `registro_erros.json` | registro público de erros; alimenta os degraus | não |
| `orquestrador.py` + `papeis/` | analistas, replicador, consolidador, crítico, revisão e os três revisores | sim, só no texto |
| `sentinela_semantica.py` + `sentinelas_semanticas/` | bateria semântica: mede os três revisores com erros que o validador não vê | sim, nos revisores medidos |
| `auditor.py` | auditoria mensal das notas aprovadas; erro vira errata e entrada no registro | não |
| `metricas.py` | métricas por ciclo e critério de degrau | não |

## Os três revisores

A regra está em `papeis/config.json` e é verificada pelo orquestrador antes de qualquer chamada: cada par de revisores difere em pelo menos três de cinco características (modelo, fornecedor, evidência, apresentação da evidência, mandato). Configuração que não cumpre é recusada.

| Revisor | Modelo | Evidência | Apresentação | Mandato |
|---|---|---|---|---|
| `validador_constitucional` | `claude-opus-5` | fatos do pacote | tabela markdown | conformidade à constituição |
| `revisor_independente` | `claude-sonnet-5` | fatos do pacote com ponteiros para a gold | JSON | fidelidade à evidência |
| `terceiro_revisor` | `claude-fable-5-1` | histórico bruto das séries na gold (13 meses) | série mensal | leitor cético |

Cada revisor roda em contexto isolado: não vê o parecer dos outros, nem os rascunhos, nem a saída dos analistas. Nenhum revisor aprova número (isso é do validador mecânico). Qualquer item grave obriga devolução; qualquer devolução volta a nota à revisão; sem unanimidade em `max_rodadas_revisao` rodadas a nota é rejeitada e nada sai. Fornecedor ainda é o mesmo nos três: a diferença de fornecedor depende de chave de outra API (pendência registrada no próprio `config.json`).

## Um ciclo

```
python3 -m pesquisa.orquestrador notas/2026-08                     # modo manual: gera o prompt e para
#   grave a resposta de cada papel em notas/2026-08/saidas/<etapa>.md e rode de novo
python3 -m pesquisa.orquestrador notas/2026-08 --backend anthropic # com a API (pip install anthropic)
python3 -m pesquisa.verificador_fonte notas/2026-08/pacote.json    # fonte primária no dia
```

O ciclo termina em `decisao.json` (`aprovada` ou `rejeitada`, rodadas, parecer de cada revisor, `revisao_humana: false`). Código de saída 0 se aprovada, 3 se não.

## Depois da aprovação

```
python3 -m pesquisa.auditor notas/ --registrar --fonte   # mensal, em .github/workflows/auditoria-notas.yml
```

O auditor confere integridade (hashes e texto final igual à renderização), reproduz cada fato na gold que gerou a nota e passa a fonte da nota na versão atual do validador. Erro factual vira `errata.md` no ciclo, entrada em `registro_erros.json` com canal `auditor` e rebaixamento do tipo de nota ao degrau 1. Revisão posterior da fonte não é erro.

## Verificações independentes

```
python3 -m pesquisa.fatos_conjuntura --verificar notas/2026-08/pacote.json   # fatos contra a gold
python3 -m pesquisa.validador notas/2026-08/nota.md --pacote notas/2026-08/pacote.json
python3 -m pesquisa.sentinela                                                 # bateria mecânica
python3 -m pesquisa.sentinela_semantica preparar pesquisa/sentinelas_semanticas/rodadas/AAAA-MM-DD
python3 -m pesquisa.sentinela_semantica avaliar pesquisa/sentinelas_semanticas/rodadas/AAAA-MM-DD
python3 -m pesquisa.metricas notas/                                           # ciclos e degrau
python3 -m unittest discover -s pesquisa/tests -t .
```

## Limites declarados

- A bateria mecânica foi escrita pelo mesmo autor do validador; a semântica foi escrita por um agente de modelo distinto dos três revisores, mas do mesmo fornecedor.
- Os três revisores são do mesmo fornecedor. Erro correlacionado é medido pela lista `perdidos_por_todos` da bateria semântica, não eliminado.
- A bateria semântica usa uma única nota base; recall medido nela não garante recall em notas de outra estrutura.
