# Seguridad de Agentes IA y Protocolo MCP

Proyecto académico del Grupo 4 para el curso de Seguridad Informática / Ciberseguridad.

## Parcial

**MCP Security Checklist + Scanner**

El proyecto estudia la arquitectura del Model Context Protocol (MCP) y desarrolla un laboratorio local para realizar una auditoría de seguridad controlada sobre un servidor MCP.

Durante el desarrollo se utilizarán como referencias principales:

- documentación oficial de Model Context Protocol;
- SlowMist MCP Security Checklist;
- Cisco AI Defense MCP Scanner.

## Alcance

Todas las pruebas de seguridad se realizarán exclusivamente sobre un laboratorio local controlado por el equipo.

El alcance autorizado se encuentra documentado en `SCOPE.md`.

## Requisitos

- Node.js 20 o superior.
- npm.

## Instalación

Desde la raíz del repositorio:

```bash
npm install
```
## Verificación de tipos

```bash
npm run typecheck
```

## Ejecutar el servidor MCP

```bash
npm run dev
```

## Verificar con MCP Inspector

```bash
npx @modelcontextprotocol/inspector npx tsx apps/mcp-lab/src/index.ts
```
Actualmente el servidor expone la Tool saludar, utilizada para comprobar la comunicación MCP y la validación básica de argumentos.
