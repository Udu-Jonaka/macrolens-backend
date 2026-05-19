require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const errorHandler = require("./middlewares/errorHandler");

// Route imports
const authRoutes = require("./routes/authRoutes");
const mealRoutes = require("./routes/mealRoutes");

const app = express();

// Connect Database
connectDB();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/meals", mealRoutes);

// Root Health Check
app.get("/", (req, res) => {
  res
    .status(200)
    .json({ success: true, message: "Cal AI Backend System Online" });
});

// Centralized Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
