# Minifigs

A minifigure configurator. Pick hair, head, torso and legs from real brick photos, snap them together, download the result.

Not affiliated with the LEGO Group.

## Develop

```bash
pnpm install
pnpm parts     # regenerate public/parts from assets/raw
pnpm dev
```

## Add a part

Drop a transparent, front-facing PNG into `assets/raw/<hair|head|body|pants>/`, optionally give it a name in `assets/parts.meta.json`, run `pnpm parts`.
