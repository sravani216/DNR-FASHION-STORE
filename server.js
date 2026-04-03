require('dotenv').config({ path: 'cred.env' });
const express = require("express");
const session = require('express-session');
const db = require("./db");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();
// ================= MULTER =================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(__dirname));

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.use("/uploads", express.static("uploads"));

// ================= BASIC =================
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

// ================= SIGNUP =================
app.post("/signup", (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.json({ success: false, message: "Missing fields" });
    }

    // check if user already exists
    db.query(
        "SELECT * FROM users WHERE email=?",
        [email],
        (err, result) => {

            if (err) {
                console.error(err);
                return res.json({ success: false });
            }

            if (result.length > 0) {
                return res.json({ success: false, message: "User already exists" });
            }

            // insert user
            db.query(
                "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')",
                [name, email, password],
                (err2) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({ success: false });
                    }

                    res.json({ success: true });
                }
            );
        }
    );
});

// ================= LOGIN =================
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.query(
        "SELECT * FROM users WHERE email=? AND password=?",
        [email, password],
        (err, result) => {

            if (err) {
                console.error("LOGIN ERROR:", err);
                return res.json({ success: false });
            }

            if (result.length > 0) {
                res.json({
                    success: true,
                    role: result[0].role
                });
            } else {
                res.json({ success: false });
            }
        }
    );
});

// ================= PRODUCTS =================
app.post("/add-product", upload.single("image"), (req, res) => {
    const { name, description, price } = req.body;

    if (!req.file) return res.send("Image required");

    const image = "/uploads/" + req.file.filename;

    db.query(
        "INSERT INTO products (name, description, price, image) VALUES (?, ?, ?, ?)",
        [name, description, price, image],
        (err) => {
            if (err) return res.send("Error adding product");
            res.json({ success: true });
        }
    );
});

app.get("/products", (req, res) => {
    db.query("SELECT * FROM products ORDER BY id DESC", (err, result) => {
        if (err) return res.json([]);
        res.json(result);
    });
});

// ================= UPDATE PRODUCT =================
app.post("/update-product", upload.single("image"), (req, res) => {
    const { id, name, description, price } = req.body;

    if (req.file) {
        const image = "/uploads/" + req.file.filename;

        db.query(
            "UPDATE products SET name=?, description=?, price=?, image=? WHERE id=?",
            [name, description, price, image, id],
            (err) => {
                if (err) {
                    console.error(err);
                    return res.json({ success: false });
                }
                res.json({ success: true });
            }
        );
    } else {
        db.query(
            "UPDATE products SET name=?, description=?, price=? WHERE id=?",
            [name, description, price, id],
            (err) => {
                if (err) {
                    console.error(err);
                    return res.json({ success: false });
                }
                res.json({ success: true });
            }
        );
    }
});

// ================= DELETE PRODUCT=================
app.post("/delete-product", (req, res) => {
    const { product_id } = req.body;

    // FIRST delete from order_items
    db.query("DELETE FROM order_items WHERE product_id=?", [product_id], (err) => {

        if (err) return res.json({ success: false });

        // THEN delete product
        db.query("DELETE FROM products WHERE id=?", [product_id], (err2) => {

            if (err2) return res.json({ success: false });

            res.json({ success: true });
        });
    });
});

// ================= ADD TO CART =================
app.post("/add-to-cart", (req, res) => {
    const { productId, email } = req.body;

    if (!productId || !email) {
        return res.json({ success: false });
    }

    db.query(
        "SELECT id FROM users WHERE email=?",
        [email],
        (err, userResult) => {

            if (err || userResult.length === 0) {
                return res.json({ success: false });
            }

            const userId = userResult[0].id;

            db.query(
                "SELECT * FROM cart WHERE product_id=? AND user_id=?",
                [productId, userId],
                (err2, result) => {

                    if (err2) return res.json({ success: false });

                    if (result.length > 0) {
                        db.query(
                            "UPDATE cart SET quantity = quantity + 1 WHERE product_id=? AND user_id=?",
                            [productId, userId],
                            () => res.json({ success: true })
                        );
                    } else {
                        db.query(
                            "INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, 1)",
                            [userId, productId],
                            () => res.json({ success: true })
                        );
                    }
                }
            );
        }
    );
});

// ================= GET CART =================
app.post("/cart", (req, res) => {
    const { email } = req.body;

    if (!email) return res.json([]);

    db.query(
        "SELECT id FROM users WHERE email=?",
        [email],
        (err, userResult) => {

            if (err || userResult.length === 0) {
                return res.json([]);
            }

            const userId = userResult[0].id;

            db.query(
                `SELECT c.product_id, p.name, p.price, c.quantity 
                 FROM cart c 
                 JOIN products p ON c.product_id = p.id 
                 WHERE c.user_id=?`,
                [userId],
                (err2, result) => {

                    if (err2) return res.json([]);

                    res.json(result);
                }
            );
        }
    );
});

// ================= REMOVE CART =================
app.post("/remove-from-cart", (req, res) => {
    const { productId, email } = req.body;

    if (!productId || !email) {
        return res.json({ success: false });
    }
    db.query(
        "SELECT id FROM users WHERE email=?",
        [email],
        (err, userResult) => {

            if (err || userResult.length === 0) {
                console.error("User fetch error:", err);
                return res.json({ success: false });
            }

            const userId = userResult[0].id;

            db.query(
                "DELETE FROM cart WHERE product_id=? AND user_id=?",
                [productId, userId],
                (err2) => {

                    if (err2) {
                        console.error("DELETE ERROR:", err2);
                        return res.json({ success: false });
                    }

                    res.json({ success: true });
                }
            );
        }
    );
});

