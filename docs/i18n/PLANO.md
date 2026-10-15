# Plano de entregas bilíngues

Base do diagnóstico: `38afb8e6e`, merge do PR #196. Este primeiro PR documenta a proposta; não declara a fase 0 concluída nem introduz traduções, rotas ou geradores. As decisões técnicas estão em [ARQUITETURA.md](ARQUITETURA.md).

## Inventário inicial

| Área | Evidência na base |
| --- | --- |
| App Router | 210 arquivos `page.tsx`; a contagem não representa todas as URLs dinâmicas |
| Setor Elétrico | 74 arquivos `page.tsx` |
| Gás Natural | 12 arquivos `page.tsx` |
| Saneamento | 24 arquivos `page.tsx` |
| Eficiência Estatal | 65 arquivos `page.tsx` |
| Contas Públicas Federais | 5 arquivos em `src/app/contas-publicas` |
| Contas Públicas Estaduais | 1 arquivo em `src/app/contas-publicas-estaduais` |
| Plataforma e conta | 29 arquivos `page.tsx`, incluindo a apresentação pública do Crédito |
| Crédito | SPA de 13.847 linhas em `public/obs/app.js`, além dos arquivos auxiliares e do route handler |
| Idioma fixo | 417 ocorrências textuais de `pt-BR` em `src`, das quais 343 fora de `src/tests`; não são todas chamadas de formatação |
| Dados | Gold em `public` e snapshots em `src/lib`; o inventário deve incluir ambos |
| Cadastro | `cpf` e `phone_e164` são únicos e aceitam nulo no schema atual; validar também migrações e fluxo |

Contagens reproduzíveis: `rg --files src/app -g 'page.tsx'`, `wc -l public/obs/app.js`, `rg -o 'pt-BR' src` e a última busca com `-g '!**/tests/**'`. O relatório futuro precisa contar rotas concretas, chaves e campos, sem tratar essas contagens de arquivos como cobertura de tradução.

## Fase 0: série de PRs

Cada linha delimita uma entrega; migrações extensas podem ser subdivididas sem misturar observatórios. O CI do PR anterior precisa estar verde antes de iniciar a próxima entrega.

| Ordem | Entrega | Critério de conclusão |
| --- | --- | --- |
| 0.1 | Arquitetura e plano, sem mover páginas | Alternativa de roteamento e contratos registrados; CI verde |
| 0.2 | Glossário inicial, inventário e script de cobertura | Fontes verificadas para termos traduzidos; estados e pendências explícitos; saída versionada conferida no CI |
| 0.3 | Tipos, dicionários e formatador com idioma | Português preservado; ausência de chave inglesa reprova `tsc`; testes de números, moedas e datas nos dois idiomas |
| 0.4 | Migração das chamadas de formatação | Nenhuma chamada fixa proibida fora do formatador; verificações portuguesas existentes intactas |
| 0.5 | Rotas, metadados, acesso e sitemap | Irmãs `/en` com a mesma política de conta; estáticas onde já eram; URLs e HTML português preservados |
| 0.6 | Seletores e home como prova de conceito | Cookie sem redirecionamento automático; mesma página no outro idioma; testes de HTML e acessibilidade |
| 0.7 | Preparação da SPA e fechamento da infraestrutura | Prefixo, dicionário, embeds e permalinks preservam idioma; `DATA_BASE` permanece igual; cobertura completa da fase |

Na fase 0, páginas ainda não traduzidas continuam em português com marcador visível `Portuguese only` e `lang="pt-BR"`. A home é a única página cujo conteúdo é traduzido nessa fase. Infraestrutura de navegação e marcador não autorizam antecipar traduções dos observatórios.

O roteamento usa `src/app/en` literal, preservando páginas e layouts portugueses. A série começa por helpers de URL e contratos, sem publicar rotas; segue por uma primeira irmã pública com fallback, documento e metadados corretos; depois amplia plataforma/conta e cada observatório separadamente. Parâmetros, layouts aninhados, redirects, portais e handlers exigem seus próprios adaptadores e verificações. Seletores e alternates só anunciam inglês em páginas com tradução publicada; fallback integral não é tradução. Formatos e rotas podem avançar em recortes intercalados dentro da fase 0, sempre com o CI anterior verde; a fase só fecha depois da migração completa, da guarda contra locale fixo e da paridade integral.

