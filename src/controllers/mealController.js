const cloudinary = require("../config/cloudinary");
const ai = require("../config/gemini");
const MealLog = require("../models/MealLog");
const { analyzeMealPrompt, analyzeTextPrompt } = require("../utils/prompts");

/**
 * Returns today's date in YYYY-MM-DD using the server's local timezone.
 * Used as a fallback when the client doesn't send a date.
 */
const getLocalDate = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

exports.analyzeMeal = async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "Please upload an image file" });
    }

    const { mealType } = req.body;
    if (!["breakfast", "lunch", "dinner", "snack"].includes(mealType)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or missing mealType" });
    }

    // 1. Upload Buffer directly to Cloudinary via stream
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "cal-ai-meals" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      stream.end(req.file.buffer);
    });

    // 2. Call Gemini Vision AI for analysis using inline buffer
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        analyzeMealPrompt,
        {
          inlineData: {
            data: req.file.buffer.toString("base64"),
            mimeType: req.file.mimetype,
          },
        },
      ],
    });

    // Parse AI response safely (stripping residual markdown if AI disobeys prompt)
    let aiText = response.text.trim();
    aiText = aiText
      .replace(/^```json/, "")
      .replace(/```$/, "")
      .trim();

    let aiData;
    try {
      aiData = JSON.parse(aiText);
    } catch (err) {
      throw new Error("AI returned malformed data. Please try again.");
    }

    // 3. Save to Database
    // Use client-provided date (local timezone) or fall back to server local date
    const dateString = req.body.date || getLocalDate();

    const newMeal = {
      mealType,
      imageUrl: uploadResult.secure_url,
      macros: {
        calories: aiData.totalCalories,
        protein: aiData.proteinGrams,
        carbs: aiData.carbsGrams,
        fats: aiData.fatsGrams,
      },
      identifiedItems: aiData.identifiedItems,
    };

    const updatedLog = await MealLog.findOneAndUpdate(
      { userId: req.user._id, date: dateString },
      {
        $push: { meals: newMeal },
        $inc: {
          totalCalories: aiData.totalCalories,
          totalProtein: aiData.proteinGrams,
          totalCarbs: aiData.carbsGrams,
          totalFats: aiData.fatsGrams,
        },
      },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
    );

    res.status(200).json({ success: true, data: updatedLog });
  } catch (error) {
    // Log the full error for debugging
    console.error("[analyzeMeal]", JSON.stringify(error?.response?.data || error?.message || error));

    // Return user-friendly messages for known Gemini API errors
    const status = error?.response?.status || error?.status || error?.error?.code;
    if (status === 503 || status === 429) {
      return res.status(503).json({
        success: false,
        error: "Our AI service is temporarily busy. Please try again in a moment.",
      });
    }

    next(error);
  }
};

