# Reporte de Avance Integral — Grupo 4 MCP Security Lab
**Fecha de corte:** Octubre 4, 2026
**Fases completadas en este reporte:** 3, 4, 5, 6, 7 y 8.
**Fases pendientes (Futuros Pasos):** 9 a 16.

---

## 1. Instrucciones de Ejecución del Entorno

El repositorio ha sido configurado para poder levantar dos servidores independientes, el servidor con las vulnerabilidades intencionales y el esqueleto del servidor seguro, así como herramientas de auditoría.

### Ejecución de los Servidores MCP
Los comandos se ejecutan desde la raíz del proyecto (`c:\Seguridad\grupo4-mcp-security`).

- **Servidor Vulnerable:**
  ```bash
  npm run dev:vulnerable
  # Equivalente a: tsx apps/mcp-lab/src/vulnerable/index.ts
  ```
- **Servidor Seguro (Esqueleto actual):**
  ```bash
  npm run dev:secure
  # Equivalente a: tsx apps/mcp-lab/src/secure/index.ts
  ```

Ambos servidores utilizan transporte `stdio`, por lo que al ejecutarse directamente en terminal, el proceso se queda bloqueado esperando mensajes de entrada estándar.

### Uso del Inspector Interactivo (Recomendado)
Para interactuar gráficamente con el servidor y probar payloads (crucial para la Fase 8):

```bash
npx @modelcontextprotocol/inspector tsx apps/mcp-lab/src/vulnerable/index.ts
```
Una vez lanzado, se debe abrir el navegador en `http://localhost:5173`. Esto renderiza la interfaz gráfica donde se exponen las Tools, Resources y Prompts.

---

## 2. Fase 3 — Configuración de Typescript, Tools, Resources y Prompts

Se estableció la configuración estricta de compilación y se verificó el registro exitoso de los componentes base del protocolo MCP.

### 2.1 Archivo `tsconfig.json`
Se creó y validó el archivo de configuración para TypeScript en la raíz, asegurando que `npm run typecheck` ejecute exitosamente sin errores de tipos:

```json
{
    "compilerOptions": {
      "target": "ES2022",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "strict": true,
      "noEmit": true,
      "types": ["node"],
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true
    },
    "include": ["apps/**/*.ts"]
}
```

### 2.2 Validación de Componentes (Inspector)
Se confirmó en el Inspector el funcionamiento correcto de:
*   **Resource:** `lab://project-info` devuelve exitosamente los metadatos JSON `LAB_INFO`.
*   **Prompt:** `explicar-componente-mcp` acepta el enum `MCP_COMPONENTS` (`Host`, `Client`, `Server`, `Transport`, `Tool`, `Resource`, `Prompt`) y genera la plantilla esperada sin errores.

---

## 3. Fase 4 — Entorno de Pruebas y Esqueleto Seguro

Se aseguraron los fixtures y las bases para la posterior mitigación de vulnerabilidades.

### 3.1 Registros Ficticios (Fixtures)
Se amplió el archivo `apps/mcp-lab/fixtures/logs/sistema.log` con 10 líneas de actividad simulada, completamente inofensiva y sin referenciar rutas reales del sistema:

```text
[2026-10-01 08:12:03] INFO  sistema iniciado correctamente
[2026-10-01 08:14:51] INFO  usuario-ficticio-01 inició sesión
[2026-10-01 09:02:10] WARN  intento de acceso a recurso restringido (bloqueado)
[2026-10-01 10:45:22] INFO  tarea programada 'backup-nocturno' completada
[2026-10-01 11:30:00] ERROR conexión perdida con servicio-ficticio-pagos (timeout)
[2026-10-01 12:00:00] INFO  reconexión exitosa con servicio-ficticio-pagos
[2026-10-01 13:15:44] WARN  usuario-ficticio-02 realizó 3 intentos de acceso fallidos
[2026-10-01 14:22:09] INFO  tarea programada 'limpieza-tmp' completada
[2026-10-01 15:45:00] INFO  sesión de usuario-ficticio-01 cerrada
[2026-10-01 23:59:59] INFO  fin de jornada — sistema en espera
```

Además, el archivo `fixtures/private/secreto-ficticio.txt` fue validado para usarse exclusivamente como blanco de la prueba de vulnerabilidad de Path Traversal.

