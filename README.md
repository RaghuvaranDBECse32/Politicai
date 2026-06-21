<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ddaaa306-323c-4ddf-bc19-bdda70ec0d81

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## About

PoliticAI is a RAG-based political news and civic intelligence MVP designed to organize recent, source-linked political content into a safe and queryable knowledge system. It helps users retrieve grounded information about political developments, election-related reporting, misinformation trends, and region-specific public-interest issues using structured sources instead of raw article dumps.

The project is built as a safety-first system for the Global South AI Safety Challenge Asia Track, with a focus on multilingual contexts, misinformation resilience, and reliable retrieval over political content. Rather than generating unsupported political answers, ELECTOR Feed is designed to surface relevant evidence, preserve source attribution, and support safer AI-assisted exploration of recent political news.
