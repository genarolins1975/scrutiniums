"""Gold epae.json — fluxos Pix entre pessoas físicas e a seção CNAE de artes,
cultura, esporte e recreação, como publicados pelo Banco Central (EPAE).

Este arquivo republica DADO OBSERVADO. Ele não estima, não projeta e não
atribui parcela alguma às apostas. A razão de existir é dar ao leitor a série
que estudos de terceiros usam como insumo — inclusive o box de bets do 3º
Update do Boletim Fiscal (Comsefaz/Cicef) — para que a distância entre o que o
BC mede e o que um modelo atribui fique visível em vez de implícita.

Três limites conceituais viajam com o dado até a tela:

1. **A seção não é bets.** A menor abertura pública da EPAE é a seção da CNAE.
   "Artes, cultura, esporte e recreação" (seção R) reúne academias, clubes,
   casas de espetáculo, cinemas, parques, loterias e apostas. Qualquer parcela
   atribuída a apostas é hipótese de terceiro, não medição do BC.
2. **Legal e ilegal não se separam.** A EPAE classifica pelo CNAE do recebedor;
   não há recorte de autorização da SPA.
3. **Fluxo não é perda.** O que uma pessoa envia a um recebedor da seção não é
   aposta, nem depósito, nem GGR. O líquido (enviado menos devolvido) é a única
   grandeza derivada aqui, é aritmética sobre dois valores publicados e vem
   declarada como calculada.

Escopo da fonte (declarado pelo BC): apenas transações liquidadas no SPI —
Pix interno à mesma instituição fica de fora; excluem-se devoluções,
cancelamentos, saques/troco e transações de mesma titularidade; pares com menos
de quatro transações no mês vão para "Outros" por confidencialidade. Os quatro
últimos meses são revisados a cada divulgação.
"""
from pipeline import common
from pipeline.sources.epae import PAGINA, SETOR_ARTES, SETOR_PF, URL

BI = 1e9
MI = 1e6

SECAO = {
    "codigo": "R",
    "rotulo": "Artes, cultura, esporte e recreação",
    "rotulo_fonte": SETOR_ARTES,
    "abrange": ("academias, clubes esportivos, casas de espetáculo, cinemas, museus, parques, "
                "loterias e apostas, entre outras atividades"),
}

CONCEITOS = [
    {"termo": "pf_para_secao",
     "def": "valor pago por pessoas físicas a recebedores classificados na seção R, via Pix no SPI, no mês. "
            "Não é aposta, não é depósito em bet, não é GGR."},
    {"termo": "secao_para_pf",
     "def": "valor pago por recebedores da seção R a pessoas físicas no mesmo mês (prêmios, saques, "
            "reembolsos, salários e qualquer outro pagamento do setor a pessoas)."},
    {"termo": "liquido",
     "def": "pf_para_secao menos secao_para_pf. Derivação aritmética sobre dois valores publicados; "
            "mede o saldo de recursos que as pessoas transferiram ao setor no mês, não perda com apostas."},
    {"termo": "pf_para_pj_total",
     "def": "valor pago por pessoas físicas a TODOS os setores que não são pessoa física (inclui 'Outros'), "
            "no mesmo mês e mesmo instrumento. Serve de denominador de escala; a participação da seção é calculada na tela."},
]

LIMITACOES = [
    "A seção R da CNAE agrega muito mais do que apostas: nenhuma linha desta série pode ser lida como 'volume de bets'.",
    "A EPAE não separa operadores autorizados pela SPA de operadores ilegais.",
    "Só entram transações liquidadas no SPI: Pix entre contas da mesma instituição fica fora, assim como devoluções, saques/troco e transferências de mesma titularidade.",
    "Pares pagador×recebedor com menos de quatro transações no mês são realocados para 'Outros' por confidencialidade.",
    "Os quatro últimos meses são provisórios: o BC revisa m-1 a m-3 e fecha m-4 a cada divulgação.",
    "A série mede fluxo financeiro, não perda: comparar com o GGR do SIGAP exigiria conhecer payout e cobertura, que não são observados aqui.",
]


def _obs(con):
    """Série mensal dos dois sentidos + total PF→PJ, direto do silver."""
    artes = {r[0]: (r[1], r[2], r[3]) for r in con.execute(
        "SELECT data, valor, transacoes, recebedor FROM epae_fluxo WHERE pagador=? AND recebedor=?",
        (SETOR_PF, SETOR_ARTES))}
    volta = {r[0]: (r[1], r[2]) for r in con.execute(
        "SELECT data, valor, transacoes FROM epae_fluxo WHERE pagador=? AND recebedor=?",
        (SETOR_ARTES, SETOR_PF))}
    total_pj = {r[0]: (r[1], r[2]) for r in con.execute(
        "SELECT data, SUM(valor), SUM(transacoes) FROM epae_fluxo WHERE pagador=? AND recebedor<>? GROUP BY data",
        (SETOR_PF, SETOR_PF))}
    obs = []
    for ref in sorted(artes):
        ida_v, ida_q, _ = artes[ref]
        volta_v, volta_q = volta.get(ref, (0.0, 0))
        tot_v, _ = total_pj.get(ref, (0.0, 0))
        obs.append({
            "ref": ref,
            "pf_para_secao": round(ida_v / BI, 3),
            "secao_para_pf": round(volta_v / BI, 3),
            "liquido": round((ida_v - volta_v) / BI, 3),
            "tx_pf_para_secao": round(ida_q / MI, 2),
            "tx_secao_para_pf": round(volta_q / MI, 2),
            "pf_para_pj_total": round(tot_v / BI, 1),
        })
    return obs


