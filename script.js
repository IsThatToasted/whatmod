// WhatMod site JavaScript
// 1) Create a Stripe Payment Link for your existing WhatMod 30-day subscription.
// 2) Paste that public URL below. It should look like: https://buy.stripe.com/...
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/test_14A5kEbQne0i7cIgxddUY00";

document.querySelector("[data-menu]")?.addEventListener("click", () => {
  document.querySelector("[data-nav]")?.classList.toggle("open");
});

document.querySelectorAll("a[href^='#']").forEach((link) => {
  link.addEventListener("click", () => document.querySelector("[data-nav]")?.classList.remove("open"));
});

const checkoutButton = document.querySelector("[data-checkout]");
checkoutButton?.addEventListener("click", () => {
  if (!STRIPE_PAYMENT_LINK || STRIPE_PAYMENT_LINK.includes("PASTE_YOUR")) {
    alert("Stripe is not connected yet. Open script.js and replace STRIPE_PAYMENT_LINK with your Stripe Payment Link URL.");
    return;
  }
  window.location.href = STRIPE_PAYMENT_LINK;
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("visible");
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
