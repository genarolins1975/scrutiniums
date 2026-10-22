"""Fluxo do dinheiro estadual: da arrecadação ao gasto por área, RREO do 6º bimestre.

Coleta (rede, sem credenciais), arquivando os bytes como as demais capturas:
    python3 -m pipeline.contas_estaduais.fluxo coletar --ano 2025 [--destino PASTA]
A captura nova vai para uma pasta própria (padrão: data/contas-estaduais/raw/<instante>-fluxo); promovê-la
à base publicada é decisão revisada: copiar para public/contas-estaduais/evidencias e apontar RAW para ela.
Consolidação, só a partir dos bytes arquivados (Anexo 01 da captura nacional e Anexos 02 e 03 desta):
    python3 -m pipeline.contas_estaduais.fluxo consolidar [--check]

Regras de leitura (declaradas também na página):
- Arrecadação: receitas correntes brutas do Anexo 03 (coluna "TOTAL (ÚLTIMOS 12 MESES)", que no 6º
  bimestre é janeiro a dezembro) mais as receitas de capital realizadas do Anexo 01.
- Repasse a municípios: dedução "Transferências Constitucionais e Legais" do Anexo 03.
- Retido para o Fundeb: dedução para formação do fundo, Anexo 03.
- Receita disponível: receita realizada exceto intra-orçamentárias, Anexo 01. Quando o estado registra
  a cota dos municípios como despesa (e não como dedução), ela sai da receita e da despesa.
- Gasto: despesa empenhada exceto intra-orçamentárias, Anexo 01; áreas pela despesa empenhada por
  função, Anexo 02. Diferenças entre demonstrativos viram faixa própria; nada é redistribuído.
Conferência significa identidade do ente, integridade dos bytes e aritmética; não é auditoria.
"""
import argparse
import datetime as dt
import json
import math
from pathlib import Path

from pipeline.contas_estaduais.coletar import UFS, agora, paginas
from pipeline.contas_estaduais.consolidar import ler as ler_registro

ROOT = Path(__file__).resolve().parents[2]
ANUAL = ROOT / "public/contas-estaduais/evidencias/20261012-nacional/anual"
RAW = ROOT / "public/contas-estaduais/evidencias/20261022-fluxo/anual"
OUT = ROOT / "src/lib/contas-estaduais/fluxo.json"
ANEXOS = {"rreo02": "RREO-Anexo 02", "rreo03": "RREO-Anexo 03"}
NOMES = dict(RO="Rondônia", AC="Acre", AM="Amazonas", RR="Roraima", PA="Pará", AP="Amapá",
             TO="Tocantins", MA="Maranhão", PI="Piauí", CE="Ceará", RN="Rio Grande do Norte",
             PB="Paraíba", PE="Pernambuco", AL="Alagoas", SE="Sergipe", BA="Bahia",
             MG="Minas Gerais", ES="Espírito Santo", RJ="Rio de Janeiro", SP="São Paulo",
             PR="Paraná", SC="Santa Catarina", RS="Rio Grande do Sul", MS="Mato Grosso do Sul",
             MT="Mato Grosso", GO="Goiás", DF="Distrito Federal")

DOZE_MESES = "TOTAL (ÚLTIMOS 12 MESES)"
REALIZADA = "Até o Bimestre (c)"
EMPENHADA_01 = "DESPESAS EMPENHADAS ATÉ O BIMESTRE (f)"
EMPENHADA_02 = "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)"
EXCETO_INTRA_02 = "Total das Despesas Exceto Intra-Orçamentárias"

