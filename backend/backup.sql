--
-- PostgreSQL database dump
--

\restrict NjaO5mLAFgauWK9V8mgc0PrDpAkMNLDdOhd1gyNOkICXMjUa0Wq0Dbuvo8E4fu3

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: notify_new_notification(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_new_notification() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM pg_notify('notifications_channel', row_to_json(NEW)::text);
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_new_notification() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: configuracion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuracion (
    id_configuracion integer NOT NULL,
    id_usuario integer NOT NULL,
    id_ranking integer NOT NULL,
    id_universidad integer NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    texto_descriptivo text,
    anio_simulado integer
);


ALTER TABLE public.configuracion OWNER TO postgres;

--
-- Name: configuracion_id_configuracion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.configuracion_id_configuracion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.configuracion_id_configuracion_seq OWNER TO postgres;

--
-- Name: configuracion_id_configuracion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.configuracion_id_configuracion_seq OWNED BY public.configuracion.id_configuracion;


--
-- Name: configuracion_metrica; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuracion_metrica (
    id_configuracion integer NOT NULL,
    id_metrica integer NOT NULL,
    valor_metrica numeric,
    valor_real numeric
);


ALTER TABLE public.configuracion_metrica OWNER TO postgres;

--
-- Name: metrica; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.metrica (
    id_metrica integer NOT NULL,
    id_ranking integer NOT NULL,
    id_sub_ranking integer,
    nombre_metrica text NOT NULL,
    descripcion_metrica text,
    tipo_metrica text,
    peso_metrica numeric
);


ALTER TABLE public.metrica OWNER TO postgres;

--
-- Name: metrica_id_metrica_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.metrica_id_metrica_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.metrica_id_metrica_seq OWNER TO postgres;

--
-- Name: metrica_id_metrica_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.metrica_id_metrica_seq OWNED BY public.metrica.id_metrica;


--
-- Name: metrica_universidad; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.metrica_universidad (
    id_metrica integer NOT NULL,
    id_universidad integer NOT NULL,
    valor_metrica numeric,
    anio_metrica integer NOT NULL
);


ALTER TABLE public.metrica_universidad OWNER TO postgres;

--
-- Name: notificacion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notificacion (
    id_notificacion integer NOT NULL,
    id_usuario integer NOT NULL,
    mensaje text NOT NULL,
    leido_bool boolean DEFAULT false,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notificacion OWNER TO postgres;

--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notificacion_id_notificacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notificacion_id_notificacion_seq OWNER TO postgres;

--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notificacion_id_notificacion_seq OWNED BY public.notificacion.id_notificacion;


--
-- Name: ranking; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ranking (
    id_ranking integer NOT NULL,
    nombre_ranking text NOT NULL,
    descripcion_ranking text,
    nivel_ranking text,
    categoria_ranking text,
    pais_ranking text,
    metodologia_ranking text
);


ALTER TABLE public.ranking OWNER TO postgres;

--
-- Name: ranking_id_ranking_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ranking_id_ranking_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ranking_id_ranking_seq OWNER TO postgres;

--
-- Name: ranking_id_ranking_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ranking_id_ranking_seq OWNED BY public.ranking.id_ranking;


--
-- Name: sub_rank_y_ranking; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sub_rank_y_ranking (
    id_sub_ranking integer NOT NULL,
    id_ranking integer NOT NULL
);


ALTER TABLE public.sub_rank_y_ranking OWNER TO postgres;

--
-- Name: sub_ranking; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sub_ranking (
    id_sub_ranking integer NOT NULL,
    nombre_sub_ranking text NOT NULL,
    peso_sub_ranking numeric
);


ALTER TABLE public.sub_ranking OWNER TO postgres;

--
-- Name: sub_ranking_id_sub_ranking_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sub_ranking_id_sub_ranking_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sub_ranking_id_sub_ranking_seq OWNER TO postgres;

--
-- Name: sub_ranking_id_sub_ranking_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sub_ranking_id_sub_ranking_seq OWNED BY public.sub_ranking.id_sub_ranking;


--
-- Name: universidad; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.universidad (
    id_universidad integer NOT NULL,
    nombre_universidad text NOT NULL,
    pais_universidad text
);


ALTER TABLE public.universidad OWNER TO postgres;

--
-- Name: universidad_id_universidad_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.universidad_id_universidad_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.universidad_id_universidad_seq OWNER TO postgres;

--
-- Name: universidad_id_universidad_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.universidad_id_universidad_seq OWNED BY public.universidad.id_universidad;


--
-- Name: universidad_ranking; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.universidad_ranking (
    id_universidad integer NOT NULL,
    id_ranking integer NOT NULL,
    anio_ranking integer NOT NULL,
    posicion_universidad integer
);


ALTER TABLE public.universidad_ranking OWNER TO postgres;

--
-- Name: usuario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuario (
    id_usuario integer NOT NULL,
    nombre_usuario text NOT NULL,
    institucion_usuario text,
    clave_usuario text NOT NULL,
    correo_usuario text NOT NULL,
    notificaciones_switch boolean DEFAULT true,
    plan_usuario text,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_facturacion timestamp without time zone
);


ALTER TABLE public.usuario OWNER TO postgres;

--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuario_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuario_id_usuario_seq OWNER TO postgres;

--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuario_id_usuario_seq OWNED BY public.usuario.id_usuario;


--
-- Name: configuracion id_configuracion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion ALTER COLUMN id_configuracion SET DEFAULT nextval('public.configuracion_id_configuracion_seq'::regclass);


--
-- Name: metrica id_metrica; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metrica ALTER COLUMN id_metrica SET DEFAULT nextval('public.metrica_id_metrica_seq'::regclass);


--
-- Name: notificacion id_notificacion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificacion ALTER COLUMN id_notificacion SET DEFAULT nextval('public.notificacion_id_notificacion_seq'::regclass);


--
-- Name: ranking id_ranking; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ranking ALTER COLUMN id_ranking SET DEFAULT nextval('public.ranking_id_ranking_seq'::regclass);


--
-- Name: sub_ranking id_sub_ranking; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sub_ranking ALTER COLUMN id_sub_ranking SET DEFAULT nextval('public.sub_ranking_id_sub_ranking_seq'::regclass);


--
-- Name: universidad id_universidad; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.universidad ALTER COLUMN id_universidad SET DEFAULT nextval('public.universidad_id_universidad_seq'::regclass);


--
-- Name: usuario id_usuario; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario ALTER COLUMN id_usuario SET DEFAULT nextval('public.usuario_id_usuario_seq'::regclass);


--
-- Data for Name: configuracion; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.configuracion (id_configuracion, id_usuario, id_ranking, id_universidad, fecha_creacion, texto_descriptivo, anio_simulado) FROM stdin;
\.


--
-- Data for Name: configuracion_metrica; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.configuracion_metrica (id_configuracion, id_metrica, valor_metrica, valor_real) FROM stdin;
\.


--
-- Data for Name: metrica; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.metrica (id_metrica, id_ranking, id_sub_ranking, nombre_metrica, descripcion_metrica, tipo_metrica, peso_metrica) FROM stdin;
1	1	4	Teaching reputation	Encuesta de reputación académica en enseñanza	Reputacion	15
2	1	4	Student staff ratio	Relación entre estudiantes y personal académico	Alumnado	4.5
3	1	4	Doctorate bachelor ratio	Proporción de doctorados respecto a pregrado	Academicos	2
4	1	4	Doctorate staff ratio	Proporción de doctorados por académico	Academicos	5.5
5	1	4	Institutional income	Ingresos institucionales por académico	Financiero	2.5
6	1	5	Research reputation	Encuesta de reputación académica en investigación	Reputacion	18
7	1	5	Research income	Ingresos por investigación ajustados por personal	Financiero	5.5
8	1	5	Research productivity	Producción científica por académico	Articulos	5.5
9	1	6	Citation impact	Impacto de citaciones de publicaciones	Articulos	15
10	1	6	Research strength	Fuerza de investigación basada en citaciones	Articulos	5
11	1	6	Research excellence	Excelencia en investigación medida por citaciones	Articulos	5
12	1	6	Research influence	Influencia global de la investigación	Articulos	5
13	1	7	Industry income	Ingresos provenientes de la industria	Financiero	2
14	1	7	Patents	Número de patentes generadas	Innovacion	2
15	1	8	International students	Proporción de estudiantes internacionales	Internacional	2.5
16	1	8	International staff	Proporción de personal internacional	Internacional	2.5
17	1	8	International co-authorship	Colaboraciones internacionales en publicaciones	Internacional	2.5
18	2	14	Academic reputation	Encuesta de reputación académica	Reputacion	30
19	2	14	Employer reputation	Reputación entre empleadores	Reputacion	20
20	2	15	Faculty student ratio	Relación entre estudiantes y académicos	Alumnado	10
21	2	15	Staff with PhD	Proporción de académicos con doctorado	Academicos	10
22	2	16	Papers per faculty	Artículos por académico	Articulos	5
23	2	16	Citations per paper	Citas por artículo	Articulos	10
24	2	17	International research network	Red internacional de investigación	Internacional	10
25	2	17	Web impact	Impacto web (Webometrics)	Infraestructura	5
30	3	1	Output in Own Journals	Número de revistas propias	Infraestructura	3
35	3	1	Open Access	Porcentaje de publicaciones en acceso abierto	Acceso Abierto	2
40	3	3	Altmetrics (PlumX and Mendeley)	Impacto social (PlumX y Mendeley)	Impacto Social	3
41	3	3	SDG-related Output	Producción asociada a ODS	Impacto Social	5
43	3	3	Overton	Documentos citados en políticas públicas	Impacto Social	3
856	4	18	Q1 (Mathematics)	Cantidad de artículos en Q1 en Mathematics	Articulos	25
857	4	19	Q1 (Physics)	Cantidad de artículos en Q1 en Physics	Articulos	25
858	4	20	Q1 (Chemistry)	Cantidad de artículos en Q1 en Chemistry	Articulos	25
859	4	21	Q1 (Earth Sciences)	Cantidad de artículos en Q1 en Earth Sciences	Articulos	25
860	4	22	Q1 (Geography)	Cantidad de artículos en Q1 en Geography	Articulos	25
861	4	23	Q1 (Ecology)	Cantidad de artículos en Q1 en Ecology	Articulos	25
862	4	24	Q1 (Oceanography)	Cantidad de artículos en Q1 en Oceanography	Articulos	25
863	4	25	Q1 (Atmospheric Science)	Cantidad de artículos en Q1 en Atmospheric Science	Articulos	25
864	4	26	Q1 (Mechanical Engineering)	Cantidad de artículos en Q1 en Mechanical Engineering	Articulos	25
865	4	27	Q1 (Electrical Engineering)	Cantidad de artículos en Q1 en Electrical Engineering	Articulos	25
866	4	28	Q1 (Automation)	Cantidad de artículos en Q1 en Automation	Articulos	25
867	4	29	Q1 (Telecommunication Engineering)	Cantidad de artículos en Q1 en Telecommunication Engineering	Articulos	25
868	4	30	Q1 (Instrumentation)	Cantidad de artículos en Q1 en Instrumentation	Articulos	25
869	4	31	Q1 (Biomedical Engineering)	Cantidad de artículos en Q1 en Biomedical Engineering	Articulos	25
870	4	32	Q1 (Computer Science)	Cantidad de artículos en Q1 en Computer Science	Articulos	25
871	4	33	Q1 (Civil Engineering)	Cantidad de artículos en Q1 en Civil Engineering	Articulos	25
872	4	34	Q1 (Chemical Engineering)	Cantidad de artículos en Q1 en Chemical Engineering	Articulos	25
873	4	35	Q1 (Materials Science)	Cantidad de artículos en Q1 en Materials Science	Articulos	25
874	4	36	Q1 (Nanoscience)	Cantidad de artículos en Q1 en Nanoscience	Articulos	25
875	4	37	Q1 (Energy)	Cantidad de artículos en Q1 en Energy	Articulos	25
876	4	38	Q1 (Environmental Science)	Cantidad de artículos en Q1 en Environmental Science	Articulos	25
877	4	39	Q1 (Water Resources)	Cantidad de artículos en Q1 en Water Resources	Articulos	25
878	4	40	Q1 (Food Science)	Cantidad de artículos en Q1 en Food Science	Articulos	25
31	3	1	International Collaboration	Producción con colaboración internacional	Internacionalizacion	2
26	3	1	Normalized Impact	Impacto normalizado respecto al promedio mundial	Investigacion	13
36	3	1	Scientific Talent Pool	Número total de autores afiliados	Academicos	2
42	3	3	Female Scientific Pool	Número de autoras afiliadas	Academicos	3
27	3	1	Excellence with Leadership	Documentos de excelencia donde la institución lidera	Articulos	8
28	3	1	Scientific Output	Número total de documentos en Scopus	Articulos	8
37	3	2	Innovative Knowledge	Producción científica citada en patentes	Innovacion	10
38	3	2	Technological Impact	Porcentaje de producción citada en patentes	Innovacion	10
39	3	2	Patents	Número de solicitudes de patentes	Innovacion	10
879	4	41	Q1 (Biotechnology)	Cantidad de artículos en Q1 en Biotechnology	Articulos	25
880	4	42	Q1 (Aerospace Engineering)	Cantidad de artículos en Q1 en Aerospace Engineering	Articulos	25
881	4	43	Q1 (Marine Engineering)	Cantidad de artículos en Q1 en Marine Engineering	Articulos	25
882	4	44	Q1 (Transportation)	Cantidad de artículos en Q1 en Transportation	Articulos	25
883	4	45	Q1 (Remote Sensing)	Cantidad de artículos en Q1 en Remote Sensing	Articulos	25
884	4	46	Q1 (Mining Engineering)	Cantidad de artículos en Q1 en Mining Engineering	Articulos	25
885	4	47	Q1 (Metallurgical Engineering)	Cantidad de artículos en Q1 en Metallurgical Engineering	Articulos	25
886	4	48	Q1 (Textile Engineering)	Cantidad de artículos en Q1 en Textile Engineering	Articulos	25
887	4	49	Q1 (Artificial Intelligence)	Cantidad de artículos en Q1 en Artificial Intelligence	Articulos	25
888	4	50	Q1 (Robotics)	Cantidad de artículos en Q1 en Robotics	Articulos	25
889	4	51	Q1 (Biological Sciences)	Cantidad de artículos en Q1 en Biological Sciences	Articulos	20
890	4	52	Q1 (Human Biological Sciences)	Cantidad de artículos en Q1 en Human Biological Sciences	Articulos	20
891	4	53	Q1 (Agricultural Sciences)	Cantidad de artículos en Q1 en Agricultural Sciences	Articulos	20
892	4	54	Q1 (Veterinary Sciences)	Cantidad de artículos en Q1 en Veterinary Sciences	Articulos	20
893	4	55	Q1 (Clinical Medicine)	Cantidad de artículos en Q1 en Clinical Medicine	Articulos	20
894	4	56	Q1 (Public Health)	Cantidad de artículos en Q1 en Public Health	Articulos	20
895	4	57	Q1 (Dentistry)	Cantidad de artículos en Q1 en Dentistry	Articulos	20
896	4	58	Q1 (Nursing)	Cantidad de artículos en Q1 en Nursing	Articulos	20
897	4	59	Q1 (Medical Technology)	Cantidad de artículos en Q1 en Medical Technology	Articulos	20
898	4	60	Q1 (Pharmacy)	Cantidad de artículos en Q1 en Pharmacy	Articulos	20
899	4	61	Q1 (Economics)	Cantidad de artículos en Q1 en Economics	Articulos	25
900	4	62	Q1 (Statistics)	Cantidad de artículos en Q1 en Statistics	Articulos	25
901	4	63	Q1 (Law)	Cantidad de artículos en Q1 en Law	Articulos	25
902	4	64	Q1 (Political Sciences)	Cantidad de artículos en Q1 en Political Sciences	Articulos	25
903	4	65	Q1 (Sociology)	Cantidad de artículos en Q1 en Sociology	Articulos	25
904	4	66	Q1 (Education)	Cantidad de artículos en Q1 en Education	Articulos	25
905	4	67	Q1 (Communication)	Cantidad de artículos en Q1 en Communication	Articulos	25
906	4	68	Q1 (Psychology)	Cantidad de artículos en Q1 en Psychology	Articulos	25
907	4	69	Q1 (Business Administration)	Cantidad de artículos en Q1 en Business Administration	Articulos	25
908	4	70	Q1 (Finance)	Cantidad de artículos en Q1 en Finance	Articulos	25
909	4	71	Q1 (Management)	Cantidad de artículos en Q1 en Management	Articulos	25
910	4	72	Q1 (Public Administration)	Cantidad de artículos en Q1 en Public Administration	Articulos	25
911	4	73	Q1 (Hospitality & Tourism Management)	Cantidad de artículos en Q1 en Hospitality & Tourism Management	Articulos	25
1084	4	19	Award (Physics)	Award en Physics Post 2024	Reputacion	100
1085	4	20	Award (Chemistry)	Award en Chemistry Post 2024	Reputacion	100
1086	4	21	Award (Earth Sciences)	Award en Earth Sciences Post 2024	Reputacion	80
1087	4	22	Award (Geography)	Award en Geography Post 2024	Reputacion	0
1088	4	23	Award (Ecology)	Award en Ecology Post 2024	Reputacion	0
1089	4	24	Award (Oceanography)	Award en Oceanography Post 2024	Reputacion	40
1090	4	25	Award (Atmospheric Science)	Award en AtmospherAward Science Post 2024	Reputacion	100
1091	4	26	Award (Mechanical Engineering)	Award en Mechanical Engineering Post 2024	Reputacion	60
1092	4	27	Award (Electrical Engineering)	Award en Electrical Engineering Post 2024	Reputacion	80
1093	4	28	Award (Automation)	Award en Automation Post 2024	Reputacion	60
1094	4	29	Award (Telecommunication Engineering)	Award en Telecommunication Engineering Post 2024	Reputacion	60
1095	4	30	Award (Instrumentation)	Award en Instrumentation Post 2024	Reputacion	0
1096	4	31	Award (Biomedical Engineering)	Award en Biomedical Engineering Post 2024	Reputacion	0
1097	4	32	Award (Computer Science)	Award en Computer Science Post 2024	Reputacion	100
1098	4	33	Award (Civil Engineering)	Award en Civil Engineering Post 2024	Reputacion	0
1099	4	34	Award (Chemical Engineering)	Award en Chemical Engineering Post 2024	Reputacion	20
1100	4	35	Award (Materials Science)	Award en Materials Science Post 2024	Reputacion	100
1101	4	36	Award (Nanoscience)	Award en Nanoscience Post 2024	Reputacion	0
1102	4	37	Award (Energy)	Award en Energy Post 2024	Reputacion	20
1103	4	38	Award (Environmental Science)	Award en Environmental Science Post 2024	Reputacion	40
1104	4	39	Award (Water Resources)	Award en Water Resources Post 2024	Reputacion	40
1105	4	40	Award (Food Science)	Award en Food Science Post 2024	Reputacion	0
1106	4	41	Award (Biotechnology)	Award en Biotechnology Post 2024	Reputacion	0
1107	4	42	Award (Aerospace Engineering)	Award en Aerospace Engineering Post 2024	Reputacion	0
1108	4	43	Award (Marine Engineering)	Award en Marine Engineering Post 2024	Reputacion	20
1109	4	44	Award (Transportation)	Award en Transportation Post 2024	Reputacion	0
1110	4	45	Award (Remote Sensing)	Award en Remote Sensing Post 2024	Reputacion	0
1111	4	46	Award (Mining Engineering)	Award en Mining Engineering Post 2024	Reputacion	0
1112	4	47	Award (Metallurgical Engineering)	Award en Metallurgical Engineering Post 2024	Reputacion	20
1113	4	48	Award (Textile Engineering)	Award en Textile Engineering Post 2024	Reputacion	0
1114	4	51	Award (Biological Sciences)	Award en Biological Sciences Post 2024	Reputacion	80
1115	4	52	Award (Human Biological Sciences)	Award en Human Biological Sciences Post 2024	Reputacion	40
1138	4	18	TJ (Mathematics)	TJ en Mathematics Post 2024	Articulos	100
912	4	18	IC (Mathematics)	IC en Mathematics Post 2024	Internacionalizacion	20
913	4	19	IC (Physics)	IC en Physics Post 2024	Internacionalizacion	20
914	4	20	IC (Chemistry)	IC en Chemistry Post 2024	Internacionalizacion	20
915	4	21	IC (Earth Sciences)	IC en Earth Sciences Post 2024	Internacionalizacion	20
916	4	22	IC (Geography)	IC en Geography Post 2024	Internacionalizacion	20
917	4	23	IC (Ecology)	IC en Ecology Post 2024	Internacionalizacion	20
918	4	24	IC (Oceanography)	IC en Oceanography Post 2024	Internacionalizacion	20
919	4	25	IC (Atmospheric Science)	IC en Atmospheric Science Post 2024	Internacionalizacion	20
920	4	26	IC (Mechanical Engineering)	IC en Mechanical Engineering Post 2024	Internacionalizacion	20
921	4	27	IC (Electrical Engineering)	IC en Electrical Engineering Post 2024	Internacionalizacion	20
922	4	28	IC (Automation)	IC en Automation Post 2024	Internacionalizacion	20
923	4	29	IC (Telecommunication Engineering)	IC en Telecommunication Engineering Post 2024	Internacionalizacion	20
924	4	30	IC (Instrumentation)	IC en Instrumentation Post 2024	Internacionalizacion	20
925	4	31	IC (Biomedical Engineering)	IC en Biomedical Engineering Post 2024	Internacionalizacion	20
926	4	32	IC (Computer Science)	IC en Computer Science Post 2024	Internacionalizacion	20
927	4	33	IC (Civil Engineering)	IC en Civil Engineering Post 2024	Internacionalizacion	20
928	4	34	IC (Chemical Engineering)	IC en Chemical Engineering Post 2024	Internacionalizacion	20
929	4	35	IC (Materials Science)	IC en Materials Science Post 2024	Internacionalizacion	20
930	4	36	IC (Nanoscience)	IC en Nanoscience Post 2024	Internacionalizacion	20
931	4	37	IC (Energy)	IC en Energy Post 2024	Internacionalizacion	20
932	4	38	IC (Environmental Science)	IC en Environmental Science Post 2024	Internacionalizacion	20
933	4	39	IC (Water Resources)	IC en Water Resources Post 2024	Internacionalizacion	20
934	4	40	IC (Food Science)	IC en Food Science Post 2024	Internacionalizacion	20
935	4	41	IC (Biotechnology)	IC en Biotechnology Post 2024	Internacionalizacion	20
936	4	42	IC (Aerospace Engineering)	IC en Aerospace Engineering Post 2024	Internacionalizacion	20
937	4	43	IC (Marine Engineering)	IC en Marine Engineering Post 2024	Internacionalizacion	20
938	4	44	IC (Transportation)	IC en Transportation Post 2024	Internacionalizacion	20
939	4	45	IC (Remote Sensing)	IC en Remote Sensing Post 2024	Internacionalizacion	20
940	4	46	IC (Mining Engineering)	IC en Mining Engineering Post 2024	Internacionalizacion	20
941	4	47	IC (Metallurgical Engineering)	IC en Metallurgical Engineering Post 2024	Internacionalizacion	20
942	4	48	IC (Textile Engineering)	IC en Textile Engineering Post 2024	Internacionalizacion	20
943	4	49	IC (Artificial Intelligence)	IC en Artificial Intelligence Post 2024	Internacionalizacion	20
944	4	50	IC (Robotics)	IC en Robotics Post 2024	Internacionalizacion	20
945	4	51	IC (Biological Sciences)	IC en Biological Sciences Post 2024	Internacionalizacion	20
946	4	52	IC (Human Biological Sciences)	IC en Human Biological Sciences Post 2024	Internacionalizacion	20
947	4	53	IC (Agricultural Sciences)	IC en Agricultural Sciences Post 2024	Internacionalizacion	20
948	4	54	IC (Veterinary Sciences)	IC en Veterinary Sciences Post 2024	Internacionalizacion	20
949	4	55	IC (Clinical Medicine)	IC en Clinical Medicine Post 2024	Internacionalizacion	20
950	4	56	IC (Public Health)	IC en Public Health Post 2024	Internacionalizacion	20
951	4	57	IC (Dentistry)	IC en Dentistry Post 2024	Internacionalizacion	20
952	4	58	IC (Nursing)	IC en Nursing Post 2024	Internacionalizacion	20
953	4	59	IC (Medical Technology)	IC en Medical Technology Post 2024	Internacionalizacion	20
954	4	60	IC (Pharmacy)	IC en Pharmacy Post 2024	Internacionalizacion	20
955	4	61	IC (Economics)	IC en Economics Post 2024	Internacionalizacion	10
956	4	62	IC (Statistics)	IC en Statistics Post 2024	Internacionalizacion	10
957	4	63	IC (Law)	IC en Law Post 2024	Internacionalizacion	10
958	4	64	IC (Political Sciences)	IC en Political Sciences Post 2024	Internacionalizacion	10
959	4	65	IC (Sociology)	IC en Sociology Post 2024	Internacionalizacion	10
960	4	66	IC (Education)	IC en Education Post 2024	Internacionalizacion	10
961	4	67	IC (Communication)	IC en Communication Post 2024	Internacionalizacion	10
962	4	68	IC (Psychology)	IC en Psychology Post 2024	Internacionalizacion	10
963	4	69	IC (Business Administration)	IC en Business Administration Post 2024	Internacionalizacion	20
964	4	70	IC (Finance)	IC en Finance Post 2024	Internacionalizacion	10
965	4	71	IC (Management)	IC en Management Post 2024	Internacionalizacion	10
966	4	72	IC (Public Administration)	IC en Public Administration Post 2024	Internacionalizacion	10
967	4	73	IC (Hospitality & Tourism Management)	IC en Hospitality & Tourism Management Post 2024	Internacionalizacion	10
968	4	74	IC (Library & Information Science)	IC en Library & Information Science Post 2024	Internacionalizacion	20
1116	4	53	Award (Agricultural Sciences)	Award en Agricultural Sciences Post 2024	Reputacion	0
1117	4	54	Award (Veterinary Sciences)	Award en Veterinary Sciences Post 2024	Reputacion	0
1118	4	55	Award (Clinical Medicine)	Award en Clinical Medicine Post 2024	Reputacion	100
1119	4	56	Award (Public Health)	Award en PublAward Health Post 2024	Reputacion	0
1120	4	57	Award (Dentistry)	Award en Dentistry Post 2024	Reputacion	80
1121	4	58	Award (Nursing)	Award en Nursing Post 2024	Reputacion	60
1122	4	59	Award (Medical Technology)	Award en Medical Technology Post 2024	Reputacion	80
1123	4	60	Award (Pharmacy)	Award en Pharmacy Post 2024	Reputacion	20
1124	4	61	Award (Economics)	Award en Economics Post 2024	Reputacion	100
969	4	18	CNCI (Mathematics)	CNCI en Mathematics Post 2024	Investigacion	50
970	4	19	CNCI (Physics)	CNCI en Physics Post 2024	Investigacion	50
971	4	20	CNCI (Chemistry)	CNCI en Chemistry Post 2024	Investigacion	50
972	4	21	CNCI (Earth Sciences)	CNCI en Earth Sciences Post 2024	Investigacion	50
973	4	22	CNCI (Geography)	CNCI en Geography Post 2024	Investigacion	50
974	4	23	CNCI (Ecology)	CNCI en Ecology Post 2024	Investigacion	50
975	4	24	CNCI (Oceanography)	CNCI en Oceanography Post 2024	Investigacion	50
976	4	25	CNCI (Atmospheric Science)	CNCI en AtmospherCNCI Science Post 2024	Investigacion	50
977	4	26	CNCI (Mechanical Engineering)	CNCI en Mechanical Engineering Post 2024	Investigacion	50
978	4	27	CNCI (Electrical Engineering)	CNCI en Electrical Engineering Post 2024	Investigacion	50
979	4	28	CNCI (Automation)	CNCI en Automation Post 2024	Investigacion	50
980	4	29	CNCI (Telecommunication Engineering)	CNCI en Telecommunication Engineering Post 2024	Investigacion	50
981	4	30	CNCI (Instrumentation)	CNCI en Instrumentation Post 2024	Investigacion	50
982	4	31	CNCI (Biomedical Engineering)	CNCI en Biomedical Engineering Post 2024	Investigacion	50
983	4	32	CNCI (Computer Science)	CNCI en Computer Science Post 2024	Investigacion	50
984	4	33	CNCI (Civil Engineering)	CNCI en Civil Engineering Post 2024	Investigacion	50
985	4	34	CNCI (Chemical Engineering)	CNCI en Chemical Engineering Post 2024	Investigacion	50
986	4	35	CNCI (Materials Science)	CNCI en Materials Science Post 2024	Investigacion	50
987	4	36	CNCI (Nanoscience)	CNCI en Nanoscience Post 2024	Investigacion	50
988	4	37	CNCI (Energy)	CNCI en Energy Post 2024	Investigacion	50
989	4	38	CNCI (Environmental Science)	CNCI en Environmental Science Post 2024	Investigacion	50
990	4	39	CNCI (Water Resources)	CNCI en Water Resources Post 2024	Investigacion	50
991	4	40	CNCI (Food Science)	CNCI en Food Science Post 2024	Investigacion	50
992	4	41	CNCI (Biotechnology)	CNCI en Biotechnology Post 2024	Investigacion	50
993	4	42	CNCI (Aerospace Engineering)	CNCI en Aerospace Engineering Post 2024	Investigacion	50
994	4	43	CNCI (Marine Engineering)	CNCI en Marine Engineering Post 2024	Investigacion	50
995	4	44	CNCI (Transportation)	CNCI en Transportation Post 2024	Investigacion	50
996	4	45	CNCI (Remote Sensing)	CNCI en Remote Sensing Post 2024	Investigacion	50
997	4	46	CNCI (Mining Engineering)	CNCI en Mining Engineering Post 2024	Investigacion	50
998	4	47	CNCI (Metallurgical Engineering)	CNCI en Metallurgical Engineering Post 2024	Investigacion	50
999	4	48	CNCI (Textile Engineering)	CNCI en Textile Engineering Post 2024	Investigacion	50
1000	4	49	CNCI (Artificial Intelligence)	CNCI en Artificial Intelligence Post 2024	Investigacion	50
1001	4	50	CNCI (Robotics)	CNCI en Robotics Post 2024	Investigacion	50
1002	4	51	CNCI (Biological Sciences)	CNCI en Biological Sciences Post 2024	Investigacion	50
1003	4	52	CNCI (Human Biological Sciences)	CNCI en Human Biological Sciences Post 2024	Investigacion	50
1004	4	53	CNCI (Agricultural Sciences)	CNCI en Agricultural Sciences Post 2024	Investigacion	50
1005	4	54	CNCI (Veterinary Sciences)	CNCI en Veterinary Sciences Post 2024	Investigacion	50
1006	4	55	CNCI (Clinical Medicine)	CNCI en Clinical Medicine Post 2024	Investigacion	50
1007	4	56	CNCI (Public Health)	CNCI en PublCNCI Health Post 2024	Investigacion	50
1008	4	57	CNCI (Dentistry)	CNCI en Dentistry Post 2024	Investigacion	50
1009	4	58	CNCI (Nursing)	CNCI en Nursing Post 2024	Investigacion	50
1010	4	59	CNCI (Medical Technology)	CNCI en Medical Technology Post 2024	Investigacion	50
1011	4	60	CNCI (Pharmacy)	CNCI en Pharmacy Post 2024	Investigacion	50
1012	4	61	CNCI (Economics)	CNCI en Economics Post 2024	Investigacion	50
1013	4	62	CNCI (Statistics)	CNCI en Statistics Post 2024	Investigacion	50
1014	4	63	CNCI (Law)	CNCI en Law Post 2024	Investigacion	50
1015	4	64	CNCI (Political Sciences)	CNCI en Political Sciences Post 2024	Investigacion	50
1016	4	65	CNCI (Sociology)	CNCI en Sociology Post 2024	Investigacion	50
1017	4	66	CNCI (Education)	CNCI en Education Post 2024	Investigacion	50
1018	4	67	CNCI (Communication)	CNCI en Communication Post 2024	Investigacion	50
1019	4	68	CNCI (Psychology)	CNCI en Psychology Post 2024	Investigacion	50
1020	4	69	CNCI (Business Administration)	CNCI en Business Administration Post 2024	Investigacion	50
1021	4	70	CNCI (Finance)	CNCI en Finance Post 2024	Investigacion	50
1022	4	71	CNCI (Management)	CNCI en Management Post 2024	Investigacion	50
1023	4	72	CNCI (Public Administration)	CNCI en PublCNCI Administration Post 2024	Investigacion	50
1024	4	73	CNCI (Hospitality & Tourism Management)	CNCI en Hospitality & Tourism Management Post 2024	Investigacion	50
1025	4	74	CNCI (Library & Information Science)	CNCI en Library & Information Science Post 2024	Investigacion	50
1125	4	62	Award (Statistics)	Award en Statistics Post 2024	Reputacion	80
1126	4	63	Award (Law)	Award en Law Post 2024	Reputacion	0
1127	4	64	Award (Political Sciences)	Award en Political Sciences Post 2024	Reputacion	100
1128	4	65	Award (Sociology)	Award en Sociology Post 2024	Reputacion	0
1129	4	66	Award (Education)	Award en Education Post 2024	Reputacion	0
1130	4	67	Award (Communication)	Award en Communication Post 2024	Reputacion	0
1131	4	68	Award (Psychology)	Award en Psychology Post 2024	Reputacion	40
1132	4	69	Award (Business Administration)	Award en Business Administration Post 2024	Reputacion	0
1133	4	70	Award (Finance)	Award en Finance Post 2024	Reputacion	0
1134	4	71	Award (Management)	Award en Management Post 2024	Reputacion	0
1135	4	72	Award (Public Administration)	Award en PublAward Administration Post 2024	Reputacion	20
1139	4	19	TJ (Physics)	TJ en Physics Post 2024	Articulos	100
1026	4	18	Q1 (Mathematics)	Q1 en Mathematics Post 2024	Articulos	100
1027	4	19	Q1 (Physics)	Q1 en Physics Post 2024	Articulos	100
1028	4	20	Q1 (Chemistry)	Q1 en Chemistry Post 2024	Articulos	100
1029	4	21	Q1 (Earth Sciences)	Q1 en Earth Sciences Post 2024	Articulos	100
1030	4	22	Q1 (Geography)	Q1 en Geography Post 2024	Articulos	100
1031	4	23	Q1 (Ecology)	Q1 en Ecology Post 2024	Articulos	100
1032	4	24	Q1 (Oceanography)	Q1 en Oceanography Post 2024	Articulos	100
1033	4	25	Q1 (Atmospheric Science)	Q1 en AtmospherQ1 Science Post 2024	Articulos	100
1034	4	26	Q1 (Mechanical Engineering)	Q1 en Mechanical Engineering Post 2024	Articulos	100
1035	4	27	Q1 (Electrical Engineering)	Q1 en Electrical Engineering Post 2024	Articulos	100
1036	4	28	Q1 (Automation)	Q1 en Automation Post 2024	Articulos	100
1037	4	29	Q1 (Telecommunication Engineering)	Q1 en Telecommunication Engineering Post 2024	Articulos	100
1038	4	30	Q1 (Instrumentation)	Q1 en Instrumentation Post 2024	Articulos	100
1039	4	31	Q1 (Biomedical Engineering)	Q1 en Biomedical Engineering Post 2024	Articulos	100
1040	4	32	Q1 (Computer Science)	Q1 en Computer Science Post 2024	Articulos	100
1041	4	33	Q1 (Civil Engineering)	Q1 en Civil Engineering Post 2024	Articulos	100
1042	4	34	Q1 (Chemical Engineering)	Q1 en Chemical Engineering Post 2024	Articulos	100
1043	4	35	Q1 (Materials Science)	Q1 en Materials Science Post 2024	Articulos	100
1044	4	36	Q1 (Nanoscience)	Q1 en Nanoscience Post 2024	Articulos	100
1045	4	37	Q1 (Energy)	Q1 en Energy Post 2024	Articulos	100
1046	4	38	Q1 (Environmental Science)	Q1 en Environmental Science Post 2024	Articulos	100
1047	4	39	Q1 (Water Resources)	Q1 en Water Resources Post 2024	Articulos	100
1048	4	40	Q1 (Food Science)	Q1 en Food Science Post 2024	Articulos	100
1049	4	41	Q1 (Biotechnology)	Q1 en Biotechnology Post 2024	Articulos	100
1050	4	42	Q1 (Aerospace Engineering)	Q1 en Aerospace Engineering Post 2024	Articulos	100
1051	4	43	Q1 (Marine Engineering)	Q1 en Marine Engineering Post 2024	Articulos	100
1052	4	44	Q1 (Transportation)	Q1 en Transportation Post 2024	Articulos	100
1053	4	45	Q1 (Remote Sensing)	Q1 en Remote Sensing Post 2024	Articulos	100
1054	4	46	Q1 (Mining Engineering)	Q1 en Mining Engineering Post 2024	Articulos	100
1055	4	47	Q1 (Metallurgical Engineering)	Q1 en Metallurgical Engineering Post 2024	Articulos	100
1056	4	48	Q1 (Textile Engineering)	Q1 en Textile Engineering Post 2024	Articulos	100
1057	4	49	Q1 (Artificial Intelligence)	Q1 en Artificial Intelligence Post 2024	Articulos	100
1058	4	50	Q1 (Robotics)	Q1 en Robotics Post 2024	Articulos	100
1059	4	51	Q1 (Biological Sciences)	Q1 en Biological Sciences Post 2024	Articulos	100
1060	4	52	Q1 (Human Biological Sciences)	Q1 en Human Biological Sciences Post 2024	Articulos	100
1061	4	53	Q1 (Agricultural Sciences)	Q1 en Agricultural Sciences Post 2024	Articulos	100
1062	4	54	Q1 (Veterinary Sciences)	Q1 en Veterinary Sciences Post 2024	Articulos	100
1063	4	55	Q1 (Clinical Medicine)	Q1 en Clinical Medicine Post 2024	Articulos	100
1064	4	56	Q1 (Public Health)	Q1 en PublQ1 Health Post 2024	Articulos	100
1065	4	57	Q1 (Dentistry)	Q1 en Dentistry Post 2024	Articulos	100
1066	4	58	Q1 (Nursing)	Q1 en Nursing Post 2024	Articulos	100
1067	4	59	Q1 (Medical Technology)	Q1 en Medical Technology Post 2024	Articulos	100
1068	4	60	Q1 (Pharmacy)	Q1 en Pharmacy Post 2024	Articulos	100
1069	4	61	Q1 (Economics)	Q1 en Economics Post 2024	Articulos	100
1070	4	62	Q1 (Statistics)	Q1 en Statistics Post 2024	Articulos	100
1071	4	63	Q1 (Law)	Q1 en Law Post 2024	Articulos	100
1072	4	64	Q1 (Political Sciences)	Q1 en Political Sciences Post 2024	Articulos	100
1073	4	65	Q1 (Sociology)	Q1 en Sociology Post 2024	Articulos	100
1074	4	66	Q1 (Education)	Q1 en Education Post 2024	Articulos	100
1075	4	67	Q1 (Communication)	Q1 en Communication Post 2024	Articulos	100
1076	4	68	Q1 (Psychology)	Q1 en Psychology Post 2024	Articulos	100
1077	4	69	Q1 (Business Administration)	Q1 en Business Administration Post 2024	Articulos	100
1078	4	70	Q1 (Finance)	Q1 en Finance Post 2024	Articulos	100
1079	4	71	Q1 (Management)	Q1 en Management Post 2024	Articulos	100
1080	4	72	Q1 (Public Administration)	Q1 en PublQ1 Administration Post 2024	Articulos	100
1081	4	73	Q1 (Hospitality & Tourism Management)	Q1 en Hospitality & Tourism Management Post 2024	Articulos	100
1082	4	74	Q1 (Library & Information Science)	Q1 en Library & Information Science Post 2024	Articulos	100
614	4	18	PUB (Mathematics)	PUB en Mathematics	Articulos	25
615	4	18	CNCI (Mathematics)	CNCI en Mathematics	Investigacion	25
616	4	18	IC (Mathematics)	IC en Mathematics	Internacionalizacion	20
617	4	18	TOP (Mathematics)	TOP en Mathematics	Articulos	20
618	4	18	AWARD (Mathematics)	AWARD en Mathematics	Reputacion	10
619	4	19	PUB (Physics)	PUB en Physics	Articulos	25
620	4	19	CNCI (Physics)	CNCI en Physics	Investigacion	25
621	4	19	IC (Physics)	IC en Physics	Internacionalizacion	20
622	4	19	TOP (Physics)	TOP en Physics	Articulos	20
623	4	19	AWARD (Physics)	AWARD en Physics	Reputacion	10
624	4	20	PUB (Chemistry)	PUB en Chemistry	Articulos	25
625	4	20	CNCI (Chemistry)	CNCI en Chemistry	Investigacion	25
626	4	20	IC (Chemistry)	IC en Chemistry	Internacionalizacion	20
627	4	20	TOP (Chemistry)	TOP en Chemistry	Articulos	20
628	4	20	AWARD (Chemistry)	AWARD en Chemistry	Reputacion	10
629	4	21	PUB (Earth Sciences)	PUB en Earth Sciences	Articulos	25
630	4	21	CNCI (Earth Sciences)	CNCI en Earth Sciences	Investigacion	25
1136	4	73	Award (Hospitality & Tourism Management)	Award en Hospitality & Tourism Management Post 2024	Reputacion	60
631	4	21	IC (Earth Sciences)	IC en Earth Sciences	Internacionalizacion	20
632	4	21	TOP (Earth Sciences)	TOP en Earth Sciences	Articulos	20
633	4	21	AWARD (Earth Sciences)	AWARD en Earth Sciences	Reputacion	10
634	4	22	PUB (Geography)	PUB en Geography	Articulos	25
635	4	22	CNCI (Geography)	CNCI en Geography	Investigacion	25
636	4	22	IC (Geography)	IC en Geography	Internacionalizacion	20
637	4	22	TOP (Geography)	TOP en Geography	Articulos	20
638	4	22	AWARD (Geography)	AWARD en Geography	Reputacion	10
639	4	23	PUB (Ecology)	PUB en Ecology	Articulos	25
640	4	23	CNCI (Ecology)	CNCI en Ecology	Investigacion	25
641	4	23	IC (Ecology)	IC en Ecology	Internacionalizacion	20
642	4	23	TOP (Ecology)	TOP en Ecology	Articulos	20
643	4	23	AWARD (Ecology)	AWARD en Ecology	Reputacion	10
644	4	24	PUB (Oceanography)	PUB en Oceanography	Articulos	25
645	4	24	CNCI (Oceanography)	CNCI en Oceanography	Investigacion	25
646	4	24	IC (Oceanography)	IC en Oceanography	Internacionalizacion	20
647	4	24	TOP (Oceanography)	TOP en Oceanography	Articulos	20
648	4	24	AWARD (Oceanography)	AWARD en Oceanography	Reputacion	10
649	4	25	PUB (Atmospheric Science)	PUB en Atmospheric Science	Articulos	25
650	4	25	CNCI (Atmospheric Science)	CNCI en Atmospheric Science	Investigacion	25
651	4	25	IC (Atmospheric Science)	IC en Atmospheric Science	Internacionalizacion	20
652	4	25	TOP (Atmospheric Science)	TOP en Atmospheric Science	Articulos	20
653	4	25	AWARD (Atmospheric Science)	AWARD en Atmospheric Science	Reputacion	10
654	4	26	PUB (Mechanical Engineering)	PUB en Mechanical Engineering	Articulos	25
655	4	26	CNCI (Mechanical Engineering)	CNCI en Mechanical Engineering	Investigacion	25
656	4	26	IC (Mechanical Engineering)	IC en Mechanical Engineering	Internacionalizacion	25
657	4	26	TOP (Mechanical Engineering)	TOP en Mechanical Engineering	Articulos	25
658	4	27	PUB (Electrical Engineering)	PUB en Electrical Engineering	Articulos	25
659	4	27	CNCI (Electrical Engineering)	CNCI en Electrical Engineering	Investigacion	25
660	4	27	IC (Electrical Engineering)	IC en Electrical Engineering	Internacionalizacion	25
661	4	27	TOP (Electrical Engineering)	TOP en Electrical Engineering	Articulos	25
662	4	28	PUB (Automation)	PUB en Automation	Articulos	25
663	4	28	CNCI (Automation)	CNCI en Automation	Investigacion	25
664	4	28	IC (Automation)	IC en Automation	Internacionalizacion	25
665	4	28	TOP (Automation)	TOP en Automation	Articulos	25
666	4	29	PUB (Telecommunication Engineering)	PUB en Telecommunication Engineering	Articulos	25
667	4	29	CNCI (Telecommunication Engineering)	CNCI en Telecommunication Engineering	Investigacion	25
668	4	29	IC (Telecommunication Engineering)	IC en Telecommunication Engineering	Internacionalizacion	25
669	4	29	TOP (Telecommunication Engineering)	TOP en Telecommunication Engineering	Articulos	25
670	4	30	PUB (Instrumentation)	PUB en Instrumentation	Articulos	25
671	4	30	CNCI (Instrumentation)	CNCI en Instrumentation	Investigacion	25
672	4	30	IC (Instrumentation)	IC en Instrumentation	Internacionalizacion	25
673	4	30	TOP (Instrumentation)	TOP en Instrumentation	Articulos	25
674	4	31	PUB (Biomedical Engineering)	PUB en Biomedical Engineering	Articulos	25
675	4	31	CNCI (Biomedical Engineering)	CNCI en Biomedical Engineering	Investigacion	25
676	4	31	IC (Biomedical Engineering)	IC en Biomedical Engineering	Internacionalizacion	25
677	4	31	TOP (Biomedical Engineering)	TOP en Biomedical Engineering	Articulos	25
678	4	32	PUB (Computer Science)	PUB en Computer Science	Articulos	25
679	4	32	CNCI (Computer Science)	CNCI en Computer Science	Investigacion	25
680	4	32	IC (Computer Science)	IC en Computer Science	Internacionalizacion	25
681	4	32	TOP (Computer Science)	TOP en Computer Science	Articulos	25
682	4	33	PUB (Civil Engineering)	PUB en Civil Engineering	Articulos	25
683	4	33	CNCI (Civil Engineering)	CNCI en Civil Engineering	Investigacion	25
684	4	33	IC (Civil Engineering)	IC en Civil Engineering	Internacionalizacion	25
685	4	33	TOP (Civil Engineering)	TOP en Civil Engineering	Articulos	25
686	4	34	PUB (Chemical Engineering)	PUB en Chemical Engineering	Articulos	25
687	4	34	CNCI (Chemical Engineering)	CNCI en Chemical Engineering	Investigacion	25
688	4	34	IC (Chemical Engineering)	IC en Chemical Engineering	Internacionalizacion	25
689	4	34	TOP (Chemical Engineering)	TOP en Chemical Engineering	Articulos	25
690	4	35	PUB (Materials Science)	PUB en Materials Science	Articulos	25
691	4	35	CNCI (Materials Science)	CNCI en Materials Science	Investigacion	25
692	4	35	IC (Materials Science)	IC en Materials Science	Internacionalizacion	25
693	4	35	TOP (Materials Science)	TOP en Materials Science	Articulos	25
694	4	36	PUB (Nanoscience)	PUB en Nanoscience	Articulos	25
695	4	36	CNCI (Nanoscience)	CNCI en Nanoscience	Investigacion	25
696	4	36	IC (Nanoscience)	IC en Nanoscience	Internacionalizacion	25
697	4	36	TOP (Nanoscience)	TOP en Nanoscience	Articulos	25
698	4	37	PUB (Energy)	PUB en Energy	Articulos	25
699	4	37	CNCI (Energy)	CNCI en Energy	Investigacion	25
700	4	37	IC (Energy)	IC en Energy	Internacionalizacion	25
701	4	37	TOP (Energy)	TOP en Energy	Articulos	25
702	4	38	PUB (Environmental Science)	PUB en Environmental Science	Articulos	25
703	4	38	CNCI (Environmental Science)	CNCI en Environmental Science	Investigacion	25
704	4	38	IC (Environmental Science)	IC en Environmental Science	Internacionalizacion	25
705	4	38	TOP (Environmental Science)	TOP en Environmental Science	Articulos	25
706	4	39	PUB (Water Resources)	PUB en Water Resources	Articulos	25
707	4	39	CNCI (Water Resources)	CNCI en Water Resources	Investigacion	25
708	4	39	IC (Water Resources)	IC en Water Resources	Internacionalizacion	25
709	4	39	TOP (Water Resources)	TOP en Water Resources	Articulos	25
710	4	40	PUB (Food Science)	PUB en Food Science	Articulos	25
711	4	40	CNCI (Food Science)	CNCI en Food Science	Investigacion	25
712	4	40	IC (Food Science)	IC en Food Science	Internacionalizacion	25
713	4	40	TOP (Food Science)	TOP en Food Science	Articulos	25
714	4	41	PUB (Biotechnology)	PUB en Biotechnology	Articulos	25
715	4	41	CNCI (Biotechnology)	CNCI en Biotechnology	Investigacion	25
716	4	41	IC (Biotechnology)	IC en Biotechnology	Internacionalizacion	25
717	4	41	TOP (Biotechnology)	TOP en Biotechnology	Articulos	25
718	4	42	PUB (Aerospace Engineering)	PUB en Aerospace Engineering	Articulos	25
719	4	42	CNCI (Aerospace Engineering)	CNCI en Aerospace Engineering	Investigacion	25
720	4	42	IC (Aerospace Engineering)	IC en Aerospace Engineering	Internacionalizacion	25
721	4	42	TOP (Aerospace Engineering)	TOP en Aerospace Engineering	Articulos	25
722	4	43	PUB (Marine Engineering)	PUB en Marine Engineering	Articulos	25
723	4	43	CNCI (Marine Engineering)	CNCI en Marine Engineering	Investigacion	25
724	4	43	IC (Marine Engineering)	IC en Marine Engineering	Internacionalizacion	25
725	4	43	TOP (Marine Engineering)	TOP en Marine Engineering	Articulos	25
726	4	44	PUB (Transportation)	PUB en Transportation	Articulos	25
727	4	44	CNCI (Transportation)	CNCI en Transportation	Investigacion	25
728	4	44	IC (Transportation)	IC en Transportation	Internacionalizacion	25
729	4	44	TOP (Transportation)	TOP en Transportation	Articulos	25
730	4	45	PUB (Remote Sensing)	PUB en Remote Sensing	Articulos	25
731	4	45	CNCI (Remote Sensing)	CNCI en Remote Sensing	Investigacion	25
732	4	45	IC (Remote Sensing)	IC en Remote Sensing	Internacionalizacion	25
733	4	45	TOP (Remote Sensing)	TOP en Remote Sensing	Articulos	25
734	4	46	PUB (Mining Engineering)	PUB en Mining Engineering	Articulos	25
735	4	46	CNCI (Mining Engineering)	CNCI en Mining Engineering	Investigacion	25
736	4	46	IC (Mining Engineering)	IC en Mining Engineering	Internacionalizacion	25
737	4	46	TOP (Mining Engineering)	TOP en Mining Engineering	Articulos	25
738	4	47	PUB (Metallurgical Engineering)	PUB en Metallurgical Engineering	Articulos	25
739	4	47	CNCI (Metallurgical Engineering)	CNCI en Metallurgical Engineering	Investigacion	25
740	4	47	IC (Metallurgical Engineering)	IC en Metallurgical Engineering	Internacionalizacion	25
741	4	47	TOP (Metallurgical Engineering)	TOP en Metallurgical Engineering	Articulos	25
742	4	48	PUB (Textile Engineering)	PUB en Textile Engineering	Articulos	25
743	4	48	CNCI (Textile Engineering)	CNCI en Textile Engineering	Investigacion	25
744	4	48	IC (Textile Engineering)	IC en Textile Engineering	Internacionalizacion	25
745	4	48	TOP (Textile Engineering)	TOP en Textile Engineering	Articulos	25
746	4	49	PUB (Artificial Intelligence)	PUB en Artificial Intelligence	Articulos	25
747	4	49	CNCI (Artificial Intelligence)	CNCI en Artificial Intelligence	Investigacion	25
748	4	49	IC (Artificial Intelligence)	IC en Artificial Intelligence	Internacionalizacion	25
749	4	49	TOP (Artificial Intelligence)	TOP en Artificial Intelligence	Articulos	25
750	4	50	PUB (Robotics)	PUB en Robotics	Articulos	25
751	4	50	CNCI (Robotics)	CNCI en Robotics	Investigacion	25
752	4	50	IC (Robotics)	IC en Robotics	Internacionalizacion	25
753	4	50	TOP (Robotics)	TOP en Robotics	Articulos	25
754	4	51	PUB (Biological Sciences)	PUB en Biological Sciences	Articulos	20
755	4	51	CNCI (Biological Sciences)	CNCI en Biological Sciences	Investigacion	30
756	4	51	IC (Biological Sciences)	IC en Biological Sciences	Internacionalizacion	20
757	4	51	TOP (Biological Sciences)	TOP en Biological Sciences	Articulos	25
758	4	51	AWARD (Biological Sciences)	AWARD en Biological Sciences	Reputacion	5
759	4	52	PUB (Human Biological Sciences)	PUB en Human Biological Sciences	Articulos	20
760	4	52	CNCI (Human Biological Sciences)	CNCI en Human Biological Sciences	Investigacion	30
761	4	52	IC (Human Biological Sciences)	IC en Human Biological Sciences	Internacionalizacion	20
762	4	52	TOP (Human Biological Sciences)	TOP en Human Biological Sciences	Articulos	25
763	4	52	AWARD (Human Biological Sciences)	AWARD en Human Biological Sciences	Reputacion	5
764	4	53	PUB (Agricultural Sciences)	PUB en Agricultural Sciences	Articulos	20
765	4	53	CNCI (Agricultural Sciences)	CNCI en Agricultural Sciences	Investigacion	30
766	4	53	IC (Agricultural Sciences)	IC en Agricultural Sciences	Internacionalizacion	20
767	4	53	TOP (Agricultural Sciences)	TOP en Agricultural Sciences	Articulos	25
768	4	53	AWARD (Agricultural Sciences)	AWARD en Agricultural Sciences	Reputacion	5
769	4	54	PUB (Veterinary Sciences)	PUB en Veterinary Sciences	Articulos	20
770	4	54	CNCI (Veterinary Sciences)	CNCI en Veterinary Sciences	Investigacion	30
771	4	54	IC (Veterinary Sciences)	IC en Veterinary Sciences	Internacionalizacion	20
772	4	54	TOP (Veterinary Sciences)	TOP en Veterinary Sciences	Articulos	25
773	4	54	AWARD (Veterinary Sciences)	AWARD en Veterinary Sciences	Reputacion	5
774	4	55	PUB (Clinical Medicine)	PUB en Clinical Medicine	Articulos	20
775	4	55	CNCI (Clinical Medicine)	CNCI en Clinical Medicine	Investigacion	30
776	4	55	IC (Clinical Medicine)	IC en Clinical Medicine	Internacionalizacion	20
777	4	55	TOP (Clinical Medicine)	TOP en Clinical Medicine	Articulos	25
778	4	55	AWARD (Clinical Medicine)	AWARD en Clinical Medicine	Reputacion	5
779	4	56	PUB (Public Health)	PUB en Public Health	Articulos	20
780	4	56	CNCI (Public Health)	CNCI en Public Health	Investigacion	30
781	4	56	IC (Public Health)	IC en Public Health	Internacionalizacion	20
782	4	56	TOP (Public Health)	TOP en Public Health	Articulos	25
783	4	56	AWARD (Public Health)	AWARD en Public Health	Reputacion	5
784	4	57	PUB (Dentistry)	PUB en Dentistry	Articulos	20
785	4	57	CNCI (Dentistry)	CNCI en Dentistry	Investigacion	30
786	4	57	IC (Dentistry)	IC en Dentistry	Internacionalizacion	20
787	4	57	TOP (Dentistry)	TOP en Dentistry	Articulos	25
788	4	57	AWARD (Dentistry)	AWARD en Dentistry	Reputacion	5
789	4	58	PUB (Nursing)	PUB en Nursing	Articulos	20
790	4	58	CNCI (Nursing)	CNCI en Nursing	Investigacion	30
791	4	58	IC (Nursing)	IC en Nursing	Internacionalizacion	20
792	4	58	TOP (Nursing)	TOP en Nursing	Articulos	25
793	4	58	AWARD (Nursing)	AWARD en Nursing	Reputacion	5
794	4	59	PUB (Medical Technology)	PUB en Medical Technology	Articulos	20
795	4	59	CNCI (Medical Technology)	CNCI en Medical Technology	Investigacion	30
796	4	59	IC (Medical Technology)	IC en Medical Technology	Internacionalizacion	20
797	4	59	TOP (Medical Technology)	TOP en Medical Technology	Articulos	25
798	4	59	AWARD (Medical Technology)	AWARD en Medical Technology	Reputacion	5
799	4	60	PUB (Pharmacy)	PUB en Pharmacy	Articulos	20
800	4	60	CNCI (Pharmacy)	CNCI en Pharmacy	Investigacion	30
801	4	60	IC (Pharmacy)	IC en Pharmacy	Internacionalizacion	20
802	4	60	TOP (Pharmacy)	TOP en Pharmacy	Articulos	25
803	4	60	AWARD (Pharmacy)	AWARD en Pharmacy	Reputacion	5
804	4	61	PUB (Economics)	PUB en Economics	Articulos	25
805	4	61	CNCI (Economics)	CNCI en Economics	Investigacion	35
806	4	61	IC (Economics)	IC en Economics	Internacionalizacion	25
807	4	61	TOP (Economics)	TOP en Economics	Articulos	15
808	4	62	PUB (Statistics)	PUB en Statistics	Articulos	25
809	4	62	CNCI (Statistics)	CNCI en Statistics	Investigacion	35
810	4	62	IC (Statistics)	IC en Statistics	Internacionalizacion	25
811	4	62	TOP (Statistics)	TOP en Statistics	Articulos	15
812	4	63	PUB (Law)	PUB en Law	Articulos	25
813	4	63	CNCI (Law)	CNCI en Law	Investigacion	35
814	4	63	IC (Law)	IC en Law	Internacionalizacion	25
815	4	63	TOP (Law)	TOP en Law	Articulos	15
816	4	64	PUB (Political Sciences)	PUB en Political Sciences	Articulos	25
817	4	64	CNCI (Political Sciences)	CNCI en Political Sciences	Investigacion	35
818	4	64	IC (Political Sciences)	IC en Political Sciences	Internacionalizacion	25
819	4	64	TOP (Political Sciences)	TOP en Political Sciences	Articulos	15
820	4	65	PUB (Sociology)	PUB en Sociology	Articulos	25
821	4	65	CNCI (Sociology)	CNCI en Sociology	Investigacion	35
822	4	65	IC (Sociology)	IC en Sociology	Internacionalizacion	25
823	4	65	TOP (Sociology)	TOP en Sociology	Articulos	15
824	4	66	PUB (Education)	PUB en Education	Articulos	25
825	4	66	CNCI (Education)	CNCI en Education	Investigacion	35
826	4	66	IC (Education)	IC en Education	Internacionalizacion	25
827	4	66	TOP (Education)	TOP en Education	Articulos	15
828	4	67	PUB (Communication)	PUB en Communication	Articulos	25
829	4	67	CNCI (Communication)	CNCI en Communication	Investigacion	35
830	4	67	IC (Communication)	IC en Communication	Internacionalizacion	25
831	4	67	TOP (Communication)	TOP en Communication	Articulos	15
832	4	68	PUB (Psychology)	PUB en Psychology	Articulos	25
833	4	68	CNCI (Psychology)	CNCI en Psychology	Investigacion	35
834	4	68	IC (Psychology)	IC en Psychology	Internacionalizacion	25
835	4	68	TOP (Psychology)	TOP en Psychology	Articulos	15
836	4	69	PUB (Business Administration)	PUB en Business Administration	Articulos	25
837	4	69	CNCI (Business Administration)	CNCI en Business Administration	Investigacion	35
838	4	69	IC (Business Administration)	IC en Business Administration	Internacionalizacion	25
839	4	69	TOP (Business Administration)	TOP en Business Administration	Articulos	15
840	4	70	PUB (Finance)	PUB en Finance	Articulos	25
841	4	70	CNCI (Finance)	CNCI en Finance	Investigacion	35
842	4	70	IC (Finance)	IC en Finance	Internacionalizacion	25
843	4	70	TOP (Finance)	TOP en Finance	Articulos	15
844	4	71	PUB (Management)	PUB en Management	Articulos	25
845	4	71	CNCI (Management)	CNCI en Management	Investigacion	35
846	4	71	IC (Management)	IC en Management	Internacionalizacion	25
847	4	71	TOP (Management)	TOP en Management	Articulos	15
848	4	72	PUB (Public Administration)	PUB en Public Administration	Articulos	25
849	4	72	CNCI (Public Administration)	CNCI en Public Administration	Investigacion	35
850	4	72	IC (Public Administration)	IC en Public Administration	Internacionalizacion	25
851	4	72	TOP (Public Administration)	TOP en Public Administration	Articulos	15
852	4	73	PUB (Hospitality & Tourism Management)	PUB en Hospitality & Tourism Management	Articulos	25
853	4	73	CNCI (Hospitality & Tourism Management)	CNCI en Hospitality & Tourism Management	Investigacion	35
854	4	73	IC (Hospitality & Tourism Management)	IC en Hospitality & Tourism Management	Internacionalizacion	25
855	4	73	TOP (Hospitality & Tourism Management)	TOP en Hospitality & Tourism Management	Articulos	15
1083	4	18	Award (Mathematics)	Award en Mathematics Post 2024	Reputacion	100
1137	4	74	Award (Library & Information Science)	Award en Library & Information Science Post 2024	Reputacion	20
1140	4	20	TJ (Chemistry)	TJ en Chemistry Post 2024	Articulos	100
1141	4	21	TJ (Earth Sciences)	TJ en Earth Sciences Post 2024	Articulos	100
1142	4	22	TJ (Geography)	TJ en Geography Post 2024	Articulos	100
1143	4	23	TJ (Ecology)	TJ en Ecology Post 2024	Articulos	100
1144	4	24	TJ (Oceanography)	TJ en Oceanography Post 2024	Articulos	80
1145	4	25	TJ (Atmospheric Science)	TJ en AtmospherTJ Science Post 2024	Articulos	100
1146	4	26	TJ (Mechanical Engineering)	TJ en Mechanical Engineering Post 2024	Articulos	60
1147	4	27	TJ (Electrical Engineering)	TJ en Electrical Engineering Post 2024	Articulos	40
1148	4	28	TJ (Automation)	TJ en Automation Post 2024	Articulos	80
1149	4	29	TJ (Telecommunication Engineering)	TJ en Telecommunication Engineering Post 2024	Articulos	100
1150	4	30	TJ (Instrumentation)	TJ en Instrumentation Post 2024	Articulos	100
1151	4	31	TJ (Biomedical Engineering)	TJ en Biomedical Engineering Post 2024	Articulos	60
1152	4	32	TJ (Computer Science)	TJ en Computer Science Post 2024	Articulos	100
1153	4	33	TJ (Civil Engineering)	TJ en Civil Engineering Post 2024	Articulos	100
1154	4	34	TJ (Chemical Engineering)	TJ en Chemical Engineering Post 2024	Articulos	100
1155	4	35	TJ (Materials Science)	TJ en Materials Science Post 2024	Articulos	80
1156	4	36	TJ (Nanoscience)	TJ en Nanoscience Post 2024	Articulos	100
1157	4	37	TJ (Energy)	TJ en Energy Post 2024	Articulos	100
1158	4	38	TJ (Environmental Science)	TJ en Environmental Science Post 2024	Articulos	100
1159	4	39	TJ (Water Resources)	TJ en Water Resources Post 2024	Articulos	100
1160	4	40	TJ (Food Science)	TJ en Food Science Post 2024	Articulos	100
1161	4	41	TJ (Biotechnology)	TJ en Biotechnology Post 2024	Articulos	100
1162	4	42	TJ (Aerospace Engineering)	TJ en Aerospace Engineering Post 2024	Articulos	80
1163	4	43	TJ (Marine Engineering)	TJ en Marine Engineering Post 2024	Articulos	40
1164	4	44	TJ (Transportation)	TJ en Transportation Post 2024	Articulos	100
1165	4	45	TJ (Remote Sensing)	TJ en Remote Sensing Post 2024	Articulos	80
1166	4	46	TJ (Mining Engineering)	TJ en Mining Engineering Post 2024	Articulos	40
1167	4	47	TJ (Metallurgical Engineering)	TJ en Metallurgical Engineering Post 2024	Articulos	100
1168	4	48	TJ (Textile Engineering)	TJ en Textile Engineering Post 2024	Articulos	100
1169	4	51	TJ (Biological Sciences)	TJ en Biological Sciences Post 2024	Articulos	100
1170	4	52	TJ (Human Biological Sciences)	TJ en Human Biological Sciences Post 2024	Articulos	100
1171	4	53	TJ (Agricultural Sciences)	TJ en Agricultural Sciences Post 2024	Articulos	100
1172	4	54	TJ (Veterinary Sciences)	TJ en Veterinary Sciences Post 2024	Articulos	100
1173	4	55	TJ (Clinical Medicine)	TJ en Clinical Medicine Post 2024	Articulos	100
1174	4	56	TJ (Public Health)	TJ en PublTJ Health Post 2024	Articulos	100
1175	4	57	TJ (Dentistry)	TJ en Dentistry Post 2024	Articulos	60
1176	4	58	TJ (Nursing)	TJ en Nursing Post 2024	Articulos	80
1177	4	59	TJ (Medical Technology)	TJ en Medical Technology Post 2024	Articulos	60
1178	4	60	TJ (Pharmacy)	TJ en Pharmacy Post 2024	Articulos	40
1179	4	61	TJ (Economics)	TJ en Economics Post 2024	Articulos	100
1180	4	62	TJ (Statistics)	TJ en Statistics Post 2024	Articulos	100
1181	4	63	TJ (Law)	TJ en Law Post 2024	Articulos	40
1182	4	64	TJ (Political Sciences)	TJ en Political Sciences Post 2024	Articulos	80
1183	4	65	TJ (Sociology)	TJ en Sociology Post 2024	Articulos	80
1184	4	66	TJ (Education)	TJ en Education Post 2024	Articulos	40
1185	4	67	TJ (Communication)	TJ en Communication Post 2024	Articulos	100
1186	4	68	TJ (Psychology)	TJ en Psychology Post 2024	Articulos	80
1187	4	69	TJ (Business Administration)	TJ en Business Administration Post 2024	Articulos	100
1188	4	70	TJ (Finance)	TJ en Finance Post 2024	Articulos	100
1189	4	71	TJ (Management)	TJ en Management Post 2024	Articulos	100
1190	4	72	TJ (Public Administration)	TJ en PublTJ Administration Post 2024	Articulos	80
1191	4	73	TJ (Hospitality & Tourism Management)	TJ en Hospitality & Tourism Management Post 2024	Articulos	100
1192	4	74	TJ (Library & Information Science)	TJ en Library & Information Science Post 2024	Articulos	80
1248	4	18	Leadership (Mathematics)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Mathematics Post 2024	Reputacion	20
1249	4	19	Leadership (Physics)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Physics Post 2024	Reputacion	20
1250	4	20	Leadership (Chemistry)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Chemistry Post 2024	Reputacion	0
1251	4	21	Leadership (Earth Sciences)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Earth Sciences Post 2024	Reputacion	10
1252	4	22	Leadership (Geography)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Geography Post 2024	Reputacion	10
1253	4	23	Leadership (Ecology)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Ecology Post 2024	Reputacion	0
1254	4	24	Leadership (Oceanography)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Oceanography Post 2024	Reputacion	0
1255	4	25	Leadership (Atmospheric Science)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en AtmospherNúmero de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados Science Post 2024	Reputacion	0
1256	4	26	Leadership (Mechanical Engineering)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Mechanical Engineering Post 2024	Reputacion	0
1257	4	27	Leadership (Electrical Engineering)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Electrical Engineering Post 2024	Reputacion	10
1258	4	28	Leadership (Automation)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Automation Post 2024	Reputacion	0
1259	4	29	Leadership (Telecommunication Engineering)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Telecommunication Engineering Post 2024	Reputacion	20
1260	4	30	Leadership (Instrumentation)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Instrumentation Post 2024	Reputacion	0
1261	4	31	Leadership (Biomedical Engineering)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Biomedical Engineering Post 2024	Reputacion	0
1262	4	32	Leadership (Computer Science)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Computer Science Post 2024	Reputacion	20
1263	4	33	Leadership (Civil Engineering)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Civil Engineering Post 2024	Reputacion	0
1264	4	34	Leadership (Chemical Engineering)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Chemical Engineering Post 2024	Reputacion	0
1265	4	35	Leadership (Materials Science)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Materials Science Post 2024	Reputacion	10
1266	4	36	Leadership (Nanoscience)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Nanoscience Post 2024	Reputacion	0
1267	4	37	Leadership (Energy)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Energy Post 2024	Reputacion	0
1268	4	38	Leadership (Environmental Science)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Environmental Science Post 2024	Reputacion	0
1269	4	39	Leadership (Water Resources)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Water Resources Post 2024	Reputacion	0
1270	4	40	Leadership (Food Science)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Food Science Post 2024	Reputacion	0
1271	4	41	Leadership (Biotechnology)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Biotechnology Post 2024	Reputacion	0
1272	4	42	Leadership (Aerospace Engineering)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Aerospace Engineering Post 2024	Reputacion	0
1273	4	43	Leadership (Marine Engineering)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Marine Engineering Post 2024	Reputacion	0
1274	4	44	Leadership (Transportation)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Transportation Post 2024	Reputacion	0
1275	4	45	Leadership (Remote Sensing)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Remote Sensing Post 2024	Reputacion	0
1276	4	46	Leadership (Mining Engineering)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Mining Engineering Post 2024	Reputacion	0
1277	4	47	Leadership (Metallurgical Engineering)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Metallurgical Engineering Post 2024	Reputacion	0
1278	4	48	Leadership (Textile Engineering)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Textile Engineering Post 2024	Reputacion	0
1279	4	51	Leadership (Biological Sciences)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Biological Sciences Post 2024	Reputacion	0
1280	4	52	Leadership (Human Biological Sciences)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Human Biological Sciences Post 2024	Reputacion	0
1281	4	53	Leadership (Agricultural Sciences)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Agricultural Sciences Post 2024	Reputacion	0
1282	4	54	Leadership (Veterinary Sciences)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Veterinary Sciences Post 2024	Reputacion	0
1283	4	55	Leadership (Clinical Medicine)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Clinical Medicine Post 2024	Reputacion	0
1284	4	56	Leadership (Public Health)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en PublNúmero de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados Health Post 2024	Reputacion	0
1285	4	57	Leadership (Dentistry)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Dentistry Post 2024	Reputacion	10
1286	4	58	Leadership (Nursing)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Nursing Post 2024	Reputacion	0
1287	4	59	Leadership (Medical Technology)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Medical Technology Post 2024	Reputacion	0
1288	4	60	Leadership (Pharmacy)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Pharmacy Post 2024	Reputacion	0
1289	4	61	Leadership (Economics)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Economics Post 2024	Reputacion	10
1290	4	62	Leadership (Statistics)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Statistics Post 2024	Reputacion	0
1291	4	63	Leadership (Law)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Law Post 2024	Reputacion	0
1292	4	64	Leadership (Political Sciences)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Political Sciences Post 2024	Reputacion	20
1293	4	65	Leadership (Sociology)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Sociology Post 2024	Reputacion	0
1294	4	66	Leadership (Education)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Education Post 2024	Reputacion	0
1295	4	67	Leadership (Communication)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Communication Post 2024	Reputacion	20
1296	4	68	Leadership (Psychology)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Psychology Post 2024	Reputacion	0
1297	4	69	Leadership (Business Administration)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Business Administration Post 2024	Reputacion	0
1298	4	70	Leadership (Finance)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Finance Post 2024	Reputacion	20
1299	4	71	Leadership (Management)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Management Post 2024	Reputacion	10
1300	4	72	Leadership (Public Administration)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en PublNúmero de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados Administration Post 2024	Reputacion	0
1301	4	73	Leadership (Hospitality & Tourism Management)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Hospitality & Tourism Management Post 2024	Reputacion	0
1302	4	74	Leadership (Library & Information Science)	Número de investigadores que han ganado premios académicos internacionales de prestigio y aquellos reconocidos como investigadores altamente citados en Library & Information Science Post 2024	Reputacion	0
1438	4	43	Laureate (Marine Engineering)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Marine Engineering Post 2024	Academicos	20
1413	4	18	Laureate (Mathematics)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica  en Mathematics Post 2024	Academicos	40
1414	4	19	Laureate (Physics)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Physics Post 2024	Academicos	60
1415	4	20	Laureate (Chemistry)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Chemistry Post 2024	Academicos	60
1416	4	21	Laureate (Earth Sciences)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Earth Sciences Post 2024	Academicos	40
1417	4	22	Laureate (Geography)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Geography Post 2024	Academicos	0
1418	4	23	Laureate (Ecology)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Ecology Post 2024	Academicos	0
1419	4	24	Laureate (Oceanography)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Oceanography Post 2024	Academicos	40
1420	4	25	Laureate (Atmospheric Science)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en AtmospherNúmero de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica Science Post 2024	Academicos	60
1421	4	26	Laureate (Mechanical Engineering)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Mechanical Engineering Post 2024	Academicos	40
1422	4	27	Laureate (Electrical Engineering)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Electrical Engineering Post 2024	Academicos	40
1423	4	28	Laureate (Automation)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Automation Post 2024	Academicos	40
1424	4	29	Laureate (Telecommunication Engineering)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Telecommunication Engineering Post 2024	Academicos	40
1425	4	30	Laureate (Instrumentation)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Instrumentation Post 2024	Academicos	0
1426	4	31	Laureate (Biomedical Engineering)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Biomedical Engineering Post 2024	Academicos	0
1427	4	32	Laureate (Computer Science)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Computer Science Post 2024	Academicos	60
1428	4	33	Laureate (Civil Engineering)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Civil Engineering Post 2024	Academicos	0
1429	4	34	Laureate (Chemical Engineering)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Chemical Engineering Post 2024	Academicos	40
1430	4	35	Laureate (Materials Science)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Materials Science Post 2024	Academicos	60
1431	4	36	Laureate (Nanoscience)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Nanoscience Post 2024	Academicos	0
1432	4	37	Laureate (Energy)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Energy Post 2024	Academicos	20
1433	4	38	Laureate (Environmental Science)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Environmental Science Post 2024	Academicos	20
1434	4	39	Laureate (Water Resources)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Water Resources Post 2024	Academicos	20
1435	4	40	Laureate (Food Science)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Food Science Post 2024	Academicos	0
1436	4	41	Laureate (Biotechnology)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Biotechnology Post 2024	Academicos	0
1437	4	42	Laureate (Aerospace Engineering)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Aerospace Engineering Post 2024	Academicos	0
1439	4	44	Laureate (Transportation)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Transportation Post 2024	Academicos	0
1440	4	45	Laureate (Remote Sensing)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Remote Sensing Post 2024	Academicos	0
1441	4	46	Laureate (Mining Engineering)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Mining Engineering Post 2024	Academicos	0
1442	4	47	Laureate (Metallurgical Engineering)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Metallurgical Engineering Post 2024	Academicos	20
1443	4	48	Laureate (Textile Engineering)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Textile Engineering Post 2024	Academicos	0
1444	4	51	Laureate (Biological Sciences)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Biological Sciences Post 2024	Academicos	20
1445	4	52	Laureate (Human Biological Sciences)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Human Biological Sciences Post 2024	Academicos	20
1446	4	53	Laureate (Agricultural Sciences)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Agricultural Sciences Post 2024	Academicos	0
1447	4	54	Laureate (Veterinary Sciences)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Veterinary Sciences Post 2024	Academicos	0
1448	4	55	Laureate (Clinical Medicine)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Clinical Medicine Post 2024	Academicos	60
1449	4	56	Laureate (Public Health)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en PublNúmero de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica Health Post 2024	Academicos	0
1450	4	57	Laureate (Dentistry)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Dentistry Post 2024	Academicos	40
1451	4	58	Laureate (Nursing)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Nursing Post 2024	Academicos	40
1452	4	59	Laureate (Medical Technology)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Medical Technology Post 2024	Academicos	40
1453	4	60	Laureate (Pharmacy)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Pharmacy Post 2024	Academicos	0
1454	4	61	Laureate (Economics)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Economics Post 2024	Academicos	40
1455	4	62	Laureate (Statistics)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Statistics Post 2024	Academicos	40
1456	4	63	Laureate (Law)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Law Post 2024	Academicos	0
1457	4	64	Laureate (Political Sciences)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Political Sciences Post 2024	Academicos	60
1458	4	65	Laureate (Sociology)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Sociology Post 2024	Academicos	0
1459	4	66	Laureate (Education)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Education Post 2024	Academicos	0
1460	4	67	Laureate (Communication)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Communication Post 2024	Academicos	0
1461	4	68	Laureate (Psychology)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Psychology Post 2024	Academicos	40
1462	4	69	Laureate (Business Administration)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Business Administration Post 2024	Academicos	0
1463	4	70	Laureate (Finance)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Finance Post 2024	Academicos	0
1464	4	71	Laureate (Management)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Management Post 2024	Academicos	0
1465	4	72	Laureate (Public Administration)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en PublNúmero de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica Administration Post 2024	Academicos	40
1466	4	73	Laureate (Hospitality & Tourism Management)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Hospitality & Tourism Management Post 2024	Academicos	40
1467	4	74	Laureate (Library & Information Science)	Número de docentes de tiempo completo de una universidad que han ganado premios académicos internacionales de alto prestigio en una materia específica en Library & Information Science Post 2024	Academicos	20
1468	4	18	HCR (Mathematics)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Mathematics Post 2024	Academicos	0
1469	4	19	HCR (Physics)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Physics Post 2024	Academicos	60
1470	4	20	HCR (Chemistry)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Chemistry Post 2024	Academicos	60
1471	4	21	HCR (Earth Sciences)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Earth Sciences Post 2024	Academicos	40
1472	4	22	HCR (Geography)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Geography Post 2024	Academicos	20
1473	4	23	HCR (Ecology)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Ecology Post 2024	Academicos	40
1474	4	24	HCR (Oceanography)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Oceanography Post 2024	Academicos	0
1475	4	25	HCR (Atmospheric Science)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en AtmospherNúmero de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica Science Post 2024	Academicos	40
1476	4	26	HCR (Mechanical Engineering)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Mechanical Engineering Post 2024	Academicos	20
1477	4	27	HCR (Electrical Engineering)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Electrical Engineering Post 2024	Academicos	20
1478	4	28	HCR (Automation)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Automation Post 2024	Academicos	40
1479	4	29	HCR (Telecommunication Engineering)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Telecommunication Engineering Post 2024	Academicos	20
1480	4	30	HCR (Instrumentation)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Instrumentation Post 2024	Academicos	0
1481	4	31	HCR (Biomedical Engineering)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Biomedical Engineering Post 2024	Academicos	20
1482	4	32	HCR (Computer Science)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Computer Science Post 2024	Academicos	40
1483	4	33	HCR (Civil Engineering)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Civil Engineering Post 2024	Academicos	0
1484	4	34	HCR (Chemical Engineering)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Chemical Engineering Post 2024	Academicos	20
1485	4	35	HCR (Materials Science)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Materials Science Post 2024	Academicos	60
1486	4	36	HCR (Nanoscience)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Nanoscience Post 2024	Academicos	0
1487	4	37	HCR (Energy)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Energy Post 2024	Academicos	20
1488	4	38	HCR (Environmental Science)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Environmental Science Post 2024	Academicos	60
1489	4	39	HCR (Water Resources)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Water Resources Post 2024	Academicos	20
1490	4	40	HCR (Food Science)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Food Science Post 2024	Academicos	20
1491	4	41	HCR (Biotechnology)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Biotechnology Post 2024	Academicos	20
1492	4	42	HCR (Aerospace Engineering)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Aerospace Engineering Post 2024	Academicos	0
1493	4	43	HCR (Marine Engineering)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Marine Engineering Post 2024	Academicos	0
1494	4	44	HCR (Transportation)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Transportation Post 2024	Academicos	20
1495	4	45	HCR (Remote Sensing)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Remote Sensing Post 2024	Academicos	20
1496	4	46	HCR (Mining Engineering)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Mining Engineering Post 2024	Academicos	0
1497	4	47	HCR (Metallurgical Engineering)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Metallurgical Engineering Post 2024	Academicos	0
1498	4	48	HCR (Textile Engineering)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Textile Engineering Post 2024	Academicos	0
1499	4	51	HCR (Biological Sciences)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Biological Sciences Post 2024	Academicos	60
1500	4	52	HCR (Human Biological Sciences)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Human Biological Sciences Post 2024	Academicos	40
1501	4	53	HCR (Agricultural Sciences)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Agricultural Sciences Post 2024	Academicos	40
1502	4	54	HCR (Veterinary Sciences)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Veterinary Sciences Post 2024	Academicos	0
1503	4	55	HCR (Clinical Medicine)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Clinical Medicine Post 2024	Academicos	60
1504	4	56	HCR (Public Health)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en PublNúmero de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica Health Post 2024	Academicos	60
1505	4	57	HCR (Dentistry)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Dentistry Post 2024	Academicos	0
1506	4	58	HCR (Nursing)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Nursing Post 2024	Academicos	0
1507	4	59	HCR (Medical Technology)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Medical Technology Post 2024	Academicos	20
1508	4	60	HCR (Pharmacy)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Pharmacy Post 2024	Academicos	40
1509	4	61	HCR (Economics)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Economics Post 2024	Academicos	20
1510	4	62	HCR (Statistics)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Statistics Post 2024	Academicos	20
1511	4	63	HCR (Law)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Law Post 2024	Academicos	0
1512	4	64	HCR (Political Sciences)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Political Sciences Post 2024	Academicos	20
1513	4	65	HCR (Sociology)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Sociology Post 2024	Academicos	0
1514	4	66	HCR (Education)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Education Post 2024	Academicos	0
1515	4	67	HCR (Communication)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Communication Post 2024	Academicos	0
1516	4	68	HCR (Psychology)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Psychology Post 2024	Academicos	60
1517	4	69	HCR (Business Administration)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Business Administration Post 2024	Academicos	20
1518	4	70	HCR (Finance)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Finance Post 2024	Academicos	20
1519	4	71	HCR (Management)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Management Post 2024	Academicos	20
1520	4	72	HCR (Public Administration)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en PublNúmero de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica Administration Post 2024	Academicos	20
1521	4	73	HCR (Hospitality & Tourism Management)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Hospitality & Tourism Management Post 2024	Academicos	40
1522	4	74	HCR (Library & Information Science)	Número de investigadores de una universidad que se encuentran entre los más citados del mundo en su área académica en Library & Information Science Post 2024	Academicos	20
1523	4	18	Editor (Mathematics)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Mathematics Post 2024	Academicos	60
1524	4	19	Editor (Physics)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Physics Post 2024	Academicos	60
1525	4	20	Editor (Chemistry)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Chemistry Post 2024	Academicos	60
1526	4	21	Editor (Earth Sciences)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Earth Sciences Post 2024	Academicos	60
1527	4	22	Editor (Geography)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Geography Post 2024	Academicos	60
1528	4	23	Editor (Ecology)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Ecology Post 2024	Academicos	60
1529	4	24	Editor (Oceanography)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Oceanography Post 2024	Academicos	40
1530	4	25	Editor (Atmospheric Science)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en AtmospherNúmero de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio Science Post 2024	Academicos	40
1531	4	26	Editor (Mechanical Engineering)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Mechanical Engineering Post 2024	Academicos	60
1532	4	27	Editor (Electrical Engineering)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Electrical Engineering Post 2024	Academicos	40
1533	4	28	Editor (Automation)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Automation Post 2024	Academicos	60
1534	4	29	Editor (Telecommunication Engineering)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Telecommunication Engineering Post 2024	Academicos	20
1535	4	30	Editor (Instrumentation)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Instrumentation Post 2024	Academicos	20
1536	4	31	Editor (Biomedical Engineering)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Biomedical Engineering Post 2024	Academicos	60
1537	4	32	Editor (Computer Science)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Computer Science Post 2024	Academicos	40
1538	4	33	Editor (Civil Engineering)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Civil Engineering Post 2024	Academicos	60
1539	4	34	Editor (Chemical Engineering)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Chemical Engineering Post 2024	Academicos	40
1540	4	35	Editor (Materials Science)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Materials Science Post 2024	Academicos	60
1541	4	36	Editor (Nanoscience)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Nanoscience Post 2024	Academicos	40
1542	4	37	Editor (Energy)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Energy Post 2024	Academicos	60
1543	4	38	Editor (Environmental Science)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Environmental Science Post 2024	Academicos	60
1544	4	39	Editor (Water Resources)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Water Resources Post 2024	Academicos	60
1545	4	40	Editor (Food Science)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Food Science Post 2024	Academicos	40
1546	4	41	Editor (Biotechnology)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Biotechnology Post 2024	Academicos	60
1547	4	42	Editor (Aerospace Engineering)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Aerospace Engineering Post 2024	Academicos	40
1548	4	43	Editor (Marine Engineering)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Marine Engineering Post 2024	Academicos	20
1549	4	44	Editor (Transportation)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Transportation Post 2024	Academicos	20
1550	4	45	Editor (Remote Sensing)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Remote Sensing Post 2024	Academicos	20
1551	4	46	Editor (Mining Engineering)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Mining Engineering Post 2024	Academicos	40
1552	4	47	Editor (Metallurgical Engineering)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Metallurgical Engineering Post 2024	Academicos	40
1553	4	48	Editor (Textile Engineering)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Textile Engineering Post 2024	Academicos	40
1554	4	51	Editor (Biological Sciences)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Biological Sciences Post 2024	Academicos	60
1555	4	52	Editor (Human Biological Sciences)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Human Biological Sciences Post 2024	Academicos	60
1556	4	53	Editor (Agricultural Sciences)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Agricultural Sciences Post 2024	Academicos	60
1557	4	54	Editor (Veterinary Sciences)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Veterinary Sciences Post 2024	Academicos	60
1558	4	55	Editor (Clinical Medicine)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Clinical Medicine Post 2024	Academicos	60
1559	4	56	Editor (Public Health)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en PublNúmero de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio Health Post 2024	Academicos	60
1560	4	57	Editor (Dentistry)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Dentistry Post 2024	Academicos	40
1561	4	58	Editor (Nursing)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Nursing Post 2024	Academicos	40
1562	4	59	Editor (Medical Technology)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Medical Technology Post 2024	Academicos	60
1563	4	60	Editor (Pharmacy)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Pharmacy Post 2024	Academicos	60
1564	4	61	Editor (Economics)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Economics Post 2024	Academicos	60
1565	4	62	Editor (Statistics)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Statistics Post 2024	Academicos	40
1566	4	63	Editor (Law)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Law Post 2024	Academicos	60
1567	4	64	Editor (Political Sciences)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Political Sciences Post 2024	Academicos	60
1568	4	65	Editor (Sociology)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Sociology Post 2024	Academicos	60
1569	4	66	Editor (Education)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Education Post 2024	Academicos	60
1570	4	67	Editor (Communication)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Communication Post 2024	Academicos	60
1571	4	68	Editor (Psychology)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Psychology Post 2024	Academicos	60
1572	4	69	Editor (Business Administration)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Business Administration Post 2024	Academicos	60
1573	4	70	Editor (Finance)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Finance Post 2024	Academicos	40
1574	4	71	Editor (Management)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Management Post 2024	Academicos	60
1575	4	72	Editor (Public Administration)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en PublNúmero de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio Administration Post 2024	Academicos	40
1576	4	73	Editor (Hospitality & Tourism Management)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Hospitality & Tourism Management Post 2024	Academicos	40
1577	4	74	Editor (Library & Information Science)	Número de académicos de una universidad que actúan como editores en jefe (Chief Editors) de revistas académicas internacionales de alto prestigio en Library & Information Science Post 2024	Academicos	40
1578	4	18	World-Class Output (Mathematics)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Mathematics Post 2024	Articulos	100
1579	4	19	World-Class Output (Physics)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Physics Post 2024	Articulos	100
1580	4	20	World-Class Output (Chemistry)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Chemistry Post 2024	Articulos	100
1581	4	21	World-Class Output (Earth Sciences)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Earth Sciences Post 2024	Articulos	100
1582	4	22	World-Class Output (Geography)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Geography Post 2024	Articulos	100
1583	4	23	World-Class Output (Ecology)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Ecology Post 2024	Articulos	100
1584	4	24	World-Class Output (Oceanography)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Oceanography Post 2024	Articulos	100
1585	4	25	World-Class Output (Atmospheric Science)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en AtmospherNúmero de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  Science Post 2024	Articulos	100
1586	4	26	World-Class Output (Mechanical Engineering)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Mechanical Engineering Post 2024	Articulos	100
1587	4	27	World-Class Output (Electrical Engineering)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Electrical Engineering Post 2024	Articulos	100
1588	4	28	World-Class Output (Automation)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Automation Post 2024	Articulos	100
1589	4	29	World-Class Output (Telecommunication Engineering)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Telecommunication Engineering Post 2024	Articulos	100
1590	4	30	World-Class Output (Instrumentation)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Instrumentation Post 2024	Articulos	100
1591	4	31	World-Class Output (Biomedical Engineering)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Biomedical Engineering Post 2024	Articulos	100
1592	4	32	World-Class Output (Computer Science)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Computer Science Post 2024	Articulos	100
1593	4	33	World-Class Output (Civil Engineering)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Civil Engineering Post 2024	Articulos	100
1594	4	34	World-Class Output (Chemical Engineering)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Chemical Engineering Post 2024	Articulos	100
1595	4	35	World-Class Output (Materials Science)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Materials Science Post 2024	Articulos	100
1596	4	36	World-Class Output (Nanoscience)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Nanoscience Post 2024	Articulos	100
1597	4	37	World-Class Output (Energy)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Energy Post 2024	Articulos	100
1598	4	38	World-Class Output (Environmental Science)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Environmental Science Post 2024	Articulos	100
1599	4	39	World-Class Output (Water Resources)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Water Resources Post 2024	Articulos	100
1600	4	40	World-Class Output (Food Science)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Food Science Post 2024	Articulos	100
1601	4	41	World-Class Output (Biotechnology)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Biotechnology Post 2024	Articulos	100
1602	4	42	World-Class Output (Aerospace Engineering)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Aerospace Engineering Post 2024	Articulos	100
1603	4	43	World-Class Output (Marine Engineering)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Marine Engineering Post 2024	Articulos	100
1604	4	44	World-Class Output (Transportation)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Transportation Post 2024	Articulos	100
1605	4	45	World-Class Output (Remote Sensing)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Remote Sensing Post 2024	Articulos	100
1606	4	46	World-Class Output (Mining Engineering)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Mining Engineering Post 2024	Articulos	100
1607	4	47	World-Class Output (Metallurgical Engineering)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Metallurgical Engineering Post 2024	Articulos	100
1608	4	48	World-Class Output (Textile Engineering)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Textile Engineering Post 2024	Articulos	100
1609	4	51	World-Class Output (Biological Sciences)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Biological Sciences Post 2024	Articulos	100
1610	4	52	World-Class Output (Human Biological Sciences)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Human Biological Sciences Post 2024	Articulos	100
1611	4	53	World-Class Output (Agricultural Sciences)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Agricultural Sciences Post 2024	Articulos	100
1612	4	54	World-Class Output (Veterinary Sciences)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Veterinary Sciences Post 2024	Articulos	100
1613	4	55	World-Class Output (Clinical Medicine)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Clinical Medicine Post 2024	Articulos	100
1614	4	56	World-Class Output (Public Health)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en PublNúmero de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  Health Post 2024	Articulos	100
1615	4	57	World-Class Output (Dentistry)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Dentistry Post 2024	Articulos	100
1616	4	58	World-Class Output (Nursing)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Nursing Post 2024	Articulos	100
1617	4	59	World-Class Output (Medical Technology)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Medical Technology Post 2024	Articulos	100
1618	4	60	World-Class Output (Pharmacy)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Pharmacy Post 2024	Articulos	100
1619	4	61	World-Class Output (Economics)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Economics Post 2024	Articulos	100
1620	4	62	World-Class Output (Statistics)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Statistics Post 2024	Articulos	100
1621	4	63	World-Class Output (Law)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Law Post 2024	Articulos	100
1622	4	64	World-Class Output (Political Sciences)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Political Sciences Post 2024	Articulos	100
1623	4	65	World-Class Output (Sociology)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Sociology Post 2024	Articulos	100
1624	4	66	World-Class Output (Education)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Education Post 2024	Articulos	100
1625	4	67	World-Class Output (Communication)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Communication Post 2024	Articulos	100
1626	4	68	World-Class Output (Psychology)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Psychology Post 2024	Articulos	100
1627	4	69	World-Class Output (Business Administration)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Business Administration Post 2024	Articulos	100
1628	4	70	World-Class Output (Finance)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Finance Post 2024	Articulos	100
1629	4	71	World-Class Output (Management)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Management Post 2024	Articulos	100
1630	4	72	World-Class Output (Public Administration)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en PublNúmero de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  Administration Post 2024	Articulos	100
1631	4	73	World-Class Output (Hospitality & Tourism Management)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Hospitality & Tourism Management Post 2024	Articulos	100
1632	4	74	World-Class Output (Library & Information Science)	Número de artículos publicados en las revistas más prestigiosas de cada materia (Q1) y el impacto de las citas recibidas  en Library & Information Science Post 2024	Articulos	100
1633	4	18	World-Class Faculty (Mathematics)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Mathematics Post 2024	Reputacion	100
1634	4	19	World-Class Faculty (Physics)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Physics Post 2024	Reputacion	100
1635	4	20	World-Class Faculty (Chemistry)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Chemistry Post 2024	Reputacion	100
1636	4	21	World-Class Faculty (Earth Sciences)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Earth Sciences Post 2024	Reputacion	100
1637	4	22	World-Class Faculty (Geography)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Geography Post 2024	Reputacion	100
1638	4	23	World-Class Faculty (Ecology)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Ecology Post 2024	Reputacion	100
1639	4	24	World-Class Faculty (Oceanography)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Oceanography Post 2024	Reputacion	100
1640	4	25	World-Class Faculty (Atmospheric Science)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en AtmospherEvalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  Science Post 2024	Reputacion	100
1641	4	26	World-Class Faculty (Mechanical Engineering)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Mechanical Engineering Post 2024	Reputacion	100
1642	4	27	World-Class Faculty (Electrical Engineering)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Electrical Engineering Post 2024	Reputacion	100
1643	4	28	World-Class Faculty (Automation)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Automation Post 2024	Reputacion	100
1644	4	29	World-Class Faculty (Telecommunication Engineering)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Telecommunication Engineering Post 2024	Reputacion	100
1645	4	30	World-Class Faculty (Instrumentation)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Instrumentation Post 2024	Reputacion	100
1646	4	31	World-Class Faculty (Biomedical Engineering)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Biomedical Engineering Post 2024	Reputacion	100
1647	4	32	World-Class Faculty (Computer Science)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Computer Science Post 2024	Reputacion	100
1648	4	33	World-Class Faculty (Civil Engineering)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Civil Engineering Post 2024	Reputacion	100
1649	4	34	World-Class Faculty (Chemical Engineering)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Chemical Engineering Post 2024	Reputacion	100
1650	4	35	World-Class Faculty (Materials Science)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Materials Science Post 2024	Reputacion	100
1651	4	36	World-Class Faculty (Nanoscience)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Nanoscience Post 2024	Reputacion	100
1652	4	37	World-Class Faculty (Energy)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Energy Post 2024	Reputacion	100
1653	4	38	World-Class Faculty (Environmental Science)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Environmental Science Post 2024	Reputacion	100
1654	4	39	World-Class Faculty (Water Resources)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Water Resources Post 2024	Reputacion	100
1655	4	40	World-Class Faculty (Food Science)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Food Science Post 2024	Reputacion	100
1656	4	41	World-Class Faculty (Biotechnology)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Biotechnology Post 2024	Reputacion	100
1657	4	42	World-Class Faculty (Aerospace Engineering)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Aerospace Engineering Post 2024	Reputacion	100
1658	4	43	World-Class Faculty (Marine Engineering)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Marine Engineering Post 2024	Reputacion	100
1659	4	44	World-Class Faculty (Transportation)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Transportation Post 2024	Reputacion	100
1660	4	45	World-Class Faculty (Remote Sensing)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Remote Sensing Post 2024	Reputacion	100
1661	4	46	World-Class Faculty (Mining Engineering)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Mining Engineering Post 2024	Reputacion	100
1662	4	47	World-Class Faculty (Metallurgical Engineering)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Metallurgical Engineering Post 2024	Reputacion	100
1663	4	48	World-Class Faculty (Textile Engineering)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Textile Engineering Post 2024	Reputacion	100
1664	4	51	World-Class Faculty (Biological Sciences)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Biological Sciences Post 2024	Reputacion	100
1665	4	52	World-Class Faculty (Human Biological Sciences)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Human Biological Sciences Post 2024	Reputacion	100
1666	4	53	World-Class Faculty (Agricultural Sciences)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Agricultural Sciences Post 2024	Reputacion	100
1667	4	54	World-Class Faculty (Veterinary Sciences)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Veterinary Sciences Post 2024	Reputacion	100
1668	4	55	World-Class Faculty (Clinical Medicine)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Clinical Medicine Post 2024	Reputacion	100
1669	4	56	World-Class Faculty (Public Health)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en PublEvalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  Health Post 2024	Reputacion	100
1670	4	57	World-Class Faculty (Dentistry)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Dentistry Post 2024	Reputacion	100
1671	4	58	World-Class Faculty (Nursing)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Nursing Post 2024	Reputacion	100
1672	4	59	World-Class Faculty (Medical Technology)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Medical Technology Post 2024	Reputacion	100
1673	4	60	World-Class Faculty (Pharmacy)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Pharmacy Post 2024	Reputacion	100
1674	4	61	World-Class Faculty (Economics)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Economics Post 2024	Reputacion	100
1675	4	62	World-Class Faculty (Statistics)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Statistics Post 2024	Reputacion	100
1676	4	63	World-Class Faculty (Law)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Law Post 2024	Reputacion	100
1677	4	64	World-Class Faculty (Political Sciences)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Political Sciences Post 2024	Reputacion	100
1678	4	65	World-Class Faculty (Sociology)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Sociology Post 2024	Reputacion	100
1679	4	66	World-Class Faculty (Education)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Education Post 2024	Reputacion	100
1680	4	67	World-Class Faculty (Communication)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Communication Post 2024	Reputacion	100
1681	4	68	World-Class Faculty (Psychology)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Psychology Post 2024	Reputacion	100
1682	4	69	World-Class Faculty (Business Administration)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Business Administration Post 2024	Reputacion	100
1683	4	70	World-Class Faculty (Finance)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Finance Post 2024	Reputacion	100
1684	4	71	World-Class Faculty (Management)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Management Post 2024	Reputacion	100
1685	4	72	World-Class Faculty (Public Administration)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en PublEvalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  Administration Post 2024	Reputacion	100
1686	4	73	World-Class Faculty (Hospitality & Tourism Management)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Hospitality & Tourism Management Post 2024	Reputacion	100
1687	4	74	World-Class Faculty (Library & Information Science)	Evalúa la calidad de la plantilla mediante cuatro indicadores objetivos: investigadores altamente citados (HCR), ganadores de premios académicos internacionales (Laureate), editores en jefe de revistas académicas y liderazgo en organizaciones académicas  en Library & Information Science Post 2024	Reputacion	100
1688	2	\N	Student mix domestic	Estudiantes totales vs. población de la ciudad.	Alumnado	0
1689	2	\N	Student mix international	Porcentaje y volumen de extranjeros.	Alumnado	0
1690	3	3	Plumx	PlumX es un conjunto de métricas alternativas integradas en Scopus y el entorno SCImago que miden el impacto académico y social de una investigación en tiempo real. Se visualizan mediante una flor de cinco colores, donde cada pétalo representa una dimensión específica: Uso (clics/descargas), Capturas (marcadores/Mendeley), Menciones (blogs/noticias), Redes Sociales (interacciones) y Citaciones (tradicionales y patentes).	Impacto Social	2.1
1691	3	3	Mendeley	Mide el impacto social y el interés académico temprano de un artículo, contabilizando cuántos usuarios lo han guardado, leído o anotado en su gestor de referencias a través de Scopus. No es una cita formal, sino un indicador de altmetrics sobre el uso y atención del investigador.	Impacto Social	0.9
1694	1	6	Research Quality	Sub-Ranking de THE, usar esta métrica como referencia del cálculo de las métricas que componen este sub-ranking	Articulos	30
1695	1	7	Industry	Sub-Ranking de THE, usar esta métrica como referencia del cálculo de las métricas que componen este sub-ranking	Financiero	0
1696	1	8	International Outlook	Sub-Ranking de THE, usar esta métrica como referencia del cálculo de las métricas que componen este sub-ranking	Internacional	10
1692	1	4	Teaching	Sub-Ranking de THE, usar esta métrica como referencia del cálculo de las métricas que componen este sub-ranking	Academicos	30
1693	1	5	Research Environment	Sub-Ranking de THE, usar esta métrica como referencia del cálculo de las métricas que componen este sub-ranking	Reputacion	30
34	3	1	Scientific Leadership	Artículos con autor correspondiente institucional	Investigacion	5
29	3	1	Output in External Journals	Documentos en revistas externas	Articulos	3
32	3	1	Number of Q1 Articles	Publicaciones en revistas Q1	Articulos	2
33	3	1	Excellence	Producción en top 10% más citado	Articulos	2
\.


--
-- Data for Name: metrica_universidad; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.metrica_universidad (id_metrica, id_universidad, valor_metrica, anio_metrica) FROM stdin;
614	22	45.4	2017
614	1	33.5	2017
614	55	27.0	2017
614	32	28.9	2017
619	1	38.1	2017
619	55	28.2	2017
619	22	30.8	2017
629	22	44.4	2017
629	24	27.3	2017
639	1	44.9	2017
658	55	20.8	2017
658	22	20.1	2017
658	24	18.0	2017
662	55	34.2	2017
670	55	30.7	2017
678	22	36.8	2017
682	1	37.5	2017
682	22	25.8	2017
710	22	38.1	2017
710	1	31.8	2017
726	1	44.2	2017
726	22	35.7	2017
754	22	26.6	2017
754	1	21.2	2017
759	1	17.8	2017
759	22	20.4	2017
764	8	33.8	2017
764	22	36.2	2017
764	1	29.8	2017
764	24	39.2	2017
769	8	31.4	2017
774	1	18.1	2017
774	22	18.4	2017
779	1	19.4	2017
779	22	24.4	2017
784	22	28.1	2017
799	22	29.8	2017
804	1	34.0	2017
804	22	37.2	2017
808	1	37.5	2017
844	22	39.5	2017
844	1	28.6	2017
615	22	63.0	2017
615	1	55.8	2017
615	55	66.7	2017
615	32	56.8	2017
620	1	55.7	2017
620	55	58.0	2017
620	22	45.5	2017
630	22	64.4	2017
630	24	65.3	2017
640	1	53.0	2017
659	55	79.7	2017
659	22	52.1	2017
659	24	58.1	2017
663	55	81.7	2017
671	55	91.0	2017
679	22	53.9	2017
683	1	35.3	2017
683	22	38.0	2017
711	22	70.1	2017
711	1	72.3	2017
727	1	50.0	2017
727	22	67.9	2017
755	22	39.4	2017
755	1	40.5	2017
760	1	63.9	2017
760	22	57.0	2017
765	8	54.7	2017
765	22	53.4	2017
765	1	55.0	2017
765	24	46.3	2017
770	8	64.7	2017
775	1	58.8	2017
775	22	56.0	2017
780	1	36.4	2017
780	22	23.5	2017
785	22	75.9	2017
800	22	53.5	2017
805	1	55.7	2017
805	22	47.8	2017
809	1	35.0	2017
845	22	47.7	2017
845	1	54.6	2017
616	22	81.0	2017
616	1	79.7	2017
616	55	81.4	2017
616	32	78.6	2017
621	1	95.3	2017
621	55	93.9	2017
621	22	89.5	2017
631	22	91.7	2017
631	24	94.7	2017
641	1	79.5	2017
660	55	87.9	2017
660	22	78.3	2017
660	24	81.0	2017
664	55	86.5	2017
672	55	94.6	2017
680	22	84.9	2017
684	1	80.5	2017
684	22	80.7	2017
712	22	65.8	2017
712	1	69.2	2017
728	1	82.1	2017
728	22	86.8	2017
756	22	76.1	2017
756	1	79.7	2017
761	1	76.7	2017
761	22	73.6	2017
766	8	78.2	2017
766	22	73.8	2017
766	1	70.6	2017
766	24	70.5	2017
771	8	77.2	2017
776	1	70.8	2017
776	22	68.4	2017
781	1	65.3	2017
781	22	64.2	2017
786	22	85.0	2017
801	22	76.1	2017
806	1	75.4	2017
806	22	79.1	2017
810	1	86.5	2017
846	22	86.9	2017
846	1	80.5	2017
617	22	19.6	2017
617	1	19.6	2017
617	55	0.0	2017
617	32	0.0	2017
622	1	28.9	2017
622	55	29.1	2017
622	22	15.4	2017
632	22	30.9	2017
632	24	20.3	2017
642	1	32.1	2017
661	55	15.2	2017
661	22	15.2	2017
661	24	0.0	2017
665	55	30.7	2017
673	55	35.9	2017
681	22	89.4	2017
685	1	24.3	2017
685	22	17.1	2017
713	22	31.1	2017
713	1	33.7	2017
729	1	49.8	2017
729	22	43.4	2017
757	22	7.9	2017
757	1	5.6	2017
762	1	14.5	2017
762	22	12.7	2017
767	8	21.5	2017
767	22	25.3	2017
767	1	21.8	2017
767	24	24.8	2017
772	8	16.6	2017
777	1	15.4	2017
777	22	14.2	2017
782	1	12.0	2017
782	22	13.9	2017
787	22	27.2	2017
802	22	0.0	2017
807	1	6.8	2017
807	22	11.8	2017
811	1	22.0	2017
847	22	19.0	2017
847	1	17.0	2017
765	1	57.0	2018
755	1	43.2	2018
683	1	32.9	2018
775	1	66.7	2018
630	1	59.1	2018
640	1	58.0	2018
805	1	55.3	2018
825	1	58.6	2018
703	1	68.8	2018
711	1	73.4	2018
760	1	61.6	2018
845	1	55.4	2018
615	1	54.4	2018
620	1	68.1	2018
817	1	54.8	2018
833	1	59.6	2018
780	1	47.3	2018
809	1	40.0	2018
727	1	53.0	2018
766	1	73.3	2018
756	1	81.8	2018
684	1	78.4	2018
776	1	74.4	2018
631	1	89.5	2018
641	1	82.6	2018
806	1	79.1	2018
826	1	83.4	2018
704	1	91.1	2018
712	1	71.8	2018
761	1	78.0	2018
846	1	82.3	2018
616	1	80.6	2018
621	1	95.4	2018
818	1	78.2	2018
834	1	75.7	2018
781	1	69.2	2018
810	1	85.8	2018
728	1	70.2	2018
764	1	30.1	2018
754	1	21.7	2018
682	1	35.0	2018
774	1	16.6	2018
629	1	22.9	2018
639	1	44.4	2018
804	1	34.8	2018
824	1	32.8	2018
702	1	30.7	2018
710	1	30.4	2018
759	1	17.6	2018
844	1	31.2	2018
614	1	32.6	2018
619	1	39.6	2018
816	1	26.8	2018
832	1	26.5	2018
779	1	18.7	2018
808	1	37.7	2018
726	1	44.8	2018
767	1	22.8	2018
757	1	4.9	2018
685	1	15.4	2018
777	1	13.5	2018
632	1	11.5	2018
642	1	15.4	2018
807	1	9.5	2018
827	1	0.0	2018
705	1	5.9	2018
713	1	32.9	2018
762	1	13.0	2018
847	1	15.4	2018
617	1	15.8	2018
622	1	31.1	2018
819	1	0.0	2018
835	1	11.2	2018
782	1	9.6	2018
811	1	21.1	2018
729	1	34.5	2018
845	4	61.6	2018
846	4	83.9	2018
844	4	26.5	2018
847	4	12.6	2018
765	8	57.9	2018
640	8	54.6	2018
770	8	67.6	2018
766	8	80.6	2018
641	8	81.7	2018
771	8	76.2	2018
764	8	33.9	2018
639	8	42.5	2018
769	8	32.3	2018
767	8	23.5	2018
642	8	15.4	2018
772	8	26.2	2018
765	22	57.6	2018
650	22	53.4	2018
755	22	43.2	2018
715	22	41.4	2018
837	22	50.6	2018
775	22	61.3	2018
679	22	46.9	2018
785	22	73.9	2018
630	22	62.2	2018
640	22	57.1	2018
805	22	49.6	2018
825	22	64.6	2018
659	22	67.1	2018
703	22	56.6	2018
711	22	68.6	2018
760	22	56.7	2018
845	22	52.2	2018
615	22	63.7	2018
735	22	53.0	2018
800	22	56.0	2018
620	22	58.3	2018
817	22	32.0	2018
780	22	31.4	2018
727	22	70.5	2018
770	22	60.3	2018
766	22	76.7	2018
651	22	81.8	2018
756	22	77.0	2018
716	22	71.9	2018
838	22	68.1	2018
776	22	71.9	2018
680	22	82.7	2018
786	22	87.4	2018
631	22	90.4	2018
641	22	76.9	2018
806	22	80.1	2018
826	22	80.6	2018
660	22	80.0	2018
704	22	80.0	2018
712	22	68.3	2018
761	22	75.2	2018
846	22	84.8	2018
616	22	82.6	2018
736	22	67.0	2018
801	22	75.2	2018
621	22	90.1	2018
818	22	56.2	2018
781	22	66.8	2018
728	22	78.6	2018
771	22	78.9	2018
764	22	36.0	2018
649	22	22.8	2018
754	22	27.7	2018
714	22	33.0	2018
836	22	34.8	2018
774	22	17.9	2018
678	22	37.9	2018
784	22	30.4	2018
629	22	44.4	2018
639	22	43.6	2018
804	22	36.8	2018
824	22	23.0	2018
658	22	20.5	2018
702	22	30.2	2018
710	22	36.6	2018
759	22	21.0	2018
844	22	42.6	2018
614	22	45.2	2018
734	22	34.2	2018
799	22	28.9	2018
619	22	32.5	2018
816	22	23.6	2018
779	22	23.8	2018
726	22	36.9	2018
769	22	25.1	2018
767	22	26.7	2018
652	22	21.1	2018
757	22	6.9	2018
717	22	18.5	2018
839	22	14.4	2018
777	22	17.5	2018
681	22	7.7	2018
787	22	35.4	2018
632	22	28.6	2018
642	22	15.4	2018
807	22	11.7	2018
827	22	0.0	2018
661	22	0.0	2018
705	22	8.4	2018
713	22	30.1	2018
762	22	13.0	2018
847	22	17.8	2018
617	22	0.0	2018
737	22	41.4	2018
802	22	0.0	2018
622	22	16.0	2018
819	22	18.6	2018
782	22	9.6	2018
729	22	39.4	2018
772	22	26.2	2018
765	24	47.4	2018
687	24	49.7	2018
630	24	57.6	2018
640	24	58.3	2018
703	24	57.6	2018
615	24	53.1	2018
735	24	45.6	2018
645	24	59.6	2018
770	24	57.9	2018
766	24	73.5	2018
688	24	90.1	2018
631	24	93.4	2018
641	24	77.2	2018
704	24	81.0	2018
616	24	89.1	2018
736	24	68.5	2018
646	24	73.3	2018
771	24	67.0	2018
764	24	39.2	2018
686	24	26.6	2018
629	24	27.2	2018
639	24	43.6	2018
702	24	34.3	2018
614	24	29.7	2018
734	24	25.9	2018
644	24	40.2	2018
769	24	20.7	2018
767	24	23.8	2018
689	24	12.1	2018
632	24	17.5	2018
642	24	26.7	2018
705	24	11.8	2018
617	24	15.8	2018
737	24	21.5	2018
647	24	27.9	2018
772	24	14.0	2018
775	25	70.9	2018
776	25	81.5	2018
774	25	6.9	2018
777	25	11.2	2018
817	41	36.6	2018
818	41	64.6	2018
816	41	22.2	2018
819	41	0.0	2018
663	55	65.5	2018
659	55	96.5	2018
615	55	67.4	2018
735	55	46.5	2018
620	55	70.0	2018
664	55	85.8	2018
660	55	86.7	2018
616	55	82.7	2018
736	55	62.3	2018
621	55	94.1	2018
662	55	31.4	2018
658	55	19.7	2018
614	55	27.2	2018
734	55	26.9	2018
619	55	29.1	2018
665	55	33.8	2018
661	55	20.4	2018
617	55	0.0	2018
737	55	40.6	2018
622	55	32.1	2018
765	1	65.9	2019
683	1	60.3	2019
775	1	73.1	2019
829	1	61.8	2019
630	1	65.5	2019
640	1	59.8	2019
805	1	69.4	2019
825	1	74.6	2019
703	1	64.6	2019
711	1	68.3	2019
635	1	58.9	2019
760	1	70.2	2019
813	1	34.7	2019
845	1	63.0	2019
615	1	70.4	2019
795	1	69.0	2019
645	1	72.0	2019
620	1	81.2	2019
817	1	58.9	2019
833	1	61.2	2019
780	1	51.4	2019
809	1	55.9	2019
727	1	54.5	2019
766	1	73.6	2019
684	1	77.5	2019
776	1	75.8	2019
830	1	59.6	2019
631	1	88.9	2019
641	1	83.9	2019
806	1	81.6	2019
826	1	84.8	2019
704	1	90.4	2019
712	1	74.0	2019
636	1	69.1	2019
761	1	78.7	2019
814	1	41.1	2019
846	1	82.3	2019
616	1	81.7	2019
796	1	100.0	2019
646	1	77.9	2019
621	1	96.3	2019
818	1	69.9	2019
834	1	77.1	2019
781	1	72.4	2019
810	1	89.0	2019
728	1	73.3	2019
764	1	31.0	2019
682	1	31.2	2019
774	1	16.9	2019
828	1	28.0	2019
629	1	24.9	2019
639	1	44.6	2019
804	1	34.7	2019
824	1	36.4	2019
702	1	31.3	2019
710	1	27.4	2019
634	1	40.4	2019
759	1	17.8	2019
812	1	26.9	2019
844	1	33.4	2019
614	1	33.2	2019
794	1	15.2	2019
644	1	22.3	2019
619	1	40.2	2019
816	1	26.8	2019
832	1	27.3	2019
779	1	19.0	2019
808	1	37.6	2019
726	1	43.7	2019
767	1	24.5	2019
685	1	14.0	2019
777	1	16.0	2019
831	1	18.7	2019
632	1	13.0	2019
642	1	15.8	2019
807	1	11.5	2019
827	1	23.6	2019
705	1	6.1	2019
713	1	26.5	2019
637	1	36.9	2019
762	1	13.9	2019
815	1	0.0	2019
847	1	17.3	2019
617	1	16.7	2019
797	1	17.2	2019
647	1	9.5	2019
622	1	28.6	2019
819	1	0.0	2019
835	1	15.7	2019
782	1	7.0	2019
811	1	22.4	2019
729	1	37.5	2019
845	4	70.3	2019
846	4	83.1	2019
844	4	26.7	2019
847	4	12.2	2019
765	8	64.4	2019
630	8	79.5	2019
640	8	58.5	2019
645	8	70.5	2019
770	8	72.8	2019
766	8	80.1	2019
631	8	95.4	2019
641	8	84.3	2019
646	8	75.3	2019
771	8	75.7	2019
764	8	34.3	2019
629	8	19.5	2019
639	8	42.6	2019
644	8	23.4	2019
769	8	31.6	2019
767	8	24.1	2019
632	8	13.0	2019
642	8	15.8	2019
647	8	12.5	2019
772	8	26.7	2019
640	16	57.8	2019
641	16	76.8	2019
639	16	28.0	2019
642	16	0.0	2019
765	22	64.8	2019
650	22	62.5	2019
755	22	65.2	2019
715	22	60.2	2019
837	22	63.1	2019
775	22	64.6	2019
679	22	61.7	2019
785	22	80.6	2019
630	22	71.4	2019
640	22	55.8	2019
805	22	64.7	2019
825	22	75.5	2019
659	22	81.3	2019
711	22	70.0	2019
635	22	61.1	2019
760	22	64.5	2019
845	22	67.1	2019
615	22	76.9	2019
735	22	61.8	2019
800	22	71.2	2019
620	22	72.4	2019
817	22	33.3	2019
780	22	48.8	2019
727	22	71.9	2019
770	22	63.9	2019
766	22	75.4	2019
651	22	84.0	2019
756	22	77.6	2019
716	22	73.7	2019
838	22	71.2	2019
776	22	72.9	2019
680	22	80.8	2019
786	22	86.8	2019
631	22	91.8	2019
641	22	79.0	2019
806	22	79.4	2019
826	22	75.6	2019
660	22	82.1	2019
712	22	71.0	2019
636	22	82.3	2019
761	22	75.7	2019
846	22	81.8	2019
616	22	82.6	2019
736	22	63.6	2019
801	22	75.5	2019
621	22	90.7	2019
818	22	63.7	2019
781	22	70.2	2019
728	22	78.1	2019
771	22	77.2	2019
764	22	36.0	2019
649	22	24.1	2019
754	22	28.2	2019
714	22	33.9	2019
836	22	34.5	2019
774	22	17.8	2019
678	22	37.2	2019
784	22	32.4	2019
629	22	44.5	2019
639	22	45.7	2019
804	22	36.0	2019
824	22	25.4	2019
658	22	20.5	2019
710	22	35.2	2019
634	22	40.8	2019
759	22	21.7	2019
844	22	43.9	2019
614	22	44.5	2019
734	22	37.9	2019
799	22	28.9	2019
619	22	33.9	2019
816	22	21.5	2019
779	22	24.3	2019
726	22	35.1	2019
769	22	26.3	2019
767	22	27.5	2019
652	22	14.0	2019
757	22	4.9	2019
717	22	16.3	2019
839	22	15.6	2019
777	22	17.7	2019
681	22	8.8	2019
787	22	40.8	2019
632	22	28.2	2019
642	22	15.8	2019
807	22	9.4	2019
827	22	13.6	2019
661	22	0.0	2019
713	22	30.6	2019
637	22	36.9	2019
762	22	13.9	2019
847	22	17.3	2019
617	22	16.7	2019
737	22	45.2	2019
802	22	21.8	2019
622	22	15.7	2019
819	22	13.2	2019
782	22	12.1	2019
729	22	40.4	2019
772	22	28.6	2019
765	24	56.7	2019
687	24	64.6	2019
630	24	65.8	2019
640	24	64.1	2019
703	24	56.6	2019
615	24	71.9	2019
735	24	58.9	2019
645	24	60.1	2019
770	24	71.0	2019
766	24	72.9	2019
688	24	89.9	2019
631	24	93.9	2019
641	24	81.1	2019
704	24	83.1	2019
616	24	88.1	2019
736	24	64.5	2019
646	24	75.3	2019
771	24	69.3	2019
764	24	39.5	2019
686	24	25.6	2019
629	24	26.2	2019
639	24	45.0	2019
702	24	33.6	2019
614	24	29.7	2019
734	24	27.1	2019
644	24	37.4	2019
769	24	21.5	2019
767	24	25.2	2019
689	24	14.2	2019
632	24	14.2	2019
642	24	27.4	2019
705	24	13.7	2019
617	24	16.7	2019
737	24	25.4	2019
647	24	26.8	2019
772	24	14.3	2019
775	38	100.0	2019
776	38	80.7	2019
774	38	8.5	2019
777	38	12.5	2019
817	41	61.8	2019
818	41	69.1	2019
816	41	22.9	2019
819	41	0.0	2019
663	55	78.1	2019
659	55	100.0	2019
615	55	83.3	2019
735	55	51.4	2019
620	55	80.3	2019
664	55	87.0	2019
660	55	88.3	2019
616	55	85.2	2019
736	55	62.0	2019
621	55	94.3	2019
662	55	29.7	2019
658	55	19.3	2019
614	55	26.9	2019
734	55	25.7	2019
619	55	29.1	2019
665	55	36.9	2019
661	55	22.9	2019
617	55	0.0	2019
737	55	36.7	2019
622	55	30.2	2019
765	1	64.9	2020
755	1	68.3	2020
683	1	62.4	2020
775	1	81.9	2020
829	1	81.4	2020
630	1	67.5	2020
640	1	58.2	2020
805	1	63.2	2020
825	1	74.8	2020
703	1	64.1	2020
711	1	68.5	2020
635	1	62.5	2020
760	1	68.4	2020
845	1	65.2	2020
615	1	67.3	2020
795	1	71.8	2020
620	1	81.4	2020
817	1	70.3	2020
833	1	61.2	2020
727	1	57.0	2020
766	1	76.8	2020
756	1	82.0	2020
684	1	80.5	2020
776	1	77.6	2020
830	1	73.5	2020
631	1	87.3	2020
641	1	85.1	2020
806	1	82.1	2020
826	1	80.1	2020
704	1	89.6	2020
712	1	75.2	2020
636	1	71.0	2020
761	1	78.5	2020
846	1	81.7	2020
616	1	82.2	2020
796	1	100.0	2020
621	1	96.2	2020
818	1	73.9	2020
834	1	82.6	2020
728	1	74.9	2020
891	1	25.4	2020
889	1	17.9	2020
871	1	31.1	2020
893	1	13.0	2020
905	1	19.9	2020
859	1	23.4	2020
861	1	33.8	2020
899	1	34.3	2020
904	1	31.7	2020
876	1	27.5	2020
878	1	24.2	2020
860	1	31.8	2020
890	1	14.9	2020
909	1	37.2	2020
856	1	41.6	2020
897	1	17.0	2020
857	1	45.6	2020
902	1	23.2	2020
906	1	18.9	2020
882	1	39.1	2020
767	1	\N	2020
757	1	6.8	2020
685	1	14.0	2020
777	1	16.6	2020
831	1	23.1	2020
632	1	13.2	2020
642	1	17.4	2020
807	1	11.5	2020
827	1	27.2	2020
705	1	9.0	2020
713	1	\N	2020
637	1	27.1	2020
762	1	7.7	2020
847	1	22.4	2020
617	1	16.9	2020
797	1	\N	2020
622	1	28.9	2020
819	1	0.0	2020
835	1	24.1	2020
729	1	\N	2020
837	4	81.9	2020
845	4	66.1	2020
838	4	84.0	2020
846	4	81.7	2020
907	4	29.9	2020
909	4	30.5	2020
839	4	0.0	2020
847	4	7.9	2020
765	8	66.2	2020
630	8	78.4	2020
640	8	56.8	2020
770	8	73.6	2020
766	8	80.1	2020
631	8	95.6	2020
641	8	86.0	2020
771	8	71.3	2020
891	8	25.8	2020
859	8	23.4	2020
861	8	31.8	2020
892	8	34.4	2020
767	8	\N	2020
632	8	12.5	2020
642	8	17.4	2020
772	8	24.7	2020
630	16	62.6	2020
640	16	63.2	2020
735	16	72.5	2020
631	16	95.1	2020
641	16	80.1	2020
736	16	79.6	2020
859	16	18.6	2020
861	16	21.1	2020
884	16	22.1	2020
632	16	11.9	2020
642	16	0.0	2020
737	16	15.9	2020
765	22	64.1	2020
650	22	66.0	2020
755	22	66.2	2020
715	22	64.1	2020
837	22	59.5	2020
683	22	65.9	2020
775	22	63.4	2020
679	22	67.3	2020
785	22	79.0	2020
630	22	70.6	2020
640	22	57.0	2020
805	22	61.9	2020
825	22	73.3	2020
659	22	79.6	2020
711	22	69.5	2020
635	22	67.4	2020
760	22	64.1	2020
845	22	67.9	2020
615	22	76.0	2020
735	22	60.9	2020
620	22	72.6	2020
817	22	38.4	2020
780	22	51.7	2020
727	22	68.9	2020
770	22	66.7	2020
766	22	74.9	2020
651	22	83.8	2020
756	22	78.1	2020
716	22	75.0	2020
838	22	71.6	2020
684	22	76.2	2020
776	22	73.9	2020
680	22	82.6	2020
786	22	88.2	2020
631	22	90.6	2020
641	22	80.8	2020
806	22	81.1	2020
826	22	74.0	2020
660	22	84.0	2020
712	22	68.8	2020
636	22	84.9	2020
761	22	77.6	2020
846	22	81.3	2020
616	22	83.5	2020
736	22	64.2	2020
621	22	90.6	2020
818	22	74.7	2020
781	22	71.7	2020
728	22	75.6	2020
771	22	74.6	2020
891	22	29.0	2020
863	22	22.2	2020
889	22	21.3	2020
879	22	27.7	2020
907	22	25.6	2020
871	22	25.5	2020
893	22	12.7	2020
870	22	30.1	2020
895	22	32.5	2020
859	22	41.7	2020
861	22	33.8	2020
899	22	29.6	2020
904	22	20.9	2020
865	22	21.0	2020
878	22	29.8	2020
860	22	37.9	2020
890	22	16.4	2020
909	22	39.1	2020
856	22	45.8	2020
884	22	39.8	2020
857	22	36.6	2020
902	22	13.0	2020
894	22	16.2	2020
882	22	39.1	2020
892	22	30.1	2020
767	22	\N	2020
652	22	17.2	2020
757	22	4.8	2020
717	22	\N	2020
839	22	16.2	2020
685	22	14.0	2020
777	22	15.7	2020
681	22	10.1	2020
787	22	39.7	2020
632	22	29.1	2020
642	22	17.4	2020
807	22	6.7	2020
827	22	19.2	2020
661	22	0.0	2020
713	22	\N	2020
637	22	24.3	2020
762	22	7.7	2020
847	22	13.7	2020
617	22	16.9	2020
737	22	27.6	2020
622	22	13.3	2020
819	22	13.2	2020
782	22	10.9	2020
729	22	\N	2020
772	22	31.2	2020
765	24	58.8	2020
687	24	65.2	2020
630	24	68.3	2020
640	24	64.8	2020
615	24	71.1	2020
645	24	57.0	2020
770	24	72.2	2020
766	24	72.4	2020
688	24	91.3	2020
631	24	93.0	2020
641	24	84.0	2020
616	24	85.4	2020
646	24	74.3	2020
771	24	66.4	2020
891	24	27.2	2020
872	24	22.6	2020
859	24	23.9	2020
861	24	33.2	2020
856	24	35.7	2020
862	24	33.0	2020
892	24	23.8	2020
767	24	\N	2020
689	24	16.4	2020
632	24	15.4	2020
642	24	24.6	2020
617	24	16.9	2020
647	24	\N	2020
772	24	15.6	2020
615	32	68.1	2020
616	32	83.8	2020
856	32	24.5	2020
617	32	16.9	2020
615	37	72.0	2020
616	37	76.5	2020
856	37	30.3	2020
617	37	0.0	2020
775	38	74.7	2020
776	38	81.9	2020
893	38	7.0	2020
777	38	12.3	2020
829	41	100.0	2020
817	41	74.9	2020
830	41	91.0	2020
818	41	67.8	2020
905	41	25.7	2020
902	41	10.6	2020
831	41	26.7	2020
819	41	0.0	2020
770	51	87.4	2020
771	51	93.0	2020
892	51	27.0	2020
772	51	29.2	2020
663	55	69.9	2020
659	55	100.0	2020
845	55	74.0	2020
615	55	81.6	2020
620	55	81.5	2020
664	55	88.0	2020
660	55	90.5	2020
846	55	78.6	2020
616	55	86.3	2020
621	55	94.9	2020
866	55	29.0	2020
865	55	20.3	2020
909	55	23.2	2020
856	55	33.4	2020
857	55	30.3	2020
665	55	33.4	2020
661	55	20.9	2020
847	55	7.9	2020
617	55	0.0	2020
622	55	31.3	2020
765	1	64.6	2021
775	1	83.2	2021
829	1	91.3	2021
630	1	67.3	2021
640	1	67.2	2021
805	1	64.2	2021
825	1	75.8	2021
635	1	62.7	2021
845	1	64.3	2021
615	1	66.7	2021
795	1	74.3	2021
620	1	80.0	2021
817	1	70.9	2021
833	1	62.3	2021
780	1	60.8	2021
727	1	61.9	2021
766	1	79.1	2021
776	1	79.3	2021
830	1	73.1	2021
631	1	84.8	2021
641	1	85.8	2021
806	1	79.7	2021
826	1	84.5	2021
636	1	75.1	2021
846	1	83.5	2021
616	1	81.3	2021
796	1	100.0	2021
621	1	96.1	2021
818	1	70.8	2021
834	1	85.3	2021
781	1	75.7	2021
728	1	80.4	2021
891	1	26.1	2021
893	1	13.4	2021
905	1	23.2	2021
859	1	24.5	2021
861	1	33.7	2021
899	1	37.3	2021
904	1	33.4	2021
860	1	36.8	2021
909	1	36.8	2021
856	1	42.2	2021
897	1	17.9	2021
857	1	45.4	2021
902	1	23.7	2021
906	1	19.6	2021
894	1	14.3	2021
882	1	37.1	2021
767	1	\N	2021
777	1	16.6	2021
831	1	26.5	2021
632	1	14.0	2021
642	1	21.8	2021
807	1	9.6	2021
827	1	29.4	2021
637	1	26.5	2021
847	1	22.6	2021
617	1	16.2	2021
797	1	39.3	2021
622	1	26.5	2021
819	1	0.0	2021
835	1	25.6	2021
782	1	8.8	2021
729	1	\N	2021
825	2	52.2	2021
826	2	69.5	2021
904	2	17.3	2021
827	2	22.7	2021
837	4	86.5	2021
845	4	71.4	2021
838	4	84.9	2021
846	4	83.7	2021
907	4	35.2	2021
909	4	30.6	2021
839	4	0.0	2021
847	4	8.0	2021
765	8	64.0	2021
630	8	79.4	2021
640	8	58.9	2021
770	8	73.0	2021
766	8	79.1	2021
631	8	95.2	2021
641	8	86.7	2021
771	8	69.7	2021
891	8	27.5	2021
859	8	24.0	2021
861	8	31.0	2021
892	8	39.0	2021
767	8	\N	2021
632	8	15.0	2021
642	8	15.4	2021
772	8	24.5	2021
630	16	66.3	2021
640	16	63.3	2021
735	16	73.3	2021
631	16	93.0	2021
641	16	82.7	2021
736	16	79.9	2021
859	16	19.3	2021
861	16	20.9	2021
884	16	21.1	2021
632	16	12.3	2021
642	16	15.4	2021
737	16	15.2	2021
765	22	66.6	2021
650	22	67.5	2021
715	22	63.6	2021
837	22	65.9	2021
683	22	67.0	2021
775	22	65.8	2021
679	22	66.4	2021
785	22	77.9	2021
630	22	68.4	2021
640	22	62.4	2021
805	22	61.4	2021
825	22	64.2	2021
659	22	78.6	2021
711	22	73.1	2021
635	22	66.0	2021
845	22	67.4	2021
615	22	68.2	2021
735	22	65.7	2021
620	22	71.6	2021
727	22	70.2	2021
770	22	70.2	2021
766	22	73.9	2021
651	22	82.8	2021
716	22	79.6	2021
838	22	77.0	2021
684	22	80.4	2021
776	22	74.7	2021
680	22	82.6	2021
786	22	86.0	2021
631	22	88.8	2021
641	22	80.7	2021
806	22	82.5	2021
826	22	75.8	2021
660	22	86.7	2021
712	22	70.5	2021
636	22	85.9	2021
846	22	82.0	2021
616	22	83.3	2021
736	22	65.3	2021
621	22	90.8	2021
728	22	79.9	2021
771	22	72.7	2021
891	22	30.8	2021
863	22	24.1	2021
879	22	28.2	2021
907	22	27.8	2021
871	22	23.7	2021
893	22	13.2	2021
870	22	29.1	2021
895	22	35.8	2021
859	22	42.2	2021
861	22	33.0	2021
899	22	31.3	2021
904	22	22.3	2021
865	22	21.2	2021
878	22	28.4	2021
860	22	40.5	2021
909	22	38.0	2021
856	22	45.6	2021
884	22	37.5	2021
857	22	37.4	2021
882	22	35.3	2021
892	22	35.1	2021
767	22	\N	2021
652	22	18.7	2021
717	22	\N	2021
839	22	16.7	2021
685	22	12.4	2021
777	22	15.7	2021
681	22	10.4	2021
787	22	30.5	2021
632	22	30.0	2021
642	22	21.8	2021
807	22	9.6	2021
827	22	18.6	2021
661	22	18.9	2021
713	22	\N	2021
637	22	26.5	2021
847	22	17.9	2021
617	22	16.2	2021
737	22	28.4	2021
622	22	12.8	2021
729	22	\N	2021
772	22	24.5	2021
687	24	68.1	2021
630	24	68.9	2021
640	24	68.3	2021
635	24	71.6	2021
615	24	70.3	2021
645	24	59.4	2021
770	24	71.7	2021
688	24	84.9	2021
631	24	91.4	2021
641	24	84.1	2021
636	24	84.9	2021
616	24	86.1	2021
646	24	76.2	2021
771	24	68.8	2021
872	24	20.6	2021
859	24	23.9	2021
861	24	33.2	2021
860	24	31.4	2021
856	24	38.1	2021
862	24	34.4	2021
892	24	25.0	2021
689	24	13.8	2021
632	24	15.0	2021
642	24	0.0	2021
637	24	20.6	2021
617	24	0.0	2021
647	24	\N	2021
772	24	0.0	2021
785	28	77.2	2021
786	28	100.0	2021
895	28	21.5	2021
787	28	0.0	2021
615	32	62.9	2021
616	32	84.8	2021
856	32	25.2	2021
617	32	16.2	2021
615	37	68.1	2021
616	37	76.7	2021
856	37	33.7	2021
617	37	0.0	2021
775	38	75.1	2021
776	38	82.8	2021
893	38	7.1	2021
777	38	12.3	2021
829	41	100.0	2021
817	41	83.1	2021
830	41	93.2	2021
818	41	73.2	2021
905	41	24.4	2021
902	41	14.0	2021
831	41	29.6	2021
819	41	0.0	2021
770	51	81.8	2021
771	51	88.5	2021
892	51	29.4	2021
772	51	24.5	2021
659	55	94.3	2021
615	55	79.0	2021
620	55	78.2	2021
660	55	88.1	2021
616	55	83.9	2021
621	55	95.4	2021
865	55	20.3	2021
856	55	35.1	2021
857	55	31.0	2021
661	55	18.9	2021
617	55	0.0	2021
622	55	30.7	2021
765	1	64.7	2022
650	1	71.4	2022
837	1	67.5	2022
775	1	84.7	2022
829	1	98.2	2022
630	1	65.4	2022
640	1	64.4	2022
805	1	64.8	2022
825	1	74.7	2022
635	1	61.3	2022
845	1	66.8	2022
615	1	68.3	2022
795	1	71.1	2022
620	1	79.0	2022
817	1	70.8	2022
833	1	63.8	2022
780	1	69.3	2022
727	1	64.3	2022
770	1	74.7	2022
766	1	79.4	2022
651	1	77.0	2022
838	1	95.2	2022
776	1	80.4	2022
830	1	72.8	2022
631	1	89.0	2022
641	1	87.3	2022
806	1	78.5	2022
826	1	77.8	2022
636	1	78.6	2022
846	1	83.9	2022
616	1	82.2	2022
796	1	100.0	2022
621	1	96.1	2022
818	1	64.6	2022
834	1	85.1	2022
781	1	76.6	2022
728	1	79.4	2022
771	1	84.9	2022
891	1	26.4	2022
863	1	11.0	2022
907	1	33.3	2022
893	1	13.7	2022
905	1	24.8	2022
859	1	24.0	2022
861	1	35.3	2022
899	1	37.9	2022
904	1	36.9	2022
860	1	37.8	2022
909	1	33.3	2022
856	1	39.9	2022
897	1	18.9	2022
857	1	44.7	2022
902	1	26.7	2022
906	1	19.0	2022
894	1	15.4	2022
882	1	34.1	2022
892	1	24.3	2022
767	1	\N	2022
652	1	6.5	2022
839	1	15.6	2022
777	1	17.4	2022
831	1	25.4	2022
632	1	13.7	2022
642	1	25.8	2022
807	1	13.8	2022
827	1	33.1	2022
637	1	25.5	2022
847	1	20.5	2022
617	1	0.0	2022
797	1	37.2	2022
622	1	23.7	2022
819	1	0.0	2022
835	1	29.9	2022
782	1	9.0	2022
729	1	34.5	2022
772	1	14.7	2022
837	4	79.3	2022
845	4	68.5	2022
838	4	92.8	2022
846	4	82.5	2022
907	4	35.3	2022
909	4	30.2	2022
839	4	0.0	2022
847	4	7.7	2022
765	8	63.2	2022
630	8	76.2	2022
640	8	60.5	2022
645	8	67.7	2022
770	8	70.7	2022
766	8	79.0	2022
631	8	96.2	2022
641	8	86.9	2022
646	8	76.5	2022
771	8	69.0	2022
891	8	28.8	2022
859	8	22.7	2022
861	8	30.4	2022
862	8	26.7	2022
892	8	43.9	2022
767	8	\N	2022
632	8	15.2	2022
642	8	14.9	2022
647	8	25.0	2022
772	8	14.7	2022
780	9	100.0	2022
781	9	93.6	2022
894	9	11.6	2022
782	9	6.4	2022
630	16	65.4	2022
640	16	60.8	2022
735	16	72.4	2022
631	16	94.4	2022
641	16	84.6	2022
736	16	81.2	2022
859	16	19.0	2022
861	16	22.2	2022
884	16	22.8	2022
632	16	13.1	2022
642	16	14.9	2022
737	16	14.7	2022
620	18	100.0	2022
621	18	93.3	2022
857	18	20.0	2022
622	18	5.2	2022
765	22	64.9	2022
650	22	66.3	2022
715	22	63.2	2022
837	22	66.5	2022
679	22	64.4	2022
785	22	78.2	2022
630	22	68.1	2022
640	22	58.9	2022
805	22	61.4	2022
825	22	58.2	2022
659	22	80.1	2022
711	22	76.2	2022
635	22	61.6	2022
845	22	63.5	2022
615	22	64.1	2022
735	22	66.7	2022
620	22	74.2	2022
727	22	80.7	2022
770	22	72.6	2022
766	22	72.3	2022
651	22	82.8	2022
716	22	78.8	2022
838	22	82.9	2022
680	22	84.1	2022
786	22	85.7	2022
631	22	90.4	2022
641	22	82.0	2022
806	22	79.1	2022
826	22	78.7	2022
660	22	88.2	2022
712	22	70.2	2022
636	22	87.5	2022
846	22	81.8	2022
616	22	84.0	2022
736	22	68.4	2022
621	22	91.7	2022
728	22	76.5	2022
771	22	73.5	2022
891	22	29.9	2022
863	22	23.1	2022
879	22	25.6	2022
907	22	28.3	2022
870	22	28.9	2022
895	22	35.9	2022
859	22	38.6	2022
861	22	32.9	2022
899	22	32.4	2022
904	22	22.8	2022
865	22	20.5	2022
878	22	28.3	2022
860	22	41.5	2022
909	22	37.2	2022
856	22	46.0	2022
884	22	37.2	2022
857	22	38.0	2022
882	22	34.4	2022
892	22	39.4	2022
767	22	\N	2022
652	22	18.8	2022
717	22	\N	2022
839	22	15.6	2022
681	22	13.1	2022
787	22	36.5	2022
632	22	28.1	2022
642	22	21.1	2022
807	22	6.9	2022
827	22	21.7	2022
661	22	20.0	2022
713	22	27.8	2022
637	22	25.5	2022
847	22	17.3	2022
617	22	22.9	2022
737	22	29.3	2022
622	22	14.3	2022
729	22	43.5	2022
772	22	27.4	2022
650	24	82.0	2022
687	24	64.7	2022
630	24	65.5	2022
640	24	67.6	2022
635	24	69.1	2022
615	24	70.0	2022
645	24	63.4	2022
770	24	69.9	2022
651	24	78.8	2022
688	24	84.0	2022
631	24	92.9	2022
641	24	86.1	2022
636	24	88.5	2022
616	24	86.1	2022
646	24	76.2	2022
771	24	73.0	2022
863	24	13.3	2022
872	24	22.3	2022
859	24	23.6	2022
861	24	34.4	2022
860	24	32.4	2022
856	24	40.2	2022
862	24	35.1	2022
892	24	27.0	2022
652	24	8.7	2022
689	24	16.0	2022
632	24	12.6	2022
642	24	14.9	2022
637	24	16.1	2022
617	24	0.0	2022
647	24	33.4	2022
772	24	10.4	2022
780	25	72.5	2022
781	25	86.5	2022
894	25	9.8	2022
782	25	11.0	2022
785	28	74.8	2022
786	28	96.8	2022
895	28	23.8	2022
787	28	14.9	2022
615	32	68.7	2022
616	32	86.3	2022
856	32	23.9	2022
617	32	16.2	2022
615	37	67.2	2022
616	37	78.0	2022
856	37	35.5	2022
617	37	0.0	2022
837	38	88.5	2022
775	38	72.9	2022
838	38	100.0	2022
776	38	82.1	2022
907	38	34.6	2022
893	38	7.7	2022
839	38	0.0	2022
777	38	12.0	2022
829	41	100.0	2022
817	41	97.3	2022
830	41	90.0	2022
818	41	76.5	2022
905	41	22.2	2022
902	41	14.4	2022
831	41	25.4	2022
819	41	0.0	2022
755	48	82.3	2022
756	48	84.1	2022
889	48	9.7	2022
757	48	4.9	2022
770	51	74.6	2022
771	51	80.5	2022
892	51	31.9	2022
772	51	23.2	2022
659	55	78.9	2022
615	55	75.4	2022
620	55	75.0	2022
660	55	87.2	2022
616	55	83.5	2022
621	55	95.3	2022
865	55	20.0	2022
856	55	36.2	2022
857	55	31.5	2022
661	55	0.0	2022
617	55	0.0	2022
622	55	28.2	2022
18	1	100.0	2025
23	1	76.7	2025
19	1	100.0	2025
20	1	65.2	2025
24	1	99.8	2025
22	1	96.8	2025
21	1	98.3	2025
1688	1	95.0	2025
1689	1	5.0	2025
25	1	95.7	2025
18	2	89.0	2025
23	2	45.4	2025
19	2	81.4	2025
20	2	14.8	2025
24	2	92.7	2025
22	2	99.1	2025
21	2	60.7	2025
1688	2	98.0	2025
1689	2	2.0	2025
25	2	50.3	2025
18	4	80.0	2025
23	4	28.4	2025
19	4	99.0	2025
20	4	19.5	2025
24	4	86.8	2025
22	4	96.4	2025
21	4	81.3	2025
1688	4	95.0	2025
1689	4	5.0	2025
25	4	43.6	2025
18	6	44.6	2025
23	6	7.9	2025
19	6	36.5	2025
20	6	9.6	2025
24	6	20.3	2025
22	6	91.8	2025
21	6	59.3	2025
1688	6	98.0	2025
1689	6	2.0	2025
25	6	27.4	2025
18	7	7.9	2025
23	7	38.0	2025
19	7	8.5	2025
20	7	16.6	2025
24	7	67.1	2025
22	7	34.5	2025
21	7	17.0	2025
1688	7	93.0	2025
1689	7	7.0	2025
25	7	17.6	2025
18	8	65.5	2025
23	8	49.8	2025
19	8	59.5	2025
20	8	9.1	2025
24	8	93.9	2025
22	8	99.3	2025
21	8	85.0	2025
1688	8	99.0	2025
1689	8	1.0	2025
25	8	59.4	2025
18	9	34.5	2025
23	9	93.5	2025
19	9	22.0	2025
20	9	13.5	2025
24	9	90.2	2025
22	9	48.9	2025
21	9	23.9	2025
1688	9	99.0	2025
1689	9	1.0	2025
25	9	36.9	2025
18	10	24.8	2025
23	10	12.3	2025
19	10	38.1	2025
20	10	26.8	2025
24	10	59.2	2025
22	10	63.2	2025
21	10	29.9	2025
1688	10	98.0	2025
1689	10	2.0	2025
25	10	13.9	2025
18	12	13.5	2025
23	12	4.9	2025
19	12	15.1	2025
20	12	18.5	2025
24	12	8.8	2025
22	12	17.8	2025
21	12	8.8	2025
1688	12	0.0	2025
1689	12	0.0	2025
25	12	13.3	2025
18	13	24.0	2025
23	13	43.1	2025
19	13	17.5	2025
20	13	22.2	2025
24	13	86.0	2025
22	13	73.5	2025
21	13	31.3	2025
1688	13	100.0	2025
1689	13	0.0	2025
25	13	24.8	2025
18	14	25.9	2025
23	14	10.5	2025
19	14	11.2	2025
20	14	5.8	2025
24	14	71.8	2025
22	14	99.8	2025
21	14	63.7	2025
1688	14	100.0	2025
1689	14	0.0	2025
25	14	26.3	2025
18	15	15.5	2025
23	15	21.0	2025
19	15	11.6	2025
20	15	27.6	2025
24	15	88.6	2025
22	15	65.2	2025
21	15	25.0	2025
1688	15	100.0	2025
1689	15	0.0	2025
25	15	27.3	2025
18	16	27.1	2025
23	16	63.9	2025
19	16	23.0	2025
20	16	24.7	2025
24	16	93.5	2025
22	16	87.1	2025
21	16	32.8	2025
1688	16	95.0	2025
1689	16	5.0	2025
25	16	47.0	2025
18	17	25.2	2025
23	17	68.8	2025
19	17	21.0	2025
20	17	11.1	2025
24	17	43.2	2025
22	17	17.3	2025
21	17	13.9	2025
1688	17	98.0	2025
1689	17	2.0	2025
25	17	20.4	2025
18	18	22.6	2025
23	18	92.1	2025
19	18	12.3	2025
20	18	24.8	2025
24	18	75.9	2025
22	18	56.1	2025
21	18	22.7	2025
1688	18	98.0	2025
1689	18	2.0	2025
25	18	20.8	2025
18	21	7.9	2025
23	21	65.9	2025
19	21	9.1	2025
20	21	5.2	2025
24	21	65.5	2025
22	21	81.5	2025
21	21	16.3	2025
1688	21	0.0	2025
1689	21	0.0	2025
25	21	18.2	2025
18	22	100.0	2025
23	22	75.7	2025
19	22	100.0	2025
20	22	22.3	2025
24	22	99.7	2025
22	22	99.4	2025
21	22	69.2	2025
1688	22	95.0	2025
1689	22	5.0	2025
25	22	100.0	2025
18	24	89.2	2025
23	24	89.8	2025
19	24	88.7	2025
20	24	37.0	2025
24	24	98.7	2025
22	24	88.9	2025
21	24	60.4	2025
1688	24	98.0	2025
1689	24	2.0	2025
25	24	82.5	2025
18	25	54.1	2025
23	25	85.6	2025
19	25	34.0	2025
20	25	14.9	2025
24	25	93.1	2025
22	25	99.1	2025
21	25	81.6	2025
1688	25	99.0	2025
1689	25	1.0	2025
25	25	32.3	2025
18	26	27.6	2025
23	26	83.5	2025
19	26	16.7	2025
20	26	9.9	2025
24	26	58.3	2025
22	26	74.9	2025
21	26	31.1	2025
1688	26	99.0	2025
1689	26	1.0	2025
25	26	21.1	2025
18	27	26.2	2025
23	27	15.8	2025
19	27	25.5	2025
20	27	21.1	2025
24	27	46.9	2025
22	27	9.7	2025
21	27	10.4	2025
1688	27	98.0	2025
1689	27	2.0	2025
25	27	17.9	2025
18	28	72.6	2025
23	28	36.0	2025
19	28	90.2	2025
20	28	29.2	2025
24	28	64.3	2025
22	28	58.2	2025
21	28	28.1	2025
1688	28	98.0	2025
1689	28	2.0	2025
25	28	25.8	2025
18	29	13.3	2025
23	29	25.7	2025
19	29	8.8	2025
20	29	9.4	2025
24	29	59.4	2025
22	29	79.2	2025
21	29	39.2	2025
1688	29	100.0	2025
1689	29	0.0	2025
25	29	30.1	2025
18	30	13.3	2025
23	30	99.0	2025
19	30	10.1	2025
20	30	55.0	2025
24	30	65.3	2025
22	30	49.9	2025
21	30	8.6	2025
1688	30	0.0	2025
1689	30	0.0	2025
25	30	19.4	2025
18	31	14.0	2025
23	31	12.9	2025
19	31	0.0	2025
20	31	22.1	2025
24	31	39.4	2025
22	31	49.1	2025
21	31	21.3	2025
1688	31	100.0	2025
1689	31	0.0	2025
25	31	21.4	2025
18	32	96.9	2025
23	32	57.7	2025
19	32	96.9	2025
20	32	24.0	2025
24	32	96.7	2025
22	32	80.6	2025
21	32	29.0	2025
1688	32	98.0	2025
1689	32	2.0	2025
25	32	63.7	2025
18	33	54.0	2025
23	33	80.8	2025
19	33	48.9	2025
20	33	19.1	2025
24	33	94.1	2025
22	33	94.9	2025
21	33	53.9	2025
1688	33	99.0	2025
1689	33	1.0	2025
25	33	59.3	2025
18	34	21.5	2025
23	34	92.3	2025
19	34	9.1	2025
20	34	9.7	2025
24	34	95.4	2025
22	34	99.8	2025
21	34	40.2	2025
1688	34	100.0	2025
1689	34	0.0	2025
25	34	29.9	2025
18	35	56.9	2025
23	35	37.1	2025
19	35	37.5	2025
20	35	25.6	2025
24	35	86.8	2025
22	35	61.2	2025
21	35	33.0	2025
1688	35	98.0	2025
1689	35	2.0	2025
25	35	43.7	2025
18	36	8.3	2025
23	36	4.0	2025
19	36	5.5	2025
20	36	33.3	2025
24	36	18.0	2025
22	36	9.3	2025
21	36	3.7	2025
765	1	61.6	2023
650	1	72.3	2023
755	1	68.4	2023
683	1	60.9	2023
775	1	77.8	2023
829	1	86.3	2023
630	1	63.1	2023
640	1	62.6	2023
805	1	67.3	2023
825	1	64.5	2023
635	1	60.6	2023
760	1	74.7	2023
845	1	63.0	2023
795	1	71.9	2023
620	1	79.5	2023
817	1	74.1	2023
833	1	64.4	2023
780	1	77.2	2023
727	1	63.9	2023
770	1	70.0	2023
766	1	79.7	2023
651	1	74.4	2023
756	1	82.4	2023
684	1	81.0	2023
776	1	82.0	2023
830	1	84.4	2023
631	1	87.9	2023
641	1	86.4	2023
806	1	71.5	2023
826	1	74.0	2023
636	1	80.1	2023
761	1	81.2	2023
846	1	83.7	2023
796	1	100.0	2023
621	1	95.2	2023
818	1	76.6	2023
834	1	87.5	2023
781	1	80.2	2023
728	1	74.4	2023
771	1	84.1	2023
891	1	22.8	2023
863	1	12.6	2023
889	1	22.5	2023
871	1	25.0	2023
893	1	13.6	2023
905	1	27.4	2023
859	1	22.8	2023
861	1	35.0	2023
899	1	40.3	2023
904	1	39.6	2023
860	1	36.1	2023
890	1	14.2	2023
909	1	27.8	2023
897	1	18.5	2023
857	1	41.3	2023
902	1	36.1	2023
906	1	21.9	2023
894	1	16.6	2023
1688	36	100.0	2025
882	1	32.2	2023
892	1	29.9	2023
767	1	22.1	2023
652	1	7.6	2023
757	1	8.9	2023
685	1	26.9	2023
777	1	14.9	2023
831	1	26.4	2023
632	1	13.2	2023
642	1	26.4	2023
807	1	9.9	2023
827	1	24.3	2023
637	1	0.0	2023
762	1	13.2	2023
847	1	17.4	2023
797	1	41.8	2023
622	1	21.8	2023
819	1	19.5	2023
835	1	27.2	2023
782	1	15.4	2023
729	1	34.0	2023
772	1	12.8	2023
829	2	88.6	2023
830	2	96.4	2023
905	2	22.6	2023
831	2	11.8	2023
760	4	86.1	2023
845	4	60.1	2023
833	4	89.5	2023
761	4	98.0	2023
846	4	85.8	2023
834	4	93.7	2023
890	4	7.0	2023
909	4	24.3	2023
906	4	15.5	2023
762	4	5.4	2023
847	4	12.3	2023
835	4	0.0	2023
765	8	59.9	2023
630	8	71.7	2023
640	8	59.9	2023
770	8	69.4	2023
766	8	75.3	2023
631	8	95.9	2023
641	8	83.4	2023
771	8	70.2	2023
891	8	27.9	2023
859	8	19.2	2023
861	8	29.3	2023
892	8	47.3	2023
767	8	28.9	2023
632	8	14.4	2023
642	8	15.2	2023
772	8	12.8	2023
790	9	78.9	2023
791	9	100.0	2023
896	9	25.5	2023
792	9	27.7	2023
640	16	60.7	2023
641	16	85.0	2023
861	16	21.8	2023
642	16	15.2	2023
620	18	100.0	2023
621	18	92.9	2023
857	18	23.0	2023
622	18	3.7	2023
765	22	64.8	2023
650	22	66.6	2023
755	22	68.7	2023
785	22	70.8	2023
630	22	66.1	2023
640	22	62.3	2023
805	22	57.3	2023
659	22	81.9	2023
711	22	68.9	2023
635	22	59.9	2023
760	22	71.4	2023
845	22	60.1	2023
615	22	59.4	2023
735	22	58.5	2023
800	22	66.8	2023
620	22	77.5	2023
667	22	85.0	2023
727	22	78.9	2023
770	22	70.3	2023
766	22	71.2	2023
651	22	83.2	2023
756	22	78.2	2023
786	22	83.9	2023
631	22	89.5	2023
641	22	79.7	2023
806	22	77.7	2023
660	22	88.4	2023
712	22	72.6	2023
636	22	87.0	2023
761	22	79.6	2023
846	22	85.9	2023
616	22	83.8	2023
736	22	70.0	2023
801	22	76.1	2023
621	22	91.5	2023
668	22	91.5	2023
728	22	80.3	2023
771	22	72.0	2023
891	22	26.9	2023
863	22	20.0	2023
889	22	25.7	2023
895	22	34.6	2023
859	22	33.3	2023
861	22	32.3	2023
899	22	33.1	2023
865	22	17.4	2023
878	22	24.5	2023
860	22	35.1	2023
890	22	15.6	2023
909	22	31.3	2023
856	22	42.8	2023
884	22	29.4	2023
898	22	34.5	2023
857	22	38.3	2023
867	22	14.0	2023
882	22	29.7	2023
892	22	45.5	2023
767	22	27.9	2023
652	22	14.0	2023
757	22	7.2	2023
787	22	16.9	2023
632	22	25.0	2023
642	22	26.4	2023
807	22	7.0	2023
661	22	21.3	2023
713	22	21.7	2023
637	22	15.8	2023
762	22	10.8	2023
847	22	18.8	2023
617	22	14.9	2023
737	22	30.2	2023
802	22	0.0	2023
622	22	13.8	2023
669	22	11.4	2023
729	22	32.1	2023
772	22	27.1	2023
765	24	61.7	2023
650	24	89.5	2023
687	24	62.9	2023
630	24	64.7	2023
640	24	68.2	2023
615	24	66.9	2023
735	24	64.6	2023
645	24	60.4	2023
620	24	87.5	2023
770	24	70.1	2023
766	24	72.3	2023
651	24	80.3	2023
688	24	80.3	2023
631	24	89.6	2023
641	24	84.0	2023
616	24	84.1	2023
736	24	65.3	2023
646	24	73.4	2023
621	24	93.1	2023
771	24	72.6	2023
891	24	23.4	2023
863	24	11.6	2023
872	24	20.9	2023
859	24	23.2	2023
861	24	31.7	2023
856	24	37.6	2023
884	24	24.5	2023
862	24	28.1	2023
857	24	30.1	2023
892	24	29.2	2023
767	24	22.2	2023
652	24	10.2	2023
689	24	18.6	2023
632	24	16.1	2023
642	24	21.6	2023
617	24	0.0	2023
737	24	20.1	2023
647	24	32.2	2023
622	24	8.2	2023
772	24	9.0	2023
775	25	82.2	2023
776	25	85.9	2023
893	25	5.8	2023
777	25	14.9	2023
785	28	71.8	2023
786	28	91.2	2023
895	28	23.7	2023
787	28	12.0	2023
615	32	62.3	2023
616	32	85.9	2023
856	32	23.4	2023
617	32	14.9	2023
837	38	85.8	2023
760	38	89.7	2023
838	38	97.4	2023
761	38	86.7	2023
907	38	36.6	2023
890	38	9.3	2023
839	38	27.9	2023
762	38	9.3	2023
829	41	92.5	2023
817	41	98.0	2023
830	41	100.0	2023
818	41	99.9	2023
905	41	24.8	2023
902	41	22.2	2023
831	41	28.9	2023
819	41	0.0	2023
755	48	83.4	2023
640	48	91.5	2023
756	48	85.5	2023
641	48	86.2	2023
889	48	12.5	2023
861	48	21.8	2023
757	48	7.2	2023
642	48	21.6	2023
825	51	94.2	2023
659	51	99.6	2023
770	51	68.7	2023
826	51	90.4	2023
660	51	95.6	2023
771	51	75.0	2023
904	51	20.0	2023
865	51	15.6	2023
892	51	35.0	2023
827	51	0.0	2023
661	51	0.0	2023
772	51	18.0	2023
659	55	76.4	2023
620	55	71.8	2023
660	55	88.1	2023
621	55	94.7	2023
865	55	17.5	2023
857	55	29.7	2023
661	55	30.2	2023
622	55	27.8	2023
1004	1	30.6	2024
1002	1	33.0	2024
984	1	30.4	2024
1006	1	39.7	2024
1018	1	39.6	2024
972	1	30.4	2024
974	1	32.4	2024
1012	1	31.9	2024
1017	1	30.6	2024
991	1	32.2	2024
973	1	31.5	2024
1003	1	37.2	2024
969	1	28.8	2024
1010	1	34.5	2024
970	1	37.5	2024
1015	1	36.3	2024
1019	1	31.7	2024
1007	1	35.0	2024
995	1	29.8	2024
1005	1	37.0	2024
947	1	15.9	2024
945	1	16.5	2024
927	1	16.4	2024
949	1	16.7	2024
961	1	7.9	2024
915	1	17.6	2024
917	1	17.1	2024
955	1	7.4	2024
960	1	7.7	2024
934	1	15.4	2024
916	1	16.0	2024
946	1	16.3	2024
912	1	16.0	2024
953	1	19.7	2024
913	1	19.0	2024
958	1	7.1	2024
962	1	8.5	2024
950	1	16.4	2024
938	1	15.5	2024
948	1	16.5	2024
1061	1	21.6	2024
1059	1	23.5	2024
1041	1	24.1	2024
1063	1	13.6	2024
1075	1	28.3	2024
1029	1	21.1	2024
1031	1	35.9	2024
1069	1	41.2	2024
1074	1	40.6	2024
1048	1	17.7	2024
1030	1	34.7	2024
1060	1	14.4	2024
1026	1	31.1	2024
1067	1	17.6	2024
1027	1	35.4	2024
1072	1	34.5	2024
1076	1	22.2	2024
1064	1	17.1	2024
1052	1	29.2	2024
1062	1	30.7	2024
1666	1	37.9	2024
1664	1	21.8	2024
1648	1	30.4	2024
1668	1	5.4	2024
1680	1	18.1	2024
1636	1	0.0	2024
1638	1	44.3	2024
1674	1	12.9	2024
1679	1	9.3	2024
1655	1	17.4	2024
1637	1	38.4	2024
1665	1	0.0	2024
1633	1	9.0	2024
1672	1	0.0	2024
1634	1	6.8	2024
1677	1	35.6	2024
1681	1	24.8	2024
1669	1	4.5	2024
1659	1	3.2	2024
1667	1	0.0	2024
1611	1	21.5	2024
1609	1	7.5	2024
1593	1	23.0	2024
1613	1	11.7	2024
1625	1	25.8	2024
1581	1	17.0	2024
1583	1	30.5	2024
1619	1	11.5	2024
1624	1	9.4	2024
1600	1	13.4	2024
1582	1	26.1	2024
1610	1	14.4	2024
1578	1	13.2	2024
1617	1	6.1	2024
1579	1	21.0	2024
1622	1	18.3	2024
1626	1	16.3	2024
1614	1	15.7	2024
1604	1	30.0	2024
1612	1	8.5	2024
1003	4	48.6	2024
946	4	19.5	2024
1060	4	8.2	2024
1665	4	0.0	2024
1610	4	10.2	2024
1004	8	29.6	2024
972	8	33.7	2024
974	8	29.7	2024
1005	8	33.9	2024
947	8	14.8	2024
915	8	18.7	2024
917	8	16.6	2024
948	8	14.4	2024
1061	8	26.0	2024
1029	8	16.7	2024
1031	8	29.8	2024
1062	8	46.5	2024
1666	8	28.1	2024
1636	8	4.6	2024
1638	8	7.9	2024
1667	8	33.9	2024
1611	8	27.3	2024
1581	8	13.9	2024
1583	8	27.5	2024
1612	8	14.6	2024
1009	9	38.4	2024
952	9	20.0	2024
1066	9	27.2	2024
1671	9	0.0	2024
1616	9	12.2	2024
1004	22	31.4	2024
976	22	33.9	2024
1002	22	32.8	2024
1008	22	36.7	2024
972	22	32.1	2024
974	22	32.2	2024
1012	22	27.5	2024
978	22	38.9	2024
991	22	34.1	2024
973	22	30.4	2024
1003	22	37.0	2024
1022	22	29.0	2024
969	22	31.2	2024
997	22	28.5	2024
1011	22	33.2	2024
970	22	37.5	2024
1007	22	28.8	2024
995	22	39.1	2024
1005	22	35.7	2024
947	22	14.4	2024
919	22	17.2	2024
945	22	15.5	2024
951	22	16.7	2024
915	22	17.9	2024
917	22	15.8	2024
955	22	7.7	2024
921	22	17.6	2024
934	22	14.6	2024
916	22	17.2	2024
946	22	15.9	2024
965	22	8.4	2024
912	22	16.8	2024
940	22	14.2	2024
954	22	15.3	2024
913	22	18.3	2024
950	22	15.0	2024
938	22	16.2	2024
948	22	14.4	2024
1061	22	25.4	2024
1033	22	19.3	2024
1059	22	26.6	2024
1065	22	34.8	2024
1029	22	30.2	2024
1031	22	32.6	2024
1069	22	33.4	2024
1035	22	17.1	2024
1048	22	24.1	2024
1030	22	30.9	2024
1060	22	15.2	2024
1079	22	29.8	2024
1026	22	36.3	2024
1054	22	28.9	2024
1068	22	33.8	2024
1027	22	33.6	2024
1064	22	19.3	2024
1052	22	25.8	2024
1062	22	45.5	2024
1666	22	15.2	2024
1640	22	0.0	2024
1664	22	17.6	2024
1670	22	4.7	2024
1636	22	6.6	2024
1638	22	0.0	2024
1674	22	37.3	2024
1642	22	0.0	2024
1655	22	0.0	2024
1637	22	0.0	2024
1665	22	15.7	2024
1684	22	12.6	2024
1633	22	6.6	2024
1661	22	0.0	2024
1673	22	6.0	2024
1634	22	9.6	2024
1669	22	5.2	2024
1659	22	0.0	2024
1667	22	0.0	2024
1611	22	26.1	2024
1585	22	12.5	2024
1609	22	7.5	2024
1615	22	16.4	2024
1581	22	25.0	2024
1583	22	28.5	2024
1619	22	6.6	2024
1587	22	10.7	2024
1600	22	18.9	2024
1582	22	15.1	2024
1610	22	8.8	2024
1629	22	21.8	2024
1578	22	18.7	2024
1606	22	16.2	2024
1618	22	9.4	2024
1579	22	13.3	2024
1614	22	16.9	2024
1604	22	27.7	2024
1612	22	23.9	2024
1004	24	29.4	2024
976	24	44.0	2024
1002	24	30.9	2024
972	24	31.7	2024
974	24	35.3	2024
975	24	29.7	2024
1005	24	34.5	2024
947	24	14.9	2024
919	24	16.0	2024
945	24	16.0	2024
915	24	17.5	2024
917	24	16.5	2024
918	24	15.0	2024
948	24	15.0	2024
1061	24	21.7	2024
1033	24	11.4	2024
1059	24	20.9	2024
1029	24	21.0	2024
1031	24	31.9	2024
1032	24	24.8	2024
1062	24	30.3	2024
1666	24	12.0	2024
1640	24	0.0	2024
1664	24	26.8	2024
1636	24	12.9	2024
1638	24	0.0	2024
1639	24	0.0	2024
1667	24	0.0	2024
1611	24	21.5	2024
1585	24	8.8	2024
1609	24	0.0	2024
1581	24	15.0	2024
1583	24	28.5	2024
1584	24	25.2	2024
1612	24	8.5	2024
1004	25	33.3	2024
1006	25	44.1	2024
947	25	16.5	2024
949	25	17.7	2024
1061	25	16.0	2024
1063	25	6.0	2024
1666	25	26.8	2024
1668	25	0.0	2024
1611	25	16.9	2024
1613	25	12.2	2024
1008	28	37.3	2024
951	28	18.3	2024
1065	28	25.0	2024
1670	28	0.0	2024
1615	28	18.5	2024
969	32	30.3	2024
912	32	17.1	2024
1026	32	21.8	2024
1633	32	25.6	2024
1578	32	0.0	2024
1004	33	33.1	2024
1012	33	32.7	2024
947	33	15.4	2024
955	33	7.6	2024
1061	33	17.3	2024
1069	33	15.2	2024
1666	33	25.6	2024
1674	33	14.7	2024
1611	33	18.1	2024
1619	33	6.6	2024
970	34	36.3	2024
913	34	19.3	2024
1027	34	21.9	2024
1634	34	0.0	2024
1579	34	25.5	2024
1003	38	41.7	2024
946	38	17.3	2024
1060	38	9.5	2024
1665	38	4.6	2024
1610	38	8.8	2024
1018	41	48.5	2024
1015	41	42.5	2024
961	41	10.0	2024
958	41	9.8	2024
1075	41	27.7	2024
1072	41	23.3	2024
1680	41	0.0	2024
1677	41	0.0	2024
1625	41	30.6	2024
1622	41	0.0	2024
974	48	49.2	2024
917	48	17.3	2024
1031	48	23.8	2024
1638	48	5.7	2024
1583	48	22.9	2024
1017	51	46.1	2024
978	51	46.0	2024
970	51	36.2	2024
1005	51	35.7	2024
960	51	9.5	2024
921	51	18.7	2024
913	51	18.9	2024
948	51	14.9	2024
1074	51	22.5	2024
1035	51	15.9	2024
1027	51	27.5	2024
1062	51	35.4	2024
1679	51	0.0	2024
1642	51	8.2	2024
1634	51	0.0	2024
1667	51	0.0	2024
1624	51	0.0	2024
1587	51	0.0	2024
1579	51	18.6	2024
1612	51	18.9	2024
978	55	35.5	2024
970	55	34.6	2024
921	55	17.4	2024
913	55	18.9	2024
1035	55	16.5	2024
1027	55	26.7	2024
1642	55	0.0	2024
1634	55	0.0	2024
1587	55	15.1	2024
1579	55	25.7	2024
1004	1	31.4	2025
1002	1	33.5	2025
984	1	29.2	2025
1006	1	40.2	2025
1018	1	14.4	2025
983	1	29.7	2025
974	1	30.6	2025
1012	1	12.8	2025
1017	1	12.4	2025
989	1	30.0	2025
991	1	33.5	2025
973	1	30.5	2025
1003	1	37.2	2025
969	1	28.1	2025
1010	1	37.1	2025
970	1	38.7	2025
1015	1	15.3	2025
1019	1	13.5	2025
1007	1	32.6	2025
1016	1	13.4	2025
1013	1	12.3	2025
995	1	29.6	2025
1005	1	37.4	2025
947	1	16.0	2025
945	1	16.2	2025
927	1	16.4	2025
949	1	16.9	2025
961	1	8.7	2025
926	1	15.8	2025
917	1	17.1	2025
955	1	7.7	2025
960	1	7.5	2025
932	1	16.3	2025
934	1	14.9	2025
916	1	15.6	2025
946	1	16.2	2025
912	1	16.1	2025
953	1	19.8	2025
913	1	19.0	2025
958	1	7.2	2025
962	1	8.5	2025
950	1	16.5	2025
959	1	7.5	2025
956	1	9.5	2025
938	1	14.8	2025
948	1	16.8	2025
1061	1	21.0	2025
1059	1	25.3	2025
1041	1	22.0	2025
1063	1	14.3	2025
1075	1	25.8	2025
1040	1	15.7	2025
1031	1	36.0	2025
1069	1	40.6	2025
1074	1	43.2	2025
1046	1	23.4	2025
1048	1	17.5	2025
1030	1	29.1	2025
1060	1	14.9	2025
1026	1	33.6	2025
1067	1	16.5	2025
1027	1	37.4	2025
1072	1	35.4	2025
1076	1	22.7	2025
1064	1	18.0	2025
1073	1	28.9	2025
1070	1	25.2	2025
1052	1	24.5	2025
1062	1	31.1	2025
1666	1	22.6	2025
1664	1	23.0	2025
1648	1	30.3	2025
1668	1	4.0	2025
1680	1	20.1	2025
1647	1	5.6	2025
1638	1	40.8	2025
1674	1	12.3	2025
1679	1	9.9	2025
1653	1	20.7	2025
1655	1	6.8	2025
1637	1	33.9	2025
1665	1	0.0	2025
1633	1	8.8	2025
1672	1	0.0	2025
1634	1	0.0	2025
1677	1	37.3	2025
1681	1	4.7	2025
1669	1	4.1	2025
1678	1	0.0	2025
1675	1	6.0	2025
1659	1	4.6	2025
1667	1	0.0	2025
1611	1	20.3	2025
1609	1	8.9	2025
1593	1	20.8	2025
1613	1	14.2	2025
1625	1	21.8	2025
1592	1	18.3	2025
1583	1	32.9	2025
1619	1	13.0	2025
1624	1	0.0	2025
1598	1	9.8	2025
1600	1	12.3	2025
1582	1	30.9	2025
1610	1	14.5	2025
1578	1	19.8	2025
1617	1	6.1	2025
1579	1	27.5	2025
1622	1	19.5	2025
1626	1	9.1	2025
1614	1	17.2	2025
1623	1	16.3	2025
1620	1	8.0	2025
1604	1	7.9	2025
1612	1	7.9	2025
1004	2	32.1	2025
1017	2	11.6	2025
947	2	15.1	2025
960	2	6.8	2025
1061	2	18.2	2025
1074	2	21.8	2025
1666	2	22.6	2025
1679	2	11.9	2025
1611	2	17.3	2025
1624	2	0.0	2025
1003	4	48.2	2025
946	4	19.5	2025
1060	4	8.4	2025
1665	4	0.0	2025
1610	4	11.9	2025
1004	8	29.2	2025
976	8	39.7	2025
1005	8	31.3	2025
947	8	15.3	2025
919	8	18.5	2025
948	8	15.2	2025
1061	8	24.1	2025
1033	8	13.6	2025
1062	8	45.0	2025
1666	8	23.7	2025
1640	8	0.0	2025
1667	8	37.4	2025
1611	8	24.2	2025
1585	8	5.9	2025
1612	8	15.7	2025
972	16	29.2	2025
915	16	17.6	2025
1029	16	15.8	2025
1636	16	9.3	2025
1581	16	14.6	2025
1004	22	31.7	2025
976	22	36.7	2025
1002	22	32.6	2025
983	22	32.5	2025
1008	22	36.2	2025
972	22	31.5	2025
1012	22	10.3	2025
1017	22	11.1	2025
978	22	39.4	2025
991	22	35.3	2025
1003	22	36.2	2025
1022	22	11.3	2025
969	22	31.3	2025
997	22	27.6	2025
1011	22	34.0	2025
970	22	37.9	2025
1007	22	27.7	2025
995	22	37.5	2025
1005	22	35.2	2025
990	22	33.9	2025
947	22	14.7	2025
919	22	17.3	2025
945	22	15.3	2025
926	22	17.2	2025
951	22	17.1	2025
915	22	17.9	2025
955	22	7.7	2025
960	22	7.7	2025
921	22	17.6	2025
934	22	14.7	2025
946	22	16.0	2025
965	22	8.5	2025
912	22	16.8	2025
940	22	14.7	2025
954	22	15.2	2025
913	22	18.4	2025
950	22	15.1	2025
938	22	16.1	2025
948	22	14.6	2025
933	22	16.0	2025
1061	22	24.1	2025
1033	22	20.5	2025
1059	22	28.5	2025
1040	22	18.0	2025
1065	22	33.6	2025
1029	22	28.9	2025
1069	22	35.6	2025
1074	22	30.4	2025
1035	22	15.0	2025
1048	22	24.2	2025
1060	22	15.8	2025
1079	22	27.6	2025
1026	22	38.4	2025
1054	22	26.5	2025
1068	22	33.6	2025
1027	22	36.4	2025
1064	22	20.0	2025
1052	22	22.6	2025
1062	22	45.7	2025
1047	22	25.0	2025
1666	22	12.5	2025
1640	22	0.0	2025
1664	22	9.5	2025
1647	22	2.8	2025
1670	22	4.5	2025
1636	22	0.0	2025
1674	22	29.6	2025
1679	22	6.5	2025
1642	22	0.0	2025
1655	22	0.0	2025
1665	22	7.9	2025
1684	22	11.9	2025
1633	22	5.7	2025
1661	22	0.0	2025
1673	22	4.6	2025
1634	22	10.1	2025
1669	22	18.5	2025
1659	22	8.4	2025
1667	22	0.0	2025
1654	22	5.9	2025
1611	22	25.0	2025
1585	22	12.8	2025
1609	22	8.9	2025
1592	22	18.7	2025
1615	22	19.4	2025
1581	22	24.0	2025
1619	22	9.2	2025
1624	22	0.0	2025
1587	22	0.0	2025
1600	22	16.0	2025
1610	22	8.4	2025
1629	22	20.0	2025
1578	22	19.8	2025
1606	22	15.2	2025
1618	22	7.6	2025
1579	22	15.7	2025
1614	22	19.7	2025
1604	22	10.3	2025
1612	22	20.8	2025
1599	22	19.3	2025
1004	24	29.4	2025
976	24	41.5	2025
1002	24	31.8	2025
972	24	30.9	2025
974	24	32.9	2025
975	24	27.5	2025
1011	24	35.2	2025
1005	24	32.8	2025
947	24	15.4	2025
919	24	16.5	2025
945	24	16.1	2025
915	24	17.3	2025
917	24	17.1	2025
918	24	14.3	2025
954	24	17.2	2025
948	24	15.6	2025
1061	24	20.9	2025
1033	24	13.8	2025
1059	24	21.5	2025
1029	24	21.1	2025
1031	24	33.8	2025
1032	24	22.2	2025
1068	24	24.4	2025
1062	24	32.9	2025
1666	24	10.1	2025
1640	24	0.0	2025
1664	24	29.1	2025
1636	24	0.0	2025
1638	24	13.2	2025
1639	24	0.0	2025
1673	24	0.0	2025
1667	24	0.0	2025
1611	24	19.5	2025
1585	24	10.3	2025
1609	24	0.0	2025
1581	24	17.7	2025
1583	24	29.1	2025
1584	24	24.6	2025
1618	24	13.1	2025
1612	24	13.6	2025
989	25	31.6	2025
932	25	17.8	2025
1046	25	13.9	2025
1653	25	31.9	2025
1598	25	4.0	2025
970	26	44.8	2025
913	26	19.7	2025
1027	26	26.4	2025
1634	26	0.0	2025
1579	26	21.9	2025
1008	28	36.7	2025
951	28	18.0	2025
1065	28	27.6	2025
1670	28	0.0	2025
1615	28	20.3	2025
1004	33	36.0	2025
947	33	15.5	2025
1061	33	16.3	2025
1666	33	26.2	2025
1611	33	17.1	2025
970	34	40.7	2025
913	34	19.6	2025
1027	34	30.8	2025
1634	34	0.0	2025
1579	34	40.1	2025
1003	38	41.4	2025
946	38	17.6	2025
1060	38	9.6	2025
1665	38	0.0	2025
1610	38	9.7	2025
1018	41	16.0	2025
961	41	9.8	2025
1075	41	26.7	2025
1680	41	0.0	2025
1625	41	26.7	2025
974	48	44.8	2025
917	48	17.4	2025
1031	48	24.3	2025
1638	48	0.0	2025
1583	48	25.7	2025
978	51	44.0	2025
970	51	37.8	2025
1005	51	34.3	2025
921	51	18.6	2025
913	51	19.1	2025
948	51	15.2	2025
1035	51	15.0	2025
1027	51	31.1	2025
1062	51	34.7	2025
1642	51	0.0	2025
1634	51	0.0	2025
1667	51	0.0	2025
1587	51	0.0	2025
1579	51	26.7	2025
1612	51	17.6	2025
978	53	42.6	2025
921	53	19.2	2025
1035	53	13.4	2025
1642	53	8.9	2025
1587	53	9.2	2025
978	55	35.1	2025
981	55	38.0	2025
970	55	35.8	2025
921	55	17.3	2025
924	55	18.2	2025
913	55	18.8	2025
1035	55	15.1	2025
1038	55	15.8	2025
1027	55	29.1	2025
1642	55	20.6	2025
1645	55	0.0	2025
1634	55	0.0	2025
1587	55	13.0	2025
1590	55	16.3	2025
1579	55	30.8	2025
1689	36	0.0	2025
25	36	10.4	2025
18	37	46.3	2025
23	37	50.3	2025
19	37	23.3	2025
20	37	10.8	2025
24	37	84.8	2025
22	37	92.0	2025
21	37	72.2	2025
1688	37	99.0	2025
1689	37	1.0	2025
25	37	39.6	2025
18	38	44.4	2025
23	38	91.7	2025
19	38	60.2	2025
20	38	30.2	2025
24	38	65.1	2025
22	38	28.6	2025
21	38	11.8	2025
1688	38	98.0	2025
1689	38	2.0	2025
25	38	43.4	2025
18	41	64.9	2025
23	41	87.3	2025
19	41	79.2	2025
20	41	24.2	2025
24	41	88.9	2025
22	41	46.0	2025
21	41	14.4	2025
1688	41	96.0	2025
1689	41	4.0	2025
25	41	34.8	2025
18	42	17.4	2025
23	42	10.6	2025
19	42	13.4	2025
20	42	22.4	2025
24	42	33.7	2025
22	42	24.0	2025
21	42	10.3	2025
1688	42	98.0	2025
1689	42	2.0	2025
25	42	1.0	2025
18	48	15.2	2025
23	48	91.2	2025
19	48	23.1	2025
20	48	11.0	2025
24	48	77.3	2025
22	48	33.5	2025
21	48	16.2	2025
1688	48	99.0	2025
1689	48	1.0	2025
25	48	27.3	2025
18	51	63.2	2025
23	51	63.4	2025
19	51	62.0	2025
20	51	25.6	2025
24	51	98.2	2025
22	51	36.1	2025
21	51	14.4	2025
1688	51	98.0	2025
1689	51	2.0	2025
25	51	46.4	2025
18	53	16.0	2025
23	53	38.4	2025
19	53	26.2	2025
20	53	52.2	2025
24	53	91.5	2025
22	53	21.8	2025
21	53	4.9	2025
1688	53	100.0	2025
1689	53	0.0	2025
25	53	36.4	2025
18	54	15.6	2025
23	54	44.6	2025
19	54	18.2	2025
20	54	17.0	2025
24	54	66.4	2025
22	54	16.0	2025
21	54	5.9	2025
1688	54	99.0	2025
1689	54	1.0	2025
25	54	8.3	2025
18	55	51.1	2025
23	55	67.7	2025
19	55	83.4	2025
20	55	10.0	2025
24	55	94.1	2025
22	55	80.2	2025
21	55	46.3	2025
1688	55	99.0	2025
1689	55	1.0	2025
25	55	22.5	2025
18	57	12.1	2025
23	57	64.5	2025
19	57	20.8	2025
20	57	12.7	2025
24	57	40.4	2025
22	57	41.1	2025
21	57	35.6	2025
1688	57	100.0	2025
1689	57	0.0	2025
25	57	22.5	2025
18	58	4.0	2025
23	58	0.0	2025
19	58	5.8	2025
20	58	23.6	2025
24	58	0.0	2025
22	58	1.2	2025
21	58	2.1	2025
1688	58	0.0	2025
1689	58	0.0	2025
25	58	7.4	2025
27	1	713.0	2018
27	1	745.0	2019
27	1	788.0	2020
27	1	800.0	2021
27	1	814.0	2022
27	1	801.0	2023
42	1	3093.0	2018
42	1	3203.0	2019
42	1	3460.0	2020
42	1	3709.0	2021
42	1	3911.0	2022
42	1	4090.0	2023
37	1	474.0	2018
37	1	445.0	2019
37	1	395.0	2020
37	1	335.0	2021
37	1	250.0	2022
37	1	176.0	2023
31	1	7533.0	2018
31	1	8009.0	2019
31	1	8702.0	2020
31	1	9197.0	2021
31	1	9604.0	2022
31	1	9923.0	2023
1691	1	12433.0	2018
1691	1	13076.0	2019
1691	1	14110.0	2020
1691	1	14887.0	2021
1691	1	15412.0	2022
1691	1	15339.0	2023
26	1	1.34073	2018
26	1	1.33939	2019
26	1	1.34197	2020
26	1	1.30033	2021
26	1	1.27142	2022
26	1	1.20949	2023
32	1	6999.0	2018
32	1	7461.0	2019
32	1	8101.0	2020
32	1	8754.0	2021
32	1	9142.0	2022
32	1	9532.0	2023
35	1	61.64133738601824	2018
35	1	62.051987546158855	2019
35	1	63.15860215053763	2020
35	1	64.87876094960009	2021
35	1	65.77136244594676	2022
35	1	65.58730913195889	2023
29	1	12634.0	2018
29	1	13295.0	2019
29	1	14389.0	2020
29	1	15302.0	2021
29	1	16012.0	2022
29	1	16451.0	2023
30	1	20.0	2018
30	1	23.0	2019
30	1	23.0	2020
30	1	22.0	2021
30	1	22.0	2022
30	1	22.0	2023
43	1	956.0	2018
43	1	973.0	2019
43	1	974.0	2020
43	1	918.0	2021
43	1	784.0	2022
43	1	606.0	2023
39	1	160.0	2018
39	1	161.0	2019
39	1	147.0	2020
39	1	146.0	2021
39	1	150.0	2022
39	1	115.0	2023
1690	1	2011.0	2018
1690	1	2303.0	2019
1690	1	2661.0	2020
1690	1	3125.0	2021
1690	1	3308.0	2022
1690	1	3323.0	2023
41	1	872.0	2018
41	1	1799.0	2019
41	1	2989.0	2020
41	1	4301.0	2021
41	1	5508.0	2022
41	1	5901.0	2023
34	1	7249.0	2018
34	1	7475.0	2019
34	1	7949.0	2020
34	1	8348.0	2021
34	1	8531.0	2022
34	1	8564.0	2023
28	1	13160.0	2018
28	1	13811.0	2019
28	1	14880.0	2020
28	1	15754.0	2021
28	1	16419.0	2022
28	1	16831.0	2023
36	1	8376.0	2018
36	1	8598.0	2019
36	1	9581.0	2020
36	1	10145.0	2021
36	1	10591.0	2022
36	1	10828.0	2023
38	1	3.92	2018
38	1	3.52	2019
38	1	2.9	2020
38	1	2.33	2021
38	1	1.67	2022
38	1	1.15	2023
27	2	150.0	2018
27	2	179.0	2019
27	2	213.0	2020
27	2	248.0	2021
27	2	264.0	2022
27	2	260.0	2023
42	2	637.0	2018
42	2	691.0	2019
42	2	771.0	2020
42	2	833.0	2021
42	2	913.0	2022
42	2	967.0	2023
37	2	92.0	2018
37	2	91.0	2019
37	2	92.0	2020
37	2	77.0	2021
37	2	65.0	2022
37	2	42.0	2023
31	2	1816.0	2018
31	2	2060.0	2019
31	2	2316.0	2020
31	2	2498.0	2021
31	2	2692.0	2022
31	2	2837.0	2023
1691	2	3205.0	2018
1691	2	3565.0	2019
1691	2	3995.0	2020
1691	2	4331.0	2021
1691	2	4574.0	2022
1691	2	4533.0	2023
26	2	0.86757	2018
26	2	0.88839	2019
26	2	0.92066	2020
26	2	0.94436	2021
26	2	0.91941	2022
26	2	0.91052	2023
32	2	1215.0	2018
32	2	1417.0	2019
32	2	1683.0	2020
32	2	1982.0	2021
32	2	2183.0	2022
32	2	2367.0	2023
35	2	56.357790119848	2018
35	2	57.7319587628866	2019
35	2	60.47225501770956	2020
35	2	63.51174934725849	2021
35	2	66.21181262729124	2022
35	2	67.79493269992082	2023
29	2	3310.0	2018
29	2	3678.0	2019
29	2	4126.0	2020
29	2	4489.0	2021
29	2	4796.0	2022
29	2	4945.0	2023
30	2	6.0	2018
30	2	6.0	2019
30	2	6.0	2020
30	2	6.0	2021
30	2	6.0	2022
30	2	6.0	2023
43	2	131.0	2018
43	2	137.0	2019
43	2	155.0	2020
43	2	143.0	2021
43	2	127.0	2022
43	2	93.0	2023
39	2	17.0	2018
39	2	17.0	2019
39	2	16.0	2020
39	2	17.0	2021
39	2	15.0	2022
39	2	13.0	2023
1690	2	379.0	2018
1690	2	500.0	2019
1690	2	658.0	2020
1690	2	831.0	2021
1690	2	946.0	2022
1690	2	1035.0	2023
41	2	223.0	2018
41	2	457.0	2019
41	2	753.0	2020
41	2	1080.0	2021
41	2	1397.0	2022
41	2	1538.0	2023
34	2	2006.0	2018
34	2	2194.0	2019
34	2	2359.0	2020
34	2	2441.0	2021
34	2	2536.0	2022
34	2	2535.0	2023
28	2	3421.0	2018
28	2	3783.0	2019
28	2	4235.0	2020
28	2	4596.0	2021
28	2	4910.0	2022
28	2	5052.0	2023
36	2	1782.0	2018
36	2	1963.0	2019
36	2	2132.0	2020
36	2	2263.0	2021
36	2	2422.0	2022
36	2	2539.0	2023
38	2	2.94	2018
38	2	2.62	2019
38	2	2.35	2020
38	2	1.81	2021
38	2	1.43	2022
38	2	0.9	2023
27	3	3.0	2018
27	3	5.0	2019
27	3	6.0	2020
27	3	5.0	2021
27	3	5.0	2022
27	3	4.0	2023
42	3	39.0	2018
42	3	49.0	2019
42	3	61.0	2020
42	3	63.0	2021
42	3	66.0	2022
42	3	61.0	2023
37	3	0.0	2018
37	3	0.0	2019
37	3	0.0	2020
37	3	0.0	2021
37	3	0.0	2022
37	3	0.0	2023
31	3	35.0	2018
31	3	48.0	2019
31	3	53.0	2020
31	3	59.0	2021
31	3	64.0	2022
31	3	59.0	2023
1691	3	108.0	2018
1691	3	135.0	2019
1691	3	169.0	2020
1691	3	198.0	2021
1691	3	205.0	2022
1691	3	175.0	2023
26	3	0.50742	2018
26	3	0.4998	2019
26	3	0.50814	2020
26	3	0.5055	2021
26	3	0.47298	2022
26	3	0.47746	2023
32	3	23.0	2018
32	3	32.0	2019
32	3	51.0	2020
32	3	66.0	2021
32	3	71.0	2022
32	3	69.0	2023
35	3	73.80952380952382	2018
35	3	71.16564417177914	2019
35	3	68.87755102040816	2020
35	3	73.91304347826087	2021
35	3	74.78991596638654	2022
35	3	74.54545454545455	2023
29	3	126.0	2018
29	3	163.0	2019
29	3	196.0	2020
29	3	230.0	2021
29	3	238.0	2022
29	3	220.0	2023
30	3	0.0	2018
30	3	0.0	2019
30	3	0.0	2020
30	3	0.0	2021
30	3	0.0	2022
30	3	0.0	2023
43	3	13.0	2018
43	3	14.0	2019
43	3	12.0	2020
43	3	7.0	2021
43	3	5.0	2022
43	3	3.0	2023
39	3	0.0	2018
39	3	0.0	2019
39	3	0.0	2020
39	3	0.0	2021
39	3	0.0	2022
39	3	0.0	2023
1690	3	20.0	2018
1690	3	26.0	2019
1690	3	37.0	2020
1690	3	48.0	2021
1690	3	49.0	2022
1690	3	40.0	2023
41	3	14.0	2018
41	3	24.0	2019
41	3	47.0	2020
41	3	73.0	2021
41	3	85.0	2022
41	3	84.0	2023
34	3	93.0	2018
34	3	119.0	2019
34	3	137.0	2020
34	3	153.0	2021
34	3	150.0	2022
34	3	135.0	2023
28	3	126.0	2018
28	3	163.0	2019
28	3	196.0	2020
28	3	230.0	2021
28	3	238.0	2022
28	3	220.0	2023
36	3	93.0	2018
36	3	119.0	2019
36	3	141.0	2020
36	3	148.0	2021
36	3	157.0	2022
36	3	148.0	2023
38	3	0.0	2018
38	3	0.0	2019
38	3	0.0	2020
38	3	0.0	2021
38	3	0.0	2022
38	3	0.0	2023
27	4	95.0	2018
27	4	102.0	2019
27	4	117.0	2020
27	4	117.0	2021
27	4	126.0	2022
27	4	142.0	2023
42	4	148.0	2018
42	4	170.0	2019
42	4	202.0	2020
42	4	230.0	2021
42	4	242.0	2022
42	4	296.0	2023
37	4	35.0	2018
37	4	35.0	2019
37	4	32.0	2020
37	4	28.0	2021
37	4	21.0	2022
37	4	14.0	2023
31	4	691.0	2018
31	4	783.0	2019
31	4	943.0	2020
31	4	1104.0	2021
31	4	1308.0	2022
31	4	1559.0	2023
1691	4	1197.0	2018
1691	4	1385.0	2019
1691	4	1618.0	2020
1691	4	1841.0	2021
1691	4	2051.0	2022
1691	4	2255.0	2023
26	4	1.07469	2018
26	4	1.05866	2019
26	4	1.02947	2020
26	4	0.95499	2021
26	4	1.00313	2022
26	4	1.08523	2023
32	4	582.0	2018
32	4	688.0	2019
32	4	858.0	2020
32	4	1042.0	2021
32	4	1213.0	2022
32	4	1441.0	2023
35	4	50.54347826086957	2018
35	4	53.58819584171697	2019
35	4	57.2405929304447	2020
35	4	60.6524962926347	2021
35	4	62.44029526704298	2022
35	4	63.2314080785202	2023
29	4	1286.0	2018
29	4	1481.0	2019
29	4	1730.0	2020
29	4	1990.0	2021
29	4	2261.0	2022
29	4	2601.0	2023
30	4	1.0	2018
30	4	3.0	2019
30	4	3.0	2020
30	4	3.0	2021
30	4	3.0	2022
30	4	3.0	2023
43	4	115.0	2018
43	4	135.0	2019
43	4	133.0	2020
43	4	128.0	2021
43	4	128.0	2022
43	4	102.0	2023
39	4	8.0	2018
39	4	10.0	2019
39	4	12.0	2020
39	4	11.0	2021
39	4	10.0	2022
39	4	8.0	2023
1690	4	179.0	2018
1690	4	221.0	2019
1690	4	301.0	2020
1690	4	388.0	2021
1690	4	483.0	2022
1690	4	554.0	2023
41	4	83.0	2018
41	4	187.0	2019
41	4	295.0	2020
41	4	466.0	2021
41	4	655.0	2022
41	4	755.0	2023
34	4	759.0	2018
34	4	867.0	2019
34	4	983.0	2020
34	4	1104.0	2021
34	4	1209.0	2022
34	4	1360.0	2023
28	4	1288.0	2018
28	4	1491.0	2019
28	4	1754.0	2020
28	4	2023.0	2021
28	4	2303.0	2022
28	4	2649.0	2023
36	4	519.0	2018
36	4	595.0	2019
36	4	677.0	2020
36	4	765.0	2021
36	4	835.0	2022
36	4	947.0	2023
38	4	3.44	2018
38	4	2.95	2019
38	4	2.28	2020
38	4	1.73	2021
38	4	1.14	2022
38	4	0.66	2023
27	5	2.0	2018
27	5	2.0	2019
27	5	3.0	2020
27	5	5.0	2021
27	5	10.0	2022
27	5	10.0	2023
42	5	3.0	2018
42	5	23.0	2019
42	5	31.0	2020
42	5	36.0	2021
42	5	69.0	2022
42	5	83.0	2023
37	5	2.0	2018
37	5	2.0	2019
37	5	2.0	2020
37	5	1.0	2021
37	5	0.0	2022
37	5	0.0	2023
31	5	21.0	2018
31	5	42.0	2019
31	5	67.0	2020
31	5	86.0	2021
31	5	129.0	2022
31	5	154.0	2023
1691	5	47.0	2018
1691	5	91.0	2019
1691	5	129.0	2020
1691	5	159.0	2021
1691	5	219.0	2022
1691	5	253.0	2023
26	5	0.55851	2018
26	5	0.51426	2019
26	5	0.60554	2020
26	5	0.66771	2021
26	5	0.84129	2022
26	5	0.97918	2023
32	5	6.0	2018
32	5	13.0	2019
32	5	25.0	2020
32	5	38.0	2021
32	5	69.0	2022
32	5	98.0	2023
35	5	62.5	2018
35	5	68.08510638297872	2019
35	5	72.38805970149252	2020
35	5	73.49397590361446	2021
35	5	75.0	2022
35	5	75.95818815331009	2023
29	5	48.0	2018
29	5	94.0	2019
29	5	134.0	2020
29	5	166.0	2021
29	5	244.0	2022
29	5	287.0	2023
30	5	0.0	2018
30	5	0.0	2019
30	5	0.0	2020
30	5	0.0	2021
30	5	0.0	2022
30	5	0.0	2023
43	5	0.0	2018
43	5	1.0	2019
43	5	2.0	2020
43	5	3.0	2021
43	5	3.0	2022
43	5	3.0	2023
39	5	0.0	2018
39	5	0.0	2019
39	5	0.0	2020
39	5	0.0	2021
39	5	0.0	2022
39	5	0.0	2023
1690	5	7.0	2018
1690	5	12.0	2019
1690	5	21.0	2020
1690	5	27.0	2021
1690	5	37.0	2022
1690	5	49.0	2023
41	5	3.0	2018
41	5	19.0	2019
41	5	28.0	2020
41	5	37.0	2021
41	5	62.0	2022
41	5	84.0	2023
34	5	6.0	2018
34	5	24.0	2019
34	5	37.0	2020
34	5	52.0	2021
34	5	88.0	2022
34	5	103.0	2023
28	5	48.0	2018
28	5	94.0	2019
28	5	134.0	2020
28	5	166.0	2021
28	5	244.0	2022
28	5	287.0	2023
36	5	26.0	2018
36	5	58.0	2019
36	5	86.0	2020
36	5	100.0	2021
36	5	157.0	2022
36	5	195.0	2023
38	5	4.44	2018
38	5	2.27	2019
38	5	1.59	2020
38	5	0.65	2021
38	5	0.0	2022
38	5	0.0	2023
27	6	31.0	2018
27	6	31.0	2019
27	6	36.0	2020
27	6	43.0	2021
27	6	41.0	2022
27	6	45.0	2023
42	6	162.0	2018
42	6	187.0	2019
42	6	206.0	2020
42	6	230.0	2021
42	6	245.0	2022
42	6	268.0	2023
37	6	0.0	2018
37	6	0.0	2019
37	6	0.0	2020
37	6	0.0	2021
37	6	0.0	2022
37	6	0.0	2023
31	6	196.0	2018
31	6	216.0	2019
31	6	260.0	2020
31	6	300.0	2021
31	6	312.0	2022
31	6	360.0	2023
1691	6	547.0	2018
1691	6	631.0	2019
1691	6	725.0	2020
1691	6	829.0	2021
1691	6	878.0	2022
1691	6	925.0	2023
26	6	0.77203	2018
26	6	0.78264	2019
26	6	0.76264	2020
26	6	0.78749	2021
26	6	0.7267	2022
26	6	0.73447	2023
32	6	143.0	2018
32	6	168.0	2019
32	6	214.0	2020
32	6	278.0	2021
32	6	306.0	2022
32	6	372.0	2023
35	6	63.80165289256198	2018
35	6	64.41893830703013	2019
35	6	67.78017241379311	2021
35	6	69.96996996996997	2022
35	6	68.25539568345324	2023
29	6	602.0	2018
29	6	691.0	2019
29	6	793.0	2020
29	6	922.0	2021
29	6	993.0	2022
29	6	1107.0	2023
30	6	1.0	2018
30	6	1.0	2019
30	6	1.0	2020
30	6	1.0	2021
30	6	1.0	2022
30	6	1.0	2023
43	6	52.0	2018
43	6	48.0	2019
43	6	58.0	2020
43	6	56.0	2021
43	6	49.0	2022
43	6	37.0	2023
39	6	0.0	2018
39	6	0.0	2019
39	6	0.0	2020
39	6	0.0	2021
39	6	0.0	2022
39	6	0.0	2023
1690	6	75.0	2018
1690	6	109.0	2019
1690	6	131.0	2020
1690	6	177.0	2021
1690	6	208.0	2022
1690	6	212.0	2023
41	6	56.0	2018
41	6	123.0	2019
41	6	178.0	2020
41	6	269.0	2021
41	6	369.0	2022
41	6	421.0	2023
34	6	426.0	2018
34	6	485.0	2019
34	6	549.0	2020
34	6	614.0	2021
34	6	643.0	2022
34	6	691.0	2023
28	6	605.0	2018
28	6	697.0	2019
28	6	800.0	2020
28	6	928.0	2021
28	6	999.0	2022
28	6	1112.0	2023
36	6	365.0	2018
36	6	419.0	2019
36	6	486.0	2020
36	6	541.0	2021
36	6	564.0	2022
36	6	638.0	2023
38	6	0.0	2018
38	6	0.0	2019
38	6	0.0	2020
38	6	0.0	2021
38	6	0.0	2022
38	6	0.0	2023
27	7	11.0	2018
27	7	12.0	2019
27	7	15.0	2020
27	7	22.0	2021
27	7	27.0	2022
27	7	26.0	2023
42	7	91.0	2018
42	7	104.0	2019
42	7	111.0	2020
42	7	116.0	2021
42	7	132.0	2022
42	7	138.0	2023
37	7	10.0	2018
37	7	12.0	2019
37	7	11.0	2020
37	7	6.0	2021
37	7	6.0	2022
37	7	4.0	2023
31	7	188.0	2018
31	7	218.0	2019
31	7	287.0	2020
31	7	364.0	2021
31	7	440.0	2022
31	7	460.0	2023
1691	7	369.0	2018
1691	7	437.0	2019
1691	7	540.0	2020
1691	7	646.0	2021
1691	7	732.0	2022
1691	7	739.0	2023
26	7	0.76076	2018
26	7	0.7407	2019
26	7	0.68605	2020
26	7	0.75288	2021
26	7	0.79843	2022
26	7	0.76796	2023
32	7	150.0	2018
32	7	171.0	2019
32	7	214.0	2020
32	7	279.0	2021
32	7	341.0	2022
32	7	363.0	2023
35	7	63.58974358974359	2018
35	7	67.10526315789474	2019
35	7	67.85079928952042	2020
35	7	70.34277198211625	2021
35	7	71.96382428940568	2022
35	7	72.42647058823529	2023
29	7	390.0	2018
29	7	456.0	2019
29	7	563.0	2020
29	7	671.0	2021
29	7	774.0	2022
29	7	816.0	2023
30	7	0.0	2018
30	7	0.0	2019
30	7	0.0	2020
30	7	0.0	2021
30	7	0.0	2022
30	7	0.0	2023
43	7	12.0	2018
43	7	12.0	2019
43	7	11.0	2020
43	7	13.0	2021
43	7	11.0	2022
43	7	9.0	2023
39	7	0.0	2018
39	7	0.0	2019
39	7	0.0	2020
39	7	0.0	2021
39	7	0.0	2022
39	7	0.0	2023
1690	7	48.0	2018
1690	7	62.0	2019
1690	7	85.0	2020
1690	7	140.0	2021
1690	7	165.0	2022
1690	7	175.0	2023
41	7	31.0	2018
41	7	63.0	2019
41	7	119.0	2020
41	7	196.0	2021
41	7	263.0	2022
41	7	275.0	2023
34	7	221.0	2018
34	7	234.0	2019
34	7	292.0	2020
34	7	327.0	2021
34	7	361.0	2022
34	7	369.0	2023
28	7	390.0	2018
28	7	456.0	2019
28	7	563.0	2020
28	7	671.0	2021
28	7	774.0	2022
28	7	816.0	2023
36	7	259.0	2018
36	7	304.0	2019
36	7	343.0	2020
36	7	369.0	2021
36	7	410.0	2022
36	7	432.0	2023
38	7	2.7	2018
38	7	2.78	2019
38	7	2.07	2020
38	7	0.95	2021
38	7	0.82	2022
38	7	0.52	2023
27	8	139.0	2018
27	8	139.0	2019
27	8	156.0	2020
27	8	161.0	2021
27	8	163.0	2022
27	8	172.0	2023
42	8	779.0	2018
42	8	831.0	2019
42	8	907.0	2020
42	8	970.0	2021
42	8	1047.0	2022
42	8	1112.0	2023
37	8	87.0	2018
37	8	86.0	2019
37	8	78.0	2020
37	8	62.0	2021
37	8	49.0	2022
37	8	32.0	2023
31	8	1887.0	2018
31	8	2111.0	2019
31	8	2467.0	2020
31	8	2772.0	2021
31	8	2983.0	2022
31	8	3006.0	2023
1691	8	3084.0	2018
1691	8	3397.0	2019
1691	8	3883.0	2020
1691	8	4319.0	2021
1691	8	4605.0	2022
1691	8	4581.0	2023
26	8	0.94407	2018
26	8	0.95487	2019
26	8	0.9719	2020
26	8	0.97012	2021
26	8	0.95717	2022
26	8	0.94005	2023
32	8	1645.0	2018
32	8	1833.0	2019
32	8	2114.0	2020
32	8	2394.0	2021
32	8	2606.0	2022
32	8	2669.0	2023
35	8	59.91952955741257	2018
35	8	61.178460670989566	2019
35	8	62.68472906403941	2020
35	8	64.11441144114411	2021
35	8	65.80565805658057	2022
35	8	66.19323864772954	2023
29	8	3066.0	2018
29	8	3394.0	2019
29	8	3918.0	2020
29	8	4424.0	2021
29	8	4753.0	2022
29	8	4871.0	2023
30	8	7.0	2018
30	8	7.0	2019
30	8	7.0	2020
30	8	7.0	2021
30	8	7.0	2022
30	8	7.0	2023
43	8	267.0	2018
43	8	266.0	2019
43	8	259.0	2020
43	8	229.0	2021
43	8	191.0	2022
43	8	137.0	2023
39	8	14.0	2018
39	8	15.0	2019
39	8	20.0	2020
39	8	21.0	2021
39	8	19.0	2022
39	8	17.0	2023
1690	8	604.0	2018
1690	8	740.0	2019
1690	8	868.0	2020
1690	8	1059.0	2021
1690	8	1188.0	2022
1690	8	1189.0	2023
41	8	277.0	2018
41	8	576.0	2019
41	8	967.0	2020
41	8	1402.0	2021
41	8	1773.0	2022
41	8	1874.0	2023
34	8	1828.0	2018
34	8	1933.0	2019
34	8	2108.0	2020
34	8	2294.0	2021
34	8	2405.0	2022
34	8	2425.0	2023
28	8	3231.0	2018
28	8	3547.0	2019
28	8	4060.0	2020
28	8	4545.0	2021
28	8	4878.0	2022
28	8	4999.0	2023
36	8	2141.0	2018
36	8	2229.0	2019
36	8	2389.0	2020
36	8	2555.0	2021
36	8	2754.0	2022
36	8	2886.0	2023
38	8	2.82	2018
38	8	2.54	2019
38	8	2.03	2020
38	8	1.44	2021
38	8	1.07	2022
38	8	0.68	2023
27	9	67.0	2018
27	9	79.0	2019
27	9	96.0	2020
27	9	110.0	2021
27	9	124.0	2022
27	9	121.0	2023
42	9	227.0	2018
42	9	262.0	2019
42	9	293.0	2020
42	9	335.0	2021
42	9	380.0	2022
42	9	433.0	2023
37	9	75.0	2018
37	9	90.0	2019
37	9	92.0	2020
37	9	84.0	2021
37	9	70.0	2022
37	9	53.0	2023
31	9	1466.0	2018
31	9	1791.0	2019
31	9	2011.0	2020
31	9	2222.0	2021
31	9	2416.0	2022
31	9	2566.0	2023
1691	9	2021.0	2018
1691	9	2390.0	2019
1691	9	2692.0	2020
1691	9	3005.0	2021
1691	9	3262.0	2022
1691	9	3377.0	2023
26	9	0.93469	2018
26	9	1.06318	2019
26	9	1.08122	2020
26	9	1.08026	2021
26	9	1.09211	2022
26	9	1.11963	2023
32	9	900.0	2018
32	9	1151.0	2019
32	9	1369.0	2020
32	9	1632.0	2021
32	9	1749.0	2022
32	9	1827.0	2023
35	9	54.72875660105617	2018
35	9	56.28815628815629	2019
35	9	59.840232389252	2020
35	9	64.11172458590451	2021
35	9	67.09465512093162	2022
35	9	69.13614760972881	2023
29	9	2083.0	2018
29	9	2457.0	2019
29	9	2754.0	2020
29	9	3079.0	2021
29	9	3349.0	2022
29	9	3577.0	2023
30	9	0.0	2018
30	9	0.0	2019
30	9	0.0	2020
30	9	0.0	2021
30	9	0.0	2022
30	9	0.0	2023
43	9	116.0	2018
43	9	139.0	2019
43	9	141.0	2020
43	9	144.0	2021
43	9	129.0	2022
43	9	101.0	2023
39	9	4.0	2018
39	9	6.0	2019
39	9	9.0	2020
39	9	11.0	2021
39	9	11.0	2022
39	9	8.0	2023
1690	9	410.0	2018
1690	9	571.0	2019
1690	9	728.0	2020
1690	9	910.0	2021
1690	9	1020.0	2022
1690	9	1058.0	2023
41	9	174.0	2018
41	9	371.0	2019
41	9	592.0	2020
41	9	854.0	2021
41	9	1128.0	2022
41	9	1247.0	2023
34	9	816.0	2018
34	9	905.0	2019
34	9	987.0	2020
34	9	1092.0	2021
34	9	1169.0	2022
34	9	1200.0	2023
28	9	2083.0	2018
28	9	2457.0	2019
28	9	2754.0	2020
28	9	3079.0	2021
28	9	3349.0	2022
28	9	3577.0	2023
36	9	618.0	2018
36	9	726.0	2019
36	9	758.0	2020
36	9	852.0	2021
36	9	952.0	2022
36	9	1074.0	2023
38	9	3.86	2018
38	9	3.95	2019
38	9	3.6	2020
38	9	2.95	2021
38	9	2.26	2022
38	9	1.59	2023
27	10	14.0	2018
27	10	16.0	2019
27	10	20.0	2020
27	10	28.0	2021
27	10	36.0	2022
27	10	39.0	2023
42	10	71.0	2018
42	10	102.0	2019
42	10	122.0	2020
42	10	154.0	2021
42	10	189.0	2022
42	10	205.0	2023
37	10	24.0	2018
37	10	28.0	2019
37	10	26.0	2020
37	10	19.0	2021
37	10	18.0	2022
37	10	9.0	2023
31	10	224.0	2018
31	10	281.0	2019
31	10	355.0	2020
31	10	484.0	2021
31	10	635.0	2022
31	10	758.0	2023
1691	10	462.0	2018
1691	10	595.0	2019
1691	10	735.0	2020
1691	10	949.0	2021
1691	10	1148.0	2022
1691	10	1242.0	2023
26	10	0.73022	2018
26	10	0.71965	2019
26	10	0.74639	2020
26	10	0.70513	2021
26	10	0.79295	2022
26	10	0.79748	2023
32	10	168.0	2018
32	10	222.0	2019
32	10	279.0	2020
32	10	374.0	2021
32	10	492.0	2022
32	10	617.0	2023
35	10	60.676532769556026	2018
35	10	63.888888888888886	2019
35	10	64.69816272965879	2020
35	10	66.08961303462321	2021
35	10	69.90856192851204	2022
35	10	71.47988505747126	2023
29	10	473.0	2018
29	10	612.0	2019
29	10	762.0	2020
29	10	982.0	2021
29	10	1203.0	2022
29	10	1392.0	2023
30	10	0.0	2018
30	10	0.0	2019
30	10	0.0	2020
30	10	0.0	2021
30	10	0.0	2022
30	10	0.0	2023
43	10	16.0	2018
43	10	16.0	2019
43	10	22.0	2020
43	10	19.0	2021
43	10	15.0	2022
43	10	11.0	2023
39	10	0.0	2018
39	10	0.0	2019
39	10	2.0	2020
39	10	7.0	2021
39	10	16.0	2022
39	10	23.0	2023
1690	10	85.0	2018
1690	10	106.0	2019
1690	10	143.0	2020
1690	10	183.0	2021
1690	10	245.0	2022
1690	10	293.0	2023
41	10	53.0	2018
41	10	106.0	2019
41	10	168.0	2020
41	10	251.0	2021
41	10	347.0	2022
41	10	399.0	2023
34	10	245.0	2018
34	10	311.0	2019
34	10	379.0	2020
34	10	451.0	2021
34	10	527.0	2022
34	10	600.0	2023
28	10	473.0	2018
28	10	612.0	2019
28	10	762.0	2020
28	10	982.0	2021
28	10	1203.0	2022
28	10	1392.0	2023
36	10	221.0	2018
36	10	284.0	2019
36	10	333.0	2020
36	10	417.0	2021
36	10	491.0	2022
36	10	543.0	2023
38	10	5.67	2018
38	10	5.08	2019
38	10	3.76	2020
38	10	2.11	2021
38	10	1.64	2022
38	10	0.7	2023
27	11	0.0	2018
27	11	0.0	2019
27	11	0.0	2020
27	11	0.0	2021
27	11	0.0	2022
27	11	0.0	2023
42	11	0.0	2018
42	11	2.0	2019
42	11	3.0	2020
42	11	5.0	2021
42	11	5.0	2022
42	11	6.0	2023
37	11	0.0	2018
37	11	0.0	2019
37	11	0.0	2020
37	11	0.0	2021
37	11	0.0	2022
37	11	0.0	2023
31	11	0.0	2018
31	11	1.0	2019
31	11	1.0	2020
31	11	1.0	2021
31	11	3.0	2022
31	11	5.0	2023
1691	11	1.0	2018
1691	11	3.0	2019
1691	11	4.0	2020
1691	11	5.0	2021
1691	11	5.0	2022
1691	11	5.0	2023
26	11	0.65771	2018
26	11	0.32885	2019
26	11	0.21924	2020
26	11	0.28701	2021
26	11	0.36838	2022
26	11	0.26313	2023
32	11	0.0	2018
32	11	0.0	2019
32	11	1.0	2020
32	11	1.0	2021
32	11	1.0	2022
32	11	2.0	2023
35	11	100.0	2018
35	11	66.66666666666666	2019
35	11	75.0	2020
35	11	80.0	2021
35	11	83.33333333333333	2022
35	11	87.5	2023
29	11	1.0	2018
29	11	3.0	2019
29	11	4.0	2020
29	11	5.0	2021
29	11	6.0	2022
29	11	8.0	2023
30	11	0.0	2018
30	11	0.0	2019
30	11	0.0	2020
30	11	0.0	2021
30	11	0.0	2022
30	11	0.0	2023
43	11	0.0	2018
43	11	0.0	2019
43	11	0.0	2020
43	11	0.0	2021
43	11	0.0	2022
43	11	0.0	2023
39	11	0.0	2018
39	11	0.0	2019
39	11	0.0	2020
39	11	0.0	2021
39	11	0.0	2022
39	11	0.0	2023
1690	11	0.0	2018
1690	11	0.0	2019
1690	11	0.0	2020
1690	11	0.0	2021
1690	11	0.0	2022
1690	11	0.0	2023
41	11	0.0	2018
41	11	2.0	2019
41	11	2.0	2020
41	11	2.0	2021
41	11	2.0	2022
41	11	3.0	2023
34	11	1.0	2018
34	11	3.0	2019
34	11	3.0	2020
34	11	3.0	2021
34	11	3.0	2022
34	11	3.0	2023
28	11	1.0	2018
28	11	3.0	2019
28	11	4.0	2020
28	11	5.0	2021
28	11	6.0	2022
28	11	8.0	2023
36	11	1.0	2018
36	11	4.0	2019
36	11	5.0	2020
36	11	8.0	2021
36	11	9.0	2022
36	11	11.0	2023
38	11	0.0	2018
38	11	0.0	2019
38	11	0.0	2020
38	11	0.0	2021
38	11	0.0	2022
38	11	0.0	2023
27	12	4.0	2018
27	12	6.0	2019
27	12	8.0	2020
27	12	6.0	2021
27	12	9.0	2022
27	12	9.0	2023
42	12	20.0	2018
42	12	32.0	2019
42	12	49.0	2020
42	12	64.0	2021
42	12	83.0	2022
42	12	97.0	2023
37	12	0.0	2018
37	12	0.0	2019
37	12	0.0	2020
37	12	0.0	2021
37	12	0.0	2022
37	12	0.0	2023
31	12	23.0	2018
31	12	45.0	2019
31	12	68.0	2020
31	12	108.0	2021
31	12	145.0	2022
31	12	176.0	2023
1691	12	69.0	2018
1691	12	115.0	2019
1691	12	167.0	2020
1691	12	231.0	2021
1691	12	293.0	2022
1691	12	355.0	2023
26	12	0.6206	2018
26	12	0.78464	2019
26	12	0.78619	2020
26	12	0.67948	2021
26	12	0.65885	2022
26	12	0.58086	2023
32	12	17.0	2018
32	12	25.0	2019
32	12	36.0	2020
32	12	45.0	2021
32	12	60.0	2022
32	12	86.0	2023
35	12	73.17073170731707	2018
35	12	73.84615384615384	2019
35	12	75.93582887700535	2020
35	12	79.45736434108527	2021
35	12	81.95718654434249	2022
35	12	82.22748815165875	2023
29	12	73.0	2018
29	12	123.0	2019
29	12	180.0	2020
29	12	255.0	2021
29	12	325.0	2022
29	12	420.0	2023
30	12	1.0	2018
30	12	1.0	2019
30	12	1.0	2020
30	12	1.0	2021
30	12	1.0	2022
30	12	1.0	2023
43	12	2.0	2018
43	12	4.0	2019
43	12	6.0	2020
43	12	8.0	2021
43	12	8.0	2022
43	12	7.0	2023
39	12	0.0	2018
39	12	0.0	2019
39	12	0.0	2020
39	12	0.0	2021
39	12	0.0	2022
39	12	0.0	2023
1690	12	7.0	2018
1690	12	10.0	2019
1690	12	15.0	2020
1690	12	39.0	2021
1690	12	52.0	2022
1690	12	62.0	2023
41	12	5.0	2018
41	12	19.0	2019
41	12	45.0	2020
41	12	73.0	2021
41	12	101.0	2022
41	12	128.0	2023
34	12	49.0	2018
34	12	75.0	2019
34	12	106.0	2020
34	12	128.0	2021
34	12	151.0	2022
34	12	196.0	2023
28	12	82.0	2018
28	12	130.0	2019
28	12	187.0	2020
28	12	258.0	2021
28	12	327.0	2022
28	12	422.0	2023
36	12	57.0	2018
36	12	89.0	2019
36	12	128.0	2020
36	12	164.0	2021
36	12	207.0	2022
36	12	259.0	2023
38	12	0.0	2018
38	12	0.0	2019
38	12	0.0	2020
38	12	0.0	2021
38	12	0.0	2022
38	12	0.0	2023
27	13	22.0	2018
27	13	40.0	2019
27	13	46.0	2020
27	13	55.0	2021
27	13	68.0	2022
27	13	71.0	2023
42	13	168.0	2018
42	13	189.0	2019
42	13	228.0	2020
42	13	279.0	2021
42	13	315.0	2022
42	13	330.0	2023
37	13	13.0	2018
37	13	19.0	2019
37	13	18.0	2020
37	13	15.0	2021
37	13	11.0	2022
37	13	9.0	2023
31	13	386.0	2018
31	13	545.0	2019
31	13	763.0	2020
31	13	1027.0	2021
31	13	1213.0	2022
31	13	1352.0	2023
1691	13	700.0	2018
1691	13	939.0	2019
1691	13	1230.0	2020
1691	13	1605.0	2021
1691	13	1893.0	2022
1691	13	2019.0	2023
26	13	0.94222	2018
26	13	1.06849	2019
26	13	1.0193	2020
26	13	0.99498	2021
26	13	1.00063	2022
26	13	0.98189	2023
32	13	264.0	2018
32	13	373.0	2019
32	13	520.0	2020
32	13	741.0	2021
32	13	894.0	2022
32	13	1031.0	2023
35	13	50.608930987821374	2018
35	13	55.214723926380366	2019
35	13	59.04463586530932	2020
35	13	62.10400478182905	2021
35	13	64.45115810674723	2022
35	13	65.26891522333636	2023
29	13	739.0	2018
29	13	978.0	2019
29	13	1277.0	2020
29	13	1673.0	2021
29	13	1986.0	2022
29	13	2194.0	2023
30	13	0.0	2018
30	13	0.0	2019
30	13	0.0	2020
30	13	0.0	2021
30	13	0.0	2022
30	13	0.0	2023
43	13	39.0	2018
43	13	48.0	2019
43	13	48.0	2020
43	13	54.0	2021
43	13	46.0	2022
43	13	33.0	2023
39	13	7.0	2018
39	13	9.0	2019
39	13	11.0	2020
39	13	13.0	2021
39	13	16.0	2022
39	13	14.0	2023
1690	13	81.0	2018
1690	13	147.0	2019
1690	13	270.0	2020
1690	13	407.0	2021
1690	13	485.0	2022
1690	13	538.0	2023
41	13	68.0	2018
41	13	166.0	2019
41	13	285.0	2020
41	13	459.0	2021
41	13	606.0	2022
41	13	670.0	2023
34	13	368.0	2018
34	13	460.0	2019
34	13	607.0	2020
34	13	769.0	2021
34	13	868.0	2022
34	13	931.0	2023
28	13	739.0	2018
28	13	978.0	2019
28	13	1277.0	2020
28	13	1673.0	2021
28	13	1986.0	2022
28	13	2194.0	2023
36	13	447.0	2018
36	13	522.0	2019
36	13	620.0	2020
36	13	744.0	2021
36	13	815.0	2022
36	13	867.0	2023
38	13	1.98	2018
38	13	2.2	2019
38	13	1.58	2020
38	13	1.0	2021
38	13	0.62	2022
38	13	0.46	2023
27	14	31.0	2018
27	14	34.0	2019
27	14	38.0	2020
27	14	43.0	2021
27	14	53.0	2022
27	14	57.0	2023
42	14	195.0	2018
42	14	249.0	2019
42	14	284.0	2020
42	14	333.0	2021
42	14	408.0	2022
42	14	435.0	2023
37	14	13.0	2018
37	14	15.0	2019
37	14	11.0	2020
37	14	7.0	2021
37	14	7.0	2022
37	14	3.0	2023
31	14	335.0	2018
31	14	430.0	2019
31	14	518.0	2020
31	14	606.0	2021
31	14	717.0	2022
31	14	841.0	2023
1691	14	758.0	2018
1691	14	943.0	2019
1691	14	1143.0	2020
1691	14	1325.0	2021
1691	14	1487.0	2022
1691	14	1597.0	2023
26	14	0.68585	2018
26	14	0.70575	2019
26	14	0.7	2020
26	14	0.74036	2021
26	14	0.74943	2022
26	14	0.73595	2023
32	14	192.0	2018
32	14	245.0	2019
32	14	324.0	2020
32	14	415.0	2021
32	14	493.0	2022
32	14	598.0	2023
35	14	60.799001248439446	2018
35	14	61.46881287726358	2019
35	14	62.45874587458746	2020
35	14	64.43812233285917	2021
35	14	66.29422718808193	2022
35	14	69.543429844098	2023
29	14	801.0	2018
29	14	994.0	2019
29	14	1212.0	2020
29	14	1406.0	2021
29	14	1611.0	2022
29	14	1796.0	2023
30	14	0.0	2018
30	14	0.0	2019
30	14	0.0	2020
30	14	0.0	2021
30	14	0.0	2022
30	14	0.0	2023
43	14	29.0	2018
43	14	30.0	2019
43	14	31.0	2020
43	14	40.0	2021
43	14	39.0	2022
43	14	32.0	2023
39	14	7.0	2018
39	14	11.0	2019
39	14	11.0	2020
39	14	10.0	2021
39	14	7.0	2022
39	14	8.0	2023
1690	14	80.0	2018
1690	14	116.0	2019
1690	14	157.0	2020
1690	14	218.0	2021
1690	14	274.0	2022
1690	14	332.0	2023
41	14	81.0	2018
41	14	164.0	2019
41	14	285.0	2020
41	14	414.0	2021
41	14	554.0	2022
41	14	622.0	2023
34	14	499.0	2018
34	14	588.0	2019
34	14	695.0	2020
34	14	754.0	2021
34	14	840.0	2022
34	14	896.0	2023
28	14	801.0	2018
28	14	994.0	2019
28	14	1212.0	2020
28	14	1406.0	2021
28	14	1611.0	2022
28	14	1796.0	2023
36	14	553.0	2018
36	14	652.0	2019
36	14	749.0	2020
36	14	850.0	2021
36	14	972.0	2022
36	14	1068.0	2023
38	14	1.76	2018
38	14	1.62	2019
38	14	0.99	2020
38	14	0.54	2021
38	14	0.48	2022
38	14	0.18	2023
27	15	16.0	2018
27	15	19.0	2019
27	15	42.0	2020
27	15	53.0	2021
27	15	75.0	2022
27	15	95.0	2023
42	15	154.0	2018
42	15	227.0	2019
42	15	273.0	2020
42	15	350.0	2021
42	15	408.0	2022
42	15	458.0	2023
37	15	11.0	2018
37	15	15.0	2019
37	15	21.0	2020
37	15	24.0	2021
37	15	21.0	2022
37	15	16.0	2023
31	15	306.0	2018
31	15	468.0	2019
31	15	747.0	2020
31	15	1038.0	2021
31	15	1392.0	2022
31	15	1705.0	2023
1691	15	590.0	2018
1691	15	847.0	2019
1691	15	1243.0	2020
1691	15	1721.0	2021
1691	15	2238.0	2022
1691	15	2576.0	2023
26	15	0.92187	2018
26	15	0.85796	2019
26	15	0.83587	2020
26	15	0.80663	2021
26	15	0.86494	2022
26	15	0.86628	2023
32	15	161.0	2018
32	15	237.0	2019
32	15	369.0	2020
32	15	571.0	2021
32	15	796.0	2022
32	15	1004.0	2023
35	15	65.28	2018
35	15	65.95505617977528	2019
35	15	67.88990825688073	2020
35	15	70.6371191135734	2021
35	15	71.37420718816068	2022
35	15	71.22557726465364	2023
29	15	625.0	2018
29	15	890.0	2019
29	15	1308.0	2020
29	15	1805.0	2021
29	15	2365.0	2022
29	15	2815.0	2023
30	15	0.0	2018
30	15	0.0	2019
30	15	0.0	2020
30	15	0.0	2021
30	15	0.0	2022
30	15	0.0	2023
43	15	33.0	2018
43	15	42.0	2019
43	15	48.0	2020
43	15	54.0	2021
43	15	57.0	2022
43	15	50.0	2023
39	15	8.0	2018
39	15	10.0	2019
39	15	12.0	2020
39	15	12.0	2021
39	15	11.0	2022
39	15	10.0	2023
1690	15	101.0	2018
1690	15	149.0	2019
1690	15	239.0	2020
1690	15	417.0	2021
1690	15	613.0	2022
1690	15	726.0	2023
41	15	72.0	2018
41	15	190.0	2019
41	15	374.0	2020
41	15	599.0	2021
41	15	885.0	2022
41	15	1072.0	2023
34	15	345.0	2018
34	15	488.0	2019
34	15	686.0	2020
34	15	902.0	2021
34	15	1171.0	2022
34	15	1351.0	2023
28	15	625.0	2018
28	15	890.0	2019
28	15	1308.0	2020
28	15	1805.0	2021
28	15	2365.0	2022
28	15	2815.0	2023
36	15	481.0	2018
36	15	626.0	2019
36	15	772.0	2020
36	15	954.0	2021
36	15	1095.0	2022
36	15	1244.0	2023
38	15	1.98	2018
38	15	1.9	2019
38	15	1.76	2020
38	15	1.46	2021
38	15	0.97	2022
38	15	0.62	2023
27	16	75.0	2018
27	16	82.0	2019
27	16	101.0	2020
27	16	109.0	2021
27	16	113.0	2022
27	16	135.0	2023
42	16	372.0	2018
42	16	384.0	2019
42	16	413.0	2020
42	16	428.0	2021
42	16	453.0	2022
42	16	479.0	2023
37	16	31.0	2018
37	16	29.0	2019
37	16	26.0	2020
37	16	25.0	2021
37	16	24.0	2022
37	16	16.0	2023
31	16	1220.0	2018
31	16	1349.0	2019
31	16	1507.0	2020
31	16	1769.0	2021
31	16	1978.0	2022
31	16	2177.0	2023
1691	16	1856.0	2018
1691	16	2049.0	2019
1691	16	2328.0	2020
1691	16	2704.0	2021
1691	16	2911.0	2022
1691	16	2995.0	2023
26	16	0.97828	2018
26	16	0.95754	2019
26	16	0.97425	2020
26	16	0.98474	2021
26	16	0.95678	2022
26	16	0.9726	2023
32	16	947.0	2018
32	16	1037.0	2019
32	16	1196.0	2020
32	16	1452.0	2021
32	16	1607.0	2022
32	16	1741.0	2023
35	16	56.94372741352607	2018
35	16	57.45385707524847	2019
35	16	59.86537652503155	2020
35	16	61.66666666666666	2021
35	16	63.62429472286757	2022
35	16	63.61111111111112	2023
29	16	1894.0	2018
29	16	2076.0	2019
29	16	2335.0	2020
29	16	2724.0	2021
29	16	2986.0	2022
29	16	3217.0	2023
30	16	2.0	2018
30	16	2.0	2019
30	16	2.0	2020
30	16	2.0	2021
30	16	2.0	2022
30	16	2.0	2023
43	16	145.0	2018
43	16	145.0	2019
43	16	136.0	2020
43	16	144.0	2021
43	16	127.0	2022
43	16	100.0	2023
39	16	12.0	2018
39	16	12.0	2019
39	16	15.0	2020
39	16	17.0	2021
39	16	18.0	2022
39	16	13.0	2023
1690	16	310.0	2018
1690	16	370.0	2019
1690	16	459.0	2020
1690	16	595.0	2021
1690	16	681.0	2022
1690	16	724.0	2023
41	16	129.0	2018
41	16	262.0	2019
41	16	450.0	2020
41	16	726.0	2021
41	16	973.0	2022
41	16	1093.0	2023
34	16	957.0	2018
34	16	1054.0	2019
34	16	1194.0	2020
34	16	1350.0	2021
34	16	1414.0	2022
34	16	1499.0	2023
28	16	1937.0	2018
28	16	2113.0	2019
28	16	2377.0	2020
28	16	2760.0	2021
28	16	3013.0	2022
28	16	3240.0	2023
36	16	1079.0	2018
36	16	1136.0	2019
36	16	1237.0	2020
36	16	1305.0	2021
36	16	1379.0	2022
36	16	1447.0	2023
38	16	1.7	2018
38	16	1.46	2019
38	16	1.16	2020
38	16	0.96	2021
38	16	0.84	2022
38	16	0.53	2023
27	17	8.0	2018
27	17	10.0	2019
27	17	13.0	2020
27	17	17.0	2021
27	17	18.0	2022
27	17	22.0	2023
42	17	69.0	2018
42	17	68.0	2019
42	17	88.0	2020
42	17	109.0	2021
42	17	126.0	2022
42	17	133.0	2023
37	17	11.0	2018
37	17	10.0	2019
37	17	13.0	2020
37	17	12.0	2021
37	17	10.0	2022
37	17	6.0	2023
31	17	228.0	2018
31	17	257.0	2019
31	17	282.0	2020
31	17	281.0	2021
31	17	313.0	2022
31	17	351.0	2023
1691	17	371.0	2018
1691	17	426.0	2019
1691	17	486.0	2020
1691	17	514.0	2021
1691	17	573.0	2022
1691	17	593.0	2023
26	17	0.68597	2018
26	17	0.67995	2019
26	17	0.71437	2020
26	17	0.96725	2021
26	17	0.89695	2022
26	17	0.93713	2023
32	17	110.0	2018
32	17	138.0	2019
32	17	180.0	2020
32	17	219.0	2021
32	17	247.0	2022
32	17	270.0	2023
35	17	42.74809160305344	2018
35	17	46.770601336302896	2019
35	17	55.7504873294347	2020
35	17	63.003663003663	2021
35	17	67.48366013071896	2022
35	17	70.35928143712576	2023
29	17	393.0	2018
29	17	449.0	2019
29	17	513.0	2020
29	17	546.0	2021
29	17	612.0	2022
29	17	668.0	2023
30	17	0.0	2018
30	17	0.0	2019
30	17	0.0	2020
30	17	0.0	2021
30	17	0.0	2022
30	17	0.0	2023
43	17	17.0	2018
43	17	15.0	2019
43	17	18.0	2020
43	17	18.0	2021
43	17	10.0	2022
43	17	8.0	2023
39	17	1.0	2018
39	17	3.0	2019
39	17	5.0	2020
39	17	5.0	2021
39	17	5.0	2022
39	17	4.0	2023
1690	17	62.0	2018
1690	17	75.0	2019
1690	17	107.0	2020
1690	17	132.0	2021
1690	17	144.0	2022
1690	17	142.0	2023
41	17	31.0	2018
41	17	60.0	2019
41	17	108.0	2020
41	17	165.0	2021
41	17	219.0	2022
41	17	247.0	2023
34	17	163.0	2018
34	17	184.0	2019
34	17	215.0	2020
34	17	237.0	2021
34	17	264.0	2022
34	17	287.0	2023
28	17	393.0	2018
28	17	449.0	2019
28	17	513.0	2020
28	17	546.0	2021
28	17	612.0	2022
28	17	668.0	2023
36	17	172.0	2018
36	17	189.0	2019
36	17	242.0	2020
36	17	282.0	2021
36	17	310.0	2022
36	17	334.0	2023
38	17	3.01	2018
38	17	2.37	2019
38	17	2.71	2020
38	17	2.4	2021
38	17	1.79	2022
38	17	0.99	2023
27	18	55.0	2018
27	18	60.0	2019
27	18	62.0	2020
27	18	63.0	2021
27	18	68.0	2022
27	18	61.0	2023
42	18	177.0	2018
42	18	201.0	2019
42	18	229.0	2020
42	18	249.0	2021
42	18	261.0	2022
42	18	269.0	2023
37	18	33.0	2018
37	18	34.0	2019
37	18	36.0	2020
37	18	33.0	2021
37	18	27.0	2022
37	18	19.0	2023
31	18	713.0	2018
31	18	893.0	2019
31	18	1072.0	2020
31	18	1190.0	2021
31	18	1286.0	2022
31	18	1315.0	2023
1691	18	1026.0	2018
1691	18	1238.0	2019
1691	18	1482.0	2020
1691	18	1649.0	2021
1691	18	1786.0	2022
1691	18	1782.0	2023
26	18	1.55706	2018
26	18	1.54982	2019
26	18	1.50451	2020
26	18	1.48027	2021
26	18	1.51188	2022
26	18	1.4699	2023
32	18	566.0	2018
32	18	700.0	2019
32	18	830.0	2020
32	18	927.0	2021
32	18	1042.0	2022
32	18	1085.0	2023
35	18	62.476370510396976	2018
35	18	65.53359683794466	2019
35	18	68.1245858184228	2020
35	18	69.93464052287581	2021
35	18	71.3972602739726	2022
35	18	71.77289769683985	2023
29	18	1058.0	2018
29	18	1265.0	2019
29	18	1509.0	2020
29	18	1683.0	2021
29	18	1825.0	2022
29	18	1867.0	2023
30	18	0.0	2018
30	18	0.0	2019
30	18	0.0	2020
30	18	0.0	2021
30	18	0.0	2022
30	18	0.0	2023
43	18	60.0	2018
43	18	65.0	2019
43	18	58.0	2020
43	18	55.0	2021
43	18	44.0	2022
43	18	32.0	2023
39	18	18.0	2018
39	18	21.0	2019
39	18	21.0	2020
39	18	26.0	2021
39	18	20.0	2022
39	18	16.0	2023
1690	18	168.0	2018
1690	18	205.0	2019
1690	18	255.0	2020
1690	18	292.0	2021
1690	18	332.0	2022
1690	18	353.0	2023
41	18	75.0	2018
41	18	170.0	2019
41	18	280.0	2020
41	18	374.0	2021
41	18	492.0	2022
41	18	506.0	2023
34	18	481.0	2018
34	18	527.0	2019
34	18	610.0	2020
34	18	687.0	2021
34	18	711.0	2022
34	18	705.0	2023
28	18	1058.0	2018
28	18	1265.0	2019
28	18	1509.0	2020
28	18	1683.0	2021
28	18	1825.0	2022
28	18	1867.0	2023
36	18	533.0	2018
36	18	597.0	2019
36	18	676.0	2020
36	18	735.0	2021
36	18	778.0	2022
36	18	805.0	2023
38	18	3.16	2018
38	18	2.73	2019
38	18	2.43	2020
38	18	2.0	2021
38	18	1.51	2022
38	18	1.04	2023
27	19	0.0	2018
27	19	0.0	2019
27	19	0.0	2020
27	19	0.0	2021
27	19	0.0	2022
27	19	0.0	2023
42	19	6.0	2018
42	19	3.0	2019
42	19	2.0	2020
42	19	3.0	2021
42	19	1.0	2022
42	19	1.0	2023
37	19	0.0	2018
37	19	0.0	2019
37	19	0.0	2020
37	19	0.0	2021
37	19	0.0	2022
37	19	0.0	2023
31	19	7.0	2018
31	19	8.0	2019
31	19	9.0	2020
31	19	8.0	2021
31	19	6.0	2022
31	19	4.0	2023
1691	19	13.0	2018
1691	19	10.0	2019
1691	19	11.0	2020
1691	19	10.0	2021
1691	19	7.0	2022
1691	19	6.0	2023
26	19	0.23998	2018
26	19	0.41813	2019
26	19	0.36444	2020
26	19	0.37352	2021
26	19	0.31109	2022
26	19	0.34114	2023
32	19	1.0	2018
32	19	2.0	2019
32	19	4.0	2020
32	19	4.0	2021
32	19	3.0	2022
32	19	3.0	2023
35	19	80.0	2018
35	19	75.0	2019
35	19	76.92307692307693	2020
35	19	90.9090909090909	2021
35	19	87.5	2022
35	19	83.33333333333333	2023
29	19	15.0	2018
29	19	12.0	2019
29	19	13.0	2020
29	19	11.0	2021
29	19	8.0	2022
29	19	6.0	2023
30	19	0.0	2018
30	19	0.0	2019
30	19	0.0	2020
30	19	0.0	2021
30	19	0.0	2022
30	19	0.0	2023
43	19	1.0	2018
43	19	1.0	2019
43	19	1.0	2020
43	19	1.0	2021
43	19	0.0	2022
43	19	0.0	2023
39	19	0.0	2018
39	19	0.0	2019
39	19	0.0	2020
39	19	0.0	2021
39	19	0.0	2022
39	19	0.0	2023
1690	19	4.0	2018
1690	19	2.0	2019
1690	19	1.0	2020
1690	19	1.0	2021
1690	19	0.0	2022
1690	19	0.0	2023
41	19	0.0	2018
41	19	1.0	2019
41	19	1.0	2020
41	19	2.0	2021
41	19	2.0	2022
41	19	2.0	2023
34	19	8.0	2018
34	19	6.0	2019
34	19	8.0	2020
34	19	7.0	2021
34	19	5.0	2022
34	19	4.0	2023
28	19	15.0	2018
28	19	12.0	2019
28	19	13.0	2020
28	19	11.0	2021
28	19	8.0	2022
28	19	6.0	2023
36	19	15.0	2018
36	19	12.0	2019
36	19	11.0	2020
36	19	11.0	2021
36	19	8.0	2022
36	19	6.0	2023
38	19	0.0	2018
38	19	0.0	2019
38	19	0.0	2020
38	19	0.0	2021
38	19	0.0	2022
38	19	0.0	2023
27	20	0.0	2018
27	20	0.0	2019
27	20	0.0	2020
27	20	0.0	2021
27	20	0.0	2022
27	20	0.0	2023
42	20	1.0	2018
42	20	1.0	2019
42	20	1.0	2020
42	20	3.0	2021
42	20	4.0	2022
42	20	4.0	2023
37	20	0.0	2018
37	20	0.0	2019
37	20	0.0	2020
37	20	0.0	2021
37	20	0.0	2022
37	20	0.0	2023
31	20	2.0	2018
31	20	3.0	2019
31	20	5.0	2020
31	20	6.0	2021
31	20	7.0	2022
31	20	8.0	2023
1691	20	3.0	2018
1691	20	5.0	2019
1691	20	8.0	2020
1691	20	11.0	2021
1691	20	11.0	2022
1691	20	12.0	2023
26	20	0.15426	2018
26	20	0.17172	2019
26	20	0.26535	2020
26	20	0.22396	2021
26	20	0.22396	2022
26	20	0.36376	2023
32	20	1.0	2018
32	20	0.0	2019
32	20	1.0	2020
32	20	1.0	2021
32	20	1.0	2022
32	20	2.0	2023
35	20	0.0	2018
35	20	40.0	2019
35	20	62.5	2020
35	20	54.54545454545456	2021
35	20	63.63636363636364	2022
35	20	69.23076923076923	2023
29	20	3.0	2018
29	20	5.0	2019
29	20	8.0	2020
29	20	11.0	2021
29	20	11.0	2022
29	20	13.0	2023
30	20	0.0	2018
30	20	0.0	2019
30	20	0.0	2020
30	20	0.0	2021
30	20	0.0	2022
30	20	0.0	2023
43	20	0.0	2018
43	20	0.0	2019
43	20	0.0	2020
43	20	0.0	2021
43	20	0.0	2022
43	20	0.0	2023
39	20	0.0	2018
39	20	0.0	2019
39	20	0.0	2020
39	20	0.0	2021
39	20	0.0	2022
39	20	0.0	2023
1690	20	0.0	2018
1690	20	0.0	2019
1690	20	1.0	2020
1690	20	2.0	2021
1690	20	2.0	2022
1690	20	2.0	2023
41	20	0.0	2018
41	20	2.0	2019
41	20	2.0	2020
41	20	3.0	2021
41	20	4.0	2022
41	20	4.0	2023
34	20	2.0	2018
34	20	4.0	2019
34	20	6.0	2020
34	20	7.0	2021
34	20	7.0	2022
34	20	7.0	2023
28	20	3.0	2018
28	20	5.0	2019
28	20	8.0	2020
28	20	11.0	2021
28	20	11.0	2022
28	20	13.0	2023
36	20	3.0	2018
36	20	5.0	2019
36	20	6.0	2020
36	20	9.0	2021
36	20	9.0	2022
36	20	11.0	2023
38	20	0.0	2018
38	20	0.0	2019
38	20	0.0	2020
38	20	0.0	2021
38	20	0.0	2022
38	20	0.0	2023
27	21	7.0	2018
27	21	10.0	2019
27	21	13.0	2020
27	21	18.0	2021
27	21	21.0	2022
27	21	23.0	2023
42	21	52.0	2018
42	21	72.0	2019
42	21	95.0	2020
42	21	129.0	2021
42	21	152.0	2022
42	21	146.0	2023
37	21	12.0	2018
37	21	12.0	2019
37	21	13.0	2020
37	21	13.0	2021
37	21	10.0	2022
37	21	6.0	2023
31	21	267.0	2018
31	21	381.0	2019
31	21	510.0	2020
31	21	645.0	2021
31	21	734.0	2022
31	21	821.0	2023
1691	21	386.0	2018
1691	21	546.0	2019
1691	21	718.0	2020
1691	21	895.0	2021
1691	21	1013.0	2022
1691	21	1057.0	2023
26	21	0.79049	2018
26	21	0.85111	2019
26	21	0.89102	2020
26	21	0.88248	2021
26	21	0.98723	2022
26	21	0.94038	2023
32	21	149.0	2018
32	21	221.0	2019
32	21	316.0	2020
32	21	406.0	2021
32	21	474.0	2022
32	21	525.0	2023
35	21	59.10224438902743	2018
35	21	62.78659611992945	2019
35	21	63.9300134589502	2020
35	21	66.41711229946524	2021
35	21	67.91044776119402	2022
35	21	67.30103806228374	2023
29	21	401.0	2018
29	21	567.0	2019
29	21	743.0	2020
29	21	935.0	2021
29	21	1072.0	2022
29	21	1156.0	2023
30	21	0.0	2018
30	21	0.0	2019
30	21	0.0	2020
30	21	0.0	2021
30	21	0.0	2022
30	21	0.0	2023
43	21	11.0	2018
43	21	14.0	2019
43	21	13.0	2020
43	21	14.0	2021
43	21	15.0	2022
43	21	11.0	2023
39	21	2.0	2018
39	21	6.0	2019
39	21	6.0	2020
39	21	6.0	2021
39	21	6.0	2022
39	21	5.0	2023
1690	21	48.0	2018
1690	21	74.0	2019
1690	21	107.0	2020
1690	21	149.0	2021
1690	21	181.0	2022
1690	21	192.0	2023
41	21	29.0	2018
41	21	68.0	2019
41	21	118.0	2020
41	21	181.0	2021
41	21	255.0	2022
41	21	316.0	2023
34	21	197.0	2018
34	21	263.0	2019
34	21	325.0	2020
34	21	394.0	2021
34	21	422.0	2022
34	21	399.0	2023
28	21	401.0	2018
28	21	567.0	2019
28	21	743.0	2020
28	21	935.0	2021
28	21	1072.0	2022
28	21	1156.0	2023
36	21	209.0	2018
36	21	267.0	2019
36	21	323.0	2020
36	21	399.0	2021
36	21	471.0	2022
36	21	470.0	2023
38	21	3.11	2018
38	21	2.21	2019
38	21	1.82	2020
38	21	1.46	2021
38	21	1.0	2022
38	21	0.56	2023
27	22	873.0	2018
27	22	905.0	2019
27	22	899.0	2020
27	22	912.0	2021
27	22	869.0	2022
27	22	819.0	2023
42	22	3858.0	2018
42	22	4062.0	2019
42	22	4287.0	2020
42	22	4595.0	2021
42	22	4854.0	2022
42	22	4946.0	2023
37	22	555.0	2018
37	22	520.0	2019
37	22	473.0	2020
37	22	403.0	2021
37	22	285.0	2022
37	22	203.0	2023
31	22	8481.0	2018
31	22	8954.0	2019
31	22	9579.0	2020
31	22	10104.0	2021
31	22	10513.0	2022
31	22	10666.0	2023
1691	22	14470.0	2018
1691	22	15204.0	2019
1691	22	16096.0	2020
1691	22	16867.0	2021
1691	22	17178.0	2022
1691	22	16701.0	2023
26	22	1.16322	2018
26	22	1.14803	2019
26	22	1.13113	2020
26	22	1.12601	2021
26	22	1.10858	2022
26	22	1.08933	2023
32	22	7539.0	2018
32	22	8061.0	2019
32	22	8677.0	2020
32	22	9382.0	2021
32	22	9712.0	2022
32	22	9972.0	2023
35	22	58.899549637752095	2018
35	22	59.28326581489561	2019
35	22	60.93713209324229	2020
35	22	63.5403796473099	2021
35	22	65.11069909477588	2022
35	22	65.55026512282221	2023
29	22	15138.0	2018
29	22	15843.0	2019
29	22	16762.0	2020
29	22	17560.0	2021
29	22	18079.0	2022
29	22	18199.0	2023
30	22	13.0	2018
30	22	16.0	2019
30	22	16.0	2020
30	22	16.0	2021
30	22	16.0	2022
30	22	16.0	2023
43	22	939.0	2018
43	22	956.0	2019
43	22	913.0	2020
43	22	865.0	2021
43	22	736.0	2022
43	22	568.0	2023
39	22	91.0	2018
39	22	87.0	2019
39	22	85.0	2020
39	22	71.0	2021
39	22	64.0	2022
39	22	50.0	2023
1690	22	2281.0	2018
1690	22	2585.0	2019
1690	22	2981.0	2020
1690	22	3466.0	2021
1690	22	3682.0	2022
1690	22	3690.0	2023
41	22	936.0	2018
41	22	1863.0	2019
41	22	3058.0	2020
41	22	4447.0	2021
41	22	5686.0	2022
41	22	5892.0	2023
34	22	8639.0	2018
34	22	8877.0	2019
34	22	9080.0	2020
34	22	9318.0	2021
34	22	9366.0	2022
34	22	9215.0	2023
28	22	15321.0	2018
28	22	16045.0	2019
28	22	16988.0	2020
28	22	17806.0	2021
28	22	18338.0	2022
28	22	18482.0	2023
36	22	10951.0	2018
36	22	11304.0	2019
36	22	11770.0	2020
36	22	12305.0	2021
36	22	12678.0	2022
36	22	12806.0	2023
38	22	3.91	2018
38	22	3.51	2019
38	22	3.0	2020
38	22	2.44	2021
38	22	1.68	2022
38	22	1.19	2023
27	23	0.0	2018
27	23	0.0	2019
27	23	0.0	2020
27	23	0.0	2021
27	23	0.0	2022
27	23	0.0	2023
42	23	2.0	2018
42	23	2.0	2019
42	23	2.0	2020
42	23	1.0	2021
42	23	1.0	2022
42	23	0.0	2023
37	23	0.0	2018
37	23	0.0	2019
37	23	0.0	2020
37	23	0.0	2021
37	23	0.0	2022
37	23	0.0	2023
31	23	2.0	2018
31	23	3.0	2019
31	23	2.0	2020
31	23	1.0	2021
31	23	1.0	2022
31	23	1.0	2023
1691	23	10.0	2018
1691	23	7.0	2019
1691	23	6.0	2020
1691	23	4.0	2021
1691	23	3.0	2022
1691	23	1.0	2023
26	23	0.24799	2018
26	23	0.2358	2019
26	23	0.2358	2020
26	23	0.12357	2021
26	23	0.16476	2022
26	23	0.04393	2023
32	23	1.0	2018
32	23	1.0	2019
32	23	1.0	2020
32	23	0.0	2021
32	23	0.0	2022
32	23	0.0	2023
35	23	50.0	2018
35	23	28.57142857142857	2019
35	23	33.33333333333333	2020
35	23	50.0	2021
35	23	66.66666666666666	2022
35	23	0.0	2023
29	23	10.0	2018
29	23	7.0	2019
29	23	6.0	2020
29	23	4.0	2021
29	23	3.0	2022
29	23	1.0	2023
30	23	0.0	2018
30	23	0.0	2019
30	23	0.0	2020
30	23	0.0	2021
30	23	0.0	2022
30	23	0.0	2023
43	23	0.0	2018
43	23	0.0	2019
43	23	0.0	2020
43	23	0.0	2021
43	23	0.0	2022
43	23	0.0	2023
39	23	0.0	2018
39	23	0.0	2019
39	23	0.0	2020
39	23	0.0	2021
39	23	0.0	2022
39	23	0.0	2023
1690	23	1.0	2018
1690	23	0.0	2019
1690	23	0.0	2020
1690	23	0.0	2021
1690	23	0.0	2022
1690	23	0.0	2023
41	23	0.0	2018
41	23	0.0	2019
41	23	0.0	2020
41	23	0.0	2021
41	23	0.0	2022
41	23	0.0	2023
34	23	6.0	2018
34	23	2.0	2019
34	23	2.0	2020
34	23	1.0	2021
34	23	0.0	2022
34	23	0.0	2023
28	23	10.0	2018
28	23	7.0	2019
28	23	6.0	2020
28	23	4.0	2021
28	23	3.0	2022
28	23	1.0	2023
36	23	14.0	2018
36	23	8.0	2019
36	23	8.0	2020
36	23	5.0	2021
36	23	4.0	2022
36	23	1.0	2023
38	23	0.0	2018
38	23	0.0	2019
38	23	0.0	2020
38	23	0.0	2021
38	23	0.0	2022
38	23	0.0	2023
27	24	307.0	2018
27	24	323.0	2019
27	24	341.0	2020
27	24	338.0	2021
27	24	337.0	2022
27	24	326.0	2023
42	24	1520.0	2018
42	24	1634.0	2019
42	24	1747.0	2020
42	24	1870.0	2021
42	24	1972.0	2022
42	24	2029.0	2023
37	24	187.0	2018
37	24	177.0	2019
37	24	178.0	2020
37	24	152.0	2021
37	24	119.0	2022
37	24	85.0	2023
31	24	3717.0	2018
31	24	3989.0	2019
31	24	4425.0	2020
31	24	4776.0	2021
31	24	5090.0	2022
31	24	5271.0	2023
1691	24	6183.0	2018
1691	24	6670.0	2019
1691	24	7231.0	2020
1691	24	7722.0	2021
1691	24	8065.0	2022
1691	24	8027.0	2023
26	24	0.98703	2018
26	24	1.03234	2019
26	24	1.05579	2020
26	24	1.06664	2021
26	24	1.12817	2022
26	24	1.1047	2023
32	24	3250.0	2018
32	24	3522.0	2019
32	24	3927.0	2020
32	24	4333.0	2021
32	24	4661.0	2022
32	24	4903.0	2023
35	24	53.85090291711684	2018
35	24	55.72332470520564	2019
35	24	57.599469496021214	2020
35	24	59.85863095238095	2021
35	24	61.99318368785991	2022
35	24	62.84566838783706	2023
29	24	6216.0	2018
29	24	6701.0	2019
29	24	7299.0	2020
29	24	7845.0	2021
29	24	8324.0	2022
29	24	8559.0	2023
30	24	8.0	2018
30	24	9.0	2019
30	24	9.0	2020
30	24	9.0	2021
30	24	9.0	2022
30	24	9.0	2023
43	24	372.0	2018
43	24	403.0	2019
43	24	408.0	2020
43	24	386.0	2021
43	24	327.0	2022
43	24	250.0	2023
39	24	130.0	2018
39	24	139.0	2019
39	24	129.0	2020
39	24	117.0	2021
39	24	94.0	2022
39	24	89.0	2023
1690	24	825.0	2018
1690	24	1010.0	2019
1690	24	1213.0	2020
1690	24	1499.0	2021
1690	24	1679.0	2022
1690	24	1756.0	2023
41	24	443.0	2018
41	24	968.0	2019
41	24	1575.0	2020
41	24	2273.0	2021
41	24	2938.0	2022
41	24	3142.0	2023
34	24	3601.0	2018
34	24	3794.0	2019
34	24	3977.0	2020
34	24	4122.0	2021
34	24	4190.0	2022
34	24	4179.0	2023
28	24	6479.0	2018
28	24	6954.0	2019
28	24	7540.0	2020
28	24	8064.0	2021
28	24	8509.0	2022
28	24	8715.0	2023
36	24	4280.0	2018
36	24	4573.0	2019
36	24	4829.0	2020
36	24	5073.0	2021
36	24	5287.0	2022
36	24	5430.0	2023
38	24	3.04	2018
38	24	2.69	2019
38	24	2.49	2020
38	24	1.99	2021
38	24	1.48	2022
38	24	1.04	2023
27	25	107.0	2018
27	25	148.0	2019
27	25	155.0	2020
27	25	171.0	2021
27	25	167.0	2022
27	25	180.0	2023
42	25	569.0	2018
42	25	631.0	2019
42	25	700.0	2020
42	25	770.0	2021
42	25	867.0	2022
42	25	910.0	2023
37	25	102.0	2018
37	25	92.0	2019
37	25	80.0	2020
37	25	65.0	2021
37	25	55.0	2022
37	25	35.0	2023
31	25	1364.0	2018
31	25	1561.0	2019
31	25	1795.0	2020
31	25	2067.0	2021
31	25	2323.0	2022
31	25	2541.0	2023
1691	25	2442.0	2018
1691	25	2719.0	2019
1691	25	3051.0	2020
1691	25	3464.0	2021
1691	25	3774.0	2022
1691	25	3965.0	2023
26	25	1.11172	2018
26	25	1.1246	2019
26	25	1.09897	2020
26	25	1.10769	2021
26	25	1.08301	2022
26	25	1.05995	2023
32	25	889.0	2018
32	25	1036.0	2019
32	25	1232.0	2020
32	25	1475.0	2021
32	25	1638.0	2022
32	25	1864.0	2023
35	25	62.273800157356405	2018
35	25	62.234042553191486	2019
35	25	63.14122862571248	2020
35	25	64.30372653404315	2021
35	25	66.5131747249936	2022
35	25	68.03804994054697	2023
29	25	2272.0	2018
29	25	2555.0	2019
29	25	2870.0	2020
29	25	3278.0	2021
29	25	3625.0	2022
29	25	3925.0	2023
30	25	1.0	2018
30	25	2.0	2019
30	25	2.0	2020
30	25	2.0	2021
30	25	2.0	2022
30	25	2.0	2023
43	25	128.0	2018
43	25	144.0	2019
43	25	157.0	2020
43	25	154.0	2021
43	25	132.0	2022
43	25	106.0	2023
39	25	17.0	2018
39	25	24.0	2019
39	25	27.0	2020
39	25	27.0	2021
39	25	23.0	2022
39	25	20.0	2023
1690	25	364.0	2018
1690	25	433.0	2019
1690	25	517.0	2020
1690	25	656.0	2021
1690	25	773.0	2022
1690	25	880.0	2023
41	25	188.0	2018
41	25	397.0	2019
41	25	677.0	2020
41	25	1026.0	2021
41	25	1363.0	2022
41	25	1529.0	2023
34	25	1503.0	2018
34	25	1664.0	2019
34	25	1792.0	2020
34	25	1987.0	2021
34	25	2100.0	2022
34	25	2194.0	2023
28	25	2542.0	2018
28	25	2820.0	2019
28	25	3158.0	2020
28	25	3569.0	2021
28	25	3909.0	2022
28	25	4205.0	2023
36	25	1536.0	2018
36	25	1693.0	2019
36	25	1836.0	2020
36	25	2053.0	2021
36	25	2208.0	2022
36	25	2340.0	2023
38	25	4.31	2018
38	25	3.51	2019
38	25	2.72	2020
38	25	1.96	2021
38	25	1.52	2022
38	25	0.9	2023
27	26	26.0	2018
27	26	34.0	2019
27	26	31.0	2020
27	26	36.0	2021
27	26	38.0	2022
27	26	38.0	2023
42	26	139.0	2018
42	26	153.0	2019
42	26	159.0	2020
42	26	181.0	2021
42	26	196.0	2022
42	26	199.0	2023
37	26	15.0	2018
37	26	16.0	2019
37	26	17.0	2020
37	26	14.0	2021
37	26	13.0	2022
37	26	6.0	2023
31	26	485.0	2018
31	26	558.0	2019
31	26	678.0	2020
31	26	772.0	2021
31	26	849.0	2022
31	26	951.0	2023
1691	26	772.0	2018
1691	26	876.0	2019
1691	26	1020.0	2020
1691	26	1132.0	2021
1691	26	1185.0	2022
1691	26	1255.0	2023
26	26	1.4616	2018
26	26	1.45223	2019
26	26	1.49036	2020
26	26	1.49522	2021
26	26	1.41423	2022
26	26	1.45667	2023
32	26	451.0	2018
32	26	523.0	2019
32	26	640.0	2020
32	26	741.0	2021
32	26	795.0	2022
32	26	872.0	2023
35	26	67.12846347607052	2018
35	26	69.30803571428571	2019
35	26	70.8969465648855	2020
35	26	72.3514211886305	2021
35	26	74.75806451612902	2022
35	26	77.24907063197026	2023
29	26	794.0	2018
29	26	896.0	2019
29	26	1048.0	2020
29	26	1161.0	2021
29	26	1240.0	2022
29	26	1345.0	2023
30	26	0.0	2018
30	26	0.0	2019
30	26	0.0	2020
30	26	0.0	2021
30	26	0.0	2022
30	26	0.0	2023
43	26	31.0	2018
43	26	32.0	2019
43	26	31.0	2020
43	26	29.0	2021
43	26	21.0	2022
43	26	16.0	2023
39	26	2.0	2018
39	26	1.0	2019
39	26	0.0	2020
39	26	0.0	2021
39	26	0.0	2022
39	26	0.0	2023
1690	26	125.0	2018
1690	26	143.0	2019
1690	26	164.0	2020
1690	26	189.0	2021
1690	26	190.0	2022
1690	26	193.0	2023
41	26	48.0	2018
41	26	80.0	2019
41	26	128.0	2020
41	26	189.0	2021
41	26	239.0	2022
41	26	247.0	2023
34	26	337.0	2018
34	26	362.0	2019
34	26	404.0	2020
34	26	403.0	2021
34	26	414.0	2022
34	26	432.0	2023
28	26	794.0	2018
28	26	896.0	2019
28	26	1048.0	2020
28	26	1161.0	2021
28	26	1240.0	2022
28	26	1345.0	2023
36	26	398.0	2018
36	26	454.0	2019
36	26	481.0	2020
36	26	524.0	2021
36	26	544.0	2022
36	26	561.0	2023
38	26	1.94	2018
38	26	1.83	2019
38	26	1.67	2020
38	26	1.25	2021
38	26	1.09	2022
38	26	0.46	2023
27	27	0.0	2018
27	27	3.0	2019
27	27	7.0	2020
27	27	17.0	2021
27	27	26.0	2022
27	27	33.0	2023
42	27	27.0	2018
42	27	42.0	2019
42	27	62.0	2020
42	27	103.0	2021
42	27	155.0	2022
42	27	200.0	2023
37	27	0.0	2018
37	27	1.0	2019
37	27	2.0	2020
37	27	6.0	2021
37	27	6.0	2022
37	27	6.0	2023
31	27	34.0	2018
31	27	58.0	2019
31	27	111.0	2020
31	27	219.0	2021
31	27	366.0	2022
31	27	514.0	2023
1691	27	92.0	2018
1691	27	170.0	2019
1691	27	286.0	2020
1691	27	504.0	2021
1691	27	778.0	2022
1691	27	1020.0	2023
26	27	0.58985	2018
26	27	0.76324	2019
26	27	0.74765	2020
26	27	0.80343	2022
26	27	0.74144	2023
32	27	16.0	2018
32	27	30.0	2019
32	27	83.0	2020
32	27	197.0	2021
32	27	337.0	2022
32	27	450.0	2023
35	27	69.0721649484536	2018
35	27	72.0	2019
35	27	74.41077441077442	2020
35	27	74.04580152671755	2021
35	27	76.44882860665844	2022
35	27	77.78776978417265	2023
29	27	97.0	2018
29	27	175.0	2019
29	27	297.0	2020
29	27	524.0	2021
29	27	811.0	2022
29	27	1112.0	2023
30	27	0.0	2018
30	27	0.0	2019
30	27	0.0	2020
30	27	0.0	2021
30	27	0.0	2022
30	27	0.0	2023
43	27	4.0	2018
43	27	8.0	2019
43	27	17.0	2020
43	27	19.0	2021
43	27	25.0	2022
43	27	24.0	2023
39	27	0.0	2018
39	27	0.0	2019
39	27	0.0	2020
39	27	0.0	2021
39	27	0.0	2022
39	27	0.0	2023
1690	27	14.0	2018
1690	27	30.0	2019
1690	27	70.0	2020
1690	27	142.0	2021
1690	27	209.0	2022
1690	27	271.0	2023
41	27	11.0	2018
41	27	37.0	2019
41	27	90.0	2020
41	27	188.0	2021
41	27	328.0	2022
41	27	460.0	2023
34	27	57.0	2018
34	27	95.0	2019
34	27	141.0	2020
34	27	233.0	2021
34	27	336.0	2022
34	27	472.0	2023
28	27	97.0	2018
28	27	175.0	2019
28	27	297.0	2020
28	27	524.0	2021
28	27	811.0	2022
28	27	1112.0	2023
36	27	101.0	2018
36	27	148.0	2019
36	27	208.0	2020
36	27	310.0	2021
36	27	416.0	2022
36	27	534.0	2023
38	27	0.0	2018
38	27	0.6	2019
38	27	0.7	2020
38	27	1.2	2021
38	27	0.78	2022
38	27	0.57	2023
27	28	57.0	2018
27	28	70.0	2019
27	28	80.0	2020
27	28	85.0	2021
27	28	87.0	2022
27	28	93.0	2023
42	28	341.0	2018
42	28	395.0	2019
42	28	434.0	2020
42	28	492.0	2021
42	28	547.0	2022
42	28	553.0	2023
37	28	60.0	2018
37	28	56.0	2019
37	28	49.0	2020
37	28	39.0	2021
37	28	30.0	2022
37	28	18.0	2023
31	28	572.0	2018
31	28	639.0	2019
31	28	723.0	2020
31	28	829.0	2021
31	28	931.0	2022
31	28	1016.0	2023
1691	28	1152.0	2018
1691	28	1274.0	2019
1691	28	1399.0	2020
1691	28	1598.0	2021
1691	28	1729.0	2022
1691	28	1761.0	2023
26	28	1.00277	2018
26	28	1.06204	2019
26	28	1.05862	2020
26	28	1.06806	2021
26	28	1.03627	2022
26	28	1.00833	2023
32	28	472.0	2018
32	28	543.0	2019
32	28	617.0	2020
32	28	703.0	2021
32	28	799.0	2022
32	28	900.0	2023
35	28	59.7413096200485	2018
35	28	60.3690036900369	2019
35	28	62.27544910179641	2020
35	28	64.78386167146975	2021
35	28	65.38461538461537	2022
35	28	64.77553034040453	2023
29	28	1237.0	2018
29	28	1355.0	2019
29	28	1503.0	2020
29	28	1735.0	2021
29	28	1898.0	2022
29	28	2027.0	2023
30	28	0.0	2018
30	28	0.0	2019
30	28	0.0	2020
30	28	0.0	2021
30	28	0.0	2022
30	28	0.0	2023
43	28	76.0	2018
43	28	83.0	2019
43	28	86.0	2020
43	28	94.0	2021
43	28	80.0	2022
43	28	63.0	2023
39	28	16.0	2018
39	28	14.0	2019
39	28	11.0	2020
39	28	9.0	2021
39	28	9.0	2022
39	28	9.0	2023
1690	28	186.0	2018
1690	28	221.0	2019
1690	28	255.0	2020
1690	28	305.0	2021
1690	28	335.0	2022
1690	28	351.0	2023
41	28	68.0	2018
41	28	136.0	2019
41	28	240.0	2020
41	28	380.0	2021
41	28	495.0	2022
41	28	557.0	2023
34	28	672.0	2018
34	28	745.0	2019
34	28	841.0	2020
34	28	969.0	2021
34	28	1047.0	2022
34	28	1095.0	2023
28	28	1237.0	2018
28	28	1355.0	2019
28	28	1503.0	2020
28	28	1735.0	2021
28	28	1898.0	2022
28	28	2027.0	2023
36	28	881.0	2018
36	28	1001.0	2019
36	28	1094.0	2020
36	28	1258.0	2021
36	28	1426.0	2022
36	28	1494.0	2023
38	28	5.58	2018
38	28	4.78	2019
38	28	3.81	2020
38	28	2.66	2021
38	28	1.87	2022
38	28	1.05	2023
27	29	19.0	2018
27	29	24.0	2019
27	29	33.0	2020
27	29	41.0	2021
27	29	47.0	2022
27	29	53.0	2023
42	29	110.0	2018
42	29	125.0	2019
42	29	143.0	2020
42	29	163.0	2021
42	29	178.0	2022
42	29	183.0	2023
37	29	8.0	2018
37	29	7.0	2019
37	29	6.0	2020
37	29	5.0	2021
37	29	2.0	2022
37	29	2.0	2023
31	29	320.0	2018
31	29	410.0	2019
31	29	509.0	2020
31	29	620.0	2021
31	29	695.0	2022
31	29	733.0	2023
1691	29	591.0	2018
1691	29	744.0	2019
1691	29	900.0	2020
1691	29	1071.0	2021
1691	29	1183.0	2022
1691	29	1183.0	2023
26	29	0.99754	2018
26	29	0.97079	2019
26	29	0.93959	2020
26	29	0.88197	2021
26	29	0.83451	2022
26	29	0.89379	2023
32	29	204.0	2018
32	29	261.0	2019
32	29	328.0	2020
32	29	420.0	2021
32	29	475.0	2022
32	29	524.0	2023
35	29	56.14035087719298	2018
35	29	60.0	2019
35	29	62.4868282402529	2020
35	29	67.43362831858407	2021
35	29	68.89419252187749	2022
35	29	70.32457496136011	2023
29	29	620.0	2018
29	29	777.0	2019
29	29	945.0	2020
29	29	1121.0	2021
29	29	1247.0	2022
29	29	1284.0	2023
30	29	1.0	2018
30	29	1.0	2019
30	29	1.0	2020
30	29	1.0	2021
30	29	1.0	2022
30	29	1.0	2023
43	29	53.0	2018
43	29	57.0	2019
43	29	59.0	2020
43	29	55.0	2021
43	29	50.0	2022
43	29	40.0	2023
39	29	3.0	2018
39	29	5.0	2019
39	29	4.0	2020
39	29	4.0	2021
39	29	4.0	2022
39	29	3.0	2023
1690	29	117.0	2018
1690	29	141.0	2019
1690	29	191.0	2020
1690	29	252.0	2021
1690	29	290.0	2022
1690	29	300.0	2023
41	29	60.0	2018
41	29	157.0	2019
41	29	247.0	2020
41	29	352.0	2021
41	29	460.0	2022
41	29	499.0	2023
34	29	304.0	2018
34	29	364.0	2019
34	29	428.0	2020
34	29	530.0	2021
34	29	576.0	2022
34	29	575.0	2023
28	29	627.0	2018
28	29	785.0	2019
28	29	949.0	2020
28	29	1130.0	2021
28	29	1257.0	2022
28	29	1294.0	2023
36	29	327.0	2018
36	29	378.0	2019
36	29	434.0	2020
36	29	477.0	2021
36	29	522.0	2022
36	29	523.0	2023
38	29	1.38	2018
38	29	0.96	2019
38	29	0.67	2020
38	29	0.48	2021
38	29	0.17	2022
38	29	0.17	2023
27	30	17.0	2018
27	30	24.0	2019
27	30	23.0	2020
27	30	30.0	2021
27	30	33.0	2022
27	30	33.0	2023
42	30	97.0	2018
42	30	102.0	2019
42	30	124.0	2020
42	30	138.0	2021
42	30	162.0	2022
42	30	171.0	2023
37	30	19.0	2018
37	30	17.0	2019
37	30	13.0	2020
37	30	9.0	2021
37	30	4.0	2022
37	30	2.0	2023
31	30	421.0	2018
31	30	486.0	2019
31	30	556.0	2020
31	30	582.0	2021
31	30	618.0	2022
31	30	629.0	2023
1691	30	549.0	2018
1691	30	626.0	2019
1691	30	703.0	2020
1691	30	753.0	2021
1691	30	809.0	2022
1691	30	824.0	2023
26	30	1.02068	2018
26	30	1.10811	2019
26	30	1.10612	2020
26	30	1.06357	2021
26	30	1.16424	2022
26	30	1.18881	2023
32	30	296.0	2018
32	30	357.0	2019
32	30	386.0	2020
32	30	431.0	2021
32	30	484.0	2022
32	30	521.0	2023
35	30	60.71428571428572	2018
35	30	61.18935837245696	2019
35	30	63.76210235131397	2020
35	30	66.28056628056628	2021
35	30	69.17562724014337	2022
35	30	70.49368541905855	2023
29	30	523.0	2018
29	30	596.0	2019
29	30	681.0	2020
29	30	746.0	2021
29	30	811.0	2022
29	30	853.0	2023
30	30	1.0	2018
30	30	1.0	2019
30	30	1.0	2020
30	30	1.0	2021
30	30	1.0	2022
30	30	1.0	2023
43	30	42.0	2018
43	30	52.0	2019
43	30	62.0	2020
43	30	60.0	2021
43	30	60.0	2022
43	30	51.0	2023
39	30	0.0	2018
39	30	0.0	2019
39	30	0.0	2020
39	30	0.0	2021
39	30	1.0	2022
39	30	2.0	2023
1690	30	126.0	2018
1690	30	161.0	2019
1690	30	196.0	2020
1690	30	230.0	2021
1690	30	261.0	2022
1690	30	271.0	2023
41	30	48.0	2018
41	30	86.0	2019
41	30	150.0	2020
41	30	228.0	2021
41	30	304.0	2022
41	30	344.0	2023
34	30	253.0	2018
34	30	289.0	2019
34	30	289.0	2020
34	30	327.0	2021
34	30	343.0	2022
34	30	335.0	2023
28	30	560.0	2018
28	30	639.0	2019
28	30	723.0	2020
28	30	777.0	2021
28	30	837.0	2022
28	30	871.0	2023
36	30	281.0	2018
36	30	299.0	2019
36	30	329.0	2020
36	30	371.0	2021
36	30	431.0	2022
36	30	443.0	2023
38	30	3.51	2018
38	30	2.74	2019
38	30	1.85	2020
38	30	1.19	2021
38	30	0.49	2022
38	30	0.24	2023
27	31	11.0	2018
27	31	12.0	2019
27	31	17.0	2020
27	31	19.0	2021
27	31	14.0	2022
27	31	13.0	2023
42	31	104.0	2018
42	31	135.0	2019
42	31	149.0	2020
42	31	175.0	2021
42	31	213.0	2022
42	31	215.0	2023
37	31	4.0	2018
37	31	7.0	2019
37	31	6.0	2020
37	31	7.0	2021
37	31	7.0	2022
37	31	5.0	2023
31	31	230.0	2018
31	31	270.0	2019
31	31	286.0	2020
31	31	309.0	2021
31	31	324.0	2022
31	31	328.0	2023
1691	31	549.0	2018
1691	31	627.0	2019
1691	31	676.0	2020
1691	31	713.0	2021
1691	31	743.0	2022
1691	31	695.0	2023
26	31	0.67075	2018
26	31	0.67257	2019
26	31	0.6582	2020
26	31	0.66447	2021
26	31	0.60914	2022
26	31	0.56727	2023
32	31	133.0	2018
32	31	164.0	2019
32	31	193.0	2020
32	31	248.0	2021
32	31	268.0	2022
32	31	274.0	2023
35	31	56.83333333333333	2018
35	31	59.827833572453365	2019
35	31	62.698412698412696	2020
35	31	64.58852867830424	2021
35	31	67.73809523809524	2022
35	31	72.6161369193154	2023
29	31	600.0	2018
29	31	695.0	2019
29	31	752.0	2020
29	31	794.0	2021
29	31	829.0	2022
29	31	804.0	2023
30	31	0.0	2018
30	31	1.0	2019
30	31	1.0	2020
30	31	1.0	2021
30	31	1.0	2022
30	31	1.0	2023
43	31	16.0	2018
43	31	20.0	2019
43	31	25.0	2020
43	31	28.0	2021
43	31	28.0	2022
43	31	20.0	2023
39	31	0.0	2018
39	31	2.0	2019
39	31	2.0	2020
39	31	2.0	2021
39	31	2.0	2022
39	31	2.0	2023
1690	31	97.0	2018
1690	31	120.0	2019
1690	31	135.0	2020
1690	31	157.0	2021
1690	31	160.0	2022
1690	31	135.0	2023
41	31	60.0	2018
41	31	105.0	2019
41	31	163.0	2020
41	31	234.0	2021
41	31	299.0	2022
41	31	297.0	2023
34	31	298.0	2018
34	31	350.0	2019
34	31	388.0	2020
34	31	402.0	2021
34	31	417.0	2022
34	31	407.0	2023
28	31	600.0	2018
28	31	697.0	2019
28	31	756.0	2020
28	31	802.0	2021
28	31	840.0	2022
28	31	818.0	2023
36	31	271.0	2018
36	31	330.0	2019
36	31	375.0	2020
36	31	404.0	2021
36	31	447.0	2022
36	31	463.0	2023
38	31	0.78	2018
38	31	1.2	2019
38	31	0.95	2020
38	31	1.04	2021
38	31	0.99	2022
38	31	0.72	2023
27	32	156.0	2018
27	32	180.0	2019
27	32	223.0	2020
27	32	253.0	2021
27	32	265.0	2022
27	32	260.0	2023
42	32	653.0	2018
42	32	724.0	2019
42	32	827.0	2020
42	32	920.0	2021
42	32	952.0	2022
42	32	1000.0	2023
37	32	150.0	2018
37	32	142.0	2019
37	32	125.0	2020
37	32	113.0	2021
37	32	95.0	2022
37	32	67.0	2023
31	32	1892.0	2018
31	32	2125.0	2019
31	32	2436.0	2020
31	32	2747.0	2021
31	32	2948.0	2022
31	32	3148.0	2023
1691	32	3467.0	2018
1691	32	3838.0	2019
1691	32	4343.0	2020
1691	32	4813.0	2021
1691	32	5077.0	2022
1691	32	5079.0	2023
26	32	0.83481	2018
26	32	0.84725	2019
26	32	0.84934	2020
26	32	0.87138	2021
26	32	0.91154	2022
26	32	0.90826	2023
32	32	1564.0	2018
32	32	1757.0	2019
32	32	2082.0	2020
32	32	2427.0	2021
32	32	2676.0	2022
32	32	2840.0	2023
35	32	50.13631406761178	2018
35	32	52.30352303523035	2019
35	32	54.25277354796607	2020
35	32	57.17365738925912	2021
35	32	59.675934450377454	2022
35	32	61.13267466478476	2023
29	32	3668.0	2018
29	32	4059.0	2019
29	32	4597.0	2020
29	32	5102.0	2021
29	32	5431.0	2022
29	32	5668.0	2023
30	32	0.0	2018
30	32	0.0	2019
30	32	0.0	2020
30	32	0.0	2021
30	32	0.0	2022
30	32	0.0	2023
43	32	131.0	2018
43	32	146.0	2019
43	32	165.0	2020
43	32	155.0	2021
43	32	137.0	2022
43	32	110.0	2023
39	32	127.0	2018
39	32	126.0	2019
39	32	106.0	2020
39	32	84.0	2021
39	32	64.0	2022
39	32	52.0	2023
1690	32	445.0	2018
1690	32	559.0	2019
1690	32	702.0	2020
1690	32	900.0	2021
1690	32	1045.0	2022
1690	32	1093.0	2023
41	32	200.0	2018
41	32	443.0	2019
41	32	762.0	2020
41	32	1179.0	2021
41	32	1540.0	2022
41	32	1683.0	2023
34	32	2113.0	2018
34	32	2313.0	2019
34	32	2582.0	2020
34	32	2781.0	2021
34	32	2882.0	2022
34	32	2942.0	2023
28	32	3668.0	2018
28	32	4059.0	2019
28	32	4597.0	2020
28	32	5102.0	2021
28	32	5431.0	2022
28	32	5668.0	2023
36	32	2237.0	2018
36	32	2402.0	2019
36	32	2679.0	2020
36	32	2937.0	2021
36	32	3054.0	2022
36	32	3200.0	2023
38	32	4.49	2018
38	32	3.85	2019
38	32	2.99	2020
38	32	2.41	2021
38	32	1.89	2022
38	32	1.28	2023
27	33	108.0	2018
27	33	107.0	2019
27	33	111.0	2020
27	33	135.0	2021
27	33	141.0	2022
27	33	157.0	2023
42	33	321.0	2018
42	33	348.0	2019
42	33	362.0	2020
42	33	411.0	2021
42	33	433.0	2022
42	33	472.0	2023
37	33	87.0	2018
37	33	80.0	2019
37	33	76.0	2020
37	33	70.0	2021
37	33	54.0	2022
37	33	40.0	2023
31	33	1131.0	2018
31	33	1281.0	2019
31	33	1418.0	2020
31	33	1609.0	2021
31	33	1721.0	2022
31	33	1901.0	2023
1691	33	2045.0	2018
1691	33	2240.0	2019
1691	33	2390.0	2020
1691	33	2675.0	2021
1691	33	2837.0	2022
1691	33	2927.0	2023
26	33	0.97113	2018
26	33	0.97991	2019
26	33	0.97681	2020
26	33	0.97947	2021
26	33	0.96276	2022
26	33	0.99632	2023
32	33	872.0	2018
32	33	1005.0	2019
32	33	1132.0	2020
32	33	1360.0	2021
32	33	1494.0	2022
32	33	1677.0	2023
35	33	54.0	2018
35	33	55.91216216216216	2019
35	33	58.00951625693894	2020
35	33	60.76352067868505	2021
35	33	63.09562931317778	2022
35	33	64.17541692402718	2023
29	33	2076.0	2018
29	33	2294.0	2019
29	33	2454.0	2020
29	33	2761.0	2021
29	33	2986.0	2022
29	33	3186.0	2023
30	33	4.0	2018
30	33	4.0	2019
30	33	4.0	2020
30	33	4.0	2021
30	33	4.0	2022
30	33	4.0	2023
43	33	92.0	2018
43	33	98.0	2019
43	33	99.0	2020
43	33	102.0	2021
43	33	90.0	2022
43	33	76.0	2023
39	33	21.0	2018
39	33	11.0	2019
39	33	12.0	2020
39	33	11.0	2021
39	33	10.0	2022
39	33	9.0	2023
1690	33	268.0	2018
1690	33	325.0	2019
1690	33	385.0	2020
1690	33	487.0	2021
1690	33	541.0	2022
1690	33	595.0	2023
41	33	125.0	2018
41	33	298.0	2019
41	33	502.0	2020
41	33	804.0	2021
41	33	1076.0	2022
41	33	1213.0	2023
34	33	1314.0	2018
34	33	1424.0	2019
34	33	1443.0	2020
34	33	1571.0	2021
34	33	1634.0	2022
34	33	1676.0	2023
28	33	2150.0	2018
28	33	2368.0	2019
28	33	2522.0	2020
28	33	2829.0	2021
28	33	3043.0	2022
28	33	3238.0	2023
36	33	1035.0	2018
36	33	1130.0	2019
36	33	1166.0	2020
36	33	1272.0	2021
36	33	1361.0	2022
36	33	1464.0	2023
38	33	4.59	2018
38	33	3.81	2019
38	33	3.38	2020
38	33	2.76	2021
38	33	1.96	2022
38	33	1.35	2023
27	34	61.0	2018
27	34	63.0	2019
27	34	66.0	2020
27	34	84.0	2021
27	34	118.0	2022
27	34	136.0	2023
42	34	196.0	2018
42	34	220.0	2019
42	34	240.0	2020
42	34	257.0	2021
42	34	271.0	2022
42	34	292.0	2023
37	34	30.0	2018
37	34	28.0	2019
37	34	25.0	2020
37	34	20.0	2021
37	34	16.0	2022
37	34	15.0	2023
31	34	795.0	2018
31	34	877.0	2019
31	34	1027.0	2020
31	34	1294.0	2021
31	34	1560.0	2022
31	34	1996.0	2023
1691	34	1246.0	2018
1691	34	1341.0	2019
1691	34	1553.0	2020
1691	34	1860.0	2021
1691	34	2153.0	2022
1691	34	2492.0	2023
26	34	0.87081	2018
26	34	0.87833	2019
26	34	0.95237	2020
26	34	1.04263	2021
26	34	1.2582	2022
26	34	1.34698	2023
32	34	485.0	2018
32	34	545.0	2019
32	34	668.0	2020
32	34	874.0	2021
32	34	1097.0	2022
32	34	1482.0	2023
35	34	58.3208395802099	2018
35	34	58.74125874125873	2019
35	34	61.80514046622833	2020
35	34	66.07142857142857	2021
35	34	66.24311732316815	2022
35	34	66.91150752011193	2023
29	34	1175.0	2018
29	34	1282.0	2019
29	34	1522.0	2020
29	34	1863.0	2021
29	34	2206.0	2022
29	34	2716.0	2023
30	34	4.0	2018
30	34	4.0	2019
30	34	4.0	2020
30	34	4.0	2021
30	34	4.0	2022
30	34	4.0	2023
43	34	44.0	2018
43	34	41.0	2019
43	34	44.0	2020
43	34	41.0	2021
43	34	39.0	2022
43	34	30.0	2023
39	34	0.0	2018
39	34	2.0	2019
39	34	4.0	2020
39	34	4.0	2021
39	34	7.0	2022
39	34	7.0	2023
1690	34	162.0	2018
1690	34	200.0	2019
1690	34	250.0	2020
1690	34	314.0	2021
1690	34	387.0	2022
1690	34	441.0	2023
41	34	79.0	2018
41	34	169.0	2019
41	34	284.0	2020
41	34	456.0	2021
41	34	653.0	2022
41	34	772.0	2023
34	34	771.0	2018
34	34	795.0	2019
34	34	900.0	2020
34	34	1044.0	2021
34	34	1193.0	2022
34	34	1301.0	2023
28	34	1334.0	2018
28	34	1430.0	2019
28	34	1673.0	2020
28	34	2016.0	2021
28	34	2361.0	2022
28	34	2859.0	2023
36	34	651.0	2018
36	34	693.0	2019
36	34	775.0	2020
36	34	823.0	2021
36	34	850.0	2022
36	34	914.0	2023
38	34	2.39	2018
38	34	2.08	2019
38	34	1.58	2020
38	34	1.06	2021
38	34	0.72	2022
38	34	0.56	2023
27	35	54.0	2018
27	35	52.0	2019
27	35	58.0	2020
27	35	75.0	2021
27	35	83.0	2022
27	35	92.0	2023
42	35	492.0	2018
42	35	550.0	2019
42	35	609.0	2020
42	35	657.0	2021
42	35	727.0	2022
42	35	772.0	2023
37	35	51.0	2018
37	35	48.0	2019
37	35	44.0	2020
37	35	36.0	2021
37	35	27.0	2022
37	35	18.0	2023
31	35	1393.0	2018
31	35	1498.0	2019
31	35	1644.0	2020
31	35	1745.0	2021
31	35	1829.0	2022
31	35	1842.0	2023
1691	35	2153.0	2018
1691	35	2319.0	2019
1691	35	2584.0	2020
1691	35	2837.0	2021
1691	35	2962.0	2022
1691	35	2932.0	2023
26	35	0.98396	2018
26	35	1.01014	2019
26	35	1.00509	2020
26	35	0.98198	2021
26	35	0.91748	2022
26	35	0.91488	2023
32	35	1137.0	2018
32	35	1250.0	2019
32	35	1405.0	2020
32	35	1520.0	2021
32	35	1588.0	2022
32	35	1628.0	2023
35	35	69.2071835304424	2018
35	35	70.8214139762975	2019
35	35	72.4163295329165	2020
35	35	73.49799732977303	2021
35	35	74.4325346784363	2022
35	35	74.32266009852216	2023
29	35	2260.0	2018
29	35	2426.0	2019
29	35	2700.0	2020
29	35	2982.0	2021
29	35	3156.0	2022
29	35	3236.0	2023
30	35	1.0	2018
30	35	2.0	2019
30	35	2.0	2020
30	35	2.0	2021
30	35	2.0	2022
30	35	2.0	2023
43	35	59.0	2018
43	35	61.0	2019
43	35	76.0	2020
43	35	82.0	2021
43	35	79.0	2022
43	35	67.0	2023
39	35	10.0	2018
39	35	10.0	2019
39	35	15.0	2020
39	35	13.0	2021
39	35	13.0	2022
39	35	16.0	2023
1690	35	293.0	2018
1690	35	358.0	2019
1690	35	465.0	2020
1690	35	576.0	2021
1690	35	618.0	2022
1690	35	649.0	2023
41	35	99.0	2018
41	35	205.0	2019
41	35	386.0	2020
41	35	598.0	2021
41	35	808.0	2022
41	35	889.0	2023
34	35	1061.0	2018
34	35	1105.0	2019
34	35	1205.0	2020
34	35	1376.0	2021
34	35	1441.0	2022
34	35	1487.0	2023
28	35	2283.0	2018
28	35	2447.0	2019
28	35	2719.0	2020
28	35	2996.0	2021
28	35	3172.0	2022
28	35	3248.0	2023
36	35	1407.0	2018
36	35	1506.0	2019
36	35	1636.0	2020
36	35	1758.0	2021
36	35	1855.0	2022
36	35	1952.0	2023
38	35	2.36	2018
38	35	2.08	2019
38	35	1.72	2020
38	35	1.28	2021
38	35	0.91	2022
38	35	0.6	2023
27	36	1.0	2018
27	36	1.0	2019
27	36	1.0	2020
27	36	1.0	2021
27	36	3.0	2022
27	36	4.0	2023
42	36	30.0	2018
42	36	34.0	2019
42	36	46.0	2020
42	36	44.0	2021
42	36	66.0	2022
42	36	76.0	2023
37	36	1.0	2018
37	36	1.0	2019
37	36	1.0	2020
37	36	0.0	2021
37	36	0.0	2022
37	36	0.0	2023
31	36	24.0	2018
31	36	33.0	2019
31	36	49.0	2020
31	36	82.0	2021
31	36	131.0	2022
31	36	179.0	2023
1691	36	76.0	2018
1691	36	102.0	2019
1691	36	129.0	2020
1691	36	182.0	2021
1691	36	251.0	2022
1691	36	310.0	2023
26	36	0.51797	2018
26	36	0.53442	2019
26	36	0.50619	2020
26	36	0.51161	2021
26	36	0.60528	2022
26	36	0.56602	2023
32	36	11.0	2018
32	36	18.0	2019
32	36	26.0	2020
32	36	43.0	2021
32	36	67.0	2022
32	36	94.0	2023
35	36	67.07317073170732	2018
35	36	75.45454545454545	2019
35	36	74.10071942446044	2020
35	36	78.75647668393782	2021
35	36	81.98529411764707	2022
35	36	83.95415472779369	2023
29	36	82.0	2018
29	36	110.0	2019
29	36	139.0	2020
29	36	193.0	2021
29	36	272.0	2022
29	36	349.0	2023
30	36	0.0	2018
30	36	0.0	2019
30	36	0.0	2020
30	36	0.0	2021
30	36	0.0	2022
30	36	0.0	2023
43	36	1.0	2018
43	36	1.0	2019
43	36	2.0	2020
43	36	4.0	2021
43	36	4.0	2022
43	36	3.0	2023
39	36	0.0	2018
39	36	0.0	2019
39	36	0.0	2020
39	36	0.0	2021
39	36	0.0	2022
39	36	0.0	2023
1690	36	9.0	2018
1690	36	13.0	2019
1690	36	17.0	2020
1690	36	27.0	2021
1690	36	43.0	2022
1690	36	69.0	2023
41	36	8.0	2018
41	36	16.0	2019
41	36	28.0	2020
41	36	40.0	2021
41	36	57.0	2022
41	36	78.0	2023
34	36	35.0	2018
34	36	48.0	2019
34	36	61.0	2020
34	36	82.0	2021
34	36	108.0	2022
34	36	136.0	2023
28	36	82.0	2018
28	36	110.0	2019
28	36	139.0	2020
28	36	193.0	2021
28	36	272.0	2022
28	36	349.0	2023
36	36	111.0	2018
36	36	103.0	2019
36	36	118.0	2020
36	36	127.0	2021
36	36	174.0	2022
36	36	182.0	2023
38	36	1.37	2018
38	36	1.02	2019
38	36	0.8	2020
38	36	0.0	2021
38	36	0.0	2022
38	36	0.0	2023
27	37	49.0	2018
27	37	47.0	2019
27	37	57.0	2020
27	37	62.0	2021
27	37	61.0	2022
27	37	57.0	2023
42	37	267.0	2018
42	37	293.0	2019
42	37	331.0	2020
42	37	380.0	2021
42	37	399.0	2022
42	37	438.0	2023
37	37	32.0	2018
37	37	29.0	2019
37	37	31.0	2020
37	37	29.0	2021
37	37	20.0	2022
37	37	14.0	2023
31	37	689.0	2018
31	37	802.0	2019
31	37	962.0	2020
31	37	1060.0	2021
31	37	1163.0	2022
31	37	1258.0	2023
1691	37	1247.0	2018
1691	37	1461.0	2019
1691	37	1709.0	2020
1691	37	1894.0	2021
1691	37	2077.0	2022
1691	37	2109.0	2023
26	37	0.72994	2018
26	37	0.69136	2019
26	37	0.73582	2020
26	37	0.74871	2021
26	37	0.75877	2022
26	37	0.74893	2023
32	37	458.0	2018
32	37	523.0	2019
32	37	643.0	2020
32	37	755.0	2021
32	37	874.0	2022
32	37	991.0	2023
35	37	55.73893473368342	2018
35	37	56.44329896907216	2019
35	37	58.2089552238806	2020
35	37	60.12909632571996	2021
35	37	61.59453302961276	2022
35	37	61.96213425129088	2023
29	37	1314.0	2018
29	37	1528.0	2019
29	37	1784.0	2020
29	37	1987.0	2021
29	37	2167.0	2022
29	37	2297.0	2023
30	37	2.0	2018
30	37	3.0	2019
30	37	3.0	2020
30	37	3.0	2021
30	37	3.0	2022
30	37	3.0	2023
43	37	30.0	2018
43	37	38.0	2019
43	37	44.0	2020
43	37	41.0	2021
43	37	31.0	2022
43	37	26.0	2023
39	37	28.0	2018
39	37	33.0	2019
39	37	30.0	2020
39	37	28.0	2021
39	37	21.0	2022
39	37	17.0	2023
1690	37	113.0	2018
1690	37	148.0	2019
1690	37	221.0	2020
1690	37	268.0	2021
1690	37	322.0	2022
1690	37	365.0	2023
41	37	97.0	2018
41	37	217.0	2019
41	37	372.0	2020
41	37	534.0	2021
41	37	695.0	2022
41	37	768.0	2023
34	37	724.0	2018
34	37	817.0	2019
34	37	923.0	2020
34	37	1003.0	2021
34	37	1035.0	2022
34	37	1082.0	2023
28	37	1333.0	2018
28	37	1552.0	2019
28	37	1809.0	2020
28	37	2014.0	2021
28	37	2195.0	2022
28	37	2324.0	2023
36	37	824.0	2018
36	37	918.0	2019
36	37	1006.0	2020
36	37	1130.0	2021
36	37	1201.0	2022
36	37	1309.0	2023
38	37	2.54	2018
38	37	1.99	2019
38	37	1.83	2020
38	37	1.54	2021
38	37	0.97	2022
38	37	0.63	2023
27	38	59.0	2018
27	38	67.0	2019
27	38	74.0	2020
27	38	87.0	2021
27	38	98.0	2022
27	38	111.0	2023
42	38	362.0	2018
42	38	406.0	2019
42	38	493.0	2020
42	38	555.0	2021
42	38	620.0	2022
42	38	677.0	2023
37	38	63.0	2018
37	38	65.0	2019
37	38	60.0	2020
37	38	49.0	2021
37	38	29.0	2022
37	38	23.0	2023
31	38	714.0	2018
31	38	808.0	2019
31	38	980.0	2020
31	38	1142.0	2021
31	38	1307.0	2022
31	38	1435.0	2023
1691	38	1346.0	2018
1691	38	1495.0	2019
1691	38	1747.0	2020
1691	38	1991.0	2021
1691	38	2176.0	2022
1691	38	2279.0	2023
26	38	1.4668	2018
26	38	1.45507	2019
26	38	1.2272	2020
26	38	1.37744	2021
26	38	1.40715	2022
26	38	1.40621	2023
32	38	631.0	2018
32	38	725.0	2019
32	38	880.0	2020
32	38	1026.0	2021
32	38	1163.0	2022
32	38	1278.0	2023
35	38	64.60431654676259	2018
35	38	64.640522875817	2019
35	38	64.90545050055617	2020
35	38	67.20351390922401	2021
35	38	68.50706713780919	2022
35	38	69.0020366598778	2023
29	38	1390.0	2018
29	38	1530.0	2019
29	38	1798.0	2020
29	38	2049.0	2021
29	38	2264.0	2022
29	38	2455.0	2023
30	38	0.0	2018
30	38	0.0	2019
30	38	0.0	2020
30	38	0.0	2021
30	38	0.0	2022
30	38	0.0	2023
43	38	154.0	2018
43	38	144.0	2019
43	38	146.0	2020
43	38	146.0	2021
43	38	135.0	2022
43	38	116.0	2023
39	38	7.0	2018
39	38	8.0	2019
39	38	7.0	2020
39	38	5.0	2021
39	38	7.0	2022
39	38	9.0	2023
1690	38	281.0	2018
1690	38	337.0	2019
1690	38	409.0	2020
1690	38	494.0	2021
1690	38	574.0	2022
1690	38	616.0	2023
41	38	116.0	2018
41	38	240.0	2019
41	38	454.0	2020
41	38	677.0	2021
41	38	884.0	2022
41	38	962.0	2023
34	38	669.0	2018
34	38	718.0	2019
34	38	839.0	2020
34	38	939.0	2021
34	38	1027.0	2022
34	38	1107.0	2023
28	38	1390.0	2018
28	38	1530.0	2019
28	38	1798.0	2020
28	38	2049.0	2021
28	38	2264.0	2022
28	38	2455.0	2023
36	38	1001.0	2018
36	38	1095.0	2019
36	38	1230.0	2020
36	38	1369.0	2021
36	38	1521.0	2022
36	38	1645.0	2023
38	38	5.04	2018
38	38	4.78	2019
38	38	3.74	2020
38	38	2.68	2021
38	38	1.46	2022
38	38	1.07	2023
27	39	0.0	2018
27	39	0.0	2019
27	39	0.0	2020
27	39	0.0	2021
27	39	0.0	2022
27	39	0.0	2023
42	39	3.0	2018
42	39	2.0	2019
42	39	2.0	2020
42	39	1.0	2021
42	39	2.0	2022
42	39	2.0	2023
37	39	0.0	2018
37	39	0.0	2019
37	39	0.0	2020
37	39	0.0	2021
37	39	0.0	2022
37	39	0.0	2023
31	39	3.0	2018
31	39	1.0	2019
31	39	1.0	2020
31	39	1.0	2021
31	39	6.0	2022
31	39	7.0	2023
1691	39	4.0	2018
1691	39	3.0	2019
1691	39	3.0	2020
1691	39	3.0	2021
1691	39	5.0	2022
1691	39	5.0	2023
26	39	0.13725	2018
26	39	0.46884	2019
26	39	0.46884	2020
26	39	0.46884	2021
26	39	1.51233	2022
26	39	1.51233	2023
32	39	0.0	2018
32	39	1.0	2019
32	39	1.0	2020
32	39	1.0	2021
32	39	1.0	2022
32	39	1.0	2023
35	39	75.0	2018
35	39	33.33333333333333	2019
35	39	33.33333333333333	2020
35	39	33.33333333333333	2021
35	39	75.0	2022
35	39	77.77777777777777	2023
29	39	4.0	2018
29	39	3.0	2019
29	39	3.0	2020
29	39	3.0	2021
29	39	8.0	2022
29	39	9.0	2023
30	39	0.0	2018
30	39	0.0	2019
30	39	0.0	2020
30	39	0.0	2021
30	39	0.0	2022
30	39	0.0	2023
43	39	0.0	2018
43	39	0.0	2019
43	39	0.0	2020
43	39	0.0	2021
43	39	0.0	2022
43	39	0.0	2023
39	39	0.0	2018
39	39	0.0	2019
39	39	0.0	2020
39	39	0.0	2021
39	39	0.0	2022
39	39	0.0	2023
1690	39	0.0	2018
1690	39	1.0	2019
1690	39	1.0	2020
1690	39	1.0	2021
1690	39	2.0	2022
1690	39	2.0	2023
41	39	0.0	2018
41	39	0.0	2019
41	39	0.0	2020
41	39	0.0	2021
41	39	3.0	2022
41	39	3.0	2023
34	39	2.0	2018
34	39	1.0	2019
34	39	1.0	2020
34	39	0.0	2021
34	39	0.0	2022
34	39	0.0	2023
28	39	4.0	2018
28	39	3.0	2019
28	39	3.0	2020
28	39	3.0	2021
28	39	8.0	2022
28	39	9.0	2023
36	39	4.0	2018
36	39	4.0	2019
36	39	4.0	2020
36	39	4.0	2021
36	39	5.0	2022
36	39	5.0	2023
38	39	0.0	2018
38	39	0.0	2019
38	39	0.0	2020
38	39	0.0	2021
38	39	0.0	2022
38	39	0.0	2023
27	40	1.0	2018
27	40	1.0	2019
27	40	0.0	2020
27	40	0.0	2021
27	40	0.0	2022
27	40	0.0	2023
42	40	2.0	2018
42	40	0.0	2019
42	40	1.0	2020
42	40	1.0	2021
42	40	1.0	2022
42	40	1.0	2023
37	40	0.0	2018
37	40	0.0	2019
37	40	0.0	2020
37	40	0.0	2021
37	40	0.0	2022
37	40	0.0	2023
31	40	1.0	2018
31	40	0.0	2019
31	40	1.0	2020
31	40	2.0	2021
31	40	2.0	2022
31	40	2.0	2023
1691	40	6.0	2018
1691	40	2.0	2019
1691	40	1.0	2020
1691	40	2.0	2021
1691	40	2.0	2022
1691	40	2.0	2023
26	40	0.73432	2018
26	40	1.09042	2019
26	40	0.04824	2020
26	40	0.02412	2021
26	40	0.02412	2022
26	40	0.02412	2023
32	40	2.0	2018
32	40	0.0	2019
32	40	0.0	2020
32	40	0.0	2021
32	40	0.0	2022
32	40	0.0	2023
35	40	100.0	2018
35	40	100.0	2019
35	40	0.0	2020
35	40	50.0	2021
35	40	50.0	2022
35	40	50.0	2023
29	40	6.0	2018
29	40	2.0	2019
29	40	1.0	2020
29	40	2.0	2021
29	40	2.0	2022
29	40	2.0	2023
30	40	0.0	2018
30	40	0.0	2019
30	40	0.0	2020
30	40	0.0	2021
30	40	0.0	2022
30	40	0.0	2023
43	40	0.0	2018
43	40	0.0	2019
43	40	0.0	2020
43	40	0.0	2021
43	40	0.0	2022
43	40	0.0	2023
39	40	0.0	2018
39	40	0.0	2019
39	40	0.0	2020
39	40	0.0	2021
39	40	0.0	2022
39	40	0.0	2023
1690	40	1.0	2018
1690	40	0.0	2019
1690	40	0.0	2020
1690	40	0.0	2021
1690	40	0.0	2022
1690	40	0.0	2023
41	40	0.0	2018
41	40	0.0	2019
41	40	0.0	2020
41	40	0.0	2021
41	40	0.0	2022
41	40	0.0	2023
34	40	4.0	2018
34	40	2.0	2019
34	40	1.0	2020
34	40	2.0	2021
34	40	2.0	2022
34	40	2.0	2023
28	40	6.0	2018
28	40	2.0	2019
28	40	1.0	2020
28	40	2.0	2021
28	40	2.0	2022
28	40	2.0	2023
36	40	5.0	2018
36	40	1.0	2019
36	40	1.0	2020
36	40	8.0	2021
36	40	8.0	2022
36	40	8.0	2023
38	40	0.0	2018
38	40	0.0	2019
38	40	0.0	2020
38	40	0.0	2021
38	40	0.0	2022
38	40	0.0	2023
27	41	114.0	2018
27	41	119.0	2019
27	41	115.0	2020
27	41	107.0	2021
27	41	106.0	2022
27	41	118.0	2023
42	41	283.0	2018
42	41	279.0	2019
42	41	276.0	2020
42	41	303.0	2021
42	41	328.0	2022
42	41	341.0	2023
37	41	22.0	2018
37	41	16.0	2019
37	41	10.0	2020
37	41	9.0	2021
37	41	5.0	2022
37	41	4.0	2023
31	41	1204.0	2018
31	41	1268.0	2019
31	41	1294.0	2020
31	41	1372.0	2021
31	41	1439.0	2022
31	41	1573.0	2023
1691	41	1968.0	2018
1691	41	2026.0	2019
1691	41	1997.0	2020
1691	41	2096.0	2021
1691	41	2205.0	2022
1691	41	2267.0	2023
26	41	1.65976	2018
26	41	1.66035	2019
26	41	1.49224	2020
26	41	1.46052	2021
26	41	1.36854	2022
26	41	1.21669	2023
32	41	980.0	2018
32	41	1066.0	2019
32	41	1140.0	2020
32	41	1268.0	2021
32	41	1340.0	2022
32	41	1460.0	2023
35	41	64.55756422454805	2018
35	41	65.89002795899349	2019
35	41	68.7883074021688	2020
35	41	72.28163992869875	2021
35	41	74.25200168563	2022
35	41	73.60126083530339	2023
29	41	2078.0	2018
29	41	2123.0	2019
29	41	2097.0	2020
29	41	2217.0	2021
29	41	2352.0	2022
29	41	2515.0	2023
30	41	2.0	2018
30	41	3.0	2019
30	41	3.0	2020
30	41	3.0	2021
30	41	3.0	2022
30	41	3.0	2023
43	41	189.0	2018
43	41	184.0	2019
43	41	161.0	2020
43	41	146.0	2021
43	41	116.0	2022
43	41	89.0	2023
39	41	0.0	2018
39	41	0.0	2019
39	41	13.0	2020
39	41	19.0	2021
39	41	24.0	2022
39	41	26.0	2023
1690	41	315.0	2018
1690	41	329.0	2019
1690	41	352.0	2020
1690	41	414.0	2021
1690	41	451.0	2022
1690	41	485.0	2023
41	41	104.0	2018
41	41	214.0	2019
41	41	332.0	2020
41	41	493.0	2021
41	41	645.0	2022
41	41	717.0	2023
34	41	999.0	2018
34	41	958.0	2019
34	41	889.0	2020
34	41	892.0	2021
34	41	928.0	2022
34	41	1006.0	2023
28	41	2102.0	2018
28	41	2146.0	2019
28	41	2121.0	2020
28	41	2244.0	2021
28	41	2373.0	2022
28	41	2538.0	2023
36	41	786.0	2018
36	41	813.0	2019
36	41	798.0	2020
36	41	837.0	2021
36	41	901.0	2022
36	41	980.0	2023
38	41	1.21	2018
38	41	0.86	2019
38	41	0.54	2020
38	41	0.46	2021
38	41	0.24	2022
38	41	0.18	2023
27	42	12.0	2018
27	42	11.0	2019
27	42	9.0	2020
27	42	12.0	2021
27	42	19.0	2022
27	42	23.0	2023
42	42	70.0	2018
42	42	84.0	2019
42	42	103.0	2020
42	42	140.0	2021
42	42	161.0	2022
42	42	192.0	2023
37	42	5.0	2018
37	42	6.0	2019
37	42	5.0	2020
37	42	5.0	2021
37	42	5.0	2022
37	42	4.0	2023
31	42	143.0	2018
31	42	154.0	2019
31	42	188.0	2020
31	42	253.0	2021
31	42	327.0	2022
31	42	386.0	2023
1691	42	362.0	2018
1691	42	408.0	2019
1691	42	433.0	2020
1691	42	555.0	2021
1691	42	658.0	2022
1691	42	728.0	2023
26	42	0.78796	2018
26	42	0.75626	2019
26	42	0.73256	2020
26	42	0.80372	2021
26	42	1.24831	2022
26	42	1.15283	2023
32	42	103.0	2018
32	42	117.0	2019
32	42	133.0	2020
32	42	193.0	2021
32	42	257.0	2022
32	42	322.0	2023
35	42	56.18556701030928	2018
35	42	57.70114942528736	2019
35	42	61.72043010752688	2020
35	42	63.63636363636364	2021
35	42	64.9645390070922	2022
35	42	66.01941747572816	2023
29	42	388.0	2018
29	42	435.0	2019
29	42	465.0	2020
29	42	594.0	2021
29	42	705.0	2022
29	42	824.0	2023
30	42	0.0	2018
30	42	0.0	2019
30	42	0.0	2020
30	42	0.0	2021
30	42	0.0	2022
30	42	0.0	2023
43	42	9.0	2018
43	42	14.0	2019
43	42	11.0	2020
43	42	13.0	2021
43	42	14.0	2022
43	42	12.0	2023
39	42	0.0	2018
39	42	0.0	2019
39	42	0.0	2020
39	42	0.0	2021
39	42	0.0	2022
39	42	0.0	2023
1690	42	64.0	2018
1690	42	74.0	2019
1690	42	81.0	2020
1690	42	108.0	2021
1690	42	129.0	2022
1690	42	148.0	2023
41	42	24.0	2018
41	42	67.0	2019
41	42	113.0	2020
41	42	194.0	2021
41	42	259.0	2022
41	42	307.0	2023
34	42	204.0	2018
34	42	225.0	2019
34	42	237.0	2020
34	42	294.0	2021
34	42	323.0	2022
34	42	367.0	2023
28	42	388.0	2018
28	42	435.0	2019
28	42	465.0	2020
28	42	594.0	2021
28	42	705.0	2022
28	42	824.0	2023
36	42	241.0	2018
36	42	278.0	2019
36	42	305.0	2020
36	42	407.0	2021
36	42	437.0	2022
36	42	522.0	2023
38	42	1.42	2018
38	42	1.51	2019
38	42	1.17	2020
38	42	0.92	2021
38	42	0.78	2022
38	42	0.54	2023
27	43	0.0	2018
27	43	0.0	2019
27	43	0.0	2020
27	43	0.0	2021
27	43	1.0	2022
27	43	1.0	2023
42	43	16.0	2018
42	43	15.0	2019
42	43	16.0	2020
42	43	19.0	2021
42	43	23.0	2022
42	43	14.0	2023
37	43	0.0	2018
37	43	0.0	2019
37	43	1.0	2020
37	43	2.0	2021
37	43	2.0	2022
37	43	2.0	2023
31	43	8.0	2018
31	43	12.0	2019
31	43	11.0	2020
31	43	17.0	2021
31	43	19.0	2022
31	43	25.0	2023
1691	43	43.0	2018
1691	43	49.0	2019
1691	43	49.0	2020
1691	43	54.0	2021
1691	43	53.0	2022
1691	43	47.0	2023
26	43	0.61749	2018
26	43	0.54761	2019
26	43	0.52656	2020
26	43	0.62141	2021
26	43	0.56357	2022
26	43	0.53842	2023
32	43	5.0	2018
32	43	4.0	2019
32	43	3.0	2020
32	43	5.0	2021
32	43	6.0	2022
32	43	9.0	2023
35	43	76.74418604651162	2018
35	43	78.84615384615384	2019
35	43	83.01886792452831	2020
35	43	80.0	2021
35	43	77.96610169491525	2022
35	43	81.35593220338983	2023
29	43	43.0	2018
29	43	52.0	2019
29	43	53.0	2020
29	43	60.0	2021
29	43	59.0	2022
29	43	59.0	2023
30	43	0.0	2018
30	43	0.0	2019
30	43	0.0	2020
30	43	0.0	2021
30	43	0.0	2022
30	43	0.0	2023
43	43	0.0	2018
43	43	0.0	2019
43	43	0.0	2020
43	43	0.0	2021
43	43	0.0	2022
43	43	0.0	2023
39	43	0.0	2018
39	43	0.0	2019
39	43	0.0	2020
39	43	0.0	2021
39	43	0.0	2022
39	43	0.0	2023
1690	43	4.0	2018
1690	43	9.0	2019
1690	43	10.0	2020
1690	43	13.0	2021
1690	43	15.0	2022
1690	43	18.0	2023
41	43	1.0	2018
41	43	5.0	2019
41	43	5.0	2020
41	43	9.0	2021
41	43	12.0	2022
41	43	15.0	2023
34	43	21.0	2018
34	43	29.0	2019
34	43	29.0	2020
34	43	29.0	2021
34	43	28.0	2022
34	43	30.0	2023
28	43	43.0	2018
28	43	52.0	2019
28	43	53.0	2020
28	43	60.0	2021
28	43	59.0	2022
28	43	59.0	2023
36	43	35.0	2018
36	43	39.0	2019
36	43	41.0	2020
36	43	44.0	2021
36	43	47.0	2022
36	43	39.0	2023
38	43	0.0	2018
38	43	0.0	2019
38	43	2.38	2020
38	43	3.92	2021
38	43	4.26	2022
38	43	4.55	2023
27	44	0.0	2018
27	44	0.0	2019
27	44	0.0	2020
27	44	0.0	2021
27	44	0.0	2022
27	44	0.0	2023
42	44	14.0	2018
42	44	12.0	2019
42	44	8.0	2020
42	44	5.0	2021
42	44	0.0	2022
42	44	0.0	2023
37	44	0.0	2018
37	44	0.0	2019
37	44	0.0	2020
37	44	0.0	2021
37	44	0.0	2022
37	44	0.0	2023
31	44	12.0	2018
31	44	10.0	2019
31	44	8.0	2020
31	44	5.0	2021
31	44	2.0	2022
31	44	1.0	2023
1691	44	28.0	2018
1691	44	25.0	2019
1691	44	20.0	2020
1691	44	10.0	2021
1691	44	4.0	2022
1691	44	2.0	2023
26	44	0.50551	2018
26	44	0.52943	2019
26	44	0.57712	2020
26	44	0.48801	2021
26	44	0.65896	2022
26	44	0.17758	2023
32	44	9.0	2018
32	44	8.0	2019
32	44	6.0	2020
32	44	4.0	2021
32	44	1.0	2022
32	44	0.0	2023
35	44	60.71428571428572	2018
35	44	60.0	2019
35	44	60.0	2020
35	44	60.0	2021
35	44	100.0	2022
35	44	100.0	2023
29	44	28.0	2018
29	44	25.0	2019
29	44	20.0	2020
29	44	10.0	2021
29	44	4.0	2022
29	44	2.0	2023
30	44	0.0	2018
30	44	0.0	2019
30	44	0.0	2020
30	44	0.0	2021
30	44	0.0	2022
30	44	0.0	2023
43	44	2.0	2018
43	44	1.0	2019
43	44	0.0	2020
43	44	0.0	2021
43	44	0.0	2022
43	44	0.0	2023
39	44	0.0	2018
39	44	0.0	2019
39	44	0.0	2020
39	44	0.0	2021
39	44	0.0	2022
39	44	0.0	2023
1690	44	4.0	2018
1690	44	4.0	2019
1690	44	4.0	2020
1690	44	3.0	2021
1690	44	1.0	2022
1690	44	0.0	2023
41	44	0.0	2018
41	44	0.0	2019
41	44	1.0	2020
41	44	1.0	2021
41	44	1.0	2022
41	44	1.0	2023
34	44	5.0	2018
34	44	5.0	2019
34	44	3.0	2020
34	44	0.0	2021
34	44	0.0	2022
34	44	0.0	2023
28	44	28.0	2018
28	44	25.0	2019
28	44	20.0	2020
28	44	10.0	2021
28	44	4.0	2022
28	44	2.0	2023
36	44	27.0	2018
36	44	24.0	2019
36	44	20.0	2020
36	44	11.0	2021
36	44	5.0	2022
36	44	2.0	2023
38	44	0.0	2018
38	44	0.0	2019
38	44	0.0	2020
38	44	0.0	2021
38	44	0.0	2022
38	44	0.0	2023
27	45	1.0	2018
27	45	1.0	2019
27	45	0.0	2020
27	45	0.0	2021
27	45	0.0	2022
27	45	0.0	2023
42	45	8.0	2018
42	45	7.0	2019
42	45	7.0	2020
42	45	16.0	2021
42	45	19.0	2022
42	45	24.0	2023
37	45	0.0	2018
37	45	0.0	2019
37	45	0.0	2020
37	45	1.0	2021
37	45	1.0	2022
37	45	1.0	2023
31	45	20.0	2018
31	45	24.0	2019
31	45	37.0	2020
31	45	51.0	2021
31	45	64.0	2022
31	45	70.0	2023
1691	45	26.0	2018
1691	45	41.0	2019
1691	45	58.0	2020
1691	45	84.0	2021
1691	45	104.0	2022
1691	45	117.0	2023
26	45	1.21371	2018
26	45	0.93567	2019
26	45	0.75873	2020
26	45	0.75378	2021
26	45	0.70832	2022
26	45	0.65648	2023
32	45	14.0	2018
32	45	18.0	2019
32	45	24.0	2020
32	45	37.0	2021
32	45	44.0	2022
32	45	45.0	2023
35	45	63.33333333333333	2018
35	45	57.14285714285714	2019
35	45	66.10169491525424	2020
35	45	67.44186046511628	2021
35	45	71.29629629629629	2022
35	45	73.01587301587301	2023
29	45	30.0	2018
29	45	42.0	2019
29	45	59.0	2020
29	45	86.0	2021
29	45	108.0	2022
29	45	126.0	2023
30	45	0.0	2018
30	45	0.0	2019
30	45	0.0	2020
30	45	0.0	2021
30	45	0.0	2022
30	45	0.0	2023
43	45	1.0	2018
43	45	3.0	2019
43	45	5.0	2020
43	45	5.0	2021
43	45	6.0	2022
43	45	7.0	2023
39	45	0.0	2018
39	45	0.0	2019
39	45	0.0	2020
39	45	0.0	2021
39	45	0.0	2022
39	45	0.0	2023
1690	45	7.0	2018
1690	45	10.0	2019
1690	45	14.0	2020
1690	45	23.0	2021
1690	45	28.0	2022
1690	45	35.0	2023
41	45	2.0	2018
41	45	3.0	2019
41	45	8.0	2020
41	45	19.0	2021
41	45	31.0	2022
41	45	38.0	2023
34	45	12.0	2018
34	45	15.0	2019
34	45	15.0	2020
34	45	22.0	2021
34	45	23.0	2022
34	45	23.0	2023
28	45	30.0	2018
28	45	42.0	2019
28	45	59.0	2020
28	45	86.0	2021
28	45	108.0	2022
28	45	126.0	2023
36	45	29.0	2018
36	45	32.0	2019
36	45	36.0	2020
36	45	52.0	2021
36	45	54.0	2022
36	45	57.0	2023
38	45	0.0	2018
38	45	0.0	2019
38	45	0.0	2020
38	45	1.22	2021
38	45	0.96	2022
38	45	0.81	2023
27	46	0.0	2018
27	46	0.0	2019
27	46	0.0	2020
27	46	0.0	2021
27	46	0.0	2022
27	46	0.0	2023
42	46	5.0	2018
42	46	5.0	2019
42	46	4.0	2020
42	46	7.0	2021
42	46	6.0	2022
42	46	3.0	2023
37	46	0.0	2018
37	46	0.0	2019
37	46	0.0	2020
37	46	0.0	2021
37	46	0.0	2022
37	46	0.0	2023
31	46	4.0	2018
31	46	3.0	2019
31	46	3.0	2020
31	46	3.0	2021
31	46	3.0	2022
31	46	1.0	2023
1691	46	11.0	2018
1691	46	10.0	2019
1691	46	8.0	2020
1691	46	9.0	2021
1691	46	9.0	2022
1691	46	5.0	2023
26	46	0.40708	2018
26	46	0.3302	2019
26	46	0.3086	2020
26	46	0.21419	2021
26	46	0.12291	2022
26	46	0.08226	2023
32	46	2.0	2018
32	46	1.0	2019
32	46	1.0	2020
32	46	2.0	2021
32	46	2.0	2022
32	46	1.0	2023
35	46	72.72727272727272	2018
35	46	70.0	2019
35	46	62.5	2020
35	46	77.77777777777777	2021
35	46	66.66666666666666	2022
35	46	66.66666666666666	2023
29	46	11.0	2018
29	46	10.0	2019
29	46	8.0	2020
29	46	9.0	2021
29	46	9.0	2022
29	46	6.0	2023
30	46	0.0	2018
30	46	0.0	2019
30	46	0.0	2020
30	46	0.0	2021
30	46	0.0	2022
30	46	0.0	2023
43	46	2.0	2018
43	46	1.0	2019
43	46	1.0	2020
43	46	0.0	2021
43	46	0.0	2022
43	46	0.0	2023
39	46	0.0	2018
39	46	0.0	2019
39	46	0.0	2020
39	46	0.0	2021
39	46	0.0	2022
39	46	0.0	2023
1690	46	2.0	2018
1690	46	1.0	2019
1690	46	1.0	2020
1690	46	1.0	2021
1690	46	0.0	2022
1690	46	0.0	2023
41	46	0.0	2018
41	46	0.0	2019
41	46	0.0	2020
41	46	0.0	2021
41	46	2.0	2022
41	46	2.0	2023
34	46	4.0	2018
34	46	3.0	2019
34	46	3.0	2020
34	46	4.0	2021
34	46	3.0	2022
34	46	3.0	2023
28	46	11.0	2018
28	46	10.0	2019
28	46	8.0	2020
28	46	9.0	2021
28	46	9.0	2022
28	46	6.0	2023
36	46	10.0	2018
36	46	9.0	2019
36	46	8.0	2020
36	46	14.0	2021
36	46	14.0	2022
36	46	10.0	2023
38	46	0.0	2018
38	46	0.0	2019
38	46	0.0	2020
38	46	0.0	2021
38	46	0.0	2022
38	46	0.0	2023
27	47	0.0	2018
27	47	0.0	2019
27	47	0.0	2020
27	47	0.0	2021
42	47	0.0	2022
42	47	0.0	2023
42	47	0.0	2018
42	47	0.0	2019
37	47	0.0	2020
37	47	0.0	2021
37	47	0.0	2022
37	47	0.0	2023
31	47	0.0	2018
31	47	0.0	2019
31	47	0.0	2020
31	47	0.0	2021
1691	47	1.0	2022
1691	47	1.0	2023
1691	47	1.0	2018
1691	47	1.0	2019
26	47	0.0	2020
26	47	0.0	2021
26	47	0.0	2022
26	47	0.0	2023
32	47	0.0	2018
32	47	0.0	2019
32	47	0.0	2020
32	47	0.0	2021
35	47	100.0	2022
35	47	100.0	2023
35	47	100.0	2018
35	47	100.0	2019
29	47	1.0	2020
29	47	1.0	2021
29	47	1.0	2022
29	47	1.0	2023
30	47	0.0	2018
30	47	0.0	2019
30	47	0.0	2020
30	47	0.0	2021
43	47	0.0	2022
43	47	0.0	2023
43	47	0.0	2018
43	47	0.0	2019
39	47	0.0	2020
39	47	0.0	2021
39	47	0.0	2022
39	47	0.0	2023
1690	47	0.0	2018
1690	47	0.0	2019
1690	47	0.0	2020
1690	47	0.0	2021
41	47	0.0	2022
41	47	0.0	2023
41	47	0.0	2018
41	47	0.0	2019
34	47	1.0	2020
34	47	1.0	2021
34	47	1.0	2022
34	47	1.0	2023
28	47	1.0	2018
28	47	1.0	2019
28	47	1.0	2020
28	47	1.0	2021
36	47	1.0	2022
36	47	1.0	2023
36	47	1.0	2018
36	47	1.0	2019
38	47	0.0	2020
38	47	0.0	2021
38	47	0.0	2022
38	47	0.0	2023
27	48	32.0	2018
27	48	45.0	2019
27	48	69.0	2020
27	48	80.0	2021
27	48	88.0	2022
27	48	88.0	2023
42	48	204.0	2018
42	48	260.0	2019
42	48	336.0	2020
42	48	411.0	2021
42	48	474.0	2022
42	48	488.0	2023
37	48	40.0	2018
37	48	53.0	2019
37	48	59.0	2020
37	48	54.0	2021
37	48	47.0	2022
37	48	34.0	2023
31	48	430.0	2018
31	48	672.0	2019
31	48	944.0	2020
31	48	1214.0	2021
31	48	1407.0	2022
31	48	1464.0	2023
1691	48	724.0	2018
1691	48	1066.0	2019
1691	48	1471.0	2020
1691	48	1854.0	2021
1691	48	2135.0	2022
1691	48	2199.0	2023
26	48	1.0973	2018
26	48	1.11581	2019
26	48	1.2012	2020
26	48	1.17907	2021
26	48	1.1984	2022
26	48	1.17041	2023
32	48	354.0	2018
32	48	544.0	2019
32	48	798.0	2020
32	48	1036.0	2021
32	48	1224.0	2022
32	48	1325.0	2023
35	48	71.23655913978496	2018
35	48	70.17383348581885	2019
35	48	69.88749172733289	2020
35	48	70.87024491922877	2021
35	48	71.35769057284618	2022
35	48	69.9228791773779	2023
29	48	744.0	2018
29	48	1093.0	2019
29	48	1511.0	2020
29	48	1919.0	2021
29	48	2217.0	2022
29	48	2334.0	2023
30	48	0.0	2018
30	48	0.0	2019
30	48	0.0	2020
30	48	0.0	2021
30	48	0.0	2022
30	48	0.0	2023
43	48	45.0	2018
43	48	73.0	2019
43	48	92.0	2020
43	48	108.0	2021
43	48	106.0	2022
43	48	91.0	2023
39	48	2.0	2018
39	48	3.0	2019
39	48	4.0	2020
39	48	3.0	2021
39	48	5.0	2022
39	48	5.0	2023
1690	48	185.0	2018
1690	48	291.0	2019
1690	48	414.0	2020
1690	48	542.0	2021
1690	48	606.0	2022
1690	48	633.0	2023
41	48	79.0	2018
41	48	221.0	2019
41	48	402.0	2020
41	48	614.0	2021
41	48	778.0	2022
41	48	857.0	2023
34	48	321.0	2018
34	48	449.0	2019
34	48	612.0	2020
34	48	753.0	2021
34	48	844.0	2022
34	48	849.0	2023
28	48	744.0	2018
28	48	1093.0	2019
28	48	1511.0	2020
28	48	1919.0	2021
28	48	2217.0	2022
28	48	2334.0	2023
36	48	594.0	2018
36	48	730.0	2019
36	48	880.0	2020
36	48	1032.0	2021
36	48	1155.0	2022
36	48	1207.0	2023
38	48	5.6	2018
38	48	5.08	2019
38	48	4.06	2020
38	48	2.96	2021
38	48	2.22	2022
38	48	1.54	2023
27	49	5.0	2018
27	49	5.0	2019
27	49	7.0	2020
27	49	8.0	2021
27	49	8.0	2022
27	49	7.0	2023
42	49	41.0	2018
42	49	44.0	2019
42	49	64.0	2020
42	49	85.0	2021
42	49	113.0	2022
42	49	117.0	2023
37	49	9.0	2018
37	49	9.0	2019
37	49	5.0	2020
37	49	4.0	2021
37	49	1.0	2022
37	49	0.0	2023
31	49	78.0	2018
31	49	90.0	2019
31	49	125.0	2020
31	49	165.0	2021
31	49	240.0	2022
31	49	274.0	2023
1691	49	184.0	2018
1691	49	206.0	2019
1691	49	264.0	2020
1691	49	327.0	2021
1691	49	400.0	2022
1691	49	440.0	2023
26	49	0.62063	2018
26	49	0.67978	2019
26	49	0.58992	2020
26	49	0.62813	2021
26	49	0.6863	2022
26	49	0.65242	2023
32	49	53.0	2018
32	49	62.0	2019
32	49	76.0	2020
32	49	104.0	2021
32	49	126.0	2022
32	49	142.0	2023
35	49	57.692307692307686	2018
35	49	54.97835497835498	2019
35	49	60.66666666666666	2020
35	49	66.0377358490566	2021
35	49	70.32520325203252	2022
35	49	72.31040564373897	2023
29	49	208.0	2018
29	49	231.0	2019
29	49	300.0	2020
29	49	371.0	2021
29	49	492.0	2022
29	49	567.0	2023
30	49	0.0	2018
30	49	0.0	2019
30	49	0.0	2020
30	49	0.0	2021
30	49	0.0	2022
30	49	0.0	2023
43	49	8.0	2018
43	49	7.0	2019
43	49	7.0	2020
43	49	7.0	2021
43	49	4.0	2022
43	49	3.0	2023
39	49	0.0	2018
39	49	0.0	2019
39	49	0.0	2020
39	49	0.0	2021
39	49	0.0	2022
39	49	0.0	2023
1690	49	35.0	2018
1690	49	38.0	2019
1690	49	52.0	2020
1690	49	74.0	2021
1690	49	86.0	2022
1690	49	99.0	2023
41	49	12.0	2018
41	49	22.0	2019
41	49	50.0	2020
41	49	78.0	2021
41	49	118.0	2022
41	49	133.0	2023
34	49	103.0	2018
34	49	110.0	2019
34	49	143.0	2020
34	49	180.0	2021
34	49	228.0	2022
34	49	256.0	2023
28	49	208.0	2018
28	49	231.0	2019
28	49	300.0	2020
28	49	371.0	2021
28	49	492.0	2022
28	49	567.0	2023
36	49	124.0	2018
36	49	143.0	2019
36	49	192.0	2020
36	49	225.0	2021
36	49	275.0	2022
36	49	306.0	2023
38	49	4.84	2018
38	49	4.35	2019
38	49	1.87	2020
38	49	1.19	2021
38	49	0.22	2022
38	49	0.0	2023
27	50	0.0	2018
27	50	0.0	2019
27	50	1.0	2020
27	50	1.0	2021
27	50	1.0	2022
27	50	1.0	2023
42	50	0.0	2018
42	50	0.0	2019
42	50	2.0	2020
42	50	3.0	2021
42	50	3.0	2022
42	50	7.0	2023
37	50	0.0	2018
37	50	0.0	2019
37	50	0.0	2020
37	50	0.0	2021
37	50	0.0	2022
37	50	0.0	2023
31	50	1.0	2018
31	50	2.0	2019
31	50	3.0	2020
31	50	6.0	2021
31	50	8.0	2022
31	50	10.0	2023
1691	50	1.0	2018
1691	50	7.0	2019
1691	50	10.0	2020
1691	50	15.0	2021
1691	50	19.0	2022
1691	50	24.0	2023
26	50	1.75996	2018
26	50	0.25142	2019
26	50	0.64228	2020
26	50	0.42745	2021
26	50	0.36683	2022
26	50	0.27712	2023
32	50	1.0	2018
32	50	1.0	2019
32	50	1.0	2020
32	50	1.0	2021
32	50	1.0	2022
32	50	0.0	2023
35	50	0.0	2018
35	50	71.42857142857143	2019
35	50	70.0	2020
35	50	70.58823529411765	2021
35	50	76.19047619047619	2022
35	50	84.61538461538461	2023
29	50	1.0	2018
29	50	7.0	2019
29	50	10.0	2020
29	50	17.0	2021
29	50	21.0	2022
29	50	26.0	2023
30	50	0.0	2018
30	50	0.0	2019
30	50	0.0	2020
30	50	0.0	2021
30	50	0.0	2022
30	50	0.0	2023
43	50	0.0	2018
43	50	0.0	2019
43	50	0.0	2020
43	50	0.0	2021
43	50	0.0	2022
43	50	0.0	2023
39	50	0.0	2018
39	50	0.0	2019
39	50	0.0	2020
39	50	0.0	2021
39	50	0.0	2022
39	50	0.0	2023
1690	50	0.0	2018
1690	50	0.0	2019
1690	50	0.0	2020
1690	50	0.0	2021
1690	50	0.0	2022
1690	50	1.0	2023
41	50	0.0	2018
41	50	1.0	2019
41	50	2.0	2020
41	50	4.0	2021
41	50	5.0	2022
41	50	5.0	2023
34	50	0.0	2018
34	50	1.0	2019
34	50	4.0	2020
34	50	7.0	2021
34	50	7.0	2022
34	50	8.0	2023
28	50	1.0	2018
28	50	7.0	2019
28	50	10.0	2020
28	50	17.0	2021
28	50	21.0	2022
28	50	26.0	2023
36	50	1.0	2018
36	50	5.0	2019
36	50	12.0	2020
36	50	17.0	2021
36	50	18.0	2022
36	50	23.0	2023
38	50	0.0	2018
38	50	0.0	2019
38	50	0.0	2020
38	50	0.0	2021
38	50	0.0	2022
38	50	0.0	2023
27	51	133.0	2018
27	51	133.0	2019
27	51	144.0	2020
27	51	162.0	2021
27	51	163.0	2022
27	51	188.0	2023
42	51	592.0	2018
42	51	658.0	2019
42	51	778.0	2020
42	51	903.0	2021
42	51	1008.0	2022
42	51	1095.0	2023
37	51	154.0	2018
37	51	133.0	2019
37	51	118.0	2020
37	51	98.0	2021
37	51	79.0	2022
37	51	52.0	2023
31	51	1905.0	2018
31	51	2131.0	2019
31	51	2540.0	2020
31	51	3052.0	2021
31	51	3483.0	2022
31	51	3946.0	2023
1691	51	3201.0	2018
1691	51	3541.0	2019
1691	51	4135.0	2020
1691	51	4853.0	2021
1691	51	5359.0	2022
1691	51	5819.0	2023
26	51	1.07194	2018
26	51	1.08922	2019
26	51	1.1295	2020
26	51	1.11996	2021
26	51	1.10293	2022
26	51	1.08571	2023
32	51	1897.0	2018
32	51	2057.0	2019
32	51	2325.0	2020
32	51	2700.0	2021
32	51	2918.0	2022
32	51	3181.0	2023
35	51	59.28270042194093	2018
35	51	60.49618320610687	2019
35	51	62.62814538676608	2020
35	51	64.34215725009878	2021
35	51	66.70203359858532	2022
35	51	67.51188589540412	2023
29	51	3298.0	2018
29	51	3650.0	2019
29	51	4274.0	2020
29	51	5047.0	2021
29	51	5640.0	2022
29	51	6293.0	2023
30	51	1.0	2018
30	51	1.0	2019
30	51	1.0	2020
30	51	1.0	2021
30	51	1.0	2022
30	51	1.0	2023
43	51	151.0	2018
43	51	153.0	2019
43	51	146.0	2020
43	51	153.0	2021
43	51	138.0	2022
43	51	96.0	2023
39	51	17.0	2018
39	51	14.0	2019
39	51	14.0	2020
39	51	16.0	2021
39	51	10.0	2022
39	51	7.0	2023
1690	51	613.0	2018
1690	51	689.0	2019
1690	51	826.0	2020
1690	51	1051.0	2021
1690	51	1170.0	2022
1690	51	1268.0	2023
41	51	188.0	2018
41	51	417.0	2019
41	51	730.0	2020
41	51	1162.0	2021
41	51	1548.0	2022
41	51	1799.0	2023
34	51	1443.0	2018
34	51	1552.0	2019
34	51	1723.0	2020
34	51	1975.0	2021
34	51	2124.0	2022
34	51	2333.0	2023
28	51	3318.0	2018
28	51	3668.0	2019
28	51	4292.0	2020
28	51	5062.0	2021
28	51	5655.0	2022
28	51	6310.0	2023
36	51	1697.0	2018
36	51	1853.0	2019
36	51	2091.0	2020
36	51	2390.0	2021
36	51	2635.0	2022
36	51	2913.0	2023
38	51	4.94	2018
38	51	3.87	2019
38	51	2.93	2020
38	51	2.06	2021
38	51	1.49	2022
38	51	0.88	2023
27	52	0.0	2018
27	52	0.0	2019
27	52	0.0	2020
27	52	1.0	2021
27	52	1.0	2022
27	52	1.0	2023
42	52	7.0	2018
42	52	9.0	2019
42	52	12.0	2020
42	52	19.0	2021
42	52	18.0	2022
42	52	18.0	2023
37	52	0.0	2018
37	52	0.0	2019
37	52	0.0	2020
37	52	0.0	2021
37	52	0.0	2022
37	52	0.0	2023
31	52	9.0	2018
31	52	11.0	2019
31	52	15.0	2020
31	52	28.0	2021
31	52	26.0	2022
31	52	25.0	2023
1691	52	16.0	2018
1691	52	25.0	2019
1691	52	38.0	2020
1691	52	51.0	2021
1691	52	52.0	2022
1691	52	50.0	2023
26	52	0.38934	2018
26	52	0.45223	2019
26	52	0.56129	2020
26	52	0.60177	2021
26	52	0.59804	2022
26	52	0.61312	2023
32	52	1.0	2018
32	52	4.0	2019
32	52	8.0	2020
32	52	14.0	2021
32	52	15.0	2022
32	52	15.0	2023
35	52	37.5	2018
35	52	46.15384615384615	2019
35	52	53.84615384615385	2020
35	52	60.0	2021
35	52	62.5	2022
35	52	64.81481481481481	2023
29	52	16.0	2018
29	52	26.0	2019
29	52	39.0	2020
29	52	55.0	2021
29	52	56.0	2022
29	52	54.0	2023
30	52	0.0	2018
30	52	0.0	2019
30	52	0.0	2020
30	52	0.0	2021
30	52	0.0	2022
30	52	0.0	2023
43	52	1.0	2018
43	52	1.0	2019
43	52	1.0	2020
43	52	0.0	2021
43	52	0.0	2022
43	52	0.0	2023
39	52	0.0	2018
39	52	0.0	2019
39	52	0.0	2020
39	52	0.0	2021
39	52	0.0	2022
39	52	0.0	2023
1690	52	2.0	2018
1690	52	9.0	2019
1690	52	14.0	2020
1690	52	18.0	2021
1690	52	18.0	2022
1690	52	18.0	2023
41	52	1.0	2018
41	52	3.0	2019
41	52	7.0	2020
41	52	14.0	2021
41	52	15.0	2022
41	52	15.0	2023
34	52	3.0	2018
34	52	6.0	2019
34	52	14.0	2020
34	52	19.0	2021
34	52	21.0	2022
34	52	20.0	2023
28	52	16.0	2018
28	52	26.0	2019
28	52	39.0	2020
28	52	55.0	2021
28	52	56.0	2022
28	52	54.0	2023
36	52	24.0	2018
36	52	34.0	2019
36	52	47.0	2020
36	52	59.0	2021
36	52	59.0	2022
36	52	54.0	2023
38	52	0.0	2018
38	52	0.0	2019
38	52	0.0	2020
38	52	0.0	2021
38	52	0.0	2022
38	52	0.0	2023
27	53	21.0	2018
27	53	28.0	2019
27	53	35.0	2020
27	53	42.0	2021
27	53	50.0	2022
27	53	58.0	2023
42	53	241.0	2018
42	53	309.0	2019
42	53	337.0	2020
42	53	376.0	2021
42	53	411.0	2022
42	53	473.0	2023
37	53	38.0	2018
37	53	38.0	2019
37	53	37.0	2020
37	53	30.0	2021
37	53	19.0	2022
37	53	14.0	2023
31	53	523.0	2018
31	53	636.0	2019
31	53	714.0	2020
31	53	713.0	2021
31	53	875.0	2022
31	53	1209.0	2023
1691	53	994.0	2018
1691	53	1213.0	2019
1691	53	1334.0	2020
1691	53	1441.0	2021
1691	53	1686.0	2022
1691	53	1987.0	2023
26	53	0.66992	2018
26	53	0.70294	2019
26	53	0.75469	2020
26	53	0.81614	2021
26	53	0.85074	2022
26	53	0.92825	2023
32	53	302.0	2018
32	53	396.0	2019
32	53	504.0	2020
32	53	590.0	2021
32	53	727.0	2022
32	53	978.0	2023
35	53	60.56201550387597	2018
35	53	62.77955271565495	2019
35	53	65.1128914785142	2020
35	53	68.32764505119454	2021
35	53	68.13186813186813	2022
35	53	65.14942528735632	2023
29	53	1032.0	2018
29	53	1252.0	2019
29	53	1373.0	2020
29	53	1465.0	2021
29	53	1729.0	2022
29	53	2175.0	2023
30	53	0.0	2018
30	53	0.0	2019
30	53	0.0	2020
30	53	0.0	2021
30	53	0.0	2022
30	53	0.0	2023
43	53	45.0	2018
43	53	48.0	2019
43	53	53.0	2020
43	53	51.0	2021
43	53	46.0	2022
43	53	38.0	2023
39	53	3.0	2018
39	53	5.0	2019
39	53	6.0	2020
39	53	11.0	2021
39	53	14.0	2022
39	53	14.0	2023
1690	53	182.0	2018
1690	53	240.0	2019
1690	53	288.0	2020
1690	53	341.0	2021
1690	53	404.0	2022
1690	53	492.0	2023
41	53	85.0	2018
41	53	192.0	2019
41	53	316.0	2020
41	53	461.0	2021
41	53	657.0	2022
41	53	816.0	2023
34	53	422.0	2018
34	53	492.0	2019
34	53	513.0	2020
34	53	550.0	2021
34	53	639.0	2022
34	53	752.0	2023
28	53	1032.0	2018
28	53	1252.0	2019
28	53	1373.0	2020
28	53	1465.0	2021
28	53	1729.0	2022
28	53	2175.0	2023
36	53	594.0	2018
36	53	747.0	2019
36	53	831.0	2020
36	53	913.0	2021
36	53	1015.0	2022
36	53	1196.0	2023
38	53	3.86	2018
38	53	3.2	2019
38	53	2.84	2020
38	53	2.17	2021
38	53	1.18	2022
38	53	0.71	2023
27	54	11.0	2018
27	54	12.0	2019
27	54	15.0	2020
27	54	18.0	2021
27	54	22.0	2022
27	54	29.0	2023
42	54	174.0	2018
42	54	204.0	2019
42	54	264.0	2020
42	54	317.0	2021
42	54	359.0	2022
42	54	407.0	2023
37	54	9.0	2018
37	54	9.0	2019
37	54	10.0	2020
37	54	10.0	2021
37	54	8.0	2022
37	54	7.0	2023
31	54	292.0	2018
31	54	353.0	2019
31	54	455.0	2020
31	54	605.0	2021
31	54	771.0	2022
31	54	879.0	2023
1691	54	574.0	2018
1691	54	689.0	2019
1691	54	841.0	2020
1691	54	1081.0	2021
1691	54	1307.0	2022
1691	54	1456.0	2023
26	54	0.81519	2018
26	54	0.72637	2019
26	54	0.70668	2020
26	54	0.75359	2021
26	54	0.80939	2022
26	54	0.81913	2023
32	54	161.0	2018
32	54	190.0	2019
32	54	232.0	2020
32	54	330.0	2021
32	54	419.0	2022
32	54	528.0	2023
35	54	68.28859060402685	2018
35	54	70.30812324929973	2019
35	54	70.55427251732101	2020
35	54	72.5135623869801	2021
35	54	74.75728155339804	2022
35	54	74.39896036387265	2023
29	54	596.0	2018
29	54	714.0	2019
29	54	866.0	2020
29	54	1106.0	2021
29	54	1339.0	2022
29	54	1539.0	2023
30	54	0.0	2018
30	54	0.0	2019
30	54	0.0	2020
30	54	0.0	2021
30	54	0.0	2022
30	54	0.0	2023
43	54	27.0	2018
43	54	29.0	2019
43	54	29.0	2020
43	54	39.0	2021
43	54	35.0	2022
43	54	30.0	2023
39	54	2.0	2018
39	54	1.0	2019
39	54	1.0	2020
39	54	1.0	2021
39	54	0.0	2022
39	54	0.0	2023
1690	54	129.0	2018
1690	54	149.0	2019
1690	54	176.0	2020
1690	54	256.0	2021
1690	54	315.0	2022
1690	54	361.0	2023
41	54	55.0	2018
41	54	118.0	2019
41	54	200.0	2020
41	54	343.0	2021
41	54	491.0	2022
41	54	554.0	2023
34	54	240.0	2018
34	54	271.0	2019
34	54	301.0	2020
34	54	367.0	2021
34	54	443.0	2022
34	54	533.0	2023
28	54	596.0	2018
28	54	714.0	2019
28	54	866.0	2020
28	54	1106.0	2021
28	54	1339.0	2022
28	54	1539.0	2023
36	54	477.0	2018
36	54	551.0	2019
36	54	639.0	2020
36	54	744.0	2021
36	54	843.0	2022
36	54	992.0	2023
38	54	1.64	2018
38	54	1.37	2019
38	54	1.26	2020
38	54	0.98	2021
38	54	0.64	2022
38	54	0.49	2023
27	55	156.0	2018
27	55	171.0	2019
27	55	170.0	2020
27	55	165.0	2021
27	55	165.0	2022
27	55	158.0	2023
42	55	229.0	2018
42	55	270.0	2019
42	55	296.0	2020
42	55	313.0	2021
42	55	311.0	2022
42	55	321.0	2023
37	55	133.0	2018
37	55	135.0	2019
37	55	115.0	2020
37	55	92.0	2021
37	55	74.0	2022
37	55	54.0	2023
31	55	2354.0	2018
31	55	2519.0	2019
31	55	2681.0	2020
31	55	2754.0	2021
31	55	2776.0	2022
31	55	2823.0	2023
1691	55	3051.0	2018
1691	55	3284.0	2019
1691	55	3520.0	2020
1691	55	3637.0	2021
1691	55	3630.0	2022
1691	55	3587.0	2023
26	55	1.48488	2018
26	55	1.45137	2019
26	55	1.3352	2020
26	55	1.26347	2021
26	55	1.21727	2022
26	55	1.13835	2023
32	55	1777.0	2018
32	55	1909.0	2019
32	55	2045.0	2020
32	55	2101.0	2021
32	55	2136.0	2022
32	55	2164.0	2023
35	55	55.600123418697926	2018
35	55	57.470605104674505	2019
35	55	58.52485301977552	2020
35	55	59.907359752959344	2021
35	55	60.94344407811311	2022
35	55	61.45884672252341	2023
29	55	3241.0	2018
29	55	3487.0	2019
29	55	3742.0	2020
29	55	3886.0	2021
29	55	3943.0	2022
29	55	4058.0	2023
30	55	0.0	2018
30	55	0.0	2019
30	55	0.0	2020
30	55	0.0	2021
30	55	0.0	2022
30	55	0.0	2023
43	55	37.0	2018
43	55	35.0	2019
43	55	43.0	2020
43	55	45.0	2021
43	55	40.0	2022
43	55	32.0	2023
39	55	61.0	2018
39	55	71.0	2019
39	55	88.0	2020
39	55	100.0	2021
39	55	90.0	2022
39	55	82.0	2023
1690	55	241.0	2018
1690	55	270.0	2019
1690	55	303.0	2020
1690	55	375.0	2021
1690	55	415.0	2022
1690	55	446.0	2023
41	55	114.0	2018
41	55	253.0	2019
41	55	440.0	2020
41	55	651.0	2021
41	55	834.0	2022
41	55	912.0	2023
34	55	1403.0	2018
34	55	1506.0	2019
34	55	1607.0	2020
34	55	1687.0	2021
34	55	1699.0	2022
34	55	1731.0	2023
28	55	3241.0	2018
28	55	3487.0	2019
28	55	3742.0	2020
28	55	3886.0	2021
28	55	3943.0	2022
28	55	4058.0	2023
36	55	1269.0	2018
36	55	1393.0	2019
36	55	1504.0	2020
36	55	1551.0	2021
36	55	1564.0	2022
36	55	1638.0	2023
38	55	4.25	2018
38	55	4.0	2019
38	55	3.16	2020
38	55	2.44	2021
38	55	1.93	2022
38	55	1.39	2023
27	56	1.0	2018
27	56	3.0	2019
27	56	4.0	2020
27	56	4.0	2021
27	56	4.0	2022
27	56	3.0	2023
42	56	19.0	2018
42	56	41.0	2019
42	56	49.0	2020
42	56	56.0	2021
42	56	53.0	2022
42	56	47.0	2023
37	56	0.0	2018
37	56	3.0	2019
37	56	3.0	2020
37	56	3.0	2021
37	56	3.0	2022
37	56	3.0	2023
31	56	46.0	2018
31	56	76.0	2019
31	56	93.0	2020
31	56	100.0	2021
31	56	96.0	2022
31	56	66.0	2023
1691	56	104.0	2018
1691	56	181.0	2019
1691	56	225.0	2020
1691	56	235.0	2021
1691	56	220.0	2022
1691	56	163.0	2023
26	56	0.6352	2018
26	56	0.69921	2019
26	56	0.66613	2020
26	56	0.65567	2021
26	56	0.6453	2022
26	56	0.6177	2023
32	56	20.0	2018
32	56	43.0	2019
32	56	49.0	2020
32	56	57.0	2021
32	56	54.0	2022
32	56	45.0	2023
35	56	54.71698113207548	2018
35	56	58.69565217391304	2019
35	56	57.89473684210527	2020
35	56	59.16666666666666	2021
35	56	60.0	2022
35	56	61.30952380952381	2023
29	56	106.0	2018
29	56	184.0	2019
29	56	228.0	2020
29	56	240.0	2021
29	56	225.0	2022
29	56	168.0	2023
30	56	0.0	2018
30	56	0.0	2019
30	56	0.0	2020
30	56	0.0	2021
30	56	0.0	2022
30	56	0.0	2023
43	56	4.0	2018
43	56	5.0	2019
43	56	5.0	2020
43	56	5.0	2021
43	56	3.0	2022
43	56	1.0	2023
39	56	0.0	2018
39	56	0.0	2019
39	56	0.0	2020
39	56	0.0	2021
39	56	0.0	2022
39	56	0.0	2023
1690	56	17.0	2018
1690	56	25.0	2019
1690	56	33.0	2020
1690	56	37.0	2021
1690	56	34.0	2022
1690	56	25.0	2023
41	56	17.0	2018
41	56	41.0	2019
41	56	57.0	2020
41	56	62.0	2021
41	56	63.0	2022
41	56	47.0	2023
34	56	37.0	2018
34	56	65.0	2019
34	56	80.0	2020
34	56	84.0	2021
34	56	83.0	2022
34	56	64.0	2023
28	56	106.0	2018
28	56	184.0	2019
28	56	228.0	2020
28	56	240.0	2021
28	56	225.0	2022
28	56	168.0	2023
36	56	70.0	2018
36	56	122.0	2019
36	56	151.0	2020
36	56	162.0	2021
36	56	158.0	2022
36	56	133.0	2023
38	56	0.0	2018
38	56	1.81	2019
38	56	1.45	2020
38	56	1.39	2021
38	56	1.46	2022
38	56	1.89	2023
27	57	6.0	2018
27	57	12.0	2019
27	57	16.0	2020
27	57	18.0	2021
27	57	19.0	2022
27	57	26.0	2023
42	57	50.0	2018
42	57	67.0	2019
42	57	80.0	2020
42	57	103.0	2021
42	57	108.0	2022
42	57	127.0	2023
37	57	19.0	2018
37	57	23.0	2019
37	57	27.0	2020
37	57	26.0	2021
37	57	21.0	2022
37	57	14.0	2023
31	57	118.0	2018
31	57	190.0	2019
31	57	263.0	2020
31	57	370.0	2021
31	57	424.0	2022
31	57	493.0	2023
1691	57	239.0	2018
1691	57	370.0	2019
1691	57	520.0	2020
1691	57	695.0	2021
1691	57	783.0	2022
1691	57	864.0	2023
26	57	0.65629	2018
26	57	0.73527	2019
26	57	0.75918	2020
26	57	0.78935	2021
26	57	0.77885	2022
26	57	0.75591	2023
32	57	113.0	2018
32	57	164.0	2019
32	57	221.0	2020
32	57	315.0	2021
32	57	362.0	2022
32	57	420.0	2023
35	57	46.15384615384615	2018
35	57	45.12820512820513	2019
35	57	48.23747680890538	2020
35	57	47.81420765027322	2021
35	57	48.49939975990396	2022
35	57	49.37106918238994	2023
29	57	247.0	2018
29	57	390.0	2019
29	57	539.0	2020
29	57	732.0	2021
29	57	833.0	2022
29	57	954.0	2023
30	57	0.0	2018
30	57	0.0	2019
30	57	0.0	2020
30	57	0.0	2021
30	57	0.0	2022
30	57	0.0	2023
43	57	5.0	2018
43	57	5.0	2019
43	57	7.0	2020
43	57	8.0	2021
43	57	7.0	2022
43	57	4.0	2023
39	57	1.0	2018
39	57	3.0	2019
39	57	4.0	2020
39	57	4.0	2021
39	57	6.0	2022
39	57	6.0	2023
1690	57	32.0	2018
1690	57	50.0	2019
1690	57	82.0	2020
1690	57	121.0	2021
1690	57	133.0	2022
1690	57	163.0	2023
41	57	23.0	2018
41	57	59.0	2019
41	57	109.0	2020
41	57	190.0	2021
41	57	244.0	2022
41	57	315.0	2023
34	57	107.0	2018
34	57	163.0	2019
34	57	217.0	2020
34	57	285.0	2021
34	57	317.0	2022
34	57	364.0	2023
28	57	247.0	2018
28	57	390.0	2019
28	57	539.0	2020
28	57	732.0	2021
28	57	833.0	2022
28	57	954.0	2023
36	57	160.0	2018
36	57	203.0	2019
36	57	238.0	2020
36	57	300.0	2021
36	57	325.0	2022
36	57	392.0	2023
38	57	8.37	2018
38	57	6.42	2019
38	57	5.34	2020
38	57	3.76	2021
38	57	2.67	2022
38	57	1.56	2023
1695	1	74.1	2024
1696	1	58.8	2024
1693	1	96.5	2024
1694	1	88.1	2024
1692	1	72.1	2024
1695	2	42.9	2024
1696	2	52.0	2024
1693	2	63.5	2024
1694	2	62.4	2024
1692	2	39.7	2024
1695	4	21.7	2024
1696	4	63.7	2024
1693	4	52.3	2024
1694	4	70.8	2024
1692	4	31.6	2024
1695	6	15.7	2024
1696	6	36.6	2024
1693	6	50.6	2024
1694	6	40.4	2024
1692	6	29.9	2024
1695	7	18.0	2024
1696	7	48.4	2024
1693	7	20.6	2024
1694	7	20.9	2024
1692	7	21.0	2024
1695	8	32.5	2024
1696	8	53.7	2024
1693	8	53.2	2024
1694	8	56.2	2024
1692	8	33.5	2024
1695	9	19.1	2024
1696	9	56.1	2024
1693	9	58.3	2024
1694	9	57.0	2024
1692	9	34.5	2024
1695	10	22.3	2024
1696	10	53.2	2024
1693	10	19.2	2024
1694	10	27.5	2024
1692	10	19.9	2024
1695	13	17.1	2024
1696	13	49.0	2024
1693	13	55.7	2024
1694	13	49.5	2024
1692	13	34.0	2024
1695	14	19.5	2024
1696	14	43.4	2024
1693	14	21.7	2024
1694	14	27.0	2024
1692	14	27.0	2024
1695	15	16.4	2024
1696	15	55.0	2024
1693	15	43.1	2024
1694	15	47.7	2024
1692	15	22.8	2024
1695	16	25.1	2024
1696	16	60.2	2024
1693	16	42.7	2024
1694	16	55.1	2024
1692	16	21.9	2024
1695	18	17.4	2024
1696	18	54.2	2024
1693	18	19.9	2024
1694	18	42.8	2024
1692	18	25.9	2024
1695	22	55.5	2024
1696	22	49.7	2024
1693	22	88.9	2024
1694	22	79.6	2024
1692	22	72.4	2024
1695	24	47.9	2024
1696	24	51.6	2024
1693	24	69.7	2024
1694	24	57.1	2024
1692	24	47.8	2024
1695	25	23.4	2024
1696	25	49.2	2024
1693	25	47.8	2024
1694	25	49.8	2024
1692	25	34.7	2024
1695	26	16.6	2024
1696	26	50.7	2024
1693	26	19.9	2024
1694	26	43.8	2024
1692	26	19.5	2024
1695	28	20.9	2024
1696	28	48.1	2024
1693	28	70.2	2024
1694	28	51.3	2024
1692	28	55.5	2024
1695	29	16.8	2024
1696	29	50.3	2024
1693	29	37.4	2024
1694	29	49.0	2024
1692	29	21.4	2024
1695	30	26.7	2024
1696	30	53.0	2024
1693	30	17.8	2024
1694	30	43.8	2024
1692	30	20.2	2024
1695	32	27.9	2024
1696	32	46.3	2024
1693	32	78.8	2024
1694	32	55.8	2024
1692	32	45.9	2024
1695	33	34.2	2024
1696	33	52.6	2024
1693	33	40.9	2024
1694	33	59.1	2024
1692	33	26.9	2024
1695	34	19.8	2024
1696	34	56.9	2024
1693	34	47.0	2024
1694	34	66.0	2024
1692	34	22.7	2024
1695	35	18.9	2024
1696	35	46.3	2024
1693	35	46.2	2024
1694	35	42.3	2024
1692	35	29.0	2024
1695	37	23.8	2024
1696	37	46.5	2024
1693	37	34.8	2024
1694	37	30.9	2024
1692	37	32.1	2024
1695	38	22.0	2024
1696	38	51.9	2024
1693	38	37.5	2024
1694	38	55.7	2024
1692	38	27.7	2024
1695	41	18.4	2024
1696	41	54.6	2024
1693	41	34.3	2024
1694	41	58.3	2024
1692	41	29.3	2024
1695	42	15.8	2024
1696	42	46.7	2024
1693	42	12.4	2024
1694	42	29.5	2024
1692	42	22.5	2024
1695	48	16.4	2024
1696	48	49.1	2024
1693	48	14.0	2024
1694	48	39.3	2024
1692	48	21.1	2024
1695	51	24.6	2024
1696	51	51.8	2024
1693	51	36.8	2024
1694	51	56.9	2024
1692	51	37.5	2024
1695	54	16.0	2024
1696	54	45.3	2024
1693	54	18.4	2024
1694	54	21.6	2024
1692	54	17.4	2024
1695	55	37.9	2024
1696	55	56.4	2024
1693	55	51.2	2024
1694	55	60.5	2024
1692	55	28.4	2024
1695	1	80.2	2026
1696	1	58.1	2026
1693	1	43.6	2026
1694	1	72.6	2026
1692	1	38.0	2026
1695	2	33.8	2026
1696	2	51.3	2026
1693	2	21.7	2026
1694	2	48.1	2026
1692	2	21.4	2026
1695	4	22.7	2026
1696	4	62.5	2026
1693	4	22.0	2026
1694	4	55.1	2026
1692	4	19.5	2026
1695	6	16.0	2026
1696	6	37.7	2026
1693	6	21.8	2026
1694	6	38.4	2026
1692	6	17.0	2026
1695	7	23.6	2026
1696	7	47.0	2026
1693	7	13.9	2026
1694	7	16.9	2026
1692	7	16.1	2026
1695	8	41.8	2026
1696	8	52.4	2026
1693	8	19.9	2026
1694	8	39.6	2026
1692	8	19.0	2026
1695	9	20.7	2026
1696	9	55.5	2026
1693	9	15.3	2026
1694	9	36.5	2026
1692	9	16.7	2026
1695	10	22.6	2026
1696	10	48.6	2026
1693	10	12.2	2026
1694	10	14.6	2026
1692	10	16.8	2026
1695	13	17.6	2026
1696	13	50.3	2026
1693	13	23.5	2026
1694	13	34.2	2026
1692	13	13.4	2026
1695	14	18.8	2026
1696	14	45.1	2026
1693	14	13.0	2026
1694	14	20.9	2026
1692	14	22.7	2026
1695	15	17.8	2026
1696	15	54.6	2026
1693	15	20.3	2026
1694	15	36.2	2026
1692	15	18.5	2026
1695	16	19.9	2026
1696	16	61.0	2026
1693	16	18.2	2026
1694	16	41.0	2026
1692	16	17.6	2026
1695	18	18.1	2026
1696	18	55.0	2026
1693	18	11.1	2026
1694	18	23.3	2026
1692	18	23.9	2026
1695	22	56.5	2026
1696	22	49.3	2026
1693	22	25.0	2026
1694	22	61.6	2026
1692	22	33.6	2026
1695	24	47.7	2026
1696	24	50.8	2026
1693	24	19.7	2026
1694	24	40.9	2026
1692	24	22.2	2026
1695	25	24.1	2026
1696	25	50.2	2026
1693	25	24.9	2026
1694	25	34.0	2026
1692	25	22.6	2026
1695	26	17.3	2026
1696	26	50.3	2026
1693	26	11.9	2026
1694	26	41.4	2026
1692	26	18.3	2026
1695	28	22.4	2026
1696	28	48.1	2026
1693	28	19.7	2026
1694	28	36.4	2026
1692	28	29.6	2026
1695	29	16.6	2026
1696	29	48.5	2026
1693	29	18.3	2026
1694	29	28.5	2026
1692	29	19.0	2026
1695	32	30.1	2026
1696	32	47.5	2026
1693	32	19.2	2026
1694	32	42.3	2026
1692	32	20.9	2026
1695	33	37.6	2026
1696	33	52.0	2026
1693	33	16.5	2026
1694	33	38.4	2026
1692	33	22.2	2026
1695	34	21.7	2026
1696	34	58.7	2026
1693	34	31.4	2026
1694	34	62.2	2026
1692	34	16.4	2026
1695	35	20.6	2026
1696	35	46.7	2026
1693	35	15.9	2026
1694	35	29.4	2026
1692	35	20.3	2026
1695	37	18.7	2026
1696	37	46.8	2026
1693	37	7.0	2026
1694	37	23.7	2026
1692	37	19.1	2026
1695	38	28.0	2026
1696	38	51.0	2026
1693	38	14.4	2026
1694	38	39.0	2026
1692	38	19.9	2026
1695	41	19.2	2026
1696	41	54.1	2026
1693	41	14.5	2026
1694	41	46.3	2026
1692	41	18.7	2026
1695	42	16.2	2026
1696	42	47.9	2026
1693	42	10.6	2026
1694	42	18.2	2026
1692	42	22.7	2026
1695	48	17.6	2026
1696	48	48.2	2026
1693	48	10.0	2026
1694	48	23.5	2026
1692	48	20.9	2026
1695	51	22.4	2026
1696	51	52.5	2026
1693	51	12.5	2026
1694	51	43.9	2026
1692	51	18.6	2026
1695	54	16.6	2026
1696	54	45.6	2026
1693	54	12.1	2026
1694	54	19.0	2026
1692	54	16.2	2026
1695	55	40.7	2026
1696	55	53.8	2026
1693	55	15.0	2026
1694	55	45.2	2026
1692	55	19.4	2026
1695	1	99.4	2023
1696	1	84.2	2023
1693	1	99.8	2023
1694	1	95.5	2023
1692	1	79.0	2023
1695	2	82.3	2023
1696	2	69.9	2023
1693	2	69.3	2023
1694	2	56.8	2023
1692	2	46.5	2023
1695	4	40.5	2023
1696	4	90.0	2023
1693	4	56.1	2023
1694	4	69.3	2023
1692	4	34.9	2023
1695	7	37.4	2023
1696	7	70.3	2023
1693	7	19.4	2023
1694	7	39.2	2023
1692	7	14.1	2023
1695	8	73.6	2023
1696	8	67.9	2023
1693	8	63.3	2023
1694	8	62.6	2023
1692	8	48.8	2023
1695	9	36.1	2023
1696	9	71.2	2023
1693	9	50.9	2023
1694	9	97.9	2023
1692	9	30.6	2023
1695	10	52.4	2023
1696	10	84.2	2023
1693	10	20.7	2023
1694	10	35.2	2023
1692	10	20.6	2023
1695	13	38.8	2023
1696	13	59.5	2023
1693	13	45.5	2023
1694	13	58.8	2023
1692	13	25.4	2023
1695	14	41.6	2023
1696	14	59.3	2023
1693	14	21.7	2023
1694	14	26.9	2023
1692	14	26.5	2023
1695	15	36.1	2023
1696	15	81.6	2023
1693	15	36.3	2023
1694	15	36.7	2023
1692	15	26.0	2023
1695	16	42.5	2023
1696	16	84.0	2023
1693	16	52.8	2023
1694	16	63.1	2023
1692	16	26.5	2023
1695	18	36.1	2023
1696	18	71.1	2023
1693	18	20.5	2023
1694	18	98.6	2023
1692	18	27.2	2023
1695	22	57.2	2023
1696	22	79.1	2023
1693	22	90.4	2023
1694	22	79.3	2023
1692	22	76.8	2023
1695	24	87.2	2023
1696	24	71.6	2023
1693	24	76.3	2023
1694	24	79.3	2023
1692	24	48.4	2023
1695	25	36.4	2023
1696	25	66.0	2023
1693	25	48.2	2023
1694	25	76.5	2023
1692	25	39.1	2023
1695	26	36.1	2023
1696	26	61.9	2023
1693	26	26.0	2023
1694	26	95.3	2023
1692	26	22.1	2023
1695	28	38.8	2023
1696	28	71.4	2023
1693	28	62.1	2023
1694	28	68.4	2023
1692	28	50.8	2023
1695	29	36.1	2023
1696	29	61.3	2023
1693	29	36.8	2023
1694	29	55.4	2023
1692	29	32.7	2023
1695	30	46.8	2023
1696	30	78.2	2023
1693	30	25.9	2023
1694	30	87.3	2023
1692	30	36.1	2023
1695	32	36.9	2023
1696	32	61.9	2023
1693	32	81.2	2023
1694	32	54.1	2023
1692	32	47.8	2023
1695	33	36.1	2023
1696	33	69.0	2023
1693	33	41.4	2023
1694	33	66.1	2023
1692	33	31.9	2023
1695	34	45.3	2023
1696	34	86.9	2023
1693	34	49.2	2023
1694	34	87.1	2023
1692	34	34.5	2023
1695	35	36.2	2023
1696	35	64.0	2023
1693	35	48.8	2023
1694	35	51.6	2023
1692	35	32.8	2023
1695	37	44.5	2023
1696	37	61.7	2023
1693	37	44.3	2023
1694	37	27.6	2023
1692	37	27.3	2023
1695	38	47.3	2023
1696	38	73.1	2023
1693	38	38.1	2023
1694	38	97.9	2023
1692	38	28.7	2023
1695	41	36.1	2023
1696	41	75.1	2023
1693	41	41.0	2023
1694	41	95.5	2023
1692	41	34.0	2023
1695	42	36.2	2023
1696	42	60.7	2023
1693	42	11.8	2023
1694	42	93.5	2023
1692	42	20.1	2023
1695	48	36.8	2023
1696	48	59.4	2023
1693	48	16.3	2023
1694	48	80.3	2023
1692	48	22.3	2023
1695	51	44.6	2023
1696	51	65.7	2023
1693	51	38.1	2023
1694	51	73.6	2023
1692	51	37.7	2023
1695	53	36.1	2023
1696	53	49.6	2023
1693	53	19.7	2023
1694	53	35.2	2023
1692	53	21.5	2023
1695	54	36.1	2023
1696	54	51.9	2023
1693	54	13.6	2023
1694	54	43.2	2023
1692	54	13.6	2023
1695	55	48.1	2023
1696	55	81.3	2023
1693	55	56.2	2023
1694	55	66.9	2023
1692	55	30.4	2023
1695	1	100.0	2022
1696	1	87.2	2022
1693	1	99.9	2022
1694	1	97.5	2022
1692	1	77.9	2022
1695	2	86.0	2022
1696	2	71.8	2022
1693	2	67.0	2022
1694	2	63.5	2022
1692	2	52.8	2022
1695	4	41.2	2022
1696	4	89.3	2022
1693	4	59.1	2022
1694	4	59.2	2022
1692	4	33.4	2022
1695	7	37.7	2022
1696	7	69.1	2022
1693	7	19.6	2022
1694	7	25.5	2022
1692	7	17.0	2022
1695	8	74.9	2022
1696	8	73.1	2022
1693	8	70.9	2022
1694	8	68.1	2022
1692	8	54.6	2022
1695	9	34.9	2022
1696	9	59.8	2022
1693	9	51.0	2022
1694	9	98.6	2022
1692	9	27.2	2022
1695	10	42.4	2022
1696	10	75.5	2022
1693	10	18.9	2022
1694	10	25.5	2022
1692	10	18.9	2022
1695	13	38.9	2022
1696	13	58.8	2022
1693	13	47.4	2022
1694	13	64.5	2022
1692	13	22.5	2022
1695	14	42.4	2022
1696	14	59.2	2022
1693	14	30.4	2022
1694	14	30.6	2022
1692	14	27.7	2022
1695	16	41.7	2022
1696	16	84.9	2022
1693	16	57.4	2022
1694	16	72.5	2022
1692	16	26.3	2022
1695	18	34.9	2022
1696	18	74.7	2022
1693	18	25.6	2022
1694	18	99.5	2022
1692	18	24.7	2022
1695	22	61.7	2022
1696	22	79.4	2022
1693	22	93.2	2022
1694	22	82.8	2022
1692	22	77.7	2022
1695	24	92.3	2022
1696	24	73.3	2022
1693	24	72.7	2022
1694	24	75.9	2022
1692	24	50.6	2022
1695	25	35.8	2022
1696	25	67.5	2022
1693	25	49.0	2022
1694	25	74.3	2022
1692	25	37.8	2022
1695	26	34.9	2022
1696	26	61.6	2022
1693	26	17.5	2022
1694	26	97.4	2022
1692	26	16.6	2022
1695	28	52.9	2022
1696	28	73.8	2022
1693	28	48.7	2022
1694	28	73.0	2022
1692	28	46.8	2022
1695	29	34.9	2022
1696	29	62.6	2022
1693	29	38.1	2022
1694	29	67.9	2022
1692	29	34.7	2022
1695	32	38.4	2022
1696	32	66.1	2022
1693	32	82.4	2022
1694	32	50.0	2022
1692	32	53.2	2022
1695	33	42.4	2022
1696	33	74.7	2022
1693	33	42.6	2022
1694	33	70.6	2022
1692	33	38.0	2022
1695	34	36.0	2022
1696	34	76.7	2022
1693	34	46.2	2022
1694	34	67.0	2022
1692	34	27.3	2022
1695	35	35.0	2022
1696	35	67.0	2022
1693	35	54.3	2022
1694	35	59.4	2022
1692	35	31.9	2022
1695	37	35.2	2022
1696	37	62.3	2022
1693	37	23.2	2022
1694	37	31.5	2022
1692	37	23.6	2022
1695	38	49.9	2022
1696	38	72.9	2022
1693	38	39.3	2022
1694	38	98.7	2022
1692	38	29.2	2022
1695	41	34.9	2022
1696	41	77.0	2022
1693	41	44.0	2022
1694	41	98.2	2022
1692	41	34.2	2022
1695	42	35.0	2022
1696	42	59.6	2022
1693	42	11.0	2022
1694	42	49.5	2022
1692	42	22.9	2022
1695	48	34.9	2022
1696	48	60.3	2022
1693	48	14.3	2022
1694	48	78.3	2022
1692	48	23.1	2022
1695	51	39.4	2022
1696	51	74.4	2022
1693	51	33.2	2022
1694	51	76.3	2022
1692	51	33.1	2022
1695	53	34.9	2022
1696	53	46.7	2022
1693	53	25.0	2022
1694	53	34.1	2022
1692	53	29.8	2022
1695	54	34.9	2022
1696	54	52.2	2022
1693	54	12.7	2022
1694	54	26.6	2022
1692	54	15.4	2022
1695	55	48.8	2022
1696	55	82.1	2022
1693	55	64.0	2022
1694	55	72.2	2022
1692	55	37.1	2022
1695	1	99.4	2021
1696	1	93.1	2021
1693	1	99.8	2021
1694	1	95.3	2021
1692	1	77.4	2021
1695	2	63.6	2021
1696	2	69.0	2021
1693	2	85.9	2021
1694	2	55.1	2021
1692	2	52.3	2021
1695	4	42.3	2021
1696	4	89.3	2021
1693	4	44.0	2021
1694	4	63.7	2021
1692	4	31.6	2021
1695	7	37.4	2021
1696	7	68.7	2021
1693	7	15.3	2021
1694	7	19.0	2021
1692	7	14.9	2021
1695	8	68.6	2021
1696	8	75.6	2021
1693	8	66.1	2021
1694	8	62.1	2021
1692	8	46.0	2021
1695	9	36.9	2021
1696	9	67.2	2021
1693	9	51.0	2021
1694	9	100.0	2021
1692	9	25.4	2021
1695	10	38.9	2021
1696	10	57.7	2021
1693	10	19.6	2021
1694	10	25.8	2021
1692	10	17.3	2021
1695	13	37.6	2021
1696	13	59.1	2021
1693	13	50.1	2021
1694	13	64.1	2021
1692	13	19.2	2021
1695	14	42.7	2021
1696	14	59.7	2021
1693	14	42.0	2021
1694	14	23.3	2021
1692	14	20.1	2021
1695	16	37.4	2021
1696	16	81.7	2021
1693	16	37.9	2021
1694	16	63.0	2021
1692	16	17.1	2021
1695	22	53.3	2021
1696	22	79.3	2021
1693	22	91.8	2021
1694	22	76.7	2021
1692	22	78.5	2021
1695	24	88.8	2021
1696	24	72.6	2021
1693	24	51.1	2021
1694	24	64.4	2021
1692	24	37.9	2021
1695	25	37.0	2021
1696	25	66.6	2021
1693	25	58.3	2021
1694	25	69.7	2021
1692	25	31.3	2021
1695	26	36.9	2021
1696	26	57.1	2021
1693	26	19.0	2021
1694	26	94.4	2021
1692	26	20.7	2021
1695	28	41.2	2021
1696	28	73.7	2021
1693	28	50.8	2021
1694	28	72.7	2021
1692	28	43.5	2021
1695	29	36.9	2021
1696	29	55.9	2021
1693	29	28.8	2021
1694	29	63.6	2021
1692	29	30.6	2021
1695	32	44.0	2021
1696	32	69.3	2021
1693	32	82.1	2021
1694	32	39.8	2021
1692	32	56.9	2021
1695	33	40.4	2021
1696	33	75.2	2021
1693	33	47.8	2021
1694	33	64.8	2021
1692	33	28.7	2021
1695	34	37.3	2021
1696	34	74.1	2021
1693	34	35.4	2021
1694	34	52.0	2021
1692	34	22.6	2021
1695	35	37.5	2021
1696	35	71.7	2021
1693	35	52.8	2021
1694	35	53.4	2021
1692	35	35.9	2021
1695	37	36.9	2021
1696	37	64.6	2021
1693	37	23.4	2021
1694	37	33.5	2021
1692	37	24.3	2021
1695	38	46.4	2021
1696	38	75.1	2021
1693	38	25.8	2021
1694	38	99.6	2021
1692	38	30.5	2021
1695	41	36.9	2021
1696	41	74.3	2021
1693	41	41.1	2021
1694	41	99.4	2021
1692	41	30.7	2021
1695	42	37.0	2021
1696	42	55.7	2021
1693	42	10.9	2021
1694	42	25.5	2021
1692	42	22.0	2021
1695	48	37.1	2021
1696	48	60.4	2021
1693	48	11.6	2021
1694	48	73.3	2021
1692	48	22.1	2021
1695	51	37.6	2021
1696	51	66.2	2021
1693	51	18.3	2021
1694	51	70.7	2021
1692	51	25.0	2021
1695	53	36.9	2021
1696	53	47.4	2021
1693	53	21.2	2021
1694	53	30.1	2021
1692	53	24.1	2021
1695	55	56.1	2021
1696	55	89.2	2021
1693	55	59.9	2021
1694	55	68.5	2021
1692	55	33.7	2021
1695	1	100.0	2020
1696	1	91.6	2020
1693	1	99.9	2020
1694	1	90.1	2020
1692	1	78.6	2020
1695	2	78.6	2020
1696	2	65.7	2020
1693	2	81.9	2020
1694	2	48.6	2020
1692	2	62.5	2020
1695	4	42.3	2020
1696	4	87.5	2020
1693	4	41.1	2020
1694	4	65.7	2020
1692	4	35.9	2020
1695	7	36.4	2020
1696	7	60.7	2020
1693	7	10.1	2020
1694	7	23.5	2020
1692	7	14.4	2020
1695	8	73.9	2020
1696	8	74.2	2020
1693	8	57.5	2020
1694	8	57.4	2020
1692	8	45.7	2020
1695	9	35.5	2020
1696	9	64.0	2020
1693	9	41.1	2020
1694	9	99.0	2020
1692	9	22.4	2020
1695	10	36.6	2020
1696	10	52.4	2020
1693	10	16.3	2020
1694	10	26.3	2020
1692	10	14.2	2020
1695	13	36.4	2020
1696	13	52.5	2020
1693	13	35.3	2020
1694	13	66.5	2020
1692	13	18.6	2020
1695	14	42.4	2020
1696	14	57.1	2020
1693	14	20.4	2020
1694	14	24.3	2020
1692	14	18.7	2020
1695	16	38.6	2020
1696	16	79.6	2020
1693	16	42.6	2020
1694	16	60.7	2020
1692	16	16.5	2020
1695	18	35.5	2020
1696	18	65.2	2020
1693	18	19.1	2020
1694	18	95.1	2020
1692	18	22.5	2020
1695	22	52.1	2020
1696	22	79.8	2020
1693	22	91.4	2020
1694	22	73.8	2020
1692	22	80.1	2020
1695	24	93.1	2020
1696	24	68.8	2020
1693	24	58.6	2020
1694	24	59.3	2020
1692	24	43.6	2020
1695	25	37.4	2020
1696	25	58.2	2020
1693	25	67.2	2020
1694	25	70.9	2020
1692	25	35.9	2020
1695	26	35.5	2020
1696	26	52.2	2020
1693	26	18.0	2020
1694	26	91.3	2020
1692	26	12.8	2020
1695	28	45.0	2020
1696	28	69.4	2020
1693	28	60.0	2020
1694	28	57.2	2020
1692	28	50.4	2020
1695	29	35.5	2020
1696	29	53.5	2020
1693	29	28.4	2020
1694	29	58.5	2020
1692	29	24.4	2020
1695	31	35.5	2020
1696	31	40.0	2020
1693	31	23.6	2020
1694	31	20.7	2020
1692	31	21.8	2020
1695	32	43.9	2020
1696	32	69.7	2020
1693	32	85.6	2020
1694	32	38.8	2020
1692	32	60.9	2020
1695	33	50.4	2020
1696	33	70.7	2020
1693	33	34.3	2020
1694	33	64.1	2020
1692	33	23.9	2020
1695	34	41.8	2020
1696	34	72.3	2020
1693	34	40.3	2020
1694	34	43.8	2020
1692	34	21.2	2020
1695	35	36.0	2020
1696	35	69.5	2020
1693	35	52.9	2020
1694	35	50.1	2020
1692	35	49.4	2020
1695	37	48.1	2020
1696	37	60.0	2020
1693	37	37.6	2020
1694	37	22.8	2020
1692	37	27.6	2020
1695	38	43.7	2020
1696	38	69.5	2020
1693	38	24.7	2020
1694	38	100.0	2020
1692	38	24.6	2020
1695	41	35.5	2020
1696	41	70.9	2020
1693	41	45.5	2020
1694	41	100.0	2020
1692	41	19.9	2020
1695	42	35.6	2020
1696	42	49.9	2020
1693	42	11.0	2020
1694	42	26.8	2020
1692	42	21.6	2020
1695	48	35.5	2020
1696	48	59.5	2020
1693	48	10.3	2020
1694	48	53.5	2020
1692	48	21.9	2020
1695	51	35.8	2020
1696	51	63.3	2020
1693	51	32.4	2020
1694	51	68.7	2020
1692	51	21.4	2020
1695	53	35.5	2020
1696	53	46.5	2020
1693	53	25.0	2020
1694	53	25.6	2020
1692	53	24.4	2020
1695	55	68.7	2020
1696	55	89.2	2020
1693	55	44.2	2020
1694	55	74.3	2020
1692	55	23.3	2020
1695	1	98.9	2019
1696	1	92.3	2019
1693	1	99.8	2019
1694	1	89.7	2019
1692	1	76.0	2019
1695	2	84.8	2019
1696	2	66.4	2019
1693	2	81.1	2019
1694	2	50.3	2019
1692	2	63.5	2019
1695	4	38.9	2019
1696	4	88.8	2019
1693	4	44.1	2019
1694	4	82.9	2019
1692	4	36.7	2019
1695	7	36.9	2019
1696	7	63.1	2019
1693	7	10.8	2019
1694	7	23.7	2019
1692	7	14.3	2019
1695	8	77.5	2019
1696	8	73.9	2019
1693	8	35.9	2019
1694	8	68.9	2019
1692	8	43.3	2019
1695	9	36.5	2019
1696	9	66.0	2019
1693	9	31.4	2019
1694	9	98.5	2019
1692	9	23.1	2019
1695	10	36.8	2019
1696	10	52.9	2019
1693	10	13.7	2019
1694	10	13.5	2019
1692	10	14.0	2019
1695	13	36.6	2019
1696	13	50.4	2019
1693	13	32.4	2019
1694	13	40.0	2019
1692	13	18.4	2019
1695	14	42.5	2019
1696	14	53.9	2019
1693	14	29.9	2019
1694	14	17.4	2019
1692	14	19.6	2019
1695	16	40.8	2019
1696	16	78.0	2019
1693	16	58.1	2019
1694	16	55.7	2019
1692	16	22.2	2019
1695	18	36.5	2019
1696	18	57.8	2019
1693	18	26.4	2019
1694	18	78.4	2019
1692	18	25.0	2019
1695	21	36.5	2019
1696	21	62.5	2019
1693	21	10.7	2019
1694	21	27.8	2019
1692	21	13.4	2019
1695	22	36.9	2019
1696	22	80.6	2019
1693	22	92.1	2019
1694	22	82.4	2019
1692	22	78.4	2019
1695	24	94.4	2019
1696	24	67.9	2019
1693	24	58.7	2019
1694	24	60.5	2019
1692	24	44.4	2019
1695	25	36.7	2019
1696	25	62.9	2019
1693	25	60.4	2019
1694	25	81.6	2019
1692	25	44.4	2019
1695	26	36.6	2019
1696	26	46.4	2019
1693	26	15.3	2019
1694	26	77.6	2019
1692	26	14.4	2019
1695	28	37.2	2019
1696	28	74.0	2019
1693	28	53.3	2019
1694	28	63.2	2019
1692	28	48.3	2019
1695	29	36.5	2019
1696	29	45.7	2019
1693	29	45.3	2019
1694	29	39.9	2019
1692	29	24.2	2019
1695	32	49.5	2019
1696	32	62.6	2019
1693	32	87.3	2019
1694	32	44.6	2019
1692	32	63.8	2019
1695	33	71.6	2019
1696	33	69.0	2019
1693	33	36.2	2019
1694	33	70.9	2019
1692	33	28.3	2019
1695	34	36.5	2019
1696	34	68.1	2019
1693	34	35.4	2019
1694	34	41.3	2019
1692	34	19.0	2019
1695	35	36.8	2019
1696	35	73.1	2019
1693	35	57.0	2019
1694	35	57.8	2019
1692	35	53.9	2019
1695	37	46.8	2019
1696	37	60.0	2019
1693	37	36.0	2019
1694	37	24.5	2019
1692	37	36.3	2019
1695	38	45.1	2019
1696	38	72.4	2019
1693	38	21.9	2019
1694	38	100.0	2019
1692	38	20.0	2019
1695	41	36.5	2019
1696	41	72.9	2019
1693	41	46.9	2019
1694	41	99.9	2019
1692	41	20.1	2019
1695	42	36.7	2019
1696	42	51.7	2019
1693	42	11.0	2019
1694	42	32.3	2019
1692	42	21.6	2019
1695	48	36.9	2019
1696	48	53.5	2019
1693	48	9.7	2019
1694	48	29.0	2019
1692	48	21.7	2019
1695	51	37.1	2019
1696	51	63.1	2019
1693	51	38.1	2019
1694	51	74.9	2019
1692	51	21.6	2019
1695	53	36.5	2019
1696	53	46.1	2019
1693	53	28.2	2019
1694	53	22.4	2019
1692	53	23.5	2019
1695	55	72.2	2019
1696	55	87.6	2019
1693	55	37.4	2019
1694	55	92.7	2019
1692	55	34.1	2019
1695	1	54.9	2018
1696	1	91.8	2018
1693	1	96.0	2018
1694	1	95.0	2018
1692	1	71.6	2018
1695	2	80.7	2018
1696	2	66.4	2018
1693	2	67.8	2018
1694	2	56.8	2018
1692	2	61.5	2018
1695	4	38.2	2018
1696	4	88.6	2018
1693	4	34.9	2018
1694	4	83.5	2018
1692	4	36.9	2018
1695	8	80.2	2018
1696	8	75.8	2018
1693	8	59.1	2018
1694	8	80.2	2018
1692	8	53.7	2018
1695	9	35.3	2018
1696	9	58.7	2018
1693	9	28.6	2018
1694	9	56.2	2018
1692	9	39.5	2018
1695	13	35.4	2018
1696	13	46.2	2018
1693	13	21.0	2018
1694	13	53.2	2018
1692	13	23.3	2018
1695	14	41.2	2018
1696	14	48.4	2018
1693	14	24.5	2018
1694	14	11.0	2018
1692	14	19.4	2018
1695	16	37.1	2018
1696	16	75.1	2018
1693	16	35.3	2018
1694	16	54.8	2018
1692	16	30.4	2018
1695	18	0.0	2018
1696	18	58.3	2018
1693	18	4.7	2018
1694	18	70.2	2018
1692	18	23.0	2018
1695	22	35.4	2018
1696	22	80.3	2018
1693	22	91.3	2018
1694	22	90.4	2018
1692	22	70.7	2018
1695	24	94.9	2018
1696	24	67.6	2018
1693	24	79.8	2018
1694	24	73.7	2018
1692	24	57.2	2018
1695	25	35.3	2018
1696	25	58.1	2018
1693	25	54.1	2018
1694	25	67.2	2018
1692	25	30.9	2018
1695	26	35.3	2018
1696	26	40.1	2018
1693	26	15.8	2018
1694	26	78.7	2018
1692	26	18.9	2018
1695	28	35.9	2018
1696	28	76.1	2018
1693	28	64.0	2018
1694	28	67.4	2018
1692	28	33.4	2018
1695	30	35.3	2018
1696	30	67.2	2018
1693	30	17.3	2018
1694	30	72.4	2018
1692	30	25.4	2018
1695	31	9.5	2018
1696	31	37.0	2018
1693	31	26.3	2018
1694	31	58.4	2018
1692	31	27.6	2018
1695	32	35.9	2018
1696	32	65.2	2018
1693	32	77.0	2018
1694	32	53.6	2018
1692	32	61.4	2018
1695	33	26.7	2018
1696	33	69.4	2018
1693	33	54.5	2018
1694	33	74.3	2018
1692	33	39.3	2018
1695	34	9.5	2018
1696	34	62.9	2018
1693	34	50.0	2018
1694	34	44.1	2018
1692	34	15.5	2018
1695	35	36.3	2018
1696	35	66.3	2018
1693	35	56.4	2018
1694	35	71.6	2018
1692	35	45.4	2018
1695	37	45.0	2018
1696	37	55.4	2018
1693	37	13.5	2018
1694	37	38.6	2018
1692	37	28.9	2018
1695	38	40.9	2018
1696	38	59.2	2018
1693	38	30.4	2018
1694	38	98.0	2018
1692	38	28.2	2018
1695	41	35.3	2018
1696	41	71.9	2018
1693	41	44.1	2018
1694	41	99.9	2018
1692	41	24.7	2018
1695	48	35.4	2018
1696	48	52.6	2018
1693	48	22.0	2018
1694	48	22.4	2018
1692	48	35.8	2018
1695	51	36.0	2018
1696	51	66.6	2018
1693	51	27.3	2018
1694	51	82.3	2018
1692	51	28.6	2018
1695	55	73.4	2018
1696	55	86.2	2018
1693	55	62.5	2018
1694	55	99.5	2018
1692	55	42.2	2018
1695	1	44.7	2017
1696	1	89.5	2017
1693	1	94.0	2017
1694	1	95.0	2017
1692	1	74.7	2017
1695	2	74.1	2017
1696	2	64.5	2017
1693	2	61.2	2017
1694	2	60.1	2017
1692	2	54.3	2017
1695	4	34.8	2017
1696	4	89.2	2017
1693	4	41.0	2017
1694	4	69.4	2017
1692	4	45.0	2017
1695	8	61.3	2017
1696	8	71.7	2017
1693	8	56.3	2017
1694	8	74.7	2017
1692	8	48.1	2017
1695	9	34.8	2017
1696	9	65.4	2017
1693	9	22.7	2017
1694	9	39.7	2017
1692	9	36.3	2017
1695	14	39.3	2017
1696	14	51.0	2017
1693	14	24.3	2017
1694	14	8.2	2017
1692	14	21.6	2017
1695	16	38.3	2017
1696	16	74.1	2017
1693	16	44.2	2017
1694	16	65.4	2017
1692	16	29.3	2017
1695	22	34.9	2017
1696	22	78.8	2017
1693	22	86.3	2017
1694	22	92.5	2017
1692	22	73.5	2017
1695	24	86.9	2017
1696	24	66.4	2017
1693	24	71.1	2017
1694	24	76.1	2017
1692	24	48.4	2017
1695	25	35.9	2017
1696	25	50.6	2017
1693	25	43.7	2017
1694	25	79.2	2017
1692	25	40.3	2017
1695	28	35.1	2017
1696	28	65.4	2017
1693	28	54.6	2017
1694	28	45.3	2017
1692	28	34.9	2017
1695	32	36.3	2017
1696	32	47.2	2017
1693	32	61.7	2017
1694	32	47.8	2017
1692	32	51.8	2017
1695	33	20.9	2017
1696	33	68.9	2017
1693	33	53.6	2017
1694	33	56.8	2017
1692	33	39.7	2017
1695	35	35.7	2017
1696	35	63.8	2017
1693	35	47.7	2017
1694	35	72.5	2017
1692	35	40.7	2017
1695	38	38.2	2017
1696	38	56.1	2017
1693	38	33.6	2017
1694	38	89.2	2017
1692	38	34.8	2017
1695	41	35.0	2017
1696	41	72.8	2017
1693	41	43.1	2017
1694	41	98.0	2017
1692	41	24.7	2017
1695	51	35.1	2017
1696	51	56.7	2017
1693	51	32.7	2017
1694	51	78.8	2017
1692	51	31.0	2017
1695	55	54.7	2017
1696	55	77.3	2017
1693	55	56.5	2017
1694	55	99.7	2017
1692	55	34.0	2017
1695	1	38.3	2016
1696	1	90.4	2016
1693	1	83.6	2016
1694	1	93.2	2016
1692	1	70.6	2016
1695	2	63.0	2016
1696	2	64.3	2016
1693	2	50.7	2016
1694	2	50.2	2016
1692	2	21.4	2016
1695	8	51.1	2016
1696	8	70.9	2016
1693	8	52.2	2016
1694	8	62.4	2016
1692	8	44.3	2016
1695	22	32.7	2016
1696	22	76.0	2016
1693	22	76.8	2016
1694	22	88.6	2016
1692	22	69.5	2016
1695	24	69.7	2016
1696	24	65.2	2016
1693	24	63.5	2016
1694	24	73.1	2016
1692	24	43.5	2016
1695	25	64.9	2016
1696	25	31.0	2016
1693	25	29.8	2016
1694	25	69.3	2016
1692	25	34.1	2016
1695	32	33.1	2016
1696	32	49.6	2016
1693	32	58.3	2016
1694	32	49.7	2016
1692	32	50.6	2016
1695	33	32.7	2016
1696	33	50.8	2016
1693	33	47.7	2016
1694	33	52.1	2016
1692	33	41.1	2016
1695	38	32.7	2016
1696	38	34.0	2016
1693	38	26.5	2016
1694	38	25.7	2016
1692	38	29.2	2016
1695	41	33.8	2016
1696	41	52.8	2016
1693	41	22.1	2016
1694	41	62.4	2016
1692	41	28.4	2016
1695	55	40.5	2016
1696	55	74.4	2016
1693	55	53.1	2016
1694	55	99.8	2016
1692	55	39.2	2016
35	6	65.3750	2020
26	27	0.777	2021
\.


--
-- Data for Name: notificacion; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notificacion (id_notificacion, id_usuario, mensaje, leido_bool, fecha_creacion) FROM stdin;
\.


--
-- Data for Name: ranking; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ranking (id_ranking, nombre_ranking, descripcion_ranking, nivel_ranking, categoria_ranking, pais_ranking, metodologia_ranking) FROM stdin;
1	THE Chile	Evalúa instituciones intensivas en investigación bajo métricas de docencia, investigación, citas, perspectiva internacional e ingresos de la industria	Nacional	Docencia e investigación	Reino Unido	Evalúa universidades intensivas en investigación basándose en 18 indicadores de rendimiento, agrupados en cinco pilares clave: Docencia, Entorno de investigación, Calidad de la investigación, Perspectiva internacional e Industria. Utiliza datos bibliométricos de Scopus, encuestas de reputación y datos institucionales para un análisis integral.
2	QS Chile	Evalúa instituciones basadas en reputación académica, empleabilidad, investigación y calidad docente.	Nacional	Reputación académica	Reino Unido	La metodología del QS Latam evalúa a las universidades mediante ocho indicadores adaptados a la realidad regional, destacando la reputación académica (30%) y la reputación entre empleadores (20%) como sus pilares principales. A diferencia del ranking mundial, otorga un peso especial a la formación docente (personal con doctorado), la productividad científica y el impacto web, buscando equilibrar el prestigio internacional con el impacto social y académico dentro del contexto latinoamericano.
3	Scimago Chile	Clasificación mundial que evalúa la calidad y el impacto de las instituciones académicas y de investigación. Es desarrollado por SCImago Lab, una organización de investigación que utiliza los datos de la base científica Scopus (Elsevier).	Nacional	Docencia e investigación	España	La metodología del SIR se basa en un indicador compuesto que combina métricas de investigación (50%), innovación (30%) e impacto social (20%), utilizando  datos de la base Scopus y Patstat.
4	Shanghai GRAS	Clasificación anual de las 1.000 mejores universidades del mundo, publicada desde 2003 por ShanghaiRanking Consultancy. Se centra fuertemente en la investigación, premiando la calidad de la educación, el rendimiento del personal y las publicaciones científicas de alto impacto 	Nacional	Docencia e investigación	China	Evalúa universidades basándose 100% en indicadores académicos y de investigación objetiva, con un fuerte enfoque en la producción científica de élite, premios Nobel/Fields y citas, representando el 20% cada uno
\.


--
-- Data for Name: sub_rank_y_ranking; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sub_rank_y_ranking (id_sub_ranking, id_ranking) FROM stdin;
1	3
2	3
3	3
4	1
5	1
6	1
7	1
8	1
14	2
15	2
16	2
17	2
18	4
19	4
20	4
21	4
22	4
23	4
24	4
25	4
26	4
27	4
28	4
29	4
30	4
31	4
32	4
33	4
34	4
35	4
36	4
37	4
38	4
39	4
40	4
41	4
42	4
43	4
44	4
45	4
46	4
47	4
48	4
49	4
50	4
51	4
52	4
53	4
54	4
55	4
56	4
57	4
58	4
59	4
60	4
61	4
62	4
63	4
64	4
65	4
66	4
67	4
68	4
69	4
70	4
71	4
72	4
73	4
74	4
\.


--
-- Data for Name: sub_ranking; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sub_ranking (id_sub_ranking, nombre_sub_ranking, peso_sub_ranking) FROM stdin;
1	Innovation Factor	30
2	Societal Factor	20
3	Research Factor	50
6	Research Quality	30
9	Research and Discovery	50
10	Employability and Outcomes	20
11	Global Engagement	15
12	Learning Experience	10
13	Sustainability	5
14	Research and Discovery (Latam)	45
15	Employability and Outcomes (Latam)	20
16	Global Engagement (Latam)	15
17	Learning Experience (Latam)	20
18	Mathematics	1.75
19	Physics	1.75
20	Chemistry	1.75
21	Earth Sciences	1.75
22	Geography	1.75
23	Ecology	1.75
24	Oceanography	1.75
25	Atmospheric Science	1.75
26	Mechanical Engineering	1.75
27	Electrical & Electronic Engineering	1.75
28	Automation & Control	1.75
29	Telecommunication Engineering	1.75
30	Instruments Science & Technology	1.75
31	Biomedical Engineering	1.75
32	Computer Science & Engineering	1.75
33	Civil Engineering	1.75
34	Chemical Engineering	1.75
35	Materials Science & Engineering	1.75
36	Nanoscience & Nanotechnology	1.75
37	Energy Science & Engineering	1.75
38	Environmental Science & Engineering	1.75
39	Water Resources	1.75
40	Food Science & Technology	1.75
41	Biotechnology	1.75
42	Aerospace Engineering	1.75
43	Marine/Ocean Engineering	1.75
44	Transportation Science & Technology	1.75
45	Remote Sensing	1.75
46	Mining & Mineral Engineering	1.75
47	Metallurgical Engineering	1.75
48	Textile Science & Engineering	1.75
49	Artificial Intelligence	1.75
50	Robotic Science & Engineering	1.75
51	Biological Sciences	1.75
52	Human Biological Sciences	1.75
53	Agricultural Sciences	1.75
54	Veterinary Sciences	1.75
55	Clinical Medicine	1.75
56	Public Health	1.75
57	Dentistry & Oral Sciences	1.75
58	Nursing	1.75
59	Medical Technology	1.75
60	Pharmacy & Pharmaceutical Sciences	1.75
61	Economics	1.75
62	Statistics	1.75
63	Law	1.75
64	Political Sciences	1.75
65	Sociology	1.75
66	Education	1.75
67	Communication	1.75
68	Psychology	1.75
69	Business Administration	1.75
70	Finance	1.75
71	Management	1.75
72	Public Administration	1.75
73	Hospitality & Tourism Management	1.75
74	Library & Information Science	1.75
4	Teaching	30
5	Research Environment	30
7	Industry	0
8	International Outlook	10
\.


--
-- Data for Name: universidad; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.universidad (id_universidad, nombre_universidad, pais_universidad) FROM stdin;
1	Pontificia Universidad Catolica de Chile	Chile
2	Pontificia Universidad Catolica de Valparaiso	Chile
3	Universidad Academia de Humanismo Cristiano	Chile
4	Universidad Adolfo Ibanez	Chile
5	Universidad Adventista de Chile	Chile
6	Universidad Alberto Hurtado	Chile
7	Universidad Arturo Prat	Chile
8	Universidad Austral de Chile	Chile
9	Universidad Autonoma de Chile	Chile
10	Universidad Bernardo O'Higgins	Chile
11	Universidad Bolivariana de Chile	Chile
12	Universidad Catolica Cardenal Raul Silva Henriquez	Chile
13	Universidad Catolica de la Santisima Concepcion	Chile
14	Universidad Catolica de Temuco	Chile
15	Universidad Catolica del Maule	Chile
16	Universidad Catolica del Norte	Chile
17	Universidad Central de Chile	Chile
18	Universidad de Antofagasta	Chile
19	Universidad ARCIS	Chile
20	Universidad de Artes, Ciencias y Comunicacion	Chile
21	Universidad de Atacama	Chile
22	Universidad de Chile	Chile
23	Universidad Ucinf	Chile
24	Universidad de Concepcion	Chile
25	Universidad de la Frontera	Chile
26	Universidad de La Serena	Chile
29	Universidad de Los Lagos	Chile
30	Universidad de Magallanes	Chile
31	Universidad de Playa Ancha	Chile
32	Universidad de Santiago de Chile	Chile
33	Universidad de Talca	Chile
34	Universidad de Tarapaca	Chile
35	Universidad de Valparaiso	Chile
36	Universidad de Vina del Mar	Chile
37	Universidad del Bio-Bio	Chile
38	Universidad del Desarrollo	Chile
41	Universidad Diego Portales	Chile
42	Universidad Finis Terrae	Chile
43	Universidad Gabriela Mistral	Chile
44	Universidad Iberoamericana de Ciencias y Tecnologia	Chile
45	Universidad Internacional SEK Chile	Chile
46	Universidad La Republica	Chile
47	Universidad Los Leones	Chile
48	Universidad Mayor	Chile
49	Universidad Metropolitana de Ciencias de la Educacion	Chile
50	Universidad Miguel de Cervantes	Chile
52	Universidad Pedro de Valdivia	Chile
53	Universidad San Sebastian	Chile
55	Universidad Tecnica Federico Santa Maria	Chile
56	Universidad Tecnologica de Chile	Chile
57	Universidad Tecnologica Metropolitana	Chile
27	Universidad de Las Americas	Chile
28	Universidad de los Andes	Chile
39	Universidad del Mar	Chile
40	Universidad del Pacifico	Chile
51	Universidad Andres Bello	Chile
54	Universidad Santo Tomas	Chile
58	Universidad UNIACC	Chile
\.


--
-- Data for Name: universidad_ranking; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.universidad_ranking (id_universidad, id_ranking, anio_ranking, posicion_universidad) FROM stdin;
\.


--
-- Data for Name: usuario; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuario (id_usuario, nombre_usuario, institucion_usuario, clave_usuario, correo_usuario, notificaciones_switch, plan_usuario, fecha_creacion, fecha_facturacion) FROM stdin;
2	Gerard Otto	PUCV	claveKai420	ottosagredo@gmail.com	t	ADMIN	2026-04-07 00:38:51.974658	\N
\.


--
-- Name: configuracion_id_configuracion_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.configuracion_id_configuracion_seq', 1, false);


--
-- Name: metrica_id_metrica_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.metrica_id_metrica_seq', 1696, true);


--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notificacion_id_notificacion_seq', 1, false);


--
-- Name: ranking_id_ranking_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ranking_id_ranking_seq', 4, true);


--
-- Name: sub_ranking_id_sub_ranking_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sub_ranking_id_sub_ranking_seq', 79, true);


--
-- Name: universidad_id_universidad_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.universidad_id_universidad_seq', 58, true);


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.usuario_id_usuario_seq', 2, true);


--
-- Name: configuracion_metrica configuracion_metrica_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_metrica
    ADD CONSTRAINT configuracion_metrica_pkey PRIMARY KEY (id_configuracion, id_metrica);


--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (id_configuracion);


--
-- Name: metrica metrica_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metrica
    ADD CONSTRAINT metrica_pkey PRIMARY KEY (id_metrica);


--
-- Name: metrica_universidad metrica_universidad_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metrica_universidad
    ADD CONSTRAINT metrica_universidad_pkey PRIMARY KEY (id_metrica, id_universidad, anio_metrica);


--
-- Name: notificacion notificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificacion
    ADD CONSTRAINT notificacion_pkey PRIMARY KEY (id_notificacion);


--
-- Name: ranking ranking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ranking
    ADD CONSTRAINT ranking_pkey PRIMARY KEY (id_ranking);


--
-- Name: sub_rank_y_ranking sub_rank_y_ranking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sub_rank_y_ranking
    ADD CONSTRAINT sub_rank_y_ranking_pkey PRIMARY KEY (id_sub_ranking, id_ranking);


--
-- Name: sub_ranking sub_ranking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sub_ranking
    ADD CONSTRAINT sub_ranking_pkey PRIMARY KEY (id_sub_ranking);


--
-- Name: universidad universidad_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.universidad
    ADD CONSTRAINT universidad_pkey PRIMARY KEY (id_universidad);


--
-- Name: universidad_ranking universidad_ranking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.universidad_ranking
    ADD CONSTRAINT universidad_ranking_pkey PRIMARY KEY (id_universidad, id_ranking, anio_ranking);


--
-- Name: usuario usuario_correo_usuario_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_correo_usuario_key UNIQUE (correo_usuario);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id_usuario);


--
-- Name: idx_configuracion_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_configuracion_usuario ON public.configuracion USING btree (id_usuario);


--
-- Name: idx_metrica_ranking; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_metrica_ranking ON public.metrica USING btree (id_ranking);


--
-- Name: idx_metrica_universidad; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_metrica_universidad ON public.metrica_universidad USING btree (id_universidad);


--
-- Name: idx_universidad_ranking_anio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_universidad_ranking_anio ON public.universidad_ranking USING btree (anio_ranking);


--
-- Name: notificacion notification_insert_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER notification_insert_trigger AFTER INSERT ON public.notificacion FOR EACH ROW EXECUTE FUNCTION public.notify_new_notification();


--
-- Name: configuracion configuracion_id_ranking_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_id_ranking_fkey FOREIGN KEY (id_ranking) REFERENCES public.ranking(id_ranking) ON DELETE CASCADE;


--
-- Name: configuracion configuracion_id_universidad_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_id_universidad_fkey FOREIGN KEY (id_universidad) REFERENCES public.universidad(id_universidad) ON DELETE CASCADE;


--
-- Name: configuracion configuracion_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: configuracion_metrica configuracion_metrica_id_configuracion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_metrica
    ADD CONSTRAINT configuracion_metrica_id_configuracion_fkey FOREIGN KEY (id_configuracion) REFERENCES public.configuracion(id_configuracion) ON DELETE CASCADE;


--
-- Name: configuracion_metrica configuracion_metrica_id_metrica_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_metrica
    ADD CONSTRAINT configuracion_metrica_id_metrica_fkey FOREIGN KEY (id_metrica) REFERENCES public.metrica(id_metrica) ON DELETE CASCADE;


--
-- Name: metrica metrica_id_ranking_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metrica
    ADD CONSTRAINT metrica_id_ranking_fkey FOREIGN KEY (id_ranking) REFERENCES public.ranking(id_ranking) ON DELETE CASCADE;


--
-- Name: metrica metrica_id_sub_ranking_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metrica
    ADD CONSTRAINT metrica_id_sub_ranking_fkey FOREIGN KEY (id_sub_ranking) REFERENCES public.sub_ranking(id_sub_ranking) ON DELETE SET NULL;


--
-- Name: metrica_universidad metrica_universidad_id_metrica_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metrica_universidad
    ADD CONSTRAINT metrica_universidad_id_metrica_fkey FOREIGN KEY (id_metrica) REFERENCES public.metrica(id_metrica) ON DELETE CASCADE;


--
-- Name: metrica_universidad metrica_universidad_id_universidad_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metrica_universidad
    ADD CONSTRAINT metrica_universidad_id_universidad_fkey FOREIGN KEY (id_universidad) REFERENCES public.universidad(id_universidad) ON DELETE CASCADE;


--
-- Name: notificacion notificacion_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificacion
    ADD CONSTRAINT notificacion_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: sub_rank_y_ranking sub_rank_y_ranking_id_ranking_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sub_rank_y_ranking
    ADD CONSTRAINT sub_rank_y_ranking_id_ranking_fkey FOREIGN KEY (id_ranking) REFERENCES public.ranking(id_ranking) ON DELETE CASCADE;


--
-- Name: sub_rank_y_ranking sub_rank_y_ranking_id_sub_ranking_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sub_rank_y_ranking
    ADD CONSTRAINT sub_rank_y_ranking_id_sub_ranking_fkey FOREIGN KEY (id_sub_ranking) REFERENCES public.sub_ranking(id_sub_ranking) ON DELETE CASCADE;


--
-- Name: universidad_ranking universidad_ranking_id_ranking_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.universidad_ranking
    ADD CONSTRAINT universidad_ranking_id_ranking_fkey FOREIGN KEY (id_ranking) REFERENCES public.ranking(id_ranking) ON DELETE CASCADE;


--
-- Name: universidad_ranking universidad_ranking_id_universidad_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.universidad_ranking
    ADD CONSTRAINT universidad_ranking_id_universidad_fkey FOREIGN KEY (id_universidad) REFERENCES public.universidad(id_universidad) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict NjaO5mLAFgauWK9V8mgc0PrDpAkMNLDdOhd1gyNOkICXMjUa0Wq0Dbuvo8E4fu3

