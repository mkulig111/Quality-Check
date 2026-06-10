import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import checksheetsRouter from "./checksheets";
import measurementsRouter from "./measurements";
import usersRouter from "./users";
import exportRouter from "./export";
import auditsRouter from "./audits";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(checksheetsRouter);
router.use(measurementsRouter);
router.use(usersRouter);
router.use(exportRouter);
router.use(auditsRouter);

export default router;
