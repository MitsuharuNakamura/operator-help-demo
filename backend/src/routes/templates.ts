import { Router } from "express";
import {
  loadChecklistTemplate,
  loadTalklistTemplate,
} from "../services/dataStore.js";

export const templatesRouter = Router();

templatesRouter.get("/templates/checklist", (_req, res) => {
  res.json(loadChecklistTemplate());
});

templatesRouter.get("/templates/talklist", (_req, res) => {
  res.json(loadTalklistTemplate());
});
