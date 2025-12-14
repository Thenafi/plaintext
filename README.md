# ZenDraft

ZenDraft is a minimalist, distraction-free writing environment designed to help you focus on your thoughts. It prioritizes simplicity, privacy, and speed.

## Features

- **Distraction-Free Interface**: A clean canvas that puts your text front and center.
- **Local Auto-Save**: Your work is automatically saved to your browser's local storage as you type. No data leaves your machine.
- **Draft History & Sessions**:
  - Automatically manages sessions.
  - Keeps a history of your drafts for up to 14 days.
  - Organize and revisit previous thoughts with the History sidebar.
- **Customizable Experience**:
  - Toggle between **Light** and **Dark** modes.
  - Choose your preferred typography: **Serif**, **Sans**, or **Mono**.
- **Privacy First**: 100% Client-side. No cloud sync, no tracking, no external servers.
- **Export**: Easily download your current draft as a `.txt` file.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)

### Installation

1.  Clone the repository or download the source.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```
4.  Open `http://localhost:5173` (or the URL shown in your terminal) in your browser.

## Usage

- **Writing**: Just start typing. The "Saved" indicator in the top right will confirm your work is safe.
- **New Session**: Each time you open the app in a new tab, a new session is created.
- **History**: Click the clock icon to see your past drafts. Select one to load it into the current view.
- **Settings**: Use the icons in the top right to change fonts, toggle theme, or download your work.
- **Info**: Click the 'i' icon to see a quick overview of the app's mission.

## License

MIT
