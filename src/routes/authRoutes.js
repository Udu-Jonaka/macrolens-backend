const express = require("express");
const router = express.Router();
const { register, verifyPin, resendPin, login, updateProfile, deleteAccount } = require("../controllers/authController");
const isAuth = require("../middlewares/isAuth");

router.post("/register", register);
router.post("/verify-email", verifyPin);
router.post("/resend-pin", resendPin);
router.post("/login", login);
router.put("/profile", isAuth, updateProfile);
router.delete("/profile", isAuth, deleteAccount);

module.exports = router;
