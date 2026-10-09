# Pedidos de mudança compartilhada: famílias Dados e fontes e Metodologia

Rotas: `/setor-eletrico/dados`, `/dados/saude`, `/dados/reproducao`, as fichas `/dados/[dataset]`, `/setor-eletrico/metodologia` e `/metodologia/avaliacao`. Cada pedido diz o que mudar, por que e em que arquivo. Nenhum bloqueia as páginas: cada uma segue com a melhor solução local, descrita no item. A equivalência de visões está em `dados-metodologia.equivalencias.json` (mesma pasta) e no fim deste arquivo.

## 0. Arquivo sem uso para apagar no fim (regra do coordenador: não apagar componente com o servidor no ar)

- `src/components/energia/CatalogoFiltro.tsx`: nenhum arquivo o importa mais. O catálogo passou a ser uma lista pesquisável só (`ListaConsultavel.tsx` com `DadosCatalogo.tsx`), com a tabela completa em Analisar. Nenhum teste o lê. `docs/observatorios/energia/BENCHMARKS.md` o cita junto de `TabelaDados` nas linhas 168 e 190 (matriz de benchmarks): ajustar o texto se o arquivo for apagado.

## 1. O "reprovado" de três CSV no relatório do módulo Dados: causa, evidência e o que pedir ao pipeline

A premissa do pedido era um falso positivo do validador, por ponto e vírgula dentro de campo entre aspas. A evidência diz outra coisa.

- O relatório (`publicacao.json`, `evidencias.checagens_reprovadas`, validação de 01/10/2026 11:22 UTC) reprova três arquivos pela checagem de esquema "linhas com número de colunas diferente do cabeçalho": `sintese_regras_diario.csv` (3.099 linhas), `mercado_nacional_mensal.csv` (18) e `empresas_financas_ajustes.csv` (3). São 3 das 2.391 checagens.
- O validador lê com `csv.reader(fh, delimiter=";")` e `newline=""` (`pipeline/energia/validacoes.py`, linhas 376 e 424 a 428): o módulo `csv` do Python respeita aspas, então ponto e vírgula entre aspas não vira coluna a mais. Não há falso positivo.
- As impressões digitais que o relatório julgou são de versões anteriores, que estão no git: `da0546c15` (sintese_regras_diario), `e96f2de8d` (mercado_nacional_mensal) e `94034d8c1` (empresas_financas_ajustes). Rodado nessas versões, o mesmo leitor do validador encontra exatamente 3.099, 18 e 3 linhas com colunas a mais: o texto livre de uma coluna (`detalhe`, por exemplo "horas no piso SE:4 S:4 NE:19 N:24; dia inteiro N") tinha ponto e vírgula sem aspas.
- O commit `8086b52b3` (08/10/2026, defeito D005) corrigiu a escrita: `base.escreve_csv` passou a citar o campo com ponto e vírgula (RFC 4180) e regravou só essas linhas. A versão publicada tem 0 linhas fora do padrão (3.099 → 0, 18 → 0, 3 → 0, com o leitor do validador), e a impressão digital do arquivo na lista de arquivos (manifesto) é a da versão corrigida. A mensagem do commit já diz: "publicacao.json segue listando os três como reprovados até a próxima execução completa do módulo Dados".

O que as páginas fazem hoje, sem alterar o relatório: junto de cada link de CSV (Saúde, Download e reprodução e fichas), a frase "Validação automática: reprovada na versão de 01/10/2026 (…); o arquivo publicado é outra versão", a releitura do arquivo publicado ("tem 12 colunas em todas as 111 linhas") e, em Analisar, as duas impressões digitais. A Metodologia explica as 3 checagens reprovadas na seção "Como o observatório confere as próprias afirmações e arquivos?". Tudo isso é calculado a cada build a partir de `dados_validacoes.csv`, do manifesto e do arquivo no disco: quando o módulo for reexecutado, a nota some sozinha.

