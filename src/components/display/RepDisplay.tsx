export function RepDisplay({ repCount }: { repCount: number }) {
  return (
    <div className="text-white/90 text-center">
      <div className="text-6xl font-black">{repCount}</div>
      <div className="text-lg uppercase tracking-wider font-semibold opacity-75">reps</div>
    </div>
  );
}
