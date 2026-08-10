# React design integration

The repository-level `design/` prototypes have been translated into native React TypeScript components. This directory contains no copied `.dc.html` files and does not use `dangerouslySetInnerHTML` or a runtime template parser.

## Component mapping

| Original prototype | Native React owner |
| --- | --- |
| `PageHome.dc.html` | `pages/HomeDesign.tsx` + `../../pages/HomePage.tsx` |
| `PageWorkspace.dc.html` | `pages/WorkspaceDesign.tsx` + `../../pages/WorkspacePage.tsx` |
| `PagePilot.dc.html` | `pages/PilotDesign.tsx` + `../../pages/PilotPage.tsx` |
| `PageFigures.dc.html` | `pages/FiguresDesign.tsx` + `../../pages/FiguresPage.tsx` |
| `PageSettings.dc.html` | `pages/SettingsDesign.tsx` + `../../pages/SettingsPage.tsx` |
| `Pipyter Final.dc.html` | `../../App.tsx` + `../../components/NavigationRail.tsx` |
| `Pipyter Workspace.dc.html` | shared React shell + Workspace components |
| `Pipyter Figure Studio.dc.html` | shared React shell + Figure components |

The `*Design.tsx` files preserve the full page markup, inline SVG artwork, typography, colors, spacing, and panels. The page components own all selected states, conditional sections, toggles, tabs, and click handlers with React `useState`.

The three complete-shell prototypes intentionally map to composition rather than duplicate TSX copies: their unique navigation shell is implemented once by `App.tsx` and `NavigationRail.tsx`, then combined with the corresponding page component.