### 3.2 Servidor Seguro (`src/secure/index.ts`)
Se inicializó el esqueleto base para alojar las futuras mitigaciones de la Fase 9. Actualmente registra el servidor bajo la versión `0.1.0` de `grupo4-mcp-lab-secure` e implementa únicamente la tool segura de línea base: `saludar`.

---

## 4. Fase 5 — Código Vulnerable y Lógica de Herramientas

Se modificó la lógica del servidor en `src/vulnerable/index.ts` para que las tres vulnerabilidades principales reflejen escenarios reales de abuso sin poner en riesgo la máquina del usuario que ejecuta el laboratorio.

### Tool 1: `saludar` (Línea Base Segura)
Funciona como mecanismo de prueba y validación de tipos Zod (`.trim().min(1).max(60)`). No contiene vulnerabilidades.

### Tool 2: `borrar_base_datos_clientes` (Vulnerabilidad 1: Authorization Bypass)
*   **Problema:** La validación de permisos se confía íntegramente al payload entrante (`rol_usuario`).
*   **Implementación exacta:** El backend ejecuta `if (rol_usuario !== 'admin') { ... }` asumiendo que la declaración del cliente es verídica, en lugar de validar un token criptográfico o una sesión del servidor.

### Tool 3: `leer_registro_sistema` (Vulnerabilidad 2: Path Traversal / Arbitrary File Read)
*   **Mejora de Robustez (Fase 5):** Se reemplazó el inestable `process.cwd()` por una ruta absoluta estricta usando importaciones de módulos ES (`const __dirname = path.dirname(fileURLToPath(import.meta.url));`).
*   **Problema:** Tras calcular el directorio base, se concatena `ruta_archivo` usando `path.join(directorioBase, ruta_archivo)` **sin validar** secuencias de escape como `../`. Esto permite a un atacante leer archivos arbitrarios como el secreto ficticio.

### Tool 4: `diagnostico_servidor` (Vulnerabilidad 3: Injection Simulada)
*   **Mejora Ética (Fase 5):** Se eliminó por completo el paquete `child_process.exec()` para prevenir ejecución arbitraria real (Command Injection) que viola las políticas de seguridad académicas.
*   **Implementación Simulada:** El nuevo código usa un simulador de consola que acepta y divide comandos usando separadores de shell reales (`/;|&&|\|/`).
*   **Problema Intencional:** Si bien ningún comando afecta el OS real, el servidor acepta, parsea y "ejecuta" comandos inyectados tras los separadores devolviendo datos de su diccionario `RESPUESTAS_SIMULADAS`, demostrando perfectamente el vector de ataque de Concatenación Insegura sin el riesgo físico de una RCE genuina.

---

## 5. Fase 6 — Resultados del Escaneo Cisco MCP

Se instaló localmente la herramienta oficial `cisco-ai-mcp-scanner` utilizando el gestor de paquetes de Python `uv`. 

El escaneo se ejecutó de forma estática apuntando directamente al archivo actualizado `evidence/tools-definition.json` (ahora con 4 herramientas, incluyendo `diagnostico_servidor`).

### Reporte de Auditoría Generado y Anotado (`audit/cisco-scanner-results.txt`)
El resultado íntegro documentado, que fusiona los hallazgos automáticos con el análisis humano:

