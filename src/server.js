require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const connectDB = require("./config/db");
const errorHandler = require("./middlewares/errorHandler");

// Route imports
const authRoutes = require("./routes/authRoutes");
const mealRoutes = require("./routes/mealRoutes");

const app = express();

// Connect Database
connectDB();

// Global Middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/meals", mealRoutes);

// Root Health Check
app.get("/", (req, res) => {
  res
    .status(200)
    .json({ success: true, message: "MacroLens Backend Online" });
});

// Keep-alive endpoint for cron jobs (Render free tier)
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Centralized Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
