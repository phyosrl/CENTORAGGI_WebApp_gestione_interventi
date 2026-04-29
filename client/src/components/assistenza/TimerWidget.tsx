import { Button } from '@heroui/react';
import { Play, Pause, Check, RotateCcw } from 'lucide-react';

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
        className={`font-mono text-xs tabular-nums rounded-md px-2 py-1 text-center whitespace-nowrap transition-colors ${
          timerRunning
            ? 'bg-success-100 text-success-700 ring-2 ring-success-400 animate-pulse'
            : timerSeconds > 0
              ? 'bg-warning-100 text-warning-700'
              : 'bg-default-100 text-default-500'
        }`}
      >
        {timerDisplay}
      </div>
      {!timerRunning ? (
        <Button
          size="sm"
          isIconOnly
          color="success"
          variant="solid"
          onPress={onStart}
          aria-label="Avvia timer"
          className="shadow-md ring-1 ring-success-300"
        >
          <Play className="w-4 h-4" />
        </Button>
      ) : (
        <Button
          size="sm"
          isIconOnly
          color="danger"
          variant="solid"
          onPress={onPause}
          aria-label="Pausa timer"
          className="shadow-md ring-2 ring-danger-300 animate-pulse"
        >
          <Pause className="w-4 h-4" />
        </Button>
      )}
      <Button
        size="sm"
        isIconOnly
        color="primary"
        variant={timerSeconds > 0 ? 'solid' : 'flat'}
        isDisabled={timerSeconds === 0}
        onPress={onApply}
        aria-label="Applica ore"
        className={timerSeconds > 0 ? 'shadow-md' : 'opacity-40'}
      >
        <Check className="w-4 h-4" />
      </Button>
      <Button
        size="sm"
        isIconOnly
        variant="flat"
        isDisabled={timerSeconds === 0}
        onPress={onReset}
        aria-label="Reset timer"
        className={timerSeconds > 0 ? '' : 'opacity-40'}
      >
        <RotateCcw className="w-4 h-4" />
      </Button>
    </div>
  );
}
