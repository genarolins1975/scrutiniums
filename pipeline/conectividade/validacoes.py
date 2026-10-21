"""Validações que retêm a publicação do painel Conectividade.

Cada função devolve a lista de problemas (vazia = aprovado). A coleta chama `validar_<fonte>(novo, anterior)` antes
de gravar o seed; a construção da gold chama todas de novo, mais `validar_cruzado`, e não grava nada se reprovar.

O que retém, por fonte:
- banda larga fixa: mês de referência no formato AAAA-MM e a no máximo MESES_MAX_ATRASO_ACESSOS meses da captura;
  entre MUNICIPIOS_MIN e MUNICIPIOS_MAX municípios; em cada município, os meios de acesso e as faixas de velocidade
  somam os acessos, a pessoa física e a maior prestadora não passam do total; os municípios somam as UFs e o Brasil;
  o Brasil do mês é o mesmo do arquivo de totais; a densidade nacional está na faixa plausível e cobre os mesmos
  municípios; recoleta do mesmo mês não muda o Brasil mais de REVISAO_MAXIMA_MESMO_MES; mês novo não difere do
  anterior mais de VARIACAO_MAXIMA_MES_SEGUINTE; a referência nunca volta no tempo;
- telefonia móvel: as mesmas regras, com as gerações (2G a 5G) e as modalidades (pré e pós) no lugar dos meios;
- cobertura: trimestre de referência a no máximo MESES_MAX_ATRASO_COBERTURA meses; toda parte coberta entre 0 e 100;
  5G ≤ 4G e 5G ≤ 4G ou 5G ≤ Todas (moradores) em cada município; as séries têm um valor por trimestre; a soma dos
  moradores dos municípios fecha com o Brasil do arquivo de evolução (TOLERANCIA_POPULACAO_COBERTURA); a referência
  nunca volta;
- cruzada: as três fontes cobrem o mesmo conjunto de municípios (até 3 diferenças, que a gold declara), e a UF de
  cada município bate com o prefixo do código IBGE.
"""
from __future__ import annotations

import re
from datetime import date

from . import fontes as F

MES = re.compile(r"^\d{4}-\d{2}$")


def _meses_entre(a: str, b: str) -> int:
    """Meses de a (AAAA-MM) até b (AAAA-MM)."""
    return (int(b[:4]) - int(a[:4])) * 12 + int(b[5:7]) - int(a[5:7])


def _hoje(seed: dict, hoje: date | None) -> str:
    if hoje is not None:
        return hoje.strftime("%Y-%m")
    return str(seed.get("capturado_em", ""))[:7]


def _perto(a, b, rel) -> bool:
    if a is None or b is None:
        return False
    return abs(a - b) <= rel * max(abs(a), abs(b), 1)


def _estrutura(seed: dict, chaves) -> list[str]:
    return [f"seed sem a chave {k!r}" for k in chaves if k not in seed]


def _referencia(seed: dict, hoje: date | None, maximo: int, anterior: dict | None) -> list[str]:
    p = []
    ref = seed.get("referencia")
    if not isinstance(ref, str) or not MES.match(ref) or not 1 <= int(ref[5:7]) <= 12:
        return [f"referência inválida: {ref!r}"]
    h = _hoje(seed, hoje)
    if MES.match(h) and _meses_entre(ref, h) > maximo:
        p.append(f"referência {ref} a mais de {maximo} meses da captura ({h})")
    # competência futura gravada faria as competências reais seguintes parecerem retrocesso: fica retida
    if MES.match(h) and _meses_entre(ref, h) < 0:
        p.append(f"referência {ref} posterior à captura ({h})")
    if anterior and isinstance(anterior.get("referencia"), str) and ref < anterior["referencia"]:
        p.append(f"referência voltou de {anterior['referencia']} para {ref}")
    return p


