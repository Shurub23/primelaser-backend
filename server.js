const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();

/* =======================
   CONFIGURARE
======================= */
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

/* =======================
   MIDDLEWARE
======================= */
app.use(cors({
  origin: "*", // Poți restricționa mai târziu domeniile
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =======================
   CONEXIUNE MONGODB CU REÎNCERCARE
======================= */
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI nu este definit în variabilele de mediu");
    }
    
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log("✅ MongoDB conectat cu succes");
    
    // Handler pentru reconectare automată
    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB deconectat. Se încearcă reconectarea...");
      setTimeout(connectDB, 5000);
    });
    
  } catch (error) {
    console.error("❌ Eroare conexiune MongoDB:", error.message);
    console.log("⏳ Se reîncearcă conexiunea în 10 secunde...");
    setTimeout(connectDB, 10000);
  }
};

// Pornește conexiunea la MongoDB
connectDB();

/* =======================
   SCHEMA ȘI MODEL MONGODB
======================= */
const ContactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Numele este obligatoriu"],
    trim: true,
    maxlength: [100, "Numele nu poate depăși 100 de caractere"]
  },
  email: {
    type: String,
    required: [true, "Email-ul este obligatoriu"],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, "Te rog să introduci un email valid"]
  },
  message: {
    type: String,
    required: [true, "Mesajul este obligatoriu"],
    trim: true,
    maxlength: [2000, "Mesajul nu poate depăși 2000 de caractere"]
  },
  ipAddress: String,
  userAgent: String,
  createdAt: { 
    type: Date, 
    default: Date.now,
    expires: 60 * 60 * 24 * 365 // Expiră după 1 an (opțional)
  }
}, {
  timestamps: true
});

// Index pentru căutare rapidă
ContactSchema.index({ email: 1, createdAt: -1 });
ContactSchema.index({ createdAt: -1 });

const Contact = mongoose.model("Contact", ContactSchema);

/* =======================
   CONFIGURARE NODEMAILER
======================= */
let transporter;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initializeEmailService = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("⚠️ Variabilele pentru email nu sunt setate. Serviciul de email va fi dezactivat.");
    transporter = null;
    return;
  }
  
  try {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    // Test conexiune email
    transporter.verify((error) => {
      if (error) {
        console.error("❌ Eroare configurare Nodemailer:", error.message);
        transporter = null;
      } else {
        console.log("✅ Serviciul de email este gata");
      }
    });
  } catch (error) {
    console.error("❌ Eroare inițializare Nodemailer:", error.message);
    transporter = null;
  }
};

initializeEmailService();

/* =======================
   RUTE
======================= */

