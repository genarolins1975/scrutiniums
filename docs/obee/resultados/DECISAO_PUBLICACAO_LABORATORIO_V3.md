# Decisão: laboratório v3 acessível em produção

12/10/2026 · Decisão editorial do titular do repositório (`genarolins1975`), registrada pela assistência técnica que implementou a mudança.

## O que foi decidido

A rota `/eficiencia-estatal/laboratorio-cesta` passa a responder em produção, para qualquer visitante. Antes, retornava 404 fora de preview e desenvolvimento.

## O que a decisão não faz

* O laboratório **não é índice oficial**: a página continua identificada como prévia experimental, com a ressalva obrigatória do protocolo de precisão e as limitações de cobertura.
* Não aprova pesos: `approved_weights` continua `null`; `publication_ready` continua `false` em todos os artefatos; o pacote congelado de revisão (`revisao-v3-pacote.json`) e o registro de pareceres não foram alterados.
* Não registra revisão independente. O parecer técnico cruzado (automatizado) recomendou não divulgar agregado, percentil ou ranking ao público nesta edição, por precisão municipal não quantificada em cinco a seis das sete medidas e por robustez de ordem restrita a uma família de pesos. Esta decisão editorial diverge dessa recomendação, de forma consciente.
* Não muda o piloto v2 na página `/eficiencia-estatal`, que segue visível só em preview e desenvolvimento.

## Salvaguardas mantidas

* Valores originais, unidades, universos e fontes ao lado das posições relativas; classe de robustez de cada par; ressalva integral também no CSV.
* Cabeçalhos `noindex, nofollow, noarchive` e `no-store`: a página não é oferecida a buscadores.
* Desligamento sem mudança de código: definir `OBEE_LABORATORIO_V3=desligado` nas variáveis de ambiente de produção da Vercel e reimplantar; a rota volta a responder 404.

## Pendências que continuam abertas

Precisão das sete medidas, definição de habitação, aceite de pesos e compensações, revisão independente e decisão sobre a marca do produto. Ver `AVALIACAO_COMPENSACAO_V3.md` e `review-ui/README.md`.
