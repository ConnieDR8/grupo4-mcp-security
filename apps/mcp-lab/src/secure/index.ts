import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { isIP } from 'node:net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVER_NAME = 'grupo4-mcp-lab-secure';
const SERVER_VERSION = '0.1.0';

/*
 * MODELO DE CONFIANZA DEL LABORATORIO
 *
 * - MCP Client / Host / agente IA:
 *   fuente no confiable de argumentos enviados a las Tools.
 *
 * - MCP Server:
 *   responsable de validar inputs y aplicar autorización.
 *
 * - Fixtures:
 *   datos ficticios y controlados exclusivamente para el laboratorio.
 *
 * - No existen usuarios, credenciales ni sistemas reales.
 *
 * El objetivo es demostrar que una Tool MCP no debe confiar en
 * privilegios o instrucciones proporcionados por su consumidor.
 */

/*
 * Contexto de autorización simulado del lado servidor.
 *
 * En la versión vulnerable, el cliente podía indicar directamente
 * su propio rol mediante el parámetro "rol_usuario".
 *
 * En esta versión segura, dicho rol desaparece del inputSchema.
 *
 * Como este laboratorio utiliza transporte stdio y no implementa
 * un proveedor de identidad real, usuario y rol se reciben mediante
 * variables de entorno configuradas al iniciar el MCP Server.
 *
 * En producción, estos datos deberían derivarse de una identidad
 * previamente autenticada y validada.
 */
type RolServidor = 'user' | 'admin';

interface SesionServidor {
  usuario: string;
  rol: RolServidor;
}

function obtenerSesionServidor(): SesionServidor {
  const usuario =
    process.env.MCP_LAB_USER?.trim() || 'usuario-ficticio-01';

  const rolConfigurado =
    process.env.MCP_LAB_ROLE?.trim().toLowerCase() || 'user';

  if (rolConfigurado !== 'user' && rolConfigurado !== 'admin') {
    throw new Error(
      'Configuración inválida: MCP_LAB_ROLE debe ser "user" o "admin".',
    );
  }

  return {
    usuario,
    rol: rolConfigurado,
  };
}

const SESION_SERVIDOR = obtenerSesionServidor();

