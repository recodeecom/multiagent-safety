# T1 Notes

- Reduce CI risk in the agent-bot lifecycle tests by making the fake review bot daemon stop quickly on TERM/INT.
- Replace the 60-second sleep loop with a short, signal-friendly loop shared through one helper.
- Keep the change test-only and focused on eliminating runner-dependent delay during `agents stop`.