O primeiro par é `/sobre` e `/en/sobre`: corpo português preservado e marcado na irmã inglesa, sem antecipar a tradução institucional da fase 1. Ele inaugura documento por idioma e registro estrutural. A irmã sem tradução recebe `noindex`, fica fora do sitemap e não é anunciada por alternates. As demais irmãs, os seletores, a home traduzida, o JSON-LD e a infraestrutura da SPA continuam pendentes; esse recorte não encerra a fase 0.

A ampliação institucional acrescenta `/sobre/erros` e `/sobre/governanca`, também estáticas e inteiramente em português marcado sob `/en`. O teste de HTML passa a percorrer todos os pares declarados e exige página compilada, entrada de prerender e HTML físico; um par sem prova estática falha até receber verificação adequada. Isso não conclui a tradução da Constituição, prevista para a fase 1, nem a paridade global.

Imprensa e a vitrine pública do Crédito acrescentam dois pares estáticos com português marcado. O recorte preserva os metadados próprios das duas folhas e verifica a hidratação do selo e dos destinos de entrada, sem ampliar o acesso à SPA ou a seus arquivos. São cinco pares declarados, quatro da plataforma e um do Crédito; não representam cinco páginas traduzidas. As rotas dinâmicas exigirão prova HTTP e de DOM concluído, sem converter páginas com sessão para `force-static`.

O seletor público usa somente pares com tradução publicada: links presentes no HTML inicial, preservação de query/fragmento na interação e cookie de preferência sem redirecionamento automático. Os cinco pares com fallback integral não oferecem inglês. Seus rótulos ainda são portugueses, como o cabeçalho inteiro no fallback. A entrega não amplia o registro de rotas nem conclui os seletores dos sete observatórios. Provas de SSR e handlers são separadas das verificações de hidratação, histórico, teclado e cookies no navegador.

A prova parcial da home acrescenta o sexto par, `/` e `/en`, mantendo a consulta de sessão e a renderização dinâmica. Quatro chaves traduzem o título e as duas ações do Hero. Sete regiões ainda portuguesas recebem marcador visível; dados e destinos existentes são preservados. O inventário registra os usos declarados separadamente do catálogo disponível, e um teste com Chromium verifica o DOM concluído. Os cinco pares estáticos conservam suas provas integrais. Esse recorte não conclui a tradução da home, a paridade de rotas, a migração dos formatadores ou a fase 0.

Glossário, Termos e Privacidade acrescentam três pares dinâmicos com o corpo inteiro em português marcado. O registro passa a nove pares, oito com fallback integral e a home parcial. Os textos jurídicos, suas versões e os verbetes continuam portugueses; a tradução de cortesia permanece na fase 1. Cada origem passa a ter canonical próprio, em vez do canonical raiz herdado, e preserva a imagem social. A prova no navegador exige o conteúdo completo de cada página e confere o anunciador de navegação do Next, incluindo seu shadow root, antes da comparação integral da ilha portuguesa. Esse recorte amplia a existência das irmãs, sem aumentar o catálogo traduzido nem os quatro usos ingleses da home.

Entrar e Cadastro acrescentam dois pares dinâmicos com português marcado, sem oferta de inglês nos cabeçalhos próprios. O layout inglês do cadastro envolve a concha inteira, incluindo cabeçalho e rodapé, sem duplicar o marcador no formulário. São onze pares, dez com fallback integral e a home parcial. As consultas de sessão, a validação do destino `de`, os cookies, campos, consentimentos e redirects de onboarding permanecem iguais. A navegação para páginas inglesas válidas que exigem conta passa a usar `/en/entrar`, preservando o destino original; recursos e aliases rejeitados pelo parser conservam a entrada portuguesa. As etapas seguintes e os destinos padrão dos formulários continuam portugueses até a publicação de suas irmãs. Esse recorte não traduz os formulários nem implementa o cadastro internacional da fase 2.

