import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  useEcosystemUI,
  useEcosystemDispatch,
} from '../../state/ecosystem-context.tsx';
import { useDebug } from '../../state/debug-context.tsx';
import { useFollow } from '../../state/follow-context.tsx';
import LogPanel from './LogPanel.tsx';

const SPEED_OPTIONS = [0.5, 1, 5, 20];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function HUD() {
  const ui = useEcosystemUI();
  const dispatch = useEcosystemDispatch();
  const { showIntentions, setShowIntentions } = useDebug();
  const { followTarget, stopFollowing } = useFollow();
  const [showLog, setShowLog] = useState(false);

  const followedLabel = useMemo(() => {
    if (!followTarget) return null;
    if (followTarget.type === 'rabbit') {
      return `Rabbit ${followTarget.id}`;
    }
    if (followTarget.type === 'fox') {
      return `Fox ${followTarget.id}`;
    }
    return `Moose ${followTarget.id}`;
  }, [followTarget]);

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="pointer-events-auto m-3 inline-flex flex-col gap-3 rounded-xl bg-black/40 p-4 backdrop-blur-md">
        {/* Prominent timer */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-white">
            {formatTime(ui.time)}
          </span>
          <span className="text-xs text-white/50">elapsed</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Stat
            label="Rabbits"
            value={ui.rabbits}
            detail={
              ui.rabbits === 0 && ui.extinctions?.rabbits != null
                ? `Extinct at ${formatTime(ui.extinctions.rabbits)}`
                : `${ui.rabbitAdults} adult${ui.rabbitAdults !== 1 ? 's' : ''}, ${ui.rabbitBabies} bab${ui.rabbitBabies !== 1 ? 'ies' : 'y'}`
            }
            color="text-amber-300"
            extinct={ui.rabbits === 0 && ui.extinctions?.rabbits != null}
          />
          <Stat
            label="Foxes"
            value={ui.foxes}
            detail={
              ui.foxes === 0 && ui.extinctions?.foxes != null
                ? `Extinct at ${formatTime(ui.extinctions.foxes)}`
                : `${ui.foxAdults} adult${ui.foxAdults !== 1 ? 's' : ''}, ${ui.foxBabies} bab${ui.foxBabies !== 1 ? 'ies' : 'y'}`
            }
            color="text-orange-400"
            extinct={ui.foxes === 0 && ui.extinctions?.foxes != null}
          />
          <Stat label="Moose" value={ui.moose} color="text-yellow-200" />
          <Stat
            label="Flowers"
            value={ui.aliveFlowers}
            detail={
              ui.aliveFlowers === 0 && ui.extinctions?.flowers != null
                ? `Extinct at ${formatTime(ui.extinctions.flowers)}`
                : undefined
            }
            color="text-pink-300"
            extinct={ui.aliveFlowers === 0 && ui.extinctions?.flowers != null}
          />
        </div>

        {/* Speed control */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-white/60">Speed</span>
          <div className="flex gap-1">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => dispatch({ type: 'SET_SPEED', speed: s })}
                className={`cursor-pointer rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  ui.speed === s
                    ? 'bg-cyan-500 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={showIntentions}
            onChange={(e) => setShowIntentions(e.target.checked)}
            className="accent-cyan-400"
          />
          <span className="text-xs text-white/80">Show intentions</span>
        </label>

        <div className="flex gap-2">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
            className="cursor-pointer rounded bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
          >
            {ui.paused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={() => setShowLog((v) => !v)}
            className={`cursor-pointer rounded px-3 py-1 text-xs text-white transition-colors ${
              showLog ? 'bg-cyan-500' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            Log
          </button>
          <button
            onClick={() => dispatch({ type: 'INIT', config: ui.config })}
            className="cursor-pointer rounded bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
          >
            Restart
          </button>
        </div>
      </div>

      {followTarget && followedLabel && (
        <div className="pointer-events-auto absolute right-0 top-0 m-3 inline-flex flex-col gap-2 rounded-xl bg-black/45 p-3 backdrop-blur-md">
          <div className="text-xs text-white/60">Following</div>
          <div className="text-sm font-semibold text-cyan-200">{followedLabel}</div>
          <button
            onClick={stopFollowing}
            className="cursor-pointer rounded bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
          >
            Stop following
          </button>
        </div>
      )}

      {/* Log panel */}
      <AnimatePresence>
        {showLog && <LogPanel onClose={() => setShowLog(false)} />}
      </AnimatePresence>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  color,
  extinct,
}: {
  label: string;
  value: number;
  detail?: string;
  color: string;
  extinct?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-medium ${color}`}>{label}</span>
      <span className={`text-sm font-bold ${extinct ? 'text-red-400' : 'text-white'}`}>
        {extinct ? 'Extinct' : value}
      </span>
      {detail && <span className="text-xs text-white/50">{detail}</span>}
    </div>
  );
}
