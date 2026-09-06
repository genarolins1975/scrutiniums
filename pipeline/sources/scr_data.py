"""SCR.data Versão 2 — agregados públicos do Sistema de Informações de Créditos.

Fonte: dadosabertos.bcb.gov.br (dataset scr_data), zips anuais
https://www.bcb.gov.br/pda/desig/scrdata_{ANO}.zip com um CSV por data-base
(~102 MB, ~315 mil linhas totalmente cruzadas: uf × segmento × cliente ×
cnae_ocupacao × porte × modalidade × submodalidade × origem × indexador).

Decisões (docs/AUDITORIA_SCR.md):
- Fatos SEPARADOS por granularidade, todos agregados das linhas-base do mesmo
  mês — nunca somar um fato a outro (dupla contagem).
- numero_de_operacoes = -1 é SUPRESSÃO da fonte (proteção estatística):
  não vira zero; o agregado registra n_op como piso e conta células suprimidas.
- Ausência ≠ zero: célula que não existe no CSV não entra em nada.
- carteira_inadimplencia = inadimplência "arrastada" (>90d, operação inteira),
  conceito distinto do SGS 21082 — declarado no gold.
- Idempotente por data-base; zips anuais ficam em cache local (data/tmp_scr) e
  o sha de cada CSV mensal vai para bronze como metadado (o zip anual muda a
  cada mês, então o bronze guarda meta + sha, não o binário de 180 MB).
"""
import csv
import hashlib
import io
import os
import zipfile

from pipeline import common

ANOS = (2024, 2025, 2026)
URL = "https://www.bcb.gov.br/pda/desig/scrdata_{ano}.zip"
CACHE = os.path.join(common.ROOT, "data", "tmp_scr")

UF_REGIAO = {
    "AC": "Norte", "AP": "Norte", "AM": "Norte", "PA": "Norte", "RO": "Norte", "RR": "Norte", "TO": "Norte",
    "AL": "Nordeste", "BA": "Nordeste", "CE": "Nordeste", "MA": "Nordeste", "PB": "Nordeste",
    "PE": "Nordeste", "PI": "Nordeste", "RN": "Nordeste", "SE": "Nordeste",
    "DF": "Centro-Oeste", "GO": "Centro-Oeste", "MT": "Centro-Oeste", "MS": "Centro-Oeste",
    "ES": "Sudeste", "MG": "Sudeste", "RJ": "Sudeste", "SP": "Sudeste",
    "PR": "Sul", "RS": "Sul", "SC": "Sul",
}

# Ocupações PF de baixa participação agregadas (regra de proteção nº 3 da auditoria)
OCUP_AGREGA = {"Serviços domésticos": "Outros", "Empregado de entidades sem fins lucrativos": "Outros",
               "Organismos internacionais e outras instituições extraterritoriais": "Outros"}


def produto_de(modalidade, submod):
    """Mapa declarado (modalidade, submodalidade) -> produto amigável."""
    m, s = modalidade.lower(), submod.lower()
    if "rotativo vinculado a cart" in s:
        return "Cartão — rotativo"
    if "cartão de crédito - compra à vista" in s:
        return "Cartão — à vista"
    if "cartão de crédito" in s:
        return "Cartão — parcelado/financiado"
    if "cheque especial" in s or "adiantamentos a depositantes" in s:
        return "Cheque especial"
    if "com consignação" in s:
        return "Consignado"
    if "sem consignação" in s:
        return "Crédito pessoal"
    if "veículos autom" in s:
        return "Veículos"
    if "habitacional" in s or "imobiliário" in s or "imobiliario" in s or "arrendamento financeiro imob" in s:
        return "Imobiliário"
    if "rurais" in m:
        return "Rural"
    if "capital de giro" in s or "conta garantida" in s:
        return "Capital de giro"
    if "exportação" in m or "importação" in m or "cambiais" in s or "contratos de câmbio" in s:
        return "Comércio exterior"
    if "infraestrutura" in m:
        return "Infraestrutura"
    if "direitos creditórios" in m:
        return "Recebíveis descontados"
    if "arrendamento" in m or "arrendamento" in s:
        return "Arrendamento"
    return "Outros"


