# BRUME

A foggy precision platformer. Run, jump, and ride moving platforms through short hand-built levels. Coins, checkpoints, and best times stay on this device.

## Play locally

```bash
npm install
npm run dev
```

Then open the local dev URL the server prints (port 8080).

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | A / D or arrow keys | On-screen buttons |
| Jump | Space, W, or Up | Jump button |
| Drop through a platform | S or Down while grounded | — |
| Pause | Esc or P | Pause button |

## Stack

React, TanStack Start, Vite, and a small canvas game loop in `src/game`. Sprite frames live in `public/sprites`.
