const express = require("express");
const router = express.Router();
const {
  analyzeMeal,
  analyzeTextMeal,
  logManualMeal,
  getHistory,
  updateWater,
  updateMeal,
  deleteMeal,
  getInsights,
  getAchievements,
} = require("../controllers/mealController");
const isAuth = require("../middlewares/isAuth");
const upload = require("../middlewares/upload");

router.use(isAuth);

router.post("/analyze", upload.single("image"), analyzeMeal);
router.post("/text", analyzeTextMeal);
router.post("/manual", logManualMeal); // <-- New direct-save route
router.get("/insights", getInsights);
router.get("/achievements", getAchievements);
router.get("/history/:date", getHistory);
router.patch("/water", updateWater);
router.put("/:date/:mealId", updateMeal);
router.delete("/:date/:mealId", deleteMeal);

module.exports = router;
