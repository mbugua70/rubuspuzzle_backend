import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./logger/logger";

const app = createApp();
const server = http.createServer(app);

server.listen(env.PORT, () => {
  logger.info(`Server started on port ${env.PORT} (${env.NODE_ENV})`);
});
