# Arquitetura bilíngue da Scrutiniums

Decisão proposta na fase 0, sobre a `main` após o merge do PR #196 (`38afb8e6e`). Este primeiro PR é documental: não move páginas, publica traduções nem altera autenticação. A implementação será dividida em PRs pequenos, com CI verde antes do próximo.

## 1. Endereços e renderização

Adotar uma camada própria, sem dependência nova. Português continua nos endereços atuais, sem prefixo; inglês usa `/en` e os mesmos slugs. Não haverá redirecionamento automático por idioma, cookie ou `Accept-Language`.

Manter a árvore portuguesa em `src/app` e acrescentar wrappers em `src/app/[lang]`, com `generateStaticParams()` retornando somente `{ lang: "en" }` e `dynamicParams = false`. O prefixo público inglês é fixo; o segmento permite transmitir o idioma aos componentes. Não criar `/pt`. Preservar os parâmetros estáticos dos segmentos internos e o comportamento dinâmico das páginas que já precisam de sessão.

Cada wrapper utiliza o mesmo componente de conteúdo, extraído quando necessário, com idioma explícito. Componentes ainda não traduzidos recebem a marcação de ausência descrita abaixo. Não duplicar lógica analítica nem criar um catch-all que transforme qualquer caminho desconhecido em página válida. Um inventário de rotas confere a existência das irmãs públicas e protegidas, inclusive os parâmetros dinâmicos publicados.

O `RootLayout` continua servidor, preservando fontes, CSS e exports de metadados. Um componente cliente pequeno, `DocumentoIdioma`, renderiza `<html>` e `<body>` e determina `lang="pt-BR"` ou `lang="en"` com `usePathname()`, por correspondência exata de `/en` ou `/en/`. Os filhos continuam sendo Server Components quando já o são. Não ler cookies ou headers para decidir o idioma do HTML; isso comprometeria a geração estática. Não manter idioma em variável global mutável no servidor.

Esta é a alternativa ao movimento integral para `[lang]` com rewrite português. Esse movimento deslocaria arquivos como `.next/server/app/setor-eletrico.html` para `/pt/...`, quebrando contratos existentes de HTML e testes que leem `src/app/page.tsx` e `layout.tsx`. A árvore paralela preserva esses caminhos, conteúdo português e geração estática; as alterações intencionais de HTML limitam-se à infraestrutura bilíngue, como seletor e metadados. Não copiar artefatos de build para esconder uma mudança de rota.

**Prova isolada:** um microprojeto fora do repositório, com Next 14.2.35, gerou `/` e `/en` estaticamente e produziu respectivamente `<html lang="pt-BR">` e `<html lang="en">`. Chromium navegou por `next/link` de `/` para `/en` e de volta, preservando o documento e atualizando `lang`, sem erro de hidratação observado. O root recebeu `params={}` nas duas rotas; portanto, ler `params.lang` diretamente no root não é alternativa válida. Houve um erro genérico de recurso HTTP 404 no microprojeto, sem URL identificada. A prova não valida o aplicativo completo: middleware, SEO, 404, parâmetros, acessibilidade e cache ainda exigem testes no repositório. A home atual consulta sessão e continua dinâmica; não remover seu redirecionamento de usuário autenticado para forçar prerender.

## 2. Navegação, acesso e SEO

Funções puras centralizam a leitura do idioma, remoção de um único prefixo `/en` e construção de URLs. Preservam query string e fragmento. Não tratam `/english`, `/enx` ou prefixos repetidos como versões equivalentes. O seletor no cabeçalho público e em cada observatório leva à mesma página no outro idioma e grava a preferência em cookie; a URL continua sendo a autoridade para renderizar. Não haverá sugestão por `Accept-Language` nesta implementação inicial.

`rotasPublicas.ts` aplica a mesma lista à rota portuguesa e à irmã inglesa. A normalização precede todas as decisões do middleware, incluindo API de dados, validação de Mobilidade e administração. Sessões, revogação e autorização administrativa permanecem obrigatórias. Login inglês preserva o destino completo em `/en`, inclusive no cookie de destino. Rotas desconhecidas continuam fechadas por padrão; conhecer um idioma nunca concede acesso.