// 1. RUTA PRINCIPALĂ - PAGINĂ DE START
app.get("/", (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = dbStatus === 1 ? "CONECTAT" : "DECONECTAT";
  const dbColor = dbStatus === 1 ? "green" : "red";
  const emailStatus = transporter ? "ACTIV" : "INACTIV";
  const emailColor = transporter ? "green" : "orange";
  
  res.send(`
    <!DOCTYPE html>
    <html lang="ro">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PrimeLaser Cleaning - Backend</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        body {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        
        .container {
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          width: 100%;
          max-width: 900px;
          overflow: hidden;
        }
        
        .header {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: white;
          padding: 40px;
          text-align: center;
        }
        
        .header h1 {
          font-size: 2.5rem;
          margin-bottom: 10px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .header p {
          font-size: 1.2rem;
          opacity: 0.9;
        }
        
        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          padding: 40px;
        }
        
        .status-card {
          background: #f8f9fa;
          border-radius: 15px;
          padding: 25px;
          text-align: center;
          transition: transform 0.3s, box-shadow 0.3s;
          border: 2px solid #e9ecef;
        }
        
        .status-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        
        .status-icon {
          font-size: 3rem;
          margin-bottom: 15px;
        }
        
        .status-title {
          font-size: 1.2rem;
          color: #495057;
          margin-bottom: 10px;
          font-weight: 600;
        }
        
        .status-value {
          font-size: 1.5rem;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .online { color: #28a745; }
        .offline { color: #dc3545; }
        .warning { color: #ffc107; }
        
        .links {
          background: #f1f3f5;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #dee2e6;
        }
        
        .btn {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px 30px;
          border-radius: 50px;
          text-decoration: none;
          font-weight: bold;
          margin: 10px;
          transition: all 0.3s;
          border: none;
          cursor: pointer;
          font-size: 1rem;
        }
        
        .btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        
        .btn-secondary {
          background: #6c757d;
        }
        
        .btn-secondary:hover {
          background: #5a6268;
          box-shadow: 0 10px 20px rgba(108, 117, 125, 0.3);
        }
        
        .info {
          padding: 25px;
          background: #f8f9fa;
          border-radius: 15px;
          margin: 20px;
          font-size: 0.9rem;
          color: #6c757d;
        }
        
        .info h3 {
          color: #495057;
          margin-bottom: 15px;
        }
        
        .endpoint {
          background: #e9ecef;
          padding: 10px 15px;
          border-radius: 8px;
          margin: 5px 0;
          font-family: monospace;
          font-size: 0.9rem;
        }
        
        @media (max-width: 768px) {
          .header h1 { font-size: 2rem; }
          .status-grid { grid-template-columns: 1fr; }
          .btn { display: block; margin: 10px auto; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚀 PrimeLaser Backend</h1>
          <p>Serverul de backend pentru formularul de contact</p>
        </div>
        
        <div class="status-grid">
          <div class="status-card">
            <div class="status-icon">📊</div>
            <div class="status-title">Status Server</div>
            <div class="status-value online">ONLINE</div>
            <p>Serverul rulează fără probleme</p>
          </div>
          
          <div class="status-card">
            <div class="status-icon">🗄️</div>
            <div class="status-title">Baza de Date</div>
            <div class="status-value ${dbStatus === 1 ? 'online' : 'offline'}">${dbStatusText}</div>
            <p>${dbStatus === 1 ? 'Conexiune activă' : 'Conexiune indisponibilă'}</p>
          </div>
          
          <div class="status-card">
            <div class="status-icon">📧</div>
            <div class="status-title">Serviciu Email</div>
            <div class="status-value ${transporter ? 'online' : 'warning'}">${emailStatus}</div>
            <p>${transporter ? 'Gmail configurat' : 'Necesită configurare'}</p>
          </div>
          
          <div class="status-card">
            <div class="status-icon">⚡</div>
            <div class="status-title">Performanță</div>
            <div class="status-value online">${process.uptime().toFixed(0)}s</div>
            <p>Uptime server</p>
          </div>
        </div>
        
        <div class="info">
          <h3>📋 Informații tehnice</h3>
          <p><strong>Port:</strong> ${PORT}</p>
          <p><strong>Mediu:</strong> ${NODE_ENV}</p>
          <p><strong>Dată/Ora:</strong> ${new Date().toLocaleString('ro-RO')}</p>
          <p><strong>Memorie RAM:</strong> ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB</p>
          
          <h3 style="margin-top: 20px;">🔗 Endpoint-uri disponibile:</h3>
          <div class="endpoint">GET / - Această pagină</div>
          <div class="endpoint">GET /health - Health check (pentru UptimeRobot)</div>
          <div class="endpoint">POST /contact - Trimite mesaj (JSON)</div>
          <div class="endpoint">GET /api/contacts - Listă mesaje (debug)</div>
          <div class="endpoint">GET /test - Pagină de test</div>
        </div>
        
        <div class="links">
          <a href="/health" class="btn">🔍 Verifică Health Status</a>
          <a href="/test" class="btn">🧪 Testează Formularul</a>
          <a href="/api/contacts" class="btn-secondary">📋 Vezi Mesaje (Debug)</a>
          <a href="https://render.com" target="_blank" class="btn-secondary">🌐 Render Dashboard</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// 2. HEALTH CHECK - PENTRU UPTIMEROBOT
app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const healthStatus = dbStatus === 1 ? "healthy" : "unhealthy";
  const statusCode = dbStatus === 1 ? 200 : 503;
  
  const response = {
    status: healthStatus,
    service: "primelaser-backend",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      connected: dbStatus === 1,
      status: dbStatus === 1 ? "connected" : "disconnected"
    },
    email: {
      enabled: !!transporter,
      status: transporter ? "configured" : "not_configured"
    },
    environment: NODE_ENV,
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
    },
    version: "1.0.0"
  };
  
  res.status(statusCode).json(response);
});

// 3. PAGINA DE TEST
app.get("/test", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Formular - PrimeLaser</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: 40px auto;
          padding: 20px;
          background: #f5f5f5;
        }
        
        .form-container {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        input, textarea {
          width: 100%;
          padding: 12px;
          margin: 10px 0;
          border: 1px solid #ddd;
          border-radius: 5px;
          font-size: 16px;
        }
        
        button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px 30px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
          width: 100%;
          margin-top: 10px;
        }
        
        button:hover {
          opacity: 0.9;
        }
        
        #result {
          margin-top: 20px;
          padding: 15px;
          border-radius: 5px;
          display: none;
        }
        
        .success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        
        .error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
      </style>
    </head>
    <body>
      <div class="form-container">
        <h1>🧪 Test Formular de Contact</h1>
        <p>Completează formularul pentru a testa funcționalitatea:</p>
        
        <form id="contactForm">
          <input type="text" name="name" placeholder="Numele tău" required>
          <input type="email" name="email" placeholder="Email-ul tău" required>
          <textarea name="message" placeholder="Mesajul tău..." rows="5" required></textarea>
          <button type="submit">📨 Trimite Mesaj</button>
        </form>
        
        <div id="result"></div>
        
        <div style="margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
          <h3>🧠 Ce testează acest formular:</h3>
          <ul>
            <li>✅ Conexiunea la server</li>
            <li>✅ Validarea datelor</li>
            <li>✅ Salvarea în MongoDB</li>
            <li>${transporter ? '✅' : '⚠️'} Trimiterea email-ului</li>
            <li>✅ Răspunsul serverului</li>
          </ul>
        </div>
      </div>
      
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
          resultDiv.innerHTML = '<p>⏳ Se trimite mesajul...</p>';
          resultDiv.className = '';
          
          try {
            const response = await fetch('/contact', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
              resultDiv.className = 'success';
              resultDiv.innerHTML = \`
                <h3>✅ Success!</h3>
                <p>Mesajul a fost trimis cu succes!</p>
                <p><strong>ID:</strong> \${data.contactId || 'N/A'}</p>
                <p><strong>Status:</strong> \${data.message || 'Salvat în baza de date'}</p>
              \`;
              
              // Reset form
              e.target.reset();
            } else {
              resultDiv.className = 'error';
              resultDiv.innerHTML = \`
                <h3>❌ Eroare</h3>
                <p>\${data.error || 'Eroare necunoscută'}</p>
              \`;
            }
          } catch (error) {
            resultDiv.className = 'error';
            resultDiv.innerHTML = \`
              <h3>❌ Eroare de conexiune</h3>
              <p>Serverul nu a răspuns. Verifică:</p>
              <ul>
                <li>Conexiunea la internet</li>
                <li>Dacă serverul este online</li>
              </ul>
              <p><strong>Detalii:</strong> \${error.message}</p>
            \`;
          }
        });
      </script>
    </body>
    </html>
  `);
});

