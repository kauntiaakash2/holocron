"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import styles from "./unfinished-systems.module.css";

const domains = [
  {
    name: "Training infrastructure",
    question: "Make every practice session count.",
    description:
      "Build better paths from first principles to independent problem-solving.",
    ideas: ["Adaptive practice planners", "Concept-based learning paths"],
  },
  {
    name: "Learning analytics",
    question: "Turn practice into understanding.",
    description: "Turn practice data into insights that help programmers grow.",
    ideas: ["Skill progression dashboards", "Post-practice reflection tools"],
  },
  {
    name: "Problem setting",
    question: "Give great problems better tools.",
    description:
      "Create tools for thoughtful problems, generators, and stronger contests.",
    ideas: ["Problem authoring workspaces", "Constraint-aware generators"],
  },
  {
    name: "Testing systems",
    question: "Find the cases everyone missed.",
    description: "Engineer test cases that find what everyone else missed.",
    ideas: ["Edge-case exploration tools", "Test-suite coverage analysis"],
  },
  {
    name: "Contest integrity",
    question: "Keep the playing field fair.",
    description:
      "Protect fair play through plagiarism detection and trusted systems.",
    ideas: ["Similarity review workspaces", "Contest integrity audit tools"],
  },
  {
    name: "Quality assurance",
    question: "Build trust in every verdict.",
    description:
      "Strengthen judging infrastructure and the systems behind every verdict.",
    ideas: ["Judge reliability testing", "Sandbox regression tools"],
  },
];

export function ChallengeExplorer() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const id = useId();

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        next = (index + 1) % domains.length;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        next = (index - 1 + domains.length) % domains.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = domains.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }

  return (
    <section
      className={`section domains ${styles.systems}`}
      id="domains"
      tabIndex={-1}
      aria-labelledby="systems-heading"
    >
      <div className={styles.heading}>
        <div>
          <p className="eyebrow gold">02 / UNFINISHED SYSTEMS</p>
          <h2 id="systems-heading" data-archive-reveal="heading">
            What will you build?
          </h2>
        </div>
        <p>
          Explore six ways to improve the competitive programming ecosystem.
        </p>
      </div>

      <div className={styles.explorer}>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Challenge areas"
          aria-orientation="vertical"
        >
          {domains.map((domain, index) => (
            <button
              key={domain.name}
              className={`domain ${styles.tab}`}
              type="button"
              role="tab"
              id={`${id}-tab-${index}`}
              aria-controls={`${id}-panel-${index}`}
              aria-selected={selected === index}
              tabIndex={selected === index ? 0 : -1}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              onClick={() => setSelected(index)}
              onKeyDown={(event) => navigate(event, index)}
            >
              <span className={styles.index} aria-hidden="true">
                0{index + 1}
              </span>
              <span>{domain.name}</span>
              <span className={styles.arrow} aria-hidden="true">
                ↗
              </span>
            </button>
          ))}
        </div>

        <div className={styles.panels}>
          {domains.map((domain, index) => (
            <div
              key={domain.name}
              className={styles.panel}
              role="tabpanel"
              id={`${id}-panel-${index}`}
              aria-labelledby={`${id}-tab-${index}`}
              hidden={selected !== index}
              tabIndex={0}
            >
              <p className={styles.panelLabel}>
                <span className="eyebrow gold">{domain.name}</span>
                <span className={styles.panelIndex} aria-hidden="true">
                  0{index + 1}
                </span>
              </p>
              <h3>{domain.question}</h3>
              <p className={styles.description}>{domain.description}</p>
              <div className={styles.ideas}>
                <p className="eyebrow">POSSIBLE DIRECTIONS</p>
                <ul>
                  {domain.ideas.map((idea) => (
                    <li key={idea}>{idea}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className={styles.note}>
        Ideas to spark your thinking. These are illustrative areas, not official
        problem statements.
      </p>
    </section>
  );
}
