## ADDED Requirements

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
The repo SHALL keep one canonical GitHub About description in `about_description.txt`, and the README SHALL reference that file instead of listing multiple About-copy options.

#### Scenario: canonical About copy is linked from the README
- **WHEN** a reader opens the `## GitHub About description` section
- **THEN** the README links to `about_description.txt`
- **AND** the section mirrors the same canonical copy in a copyable text block.