const LAB_INFO = {
  project: 'grupo4-mcp-security',
  purpose: 'Laboratorio académico para estudiar seguridad en servidores MCP',
  environment: 'local',
  transport: 'stdio',
  intentionalVulnerabilities: false,
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

/*
 * Solo se aceptan direcciones IP válidas o nombres de host
 * formados por caracteres permitidos.
 *
 * De esta forma, metacaracteres como ;, &, |, $, etc.
 * no pueden formar parte del host recibido.
 */
const HOSTNAME_VALIDO =
  /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

function hostEsValido(host: string): boolean {
  if (host !== host.trim()) {
    return false;
  }

  return isIP(host) !== 0 || HOSTNAME_VALIDO.test(host);
}

function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  /*
   * Tool normal de la Fase 2.
   * No requiere una mitigación especial.
   */
  server.registerTool(
    'saludar',
    {
      description:
        'Devuelve un saludo local (versión segura, sin cambios de seguridad relevantes).',
      inputSchema: z.object({
        nombre: z.string().trim().min(1).max(60),
      }),
    },
    async ({ nombre }) => ({
      content: [
        {
          type: 'text',
          text: `Hola, ${nombre}. Servidor MCP seguro.`,
        },
      ],
    }),
  );

  /*
   * MITIGACIÓN 1 — AUTHORIZATION BYPASS
   *
   * En la versión vulnerable, el cliente podía proporcionar
   * directamente su propio rol mediante "rol_usuario".
   *
   * En esta versión segura, el rol desaparece completamente del
   * inputSchema. La decisión de autorización utiliza exclusivamente
   * el contexto mantenido por el servidor.
   *
   * Así, un Client/Host —o un agente IA que invoque esta Tool—
   * no puede elevar sus privilegios modificando los argumentos MCP.
   */
  server.registerTool(
    'borrar_base_datos_clientes',
    {
      description:
        'Simula una operación administrativa protegida por autorización del servidor.',
      inputSchema: z.object({
        confirmacion: z
          .boolean()
          .describe('Confirma la operación administrativa simulada.'),
      }),
    },
    async ({ confirmacion }) => {
      if (!confirmacion) {
        return {
          content: [
            {
              type: 'text',
              text: 'Operación cancelada: no fue confirmada.',
            },
          ],
        };
      }

      if (SESION_SERVIDOR.rol !== 'admin') {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text:
                `Acceso denegado para ${SESION_SERVIDOR.usuario}: ` +
                'el contexto de autorización no posee el rol admin.',
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text:
              'SIMULACIÓN: operación administrativa autorizada. ' +
              'No se modificaron datos reales.',
          },
        ],
      };
    },
  );

  /*
   * MITIGACIÓN 2 — PATH TRAVERSAL / ARBITRARY FILE READ
   *
   * Los archivos permitidos deben permanecer dentro de:
   *
   * fixtures/logs/
   *
   * path.resolve() normaliza la ruta y path.relative() permite
   * comprobar que el destino continúa dentro del directorio base.
   */
  server.registerTool(
    'leer_registro_sistema',
    {
      description:
        'Lee únicamente archivos del directorio local permitido de registros ficticios.',
      inputSchema: z.object({
        ruta_archivo: z
          .string()
          .trim()
          .min(1)
          .max(255)
          .describe(
            'Ruta relativa de un archivo dentro del directorio permitido de logs.',
          ),
      }),
    },
    async ({ ruta_archivo }) => {
      const directorioBase = path.resolve(
        __dirname,
        '..',
        '..',
        'fixtures',
        'logs',
      );

      const rutaFinal = path.resolve(directorioBase, ruta_archivo);
      const rutaRelativa = path.relative(directorioBase, rutaFinal);

      const fueraDelDirectorio =
        rutaRelativa === '..' ||
        rutaRelativa.startsWith(`..${path.sep}`) ||
        path.isAbsolute(rutaRelativa);

      if (fueraDelDirectorio) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text:
                'Acceso denegado: la ruta solicitada está fuera ' +
                'del directorio de registros permitido.',
            },
          ],
        };
      }

      try {
        const contenido = fs.readFileSync(rutaFinal, 'utf8');

        return {
          content: [
            {
              type: 'text',
              text:
                `Contenido del registro permitido "${ruta_archivo}":\n` +
                contenido.slice(0, 2000),
            },
          ],
        };
      } catch {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text:
                'No fue posible leer el archivo solicitado dentro ' +
                'del directorio permitido.',
            },
          ],
        };
      }
    },
  );

  /*
   * MITIGACIÓN 3 — INJECTION
   *
   * La versión vulnerable construía una línea similar a:
   *
   * ping -c 1 ${host}
   *
   * y simulaba su interpretación como shell.
   *
   * La versión segura no concatena ni interpreta comandos.
   * El host debe ser una IP válida o un hostname permitido.
   */
  server.registerTool(
    'diagnostico_servidor',
    {
      description:
        'Realiza un diagnóstico local simulado aceptando únicamente una IP o hostname válido.',
      inputSchema: z.object({
        host: z
          .string()
          .min(1)
          .max(253)
          .describe('Host o IP a diagnosticar (ej.: "127.0.0.1").'),
      }),
    },
    async ({ host }) => {
      if (!hostEsValido(host)) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text:
                'Entrada rechazada: el host contiene un formato ' +
                'o caracteres no permitidos.',
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text:
              `Diagnóstico seguro para "${host}": conectividad simulada OK. ` +
              'No se ejecutaron comandos del sistema.',
          },
        ],
      };
    },
  );

  /*
   * Resource de la Fase 3.
   */
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

  /*
   * Prompt de la Fase 3.
   */
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
  `${SERVER_NAME} v${SERVER_VERSION} ejecutándose mediante stdio. ` +
    `Contexto: usuario=${SESION_SERVIDOR.usuario}, rol=${SESION_SERVIDOR.rol}.`,
);