/**
 * THE DOJO — Physiological Override System
 * 
 * Local MP3 storage in IndexedDB as Blobs.
 * Zero-latency playback via URL.createObjectURL(blob).
 * Free-form categories with Lucide icons.
 */

import { db, type DojoTrack } from './db';

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

// ── Storage ────────────────────────────────────────────────────────────────────

export async function addTrack(
  file: File,
  title: string,
  category: string,
  icon: string
): Promise<number> {
  const blob = new Blob([await file.arrayBuffer()], { type: file.type });
  const duration = await getAudioDuration(blob);

  const id = await db.dojo.add({
    blob,
    title,
    category,
    icon,
    duration,
    addedAt: Date.now(),
  });

  return id as number;
}

export async function removeTrack(id: number): Promise<void> {
  await db.dojo.delete(id);
}

export async function getAllTracks(): Promise<DojoTrack[]> {
  return db.dojo.toArray();
}

// ── Playback ───────────────────────────────────────────────────────────────────

export function playTrack(track: DojoTrack): HTMLAudioElement {
  stopPlayback();

  const url = URL.createObjectURL(track.blob);
  currentObjectUrl = url;

  const audio = new Audio(url);
  audio.volume = 1.0;
  currentAudio = audio;

  audio.play().catch(console.error);

  audio.addEventListener('ended', () => {
    cleanupAudio();
  });

  return audio;
}

export function stopPlayback(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    cleanupAudio();
  }
}

export function pausePlayback(): void {
  if (currentAudio) {
    currentAudio.pause();
  }
}

export function resumePlayback(): void {
  if (currentAudio) {
    currentAudio.play().catch(console.error);
  }
}

export function isPlaying(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

export function getCurrentAudio(): HTMLAudioElement | null {
  return currentAudio;
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function cleanupAudio(): void {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  currentAudio = null;
}

function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      resolve(Math.round(audio.duration));
      URL.revokeObjectURL(url);
    });
    audio.addEventListener('error', () => {
      resolve(0);
      URL.revokeObjectURL(url);
    });
  });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
