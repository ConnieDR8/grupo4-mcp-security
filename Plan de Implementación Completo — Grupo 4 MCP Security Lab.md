# Plan de Implementación Completo — Grupo 4 MCP Security Lab

Oct 4, 2026 · @Rodrigo

## Resumen ejecutivo

El código actual cubre bien Authorization Bypass y Path Traversal (Fase 5), pero la Injection sigue siendo ejecución real de comandos (`exec()`), lo cual contradice la ética del laboratorio. Este plan corrige eso con una injection simulada, completa los fixtures y el servidor `secure/` (Fase 4 y 9), termina el checklist SlowMist punto por punto (Fase 7), y deja instrucciones concretas para las Fases 10 a 16.

| Fase | Estado actual | Acción principal en este plan |
| --- | --- | --- |
| 3 | 🟡 | Validar con Inspector, correr `typecheck`, crear `tsconfig.json` |
| 4 | 🟡 | Completar `fixtures/logs/sistema.log`, crear esqueleto `secure/index.ts` |
| 5 | 🟡 | Reemplazar `exec()` real por injection simulada e inocua |
| 6 | ✅ | Corregir texto del informe sobre el alcance del escaneo Cisco |
| 7 | ❌ | Completar las 14 secciones del checklist SlowMist, formato completo |
| 8 | ❌ | Script de demo para las 3 vulnerabilidades |
| 9 | ❌ | Construir `secure/index.ts` con las 3 mitigaciones |
| 10 | ❌ | Script BEFORE/AFTER automatizado |
| 11 | 🟡 | Checklist de evidencias, sin subir capturas al repo |
| 12 | ❌ | `audit/risk-taxonomy.md` con 10 riesgos |
| 13 | 🟡 | Estructura actualizada del informe técnico |
| 14 | ❌ | Esqueleto de la presentación (10–12 slides) |
| 15 | 🟡 | Guion del video final |
| 16 | ❌ | Checklist de ensayo y preguntas esperadas |

El orden recomendado de trabajo real es: Fase 5 (injection) → Fase 4 (fixtures/secure) → Fase 3 (typecheck/Inspector) → Fase 9 (mitigaciones) → Fase 10 (before/after) → Fase 6 y 7 (auditoría) → Fase 8 (demo) → Fase 11–16 (entrega).

## Fase 3 — Cerrar Tools, Resource, Prompt

Falta `tsconfig.json`, sin el cual `npm run typecheck` fallará aunque el código esté bien escrito.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist"
  },
  "include": ["apps/mcp-lab/src/**/*.ts"]
}
```

**Pasos:**

1. Crear el `tsconfig.json` de arriba en la raíz del repo.
2. Correr `npm run typecheck`. Si falla por `exactOptionalPropertyTypes` o similar en zod, ajustar según el error exacto (no desactivar `strict`).
3. Abrir el Inspector: `npx @modelcontextprotocol/inspector tsx apps/mcp-lab/src/vulnerable/index.ts`.
4. En el Inspector, probar el Resource `lab://project-info` y confirmar que devuelve el JSON de `LAB_INFO`.
5. Probar el Prompt `explicar-componente-mcp` con cada valor del enum (`Host`, `Client`, `Server`, `Transport`, `Tool`, `Resource`, `Prompt`) y confirmar que genera el mensaje esperado.
6. 📸 Capturar: el árbol de tools/resource/prompt en el Inspector, la respuesta del Resource, y una respuesta del Prompt.
7. No tocar el README todavía, como ya decidiste — se actualiza una sola vez al final (Fase 13).

## Fase 4 — Asegurar el laboratorio

Falta el log de logs y el esqueleto `secure/`, aunque `package.json` ya referencia `dev:secure`.

**`apps/mcp-lab/fixtures/logs/sistema.log`** (dato ficticio, nada real):

```text
[2026-10-01 08:12:03] INFO  sistema iniciado correctamente
[2026-10-01 08:14:51] INFO  usuario-ficticio-01 inició sesión
[2026-10-01 09:02:10] WARN  intento de acceso a recurso restringido (bloqueado)
[2026-10-01 10:45:22] INFO  tarea programada 'backup-nocturno' completada
[2026-10-01 11:30:00] ERROR conexión perdida con servicio-ficticio-pagos (timeout)
```

