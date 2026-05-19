/**
 * Calculates BMR, TDEE, and Macro distributions based on physical attributes.
 */
const calculateMacros = (profile) => {
  const { age, weight, height, biologicalSex, activityLevel, fitnessGoal } =
    profile;

  // 1. Calculate Basal Metabolic Rate (BMR) using Harris-Benedict Equation
  let bmr;
  if (biologicalSex === "male") {
    bmr = 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age;
  } else {
    bmr = 447.593 + 9.247 * weight + 3.098 * height - 4.33 * age;
  }

  // 2. Calculate Total Daily Energy Expenditure (TDEE)
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const tdee = bmr * (activityMultipliers[activityLevel] || 1.2);

  // 3. Adjust for Fitness Goal
  let targetCalories;
  switch (fitnessGoal) {
    case "lose_weight":
      targetCalories = tdee - 500;
      break;
    case "gain_weight":
      targetCalories = tdee + 300;
      break;
    case "maintain":
    default:
      targetCalories = tdee;
      break;
  }

  // Ensure calories don't drop to dangerous levels
  targetCalories = Math.max(
    targetCalories,
    biologicalSex === "male" ? 1500 : 1200,
  );

  // 4. Calculate Macros
  // Protein: 2g per kg of body weight (4 kcal/g)
  const proteinGrams = Math.round(weight * 2);
  const proteinCalories = proteinGrams * 4;

  // Fats: 25% of total target calories (9 kcal/g)
  const fatCalories = targetCalories * 0.25;
  const fatsGrams = Math.round(fatCalories / 9);

  // Carbs: Remainder of calories (4 kcal/g)
  const remainingCalories = targetCalories - proteinCalories - fatCalories;
  const carbsGrams = Math.max(Math.round(remainingCalories / 4), 0);

  return {
    calories: Math.round(targetCalories),
    proteinGrams,
    carbsGrams,
    fatsGrams,
  };
};

module.exports = calculateMacros;
