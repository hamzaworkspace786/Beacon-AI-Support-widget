import { randomBytes } from "node:crypto";

/**
 * The public id of a bot, like bot_9f2c4a1b7e3d5c6a8b01. It is safe to put in
 * a website's embed code: it only says which bot to talk to and grants no
 * access to the dashboard. 80 random bits make it impossible to guess.
 */
export function generatePublicId(): string {
  return `bot_${randomBytes(10).toString("hex")}`;
}
