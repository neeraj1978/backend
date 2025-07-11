const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { exec } = require("child_process");
const fileRoutes = require('./routes/fileRoutes');
const documentRoutes = require('./routes/documentRoutes');
require("dotenv").config();

// ── Mongoose connection ──
const mongoose = require("mongoose");

async function connectDB() {
  try {
     await mongoose.connect(process.env.MONGODB_URI);

    console.log("✅ MongoDB (via Mongoose) connected successfully.");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

// ── Auto-start MongoDB (replica-set) ──


// ── Initiate replica-set once (idempotent) ──
exec('mongosh --eval "rs.initiate()"', () => {});

// ── Express & Socket.io setup ──
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
global.io = io; // for proctoring sockets

app.use(cors());
app.use(express.json());

// Mount routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/bookings", require("./routes/bookingRoutes"));


app.use("/api/document", require("./routes/documentRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/tests", require("./routes/testRoutes"));
app.use("/api/proctor", require("./routes/proctorRoutes"));
app.use('/api/result', require('./routes/resultRoutes'));
app.use('/api/file', fileRoutes);          // For GET /api/file/:id
app.use('/api/document', documentRoutes);





// Health check
app.get("/", (_, res) => res.send("Server running ✅"));

// Start everything
const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