// 4. ENDPOINT PRINCIPAL PENTRU FORMULAR
app.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;
  
  // Date de diagnostic
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];
  
  // Validări
  if (!name || !email || !message) {
    return res.status(400).json({ 
      error: "Toate câmpurile sunt obligatorii",
      required: ["name", "email", "message"]
    });
  }
  
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      error: "Adresa de email nu este validă",
      received: email
    });
  }
  
  if (name.length > 100) {
    return res.status(400).json({ 
      error: "Numele nu poate depăși 100 de caractere",
      length: name.length
    });
  }
  
  if (message.length > 2000) {
    return res.status(400).json({ 
      error: "Mesajul nu poate depăși 2000 de caractere",
      length: message.length
    });
  }
  
  try {
    // Verifică conexiunea la MongoDB
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Baza de date nu este disponibilă");
    }
    
    // Creează și salvează contactul
    const contact = new Contact({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim(),
      ipAddress: clientIP,
      userAgent: userAgent
    });
    
    await contact.save();
    
    // Încearcă să trimiți email (dacă este configurat)
    let emailResult = null;
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"PrimeLaser Cleaning" <${process.env.EMAIL_USER}>`,
          to: process.env.EMAIL_USER,
          subject: `✉️ Mesaj nou de la: ${name}`,
          text: `
