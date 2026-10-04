# Guion de Demo — Fase 8: Demostración de Vulnerabilidades

**Servidor a usar:** `npm run dev:vulnerable`  
**Inspector:** `npx @modelcontextprotocol/inspector tsx apps/mcp-lab/src/vulnerable/index.ts`

> ⚠️ Todas las capturas van al informe/documento. **Nunca al repositorio.**

---

## Configuración previa

1. Desde la raíz del repositorio, lanzar el Inspector:
   ```bash
   npx @modelcontextprotocol/inspector tsx apps/mcp-lab/src/vulnerable/index.ts
   ```
2. Abrir el navegador en `http://localhost:5173` (puerto por defecto del Inspector).
3. Confirmar que aparecen las 4 tools (`saludar`, `borrar_base_datos_clientes`, `leer_registro_sistema`, `diagnostico_servidor`), el Resource `lab://project-info` y el Prompt `explicar-componente-mcp`.

📸 **Captura 0 — árbol completo de tools/resource/prompt en el Inspector.**

---

## Demo 1 — Authorization Bypass

### Paso 1a: caso denegado (control de referencia)

**Tool:** `borrar_base_datos_clientes`  
**Payload:**
```json
{
  "rol_usuario": "user",
  "confirmacion": true
}
```
**Resultado esperado:**
```
Error de Autorización: El rol 'user' no tiene permisos para realizar esta acción.
```

📸 **Captura 1 — error de autorización con rol `user`.**

---

### Paso 1b: Authorization Bypass (ataque)

**Tool:** `borrar_base_datos_clientes`  
**Payload:**
```json
{
  "rol_usuario": "admin",
  "confirmacion": true
}
```
**Resultado esperado:**
```
¡ÉXITO (Vulnerabilidad)! Base de datos borrada satisfactoriamente.
(Authorization Bypass logrado por confiar en el cliente)
```

📸 **Captura 2 — bypass exitoso enviando `rol_usuario: "admin"` desde el cliente.**

**Narración sugerida:**
> «El servidor nunca verifica quién eres realmente — simplemente pregunta al mismo cliente que quiere ejecutar la acción. Cualquiera puede declararse admin.»

**Línea de código vulnerable:**
```typescript
// apps/mcp-lab/src/vulnerable/index.ts ~línea 74
if (rol_usuario !== 'admin') {   // ← rol_usuario viene del cliente sin verificar
```

---

## Demo 2 — Path Traversal / Arbitrary File Read

### Paso 2a: caso normal (dentro del directorio permitido)

**Tool:** `leer_registro_sistema`  
**Payload:**
```json
{
  "ruta_archivo": "sistema.log"
}
```
**Resultado esperado:** contenido completo de `fixtures/logs/sistema.log` (10 entradas de log ficticias).

📸 **Captura 3 — lectura normal del log ficticio.**

---

### Paso 2b: Path Traversal — escape del directorio (ataque)

**Tool:** `leer_registro_sistema`  
**Payload:**
```json
{
  "ruta_archivo": "../private/secreto-ficticio.txt"
}
```
**Resultado esperado:** contenido de `fixtures/private/secreto-ficticio.txt`, que está **fuera** del directorio `logs/`.

📸 **Captura 4 — archivo secreto ficticio leído desde fuera del directorio permitido.**

**Narración sugerida:**
> «El servidor une la ruta base con el input del cliente usando `path.join()`. La secuencia `../` navega hacia el directorio padre, escapando del sandbox que el programador intentó crear.»

**Línea de código vulnerable:**
```typescript
// apps/mcp-lab/src/vulnerable/index.ts ~línea 130
const directorioBase = path.join(__dirname, '..', '..', 'fixtures', 'logs');
const rutaFinal = path.join(directorioBase, ruta_archivo); // ← sin verificar startsWith(base)
```

---

## Demo 3 — Injection (simulada)

### Paso 3a: comando simple (sin inyección)

**Tool:** `diagnostico_servidor`  
**Payload:**
```json
{
  "host": "127.0.0.1"
}
```
**Resultado esperado:**
```
Diagnóstico ejecutado (sin inyección detectada en este input):

PING 127.0.0.1: 1 paquete transmitido, 1 recibido, 0% packet loss (simulado)
```

📸 **Captura 5 — ping simulado a 127.0.0.1, sin inyección.**

---

### Paso 3b: comando encadenado — Injection (ataque)

**Tool:** `diagnostico_servidor`  
**Payload:**
```json
{
  "host": "127.0.0.1; whoami"
}
```
**Resultado esperado:**
```
Diagnóstico ejecutado con comandos encadenados (Vulnerabilidad Injection lograda, simulada):

PING 127.0.0.1: 1 paquete transmitido, 1 recibido, 0% packet loss (simulado)
usuario-ficticio-lab
```

📸 **Captura 6 — el separador `;` fue interpretado, ejecutando `whoami` ficticio.**

**Narración sugerida:**
> «El servidor concatena el input directamente en una "línea de comando" sin sanitizar. El separador `;` hace que el intérprete de shell ejecute un segundo comando. En producción, con `exec()` real, esto sería ejecución arbitraria de código en el servidor.»

**Líneas de código vulnerables:**
```typescript
// apps/mcp-lab/src/vulnerable/index.ts
const linea = `ping -c 1 ${host}`;                        // ← concatenación sin escape
const partes = linea.split(/;|&&|\|/).map((p) => p.trim()); // ← separadores interpretados
```

---

## Resumen de capturas requeridas

| # | Captura | Vulnerabilidad |
|---|---|---|
| 0 | Árbol Inspector (tools + resource + prompt) | — |
| 1 | `borrar_base_datos_clientes` con `rol_usuario: "user"` → error | Authz (control) |
| 2 | `borrar_base_datos_clientes` con `rol_usuario: "admin"` → éxito | Authz Bypass ✅ |
| 3 | `leer_registro_sistema` con `sistema.log` → log ficticio | Path Traversal (control) |
| 4 | `leer_registro_sistema` con `../private/secreto-ficticio.txt` → secreto | Path Traversal ✅ |
| 5 | `diagnostico_servidor` con `127.0.0.1` → ping normal | Injection (control) |
| 6 | `diagnostico_servidor` con `127.0.0.1; whoami` → dos salidas | Injection ✅ |

---

## Payloads adicionales para demostrar variantes

```json
// Injection con &&
{ "host": "127.0.0.1 && id" }

// Injection con |
{ "host": "127.0.0.1 | cat secreto-ficticio.txt" }

// Path Traversal doble nivel (si existiera un directorio adicional)
{ "ruta_archivo": "../../package.json" }
```

> **Nota:** Los payloads adicionales son opcionales. Los 6 payloads principales son suficientes para la entrega.
