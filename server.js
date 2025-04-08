require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const { Parser } = require('json2csv'); 
const PDFDocument = require('pdfkit');  

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("⚠️ JWT_SECRET is missing! Set it in your .env file.");
  process.exit(1); // Stop the server if missing
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('public'));


app.use(
  helmet({
      contentSecurityPolicy: {
          directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
              scriptSrcAttr: ["'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
          },
      },
  })
);

// Force correct MIME type for jwt-decode.min.js
app.get("/js/jwt-decode.min.js", (req, res) => {
  res.type("application/javascript");
  res.sendFile(path.join(__dirname, "public/js/jwt-decode.min.js"));
});


app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true,
  allowedHeaders: ['Authorization', 'Content-Type']
}));

// MySQL Database Connection
async function connectToDatabase() {
  return await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'mc@tie',
    database: 'uzalendo_campus'
  });
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Token verification failed:', err);
      return res.status(403).json({ message: 'Token verification failed' });
    }
    req.user = user;
    next();
  });
}

// Signup Route
app.post('/api/signup', async (req, res) => {
  let connection;
  try {
    const { fullName, email, username, password } = req.body;

    if (!fullName || !email || !username || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    connection = await connectToDatabase();
    const [existingUser] = await connection.execute("SELECT * FROM users WHERE email = ?", [email]);

    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await connection.execute("INSERT INTO users (fullName, email, username, password) VALUES (?, ?, ?, ?)", 
      [fullName, email, username, hashedPassword]);

    res.status(201).json({ message: 'Signup successful' });

  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  } finally {
    if (connection) await connection.end();
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  let connection;
  try {
    connection = await connectToDatabase();
    const { username, password } = req.body;

    const [users] = await connection.execute('SELECT * FROM users WHERE username = ?', [username]);

    if (users.length === 0) {
      return res.status(400).json({ message: 'User not found' });
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username, fullName: user.fullName }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ message: 'Login successful', token });

  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

app.post("/api/verify-token", (req, res) => {
  try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).json({ message: "Unauthorized" });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      res.json({ userId: decoded.userId, fullName: decoded.fullName, username: decoded.username });
  } catch (error) {
      res.status(401).json({ message: "Invalid or expired token" });
  }
});


app.get('/api/dashboard', async (req, res) => {
  let connection;
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Extract token
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET); // Verify token
    console.log("Decoded Token:", decoded);

    connection = await connectToDatabase();

    // Fetch dashboard stats (Example queries, modify as needed)
    const [totalEmployees] = await connection.execute('SELECT COUNT(*) AS count FROM employees');
    const [leaveEmployees] = await connection.execute('SELECT COUNT(*) AS approved FROM leave_requests WHERE status = "Approved"');
    const [attendance] = await connection.execute('SELECT COUNT(*) AS count FROM attendance');
    const [pendingRequests] = await connection.execute('SELECT COUNT(*) AS pending FROM leave_requests WHERE status = "Pending"');

    // Response data
    res.json({
      totalEmployees: totalEmployees[0].count || 0,
      leaveEmployees: leaveEmployees[0].approved || 0,
      attendanceRate: attendance[0].count || 0,
      pendingRequests: pendingRequests[0].pending || 0,
      notifications: ["System update completed", "New leave request submitted"], // Example notifications
    });

  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({ message: "Server error: " + error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Get Recruitment Data
app.get("/recruitment", async (req, res) => {
  let connection;
  try {
      connection = await connectToDatabase();  // Establish connection
      const [rows] = await connection.execute("SELECT * FROM recruitment");
      res.json(rows);
  } catch (error) {
      console.error("Error fetching recruitment data:", error);
      res.status(500).json({ message: "Server error" });
  } finally {
      if (connection) await connection.end(); // Close connection
  }
});

// Add New Recruitment Entry
app.post("/recruitment", async (req, res) => {
  let connection;
  const { job_title, application_deadline, interview_date } = req.body;

  if (!job_title || !application_deadline || !interview_date) {
      return res.status(400).json({ message: "All fields are required" });
  }

  try {
      connection = await connectToDatabase();  // Establish connection
      await connection.execute(
          "INSERT INTO recruitment (job_title, application_deadline, interview_date) VALUES (?, ?, ?)",
          [job_title, application_deadline, interview_date]
      );
      res.status(201).json({ message: "Recruitment added successfully" });
  } catch (error) {
      console.error("Error adding recruitment:", error);
      res.status(500).json({ message: "Server error" });
  } finally {
      if (connection) await connection.end(); // Close connection
  }
});


// Recruitment Route
app.post('/apply', authenticateToken, async (req, res) => {
  let connection;
  try {
    connection = await connectToDatabase();
    const { applicant_name, applicant_phone, applicant_age, job_id } = req.body;

    const sql = 'INSERT INTO applications (job_id, applicant_name, applicant_phone, applicant_age) VALUES (?, ?, ?, ?)';
    
    await connection.execute(sql, [job_id, applicant_name, applicant_phone, applicant_age]);

    res.json({ message: 'Application submitted successfully' });
  } catch (err) {
    console.error("Error submitting application:", err);
    res.status(500).json({ error: "Database error" });
  } finally {
    if (connection) await connection.end();
  }
});

// Training Routes
app.get("/training", authenticateToken, async (req, res) => {
  let connection;
  try {
    connection = await connectToDatabase();
    const [results] = await connection.execute(
      "SELECT id, title, DATE_FORMAT(date, '%Y-%m-%d') AS date, TIME_FORMAT(time, '%H:%i') AS time, location FROM training_sessions"
    );

    res.json(results);
  } catch (error) {
    console.error("Error fetching training data:", error);
    res.status(500).json({ error: "Database error" });
  } finally {
    if (connection) await connection.end();
  }
});


app.post("/training", authenticateToken, async (req, res) => {
  let connection;
  try {
    connection = await connectToDatabase();
    const { title, date, time, location } = req.body;

    // Ensure time is stored correctly
    const formattedTime = time.length === 5 ? `${time}:00` : time; // Convert HH:MM to HH:MM:SS if necessary

    await connection.execute(
      "INSERT INTO training_sessions (title, date, time, location) VALUES (?, ?, ?, ?)",
      [title, date, formattedTime, location]
    );

    res.json({ message: "Training session added successfully!" });
  } catch (error) {
    console.error("Error adding training session:", error);
    res.status(500).json({ error: "Database error" });
  } finally {
    if (connection) await connection.end();
  }
});


app.get("/attendance", authenticateToken, async (req, res) => {
  let connection;
  try {
      connection = await connectToDatabase();

      let { department, status, date } = req.query;
      let query = `
          SELECT e.name, a.status
          FROM attendance a
          JOIN employees e ON a.employee_id = e.id
          WHERE 1=1
      `;
      const queryParams = [];

      if (department && department !== "all") {
          query += " AND e.department = ?";
          queryParams.push(department);
      }
      if (status && status !== "all") {
          query += " AND a.status = ?";
          queryParams.push(status);
      }
      if (date) {
          query += " AND DATE(a.date) = ?";
          queryParams.push(date);
      }

      const [rows] = await connection.execute(query, queryParams);
      res.json(rows);
  } catch (error) {
      console.error("Error fetching attendance records:", error);
      res.status(500).json({ message: "Internal Server Error" });
  } finally {
      if (connection) await connection.end();
  }
});

app.get("/employeeDetails", authenticateToken, async (req, res) => {
  let connection;
  try {
      connection = await connectToDatabase();
      const department = req.query.department;

      let query = "SELECT id, name, position, department, contact FROM employees";
      const queryParams = [];

      if (department) {
          query += " WHERE department = ?";
          queryParams.push(department);
      }

      const [rows] = await connection.execute(query, queryParams);
      res.json(rows);
  } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Internal Server Error" });
  } finally {
      if (connection) await connection.end();
  }
});



app.put("/employeeDetails/:id", authenticateToken, async (req, res) => {
  let connection;
  try {
      connection = await connectToDatabase();
      const { id } = req.params;
      const { name, position, department, contact } = req.body;

      const updateQuery = `
          UPDATE employees 
          SET name = ?, position = ?, department = ?, contact = ?
          WHERE id = ?
      `;

      const [result] = await connection.execute(updateQuery, [name, position, department, contact, id]);

      if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Employee not found" });
      }

      res.json({ message: "Employee updated successfully" });
  } catch (error) {
      console.error("Error updating employee:", error);
      res.status(500).json({ message: "Internal Server Error" });
  } finally {
      if (connection) await connection.end();
  }
});


app.get("/api/leaveRequests", authenticateToken, async (req, res) => {
  let connection;
  try {
      connection = await connectToDatabase(); // Establish connection

      let { department, status, startDate, endDate } = req.query;
      let query = `SELECT * FROM leave_requests WHERE 1`;
      let queryParams = [];

      if (department && department !== "all") {
          query += " AND department = ?";
          queryParams.push(department);
      }
      if (status && status !== "all") {
          query += " AND status = ?";
          queryParams.push(status);
      }
      if (startDate) {
          query += " AND start_date >= ?";
          queryParams.push(startDate);
      }
      if (endDate) {
          query += " AND end_date <= ?";
          queryParams.push(endDate);
      }

      const [rows] = await connection.execute(query, queryParams);
      res.json(rows);
  } catch (error) {
      console.error("Error fetching leave requests:", error);
      res.status(500).json({ message: "Internal Server Error" });
  } finally {
      if (connection) await connection.end(); // Close connection
  }
});


app.put("/api/LeaveRequests/:id", authenticateToken, async (req, res) => {
  let connection;
  try {
      connection = await connectToDatabase(); // Establish connection
      const { id } = req.params;
      const { status } = req.body;

      if (!["Approved", "Rejected"].includes(status)) {
          return res.status(400).json({ message: "Invalid status" });
      }

      const [result] = await connection.execute(
          "UPDATE leave_requests SET status = ? WHERE id = ?",
          [status, id]
      );

      if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Leave request not found" });
      }

      res.json({ message: `Leave request ${status.toLowerCase()} successfully` });
  } catch (error) {
      console.error("Error updating leave request:", error);
      res.status(500).json({ message: "Internal Server Error" });
  } finally {
      if (connection) await connection.end(); // Close connection
  }
});

// Reports Route
app.get('/reports', authenticateToken, async (req, res) => {
  let connection;
  try {
    connection = await connectToDatabase();

    const { startDate, endDate, reportType, trend } = req.query;
    let queryConditionsAttendance = [];
let queryConditionsLeave = [];

let queryParams = [];

if (startDate) {
    queryConditionsAttendance.push("date >= ?");
    queryConditionsLeave.push("start_date >= ?");
    queryParams.push(startDate);
}
if (endDate) {
    queryConditionsAttendance.push("date <= ?");
    queryConditionsLeave.push("end_date <= ?");
    queryParams.push(endDate);
}



let whereAttendance = queryConditionsAttendance.length ? `WHERE ${queryConditionsAttendance.join(' AND ')}` : '';
let whereLeave = queryConditionsLeave.length ? `WHERE ${queryConditionsLeave.join(' AND ')}` : '';

console.log("whereAttendance:", whereAttendance);
console.log("whereLeave:", whereLeave);

let query = `
    SELECT 
        (SELECT COUNT(*) FROM employees) AS total_employees,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent
    FROM attendance 
    ${whereAttendance ? whereAttendance : ''}

    UNION ALL

    SELECT 
        NULL, -- Placeholder to align columns
        SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected
    FROM leave_requests 
    ${whereLeave ? whereLeave : ''}
`;


    // Trend Analysis: Weekly & Monthly Reports (Attendance)
    if (trend === 'weekly' && reportType === 'attendance') {
      query = `
        SELECT 
          WEEK(date) AS period, 
          COUNT(CASE WHEN status = 'Present' THEN 1 END) AS present, 
          COUNT(CASE WHEN status = 'Absent' THEN 1 END) AS absent
        FROM attendance ${whereClause}
        GROUP BY period
        ORDER BY period;
      `;
    } else if (trend === 'monthly' && reportType === 'attendance') {
      query = `
        SELECT 
          MONTH(date) AS period, 
          COUNT(CASE WHEN status = 'Present' THEN 1 END) AS present, 
          COUNT(CASE WHEN status = 'Absent' THEN 1 END) AS absent
        FROM attendance ${whereClause}
        GROUP BY period
        ORDER BY period;
      `;
    }

    // Trend Analysis: Weekly & Monthly Reports (Leave Requests)
    if (trend && reportType === 'leave') {
      query = `
        SELECT 
          ${trend === 'weekly' ? 'WEEK(date)' : 'MONTH(date)'} AS period, 
          COUNT(CASE WHEN status = 'Approved' THEN 1 END) AS approved,
          COUNT(CASE WHEN status = 'Pending' THEN 1 END) AS pending,
          COUNT(CASE WHEN status = 'Rejected' THEN 1 END) AS rejected
        FROM leave_requests ${whereClause}
        GROUP BY period
        ORDER BY period;
      `;
    }

    console.log("Executing Query:", query, "Params:", queryParams);

    const [results] = await connection.execute(query, queryParams);
    
    // Log the output before sending
    console.log("Query Results:", results);

    res.json(results);

  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Failed to fetch reports', error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});


app.get("/export-reports", authenticateToken, async (req, res) => {
  let connection;
  try {
    connection = await connectToDatabase();
    const { format, reportType, startDate, endDate } = req.query;

    // Validate input
    const allowedReports = ["employees", "attendance"]; // Adjust as needed
    if (!allowedReports.includes(reportType)) {
      return res.status(400).json({ message: "Invalid report type" });
    }

    let queryConditions = [];
    let queryParams = [];

    // Filters
    if (startDate) {
      queryConditions.push("date >= ?");
      queryParams.push(startDate);
    }
    if (endDate) {
      queryConditions.push("date <= ?");
      queryParams.push(endDate);
    }

    let whereClause = queryConditions.length ? `WHERE ${queryConditions.join(" AND ")}` : "";
    let query = `SELECT * FROM ${reportType} ${whereClause}`;

    const [data] = await connection.execute(query, queryParams);

    if (data.length === 0) {
      return res.status(404).json({ message: "No data found for the given filters" });
    }

    // 📌 CSV Export
    if (format === "csv") {
      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(data);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${reportType}_report.csv"`);
      return res.status(200).send(csv);
    }

    // 📌 PDF Export
    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${reportType}_report.pdf"`);

      const doc = new PDFDocument();
      doc.pipe(res);

      doc.fontSize(18).text(`${reportType.toUpperCase()} Report`, { align: "center" });
      doc.moveDown();

      data.forEach((row, index) => {
        doc.fontSize(12).text(`${index + 1}. ${JSON.stringify(row, null, 2)}`);
        doc.moveDown();
      });

      doc.end();
      return;
    }

    return res.status(400).json({ message: "Invalid format requested" });

  } catch (error) {
    console.error("Error exporting report:", error);
    return res.status(500).json({ message: "Failed to export report", error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