**Separación vulnerable/secure.** Crear `apps/mcp-lab/src/secure/index.ts` como copia reservada (no vacío, porque `npm run dev:secure` fallaría). Puede ser por ahora solo la tool `saludar` + un comentario marcando que las tres mitigaciones llegan en la Fase 9:

```typescript
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

// Fase 9: aquí se añadirán las versiones mitigadas de
// borrar_base_datos_clientes, leer_registro_sistema y diagnostico_servidor.

const server = new McpServer({ name: 'grupo4-mcp-lab-secure', version: '0.1.0' });

server.registerTool(
  'saludar',
  {
    description: 'Devuelve un saludo local (versión segura, sin cambios respecto a vulnerable).',
    inputSchema: z.object({ nombre: z.string().trim().min(1).max(60) }),
  },
  async ({ nombre }) => ({
    content: [{ type: 'text', text: `Hola, ${nombre}. Servidor seguro en construcción (Fase 9).` }],
  }),
);

void serveStdio(() => server);
console.error('grupo4-mcp-lab-secure ejecutándose mediante stdio.');
```

**Checklist de la fase:**

- [ ] `fixtures/logs/sistema.log` creado (arriba)
- [ ] `fixtures/private/secreto-ficticio.txt` ya existe — no tocar
- [ ] `src/secure/index.ts` creado como esqueleto
- [ ] `npm run dev:secure` corre sin error
- [ ] Confirmar que ningún fixture referencia rutas reales del sistema (`/etc`, `.env`, credenciales)

## Fase 5 — Corregir las vulnerabilidades

### Vulnerabilidad 1: Authorization Bypass — se conserva tal cual

Ya está bien implementada en `borrar_base_datos_clientes`: el servidor confía en `rol_usuario` enviado por el cliente. No requiere cambios de código, solo la demo (Fase 8) y la mitigación (Fase 9).

### Vulnerabilidad 2: Path Traversal — se conserva, aclarar el nombre

Ya funciona con `fixtures/logs/` + `../private/secreto-ficticio.txt`. Un único cambio recomendado: hacer la ruta base independiente de `process.cwd()` para que funcione sin importar desde dónde se ejecute el proceso.

```typescript
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const directorioBase = path.join(__dirname, '..', '..', 'fixtures', 'logs');
```

Renombrar la vulnerabilidad en todos los documentos como **"Path Traversal / Arbitrary File Read"**, nunca "Command Injection" — el código actual nunca ejecuta nada, solo lee archivos.

### Vulnerabilidad 3: Injection — reemplazar `exec()` real por una simulación inocua

**Problema del código actual:** `diagnostico_servidor` ejecuta `exec(comando)` con el texto del usuario tal cual. Esto es ejecución real y arbitraria de comandos en la máquina — contradice directamente la ética del laboratorio ("la prueba NO será ejecutar comandos reales"). Reemplazar completamente por esta versión, que concatena sin sanitizar (ahí está la vulnerabilidad real: inyección de separadores de shell) pero nunca llama a un proceso del sistema operativo:

