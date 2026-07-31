# METODOLOGIA_FRAUDES.md — aba "Fraudes financeiras e risco de crédito"

## Princípio central
O painel não assume que fraudes causam inadimplência. Investiga quatro dimensões: perda direta de recursos, efeitos indiretos no uso de crédito, impacto em comportamento financeiro e vulnerabilidade digital e institucional. Cada elemento declara sua categoria: dado observado, dado administrativo, estimativa, pesquisa declaratória, associação exploratória, evidência causal ou hipótese não testada. Correlação temporal nunca é apresentada como causalidade.

## Hierarquia de evidências (visível em cada indicador)
**A** administrativo oficial (BCB, FBSP/SINESP, PF, STJ, CERT.br) · **B** pesquisa oficial representativa (DataSenado, Cetic.br) · **C** acadêmico com método (WPs marcados) · **D** estimativa privada com método e interesse declarado · **E** sinal exploratório ou não validado em fonte primária.

## Conceitos protegidos por teste automatizado
Fraude consumada ≠ tentativa; perda bruta ≠ líquida; estorno/chargeback ≠ ausência de perda; digital ≠ presencial; engenharia social ≠ invasão técnica; conta comprometida ≠ identidade roubada; reportado ≠ estimado; evento ≠ vítima ≠ transação. Regras codificadas em `src/tests/fraudes-data.test.ts`:
1. Tentativas (Serasa) nunca aparecem com conceito de perda; a série declara "tentativa" no conceito.
2. Nenhum número de imprensa recebe nível A; dado oficial exige URL primária de órgão público.
3. A série do MED carrega `quebra_metodologica: true` (MED 2.0, fev/2026).
4. Séries anuais ordenadas, sem duplicatas, sem interpolação; timeline dentro de [2012, corte].
5. As camadas de subnotificação são apresentadas separadas; nenhum campo soma fontes da matriz de duplicidade.
6. Correlação bloqueada: `min_obs_correlacao` = 24 observações mensais comparáveis (hoje inexistentes).

## Por que o explorador não calcula correlações
A única série longa de exposição é o estelionato registrado: anual (n=8), com quebra de regime em 2020-21 (pandemia + digitalização + novo tipo penal) e subnotificação superior a 90%. Inadimplência e endividamento no mesmo período foram dominados pelo ciclo de juros. Qualquer correlação seria tendência espúria. O explorador exibe as séries de crédito mensais (SGS, já auditadas no Observatório) com os marcos de fraude e segurança anotados, sob o rótulo fixo "sem evidência suficiente".

## Achado central da literatura (e por que ele importa aqui)
A melhor evidência causal internacional (painéis de bureau de crédito, Philadelphia Fed) encontra que o roubo de identidade gera choque de crédito pequeno e transitório QUANDO a remediação é eficaz (arcabouço FCRA americano: correção cadastral, bloqueios, remoção de registros). A variável decisiva não é o golpe, é a recuperação. No Brasil, a devolução no MED foi de 9,3% em 2025, contra 61% a 89% no benchmark britânico de reembolso obrigatório. A hipótese central da aba, ainda não testada: com recuperação baixa, o dano de liquidez das vítimas brasileiras tende a ser mais persistente que o observado nos EUA.

## Estratégias de identificação futuras (quando houver dados)
- Diff-in-diff com a adoção escalonada de medidas antifraude entre instituições (Res. 403/2024, MED 2.0, biometria).
- Descontinuidades em datas de vigência regulatória com série mensal do MED.
- Variação entre instituições financeiras em taxas de devolução e marcação no DICT.
- Nada disso será publicado sem: choque plausivelmente exógeno, grupo de comparação válido, tendências prévias compatíveis, controles, ausência de antecipação, placebos, robustez e coerência econômica.

## Modelos preditivos
Somente com vintages respeitados, sem vazamento temporal, treino/validação/teste separados, ganho fora da amostra contra benchmarks simples, erros publicados e selo EXPERIMENTAL.

## Open Finance e pesquisa futura
Potencial: detecção de padrões de fraude, perda líquida por evento, recuperação de crédito pós-fraude, crédito emergencial e efeito em consumo/poupança, sempre agregado e consentido. Salvaguardas: minimização, células mínimas, controle de reidentificação, finalidade delimitada, consentimento específico, RIPD (LGPD), revisão jurídica e ética. Vedações absolutas: score individual de vítima, monitoramento sem consentimento, decisão automatizada de crédito por evento isolado de fraude.

## Design
Institucional e neutro, no design system do Observatório. Sem estética de "crime digital", sem alarmismo. Vermelho: perda confirmada/deterioração; âmbar: risco/estimativa; azul: dado observado; cinza: incerteza ou indisponível. Gráficos de um eixo; tabela acessível em cada gráfico; fontes e períodos em todos os rodapés.

## Resposta à pergunta central (estado em 31/07/2026)
- **Exposição**: 2,26 mi de estelionatos registrados em 2025 (+429% desde 2018, A); 24% da população declara perda com golpe em 12 meses (B); subnotificação policial de ~90%.
- **Perda**: R$ 10,1 bi reportados pelos bancos em 2024 (D, piso); recuperação de 9,3% no MED (A): perda de golpe Pix é quase toda definitiva. Intervalo especulativo superior: R$ 29 a 99 bi (E).
- **Mecanismos para o crédito**: perda de liquidez comprovada; uso de crédito emergencial, endividamento e atraso pós-fraude são hipóteses sem medição brasileira; evidência internacional aponta dano transitório sob remediação eficaz, condição que o Brasil não tem.
- **Relações medidas**: nenhuma relação causal doméstica; associações declaratórias apenas.
- **Hipóteses abertas**: persistência do dano com recuperação baixa; efeito das medidas de 2024-2026 (Res. 403, MED 2.0) sobre perdas; identificável com série mensal do MED e dados consentidos.
