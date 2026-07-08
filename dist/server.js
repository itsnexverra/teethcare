// server.js
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import mongoose from "mongoose";
import crypto from "crypto";
var app = express();
var PORT = 3e3;
app.use(express.json());
var MONGODB_URI = "mongodb+srv://itsnexverra_db_user:G5LoVUS0Y0j2iAqH@cluster0.qs4cykc.mongodb.net/?appName=Cluster0";
mongoose.connect(MONGODB_URI).then(() => {
  console.log("Connected to MongoDB Atlas successfully.");
  seedAdmin();
}).catch((err) => {
  console.error("MongoDB connection error:", err);
});
var SALT = "teethcare_secret_salt_987123";
function hashPassword(password) {
  return crypto.pbkdf2Sync(password, SALT, 1e3, 64, "sha512").toString("hex");
}
var UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, default: "" },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  createdAt: { type: Date, default: Date.now }
});
var User = mongoose.model("User", UserSchema);
var AppointmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});
var Appointment = mongoose.model("Appointment", AppointmentSchema);
var ChatMessageSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String, required: true },
  sender: { type: String, enum: ["user", "admin"], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});
var ChatMessage = mongoose.model("ChatMessage", ChatMessageSchema);
async function seedAdmin() {
  try {
    const adminEmail = "admin@teethcare.com";
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const adminPass = hashPassword("admin123");
      const newAdmin = new User({
        name: "TeethCare Admin",
        email: adminEmail,
        password: adminPass,
        phone: "+1 1234567890",
        role: "admin"
      });
      await newAdmin.save();
      console.log("Default admin account successfully seeded (admin@teethcare.com / admin123).");
    }
  } catch (error) {
    console.error("Error seeding default admin:", error);
  }
}
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required." });
    }
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password: hashPassword(password),
      phone: phone || "",
      role: "user"
    });
    await newUser.save();
    return res.status(201).json({
      message: "Registration successful!",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ error: "Internal server error during registration." });
  }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    if (user.password !== hashPassword(password)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    return res.json({
      message: "Login successful!",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error during login." });
  }
});
app.post("/api/appointments", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !phone || !message) {
      return res.status(400).json({ error: "All fields are required." });
    }
    const newAppointment = new Appointment({ name, email, phone, message });
    await newAppointment.save();
    const userEmail = email.toLowerCase();
    const existingUser = await User.findOne({ email: userEmail });
    let accountCreated = false;
    let tempPassword = "teethcare123";
    if (!existingUser) {
      const newUser = new User({
        name,
        email: userEmail,
        password: hashPassword(tempPassword),
        phone,
        role: "user"
      });
      await newUser.save();
      accountCreated = true;
    }
    return res.status(201).json({
      message: "Appointment scheduled successfully!",
      appointment: newAppointment,
      accountCreated,
      tempPassword: accountCreated ? tempPassword : null
    });
  } catch (error) {
    console.error("Error creating appointment:", error);
    return res.status(500).json({ error: "Failed to create appointment." });
  }
});
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
    return res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ error: "Failed to fetch users." });
  }
});
app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    return res.json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ error: "Failed to delete user." });
  }
});
app.get("/api/appointments", async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({ timestamp: -1 });
    return res.json(appointments);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return res.status(500).json({ error: "Failed to fetch appointments." });
  }
});
app.get("/api/chats/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const chats = await ChatMessage.find({ email: email.toLowerCase() }).sort({ timestamp: 1 });
    return res.json(chats);
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return res.status(500).json({ error: "Failed to fetch chat history." });
  }
});
app.post("/api/chats", async (req, res) => {
  try {
    const { email, name, sender, text } = req.body;
    if (!email || !name || !sender || !text) {
      return res.status(400).json({ error: "All chat message fields are required." });
    }
    const newMessage = new ChatMessage({
      email: email.toLowerCase(),
      name,
      sender,
      text,
      read: sender === "admin" ? true : false
    });
    await newMessage.save();
    return res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error sending chat message:", error);
    return res.status(500).json({ error: "Failed to send message." });
  }
});
app.get("/api/chats-sessions", async (req, res) => {
  try {
    const sessions = await ChatMessage.aggregate([
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: "$email",
          name: { $first: "$name" },
          lastMessage: { $first: "$text" },
          lastTimestamp: { $first: "$timestamp" },
          unreadCount: {
            $sum: {
              $cond: [{ $and: [{ $eq: ["$read", false] }, { $eq: ["$sender", "user"] }] }, 1, 0]
            }
          }
        }
      },
      {
        $sort: { lastTimestamp: -1 }
      }
    ]);
    return res.json(sessions);
  } catch (error) {
    console.error("Error getting active chat sessions:", error);
    return res.status(500).json({ error: "Failed to load chat sessions." });
  }
});
app.post("/api/chats/mark-read/:email", async (req, res) => {
  try {
    const { email } = req.params;
    await ChatMessage.updateMany(
      { email: email.toLowerCase(), sender: "user", read: false },
      { $set: { read: true } }
    );
    return res.json({ message: "Messages marked as read." });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return res.status(500).json({ error: "Failed to update messages status." });
  }
});
app.delete("/api/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Appointment.findByIdAndDelete(id);
    return res.json({ message: "Appointment deleted successfully." });
  } catch (error) {
    console.error("Error deleting appointment:", error);
    return res.status(500).json({ error: "Failed to delete appointment." });
  }
});
app.delete("/api/chats/session/:email", async (req, res) => {
  try {
    const { email } = req.params;
    await ChatMessage.deleteMany({ email: email.toLowerCase() });
    return res.json({ message: "Chat session deleted successfully." });
  } catch (error) {
    console.error("Error deleting chat session:", error);
    return res.status(500).json({ error: "Failed to delete chat session." });
  }
});
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa"
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
//# sourceMappingURL=server.js.map