# Lado da arrecadação: (id, rótulo, [(cod_conta do Anexo 03, rótulo da parte)])
FONTES = [
    ("icms", "ICMS", [("ICMSLiquidoExcetoTransferenciasEFUNDEB", "ICMS")]),
    ("ipva", "IPVA", [("IPVALiquidoExcetoTransferenciasEFUNDEB", "IPVA")]),
    # O Distrito Federal arrecada também os impostos municipais (IPTU, ISS e ITBI).
    ("outros_tributos", "Outros impostos e taxas", [
        ("IRRFLiquidoExcetoTransferenciasEFUNDEB", "Imposto de renda retido dos servidores"),
        ("ITCDLiquidoExcetoTransferenciasEFUNDEB", "ITCMD (heranças e doações)"),
        ("ISSLiquidoExcetoTransferenciasEFUNDEB", "ISS"),
        ("IPTULiquidoExcetoTransferenciasEFUNDEB", "IPTU"),
        ("ITBILiquidoExcetoTransferenciasEFUNDEB", "ITBI"),
        ("OutrasReceitasTributarias", "Taxas e outros tributos")]),
    ("fpe", "FPE (repasse da União)", [("RREO3CotaParteDoFPE", "Cota-parte do FPE")]),
    ("transferencias", "Fundeb, SUS e convênios", [
        ("RREO3TransferenciasDoFUNDEB", "Transferências do Fundeb"),
        ("RREO3OutrasTransferenciasCorrentes", "Outras transferências correntes (SUS, convênios)"),
        ("RREO3TransferenciasDaLC611989", "IPI-Exportação (LC 61/1989)"),
        ("RREO3CotaParteDoFPM", "Cota-parte do FPM"),
        ("RREO3CotaParteDoITR", "Cota-parte do ITR")]),
    ("contribuicoes", "Contribuições", [("RREO3ReceitaDeContribuicoes", "Contribuições")]),
    ("outras_correntes", "Rendimentos e outras", [
        ("RREO3ReceitaPatrimonial", "Receita patrimonial (aplicações, royalties)"),
        ("RREO3ReceitaDeServicos", "Serviços"),
        ("RREO3ReceitaAgropecuaria", "Agropecuária"),
        ("RREO3ReceitaIndustrial", "Industrial"),
        ("RREO3OutrasReceitasCorrentes", "Outras receitas correntes (multas, dívida ativa)")]),
]
CORRENTES = "ReceitasCorrentesLiquidasExcetoTransferenciasEFUNDEB"
TRIBUTARIA = "ReceitaTributariaLiquidaExcetoTransferenciasEFUNDEB"
TRANSF_CORRENTES = "RREO3TransferenciasCorrentes"
REPASSE = "ReceitaDeTransferenciasConstitucionaisELegais"
FUNDEB = "DeducaoDeReceitaParaFormacaoDoFUNDEB"
CAPITAL = "ReceitasDeCapital"
RECEITA_01 = "ReceitasExcetoIntraOrcamentarias"
DESPESA_01 = "DespesasExcetoIntraOrcamentarias"
CAPITAL_PARTES = [("OperacoesDeCredito", "Operações de crédito"), ("AlienacaoDeBens", "Alienação de bens"),
                  ("TransferenciasDeCapital", "Transferências de capital")]

# Lado do gasto: funções do Anexo 02 (rótulo de função da fonte) agrupadas por área.
AREAS = [
    ("previdencia", "Aposentadorias de servidores", ["Previdência Social"]),
    ("educacao", "Educação", ["Educação"]),
    ("saude", "Saúde", ["Saúde"]),
    ("seguranca", "Segurança pública", ["Segurança Pública"]),
    ("poderes", "Judiciário, MP e Legislativo", ["Judiciária", "Essencial à Justiça", "Legislativa"]),
    ("encargos", "Dívida e encargos especiais", ["Encargos Especiais"]),
    ("administracao", "Administração", ["Administração"]),
    ("transporte", "Transporte", ["Transporte"]),
    ("assistencia", "Assistência social", ["Assistência Social"]),
]
DEMAIS = ("demais", "Demais áreas")
FUNCOES_DE_GOVERNO = {
    "Legislativa", "Judiciária", "Essencial à Justiça", "Administração", "Defesa Nacional",
    "Segurança Pública", "Relações Exteriores", "Assistência Social", "Previdência Social", "Saúde",
    "Trabalho", "Educação", "Cultura", "Direitos da Cidadania", "Urbanismo", "Habitação", "Saneamento",
    "Gestão Ambiental", "Ciência e Tecnologia", "Agricultura", "Organização Agrária", "Indústria",
    "Comércio e Serviços", "Comunicações", "Energia", "Transporte", "Desporto e Lazer", "Encargos Especiais",
}
TOLERANCIA = 1.0  # R$; diferenças acima disso aparecem como faixa própria


