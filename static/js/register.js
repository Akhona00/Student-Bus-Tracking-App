document.addEventListener("DOMContentLoaded", function () {
  const API_KEY = "1b7e8832-3614-4820-a3ca-58d12afb1f44"; // Replace with your actual API key or fetch from a secure source
  const signupForm = document.getElementById("signup-form");
  const alertContainer = document.getElementById("alert-container");

  signupForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("name").value;
    const surname = document.getElementById("surname").value;
    const student_email = document.getElementById("student_email").value;
    const password = document.getElementById("password").value;
    const confirm_password = document.getElementById("confirm_password").value;

    // Basic client-side validation
    if (password !== confirm_password) {
      showAlert("danger", "Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      showAlert("danger", "Password must be at least 8 characters long.");
      return;
    }

    if (
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      showAlert(
        "danger",
        "Password must contain uppercase, lowercase, and numbers."
      );
      return;
    }

    try {
      const response = await fetch("/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          name,
          surname,
          student_email,
          password,
          confirm_password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store email for verification page
        sessionStorage.setItem("registerEmail", student_email);
        sessionStorage.setItem("verificationCode", data.verification_code);

        showAlert(
          "success",
          "Registration successful! Please verify your email."
        );

        // Redirect to verification page
        setTimeout(() => {
          window.location.href = "/verify-email";
        }, 1500);
      } else {
        showAlert(
          "danger",
          data.error || "Registration failed. Please try again."
        );
      }
    } catch (error) {
      console.error("Registration error:", error);
      showAlert("danger", "Network error. Please try again later.");
    }
  });

  function showAlert(type, message) {
    alertContainer.innerHTML = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
  }
});
