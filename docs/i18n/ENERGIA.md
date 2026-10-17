# Setor Elétrico em inglês

Fase 3 do [plano](PLANO.md). Todas as páginas de `/setor-eletrico` têm irmã em `/en/setor-eletrico`, com o mesmo conteúdo, os mesmos números e os mesmos destinos, em inglês. A versão portuguesa não muda: cada texto passa a ter as duas formas lado a lado no código e o português sai idêntico ao que era.

## Como a página sabe o idioma

A URL decide. No servidor, `idiomaEnergia()` lê o endereço da renderização no armazenamento do Next (`urlPathname`, o mesmo que o Next usa nos metadados), o que vale para componente de servidor, componente de cliente renderizado no servidor e `generateMetadata`; no navegador, o endereço da janela. Uma caixa no cache de requisição do React foi testada e descartada: componentes de cliente renderizados no servidor não têm esse cache. O armazenamento é interno do Next 14.2.35 (fixado no `package.json`); `src/tests/energia-idioma.test.ts` falha se ele mudar. `/en/...` é inglês; o resto, português. Não há cookie, cabeçalho nem redirecionamento.

| Onde | Como ler o idioma | Texto | Números e datas |
|---|---|---|---|
| Componente de servidor, `generateMetadata`, função de `src/lib/energia` chamada por eles | automático: `idiomaEnergia()` lê o endereço da renderização | `tx("pt", "en")` de `@/lib/energia/idioma` | `num`, `reais`, `pct`, `dataBR`, `mesAno`... de `@/lib/energia/formato`, sem argumento extra |
| Componente de cliente (`"use client"`) | `const idioma = useIdioma()` de `@/lib/energia/useIdioma` | `const tx = useTx()` e depois `tx("pt", "en")` | `const f = formatos(idioma)` e depois `f.num(v, 1)`, `f.dataBR(iso)`; ou passar `idioma` como último argumento |
| Função de lib chamada também por cliente | receber `idioma: Idioma` como parâmetro | `tx("pt", "en", idioma)` ou `porIdioma(idioma, { pt, en })` | passar `idioma` aos formatadores |

Regras:

1. **O português não muda.** O primeiro argumento de `tx` é exatamente o texto que estava no código. Nenhum teste existente é alterado para acomodar tradução.
2. **Nenhum cálculo duplicado.** A irmã inglesa (`src/app/en/setor-eletrico/**/page.tsx`) é gerada por `node scripts/i18n/irmas-energia.mjs` e só reexporta a página portuguesa. Não editar à mão.
3. **Metadados**: o `generateMetadata` de cada página portuguesa passa por `metadadosEnergia(caminho, { title: tx(...), description: tx(...) }, anterior)`. Traduzir `title` e `description` com `tx`.
4. **Links internos**: `Link` vem de `@/components/i18n/LinkIdioma` (ou `@/components/energia/LinkSemPrefetch`), que leva para `/en` quando a irmã é traduzida. `<a href="/setor-eletrico/...">` interno vira `Link`. Destino montado em código para `router.push`/`location` usa `hrefNoIdioma(href, idioma)` de `@/lib/i18n-href`.
5. **Nome próprio fica em português e é marcado**: `<Nome>{empresa.nome}</Nome>` (`@/components/i18n/Nome`). Vale para empresa, usina, município, estado, programa (Tarifa Social, Luz para Todos), base de dados oficial pelo nome (SIGA, SIGET, SAMP), lei e órgão por extenso. Na primeira ocorrência, uma explicação inglesa curta pode acompanhar: `<Nome>Tarifa Social</Nome> (the social electricity tariff)`. Siglas de órgãos (ANEEL, ONS, CCEE, EPE, MME, IBGE) ficam como estão, sem marca.
6. **Texto que só existe em português** (citação literal de norma, nota publicada pela fonte, prosa da gold sem versão inglesa): `<TrechoPortugues regiao="id-curto">...</TrechoPortugues>`, que põe o aviso "Portuguese only" visível antes. Usar só quando traduzir mudaria o documento citado; não usar para fugir do trabalho.
7. **Texto que vem dos dados** (rótulos de categoria, fonte, tipo, situação na gold): traduzir por tabela exata (`Record<string, string>` do português para o inglês) num arquivo do próprio grupo; valor sem entrada na tabela sai em `<TrechoPortugues>`, nunca em português solto. Não alterar a gold nem o pipeline.
8. **Atributos** (`aria-label`, `title`, `alt`, `placeholder`) também passam por `tx`. Nome próprio dentro de atributo é aceitável; o resto do atributo é inglês.
9. **Gráficos**: rótulos de eixo, legenda, `<title>` de marca e texto de SVG passam por `tx`; datas de eixo com `mesAnoCurto`/`dataCurta` no idioma.
10. **CSV, imagem e citação**: cabeçalhos de CSV montados na tela e o texto de `BaixarImagem`/citação seguem o idioma da página; valores e recortes iguais.
11. **Registro**: inglês técnico e neutro (o mesmo contrato editorial do português: sem adjetivo de julgamento, sem previsão). Sem travessão (— ou –) na prosa inglesa; hífen só em palavra composta. Número com unidade, período e fonte, como no português. `R$` fica `R$`; "R$ 1,2 bilhão" vira "R$ 1.2 billion"; "mil" vira "thousand", "milhões" "million", "bilhões" "billion".
12. **Siglas portuguesas** ficam e ganham o nome inglês na primeira ocorrência da página, como a tabela abaixo. A legenda de siglas (`LegendaSiglas`) explica cada uma em inglês.

## Terminologia comum

