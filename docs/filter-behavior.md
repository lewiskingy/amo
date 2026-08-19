# Filter interaction

Column filters are designed to remain usable while the grid is being filtered.

- Text filters apply after a 300ms debounce.
- The active filter control and caret position are restored after the grid rerenders.
- Reference-data filters use select controls and restore focus after filtering.
- Sorting remains a three-state cycle: ascending, descending, unsorted.
- Clear Filters resets the grid without altering edit buffers.
