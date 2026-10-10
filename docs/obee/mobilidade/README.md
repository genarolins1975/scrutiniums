# Mobilidade e transporte — Chegar aonde precisa

PR 136, em branch. Não implica merge nem publicação em produção.

## Entrega implementada

Oito páginas sob `/eficiencia-estatal/mobilidade-transporte`: panorama, tempo, transporte, acesso, seguranca, recursos, comparar e metodos. Navegação a partir do OBEE e sitemap. Renderização no servidor, filtros GET compartilháveis, ordenação explícita, paginação de 24 registros e exportação integral. Barras desde zero, referência declarada e tabela equivalente. Simulador de custo bruto de embarques identificado como cenário editável. O snapshot completo não é passado ao navegador como props.

## Edição integrada

- Censo Demográfico 2022, tabela 10330: Brasil, 27 UFs e 5.570 municípios (5.598 territórios), faixas de tempo, meio principal e proporção acima de uma hora.
- Pemob Municipal 2025: 82 municípios respondentes, atributos declarados da rede, tarifa, financiamento e estrutura de fiscalização; fluxos explicitamente referentes a 2024 conservam esse período.
- Total: 45 medidas, 136.074 observações, 135.033 válidas no snapshot de 10/10/2026. As 45 medidas incluem categorias das distribuições e dois diagnósticos de reconciliação, não 45 dimensões independentes de desempenho.
- SHA-256 do snapshot: `4c5b86b034167300041bdb4e963d759481aa8b3cf910a3c70062d91734c35353`.

O total nacional do Censo excede a soma das categorias publicadas. A diferença é mostrada como diagnóstico calculado, sem atribuir causa e sem reescalonar parcelas. Nunca se calcula o resíduo para deduzir uma célula suprimida. Documento específico: `RECONCILIACAO_CENSO.md`.

## Ainda não integrado

Acessibilidade espacial a oportunidades do Ipea, mortalidade/lesões do SIM e despesas/entregas reconciliadas do Siconfi. A página de acesso trata atributos físicos e não os apresenta como acesso a empregos ou serviços. Segurança trata estrutura de fiscalização, não risco ou resultados. Receitas e subsídios declarados não equivalem a gasto público consolidado. Não há nota de eficiência e os escores existentes não foram alterados.

## Rastreabilidade e reprodução

`data/eficiencia_mobilidade/gold.json` é verificado pelo SHA-256 antes de servir. O pacote versionado `originais.tar.gz.b64` contém respostas e manifesto, incluindo todas as partes das consultas IBGE. As junções são refeitas a partir das partes com hash conferido. Zero, ausência, supressão, não aplicabilidade e inconsistência permanecem estados distintos. O CSV usa ponto decimal, ponto e vírgula e proteção contra fórmulas textuais; inclui território, período, numerador, denominador, célula/consulta, fonte e captura. Não é truncado pela paginação.

Reprodução local sem rede:

```sh
python3 -m unittest pipeline.tests.test_eficiencia_mobilidade
python3 pipeline/eficiencia_mobilidade/reproduzir.py --saida /tmp/obee-mobilidade
npm run lint
npx tsc --noEmit
npm run build
npx vitest run src/tests/obee-mobilidade.test.ts src/tests/obee-mobilidade-censo.test.ts
```

O workflow de fontes agora é somente leitura: reextrai os originais a cada alteração relevante e exige identidade byte a byte com o snapshot. A rotina temporária que gravava candidatos na branch foi removida; não há nova coleta nem escrita remota automática nesse workflow. `pipeline.sha256` é registro legado da coleta inicial e não é usado como cache de validação.

## Estado de aceite

A coleta e a primeira reprodução sem rede foram aprovadas antes da gravação do snapshot. Lint e tipos passaram na revisão anterior. Os resultados de build, contratos de interface e auditoria HTTP/responsiva do commit final devem ser conferidos no CI e registrados no PR, sem presumir aprovação pela existência dos testes.

O roteiro de navegador cobre oito rotas em 320, 390, 768 e 1440 px, controles, axe, filtros, tabelas, exportação e erros. Capturas são evidência de execução, não atestado de revisão estética independente. Não há teste com usuários, leitor de tela real ou nota estética 9/10 atestados. A disponibilidade e as exportações em produção só podem ser confirmadas após uma publicação autorizada.
