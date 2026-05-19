const express = require("express");
const router = express.Router();
const {
  analyzeMeal,
  getHistory,
  updateWater,
} = require("../controllers/mealController");
const isAuth = require("../middlewares/isAuth");
const upload = require("../middlewares/upload");

// All meal routes are protected
router.use(isAuth);

router.post("/analyze", upload.single("image"), analyzeMeal);
router.get("/history/:date", getHistory);
router.patch("/water", updateWater);

module.exports = router;