APIs, assets, arquivos gold e seus endereços atuais permanecem compartilhados. Não prefixar automaticamente `/api`, `/_next`, `/obs/data/gold` ou URLs de fontes. Handlers de página, exportação e incorporação recebem tratamento explícito, com a mesma proteção. Redirecionamentos legados portugueses permanecem intactos; eventuais irmãs inglesas preservam idioma e destino equivalente.

Um helper servidor compõe metadados por rota e idioma: canonical próprio; hreflang recíproco `pt-BR`, `en` e `x-default` português; `og:locale` como `pt_BR` ou `en_US` e `og:locale:alternate`; `inLanguage` como `pt-BR` ou `en` no JSON-LD. Preservar `noindex` e demais condições editoriais existentes. Wrappers não herdam silenciosamente canonical ou descrição portugueses como se estivessem traduzidos. Quando faltar texto, os metadados declaram a indisponibilidade em inglês e não inventam uma descrição do indicador.

O sitemap parte do inventário existente, filtra pela lista pública e emite as duas versões, com `alternates.languages`. Nunca inclui painéis fechados. As restrições de robots aplicáveis à conta e a fluxos sensíveis também abrangem as irmãs inglesas. Testes verificam metadados no HTML e no handler da SPA, além da configuração em código.

## 3. Dicionários, glossário e formato

`src/i18n/pt.ts` define as chaves e contratos de interpolação; `en.ts` implementa o mesmo tipo, com ausência de chave reprovando `tsc`. Toda entrada tem estado explícito: traduzida ou português marcado. O segundo estado referencia o original, não uma tradução aproximada. Um componente comum mostra **Portuguese only** e envolve o trecho original em `lang="pt-BR"`; o aviso tem idioma inglês. Isso também vale para rótulos, avisos, lacunas e nomes acessíveis sem tradução. Atributos como `aria-label`, `alt`, `title` e `placeholder` não aceitam wrappers: o elemento portador recebe `lang="pt-BR"` e um marcador visível associado, ou o nome acessível referencia texto marcado por `aria-labelledby`. O teste verifica essa associação e o idioma efetivo do atributo. A cobertura distingue estado declarado e uso efetivo nas rotas.

`config/glossario-en.json` é a única fonte de termos técnicos: identificador estável, termo português, equivalente inglês, fonte primária em inglês com URL e localização verificável, e nota para alternativas de mercado. Dicionários e modelos referenciam os identificadores; verificações impedem equivalentes divergentes. Fontes admissíveis incluem BCB, ANEEL, ANP, IBGE, Tesouro, OECD e IEA. Sem fonte conferida ou entrada aprovada, manter português marcado e registrar a decisão pendente no PR. Este documento não propõe traduções técnicas sem fonte.

Nomes próprios, programas, órgãos, sistemas, bases e nomes oficiais de séries permanecem em português. O glossário registra sua explicação inglesa, apresentada na primeira ocorrência quando necessária. Não substituir Desenrola, Bolsa Família, Tarifa Social, Pix, SINISA, SISAGUA, Siconfi, ESTBAN, IF.data, ANEEL, ANP, ONS, CCEE, BCB ou IBGE por nomes inventados.

`src/lib/format.ts` centraliza número, moeda, percentual, datas e referências mensais, recebendo idioma explicitamente; uma transição compatível pode manter português como padrão enquanto as chamadas migram. Inglês usa `en-US`, vírgula de milhar, ponto decimal e BRL exibido como `R$` pelo `Intl`. Datas inglesas seguem `Oct 14, 2026`, e referências mensais, `Aug 2026`. Preservar precisão, unidades, fuso e valor do português; mudança de apresentação não recalcula o dado. Migrar todas as chamadas com locale fixo. Um teste impede novos `toLocaleString("pt-BR")` e `Intl.NumberFormat("pt-BR")` fora do formatador e suas verificações, sem uma lista permanente de exceções legadas.

O inglês mantém registro técnico e neutro, sem juízo de valor sem régua, rating, recomendação ou previsão; não usa em dash ou en dash na prosa. Hífen só em palavra composta que o exija. A interface usa o design system existente, seguindo `.claude/skills/observatorio-layout/SKILL.md`, com números e datas no idioma escolhido.

## 4. Textos do pipeline sem modificar a gold portuguesa

