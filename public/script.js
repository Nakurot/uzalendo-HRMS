document.getElementById('signupForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        alert("Please enter a valid email address.");
        return;
    }

    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, email, username, password }),
        });

        const result = await response.json();

        if (response.ok) {
            alert('Signup successful! Redirecting to login...');
            window.location.href = 'login.html';
        } else {
            alert(result.message || 'Signup failed. Try again.');
        }
    } catch (error) {
        console.error('Signup Error:', error);
        alert('An error occurred. Please try again.');
    }
});