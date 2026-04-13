# Chase IntelliWealth

Chase IntelliWealth is a multi-agent AI wealth advisory system built for bank-grade portfolio management. It runs a three-stage agent pipeline that analyzes client portfolios, generates actionable investment recommendations, and delivers them through an interactive web interface or a REST API.

The web UI features a clean, light-themed interface with a conversational advisor experience where each session generates a randomized client profile for demonstration purposes.

---

## Demo Quick Start

Follow these steps to run the demo locally.

### Prerequisites

- **Node.js ≥ 20** — [Download](https://nodejs.org/)
- **npm** (included with Node.js)
- **Groq API Key** — Sign up at [console.groq.com](https://console.groq.com) and generate an API key

### 1. Install Dependencies

```bash
cd IntelliWealth
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Groq API key:

```
INTELLIWEALTH_OPENAI_API_KEY=your-groq-api-key-here
```

### 3. Start the Server

```bash
npm run start:api
```

You should see:

```
Chase IntelliWealth API listening on http://0.0.0.0:8000
```

### 3. Open the Web UI

Open your browser and navigate to:

```
http://localhost:8000
```

### 4. Run a Demo Session

1. Click **"New Client Session"** — a randomized client profile is generated with a name, age, risk tolerance, and portfolio of stock holdings.
2. The left sidebar shows the client's profile and current holdings.
3. Type a question or click one of the suggested prompts, for example:
   - _"Analyze my portfolio for a 5-year wealth growth goal"_
   - _"How diversified is my portfolio?"_
   - _"Rebalance my portfolio for low risk retirement in 20 years"_
4. The advisor responds with allocation analysis, identified issues, and actionable recommendations.
5. Click **"New Client Session"** again to generate a different client.

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                │
│                                                                     │
│   Web UI (Fastify)                                                  │
│   localhost:8000                                                    │
│   Conversational chat                                               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Advisory Pipeline                                │
│                                                                     │
│  1. Query Interpretation (OpenAI or rules)                          │
│     → mode: "analysis" | "holdings_list" | "portfolio_answer"       │
│                                                                     │
│  2. Portfolio Fetch (PortfolioService)                              │
│                                                                     │
│  3. Agent Pipeline (analysis mode)                                  │
│     ┌──────────────┐   ┌───────────────┐   ┌───────────────────┐   │
│     │ Advisor Agent │──▶│ Analyst Agent │──▶│  Decision Agent   │   │
│     │ (intent +     │   │ (allocation,  │   │  (AI-first with   │   │
│     │  goal/risk    │   │  issues,      │   │   deterministic   │   │
│     │  extraction)  │   │  risk summary)│   │   fallback)       │   │
│     └──────────────┘   └───────────────┘   └───────────────────┘   │
│                                                                     │
│  4. Rendering (formatter.ts → plain text)                           │
└─────────────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌───────────────────┐
│ OpenAI Service   │ │ Portfolio Service│ │ Market Context    │
│ (structured JSON │ │ (asset normal-  │ │ (allocation       │
│  responses,      │ │  ization,       │ │  presets, equity   │
│  TTL cache)      │ │  5-min cache)   │ │  caps, market      │
│                  │ │                 │ │  outlook)          │
└──────────────────┘ └──────────────────┘ └───────────────────┘
```

## Agent Pipeline

### Advisor Agent

Parses the user query into structured intent: goal, time horizon, risk tolerance, liquidity requirement, and target corpus. Uses OpenAI for natural-language understanding with a rules-based fallback. Does **not** produce recommendations.

### Analyst Agent

Deterministic analysis of the portfolio. Computes current allocation percentages, detects issues (overexposure, concentration, low liquidity, horizon misalignment), and produces a risk summary. No AI dependency — pure computation.

### Decision Agent

AI-first recommendation engine with deterministic fallback. Receives analyst output + market context + goal path math and produces:

- **Target allocation** (clamped to hard constraint guardrails)
- **Actionable recommendations** with dollar amounts
- **Sector-specific recommendations** (sector, action, vehicle, rationale)
- **Market outlook** based on current market conditions
- **Reasoning and tradeoffs**
- **Confidence score** (55–95 based on inferred vs explicit inputs)

## Response Modes

| Mode               | Trigger                                | Output                                                                    |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------------- |
| `analysis`         | Goal/allocation queries                | Full recommendation with target allocation, sector advice, market outlook |
| `holdings_list`    | "Show my holdings"                     | Rendered list of equity holdings with weights                             |
| `portfolio_answer` | Factual questions ("What % is in IT?") | Direct answer with supporting data points                                 |

## Key Design Decisions

- **AI-first, deterministic fallback**: OpenAI generates recommendations and allocation proposals; if unavailable, rules-based templates produce equivalent output
- **Constraint enforcement is deterministic**: `clampAllocation()` enforces equity caps, concentration limits, and cash floors regardless of what the AI proposes
- **Centralized market context**: Allocation presets, constraint guardrails, and market outlook all live in `marketContext.ts`
- **Shared backend**: All clients (Web UI, API) hit the same pipeline — consistent output everywhere

## Project Structure

```
src/
├── api/
│   ├── app.ts              # Fastify routes + web UI serving
│   └── server.ts           # Server entrypoint
├── agents/
│   ├── advisorAgent.ts     # Intent parsing + goal extraction
│   ├── analystAgent.ts     # Deterministic portfolio analysis
│   ├── decisionAgent.ts    # AI-first recommendations + fallback
│   └── pipeline.ts         # Orchestrates the full agent flow
├── services/
│   ├── openAiService.ts    # OpenAI structured responses + caching
│   ├── portfolioService.ts # Portfolio normalization + caching
│   ├── marketContext.ts    # Allocation presets, constraints, market outlook
│   └── cache.ts            # Generic TTL in-memory cache
├── clients/
│   └── backendClient.ts    # Backend HTTP client
├── presentation/
│   └── formatter.ts        # Renders structured responses to plain text
├── config.ts               # Environment-based settings
└── models.ts               # All TypeScript interfaces and types
public/
└── index.html              # Chase IntelliWealth web interface
test/
├── api.test.ts             # API endpoint tests
├── pipeline.test.ts        # Pipeline determinism + constraint tests
└── helpers/
    └── mockPortfolio.ts    # Test portfolio fixtures
```

## Environment Variables

| Variable                                  | Required      | Default                      | Description                      |
| ----------------------------------------- | ------------- | ---------------------------- | -------------------------------- |
| `INTELLIWEALTH_OPENAI_API_KEY`            | **Yes**       | —                            | Groq API key                     |
| `INTELLIWEALTH_OPENAI_BASE_URL`           | No            | `https://api.groq.com/openai/v1` | OpenAI-compatible API base URL |
| `INTELLIWEALTH_OPENAI_MODEL`              | No            | `openai/gpt-oss-120b`       | Model to use                     |
| `INTELLIWEALTH_API_HOST`                  | No            | `0.0.0.0`                    | API server bind address          |
| `INTELLIWEALTH_API_PORT`                  | No            | `8000`                       | API server port                  |

## All Run Commands

```bash
# Web UI + API server (primary demo)
npm run start:api

# Run tests
npm test

# Type-check
npm run typecheck
```

## API Endpoints

| Method | Path                        | Description                           |
| ------ | --------------------------- | ------------------------------------- |
| GET    | `/`                         | Chase IntelliWealth web interface     |
| GET    | `/health`                   | Health check                          |
| GET    | `/client`                   | Current client profile                |
| POST   | `/client/regenerate`        | Generate a new random client          |
| POST   | `/analyze`                  | Run portfolio analysis (JSON body)    |
| POST   | `/conversation/start`       | Start a new conversational session    |
| POST   | `/conversation/message`     | Send a message in an active session   |
| GET    | `/conversation/:sessionId`  | Retrieve conversation history         |

### Example: Direct API Analysis

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "Analyze my portfolio for a 10 year retirement goal"}'
```

## Constraints Enforced

| Constraint                  | Low Risk | Medium Risk | High Risk |
| --------------------------- | -------- | ----------- | --------- |
| Max equity                  | 50%      | 70%         | 90%       |
| Max single asset class      | 80%      | 80%         | 80%       |
| Min cash (low liquidity)    | 3%       | 3%          | 3%        |
| Min cash (medium liquidity) | 5%       | 5%          | 5%        |
| Min cash (high liquidity)   | 10%      | 10%         | 10%       |

## Tech Stack

- **Runtime**: Node.js ≥ 20, TypeScript, ESM
- **API**: Fastify
- **AI**: OpenAI structured JSON responses (with deterministic fallback)
- **Frontend**: Single-page HTML/CSS/JS served by Fastify
- **Caching**: In-memory TTL cache (portfolio 5 min, AI responses configurable)

## Disclaimer

> This is a demonstration system. It is not financial advice. Please consult a qualified financial advisor before making investment decisions.
