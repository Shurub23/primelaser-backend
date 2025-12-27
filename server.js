const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();

/* =======================
   MIDDLEWARE
======================= */
app.use(cors());
app.use(express.json());

/* =======================
   MONGODB
======================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectat cu succes"))
  .catch((err) => console.error("❌ Eroare MongoDB:", err));

const ContactSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
});

const Contact = mongoose.model("Contact", ContactSchema);

/* =======================
   EMAIL (NODEMAILER)
======================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* =======================
   VALIDARE EMAIL
======================= */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* =======================
   ROUTE PRINCIPALĂ (PENTRU BROWSER)
======================= */
app.get("/", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "CONECTAT" : "DECONECTAT";
  const dbColor = mongoose.connection.readyState === 1 ? "green" : "red";
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>PrimeLaser Backend</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          text-align: center;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #2c3e50; }
        .status { 
          font-weight: bold;
          padding: 10px;
          border-radius: 5px;
          display: inline-block;
          margin: 10px;
        }
        .connected { background: #d4edda; color: #155724; }
        .disconnected { background: #f8d7da; color: #721c24; }
        .links a {
          display: inline-block;
          margin: 10px;
          padding: 10px 20px;
          background: #3498db;
          color: white;
          text-decoration: none;
          border-radius: 5px;
        }
        .links a:hover { background: #2980b9; }
        .info { 
          margin-top: 30px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 5px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Serverul PrimeLaser este funcțional!</h1>
        
        <div class="info">
          <h3>Status MongoDB:</h3>
          <div class="status ${mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'}">
            ${dbStatus}
          </div>
        </div>
        
        <div class="info">
          <h3>🔗 Linkuri utile:</h3>
          <div class="links">
            <a href="/health">Health Check (pentru UptimeRobot)</a>
            <a href="/test-contact">Testează formularul</a>
          </div>
        </div>
        
        <div class="info">
          <h3>📊 Informații server:</h3>
          <p><strong>Dată/Oră:</strong> ${new Date().toLocaleString('ro-RO')}</p>
          <p><strong>Port:</strong> ${process.env.PORT || 5000}</p>
          <p><strong>Uptime:</strong> ${process.uptime().toFixed(0)} secunde</p>
          <p><strong>Mediu:</strong> ${process.env.NODE_ENV || 'development'}</p>
        </div>
        
        <div class="info">
          <h3>📨 Endpoint formular:</h3>
          <p><code>POST ${req.protocol}://${req.get('host')}/contact</code></p>
          <p>Trimite: { "name": "...", "email": "...", "message": "..." }</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

/* =======================
   HEALTH CHECK (PENTRU UPTIMEROBOT)
======================= */
app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  
  res.json({
    status: "OK",
    service: "PrimeLaser Backend",
    database: dbStatus,
    serverTime: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    memoryUsage: process.memoryUsage(),
  });
});

/* =======================
   ROUTE PENTRU TEST FORMULAR (PAGINĂ SIMPLĂ)
======================= */
app.get("/test-contact", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Formular Contact - PrimeLaser</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          max-width: 600px;
          margin: 0 auto;
        }
        input, textarea {
          width: 100%;
          padding: 10px;
          margin: 10px 0;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        button {
          background: #3498db;
          color: white;
          padding: 12px 25px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
        }
        button:hover { background: #2980b9; }
        #result {
          margin-top: 20px;
          padding: 15px;
          border-radius: 5px;
          display: none;
        }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
      </style>
    </head>
    <body>
      <h1>Testează formularul de contact</h1>
      <p>Completează formularul pentru a testa conexiunea la MongoDB și trimiterea email-ului.</p>
      
      <form id="contactForm">
        <input type="text" name="name" placeholder="Nume" required>
        <input type="email" name="email" placeholder="Email" required>
        <textarea name="message" placeholder="Mesajul tău..." rows="4" required></textarea>
        <button type="submit">Trimite mesaj</button>
      </form>
      
      <div id="result"></div>
      
      <script>
        document.getElementById('contactForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const formData = {
            name: e.target.name.value,
            email: e.target.email.value,
            message: e.target.message.value
          };
          
          const resultDiv = document.getElementById('result');
          resultDiv.style.display = 'block';
          resultDiv.innerHTML = '<p>Se trimite...</p>';
          
          try {
            const response = await fetch('/contact', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
              resultDiv.className = 'success';
              resultDiv.innerHTML = 
                '<h3>✅ Mesaj trimis cu succes!</h3>' +
                '<p>Mesajul a fost salvat în MongoDB și un email a fost trimis.</p>';
              
              // Golește formularul
              e.target.reset();
            } else {
              resultDiv.className = 'error';
              resultDiv.innerHTML = 
                '<h3>❌ Eroare</h3>' +
                '<p>' + (result.error || 'Eroare necunoscută') + '</p>';
            }
            
          } catch (error) {
            resultDiv.className = 'error';
            resultDiv.innerHTML = 
              '<h3>❌ Eroare de conexiune</h3>' +
              '<p>Verifică conexiunea la internet sau serverul.</p>' +
              '<p>Detalii: ' + error.message + '</p>';
          }
        });
      </script>
      
      <p style="margin-top: 30px; color: #666;">
        <strong>Notă:</strong> Acest formular testează:
        1. Conexiunea la MongoDB
        2. Salvarea datelor în baza de date
        3. Trimiterea email-ului prin Nodemailer
      </p>
    </body>
    </html>
  `);
});

/* =======================
   ROUTE CONTACT (ORIGINAL - NU SCHIMBA)
======================= */
app.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;

  // Validări
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Date lipsă" });
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Format email invalid" });
  }

  try {
    // 1️⃣ Salvare în MongoDB
    const contact = new Contact({ name, email, message });
    await contact.save();

    // 2️⃣ Trimitere email către tine
    await transporter.sendMail({
      from: `"PrimeLaser Cleaning" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: "Mesaj nou de pe site",
      text: `
Ai primit un mesaj nou de pe site:

Nume: ${name}
Email: ${email}

Mesaj:
${message}
      `,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

/* =======================
   ROUTE PENTRU A VEDEA TOATE MESAJELE (OPTIONAL)
======================= */
app.get("/api/contacts", async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 }).limit(20);
    res.json({ 
      success: true, 
      count: contacts.length,
      contacts 
    });
  } catch (err) {
    res.status(500).json({ error: "Eroare la obținerea mesajelor" });
  }
});

/* =======================
   SERVER (MODIFICAT PENTRU RENDER)
======================= */
// PORT PENTRU RENDER - NU MODIFICA ACEST COD!
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("========================================");
  console.log("🚀 Serverul PrimeLaser a pornit!");
  console.log(`📡 Port: ${PORT}`);
  console.log(`🗄️  MongoDB: ${mongoose.connection.readyState === 1 ? "CONECTAT" : "DECONECTAT"}`);
  console.log(`🌍 Accesează: http://localhost:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`📨 Test Formular: http://localhost:${PORT}/test-contact`);
  console.log("========================================");
});