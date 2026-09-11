import { Router } from "express";
import { loadJobs } from "../services/dataStore.js";

export const jobsRouter = Router();

jobsRouter.get("/jobs", (_req, res) => {
  res.json(loadJobs());
});
