import Link from "next/link";
import { ArchiveReveal } from "@/components/ArchiveReveal";
import { ChallengeExplorer } from "@/components/ChallengeExplorer";

/** The first real page is also the portal's destination layer. */
export function MissionSection() {
  return (
    <ArchiveReveal>
      <section className="mission section" id="mission" tabIndex={-1}>
        <div className="section-index">
          <span className="eyebrow gold">01 / THE MISSION</span>
          <span className="small-rule" />
        </div>
        <div className="mission-body">
          <h2 data-archive-reveal="heading">
            Don’t just solve.
            <span>Build the advantage.</span>
          </h2>
          <div className="mission-text" data-archive-reveal="copy">
            <div className="mission-story">
              <p>
                An ancient archive of engineering knowledge has been discovered.
                Its systems are unfinished. Its next chapter belongs to you.
              </p>
              <p>
                HOL0CRON brings teams of three together to build tools, systems,
                and infrastructure for the competitive programming ecosystem.
              </p>
            </div>
            <div className="mission-purpose">
              <span className="eyebrow gold">THE CORE PRINCIPLE</span>
              <p className="principle">
                Build technology that makes programmers better at solving
                problems themselves, not technology that solves live contests
                for them.
              </p>
              <span className="eyebrow">
                THIS IS A PRODUCT-BUILDING HACKATHON.
              </span>
            </div>
          </div>
        </div>
      </section>
    </ArchiveReveal>
  );
}

/** Remaining event content follows the released mission in normal document flow. */
export function HomeSections() {
  return (
    <>
      <ArchiveReveal>
        <ChallengeExplorer />
      </ArchiveReveal>
      <ArchiveReveal>
        <section className="section brief" id="brief" tabIndex={-1}>
          <div>
            <p className="eyebrow gold">03 / MISSION BRIEF</p>
            <h2>
              Three minds.
              <br />
              One new possibility.
            </h2>
            <p>
              Assemble your crew. Bring your curiosity.
              <br />
              Leave your mark on the archive.
            </p>
            <Link href="/register" className="button">
              INITIATE REGISTRATION <span>↗</span>
            </Link>
          </div>
          <dl>
            {[
              ["Event", "HOL0CRON"],
              ["Date", "22 December 2026"],
              ["Timing", process.env.EVENT_TIME_LABEL || "To be announced"],
              ["Location", "Campus 25, Lecture Halls · KIIT University"],
              ["Eligibility", "KIIT undergraduates · Years 1, 2 & 3"],
              ["Team size", "Exactly 3 eligible participants"],
            ].map(([key, value]) => (
              <div key={key} data-archive-reveal="detail">
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </ArchiveReveal>
      <ArchiveReveal>
        <section className="archive-invite" id="join" tabIndex={-1}>
          <span className="eyebrow">THE NEXT CHAPTER IS NOT WRITTEN YET.</span>
          <h2 data-archive-reveal="closing">It has your name on it.</h2>
          <Link href="/register" className="button">
            JOIN THE ARCHIVE <span>↗</span>
          </Link>
          <svg
            className="giant-wordmark"
            viewBox="0 0 1000 140"
            aria-hidden="true"
            focusable="false"
          >
            <text
              x="0"
              y="200"
              textLength="1000"
              lengthAdjust="spacingAndGlyphs"
            >
              HOL0CRON
            </text>
          </svg>
        </section>
      </ArchiveReveal>
    </>
  );
}
