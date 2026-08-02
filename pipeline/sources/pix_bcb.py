"""Pix e Meios de Pagamento — coletores Olinda/OData do BCB (ver docs/AUDITORIA_PIX.md).

Serviços: Pix_DadosAbertos (transações cruzadas, municípios, DICT, chaves, MED, EPAE),
MPV_DadosAbertos (meios de pagamento mensal/trimestral) e SPI (liquidação, intradia,
disponibilidade). Peculiaridades DESCOBERTAS NA AUDITORIA (não presumidas):
- parâmetro `Database`/`AnoMes` é o INÍCIO de uma janela que vai até o mês mais recente
  (1 chamada = história completa a partir dali);
- CSV usa vírgula decimal SEM separador de milhar; JSON usa ponto;
- MPV: quantidade em MILHARES e valor em R$ MILHÕES (validado por reconciliação);
- ausência ≠ zero: meses ausentes não são gravados; zeros do MPV (DOC/TEC após
  descontinuação) são zeros reais da fonte.
Idempotente: cada coleta substitui integralmente o período retornado pela fonte
(a fonte revisa meses recentes — recarga por janela preserva revisões).
"""
import csv
import io
import json
from datetime import date

from pipeline import common

PIX = "https://olinda.bcb.gov.br/olinda/servico/Pix_DadosAbertos/versao/v1/odata/"
MPV = "https://olinda.bcb.gov.br/olinda/servico/MPV_DadosAbertos/versao/v1/odata/"
SPI = "https://olinda.bcb.gov.br/olinda/servico/SPI/versao/v1/odata/"

TX_DESDE = "202011"      # lançamento do Pix
MUN_MESES = 14           # meses de detalhe municipal (série 13m + mês parcial de revisão)
CNAE_DESDE = "202501"    # EPAE agregada (18+ meses)


def _num(s):
    if s is None or s == "" or str(s).lower() == "null":
        return None
    return float(str(s).replace(",", "."))


