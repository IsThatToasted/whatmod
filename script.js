// WHATMOD STRIPE SETUP
// 1) In Stripe Dashboard, create/copy a Payment Link for your WhatMod 30-day subscription.
// 2) Paste the customer-facing URL below. It should look like: https://buy.stripe.com/...
// 3) Commit and push this file to GitHub Pages.
const STRIPE_PAYMENT_LINK = "";

const menuBtn = document.getElementById("menuBtn");
const nav = document.getElementById("nav");
const modal = document.getElementById("stripeModal");
const closeModal = document.getElementById("closeModal");

document.getElementById("year").textContent = new Date().getFullYear();

menuBtn?.addEventListener("click", () => nav.classList.toggle("open"));

document.querySelectorAll(".checkout-btn").forEach((button) => {
  button.addEventListener("click", () => {
    if (STRIPE_PAYMENT_LINK && STRIPE_PAYMENT_LINK.startsWith("https://")) {
      window.location.href = STRIPE_PAYMENT_LINK;
    } else {
      modal.classList.add("show");
      modal.setAttribute("aria-hidden", "false");
    }
  });
});

closeModal?.addEventListener("click", () => {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
});

modal?.addEventListener("click", (event) => {
  if (event.target === modal) closeModal.click();
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("visible");
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
