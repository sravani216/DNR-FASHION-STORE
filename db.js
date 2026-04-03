const mysql = require("mysql2");

const db = mysql.createPool({
  // This looks at Render's settings first, then your computer
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "DNR@fashion16",
  database: process.env.DB_NAME || "dnr_store",
  // Port is 4000 for TiDB, but 3306 for your local PC
  port: process.env.DB_PORT || 3306, 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // CRITICAL: This allows the encrypted connection required by TiDB
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connection
db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Connected to MySQL database");
    if (connection) connection.release();
  }
});

module.exports = db;