// ================= PLACE ORDER=================
app.post("/place-order", (req, res) => {

    console.log("BODY:", req.body);

    const email = req.body.email;
    const address = req.body.address;
    const screenshot = null;

    if (!email) {
        return res.json({ success: false });
    }

    // 🔍 get user
    db.query(
        "SELECT id FROM users WHERE email=?",
        [email],
        (err, userResult) => {

            if (err || userResult.length === 0) {
                console.error("USER ERROR:", err);
                return res.json({ success: false });
            }

            const userId = userResult[0].id;

            // 🔍 get cart
            db.query(
                `SELECT c.product_id, p.name, p.price, c.quantity 
                 FROM cart c 
                 JOIN products p ON c.product_id = p.id 
                 WHERE c.user_id=?`,
                [userId],
                (err2, cartData) => {

                    if (err2 || cartData.length === 0) {
                        console.error("CART ERROR:", err2);
                        return res.json({ success: false });
                    }

                    let total = 0;
                    cartData.forEach(item => {
                        total += item.price * item.quantity;
                    });

                    // 🧾 insert order
                    db.query(
                        `INSERT INTO orders 
                        (user_id, total_amount, status, payment_status, screenshot, address, created_at) 
                        VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                        [userId, total, "Pending", "Pending", screenshot, address],
                        (err3, result) => {

                            if (err3) {
                                console.error("ORDER INSERT ERROR:", err3);
                                return res.json({ success: false });
                            }

                            const orderId = result.insertId;

                            const values = cartData.map(item => [
                                orderId,
                                item.product_id,
                                item.name,
                                item.quantity,
                                item.price
                            ]);

                            // 📦 insert items
                            db.query(
                                "INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES ?",
                                [values],
                                (err4) => {

                                    if (err4) {
                                        console.error("ITEM INSERT ERROR:", err4);
                                        return res.json({ success: false });
                                    }

                                    // 🧹 clear cart properly
                                    db.query(
                                        "DELETE FROM cart WHERE user_id=?",
                                        [userId],
                                        (err5) => {

                                            if (err5) {
                                                console.error("CART DELETE ERROR:", err5);
                                                return res.json({ success: false });
                                            }

                                            console.log("✅ ORDER SUCCESS");
                                            return res.json({ success: true });
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});
// ================= ACCOUNT =================
app.post("/get-user", (req, res) => {
    const { email } = req.body;

    console.log("Incoming email:", email);

    if (!email) {
        return res.json({ success: false });
    }

    db.query(
        "SELECT name, email, role FROM users WHERE email=?",
        [email],
        (err, result) => {

            if (err) {
                console.error("DB ERROR:", err);
                return res.json({ success: false });
            }

            if (result.length === 0) {
                console.log("No user found");
                return res.json({ success: false });
            }

            res.json({
                success: true,
                user: result[0]
            });
        }
    );
});

// ================= ADMIN ORDERS =================
app.get("/admin-orders", (req, res) => {
    db.query(
        `SELECT o.id, o.user_id, o.total_amount, o.status, 
                o.payment_status, o.created_at, o.screenshot, o.address,
                u.email 
         FROM orders o
         JOIN users u ON o.user_id = u.id
         ORDER BY o.id DESC`,
        (err, result) => {

            if (err) {
                console.error("ADMIN ORDERS ERROR:", err);
                return res.json([]);
            }

            res.json(result);
        }
    );
});

// ================= OVER ALL GRAPH================
app.get("/admin-stats", (req, res) => {

    // 1️⃣ total orders
    db.query("SELECT COUNT(*) AS totalOrders FROM orders", (err1, ordersRes) => {

        if (err1) return res.json({});

        // 2️⃣ total revenue
        db.query("SELECT SUM(total_amount) AS totalRevenue FROM orders", (err2, revenueRes) => {

            if (err2) return res.json({});

            // 3️⃣ total products
            db.query("SELECT COUNT(*) AS totalProducts FROM products", (err3, productRes) => {

                if (err3) return res.json({});

                // 4️⃣ graph data
                db.query(
                    `SELECT DATE(created_at) AS date, SUM(total_amount) AS revenue
                     FROM orders
                     GROUP BY DATE(created_at)
                     ORDER BY date`,
                    (err4, graphRes) => {

                        if (err4) return res.json({});

                        res.json({
                            totalOrders: ordersRes[0].totalOrders || 0,
                            totalRevenue: revenueRes[0].totalRevenue || 0,
                            totalProducts: productRes[0].totalProducts || 0,
                            graph: graphRes
                        });
                    }
                );
            });
        });
    });
});

// ================= PRDUCT STATS=================
app.get("/product-stats", (req, res) => {

    db.query(
        `SELECT 
            p.id,
            p.name,
            IFNULL(SUM(oi.quantity), 0) AS sold,
            IFNULL(SUM(oi.quantity * oi.price), 0) AS revenue
         FROM products p
         LEFT JOIN order_items oi ON p.id = oi.product_id
         GROUP BY p.id, p.name
         ORDER BY sold DESC`,
        (err, result) => {

            if (err) {
                console.error("PRODUCT STATS ERROR:", err);
                return res.json({ success: false });
            }

            res.json({
                success: true,
                data: result
            });
        }
    );
});
// ================= SERVER =================
app.listen(5000, () => {
    console.log("Server running on port 5000");
});