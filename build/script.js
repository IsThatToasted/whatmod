// Aurelium contact settings.
// Replace these two values with your real contact information.
const AURELIUM_EMAIL = "toasted3@icloud.com";
const AURELIUM_PHONE_DISPLAY = "(717) 5156488";
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

document.getElementById("contactForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const firstName = document.getElementById("firstName").value.trim();
  const businessName = document.getElementById("businessName").value.trim();
  const visitorEmail = document.getElementById("visitorEmail").value.trim();
  const projectType = document.getElementById("projectType").value;
  const projectDetails = document.getElementById("projectDetails").value.trim();

  const subject = encodeURIComponent(`Aurelium website inquiry${businessName ? " — " + businessName : ""}`);
  const body = encodeURIComponent(
`New Aurelium Website Inquiry

Name: ${firstName}
Business: ${businessName || "Not provided"}
Email: ${visitorEmail}
Project: ${projectType}

Project details:
${projectDetails}

---
Sent from the Aurelium website.`
  );

  window.location.href = `mailto:${AURELIUM_EMAIL}?subject=${subject}&body=${body}`;
});