```typescript
// VULNERABILIDAD 3: Injection (simulada, sin ejecución real de procesos)
const RESPUESTAS_SIMULADAS: Record<string, string> = {
  whoami: 'usuario-ficticio-lab',
  'cat secreto-ficticio.txt': '[contenido ficticio: ver fixtures/private/secreto-ficticio.txt]',
  id: 'uid=1000(usuario-ficticio) gid=1000(lab)',
};

function pingSimulado(host: string): string {
  return `PING ${host}: 1 paquete transmitido, 1 recibido, 0% packet loss (simulado)`;
}

server.registerTool(
  'diagnostico_servidor',
  {
    description:
      '[VULNERABLE] Ejecuta un diagnóstico de red (ping simulado) a partir del host indicado.',
    inputSchema: z.object({
      host: z.string().describe('Host o IP a diagnosticar (ej. "127.0.0.1")'),
    }),
  },
  async ({ host }) => {
    // VULNERABILIDAD: se concatena 'host' sin validar ni sanitizar antes de
    // "ejecutar" la línea. En producción esto sería exec(`ping -c 1 ${host}`);
    // aquí lo interpretamos con un shell simulado, sin tocar el sistema real.
    const linea = `ping -c 1 ${host}`;
    const partes = linea.split(/;|&&|\|/).map((p) => p.trim());

    const salida = partes.map((parte) => {
      if (parte.startsWith('ping')) {
        const objetivo = parte.replace('ping -c 1 ', '').trim();
        return pingSimulado(objetivo);
      }
      return RESPUESTAS_SIMULADAS[parte] ?? `sh: ${parte}: comando no encontrado (simulado)`;
    });

    const huboInyeccion = partes.length > 1;
    return {
      content: [
        {
          type: 'text',
          text:
            (huboInyeccion
              ? 'Diagnóstico ejecutado con comandos encadenados (Vulnerabilidad Injection lograda, simulada):\n\n'
              : 'Diagnóstico ejecutado (sin inyección detectada en este input):\n\n') + salida.join('\n'),
        },
      ],
    };
  },
);
```

**Payload de demo:** `host = "127.0.0.1; whoami"` → el resultado muestra el ping simulado y además `usuario-ficticio-01`, demostrando que el separador `;` fue interpretado como un segundo comando. Ningún proceso real se ejecuta en ningún momento.

**Pendiente de código:** eliminar el `import { exec } from 'child_process'` del archivo — ya no se usa y un auditor (o Cisco Scanner) lo marcaría como riesgo aunque esté sin usar.

## Fase 6 — Cisco MCP Scanner

Esta fase ya está prácticamente completa; solo corregir interpretaciones en el informe:

1. **Target del escaneo:** aclarar explícitamente en el informe que el target por defecto `mcp.deepwiki.com` que aparece en el resultado NO es el servidor del laboratorio — es el target por defecto de la herramienta cuando no se le apunta a nada específico. Documentar el comando exacto usado para escanear el proyecto propio.
2. **Alcance real del análisis:** corregir cualquier frase tipo "Cisco detectó directamente el AST de nuestro TypeScript". La ejecución fue estática contra `evidence/tools-definition.json` (un JSON con las definiciones de las tools), no contra el código TypeScript. Especificar esto en el informe técnico (Fase 13) y en la comparación del SlowMist (Fase 7).
3. **Volver a escanear tras la Fase 5:** una vez agregada `diagnostico_servidor` con contenido real, regenerar `evidence/tools-definition.json` con las 3 tools vulnerables + `saludar`, y volver a correr Cisco Scanner para capturar el resultado actualizado (probablemente detecte patrones de "command injection" por las palabras `ping`, `sh:`, etc. en la descripción/código simulado — documentar si el detector dispara con contenido simulado o no).
4. 📸 Capturar el nuevo resultado de Cisco Scanner con las 4 tools.

## Fase 7 — Checklist SlowMist completo

El informe actual (`audit/slowmist-report.md`) ya cubre bien API Security, Authentication & Authorization, parte de Deployment & Runtime, Code & Data Integrity y Supply Chain. Faltan 9 secciones del checklist oficial. Para cada control usar siempre el formato: **Control → ¿Aplica? → Estado → Evidencia → Justificación → Hallazgo → Mitigación**. Lo que no aplique al laboratorio va como **N/A con justificación**, nunca se omite.

Antes de completar, corregir en el texto existente: (a) la vulnerabilidad de `leer_registro_sistema` se llama *Path Traversal / Arbitrary File Read*, no "Path Traversal/Injection"; (b) el enlace al código roto apunta a `apps/mcp-lab/src/index.ts`, debe ser `apps/mcp-lab/src/vulnerable/index.ts`; (c) no es cierto que se "permitan rutas absolutas" — con `path.join(base, input)` una ruta como `/etc/passwd` queda anidada dentro de `base`; lo que sí escapa es `../`.

### 7. Monitoring & Logging

