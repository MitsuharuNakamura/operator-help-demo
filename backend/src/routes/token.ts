import { Router } from "express";
import { issueVoiceAccessToken, toSafeAgentId } from "../services/twilioClient.js";

export const tokenRouter = Router();

tokenRouter.post("/token", (req, res) => {
  const raw =
    (req.body?.identity as string) || (req.query.identity as string) || "";
  if (!raw) {
    res.status(400).json({ error: "identity required" });
    return;
  }
  const safeIdentity = toSafeAgentId(raw);
  try {
    const jwt = issueVoiceAccessToken(safeIdentity);
    res.json({ token: jwt, identity: safeIdentity });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
