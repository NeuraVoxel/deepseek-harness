# Architecture (MVP stub)

English overview of the data closed loop. Expand as modules land.

## Loop

Upload → Parse → Catalog → Viz / Dataset export; bridges to annotation, algorithm, evaluation, training, fine-tuning.

## Contracts

Versioned JSON Schema under `schemas/`. Fixtures under `fixtures/`. Catalog revisions are immutable.

## Shared core (keep thin)

Identity/authz, object storage abstraction, dataset revision + lineage, job orchestration, audit — not a kitchen-sink platform library.
