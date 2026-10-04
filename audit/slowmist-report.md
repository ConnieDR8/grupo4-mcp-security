# Auditoría de Seguridad MCP — SlowMist Checklist

**Proyecto:** grupo4-mcp-security  
**Servidor auditado:** `grupo4-mcp-lab` v0.1.0  
**Rama auditada:** `lab-vulnerable`  
**Referencia:** [SlowMist MCP-Security-Checklist](https://github.com/slowmist/MCP-Security-Checklist)  
**Fecha:** 2026-10-03  
**Equipo:** Grupo 4  

---

## Contexto

Este reporte aplica el checklist de seguridad MCP publicado por SlowMist sobre el servidor
vulnerable del laboratorio académico del Grupo 4. El objetivo es identificar sistemáticamente
las fallas de seguridad presentes en el servidor de práctica antes de proceder con la
demostración de vulnerabilidades.

El servidor expone tres herramientas MCP:

| Tool | Tipo |
|---|---|
| `saludar` | Baseline sano (referencia) |
| `borrar_base_datos_clientes` | Vulnerable — Authorization Bypass |
| `leer_registro_sistema` | Vulnerable — Path Traversal / Injection |

---

## MCP Server (MCP Plugin) Security

### 1. API Security

#### 1.1 Input Validation `[HIGH]`

> Enforce strict validation on all API inputs to prevent injection attacks and invalid parameters.

| Tool | Resultado | Observación |
|---|---|---|
| `saludar` | ✅ PASA | Validación estricta con Zod: `.string().trim().min(1).max(60)` |
| `borrar_base_datos_clientes` | ⚠️ PARCIAL | Zod valida el tipo del parámetro `rol_usuario` pero no sus valores permitidos. Acepta cualquier cadena de texto arbitraria como rol, incluyendo `"admin"`. |
| `leer_registro_sistema` | ❌ FALLA | El parámetro `ruta_archivo` acepta cualquier cadena sin restricción de directorio base, longitud o caracteres especiales. Permite rutas absolutas y secuencias de escape como `../`. |

**Hallazgo crítico:** La tool `leer_registro_sistema` no valida ni restringe la ruta
proporcionada por el cliente antes de pasarla directamente a `fs.readFileSync()`.
Esto constituye un **Path Traversal** explotable que permite a cualquier cliente MCP
leer archivos arbitrarios del sistema operativo host.

---

#### 1.2 API Rate Limiting `[MEDIUM]`

> Implement call rate limits to prevent abuse or DoS attacks.

| Tool | Resultado | Observación |
|---|---|---|
| Todas | ❌ FALLA | El servidor no implementa ningún mecanismo de rate limiting. Un cliente malicioso puede invocar cualquier herramienta de forma ilimitada. |

---

#### 1.3 Output Encoding `[MEDIUM]`

> Properly encode API outputs.

| Tool | Resultado | Observación |
|---|---|---|
| `saludar` | ✅ PASA | Retorna texto plano inofensivo. |
| `leer_registro_sistema` | ❌ FALLA | Retorna el contenido crudo del archivo sin sanitizar. Si el archivo leído contiene caracteres de control, scripts, o datos sensibles, estos se transmiten sin codificación al cliente MCP. |

---

### 2. Server Authentication & Authorization

#### 2.1 Access Control `[HIGH]`

> Implement role-based access control, limit resource access, and enforce the principle of least privilege.

| Tool | Resultado | Observación |
|---|---|---|
| `borrar_base_datos_clientes` | ❌ FALLA — **CRÍTICO** | El servidor confía ciegamente en el parámetro `rol_usuario` proporcionado por el cliente en el payload JSON. La autorización no se valida en el backend. Un cliente puede declararse `"admin"` enviando `{"rol_usuario": "admin"}` y el servidor ejecutará la acción destructiva sin verificación adicional. Esto es un **Authorization Bypass** directo. |
| `leer_registro_sistema` | ❌ FALLA — **CRÍTICO** | No existe control de acceso sobre qué rutas puede solicitar un cliente. Cualquier cliente autenticado o no puede leer cualquier archivo del sistema. |
| `saludar` | ✅ PASA | No realiza acciones que requieran autorización. |

**Resumen del hallazgo:**  
La verificación de autorización en `borrar_base_datos_clientes` ocurre dentro del
handler de la herramienta usando datos proporcionados por el propio cliente:

```typescript
// CÓDIGO VULNERABLE — el servidor pregunta al cliente quién es
if (rol_usuario !== 'admin') {
  return { isError: true, ... };
}
```

Esto viola el principio fundamental de que **la autorización debe ocurrir en el backend
con información del servidor, nunca confiando en datos enviados por el cliente**.

---

#### 2.2 Credential Management `[HIGH]`

> Securely manage and store service credentials; avoid hard-coded secrets and use key management services.

| Resultado | Observación |
|---|---|
| ✅ PASA | El servidor no contiene credenciales, API keys, tokens ni secretos en el código fuente. Esta es una práctica correcta mantenida desde la Fase 1 del proyecto. |

---

#### 2.3 Least Privilege `[MEDIUM]`

> Run service processes with the minimum required permissions to reduce the potential attack surface.

| Resultado | Observación |
|---|---|
| ❌ FALLA | El proceso Node.js corre con los permisos completos del usuario del sistema operativo. No existe sandboxing, contenedor Docker, ni restricción de permisos de sistema de archivos. La tool `leer_registro_sistema` hereda y explota estos permisos amplios. |

---

### 3. Background Persistence Control

#### 3.1 Lifecycle Management `[HIGH]`

> Implement strict lifecycle management for MCP plugins and coordinate with the client.

| Resultado | Observación |
|---|---|
| ⚠️ PARCIAL | El transporte `stdio` gestiona el ciclo de vida del proceso de forma implícita: el servidor termina cuando termina el proceso host. No existe lógica explícita de cleanup ante señales del sistema operativo (`SIGTERM`, `SIGINT`). |

---

#### 3.2 Shutdown Cleanup `[HIGH]`

> Forcefully clean up all MCP background processes when the client is shut down.

| Resultado | Observación |
|---|---|
| ⚠️ PARCIAL | No se implementan handlers explícitos de cleanup (`process.on('SIGTERM', ...)`) ni liberación controlada de recursos al recibir señal de cierre del cliente. |

---

### 4. Deployment & Runtime Security

#### 4.1 Isolation Environment `[HIGH]`

> Server runs in an isolated environment (container, VM, or sandbox).

| Resultado | Observación |
|---|---|
| ❌ FALLA | El servidor se ejecuta directamente sobre el sistema operativo host sin ningún tipo de aislamiento. No se utiliza Docker, sandbox ni restricción de namespace. Esto agrava el impacto de la vulnerabilidad de Path Traversal: el acceso al sistema de archivos no tiene límites de contenedor. |

---

#### 4.2 Container Security `[HIGH]`

> Adopt hardened container security configurations and run containers as non-root users.

| Resultado | Observación |
|---|---|
| ❌ FALLA (N/A para lab) | El laboratorio no utiliza contenedores. En un entorno de producción, esto sería un riesgo crítico dado que el servidor accede al sistema de archivos sin restricción. |

---

#### 4.3 Environment Variable Security `[MEDIUM]`

> Protect sensitive environment variables and ensure they are not exposed in logs.

| Resultado | Observación |
|---|---|
| ✅ PASA | El servidor no lee ni expone variables de entorno. No hay riesgo de filtración de configuración sensible a través de logs o respuestas de herramientas. |

---

### 5. Code & Data Integrity

#### 5.1 Integrity Verification `[HIGH]`

> Use digital signatures, checksums, or similar to ensure code has not been tampered with.

| Resultado | Observación |
|---|---|
| ⚠️ PARCIAL | El repositorio utiliza Git con historial verificable. No se implementan firmas digitales de artefactos de despliegue. Para un laboratorio académico esto es aceptable; en producción sería insuficiente. |

---

### 6. Supply Chain Security

#### 6.1 Dependency Management `[HIGH]`

> Securely manage third-party dependencies.

| Resultado | Observación |
|---|---|
| ✅ PASA | El proyecto usa `package-lock.json` para fijar versiones exactas de dependencias. Las dependencias son mínimas y justificadas: `@modelcontextprotocol/server`, `zod`, `typescript`, `tsx`, `@types/node`. |

---

#### 6.2 Package Integrity `[HIGH]`

> Verify the integrity and authenticity of packages.

| Resultado | Observación |
|---|---|
| ⚠️ PARCIAL | npm verifica integridad mediante hashes en `package-lock.json`. No se realizó verificación de firmas adicional de los mantenedores de los paquetes. |

---

## Resumen Ejecutivo de Hallazgos

| ID | Categoría SlowMist | Severidad | Tool Afectada | Hallazgo |
|---|---|---|---|---|
| H-01 | Input Validation (1.1) | 🔴 CRÍTICO | `leer_registro_sistema` | Path Traversal: ruta de archivo no restringida |
| H-02 | Access Control (2.1) | 🔴 CRÍTICO | `borrar_base_datos_clientes` | Authorization Bypass: rol decidido por el cliente |
| H-03 | API Rate Limiting (1.2) | 🟡 MEDIO | Todas | Sin límite de invocaciones por cliente |
| H-04 | Output Encoding (1.3) | 🟡 MEDIO | `leer_registro_sistema` | Contenido de archivo retornado sin sanitizar |
| H-05 | Least Privilege (2.3) | 🟡 MEDIO | Servidor completo | Proceso sin sandbox ni restricción de permisos |
| H-06 | Isolation Environment (4.1) | 🟡 MEDIO | Servidor completo | Sin contenedor ni aislamiento de runtime |
| H-07 | Lifecycle Management (3.1) | 🟢 BAJO | Servidor completo | Sin handlers explícitos de shutdown |

---

## Comparación con Escaneo Automatizado (Cisco MCP Scanner)

El escaneo previo con Cisco MCP Scanner (modo YARA, análisis estático offline) detectó:

| Herramienta | Resultado Cisco | Resultado SlowMist |
|---|---|---|
| `saludar` | ✅ SAFE | ✅ PASA en todos los controles relevantes |
| `borrar_base_datos_clientes` | ✅ SAFE | ❌ FALLA en Access Control (H-02 CRÍTICO) |
| `leer_registro_sistema` | 🔴 HIGH — SYSTEM MANIPULATION | ❌ FALLA en Input Validation (H-01 CRÍTICO) |

**Conclusión de la comparación:**  
Las herramientas automáticas como Cisco MCP Scanner son eficaces para detectar
vulnerabilidades con patrones conocidos (como acceso al sistema de archivos).
Sin embargo, el **Authorization Bypass** de `borrar_base_datos_clientes` no fue
detectado por el escáner automático, ya que su YARA no evalúa la lógica de negocio
incorrecta. Esto demuestra que la auditoría manual con metodologías como SlowMist
es complementaria e indispensable para cubrir vulnerabilidades de diseño que los
escáneres no pueden identificar.

---

## Referencias

- [SlowMist MCP-Security-Checklist](https://github.com/slowmist/MCP-Security-Checklist)
- [Cisco AI Defense MCP Scanner](https://github.com/cisco-ai-defense/mcp-scanner)
- [MCP Official Specification](https://spec.modelcontextprotocol.io)
- Código auditado: [`apps/mcp-lab/src/index.ts`](../apps/mcp-lab/src/index.ts)
- Evidencia de escaneo automático: [`evidence/tools-definition.json`](../evidence/tools-definition.json)
