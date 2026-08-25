// Aurelium contact settings.
// Replace these two values with your real contact information.
const AURELIUM_EMAIL = "toasted3@icloud.com";
const AURELIUM_PHONE_DISPLAY = "(717) 515-6488";
const AURELIUM_PHONE_TEL = "+10000000000";

document.getElementById("year").textContent = new Date().getFullYear();

const emailDisplay = document.getElementById("emailDisplay");
const phoneDisplay = document.getElementById("phoneDisplay");
const directEmailLink = document.getElementById("directEmailLink");
const directPhoneLink = document.getElementById("directPhoneLink");
const footerEmail = document.getElementById("footerEmail");
const footerPhone = document.getElementById("footerPhone");

emailDisplay.textContent = AURELIUM_EMAIL;
phoneDisplay.textContent = AURELIUM_PHONE_DISPLAY;
directEmailLink.href = `mailto:${AURELIUM_EMAIL}`;
directPhoneLink.href = `tel:${AURELIUM_PHONE_TEL}`;
footerEmail.href = `mailto:${AURELIUM_EMAIL}`;
footerPhone.href = `tel:${AURELIUM_PHONE_TEL}`;

const menuButton = document.querySelector(".menu-button");
const mobileMenu = document.querySelector(".mobile-menu");
menuButton.addEventListener("click", () => {
  const open = mobileMenu.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", open);
});
mobileMenu.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
  mobileMenu.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
}));

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach(el => revealObserver.observe(el));


const contactForm = document.getElementById("contactForm");
const formStatus = document.getElementById("formStatus");
const submitButton = contactForm.querySelector(".submit-button");
const submitLabel = contactForm.querySelector(".submit-label");

function setFormStatus(type, message) {
  formStatus.className = `form-status ${type}`;
  formStatus.textContent = message;
}

contactForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const firstName = document.getElementById("firstName").value.trim();
  const businessName = document.getElementById("businessName").value.trim();
  const visitorEmail = document.getElementById("visitorEmail").value.trim();
  const projectType = document.getElementById("projectType").value;
  const projectDetails = document.getElementById("projectDetails").value.trim();
  const honey = document.getElementById("websiteField").value;

  formStatus.className = "form-status";
  formStatus.textContent = "";

  if (AURELIUM_EMAIL === "hello@yourdomain.com") {
    setFormStatus("error", "Site owner setup required: replace hello@yourdomain.com in script.js with the email address that should receive inquiries.");
    return;
  }

  if (honey) {
    // Silently treat bot submissions as successful.
    contactForm.reset();
    setFormStatus("success", "Thanks — your inquiry has been received.");
    return;
  }

  submitButton.classList.add("is-loading");
  submitButton.disabled = true;
  submitLabel.textContent = "Sending…";

  const payload = {
    name: firstName,
    business: businessName || "Not provided",
    email: visitorEmail,
    project_type: projectType,
    message: projectDetails,
    _subject: `New Aurelium Website Inquiry${businessName ? " — " + businessName : ""}`,
    _template: "table",
    _replyto: visitorEmail
  };

  try {
    const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(AURELIUM_EMAIL)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    let result = {};
    try {
      result = await response.json();
    } catch (_) {}

    if (!response.ok || result.success === "false" || result.success === false) {
      throw new Error(result.message || "The form service returned an error.");
    }

    contactForm.reset();
    setFormStatus(
      "success",
      "Thanks — your inquiry was sent successfully. We'll get back to you as soon as possible."
    );
  } catch (error) {
    console.error("Aurelium contact form error:", error);
    setFormStatus(
      "error",
      "We couldn't send the form right now. Please use the email or call/text option beside the form."
    );
  } finally {
    submitButton.classList.remove("is-loading");
    submitButton.disabled = false;
    submitLabel.textContent = "Send project inquiry";
  }
});