def _acessos_comuns(seed: dict, campos, partes_a, partes_b, nome: str) -> list[str]:
    """Regras compartilhadas pela banda larga fixa e pela telefonia móvel."""
    p = []
    mun = seed["municipios"]
    n = len(mun)
    if not F.MUNICIPIOS_MIN <= n <= F.MUNICIPIOS_MAX:
        p.append(f"{nome}: {n} municípios, fora de {F.MUNICIPIOS_MIN} a {F.MUNICIPIOS_MAX}")
    if list(seed.get("campos", [])) != list(campos):
        p.append(f"{nome}: campos {seed.get('campos')} diferentes de {list(campos)}")
        return p
    i = {c: k for k, c in enumerate(campos)}
    soma_mun = 0
    soma_uf = {}
    erros = 0
    for cod, (nomem, uf, v) in mun.items():
        if len(v) != len(campos):
            p.append(f"{nome}: município {cod} com {len(v)} valores")
            return p
        a = v[i["acessos"]]
        soma_mun += a
        soma_uf[uf] = soma_uf.get(uf, 0) + a
        if F.UF_DO_PREFIXO.get(cod[:2]) != uf:
            erros += 1
            if erros <= 5:
                p.append(f"{nome}: município {cod} ({nomem}) com UF {uf} fora do prefixo IBGE")
        for partes in (partes_a, partes_b):
            s = sum(v[i[c]] for c in partes)
            if s != a and not (partes is partes_b and s < a and nome == "telefonia móvel"):
                erros += 1
                if erros <= 5:
                    p.append(f"{nome}: município {cod} ({nomem}): {partes} somam {s}, acessos {a}")
        if v[i["pessoa_fisica"]] > a or v[i["maior_grupo_acessos"]] > a:
            erros += 1
            if erros <= 5:
                p.append(f"{nome}: município {cod} ({nomem}): pessoa física ou maior grupo acima dos acessos")
    if erros > 5:
        p.append(f"{nome}: {erros} municípios com inconsistência interna")
    br = seed["brasil"]["acessos"]
    if soma_mun != br:
        p.append(f"{nome}: municípios somam {soma_mun}, Brasil {br}")
    # o arquivo de totais da telefonia móvel exclui M2M e pontos de serviço (fontes.PRODUTOS_FORA_DO_TOTAL)
    comparavel = br - seed["brasil"].get("m2m", 0) - seed["brasil"].get("ponto_servico", 0) if nome == "telefonia móvel" else br
    for uf, s in soma_uf.items():
        if uf not in seed["ufs"] or seed["ufs"][uf][i["acessos"]] != s:
            p.append(f"{nome}: UF {uf} com {seed['ufs'].get(uf, [None])[0]} acessos, municípios somam {s}")
    tm = seed["total_mensal"]
    ref = seed["referencia"]
    # a série inteira vai ao gráfico nacional e ao CSV: mês vazio é lacuna legítima (None), contagem negativa retém
    invalidos = [m for m in tm["meses"] if not isinstance(m, str) or not MES.match(m) or not 1 <= int(m[5:7]) <= 12]
    if invalidos:
        p.append(f"{nome}: o arquivo de totais tem competências inválidas: {invalidos[:5]}")
    negativos = [m for m, a in zip(tm["meses"], tm["acessos"]) if a is not None and a < 0]
    if negativos:
        p.append(f"{nome}: o arquivo de totais tem acessos negativos em {', '.join(negativos[:5])}")
    # o arquivo de totais à frente do CSV municipal (atualização parcial da fonte) publicaria um mês adiante da referência validada
    if tm["meses"] and tm["meses"][-1] > ref:
        p.append(f"{nome}: o arquivo de totais vai até {tm['meses'][-1]}, depois da referência {ref}; a fonte fica retida até os municípios alcançarem o mês")
    if ref not in tm["meses"]:
        p.append(f"{nome}: o arquivo de totais não tem o mês {ref}")
    else:
        t = tm["acessos"][tm["meses"].index(ref)]
        if not _perto(t, comparavel, 1e-3):
            p.append(f"{nome}: total do arquivo da Anatel em {ref} é {t}, os municípios somam {comparavel}")
    d = seed["densidade"]
    if d["ultimo"] != ref:
        p.append(f"{nome}: densidade até {d['ultimo']}, acessos até {ref}")
    faltam = set(mun) ^ set(d["municipios"])
    if len(faltam) > 3:
        p.append(f"{nome}: {len(faltam)} municípios diferentes entre acessos e densidade")
    fora = [cod for cod, v in d["municipios"].items() if v is None or not 0 <= v <= F.DENSIDADE_MUNICIPIO_MAX]
    if fora:
        p.append(f"{nome}: {len(fora)} municípios com densidade fora de 0 a {F.DENSIDADE_MUNICIPIO_MAX} (ex.: {fora[:3]})")
    return p


