# Pacote de revisão da candidata v3

12/10/2026 · Candidata 2022 · 26 capitais estaduais, sem DF.

## Estado e objetivo

**Pacote preparado; revisão independente ainda não realizada.** Não há revisor designado ou parecer recebido nesta entrega. O objetivo é permitir que alguém distinto do autor examine uma versão identificável, reproduza as evidências e registre concordâncias ou objeções. Não confundir conclusão de testes com validação metodológica.

A candidata reúne sete indicadores, com material em 40% como referência experimental e sete pesos iguais como contraponto. A v2 permanece congelada. Saúde continua ausente; o escore não representa eficiência causal, satisfação ou capítulos completos. Precisão municipal não foi quantificada.

## Roteiro de leitura e decisão

| Critério no registro | Material para examinar | Resposta exigida no parecer |
|---|---|---|
| `conteudo` | [Parecer de conteúdo](PARECER_CONTEUDO_PESOS_V3.md), matriz dos sete indicadores | O nome e a promessa são compatíveis com a cobertura parcial e os diferentes universos? Quais interpretações devem ser excluídas? |
| `habitacao_definicao` | [Cenários de habitação](HABITACAO_CENARIOS.md), dados 9934/9940 e [cesta conjunta](CESTA_CONJUNTA_V3.md) | Aceita domicílios >2 como definição principal? Por quê? Examinar >3 e medidas por moradores; continuidade não comprova adequação substantiva |
| `pesos_compensacao` | Parecer, 18 cenários, matriz de correlações e decomposição | Aceita o orçamento de 40%, a redução de renda/saneamento e as compensações? Comparar sete iguais sem escolher por ranking desejado |
| `precisao_divulgacao` | [Protocolo municipal](PRECISAO_CANDIDATAS.md), nota IBGE, inventário do anexo e 52 registros | Exige nova evidência de precisão ou admite divulgação estritamente descritiva? Delimitar valores, comparação, percentis e agregado separadamente; aceitar uma ressalva não libera automaticamente todos os usos |
| `reproducao` | Fontes, hashes, código, testes, JSON/CSV e referência v2 | Reproduziu as saídas? Registrar versão do Python, comando, resultados e divergências; não apenas citar CI |
| `edicao_apresentacao` | Nome proposto, limitações, coorte e protocolo de apresentação | Quais usos e rótulos são admissíveis? Exigir diferenciação entre mudança de cesta e evolução temporal, e explicitar ausências |

O inventário `revisao-v3-pacote.json` fixa arquivos por SHA-256; seu próprio identificador é o hash do conteúdo canônico sem o campo `packet_sha256`. Inclui fontes e código do pipeline, referência v2, resultados e documentos centrais. O inventário não contém a si mesmo, os pareceres recebidos ou o relatório de status, evitando dependência circular. O contexto complementar está no repositório no commit que introduz o pacote.

## Reprodução sem rede

Usar Python 3.12 na raiz do repositório:

```sh
python3.12 -m unittest pipeline.eficiencia_resultados.test_cesta_conjunta pipeline.eficiencia_resultados.test_precisao_candidatas pipeline.eficiencia_resultados.test_revisao_v3
python3.12 -m pipeline.eficiencia_resultados.revisao_v3
```

Os testes da cesta e da precisão recalculam e reconciliam as saídas. A triagem confere a identidade do pacote, hashes e vínculos dos pareceres. Inventário alterado, fonte modificada, parecer de outra versão, critério duplicado ou evidência ausente interrompem a verificação. Parecer pendente/rejeitado mantém a revisão documental incompleta. Nenhum comando altera a interface ou publica o escore.

## Registro de pareceres

O arquivo `revisao-v3-pareceres.json` começa com `records: []`, vinculado ao identificador do pacote. Um parecer pode cobrir vários critérios, mas deve haver um registro por critério, com:

- `criterion`: um dos seis identificadores da tabela;
- `decision`: `approve`, `reject` ou `changes_requested`;
- `reviewer`, `reviewed_at`, `independence_declared: true` e `rationale`;
- `evidence_path` e `evidence_sha256`: arquivo do parecer dentro do repositório, com conteúdo substantivo e hash conferível.

Não preencher com identidades fictícias, atribuir revisão ao autor ou registrar aprovação sem parecer. A lista `authors` identifica a autoria técnica desta implementação; o responsável pela edição deve conferir as pessoas efetivamente envolvidas, vínculos e conflitos de interesse. Comparar identificadores e exigir declaração não autentica identidade nem comprova independência. Esses pontos exigem conferência humana, com rastreabilidade no processo de revisão do repositório.

Só incorporar documentos autorizados para o repositório público, sem microdados controlados ou dados pessoais desnecessários. Não foram enviados convites ou mensagens a terceiros nesta entrega.

## O que cada estado significa

| Estado | Consequência |
|---|---|
| Pacote íntegro, seis critérios pendentes | Material pronto para revisão, sem aprovação |
| Um ou mais critérios rejeitados/com alterações | Revisar a proposta; nova versão exige novos pareceres |
| Seis critérios documentalmente aprovados | Triagem documental completa; ainda requer conferir autenticidade, independência e escopo |
| Decisão editorial explícita sobre a edição | Pode fundamentar trabalho de integração, dentro do escopo efetivamente aceito |
| Integração e validação do produto | Etapa própria; exige testes da interface e manutenção das ressalvas |

`publication_ready` permanece **false mesmo com seis registros aprovados**. Este módulo é uma triagem offline, não uma autoridade de aprovação e não substitui a trava já existente em produção. O resultado não decide que a ausência de precisão é aceitável: exige que o parecer delimite e justifique os usos permitidos, e que a decisão editorial os confirme.

## Atualização do pacote e próximo passo

Se fonte, definição, peso, método, teste ou documento congelado mudar, gerar novo inventário por `freeze()` e novo identificador; arquivar pareceres anteriores e iniciar registros vinculados à nova versão. Nunca reaproveitar parecer antigo apenas trocando seu hash de pacote. O gerador não modifica automaticamente o arquivo de pareceres.

**Próximo passo substantivo: revisão por responsável distinto da implementação**, com os seis critérios acima. A preparação técnica está concluída; não podemos declarar essa revisão realizada na ausência de parecer. Até o aceite, podem avançar melhorias do painel descritivo que não dependam da liberação do novo agregado. A obtenção de precisão municipal continua em trilha própria.