| Control | ¿Aplica? | Estado | Evidencia | Justificación / Hallazgo | Mitigación |
| --- | --- | --- | --- | --- | --- |
| Audit logging de llamadas a tools | Sí | ❌ FALLA | Código fuente | No existe ningún registro de qué tool fue invocada, con qué parámetros ni por quién. Imposible detectar el Authorization Bypass después del hecho. | Fase 9: middleware que registra tool, timestamp, parámetros (sin datos sensibles) antes de ejecutar el handler. |
| Alertas ante patrones anómalos | Sí | ❌ FALLA | Código fuente | Sin logging, tampoco hay alertas posibles. | Fuera de alcance del laboratorio académico; documentar como trabajo futuro. |
| Logs protegidos contra manipulación | Sí | N/A | — | No aplica aún: no existen logs que proteger (ver control anterior). | — |

### 8. Isolation

| Control | ¿Aplica? | Estado | Evidencia | Justificación / Hallazgo | Mitigación |
| --- | --- | --- | --- | --- | --- |
| Aislamiento de procesos (sandbox/VM/contenedor) | Sí | ❌ FALLA | `package.json`, ausencia de Dockerfile | El servidor corre directo sobre el host con los permisos del usuario del sistema operativo. Agrava el impacto del Path Traversal. | Fase 9: documentar cómo un `Dockerfile` con usuario no-root limitaría el radio de impacto (no implementado por alcance académico). |
| Límite de recursos (CPU/memoria) | Sí | ❌ FALLA | Código fuente | No hay límites de memoria/CPU configurados para el proceso Node. | Documentar como mejora futura (cgroups o límites de contenedor). |

### 9. Data Security & Privacy

| Control | ¿Aplica? | Estado | Evidencia | Justificación / Hallazgo | Mitigación |
| --- | --- | --- | --- | --- | --- |
| Datos sensibles no se envían a terceros sin consentimiento | Sí | ✅ PASA | Código fuente | El servidor es local (stdio), no transmite datos a servicios externos. | — |
| Datos de prueba no contienen información real | Sí | ✅ PASA | `fixtures/` | `secreto-ficticio.txt` y `sistema.log` son completamente ficticios, como exige la ética del proyecto. | — |
| Minimización de datos en respuestas | Sí | ⚠️ PARCIAL | Código fuente | `leer_registro_sistema` devuelve el contenido completo del archivo sin redacción ni límite de tamaño. | Fase 9: limitar tamaño de respuesta y aplicar allowlist de archivos legibles. |

### 10. Resources Security

| Control | ¿Aplica? | Estado | Evidencia | Justificación / Hallazgo | Mitigación |
| --- | --- | --- | --- | --- | --- |
| El URI del resource no expone rutas internas explotables | Sí | ✅ PASA | Código fuente | `lab://project-info` es un URI estático sin parámetros controlados por el cliente; no hay superficie de ataque. | — |
| El resource no filtra datos sensibles | Sí | ✅ PASA | Código fuente | `LAB_INFO` solo contiene metadatos no sensibles del proyecto. | — |

### 11. Tools Security

| Control | ¿Aplica? | Estado | Evidencia | Justificación / Hallazgo | Mitigación |
| --- | --- | --- | --- | --- | --- |
| Las descripciones de tools no inducen a uso inseguro (tool poisoning) | Sí | ⚠️ PARCIAL | Código fuente | Las descripciones usan el prefijo `[VULNERABLE]`, lo cual es correcto para un laboratorio, pero en un servidor de producción una descripción así sería una señal de alerta para cualquier cliente MCP o LLM. | Documentar en el informe que el prefijo es intencional y pedagógico, no un patrón recomendado. |
| Cada tool declara con precisión su efecto (side effects) | Sí | ⚠️ PARCIAL | Código fuente | Ninguna tool usa anotaciones de side effects del SDK (p. ej. `destructiveHint`) para `borrar_base_datos_clientes`, que sí es destructiva. | Fase 9: añadir anotaciones de hints en las definiciones de tools. |

### 12. Client / Host Security

