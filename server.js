const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectat"))
  .catch(err => console.error(err));

const ContactSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  createdAt: { type: Date, default: Date.now }
});

const Contact = mongoose.model("Contact", ContactSchema);

// Email validation regex pattern
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;

  // Check for missing fields
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Date lipsă" });
  }

  // Validate email format
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Format email invalid" });
  }

  try {
    const contact = new Contact({ name, email, message });
    await contact.save();
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Eroare server" });
  }
});

app.listen(5000, () => console.log("Server pornit pe port 5000"));
