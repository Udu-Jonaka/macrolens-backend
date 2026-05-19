const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    profile: {
      age: { type: Number, required: true },
      weight: { type: Number, required: true }, // in kg
      height: { type: Number, required: true }, // in cm
      biologicalSex: { type: String, enum: ["male", "female"], required: true },
      activityLevel: {
        type: String,
        enum: ["sedentary", "light", "moderate", "active", "very_active"],
        required: true,
      },
      fitnessGoal: {
        type: String,
        enum: ["lose_weight", "maintain", "gain_weight"],
        required: true,
      },
    },
    dailyTargets: {
      calories: { type: Number, required: true },
      proteinGrams: { type: Number, required: true },
      carbsGrams: { type: Number, required: true },
      fatsGrams: { type: Number, required: true },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