def coletar(ano, pasta, ufs=None):
    pasta.mkdir(parents=True, exist_ok=False)
    registros = []
    for uf in ufs or sorted(UFS):
        for fonte, anexo in ANEXOS.items():
            params = dict(an_exercicio=ano, nr_periodo=6, co_tipo_demonstrativo="RREO",
                          no_anexo=anexo, co_esfera="E", id_ente=UFS[uf], limit=5000)
            registro = dict(uf=uf, ano=ano, fonte=fonte, parametros=params, iniciado_em=agora())
            destino = pasta / (uf + "-" + fonte)
            destino.mkdir()
            itens, arquivos = paginas("rreo", params, destino)
            registro.update(status="capturado" if itens else "sem_registro_na_consulta",
                            linhas=len(itens), paginas=arquivos)
            registros.append(registro)
            (pasta / "manifesto.json").write_text(
                json.dumps(dict(versao="0.1.0", registros=registros), ensure_ascii=False, indent=2) + "\n")
            print(uf, fonte, registro["status"], len(itens))
    return registros


def _valor(v, rotulo):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
        raise ValueError(f"Valor inválido: {rotulo}")
    return float(v)


def unico(itens, conta, coluna, rotulo=None, obrigatorio=True):
    linhas = [r for r in itens if r.get("cod_conta") == conta and r.get("coluna") == coluna
              and (rotulo is None or r.get("rotulo") == rotulo)]
    if not linhas:
        if obrigatorio:
            raise ValueError(f"Conta ausente: {conta} / {coluna}")
        return None
    if len(linhas) > 1:
        raise ValueError(f"Conta duplicada: {conta} / {coluna}")
    return _valor(linhas[0].get("valor"), conta)


def identidade(itens, uf, ano, anexo):
    for r in itens:
        if (r.get("uf") != uf or r.get("exercicio") != ano or r.get("cod_ibge") != UFS[uf]
                or r.get("periodo") != 6 or r.get("esfera") != "E" or r.get("anexo") != anexo):
            raise ValueError(f"Identidade, período ou anexo incompatível: {uf} {anexo}")


def funcoes(itens):
    """Despesa empenhada por função, exceto intra-orçamentárias.

    No Anexo 02 do Siconfi função e subfunção têm o mesmo cod_conta; a função é reconhecida pelo
    nome, na lista oficial das 28 funções de governo (Portaria MOG 42/1999), e a soma é conferida
    com o total "(I)" que o próprio anexo declara.
    """
    total = None
    por_funcao = {}
    for r in itens:
        if r.get("rotulo") != EXCETO_INTRA_02 or r.get("coluna") != EMPENHADA_02:
            continue
        conta = (r.get("conta") or "").strip()
        if conta.startswith("DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS)"):
            if total is not None:
                raise ValueError("Total do Anexo 02 duplicado")
            total = _valor(r.get("valor"), "total do Anexo 02")
        elif conta in FUNCOES_DE_GOVERNO:
            if conta in por_funcao:
                raise ValueError(f"Função duplicada: {conta}")
            por_funcao[conta] = _valor(r.get("valor"), conta)
    if total is None or not por_funcao:
        raise ValueError("Anexo 02 sem total ou sem funções")
    return total, por_funcao