A árvore inglesa dessas duas entradas produz IDs de `useId()` diferentes dos portugueses. A comparação dos formulários exige uma bijeção dos IDs gerados e de suas referências de rótulo/erro, depois de verificar unicidade, campos e associações; todos os outros atributos, textos, números e destinos continuam sob igualdade estrita. Os IDs portugueses permanecem iguais ao baseline. Essa adaptação é restrita às duas páginas de autenticação e não altera as provas da home ou das páginas de leitura.

Na home, o rótulo e os três benefícios do Hero ganham inglês, com os conceitos de fonte de dados e período de referência documentados no glossário por IBGE e BCB. O catálogo passa a doze mensagens, oito efetivamente usadas no conteúdo inglês da home. Rótulo e benefícios deixam o fallback; permanecem cinco regiões portuguesas marcadas entre as nove regiões declaradas. A página continua parcial. Texto, estrutura, números e destinos portugueses são preservados, assim como as demais vitrines e as onze irmãs existentes. A comparação de DOM admite somente essas quatro traduções adicionais antes de reconstruir o corpo português integral.

As duas telas de login por SMS acrescentam `/en/entrar/sms` e `/en/entrar/sms/verificar`, dinâmicas e integralmente em português marcado, sem oferta de inglês nos cabeçalhos próprios. São treze pares, doze integrais e a home parcial; os oito usos ingleses da home permanecem iguais. As guardas de sessão, a leitura de `login_phone`, a máscara de telefone, os formulários e seus destinos portugueses são preservados. Sem cookie válido, a verificação continua redirecionando para `/entrar/sms`; publicar a irmã não significa que todo o fluxo já permanece em inglês. Tradução, cadastro internacional e continuidade dos destinos ficam nos recortes seguintes.

As quatro URLs dessas telas ficam fora do sitemap. O robots.txt mantém o bloqueio de rastreamento de SMS nos dois idiomas; as irmãs inglesas com português marcado recebem também `noindex`, sem alternates ou oferta de inglês no seletor. A prova do OTP usa somente um cookie sintético no servidor isolado, sem criar usuário ou sessão e sem solicitar SMS. As comparações de DOM preservam os controles, a máscara e os números, com bijeção restrita dos IDs React e o contador de reenvio no mesmo estado temporal.

A introdução completa da home ganha uma mensagem tipada com um único argumento de contagem. A quantidade continua vindo do registro de domínios; as chamadas portuguesas mantêm a saída anterior e a nova forma inglesa trata singular, palavras de um a nove e os demais valores pelo formatador. União permanece em português com explicação funcional em inglês. Quatro termos e esse nome próprio entram no glossário com fontes já versionadas de BCB e IBGE. São treze mensagens disponíveis, nove usadas no conteúdo da home, cinco regiões traduzidas e quatro portuguesas marcadas entre as nove regiões. As treze irmãs existentes, os dados e as vitrines portuguesas permanecem iguais. A prova do parágrafo completo, incluindo a quantidade, precede sua reconstrução portuguesa na comparação de DOM; os literais lexicais da contagem continuam visíveis no inventário, sem exclusão de cobertura.

O índice da home acrescenta nove mensagens: navegação, seis unidades, conectivo da contagem parcial e ressalva das ilustrações. Os sete nomes dos produtos permanecem em português, com explicações já registradas no glossário. Um campo numérico separado reutiliza as mesmas quantidades das vitrines; o adaptador inglês não lê suas strings portuguesas, e o caminho PT devolve a contagem existente intacta. A home continua consultando as vitrines uma vez e compartilhando-as com as seções inferiores. O catálogo passa a 22 mensagens, com 18 chaves declaradas em uso na home; são seis regiões traduzidas e três portuguesas entre as nove regiões. Cabeçalho, seções e rodapé conservam os marcadores. Números, âncoras, ordem, imagens e treze pares de rotas permanecem iguais. A prova integral dos sete cartões precede sua reconstrução PT; quantidades simples, numeradores e denominadores têm negativos próprios. Esse recorte não traduz as páginas dos observatórios.