| Control | ¿Aplica? | Estado | Evidencia | Justificación / Hallazgo | Mitigación |
| --- | --- | --- | --- | --- | --- |
| El host valida el servidor MCP antes de conectar | No aplica al servidor | N/A | — | Este control es responsabilidad del cliente/host (Inspector, Claude Desktop, etc.), no del código del servidor auditado. Fuera del alcance de este proyecto. | — |
| El host pide confirmación antes de ejecutar tools destructivas | No aplica al servidor | N/A | — | Mismo motivo: depende del comportamiento del Inspector o del host MCP usado, no del código del Grupo 4. | — |

### 13. LLM Security

| Control | ¿Aplica? | Estado | Evidencia | Justificación / Hallazgo | Mitigación |
| --- | --- | --- | --- | --- | --- |
| Prompt injection vía resultados de tools | Sí | ⚠️ PARCIAL | Código fuente | `leer_registro_sistema` devuelve contenido de archivo sin sanitizar hacia el LLM que consuma el resultado; un archivo ficticio con texto tipo "ignora instrucciones anteriores" podría probarse como extensión opcional. | No implementado en el alcance actual; documentar como vector relacionado pero no demostrado. |
| El prompt del Prompt registrado no es manipulable por el cliente de forma insegura | Sí | ✅ PASA | Código fuente | `explicar-componente-mcp` usa un `enum` cerrado (`MCP_COMPONENTS`), el cliente no puede inyectar texto libre en el prompt generado. | — |

### 14. Multi-MCP / Crypto

| Control | ¿Aplica? | Estado | Evidencia | Justificación / Hallazgo | Mitigación |
| --- | --- | --- | --- | --- | --- |
| Aislamiento entre múltiples servidores MCP conectados al mismo host | No aplica | N/A | — | El laboratorio expone un único servidor MCP vía stdio; no hay escenario multi-servidor que auditar. | — |
| Uso de criptografía para proteger datos en tránsito o en reposo | No aplica | N/A | — | El transporte es stdio local (proceso a proceso, sin red); no hay datos en tránsito que cifrar ni almacenamiento persistente de secretos. | — |

**Después de completar las 9 secciones:** agregar las filas nuevas (H-08 Monitoring, H-09 Isolation, H-10 Data minimization, H-11 Tools hints) a la tabla "Resumen Ejecutivo de Hallazgos" que ya existe en `slowmist-report.md`, manteniendo el mismo formato de columnas.

## Fase 8 — Demostrar las vulnerabilidades

Usar el Inspector (`npx @modelcontextprotocol/inspector tsx apps/mcp-lab/src/vulnerable/index.ts`) para las tres demos. Guardar una captura por cada paso marcado 📸.

| # | Vulnerabilidad | Payload | Resultado esperado | Evidencia |
| --- | --- | --- | --- | --- |
| 1 | Authz — denegado | `borrar_base_datos_clientes({ rol_usuario: "user", confirmacion: true })` | Error de autorización | 📸 |
| 2 | Authz — bypass | `borrar_base_datos_clientes({ rol_usuario: "admin", confirmacion: true })` | "¡ÉXITO (Vulnerabilidad)!..." | 📸 |
| 3 | Path Traversal — caso normal | `leer_registro_sistema({ ruta_archivo: "sistema.log" })` | Contenido del log ficticio | 📸 |
| 4 | Path Traversal — escape | `leer_registro_sistema({ ruta_archivo: "../private/secreto-ficticio.txt" })` | Contenido del secreto ficticio, fuera del directorio permitido | 📸 |
| 5 | Injection — comando simple | `diagnostico_servidor({ host: "127.0.0.1" })` | Solo el ping simulado, sin inyección | 📸 |
| 6 | Injection — comando encadenado | `diagnostico_servidor({ host: "127.0.0.1; whoami" })` | Ping simulado + salida de `whoami` simulada, demostrando que el separador `;` fue interpretado | 📸 |

**Guion de narración sugerido para cada vulnerabilidad (útil también para la Fase 14 y 15):**

