# Notas do Observatório

Uma pasta por ciclo (`notas/AAAA-MM/`, retrospectivos em `notas/retro/AAAA-MM/`), gerada por `python3 -m pesquisa.orquestrador`. É a única área em que agentes escrevem (docs/CONSTITUICAO.md, art. 11). Não há revisão humana: a nota só é aprovada por unanimidade dos três revisores agentes independentes (art. 6), e nada daqui vai ao site enquanto o tipo de nota estiver no degrau 1 (art. 9).

Conteúdo de cada ciclo: `pacote.json` (fatos e hashes da gold), `prompts/` e `saidas/` por papel e por rodada, `uso/` (tokens e modelo que respondeu), `validacao_mecanica_<rodada>.json`, `nota.md` (fonte com marcadores), `nota_final.md` (texto renderizado, só se aprovada), `manifesto.json` (reprodutibilidade), `decisao.json` (decisão, rodadas e parecer de cada revisor), `metricas.json`, e depois da auditoria mensal `auditoria.json` e, se houver erro, `errata.md`.

O ciclo retrospectivo `retro/2026-06` foi gerado antes da constituição v2 e não tem `decisao.json`; o auditor o ignora e ele não conta para degrau.
