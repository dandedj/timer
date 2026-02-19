interface SetIndicatorProps {
  setNumber: number;
  totalSets: number;
  circuitName: string;
}

export function SetIndicator({ setNumber, totalSets, circuitName }: SetIndicatorProps) {
  if (totalSets <= 1) return null;

  return (
    <div className="text-white/90 text-right">
      <div className="text-sm font-medium opacity-75">{circuitName}</div>
      <div className="text-xl font-bold">
        Set {setNumber} of {totalSets}
      </div>
    </div>
  );
}
