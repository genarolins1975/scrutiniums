# Glossário técnico inglês

[`config/glossario-en.json`](../../config/glossario-en.json) registra o vocabulário técnico compartilhado pela interface e pelos futuros modelos de frase do pipeline. Este núcleo contém **28 termos, 16 nomes próprios, 8 fontes e 25 pendências conhecidas**. Disponibilidade no glossário não comprova tradução de páginas nem de campos da gold; o relatório de cobertura mede separadamente o uso declarado na home.

As fontes foram consultadas em 14 de outubro de 2026. Cada entrada utilizável tem contexto, trecho da publicação e localização; PDFs também indicam a página. Os hashes identificam os arquivos efetivamente consultados. Uma página HTML pode mudar depois da consulta: o hash não é uma promessa de imutabilidade do site, nem uma verificação de rede feita pelo CI.

## Contrato

- `schema_version`: versão do formato, inicialmente `1`.
- `fontes`: publicações identificadas por órgão, título, URL oficial, idioma, formato e SHA-256; `url_pt`, quando disponível, aponta para o correspondente português.
- `entradas`: conceitos com ID estável, `tipo`, `pt`, `en`, `contexto` e, quando necessário, `nota` sobre variantes e limites. Termos e nomes institucionais exigem `evidencias`. Nomes de produtos exigem `origem_nome` no registro do projeto e `evidencias_explicacao` para os conceitos da explicação inglesa.
- `pendencias`: casos sem tradução utilizável, com ID, texto português, contexto, motivo, arquivos de origem e dependência de pesquisa ou decisão do mantenedor. Não contêm campo inglês.

Os IDs representam conceitos, como `credito.inadimplencia`, não frases nem caminhos de arquivos. Interface e modelos de frase devem referenciar esses IDs. A presença de uma palavra semelhante no texto não autoriza substituição automática: `credito.saldo_carteira_ativa_scr` não traduz qualquer ocorrência de “saldo”.

As citações mantêm a redação da fonte, inclusive quebras de linha extraídas de PDFs e sinais de pontuação. A proibição de travessão e meia risca na prosa inglesa publicada aplica-se às traduções e explicações destinadas à interface; não exige adulterar uma citação usada como evidência.

## Termos incluídos

| Grupo | Português | Inglês | Fonte |
| --- | --- | --- | --- |
| Crédito | crédito | credit | BCB |
| Crédito | taxa de juros | interest rate | BCB |
| Crédito | inadimplência | delinquency | BCB |
| Crédito | taxa de inadimplência | delinquency rate | BCB |
| Crédito | saldo de carteira ativa | credit outstanding balance | BCB |
| Crédito | carteira de crédito | credit portfolio | BCB |
| Macroeconomia | Produto Interno Bruto (PIB) | gross domestic product (GDP) | BCB |
| Macroeconomia | inflação | inflation | BCB |
| Energia | energia elétrica | electricity | IEA |
| Energia | geração de energia elétrica | electricity generation | IEA |
| Energia | setor elétrico | power sector | IEA |
| Gás | gás natural | natural gas | IEA |
| Saneamento | saneamento básico | basic sanitation | IBGE |
| Saneamento | abastecimento de água | water supply | IBGE |
| Saneamento | esgotamento sanitário | sewage disposal | IBGE |
| Saneamento | manejo de resíduos sólidos | solid waste management | IBGE |
| Saneamento | limpeza urbana | urban cleaning | IBGE |
| Saneamento | drenagem e manejo de águas pluviais | rainwater drainage and management | IBGE |
| Fiscal | finanças públicas | public finances | IBGE |
| Fiscal | governo geral | general government | IBGE |
| Fiscal | governo central | central government | IBGE |
| Estatística | fonte de dados | data source | IBGE e BCB |
| Estatística | período de referência | reference period | BCB |
| Estatística | base de dados | database | IBGE |
| Federação | estado | state | IBGE |
| Federação | unidades da Federação | Federation Units | IBGE |
| Fiscal | contas públicas | public accounts | BCB |
| Serviços | serviços públicos | public services | BCB |

O saldo documentado é o da carteira ativa dos clientes identificados no SCR. “Taxa de juros” não cobre juros como valor monetário. “Inadimplência” conserva o critério de atraso, universo e denominador da série; não se torna sinônimo automático de *default* ou *non-performing loans*. A fonte usa algumas formas no plural; a nota registra a adoção do singular no glossário, sem criar um mecanismo de flexão ou tradução em tempo de execução.