1. Mostrar el código vulnerable (una línea clave resaltada).
2. Ejecutar el payload "seguro" (resultado esperado/benigno).
3. Ejecutar el payload malicioso y señalar en pantalla qué cambió.
4. Explicar en una frase por qué pasa (quién confía en qué dato que no debería).

> Recordatorio: las capturas van al informe/documento, nunca al repositorio.

## Fase 9 — Mitigaciones (versión segura)

Reemplazar el contenido de `apps/mcp-lab/src/secure/index.ts` (el esqueleto de la Fase 4) por esta versión completa. Las tres mitigaciones, explicadas:

- **Authz:** el servidor deja de leer `rol_usuario` del payload del cliente y en su lugar usa una sesión simulada fija en el servidor (`SESION_SERVIDOR`), representando lo que en producción sería un token validado por el backend.
- **Path Traversal:** se normaliza la ruta resultante con `path.resolve` y se verifica con `startsWith` que sigue dentro del directorio base antes de leer.
- **Injection:** se elimina la concatenación de shell; el host se valida contra un patrón estricto de IPv4/hostname antes de aceptar cualquier input.

```typescript
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_NAME = 'grupo4-mcp-lab-secure';
const SERVER_VERSION = '0.1.0';

// MITIGACIÓN Authz: el rol NUNCA viene del cliente. En un caso real esto
// saldría de un token de sesión validado por el servidor (p. ej. JWT verificado
// contra una base de usuarios). Aquí se simula con una constante de servidor.
const SESION_SERVIDOR = { usuario: 'usuario-ficticio-01', rol: 'user' as const };

function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    'saludar',
    {
      description: 'Devuelve un saludo local para comprobar el funcionamiento del laboratorio MCP.',
      inputSchema: z.object({ nombre: z.string().trim().min(1).max(60) }),
    },
    async ({ nombre }) => ({
      content: [{ type: 'text', text: `Hola, ${nombre}. Servidor MCP seguro del Grupo 4.` }],
    }),
  );

  // MITIGACIÓN 1: Authorization Bypass
  server.registerTool(
    'borrar_base_datos_clientes',
    {
      description: 'Elimina todos los registros de clientes. Solo para administradores.',
      inputSchema: z.object({ confirmacion: z.boolean() }),
    },
    async ({ confirmacion }) => {
      // El rol se determina en el servidor, no se acepta del cliente.
      if (SESION_SERVIDOR.rol !== 'admin') {
        return {
          content: [{ type: 'text', text: `Acceso denegado: el usuario '${SESION_SERVIDOR.usuario}' no tiene rol admin.` }],
          isError: true,
        };
      }
      if (!confirmacion) {
        return { content: [{ type: 'text', text: 'Operación cancelada: falta confirmación.' }] };
      }
      return { content: [{ type: 'text', text: 'Base de datos borrada (autorización verificada en servidor).' }] };
    },
  );

  // MITIGACIÓN 2: Path Traversal
  server.registerTool(
    'leer_registro_sistema',
    {
      description: 'Lee un archivo de registro del sistema dentro del directorio permitido.',
      inputSchema: z.object({ ruta_archivo: z.string().min(1).max(100) }),
    },
    async ({ ruta_archivo }) => {
      const directorioBase = path.resolve(__dirname, '..', '..', 'fixtures', 'logs');
      const rutaFinal = path.resolve(directorioBase, ruta_archivo);

      // Verificación: la ruta resuelta debe seguir dentro del directorio base.
      if (!rutaFinal.startsWith(directorioBase + path.sep)) {
        return {
          content: [{ type: 'text', text: 'Acceso denegado: ruta fuera del directorio permitido.' }],
          isError: true,
        };
      }
      try {
        const contenido = fs.readFileSync(rutaFinal, 'utf-8');
        return { content: [{ type: 'text', text: contenido.slice(0, 2000) }] };
      } catch {
        return { content: [{ type: 'text', text: 'No se pudo leer el archivo solicitado.' }], isError: true };
      }
    },
  );

  // MITIGACIÓN 3: Injection
  const HOST_VALIDO = /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9.-]+$/;
  server.registerTool(
    'diagnostico_servidor',
    {
      description: 'Ejecuta un diagnóstico de red (ping simulado) a un host validado.',
      inputSchema: z.object({ host: z.string().min(1).max(50) }),
    },
    async ({ host }) => {
      if (!HOST_VALIDO.test(host)) {
        return {
          content: [{ type: 'text', text: `Host inválido: '${host}'. Solo se permiten IPs o hostnames simples.` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text', text: `PING ${host}: 1 paquete transmitido, 1 recibido, 0% packet loss (simulado)` }] };
    },
  );

  return server;
}

void serveStdio(createServer);
console.error(`${SERVER_NAME} v${SERVER_VERSION} ejecutándose mediante stdio.`);
```