O primeiro recorte de formatos do Setor Elétrico centraliza dez chamadas fixas em `formato.ts`, `GraficoPontos` e `TabelaDados`, com propagação pelos três helpers de apresentação de `escalas.ts`. O idioma é argumento opcional, português por padrão. Precisão, ausência, sinais, unidades, ordenação, arredondamento e fuso de Brasília conservam seus contratos; a moeda inglesa usa BRL como R$ pelo formatador central. Os consumidores atuais continuam em português, inclusive os que reutilizam esses helpers no Gás Natural. Datas civis, textos de unidade, avisos, exportações e páginas não são traduzidos neste recorte. A cobertura continua com as mesmas chaves, regiões e irmãs declaradas; a alteração das fontes não representa tradução de UI ou gold. A migração dos demais formatadores do domínio e a guarda global contra locale fixo permanecem pendentes.

A migração dos gráficos centraliza outras vinte chamadas em barras, linhas, pequenos múltiplos, cronograma, linha do tempo e duração, incluindo os dois módulos intermediários que encaminham a duração aos componentes. O idioma alcança medições e rótulos de eixo, tabelas, contagens, leituras acessíveis e o painel interno dos pequenos múltiplos. O formatador de linhas conserva seu espaço comum, precisão e tratamento de zero negativo; as escalas mantêm seus contratos próprios. A função local de ticks em barras atende à medição e ao desenho, preservando a expressão de largura protegida pelo teste existente. Os consumidores atuais, inclusive de outras áreas, continuam no default PT. Prosa, unidades, meses, datas civis, números brutos, filtros, URLs e exportações permanecem fora da tradução deste recorte; as chaves e regiões traduzidas declaradas não aumentam.

O recorte de PLD, arquivo e modelos centraliza vinte chamadas fixas em oito fontes, incluindo duas funções de `pld.ts` que apresentam os critérios e o teto junto ao painel de períodos. Os helpers e os dois componentes recebem idioma opcional com PT por padrão; as três folhas estáticas continuam com suas assinaturas Next e português explícito. O instante da emissão conserva a composição portuguesa com `formatToParts`, Brasília e ciclo de 24 horas; a data do arquivo conserva seu contrato distinto, inclusive `Invalid Date`. Retenção de números, precisão variável, correção EPSILON do risco, recursão restrita da configuração, frações e valores brutos permanecem iguais. Idioma chega ao gráfico e aos textos numéricos adjacentes, sem traduzir prosa, datas civis, unidades, CSV ou gold. Os demais consumidores dos helpers continuam PT, e nenhuma rota, chave ou região traduzida é acrescentada.

O recorte de composição da geração, balanço da rede, exercício de contratos e conta de luz centraliza dez chamadas fixas em seis componentes e encaminha idioma a outras 39 chamadas. As precisões distintas da tolerância, da moeda do exercício, das participações e dos valores de conta permanecem explícitas. A dica da grade continua consumindo texto português; somente a apresentação do kWh extraído recebe idioma. Trocar a prop preserva o último anúncio, e o próximo evento usa o novo idioma. Os cinco gráficos do balanço e a tabela da composição recebem a prop, enquanto os eixos de `ContaPontos`, as frases de domínio, outras tabelas, datas, unidades e exportações mantêm os contratos atuais. Nenhuma página, rota ou região traduzida é acrescentada neste recorte; os consumidores existentes continuam PT por padrão.

O recorte de leituras e auditoria centraliza doze chamadas fixas em dez fontes. Quatro componentes recebem idioma opcional e preservam os 49 usos de seus helpers privados; participações muito pequenas e resumo de chaves também recebem idioma, com PT por padrão. Precisão fixa ou máxima, sinais distintos, teto de doze casas, percentuais já expressos em pontos e precedência de consulta/manifesto permanecem iguais. As quatro folhas estáticas usam PT explícito, conservando assinaturas Next, regex de detalhe, dados, contas e guardas de ausência. Mapas, prosa, unidades, datas civis, destinos e exportações mantêm seus contratos atuais. O ramo de demanda do laboratório tem prova SSR com entrada no hook real; isso não comprova interação ou mudança de URL no navegador. Nenhuma rota, chave, região ou campo da gold ganha tradução neste recorte.

