import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

const SERVER_NAME = 'grupo4-mcp-lab';
const SERVER_VERSION = '0.1.0';

function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    'saludar',
    {
      description:
        'Devuelve un saludo local para comprobar el funcionamiento del laboratorio MCP.',
      inputSchema: z.object({
        nombre: z
          .string()
          .trim()
          .min(1, 'El nombre es obligatorio.')
          .max(60, 'El nombre no puede superar los 60 caracteres.'),
      }),
    },
    async ({ nombre }) => ({
      content: [
        {
          type: 'text',
          text: `Hola, ${nombre}. El servidor MCP del Grupo 4 está funcionando correctamente.`,
        },
      ],
    }),
  );

  return server;
}

void serveStdio(createServer);

console.error(
  `${SERVER_NAME} v${SERVER_VERSION} ejecutándose mediante stdio.`,
);