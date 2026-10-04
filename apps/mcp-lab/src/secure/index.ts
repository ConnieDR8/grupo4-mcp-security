import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

// Fase 9: aquí se añadirán las versiones mitigadas de
// borrar_base_datos_clientes, leer_registro_sistema y diagnostico_servidor.

const SERVER_NAME = 'grupo4-mcp-lab-secure';
const SERVER_VERSION = '0.1.0';

function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

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

  return server;
}

void serveStdio(createServer);
console.error(`${SERVER_NAME} v${SERVER_VERSION} ejecutándose mediante stdio.`);
