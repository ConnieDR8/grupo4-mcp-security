# 📘 Manual de Ejecución y Uso — MCP Security Lab

Este manual detalla las instrucciones para ejecutar el entorno de laboratorio MCP (Model Context Protocol) del Grupo 4 y documenta los payloads necesarios para probar e interactuar con las herramientas vulnerables.

---

## 1. Ejecución del Servidor (Vía MCP Inspector)

Para interactuar gráficamente con el servidor, enviarle payloads y visualizar las respuestas, utilizaremos la herramienta oficial **MCP Inspector**.

Abre una terminal en la raíz del proyecto y ejecuta el comando correspondiente al entorno que deseas probar:

### ▶ Entorno Vulnerable
Despliega el código que contiene los fallos de seguridad intencionales.
```bash
npx @modelcontextprotocol/inspector tsx apps/mcp-lab/src/vulnerable/index.ts
```

### ▶ Entorno Seguro (Mitigado)
Despliega la versión con las validaciones de seguridad corregidas *(disponible a partir de la Fase 9)*.
```bash
npx @modelcontextprotocol/inspector tsx apps/mcp-lab/src/secure/index.ts
```

> **Nota:** Una vez que ejecutes cualquiera de los comandos, abre tu navegador web e ingresa a `http://localhost:5173`. Navega a la pestaña **"Tools"** para comenzar las pruebas.

---

## 2. Guía de Uso de Herramientas (Payloads)

A continuación, se detallan los payloads JSON que debes introducir en el Inspector para interactuar con cada herramienta. Se provee un flujo de "Uso Normal" (benigno) y un flujo de "Explotación" (ataque) para demostrar la vulnerabilidad.

### 2.1 Herramienta: `borrar_base_datos_clientes`
**Vulnerabilidad demostrada:** Authorization Bypass (Control de Acceso Deficiente).

*   **Uso Normal (Denegado):** El sistema rechaza la acción correctamente porque el rol no tiene privilegios.
    ```json
    {
      "rol_usuario": "user",
      "confirmacion": true
    }
    ```
*   **ATAQUE (Explotación exitosa):** El sistema confía en la entrada del cliente sin validar sesión, permitiendo la destrucción de la base de datos.
    ```json
    {
      "rol_usuario": "admin",
      "confirmacion": true
    }
    ```

### 2.2 Herramienta: `leer_registro_sistema`
**Vulnerabilidad demostrada:** Path Traversal (Lectura de Archivos Arbitrarios).

*   **Uso Normal (Permitido):** Lectura del archivo de registros esperado dentro del directorio público.
    ```json
    {
      "ruta_archivo": "sistema.log"
    }
    ```
*   **ATAQUE (Explotación exitosa):** Mediante saltos de directorio (`../`), el atacante escapa de la carpeta de logs y lee un archivo confidencial.
    ```json
    {
      "ruta_archivo": "../private/secreto-ficticio.txt"
    }
    ```

### 2.3 Herramienta: `diagnostico_servidor`
**Vulnerabilidad demostrada:** Command Injection Simulada (Inyección de Comandos).

*   **Uso Normal (Permitido):** Ejecución estándar de un ping hacia una IP válida.
    ```json
    {
      "host": "127.0.0.1"
    }
    ```
*   **ATAQUE (Explotación exitosa):** El atacante inyecta un separador de shell (`;`) seguido de un comando adicional (`whoami`), forzando al sistema a ejecutar ambos de forma secuencial.
    ```json
    {
      "host": "127.0.0.1; whoami"
    }
    ```
