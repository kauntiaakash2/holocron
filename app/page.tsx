export const dynamic = "force-dynamic";
import Image from "next/image";
import { VerticalDialNav } from "@/components/VerticalDialNav";
import { HolocronPortal } from "@/components/HolocronPortal";
import { HomeSections, MissionSection } from "@/components/HomeSections";
import { HolocronAtmosphere } from "@/components/holocron/HolocronAtmosphere";
import { HolocronExperience } from "@/components/holocron/HolocronExperience";
import { Preloader } from "@/components/Preloader";
import { MissionMarquee } from "@/components/MissionMarquee";
import styles from "./home.module.css";

export default function Home() {
  return (
    <>
      <Preloader />
      <VerticalDialNav />
      <main id="main">
        <HolocronPortal
          mission={
            <div className={styles.content}>
              <MissionSection />
              <MissionMarquee />
            </div>
          }
          hero={
            <section
              id="archive"
              tabIndex={-1}
              className={styles.scene}
              aria-label="HOL0CRON interactive archive"
            >
              <HolocronAtmosphere />
              <div
                className={styles.organizerBrand}
                role="group"
                aria-label="Organizers"
              >
                <div className={styles.organizerIdentity}>
                  <Image
                    className={styles.algozenithLogo}
                    src="/organizers/algozenith-symbol.png"
                    alt=""
                    width={256}
                    height={231}
                    sizes="(max-height: 500px) 26px, (max-width: 600px) 26px, 34px"
                    loading="eager"
                  />
                  <span className={styles.organizerName}>
                    AlgoZenith
                    <small>KIIT CHAPTER</small>
                  </span>
                </div>
                <span className={styles.organizerDivider} aria-hidden="true">
                  ×
                </span>
                <div className={styles.organizerIdentity}>
                  <Image
                    className={styles.kodewreckLogo}
                    src="/organizers/kodewreck-symbol.png"
                    alt=""
                    width={161}
                    height={70}
                    sizes="(max-height: 500px) 42px, (max-width: 600px) 42px, 54px"
                    loading="eager"
                  />
                  <span className={styles.organizerName}>KodeWreck</span>
                </div>
              </div>
              <h1 className={styles.accessibleTitle}>HOL0CRON</h1>
              <div className={styles.stage}>
                <HolocronExperience waitForIntro centered />
              </div>
            </section>
          }
        >
          <div className={styles.content}>
            <HomeSections />
          </div>
        </HolocronPortal>
      </main>
    </>
  );
}
