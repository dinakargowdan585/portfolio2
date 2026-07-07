const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (start, end, amount) => start + (end - start) * amount;
const smoothstep = (value) => value * value * (3 - 2 * value);

export function initHeroScrollVideo(root = document) {
  const section = root.querySelector("[data-hero-scroll-video]");
  const video = section?.querySelector("[data-hero-scroll-video-element]");

  if (!section || !video) {
    return () => {};
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const abortController = new AbortController();
  const progressEase = 0.045;
  const timeEase = 0.055;
  const state = {
    duration: 0,
    currentProgress: 0,
    targetProgress: 0,
    displayTime: 0,
    scrollStart: 0,
    scrollEnd: 1,
    lastSeekTime: -1,
    rafId: 0,
    ticking: false,
    reducedMotion: prefersReducedMotion.matches,
    ready: false,
    destroyed: false,
  };

  const setProgress = (progress) => {
    section.style.setProperty("--hero-progress", `${clamp(progress, 0, 1)}`);
  };

  const setMotionVars = (progress, reveal) => {
    const overlayShift = lerp(0, -12, progress);
    const copyShift = lerp(26, 0, reveal);
    const hintShift = lerp(10, 0, reveal);

    section.style.setProperty("--hero-overlay-y", `${overlayShift.toFixed(2)}px`);
    section.style.setProperty("--hero-copy-y", `${copyShift.toFixed(2)}px`);
    section.style.setProperty("--hero-copy-opacity", `${reveal.toFixed(3)}`);
    section.style.setProperty("--hero-hint-y", `${hintShift.toFixed(2)}px`);
    section.style.setProperty("--hero-hint-opacity", `${reveal.toFixed(3)}`);
  };

  const updateMetrics = () => {
    const viewportHeight = window.innerHeight || 1;
    const sectionHeight = Math.max(section.offsetHeight, viewportHeight);

    state.scrollStart = section.offsetTop;
    state.scrollEnd = state.scrollStart + Math.max(sectionHeight - viewportHeight, 1);
  };

  const seekVideo = (progress) => {
    if (!state.duration || !Number.isFinite(state.duration)) return;

    const targetTime = clamp(
      smoothstep(progress) * state.duration,
      0,
      Math.max(state.duration - 0.016, 0)
    );
    state.displayTime = lerp(state.displayTime, targetTime, timeEase);

    if (!video.seeking && Math.abs(state.displayTime - state.lastSeekTime) > 0.03) {
      state.lastSeekTime = state.displayTime;
      video.currentTime = state.displayTime;
    }
  };

  const frame = () => {
    state.ticking = false;

    if (state.destroyed) return;

    if (state.reducedMotion) {
      setProgress(0);
      return;
    }

    state.currentProgress = lerp(state.currentProgress, state.targetProgress, progressEase);

    if (Math.abs(state.targetProgress - state.currentProgress) < 0.0005) {
      state.currentProgress = state.targetProgress;
    }

    seekVideo(state.currentProgress);
    setProgress(state.currentProgress);

    const revealProgress = clamp((state.currentProgress - 0.94) / 0.06, 0, 1);
    const reveal = smoothstep(revealProgress);
    setMotionVars(state.currentProgress, reveal);
    section.classList.toggle("is-copy-visible", revealProgress > 0);

    if (Math.abs(state.targetProgress - state.currentProgress) > 0.0008) {
      schedule();
    }
  };

  const schedule = () => {
    if (state.ticking || state.destroyed) return;

    state.ticking = true;
    state.rafId = window.requestAnimationFrame(frame);
  };

  const syncFromScroll = () => {
    if (state.reducedMotion) return;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const rawProgress = (scrollY - state.scrollStart) / (state.scrollEnd - state.scrollStart);

    state.targetProgress = clamp(rawProgress, 0, 1);
    schedule();
  };

  const applyReducedMotion = () => {
    state.reducedMotion = prefersReducedMotion.matches;
    section.classList.toggle("is-reduced-motion", state.reducedMotion);

    if (state.reducedMotion) {
      setProgress(0);
      section.classList.add("is-copy-visible");
      setMotionVars(1, 1);
      video.pause();
      if (state.ready) {
        video.currentTime = 0;
      }
      return;
    }

    updateMetrics();
    syncFromScroll();
  };

  const setReadyState = () => {
    if (state.ready) return;

    state.ready = true;
    section.classList.add("is-ready");

    if (state.reducedMotion) {
      section.classList.add("is-copy-visible");
      setMotionVars(1, 1);
      video.pause();
      return;
    }

    video.pause();
    video.currentTime = 0;
    state.displayTime = 0;
    state.lastSeekTime = 0;
    updateMetrics();
    syncFromScroll();
  };

  const onLoadedMetadata = () => {
    state.duration = Number.isFinite(video.duration) ? video.duration : 0;
    setReadyState();
  };

  const onLoadedData = () => {
    if (!state.duration && Number.isFinite(video.duration)) {
      state.duration = video.duration;
    }

    if (state.ready) {
      state.displayTime = clamp(
        video.currentTime,
        0,
        Math.max(state.duration - 0.016, 0)
      );
      state.lastSeekTime = state.displayTime;
    }

    setReadyState();
  };

  const onResize = () => {
    updateMetrics();
    syncFromScroll();
  };

  const onScroll = () => {
    syncFromScroll();
  };

  updateMetrics();
  setMotionVars(0, 0);

  if (video.readyState >= 1) {
    onLoadedMetadata();
  }

  if (video.readyState >= 2) {
    onLoadedData();
  }

  video.addEventListener("loadedmetadata", onLoadedMetadata, {
    signal: abortController.signal,
  });

  video.addEventListener("loadeddata", onLoadedData, {
    signal: abortController.signal,
  });

  video.addEventListener("error", () => {
    section.classList.remove("is-ready");
  }, {
    signal: abortController.signal,
  });

  window.addEventListener("scroll", onScroll, {
    passive: true,
    signal: abortController.signal,
  });

  window.addEventListener("resize", onResize, {
    passive: true,
    signal: abortController.signal,
  });

  prefersReducedMotion.addEventListener?.("change", applyReducedMotion, {
    signal: abortController.signal,
  });

  applyReducedMotion();

  if (!state.reducedMotion) {
    syncFromScroll();
  }

  return () => {
    state.destroyed = true;
    abortController.abort();

    if (state.rafId) {
      window.cancelAnimationFrame(state.rafId);
    }
  };
}
