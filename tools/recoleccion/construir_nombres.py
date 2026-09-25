# -*- coding: utf-8 -*-
"""Construye `nombres_universidades.csv`: alias de cada fuente -> nombre de la BD.

La tabla `universidad` es la fuente de verdad de los nombres. Cada ranking escribe
los suyos de otra forma —en inglés, con tildes, con siglas— y sin una tabla de
equivalencias los datos de dos fuentes no se pueden juntar.

El archivo se versiona y se edita a mano cuando aparece un alias nuevo: los guiones
de recolección avisan del que falte en vez de descartar la universidad en silencio.

    python tools/recoleccion/construir_nombres.py
"""
from __future__ import annotations

import csv
import os
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SALIDA = Path(__file__).with_name("nombres_universidades.csv")
DUMP = RAIZ / "backend" / "backup.sql"


def desde_la_base() -> list[str]:
    """Nombres canónicos: de PostgreSQL si hay conexión, del volcado si no.

    El volcado sirve de respaldo para que el guion funcione en un equipo sin la
    base levantada, que es la situación de quien solo quiere recolectar datos.
    """
    url = os.getenv("DATABASE_URL")
    if not url and (RAIZ / "backend" / ".env").exists():
        for linea in (RAIZ / "backend" / ".env").read_text(encoding="utf-8").splitlines():
            if linea.startswith("DATABASE_URL="):
                url = linea.split("=", 1)[1].strip()
    if url:
        try:
            import psycopg2
            with psycopg2.connect(url, connect_timeout=10) as cn, cn.cursor() as cur:
                cur.execute("SELECT nombre_universidad FROM universidad ORDER BY 1")
                return [f[0] for f in cur.fetchall()]
        except Exception as e:  # noqa: BLE001 - se cae al volcado
            print(f"  (sin base: {type(e).__name__}; se lee el volcado)", file=sys.stderr)

    if not DUMP.exists():
        raise SystemExit("No hay base ni volcado del que leer los nombres.")
    texto = DUMP.read_text(encoding="utf-8", errors="replace").splitlines()
    nombres, dentro = [], False
    for linea in texto:
        if linea.startswith("COPY public.universidad "):
            dentro = True
            continue
        if dentro:
            if linea.startswith("\\."):
                break
            partes = linea.split("\t")
            if len(partes) > 1:
                nombres.append(partes[1])
    return sorted(nombres)


# Alias de THE, ya resueltos en el estudio previo. Se copian aquí para no
# depender de un script de análisis que importa pandas y numpy.
THE = {
    "Pontificia Universidad Católica de Chile": "Pontificia Universidad Catolica de Chile",
    "Pontifical Catholic University of Valparaíso": "Pontificia Universidad Catolica de Valparaiso",
    "Adolfo Ibáñez University": "Universidad Adolfo Ibanez",
    "Alberto Hurtado University": "Universidad Alberto Hurtado",
    "Arturo Prat University": "Universidad Arturo Prat",
    "Austral University of Chile": "Universidad Austral de Chile",
    "Bernardo O’Higgins University": "Universidad Bernardo O'Higgins",
    "Catholic University of the North": "Universidad Catolica del Norte",
    "Diego Portales University": "Universidad Diego Portales",
    "Federico Santa María Technical University": "Universidad Tecnica Federico Santa Maria",
    "Finis Terrae University": "Universidad Finis Terrae",
    "Temuco Catholic University": "Universidad Catolica de Temuco",
    "Universidad Andrés Bello (UNAB)": "Universidad Andres Bello",
    "Universidad Autónoma de Chile": "Universidad Autonoma de Chile",
    "Universidad Católica de la Santísima Concepción": "Universidad Catolica de la Santisima Concepcion",
    "Universidad Católica del Maule": "Universidad Catolica del Maule",
    "Universidad Mayor": "Universidad Mayor",
    "Universidad Santo Tomás": "Universidad Santo Tomas",
    "Universidad del Desarrollo": "Universidad del Desarrollo",
    "University of Antofagasta": "Universidad de Antofagasta",
    "University of Bío-Bío": "Universidad del Bio-Bio",
    "University of Chile": "Universidad de Chile",
    "University of Concepción": "Universidad de Concepcion",
    "University of La Frontera": "Universidad de la Frontera",
    "University of La Serena": "Universidad de La Serena",
    "University of Los Lagos": "Universidad de Los Lagos",
    "University of Magallanes": "Universidad de Magallanes",
    "University of Talca": "Universidad de Talca",
    "University of Tarapacá": "Universidad de Tarapaca",
    "University of Valparaíso": "Universidad de Valparaiso",
    "University of Santiago, Chile": "Universidad de Santiago de Chile",
    "University of the Andes, Chile": "Universidad de los Andes",
}


