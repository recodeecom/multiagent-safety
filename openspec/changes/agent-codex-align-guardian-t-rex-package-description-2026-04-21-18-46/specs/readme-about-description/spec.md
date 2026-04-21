## MODIFIED Requirements

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
