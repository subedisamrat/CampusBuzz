const mongoose = require("mongoose");
const fs = require("fs");

// ── Load .env ──────────────────────────────────────────────────────────────
const envPath = ".env";
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .forEach((line) => {
      const [key, ...rest] = line.split("=");
      if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
    });
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI missing");
  process.exit(1);
}

// ── Schemas ────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({});
const EventSchema = new mongoose.Schema({});
const RegistrationSchema = new mongoose.Schema({});
const WaitlistSchema = new mongoose.Schema({});
const PaymentSchema = new mongoose.Schema({});

// ── Models ─────────────────────────────────────────────────────────────────
const User = mongoose.models.User || mongoose.model("User", UserSchema);
const Event = mongoose.models.Event || mongoose.model("Event", EventSchema);
const Registration =
  mongoose.models.Registration ||
  mongoose.model("Registration", RegistrationSchema);
const Waitlist =
  mongoose.models.Waitlist ||
  mongoose.model("Waitlist", WaitlistSchema);
const Payment =
  mongoose.models.Payment ||
  mongoose.model("Payment", PaymentSchema);

// ── Clear Database ─────────────────────────────────────────────────────────
async function clearDatabase() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected.");

    const results = await Promise.all([
      User.deleteMany({}),
      Event.deleteMany({}),
      Registration.deleteMany({}),
      Waitlist.deleteMany({}),
      Payment.deleteMany({}),
    ]);

    console.log("\n✅ Database cleared successfully!");
    console.log("--------------------------------");
    console.log(`Users deleted: ${results[0].deletedCount}`);
    console.log(`Events deleted: ${results[1].deletedCount}`);
    console.log(`Registrations deleted: ${results[2].deletedCount}`);
    console.log(`Waitlists deleted: ${results[3].deletedCount}`);
    console.log(`Payments deleted: ${results[4].deletedCount}`);
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB.");
  }
}

clearDatabase();