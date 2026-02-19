import type { CompoundTimer, FlatInterval, IntervalKind } from '../types/timer';
import { v4 as uuidv4 } from 'uuid';
import { REST_COLOR, REST_SET_COLOR, REST_CIRCUIT_COLOR } from './colorPalette';

export function buildSequence(timer: CompoundTimer): FlatInterval[] {
  const intervals: Omit<FlatInterval, 'intervalIndexGlobal' | 'totalIntervalsGlobal'>[] = [];

  for (let ci = 0; ci < timer.circuits.length; ci++) {
    const circuit = timer.circuits[ci];

    for (let setNum = 1; setNum <= circuit.sets; setNum++) {
      for (let ei = 0; ei < circuit.exercises.length; ei++) {
        const exercise = circuit.exercises[ei];

        intervals.push({
          id: uuidv4(),
          kind: 'work' as IntervalKind,
          label: exercise.name,
          durationSeconds: exercise.durationSeconds,
          color: exercise.color,
          repCount: exercise.repCount,
          circuitName: circuit.name,
          circuitIndex: ci,
          setNumber: setNum,
          totalSets: circuit.sets,
        });

        const isLastExercise = ei === circuit.exercises.length - 1;
        if (!isLastExercise && circuit.restBetweenExercisesSeconds > 0) {
          intervals.push({
            id: uuidv4(),
            kind: 'rest-exercise' as IntervalKind,
            label: 'Rest',
            durationSeconds: circuit.restBetweenExercisesSeconds,
            color: REST_COLOR,
            circuitName: circuit.name,
            circuitIndex: ci,
            setNumber: setNum,
            totalSets: circuit.sets,
          });
        }
      }

      const isLastSet = setNum === circuit.sets;
      if (!isLastSet && circuit.restBetweenSetsSeconds > 0) {
        intervals.push({
          id: uuidv4(),
          kind: 'rest-set' as IntervalKind,
          label: 'Rest (between sets)',
          durationSeconds: circuit.restBetweenSetsSeconds,
          color: REST_SET_COLOR,
          circuitName: circuit.name,
          circuitIndex: ci,
          setNumber: setNum,
          totalSets: circuit.sets,
        });
      }
    }

    // Rest between circuits (not after the last circuit)
    const isLastCircuit = ci === timer.circuits.length - 1;
    if (!isLastCircuit) {
      const nextCircuit = timer.circuits[ci + 1];
      intervals.push({
        id: uuidv4(),
        kind: 'rest-circuit' as IntervalKind,
        label: `Rest — ${nextCircuit.name} next`,
        durationSeconds: circuit.restBetweenExercisesSeconds || 15,
        color: REST_CIRCUIT_COLOR,
        circuitName: circuit.name,
        circuitIndex: ci,
        setNumber: circuit.sets,
        totalSets: circuit.sets,
      });
    }
  }

  const total = intervals.length;
  return intervals.map((interval, i) => ({
    ...interval,
    intervalIndexGlobal: i + 1,
    totalIntervalsGlobal: total,
  }));
}

export function computeTotalDuration(timer: CompoundTimer): number {
  return buildSequence(timer).reduce((s, i) => s + i.durationSeconds, 0);
}