O conceito brasileiro de saneamento básico inclui água, esgotamento sanitário, resíduos sólidos e águas pluviais. A fonte do IBGE documenta esse escopo. A entrada não decide o nome editorial do observatório. Da mesma forma, *power sector* é um termo técnico verificado, sem renomear o produto Setor Elétrico. *Public finances* não define os títulos Contas Públicas Federais e Contas Públicas Estaduais. Nomes oficiais de séries continuam preservados, inclusive quando contêm um conceito traduzido como PIB.

## Nomes preservados

BCB, IBGE, CVM, Secretaria do Tesouro Nacional, Pix, SGS, SCR, Siconfi e União têm `en` idêntico a `pt`, com explicação inglesa em `explicacao_en` e evidências contextualizadas. A explicação fica no glossário e pode também acompanhar a primeira ocorrência na página; não substitui o nome. A explicação funcional de União não é tradução jurídica formal nem equivalência a governo central ou geral.

`formas_preservadas` registra formas portuguesas adicionais: Banco Central e Banco Central do Brasil para BCB; Tesouro e Tesouro Nacional para a Secretaria do Tesouro Nacional. Cada forma deve continuar literalmente como aparece no texto de origem. A associação ao órgão é explícita e contextual: “Tesouro” em outro sentido não herda a explicação institucional.

As explicações do IBGE, CVM, Pix, SGS e SCR vêm dos relatórios de estabilidade financeira do BCB. As do Banco Central, Tesouro e Siconfi também usam a publicação de contas de governo do IBGE. Para Siconfi, a evidência é a descrição da edição de 2024; a descrição histórica da mesma página tem outra expansão inglesa, registrada como variante na nota.

### Nomes dos produtos Scrutiniums

A variante estrita `nome_proprio_produto` preserva os sete valores de `DOMINIOS.nomeCurto`: Crédito, Setor Elétrico, Eficiência Estatal, Contas Públicas Federais, Contas Públicas Estaduais, Saneamento e Gás Natural. A denominação vem do projeto; BCB, IBGE e IEA sustentam apenas os conceitos usados nas explicações inglesas. Nenhuma publicação é apresentada como fonte do nome de um produto Scrutiniums.

`origem_nome` admite somente `src/lib/dominios.ts`, um ID existente no registro e o campo `nomeCurto`. O validador exige `pt === en === nomeCurto`, chave `nome.observatorio_<id>` e origem única. Não aceita aliases livres, `formas_preservadas`, o campo antigo `evidencias` ou um nome inglês inventado. `evidencias_explicacao` mantém os mesmos requisitos de fontes oficiais, referência existente e página de PDF. Os dois tipos anteriores conservam sua evidência obrigatória.

O adaptador lê a AST do registro, sem importar ou executar o módulo da aplicação. Exige declaração única `export const DOMINIOS`, array de objetos explícitos, IDs/nomes literais e ausência de duplicação, spreads, getters e propriedades computadas. Não contém uma segunda lista dos sete nomes/IDs. O carregamento só ocorre para glossários com produtos, uma vez por validação. A CLI usa a raiz do próprio script, mesmo com JSON externo ou outro diretório corrente; a cobertura usa a raiz que recebeu. Arquivos que escapem dessa raiz por symlink são recusados.

A origem deve estar classificada como interface no inventário, incluída na assinatura de fontes e no índice Git antes da publicação do relatório. O detector recebe somente nomes de um glossário validado a partir do JSON original; explicações, evidências, termos e pendências não viram exceções. Mantém os limites de palavra existentes e a verificação da prosa vizinha. Isso não substitui a prova literal dos nomes no HTML consumidor.

As explicações delimitam assunto, sem traduzir títulos nem ampliar cobertura: Saneamento descreve o foco atual em água/esgoto; Eficiência Estatal não anuncia conclusão sobre gestão; as contas estaduais abrangem as unidades da Federação, incluindo DF. A entrada `federativo.unidades_federacao` usa a expressão “Federation Units” da PNSB/IBGE e não importa números daquela pesquisa para a plataforma. As cinco pendências de títulos editoriais ingleses continuam registradas.

## Vínculo das mensagens ao glossário

`config/i18n-terminologia.json` classifica todas as chaves dos dois catálogos literais. Onze mensagens atuais têm justificativa de prosa comum; a introdução e o benefício de evidência declaram treze vínculos com onze IDs. Essa classificação vale para os textos revisados, sem afirmar que toda ocorrência futura de uma palavra é comum ou técnica. O contrato não traduz nem substitui textos em tempo de execução.

Cada mensagem guarda SHA-256 do UTF-8 de `JSON.stringify([pt, en.estado, textoOuMotivoEn])`, sem normalizar caixa, espaços ou acentos. Qualquer alteração exige revisão do contrato, inclusive nas mensagens sem termos técnicos. A geração de cobertura não renova essa assinatura. Ela detecta mudança do texto revisado; a adequação semântica dos vínculos continua dependendo da revisão.

