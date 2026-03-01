# .timer File Format

The `.timer` format is a JSON file used to define workout timers. You can create these files by hand, have AI generate them, or export them from the app.

## How to Use

1. Create a `.timer` file following the format below
2. In the app, click **Import** and select your `.timer` file
3. The timer appears in your library ready to edit or run

## Format Overview

A `.timer` file is JSON with three levels: **Timer** > **Circuits** > **Exercises**.

```json
{
  "id": "any-unique-string",
  "name": "Timer Name",
  "circuits": [ ... ],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

> **Tip:** The `id`, `createdAt`, and `updatedAt` fields are overwritten on import, so you can use placeholder values.

## Full Schema

### Timer (top level)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier (any string, gets replaced on import) |
| `name` | string | yes | Display name of the workout |
| `circuits` | Circuit[] | yes | Array of circuits (see below) |
| `createdAt` | string | yes | ISO 8601 timestamp (placeholder OK) |
| `updatedAt` | string | yes | ISO 8601 timestamp (placeholder OK) |

### Circuit

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier (any string) |
| `name` | string | yes | Circuit name (e.g., "Upper Body", "Core Blast") |
| `exercises` | Exercise[] | yes | Array of exercises in this circuit |
| `restBetweenExercisesSeconds` | number | yes | Rest duration (seconds) between each exercise. Common values: 10, 15, 20, 30 |
| `sets` | number | yes | How many times to repeat this circuit's exercises |
| `restBetweenCircuitsSeconds` | number | yes | Rest duration (seconds) after this circuit before the next one. Common values: 10, 15, 20, 30 |

### Exercise

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier (any string) |
| `name` | string | yes | Exercise name (e.g., "Push-ups", "Squats") |
| `durationSeconds` | number | yes | Work duration in seconds. Common values: 25, 30, 35, 40, 45, 60 |
| `color` | string | yes | Hex color for display. Use the palette below |

### Color Palette

Use these colors for exercises (cycle through them in order):

| Index | Hex Code | Color |
|-------|----------|-------|
| 0 | `#D81B60` | Pink |
| 1 | `#8E24AA` | Purple |
| 2 | `#E91E63` | Rose |
| 3 | `#7B1FA2` | Deep Purple |
| 4 | `#C2185B` | Crimson |
| 5 | `#AB47BC` | Orchid |
| 6 | `#AD1457` | Dark Pink |
| 7 | `#6A1B9A` | Violet |
| 8 | `#EC407A` | Light Pink |
| 9 | `#9C27B0` | Medium Purple |

Assign colors by cycling: exercise 0 gets color 0, exercise 1 gets color 1, ..., exercise 10 wraps back to color 0.

## Timing Behavior

- Exercises within a circuit play in order with rest between each
- Rest appears after every exercise **except** the last exercise of the last set in a circuit
- With multiple sets, the circuit's exercises repeat — rest bridges between the last exercise of one set and the first exercise of the next
- Rest between circuits appears after a circuit ends, before the next circuit begins
- No rest after the final circuit

## Complete Example

A 30-minute HIIT workout with 3 circuits:

```json
{
  "id": "example-hiit-30",
  "name": "30-Min HIIT Blast",
  "circuits": [
    {
      "id": "circuit-1",
      "name": "Upper Body",
      "exercises": [
        { "id": "ex-1", "name": "Push-ups", "durationSeconds": 30, "color": "#D81B60" },
        { "id": "ex-2", "name": "Shoulder Press", "durationSeconds": 30, "color": "#8E24AA" },
        { "id": "ex-3", "name": "Tricep Dips", "durationSeconds": 30, "color": "#E91E63" },
        { "id": "ex-4", "name": "Bicep Curls", "durationSeconds": 30, "color": "#7B1FA2" }
      ],
      "restBetweenExercisesSeconds": 10,
      "sets": 3,
      "restBetweenCircuitsSeconds": 30
    },
    {
      "id": "circuit-2",
      "name": "Lower Body",
      "exercises": [
        { "id": "ex-5", "name": "Squats", "durationSeconds": 30, "color": "#C2185B" },
        { "id": "ex-6", "name": "Lunges", "durationSeconds": 30, "color": "#AB47BC" },
        { "id": "ex-7", "name": "Glute Bridges", "durationSeconds": 30, "color": "#AD1457" },
        { "id": "ex-8", "name": "Calf Raises", "durationSeconds": 30, "color": "#6A1B9A" }
      ],
      "restBetweenExercisesSeconds": 10,
      "sets": 3,
      "restBetweenCircuitsSeconds": 30
    },
    {
      "id": "circuit-3",
      "name": "Core",
      "exercises": [
        { "id": "ex-9", "name": "Planks", "durationSeconds": 30, "color": "#EC407A" },
        { "id": "ex-10", "name": "Russian Twists", "durationSeconds": 30, "color": "#9C27B0" },
        { "id": "ex-11", "name": "Bicycle Crunches", "durationSeconds": 30, "color": "#D81B60" },
        { "id": "ex-12", "name": "Leg Raises", "durationSeconds": 30, "color": "#8E24AA" }
      ],
      "restBetweenExercisesSeconds": 10,
      "sets": 3,
      "restBetweenCircuitsSeconds": 30
    }
  ],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

This produces: 3 circuits x (4 exercises x 30s + 3 rests x 10s) x 3 sets + 2 circuit rests x 30s = **19:30** of workout time.

## AI Prompt Template

Copy this prompt to have AI generate a `.timer` file for you:

> Generate a .timer JSON file for a [X]-minute [type] workout (e.g., HIIT, strength, bootcamp).
> Use [N] circuits with [M] exercises each, [S] sets per circuit.
> Exercise duration: [D] seconds, rest between exercises: [R] seconds, rest between circuits: [C] seconds.
> Focus areas: [upper body, lower body, core, full body, etc.].
>
> Follow this format exactly:
> - Top level: { id, name, circuits, createdAt, updatedAt }
> - Each circuit: { id, name, exercises, restBetweenExercisesSeconds, sets, restBetweenCircuitsSeconds }
> - Each exercise: { id, name, durationSeconds, color }
> - Use these colors in order: #D81B60, #8E24AA, #E91E63, #7B1FA2, #C2185B, #AB47BC, #AD1457, #6A1B9A, #EC407A, #9C27B0 (cycle if needed)
> - IDs can be any unique strings
> - Output only the JSON, no explanation
> - Save with a .timer extension