```text
# Cisco AI Defense MCP Scanner — Resultados
# Fecha: 2026-10-04 13:48:44
# Comando: mcp-scanner --format detailed static --tools evidence/tools-definition.json
# Nota: "Server URL: mcp.deepwiki.com" es el target DEFAULT de la herramienta;
#       el escaneo real fue sobre: evidence/tools-definition.json (4 tools del Grupo 4)
# Advertencias esperadas: LLM y API analyzers desactivados (sin API key) — solo YARA activo
# =====================================================================================
Warning: LLM analyzer requested but MCP_SCANNER_LLM_API_KEY not set
Warning: API analyzer requested but MCP_SCANNER_API_KEY not set

=== MCP Scanner Results ===

Server URL: https://mcp.deepwiki.com/mcp
Tools scanned: 4
Safe tools: 3
Unsafe tools: 1
Incomplete tools: 0

=== Detalle por Tool ===

1. saludar
   Status: completed
   Safe: Yes
   Analyzer Results:
     yara_analyzer:
       - Severity: SAFE
       - Threat Summary: No threats detected
       - Total Findings: 0

2. borrar_base_datos_clientes
   Status: completed
   Safe: Yes
   Analyzer Results:
     yara_analyzer:
       - Severity: SAFE
       - Threat Summary: No threats detected
       - Total Findings: 0
   >> NOTA DEL EQUIPO: Esta tool contiene el Authorization Bypass (H-02, CRÍTICO
      en SlowMist). YARA no evalúa lógica de negocio/autorización, solo patrones
      de código conocidos — por eso no dispara ningún hallazgo aquí.

3. leer_registro_sistema
   Status: completed
   Safe: No
   Analyzer Results:
     yara_analyzer:
       - Severity: HIGH
       - Threat Summary: Detected 1 threat: system manipulation
       - Threat Names: SYSTEM MANIPULATION
       - Total Findings: 1
       - MCP Taxonomy:
         AITech: AITech-9.1
         AITech Name: Model or Agentic System Manipulation
         AISubtech: AISubtech-9.1.2
         AISubtech Name: Unauthorized or Unsolicited System Access
         Description: Manipulating or accessing underlying system resources without
         authorization, leading to data exposure or system compromise.
   >> NOTA DEL EQUIPO: La etiqueta "System Manipulation" es genérica; nuestro
      análisis manual (SlowMist, control 1.1) la especifica correctamente como
      Path Traversal / Arbitrary File Read.

4. diagnostico_servidor
   Status: completed
   Safe: Yes
   Analyzer Results:
     yara_analyzer:
       - Severity: SAFE
       - Threat Summary: No threats detected
       - Total Findings: 0
   >> NOTA DEL EQUIPO: Esta tool contiene la Injection simulada (H-03, CRÍTICO
      en SlowMist). El código simulado no ejecuta `exec()` real ni contiene
      patrones de shell injection que el YARA reconozca, por lo que pasa como
      segura pese a tener la vulnerabilidad de concatenación sin sanitizar.

=== Conclusión del equipo ===

De los 3 hallazgos críticos identificados manualmente (H-01, H-02, H-03),
Cisco MCP Scanner solo detectó 1 (H-01, Path Traversal). Los otros dos
(Authorization Bypass y Injection) requieren análisis de lógica de negocio
que un escáner estático basado en YARA no puede realizar. Esto confirma
que el análisis automatizado y la auditoría manual (SlowMist) son
complementarios, no sustitutos.
```

---

## 6. Fase 7 — Auditoría Manual Completa (Checklist SlowMist)

Se elaboró y completó íntegramente la matriz de auditoría basada en el framework SlowMist, cubriendo los 14 dominios de seguridad aplicables al ecosistema MCP. Este documento final existe en `audit/slowmist-report.md`.

### Evaluación Final (14 Dominios)
1. **API Security:** 
   - `1.1 Input Validation`: **FALLA CRÍTICA** en Path Traversal e Injection Simulada.
   - `1.2 API Rate Limiting`: **FALLA** general (Ausencia total).
   - `1.3 Output Encoding`: **FALLA** en `leer_registro_sistema` al devolver crudos del sistema.
2. **Server Authentication & Authorization:**
   - `2.1 Access Control`: **FALLA CRÍTICA** por Authorization Bypass.
   - `2.2 Credential Management`: PASA.
   - `2.3 Least Privilege`: **FALLA** (El proceso Node corre con permisos amplios del usuario host).
3. **Background Persistence Control:**
   - `3.1 / 3.2 Lifecycle Management & Cleanup`: **ADVERTENCIA** (Faltan capturas de `SIGINT`/`SIGTERM`).
4. **Deployment & Runtime Security:**
   - `4.1 / 4.2 Isolation & Containers`: **FALLA** (Falta contenedor/sandbox para acotar radio de blast de lectura).
   - `4.3 Environment Security`: PASA.
5. **Code & Data Integrity:**
   - `5.1 Verification`: ADVERTENCIA.
6. **Supply Chain Security:**
   - `6.1 Dependency Management`: PASA.
   - `6.2 Package Integrity`: ADVERTENCIA.
7. **Monitoring & Logging:**
   - **FALLA** completa por la ausencia de un Audit Log que registre quién y cuándo borró la DB ficticia.
8. **Isolation:**
   - **FALLA** en límites de memoria/recursos por proceso.