Pedidos, nesta ordem:

1. Reexecutar o módulo Dados (`python3 pipeline/energia/executar_modulo.py dados --sem-coleta`). Esperado: 0 checagens reprovadas, `dados_validacoes.csv` e `publicacao.json` coerentes com o manifesto atual.
2. Para que isso não dependa de lembrar: o relatório só guarda a impressão digital julgada dos arquivos reprovados, então a página só consegue dizer "versão anterior" nesses. Um arquivo aprovado que for reescrito depois da validação aparece como aprovado sem aviso. Patch proposto, em duas partes. Em `pipeline/energia/validacoes.py`:

```diff
-def checagem(id_, alvo, tipo, resultado, detalhe, *, criterio, verificados=None, problemas=0, exemplos=None):
+def checagem(id_, alvo, tipo, resultado, detalhe, *, criterio, verificados=None, problemas=0, exemplos=None, sha256=None):
     assert resultado in RESULTADOS, resultado
     return {"id": id_, "alvo": alvo, "tipo": tipo, "resultado": resultado, "detalhe": detalhe, "criterio": criterio,
-            "verificados": verificados, "problemas": problemas, "exemplos": list(exemplos or [])[:5]}
+            "verificados": verificados, "problemas": problemas, "exemplos": list(exemplos or [])[:5], "sha256": sha256}
```

e, em `valida_csv`, calcular o hash do arquivo (leitura em blocos, como o resto da função) e passá-lo como `sha256=` à checagem `:legivel` (linha 417). Em `pipeline/energia/modulos/dados.py`, linhas 1205 a 1208, acrescentar a coluna ao CSV:

```diff
-    _csv(CSV["validacoes"], ["id", "alvo", "tipo", "resultado", "detalhe", "criterio", "verificados", "problemas", "exemplos"],
+    _csv(CSV["validacoes"], ["id", "alvo", "tipo", "resultado", "detalhe", "criterio", "verificados", "problemas", "exemplos", "sha256_julgado"],
          [[k["id"], k["alvo"], k["tipo"], k["resultado"], _limpa(k["detalhe"]), _limpa(k["criterio"]), k["verificados"],
-           k["problemas"], json.dumps(k["exemplos"], ensure_ascii=False, separators=(",", ":"), default=str).replace(";", ",") if k["exemplos"] else None]
+           k["problemas"], json.dumps(k["exemplos"], ensure_ascii=False, separators=(",", ":"), default=str).replace(";", ",") if k["exemplos"] else None,
+           k.get("sha256")]
           for k in todas_checagens])
```

Com a coluna, `validacoesDosCsv` e `estadoDoArquivo` (`src/lib/energia/dados-servidor.ts`) passam a comparar a impressão digital julgada com a do manifesto em todo CSV, e não só nos reprovados (mudança pequena, que faço quando a coluna existir; sem ela, nada muda).

3. Os 9 CSV do manifesto que o relatório não cobre são todos do próprio módulo Dados (`dados_calendario`, `dados_catalogo`, `dados_conjuntos`, `dados_eixos`, `dados_recursos_aneel`, `dados_recursos_ccee`, `dados_recursos_ons`, `dados_revisoes`, `dados_validacoes`), gravados depois da validação. A página diz "o relatório desta publicação não cobre este arquivo", nunca aprovado. Se o relatório passar a incluir os arquivos do módulo, o aviso some.

## 2. Revisões na Saúde: o que confere, o que não confere e onde está a divergência

O histórico de revisões da Saúde é coerente consigo mesmo: o resumo de `publicacao.json` (3.057 valores revisados em 392 períodos de 4 integrações) é a soma das integrações (2.620 + 33 + 44 + 360), e cada revisão traz as duas capturas, com a anterior guardada. As divergências estão em outros lugares:

