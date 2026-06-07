// Using Brevo's HTTP API instead of SMTP to bypass Render's port blocking
const axios = require("axios");

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const sendVerificationEmail = async (userEmail, pin) => {
  try {
    const emailData = {
      sender: {
        name: "MacroLens App",
        email: process.env.BREVO_USER,
      },
      to: [{ email: userEmail }],
      subject: "Verify your MacroLens Account",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
          <h2>Welcome to MacroLens!</h2>
          <p>We are excited to have you. Please use the PIN below to verify your account:</p>
          <h1 style="color: #4A90E2; letter-spacing: 5px;">${pin}</h1>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `,
    };

    await axios.post(BREVO_API_URL, emailData, {
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
      },
    });

    console.log(`Verification email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending email:", error.response?.data || error.message);
    throw new Error("Could not send verification email");
  }
};

module.exports = { sendVerificationEmail };
