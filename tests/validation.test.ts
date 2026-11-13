import { describe, it, expect } from "vitest";
import {
  registrationSchema,
  normalizeTeam,
  validateDomains,
} from "../lib/validation";
const input = () => ({
  teamName: "Archive Crew",
  members: [0, 1, 2].map((i) => ({
    fullName: "Test Builder",
    rollNumber: `23000${i}`,
    email: `builder${i}@kiit.ac.in`,
    phone: "9876543210",
    academicYear: i + 1,
    branch: "Computer Science",
  })),
  consents: {
    undergraduate: true,
    years: true,
    teamSize: true,
    accuracy: true,
    terms: true,
    privacy: true,
  },
  website: "",
});
describe("registration validation", () => {
  it("accepts exactly three eligible independent members", () =>
    expect(registrationSchema.safeParse(input()).success).toBe(true));
  it("normalizes team names consistently", () =>
    expect(normalizeTeam("  Ａrchive   CREW ")).toBe("archive crew"));
  it("rejects fewer or more than three", () => {
    for (const count of [0, 1, 2, 4]) {
      const data = input();
      data.members = Array.from({ length: count }, (_, i) => ({
        ...data.members[0],
        rollNumber: `23000${i}`,
        email: `m${i}@kiit.ac.in`,
      }));
      expect(registrationSchema.safeParse(data).success).toBe(false);
    }
  });
  it("rejects repeated identities after normalization", () => {
    const data = input();
    data.members[1].email = "BUILDER0@KIIT.AC.IN";
    expect(registrationSchema.safeParse(data).success).toBe(false);
    data.members[1].email = "other@kiit.ac.in";
    data.members[1].rollNumber = data.members[0].rollNumber;
    expect(registrationSchema.safeParse(data).success).toBe(false);
  });
  it("rejects ineligible years and unchecked consent", () => {
    const data = input();
    data.members[0].academicYear = 4;
    expect(registrationSchema.safeParse(data).success).toBe(false);
    data.members[0].academicYear = 1;
    data.consents.privacy = false;
    expect(registrationSchema.safeParse(data).success).toBe(false);
  });
  it("does not accept domain suffix tricks", () => {
    const data = input();
    data.members[0].email = "a@kiit.ac.in.evil.test";
    expect(
      validateDomains(registrationSchema.parse(data), ["kiit.ac.in"]),
    ).toBe(false);
  });
  it("rejects bot honeypot input", () => {
    const data = input();
    data.website = "https://spam.test";
    expect(registrationSchema.safeParse(data).success).toBe(false);
  });
});