O recorte de qualidade e inclusão centraliza oito chamadas fixas em seis fontes. Horas e minutos, contagens iniciais e conjuntos sem valor mantêm as regras de ausência, arredondamento e precisão; os componentes recebem idioma opcional, com PT por padrão, e a folha estática continua PT. O detalhe do município acompanha idioma no memo que produz texto, sem acrescentá-lo aos efeitos de dados. A prop chega aos pequenos múltiplos de DEC/FEC e aos três gráficos do orçamento familiar. Tabelas compartilhadas, mapa, frases de domínio, unidades, dados brutos, filtros, URLs e exportações conservam seus contratos atuais. A preparação de formatos não acrescenta página, chave, região ou campo da gold traduzido.

O primeiro recorte de formatos de Saneamento centraliza quatro chamadas fixas em três módulos e encaminha idioma ao adaptador de medidas municipais, totalizando quatro fontes. Os helpers recebem idioma opcional, com português por padrão. Casas, sinais, zero negativo, guardas de ausência e limiares monetários mantêm os contratos distintos de cada função. A conta encaminha idioma aos rótulos de água e esgoto e aos dois cálculos de `leituras`; escala aritmética, centavos, volumes, preços, somas e adicionais permanecem iguais. O cálculo seguinte só expõe seu total à leitura marginal: o segundo repasse de idioma é conferido na revisão, sem alegar observação de seus rótulos descartados. Unidades, sufixos, textos livres, datas civis e consumidores atuais continuam portugueses. O recorte não acrescenta página, chave, região ou campo da gold traduzido.

## Fases seguintes

| Fase | Série de entregas, sempre com CI verde entre PRs |
| --- | --- |
| 1 | Vitrine: home, Sobre, erros e governança; glossário e imprensa; termos e privacidade; métodos; entrada, cadastro e páginas de erro |
| 2 | Países e política de SMS; CPF conforme telefone verificado; limites por país/prefixo; idioma na conta; tradução das áreas de conta e administração da plataforma; comunicações; privacidade internacional |
| 3 | Setor Elétrico |
| 4 | Gás Natural |
| 5 | Saneamento |
| 6 | Eficiência Estatal |
| 7 | Contas Públicas Federais |
| 8 | Contas Públicas Estaduais |
| 9 | SPA do Crédito |

Cada fase de observatório divide a interface por módulos, adiciona textos ingleses determinísticos do pipeline conforme o contrato de arquivos paralelos e conclui exportações CSV, XLSX, PNG e citações. Nenhum PR mistura dois observatórios. Testes novos confrontam os valores e os campos portugueses sem editar expectativas dos testes existentes. A cobertura de uma fase precisa estar atualizada antes de iniciar a seguinte.

## Estados da cobertura

O recorte de proveniência registra os sete nomes curtos dos produtos a partir de `DOMINIOS.nomeCurto`, com explicações conceituais sustentadas por fontes oficiais e origem interna separada. A cobertura exige que esse registro esteja entre as fontes de interface assinadas; nomes preservados não contam como traduções de UI ou gold. O índice consome esses nomes sem criar títulos ingleses.

O contrato terminológico classifica as 22 mensagens atuais e vincula três delas a doze IDs do glossário, com catorze referências. Sete formas contextuais explícitas em seis termos permitem conferir o português publicado, sem alterá-lo nem flexibilizar caixa, acentos ou fronteiras de palavra. O índice reutiliza o equivalente canônico de unidades da Federação, sem criar termo ou fonte. A assinatura revisada de cada mensagem detecta mudanças posteriores; sua atualização exige revisão, não é efeito da geração do relatório. Nomes podem ter explicação no glossário ou na própria mensagem, conforme declaração explícita. Essa conferência offline tem métricas próprias e não comprova consumo no HTML nem tradução da gold. Consumidores e campos futuros precisam de seus próprios vínculos e provas.

O relatório versionado agrupa fontes de código da plataforma e de cada observatório. Campos textuais da gold são inspecionados separadamente pelo diagnóstico não versionado `--gold`. As saídas têm ordenação estável e não incluem horário corrente.

