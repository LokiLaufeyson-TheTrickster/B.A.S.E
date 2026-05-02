'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { DojoTrack } from '@/lib/db';
import {
  addTrack, removeTrack, getAllTracks,
  playTrack, stopPlayback,
  formatDuration,
} from '@/lib/dojo';
import {
  Flame, Zap, Swords, Shield, Brain, Heart, Dumbbell, Target,
  Skull, Crown, Rocket, Timer, Volume2, Music, Radio, Headphones,
  Mountain, Sun, Moon, CloudLightning, Wind, Waves, Eye, Star,
  type LucideIcon,
} from 'lucide-react';

// ── Curated Icon Palette ───────────────────────────────────────────────────────

const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: 'flame', icon: Flame },
  { name: 'zap', icon: Zap },
  { name: 'swords', icon: Swords },
  { name: 'shield', icon: Shield },
  { name: 'brain', icon: Brain },
  { name: 'heart', icon: Heart },
  { name: 'dumbbell', icon: Dumbbell },
  { name: 'target', icon: Target },
  { name: 'skull', icon: Skull },
  { name: 'crown', icon: Crown },
  { name: 'rocket', icon: Rocket },
  { name: 'timer', icon: Timer },
  { name: 'volume2', icon: Volume2 },
  { name: 'music', icon: Music },
  { name: 'radio', icon: Radio },
  { name: 'headphones', icon: Headphones },
  { name: 'mountain', icon: Mountain },
  { name: 'sun', icon: Sun },
  { name: 'moon', icon: Moon },
  { name: 'cloudLightning', icon: CloudLightning },
  { name: 'wind', icon: Wind },
  { name: 'waves', icon: Waves },
  { name: 'eye', icon: Eye },
  { name: 'star', icon: Star },
];

function getIconComponent(iconName: string): LucideIcon {
  const found = ICON_OPTIONS.find(o => o.name === iconName);
  return found ? found.icon : Music;
}

// ── Upload Modal ───────────────────────────────────────────────────────────────

interface UploadModalProps {
  file: File;
  onConfirm: (title: string, category: string, icon: string) => void;
  onCancel: () => void;
}

