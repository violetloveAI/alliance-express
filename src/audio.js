/** Original recordings only. Music loops; effects replace one another. */
export class JourneyAudio {
  constructor({ musicUrl, sounds = {} } = {}) {
    this._musicUrl = musicUrl;
    this._sounds = sounds;
    this._player = null;
    this._effect = null;
    this._enabled = false;
    this._started = false;
    this._suspended = false;
    this._generation = 0;
    this._musicVolume = 0.24;
  }

  get enabled() { return this._enabled; }

  /** First departure opts into music; later departures keep the user's choice. */
  start() {
    if (this._started) return Promise.resolve(this._enabled);
    this._started = true;
    return this.enable();
  }

  async enable() {
    const generation = ++this._generation;
    this._enabled = true;
    if (this._suspended) return false;
    try {
      if (!this._player) {
        this._player = new Audio(this._musicUrl);
        this._player.loop = true;
        this._player.preload = 'none';
        this._player.volume = this._musicVolume;
      }
      // Keep play() in the initiating click's call stack for autoplay policies.
      await this._player.play();
      if (generation !== this._generation) return false;
      return this._enabled;
    } catch {
      if (generation === this._generation) this.disable();
      return false;
    }
  }

  disable() {
    this._generation += 1;
    this._enabled = false;
    this.stopEffects();
    this._player?.pause();
  }

  /** Page lifecycle pauses playback without changing the sound preference. */
  suspend() {
    this._suspended = true;
    this._generation += 1;
    this.stopEffects();
    this._player?.pause();
  }

  resume() {
    if (!this._suspended) return Promise.resolve(this._enabled);
    this._suspended = false;
    return this._enabled ? this.enable() : Promise.resolve(false);
  }

  /** Resolves when playback starts, not when the recording finishes. */
  async play(event) {
    const sound = this._sounds[event];
    if (!this._enabled || this._suspended || !sound?.url) return false;
    this.stopEffects();

    let effect;
    try {
      const player = new Audio(sound.url);
      player.preload = 'auto';
      player.volume = Number.isFinite(sound.volume) ? Math.max(0, Math.min(1, sound.volume)) : 0.65;
      const start = Number.isFinite(sound.start) ? Math.max(0, sound.start) : 0;
      const end = Number.isFinite(sound.end) && sound.end > start ? sound.end : null;
      effect = { player, timer: null, listeners: [] };
      this._effect = effect;

      const listen = (type, handler) => {
        player.addEventListener(type, handler);
        effect.listeners.push([type, handler]);
      };
      const clearTimer = () => {
        clearTimeout(effect.timer);
        effect.timer = null;
      };
      const finish = () => {
        if (this._effect === effect) this.stopEffects();
      };
      const checkRange = () => {
        clearTimer();
        if (this._effect !== effect || end === null) return;
        if (player.currentTime >= end) return finish();
        if (player.paused) return;
        // Recheck media time after the deadline: buffering must not cut a clip early.
        const remaining = (end - player.currentTime) / (player.playbackRate || 1);
        effect.timer = setTimeout(checkRange, Math.max(16, Math.ceil(remaining * 1000)));
      };
      let positioned = false;
      const seekStart = () => {
        if (this._effect !== effect || positioned) return;
        if (start > 0) player.currentTime = start;
        positioned = true;
        checkRange();
      };
      listen('loadedmetadata', seekStart);
      listen('playing', checkRange);
      listen('timeupdate', checkRange);
      listen('seeked', checkRange);
      listen('ratechange', checkRange);
      listen('waiting', clearTimer);
      listen('pause', clearTimer);
      listen('ended', finish);
      listen('error', finish);
      if (player.readyState >= 1) seekStart();
      this._mix();

      // Request play synchronously inside the user's gesture, before awaiting it.
      await player.play();
      if (this._effect !== effect || !this._enabled) {
        player.pause();
        return false;
      }
      checkRange();
      return true;
    } catch {
      if (effect && this._effect === effect) this.stopEffects();
      return false;
    }
  }

  stopEffects() {
    const effect = this._effect;
    this._effect = null;
    if (effect) {
      clearTimeout(effect.timer);
      for (const [type, handler] of effect.listeners) effect.player.removeEventListener(type, handler);
      effect.player.pause();
    }
    this._mix();
  }

  _mix() {
    if (this._player) this._player.volume = this._musicVolume * (this._effect ? 0.4 : 1);
  }
}
