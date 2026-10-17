# Judiciário — Brasil e outros países

Pedido: comparar o Judiciário brasileiro com o de outros países e aumentar a utilidade do painel para a sociedade. A tarefa da nova página é permitir examinar acesso, resposta, cumprimento e garantias nas mesmas perguntas e edição, com uma agenda de resultados para as pessoas. Não se promete que uma diferença entre países seja o efeito alcançável de uma reforma.

## Fonte e escolha do recorte

A organização `worldjusticeproject` foi conferida pela API GitHub em 17/10/2026: organização verificada, site institucional `https://worldjusticeproject.org/`. O repositório de perfis publica a planilha histórica. Arquivo fixado em `0e1ca8e3e3ed3ba1ccdb5ed57ff688a90c7d77d3`, blob `b5773055af20c8e4cc25f0b8e26918543ff262c3`, SHA-256 `7e38aebfe8bf54f7d782d459ca9b8e910da5211ee81cba7fb8e9f33c5f98e642`. Bytes do original preservados em `pipeline/judiciario/seed/wjp-historico.xlsx`; origem, verificação, nomes e limites em `wjp-origem.json`.

A edição **2025** foi adotada explicitamente: 143 países/jurisdições, 16 escores (fatores oficiais 7 e 8 e seus sete subfatores). A planilha também tem 2026, mas a divulgação/revisão mais recente não pôde ser conferida no portal bloqueado. A adoção de 2025 não afirma que a outra edição seja sintética; evita promover automaticamente um recorte não confirmado. O README do publicador ainda distingue dados de 2025 de peças de layout com rótulos 2026. Nenhum rótulo é deslocado para parecer mais recente.

A série exibida preserva dez edições entre 2015 e 2025 e 1.288 registros país/edição. **2017–2018 é uma edição conjunta**, apresentada uma vez. O gráfico usa 2018 como posição desse ponto e conserva o rótulo original na tabela e exportação. Lacunas interrompem linhas. Nomes em português reaproveitam somente o catálogo IBGE preservado no saneamento, com hash registrado; grupos e valores não vêm daquele domínio. Na ausência de nome IBGE, permanece o nome WJP.

O índice mede experiências e percepções, com pesquisas domiciliares e questionários de especialistas. Edição não é janela comum de entrevistas. A definição em inglês é preservada por coluna; a tradução editorial está no contrato TypeScript. Não é percentual de pessoas, tempo em meses, taxa administrativa de cumprimento ou custo-benefício.

## O que se compara

- Brasil sempre presente; até três outros países selecionáveis, com atalhos geográficos explícitos. Padrões: Portugal, Chile e Uruguai; não foram escolhidos por uma ordenação dos escores.
- Mesma edição e indicador, escala fixa 0–1, cores de identidade e rótulos diretos. O fator criminal abrange investigação e sistema correcional, além dos tribunais.
- Referência: mediana dos **outros** países com valor, excluindo o Brasil, dando peso igual aos países. Opções: América Latina e Caribe (31 outros), renda média alta registrada na fonte (43 outros), mundo (142 outros) ou selecionados. Região/renda correspondem ao registro da edição adotada; a coluna de renda foi acrescentada pelo publicador dos perfis e não é recalculada nem aplicada retrospectivamente a outros anos.
- Cobertura elegível e observada junto à mediana; ausência não vira zero. Duplicata na URL não aumenta peso. Referência sem país permanece ausente.
- Sete dimensões civis e maior diferença positiva para a mediana: diferença em pontos do índice, sem nova nota composta ou promessa de ganho. Não há intervalos de incerteza nesta extração; diferenças pequenas não demonstram significância estatística.
- Histórico dos mesmos países/indicador sob demanda; sem mediana histórica de grupos com composição variável. Filtros na URL, voltar/avançar, tabelas e exportações equivalentes.

## Fronteiras metodológicas

O PDF CNJ já preservado, p. 230–231, reproduz comparações CEPEJ, com conceitos e períodos diferentes. O recorte europeu citado remete à coleta 2022, enquanto o brasileiro é 2025. Somar instâncias/classes pode contar eventos em perímetros diferentes. Disposition time é uma razão estoque/saídas, não uma média observada de duração. Esses números não foram introduzidos como referências harmonizadas nem usados para estimar economia.

