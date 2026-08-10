"""Compra de folha de servidores pelos bancos — gold folha_bancos.json.

Três camadas com procedência distinta, nunca misturadas:

1. **Grandes leilões (curado)** — pipeline/curated/folha_leiloes.json: os
   eventos de manchete (INSS, estados, capitais), cada um com vencedor,
   valor, data e fonte com nível. Valores nunca somados entre leilões:
   escopos e prazos diferentes.
2. **Fluxo do PNCP (coletado)** — silver pncp_folha_*: contratos de folha
   com instituição financeira em todos os entes desde a obrigatoriedade da
   Lei 14.133 (2023-24), com vencedor por CNPJ e o flag `receita` (cessão
   onerosa: o banco paga ao ente). Ranking por CONTAGEM de contratos — os
   valores têm semântica mista (receita × despesa × simbólico) e não são
   somados.
3. **INSS por lote (curado)** — a ordem de preferência 2025-2029.

Ausência declarada: sem coleta do PNCP no estado atual, a camada 2 se
declara indisponível e as camadas curadas seguem publicadas.
"""
import json
from pathlib import Path

from pipeline import common

CURADO = Path(__file__).resolve().parent / "curated" / "folha_leiloes.json"
BALANCO = Path(__file__).resolve().parent / "curated" / "folha_balanco.json"


def _bloco_balanco():
    """Rodada 2 — o lado do balanço (Fase 2): intangível de folha nas DFP.

    Só observações com status `aprovado` são publicadas, com evidência
    completa (documento oficial CVM/ENET, página, trecho). O que está
    em revisão aparece apenas como contagem — nada de valor não revisado
    chega ao leitor. Conceitos NÃO comparáveis entre bancos: nunca somar."""
    try:
        cur = json.loads(BALANCO.read_text())
    except Exception:
        return None
    docs = cur.get("documentos", {})
    aprovadas, em_revisao = [], 0
    for o in cur.get("observacoes", []):
        if o.get("status") == "aprovado":
            d = docs.get(o.get("documento"), {})
            aprovadas.append({
                "id": o["id"], "banco": o["banco"], "cnpj8": o.get("cnpj8"),
                "metrica": o["metrica"], "valor": o.get("valor"), "unidade": o.get("unidade"),
                "data_ref": o.get("data_ref"), "exclusivo_folha": bool(o.get("exclusivo_folha")),
                "documento": {"titulo": d.get("titulo"), "url": d.get("url")},
                "pagina": o.get("pagina_doc") or f"p.{o.get('pagina_pdf')}",
                "trecho": o.get("trecho"), "revisor": o.get("revisor"),
            })
        elif o.get("status") == "em_revisao":
            em_revisao += 1
    return {
        "observacoes": aprovadas,
        "em_revisao": em_revisao,
        "leitura": ("O que o banco paga pela folha vira ativo intangível e se amortiza no prazo do "
                    "contrato — é o mesmo negócio dos leilões, visto pelo balanço. Só o Banco do Brasil "
                    "isola a folha em conta própria; nos demais o conceito é mais amplo ou não é isolado, "
                    "e cada observação declara isso em `exclusivo_folha`."),
        "cautelas": [
            "Conceitos e unidades diferem por banco (R$ mil × R$ milhões; folha isolada × categoria ampla): valores NUNCA são somados nem ranqueados entre bancos.",
            "Comparabilidade C: cada número vale dentro da divulgação do próprio banco, contra a própria série dele.",
        ],
        "fonte": {"nome": "CVM/ENET — Demonstrações Financeiras Padronizadas (DFP 31/12/2025), notas explicativas",
                  "nivel": "A"},
    }


def _rows(con, sql, params=()):
    try:
        return con.execute(sql, params).fetchall()
    except Exception:
        return []


def _cnpj8(ni):
    d = "".join(ch for ch in str(ni or "") if ch.isdigit())
    return d[:8].zfill(8) if d else ""


def _bloco_pncp(con):
    contratos = _rows(con, """
        SELECT numero_controle, orgao_nome, esfera, municipio, uf, modalidade,
               assinatura, vig_inicio, vig_fim, valor_global, receita,
               fornecedor_ni, fornecedor_nome, objeto, item_url
        FROM pncp_folha_contratos WHERE eh_if=1 ORDER BY assinatura DESC""")
    if not contratos:
        return {"disponivel": False,
                "motivo": "coleta do PNCP ainda sem contratos absorvidos nesta execução"}
    # ranking por CNPJ-raiz: a mesma instituição chega com grafias diferentes
    # ("BANCO BRADESCO S/A", "SA", "S.A.") — o rótulo é a grafia mais comum
    por_banco = {}
    for c in contratos:
        raiz = _cnpj8(c[11])
        d = por_banco.setdefault(raiz, {"contratos": 0, "ufs": set(), "nomes": {}, "receita": 0})
        d["contratos"] += 1
        if c[4]:
            d["ufs"].add(c[4])
        d["nomes"][c[12]] = d["nomes"].get(c[12], 0) + 1
        d["receita"] += 1 if c[10] else 0
    ranking = sorted(({
        "cnpj8": raiz,
        "banco": max(d["nomes"], key=d["nomes"].get),
        "contratos": d["contratos"],
        "ufs": len(d["ufs"]),
        "como_receita": d["receita"],
    } for raiz, d in por_banco.items()), key=lambda x: -x["contratos"])
    recentes = [{
        "controle": c[0], "ente": c[1], "esfera": c[2], "municipio": c[3], "uf": c[4],
        "modalidade": c[5], "assinatura": c[6], "vig_fim": c[8],
        "valor": c[9], "receita": bool(c[10]),
        "banco": c[12], "cnpj8": _cnpj8(c[11]),
        "url": f"https://pncp.gov.br{c[14]}" if c[14] else None,
    } for c in contratos[:40]]
    editais = _rows(con, """
        SELECT orgao_nome, municipio, uf, modalidade, situacao, publicacao, item_url
        FROM pncp_folha_editais ORDER BY publicacao DESC LIMIT 12""")
    total_editais = _rows(con, "SELECT COUNT(*) FROM pncp_folha_editais")
    backfill = bool(_rows(con, "SELECT 1 FROM pncp_folha_coleta WHERE chave='backfill_contratos'"))
    return {
        "disponivel": True,
        "total_contratos_if": len(contratos),
        "total_editais": total_editais[0][0] if total_editais else 0,
        "backfill_completo": backfill,
        "ranking": ranking,
        "recentes": recentes,
        "editais_recentes": [{
            "ente": e[0], "municipio": e[1], "uf": e[2], "modalidade": e[3],
            "situacao": e[4], "publicacao": e[5],
            "url": f"https://pncp.gov.br{e[6]}" if e[6] else None,
        } for e in editais],
        "criterio_if": ("Heurística declarada sobre a razão social do fornecedor "
                        "(denominações do sistema financeiro + marcas bancárias); contratos de "
                        "software/assessoria de folha ficam fora pelo objeto. Contagem por "
                        "CNPJ-raiz do fornecedor, como registrado pelo próprio ente no PNCP."),
        "fonte": {"nome": "PNCP — Portal Nacional de Contratações Públicas (Lei 14.133/2021)",
                  "url": "https://pncp.gov.br", "nivel": "A"},
    }


