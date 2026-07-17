# strategyless

> Build the company. Control the market. Survive the system.

A turn-based corporate strategy game set in the contemporary technology market. Compete as a CEO building a tech empire across SaaS, AI, cybersecurity, consulting, and managed services.

## Features

- **Isometric Market Map** - Conquer market segments represented as interactive tiles
- **Deep Company Simulation** - Cash flow, valuation, market influence, brand trust, security posture
- **Executive Orders System** - Limited actions per turn force strategic prioritization
- **Four AI Archetypes** - Hypergrowth Platform, Security Fortress, Acquisition Machine, Lean Specialist
- **Dynamic Events** - Cyber incidents, regulatory shifts, market disruptions, M&A opportunities
- **Multiple Victory Paths** - Market dominance, tech leadership, brand trust, consolidation, resilience
- **Procedural Generation** - Unique market maps and companies every game

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Lint code
npm run lint
```

## Stack

- **Vite** - Build tool and dev server
- **React 18** - UI framework
- **TypeScript** - Type-safe development
- **Phaser 3** - Isometric map rendering
- **Zustand** - State management
- **Vitest** - Unit testing

## Game Concepts

### Resources
- **Cash** - Liquid capital for actions
- **Cash Flow** - Net income per turn
- **Valuation** - Company worth
- **Market Influence** - Territorial control %
- **Brand Trust** - Reputation (0-100)
- **Security Posture** - Cyber resilience (0-100)
- **Innovation** - R&D capability (0-100)
- **AI Capability** - ML/AI maturity (0-100)
- **Consulting Capacity** - Services delivery (0-100)

### Actions (Executive Orders)
| Action | Cost | Department |
|--------|------|------------|
| Build Department | $500K+ | Corporate Strategy |
| Launch Product | $300K+ | Product & R&D |
| Improve Product | $100K+ | Product & R&D |
| Expand Market | $200K+ | Sales & Marketing |
| Marketing Campaign | $150K+ | Sales & Marketing |
| Hire Executive | $400K+ | People & Culture |
| Security Hardening | $200K+ | Cybersecurity |
| AI Automation | $250K+ | AI & Data |
| Launch Consulting | $150K+ | Consulting Services |
| Scout Acquisition | $50K+ | Acquisitions |
| Acquire Company | $2M+ | Acquisitions |
| Raise Capital | - | Finance & IR |
| Reduce Costs | - | Finance & IR |

### AI Competitors
- **Hypergrowth Platform** - Aggressive expansion, high burn, platform strategy
- **Security Fortress** - Slow steady growth, high trust, regulated markets
- **Acquisition Machine** - Roll-up strategy, integration risk
- **Lean Specialist** - Niche dominance, high margins, vulnerable to scale

## Project Structure

```
src/
├── app/                 # React app components
│   ├── components/      # UI components (layout, map, panels, modals)
├── simulation/          # Headless game simulation
│   ├── factories/       # Entity creation
│   ├── turn/            # Turn engine
│   └── utils/           # RNG, ID generation
├── store/               # Zustand state management
├── types/               # TypeScript definitions
├── utils/               # Formatters, helpers
└── styles/              # CSS tokens and globals
```

## Development

### Adding a New Action Type

1. Add to `ActionType` in `src/types/index.ts`
2. Add cost/base in `turnEngine.ts`
3. Implement `applyActionEffectsToCompany` in `turnEngine.ts`
4. Add button in `ActionModal` component
5. Add tests in `tests/`

### Running Tests

```bash
npm run test           # Run once
npm run test:ui        # Interactive UI
```

### Linting

```bash
npm run lint           # Check
npm run lint:fix       # Auto-fix
```

## License

MIT - Feel free to use for learning or as a base for your own strategy game.
