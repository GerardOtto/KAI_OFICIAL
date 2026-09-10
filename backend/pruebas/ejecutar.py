"""Ejecuta las baterías de verificación del backend y emite un veredicto único.

    python pruebas/ejecutar.py              # las que no gastan dinero
    python pruebas/ejecutar.py --en-vivo    # incluye las que llaman al proveedor
    python pruebas/ejecutar.py --solo herramientas concurrencia

Cada batería es un guion independiente que imprime sus comprobaciones y termina
con código 0 o 1. Este ejecutor las lanza en subprocesos separados —y no
importándolas— porque varias sustituyen módulos del backend por dobles, y
compartir intérprete haría que esas sustituciones se filtraran de una a otra.

Requisitos comunes: PostgreSQL accesible con la variable de entorno de conexión
que use `app.db`, y las tablas académicas cargadas. Ninguna batería del grupo
por defecto llama a un proveedor de lenguaje ni consume créditos.
"""
import argparse
import os
import re
import subprocess
import sys
import time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AQUI = os.path.dirname(os.path.abspath(__file__))

# nombre corto -> (archivo, descripción, necesita servidor aparte, gasta dinero)
BATERIAS = [
    ("herramientas", "test_herramientas.py",
     "Las diez herramientas de consulta y la contención de la consulta SQL", False, False),
    ("motor-gemini", "test_motor_gemini.py",
     "Ciclo de herramientas, tokens y errores del motor Gemini", False, False),
    ("busqueda-web", "test_busqueda_web.py",
     "Declaración conjunta de búsqueda y herramientas, y repliegue", False, False),
    ("convivencia", "test_convivencia_motores.py",
     "Motor fijado por conversación y aislamiento del contexto", False, False),
    ("planes", "test_planes.py",
     "Cuotas por motor, tope diario, margen comercial y rol administrador", False, False),
    ("chat", "test_chat_extremo_a_extremo.py",
     "Recorrido completo de /chat con sesión y base reales", False, False),
    ("concurrencia", "test_concurrencia.py",
     "Tope diario bajo peticiones simultáneas del mismo usuario", False, False),
    ("autenticacion", "test_autenticacion.py",
     "Registro, sesión y propiedad de las conversaciones (requiere backend en marcha)", True, False),
    ("en-vivo", "test_en_vivo_gemini.py",
     "Motor real contra la API real del proveedor", False, True),
]

CUENTA = re.compile(r"^\s*\[(OK |FALLA)\]", re.M)


def ejecutar(archivo, entorno):
    inicio = time.time()
    proceso = subprocess.run([sys.executable, os.path.join(AQUI, archivo)],
                             cwd=RAIZ, capture_output=True, text=True,
                             encoding="utf-8", errors="replace", env=entorno)
    salida = (proceso.stdout or "") + (proceso.stderr or "")
    marcas = CUENTA.findall(salida)
    return {
        "codigo": proceso.returncode,
        "comprobaciones": len(marcas),
        "fallidas": sum(1 for m in marcas if m == "FALLA"),
        "segundos": time.time() - inicio,
        "salida": salida,
    }


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--en-vivo", action="store_true",
                   help="incluye las baterías que llaman al proveedor y consumen cuota")
    p.add_argument("--con-servidor", action="store_true",
                   help="incluye las que requieren un backend ya en marcha")
    p.add_argument("--solo", nargs="+", metavar="NOMBRE",
                   help="ejecuta solo las baterías indicadas")
    p.add_argument("--detalle", action="store_true",
                   help="imprime la salida completa de cada batería")
    args = p.parse_args()

    seleccion = []
    for nombre, archivo, descripcion, necesita_servidor, gasta in BATERIAS:
        if args.solo:
            if nombre in args.solo:
                seleccion.append((nombre, archivo, descripcion))
            continue
        if gasta and not args.en_vivo:
            continue
        if necesita_servidor and not args.con_servidor:
            continue
        seleccion.append((nombre, archivo, descripcion))

    if not seleccion:
        print("Ninguna batería seleccionada.")
        return 2

    # Las baterías que sustituyen el proveedor necesitan que el motor figure como
    # configurado; sin clave real, porque no llegan a llamarlo.
    entorno = {**os.environ}
    entorno.setdefault("GEMINI_API_KEY", "clave-de-prueba")
    entorno["PYTHONIOENCODING"] = "utf-8"

    print(f"Ejecutando {len(seleccion)} baterías\n")
    resultados = []
    for nombre, archivo, descripcion in seleccion:
        print(f"  {nombre:16} {descripcion[:60]:62}", end="", flush=True)
        r = ejecutar(archivo, entorno)
        resultados.append((nombre, r))
        estado = "OK" if r["codigo"] == 0 else f"FALLA ({r['fallidas']})"
        print(f" {r['comprobaciones']:4} compr.  {r['segundos']:6.1f}s  {estado}")
        if args.detalle or r["codigo"] != 0:
            for linea in r["salida"].splitlines():
                print("        " + linea)

    total = sum(r["comprobaciones"] for _, r in resultados)
    fallidas = sum(r["fallidas"] for _, r in resultados)
    rotas = [n for n, r in resultados if r["codigo"] != 0]

    print("\n" + "=" * 74)
    print(f"{len(resultados)} baterías · {total} comprobaciones · {fallidas} fallidas")
    if rotas:
        print(f"BATERÍAS EN ROJO: {', '.join(rotas)}")
    else:
        print("TODO EN VERDE")
    return 1 if rotas else 0


if __name__ == "__main__":
    sys.exit(main())