O portal WJP e `www.coe.int` responderam CONNECT 403 da política de rede. Os domínios oficiais necessários foram acrescentados ao rascunho do ambiente preservando as regras anteriores. Salvar o rascunho não aplica nem publica a configuração; a base primária GitHub permitiu concluir a coleta WJP independentemente. Não houve alteração de proxy, TLS ou tentativa de contornar bloqueios. Sem acesso a bases administrativas harmonizadas, o painel não atribui custos, meses ou resultados materiais de outros países por aproximação silenciosa.

A agenda pública pede medir necessidades atendidas, custo para a pessoa, duração por coorte/assunto, garantias, cumprimento e gasto público compatível. Esses são critérios de avaliação, não novas estatísticas implementadas. Cada caminho aponta para as análises brasileiras que já existem. Os snapshots, CSVs e cálculos do CNJ não foram modificados.

## Reprodução e acesso

```
python3 -m pipeline.judiciario.internacional
python3 -m pipeline.judiciario.internacional --check
python3 -m unittest pipeline.tests.test_judiciario_internacional -v
```

A geração é offline, determinística e valida original/hash do blob, cobertura, chaves únicas, colunas e escala antes de gravar. Quatro saídas próprias em `public/eficiencia/judiciario`: edição adotada, histórico, CSV completo e manifesto. O manifesto CNJ anterior não é substituído. A mesma barreira de sessão e o cabeçalho privado do prefixo protegem os novos arquivos. O snapshot entra somente em Server Components; o histórico é buscado sob demanda. Painel protegido não entra no sitemap.

Rota: `/eficiencia-estatal/judiciario/internacional`. Entrada ilustrada, navegação do módulo, seletor, vitrine e mapa OBEE anunciam a cobertura efetivamente implementada. O método público identifica os instrumentos e disponibiliza links de download que continuam exigindo sessão.

## Validação e revisão

Build de produção aprovado: 719 páginas, incluindo lint e tipos. Oito testes Python próprios e 286 testes Vitest direcionados aprovados; geração internacional e nacional conferidas em modo `--check`. Os 6.414 testes completos passaram (um pulado); o guarda de árvore detectou edições simultâneas desta sessão em dois documentos e um capturador temporário, removido. A suíte será repetida sem edição concorrente e o CI validará o commit final integrado.

Navegador no build de produção: **60 telas e 211 verificações, sem erros**, larguras 320, 390, 768 e 1440 CSS px, relatório em [evidencias/internacional/resultado.json](evidencias/internacional/resultado.json). Inclui acesso anônimo/autenticado local, cache privado dos quatro arquivos, nove capítulos, seletor, filtros e histórico de URL, cobertura de referências, duplicatas, seleção vazia, teclado, foco após carregamento, gráfico histórico, CSVs e tabela mundial. Axe/reflow executados nos estados testados, incluindo comparação e histórico no celular/desktop. Valor exclusivo do snapshot conferido ausente de JavaScript público e HTML dos métodos.

Capturas reais, sem edição: [primeira tela desktop](evidencias/internacional/primeira-tela-1440.png), [celular](evidencias/internacional/primeira-tela-390.png), [barras no celular](evidencias/internacional/comparacao-390.png), [desktop](evidencias/internacional/comparacao-1440.png), [trajetória no celular](evidencias/internacional/trajetoria-390.png), [desktop](evidencias/internacional/trajetoria-1440.png), [entrada do módulo](evidencias/internacional/entrada-destaque-390.png). Inspeção visual de hierarquia, números, legendas, controles e tabelas; nenhuma sobreposição observada. No celular, a leitura é sequencial e tabelas mantêm rolagem local.

Autoavaliação editorial, não revisão independente. Escala 0–10; sem média compensatória. Métodos e seletor foram conferidos também nas capturas de quatro larguras da bateria; os demais capítulos continuam como regressão, sem novo redesenho. Vitrine/mapa OBEE receberam atualização factual e links, sem atribuir nova avaliação visual integral.

| Página/estado | Arte | Hierarquia | Didática | Rastreabilidade | Comparabilidade | Utilidade | Interação/a11y | Responsividade |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Internacional padrão e indicadores criminais | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |
| Internacional com referência vazia/duplicada | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |
| Histórico carregado | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |
| Entrada com comparação em um clique | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |
| Métodos e arquivos | 8 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |
| Seletor do observatório | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |

Limites: não houve leitor de tela, zoom nativo ou sessão real de produção. O método público é documental e extenso; não substitui a apresentação analítica. A utilidade do comparador não comprova impacto causal de reformas. O painel não mede custos internacionais harmonizados nem satisfação pós-atendimento. CI, revisão automática e publicação são conferidos no PR e no SHA final; capturas locais não são prova de deploy.
