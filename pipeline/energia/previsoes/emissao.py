"""Rodada diária da previsão do PLD: verificação antes do corte, emissão e registro.

Compromisso operacional (seção 12.1): corte às 07h00 e publicação até 08h00 de Brasília,
todos os dias. A coleta noturna das 20h40 (workflow atualizar-energia.yml) é a pré-carga;
este módulo confere de manhã se o que a rodada precisa já foi capturado, tenta coletar o
que falta antes do corte e emite com o dado como estava no corte. Rodar às 20h40 como se
fosse a rodada das 07h mudaria o conjunto de informação e é recusado aqui: a emissão usa
sempre como_estava_em(corte), e uma coleta feita depois do corte não entra.

Uso (workflow .github/workflows/previsao-pld.yml):

    python3 -m pipeline.energia.previsoes.emissao verificar      # 0 = pronto; 3 = falta dado
    python3 -m pipeline.energia.previsoes.emissao coletar         # tenta CCEE e ONS (EAR, ENA)
    python3 -m pipeline.energia.previsoes.emissao aguardar-corte  # dorme até 07h00 de Brasília
    python3 -m pipeline.energia.previsoes.emissao emitir --modo agendada --run-url URL
    python3 -m pipeline.energia.previsoes.emissao falha --mensagem "..."   # registra a falha
    python3 -m pipeline.energia.previsoes.emissao ja-emitida      # 0 se a rodada do dia existe

Toda rodada registra o horário real da emissão, o prazo, o atraso, o modo (agendada ou
manual), a versão do código e o motivo de cada célula sem número. Rotina escrita no código
não é rotina comprovada: a gold só a declara comprovada com execuções agendadas reais
registradas no arquivo.

O que vai para o arquivo:
* B0, como REFERENCIA_EXPERIMENTAL (seção 12.4): número real quando o período elegível
  está capturado até o corte e o recálculo independente confere; faixa só se o segmento
  estiver CALIBRADO no teste retrospectivo, o que hoje não acontece;
* C2-P e C2-H, como RODADA_INTERNA, só depois da liberação formal registrada no registro
  de modelos (`publicacao_resultados.liberada`); até lá, nenhuma célula deles é emitida.
"""
import argparse
import hashlib
import json
import os
import sys
import time
import traceback
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia import governanca as g  # noqa: E402
from pipeline.energia.previsoes import arquivo as arq  # noqa: E402
from pipeline.energia.previsoes import avaliacao as av  # noqa: E402
from pipeline.energia.previsoes import calendario as cal  # noqa: E402
from pipeline.energia.previsoes import modelos_pld as mp  # noqa: E402
from pipeline.energia.previsoes import variaveis as v  # noqa: E402

REGISTRO_MODELOS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "registro_modelos.json")
DATASETS = (v.DS_PLD, v.DS_EAR, v.DS_ENA)
TOLERANCIA_B0 = 1e-6  # R$/MWh: mesmo cálculo por dois caminhos, só arredondamento binário
CASAS = 4  # a previsão é gravada com 4 casas (R$ 0,0001/MWh); a reexecução confere a 0,005
ROTULO_REF = "B0: referência experimental de persistência, não é previsão aprovada"


def le_registro(caminho=REGISTRO_MODELOS):
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def limites():
    from pipeline.energia import regulatorio
    return mp.LimitesConhecidos(regulatorio.limites_pld()["atos"])


def snapshot_no_corte(con, instante):
    """Identificação do conjunto de capturas usado: para cada recurso dos conjuntos da
    previsão, a vintage mais recente capturada até o instante."""
    inst = base.instante_utc(instante)
    partes, capturas = [], {}
    for ds in DATASETS:
        ultimo = {}
        for vt in base.vintages_do_dataset(con, ds):
            if vt["capturado_em"] <= inst:
                ultimo[vt["recurso"]] = vt
        for rec in sorted(ultimo):
            partes.append(f"{ds}:{rec}:{ultimo[rec]['sha256']}")
        capturas[ds] = max((x["capturado_em"] for x in ultimo.values()), default=None)
    sha = hashlib.sha256("\n".join(partes).encode("utf-8")).hexdigest()
    return {"id": f"corte@{inst}:{sha[:12]}", "sha256": sha, "capturas": capturas, "arquivos": len(partes)}


