import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';


const SERVER_NAME = 'grupo4-mcp-lab';
const SERVER_VERSION = '0.1.0';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LAB_INFO = {
  project: 'grupo4-mcp-security',
  purpose: 'Laboratorio académico para estudiar seguridad en servidores MCP',
  environment: 'local',
  transport: 'stdio',
  intentionalVulnerabilities: true,
} as const;

const MCP_COMPONENTS = [
  'Host',
  'Client',
  'Server',
  'Transport',
  'Tool',
  'Resource',
  'Prompt',
] as const;

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

  // VULNERABILIDAD 1: Authorization Bypass
  server.registerTool(
    'borrar_base_datos_clientes',
    {
      description:
        '[VULNERABLE] Elimina todos los registros de clientes. Solo para uso de administradores.',
      inputSchema: z.object({
        rol_usuario: z
          .string()
          .describe('Rol del usuario que ejecuta la acción (ej: "user", "admin")'),
        confirmacion: z.boolean().describe('Confirmar acción destructiva'),
      }),
    },
    async ({ rol_usuario, confirmacion }) => {
      // VULNERABILIDAD: El servidor confía ciegamente en el parámetro 'rol_usuario'
      // proporcionado por el cliente en el payload JSON.
      if (rol_usuario !== 'admin') {
        return {
          content: [
            {
              type: 'text',
              text: `Error de Autorización: El rol '${rol_usuario}' no tiene permisos para realizar esta acción.`,
            },
          ],
          isError: true,
        };
      }

      if (!confirmacion) {
        return {
          content: [
            {
              type: 'text',
              text: 'Operación cancelada: Se requiere confirmación (confirmacion: true).',
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: '¡ÉXITO (Vulnerabilidad)! Base de datos borrada satisfactoriamente. (Authorization Bypass logrado por confiar en el cliente)',
          },
        ],
      };
    },
  );

  // VULNERABILIDAD 2: Path Traversal / Arbitrary File Read
  server.registerTool(
    'leer_registro_sistema',
    {
      description:
        '[VULNERABLE] Lee un archivo de registro del sistema. Se asume que el usuario enviará un log relativo válido.',
      inputSchema: z.object({
        ruta_archivo: z
          .string()
          .describe('Ruta del archivo a leer (ej. ./logs/sistema.log)'),
      }),
    },
    async ({ ruta_archivo }) => {
      try {
        
        // VULNERABILIDAD: El servidor une la ruta base con el input sin sanitizar '../'
        const directorioBase = path.join(__dirname, '..', '..', 'fixtures', 'logs');
        const rutaFinal = path.join(directorioBase, ruta_archivo);
        const contenido = fs.readFileSync(rutaFinal, 'utf-8');
        return {
          content: [
            {
              type: 'text',
              text: `Contenido leído exitosamente (Vulnerabilidad Path Traversal lograda):\n\n${contenido}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error al leer el archivo. El servidor devuelve el error de sistema: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // VULNERABILIDAD 3: Injection (simulada, sin ejecución real de procesos)
  const RESPUESTAS_SIMULADAS: Record<string, string> = {
    whoami: 'usuario-ficticio-lab',
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



  // Recurso de la Fase 3
  server.registerResource(
    'project-info',
    'lab://project-info',
    {
      title: 'Información del laboratorio MCP',
      description:
        'Describe información general y no sensible del laboratorio académico.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(LAB_INFO, null, 2),
        },
      ],
    }),
  );

  // Prompt de la Fase 3
  server.registerPrompt(
    'explicar-componente-mcp',
    {
      title: 'Explicar componente MCP',
      description:
        'Genera una plantilla para explicar un componente de la arquitectura MCP.',
      argsSchema: z.object({
        componente: z
          .enum(MCP_COMPONENTS)
          .describe('Componente MCP que se desea explicar.'),
      }),
    },
    ({ componente }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text:
              `Explica el componente MCP "${componente}" en el contexto de ` +
              'nuestro laboratorio académico. Incluye su función, su relación ' +
              'con los demás componentes y un ejemplo de uso normal. ' +
              'No inventes vulnerabilidades.',
          },
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