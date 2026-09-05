import { OrbitControls, RoundedBox } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import {
  completePracticeSession,
  createPracticeSession,
  getExercise,
  getPracticeSession,
  getProgress,
  type Exercise,
  type Progress,
} from "./api";
import { AppNav } from "./navigation";
import { sceneTheme } from "./theme";

const difficultyLabels = {
  too_easy: "Too easy",
  just_right: "Right level",
  too_hard: "Too hard",
} as const;

function ProgressDots({ completed, target }: { completed: number; target: number }) {
  return (
    <div className="progress-dots" aria-label={`${completed} of ${target} practices completed this week`}>
      {Array.from({ length: target }, (_, index) => (
        <span key={index} className={index < completed ? "is-filled" : ""} aria-hidden="true" />
      ))}
    </div>
  );
}

function StartLessonButton({
  exerciseId,
  activeSessionId,
  label = "Start today's lesson",
  onStarted,
}: {
  exerciseId: string;
  activeSessionId?: string | null;
  label?: string;
  onStarted?: (sessionId: string) => void;
}) {
  const navigate = useNavigate();
  const start = useMutation({
    mutationFn: () => createPracticeSession(exerciseId),
    onSuccess: (session) => {
      navigate(`/practice/${exerciseId}?session=${session.id}`);
      onStarted?.(session.id);
    },
  });

  if (activeSessionId) {
    return (
      <Link className="button-link" to={`/practice/${exerciseId}?session=${activeSessionId}`}>
        Resume lesson
      </Link>
    );
  }

  return (
    <button type="button" disabled={start.isPending} onClick={() => start.mutate()}>
      {start.isPending ? "Preparing your page…" : label}
    </button>
  );
}

function DashboardLoading() {
  return (
    <div className="dashboard-loading" role="status">
      <span />
      <p>Opening your drawing path…</p>
    </div>
  );
}

