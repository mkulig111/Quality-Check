import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import checksheetsRouter from "./checksheets";
import measurementsRouter from "./measurements";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(checksheetsRouter);
router.use(measurementsRouter);
router.use(usersRouter);

export default router;
