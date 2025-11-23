# FAQ HIV e Aids - Progressive Web App

Interactive FAQ system about HIV and AIDS with search functionality, audio descriptions, and offline support.

## Features

- **Interactive FAQ System**: Expandable details elements with questions and HTML-formatted answers
- **Search Functionality**: Real-time search across questions, answers, and tags
- **Audio Descriptions**: Howler.js-powered audio playback for all FAQs and presentation
- **Theme Switching**: Light and dark themes with persistence via localStorage and URL parameters
- **Progressive Web App**: Offline-first with service worker caching
- **Analytics Tracking**: Comprehensive Google Analytics 4 (GA4) integration
- **Responsive Design**: Mobile-first, fully responsive layout

## Analytics Implementation

### Overview

The app uses Google Analytics 4 (GA4) to track user interactions and content engagement. Analytics were added on 2025-11-22 to understand which FAQs are most viewed and how users interact with the app.

**Measurement ID**: `G-W7XLCD3VKR`

### Tracked Events

#### 1. FAQ Views (`faq_view`)
Tracks when users open a FAQ to read the answer.

**Trigger**: When a `<details>` element is opened
**Location**: `app.js:565-569`
**Parameters**:
- `faq_id`: Unique identifier for the FAQ
- `faq_question`: The question text
- `content_type`: Always "faq"

**Usage**: Identify which FAQs are most popular and which topics need better coverage.

#### 2. Search Queries (`search`)
Tracks user search behavior with a 1-second debounce.

**Trigger**: After user stops typing for 1 second
**Location**: `app.js:499-507` (FAQ page), `app.js:688-696` (Bot page)
**Parameters**:
- `search_term`: The search query text
- `result_count`: Number of matching results

**Usage**: Understand what users are looking for and identify gaps in content.

#### 3. Audio Plays (`audio_play`)
Tracks when users play audio descriptions.

**Trigger**: When audio play button is clicked
**Location**: `app.js:518-524` (FAQ page), `app.js:707-713` (Bot page), `app.js:991-994` (Presentation page)
**Parameters**:
- `content_id`: ID of the content being played
- `content_title`: Title/question of the content
- `content_type`: Always "audio"

**Usage**: Measure audio feature adoption and accessibility usage.

#### 4. Page Views (`page_view`)
Tracks navigation between different sections of the app.

**Trigger**: When route changes
**Location**: `app.js:1114-1123`
**Parameters**:
- `page_title`: Readable page name ("Home", "Perguntas Frequentes", "Bot", "Apresentação")
- `page_location`: Full URL
- `page_path`: URL path including hash

**Usage**: Understand user navigation patterns and which sections are most visited.

#### 5. Theme Toggles (`theme_toggle`)
Tracks when users switch between light and dark themes.

**Trigger**: When theme toggle button is clicked
**Location**: `app.js:1126-1132`
**Parameters**:
- `theme`: The new theme value ("light" or "dark")

**Usage**: Understand theme preferences and usage patterns.

### Analytics Implementation Details

#### AnalyticsTracker Utility

A centralized utility object manages all analytics tracking:

```javascript
const AnalyticsTracker = {
  trackEvent(eventName, eventParams) { /* ... */ },
  trackPageView(pageName, pageTitle) { /* ... */ },
  trackFaqView(faqId, faqQuestion) { /* ... */ },
  trackAudioPlay(contentId, contentTitle) { /* ... */ },
  trackSearch(searchTerm, resultCount) { /* ... */ },
  trackThemeToggle(newTheme) { /* ... */ }
};
```

**Location**: `app.js:6-50`

#### Google Tag Integration