# Guarda contra carga truncada: uma data-base só entra se trouxer pelo menos esta
# fração das linhas da data-base anterior (o CSV mensal tem ~310 mil linhas e
# oscila menos de 2% de um mês para outro). Arquivo cortado no download ou zip
# corrompido fica FORA e vira falha declarada, nunca número publicado.
PISO_LINHAS = 0.90


def _ensure(con):
    metricas = "saldo REAL, n_op REAL, n_op_supr INTEGER, saldo_opv REAL, v1590 REAL, v90 REAL, inad REAL, ap REAL"
    con.executescript(f"""
    CREATE TABLE IF NOT EXISTS scr_carga(data TEXT PRIMARY KEY, crc TEXT, tamanho INTEGER, linhas INTEGER,
        saldo REAL, coletado_em TEXT);
    CREATE TABLE IF NOT EXISTS scr_uf(data TEXT, uf TEXT, cliente TEXT, {metricas},
        pz90 REAL, pz360 REAL, pz1080 REAL, pz1800 REAL, pz5400 REAL, pzmais REAL,
        PRIMARY KEY(data, uf, cliente));
    CREATE TABLE IF NOT EXISTS scr_uf_produto(data TEXT, uf TEXT, cliente TEXT, produto TEXT, {metricas},
        PRIMARY KEY(data, uf, cliente, produto));
    CREATE TABLE IF NOT EXISTS scr_uf_renda(data TEXT, uf TEXT, cliente TEXT, faixa TEXT, {metricas},
        PRIMARY KEY(data, uf, cliente, faixa));
    CREATE TABLE IF NOT EXISTS scr_uf_ocupacao(data TEXT, uf TEXT, cliente TEXT, grupo TEXT, {metricas},
        PRIMARY KEY(data, uf, cliente, grupo));
    CREATE TABLE IF NOT EXISTS scr_renda_produto(data TEXT, cliente TEXT, faixa TEXT, produto TEXT, {metricas},
        PRIMARY KEY(data, cliente, faixa, produto));
    CREATE TABLE IF NOT EXISTS scr_ocup_produto(data TEXT, cliente TEXT, grupo TEXT, produto TEXT, {metricas},
        PRIMARY KEY(data, cliente, grupo, produto));
    CREATE TABLE IF NOT EXISTS scr_uf_ocup_produto(data TEXT, uf TEXT, cliente TEXT, grupo TEXT,
        produto TEXT, {metricas}, PRIMARY KEY(data, uf, cliente, grupo, produto));
    CREATE TABLE IF NOT EXISTS scr_uf_origem(data TEXT, uf TEXT, cliente TEXT, origem TEXT, saldo REAL, inad REAL,
        PRIMARY KEY(data, uf, cliente, origem));
    """)


class _Agg(dict):
    """Acumulador saldo/n_op/supressão/atrasos por chave."""

    def add(self, key, saldo, n_op, v1590, v90, inad, ap):
        a = self.get(key)
        if a is None:
            a = self[key] = [0.0, 0.0, 0, 0.0, 0.0, 0.0, 0.0, 0.0]
        a[0] += saldo
        if n_op < 0:
            a[2] += 1  # célula suprimida na fonte: n_op vira PISO, nunca zero
        else:
            a[1] += n_op
            a[3] += saldo  # saldo_opv: numerador válido p/ saldo médio por operação
        a[4] += v1590; a[5] += v90; a[6] += inad; a[7] += ap


