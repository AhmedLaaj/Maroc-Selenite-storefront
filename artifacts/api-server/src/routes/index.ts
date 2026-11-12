import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import healthRouter from "./health";
import publicRouter from "./public";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicRouter);
router.use("/admin", adminRouter);

export default router;
