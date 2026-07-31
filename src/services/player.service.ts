import { nanoid } from "nanoid";
import { logger } from "../logger/logger";
import { Player } from "../models/Player";

export interface LoginResult {
  playerId: string;
  sessionId: string;
  staffId: string;
  name: string;
}

/**
 * Upserts the player by staffId (so a repeat visitor's name stays current)
 * and mints a fresh sessionId for this playthrough. There's no persisted
 * "session" document - sessionId is just an opaque correlation id the
 * frontend carries through to /api/scores/submit.
 */
export const loginPlayer = async (staffId: string, name: string): Promise<LoginResult> => {
  const normalizedStaffId = staffId.toUpperCase();

  const player = await Player.findOneAndUpdate(
    { staffId: normalizedStaffId },
    { staffId: normalizedStaffId, name },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const sessionId = nanoid();
  logger.info({ staffId: normalizedStaffId, sessionId }, "Player logged in");

  return {
    playerId: String(player._id),
    sessionId,
    staffId: player.staffId,
    name: player.name,
  };
};
