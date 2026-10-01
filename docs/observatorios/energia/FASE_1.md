# Fase 1 do Observatório Brasileiro do Setor Elétrico

Corte de escopo definido em 01/10/2026 para publicação em produção. A especificação mestre (`ESPECIFICACAO.md`, 71 painéis) não está concluída: esta fase publica o que passou nos testes e na construção do site, e deixa o restante para a Fase 2 com o trabalho já feito preservado.

## Critério do corte

Entra na Fase 1 a página que (1) tem gold publicada com proveniência, (2) compila, passa na suíte de testes e na construção estática, e (3) não promete conteúdo que não existe. Interface interrompida no meio fica fora: a página de produção anterior é mantida, ou o painel aparece como "em preparação", sem link.

## Estado dos 71 painéis

| Estado | Painéis | Quantidade |
| --- | --- | --- |
| Ciclo completo (dados, verificação adversarial, correção, interface e revisão) | P017 a P020, P025 a P027, P044 a P046, P047 a P050, P051 a P054, P055 a P058, P059 a P062 | 26 |
| Publicado na Fase 1, revisão adversarial da interface pendente | P001, P002, P003, P008 a P016, P021, P022, P028 a P031, P036 a P039, P040 a P043, P063, P064 | 28 |
| Fase 2 (dados prontos ou em andamento; página de produção anterior mantida) | P004 a P007, P023, P024, P032 a P035, P065, P066, P067 a P070, P071 | 17 |

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
| Visão geral nova (P004 a P007) | gold `sintese.json` pronta; página nova interrompida no meio | página de produção mantida; versão parcial guardada no branch de trabalho |
| Geração P023 e P024 | dados prontos em `geracao_detalhe.json`; páginas não criadas | painéis aparecem como "em preparação" |
| Mercado (P032 a P035) | gold pronta; página nova não feita; **decisão de acesso à CCEE pendente com o responsável** | página "em integração" mantida |
| Aprenda (P065, P066) | verbetes dos módulos publicados; módulo próprio não executado | página de produção mantida |
| Dados e metodologia novos (P067 a P070) | `publicacao.json`, catálogo e manifesto prontos; interface nova interrompida | páginas de produção com ajustes mínimos |
| Avaliação dos painéis (P071) | não iniciada | |
| Revisão adversarial das interfaces de PLD e Previsões | não autorizada nesta sessão (permissão negada) | pendente de autorização |

## Decisões pendentes com o responsável

1. **Coleta da CCEE (Mercado).** O portal de dados abertos da CCEE responde 403 "Acesso bloqueado" ao `curl` e 200 ao cliente do pipeline (User-Agent do projeto, sem disfarce de navegador), o mesmo cliente que já coleta o PLD horário em produção. Usar esse cliente para os 17 conjuntos do Mercado é decisão do responsável. Enquanto não houver decisão, o módulo não faz requisição à CCEE e os painéis P032 a P035 ficam "pendente de decisão de acesso".
2. **Revisões adversariais pendentes** (PLD, Previsões e as interfaces publicadas sem revisão): autorizar a retomada dos fluxos de revisão.

## Riscos da primeira atualização automática

O workflow `atualizar-energia.yml` passa a rodar todos os módulos. Na primeira execução não há cópia durável dos silvers das famílias novas (`energia-silver-familias.tar.gz`), então a coleta parte do zero (Geração baixa cerca de 850 MB de Parquet). Módulo que falha publica stub e a sentinela mantém a última gold válida no repositório; nenhuma página fica sem dado por falha de coleta. Sem a decisão sobre a CCEE e sem o bronze local, o Mercado no Actions não tem os números da CCEE; a página do Mercado na Fase 1 não mostra números.