Equivalentes de trabalho para o observatório inteiro. Usar exatamente estes; termo novo que se repete em mais de um módulo entra aqui antes de ser usado. A formalização no glossário (`config/glossario-en.json`, com trecho da fonte em inglês) acompanha a fase.

| Português | Inglês |
|---|---|
| Setor Elétrico (nome do observatório) | Setor Elétrico (não traduzir; na abertura: "Brazilian power sector observatory") |
| setor elétrico (conceito) | power sector |
| Preço de Liquidação das Diferenças (PLD) | spot price (PLD) na primeira ocorrência; depois PLD |
| custo marginal de operação (CMO) | marginal operating cost (CMO) |
| submercado | submarket |
| subsistema | subsystem |
| Sudeste/Centro-Oeste, Sul, Nordeste, Norte | Southeast/Center-West, South, Northeast, North (`nomeSubmercado`) |
| Sistema Interligado Nacional (SIN) | National Interconnected System (SIN) |
| energia armazenada (EAR) | stored energy (EAR) |
| energia natural afluente (ENA) | natural inflow energy (ENA) |
| reservatório | reservoir |
| afluência, vazão | inflow, flow |
| MWmédio, MWmed | MWavg (average megawatts) |
| potência | capacity (instalada: installed capacity); energia: energy |
| carga | load |
| intercâmbio | interchange |
| geração | generation |
| despacho | dispatch |
| usina hidrelétrica (UHE), PCH, CGH | hydropower plant (UHE), small hydropower plant (PCH), mini hydropower plant (CGH) |
| eólica, solar fotovoltaica, térmica, nuclear, biomassa | wind, solar photovoltaic, thermal, nuclear, biomass |
| curtailment, restrição de operação (constrained-off) | curtailment, operating restriction (constrained-off) |
| Ambiente de Contratação Regulada (ACR) | regulated contracting environment (ACR) |
| Ambiente de Contratação Livre (ACL), mercado livre | free contracting environment (ACL), free market |
| consumidor cativo, consumidor livre | captive consumer, free consumer |
| leilão; preço-teto; deságio | auction; ceiling price; discount (below the ceiling price) |
| garantia física | physical guarantee |
| distribuidora | distribution utility |
| transmissora | transmission company |
| geradora | generation company |
| concessionária, permissionária | concession holder, permit holder |
| outorga | grant (authorization or concession) |
| unidade consumidora (UC) | consumer unit |
| tarifa; reajuste tarifário; revisão tarifária | tariff; tariff adjustment; tariff review |
| bandeira tarifária | tariff flag |
| Tarifa Social de Energia Elétrica | Tarifa Social (social electricity tariff) |
| conta de luz | electricity bill |
| encargos setoriais | sector charges |
| Conta de Desenvolvimento Energético (CDE) | Energy Development Account (CDE) |
| perdas técnicas, perdas não técnicas | technical losses, non-technical losses |
| DEC, FEC | DEC (equivalent interruption duration per consumer unit), FEC (equivalent interruption frequency per consumer unit) |
| micro e minigeração distribuída (MMGD) | distributed micro and mini generation (MMGD) |
| Mecanismo de Realocação de Energia (MRE); GSF | Energy Reallocation Mechanism (MRE); generation scaling factor (GSF) |
| agente (de mercado) | (market) agent |
| consulta pública, audiência pública | public consultation, public hearing |
| agenda regulatória | regulatory agenda |
| resolução normativa (REN) | normative resolution (REN) |
| natureza do dado: Observado, Calculado, Estimado, Previsto, Cenário | Observed, Calculated, Estimated, Forecast, Scenario |
| Sobre este dado | About this data |
| Comprove este número | Check this number |
| fonte; data de referência; período | source; reference date; period |
| capturado em; gerado em | captured on; generated on |
| sem dado | no data |
| em preparação | in preparation |
| Mapa do Observatório | Observatory map |
| Aprenda | Learn |
| verbete | entry |
| trilha | learning path |
| conjunto elétrico (continuidade) | consumer set (nunca "cluster" nem "electrical set") |
| Comprove este número | Check this number |
| MWmês | MWmonth |
| potência fiscalizada; potência outorgada | inspected capacity; granted capacity |
| Luz para Todos | Luz para Todos (rural electrification program); nunca "Light for All" |
| Tarifa Social (no meio do texto) | Tarifa Social; nunca "Social Tariff" |
| Cadastro Único (CadÚnico) | Cadastro Único (federal social registry) |
| fato relevante | material fact |
| exercício (contábil) | fiscal year |
| Conta de luz; Água e clima; Carga; Rede; Geração; Expansão; Transição; Território; Empresas; Leilões; Mercado; Regulação; Perdas; Qualidade; Inclusão energética; Dados; Metodologia; Visão geral | Electricity bill; Water and climate; Load; Grid; Generation; Expansion; Transition; Territory; Companies; Auctions; Market; Regulation; Losses; Quality of supply; Energy inclusion; Data; Methodology; Overview |

## Verificação

- Código: `node scripts/i18n/pendencias-energia.mjs <arquivos>` lista texto português visível que ainda não passa por `tx` nem por marca. Meta: zero nos arquivos traduzidos, salvo literal que não chega à tela (marcar a linha com `// i18n: dado`).
- Tipos e regras: `npx tsc --noEmit`, `npm run lint`.
- Testes do domínio: `npx vitest run src/tests/energia-<modulo>*.test.ts`.
- HTML gerado (prova): `npm run build` e `npx vitest run src/tests/energia-i18n-html.test.ts`. Cada página precisa de: documento inglês, head inglês indexável com alternates, nenhum português sem marca, mesmos destinos de link, mesmos números (mês por nome conta como o número do mês) e mesma estrutura de títulos.