- Água e clima. As fichas "Comprove" de EAR e ENA dizem "Nenhuma revisão detectada entre as capturas integradas", e a Saúde registra 44 valores de EAR (9 períodos, maior revisão relativa de 0,19%) e 360 de ENA (30 períodos, 6,25%). É o item D6 da lista do coordenador (texto da ficha vem de `c.snapshot_de(...).get("revisoes")` em `agua_detalhe.py`). Na Saúde, a ponte entre os dois critérios (capturas consecutivas do mesmo arquivo contra uma recaptura em 30 dias) está escrita em `TEXTO_PONTE_REVISOES` (`dados-leitor.ts`) e aparece na seção das revisões, com link para Água e clima.
- Valor impossível na primeira captura. A integração Carga de Energia Diária registra, como maior revisão relativa, `carga_mwmed.NE` de 26/09/2026: de −668,879 para 13.984,696 MWmed (+2.190,8%). Carga negativa não existe. Não há texto da fonte que explique; a página mostra o que a gold registra, com "uma revisão grande não prova erro". Pedido de pipeline: validar valor fisicamente impossível (carga negativa) antes de guardá-lo como observação, ou marcá-lo como captura incompleta. A maior revisão da Saúde (Balanço de Energia nos Subsistemas, `carga.NE` de 26/09/2026 08:00, de 63,185 para 13.115,052, +20.656,6%) parece do mesmo tipo (valor de hora ainda não consolidado na primeira captura), mas a gold não diz isso.

## 3. Versão do código das bases e o sufixo `+alterado`

- Cada base é gerada por um módulo, em horário próprio, com uma versão de código própria. Em 09/10/2026: `publicacao.json` 685bb4bc29fd+alterado, `meta.json` 196905461ac0, `metricas.json` e `arquivos.json` 1f075868ed56+alterado, `manifesto.json` e `avaliacao.json` c41b9e6f1b95+alterado, `agua_detalhe.json` ac7599ce6c86+alterado. Das 31 bases do manifesto, 26 levam o sufixo, 4 têm o código todo registrado e 1 não registra versão (`catalogo.json` não tem o campo `versao_codigo`).
- A página Download e reprodução explica o sufixo (o código tinha mudanças ainda não registradas, então refazer a base a partir da versão indicada pode dar outro resultado) e lista a versão de cada base. É o item D4 da lista do coordenador (gerar a versão com árvore limpa antes da publicação final). Pedido pequeno de pipeline: gravar `versao_codigo` também em `catalogo.json`.

## 4. Nome legível dos arquivos para baixar

137 dos 147 arquivos que as fichas oferecem não têm descrição própria (nem em `ROTULO_DO_ARQUIVO`, de `dados-ficha.ts`, nem no dicionário `arquivos.json`, que traz só a lista de colunas). O nome mostrado vinha do nome do arquivo sem sublinhados ("Regulacao limites pld conferencias"). `rotuloDoArquivo` agora restaura siglas e acentos de uma lista de palavras (PLD, EAR, MMGD, "regulação", "horário"…), o que resolve a grafia, não a clareza: "Qualidade conjuntos anual 2000 2009" continua sendo um nome de arquivo. Pedido de dado: o pipeline escrever o campo `rotulo` de cada arquivo em `arquivos.json` (uma frase curta, como as dez já escritas à mão em `ROTULO_DO_ARQUIVO`). A página passa a usá-lo na hora, sem outra mudança.

## 5. `TabelaInterativa`: tamanhos de página menores

`tamanhoPagina` só aceita 25, 50, 100 ou 200. A avaliação (94 páginas e os defeitos abertos, em Analisar) fica em 563 a 585 kB de HTML com o fluxo RSC, perto da meta de 600 kB, e uma tabela que abrisse com 12 linhas tiraria cerca de 20 kB sem perda (medido: 563 kB com 12 linhas, 585 kB com 25). Proposta: aceitar 10 e 12. O que a página cortou do que é dela: as 94 linhas da tabela de páginas viajam em matriz compacta (chaves uma vez), a matriz de entregas perdeu as classes repetidas em cada célula (cerca de 25 kB), e as duas tabelas ficam fora de Entender.