def sin_tildes(texto: str) -> str:
    reemplazos = str.maketrans("áàäâéèëêíìïîóòöôúùüûñçÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑÇ",
                               "aaaaeeeeiiiioooouuuuncAAAAEEEEIIIIOOOOUUUUNC")
    return texto.translate(reemplazos)


def normalizar(texto: str) -> str:
    """Clave de comparación: sin tildes, sin puntuación y en minúsculas."""
    return re.sub(r"[^a-z0-9]+", " ", sin_tildes(texto).lower()).strip()


def main() -> int:
    canonicos = desde_la_base()
    print(f"{len(canonicos)} universidades en la base")

    filas = []
    # 1. Cada nombre canónico es alias de sí mismo, para las fuentes chilenas que
    #    ya lo escriben igual o casi.
    for nombre in canonicos:
        filas.append({"alias": nombre, "fuente": "base", "nombre_universidad": nombre})

    # 2. Alias de THE, comprobando que el destino existe en la base.
    faltan = []
    for alias, destino in THE.items():
        if destino not in canonicos:
            faltan.append(destino)
            continue
        filas.append({"alias": alias, "fuente": "the", "nombre_universidad": destino})

    # 3. Alias evidentes por normalización: el mismo nombre con tildes o con
    #    puntuación distinta. Ahorra escribir a mano los de QS y Scimago.
    indice = {normalizar(n): n for n in canonicos}
    variantes = {
        "Pontificia Universidad Católica de Valparaíso": "Pontificia Universidad Catolica de Valparaiso",
        "Universidad Técnica Federico Santa María": "Universidad Tecnica Federico Santa Maria",
        "Universidad de Concepción": "Universidad de Concepcion",
        "Universidad de Santiago de Chile (USACH)": "Universidad de Santiago de Chile",
        "Universidad Católica del Norte": "Universidad Catolica del Norte",
        "Universidad de La Frontera": "Universidad de la Frontera",
        "Universidad de Tarapacá": "Universidad de Tarapaca",
        "Universidad de Valparaíso": "Universidad de Valparaiso",
        "Universidad Andrés Bello": "Universidad Andres Bello",
        "Universidad Adolfo Ibáñez": "Universidad Adolfo Ibanez",
        "Universidad del Bío-Bío": "Universidad del Bio-Bio",
        "Universidad de Magallanes": "Universidad de Magallanes",
        "Universidad Católica de Temuco": "Universidad Catolica de Temuco",
        "Universidad Católica del Maule": "Universidad Catolica del Maule",
        "Universidad Católica de la Santísima Concepción": "Universidad Catolica de la Santisima Concepcion",
        "Universidad Autónoma de Chile": "Universidad Autonoma de Chile",
        "Universidad Santo Tomás": "Universidad Santo Tomas",
        "Universidad Bernardo O'Higgins": "Universidad Bernardo O'Higgins",
        "Universidad de los Andes": "Universidad de los Andes",
    }
    for alias, destino in variantes.items():
        objetivo = destino if destino in canonicos else indice.get(normalizar(alias))
        if objetivo:
            filas.append({"alias": alias, "fuente": "generico", "nombre_universidad": objetivo})

    # Sin duplicados exactos y ordenado, para que el archivo sea estable entre
    # ejecuciones y sus diferencias en git se lean.
    vistos, unicas = set(), []
    for fila in sorted(filas, key=lambda f: (f["fuente"], f["alias"])):
        clave = (fila["alias"], fila["fuente"])
        if clave in vistos:
            continue
        vistos.add(clave)
        unicas.append(fila)

    with SALIDA.open("w", encoding="utf-8-sig", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=["alias", "fuente", "nombre_universidad"])
        escritor.writeheader()
        escritor.writerows(unicas)

    print(f"{len(unicas)} alias escritos en {SALIDA.name}")
    if faltan:
        print("Alias de THE cuyo destino no está en la base:", faltan)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
