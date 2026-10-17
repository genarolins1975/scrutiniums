# Judiciário — validação de 17/10/2026

## Resultado e perímetro

Implementação dos três ramos com 57 fichas e dados reais. Fonte integral do CNJ obtida e conferida, pipeline reproduzível, seis capítulos, comparação, jornada e integração com o OBEE/Acesso à Justiça. **Não corresponde ao atendimento integral de todos os itens da especificação:** histórico individual, despesa por TRF, nominal histórico, detalhamento completo de custeio/investimento/tecnologia, população/jurisdições, metas, eventos de cumprimento e pesquisa de satisfação permanecem fora do recorte. A matriz completa consta no README e nos métodos.

Validação local sobre `main` integrado em `d7409e8ac` (base `0d559203981ee187cc9ff77d5e9ba72007e4dada`), seguida da correção de renderização SSR dos títulos SVG financeiros. Não confundir este registro com CI remoto, merge ou deploy; esses estados são conferidos no PR e na resposta final, no SHA efetivamente integrado.

## Evidência executada

| Verificação | Resultado |
|---|---|
| PDF oficial da Biblioteca Digital | 25 MB; SHA-256 `7aafbf664cbd3edadf46492151988468e154fe9cb131b460fe7dde335c3dca19`, idêntico ao original identificado |
| Sementes e saídas | `python3 -m pipeline.judiciario.run --check` aprovado; hashes de todas as saídas conferidos |
| Testes próprios de dados | 8 aprovados: duplicatas, ausência/zero, denominador, unidades, médias, índices oficiais, reconciliação, integridade, repetibilidade e preservação do snapshot válido |
| Pipeline completo integrado | 1.854 testes executados; sem falhas, 6 pulados |
| Pesquisa | 69 testes aprovados |
| Lint e tipos | Aprovados; build também executou ambos após a integração |
| Build final | Aprovado; 718 páginas estáticas geradas, incluindo as novas 66 páginas |
| Vitest completo integrado | 293 arquivos; 6.353 testes aprovados e 1 pulado. Após ajuste do título SVG, 226 testes direcionados e a bateria de navegador foram repetidos e aprovados |
| Navegador final, build de produção | 52 telas, 113 verificações aprovadas, nenhum erro JavaScript ou de console |
| Quatro larguras | 320, 390, 768 e 1440 CSS px; 13 rotas/estados em cada largura, sem overflow global e sem violações axe nos critérios WCAG 2/2.1 A/AA testados |
| Navegação existente | Sete observatórios conferidos com e sem sessão, home logada mantendo o seletor e vitrine anônima contendo a entrada nova |
| Acesso e cache | Painéis/fichas/arquivos redirecionam sem sessão; método público; downloads autenticados 200 e cache privado |

O relatório de navegador em [evidencias/resultado.json](evidencias/resultado.json) pertence à rodada iniciada em `2026-10-17T08:36:21.937Z`. Hash do snapshot efetivamente testado: `d3d516a84bc550559eb217ac09d810e5d6b107de8e7cfeb599c796be33746bb3`. O verificador compara esse identificador com o arquivo publicado; não são resultados antigos reutilizados.

## Fluxos e método

- Seleção de três TJs, mudança de medida, recarregar, voltar/avançar, URL compartilhável e reset por teclado.
- Recorte incompatível entre ramo/porte explicitamente recusado, tribunal repetido não duplicado; ausência de porte dos TRFs mantida.
- Comparação e ficha de TRF3 e TRT3, além de TJSP/TJPE e nome longo de TJDFT; região não atribuída à UF da sede.
- CSV de todos os pares elegíveis, com seleção apenas sinalizada; CSV da série real com 17 anos; modo nominal restrito a 2025, sem inventar deflator.
- Tabelas, dados integrais, manifesto, 404 de tribunal inexistente, jornada e links do OBEE/Acesso à Justiça.
- Reconciliação financeira: estadual exata; trabalhista com resíduo preservado de R$ 2, dentro do limite de R$ 12,50 para parcelas/total publicados em reais inteiros. Não ajustamos parcelas.
- IAD oficial distinto da razão derivada dos volumes arredondados; taxas não agregadas pela média de percentuais; médias de tribunais não tratadas como média ou mediana dos processos.
- Original consultado visualmente nas despesas e na equação de congestionamento; amostras de tempos e IPC-Jus dos três ramos conferidas, com testes independentes. As extrações tabulares têm chaves únicas e contagens completas.

O erro de hidratação encontrado no gráfico financeiro vinha de múltiplos nós de texto dentro de `title` SVG no SSR. Foi corrigido com um único texto; a nova verificação navega e interage com o gráfico real, verifica console e passou. Esse fluxo agora integra o CI após o build, com relatório preservado como artefato. A home autenticada é verificada por navegação real, respeitando redirecionamento HTTP ou streaming, sem presumir o transporte interno do Next.

