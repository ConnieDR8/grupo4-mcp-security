# INFORME TÉCNICO DE SEGURIDAD: PROYECTO MCP SECURITY LAB
**Documento:** Reporte Detallado de Arquitectura, Auditoría y Pruebas de Concepto (PoC)
**Equipo:** Grupo 4
**Fecha de Emisión:** 4 de Octubre de 2026
**Estado del Proyecto:** Auditoría de vulnerabilidades completada. Fase de mitigación pendiente.

---

## 1. Resumen Ejecutivo

El presente informe detalla el diseño, implementación y auditoría de un entorno de laboratorio basado en el **Model Context Protocol (MCP)**. El objetivo principal del proyecto es demostrar vectores de ataque reales que pueden comprometer a servidores MCP (y por extensión, a los agentes LLM que los consumen), para posteriormente aplicar sus respectivas mitigaciones.

A la fecha, se ha construido exitosamente la arquitectura base, se han inyectado de forma segura tres vulnerabilidades críticas (Authorization Bypass, Path Traversal e Injection), y se ha sometido el código a un escrutinio de seguridad dual: 
1. **Análisis Estático Automatizado** mediante *Cisco AI Defense MCP Scanner*.
2. **Auditoría Manual de Cumplimiento** aplicando los 16 dominios del framework *SlowMist*.

La auditoría demostró de forma concluyente que las herramientas automatizadas (Cisco) logran detectar amenazas sistémicas directas (como Path Traversal), pero son incapaces de identificar vulnerabilidades de lógica de negocio o de control de acceso, requiriendo el análisis manual humano para descubrir el 100% de la superficie de ataque.

---

## 2. Arquitectura del Entorno y Configuraciones Base

El ecosistema del servidor ha sido estructurado en TypeScript moderno (`ES2022`, `NodeNext`) garantizando un tipado estricto mediante `zod`. 

### 2.1 Despliegue de Servidores
El proyecto opera sobre un modelo de repositorios paralelos para facilitar la comparación "Antes y Después":
*   **Servidor Vulnerable** (`npm run dev:vulnerable`): Contiene la lógica intencionalmente defectuosa.
*   **Servidor Seguro** (`npm run dev:secure`): Esqueleto preparado para recibir la refactorización de seguridad (Fase 9).

Ambos servidores operan mediante el transporte `stdio`, abstrayéndose de la capa de red y comunicándose de manera nativa proceso-a-proceso con el cliente (por ejemplo, el Inspector de MCP).

### 2.2 Entorno de Fixtures (Datos de Prueba)
Para probar los vectores de ataque sin comprometer la máquina host del desarrollador, se creó un entorno encapsulado en `fixtures/`:
*   `logs/sistema.log`: Contiene 10 líneas de registros ficticios e inofensivos.
*   `private/secreto-ficticio.txt`: Archivo restringido simulado, utilizado exclusivamente como objetivo para la prueba de concepto de Path Traversal.

---

## 3. Modelado de Vulnerabilidades (Diseño Intencional)

El código fuente vulnerable (`apps/mcp-lab/src/vulnerable/index.ts`) expone cuatro herramientas, diseñadas para ilustrar fallos específicos en el ecosistema LLM-MCP.

### 3.1 Línea Base Segura (`saludar`)
Herramienta de control que valida correctamente la entrada del usuario mediante esquemas Zod estrictos (`.trim().min(1).max(60)`). Demuestra cómo debería ser una interacción sana.

### 3.2 Authorization Bypass (`borrar_base_datos_clientes`)
*   **Defecto de diseño:** La herramienta permite una acción destructiva confiando ciegamente en el parámetro `rol_usuario` inyectado en el payload por el cliente.
*   **Vector de riesgo:** En un entorno real, un LLM engañado (Prompt Injection) podría autodeclararse "admin" y desencadenar el borrado de datos, ya que el backend carece de un sistema de sesión o token criptográfico real.

### 3.3 Path Traversal / Arbitrary File Read (`leer_registro_sistema`)
*   **Defecto de diseño:** El sistema concatena dinámicamente un directorio base estricto con un input no sanitizado del usuario (`path.join(__dirname, ruta_archivo)`).
*   **Vector de riesgo:** Al permitir secuencias relativas de escape (`../`), un atacante puede salir del directorio de logs y acceder a archivos sensibles del disco duro del servidor.

