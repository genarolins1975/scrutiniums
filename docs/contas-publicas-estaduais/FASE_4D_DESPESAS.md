# Fase 4D — composição econômica da despesa

Em 12/10/2026, a ficha estadual passou a detalhar a despesa liquidada de 2025 nas 27 UFs. A base desta etapa é o commit eea9e9daf3d3f847e667a7ca2309832f60a3b910, preservando execução, saldos, financiamento e dívida.

## Contrato

Fonte: respostas preservadas do Siconfi, RREO Anexo 01, coluna `DESPESAS LIQUIDADAS ATÉ O BIMESTRE (h)`. Seis contas exclusivas: pessoal e encargos, juros, outras despesas correntes, investimentos, inversões financeiras e amortização. Subcontas, intra-orçamentárias e refinanciamento destacado não são somados.

Cada conta deve ocorrer exatamente uma vez, com valor numérico finito e não negativo. Ausência e duplicação interrompem a consolidação; zero permanece zero. O total deve ser positivo. As três parcelas correntes, as três de capital e os dois subtotais reconciliam com seus respectivos totais, com tolerância de R$ 0,02. As 27 UFs apresentaram resíduos arredondados a três casas iguais a zero.

Todas as barras usam a mesma despesa liquidada como denominador. Tabela e CSV mostram valores exatos, códigos, coluna original, arquivo e SHA-256. Não há reaproveitamento de outro ano quando falta execução. Esta decomposição não cria novos indicadores: permanecem sete indicadores e 216 observações.

Investimentos não comprovam conclusão ou qualidade de obras; pessoal no RREO não corresponde à medida legal da LRF. A composição não sustenta ranking de eficiência.

## Validação local

- 48 testes Python aprovados com Python 3.12.
- 26 testes TypeScript aprovados; tipos e lint da nova implementação aprovados.
- Consolidação reproduzida com 81 capturas íntegras e 216 observações.
- Interface PE/2025 conferida em desktop, com abertura dos detalhes por Enter, valores exatos e hash presentes.
- A tentativa de viewport de 390 px resultou em largura efetiva de 520 px; sem transbordamento externo detectado pelo DOM, mas a captura estreita não permitiu concluir revisão visual. Revisão integral de 320/390/768/1440 px, zoom de 200% e leitor de tela permanece pendente.

Educação permanece sem observações promovidas devido às falhas da fonte oficial. TLS continua ativo. PR em rascunho; sem merge ou publicação em produção nesta etapa.
