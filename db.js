const mysql = require("mysql2");

// ✅ Use environment variables to keep code the same across environments
const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "DNR@fashion16",
  database: process.env.DB_NAME || "dnr_store",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Optional: test connection
db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Connected to MySQL database");
    connection.release();
  }
});

module.exports = db;