def _anuais(obs):
    """Soma dos meses publicados de cada ano civil. Ano incompleto é marcado —
    nunca anualizado, nunca projetado."""
    anos = {}
    for o in obs:
        a = anos.setdefault(o["ref"][:4], {"meses": 0, "pf_para_secao": 0.0,
                                           "secao_para_pf": 0.0, "liquido": 0.0})
        a["meses"] += 1
        for k in ("pf_para_secao", "secao_para_pf", "liquido"):
            a[k] += o[k]
    saida = []
    for ano in sorted(anos):
        a = anos[ano]
        saida.append({
            "ano": int(ano), "meses": a["meses"], "completo": a["meses"] == 12,
            "pf_para_secao": round(a["pf_para_secao"], 2),
            "secao_para_pf": round(a["secao_para_pf"], 2),
            "liquido": round(a["liquido"], 2),
        })
    return saida


def _comparacao(anuais):
    """Confronto explícito entre o observado e o que o estudo de terceiro atribui.

    O número de R$ 62,5 bi do 3º Update do Boletim Fiscal NÃO é o líquido
    observado de 2025: é o líquido observado menos um contrafactual ARIMA que
    projeta o que a seção teria movimentado sem a entrada das bets reguladas.
    A diferença entre as duas grandezas é o modelo, e ela fica na tela.
    """
    a2025 = next((a for a in anuais if a["ano"] == 2025), None)
    if not a2025 or not a2025["completo"]:
        return None
    return {
        "ano": 2025,
        "observado": {
            "valor": a2025["liquido"],
            "rotulo": "líquido observado na EPAE (seção R inteira)",
            "status": "calculado",
            "derivacao": "soma dos 12 meses publicados de (pf_para_secao − secao_para_pf)",
            "nivel": "A",
        },
        "atribuido_estudo": {
            "valor": 62.5,
            "rotulo": "atribuído às bets pelo 3º Update do Boletim Fiscal (Comsefaz/Cicef)",
            "status": "estimativa",
            "derivacao": "líquido observado menos contrafactual ARIMA estimado com dados até ago/2024",
            "nivel": "D",
            "url": "https://comsefaz.org.br/novo/wp-content/uploads/2026/07/boletim_fiscal_3_update_v4.pdf",
        },
        "leitura": ("A diferença entre os dois números não é erro de nenhum lado: o primeiro é a soma do que o BC "
                    "publicou para a seção inteira; o segundo é quanto um modelo atribui às apostas, e supera o "
                    "observado porque o contrafactual projeta que, sem as bets, o setor teria devolvido mais do "
                    "que recebeu. Nenhum dos dois é medição de perda com apostas."),
    }


def build(con, cfg=None):
    row = con.execute("SELECT coletado_em, sha FROM epae_coleta WHERE chave='epae'").fetchone()
    obs = _obs(con)
    if not obs:
        return None
    anuais = _anuais(obs)
    payload = {
        "gerado_em": common.now_utc(),
        "titulo": "Pagamentos Pix por atividade econômica — seção de artes, cultura, esporte e recreação",
        "aviso": ("Série do Banco Central para a SEÇÃO INTEIRA da CNAE: ela reúne academias, clubes, "
                  "cinemas, parques, loterias e bets, e a EPAE não permite separá-las nem distinguir "
                  "operador autorizado de operador ilegal."),
        "fonte": {
            "nome": "Banco Central do Brasil — Estatísticas de Pagamentos por Atividade Econômica (EPAE)",
            "instrumento": "Pix liquidado no SPI",
            "url": URL,
            "pagina": PAGINA,
            "nivel": "A",
            "frequencia": "mensal",
            "coletado_em": row[0] if row else None,
            "sha256": row[1] if row else None,
        },
        "secao": SECAO,
        "conceitos": CONCEITOS,
        "limitacoes": LIMITACOES,
        "revisao": "O BC revisa os quatro últimos meses a cada divulgação (definitivo em m-4, provisório de m-1 a m-3).",
        "cobertura": {"inicio": obs[0]["ref"], "fim": obs[-1]["ref"], "meses": len(obs)},
        "unidades": {"valor": "R$ bilhões", "transacoes": "milhões de transações"},
        "serie": {"obs": obs},
        "anuais": anuais,
        "comparacao": _comparacao(anuais),
    }
    common.write_gold("epae.json", payload)
    return payload