The GA4 tracking script is loaded in the `<head>` section:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-W7XLCD3VKR"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-W7XLCD3VKR');
</script>
```

**Location**: `index.html:12-20`

### Viewing Analytics Data in Google Analytics 4

Follow these detailed steps to access and analyze FAQ metrics in your Google Analytics dashboard.

#### Accessing Google Analytics

1. Navigate to [Google Analytics](https://analytics.google.com)
2. Sign in with your Google account
3. Select the property for **G-W7XLCD3VKR** (FAQ HIV e Aids)

#### Finding Most Accessed FAQs (Most Important)

This shows you which Perguntas Frequentes (FAQs) users are viewing most:

1. In the left sidebar, click **Reports**
2. Click **Engagement** → **Events**
3. In the events table, find and click on the **`faq_view`** event
4. This shows total FAQ views. To see which specific FAQs:
   - Look for the event parameters section below the chart
   - Click on **`faq_question`** parameter
   - You'll see a table showing:
     - Each FAQ question text
     - Number of times it was viewed
     - Percentage of total views
5. Click the column headers to sort by:
   - **Event count** (descending) to see most popular FAQs first
   - **FAQ question** (alphabetically)

**Example interpretation**: If "O que é HIV?" has 150 views and "Como se transmite?" has 200 views, you know transmission questions are more searched.

#### Alternative View: Custom Exploration

For more detailed analysis:

1. In the left sidebar, click **Explore**
2. Click **Create a new exploration** or use a template
3. Select **Free form** exploration
4. Configure:
   - **Dimensions**: Add `Event name` and `faq_question`
   - **Metrics**: Add `Event count`
   - **Filters**: Filter where `Event name` exactly matches `faq_view`
5. Drag `faq_question` to **Rows**
6. Drag `Event count` to **Values**
7. Sort by event count to see top FAQs

#### Finding Search Terms

See what users are searching for to identify content gaps:

1. Go to **Reports** → **Engagement** → **Events**
2. Click on the **`search`** event
3. View the **`search_term`** parameter to see:
   - What keywords users search for
   - Search terms with zero results (indicates missing content)
   - Most common search queries

#### Audio Engagement Analytics

Track how many users listen to audio descriptions:

1. Go to **Reports** → **Engagement** → **Events**
2. Click on the **`audio_play`** event
3. View by **`content_title`** to see which FAQ audio is played most
4. Compare audio plays vs FAQ views to calculate audio adoption rate

#### Page Navigation Flow

Understand how users navigate through the app:

1. Go to **Reports** → **Engagement** → **Events**
2. Click on the **`page_view`** event
3. View by **`page_title`** parameter to see:
   - Home page visits
   - FAQ page visits
   - Presentation page visits
   - Bot page visits

#### Real-Time Monitoring

See live user activity as it happens:

1. In the left sidebar, click **Reports**
2. Click **Realtime** → **Overview**
3. View:
   - Users currently on the app
   - Events happening in real-time
   - Which FAQs are being viewed right now

#### Creating Custom Reports

To create a dedicated FAQ analytics dashboard:

1. Go to **Reports** → **Library**
2. Click **Create new report**
3. Select **Create detail report**
4. Add these metrics:
   - Event name = `faq_view`
   - Dimension: `faq_question`
   - Metric: `Event count`
5. Save with a name like "Top FAQs Report"

#### Exporting Data

To export FAQ data for external analysis:

1. Navigate to any report showing FAQ data
2. Click the **Share** icon (top right)
3. Select **Download file**
4. Choose format: CSV, PDF, or Google Sheets
5. Open in Excel/Sheets for further analysis

#### Setting Up Alerts

Get notified when specific FAQs become popular:

1. Go to **Admin** → **Data Display** → **Custom Insights**
2. Create insights based on:
   - Spike in specific FAQ views
   - New search terms appearing
   - Drop in overall engagement

#### Time-Based Analysis

View FAQ popularity over time:

1. Go to any event report
2. Use the date range picker (top right) to select:
   - Last 7 days
   - Last 28 days
   - Custom date range
3. The chart will show trends over time
4. Identify:
   - Which FAQs trend during specific periods
   - Seasonal patterns in questions
   - Impact of external events on searches

#### Recommended Weekly Review

For ongoing monitoring, review these weekly:

1. **Top 10 Most Viewed FAQs**: Track changes in popular topics
2. **Top Search Terms**: Identify new user interests
3. **Audio Play Rate**: Monitor accessibility feature usage
4. **Zero-Result Searches**: Find content gaps to fill

## Technical Architecture

### Stack

- **React 18**: Loaded from CDN (development build)
- **Howler.js**: Audio playback library
- **TailwindCSS**: Custom theme system (requires build step)
- **Service Worker**: Offline caching and PWA capabilities
- **Google Analytics 4**: User behavior tracking

### Routing

Hash-based routing with 4 routes:
- `#home` - Landing page with feature cards
- `#faq` - Traditional FAQ list with expandable details
- `#bot` - Search-focused FAQ interface
- `#apresentacao` - About/presentation page

### Theme System

Two themes available:
- `light` (default)
- `dark`

Theme preference is:
1. Read from URL parameter (`?theme=light` or `?theme=dark`)
2. Fallback to `localStorage` (`faq-hiv-aids-theme`)
3. Default to `light`

Theme is synced to:
- `data-theme` attribute on `<html>` element
- `localStorage` for persistence
- URL search parameter for shareability

### Data Management

FAQ data is loaded from `./data/faq.json` with the following structure:

```json
[
  {
    "id": "unique-id",
    "question": "Question text",
    "answerHtml": "<p>HTML formatted answer</p>",
    "tags": ["tag1", "tag2"],
    "audioDescription": {
      "src": "./assets/audio/faq1.mp3",
      "durationSec": 45
    }
  }
]
```

### Service Worker

Caching strategy:
- **Cache-first**: CSS, JS, images, fonts
- **Network-first**: JSON data files
- **Version-based invalidation**: Update `VERSION` constant in `sw.js`

## Development

### Prerequisites

- Node.js (for TailwindCSS build)
- HTTP server (Python, Node, or any static server)

### Setup

1. Install dependencies:
```bash
cd faq-hiv-aids
npm install
```

2. Build TailwindCSS (watch mode):
```bash
npx tailwindcss -i ./tokens.css -o ./styles.css --watch
```

3. Serve the app:
```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve
```

4. Open browser to `http://localhost:8000`

### Building for Production

```bash
# One-time TailwindCSS build
npx tailwindcss -i ./tokens.css -o ./styles.css --minify
```

### Updating Content

1. Edit `data/faq.json` with new questions/answers
2. Add audio files to `assets/audio/`
3. Update service worker version in `sw.js` if needed

### Adding Analytics Events

To track a new event:

1. Add method to `AnalyticsTracker` utility:
```javascript
trackNewEvent(param1, param2) {
  this.trackEvent('new_event_name', {
    param1: param1,
    param2: param2,
  });
}
```

2. Call from component:
```javascript
AnalyticsTracker.trackNewEvent(value1, value2);
```

## Browser Support

- Modern browsers with ES6+ support
- Service Worker support required for offline functionality
- Audio playback requires HTML5 audio support

## Accessibility

- ARIA labels on interactive elements
- Semantic HTML with proper heading hierarchy
- Keyboard navigation support
- Audio descriptions for all content
- High contrast theme options

## License

© 2025 Dezembro Vermelho • Ministério da Saúde
