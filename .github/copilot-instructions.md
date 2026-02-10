# Copilot instructions for Totem OS

## Big picture
- Next.js 15 App Router app with server actions in `src/actions/**` and routes/layouts in `src/app/**` (see `src/app/layout.tsx`).
- Feature-based UI: `src/components/ui` = shadcn “dumb” components, `src/components/features/**` = smart modules by domain (clients/content/finance/users/shared). Keep changes within the feature folder.
- Data layer uses Prisma (`src/lib/db.ts`) with schema in `prisma/schema.prisma` and JSON-ish fields stored as `String` (e.g., `Client.brandKit`, `planConfig`), so actions serialize/parse with `JSON.stringify`/`JSON.parse` (see `src/actions/client-actions.ts`).
- Auth is NextAuth: base config in `src/auth.config.ts` (no Prisma), full config in `src/auth.ts` (Prisma + credentials), and access control in `src/middleware.ts` (admin gating + public report access).

## 1. GENERAL PHILOSOPHY (ATOMIC & SCALABLE)
- **Think before coding:** Break down complex tasks into small, atomic steps.
- **No Monoliths:** Do not generate single files with >300 lines of code. Split logic into hooks, utils, or sub-components.
- **Feature-Based Architecture:** Respect the `/src/components/features/{module}` structure. Do not mix features.
- **Mobile First:** All UI code must be mobile-responsive by default using Tailwind classes (e.g., `grid-cols-1 md:grid-cols-3`).g


## Conventions & patterns
- Server Actions: must be in `src/actions/**`, start with `"use server"`, validate inputs via Zod schemas in `src/schemas/**`, wrap async logic in try/catch, and return `ApiResponse<T>`/`ActionResponse<T>` from `src/types/index.ts`.
- Do not import Prisma into client components; use actions for writes and `revalidatePath()` after mutations (example in `src/actions/client-actions.ts`).
- Strict typing: avoid `any`; prefer Prisma-generated types (e.g., `Prisma.XGetPayload`) or `z.infer` from schemas (see `.cursorrules`, `src/schemas/client.ts`).
- UI is Tailwind (mobile-first) + shadcn/ui; avoid custom CSS files. Icons via `lucide-react`.

## Integrations
- Pusher server config in `src/lib/pusher.ts` (requires `PUSHER_*` env vars).
- UploadThing setup in `src/app/api/uploadthing/**` and root layout (see `src/app/layout.tsx`).
- Google OAuth in `src/auth.config.ts` and credentials auth in `src/auth.ts`.

## Voice control (current behavior)
- Main panel at `/admin/voice-control` provides mic control, live transcription, auto-interpret on stop, and prefill for `TaskSheet`/`ShootingForm`.
- `FloatingVoiceButton` is global (hidden on Finance and `/admin/voice-control`), opens a side sheet mini-UI, and reuses the same voice logic.
- Audio capture prefers Web Speech API; fallback uses `MediaRecorder` + `POST /api/transcribe` (Groq Whisper).
- Interpretation via `interpretVoiceCommandAction` uses the AI provider set in `/admin/settings` and returns structured JSON:
	`{ type, title, details, pieceType?, suggestedClient?, suggestedDate?, suggestedStartTime?, suggestedEndTime? }`.
- Client matching uses `matchClientIdWithFallback` (exact/partial/reverse match) with `suggestedClient` or transcript text; dates/times parsed by `parseDDMMYYYY` and `parseTimeToHHMM`.
- After creation: tasks close the modal; shoots navigate to `/content/shoots?detail={id}` or refresh.

## Developer workflows
- Install: `npm install` (postinstall runs `prisma generate`).
- Dev server: `npm run dev` (Turbo) or `npm run dev:standard`.
- Prisma: `npm run db:push`, `npm run db:migrate`, `npm run db:studio`, `npm run db:seed`.
- Deployment target is cPanel with `output: 'standalone'` (see `next.config.ts`).

## DB environment note
- `prisma/schema.prisma` documents switching between PostgreSQL (Neon) and SQLite; keep the datasource consistent with `.env` before running Prisma commands.