- `traduzido`: chave ou campo catalogado, tradução disponível e validada; conta como inglês disponível.
- `portugues_marcado`: fallback efetivamente apresentado com marcador e idioma; conta como pendência, nunca como tradução.
- `sem_traducao`: item catalogado sem inglês, ainda sem comprovação do fallback; deve impedir sua exposição sem marcador em `/en`.
- `nao_catalogado`: texto candidato encontrado fora do inventário; fica separado do denominador de chaves conhecidas, com localização e quantidade explícitas.
- `preservado`: nome próprio registrado no glossário; contabilizado separadamente, com explicação inglesa onde exigida.

O estado de rota `parcialmente_traduzido` reúne regiões com chaves inglesas declaradas e regiões portuguesas marcadas. Não equivale a uma página totalmente traduzida. A declaração de uso não é contada como verificação de HTML pelo gerador; a prova de DOM é uma etapa separada do CI.

Campos técnicos como IDs, códigos, datas de máquina e valores não são traduções; a classificação precisa justificar sua exclusão. Uma área não catalogada não pode aparecer como 100% traduzida. Rotas têm estado próprio de existência, acesso e tradução, incluindo rotas dinâmicas e a SPA. O CI deve rejeitar diferença entre `docs/i18n/cobertura.json` e a saída atual do script.

## Pendências e condições de avanço

- Glossário: pesquisar fontes oficiais em inglês antes de propor equivalentes para “saneamento”, “eficiência estatal”, “contas públicas”, “inadimplência”, “encargos” e “economia” como unidade de saneamento. Registrar ambiguidades por contexto; termo sem entrada fica em português e vai ao PR para decisão do dono.
- Nomes próprios e séries oficiais: inventariar nomes e primeira explicação inglesa. Não traduzir silenciosamente Tarifa Social, Desenrola, Bolsa Família, Pix, SINISA, SISAGUA, Siconfi, ESTBAN, IF.data e siglas de órgãos.
- Governança: tradução de cortesia em arquivo separado, aviso de prevalência do português e teste de quantidade de artigos/itens. Não alterar `docs/CONSTITUICAO.md` nem escrever em `notas/`.
- Cadastro internacional: confirmar regra pelo telefone E.164 verificado, não pelo idioma ou país escolhido no formulário. Variável `SMS_PAISES_PERMITIDOS` vazia mantém só Brasil; mudanças jurídicas primeiro em português, pendentes de validação do dono.
- Ações externas da fase 2: dono libera os países no Twilio Verify, define `SMS_PAISES_PERMITIDOS` e valida privacidade. Registrar no PR; não declarar essas ações concluídas pelo código.
- Configuração institucional: campos vazios, listas vazias e nulos permanecem assim. Tradução não constitui decisão nova do mantenedor.
- Acessibilidade: `npm run wcag` hoje inicia servidor estático e imprime um procedimento; não é evidência automática de aprovação das páginas Next. Acrescentar auditoria das páginas inglesas e registrar resultados, inclusive navegação por teclado e trechos com idioma próprio.
- Antes de cada push: `node scripts/minify-obs.mjs`, `npm run lint`, `npx tsc --noEmit`, `npm test` e os `unittest` do domínio alterado. Acrescentar build e verificação de HTML quando afetados; CI continua exigindo build, `EXIGIR_BUILD_HTML=1` e árvore limpa.
- Cada PR informa tradução entregue, termos/fontes propostos, pendências do dono, trecho de cobertura alterado e resultados reais dos comandos. Inviabilidade da especificação é documentada com alternativa no PR antes de prosseguir; teste existente não é relaxado.

## Revisão do contrato de cobertura

O relatório versionado e o `--check` dependem somente de fontes de código: interface, dicionários, glossário, inventário de rotas e modelos de frase. A situação da gold é calculada por `--gold`, em relatório não versionado. A publicação diária de dados não depende da cobertura i18n; os quatro workflows de dados permanecem iguais aos da main. Esta regra substitui o contrato anterior que incluía hashes e contagens da gold no arquivo versionado.

## Ordem após a revisão da pilha

O cadastro sem CPF para telefone estrangeiro verificado é entregue antes de
novos recortes do Setor Elétrico. O contrato, as provas e as ações externas estão
em [CADASTRO-INTERNACIONAL.md](CADASTRO-INTERNACIONAL.md). Os PRs de energia já
existentes recebem a propagação das correções da base; isso não encerra as demais
entregas de conta, idioma e comunicações previstas na fase 2.
