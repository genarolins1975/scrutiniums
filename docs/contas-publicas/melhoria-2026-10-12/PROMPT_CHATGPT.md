# Prompt para o ChatGPT (Codex) implementar as melhorias

Copie o bloco abaixo integralmente. Ele pressupõe acesso de escrita ao repositório `genarolins1975/scrutiniums`.

```text
PAPEL
Você é, ao mesmo tempo, designer de informação sênior de um grande jornal de dados, especialista em finanças públicas federais brasileiras (orçamento, RTN, restos a pagar, custos do setor público) e engenheiro front end de Next.js 14 com TypeScript estrito. Seu leitor final é um cidadão leigo. Seu padrão de rigor é o de um auditor do Tesouro. Seu padrão estético é o de uma publicação editorial de referência internacional.

REPOSITÓRIO E ESCOPO
Repositório: genarolins1975/scrutiniums. Crie a branch codex/contas-publicas-didatica a partir de main.
Escopo exclusivo: observatório de Contas Públicas Federais.
* Rotas: src/app/contas-publicas/ (page.tsx, [capitulo]/page.tsx, dados/page.tsx, metodologia/page.tsx, layout.tsx, contas.css)
* Componentes: src/components/contas-publicas/ (PaineisDados, PainelRAP, PainelCustos, PainelMetas, FichaIndicador, CatalogoIndicadores)
* Modelos: src/lib/contas-publicas/ (dados.ts, rap-modelo.ts, custos-leitura.ts, metas-modelo.ts, metas-dados.ts, catalogo.ts, entregas.ts, metricas.ts)
* Testes: src/tests/contas-publicas*.test.ts
Não altere outros observatórios.

LEITURA OBRIGATÓRIA ANTES DE ESCREVER CÓDIGO
1. docs/contas-publicas/melhoria-2026-10-12/RELATORIO.md (diagnóstico completo, achados I1 a D4, artefatos A0 a A10, rubrica). Este prompt implementa esse relatório.
2. .claude/skills/observatorio-layout/SKILL.md (contrato editorial e visual da plataforma; siga integralmente).
3. docs/contas-publicas/INICIO_DO_PROJETO.md, INTEGRACAO_DADOS.md, ETAPA3_FONTES_E_CONTRATOS.md, ETAPA4_CUSTOS.md (limites metodológicos que não podem ser violados).
4. As capturas antes-*.jpg da mesma pasta.

RESTRIÇÕES INEGOCIÁVEIS
1. Não altere snapshots (src/lib/contas-publicas/snapshots/*.json), importadores (scripts/contas-publicas/) nem contratos de dados. Toda mudança é de apresentação, formatação e cálculo derivado auditável.
2. Não invente número, série, definição, benchmark ou fonte. Todo valor exibido vem dos snapshots. Toda definição de glossário cita documento oficial com URL e data de consulta; se não encontrar fonte, deixe o verbete fora.
3. Não crie nota, ranking, semáforo ou adjetivo de desempenho ("eficiente", "ruim", "desperdício"). Sem verde e vermelho para bom e ruim.
4. Não publique média de cumprimento entre metas de produtos diferentes.
5. Não some estágios orçamentários, nem pais e filhos de custos, nem RAP com pago no exercício. Não compare 2026 parcial com 2025 fechado.
6. Não deflacione nem calcule % do PIB ou valor por habitante: exigem fontes novas não homologadas (artefato A9 fica fora deste PR).
7. Ausência, zero, inelegível e não calculável continuam como estados distintos, também visualmente.
8. Sem novas dependências de npm. Gráficos em SVG ou CSS, como já é feito no domínio.
9. Mantenha todos os testes existentes passando. Não desabilite nem pule testes.
10. Português do Brasil, padrão numérico brasileiro, acentuação correta. Textos públicos sem hífen ou travessão como pontuação; use ponto, dois pontos ou ponto médio (·).

FASE 1 · RIGOR E COERÊNCIA (commit próprio)
1.1 Crie src/lib/contas-publicas/formato.ts como formatador único e substitua bilhoes, moeda, bi, n, participacao e percentual espalhados nos componentes:
    * moeda(valorEmReais, {curta?}) com escala automática: ≥ R$ 1 trilhão com duas casas ("R$ 5,84 trilhões"); ≥ R$ 1 bilhão com uma casa ("R$ 391,5 bilhões"); abaixo, milhões com uma casa. Forma curta (tri, bi, mi) só em rótulos de gráfico.
    * Aceitar entrada em reais ou em milhões (RTN e RFC estão em milhões) via parâmetro explícito de unidade de origem.
    * Sinal de menos U+2212. Sinal de mais apenas em variações.
    * participacao e razao com uma casa decimal fixa ("24,0%", "100,0%").
    * pontosPercentuais distinto de variacaoPercentual.
    * Função dividirEmCem(valores) com arredondamento pelo maior resto, garantindo soma exata de 100,0.
    * Testes unitários em src/tests/contas-publicas-formato.test.ts cobrindo escalas, fronteiras (999,9 bi; 1 tri), negativos, zero, null ("Não informado") e soma exata de dividirEmCem com os grupos de pago 2025 do SIOP (resultado esperado: 35,1; 7,2; 45,6; 7,9; 3,4; 0,8).
1.2 Tokens semânticos em contas.css, mapeados aos tokens de src/app/globals.css: --cp-foco, --cp-referencia (neutro, não bronze), --cp-financeiro (bronze, só juros, amortização e custos financeiros), --cp-negativo (distinto do bronze, sem vermelho), --cp-pendente (hachura). Substitua todos os usos atuais de bronze. Verifique contraste: 4,5:1 para texto, 3:1 para marcas gráficas.
1.3 Status de capítulo derivado do estado real: substitua a caixa fixa "Contrato metodológico inicial" em [capitulo]/page.tsx por texto calculado a partir do catálogo e dos painéis presentes ("Dados observados: ... · Pendentes: ...").
1.4 Catálogo: a contagem deve declarar 4 indicadores com recorte observado e 1 painel complementar de custos que não homologa indicador.
1.5 Cartão "Pago no exercício": exibir abaixo do valor a parcela de serviço da dívida (juros + amortização) em reais e em participação, com nota "amortização inclui refinanciamento". Para 2025 o resultado deve ser R$ 2,14 trilhões, 42,2%.
1.6 Painel fiscal: substituir a frase com "R$ -42,9" e "diferença nominal de R$ -18,8" por frase em linguagem natural calculada: "O déficit primário passou de R$ 42,9 bilhões em 2024 para R$ 61,7 bilhões em 2025, aumento nominal de R$ 18,8 bilhões, sem correção pela inflação." Trate os quatro casos (déficit para déficit, superávit para superávit, troca de sinal em cada direção) com testes.
1.7 Aplicar cp-section à seção "O percurso da gestão" em page.tsx.
1.8 RAP na abertura de 2026: o segundo cartão não pode repetir o saldo; mostrar a participação do exercício de origem mais recente no saldo.
1.9 Custos: quando o maior aumento em reais e a maior alta real forem o mesmo componente, fundir em um destaque e exibir no espaço liberado a maior redução. Anotar diretamente nas barras de Previdenciários e Assistenciais e de Outros Custos que a classificação de 2024 foi revisada.

FASE 2 · ARTEFATOS DIDÁTICOS (um commit por artefato)
Cada artefato é um componente em src/components/contas-publicas/artefatos/, com: pergunta como título, subtítulo com unidade, período e perímetro, rótulos diretos, faixa de proveniência (A8), valores exatos acessíveis (tabela, details ou title), descrição textual para leitor de tela via figcaption ou aria-describedby, e teste de identidade dos números.
A0 Três respostas na abertura do início: "Quanto o governo federal pagou em 2025?", "Arrecadou mais do que gastou?", "Quanto ficou para pagar nos anos seguintes?". Frases calculadas; link para o capítulo; nada de adjetivo.
A1 Régua de R$ 100 pagos (SIOP 2025 e 2026 conforme seletor): barra 100% ou grade 10 × 10, dívida em --cp-financeiro, nota sobre refinanciamento. Usa dividirEmCem.
A2 Escada dos estágios: dotação inicial, atualizada, empenhado, liquidado, pago; degraus rotulados com a diferença (2025: R$ 456,0 bi; R$ 224,7 bi; R$ 100,5 bi). Texto fixo: diferença entre estágios não é desperdício nem economia.
A3 Ponte fiscal do RTN: receita total, menos transferências, receita líquida, menos os quatro grupos de despesa, resultado. Teste: a ponte fecha com tolerância já usada no domínio. Nota: acima da linha, não apura meta fiscal.
A4 Ciclo de vida do RAP: linha do tempo empenho, inscrição em 31/12, reinscrição, pagamento ou cancelamento; abaixo, saldo por faixas de idade (1 ano, 2 a 3, 4 a 5, 6 ou mais), mantendo a tabela por exercício. Na visão de encerramento, barra única 100% de pagamentos, cancelamentos e saldo.
A5 Barra de cumprimento em metas: realizado como barra neutra, marcador sólido na meta atual e tracejado na original; acima de 100% a barra ultrapassa o marcador; estados não calculáveis em texto e hachura.
A6 Régua de R$ 100 de custo (RFC 2025) sincronizada ao seletor de grupo existente; itens fora do custo em régua separada.
A8 Componente Proveniencia único (fonte, referência, publicação, captura, perímetro, unidade, natureza), substituindo os rodapés de fonte atuais. Data nula aparece como "não identificada".
A10 Matriz de cobertura no catálogo: 12 capítulos × estados, derivada de catalogo.ts, com filtro por estado.

FASE 3 · LEITURA E MOBILIDADE
3.1 Glossário (A7): src/lib/contas-publicas/glossario.ts com verbetes {termo, definicao, fonte, url, consulta}; componente Termo com sublinhado pontilhado e popover acessível por teclado, toque e leitor de tela; página /contas-publicas/glossario. Verbetes mínimos: dotação inicial, dotação atualizada, empenho, liquidação, pagamento, restos a pagar processados e não processados, reinscrição, GND, resultado primário, acima da linha, programação financeira, localizador, plano orçamentário, custo contábil. Fontes aceitas: Manual Técnico de Orçamento (SOF), Manual de Contabilidade Aplicada ao Setor Público (STN), glossários do Tesouro Nacional e do SIOP.
3.2 Metas no celular (≤ 760 px): sem rolagem horizontal para a tarefa principal. Cada linha mostra título curto, nome do localizador, barra A5 e os números meta, realizado e razão. A tabela completa fica disponível por alternância. Nome do localizador também no desktop. Detalhe da programação: painel lateral fixo no desktop, expansão logo abaixo da linha no celular, foco gerenciado. Sublinhado de títulos só em foco e hover.
3.3 Início enxuto: manter A0 e A1 com link aos capítulos; os painéis completos de orçamento e fiscal ficam apenas em execucao e panorama. Fichas do catálogo passam a apontar para os capítulos.
3.4 Catálogo: downloads reunidos em uma tabela "Dados abertos" ao final (conteúdo, formato, data de captura), em vez de cinco botões no topo.
3.5 Gráfico de resultado anual: manter escala comum com 2020 anotado; alternância "reescalar sem 2020" com aviso visível de mudança de escala.

VALIDAÇÃO OBRIGATÓRIA ANTES DE ABRIR O PR
1. npm ci
2. npx vitest run src/tests/contas-publicas*.test.ts (todos passando, incluindo os novos)
3. npm run lint e npx tsc --noEmit (registrar no PR qualquer falha preexistente fora do domínio, sem corrigi-la)
4. npm run build
5. Capturas de página inteira em 1440 px e 390 px das rotas /contas-publicas, /panorama, /execucao, /restos-a-pagar, /custos, /metas, /dados, /metodologia e /glossario, antes e depois, salvas em docs/contas-publicas/melhoria-2026-10-12/depois-*.jpg (JPEG, largura máxima 1100 px).
6. axe-core nas mesmas rotas: zero violações. Verificação manual por teclado em metas e glossário, descrita no PR.
7. Conferência aritmética: para cada número citado nos critérios acima (R$ 2,14 trilhões e 42,2%; régua 35,1 / 7,2 / 45,6 / 7,9 / 3,4 / 0,8; degraus 456,0 / 224,7 / 100,5; déficits 42,9 e 61,7), confirme o valor renderizado.
8. Revisão do próprio diff procurando: número inventado, adjetivo de desempenho, verde ou vermelho, soma indevida, hífen ou travessão em texto público, valor sem unidade ou período.

ENTREGA
Abra um PR para main com título "Contas Públicas: didática, coerência e artefatos visuais". Corpo do PR:
* O que mudou para o leitor, por fase.
* Tabela achado do relatório (I1 a D4) × status (resolvido, parcial, não feito e motivo).
* Rubrica do relatório preenchida com nota depois, por página, marcando "não verificado" onde faltar evidência.
* Capturas antes e depois.
* Resultados dos comandos de validação, com saída resumida.
* Limitações remanescentes.
Não faça merge nem deploy.

PARE E PERGUNTE SE
* Um achado exigir mudança em snapshot, importador ou contrato de dados.
* Não houver fonte oficial para um verbete ou rótulo de categoria.
* Um artefato só funcionar com dado que não existe nos snapshots.
* A correção de um achado entrar em conflito com regra do SKILL.md ou dos documentos metodológicos.
```
