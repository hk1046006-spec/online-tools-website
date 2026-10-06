'use strict';

/**
 * Minimal file-backed session store.
 *
 * express-session's default MemoryStore leaks by design and logs a warning in
 * production. This store keeps sessions in data/sessions.json with the same
 * rules: JSON only, atomic writes, expired entries pruned on load and every
 * ten minutes. It also means an admin stays signed in across a server restart.
 */

const fs = require('fs');
const path = require('path');
const session = require('express-session');

class FileSessionStore extends session.Store {
  constructor(file) {
    super();
    this.file = file;
    this.sessions = this.load();
    this.timer = setInterval(() => this.prune(), 10 * 60 * 1000);
    if (this.timer.unref) this.timer.unref();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      const now = Date.now();
      const clean = {};
      Object.keys(parsed).forEach((sid) => {
        const entry = parsed[sid];
        if (!entry || (entry.expires && entry.expires < now)) return;
        clean[sid] = entry;
      });
      return clean;
    } catch (err) {
      return {};
    }
  }

  persist() {
    const tmp = `${this.file}.${process.pid}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(this.sessions), 'utf8');
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.warn(`[session-store] could not persist sessions: ${err.message}`);
    }
  }

  expiryOf(data) {
    if (data && data.cookie && data.cookie.expires) {
      const time = new Date(data.cookie.expires).getTime();
      if (!Number.isNaN(time)) return time;
    }
    if (data && data.cookie && data.cookie.originalMaxAge) {
      return Date.now() + data.cookie.originalMaxAge;
    }
    return Date.now() + 8 * 60 * 60 * 1000;
  }

  get(sid, callback) {
    const entry = this.sessions[sid];
    if (!entry) return callback(null, null);
    if (entry.expires && entry.expires < Date.now()) {
      delete this.sessions[sid];
      this.persist();
      return callback(null, null);
    }
    return callback(null, entry.data);
  }

  set(sid, data, callback) {
    this.sessions[sid] = { data, expires: this.expiryOf(data) };
    this.persist();
    return callback(null);
  }

  touch(sid, data, callback) {
    const entry = this.sessions[sid];
    if (entry) {
      entry.data = data;
      entry.expires = this.expiryOf(data);
      this.persist();
    }
    return callback(null);
  }

  destroy(sid, callback) {
    delete this.sessions[sid];
    this.persist();
    return callback(null);
  }

  length(callback) {
    return callback(null, Object.keys(this.sessions).length);
  }

  clear(callback) {
    this.sessions = {};
    this.persist();
    return callback(null);
  }

  prune() {
    const now = Date.now();
    let changed = false;
    Object.keys(this.sessions).forEach((sid) => {
      const entry = this.sessions[sid];
      if (!entry || (entry.expires && entry.expires < now)) {
        delete this.sessions[sid];
        changed = true;
      }
    });
    if (changed) this.persist();
  }
}

module.exports = FileSessionStore;
