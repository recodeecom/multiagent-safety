## ADDED Requirements

### Requirement: Top-left brand hierarchy
The frontend tutorial header SHALL render GuardeX as the primary top-left corner brand, with the "How it works" heading directly below it.

#### Scenario: Corner-first brand stack
- **WHEN** the tutorial page header renders
- **THEN** the GuardeX logo/title row appears first in the top-left brand area
- **AND** the "How it works" row is rendered directly underneath in the same left stack.

### Requirement: Tutorial URL visibility
The tutorial URL SHALL remain visible in the GuardeX subtitle row after layout changes.

#### Scenario: Tutorial URL retained
- **WHEN** the top-left GuardeX row renders
- **THEN** `guardextutorial.com` remains visible and clickable
- **AND** it opens in a new tab/window with safe link attributes.
