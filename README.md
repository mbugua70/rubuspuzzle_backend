# TV Picture Puzzle Game — Backend

Backend for a live, TV-based picture puzzle game show. It manages game
sessions, generates game codes, holds the authoritative game state
(score, puzzle progression, status), and keeps a **TV display** client
and a **facilitator (control)** client in sync in real time over
Socket.IO.

This backend does **not** store puzzle images, answers, or words — that
content lives entirely in the frontend. The backend only ever knows
*which puzzle ID* is currently active (`puzzleIds` + `currentPuzzleIndex`).

## Tech stack

Node.js, Express, TypeScript, MongoDB/Mongoose, Socket.IO, Zod, Pino.

## Installation

```bash
npm install
```

Copy the example env file and fill in your own values:

```bash
cp .env.example .env
```

## Environment variables

| Variable | Description | Example |
|---|---|---|
| `PORT` | HTTP port the server listens on | `5000` |
| `NODE_ENV` | `development` \| `production` \| `test` | `development` |
| `MONGO_URI` | MongoDB connection string (local or Atlas) | see below |
| `CLIENT_URL` | Origin allowed by CORS/Socket.IO (the frontend) | `http://localhost:5173` |
| `LOG_LEVEL` | Pino log level | `info` |

`env.ts` validates these with Zod at startup — the process exits
immediately with a logged error if anything required is missing or
malformed, rather than starting in a half-configured state.

### Connecting to MongoDB

**Local:**
```env
MONGO_URI=mongodb://localhost:27017/picture-puzzle
```

**Atlas:**
```env
MONGO_URI=mongodb+srv://<db_user>:<db_password>@<cluster-host>/picture-puzzle?appName=<app-name>
```

Make sure the database name (`/picture-puzzle` above) is included in
the URI — without it Mongo defaults to a database literally called
`test`. If using Atlas, the connecting IP must be allow-listed in the
Atlas dashboard's Network Access settings.

## Running

```bash
npm run dev     # nodemon + tsx, auto-restarts on src/ changes
npm run build   # tsc -> dist/
npm run start   # node dist/server.js (run build first)
npm run lint    # eslint .
```

## Folder structure

```text
src/
├── config/          env.ts (Zod-validated env), constants.ts (game tunables),
│                     database.ts (mongoose connect/disconnect + logging)
├── logger/           logger.ts - single Pino instance, pretty in dev / JSON in prod
├── types/            game.types.ts (GameStatus, GameStatePayload, Role),
│                     socket.types.ts (typed Socket.IO event maps)
├── utils/            AppError, asyncHandler, response envelope, gameCode generator
├── models/           GameSession.ts (Mongoose schema -> game_sessions collection)
├── validators/       game.validator.ts - one Zod schema per action
├── services/         game.service.ts - all game logic and state transitions
├── controllers/      game.controller.ts - REST request/response glue
├── middleware/       errorHandler.ts, notFound.ts
├── routes/           game.routes.ts
├── sockets/          index.ts (Socket.IO server setup), game.socket.ts (event
│                     handlers), timer.manager.ts (question timeout scheduling),
│                     presence.manager.ts (per-role connection tracking)
├── app.ts             Express app: helmet, cors, rate limiting, pino-http, routes
└── server.ts          http server, DB connect, Socket.IO init, graceful shutdown
```

## Architecture

Strict layering for REST:

```text
Route -> Controller -> Service -> Mongoose Model
```

Controllers only validate input (Zod), call a service function, and
shape the HTTP response — no game logic lives there. All game rules
(scoring, status transitions, puzzle progression) live in
`services/game.service.ts`, which is completely transport-agnostic: it
has no knowledge of Express or Socket.IO, and returns a single DTO
shape (`GameStatePayload`) used identically by both.

Socket.IO is a **parallel path into the same service layer**, not a
separate copy of the logic:

```text
Socket event -> Zod validate -> role check -> Service -> broadcast game:state
```

The one piece of state that lives outside MongoDB is the **question
timer** (`sockets/timer.manager.ts`, an in-memory `Map` keyed by game
code) and **presence tracking** (`sockets/presence.manager.ts`, tracks
which socket IDs are connected per role per game). Both are
transport-layer concerns — they need to call back into `io.emit(...)`
or reason about individual live connections, which the DB-only service
layer deliberately knows nothing about.

## How the TV and facilitator communicate

Every game has one Socket.IO room, `game:<CODE>`. Both the **display**
(TV) and **facilitator** (control) clients connect to the same room by
emitting `game:join` with their role. From then on:

- The facilitator emits control events (`game:start`, `game:judge`,
  `game:pause`, `game:resume`, `game:skip`, `game:restart`, `game:end`).
- The server validates the payload, checks the emitting socket
  actually joined *that* game as `facilitator` (a `display` socket, or
  a socket that joined a different game, gets a clean ack error and no
  state change), runs the corresponding service function, and
  broadcasts one `game:state` event to the whole room.
- The display client is purely reactive — it only ever listens for
  `game:state` and renders whatever it receives. It never computes
  score or timing itself; the backend is the single source of truth.

**Reconnects:** if the facilitator's socket drops while the game is
`"playing"`, the game auto-pauses so nothing times out unattended; the
facilitator must send `game:resume` after reconnecting. Multiple
sockets of the same role are tracked individually (`presence.manager`),
so a stale disconnect from an old tab won't wrongly flip
`facilitatorConnected`/`displayConnected` to false while a fresh
reconnect is still live.

**Pacing:** `game:judge` (and the internal auto-timeout) only record
the outcome — status becomes `"correct"` / `"wrong"` / `"timeout"` and
stays there so the TV can display it. `game:skip` is what actually
advances to the next puzzle (or finishes the game if none remain); it
only counts as a "skip" in the stats if the puzzle was still
unanswered. This keeps pacing entirely under the facilitator's control.

## REST endpoints

All responses use the envelope `{ success, data?, message? }`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check → `{ "status": "ok" }` |
| `POST` | `/api/game-sessions` | Create a session. Body: `{ puzzleIds: string[] }`. Returns `{ gameCode, displayUrl, facilitatorUrl }` |
| `GET` | `/api/game-sessions/:gameCode` | Full current game state |
| `DELETE` | `/api/game-sessions/:gameCode` | Remove a session |

## Socket.IO events

**Incoming** (client → server, all take `{ gameCode, ... }` and an
optional ack callback receiving `{ success, data }` or `{ success:
false, message }`):

`game:join` (+`role: "display" | "facilitator"`), `game:start`,
`game:judge` (+`result: "correct" | "wrong"`), `game:pause`,
`game:resume`, `game:skip`, `game:restart`, `game:end`

**Outgoing** (server → clients in the room):

`game:state` — the full `GameStatePayload`, broadcast after every
successful action. There is deliberately no finer-grained event; every
client always gets the complete current state.

## Future plans

Puzzle CRUD and image storage are out of scope for this backend by
design — puzzle content lives in the frontend today. If that ever
needs to move server-side (e.g. a shared puzzle bank across multiple
frontends), it would live in its own collection/module without
touching the game-session state machine described above.