def montar(uf, a01, a02, a03):
    receita_01 = unico(a01, RECEITA_01, REALIZADA)
    despesa_01 = unico(a01, DESPESA_01, EMPENHADA_01)
    capital = unico(a01, CAPITAL, REALIZADA)
    correntes = unico(a03, CORRENTES, DOZE_MESES)
    # O Distrito Federal não tem municípios e não declara a dedução da cota municipal.
    repasse = unico(a03, REPASSE, DOZE_MESES, obrigatorio=uf != "DF") or 0.0
    fundeb = unico(a03, FUNDEB, DOZE_MESES)
    for nome, v in (("receita", receita_01), ("despesa", despesa_01), ("correntes", correntes)):
        if v <= 0:
            raise ValueError(f"{uf}: {nome} não positiva")
    if min(capital, repasse, fundeb) < 0:
        raise ValueError(f"{uf}: valor negativo exige exame do perímetro")

    fontes = []
    for id_, nome, contas in FONTES:
        partes = [[rot, unico(a03, conta, DOZE_MESES, obrigatorio=False) or 0.0] for conta, rot in contas]
        fontes.append(dict(id=id_, nome=nome, valor=sum(p[1] for p in partes),
                           partes=[p for p in partes if len(contas) > 1 and p[1] != 0]))
    # As partes do Anexo 03 têm de fechar com os subtotais que o próprio anexo declara.
    tributos = sum(f["valor"] for f in fontes if f["id"] in ("icms", "ipva", "outros_tributos"))
    if abs(tributos - unico(a03, TRIBUTARIA, DOZE_MESES)) > TOLERANCIA:
        raise ValueError(f"{uf}: tributos do Anexo 03 não fecham")
    transf = sum(f["valor"] for f in fontes if f["id"] in ("fpe", "transferencias"))
    if abs(transf - unico(a03, TRANSF_CORRENTES, DOZE_MESES)) > TOLERANCIA:
        raise ValueError(f"{uf}: transferências do Anexo 03 não fecham")
    if abs(sum(f["valor"] for f in fontes) - correntes) > TOLERANCIA:
        raise ValueError(f"{uf}: receitas correntes do Anexo 03 não fecham")
    partes_capital = [[rot, unico(a01, conta, REALIZADA, obrigatorio=False) or 0.0] for conta, rot in CAPITAL_PARTES]
    outras_capital = capital - sum(p[1] for p in partes_capital)
    if outras_capital < -TOLERANCIA:
        raise ValueError(f"{uf}: partes das receitas de capital excedem o total")
    partes_capital.append(["Outras receitas de capital", max(outras_capital, 0.0)])
    fontes.append(dict(id="capital", nome="Empréstimos e capital", valor=capital,
                       partes=[p for p in partes_capital if p[1] != 0]))
    arrecadacao = correntes + capital

    # Onde a cota dos municípios foi registrada: a receita do Anexo 01 é comparada às duas hipóteses.
    sem_repasse = arrecadacao - fundeb - repasse
    com_repasse = arrecadacao - fundeb
    registro = "despesa" if abs(receita_01 - com_repasse) < abs(receita_01 - sem_repasse) else "deducao"
    receita = receita_01 - (repasse if registro == "despesa" else 0.0)
    gasto = despesa_01 - (repasse if registro == "despesa" else 0.0)
    diferenca_receita = sem_repasse - receita

    total_02, por_funcao = funcoes(a02)
    if abs(sum(por_funcao.values()) - total_02) > TOLERANCIA:
        raise ValueError(f"{uf}: funções do Anexo 02 não somam o total do próprio anexo")
    usos, usadas = [], set()
    for id_, nome, nomes_funcao in AREAS:
        partes = [[f, por_funcao[f]] for f in nomes_funcao if f in por_funcao]
        usadas.update(f for f in nomes_funcao)
        usos.append(dict(id=id_, nome=nome, valor=sum(p[1] for p in partes),
                         partes=partes if len(nomes_funcao) > 1 else []))
    resto = sorted(([f, v] for f, v in por_funcao.items() if f not in usadas and v != 0), key=lambda p: -p[1])
    usos.append(dict(id=DEMAIS[0], nome=DEMAIS[1], valor=sum(p[1] for p in resto), partes=resto))
    if registro == "despesa":
        encargos = next(u for u in usos if u["id"] == "encargos")
        if encargos["valor"] < repasse - TOLERANCIA:
            raise ValueError(f"{uf}: cota dos municípios registrada como despesa sem caber em Encargos Especiais")
        encargos["valor"] -= repasse
        encargos["partes"] = [["Encargos Especiais, sem a cota dos municípios", encargos["valor"]]]
    soma_areas = sum(u["valor"] for u in usos)
    diferenca_gasto = gasto - soma_areas
    if min(u["valor"] for u in usos) < -TOLERANCIA:
        raise ValueError(f"{uf}: área com valor negativo")

    resultado = receita - gasto
    # Identidades que o desenho exige: entra = sai em cada nó.
    entra = arrecadacao
    sai = repasse + fundeb + diferenca_receita + receita
    if abs(entra - sai) > TOLERANCIA:
        raise ValueError(f"{uf}: arrecadação não fecha")
    if abs(soma_areas + diferenca_gasto - gasto) > TOLERANCIA:
        raise ValueError(f"{uf}: gasto não fecha")
    return dict(
        uf=uf, nome=NOMES[uf], ano=2025, registro_repasse=registro,
        fontes=fontes, arrecadacao=arrecadacao, repasse=repasse, fundeb=fundeb,
        diferenca_receita=diferenca_receita if abs(diferenca_receita) > TOLERANCIA else 0.0,
        receita_disponivel=receita, gasto=gasto, resultado=resultado,
        usos=usos, diferenca_gasto=diferenca_gasto if abs(diferenca_gasto) > TOLERANCIA else 0.0,
        totais_fonte=dict(receita_anexo01=receita_01, despesa_anexo01=despesa_01, despesa_anexo02=total_02,
                          receitas_correntes_anexo03=correntes),
    )