def _absorve_mes(con, fh, data_base, min_linhas=0):
    num = lambda s: float(s.replace(",", ".")) if s else 0.0
    rdr = csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8-sig"), delimiter=";")
    a_uf, a_ufprod, a_ufrenda, a_ufocup, a_rendaprod, a_ocupprod = _Agg(), _Agg(), _Agg(), _Agg(), _Agg(), _Agg()
    # Corte triplo uf × ocupação × produto, restrito ao consignado. É a única medida
    # pública que separa consignado de aposentado e pensionista por unidade da federação,
    # e existe só porque o CSV do SCR vem totalmente cruzado. Guardar o corte triplo
    # inteiro geraria centenas de milhares de linhas por mês sem uso; a restrição ao
    # consignado é deliberada e está declarada em docs/AUDITORIA_CONSIGNADO.md.
    a_ufocupprod = _Agg()
    prazos, a_origem = {}, {}
    n = 0
    for row in rdr:
        n += 1
        uf, cli = row["uf"], row["cliente"]
        saldo = num(row["carteira_ativa"])
        v1590, v90 = num(row["vencido_de_15_ate_90_dias"]), num(row["vencido_acima_de_90_dias"])
        inad, ap = num(row["carteira_inadimplencia"]), num(row["ativo_problematico"])
        n_op = float(row["numero_de_operacoes"] or -1)
        produto = produto_de(row["modalidade"], row["submodalidade"])
        ocup = row["cnae_ocupacao"].strip()
        ocup = OCUP_AGREGA.get(ocup, ocup)
        faixa = row["porte"].strip()
        args = (saldo, n_op, v1590, v90, inad, ap)
        a_uf.add((uf, cli), *args)
        a_ufprod.add((uf, cli, produto), *args)
        a_ufrenda.add((uf, cli, faixa), *args)
        a_ufocup.add((uf, cli, ocup), *args)
        a_rendaprod.add((cli, faixa, produto), *args)
        a_ocupprod.add((cli, ocup, produto), *args)
        if produto == "Consignado":
            a_ufocupprod.add((uf, cli, ocup, produto), *args)
        pz = prazos.setdefault((uf, cli), [0.0] * 6)
        for i, c in enumerate(("a_vencer_ate_90_dias", "a_vencer_de_91_ate_360_dias", "a_vencer_de_361_ate_1080_dias",
                               "a_vencer_de_1081_ate_1800_dias", "a_vencer_de_1801_ate_5400_dias",
                               "a_vencer_acima_de_5400_dias")):
            pz[i] += num(row[c])
        o = a_origem.setdefault((uf, cli, row["origem"]), [0.0, 0.0])
        o[0] += saldo; o[1] += inad

    if n < min_linhas:
        raise ValueError(f"{data_base}: {n} linhas, abaixo do piso de {min_linhas} "
                         f"({PISO_LINHAS:.0%} da data-base anterior) — arquivo possivelmente truncado; nada gravado")
    d = data_base
    con.execute("DELETE FROM scr_uf WHERE data=?", (d,))
    con.executemany("INSERT INTO scr_uf VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    [(d, k[0], k[1], *v, *prazos[k]) for k, v in a_uf.items()])
    for tabela, agg in (("scr_uf_produto", a_ufprod), ("scr_uf_renda", a_ufrenda), ("scr_uf_ocupacao", a_ufocup),
                        ("scr_renda_produto", a_rendaprod), ("scr_ocup_produto", a_ocupprod)):
        con.execute(f"DELETE FROM {tabela} WHERE data=?", (d,))
        con.executemany(f"INSERT INTO {tabela} VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                        [(d, *k, *v) for k, v in agg.items()])
    con.execute("DELETE FROM scr_uf_ocup_produto WHERE data=?", (d,))
    con.executemany("INSERT INTO scr_uf_ocup_produto VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    [(d, *k, *v) for k, v in a_ufocupprod.items()])
    con.execute("DELETE FROM scr_uf_origem WHERE data=?", (d,))
    con.executemany("INSERT INTO scr_uf_origem VALUES(?,?,?,?,?,?)",
                    [(d, *k, *v) for k, v in a_origem.items()])
    con.commit()
    return n, sum(v[0] for v in a_uf.values())


def _mes_anterior(data_base):
    ano, mes = int(data_base[:4]), int(data_base[5:7])
    return f"{ano - 1}-12" if mes == 1 else f"{ano}-{mes - 1:02d}"


def collect(con, cfg):
    """Zips anuais do SCR.data, um CSV por data-base.

    Três regras (auditoria de 06/09/2026, achado D1):
    - ano fechado com as 12 datas-base já carregadas nem é baixado (o zip de
      2024 e o de 2025 não mudam mais; eram ~200 MB por execução à toa);
    - o CRC32 do CSV dentro do zip identifica a REVISÃO da fonte: o BCB
      reescreve o zip do ano corrente a cada mês e revisa meses anteriores
      (2026-06 e 2026-07 mudaram entre 05 e 06/09/2026). Data-base com CRC
      diferente do carregado é reabsorvida; igual, é pulada;
    - piso de linhas contra arquivo truncado (PISO_LINHAS): abaixo dele nada é
      gravado e a falha fica declarada em fontes_status.
    """
    _ensure(con)
    os.makedirs(CACHE, exist_ok=True)
    results = []
    ja = {r[0] for r in con.execute("SELECT DISTINCT data FROM scr_uf")}
    carga = {r[0]: {"crc": r[1], "linhas": r[2]} for r in con.execute("SELECT data, crc, linhas FROM scr_carga")}
    ano_corrente = int(common.now_utc()[:4])
    for ano in ANOS:
        meses_ano = {f"{ano}-{m:02d}" for m in range(1, 13)}
        # ano fechado só é pulado quando as 12 datas-base foram carregadas COM o
        # registro de carga (scr_carga): o silver semeado trazia scr_uf de 2024 e
        # 2025 sem o corte triplo scr_uf_ocup_produto, e a idempotência por
        # scr_uf impedia para sempre o preenchimento (Consignado em stub desde
        # 04/08/2026). Na primeira execução com scr_carga tudo é reabsorvido.
        if ano < ano_corrente and meses_ano <= ja and meses_ano <= set(carga):
            results.append({"key": f"scr_data:{ano}", "ok": True, "pulado": "ano fechado com 12 datas-base carregadas"})
            continue
        zpath = os.path.join(CACHE, f"scrdata_{ano}.zip")
        try:
            if not os.path.exists(zpath):
                common.http_download(URL.format(ano=ano), zpath, timeout=1200)
            zf = zipfile.ZipFile(zpath)
            for name in sorted(zf.namelist()):
                am = name.replace("scrdata_", "").replace(".csv", "")
                data_base = f"{am[:4]}-{am[4:6]}"
                info = zf.getinfo(name)
                crc = f"{info.CRC:08x}:{info.file_size}"
                if data_base in ja and carga.get(data_base, {}).get("crc") == crc:
                    continue  # mesma revisão da fonte: nada a fazer
                # data-base carregada antes de existir o registro de revisão é
                # reabsorvida uma vez: a fonte pode ter revisado nesse intervalo
                # (2026-06 e 2026-07 mudaram entre 05 e 06/09/2026)
                revisao = "reabsorvida" if data_base in ja else "nova"
                anterior = carga.get(_mes_anterior(data_base), {}).get("linhas")
                piso = int(anterior * PISO_LINHAS) if anterior else 0
                with zf.open(name) as fh:
                    sha = hashlib.sha256(fh.read(1 << 22)).hexdigest()  # sha do 1º bloco (id do vintage)
                with zf.open(name) as fh:
                    n, saldo = _absorve_mes(con, fh, data_base, min_linhas=piso)
                con.execute("INSERT OR REPLACE INTO scr_carga VALUES(?,?,?,?,?,?)",
                            (data_base, crc, info.file_size, n, saldo, common.now_utc()))
                con.commit()
                carga[data_base] = {"crc": crc, "linhas": n}
                ja.add(data_base)
                common.record_lineage(con, "panorama.json", f"tmp_scr/scrdata_{ano}.zip::{name}", sha,
                                      "linhas-base SCR.data v2 -> fatos scr_* (agregação por mês; -1 = supressão preservada)")
                results.append({"key": f"scr_data:{data_base}", "ok": True, "linhas": n, "revisao": revisao})
        except Exception as e:
            results.append({"key": f"scr_data:{ano}", "ok": False, "error": str(e)[:200]})
    return results or [{"key": "scr_data", "ok": True, "note": "todas as datas-base já absorvidas"}]
