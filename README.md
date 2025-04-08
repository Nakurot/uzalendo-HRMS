Uzalendo Campus Human Resource Management System (HRMS)

📘 Overview

The Uzalendo HRMS is a secure, web-based system developed to automate human resource functions at Uzalendo Campus. It streamlines operations like employee recruitment, training schedules, attendance tracking, and report generation. Built using modern technologies like Node.js and MySQL, the system provides administrators with full control and secure access.



🧰 Features

- Admin-only access with session-based authentication
- Add and manage employees
- Post and monitor job applications
- Track attendance and leave records
- Export reports in CSV or PDF formats
- Training schedules and status tracking
- Secure password hashing with bcrypt
- Dashboard with HR statistics and analytics


 🛠️ Tech Stack

- Backend: Node.js, Express.js
- Frontend: HTML, CSS, JavaScript, Bootstrap
- Database: MySQL (via Sequelize ORM)
- Security: bcrypt, Helmet.js, session-based auth
- Tools: Postman (API testing), Git & GitHub (version control), VS Code



 ⚙️ Installation & Setup

 1. Clone the Repository
bash

git clone https://github.com/Nakurot/uzalendo-HRMS.git
cd uzalendo-hrms


2. Install Dependencies
bash

npm install


 3. Set Up Environment Variables
Create a `.env` file and configure:

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=mc@tie
DB_NAME=uzalendo_hrms
SESSION_SECRET=yourSecret


 4. Initialize Database
Ensure MySQL is running, then run:
bash
npm run migrate


5. Start the Server
bash

npm start


Access the system via `http://localhost:3000`.



📄 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/employeeDetails` | Get employee summary |
| GET | `/attendance` | Get attendance rate |
| GET | `/api/leaveRequests` | Get leave stats |
| GET | `/export-reports` | Export report in PDF/CSV |
| POST | `/auth/login` | Admin login |
| POST | `/auth/logout` | Admin logout |



🔐 Admin Authentication

The system uses session-based authentication. Only users with valid admin credentials (stored securely with hashed passwords) can access the system.



🧪 Testing

Use **Postman** to test API routes by providing the session token in the headers:

Cookie: connect.sid=yourSessionToken




📌 Limitations

- No employee self-service portal (admin only)
- Basic UI for MVP purposes
- Limited reporting visualization (no charts)



✅ Future Enhancements

- Add multi-role support (e.g., employees, HR managers)
- Visual analytics (graphs, charts)
- Email notification system
- Attendance via biometric/QR check-in



📬 Contact

For contributions, issues, or feature requests, reach out to:
`developer@uzalendocampus.ac.ke`



📝 License

This project is licensed under the MIT License.
