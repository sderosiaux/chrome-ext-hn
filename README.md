# HN Distill

> Transform Hacker News discussions into actionable learning insights with AI-powered theme clustering

HN Distill is a Chrome extension that analyzes Hacker News comment threads and distills them into structured, theme-based learning summaries. Instead of scrolling through hundreds of comments, get organized insights with key learnings, technical glossaries, and curated resources.

## Features

- **AI-Powered Analysis**: Uses Claude or OpenAI to analyze and synthesize HN comment threads
- **Theme Clustering**: Automatically groups related discussions into coherent themes
- **Key Learnings**: Extracts actionable insights from each conversation
- **Critical Thinking**: Challenges assumptions and surfaces non-obvious insights
- **Technical Glossary**: Defines domain-specific terms and jargon
- **Curated Resources**: Surfaces relevant links and references from the discussion
- **Multi-Language**: Output in English, French, Spanish, German, Portuguese, Chinese, or Japanese
- **Personal Context**: Tailor insights to your interests and expertise level
- **Thread Caching**: Saves analysis results for instant retrieval

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone git@github.com:sderosiaux/chrome-ext-hn.git
   cd chrome-ext-hn
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in the top-right corner)

4. Click "Load unpacked" and select the extension directory

5. Navigate to any Hacker News discussion thread (e.g., `https://news.ycombinator.com/item?id=123456`)

6. Click the "Distill" button that appears on the page

## Setup

### API Key Configuration

HN Distill requires an Anthropic API key to function:

1. Get your API key from [Anthropic Console](https://console.anthropic.com/)
2. Click the "Distill" button on any HN thread
3. Click the API key icon in the top-right corner
4. Enter your API key and save

Your API key is stored locally in Chrome's storage and never leaves your browser except to make API calls to Anthropic.

## Usage

### Basic Workflow

1. **Visit any HN thread**: Navigate to a discussion on `news.ycombinator.com/item?id=...`
2. **Click "Distill"**: A floating button appears on the page
3. **View Analysis**: The extension analyzes the thread and presents:
   - Global key learnings across all themes
   - Individual themes with detailed breakdowns
   - Technical glossaries and definitions
   - Links to related resources
   - Supporting comments for each theme

### Theme Deep Dive

Click on any theme card to see:
- **Why it matters**: Context and relevance
- **Key points**: Main ideas and takeaways
- **Glossary**: Technical terms explained
- **Beyond the basics**: Advanced concepts and nuances
- **Links**: Curated resources from the discussion
- **Comments**: Original comments supporting this theme

### Critical Thinking Tab

A dedicated tab provides deeper strategic analysis:
- **What breaks this?**: Failure modes and edge cases
- **Non-obvious truth**: Counterintuitive insights
- **Hidden assumptions**: Unstated premises and tradeoffs
- **New bottleneck**: Second-order effects
- **Leverage point**: Asymmetric opportunities

## Architecture

### Files Overview

- **manifest.json**: Extension configuration and permissions
- **content.js**: Injects the "Distill" button and modal overlay into HN pages
- **content.css**: Styles for the injected UI elements
- **background.js**: Service worker for extension lifecycle management
- **sidepanel.html/js/css**: Main analysis UI loaded in the modal
- **api_client.js**: Handles API calls to Anthropic Claude
- **prompts.js**: Prompt engineering for thread analysis
- **design-system.css**: Shared design tokens and variables

### Data Flow

1. User clicks "Distill" button on HN thread
2. Content script extracts thread ID from URL
3. Thread data fetched from HN Algolia API
4. Comments preprocessed and filtered (max 500 comments)
5. Analysis prompt built and sent to Claude API
6. Response parsed and structured into themes
7. Results cached for instant future access
8. UI renders global summary and theme cards

### Caching Strategy

- Results are cached per thread ID in memory
- Cache persists for the duration of the browser session
- Switching between threads preserves analysis state
- No server-side storage - everything is client-side

## Privacy & Security

- **No data collection**: No analytics, tracking, or telemetry
- **Local storage only**: API keys stored in Chrome's local storage
- **Direct API calls**: Your browser communicates directly with Anthropic
- **No third-party services**: Only HN Algolia API and Anthropic API are used

## Development

### Project Structure

```
chrome-ext-hn/
├── manifest.json          # Extension manifest
├── background.js          # Service worker
├── content.js             # Content script (HN page injection)
├── content.css            # Content script styles
├── sidepanel.html         # Main UI
├── sidepanel.js           # Main UI logic
├── sidepanel.css          # Main UI styles
├── design-system.css      # Design tokens
├── api_client.js          # API client abstraction
└── prompts.js             # Prompt templates
```

### Design System

The extension uses a cohesive design system with:
- CSS custom properties for theming
- Consistent spacing scale
- Reusable color palette
- Minimalist, professional UI inspired by Linear and Stripe

### API Client

The API client is abstracted to support multiple LLM providers:
- Currently supports Anthropic Claude
- Factory pattern for easy provider switching
- Configurable model and parameters

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - See LICENSE file for details

## Acknowledgments

- Built with [Anthropic Claude](https://www.anthropic.com/) for AI analysis
- Uses [HN Algolia API](https://hn.algolia.com/api) for fetching thread data
- Designed for the [Hacker News](https://news.ycombinator.com/) community
