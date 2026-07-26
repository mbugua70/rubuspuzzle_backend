# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev     # nodemon + tsx, auto-restarts on src/ changes, connects to MONGO_URI
npm run build   # tsc -> dist/ (noEmitOnError: strict, must be clean)
npm run start   # node dist/server.js (run build first)
npm run lint    # eslint . (flat config, typescript-eslint recommended)
```

No test suite exists in this repo. `.env` (gitignored) holds `PORT`,
`NODE_ENV`, `MONGO_URI`, `CLIENT_URL`, `LOG_LEVEL` — see `.env.example`
for the shape; `src/config/env.ts` validates these with Zod at startup
and exits the process on failure rather than running half-configured.

## Architecture

This is the backend for a live TV picture-puzzle game show: it manages
game sessions, generates game codes, and holds the authoritative game
state, syncing a TV **display** client and a **facilitator** (control)
client over Socket.IO. It deliberately does **not** own puzzle content
(images/answers/words) — that lives in the frontend. The backend only
ever knows a puzzle ID string and its index in `puzzleIds`.

**Strict layering for REST**: `Route -> Controller -> Service -> Mongoose Model`.
Controllers (`controllers/game.controller.ts`) only Zod-validate input,
call a service function, and shape the response — no game logic there.

**All game rules live in `services/game.service.ts`**, which is
completely transport-agnostic (no Express or Socket.IO imports). It
returns one DTO shape, `GameStatePayload` (`types/game.types.ts`), used
identically as the REST `GET` response body and the Socket.IO
`game:state` broadcast payload — there is one mapper
(`toGameStatePayload`) that produces it, so REST and sockets can never
drift apart on what "the state" looks like.

**Socket.IO (`sockets/`) is a parallel path into the same service
layer**, not a second copy of the logic: `socket event -> Zod validate
-> role check -> service function -> broadcast game:state to the room`.
Every game has one room, `game:<CODE>`. Control events
(start/judge/pause/resume/skip/restart/end) are rejected unless the
emitting socket joined that specific game as `"facilitator"`
(`sockets/game.socket.ts`'s `assertFacilitator`).

Two pieces of state intentionally live **outside MongoDB**, in-memory,
because they're transport-layer concerns the DB-only service layer has
no business knowing about:
- `sockets/timer.manager.ts` — the per-game question-duration auto-timeout
  (a `Map<gameCode, Timeout>`). Fires `gameService.timeoutQuestion()`
  and broadcasts the result when a puzzle's time runs out unanswered.
- `sockets/presence.manager.ts` — tracks connected socket IDs per role
  per game, so a stale disconnect from an old tab can't wrongly flip
  `facilitatorConnected`/`displayConnected` false while a fresh
  reconnect is still live. If the facilitator's *last* socket
  disconnects while the game is `"playing"`, the game auto-pauses.

**Pacing model** (the non-obvious part of the state machine): judging
an answer or timing out only records the outcome — status becomes
`"correct"` / `"wrong"` / `"timeout"` and stays there. `game:skip` is
what actually advances to the next puzzle (or finishes the game), and
only increments `skippedCount` if the puzzle was still unanswered when
skipped. This keeps pacing entirely under the facilitator's control
using only the events already defined, rather than an implicit
auto-advance timer.

See `README.md` for the full REST endpoint list, Socket.IO event
payloads, and env var reference.
