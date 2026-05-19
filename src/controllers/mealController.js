const cloudinary = require("../config/cloudinary");
const ai = require("../config/gemini");
const MealLog = require("../models/MealLog");
const { analyzeMealPrompt } = require("../utils/prompts");

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
    // Determine today's date string based on user's timezone (using UTC for standard backend)
    const dateString = new Date().toISOString().split("T")[0];

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
      return res
        .status(400)
        .json({
          success: false,
          error: "Provide valid date (YYYY-MM-DD) and amountMl",
        });
    }

    const updatedLog = await MealLog.findOneAndUpdate(
      { userId: req.user._id, date },
      { $inc: { waterIntake: amountMl } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    res.status(200).json({ success: true, data: updatedLog });
  } catch (error) {
    next(error);
  }
};