export function Dashboard() {
  const progress = useQuery({ queryKey: ["progress"], queryFn: getProgress });
  if (progress.isPending) return <><AppNav /><DashboardLoading /></>;
  if (progress.isError) {
    return <><AppNav /><p role="alert">Your path could not be loaded. Try again shortly.</p></>;
  }

  const data = progress.data;
  const recommended = data.lessons.find(
    (lesson) => lesson.exercise.id === data.recommended_exercise_id,
  ) ?? data.lessons[0];
  const completedThisWeek = Math.min(data.weekly_completed, data.weekly_target);

  return (
    <>
      <AppNav />
      <header className="dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">YOUR NEXT 15 MINUTES</p>
          <h1>Draw one thing.<br />Learn one thing.</h1>
          <p className="lede">
            No course hunting and no perfect-page pressure. Your next beginner lesson is ready.
          </p>
        </div>
        <aside className="week-card" aria-label="This week's practice goal">
          <span>This week</span>
          <strong>{completedThisWeek}<small> / {data.weekly_target}</small></strong>
          <ProgressDots completed={completedThisWeek} target={data.weekly_target} />
          <p>Flexible days. Missed days do not count against you.</p>
        </aside>
      </header>

      <section className="recommended-card" aria-labelledby="recommended-title">
        <div className="lesson-number">{String(recommended.exercise.sequence_index).padStart(2, "0")}</div>
        <div className="recommended-copy">
          <p className="eyebrow">RECOMMENDED · WEEK {recommended.exercise.week_number}</p>
          <h2 id="recommended-title">{recommended.exercise.title}</h2>
          <p>{recommended.exercise.objective}</p>
          <div className="lesson-meta">
            <span>15 gentle minutes</span><span>Paper first</span><span>No upload required</span>
          </div>
          <StartLessonButton
            exerciseId={recommended.exercise.id}
            activeSessionId={recommended.active_session_id}
          />
        </div>
        <LessonVisual kind={recommended.exercise.visual_kind} compact />
      </section>

      <section className="dashboard-grid">
        <article className="milestone-card">
          <p className="eyebrow">CURRENT MILESTONE</p>
          <h2>{data.current_milestone}</h2>
          <div className="path-line" aria-label={`${data.total_completed_lessons} of ${data.total_lessons} lessons complete`}>
            <span style={{ width: `${(data.total_completed_lessons / data.total_lessons) * 100}%` }} />
          </div>
          <p>{data.total_completed_lessons} of {data.total_lessons} lessons complete</p>
          <Link to="/practice">See the whole path →</Link>
        </article>
        <article className="reflection-card">
          <p className="eyebrow">RECENT NOTICE</p>
          {data.recent_reflections[0] ? (
            <>
              <h2>{data.recent_reflections[0].exercise_title}</h2>
              <span className="difficulty-pill">
                {difficultyLabels[data.recent_reflections[0].difficulty_response as keyof typeof difficultyLabels]}
              </span>
              <blockquote>{data.recent_reflections[0].takeaway || "Practice completed—showing up is the first milestone."}</blockquote>
            </>
          ) : (
            <>
              <h2>Your observations will live here.</h2>
              <p>After each lesson, save one small thing you noticed. No grades, just evidence of attention.</p>
            </>
          )}
        </article>
      </section>

      <section className="secondary-tool secondary-tool--reference">
        <div>
          <p className="eyebrow">WHEN YOU WANT A SUBJECT</p>
          <h2>Find a reference worth noticing.</h2>
          <p>Search community images or pick a built-in flower, river, city, or animal study.</p>
        </div>
        <Link className="text-link" to="/references">Browse references →</Link>
      </section>

      <section className="secondary-tool secondary-tool--library">
        <div>
          <p className="eyebrow">WHEN ONE SKILL NEEDS A CLOSER PASS</p>
          <h2>Choose a focused drawing drill.</h2>
          <p>Practice perspective, solid form, or controlled hatching without changing your four-week path.</p>
        </div>
        <Link className="text-link" to="/library">Open the exercise library →</Link>
      </section>

      <section className="secondary-tool secondary-tool--scene-study">
        <div>
          <p className="eyebrow">WHEN A SUBJECT FEELS TOO COMPLICATED</p>
          <h2>Break a scene into drawable decisions.</h2>
          <p>Study the frame, big shapes, perspective, forms, measurements, and light—then rebuild the scene on paper.</p>
        </div>
        <Link className="text-link" to="/studio/3d">Open the scene studio →</Link>
      </section>

      <section className="secondary-tool secondary-tool--style-lab">
        <div>
          <p className="eyebrow">WHEN YOU WANT A STYLE REFERENCE</p>
          <h2>See one place through five drawing languages.</h2>
          <p>Browse original realism, cartoon, architectural, watercolor, and anime-environment references, then follow an attainable four-stage drawing guide.</p>
        </div>
        <Link className="text-link" to="/style-lab">Open the style guide →</Link>
      </section>

      <section className="secondary-tool">
        <div>
          <p className="eyebrow">WHEN YOU WANT A CLOSER LOOK</p>
          <h2>Critique is available, never required.</h2>
          <p>Upload a page for private mark and composition signals without changing your place in the course.</p>
        </div>
        <Link className="text-link" to="/upload">Analyze a sketch →</Link>
      </section>
    </>
  );
}