**Pasos:**

1. Reemplazar el esqueleto de `src/secure/index.ts` por este código completo.
2. Copiar también el Resource (`lab://project-info`) y el Prompt (`explicar-componente-mcp`) de la Fase 3 sin cambios — no tienen vulnerabilidades que mitigar.
3. Correr `npm run typecheck` de nuevo.
4. Probar en Inspector los mismos 6 payloads de la Fase 8 contra `secure/` y confirmar que los 3 ataques ahora fallan de forma controlada (no con un crash).

## Fase 10 — Repetir pruebas (BEFORE / AFTER)

Repetir exactamente los 6 payloads de la Fase 8, ahora contra `secure/` (`npm run dev:secure`), y documentar lado a lado:

| # | Payload | `vulnerable/` (BEFORE) | `secure/` (AFTER) |
| --- | --- | --- | --- |
| 1 | `rol_usuario: "admin"` sin validación real | ✅ Borra la BD | ❌ Denegado (rol fijado en servidor = `user`) |
| 2 | `ruta_archivo: "../private/secreto-ficticio.txt"` | ✅ Lee el secreto | ❌ Denegado (ruta fuera del directorio base) |
| 3 | `host: "127.0.0.1; whoami"` | ✅ Ejecuta el comando encadenado | ❌ Rechazado (no cumple `HOST_VALIDO`) |

Guardar esta tabla en `audit/before-after.md` con una captura por fila (6 en total: 3 BEFORE ya tomadas en Fase 8 + 3 AFTER nuevas). Esta tabla es la evidencia central de que las mitigaciones funcionan y alimenta directamente la Fase 13 (informe) y la Fase 14 (presentación).

## Fase 11 — Evidencias

Checklist de capturas a reunir (todas van al informe/documento, **ninguna al repositorio**):