def _csv(url):
    body, _meta = common.http_get(url, timeout=1800)
    return body, list(csv.DictReader(io.StringIO(body.decode("utf-8-sig"))))


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS mp_mensal(anomes TEXT, instrumento TEXT, qtd_mil REAL, valor_mi REAL,
        PRIMARY KEY(anomes, instrumento));
    CREATE TABLE IF NOT EXISTS mp_trimestral(tri TEXT, instrumento TEXT, qtd_mil REAL, valor_mi REAL,
        PRIMARY KEY(tri, instrumento));
    CREATE TABLE IF NOT EXISTS pix_tx(anomes TEXT, pag_pfpj TEXT, rec_pfpj TEXT, pag_regiao TEXT,
        rec_regiao TEXT, pag_idade TEXT, rec_idade TEXT, forma TEXT, natureza TEXT, finalidade TEXT,
        valor REAL, qtd REAL,
        PRIMARY KEY(anomes, pag_pfpj, rec_pfpj, pag_regiao, rec_regiao, pag_idade, rec_idade, forma, natureza, finalidade));
    CREATE TABLE IF NOT EXISTS pix_mun(anomes TEXT, cod_ibge TEXT, municipio TEXT, uf TEXT, regiao TEXT,
        vl_pag_pf REAL, qt_pag_pf REAL, vl_pag_pj REAL, qt_pag_pj REAL,
        vl_rec_pf REAL, qt_rec_pf REAL, vl_rec_pj REAL, qt_rec_pj REAL,
        pes_pag_pf REAL, pes_pag_pj REAL, pes_rec_pf REAL, pes_rec_pj REAL,
        PRIMARY KEY(anomes, cod_ibge));
    CREATE TABLE IF NOT EXISTS pix_dict(data TEXT PRIMARY KEY, pf REAL, pj REAL, total REAL);
    CREATE TABLE IF NOT EXISTS pix_chaves(data TEXT, ispb TEXT, nome TEXT, natureza TEXT, tipo TEXT,
        qtd REAL, segmento TEXT, PRIMARY KEY(data, ispb, natureza, tipo));
    CREATE TABLE IF NOT EXISTS pix_med(anomes TEXT PRIMARY KEY, payload TEXT);
    CREATE TABLE IF NOT EXISTS pix_cnae(anomes TEXT, cnssecao TEXT, naturezarel TEXT, finalidade TEXT,
        mei TEXT, qtd REAL, valor REAL, vl_compra REAL, vl_dinespec REAL, qt_recebedor REAL,
        PRIMARY KEY(anomes, cnssecao, naturezarel, finalidade, mei));
    CREATE TABLE IF NOT EXISTS spi_diario(data TEXT PRIMARY KEY, quantidade REAL, total REAL);
    CREATE TABLE IF NOT EXISTS spi_intradia(horario TEXT PRIMARY KEY, qtd_media REAL, total_medio REAL);
    CREATE TABLE IF NOT EXISTS spi_disp(database TEXT PRIMARY KEY, indice REAL, minimo REAL);
    """)


def _mp_mensal(con):
    body, rows = _csv(MPV + "MeiosdePagamentosMensalDA(AnoMes=@AnoMes)?@AnoMes='201501'&$format=text/csv")
    common.save_bronze("pix", "mpv_mensal.csv", body, {"fonte": "BCB MPV_DadosAbertos mensal",
                       "unidades": "quantidade em milhares; valor em R$ milhões"})
    n = 0
    for r in rows:
        am = r["AnoMes"]
        for inst in ("Pix", "TED", "TEC", "Cheque", "Boleto", "DOC"):
            q, v = _num(r.get(f"quantidade{inst}")), _num(r.get(f"valor{inst}"))
            if q is None and v is None:
                continue
            con.execute("INSERT OR REPLACE INTO mp_mensal VALUES(?,?,?,?)", (am, inst, q, v))
            n += 1
    return {"key": "mpv_mensal", "ok": True, "linhas": n}


def _mp_trimestral(con):
    # nome do parâmetro difere entre recursos — tentativas documentadas
    last_err = None
    for param in ("trimestre=@trimestre)?@trimestre='20151'",):
        try:
            body, rows = _csv(MPV + "MeiosdePagamentosTrimestralDA(" + param + "&$format=text/csv")
            break
        except Exception as e:
            last_err = e
            rows = None
    if not rows:
        raise last_err
    common.save_bronze("pix", "mpv_trimestral.csv", body, {"fonte": "BCB MPV_DadosAbertos trimestral"})
    insts = ["Pix", "TED", "TEC", "Cheque", "Boleto", "DOC", "CartaoCredito", "CartaoDebito", "CartaoPrePago",
             "TransIntrabancaria", "Convenios", "DebitoDireto", "Saques"]
    n = 0
    for r in rows:
        tri = r.get("datatrimestre") or r.get("trimestre")
        for inst in insts:
            q, v = _num(r.get(f"quantidade{inst}")), _num(r.get(f"valor{inst}"))
            if q is None and v is None:
                continue
            con.execute("INSERT OR REPLACE INTO mp_trimestral VALUES(?,?,?,?)", (tri, inst, q, v))
            n += 1
    return {"key": "mpv_trimestral", "ok": True, "linhas": n}


def _pix_tx(con):
    ja = {r[0] for r in con.execute("SELECT DISTINCT anomes FROM pix_tx")}
    desde = TX_DESDE if not ja else max(min(sorted(ja)[-3:]), TX_DESDE)  # recarrega os 3 últimos (revisões)
    body, rows = _csv(PIX + f"EstatisticasTransacoesPix(Database=@Database)?@Database='{desde}'&$format=text/csv")
    sha = common.save_bronze("pix", f"pix_tx_{desde}.csv", body,
                             {"fonte": "Pix_DadosAbertos EstatisticasTransacoesPix", "janela_desde": desde})[1]
    meses = {r["AnoMes"] for r in rows}
    for m in meses:
        con.execute("DELETE FROM pix_tx WHERE anomes=?", (m,))
    con.executemany("INSERT OR REPLACE INTO pix_tx VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                    [(r["AnoMes"], r["PAG_PFPJ"], r["REC_PFPJ"], r["PAG_REGIAO"], r["REC_REGIAO"],
                      r["PAG_IDADE"], r["REC_IDADE"], r["FORMAINICIACAO"], r["NATUREZA"], r["FINALIDADE"],
                      _num(r["VALOR"]), _num(r["QUANTIDADE"])) for r in rows])
    common.record_lineage(con, "pix.json", f"pix/pix_tx_{desde}.csv", sha,
                          "base transacional Pix (SPI) -> silver pix_tx; cobertura ~91% da qtd do universo doc 1201 (declarada)")
    return {"key": "pix_tx", "ok": True, "linhas": len(rows), "meses": len(meses)}


def _pix_mun(con):
    hoje = date.today()
    y, m = hoje.year, hoje.month
    for _ in range(MUN_MESES):
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    desde = f"{y}{m:02d}"
    body, rows = _csv(PIX + f"TransacoesPixPorMunicipio(DataBase=@DataBase)?@DataBase='{desde}'&$format=text/csv")
    common.save_bronze("pix", f"pix_mun_{desde}.csv", body, {"fonte": "TransacoesPixPorMunicipio", "desde": desde})
    meses = {r["AnoMes"] for r in rows}
    for mm in meses:
        con.execute("DELETE FROM pix_mun WHERE anomes=?", (mm,))
    con.executemany("INSERT OR REPLACE INTO pix_mun VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    [(r["AnoMes"], r["Municipio_Ibge"], r["Municipio"], r["Estado"], r["Regiao"],
                      _num(r["VL_PagadorPF"]), _num(r["QT_PagadorPF"]), _num(r["VL_PagadorPJ"]), _num(r["QT_PagadorPJ"]),
                      _num(r["VL_RecebedorPF"]), _num(r["QT_RecebedorPF"]), _num(r["VL_RecebedorPJ"]), _num(r["QT_RecebedorPJ"]),
                      _num(r["QT_PES_PagadorPF"]), _num(r["QT_PES_PagadorPJ"]), _num(r["QT_PES_RecebedorPF"]), _num(r["QT_PES_RecebedorPJ"]))
                     for r in rows])
    return {"key": "pix_mun", "ok": True, "linhas": len(rows), "meses": len(meses)}


def _pix_dict(con):
    body, _m = common.http_get(PIX + "PixUsuariosCadastradosDICT?$format=json&$top=10000", timeout=300)
    common.save_bronze("pix", "pix_dict.json", body, {"fonte": "PixUsuariosCadastradosDICT"})
    rows = json.loads(body)["value"]
    con.executemany("INSERT OR REPLACE INTO pix_dict VALUES(?,?,?,?)",
                    [(r["DataGraficosPix"], r["qtdUsuariosPessoaFisica"], r["qtdUsuariosPessoaJuridica"],
                      r["qtdUsuariosCadastradosDICTTotal"]) for r in rows])
    return {"key": "pix_dict", "ok": True, "linhas": len(rows)}


def _fim_de_mes(y, m):
    if m == 12:
        return f"{y}-12-31"
    return (date(y, m + 1, 1).toordinal() - 1) and date.fromordinal(date(y, m + 1, 1).toordinal() - 1).isoformat()


def _pix_chaves(con):
    """Estoque mais recente + estoque de 12 meses antes (nunca somar estoques)."""
    hoje = date.today()
    coletas = []
    for alvo_y, alvo_m in ((hoje.year, hoje.month), (hoje.year - 1, hoje.month)):
        y, m = alvo_y, alvo_m
        for _tent in range(4):  # anda para trás até achar snapshot publicado
            d = _fim_de_mes(y, m)
            try:
                body, rows = _csv(PIX + f"ChavesPix(Data=@Data)?@Data='{d}'&$format=text/csv")
            except Exception:
                rows = []
            if len(rows) > 20000:  # snapshot completo (~74 mil linhas); parciais em publicação são ignorados
                dd = rows[0]["Data"][:10]
                con.execute("DELETE FROM pix_chaves WHERE data=?", (dd,))
                con.executemany("INSERT OR REPLACE INTO pix_chaves VALUES(?,?,?,?,?,?,?)",
                                [(dd, r["ISPB"], r["Nome"], r["NaturezaUsuario"], r["TipoChave"],
                                  _num(r["qtdChaves"]), r["Segmento"]) for r in rows])
                coletas.append({"data": dd, "linhas": len(rows)})
                break
            m -= 1
            if m == 0:
                y, m = y - 1, 12
    return {"key": "pix_chaves", "ok": bool(coletas), "snapshots": coletas}


def _pix_med(con):
    body, rows = _csv(PIX + "EstatisticasFraudesPix(Database=@Database)?@Database='202001'&$format=text/csv")
    common.save_bronze("pix", "pix_med.csv", body, {"fonte": "EstatisticasFraudesPix (MED)"})
    for r in rows:
        con.execute("INSERT OR REPLACE INTO pix_med VALUES(?,?)",
                    (r["AnoMes"], json.dumps({k: _num(v) if k != "AnoMes" else v for k, v in r.items()},
                                             ensure_ascii=False)))
    return {"key": "pix_med", "ok": True, "linhas": len(rows)}


def _pix_cnae(con):
    body, rows = _csv(PIX + f"CnaePorteRecebedor(Database=@Database)?@Database='{CNAE_DESDE}'&$format=text/csv")
    common.save_bronze("pix", f"pix_cnae_{CNAE_DESDE}.csv", body, {"fonte": "CnaePorteRecebedor (EPAE)"})
    agg = {}
    for r in rows:
        k = (r["AnoMes"], r["cnssecao"], r["naturezarel"], r["finalidade"], r["mei"])
        a = agg.setdefault(k, [0.0] * 5)
        a[0] += _num(r["qtlanliq"]) or 0
        a[1] += _num(r["vllanliq"]) or 0
        a[2] += _num(r["vlcompra"]) or 0
        a[3] += _num(r["vldinespec"]) or 0
        a[4] += _num(r["qtrecebedor"]) or 0  # soma de células distintas — usar apenas como ordem de grandeza
    meses = {k[0] for k in agg}
    for m in meses:
        con.execute("DELETE FROM pix_cnae WHERE anomes=?", (m,))
    con.executemany("INSERT OR REPLACE INTO pix_cnae VALUES(?,?,?,?,?,?,?,?,?,?)",
                    [(*k, *v) for k, v in agg.items()])
    return {"key": "pix_cnae", "ok": True, "linhas_brutas": len(rows), "celulas": len(agg), "meses": len(meses)}


def _spi(con):
    out = []
    try:
        body, _m = common.http_get(SPI + "PixLiquidadosAtual?$format=json&$top=40000", timeout=600)
        rows = json.loads(body)["value"]
        common.save_bronze("pix", "spi_diario.json", body[:1 << 20], {"fonte": "SPI PixLiquidadosAtual (trunc 1MB p/ meta)"})
        con.executemany("INSERT OR REPLACE INTO spi_diario VALUES(?,?,?)",
                        [(r["Data"][:10], r.get("Quantidade"), r.get("Total")) for r in rows])
        out.append({"key": "spi_diario", "ok": True, "linhas": len(rows)})
    except Exception as e:
        out.append({"key": "spi_diario", "ok": False, "error": str(e)[:150]})
    try:
        body, _m = common.http_get(SPI + "PixLiquidadosIntradia?$format=json&$top=500", timeout=300)
        rows = json.loads(body)["value"]
        con.execute("DELETE FROM spi_intradia")
        con.executemany("INSERT INTO spi_intradia VALUES(?,?,?)",
                        [(r["Horario"], r.get("QuantidadeMedia"), r.get("TotalMedio")) for r in rows])
        out.append({"key": "spi_intradia", "ok": True, "linhas": len(rows)})
    except Exception as e:
        out.append({"key": "spi_intradia", "ok": False, "error": str(e)[:150]})
    try:
        body, _m = common.http_get(SPI + "PixDisponibilidadeSPI?$format=json&$top=500", timeout=300)
        rows = json.loads(body)["value"]
        con.executemany("INSERT OR REPLACE INTO spi_disp VALUES(?,?,?)",
                        [(str(r["DataBase"]), r.get("Indice"), r.get("MinimoNormativo")) for r in rows])
        out.append({"key": "spi_disp", "ok": True, "linhas": len(rows)})
    except Exception as e:
        out.append({"key": "spi_disp", "ok": False, "error": str(e)[:150]})
    return out


def collect(con, cfg):
    _ensure(con)
    results = []
    for fn in (_mp_mensal, _mp_trimestral, _pix_tx, _pix_mun, _pix_dict, _pix_chaves, _pix_med, _pix_cnae):
        try:
            results.append(fn(con))
        except Exception as e:
            results.append({"key": fn.__name__, "ok": False, "error": str(e)[:200]})
        con.commit()
    results.extend(_spi(con))
    con.commit()
    return results
