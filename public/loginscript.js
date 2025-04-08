document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");

    if (!loginForm) {
        console.error("Login form not found!");
        return;
    }

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault(); // Prevent form from submitting normally
        
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;

        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();
            console.log("Login Response:", data);

            if (response.ok && data.token) {
                console.log("Saving Token:", data.token);
                localStorage.setItem("token", data.token);
                window.location.href = "dashboard.html";
            } else {
                alert(data.message || "Invalid username or password");
            }
        } catch (error) {
            console.error("Login Error:", error);
            alert("An error occurred. Please try again.");
        }
    });
});