def build(con, cfg=None):
    cur = json.loads(CURADO.read_text())
    leiloes = sorted(cur["leiloes"], key=lambda x: str(x.get("data_resultado") or ""), reverse=True)
    pncp = _bloco_pncp(con)
    g = {
        "disponivel": True,
        "gerado_em": common.now_utc(),
        "titulo": "Quem banca a folha dos servidores",
        "leiloes": leiloes,
        "inss": cur["inss_lotes"],
        "pncp": pncp,
        "balanco": _bloco_balanco(),
        "sintese": [
            "A cessão da folha é o leilão em que o banco PAGA ao ente público pelo direito de ser o banco dos servidores — e, com isso, a porta do consignado e dos demais produtos.",
            "No INSS, o desenho é outro: ordem de preferência para pagar os novos benefícios (2025-2029), vencida pela Crefisa em 25 dos 26 lotes.",
        ],
        "cautelas": [
            "Valores de leilões distintos NUNCA são somados nem comparados diretamente: cada folha tem tamanho, prazo e desenho contratual próprios.",
            "No fluxo do PNCP, o valor do contrato tem semântica mista — cessão onerosa é receita do ente (o banco paga), contrato de tarifa é despesa, e muitos registros trazem valor simbólico. Por isso o ranking é por CONTAGEM de contratos, não por soma de valores.",
            "Cobertura do PNCP começa com a obrigatoriedade da Lei 14.133 (2023-24): leilões anteriores existem apenas na camada curada.",
            "Vencer a folha do INSS não é comprar carteira de consignado — é a preferência para pagar o benefício novo, que abre a relação bancária.",
            "A classificação de fornecedor como instituição financeira é heurística sobre a razão social, declarada no bloco do PNCP.",
        ],
        "catalogo": [
            {"id": "leiloes_curados", "nome": "Grandes leilões de folha", "conceito": "eventos curados com vencedor, valor e fonte nominal por nível de evidência", "unidade": "R$ por leilão (nunca somados)", "periodicidade": "por evento", "fonte": "curadoria com fontes A/B declaradas por entrada", "inicio": "2019", "limitacoes": "cobertura editorial, não censo", "versao": "v1"},
            {"id": "pncp_contratos_if", "nome": "Contratos de folha com IF no PNCP", "conceito": "contratos cujo objeto é folha de pagamento e cujo fornecedor é instituição financeira (heurística declarada)", "unidade": "contratos", "periodicidade": "diária (incremental)", "fonte": "PNCP api/search + api/pncp/v1", "inicio": "2023", "limitacoes": "valor com semântica mista; cobertura desde a Lei 14.133", "versao": "v1"},
            {"id": "folha_intangivel", "nome": "Intangível de folha nas DFP (Fase 2)", "conceito": "o que o banco carrega no balanço pelos direitos de folha adquiridos — extraído das notas explicativas das DFP com evidência (documento, página, trecho) e aprovação editorial", "unidade": "declarada por observação (R$ mil ou R$ milhões; nunca somados entre bancos)", "periodicidade": "anual (DFP) / trimestral (ITR) por extração", "fonte": "CVM/ENET — DFP, notas explicativas", "inicio": "2025", "limitacoes": "só o BB isola a folha; conceitos não comparáveis entre bancos; publicação exige status aprovado", "versao": "v1"},
            {"id": "inss_lotes", "nome": "Folha de benefícios do INSS por lote", "conceito": "ordem de preferência do pregão 90.005/2024 para pagar novos benefícios", "unidade": "lotes", "periodicidade": "por certame", "fonte": "INSS (página oficial do pregão)", "inicio": "2024", "limitacoes": "lances por lote pendentes de extração do termo de homologação", "versao": "v1"},
        ],
    }
    common.write_gold("folha_bancos.json", g)
    return {"ok": True, "leiloes": len(leiloes),
            "pncp_contratos": g["pncp"].get("total_contratos_if", 0) if g["pncp"].get("disponivel") else 0}