exports.analyzeTextMeal = async (req, res, next) => {
  try {
    const { mealType, text } = req.body;

    if (!["breakfast", "lunch", "dinner", "snack"].includes(mealType)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or missing mealType" });
    }

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Please provide a valid meal description",
      });
    }

    // Call Gemini API with the text payload
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [analyzeTextPrompt, { text: text }],
    });

    // Parse AI response safely
    let aiText = response.text.trim();
    aiText = aiText
      .replace(/^```json/, "")
      .replace(/```$/, "")
      .trim();

    let aiData;
    try {
      aiData = JSON.parse(aiText);
    } catch (err) {
      throw new Error("AI returned malformed data. Please try again.");
    }

    const dateString = req.body.date || getLocalDate();

    // Format the new meal (imageUrl is null for text-based entries)
    const newMeal = {
      mealType,
      imageUrl: null,
      macros: {
        calories: aiData.totalCalories,
        protein: aiData.proteinGrams,
        carbs: aiData.carbsGrams,
        fats: aiData.fatsGrams,
      },
      identifiedItems: aiData.identifiedItems,
    };

    const updatedLog = await MealLog.findOneAndUpdate(
      { userId: req.user._id, date: dateString },
      {
        $push: { meals: newMeal },
        $inc: {
          totalCalories: aiData.totalCalories,
          totalProtein: aiData.proteinGrams,
          totalCarbs: aiData.carbsGrams,
          totalFats: aiData.fatsGrams,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    res.status(200).json({ success: true, data: updatedLog });
  } catch (error) {
    // Log the full error for debugging
    console.error("[analyzeTextMeal]", JSON.stringify(error?.response?.data || error?.message || error));

    // Return user-friendly messages for known Gemini API errors
    const status = error?.response?.status || error?.status || error?.error?.code;
    if (status === 503 || status === 429) {
      return res.status(503).json({
        success: false,
        error: "Our AI service is temporarily busy. Please try again in a moment.",
      });
    }

    next(error);
  }
};

exports.logManualMeal = async (req, res, next) => {
  try {
    const { mealType, calories, protein, carbs, fats, identifiedItems } =
      req.body;

    if (!["breakfast", "lunch", "dinner", "snack"].includes(mealType)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or missing mealType" });
    }

    // Validate that we received numbers for the macros
    if (
      [calories, protein, carbs, fats].some((val) => typeof val !== "number")
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Macros must be valid numbers" });
    }

    const dateString = req.body.date || getLocalDate();

    const newMeal = {
      mealType,
      imageUrl: null,
      macros: { calories, protein, carbs, fats },
      identifiedItems: Array.isArray(identifiedItems) ? identifiedItems : [],
    };

    const updatedLog = await MealLog.findOneAndUpdate(
      { userId: req.user._id, date: dateString },
      {
        $push: { meals: newMeal },
        $inc: {
          totalCalories: calories,
          totalProtein: protein,
          totalCarbs: carbs,
          totalFats: fats,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    res.status(200).json({ success: true, data: updatedLog });
  } catch (error) {
    next(error);
  }
};

exports.getHistory = async (req, res, next) => {
  try {
    const { date } = req.params;

    // Regex check for YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid date format. Use YYYY-MM-DD" });
    }

    let log = await MealLog.findOne({ userId: req.user._id, date });

    // Return an empty template structure if no data exists for the requested date
    if (!log) {
      log = {
        userId: req.user._id,
        date,
        meals: [],
        waterIntake: 0,
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFats: 0,
      };
    }

    res.status(200).json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

exports.updateWater = async (req, res, next) => {
  try {
    const { date, amountMl } = req.body;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof amountMl !== "number") {
      return res.status(400).json({
        success: false,
        error: "Provide valid date (YYYY-MM-DD) and amountMl",
      });
    }

    const updatedLog = await MealLog.findOneAndUpdate(
      { userId: req.user._id, date },
      { $inc: { waterIntake: amountMl } },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
    );

    res.status(200).json({ success: true, data: updatedLog });
  } catch (error) {
    next(error);
  }
};

exports.updateMeal = async (req, res, next) => {
  try {
    const { date, mealId } = req.params;
    const { mealType, calories, protein, carbs, fats } = req.body;

    if (!["breakfast", "lunch", "dinner", "snack"].includes(mealType)) {
      return res.status(400).json({ success: false, error: "Invalid mealType" });
    }

    if ([calories, protein, carbs, fats].some((val) => typeof val !== "number")) {
      return res.status(400).json({ success: false, error: "Macros must be valid numbers" });
    }

    const log = await MealLog.findOne({ userId: req.user._id, date });
    if (!log) return res.status(404).json({ success: false, error: "Log not found" });

    const meal = log.meals.id(mealId);
    if (!meal) return res.status(404).json({ success: false, error: "Meal not found" });

    // Calculate diffs
    const diffCal = calories - meal.macros.calories;
    const diffPro = protein - meal.macros.protein;
    const diffCarb = carbs - meal.macros.carbs;
    const diffFat = fats - meal.macros.fats;

    // Update meal
    meal.mealType = mealType;
    meal.macros = { calories, protein, carbs, fats };

    // Update totals
    log.totalCalories += diffCal;
    log.totalProtein += diffPro;
    log.totalCarbs += diffCarb;
    log.totalFats += diffFat;

    await log.save();

    res.status(200).json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

exports.deleteMeal = async (req, res, next) => {
  try {
    const { date, mealId } = req.params;

    const log = await MealLog.findOne({ userId: req.user._id, date });
    if (!log) return res.status(404).json({ success: false, error: "Log not found" });

    const meal = log.meals.id(mealId);
    if (!meal) return res.status(404).json({ success: false, error: "Meal not found" });

    // Deduct macros
    log.totalCalories -= meal.macros.calories;
    log.totalProtein -= meal.macros.protein;
    log.totalCarbs -= meal.macros.carbs;
    log.totalFats -= meal.macros.fats;

    // Remove meal
    meal.deleteOne();
    await log.save();

    res.status(200).json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

exports.getInsights = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7;
    
    // Generate array of last N days in YYYY-MM-DD
    const dateArray = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dateArray.push(d.toISOString().split('T')[0]);
    }

    const logs = await MealLog.find({
      userId: req.user._id,
      date: { $in: dateArray }
    }).lean();

    // Create a map for quick lookup
    const logMap = {};
    logs.forEach(log => {
      logMap[log.date] = log;
    });

    // Ensure all days are returned in order, even if missing
    const data = dateArray.map(date => {
      const log = logMap[date] || {};
      return {
        date,
        totalCalories: log.totalCalories || 0,
        totalProtein: log.totalProtein || 0,
        totalCarbs: log.totalCarbs || 0,
        totalFats: log.totalFats || 0
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getAchievements = async (req, res, next) => {
  try {
    const logs = await MealLog.find({ userId: req.user._id }).sort({ date: 1 }).lean();
    
    let achievements = {
      1: false, // First Scan
      2: false, // Iron Will
      3: false, // Hydration King
      4: false, // Early Bird
      5: false, // Perfect Week
      6: false, // Master Chef
    };

    let ironWillStreak = 0;
    let hydrationStreak = 0;
    let earlyBirdStreak = 0;
    let perfectWeekStreak = 0;
    let manualMealsCount = 0;

    let lastDate = null;
    const dailyTargets = req.user.dailyTargets || { proteinGrams: 100, calories: 2000 };
    const todayStr = new Date().toISOString().split('T')[0];

    for (let log of logs) {
      const currentDate = new Date(log.date);

      // Check if consecutive day
      let isConsecutive = false;
      if (lastDate) {
        const diffTime = Math.abs(currentDate - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) isConsecutive = true;
      } else {
        isConsecutive = true;
      }

      // 1: First Scan
      if (!achievements[1]) {
        const hasScan = log.meals.some((m) => m.imageUrl);
        if (hasScan) achievements[1] = true;
      }

      // 6: Master Chef
      if (!achievements[6]) {
        const manualCount = log.meals.filter(
          (m) => !m.imageUrl && (!m.identifiedItems || m.identifiedItems.length === 0)
        ).length;
        manualMealsCount += manualCount;
        if (manualMealsCount >= 10) achievements[6] = true;
      }

      // Reset streaks if not consecutive
      if (!isConsecutive) {
        ironWillStreak = 0;
        hydrationStreak = 0;
        earlyBirdStreak = 0;
        perfectWeekStreak = 0;
      }

      // 2: Iron Will (3 days protein)
      if (!achievements[2]) {
        if (log.totalProtein >= dailyTargets.proteinGrams) {
          ironWillStreak++;
          if (ironWillStreak >= 3) achievements[2] = true;
        } else {
          ironWillStreak = 0;
        }
      }

      // 3: Hydration King (Daily goal: water >= 2000ml today)
      // This resets every day, so we only check if the log's date is today.
      if (log.date === todayStr) {
        achievements[3] = (log.waterIntake || 0) >= 2000;
      }

      // 4: Early Bird (7 days breakfast before 9 AM)
      if (!achievements[4]) {
        const hasEarlyBreakfast = log.meals.some((m) => {
          if (m.mealType === "breakfast" && m.timestamp) {
            const hour = new Date(m.timestamp).getHours();
            return hour < 9;
          }
          return false;
        });
        
        if (hasEarlyBreakfast) {
          earlyBirdStreak++;
          if (earlyBirdStreak >= 7) achievements[4] = true;
        } else {
          earlyBirdStreak = 0;
        }
      }

      // 5: Perfect Week (7 days macros perfectly, ~10% of calories)
      if (!achievements[5]) {
        const calTarget = dailyTargets.calories;
        if (log.totalCalories >= calTarget * 0.9 && log.totalCalories <= calTarget * 1.1) {
          perfectWeekStreak++;
          if (perfectWeekStreak >= 7) achievements[5] = true;
        } else {
          perfectWeekStreak = 0;
        }
      }

      lastDate = currentDate;
    }

    res.status(200).json({ success: true, data: achievements });
  } catch (error) {
    next(error);
  }
};