9. **Data Security & Privacy:**
   - `Minimización de datos en respuestas`: ADVERTENCIA en `leer_registro_sistema` (sin truncamiento máximo).
10. **Resources Security:**
    - PASA (el recurso estático `lab://project-info` no expone vectores).
11. **Tools Security:**
    - ADVERTENCIA general por falta de marcadores del SDK como `destructiveHint` en `borrar_base_datos_clientes`.
12. **Client / Host Security:**
    - N/A (Fuera de alcance del lado del servidor).
13. **LLM Security:**
    - `Prompt injection vía tool output`: ADVERTENCIA teórica en Path Traversal.
14. **Multi-MCP / Crypto:**
    - N/A para conexiones locales via stdio.

### Tabla Resumen de Hallazgos
Resultando en la identificación de 12 puntos clave de mejora:

| ID | Categoría SlowMist | Severidad | Tool Afectada | Hallazgo |
|---|---|---|---|---|
| H-01 | Input Validation (1.1) | 🔴 CRÍTICO | `leer_registro_sistema` | Path Traversal / Arbitrary File Read: ruta de archivo no restringida |
| H-02 | Access Control (2.1) | 🔴 CRÍTICO | `borrar_base_datos_clientes` | Authorization Bypass: rol decidido por el cliente |
| H-03 | Input Validation (1.1) | 🔴 CRÍTICO | `diagnostico_servidor` | Injection: host concatenado sin sanitizar, separadores de shell interpretados |
| H-04 | API Rate Limiting (1.2) | 🟡 MEDIO | Todas | Sin límite de invocaciones por cliente |
| H-05 | Output Encoding (1.3) | 🟡 MEDIO | `leer_registro_sistema` | Contenido de archivo retornado sin sanitizar |
| H-06 | Least Privilege (2.3) | 🟡 MEDIO | Servidor completo | Proceso sin sandbox ni restricción de permisos |
| H-07 | Isolation Environment (4.1) | 🟡 MEDIO | Servidor completo | Sin contenedor ni aislamiento de runtime |
| H-08 | Monitoring & Logging (7) | 🟡 MEDIO | Servidor completo | Sin audit logging de llamadas a tools |
| H-09 | Isolation (8) | 🟡 MEDIO | Servidor completo | Sin aislamiento de proceso ni límites de recursos |
| H-10 | Data Security (9) | 🟢 BAJO | `leer_registro_sistema` | Respuesta sin límite de tamaño (minimización de datos incompleta) |
| H-11 | Tools Security (11) | 🟢 BAJO | `borrar_base_datos_clientes` | Sin anotaciones `destructiveHint` en tools destructivas |
| H-12 | Lifecycle Management (3.1) | 🟢 BAJO | Servidor completo | Sin handlers explícitos de shutdown |

---

## 7. Fase 8 — Guion Completo de Demostración

Se preparó el script oficial de demo (ubicado en `demo/guion-demo-fase8.md`), delineando paso a paso cómo presentar los fallos usando el Inspector de MCP.

### Guion y Ejecución Detallada

#### Configuración de Inicio:
```bash
npx @modelcontextprotocol/inspector tsx apps/mcp-lab/src/vulnerable/index.ts
```

#### Demo 1: Authorization Bypass
1. **Control Benigno (Payload):** `{"rol_usuario": "user", "confirmacion": true}`
   - *Resultado:* El servidor rechaza la acción con un mensaje de permisos denegados.
2. **Ataque (Payload):** `{"rol_usuario": "admin", "confirmacion": true}`
   - *Resultado:* ¡ÉXITO (Vulnerabilidad)! Base de datos borrada satisfactoriamente.
   - *Explicación sugerida:* "El servidor no posee un token de sesión real, sino que ciegamente confía en la identidad autodeclarada en el payload JSON. Cualquiera puede ser admin manipulando el parámetro."

#### Demo 2: Path Traversal
1. **Control Benigno (Payload):** `{"ruta_archivo": "sistema.log"}`
   - *Resultado:* Devuelve los 10 logs de nuestro fixture benigno.
2. **Ataque (Payload):** `{"ruta_archivo": "../private/secreto-ficticio.txt"}`
   - *Resultado:* Exposición de archivo `secreto-ficticio.txt`.
   - *Explicación sugerida:* "La concatenación mediante `path.join` permite el uso de `../` saltando hacia atrás en la jerarquía del servidor, escapando del supuesto entorno confinado de `logs/`".

