"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  memberSchema,
  registrationSchema,
  validateDomains,
} from "@/lib/validation";
type Member = {
  fullName: string;
  email: string;
  rollNumber: string;
  phone: string;
  academicYear: string;
  branch: string;
};
type Form = {
  teamName: string;
  members: Member[];
  consents: Record<string, boolean>;
  website: string;
};
const session = {
  getItem: (key: string) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {}
  },
  removeItem: (key: string) => {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  },
};
const blank = (): Member => ({
  fullName: "",
  email: "",
  rollNumber: "",
  phone: "",
  academicYear: "",
  branch: "",
});
const labels = [
  "Team identification",
  "Team manifest",
  "Eligibility & declaration",
  "Mission review",
];
const declarations = [
  ["undergraduate", "All participants are KIIT undergraduate students."],
  ["years", "All participants are in their first, second, or third year."],
  ["teamSize", "Our team contains exactly three eligible members."],
  ["accuracy", "The submitted information is accurate."],
  ["terms", "We agree to the event participation terms."],
  ["privacy", "We acknowledge the privacy notice."],
];
export function RegistrationWizard({
  allowedDomains,
  open,
}: {
  allowedDomains: string[];
  open: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0),
    [member, setMember] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [recovery, setRecovery] = useState("");
  const key = useRef("");
  const locked = useRef<Form | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const {
    register,
    getValues,
    reset,
    watch,
    trigger,
    setError: setFieldError,
    clearErrors,
    formState: { errors },
  } = useForm<Form>({
    defaultValues: {
      teamName: "",
      members: [blank(), blank(), blank()],
      consents: {
        undergraduate: false,
        years: false,
        teamSize: false,
        accuracy: false,
        terms: false,
        privacy: false,
      },
      website: "",
    },
    mode: "onBlur",
    shouldUnregister: false,
  });
  useEffect(() => {
    try {
      const draft = session.getItem("holo_draft");
      if (draft) {
        const restored = JSON.parse(draft) as Partial<Form>;
        restored.website = "";
        reset(restored);
      }
      key.current =
        session.getItem("holo_key") ||
        crypto.randomUUID() + crypto.randomUUID();
      session.setItem("holo_key", key.current);
      const pending = session.getItem("holo_pending");
      if (pending) {
        locked.current = JSON.parse(pending);
        reset(locked.current!);
        setUncertain(true);
        setStep(3);
      }
    } catch {
      key.current = crypto.randomUUID() + crypto.randomUUID();
    }
    const subscription = watch((value) => {
      try {
        session.setItem("holo_draft", JSON.stringify(value));
      } catch {}
    });
    return () => subscription.unsubscribe();
  }, [reset, watch]);
  const fieldError = (index: number, field: keyof Member) =>
    errors.members?.[index]?.[field]?.message;
  const fields = (index: number) => {
    const prefix = `members.${index}` as const;
    return (
      <div className="field-grid">
        <label className="field">
          Full name
          <input
            autoComplete="name"
            {...register(`${prefix}.fullName`, {
              required: "Full name is required",
            })}
            aria-invalid={!!errors.members?.[index]?.fullName}
          />
          {fieldError(index, "fullName") && (
            <span className="error">{fieldError(index, "fullName")}</span>
          )}
        </label>
        <label className="field">
          KIIT email address
          <input
            type="email"
            autoComplete="email"
            {...register(`${prefix}.email`, { required: true })}
          />
          {fieldError(index, "email") && (
            <span className="error">{fieldError(index, "email")}</span>
          )}
          <small>Accepted: {allowedDomains.join(", ")}</small>
        </label>
        <label className="field">
          KIIT roll number
          <input
            {...register(`${prefix}.rollNumber`, { required: true })}
            autoCapitalize="characters"
          />
          {fieldError(index, "rollNumber") && (
            <span className="error">{fieldError(index, "rollNumber")}</span>
          )}
        </label>
        <label className="field">
          Phone number
          <input
            type="tel"
            autoComplete="tel"
            {...register(`${prefix}.phone`, { required: true })}
          />
          {fieldError(index, "phone") && (
            <span className="error">{fieldError(index, "phone")}</span>
          )}
        </label>
        <label className="field">
          Year of study
          <select {...register(`${prefix}.academicYear`, { required: true })}>
            <option value="">Select year</option>
            <option value="1">First year</option>
            <option value="2">Second year</option>
            <option value="3">Third year</option>
          </select>
          {fieldError(index, "academicYear") && (
            <span className="error">{fieldError(index, "academicYear")}</span>
          )}
        </label>
        <label className="field">
          School or branch
          <input {...register(`${prefix}.branch`, { required: true })} />
          {fieldError(index, "branch") && (
            <span className="error">{fieldError(index, "branch")}</span>
          )}
        </label>
      </div>
    );
  };
  async function next() {
    setError("");
    clearErrors();
    const values = getValues();
    if (step === 0) {
      if (
        !(await trigger(["teamName", "members.0.fullName", "members.0.email"]))
      ) {
        setError("Enter your team name and the leader’s name and email.");
        return;
      }
      if (!/^[\p{L}\p{N} ._-]{2,48}$/u.test(values.teamName.trim())) {
        setError(
          "Team name must contain 2–48 letters, numbers, spaces, dots, underscores or hyphens.",
        );
        return;
      }
    }
    if (step === 1) {
      for (let i = 0; i < 3; i++) {
        const result = memberSchema.safeParse(values.members[i]);
        if (!result.success) {
          for (const issue of result.error.issues) {
            setFieldError(
              `members.${i}.${String(issue.path[0])}` as `members.${number}.fullName`,
              { message: issue.message },
            );
          }
          setMember(i);
          setError(
            `Member ${i + 1}: ${result.error.issues.map((x) => `${x.path.join(" ")} — ${x.message}`).join(". ")}`,
          );
          return;
        }
      }
    }
    if (step === 2) {
      const parsed = registrationSchema.safeParse(values);
      if (!parsed.success) {
        setError(
          parsed.error.issues
            .map((issue) => {
              const path = issue.path.join(".");
              return path ? `${path}: ${issue.message}` : issue.message;
            })
            .join(". "),
        );
        return;
      }
      if (!validateDomains(parsed.data, allowedDomains)) {
        setError(
          `All members need a supported KIIT email (${allowedDomains.join(", ")}).`,
        );
        return;
      }
    }
    setStep((s) => s + 1);
    setTimeout(() => heading.current?.focus(), 0);
  }
  async function submit() {
    if (busy) return;
    setError("");
    const values = locked.current || getValues();
    const parsed = registrationSchema.safeParse(values);
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((issue) => {
            const path = issue.path.join(".");
            return path ? `${path}: ${issue.message}` : issue.message;
          })
          .join(". "),
      );
      return;
    }
    setBusy(true);
    locked.current = values;
    session.setItem("holo_pending", JSON.stringify(values));
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key.current,
        },
        body: JSON.stringify(values),
        signal: AbortSignal.timeout(20000),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status < 500) {
          locked.current = null;
          session.removeItem("holo_pending");
          setUncertain(false);
        } else setUncertain(true);
        throw new Error(data.error?.message || "Registration failed.");
      }
      session.removeItem("holo_draft");
      session.removeItem("holo_pending");
      session.setItem(`holo_recovery_${data.id}`, key.current);
      session.removeItem("holo_key");
      router.push(`/registration/${data.id}`);
    } catch (e) {
      if (locked.current) setUncertain(true);
      setError(
        e instanceof Error
          ? e.message
          : "Unable to connect. Retry this submission.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function recover() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/registrations/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: recovery.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error.message);
      router.push(`/registration/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const values = getValues();
  return (
    <div className="wizard-layout">
      <aside className="wizard-aside">
        <ol className="steps">
          {labels.map((label, i) => (
            <li key={label} aria-current={step === i ? "step" : undefined}>
              <span>{step > i ? "✓" : `0${i + 1}`}</span>
              {label}
            </li>
          ))}
        </ol>
        <p className="wizard-aside-note">
          22 DECEMBER 2026
          <br />
          Campus 25, KIIT University
          <br />
          <br />
          Registration is confirmed only after the archive saves your team.
          Admission is subject to organizer eligibility review.
        </p>
      </aside>
      <div>
        <div className="progress-mobile">
          STEP {step + 1} / 4 · {labels[step]}
        </div>
        <form
          className="form-panel"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 3) void next();
            else void submit();
          }}
        >
          <p className="eyebrow gold">MANIFEST / 0{step + 1}</p>
          <h2 ref={heading} tabIndex={-1}>
            {labels[step]}
          </h2>
          {!open && (
            <p className="notice">
              Registration is not open yet. You can explore the form; submission
              will be available after organizer configuration.
            </p>
          )}
          <div aria-live="polite">
            {error && (
              <p role="alert" className="notice error">
                {error}
              </p>
            )}
          </div>
          {step === 0 && (
            <>
              <p>Your team leader is the first member of the manifest.</p>
              <label className="field">
                Team name
                <input
                  maxLength={48}
                  {...register("teamName", { required: true, minLength: 2 })}
                />
                <small>
                  Names are unique ignoring case, repeated spaces, and Unicode
                  width differences.
                </small>
              </label>
              <label className="field">
                Team leader full name
                <input
                  autoComplete="name"
                  {...register("members.0.fullName", {
                    required: true,
                    minLength: 2,
                  })}
                />
              </label>
              <label className="field">
                Team leader KIIT email
                <input
                  type="email"
                  autoComplete="email"
                  {...register("members.0.email", {
                    required: true,
                    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  })}
                />
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <p>
                All three participants must independently meet the eligibility
                requirements.
              </p>
              <div
                className="member-tabs"
                role="tablist"
                aria-label="Team members"
              >
                {[0, 1, 2].map((i) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={member === i}
                    aria-controls={`member-${i}`}
                    id={`tab-${i}`}
                    key={i}
                    onClick={() => {
                      setMember(i);
                      setError("");
                    }}
                    onKeyDown={(e) => {
                      if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                        e.preventDefault();
                        setMember(
                          (member + (e.key === "ArrowRight" ? 1 : 2)) % 3,
                        );
                      }
                    }}
                  >
                    0{i + 1} / {i === 0 ? "LEADER" : "MEMBER"}
                  </button>
                ))}
              </div>
              <div
                key={member}
                role="tabpanel"
                id={`member-${member}`}
                aria-labelledby={`tab-${member}`}
              >
                {fields(member)}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <p>
                Review these acknowledgments with your entire team. No marketing
                consent is requested.
              </p>
              {declarations.map(([key, label]) => (
                <label className="check-field" key={key}>
                  <input type="checkbox" {...register(`consents.${key}`)} />
                  <span>
                    {label}{" "}
                    {key === "terms" && (
                      <Link target="_blank" href="/terms">
                        Read terms ↗
                      </Link>
                    )}
                    {key === "privacy" && (
                      <Link target="_blank" href="/privacy">
                        Read privacy notice ↗
                      </Link>
                    )}
                  </span>
                </label>
              ))}
            </>
          )}
          {step === 3 && (
            <>
              <p>
                One team. One admission ticket. Check every detail before
                transmission.
              </p>
              <div className="review-head">
                <h3>{values.teamName}</h3>
                {!uncertain && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setStep(0)}
                  >
                    Edit team
                  </button>
                )}
              </div>
              {values.members.map((m, i) => (
                <div className="review-card" key={i}>
                  <div className="review-head">
                    <span className="eyebrow">
                      0{i + 1} / {i === 0 ? "TEAM LEADER" : "MEMBER"}
                    </span>
                    {!uncertain && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setMember(i);
                          setStep(1);
                        }}
                      >
                        Edit member
                      </button>
                    )}
                  </div>
                  <h3>{m.fullName}</h3>
                  <p>
                    {m.rollNumber} · Year {m.academicYear} · {m.branch}
                  </p>
                  <p>
                    {m.email} · {m.phone}
                  </p>
                </div>
              ))}
              <div className="review-card">
                <p>
                  22 December 2026
                  <br />
                  Campus 25, Lecture Halls, KIIT University
                </p>
                <p>
                  All six eligibility, accuracy, terms, and privacy
                  acknowledgments accepted.
                </p>
                {!uncertain && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setStep(2)}
                  >
                    Review declarations
                  </button>
                )}
              </div>
              {uncertain && (
                <div className="notice">
                  The last request may have reached the server. Retry safely
                  with the same details or recover using this private key:{" "}
                  <code>{key.current}</code>. Keep it confidential.
                </div>
              )}
            </>
          )}
          <div className="honey" aria-hidden="true">
            <label>
              Website
              <input
                tabIndex={-1}
                autoComplete="new-password"
                aria-label="Leave this field empty"
                {...register("website")}
              />
            </label>
          </div>
          <div className="form-actions">
            {step > 0 && !uncertain ? (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setStep((s) => s - 1);
                  setError("");
                }}
              >
                ← Back
              </button>
            ) : (
              <span className="eyebrow">{step + 1} / 4</span>
            )}
            <button
              className="button"
              disabled={busy || (step === 3 && !open)}
              type="submit"
            >
              {busy
                ? "TRANSMITTING…"
                : step === 3
                  ? uncertain
                    ? "RETRY REGISTRATION"
                    : "CONFIRM MISSION REGISTRATION"
                  : "CONTINUE"}{" "}
              <span>↗</span>
            </button>
          </div>
        </form>
        <details className="recovery">
          <summary>Already registered? Recover your access</summary>
          <label className="field">
            Private recovery key
            <input
              value={recovery}
              onChange={(e) => setRecovery(e.target.value)}
              autoComplete="off"
            />
          </label>
          <button
            className="button secondary"
            disabled={busy}
            onClick={recover}
          >
            RECOVER REGISTRATION
          </button>
        </details>
      </div>
    </div>
  );
}