### 3.4 Command Injection Simulada (`diagnostico_servidor`)
*   **Defecto de diseño ético:** Dado que ejecutar `child_process.exec` real viola las normativas académicas, la herramienta implementa un simulador de consola que acepta separadores de shell reales (`;`, `&&`, `|`).
*   **Vector de riesgo:** Ilustra cómo la falta de parametrización de un input (ej. `host`) permite la ejecución de comandos arbitrarios concatenados.

---

## 4. Resultados de Auditoría de Seguridad

El servidor vulnerable fue sometido a metodologías de evaluación tanto dinámicas como estáticas.

### 4.1 Análisis Automatizado (Cisco AI Defense MCP Scanner)
Para la evaluación automatizada temprana, se desplegó el **Cisco AI Defense MCP Scanner** (v4.8.5), una herramienta especializada en auditar servidores MCP mediante análisis de firmas estáticas y modelos de comportamiento.

#### 4.1.1 Configuración, Motores y Ejecución
El escáner fue aprovisionado en el entorno local utilizando el gestor ultrarrápido de paquetes de Python `uv`. Para garantizar una evaluación segura y contenida, se forzó el modo de análisis 100% estático (offline) apuntando directamente a la especificación exportada del servidor (`evidence/tools-definition.json`).

*   **Comando base de ejecución:** 
    `mcp-scanner --format detailed --verbose static --tools evidence/tools-definition.json`
*   **Motores de Análisis (Analyzers):** Al prescindir deliberadamente de APIs LLM externas para mantener el laboratorio autocontenido, el escáner recayó exclusivamente en su motor principal de **reglas YARA**. El log de depuración (Verbose) confirmó la compilación en tiempo real de más de 10 reglas críticas especializadas en agentes de IA, tales como: `code_execution.yara`, `command_injection.yara`, `prompt_injection.yara` y `system_manipulation.yara`.

#### 4.1.2 Taxonomía de Hallazgos
El reporte automatizado final generó el siguiente diagnóstico:
*   **Volumen:** 4 Herramientas analizadas.
*   **Evaluación Segura (Safe):** 3 (`saludar`, `borrar_base_datos_clientes`, `diagnostico_servidor`).
*   **Evaluación Insegura (Unsafe):** 1 (`leer_registro_sistema`).

El escáner logró interceptar de manera exitosa la vulnerabilidad de Path Traversal, clasificándola bajo los estándares taxonómicos de riesgo de IA (AITech):
*   **Severidad:** ALTA (HIGH)
*   **Categoría YARA:** SYSTEM MANIPULATION
*   **Taxonomía Principal:** `AITech-9.1` (Model or Agentic System Manipulation)
*   **Sub-Taxonomía:** `AISubtech-9.1.2` (Unauthorized or Unsolicited System Access)
*   **Justificación Técnica Emitida:** *"Manipulating or accessing underlying system resources without authorization, leading to unsolicited modification or deletion of files, registries, or permissions through model-driven or agent-executed commands system."*

#### 4.1.3 Análisis de Limitaciones (Falsos Negativos)
Pese a su precisión detectando manipulación de archivos de sistema, el escáner declaró las herramientas `borrar_base_datos_clientes` y `diagnostico_servidor` como "Seguras", arrojando dos Falsos Negativos críticos debido a su naturaleza estática:
1.  **Ceguera ante Lógica de Negocio (Auth Bypass):** Las reglas YARA buscan patrones de código sintácticamente maliciosos o firmas de librerías de riesgo. Un control de acceso lógicamente defectuoso que valida privilegios basándose en un payload inyectado por el cliente no dispara reglas estáticas de malware.
2.  **Ceguera ante Simulaciones (Injection):** Puesto que la Fase 5 exigió remover la invocación de `child_process.exec()` por razones éticas (para evitar RCEs reales en el host del estudiante) y sustituirlo por una "consola simulada", las expresiones regulares de YARA no encontraron los imports ni firmas nativas de ejecución de shell, ignorando el peligro real de la concatenación no sanitizada de strings que expone la herramienta.

### 4.2 Auditoría Manual de Cumplimiento (SlowMist Framework)
Se aplicó de manera exhaustiva el checklist oficial de SlowMist, cubriendo explícitamente el **100% de los 16 dominios** de seguridad. Los controles correspondientes al ciclo de vida del Cliente, uso de criptomonedas y Multi-MCP fueron justificados como Fuera de Alcance (N/A).