def b0_direto(con, sm, inicio, fim, instante, _cache=None):
    """Recálculo independente do B0: relê os valores com como_estava_em e soma hora a hora
    pelas referências do calendário (sem as somas acumuladas do construtor)."""
    chave = (sm, instante)
    if _cache is not None and chave in _cache:
        pontos = _cache[chave]
    else:
        pontos = dict(base.como_estava_em(con, v.DS_PLD, f"pld.{sm}", instante))
        if _cache is not None:
            _cache[chave] = pontos
    refs = cal.horas(inicio, fim)
    vals = [pontos.get(r) for r in refs]
    if any(x is None for x in vals):
        return None
    return sum(vals) / len(vals)


def verificar(con, origem, agora=None):
    """O que a rodada da origem precisa e ainda não foi capturado (até agora ou até o corte,
    o que vier primeiro). Lista vazia = pronto."""
    agora = agora or datetime.now(timezone.utc)
    corte = cal.corte_de(origem).astimezone(timezone.utc)
    info = v.Informacao(con, cal.utc_iso(min(agora, corte)))
    faltam = []
    for sm in cal.SUBMERCADOS:
        for freq in ("W", "M"):
            bas = v.basicas(info, origem, freq, sm, 1, hidrologia=True)
            for nome in ("b0", "mm", "d7", "ear28", "ena7"):
                if bas[nome]["valor"] is None:
                    faltam.append(f"{sm} {freq} {nome}: {bas[nome]['serie']} de {bas[nome]['inicio']} a {bas[nome]['fim']} (fim excluído)")
    return sorted(set(faltam))


def _registro_base(origem, e, sm, modelo, versao_modelo, estado, corte, prazo, emitido, execucao, versao_codigo, snap):
    atraso = max(0.0, (emitido - prazo).total_seconds() / 60)
    alertas = []
    if emitido > prazo:
        alertas.append("ATRASADO_APOS_08H")
    if execucao["modo"] != "agendada":
        alertas.append("EXECUCAO_MANUAL")
    if versao_codigo and versao_codigo.endswith("+alterado"):
        alertas.append("CODIGO_NAO_COMMITADO")
    run_id = f"prosp_{origem.isoformat()}_{emitido.strftime('%Y%m%dT%H%M%SZ')}"
    return {
        "forecast_id": f"{run_id}:{e['horizonte']}:{sm}:{modelo}", "run_id": run_id,
        "origem": origem.isoformat(), "cutoff": cal.utc_iso(corte), "prazo": cal.utc_iso(prazo),
        "emitido_em": cal.utc_iso(emitido), "atraso_min": round(atraso, 1),
        "registrado_no_portal_em": emitido.astimezone(cal.FUSO).date().isoformat(),
        "horizonte": e["horizonte"], "frequencia": e["frequencia"],
        "entrega": {"id": e["id"], "inicio": e["inicio_utc"], "fim": e["fim_utc"]},
        "submercado": sm, "modelo": modelo, "versao_modelo": versao_modelo, "estado_modelo": estado,
        "versao_codigo": versao_codigo, "configuracao_sha256": mp.sha_configuracao(),
        "snapshot": snap["id"] if snap else None, "snapshot_sha256": snap["sha256"] if snap else None,
        "elegibilidade": "LAT1D", "natureza": "PREVISTO", "execucao": execucao,
        "evidencia": {"classe": "PROSPECTIVO_REGISTRADO",
                      "fonte": "pipeline/energia/previsoes/emissao.py (rodada do observatório)"},
        "alertas": alertas, "substitui": None, "motivo_correcao": None,
    }