## Revisão visual e acessibilidade

Inspeção do começo, meio e fim das capturas, além da automação. Tokens, tipografia e fontes existentes; sem imagens geradas, mapas inventados, decoração de martelo, gradientes de julgamento ou escore próprio. Setas ausentes na fonte foram substituídas por SVG. Controles têm alvo mínimo de 44 px e foco; tabelas largas mantêm rolagem local e indicação. Referências não dependem somente de cor.

Evidências selecionadas:

- [Entrada desktop](evidencias/entrada-1440.png) e [celular](evidencias/entrada-390.png).
- [Recursos desktop](evidencias/recursos-1440.png) e [celular](evidencias/recursos-390.png).
- [Comparação de três tribunais](evidencias/comparacao-tres-tribunais.png) e [distribuição no celular](evidencias/comparar-390.png).
- [Ficha federal no celular](evidencias/tribunais-trf3-390.png) e [métodos](evidencias/metodos-1440.png).

Autoavaliação, não revisão independente. Escala de 0–10; sem média compensatória. A automação cobre todas as 13 rotas/estados, mas não substitui avaliação humana com leitor de tela. As notas abaixo registram limites de conteúdo e verificação, sem declarar que todos os critérios atingiram 9.

| Página/modelo | Arte | Hierarquia | Didática | Rastreabilidade | Comparabilidade | Utilidade | Interação/a11y | Responsividade |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Entrada | 9 | 9 | 8 | 9 | 9 | 8 | 8 | 9 |
| Panorama | 8 | 9 | 8 | 9 | 9 | 8 | 8 | 9 |
| Recursos | 9 | 9 | 8 | 8 | 9 | 8 | 8 | 9 |
| Tempo | 8 | 9 | 8 | 9 | 9 | 8 | 8 | 9 |
| Filas | 8 | 9 | 8 | 9 | 9 | 8 | 8 | 9 |
| Entrega | 8 | 9 | 9 | 9 | 9 | 7 | 8 | 9 |
| Acesso | 8 | 9 | 8 | 9 | 9 | 7 | 8 | 9 |
| Comparador | 9 | 9 | 9 | 9 | 8 | 8 | 8 | 9 |
| Métodos | 8 | 9 | 8 | 9 | 9 | 8 | 8 | 9 |
| Ficha TJSP | 8 | 9 | 8 | 9 | 8 | 8 | 8 | 9 |
| Ficha TJDFT | 8 | 9 | 8 | 9 | 8 | 8 | 8 | 9 |
| Ficha TRF3 | 8 | 9 | 8 | 9 | 8 | 7 | 8 | 9 |
| Ficha TRT3 | 8 | 9 | 8 | 9 | 8 | 8 | 8 | 9 |

Limites das notas: convenção fina do ajuste IPCA não explicitada na fonte; ausência de histórico individual/composição da demanda; cumprimento não mensurável; mapa de unidades/jurisdições não integrado. Evoluir nesses pontos exige base estruturada adequada, não alterações cosméticas. Leitor de tela e zoom nativo do navegador não foram verificados: houve teste de texto ampliado a 200% e reflow em larguras estreitas, que não equivalem a uma certificação integral de acessibilidade.

## Publicação

O estado de PR, CI, merge, commit integrado e deploy deve ser consultado nas evidências remotas e na resposta final. Nenhuma credencial de produção foi usada para os testes logados; o banco e os cookies da fixture são exclusivamente locais, removidos ao terminar. Em produção, métodos/vitrine/deploy e redirecionamentos podem ser conferidos sem sessão; navegação efetivamente autenticada exige uma conta válida e não é simulada com a fixture local.


### Gate remoto de Mobilidade

A auditoria de Mobilidade também foi acionada pela integração no mapa do OBEE. No primeiro run, instalação/build/contratos passaram; a auditoria encerrou antes de produzir arquivos. O workflow instalava Chromium de Playwright 1.56, mas o projeto e os imports dos scripts usam 1.64.1. O symlink criado dentro de um diretório existente não alterava a resolução. A instalação foi alinhada ao lockfile com `npx --no-install playwright install --with-deps chromium`, mantendo integralmente as auditorias e sem alterar dependências. Os resultados finais desse novo SHA constam no CI remoto do PR.

## Extensão internacional — 17/10/2026

WJP 2025: 143 países/jurisdições, 16 escores e dez edições históricas. Dados, decisões metodológicas, evidência visual e resultados próprios em [INTERNACIONAL.md](INTERNACIONAL.md). A bateria ampliada passou em 60 telas e 211 verificações. Não altera o snapshot CNJ nem converte escores em ganho monetário. A publicação desta extensão depende do CI e deploy próprios, sem reaproveitar o estado de publicação do módulo anterior.