Uma referência usa ID existente, forma explícita e quantidade inteira positiva de ocorrências. `canonica` seleciona os valores `pt`/`en` da entrada. Somente termos admitem `formas_contextuais`, um mapa não vazio de pares literais com contexto, cuja chave não pode ser `canonica`. As sete formas atuais documentam saneamento/contas na enumeração técnica, estados no plural, bases oficiais, fonte/Fonte e período. Herdam as evidências e os limites de seis entradas existentes; não criam novos conceitos, aliases de nomes próprios ou regras gerais de flexão. A qualificação “oficiais” vem da apresentação portuguesa, sem ser atribuída como citação ao IBGE.

Nomes exigem `explicacao: "na_mensagem" | "no_glossario"`. O segundo modo usa a explicação documentada no glossário sem impor repetição inline. O primeiro exige, na primeira ocorrência inglesa da mensagem, o bloco literal `nome (explicacao_en)`; é a escolha explícita de União na introdução. A prova não infere a ordem de renderização de uma página. Ambos os modos preservam o nome português.

O validador compara trechos literais com fronteiras Unicode, distinguindo caixa e acentos. Primeiro reserva nomes e explicações completas reconhecidas; depois confere os termos. Uma ocorrência inteiramente dentro de uma explicação não comprova outro vínculo técnico, mas ocorrências externas continuam sendo contadas. Intervalos parcialmente sobrepostos ou disputados por referências distintas são recusados, independentemente da ordem das referências. Não há regex livre, aproximação ou normalização de texto. A reserva não amplia as exceções do detector de vazamento.

Para `portugues_marcado`, o contrato confere o lado português e registra os vínculos ingleses como pendentes. A seção `terminologia_catalogo` da cobertura assina o arquivo, conta mensagens, referências e formas distintas e mantém `uso_na_interface_verificado: false`. Vínculos contam registros, não a soma das ocorrências ou dos idiomas. Catálogo validado não prova consumo no HTML nem tradução da gold.

O inventário declara o caminho canônico do contrato. A cobertura reutiliza os catálogos e o glossário já validados, exige arquivo regular dentro da raiz recebida e recusa arquivo presente sem declaração. O fluxo de publicação exige que essa fonte também esteja no índice Git. As fixtures anteriores sem contrato continuam válidas; a prova do catálogo real exige sua adoção.

## Pendências e cobertura

As decisões editoriais registradas são os títulos Eficiência Estatal, Contas Públicas Federais, Contas Públicas Estaduais, Saneamento e Setor Elétrico. Os conceitos técnicos existentes não resolvem esses títulos automaticamente.

As pendências de pesquisa registradas abrangem “saldo” sem contexto, juros como montante e explicações ainda não incorporadas para ANEEL, ANP, ONS, CCEE, INEP, MDS, CNJ, PGFN, Sinesp, ESTBAN, IF.data, SINISA, SIOP e Comex Stat. Incluem também SISAGUA, Desenrola, Bolsa Família e Tarifa Social, nomes explicitamente preservados pela especificação e cujas explicações inglesas ainda faltam. Essa lista reúne casos conhecidos; não é um inventário completo dos textos da plataforma. Pesquisas adicionais e outros nomes, como EPE, podem entrar em entregas posteriores com suas evidências.

Uma pendência não pode ser consumida como tradução. Um texto sem tradução continua em português, com o marcador visível `Portuguese only` e `lang="pt-BR"`, quando as páginas inglesas forem implementadas. Preservar um nome próprio não autoriza excluir da verificação de idioma o restante da frase ou do parágrafo.

O relatório de cobertura distingue entradas do glossário de chaves de interface e campos da gold traduzidos. A inclusão dos nomes de produtos não acrescenta mensagens traduzidas nem retira marcadores da home. O glossário não altera números, definições, arquivos portugueses nem critérios de publicação.

## Inclusão de entradas

Para acrescentar um termo, conferir o contexto consumidor e uma publicação inglesa de órgão autorizado, registrar a evidência efetivamente lida e documentar as variantes relevantes. Se faltar fonte ou houver uma decisão editorial em aberto, registrar uma pendência. Alterações de contexto ou escolha terminológica exigem revisão da entrada e de seus consumidores; o ID não deve ser reutilizado para outro conceito.

A validação local e o CI conferem a estrutura, as referências às fontes e as regras de preservação. Essa verificação não substitui a revisão humana da fidelidade da citação e da adequação do termo ao campo consumidor. O pipeline permanece determinístico: o glossário é versionado e não depende de tradução por modelo ou consulta de rede durante a geração.
