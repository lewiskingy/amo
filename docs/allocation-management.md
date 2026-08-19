# Allocation management behavior

The Allocations tab is the operational editor for Architecture resource allocations.

- Every unresolved demand item is represented, even when no resource is allocated.
- Existing allocations are one row per Demand Item + Team Member.
- Edit mode adds an extra blank draft row for every unresolved demand item so further resources can be allocated quickly.
- Selecting a resource on a blank row creates a draft allocation with all months in the current year initialised to 0%.
- Monthly values are entered as percentages and persisted as FTE decimals (e.g. 50% = 0.5).
- Deleting an allocation removes it from the in-memory model and schedules its JSON file for deletion when the workspace is saved.
- Completed, closed, and cancelled demand items are excluded from the allocation editor.
- The Resource Plan remains a read-only consolidated view derived from allocation records.

List filters use a short debounce before applying and restore focus after rerendering so typing can continue without interruption.