def _comparar_anterior(seed: dict, anterior: dict | None, nome: str) -> list[str]:
    if not anterior:
        return []
    p = []
    ref, ref_ant = seed["referencia"], anterior.get("referencia")
    br, br_ant = seed["brasil"]["acessos"], (anterior.get("brasil") or {}).get("acessos")
    if ref == ref_ant and br_ant and not _perto(br, br_ant, F.REVISAO_MAXIMA_MESMO_MES):
        p.append(f"{nome}: o mesmo mês {ref} mudou de {br_ant} para {br} acessos (mais de {F.REVISAO_MAXIMA_MESMO_MES:.0%})")
    # o teto vale por mês transcorrido: depois de uma retenção de dois ou mais meses, a variação acumulada legítima
    # pode passar de 5% e o atualizador agendado precisa conseguir se recuperar sozinho
    meses = max(1, _meses_entre(ref_ant, ref)) if ref != ref_ant and isinstance(ref_ant, str) and MES.match(ref_ant) else 1
    limite = F.VARIACAO_MAXIMA_MES_SEGUINTE * meses
    if ref != ref_ant and br_ant and not _perto(br, br_ant, limite):
        p.append(f"{nome}: de {ref_ant} para {ref} o Brasil foi de {br_ant} para {br} acessos (mais de {limite:.0%} em {meses} {'mês' if meses == 1 else 'meses'})")
    return p


def validar_fixa(seed: dict, anterior: dict | None = None, hoje: date | None = None) -> list[str]:
    p = _estrutura(seed, ("fonte", "capturado_em", "arquivo", "referencia", "campos", "grupos", "brasil", "ufs", "municipios", "total_mensal", "densidade"))
    if p:
        return p
    p += _referencia(seed, hoje, F.MESES_MAX_ATRASO_ACESSOS, anterior)
    if p:
        return p
    p += _acessos_comuns(seed, F.CAMPOS_FIXA, ("fibra", "coaxial", "radio", "satelite", "metalico"),
                         ("vel_ate_10", "vel_10_25", "vel_25_100", "vel_100_mais"), "banda larga fixa")
    dens = seed["densidade"]["brasil"]
    lo, hi = F.DENSIDADE_FIXA_BRASIL
    if dens is None or not lo <= dens <= hi:
        p.append(f"banda larga fixa: densidade nacional {dens} fora de {lo} a {hi} por 100 domicílios")
    p += _comparar_anterior(seed, anterior, "banda larga fixa")
    return p


def validar_movel(seed: dict, anterior: dict | None = None, hoje: date | None = None) -> list[str]:
    p = _estrutura(seed, ("fonte", "capturado_em", "arquivo", "referencia", "campos", "grupos", "brasil", "ufs", "municipios", "total_mensal", "densidade"))
    if p:
        return p
    p += _referencia(seed, hoje, F.MESES_MAX_ATRASO_ACESSOS, anterior)
    if p:
        return p
    p += _acessos_comuns(seed, F.CAMPOS_MOVEL, ("g2", "g3", "g4", "g5"), ("pre", "pos"), "telefonia móvel")
    i = {c: k for k, c in enumerate(F.CAMPOS_MOVEL)}
    for cod, (nomem, _uf, v) in seed["municipios"].items():
        if v[i["m2m"]] + v[i["ponto_servico"]] > v[i["acessos"]]:
            p.append(f"telefonia móvel: município {cod} ({nomem}) com M2M acima dos acessos")
            break
    dens = seed["densidade"]["brasil"]
    lo, hi = F.DENSIDADE_MOVEL_BRASIL
    if dens is None or not lo <= dens <= hi:
        p.append(f"telefonia móvel: densidade nacional {dens} fora de {lo} a {hi} por 100 habitantes")
    p += _comparar_anterior(seed, anterior, "telefonia móvel")
    return p


