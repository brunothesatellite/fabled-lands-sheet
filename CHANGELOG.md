# Changelog

## v1.14

This release continues the evolution of the project from the v1.13 baseline, focusing on visual identity, screen-size usability, compact interface polish, and stronger consistency between the adventure sheet, encounter panels, and the book/map navigation flow.

### New brand and visual identity
- Added a stronger fantasy RPG brand presence through a new sword-and-shield style iconography and an updated favicon set.
- Introduced new favicon assets aligned with the project’s fantasy adventure identity:
  - a combined fantasy/RPG favicon,
  - a magic-book variation,
  - a sword-and-shield mark,
  - and a refreshed default favicon.
- Updated the visual screenshot used by the project to match the newer interface treatment.

### UI and mobile experience improvements
- Improved the interface for smaller screens and compact mobile layouts, making the sheet more readable and less crowded on smartphones.
- Added Android-focused interface refinements, especially in the interaction flow and layout density for mobile touch usage.
- Simplified and improved the menu and top-level navigation behavior for a better overall user experience.

### UX and menu evolution
- Continued the interface evolution around the menu and tab system.
- Improved dropdown/tab active-state synchronization so book and map navigation selections stay visually coherent.
- Added click-memory behavior for book and map recall indicators, making the tab/subtab switching story clearer for the player.
- Updated the tab switching flow to keep book and map dropdown controls in sync with active panels.

### Form and sheet structure changes
- Reworked the adventure sheet form layout to better organize identity and progression fields.
- Added or reorganized the adventure fields for:
  - Profession,
  - God,
  - Money,
  - Rank.
- Clarified the adventure metadata structure by aligning the field placement with the fantasy sheet workflow rather than the older row order.
- Improved the consistency of the encounter box layout by aligning the Me and Foe combat/defence fields in matching row containers.
- Added proper border and layout treatment to the readonly encounter fields so the Me and Foe columns visually align more cleanly.

### Styling and layout consistency fixes
- Applied CSS refinements to harmonize the compact layout on mobile and regular desktop sizing.
- Adjusted the stepper and field containers to preserve visual alignment across adventure and encounter zones.
- Updated page styling so the new icons, form-row organization and dropdown behavior are reflected consistently across both the interface and the active UI states.

### JavaScript behavior and state synchronization
- Extended the tab-switching logic to clear and restore active dropdown toggles for book and map menus.
- Improved the handling of book/map recall labels and map/book dataset indicators during tab actions.
- Added event-driven recall updates so user moves across books and maps are represented in the UI more clearly.
- Preserved and improved the interaction mapping for the existing stepper controls and form inputs.

### Fixes and quality work applied
- Corrected interface consistency problems caused by uneven field container structure across the “Me” and “Foe” encounter panels.
- Repaired layout harmonization issues between combat and defence fields by matching the row structure in both visual columns.
- Fixed the mobile/menu usability drawbacks by removing overflow-prone behavior and by constraining the visual structure where necessary.
- Improved the overall arrangement of the user-facing form so the visual grammar of the adventure sheet is more coherent and less cluttered.

---

This current state thus represents a UI/UX stabilization and visual refresh cycle after v1.13: stronger fantasy branding, more responsive compact/mobile design, a refined menu interplay, stronger layout consistency across the sheet and encounter surfaces, and a series of interface and styling corrections that align the project with the current visual language.
