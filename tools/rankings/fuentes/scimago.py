# -*- coding: utf-8 -*-
"""SCImago: solo se vigila si ya hay una edición nueva con sus cifras.

La plataforma guarda de Scimago el percentil de cada **cifra** (documentos,
citas, patentes…) entre las universidades chilenas del año, y no un puntaje que
la fuente publique. Desde la edición 2026, scimagoir.com dejó de publicar esas
cifras —su exportación trae solo posiciones— y además está tras un desafío de
Cloudflare. El único lugar donde siguen apareciendo es scimagoiber.com, la serie
iberoamericana, que hoy llega hasta la ventana 2019-2023 (la edición 2025).

Aquí solo se pregunta qué ventana trae: cuando aparezca la 2020-2024, la edición
2026 tendrá cifras y el informe mensual lo avisará. Su carga sigue el camino de
tools/recoleccion/scimago.py y la migración 011 (cifras y percentiles).
"""
from __future__ import annotations

import re

# Una institución de referencia: la PUCV. Si su página trae una ventana nueva,
# la traen todas (la serie se publica completa).
PAGINA = "https://www.scimagoiber.com/institution.php?id=1151"
# La edición es el año en que cierra la ventana más dos (017_scimago_por_edicion).
DESFASE = 2
CARGADA = 2025


def ultima_edicion_con_cifras() -> int | None:
    import requests

    from comun import CABECERAS

    r = requests.get(PAGINA, headers=CABECERAS, timeout=90)
    if r.status_code != 200:
        return None
    ventanas = re.findall(r"(20\d\d)-(20\d\d)", r.text)
    cierres = [int(b) for a, b in ventanas if int(b) - int(a) == 4]
    return max(cierres) + DESFASE if cierres else None