def validar_cobertura(seed: dict, anterior: dict | None = None, hoje: date | None = None) -> list[str]:
    p = _estrutura(seed, ("fonte", "capturado_em", "arquivo", "referencia", "trimestres", "tecnologias", "operadoras", "brasil", "municipios"))
    if p:
        return p
    p += _referencia(seed, hoje, F.MESES_MAX_ATRASO_COBERTURA, anterior)
    if p:
        return p
    tri = seed["trimestres"]
    ref = seed["referencia"]
    if tri != sorted(tri) or tri[-1] != ref:
        p.append(f"cobertura: trimestres {tri} fora de ordem ou sem a referência {ref}")
    # cada trimestre histórico vai para a grade e para os rótulos do gráfico: tem de ser um mês calendário válido
    invalidos = [t for t in tri if not isinstance(t, str) or not MES.match(t) or not 1 <= int(t[5:7]) <= 12]
    if invalidos:
        p.append(f"cobertura: trimestres com período inválido: {invalidos}")
    mun = seed["municipios"]
    n = len(mun)
    if not F.MUNICIPIOS_MIN <= n <= F.MUNICIPIOS_MAX:
        p.append(f"cobertura: {n} municípios, fora de {F.MUNICIPIOS_MIN} a {F.MUNICIPIOS_MAX}")
    moradores = 0
    erros = 0
    for cod, v in mun.items():
        nomem, uf, mor, dom, _area, tec, ops, s4, s5 = v
        # população vazia não é zero, e contagem negativa não é população: a soma do Brasil e as médias ponderadas sairiam
        # erradas sem ressalva
        if mor is None or dom is None or mor < 0 or dom < 0:
            erros += 1
            if erros <= 5:
                p.append(f"cobertura: município {cod} ({nomem}) sem moradores ou domicílios")
            continue
        moradores += mor
        if F.UF_DO_PREFIXO.get(cod[:2]) != uf:
            erros += 1
            if erros <= 5:
                p.append(f"cobertura: município {cod} ({nomem}) com UF {uf} fora do prefixo IBGE")
        if len(s4) != len(tri) or len(s5) != len(tri):
            erros += 1
            if erros <= 5:
                p.append(f"cobertura: município {cod} ({nomem}) com série de {len(s4)} e {len(s5)} valores para {len(tri)} trimestres")
        # a série histórica vai direto ao gráfico do município: cada trimestre fica em 0 a 100 (5G acima do 4G é contado na gold)
        for i, (h4, h5) in enumerate(zip(s4, s5)):
            if any(x is not None and not 0 <= x <= 100 for x in (h4, h5)):
                erros += 1
                if erros <= 5:
                    t = tri[i] if i < len(tri) else f"#{i}"
                    p.append(f"cobertura: município {cod} ({nomem}) com série em {t} fora de 0 a 100: 4G {h4}, 5G {h5}")
        todas = tec.get("todas")
        if not todas or any(x is None or not 0 <= x <= 100 for x in todas):
            erros += 1
            if erros <= 5:
                p.append(f"cobertura: município {cod} ({nomem}) sem a cobertura de todas as tecnologias ({todas})")
            continue
        for campo, vals in tec.items():
            if vals is not None and any(x is not None and not 0 <= x <= 100 for x in vals):
                erros += 1
                if erros <= 5:
                    p.append(f"cobertura: município {cod} ({nomem}) com {campo} fora de 0 a 100: {vals}")
        # invariantes de união nas três medidas (moradores, domicílios, área): 5G nunca acima de "4G ou 5G" nem de "todas",
        # 4G nunca acima de "todas". 5G acima do 4G não é invariante da fonte (a Anatel publica isso em trimestres antigos
        # de dezenas de municípios): a gold conta e declara
        quebra = _uniao_quebrada(tec)
        if quebra:
            erros += 1
            if erros <= 5:
                p.append(f"cobertura: município {cod} ({nomem}) com {quebra}")
        for op, (a, b) in ops.items():
            if any(x is not None and not 0 <= x <= 100 for x in (a, b)):
                erros += 1
                if erros <= 5:
                    p.append(f"cobertura: município {cod} ({nomem}), operadora {op} fora de 0 a 100")
            elif a is not None and b is not None and a > b + 0.05:              # "4G ou 5G" é parte de "todas": união nunca acima do conjunto
                erros += 1
                if erros <= 5:
                    p.append(f"cobertura: município {cod} ({nomem}), operadora {op} com 4G ou 5G ({a}) acima de todas ({b})")
    if erros > 5:
        p.append(f"cobertura: {erros} municípios com inconsistência interna")
    br = seed["brasil"]
    # a evolução nacional à frente dos arquivos municipais misturaria períodos: o agregado por operadora é do último trimestre nacional
    ultimo_nacional = max(br.get("serie") or {}, default=None)
    if ultimo_nacional is not None and ultimo_nacional > ref:
        p.append(f"cobertura: o arquivo de evolução do Brasil vai até {ultimo_nacional}, depois do trimestre municipal {ref}; a fonte fica retida até os municípios alcançarem o trimestre")
    if ref not in br.get("serie", {}) or "todas" not in br["serie"][ref]:
        p.append(f"cobertura: o arquivo de evolução do Brasil não tem o trimestre {ref}")
    else:
        pop = (br.get("populacao") or {}).get(ref, {}).get("moradores")
        if not pop or not _perto(moradores, pop, F.TOLERANCIA_POPULACAO_COBERTURA):
            p.append(f"cobertura: os municípios somam {moradores} moradores, o Brasil do arquivo de evolução tem {pop}")
    # a série nacional vai direto aos cartões e ao gráfico do Brasil: a mesma relação entre gerações vale em cada trimestre
    for t, tec in sorted((br.get("serie") or {}).items()):
        quebra = _uniao_quebrada(tec)
        if quebra:
            p.append(f"cobertura: Brasil em {t} com {quebra}")
        # as três medidas (moradores, domicílios e área) de cada tecnologia, como nos registros municipais
        for campo, vals in tec.items():
            if vals is not None and any(x is not None and not 0 <= x <= 100 for x in vals):
                p.append(f"cobertura: Brasil em {t} com {campo} fora de 0 a 100: {vals}")
    # o agregado nacional por operadora vai direto ao gráfico por operadora: 0 a 100 e "4G ou 5G" nunca acima de "todas"
    for op, v in sorted((br.get("operadoras_ultimo") or {}).items()):
        a, b = v.get("g4g5"), v.get("todas")
        if any(x is not None and not 0 <= x <= 100 for x in (a, b)):
            p.append(f"cobertura: Brasil, operadora {op} fora de 0 a 100: {v}")
        elif a is not None and b is not None and a > b + 0.05:
            p.append(f"cobertura: Brasil, operadora {op} com 4G ou 5G ({a}) acima de todas ({b})")
    return p