def _registros(pasta):
    return json.loads((pasta / "manifesto.json").read_text())["registros"]


def consolidar():
    a01 = {r["uf"]: r for r in _registros(ANUAL) if r["fonte"] == "rreo" and r["ano"] == 2025}
    novos = {(r["uf"], r["fonte"]): r for r in _registros(RAW)}
    ufs, captura = [], None
    for uf in sorted(UFS, key=lambda u: UFS[u]):
        itens01, fontes01 = ler_registro(a01[uf], ANUAL)
        identidade(itens01, uf, 2025, "RREO-Anexo 01")
        lidos, fontes = {}, list(fontes01)
        for fonte, anexo in ANEXOS.items():
            itens, f = ler_registro(novos[(uf, fonte)], RAW)
            identidade(itens, uf, 2025, anexo)
            lidos[fonte] = itens
            fontes.extend(f)
        captura = max(captura or "", *(f["capturado_em"][:10] for f in fontes))
        ufs.append(dict(montar(uf, itens01, lidos["rreo02"], lidos["rreo03"]), evidencias=fontes))
    return dict(
        versao="0.1.0", captura=captura, exercicio=2025,
        perimetro=("RREO do 6º bimestre de 2025, esfera estadual. Arrecadação pelas receitas correntes brutas "
                   "do Anexo 03 (janeiro a dezembro) e pelas receitas de capital do Anexo 01; receita disponível "
                   "e gasto pelo Anexo 01, exceto intra-orçamentárias (receita realizada, despesa empenhada); "
                   "áreas pela despesa empenhada por função do Anexo 02. Valores nominais declarados por cada ente."),
        escopo_conferencia=("Identidade do ente, período, integridade dos bytes e aritmética. "
                            "Não constitui auditoria nem certificação do Tesouro."),
        ufs=ufs)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="acao", required=True)
    c = sub.add_parser("coletar")
    c.add_argument("--ano", type=int, default=2025)
    c.add_argument("--ufs", nargs="+", choices=sorted(UFS))
    c.add_argument("--destino", type=Path)
    k = sub.add_parser("consolidar")
    k.add_argument("--check", action="store_true")
    args = p.parse_args()
    if args.acao == "coletar":
        destino = args.destino or ROOT / "data/contas-estaduais/raw" / (
            dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-fluxo")
        coletar(args.ano, destino, args.ufs)
        print("Manifesto:", destino / "manifesto.json")
        return
    texto = json.dumps(consolidar(), ensure_ascii=False, indent=1) + "\n"
    if args.check:
        if OUT.read_text() != texto:
            raise SystemExit("Fluxo publicado diverge da reprodução")
        print("Fluxo estadual reproduzido a partir dos bytes arquivados.")
    else:
        OUT.write_text(texto)
        print("Gravado", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
