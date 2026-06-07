const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const calculateMacros = require("../utils/calculateMacros");
const generatePin = require("../utils/generatePin");
const { sendVerificationEmail } = require("../services/email.service");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// REGISTER USER
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, profile, preferences } = req.body;

    // 1. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, error: "Email is already registered" });
    }

    // 2. Calculate Targets
    const dailyTargets = calculateMacros(profile);

    // 3. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Generate the 5-digit PIN
    const pin = generatePin();

    // 5. Create User (unverified)
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      verificationPin: pin,
      isVerified: false,
      profile,
      preferences,
      dailyTargets,
    });

    // 6. Send the email (non-blocking)
    sendVerificationEmail(email, pin).catch((err) =>
      console.error("Email Service Error:", err.message)
    );

    // 7. Send success response (no token yet — must verify first)
    res.status(201).json({
      success: true,
      message:
        "Registration successful. Please check your email for the verification PIN.",
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
};

// VERIFY PIN
exports.verifyPin = async (req, res, next) => {
  try {
    const { email, pin } = req.body;

    // 1. Find the user
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: "User not found" });
    }

    // 2. Check if already verified
    if (user.isVerified) {
      return res
        .status(400)
        .json({ success: false, error: "Account is already verified" });
    }

    // 3. Check if the PIN matches
    const incomingPin = String(pin).trim();
    const databasePin = String(user.verificationPin).trim();

    if (incomingPin !== databasePin) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid PIN" });
    }

    // 4. Success! Update user status
    user.isVerified = true;
    user.verificationPin = undefined;
    await user.save();

    // 5. Generate their token
    res.status(200).json({
      success: true,
      message: "Account verified successfully",
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        preferences: user.preferences,
        dailyTargets: user.dailyTargets,
      },
    });
  } catch (error) {
    next(error);
  }
};

// RESEND PIN
exports.resendPin = async (req, res, next) => {
  try {
    const { email } = req.body;

    // 1. Find the user
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: "User not found" });
    }

    // 2. Check if already verified
    if (user.isVerified) {
      return res
        .status(400)
        .json({ success: false, error: "Account is already verified" });
    }

    // 3. Generate a new PIN and save it
    const pin = generatePin();
    user.verificationPin = pin;
    await user.save();

    // 4. Send the new verification email
    await sendVerificationEmail(email, pin);

    res
      .status(200)
      .json({ success: true, message: "A new PIN has been sent to your email" });
  } catch (error) {
    next(error);
  }
};

// LOGIN
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    }

    // Enforce email verification
    if (!user.isVerified) {
      return res
        .status(403)
        .json({ success: false, error: "Please verify your email to log in" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    }

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        preferences: user.preferences,
        dailyTargets: user.dailyTargets,
      },
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE PROFILE
exports.updateProfile = async (req, res, next) => {
  try {
    const { weight, height, age, activityLevel, fitnessGoal, unitSystem } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Update fields if provided
    if (weight !== undefined) user.profile.weight = weight;
    if (height !== undefined) user.profile.height = height;
    if (age !== undefined) user.profile.age = age;
    if (activityLevel !== undefined) user.profile.activityLevel = activityLevel;
    if (fitnessGoal !== undefined) user.profile.fitnessGoal = fitnessGoal;
    
    if (unitSystem !== undefined) {
      if (!user.preferences) user.preferences = {};
      user.preferences.unitSystem = unitSystem;
    }

    // Recalculate daily targets based on new profile
    const newTargets = calculateMacros(user.profile);
    user.dailyTargets = newTargets;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        preferences: user.preferences,
        dailyTargets: user.dailyTargets,
      },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE ACCOUNT
exports.deleteAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // We can also delete their meal logs here
    const MealLog = require("../models/MealLog");
    await MealLog.deleteMany({ userId: user._id });

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: "Account and associated data deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
