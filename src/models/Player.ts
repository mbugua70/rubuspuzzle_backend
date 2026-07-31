import { Document, Schema, model } from "mongoose";

export interface PlayerDocument extends Document {
  staffId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const playerSchema = new Schema<PlayerDocument>(
  {
    staffId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const Player = model<PlayerDocument>("Player", playerSchema, "players");
