# Curadoria do Varejo: contrato dos arquivos

Arquivos escritos à mão a partir de documentos públicos. Regras que valem para todos:

- Todo número tem `fonte` (título, url do documento efetivamente usado, página ou tabela, período, `consultado_em` AAAA-MM-DD).
- `null` significa "não divulgado" ou "não acessado"; o motivo vai em `campos_sem_divulgacao` ou em `nota`. Nunca estimar.
- `natureza`: `"divulgado"` (pela empresa ou em demonstração), `"estimado_pela_fonte"` (a fonte declara estimativa), `"calculado"` (conta nossa, com fórmula).
- Explicações de causa dadas em release são atribuídas à administração ("segundo a administração").
- Texto em português do Brasil, sem travessão, sem adjetivo de julgamento ("melhor", "eficiente", "gestão ruim").
- Números financeiros de companhias abertas vêm de `public/varejo/gold/empresas.json` (CVM); a curadoria não os repete, só os cita nos parágrafos com o mesmo valor.

## ranking.json

```json
{
  "fonte": {"nome": "", "edicao": "", "exercicio": 2025, "url": "", "paginas": "", "consultado_em": "", "metodologia": "", "conceito_venda": "", "hierarquia_fontes": {"1": "", "2": "", "3": "", "4": "", "5": ""}},
  "grupos": [{
    "posicao": 1, "posicao_anterior": 1, "slug": "carrefour-brasil", "grupo": "", "bandeiras": [""],
    "segmento_irtt": "", "segmento": "alimentar|farmacia-beleza|eletromoveis|departamento|moda|foodservice|digital|outros",
    "vendas_milhoes": 0, "vendas_ano_anterior_milhoes": 0, "crescimento_pct": 0,
    "lojas": 0, "lojas_ano_anterior": 0, "funcionarios": 0,
    "capital": "aberto|fechado", "sede_uf": "SP", "estados": "todos" , "n_estados": 27,
    "natureza": "divulgado|estimado_pela_fonte", "nota_fonte": 1,
    "empresa_gold": "slug em empresas.json ou null", "pagina": 38
  }],
  "lideres_por_segmento": [{"segmento_irtt": "", "lider": "", "slug": "", "posicao_geral": 0, "vendas_milhoes": 0, "pagina": 0}],
  "soma_top300_milhoes": 0,
  "conferencias": [{"fonte": "ABRAS|IBEVAR-FIA", "edicao": "", "url": "", "consultado_em": "", "o_que_confere": "", "divergencias": [{"grupo": "", "valor_irtt": 0, "valor_outra": 0, "motivo": ""}], "nao_acessado": ""}]
}
```

## fichas/<slug>.json

```json
{
  "slug": "", "grupo": "", "resumo": "uma frase, até 160 caracteres, sobre o que o grupo é",
  "controlador": {"nome": "", "nota": "", "fonte": {}},
  "capital": "aberto|fechado|aberto no exterior", "empresa_gold": "slug ou null",
  "bandeiras": [{"nome": "", "formato": "", "nota": ""}],
  "formatos": [""], "regioes": {"texto": "", "estados": ["SP"]}, "canais": [""],
  "clientes": "", "fontes_de_receita": [{"nome": "", "descricao": ""}],
  "concorrentes": [{"nome": "", "slug": "slug de outra ficha ou null"}],
  "operacionais": [{"indicador": "Vendas nas mesmas lojas", "unidade": "%", "nota": "", "valores": [{"periodo": "2025", "valor": 0, "natureza": "divulgado"}], "fonte": {"titulo": "", "url": "", "pagina": "", "consultado_em": ""}}],
  "eventos": [{"data": "2025-05", "tipo": "aquisicao|desinvestimento|reapresentacao|recuperacao_judicial|fechamento_de_capital|mudanca_de_controle|outro", "descricao": "", "fonte": {}}],
  "alcance_do_dado": "obrigatório para operador digital ou grupo com serviços financeiros: o que a venda do ranking inclui e exclui (1P, 3P, GMV, comissões, vendas de franqueados)",
  "analise": {
    "crescimento": "parágrafo 1: de onde veio o crescimento (lojas existentes, expansão, aquisições, mix, preço), com números e período",
    "rentabilidade_caixa": "parágrafo 2: rentabilidade e caixa; sem demonstrações, a evidência operacional que permite avaliar a posição competitiva",
    "acompanhar": {"indicador": "", "reforca": "que mudança reforçaria a leitura", "enfraquece": "que mudança enfraqueceria"}
  },
  "campos_sem_divulgacao": [""],
  "fontes": [{"titulo": "", "url": "", "pagina": "", "periodo": "", "consultado_em": ""}]
}
```

## segmentos.json

```json
{
  "segmentos": [{
    "slug": "alimentar", "nome": "", "atividades_pmc": ["alimentar"], "classes_pac": ["4711"],
    "equivalencia": "direta|parcial|sem_equivalencia", "nota_equivalencia": "",
    "o_que_se_vende": "", "quem_compra": "", "canais": "", "o_que_determina_a_demanda": "", "onde_se_forma_a_margem": "",
    "concorrentes": [{"nome": "", "slug": "", "tipo": "nacional|regional|independentes", "fonte": {}}],
    "indicador_operacional": {"nome": "Giro de estoque", "formula": "", "por_que": "", "empresas": ["assai"]},
    "fontes": []
  }],
  "ecommerce": {"texto": "canal transversal", "fonte": {}}
}
```
