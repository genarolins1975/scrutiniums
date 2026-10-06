# Fase 1 do Observatório Brasileiro do Setor Elétrico

Corte de escopo definido em 01/10/2026 para publicação em produção. A especificação mestre (`ESPECIFICACAO.md`, 71 painéis) não está concluída: esta fase publica o que passou nos testes e na construção do site, e deixa o restante para a Fase 2 com o trabalho já feito preservado.

## Critério do corte

Entra na Fase 1 a página que (1) tem gold publicada com proveniência, (2) compila, passa na suíte de testes e na construção estática, e (3) não promete conteúdo que não existe. Interface interrompida no meio fica fora: a página de produção anterior é mantida, ou o painel aparece como "em preparação", sem link.

## Estado dos 71 painéis

| Estado | Painéis | Quantidade |
| --- | --- | --- |
| Ciclo completo (dados, verificação adversarial, correção, interface e revisão) | P017 a P020, P025 a P027, P044 a P046, P047 a P050, P051 a P054, P055 a P058, P059 a P062 | 26 |
| Publicado na Fase 1, revisão adversarial da interface pendente | P001, P002, P003, P008 a P016, P021, P022, P028 a P031, P036 a P039, P040 a P043, P063, P064 | 28 |
| Publicado na Fase 2 em 06/10/2026, revisão adversarial da interface pendente | P004 a P007, P023, P024, P032 a P035 | 10 |
| Fase 2 (dados prontos ou em andamento; página de produção anterior mantida) | P065, P066, P067 a P070, P071 | 7 |

Dentro do ciclo completo, três painéis têm limitação declarada na própria página: P050 (efeito médio dos reajustes: documentos da ANEEL atrás de desafio anti-robô), P057 (referência regulatória das perdas não técnicas) e P058 (custo total das perdas).

## O que muda em produção

* **Página inicial** (`/setor-eletrico`): mapa didático com as sete seções da especificação (propósito e busca; mapa conceitual com ligações tipificadas e versão em texto; cartão de cada destino; perguntas do dia a dia com escolha da distribuidora; quatro trilhas; como confiar e ler, com um número real e a ficha "Comprove este número"; atualidade das fontes principais pelo período de referência).
* **Novos destinos**: Conta de luz, Perdas, Qualidade, Inclusão energética, Transição e ambiente, Minha região (território), com as subpáginas de cada um.
* **Módulos refeitos**: Água e clima, Carga, PLD (CMO, limites, histórico, diferenças regionais), Previsões e modelos, Rede, Expansão, Empresas (com ficha por distribuidora), Regulação, Geração (matriz efetiva e despacho térmico).
* **Navegação** em seis grupos, com "Minha região" em "Comece aqui".
* **Pipeline**: módulos descobertos automaticamente em `pipeline/energia/modulos/`, catálogo de métricas (`metricas.json`), dicionário de arquivos (`arquivos.json`), publicação e manifesto (`publicacao.json`, `manifesto.json`).

## Fora da Fase 1 (Fase 2)

| Item | Situação | Onde está o trabalho |
| --- | --- | --- |
| Visão geral nova (P004 a P007) | **publicada em 06/10/2026**: página ligada à gold `sintese.json` com os componentes `Visao*`; fichas de prova e tabelas de auditoria lidas da gold sob demanda (530 KB de HTML) | `src/app/setor-eletrico/visao-geral/page.tsx`; método em `modulos/visao.md`; estado em `CONTINUIDADE.md` |
| Geração P023 e P024 | **publicados em 06/10/2026**: páginas `/geracao/restricoes` (mapa das usinas, razões oficiais, energia separada de potência) e `/geracao/capacidade` (fator de capacidade com a potência de cada mês, distribuição por usina, ANEEL e MMGD ao lado sem soma), sobre a gold `geracao_detalhe.json` de 01/10/2026; ambos concluídos com limitação | `src/app/setor-eletrico/geracao/`; interface em `modulos/geracao.md`, seção 7; estado em `CONTINUIDADE.md` |
| Mercado (P032 a P035) | **publicado em 06/10/2026**: coleta da CCEE autorizada e refeita no mesmo dia (dados até agosto de 2026), quatro páginas ligadas à gold `mercado.json`; P032, P033 e P035 concluídos com limitação, P034 parcial (número de 12 meses do InfoMercado não reproduzido) | `src/app/setor-eletrico/mercado/`; método e interface em `modulos/mercado.md`; estado em `CONTINUIDADE.md` |
| Aprenda (P065, P066) | verbetes dos módulos publicados; módulo próprio não executado | página de produção mantida |
| Dados e metodologia novos (P067 a P070) | `publicacao.json`, catálogo e manifesto prontos; interface nova interrompida | páginas de produção com ajustes mínimos |
| Avaliação dos painéis (P071) | não iniciada | |
| Revisão adversarial das interfaces de PLD e Previsões | não autorizada nesta sessão (permissão negada) | pendente de autorização |
| Datas cruas no texto (AAAA-MM-DD) | 120 ocorrências em 23 páginas, em textos gerados pelos módulos (Regulação, Finanças, Território, Carga, PLD) e rótulos de planilha da fonte; formatação, não dado errado. O teste `energia-reauditoria` ("páginas pré-renderizadas…") acusa isso quando há build local; o CI não constrói e não o executa | correção nos geradores de cada módulo |

## Decisões pendentes com o responsável

1. **Revisões adversariais pendentes** (PLD, Previsões e as interfaces publicadas sem revisão): autorizar a retomada dos fluxos de revisão.

### Decisões tomadas em 06/10/2026

* **Coleta da CCEE autorizada** pelo responsável: os 17 conjuntos do Mercado podem ser coletados com o cliente do pipeline (User-Agent do projeto, sem disfarce de navegador), o mesmo que coleta o PLD horário, a partir do ambiente de desenvolvimento e do GitHub Actions. Registrada em `pipeline/energia/fontes/ccee_mercado.py` (`DECISAO_ACESSO`) e no workflow (`ENERGIA_CCEE_COLETA: "1"`); coleta feita em 06/10/2026 entre 16h58 e 17h01 de Brasília, os 17 conjuntos e três edições do InfoMercado com HTTP 200.
* **Base da Fase 2**: a `main` (Fase 1 em produção). O redesenho visual feito em setembro sobre a base anterior (commits até `1592f9efe` no branch `claude/kind-mayer-v9tpwi`, agora reiniciado a partir da `main`) não foi mesclado; o que dele não existe na `main` (home e seletor com painéis vivos, gramática visual, testes) é porte pendente, registrado em `CONTINUIDADE.md`.

## Riscos da primeira atualização automática

O workflow `atualizar-energia.yml` passa a rodar todos os módulos. Na primeira execução não há cópia durável dos silvers das famílias novas (`energia-silver-familias.tar.gz`), então a coleta parte do zero (Geração baixa cerca de 850 MB de Parquet). Módulo que falha publica stub e a sentinela mantém a última gold válida no repositório; nenhuma página fica sem dado por falha de coleta. Com a coleta da CCEE autorizada, o Mercado no Actions coleta os 17 conjuntos a cada execução (só o que mudou). Quando o silver vem da cópia durável sem o bronze, a releitura de um arquivo do bronze passou a usar a cópia recapturada com o mesmo sha256 (`base.abre_bronze`, 06/10/2026); antes, essa situação derrubava a construção do Mercado e a sentinela mantinha a gold anterior.
