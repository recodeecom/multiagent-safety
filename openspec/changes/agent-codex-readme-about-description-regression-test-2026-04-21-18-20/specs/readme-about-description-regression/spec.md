## ADDED Requirements

### Requirement: metadata tests protect the canonical README About copy contract
The repo SHALL keep focused regression coverage that verifies the README problem/solution visual placement and the canonical `about_description.txt` mirror.

#### Scenario: metadata test locks the merged README structure
- **WHEN** the metadata test suite runs
- **THEN** it verifies the collision visual appears under `## The problem`
- **AND** it verifies the branch-start visual appears under `### Solution`
- **AND** it verifies the README links to `about_description.txt`
- **AND** it verifies the README mirrors the same canonical About copy stored in `about_description.txt`.