_MEDIDAS_COBERTURA = ("moradores", "domicílios", "área")


def _uniao_quebrada(tec: dict) -> str | None:
    """Primeira quebra das invariantes de união nas três medidas: 5G acima de "4G ou 5G" ou de "todas", 4G acima de "todas"."""
    for i, medida in enumerate(_MEDIDAS_COBERTURA):
        valor = lambda campo: ((tec.get(campo) or [None, None, None]) + [None, None, None])[i]  # noqa: E731
        g5, g4, g45, todas = valor("g5"), valor("g4"), valor("g4g5"), valor("todas")
        # cada geração dentro de "4G ou 5G", "4G ou 5G" dentro de "todas", e toda geração dentro de "todas"
        pares = (("5G", g5, "4G ou 5G", g45), ("4G", g4, "4G ou 5G", g45), ("4G ou 5G", g45, "todas", todas),
                 ("5G", g5, "todas", todas), ("4G", g4, "todas", todas), ("3G", valor("g3"), "todas", todas), ("2G", valor("g2"), "todas", todas))
        for nome_a, a, nome_b, b in pares:
            if a is not None and b is not None and a > b + 0.05:
                return f"{nome_a} ({a}) acima de {nome_b} ({b}) em {medida}"
    return None


def validar_cruzado(fixa: dict, movel: dict, cobertura: dict) -> list[str]:
    p = []
    a, b, c = set(fixa["municipios"]), set(movel["municipios"]), set(cobertura["municipios"])
    # os três pares: cada base pode diferir de cada outra em até três municípios
    for nome, um, outro in (("banda larga fixa e telefonia móvel", a, b), ("banda larga fixa e cobertura", a, c), ("telefonia móvel e cobertura", b, c)):
        dif = um ^ outro
        if len(dif) > 3:
            p.append(f"cruzado: {nome} diferem em {len(dif)} municípios")
    for cod in a & b:
        if fixa["municipios"][cod][1] != movel["municipios"][cod][1]:
            p.append(f"cruzado: município {cod} com UF diferente entre banda larga fixa e telefonia móvel")
            break
    # a unidade da densidade: acessos ÷ densidade × 100 tem de reproduzir a população (moradores do Censo 2022 na
    # cobertura), com folga para o crescimento desde 2022; se reproduzisse os domicílios, a razão ficaria perto de 0,4
    im, ips = fixa["campos"].index("acessos"), None
    for nome, seed in (("banda larga fixa", fixa), ("telefonia móvel", movel)):
        i = {c: k for k, c in enumerate(seed["campos"])}
        fora = total = 0
        for cod, (_n, _uf, v) in seed["municipios"].items():
            c = cobertura["municipios"].get(cod)
            dens = seed["densidade"]["municipios"].get(cod)
            acessos = v[i["acessos"]] - v[i["m2m"]] - v[i["ponto_servico"]] if "ponto_servico" in i else v[i["acessos"]]
            if not c or not c[2] or not dens or acessos < 1000:
                continue
            total += 1
            razao = acessos / dens * 100 / c[2]
            if not F.RAZAO_POPULACAO[0] <= razao <= F.RAZAO_POPULACAO[1]:
                fora += 1
        if total and fora / total > F.FRACAO_MAXIMA_FORA_DA_RAZAO:
            p.append(f"cruzado: {nome}: em {fora} de {total} municípios acessos ÷ densidade não reproduz a população do Censo 2022")
    return p
