export function numericScore(guess, answer) {
  guess = Number(guess); answer = Number(answer);
  if (!Number.isFinite(guess) || !Number.isFinite(answer)) return 0;
  if (guess === answer) return 1000;

  // Fermi-friendly distance: orders of magnitude matter, but values near zero
  // fall back to normalized relative error.
  if (guess > 0 && answer > 0) {
    const orderError = Math.abs(Math.log10(guess / answer));
    return Math.max(0, Math.min(1000, Math.round(1000 * Math.exp(-1.35 * orderError))));
  }
  const scale = Math.max(1, Math.abs(answer));
  const relative = Math.abs(guess - answer) / scale;
  return Math.max(0, Math.min(1000, Math.round(1000 * Math.exp(-1.65 * relative))));
}

export function answerScore(question, value) {
  if (!question) return 0;
  if (question.question_type === "numeric") return numericScore(value, question.answer_numeric);
  if (question.question_type === "multiple_choice") return String(value) === String(question.correct_option) ? 1000 : 0;
  if (question.question_type === "text") {
    const n = s => String(s ?? "").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ");
    return n(value) === n(question.answer_text) ? 1000 : 0;
  }
  return 0;
}

export function xpForScore(score, { daily = false, win = false } = {}) {
  return Math.max(5, Math.round(score / 20) + (daily ? 15 : 0) + (win ? 35 : 0));
}

export function formatAnswer(value) {
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(n);
  return String(value ?? "—");
}