def _celulas_b0(origem, info, lim):
    """Previsão B0 da origem (engine do teste retrospectivo, só B0) e estado de calibração
    de cada segmento no período de teste, com o dado como estava no corte."""
    linhas = av.executa(info, lim, av.origens_ate(origem), k=1, modelos=("B0",))
    por_celula = {(ln.h, ln.sm): ln for ln in linhas if ln.origem == origem}
    calib = {}
    for h in cal.HORIZONTES:
        for sm in cal.SUBMERCADOS:
            ls = [ln for ln in linhas if ln.h == h and ln.sm == sm and ln.periodo() == "teste"]
            res = av.resumo(ls, "B0", "W" if h in cal.HORIZONTES_W else "M")
            calib[(h, sm)] = {"status": av.calibracao(res, g.CALIBRACAO_N_MIN),
                              "cobertura_p10_p90": None if res.get("cobertura_p10_p90") is None else round(res["cobertura_p10_p90"], 4),
                              "entregas": res.get("entregas_com_quantis"),
                              "fonte": "teste retrospectivo sob LAT1D, período de teste (entregas desde 01/01/2025), dado como estava no corte"}
    return por_celula, calib


def emitir(con, origem, agora=None, modo="manual", run_url=None, versao_codigo=None, falha=None, gravar=True,
           registro=None, pasta=arq.PASTA, legado=arq.LEGADO, emitido_em=None, lim=None):
    """Emite a rodada da origem e grava no arquivo. `falha`: registra a rodada como falha
    (todas as células sem número, com o motivo), sem calcular nada. `emitido_em` só é
    informado nos testes; na rodada real é o relógio no fim do cálculo."""
    registro = registro or le_registro()
    modelos = {m["codigo"]: m for m in registro["modelos"]}
    agora = agora or datetime.now(timezone.utc)
    corte = cal.corte_de(origem)
    prazo = cal.prazo_de(origem)
    if agora < corte.astimezone(timezone.utc) and not falha:
        raise ValueError("emissão antes do corte: a rodada usa o dado como estava às 07h00 e ainda não chegou a hora")
    execucao = {"modo": modo, "executor": "GitHub Actions" if os.environ.get("GITHUB_ACTIONS") else "ambiente de desenvolvimento",
                "run_url": run_url, "iniciado_em": cal.utc_iso(agora)}
    versao_codigo = versao_codigo or base.versao_codigo()
    corte_iso = cal.utc_iso(corte)
    b0 = modelos["B0"]
    regs = []
    if falha:
        for e in cal.entregas(origem):
            for sm in cal.SUBMERCADOS:
                r = _registro_base(origem, e, sm, "B0", b0["versao"], b0["estado"], corte, prazo, agora, execucao, versao_codigo, None)
                r.update(tipo="REFERENCIA_EXPERIMENTAL", rotulo=ROTULO_REF, status="INDISPONIVEL", previsao=None, quantis=None,
                         motivo="FALHA_NA_EXECUCAO", detalhe_falha=str(falha)[:300], features_usadas=[],
                         calibracao={"status": "SEM_AVALIACAO"})
                r["alertas"] = sorted(set(r["alertas"] + ["FALHA"]))
                regs.append(r)
        return arq.anexa(regs, pasta, legado) if gravar else regs
    snap = snapshot_no_corte(con, corte_iso)
    info = v.Informacao(con, corte_iso)
    lim = lim or limites()
    celulas, calib = _celulas_b0(origem, info, lim)
    emitido = emitido_em or datetime.now(timezone.utc)
    cache_direto = {}
    for e in cal.entregas(origem):
        freq = e["frequencia"]
        for sm in cal.SUBMERCADOS:
            r = _registro_base(origem, e, sm, "B0", b0["versao"], b0["estado"], corte, prazo, emitido, execucao, versao_codigo, snap)
            ln = celulas[(e["horizonte"], sm)]
            bas = v.basicas(info, origem, freq, sm, 1)
            per = bas["b0"]
            ini, fim = date.fromisoformat(per["inicio"]), date.fromisoformat(per["fim"])
            conhecidas = info.horas_disponiveis(sm, e["inicio"], e["fim"])
            r.update(tipo="REFERENCIA_EXPERIMENTAL", rotulo=ROTULO_REF, calibracao=calib[(e["horizonte"], sm)],
                     horas_capturadas_ate_corte=conhecidas, fracao_conhecida=round(conhecidas / e["horas"], 6),
                     limites={"piso_medio": None if ln.lo is None else round(ln.lo, 4),
                              "teto_estrutural_medio": None if ln.hi is None else round(ln.hi, 4),
                              "provisoria": ln.provisoria})
            if ln.provisoria:
                r["alertas"] = sorted(set(r["alertas"] + ["LIMITE_PROVISORIO"]))
            valor = ln.prev.get("B0")
            if valor is None:
                r.update(status="INDISPONIVEL", previsao=None, quantis=None, features_usadas=[],
                         motivo="SEM_PERIODO_ELEGIVEL_CAPTURADO_ATE_O_CORTE" if info.ultima_hora.get(sm) is None
                         else "PERIODO_ELEGIVEL_INCOMPLETO_NO_CORTE")
                regs.append(r)
                continue
            direto = b0_direto(con, sm, ini, fim, corte_iso, cache_direto)
            if direto is None or abs(direto - ln.bruta["B0"]) > TOLERANCIA_B0:
                r.update(status="INDISPONIVEL", previsao=None, quantis=None, features_usadas=[], motivo="CONFERENCIA_B0_DIVERGENTE")
                regs.append(r)
                continue
            cap = v.capturas_usadas(con, v.DS_PLD, f"pld.{sm}", ini, fim, corte_iso)
            prev = valor
            if conhecidas:
                # entrega com horas já publicadas no corte: a previsão cobre só o desconhecido
                # e a combinação é explícita (nunca acontece com as entregas atuais; ver calendario)
                media_conh = info.media_horas(sm, e["inicio"], e["inicio"] + timedelta(days=conhecidas // 24)) if conhecidas % 24 == 0 else None
                if media_conh is None:
                    r.update(status="INDISPONIVEL", previsao=None, quantis=None, features_usadas=[], motivo="ENTREGA_PARCIALMENTE_PUBLICADA_SEM_DIAS_INTEIROS")
                    regs.append(r)
                    continue
                r["previsao_parte_desconhecida"] = round(valor, CASAS)
                r["media_conhecida_no_corte"] = round(media_conh, CASAS)
                prev = (media_conh * conhecidas + valor * (e["horas"] - conhecidas)) / e["horas"]
                r["alertas"] = sorted(set(r["alertas"] + ["ENTREGA_COM_HORAS_JA_PUBLICADAS"]))
            q = None
            if calib[(e["horizonte"], sm)]["status"] == "CALIBRADO" and "B0" in ln.q and not conhecidas:
                q = {"p10": round(ln.q["B0"]["p10"], CASAS), "p90": round(ln.q["B0"]["p90"], CASAS), "rotulo_faixa": "faixa de 80%"}
            r.update(status="DISPONIVEL", previsao=round(prev, CASAS), previsao_bruta=round(ln.bruta["B0"], CASAS),
                     ajustada_ao_limite=abs(ln.prev["B0"] - ln.bruta["B0"]) > 1e-9, quantis=q, motivo=None,
                     features_usadas=[{"nome": "b0", "serie": per["serie"], "dataset": per["dataset"], "inicio": per["inicio"],
                                       "fim": per["fim"], "valor": round(ln.bruta["B0"], CASAS), "horas": 24 * (fim - ini).days,
                                       "capturado_em": cap["capturado_em"], "vintages": cap["vintages"]}])
            if r["ajustada_ao_limite"]:
                r["alertas"] = sorted(set(r["alertas"] + ["AJUSTADA_AO_LIMITE"]))
            regs.append(r)
    if (registro.get("publicacao_resultados") or {}).get("liberada") is True:
        regs.extend(_celulas_c2(con, origem, info, lim, modelos, corte, prazo, emitido, execucao, versao_codigo, snap))
    viol = [x for rec in regs for x in g.valida_registro(arq.sela(rec), modelos)]
    if viol:
        raise g.ViolacaoGovernanca("; ".join(viol[:10]))
    return arq.anexa(regs, pasta, legado) if gravar else regs


def _celulas_c2(con, origem, info, lim, modelos, corte, prazo, emitido, execucao, versao_codigo, snap):
    """Rodada interna dos candidatos C2 (só depois da liberação formal). Treino com o dado
    como estava no corte, restrito às entregas maturadas até o último domingo."""
    linhas = av.executa(info, lim, av.origens_ate(origem), k=1, modelos=("B0", "C2-P", "C2-H"))
    regs = []
    for ln in linhas:
        if ln.origem != origem:
            continue
        e = cal.entrega(origem, ln.h)
        for mod in ("C2-P", "C2-H"):
            m = modelos[mod]
            r = _registro_base(origem, e, ln.sm, mod, m["versao"], m["estado"], corte, prazo, emitido, execucao, versao_codigo, snap)
            valor = ln.prev.get(mod)
            r.update(tipo="RODADA_INTERNA", calibracao={"status": "SEM_AVALIACAO"}, quantis=None,
                     status="DISPONIVEL" if valor is not None else "INDISPONIVEL",
                     previsao=None if valor is None else round(valor, CASAS), motivo=ln.motivo.get(mod),
                     features_usadas=[{"nome": "variaveis do C2", "serie": f"pld.{ln.sm}", "dataset": v.DS_PLD,
                                       "capturado_em": snap["capturas"].get(v.DS_PLD)}])
            regs.append(r)
    return regs


def ja_emitida(origem, pasta=arq.PASTA, legado=arq.LEGADO):
    """Há rodada da origem com alguma célula calculada (falha não conta)?"""
    for r in arq.le_tudo(pasta, legado):
        if r.get("origem") == origem.isoformat() and r.get("motivo") != "FALHA_NA_EXECUCAO" and "execucao" in r:
            return True
    return False


def coletar(con):
    """Retentativa antes do corte: CCEE (PLD) e ONS (EAR e ENA). Nunca contorna bloqueio:
    a CCEE que responde 403 fica registrada como falha de coleta."""
    from pipeline.energia.fontes import ccee, ons
    out = {"ccee": ccee.coleta_direta(con)}
    for ds in (v.DS_EAR, v.DS_ENA):
        out[ds] = ons.coleta_dataset(con, ds)
    con.commit()
    return out


def aguardar_corte(origem, limite_s=3 * 3600):
    alvo = cal.corte_de(origem).astimezone(timezone.utc)
    falta = (alvo - datetime.now(timezone.utc)).total_seconds()
    if 0 < falta <= limite_s:
        time.sleep(falta + 5)
    return max(0.0, falta)


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("acao", choices=["verificar", "coletar", "aguardar-corte", "emitir", "falha", "ja-emitida"])
    ap.add_argument("--origem", help="AAAA-MM-DD (padrão: hoje em Brasília)")
    ap.add_argument("--modo", default="manual", choices=["agendada", "manual"])
    ap.add_argument("--run-url")
    ap.add_argument("--mensagem", default="falha sem mensagem")
    a = ap.parse_args(argv)
    origem = date.fromisoformat(a.origem) if a.origem else cal.origem_de(datetime.now(timezone.utc))
    if a.acao == "ja-emitida":
        return 0 if ja_emitida(origem) else 1
    if a.acao == "aguardar-corte":
        print(f"[previsao] faltavam {aguardar_corte(origem):.0f} s para o corte de {origem}")
        return 0
    con = base.conecta()
    try:
        if a.acao == "verificar":
            faltam = verificar(con, origem)
            print(json.dumps({"origem": origem.isoformat(), "faltam": faltam}, ensure_ascii=False))
            return 0 if not faltam else 3
        if a.acao == "coletar":
            print(json.dumps(coletar(con), ensure_ascii=False, default=str)[:3000])
            return 0
        if a.acao == "falha":
            regs = emitir(con, origem, modo=a.modo, run_url=a.run_url, falha=a.mensagem)
            print(f"[previsao] falha registrada: {len(regs)} células de {origem}")
            return 0
        try:
            regs = emitir(con, origem, modo=a.modo, run_url=a.run_url)
        except Exception as e:  # a falha vira registro, nunca número
            traceback.print_exc()
            regs = emitir(con, origem, modo=a.modo, run_url=a.run_url, falha=f"{type(e).__name__}: {e}")
            print(f"[previsao] rodada de {origem} registrada como falha: {e}")
            return 0
        com = sum(1 for r in regs if r["status"] == "DISPONIVEL")
        print(f"[previsao] rodada {regs[0]['run_id']}: {len(regs)} células, {com} com número; atraso {regs[0]['atraso_min']} min")
        return 0
    finally:
        con.close()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
