export const event = {
  name: "HOL0CRON",
  date: "22 December 2026",
  venue: "Campus 25, Lecture Halls, KIIT University",
  city: "Bhubaneswar",
  termsVersion: "2026-10-v1",
  privacyVersion: "2026-10-v1",
};
export const domains = () =>
  (process.env.KIIT_EMAIL_DOMAINS || "kiit.ac.in")
    .split(",")
    .map((x) => x.trim().toLowerCase());
export const origin = () => process.env.APP_ORIGIN || "http://localhost:3000";