Escolher uma estrutura paralela de arquivos, em vez de acrescentar `_en` à gold atual: `public/i18n/en/<dominio>/<identificador-estavel>.json`. Cada arquivo contém `schema_version`, `source: { path, sha256 }`, `glossary_sha256`, `templates_sha256` e `textos`, indexado pelo JSON Pointer do campo português. Cada entrada informa `texto_en`, os identificadores de `termos` e, quando aplicável, `modelo` e referências de `argumentos` ao pacote de fatos. A fonte pode estar em `public` ou em snapshots de `src/lib`, como ocorre nas contas públicas.

Essa estrutura é a versão inglesa ao lado lógico de cada campo português: não duplica nem recalcula séries. O consumidor só utiliza traduções cujo hash corresponda à fonte; tradução ausente ou desatualizada produz português marcado e pendência de cobertura. Campo numérico, identificador, código, URL ou nome oficial não vira texto livre traduzível. Os arquivos ingleses mantêm a regra de acesso da fonte; não abrir todo `/i18n` para contornar a proteção dos dados.

Os pipelines de cada domínio geram esses arquivos com biblioteca padrão Python, glossário e modelos de frase versionados em `pipeline/i18n/templates/<dominio>.json`. Ordenação e serialização são fixas, sem timestamp corrente nem tradução por modelo de linguagem no pipeline ou em execução. Novos modelos sem correspondência exata deixam pendência, sem adivinhar significado.

Testes rejeitam pointer inexistente, hash incompatível, argumento sem origem e qualquer mudança nos bytes dos arquivos portugueses. Toda ocorrência numérica do par de textos é comparada por valor e papel, normalizando apenas convenções de apresentação; os números vêm dos mesmos argumentos referenciados. Não basta comparar somente números explicitamente declarados pelo tradutor: a análise também detecta números introduzidos na prosa. Referência temporal, sinal, unidade e precisão preservam o contrato original. Os testes atuais de valores, gold e HTML não serão ajustados para acomodar diferenças.

CSV, XLSX, PNG de `BaixarImagem` e citação copiada usam idioma da página, cabeçalhos e rótulos do glossário, com os mesmos valores e recortes. CSV conserva o contrato de codificação e separador declarado; valores numéricos de XLSX continuam numéricos. Testes comparam os dados exportados, separadamente dos rótulos traduzidos.

## 5. Crédito, cadastro e comunicações

A SPA continua atendida por handler próprio; `/en/observatorio/[[...rota]]` reutiliza a implementação com idioma explícito. `observatorioHead` gera shell e SEO por idioma. `public/obs/app.js` identifica o prefixo, carrega `public/obs/i18n/en.json` e usa `BASE` compatível com `/en/observatorio`; `DATA_BASE` não muda. O JSON é artefato determinístico das mesmas chaves e termos versionados, não um glossário concorrente. A implementação JavaScript de formato segue o mesmo contrato e casos de teste do formatador TypeScript. Embeds, links literais, histórico, permalinks, exportações e seus filtros preservam idioma; o handler mantém 404 reais e as regras de sessão. O carregamento inicial da SPA participa dos testes de vazamento, incluindo o DOM após carregar os dados.

Na fase 2, `src/lib/phone.ts` amplia países e lê `SMS_PAISES_PERMITIDOS` como códigos ISO separados por vírgula; vazio permite somente Brasil. A validação ocorre no servidor e usa o país real do telefone normalizado. CPF é obrigatório se e somente se o telefone **verificado** for `+55`, independentemente do idioma. Para estrangeiros, unicidade pelo telefone E.164 verificado. Confirmar nulabilidade de `cpf`, índices e concorrência; qualquer ajuste necessário recebe migração testada. Limites por país e prefixo complementam os atuais de `ratelimit.ts`, com casos de abuso e preservação dos limites existentes.

Adicionar idioma preferido do usuário com migração e padrão português para contas existentes, gravado no cadastro e editável em Conta. Emails transacionais, convites, boletim mensal e SMS de verificação usam essa preferência. Antes de existir usuário, o fluxo leva o idioma selecionado explicitamente. A escolha jamais altera elegibilidade, verificação ou unicidade.

