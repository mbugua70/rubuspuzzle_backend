import { GameStatePayload, Role } from "./game.types";

export type AckResponse =
  | { success: true; data: GameStatePayload }
  | { success: false; message: string };

export type AckCallback = (response: AckResponse) => void;

export interface JoinPayload {
  gameCode: string;
  role: Role;
}

export interface GameCodePayload {
  gameCode: string;
}

export interface JudgePayload {
  gameCode: string;
  result: "correct" | "wrong";
}

export interface ClientToServerEvents {
  "game:join": (payload: JoinPayload, callback?: AckCallback) => void;
  "game:start": (payload: GameCodePayload, callback?: AckCallback) => void;
  "game:judge": (payload: JudgePayload, callback?: AckCallback) => void;
  "game:pause": (payload: GameCodePayload, callback?: AckCallback) => void;
  "game:resume": (payload: GameCodePayload, callback?: AckCallback) => void;
  "game:skip": (payload: GameCodePayload, callback?: AckCallback) => void;
  "game:retry": (payload: GameCodePayload, callback?: AckCallback) => void;
  "game:restart": (payload: GameCodePayload, callback?: AckCallback) => void;
  "game:end": (payload: GameCodePayload, callback?: AckCallback) => void;
}

export interface ServerToClientEvents {
  "game:state": (payload: GameStatePayload) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents {}

export interface SocketData {
  gameCode: string | null;
  role: Role | null;
}
