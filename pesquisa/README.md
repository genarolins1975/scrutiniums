# Camada de pesquisa: nota mensal de conjuntura (piloto, degrau 1)

Opera sobre a gold publicada e fora do pipeline de números. Nada aqui escreve em `pipeline/`, `data/` ou `public/`; agentes escrevem só em `notas/`. Critério único: `docs/CONSTITUICAO.md`. Desenho e plano: `docs/AVALIACAO_AGENTES_2026-09-24.md`.

## Peças

| Módulo | Papel | Tem modelo de linguagem? |
|---|---|---|
| `fatos_conjuntura.py` | pacote de fatos: única origem de número da nota, com ponteiro para a gold e hash | não |
| `nota.py` | formato da nota com marcadores, renderizador e manifesto de reprodutibilidade | não |
| `validador.py` | validador mecânico M1 a M11; decide aprovar, devolver ou bloquear | não |
| `sentinela.py` + `sentinelas/` | casos com erro plantado; recall por categoria e falso bloqueio | não |
| `verificador_fonte.py` | confere cada valor do pacote na API do SGS no dia | não |
| `registro.py` + `registro_erros.json` | registro público de erros; alimenta os degraus | não |
| `orquestrador.py` + `papeis/` | analistas, replicador, crítico, consolidador, validador constitucional | sim, só no texto |
| `metricas.py` | métricas por ciclo e critério de degrau | não |

## Um ciclo

```
python3 -m pesquisa.orquestrador notas/2026-08                     # modo manual: gera o prompt e para
#   grave a resposta de cada papel em notas/2026-08/saidas/<etapa>.md e rode de novo
python3 -m pesquisa.orquestrador notas/2026-08 --backend anthropic # com a API (pip install anthropic)
python3 -m pesquisa.verificador_fonte notas/2026-08/pacote.json    # fonte primária no dia
```

O editor revisa `nota_final.md` e preenche `editor.json` (início, fim, decisão, erros factuais que o validador deixou passar). Erro publicado vai para `registro_erros.json`.

## Verificações independentes

```
python3 -m pesquisa.fatos_conjuntura --verificar notas/2026-08/pacote.json   # fatos contra a gold
python3 -m pesquisa.validador notas/2026-08/nota.md --pacote notas/2026-08/pacote.json
python3 -m pesquisa.sentinela                                                 # bateria sentinela
python3 -m pesquisa.metricas notas/                                           # ciclos e degrau
python3 -m unittest discover -s pesquisa/tests -t .
```

## Limites declarados

- A bateria sentinela foi escrita pelo mesmo autor do validador: o recall de 100% é otimista até o editor ou outro modelo escreverem casos novos.
- Todos os papéis usam `claude-opus-5` até a decisão sobre um segundo fornecedor (`papeis/config.json`); erro correlacionado entre papéis não está medido.
- O validador constitucional só devolve; não aprova número nem reverte bloqueio.