- [ ] Fase 3: árbol Inspector, respuesta Resource, respuesta Prompt (×7 valores del enum, al menos 2 capturas representativas)
- [ ] Fase 6: resultado Cisco Scanner actualizado con 4 tools
- [ ] Fase 8: 6 capturas (payloads #1–6)
- [ ] Fase 10: 3 capturas AFTER adicionales
- [ ] Fase 15: grabación de pantalla del video backup

Organizar en una carpeta local `evidencias-informe/` (fuera del repo o en `.gitignore`) con subcarpetas `fase3/`, `fase6/`, `fase8/`, `fase10/`. Nombrar los archivos de forma descriptiva: `fase8-payload2-authz-bypass.png`.

## Fase 12 — Taxonomía de 10 riesgos

Crear `audit/risk-taxonomy.md`. Usar como base la taxonomía MCP vista en el escaneo de Cisco (`AITech-9.1` etc.) y el propio SlowMist checklist. Diez riesgos mínimos a incluir, cada uno con: nombre, descripción, tool/componente afectado, severidad, y si fue demostrado o es teórico:

| # | Riesgo | Demostrado | Componente |
| --- | --- | --- | --- |
| 1 | Authorization Bypass (confianza en datos del cliente) | ✅ Sí | `borrar_base_datos_clientes` |
| 2 | Path Traversal / Arbitrary File Read | ✅ Sí | `leer_registro_sistema` |
| 3 | Command/Shell Injection | ✅ Sí (simulado) | `diagnostico_servidor` |
| 4 | Ausencia de rate limiting | ⚠️ Documentado, no explotado | Todas las tools |
| 5 | Ausencia de audit logging | ⚠️ Documentado, no explotado | Servidor completo |
| 6 | Falta de aislamiento de proceso (sin sandbox) | ⚠️ Documentado, no explotado | Servidor completo |
| 7 | Tool poisoning / descripciones engañosas | ⚠️ Teórico | Definición de tools |
| 8 | Prompt injection vía resultado de tool | ⚠️ Teórico, no demostrado | `leer_registro_sistema` |
| 9 | Falta de anotaciones de side-effects (`destructiveHint`) | ⚠️ Documentado | `borrar_base_datos_clientes` |
| 10 | Ausencia de límites de tamaño de respuesta | ⚠️ Documentado, mitigado parcialmente en `secure/` | `leer_registro_sistema` |

Para cada fila, expandir en el `.md` con 2-3 líneas de descripción + referencia cruzada a la sección correspondiente del SlowMist report (Fase 7).

## Fase 13 — Informe técnico

Estructura recomendada para actualizar el borrador existente, en este orden:

1. Introducción y alcance (Fase 1)
2. Arquitectura MCP del laboratorio: Tool/Resource/Prompt (Fase 3)
3. Metodología: Cisco Scanner (estático) + SlowMist checklist (manual) — aclarar que son complementarios, no redundantes (Fase 6)
4. Las tres vulnerabilidades: descripción, código vulnerable, demo BEFORE (Fase 5, 8)
5. Tabla consolidada SlowMist (14 secciones) (Fase 7)
6. Taxonomía de 10 riesgos (Fase 12)
7. Mitigaciones y tabla BEFORE/AFTER (Fase 9, 10)
8. Conclusiones y trabajo futuro (rate limiting, logging, sandboxing — los hallazgos documentados pero no mitigados)
9. Referencias y anexos (enlaces a `slowmist-report.md`, `risk-taxonomy.md`, `cisco-scanner-results.txt`)

Actualizar también el `README.md` del repo en este punto (ya quedó pendiente desde la Fase 3): estructura del proyecto, cómo correr `dev:vulnerable` y `dev:secure`, y un resumen de las 3 vulnerabilidades con enlace al informe.

## Fase 14 — Presentación

Esqueleto de PPT (10-12 slides):

1. Portada (proyecto, grupo, fecha)
2. Objetivo y alcance del laboratorio
3. Arquitectura MCP (Tool/Resource/Prompt/Transport)
4. Metodología de auditoría (Cisco + SlowMist)
5. Vulnerabilidad 1 — Authz Bypass (código + demo)
6. Vulnerabilidad 2 — Path Traversal (código + demo)
7. Vulnerabilidad 3 — Injection (código + demo)
8. Tabla BEFORE/AFTER consolidada
9. Taxonomía de 10 riesgos (resumen visual)
10. Hallazgos SlowMist más relevantes (3-4 destacados, no las 14 secciones completas)
11. Conclusiones y trabajo futuro
12. Preguntas

## Fase 15 — Video backup

Actualizar el video preliminar con: las 3 demos BEFORE/AFTER ya grabadas en Inspector (Fase 10), narración siguiendo el guion de 4 pasos de la Fase 8, duración objetivo 5-8 minutos. Debe poder reemplazar completamente una demo en vivo si falla la conexión o el entorno el día de la presentación.

## Fase 16 — Ensayo y revisión final

- [ ] Repasar la rúbrica del curso punto por punto contra el informe y la presentación
- [ ] Ensayar la demo en vivo cronometrada (objetivo: menos de 4 minutos para las 3 vulnerabilidades)
- [ ] Preparar plan B: si el Inspector falla en vivo, cortar directamente al video de la Fase 15
- [ ] Preguntas esperadas a preparar: por qué la Injection es simulada y no real; por qué Cisco no detectó el Authorization Bypass; diferencia entre `fs.readFileSync` vulnerable y la validación con `startsWith` en `secure/`; qué controles del SlowMist quedaron N/A y por qué
- [ ] Confirmar que ninguna captura ni archivo de evidencia quedó subido al repositorio por error (`git status` limpio)
