document.addEventListener("DOMContentLoaded", function () {
  const API_KEY = "1b7e8832-3614-4820-a3ca-58d12afb1f44"; // Replace with your actual API key or fetch from a secure source
  const verifyForm = document.getElementById("verify-form");
  const alertContainer = document.getElementById("alert-container");
  const studentEmailInput = document.getElementById("student_email");
  const verificationCodeInput = document.getElementById("verification_code");
  const autoFillBtn = document.getElementById("auto-fill-btn");

  // Pre-fill email from registration if available
  const registeredEmail = sessionStorage.getItem("registerEmail");
  if (registeredEmail) {
    studentEmailInput.value = registeredEmail;
  } else {
    studentEmailInput.removeAttribute("readonly");
  }

  // Auto-fill verification code from registration (for development/testing)
  autoFillBtn.addEventListener("click", function () {
    const storedCode = sessionStorage.getItem("verificationCode");
    if (storedCode) {
      verificationCodeInput.value = storedCode;
    } else {
      showAlert("warning", "No verification code found in session.");
    }
  });

  verifyForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const student_email = studentEmailInput.value;
    const verification_code = verificationCodeInput.value;

    if (!student_email || !verification_code) {
      showAlert("danger", "Email and verification code are required.");
      return;
    }

    try {
      const response = await fetch("/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          student_email,
          verification_code,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Clear verification data from session
        sessionStorage.removeItem("registerEmail");
        sessionStorage.removeItem("verificationCode");

        showAlert(
          "success",
          "Email verified successfully! Redirecting to login..."
        );

        // Redirect to login page
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      } else {
        showAlert(
          "danger",
          data.error || "Verification failed. Please try again."
        );
      }
    } catch (error) {
      console.error("Verification error:", error);
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