export function PathOverview() {
  const progress = useQuery({ queryKey: ["progress"], queryFn: getProgress });
  if (progress.isPending) return <><AppNav /><DashboardLoading /></>;
  if (progress.isError) return <><AppNav /><p role="alert">Your path could not be loaded.</p></>;

  return (
    <>
      <AppNav />
      <header className="path-header">
        <p className="eyebrow">FOUR WEEKS · TWELVE LESSONS</p>
        <h1>A calm path into drawing.</h1>
        <p className="lede">Follow the recommendation or choose any lesson intentionally. Nothing expires and every page can be revisited.</p>
      </header>
      <div className="curriculum-path">
        {progress.data.milestones.map((milestone) => (
          <section key={milestone.week_number} className="path-week" aria-labelledby={`week-${milestone.week_number}`}>
            <div className="week-heading">
              <span>Week {milestone.week_number}</span>
              <div>
                <h2 id={`week-${milestone.week_number}`}>{milestone.title}</h2>
                <p>{milestone.completed_lessons} of {milestone.total_lessons} complete</p>
              </div>
            </div>
            <div className="lesson-list">
              {progress.data.lessons.filter((lesson) => lesson.exercise.week_number === milestone.week_number).map((lesson) => {
                const isRecommended = lesson.exercise.id === progress.data.recommended_exercise_id;
                return (
                  <article key={lesson.exercise.id} className={`path-lesson ${isRecommended ? "is-recommended" : ""}`}>
                    <span className={`lesson-status is-${lesson.status}`} aria-label={lesson.status.replace("_", " ")} />
                    <div>
                      <p>{String(lesson.exercise.sequence_index).padStart(2, "0")} · {lesson.exercise.duration_minutes} min</p>
                      <h3>{lesson.exercise.title}</h3>
                      <span>{lesson.exercise.objective}</span>
                      {isRecommended && <strong>Recommended next</strong>}
                    </div>
                    <Link to={`/practice/${lesson.exercise.id}${lesson.active_session_id ? `?session=${lesson.active_session_id}` : ""}`}>
                      {lesson.active_session_id ? "Resume" : lesson.status === "completed" ? "Practice again" : "Preview"}
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

type LessonVisualContext = "hero" | "instruction" | "timer";

function LessonVisual({
  kind,
  compact = false,
  context = compact ? "hero" : "instruction",
  active = true,
}: {
  kind: string;
  compact?: boolean;
  context?: LessonVisualContext;
  active?: boolean;
}) {
  const label = `Instructional diagram for ${kind.replaceAll("-", " ")}`;
  return (
    <div
      className={`lesson-visual visual-${kind} ${compact ? "is-compact" : ""}`}
      data-context={context}
      data-active={active}
    >
      <div className="visual-ambient" aria-hidden="true">
        <span /><span /><span />
      </div>
      <svg viewBox="0 0 360 240" role="img" aria-label={label}>
        <rect x="10" y="10" width="340" height="220" rx="24" className="paper-shape" />
        <g className="lesson-artwork">
        {kind === "lines" && <>
          <circle cx="55" cy="70" r="5" /><circle cx="300" cy="45" r="5" /><path d="M55 70 L300 45" />
          <circle cx="70" cy="135" r="5" /><circle cx="285" cy="170" r="5" /><path d="M70 135 L285 170" />
          <path className="ghost" d="M45 205 C130 160 225 200 315 125" />
        </>}
        {kind === "ellipses" && <>
          <ellipse cx="105" cy="80" rx="62" ry="26" /><ellipse cx="255" cy="75" rx="50" ry="36" transform="rotate(-18 255 75)" />
          <rect x="58" y="140" width="105" height="62" transform="rotate(5 110 171)" /><ellipse cx="110" cy="171" rx="48" ry="27" transform="rotate(5 110 171)" />
          <ellipse cx="255" cy="168" rx="68" ry="22" transform="rotate(20 255 168)" />
        </>}
        {kind === "contour" && <path d="M73 186 C42 151 62 93 111 82 C125 34 194 45 205 88 C253 61 315 101 286 151 C263 194 196 176 160 200 C126 221 95 204 73 186Z" />}
        {kind === "measure" && <>
          <path d="M130 194 L145 62 Q180 43 215 62 L230 194Z" /><path className="guide" d="M110 62 H250 M110 194 H250 M105 62 V194" />
          <path className="tick" d="M98 62 H112 M98 194 H112 M145 50 V65 M215 50 V65" />
        </>}
        {kind === "negative-space" && <>
          <path d="M72 192 V68 H132 C170 68 178 119 145 135 H72 M145 135 C191 154 215 192 215 192 M215 192 V68 H292" />
          <path className="accent-fill" d="M91 86 H128 C146 86 151 112 132 121 H91Z" />
          <path className="accent-fill" d="M154 139 C185 153 195 174 200 192 H112 C125 166 139 148 154 139Z" />
        </>}
        {(kind === "simplify" || kind === "construction" || kind === "capstone") && <>
          <ellipse cx="175" cy="70" rx="61" ry="22" /><path d="M114 70 V168 C116 196 232 196 236 168 V70" /><ellipse cx="175" cy="168" rx="61" ry="22" />
          <path d="M236 91 C304 78 306 164 238 153" />
          <path className="ghost" d="M126 78 L224 161 M224 78 L126 161" />
        </>}
        {kind === "values" && [0, 1, 2, 3, 4].map((value) => <rect key={value} x={48 + value * 54} y="78" width="48" height="84" className={`value-${value}`} />)}
        {kind === "composition" && <>
          <rect x="45" y="52" width="120" height="78" /><circle cx="106" cy="92" r="23" className="accent-fill" />
          <rect x="195" y="52" width="120" height="78" /><circle cx="275" cy="80" r="32" className="accent-fill" />
          <rect x="45" y="150" width="120" height="62" /><path className="accent-fill" d="M45 202 L98 157 L145 212Z" />
          <rect x="195" y="150" width="120" height="62" /><path className="accent-fill" d="M215 212 L250 160 L293 212Z" />
        </>}
        {(kind === "forms" || kind === "perspective") && <>
          <path d="M70 93 L151 55 L221 91 L140 130Z M70 93 V173 L140 213 V130 M140 213 L221 171 V91" />
          <ellipse cx="270" cy="82" rx="38" ry="14" /><path d="M232 82 V175 M308 82 V175" /><ellipse cx="270" cy="175" rx="38" ry="14" />
          {kind === "perspective" && <path className="guide" d="M12 42 L340 145 M12 215 L340 145" />}
        </>}
        </g>
      </svg>
      {!compact && <p>Look for the large idea first. Your page does not need to match this example.</p>}
    </div>
  );
}

function EmbeddedReference({ config }: { config: Record<string, unknown> }) {
  const [rotation, setRotation] = useState<[number, number]>([0.18, 0.48]);
  const shape = String(config.shape ?? "box");
  return (
    <section className="embedded-reference" aria-labelledby="reference-title">
      <div>
        <p className="eyebrow">INTERACTIVE REFERENCE</p>
        <h2 id="reference-title">Turn the form, then draw what changes.</h2>
      </div>
      <div className="reference-stage">
        <Canvas camera={{ position: [3.2, 2.6, 4], fov: 42 }} aria-label="Interactive 3D drawing reference">
          <color attach="background" args={[sceneTheme.canvas]} />
          <ambientLight intensity={0.65} />
          <directionalLight position={[4, 6, 3]} intensity={1.8} />
          <group rotation={[rotation[0], rotation[1], 0]}>
            {shape === "sphere" ? (
              <mesh><sphereGeometry args={[1, 48, 48]} /><meshStandardMaterial color={sceneTheme.coral} roughness={0.72} /></mesh>
            ) : (
              <>
                <RoundedBox args={[1.5, 1.5, 1.5]} position={shape === "box-cylinder" ? [-0.75, 0, 0] : [0, 0, 0]} radius={0.035} smoothness={4}>
                  <meshStandardMaterial color={sceneTheme.coral} roughness={0.72} />
                </RoundedBox>
                {shape === "box-cylinder" && <mesh position={[0.75, 0, 0]}><cylinderGeometry args={[0.65, 0.65, 1.65, 40]} /><meshStandardMaterial color={sceneTheme.blue} roughness={0.72} /></mesh>}
              </>
            )}
          </group>
          <gridHelper args={[10, 10, sceneTheme.plum, sceneTheme.greenSoft]} position={[0, -1.05, 0]} />
          <OrbitControls makeDefault enablePan={false} />
        </Canvas>
      </div>
      <div className="reference-buttons" aria-label="Keyboard-accessible reference views">
        <button type="button" onClick={() => setRotation(([x, y]) => [x, y - 0.35])}>Turn left</button>
        <button type="button" onClick={() => setRotation(([x, y]) => [x, y + 0.35])}>Turn right</button>
        <button type="button" onClick={() => setRotation([-0.65, 0.35])}>View from above</button>
        <button type="button" onClick={() => setRotation([0.18, 0.48])}>Reset view</button>
      </div>
    </section>
  );
}

type TimerState = { phaseIndex: number; secondsRemaining: number };

function GentleTimer({ exercise, sessionId, onReview }: { exercise: Exercise; sessionId: string; onReview: () => void }) {
  const storageKey = `drawcoach-timer-${sessionId}`;
  const initial = useMemo<TimerState>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { return JSON.parse(saved) as TimerState; } catch { /* use lesson default */ }
    }
    return { phaseIndex: 0, secondsRemaining: exercise.timed_phases[0].minutes * 60 };
  }, [exercise.timed_phases, storageKey]);
  const [phaseIndex, setPhaseIndex] = useState(initial.phaseIndex);
  const [secondsRemaining, setSecondsRemaining] = useState(initial.secondsRemaining);
  const [running, setRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(
    initial.secondsRemaining < exercise.timed_phases[initial.phaseIndex].minutes * 60,
  );
  const phase = exercise.timed_phases[phaseIndex];
  const timerState = secondsRemaining === 0
    ? "complete"
    : running
      ? secondsRemaining <= 60 ? "final-minute" : "running"
      : hasStarted ? "paused" : "idle";

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ phaseIndex, secondsRemaining }));
  }, [phaseIndex, secondsRemaining, storageKey]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSecondsRemaining((seconds) => {
        if (seconds > 1) return seconds - 1;
        if (phaseIndex < exercise.timed_phases.length - 1) {
          const nextIndex = phaseIndex + 1;
          setPhaseIndex(nextIndex);
          return exercise.timed_phases[nextIndex].minutes * 60;
        }
        setRunning(false);
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [exercise.timed_phases, phaseIndex, running]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const advance = () => {
    if (phaseIndex < exercise.timed_phases.length - 1) {
      const nextIndex = phaseIndex + 1;
      setPhaseIndex(nextIndex);
      setSecondsRemaining(exercise.timed_phases[nextIndex].minutes * 60);
    } else {
      setRunning(false);
      onReview();
    }
  };

  return (
    <section className="practice-timer lesson-reveal" aria-labelledby="timer-title" data-timer-state={timerState}>
      <div className="timer-motion" aria-hidden="true">
        <span className="timer-orbit" /><span className="timer-sweep" /><span className="timer-spark" />
      </div>
      <div className="phase-rail" aria-label="Lesson phases">
        {exercise.timed_phases.map((item, index) => <span key={item.label} className={index <= phaseIndex ? "is-active" : ""} aria-current={index === phaseIndex ? "step" : undefined}>{item.label}<small>{item.minutes} min</small></span>)}
      </div>
      <div className="timer-focus" key={phaseIndex}>
        <div>
          <p className="eyebrow">PHASE {phaseIndex + 1} OF {exercise.timed_phases.length}</p>
          <h2 id="timer-title">{phase.label}</h2>
          <p>{phase.instruction}</p>
        </div>
        <output aria-live="polite" aria-label={`${minutes} minutes and ${seconds} seconds remaining`}>
          {String(minutes).padStart(2, "0")}<small>:</small>{String(seconds).padStart(2, "0")}
        </output>
      </div>
      <div className="timer-actions">
        <button type="button" onClick={() => { setHasStarted(true); setRunning((value) => !value); }}>{running ? "Pause" : secondsRemaining === 0 ? "Done" : "Start timer"}</button>
        <button type="button" className="quiet-button" onClick={() => setSecondsRemaining((value) => value + 60)}>+ 1 minute</button>
        <button type="button" className="quiet-button" onClick={advance}>{phaseIndex === exercise.timed_phases.length - 1 ? "Reflect now" : "Next phase"}</button>
        <button type="button" className="text-button" onClick={onReview}>Finish early</button>
      </div>
      <p className="timer-note">The timer is a guide, not a test. Pause, extend, or finish whenever the practice feels complete.</p>
    </section>
  );
}

export function ActiveLesson() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const sessionFromUrl = new URLSearchParams(location.search).get("session");
  const [sessionId, setSessionId] = useState<string | null>(sessionFromUrl);
  const [showReflection, setShowReflection] = useState(false);
  const [difficulty, setDifficulty] = useState<keyof typeof difficultyLabels | null>(null);
  const [takeaway, setTakeaway] = useState("");
  const [completion, setCompletion] = useState<Progress | null>(null);

  useEffect(() => {
    setSessionId(sessionFromUrl);
    setShowReflection(false);
    setDifficulty(null);
    setTakeaway("");
    setCompletion(null);
  }, [id, sessionFromUrl]);

  const exercise = useQuery({ queryKey: ["exercise", id], queryFn: () => getExercise(id) });
  const progress = useQuery({ queryKey: ["progress"], queryFn: getProgress });
  const existing = progress.data?.lessons.find((lesson) => lesson.exercise.id === id)?.active_session_id;
  useEffect(() => {
    if (!sessionId && existing) setSessionId(existing);
  }, [existing, sessionId]);
  useQuery({
    queryKey: ["practice-session", sessionId],
    queryFn: () => getPracticeSession(sessionId!),
    enabled: Boolean(sessionId),
  });
  const start = useMutation({
    mutationFn: () => createPracticeSession(id),
    onSuccess: (session) => {
      setSessionId(session.id);
      navigate(`/practice/${id}?session=${session.id}`, { replace: true });
    },
  });
  const complete = useMutation({
    mutationFn: () => completePracticeSession(sessionId!, difficulty!, takeaway),
    onSuccess: (result) => {
      localStorage.removeItem(`drawcoach-timer-${sessionId}`);
      queryClient.setQueryData(["progress"], result.progress);
      setCompletion(result.progress);
    },
  });

  if (exercise.isPending) return <><AppNav /><DashboardLoading /></>;
  if (exercise.isError) return <><AppNav /><p role="alert">This lesson could not be loaded.</p></>;
  const lesson = exercise.data;
  const nextLesson = completion?.lessons.find((item) => item.exercise.id === completion.recommended_exercise_id);

  if (completion) {
    return (
      <>
        <AppNav />
        <section className="completion-screen">
          <div className="completion-delight" aria-hidden="true">
            <span /><span /><span /><span /><span /><span />
            <p className="completion-mark">✓</p>
          </div>
          <p className="eyebrow">PAGE COMPLETE</p>
          <h1>You showed up.<br />That counts.</h1>
          <p className="lede">{lesson.title} is saved to your path. The page can be imperfect and still be useful.</p>
          {difficulty === "too_hard" && <article className="replay-offer"><span>Try a gentler replay</span><h2>Same idea, smaller step.</h2><p>{lesson.replay_variation}</p><StartLessonButton exerciseId={lesson.id} label="Repeat with this variation" onStarted={(newSessionId) => { setSessionId(newSessionId); setCompletion(null); setShowReflection(false); setDifficulty(null); setTakeaway(""); }} /></article>}
          <div className="completion-actions">
            {nextLesson && <Link className="button-link" to={`/practice/${nextLesson.exercise.id}`}>Preview next: {nextLesson.exercise.title}</Link>}
            <Link className="text-link" to="/">Return to dashboard</Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <div className="lesson-motion-page">
      <AppNav />
      <article className="lesson-hero lesson-reveal">
        <div>
          <Link to="/practice">← Four-week path</Link>
          <p className="eyebrow">LESSON {String(lesson.sequence_index).padStart(2, "0")} · WEEK {lesson.week_number}</p>
          <h1>{lesson.title}</h1>
          <p className="lede">{lesson.objective}</p>
          <div className="lesson-meta"><span>{lesson.duration_minutes} minutes</span><span>{lesson.materials.join(" · ")}</span></div>
        </div>
        <LessonVisual kind={lesson.visual_kind} compact context="hero" />
      </article>

      <section className="micro-lesson lesson-reveal">
        <article><p className="eyebrow">THE IDEA</p><h2>{lesson.concept}</h2><p>{lesson.why_it_matters}</p></article>
        <article className="mistake-card"><p className="eyebrow">WATCH FOR</p><h2>One common detour</h2><p>{lesson.common_mistake}</p></article>
      </section>
      <div className="lesson-reveal"><LessonVisual kind={lesson.visual_kind} context="instruction" /></div>
      {lesson.three_d_config && <EmbeddedReference config={lesson.three_d_config} />}
      <section className="lesson-steps lesson-reveal" aria-labelledby="steps-title">
        <p className="eyebrow">ON YOUR PAGE</p>
        <h2 id="steps-title">Three clear steps</h2>
        <ol>{lesson.instructions.map((instruction, index) => <li key={instruction}><span>{index + 1}</span><p>{instruction}</p></li>)}</ol>
      </section>

      {!sessionId ? (
        <section className="start-practice-panel">
          <div><p className="eyebrow">READY WHEN YOU ARE</p><h2>Put the paper in front of you.</h2><p>The paced timer starts only when you ask it to.</p></div>
          <button type="button" disabled={start.isPending} onClick={() => start.mutate()}>{start.isPending ? "Preparing…" : "Begin this lesson"}</button>
        </section>
      ) : showReflection ? (
        <section className="reflection-form" aria-labelledby="reflection-title">
          <p className="eyebrow">ONE SMALL REFLECTION</p>
          <h2 id="reflection-title">How did that level feel?</h2>
          <div className="difficulty-options">
            {(Object.entries(difficultyLabels) as [keyof typeof difficultyLabels, string][]).map(([value, label]) => (
              <button key={value} type="button" className={difficulty === value ? "is-selected" : ""} aria-pressed={difficulty === value} onClick={() => setDifficulty(value)}>{label}</button>
            ))}
          </div>
          <label><span>What did you notice? <em>Optional</em></span><textarea maxLength={500} value={takeaway} onChange={(event) => setTakeaway(event.target.value)} placeholder="One line felt more confident when…" /></label>
          {complete.isError && <p role="alert">Your reflection could not be saved. Your page is still yours—please try once more.</p>}
          <button type="button" disabled={!difficulty || complete.isPending} onClick={() => complete.mutate()}>{complete.isPending ? "Saving your place…" : "Complete lesson"}</button>
        </section>
      ) : (
        <GentleTimer exercise={lesson} sessionId={sessionId} onReview={() => setShowReflection(true)} />
      )}
    </div>
  );
}