#### Demo 3: Command Injection Simulada
1. **Control Benigno (Payload):** `{"host": "127.0.0.1"}`
   - *Resultado:* PING normal ejecutado sin detección de inyección.
2. **Ataque (Payload):** `{"host": "127.0.0.1; whoami"}`
   - *Resultado:* Salida concatenada del PING y de la ejecución de `usuario-ficticio-lab`.
   - *Explicación sugerida:* "El servidor recibe la línea y en vez de parametrizar el input, concatena. El separador de shell (punto y coma) hace que todo lo que siga sea tratado como un segundo comando arbitrario, logrando inyección directa."

---

## 8. Futuros Pasos (Fases 9 a 16) — Guía de Implementación

Siguiendo el "Plan de Implementación Completo" entregado, el trabajo restante abarca las siguientes fases:

### Fase 9 — Construir Mitigaciones en `secure/index.ts`
*   **Acción Requerida:** Sustituir el esqueleto actual en `apps/mcp-lab/src/secure/index.ts` por el código mitigado para las tres vulnerabilidades principales.
*   **Detalle Mitigaciones:**
    1.  **Authz Bypass:** Remover `rol_usuario` del input del cliente. Utilizar un contexto (mock de sesión segura) gestionado única y exclusivamente por el servidor.
    2.  **Path Traversal:** Usar `path.resolve` y una comprobación booleana estricta con `.startsWith()` para obligar que cualquier ruta final sea hija legítima del directorio `fixtures/logs/`.
    3.  **Injection:** Implementar validación de input con una expresión regular severa (`HOST_VALIDO = /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9.-]+$/`) rechazando separadores antes de la concatenación.

### Fase 10 — Automatización / Prueba "BEFORE & AFTER"
*   **Acción Requerida:** Iniciar `npm run dev:secure` en el Inspector.
*   **Tarea:** Repetir los mismos 3 ataques (Payloads maliciosos de la Fase 8) y corroborar y documentar cómo ahora resultan en errores controlados y mitigados (Denegado / Rechazado).
*   **Entregable:** Matriz comparativa "BEFORE/AFTER" para la presentación.

### Fase 11 — Recolección Final de Evidencias
*   **Acción Requerida:** Recopilar capturas de pantalla de los Inspector Runs (Fase 3, 8 y 10).
*   **Política de Seguridad Estricta:** Validar que ninguna captura haya sido insertada en el repositorio git; mantener la carpeta de capturas de la evidencia final fuera de control de versiones o listada en el `.gitignore`.

### Fase 12 — Elaboración de la Taxonomía de Riesgos
*   **Acción Requerida:** Crear un nuevo documento Markdown (`audit/risk-taxonomy.md`) basándose directamente en la salida completa de Cisco (ej: `AITech-9.1`) y los hallazgos de SlowMist (Ej: H-02, H-08).
*   **Contenido:** Las vulnerabilidades explotadas vs las documentadas como "riesgo futuro" en el laboratorio.

### Fase 13 — Informe Técnico Consolidado
*   **Acción Requerida:** Unificar la estructura de documentación en un reporte final (Introducción, Arquitectura, Metodología [Cisco + SlowMist], Pruebas Before/After, Taxonomía).
*   **Actualización del README:** Explicar claramente el propósito del repo, las ramas `vulnerable` y `secure` y cómo correr los laboratorios.

### Fase 14 y 15 — Presentación PPT y Video de Backup
*   **Fase 14:** Desarrollar 10-12 diapositivas PPT extrayendo la tabla consolidada, las arquitecturas y los diagramas de demostración de los payloads BEFORE/AFTER.
*   **Fase 15:** Grabar el video "backup" de 5 a 8 minutos mostrando la demostración fluida en caso de caída o error al mostrar el Inspector en vivo en clase.

### Fase 16 — Checklist de Ensayo Final
*   **Acción Requerida:** Auditar el proyecto entero contra la rúbrica del docente. 
*   **Defensa Académica:** Prepararse para preguntas de justificación de diseño (Ej: "Por qué Cisco Scanner falló en ver la vulnerabilidad del Bypass de Autorización" -> "Porque la lógica comercial no es deducible solo estáticamente sin modelar el comportamiento funcional"). Verificar el historial limpio de git.
