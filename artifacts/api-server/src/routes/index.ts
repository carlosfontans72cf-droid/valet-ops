import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import configRouter from "./config";
import eventsRouter from "./events";
import shiftsRouter from "./shifts";
import ticketsRouter from "./tickets";
import parkingRouter from "./parking";
import accessCodesRouter from "./access-codes";
import exportRouter from "./export";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(configRouter);
router.use(eventsRouter);
router.use(shiftsRouter);
router.use(ticketsRouter);
router.use(parkingRouter);
router.use(accessCodesRouter);
router.use(exportRouter);

export default router;
