import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../logger/logger";
import { AppError } from "../utils/AppError";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = "Internal server error";

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = err.issues.map((issue) => issue.message).join(", ");
  } else if (err instanceof Error) {
    message = err.message;
  }

  const logPayload = { err, method: req.method, url: req.originalUrl };
  if (statusCode >= 500) {
    logger.error(logPayload, message);
  } else {
    logger.warn(logPayload, message);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};