**Resumen de los 12 Hallazgos de Mejora:**
| ID | Dominio SlowMist Afectado | Severidad | Herramienta | Hallazgo Principal |
|---|---|---|---|---|
| H-01 | 1.1, 8.2, 12.3 | 🔴 CRÍTICO | `leer_registro_sistema` | Path Traversal / Arbitrary File Read |
| H-02 | 2.1, 10.4, 12.4 | 🔴 CRÍTICO | `borrar_base_datos_clientes` | Authorization Bypass por entrada del cliente |
| H-03 | 1.1, 12.3, 12.5 | 🔴 CRÍTICO | `diagnostico_servidor` | Injection: host concatenado sin sanitizar |
| H-04 | 1.2 Rate Limiting | 🟡 MEDIO | Todas | Sin límite de invocaciones por cliente |
| H-05 | 1.3 Output Encoding | 🟡 MEDIO | `leer_registro_sistema` | Contenido de archivo retornado sin sanitizar |
| H-06 | 2.3 Least Privilege | 🟡 MEDIO | Servidor completo | El proceso Node corre sin restricción de permisos |
| H-07 | 4.1, 4.5 Isolation | 🟡 MEDIO | Servidor completo | Sin contenedor ni aislamiento de runtime (CPU/RAM) |
| H-08 | 7.1 Audit Logging | 🟡 MEDIO | Servidor completo | Sin registro de eventos o uso de tools críticas |
| H-09 | 12.9 Error Handling | 🟡 MEDIO | `leer_registro_sistema` | Fallos crudos del filesystem expuestos al cliente |
| H-10 | 10.1 Data Minimization | 🟢 BAJO | `leer_registro_sistema` | Respuesta sin límite de truncamiento |
| H-11 | 3.1 Lifecycle | 🟢 BAJO | Servidor completo | Ausencia de hooks de apagado (SIGINT/SIGTERM) |
| H-12 | 8.3 Perm Separation | 🟢 BAJO | Servidor completo | Sin separación de privilegios entre herramientas |

---

## 5. Pruebas de Concepto (PoC) — Guía de Explotación

Para verificar las vulnerabilidades, se utiliza el Inspector de MCP oficial:
`npx @modelcontextprotocol/inspector tsx apps/mcp-lab/src/vulnerable/index.ts`

### PoC 1: Explotación de Authorization Bypass
1.  **Payload (Benigno):** `{"rol_usuario": "user", "confirmacion": true}` → Rechazado.
2.  **Payload (Ataque):** `{"rol_usuario": "admin", "confirmacion": true}` → Base de datos borrada con éxito.
*El servidor confía ciegamente en el rol auto-declarado.*

### PoC 2: Explotación de Path Traversal
1.  **Payload (Benigno):** `{"ruta_archivo": "sistema.log"}` → Muestra logs regulares.
2.  **Payload (Ataque):** `{"ruta_archivo": "../private/secreto-ficticio.txt"}` → Filtra archivo confidencial.
*El uso inseguro de `path.join` permite el uso de saltos direccionales `../`.*

### PoC 3: Explotación de Command Injection (Simulada)
1.  **Payload (Benigno):** `{"host": "127.0.0.1"}` → Simula Ping normal.
2.  **Payload (Ataque):** `{"host": "127.0.0.1; whoami"}` → Ejecuta comando inyectado mostrando al usuario ficticio.
*La concatenación de strings permite ejecutar todo lo que siga a un separador de shell.*

---

## 6. Plan de Mitigación y Futuros Pasos (Roadmap)

Con las fases analíticas concluidas, el proyecto entra en su ciclo de remediación. 

1.  **Desarrollo de Código Seguro (Fase 9):**
    *   *Path Traversal:* Implementar comprobaciones booleanas `.startsWith()` combinadas con `path.resolve()` para confinar la lectura al directorio autorizado.
    *   *Auth Bypass:* Retirar el control de privilegios del input del cliente. Emular un contexto de sesión de backend.
    *   *Injection:* Restringir las entradas mediante RegEx estricta (`/^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9.-]+$/`) rechazando caracteres de escape.
2.  **Validación Before/After (Fase 10 & 11):**
    *   Ejecutar las mismas Pruebas de Concepto (PoC) documentadas en la sección 5 sobre el servidor seguro (`npm run dev:secure`) para comprobar la denegación de los ataques.
3.  **Documentación de Riesgos y Entrega (Fases 12 y 13):**
    *   Consolidar la taxonomía de AITech para cada vector mitigado.
    *   Finalizar el README oficial del repositorio para instructores y evaluadores.
4.  **Preparación de Defensa Académica (Fases 14, 15 y 16):**
    *   Elaboración de matriz PPT resumiendo la falla sistémica automatizada vs manual.
    *   Grabación de la demostración en video como respaldo de la defensa en vivo.
    *   Ejecución de ensayo general de la rúbrica de calificación.
