import { Button } from '@heroui/react';

interface TimerWidgetProps {
  timerDisplay: string;
  timerRunning: boolean;
  timerSeconds: number;
  onStart: () => void;
  onPause: () => void;
  onApply: () => void;
  onReset: () => void;
}

export default function TimerWidget({
  timerDisplay,
  timerRunning,
  timerSeconds,
  onStart,
  onPause,
  onApply,
  onReset,
}: TimerWidgetProps) {
  return (
    <div className="flex items-center gap-1 pb-1 shrink-0">
      <div
        className={`font-mono text-xs tabular-nums rounded-md px-2 py-1 text-center whitespace-nowrap ${
          timerRunning ? 'bg-success-100 text-success-700' : 'bg-default-100 text-default-700'
        }`}
      >
        {timerDisplay}
      </div>
      {!timerRunning ? (
        <Button size="sm" isIconOnly color="success" variant="flat" onPress={onStart} aria-label="Avvia timer">
          ▶
        </Button>
      ) : (
        <Button size="sm" isIconOnly color="danger" variant="flat" onPress={onPause} aria-label="Pausa timer">
          ⏸
        </Button>
      )}
      {timerSeconds > 0 && (
        <>
          <Button size="sm" isIconOnly color="primary" variant="flat" onPress={onApply} aria-label="Applica ore">
            ✓
          </Button>
          <Button size="sm" isIconOnly variant="flat" onPress={onReset} aria-label="Reset timer">
            ↺
          </Button>
        </>
      )}
    </div>
  );
}
