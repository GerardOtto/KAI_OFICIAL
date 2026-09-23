# Modelo entidad-relación

Esquema de la base de datos de KAI (PostgreSQL), extraído del esquema real el
21-09-2026. El SQL equivalente, listo para importar en herramientas de
diagramas, está en [`modelo-er.sql`](modelo-er.sql).

```mermaid
erDiagram
    ranking ||--o{ metrica : "define"
    metrica |o--o{ metrica : "agrupa"
    metrica ||--o{ metrica_universidad : "se mide en"
    universidad ||--o{ metrica_universidad : "obtiene"
    universidad |o--o{ cientifico : "afilia"
    cientifico ||--o{ cientifico_metrica : "tiene"
    cientifico ||--o{ cientifico_topico : "publica en"
    plan |o--o{ usuario : "suscribe"
    usuario ||--o{ conversacion : "inicia"
    conversacion ||--o{ mensaje : "contiene"
    usuario ||--o{ notificacion : "recibe"

    universidad {
        int id_universidad PK
        text nombre_universidad
        text pais_universidad
    }
    ranking {
        int id_ranking PK
        text nombre_ranking
        text descripcion_ranking
        text nivel_ranking
        text categoria_ranking
        text pais_ranking
        text metodologia_ranking
    }
    metrica {
        int id_metrica PK
        int id_ranking FK
        text nombre_metrica
        text descripcion_metrica
        text tipo_metrica
        numeric peso_metrica
        text disciplina
        int id_metrica_padre FK "nulable"
        boolean pondera
    }
    metrica_universidad {
        int id_metrica PK,FK
        int id_universidad PK,FK
        int anio_metrica PK
        numeric valor_metrica
    }
    cientifico {
        int id_cientifico PK
        int id_universidad FK "nulable"
        text nombre_cientifico
        text institucion_original
        text campo_principal
        text subcampo_principal
        int anio_primera_publicacion
        int anio_ultima_publicacion
        text pais_cientifico
        text orcid
    }
    cientifico_metrica {
        int id_cientifico PK,FK
        int anio_datos PK
        text fuente PK
        int rank_global
        int rank_global_ns
        int h_index
        numeric hm_index
        int citas_totales
        int num_articulos
        numeric composite_score
        numeric self_citation_pct
    }
    cientifico_topico {
        int id_cientifico PK,FK
        text topico PK
        text fuente PK
        int anio_datos PK
        int autor_documentos
        numeric topico_fwci
    }
    plan {
        text codigo_plan PK
        text nombre_plan
        text descripcion
        numeric precio_mensual_usd
        bigint tokens_claude_mes
        bigint tokens_gemini_mes
        int mensajes_por_dia
        boolean publico
        int orden
    }
    usuario {
        int id_usuario PK
        text correo_usuario UK
        text google_sub UK "nulable"
        text clave_usuario "hash bcrypt, nulable"
        text plan_usuario FK
        text nombre_usuario
        text institucion_usuario
        text avatar_url
        boolean correo_verificado
        boolean notificaciones_switch
        timestamp fecha_creacion
        timestamp fecha_facturacion
        timestamp ultimo_acceso
    }
    conversacion {
        int id_conversacion PK
        int id_usuario FK
        text titulo
        text motor "claude | gemini"
        boolean archivada
        timestamp fecha_creacion
        timestamp fecha_actualizacion
    }
    mensaje {
        int id_mensaje PK
        int id_conversacion FK
        text rol "user | assistant"
        text contenido
        int tokens_entrada
        int tokens_salida
        text modelo
        timestamp fecha_creacion
    }
    notificacion {
        int id_notificacion PK
        int id_usuario FK
        text mensaje
        boolean leido_bool
        timestamp fecha_creacion
    }
```

## Dominios

- **Rankings:** `ranking` → `metrica` → `metrica_universidad` ← `universidad`.
  `metrica_universidad` es la tabla de hechos: el valor de una métrica para una
  universidad en un año. `metrica` se referencia a sí misma: algunos rankings
  publican su metodología en dos niveles —los pilares y los indicadores que cada
  pilar agrupa—, y `id_metrica_padre` registra esa jerarquía. `pondera` marca
  cuál de los dos niveles compone el 100 % del ranking; el otro se conserva como
  referencia metodológica y queda fuera de cualquier suma de pesos.
- **Investigadores:** `cientifico` (afiliado opcionalmente a una `universidad`)
  con sus indicadores anuales por fuente (`cientifico_metrica`) y sus tópicos
  (`cientifico_topico`).
- **Usuarios y asistente:** `plan` → `usuario` → `conversacion` → `mensaje`,
  más `notificacion`. Borrar un usuario borra en cascada sus conversaciones,
  mensajes y notificaciones.