function UploadModal({ file, onConfirm, onCancel }: UploadModalProps) {
  const [title, setTitle] = useState(file.name.replace(/\.[^.]+$/, ''));
  const [category, setCategory] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('flame');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !category.trim()) return;
    onConfirm(title.trim(), category.trim(), selectedIcon);
  };

  return (
    <div className="tp-overlay" style={{ zIndex: 700 }}>
      <div className="tp-container animate-slide-up" style={{ maxWidth: '480px' }}>
        <div className="tp-header">
          <span className="tp-header-title">ADD TRACK TO DOJO</span>
          <button onClick={onCancel} style={{ color: 'var(--gray-500)', fontSize: '16px' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* File Info */}
          <div style={{
            fontSize: '10px', fontFamily: 'var(--font-mono)',
            color: 'var(--gray-500)', letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            FILE: {file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)
          </div>

          {/* Track Name */}
          <div>
            <label style={{
              display: 'block', fontSize: '9px', fontWeight: 700,
              letterSpacing: '2px', textTransform: 'uppercase',
              color: 'var(--gray-500)', marginBottom: '6px',
            }}>TRACK NAME</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Lose Yourself"
              style={{
                width: '100%', padding: '10px 14px', fontSize: '13px',
                borderRadius: 'var(--radius)',
              }}
              autoFocus
            />
          </div>

          {/* Category Name */}
          <div>
            <label style={{
              display: 'block', fontSize: '9px', fontWeight: 700,
              letterSpacing: '2px', textTransform: 'uppercase',
              color: 'var(--gray-500)', marginBottom: '6px',
            }}>CATEGORY</label>
            <input
              type="text"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Morning Motivation, War Mode, Focus..."
              style={{
                width: '100%', padding: '10px 14px', fontSize: '13px',
                borderRadius: 'var(--radius)',
              }}
            />
          </div>

          {/* Icon Picker */}
          <div>
            <label style={{
              display: 'block', fontSize: '9px', fontWeight: 700,
              letterSpacing: '2px', textTransform: 'uppercase',
              color: 'var(--gray-500)', marginBottom: '8px',
            }}>ICON</label>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '4px',
            }}>
              {ICON_OPTIONS.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedIcon(name)}
                  style={{
                    width: '40px', height: '40px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${selectedIcon === name ? 'var(--crimson)' : 'var(--gray-300)'}`,
                    borderRadius: 'var(--radius)',
                    background: selectedIcon === name ? 'var(--crimson-glow)' : 'transparent',
                    color: selectedIcon === name ? 'var(--crimson)' : 'var(--gray-500)',
                    transition: 'var(--transition)',
                  }}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="tp-send"
            style={{ width: '100%', padding: '14px', marginTop: '4px' }}
            disabled={!title.trim() || !category.trim()}
          >
            LOCK INTO DOJO
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main Dojo Panel ────────────────────────────────────────────────────────────

export default function DojoPanel() {
  const [tracks, setTracks] = useState<DojoTrack[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadTracks = useCallback(async () => {
    const all = await getAllTracks();
    setTracks(all);
  }, []);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPendingFile(files[0]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleUploadConfirm = async (title: string, category: string, icon: string) => {
    if (!pendingFile) return;
    await addTrack(pendingFile, title, category, icon);
    setPendingFile(null);
    await loadTracks();
  };

  const handlePlay = (track: DojoTrack) => {
    if (playingId === track.id) {
      stopPlayback();
      setPlayingId(null);
    } else {
      const audio = playTrack(track);
      setPlayingId(track.id!);
      audio.addEventListener('ended', () => setPlayingId(null));
    }
  };

  const handleDelete = async (id: number) => {
    if (playingId === id) { stopPlayback(); setPlayingId(null); }
    await removeTrack(id);
    await loadTracks();
  };

  // Group tracks by category
  const grouped = tracks.reduce<Record<string, DojoTrack[]>>((acc, t) => {
    const key = t.category || 'Uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="dojo-container">
      <div className="section-header" style={{ padding: '0 0 16px' }}>
        <span className="section-title">DOJO — PHYSIOLOGICAL OVERRIDE</span>
        <span className="section-count">{tracks.length} TRACKS</span>
      </div>

      {/* Upload */}
      <div className="dojo-upload" onClick={() => fileRef.current?.click()}>
        <div className="dojo-upload-icon">🎧</div>
        <div className="dojo-upload-text">DROP MP3 FILES OR CLICK TO UPLOAD</div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* Track List — Grouped by Category */}
      {Object.keys(grouped).length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔇</div>
          <div className="empty-title">No Tracks</div>
          <div className="empty-desc">Upload audio. Name it. Tag it. The Dojo remembers.</div>
        </div>
      ) : (
        Object.entries(grouped).map(([category, catTracks]) => {
          const catIcon = catTracks[0]?.icon || 'music';
          const IconComp = getIconComponent(catIcon);
          return (
            <div key={category} style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 0', marginBottom: '6px',
                borderBottom: '1px solid var(--gray-200)',
              }}>
                <IconComp size={14} style={{ color: 'var(--crimson)' }} />
                <span style={{
                  fontSize: '10px', fontWeight: 700,
                  letterSpacing: '3px', textTransform: 'uppercase',
                  color: 'var(--gray-500)',
                }}>
                  {category}
                </span>
                <span style={{
                  fontSize: '10px', fontFamily: 'var(--font-mono)',
                  color: 'var(--gray-400)', marginLeft: 'auto',
                }}>
                  {catTracks.length}
                </span>
              </div>

              {catTracks.map((track) => {
                const TrackIcon = getIconComponent(track.icon);
                return (
                  <div key={track.id} className="track-card animate-slide-up">
                    <button
                      className={`track-play-btn ${playingId === track.id ? 'playing' : ''}`}
                      onClick={() => handlePlay(track)}
                    >
                      {playingId === track.id ? '■' : '▶'}
                    </button>
                    <TrackIcon size={14} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
                    <div className="track-info">
                      <div className="track-title">{track.title}</div>
                      <div className="track-meta">
                        {track.category} • {formatDuration(track.duration)}
                      </div>
                    </div>
                    <button className="track-delete" onClick={() => handleDelete(track.id!)}>✕</button>
                  </div>
                );
              })}
            </div>
          );
        })
      )}

      {/* Upload Modal */}
      {pendingFile && (
        <UploadModal
          file={pendingFile}
          onConfirm={handleUploadConfirm}
          onCancel={() => setPendingFile(null)}
        />
      )}
    </div>
  );
}
