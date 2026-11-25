# Reglas del Proyecto: Finanzas Personales (Monolito Next.js)

## Stack & Arquitectura
- Framework: Next.js (App Router) full-stack unificado (UI + API Routes).
- Base de datos: SQLite con Prisma ORM (`prisma/schema.prisma`).
- Estilos: Tailwind CSS + Lucide Icons.
- Principios: Clean Architecture ligera y SOLID. Separa siempre la lógica matemática/financiera en `src/domain/` o `src/services/` lejos de los componentes React.
- Moneda: Usa `Decimal` en Prisma y evita errores de punto flotante en cálculos financieros.

## Reglas de Ahorro de Tokens (ESTRICTO)
1. NUNCA leas `node_modules`, `.next`, `package-lock.json` ni archivos `.db`.
2. Modifica o crea solo los archivos estrictamente necesarios para la tarea actual.
3. No escribas explicaciones largas; responde con un resumen breve de los archivos creados/modificados y cómo probarlos.
4. Usa `/compact` o `/clear` cuando cambies de módulo.
- Prisma: Este proyecto usa Prisma 7 (`prisma7.config.ts`). Respeta la configuración v7 al generar el schema y el cliente.
- Diseño UI: Sigue estrictamente los tokens, colores, radios, sombras y reglas visuales definidas en `DESIGN.md`.