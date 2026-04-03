const mysql = require("mysql2");

// We'll use your actual TiDB username here as a backup 
// to make sure that "prefix" error never happens again.
const db = mysql.createPool({
  host: process.env.DB_HOST || "gateway01.ap-southeast-1.prod.aws.tidbcloud.com",
  user: process.env.DB_USER || "N17AtrVvXBEaB1g.root", 
  password: process.env.DB_PASSWORD || "tTZNhMeiLEXd89Sw",
  database: process.env.DB_NAME || "test",
  port: process.env.DB_PORT || 4000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Connected to TiDB Cloud successfully!");
    if (connection) connection.release();
  }
});

module.exports = db;