Nume: ${name}
Email: ${email}
IP: ${clientIP}
User Agent: ${userAgent}
Data: ${new Date().toLocaleString('ro-RO')}

Mesaj:
${message}
          `,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <h2 style="color: #667eea;">✉️ Mesaj nou de pe site</h2>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
                <p><strong>👤 Nume:</strong> ${name}</p>
                <p><strong>📧 Email:</strong> ${email}</p>
                <p><strong>🕒 Data:</strong> ${new Date().toLocaleString('ro-RO')}</p>
                <p><strong>🌐 IP:</strong> ${clientIP}</p>
              </div>
              <div style="margin-top: 20px; padding: 15px; background: #e9ecef; border-radius: 5px;">
                <h3>📝 Mesaj:</h3>
                <p>${message.replace(/\n/g, '<br>')}</p>
              </div>
            </div>
          `
        });
        emailResult = "sent";
      } catch (emailError) {
        console.error("❌ Eroare la trimiterea email-ului:", emailError.message);
        emailResult = "failed";
        // Continuăm chiar dacă email-ul eșuează
      }
    }
    
    // Răspuns de succes
    res.status(200).json({
      success: true,
      message: "Mesajul a fost primit și procesat",
      contactId: contact._id,
      email: emailResult,
      database: "saved",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ Eroare procesare contact:", error);
    
    res.status(500).json({
      error: "A apărut o eroare la procesarea mesajului",
      details: NODE_ENV === "development" ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// 5. ENDPOINT PENTRU DEBUG (securizat)
app.get("/api/contacts", async (req, res) => {
  // Verifică basic auth sau token (simplu pentru acum)
  const authToken = req.headers['x-debug-token'];
  if (authToken !== process.env.DEBUG_TOKEN && NODE_ENV === "production") {
    return res.status(401).json({ 
      error: "Neautorizat",
      message: "Token de debug necesar"
    });
  }
  
  try {
    const limit = parseInt(req.query.limit) || 10;
    const contacts = await Contact.find()
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 50))
      .select('name email message createdAt');
    
    res.json({
      success: true,
      count: contacts.length,
      total: await Contact.countDocuments(),
      contacts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. RUTĂ PENTRU VERIFICARE MONGO
app.get("/api/db-status", (req, res) => {
  const status = mongoose.connection.readyState;
  const statusMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };
  
  res.json({
    status: statusMap[status] || "unknown",
    code: status,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    models: Object.keys(mongoose.models)
  });
});

// 7. RUTĂ DE FALLBACK PENTRU ORICE ALTCEVA
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint negăsit",
    available: [
      "GET /",
      "GET /health",
      "GET /test",
      "POST /contact",
      "GET /api/contacts",
      "GET /api/db-status"
    ],
    timestamp: new Date().toISOString()
  });
});

// 8. HANDLER PENTRU ERORI GLOBALE
app.use((error, req, res, next) => {
  console.error("🔥 Eroare globală:", error);
  
  res.status(500).json({
    error: "Eroare internă a serverului",
    requestId: req.id || Date.now(),
    timestamp: new Date().toISOString()
  });
});

/* =======================
   PORNIRE SERVER
======================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`
  ========================================
  🚀 PRIMELASER BACKEND STARTED SUCCESSFULLY
  ========================================
  🌍 Server: http://localhost:${PORT}
  🔧 Environment: ${NODE_ENV}
  📡 Port: ${PORT}
  🗄️  MongoDB: ${mongoose.connection.readyState === 1 ? "✅ CONNECTED" : "❌ DISCONNECTED"}
  📧 Email Service: ${transporter ? "✅ ACTIVE" : "⚠️ INACTIVE"}
  ⏰ Uptime: ${process.uptime()} seconds
  ========================================
  
  🔗 Available endpoints:
  → GET  /           - Dashboard
  → GET  /health     - Health check (for UptimeRobot)
  → GET  /test       - Test form page
  → POST /contact    - Submit contact form
  → GET  /api/contacts - List messages (debug)
  → GET  /api/db-status - Database status
  
  ========================================
  `);
});

// Handler pentru shutdown curat
process.on("SIGTERM", () => {
  console.log("🔄 Received SIGTERM, shutting down gracefully...");
  mongoose.connection.close();
  process.exit(0);
});