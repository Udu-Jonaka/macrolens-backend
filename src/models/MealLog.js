const mongoose = require("mongoose");

const mealEntrySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  mealType: {
    type: String,
    enum: ["breakfast", "lunch", "dinner", "snack"],
    required: true,
  },
  imageUrl: { type: String },
  macros: {
    calories: { type: Number, required: true, default: 0 },
    protein: { type: Number, required: true, default: 0 },
    carbs: { type: Number, required: true, default: 0 },
    fats: { type: Number, required: true, default: 0 },
  },
  identifiedItems: [{ type: String }],
});

// To fulfill front-end expectations, ensure id is mapped correctly
mealEntrySchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
  },
});

const mealLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/, // Enforce YYYY-MM-DD
    },
    meals: [mealEntrySchema],
    waterIntake: { type: Number, default: 0 }, // in ml
    // Accumulated totals for the day for quick fetching
    totalCalories: { type: Number, default: 0 },
    totalProtein: { type: Number, default: 0 },
    totalCarbs: { type: Number, default: 0 },
    totalFats: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Compound index to ensure one log per user per day and fast queries
mealLogSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("MealLog", mealLogSchema);
