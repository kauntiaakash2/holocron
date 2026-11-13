import { z } from "zod";
export const normalizeTeam = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
const name = z
  .string()
  .trim()
  .min(2, "Enter at least two characters")
  .max(70, "Use 70 characters or fewer")
  .regex(/^[\p{L}\p{M} .'-]+$/u, "Use letters, spaces, apostrophes or hyphens");
export const memberSchema = z.object({
  fullName: name,
  rollNumber: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9]{6,20}$/, "Enter a valid 6–20 character roll number")
    .transform((x) => x.toUpperCase()),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .max(120)
    .transform((x) => x.toLowerCase()),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{10,18}$/, "Enter a valid phone number")
    .refine(
      (x) => x.replace(/\D/g, "").length >= 10,
      "At least 10 digits required",
    ),
  academicYear: z.coerce.number().int().min(1).max(3),
  branch: z.string().trim().min(2, "Enter your school or branch").max(100),
});
export const declarations = [
  "undergraduate",
  "years",
  "teamSize",
  "accuracy",
  "terms",
  "privacy",
] as const;
export const registrationSchema = z
  .object({
    teamName: z
      .string()
      .trim()
      .min(2)
      .max(48)
      .regex(
        /^[\p{L}\p{N} ._-]+$/u,
        "Use letters, numbers, spaces, dots, underscores or hyphens",
      ),
    members: z.array(memberSchema).length(3, "Exactly three members required"),
    consents: z.object({
      undergraduate: z.literal(true),
      years: z.literal(true),
      teamSize: z.literal(true),
      accuracy: z.literal(true),
      terms: z.literal(true),
      privacy: z.literal(true),
    }),
    website: z.string().max(0).optional(),
  })
  .superRefine((data, ctx) => {
    for (const field of ["rollNumber", "email"] as const) {
      const seen = new Set<string>();
      data.members.forEach((m, i) => {
        if (seen.has(m[field]))
          ctx.addIssue({
            code: "custom",
            path: ["members", i, field],
            message: "Each participant must be unique",
          });
        seen.add(m[field]);
      });
    }
  });
export type RegistrationInput = z.input<typeof registrationSchema>;
export type Registration = z.output<typeof registrationSchema>;
export function validateDomains(data: Registration, allowed: string[]) {
  return data.members.every((m) => allowed.includes(m.email.split("@")[1]));
}
