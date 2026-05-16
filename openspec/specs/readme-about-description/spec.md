# readme-about-description Specification

## Purpose
TBD - created by archiving change agent-codex-readme-about-description-2026-04-21-18-05. Update Purpose after archive.
## Requirements
### Requirement: README problem and solution sections use separate visuals
The README SHALL place the multi-agent collision visual directly under `## The problem` and SHALL place a Guardex solution visual directly under `### Solution`.

#### Scenario: problem visual appears before the collision narrative
- **WHEN** a reader opens the top-level README
- **THEN** the `## The problem` heading is followed by the collision visual
- **AND** the narrative about parallel agents overwriting each other appears below that visual.

#### Scenario: solution visual appears under the solution heading
- **WHEN** a reader reaches the `### Solution` section
- **THEN** the README shows a Guardex workflow image directly under that heading
- **AND** the solution copy appears below the image.

### Requirement: README points to one canonical GitHub About description source
The repo SHALL keep one canonical GitHub About description in `about_description.txt`, and the README plus package metadata SHALL mirror that same copy instead of drifting across product surfaces.

#### Scenario: package metadata matches the canonical About copy
- **WHEN** a maintainer inspects `package.json` and `about_description.txt`
- **THEN** `package.json` `description` matches the full canonical text in `about_description.txt`
- **AND** the README continues to reference that same canonical source.

#### Scenario: solution visual remains under the solution heading
- **WHEN** a reader opens the top-level README
- **THEN** the `### Solution` heading is followed by the workflow image
- **AND** the Guardex solution copy appears below that image.