## 6. `FaixaMetricas` no celular

Com quatro medidas, a faixa ocupa 360 a 450 px em 390 px de largura (uma linha por medida, cada uma com rótulo, data, selo e nota). Com o cabeçalho (título, lead, recorte e fonte), a primeira figura de cada página fica abaixo da primeira tela em 390 por 844: lista do catálogo em y=1171, gráfico da Saúde em y=1288, passos da Reprodução em y=1390, matriz da Avaliação em y=1234 (em 1440 por 900, todas começam na primeira tela, de y=606 a y=876). Nada se perde, mas o celular abre com números e sem figura. Proposta: uma variante compacta para duas a quatro medidas (valor e rótulo na mesma linha, nota e período numa segunda linha menor, duas colunas a partir de 360 px). Local: `FaixaMetricas.tsx` e as regras `.ed-faixa-grade` de `globals.css`.

## 7. Resolvido por componente do coordenador

- `NavegacaoLocal nivelTitulo={3}` (capítulos dentro do painel), `RespostaCurta depois`, legenda e coluna "Ano" sem separador de milhar: usados como pedidos. A faixa de abas de duas colunas no celular (S14) vale para a Saúde, a Reprodução e a Avaliação.

## Equivalência de visões (comparador do coordenador, 12 rotas, 1440 px, três níveis)

Resultado: 0 visões sem par e 0 controles sem equivalência nas 12 rotas, com `dados-metodologia.equivalencias.json` (82 ocorrências restantes são rotas de outras famílias que esta extração não percorreu). Arquivos para baixar e fichas "Comprove este número": nenhum a menos em nenhuma rota.

- `/dados`: 27 visões antes, 38 depois. O painel "Quais dados estão de fato validados?" virou "Quais conjuntos existem, e até onde cada um chegou?". A tabela do catálogo (415 linhas) passou de Entender para Analisar, e a lista pesquisável única, em Entender, traz as mesmas colunas por conjunto, com o estado mais avançado e o histórico de estados no detalhe. "Conjuntos integrados" e "catálogo completo" são uma lista só. O filtro "Estado alcançado" virou "Estado mais avançado" (mesmas opções e contagens) mais o seletor cumulativo "Estado: chegou a". O gráfico de arquivos por portal e a tabela dos 733 arquivos da CCEE ficam em Analisar. Controles: 15 antes, 19 depois.
- `/dados/saude`: 19 antes, 26 depois. O painel "O que atrasou ou mudou?" virou o título da página, e o painel passou a perguntar "Como cada integração está frente ao prazo da fonte?" (mesmo id, mesmas fontes). Gráfico por cadência, tabela das 151 integrações, calendário e revisões continuam em Entender.
- `/dados/reproducao`: 12 antes, 21 depois. O painel "Consigo reproduzir este gráfico?" virou o título da página; o painel pergunta "Quais são os passos para refazer um número?". A tabela dos 270 arquivos continua em Entender.
- `/metodologia`: 11 antes, 31 depois. O painel "Quais interpretações são permitidas?" é o mesmo; a tabela das 276 regras passou de Entender para Analisar, e a lista pesquisável de indicadores, com a regra em quatro partes no detalhe, está em Entender, junto da porta por tarefa, da linhagem visual e do exemplo reproduzível. As afirmações conferidas e a tabela de natureza e validação seguem em Analisar, e as regras do pipeline, em Auditar. Controles: 4 antes, 7 depois.
- Fichas de conjunto (8 da amostra): 25 visões antes, 58 depois; todas casadas.
- `/metodologia/avaliacao` (fora do inventário "antes"): matriz de entregas, gráfico por dimensão e avisos em Entender; tabelas de páginas e de defeitos, jornadas, revisão e evolução em Analisar; rubrica e método em Auditar.
