module.exports = (err, req, res, next) => {
  console.error(`[Error] ${err.message}`);

  let statusCode = err.statusCode || 500;
  let errorMsg = err.message || "Internal Server Error";

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 400;
    errorMsg = "Duplicate field value entered.";
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    errorMsg = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  }

  res.status(statusCode).json({
    success: false,
    error: errorMsg,
  });
};