Termos, privacidade e Constituição em inglês são traduções de cortesia com aviso no topo de prevalência do português, sem compromissos novos. `/en/sobre/governanca` será renderizada de `docs/CONSTITUICAO.en.md`, com paridade de artigos e itens frente ao original e as mesmas omissões públicas declaradas pelo renderer atual. `docs/CONSTITUICAO.md` e `notas/` permanecem intocados. Campos vazios de `config/institucional.json` permanecem vazios.

Mudanças materiais de privacidade para titulares fora do Brasil e transferência internacional entram primeiro no português e são destacadas como pendentes de validação do dono; a tradução acompanha. O PR de cadastro lista as ações externas: habilitar países no Twilio Verify Geo Permissions, definir `SMS_PAISES_PERMITIDOS` e validar privacidade. Não ampliar países em produção por suposição.

## 6. Cobertura, testes e ordem de entrega

`scripts/cobertura-i18n.mjs` gera `docs/i18n/cobertura.json` deterministicamente a partir das fontes de código: interface, dicionários, glossário, inventário de rotas e modelos de frase. O CI exige igualdade desse relatório com o arquivo versionado. A situação dos campos da gold é calculada separadamente por `--gold`, sem arquivo versionado e sem condicionar a publicação de dados. Ausência de catálogo semântico não conta como cobertura completa; campos candidatos não são traduções comprovadas.

Novos testes percorrem o HTML inglês no padrão de `html-gerado.test.ts`, exigindo build quando `EXIGIR_BUILD_HTML=1`, e detectam palavras funcionais portuguesas fora de nomes próprios registrados e trechos marcados. A verificação inversa identifica inglês indevido no português. As exceções são específicas, auditáveis e contadas; scripts, estilos e dados de máquina não são prosa. Complementar com atributos acessíveis, páginas dinâmicas e DOM da SPA. Paridade cobre rotas abertas e fechadas, parâmetros, login, administração, query e hash. Testes existentes não são removidos, relaxados ou alterados para acomodar valores, gold ou HTML divergentes.

`npm run wcag` deve cobrir páginas inglesas sem regressão, inclusive idioma dos trechos marcados, teclado, foco, expansão de texto e responsividade. A infraestrutura terá testes próprios de formato, dicionários, metadados, vazamento, cobertura e preservação dos arquivos protegidos. Antes de cada push: `node scripts/minify-obs.mjs`, `npm run lint`, `npx tsc --noEmit`, `npm test` e os `unittest` dos domínios alterados. O CI mantém compileall, testes Python, build de produção e Vitest com `EXIGIR_BUILD_HTML=1`.

| Fase | Série de PRs e condição de encerramento |
|---|---|
| 0 | Primeiro este documento, depois contratos e glossário inicial com fontes, formatadores e cobertura, rotas/SEO/acesso, seletores e home como prova. Demais páginas somente com ausência explícita de tradução. Encerrar com paridade, vazamento, cobertura e CI verdes. |
| 1 | Home completa, Sobre, Erros, Governança, glossário, imprensa, termos, privacidade, métodos dos sete observatórios, entrada, cadastro e erros. Traduções jurídicas de cortesia e teste de paridade da Constituição. |
| 2 | Cadastro internacional, limites SMS, idioma preferido, comunicações e privacidade, com migrações, testes e ações externas declaradas. |
| 3 a 9 | Um observatório por fase, nesta ordem: Setor Elétrico, Gás Natural, Saneamento, Eficiência Estatal, Contas Públicas Federais, Contas Públicas Estaduais, SPA do Crédito. Cada série entrega interface, textos determinísticos, exportações e testes do próprio domínio. |

Cada PR tem título e descrição em português, traduções realizadas, termos propostos com fontes, pendências do dono, trecho alterado da cobertura e comandos executados com resultados. Cada fase encerra com cobertura atualizada e CI verde; não iniciar a próxima com falha pendente. Se uma decisão não puder cumprir os contratos, registrar o impedimento e a alternativa no PR antes de continuar a implementação dependente.

## Revisão do contrato de cobertura

O relatório versionado e o `--check` dependem somente de fontes de código: interface, dicionários, glossário, inventário de rotas e modelos de frase. A situação da gold é calculada por `--gold`, em relatório não versionado. A publicação diária de dados não depende da cobertura i18n; os quatro workflows de dados permanecem iguais aos da main. Esta regra substitui o contrato anterior que incluía hashes e contagens da gold no arquivo versionado.
