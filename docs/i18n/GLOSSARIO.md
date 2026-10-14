# Glossário técnico inglês

[`config/glossario-en.json`](../../config/glossario-en.json) registra o vocabulário técnico compartilhado pela interface e pelos futuros modelos de frase do pipeline. Este núcleo contém **21 termos, 8 nomes próprios, 8 fontes e 25 pendências conhecidas**. Ele não traduz páginas nem campos da gold e não comprova cobertura da home.

As fontes foram consultadas em 14 de outubro de 2026. Cada entrada utilizável tem contexto, trecho da publicação e localização; PDFs também indicam a página. Os hashes identificam os arquivos efetivamente consultados. Uma página HTML pode mudar depois da consulta: o hash não é uma promessa de imutabilidade do site, nem uma verificação de rede feita pelo CI.

## Contrato

- `schema_version`: versão do formato, inicialmente `1`.
- `fontes`: publicações identificadas por órgão, título, URL oficial, idioma, formato e SHA-256; `url_pt`, quando disponível, aponta para o correspondente português.
- `entradas`: conceitos com ID estável, `tipo`, `pt`, `en`, `contexto`, `evidencias` e, quando necessário, `nota` sobre variantes e limites.
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

O saldo documentado é o da carteira ativa dos clientes identificados no SCR. “Taxa de juros” não cobre juros como valor monetário. “Inadimplência” conserva o critério de atraso, universo e denominador da série; não se torna sinônimo automático de *default* ou *non-performing loans*. A fonte usa algumas formas no plural; a nota registra a adoção do singular no glossário, sem criar um mecanismo de flexão ou tradução em tempo de execução.

O conceito brasileiro de saneamento básico inclui água, esgotamento sanitário, resíduos sólidos e águas pluviais. A fonte do IBGE documenta esse escopo. A entrada não decide o nome editorial do observatório. Da mesma forma, *power sector* é um termo técnico verificado, sem renomear o produto Setor Elétrico. *Public finances* não define os títulos Contas Públicas Federais e Contas Públicas Estaduais. Nomes oficiais de séries continuam preservados, inclusive quando contêm um conceito traduzido como PIB.

## Nomes preservados

BCB, IBGE, CVM, Secretaria do Tesouro Nacional, Pix, SGS, SCR e Siconfi têm `en` idêntico a `pt`, com explicação inglesa comprovada em `explicacao_en`. A explicação acompanha o nome; não o substitui.

`formas_preservadas` registra formas portuguesas adicionais: Banco Central e Banco Central do Brasil para BCB; Tesouro e Tesouro Nacional para a Secretaria do Tesouro Nacional. Cada forma deve continuar literalmente como aparece no texto de origem. A associação ao órgão é explícita e contextual: “Tesouro” em outro sentido não herda a explicação institucional.

As explicações do IBGE, CVM, Pix, SGS e SCR vêm dos relatórios de estabilidade financeira do BCB. As do Banco Central, Tesouro e Siconfi também usam a publicação de contas de governo do IBGE. Para Siconfi, a evidência é a descrição da edição de 2024; a descrição histórica da mesma página tem outra expansão inglesa, registrada como variante na nota.

## Pendências e cobertura

As decisões editoriais registradas são os títulos Eficiência Estatal, Contas Públicas Federais, Contas Públicas Estaduais, Saneamento e Setor Elétrico. Os conceitos técnicos existentes não resolvem esses títulos automaticamente.

As pendências de pesquisa registradas abrangem “saldo” sem contexto, juros como montante e explicações ainda não incorporadas para ANEEL, ANP, ONS, CCEE, INEP, MDS, CNJ, PGFN, Sinesp, ESTBAN, IF.data, SINISA, SIOP e Comex Stat. Incluem também SISAGUA, Desenrola, Bolsa Família e Tarifa Social, nomes explicitamente preservados pela especificação e cujas explicações inglesas ainda faltam. Essa lista reúne casos conhecidos; não é um inventário completo dos textos da plataforma. Pesquisas adicionais e outros nomes, como EPE, podem entrar em entregas posteriores com suas evidências.

Uma pendência não pode ser consumida como tradução. Um texto sem tradução continua em português, com o marcador visível `Portuguese only` e `lang="pt-BR"`, quando as páginas inglesas forem implementadas. Preservar um nome próprio não autoriza excluir da verificação de idioma o restante da frase ou do parágrafo.

O relatório de cobertura deve distinguir entradas do glossário de chaves de interface e campos da gold traduzidos. Neste PR, as traduções de interface e gold continuam em zero. O glossário não altera números, definições, arquivos portugueses nem critérios de publicação.

## Inclusão de entradas

Para acrescentar um termo, conferir o contexto consumidor e uma publicação inglesa de órgão autorizado, registrar a evidência efetivamente lida e documentar as variantes relevantes. Se faltar fonte ou houver uma decisão editorial em aberto, registrar uma pendência. Alterações de contexto ou escolha terminológica exigem revisão da entrada e de seus consumidores; o ID não deve ser reutilizado para outro conceito.

A validação local e o CI conferem a estrutura, as referências às fontes e as regras de preservação. Essa verificação não substitui a revisão humana da fidelidade da citação e da adequação do termo ao campo consumidor. O pipeline permanece determinístico: o glossário é versionado e não depende de tradução por modelo ou consulta de rede durante a geração.
