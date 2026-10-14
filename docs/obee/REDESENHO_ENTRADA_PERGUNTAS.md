# Entrada do OBEE organizada por perguntas

14/10/2026. Rota `/eficiencia-estatal` (área com login). Nenhum valor, fórmula, peso ou estado de elegibilidade foi alterado.

## Problema

A entrada somava quatro comparadores (abertura, índice, panorama de quatro perspectivas e aprofundamento de educação), três cartões ilustrados, uma faixa de números, o catálogo de 16 capítulos com busca, o método dos escores e treze sanfonas de cobertura. Media 9.814 px no desktop e 19.063 px a 390 px, sem uma pergunta que organizasse a leitura. O panorama justapunha a cobertura potencial da atenção primária de dezembro de 2025 (capacidade do serviço) a três condições dos moradores de 2022.

## Nova composição

| Ordem | Seção | Pergunta | Conteúdo |
|---|---|---|---|
| Topo | Retrato da capital | Como se vive na sua capital? | Contorno oficial do município (malha IBGE 2022) gravado em hachura, sete pétalas com a posição da capital em cada resultado de 2022, losangos do comparador, população do Censo 2022, área oficial e densidade |
| 01 | A vida na capital | Sete perguntas | Uma linha por resultado: valores das duas capitais, diferença na unidade original e faixa das 26 capitais com a mediana simples; tabela equivalente das 26 e CSV com ressalva |
| 02 | O que o poder público aplica e oferece | Quanto a prefeitura aplica, e que capacidade registra | Despesa municipal por habitante em Educação e em Saúde (2025) e cobertura potencial da atenção primária (dezembro de 2025), separadas dos resultados de 2022 e sem relação causal |
| Índice | Uma nota que se explica | | Componente do índice v4 sem alteração (interface conferida por `interface-v4.json`) |
| 03 | Aprofundar a educação | Escola por idade e aprendizagem | Frequência escolar por faixa etária e Saeb, preservados |
| 04 | O que ainda não se sabe | Até onde cada tema chega | Matriz de 16 temas por nível territorial (índice v4, capitais, municípios, UFs, regiões, Brasil); cada linha abre a ficha do tema, com o conteúdo das antigas sanfonas |
| 05 | Da evidência ao escore | | Método dos escores dos serviços, disponibilidade e aviso sobre esferas, preservados |

A seleção de capital e comparador fica na URL (`territorio`, `comparador`) e atualiza todas as seções; voltar no navegador restaura a seleção anterior. Os links profundos de Trabalho e renda, Mobilidade e Saúde levam o recorte das capitais selecionadas.

## Fontes novas

* **Contornos**: IBGE, API de malhas territoriais v3, `periodo=2022`, `qualidade=maxima`, e metadados de área. `scripts/obee_contornos_capitais.py --acquire` grava as 52 respostas inteiras, com sha256, em `pipeline/eficiencia_resultados/seed/contornos/malhas-2022.json.gz`; sem `--acquire`, regenera `src/lib/eficiencia/contornos-capitais.json` a partir do recorte; `--check` confere no CI. Projeção equirretangular na latitude do município e Douglas-Peucker com tolerância de 1,6 em 1.000 unidades. Partes além de três vezes o maior lado da parte principal ficam fora do enquadramento e são declaradas na página: em Vitória, quatro partes (ilhas oceânicas de Trindade e Martim Vaz). A área exibida é a oficial do IBGE.
* **População 2022, despesa por habitante 2025 e atenção primária**: lidas das golds já publicadas de Educação e Saúde e do panorama do Atlas, sem recálculo (`src/lib/eficiencia/entrada.ts`). Em Saúde, 25 das 26 capitais estão na comparação em 2025; a capital fora aparece com o motivo, fora da faixa e da mediana.

Os valores das condições são os da edição v4. Nas três medidas em comum com o panorama anterior (frequência escolar, renda e deslocamento), os 78 valores são idênticos; teste em `src/tests/obee-panorama-atlas.test.ts`.

## Removido

`AberturaCidada` (incluída a visão por Grandes Regiões da segurança alimentar, que segue no painel do tema), `PanoramaTerritorial`, a faixa de números, os cartões ilustrados da entrada e o catálogo com busca, substituído pela matriz. O arquivo `public/eficiencia/atlas/panorama-capitais.csv` continua publicado e testado.

## Verificação

`npm run build`, `EXIGIR_BUILD_HTML=1 npx vitest run` (224 arquivos, 4.912 testes aprovados, 1 ignorado), `npx tsc --noEmit`, `npm run lint`, `python3 scripts/obee_contornos_capitais.py --check`, `python3 scripts/obee_interface_v4.py --check` e `python3 -m pipeline.eficiencia_resultados.indice_v4 --verificar`. Navegador (Chromium, sessão local de desenvolvimento): 320, 390, 768 e 1440 px sem rolagem horizontal; troca de capital, URL e histórico conferidos nas três larguras. Altura da página: 9.498 px no desktop e 16.796 px a 390 px.

Contraste sobre a tinta do Atlas: texto claro 12,7:1, comparador 6,8:1, acento 9,9:1. Pontos das demais capitais sobre o papel: 3,3:1 (token `--cor-obee-atlas-ponto`).

**Não verificado:** leitor de tela, zoom de 200% e compreensão por usuários.

Capturas em [capturas/entrada-perguntas/](capturas/entrada-perguntas/).
