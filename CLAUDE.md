# SUITRUMP Royale - Claude Code Project Guidelines

## Project Overview

SUITRUMP Royale is a provably fair gaming platform on Sui blockchain.
- **Theme**: SUITRUMP aesthetic (teal/lime color scheme)
- **Token**: SUIT (SUITRUMP token on Sui)
- **Games**: 8 games (Dice, Progressive, Raffle, Slots, Crash, Plinko, Keno, Roulette)
- **Blockchain**: Sui (Move contracts)

## Development Workflow - MANDATORY

### All changes follow this workflow:

1. **Make changes locally** - Edit files on the local machine only
2. **Build locally** - Run `npm run build` to verify no errors
3. **Test locally** - User runs `npm run dev` to test changes
4. **Get approval** - Ask user: "Ready to deploy to Vercel?"
5. **Deploy only after approval** - Only run `npx vercel --prod` when user confirms

### NEVER auto-deploy
- Do NOT automatically deploy after making changes
- Do NOT chain build && deploy commands together
- ALWAYS stop after building and wait for user approval

## Project Structure

```
D:\Apps\sui-casino\
├── move/                    # Sui Move smart contracts
│   ├── Move.toml
│   └── sources/
│       └── suitrump_*.move  # Game contracts
├── frontend/                # React + Vite frontend
│   ├── src/
│   │   ├── pages/          # Game pages
│   │   ├── components/     # Shared components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   ├── styles/         # CSS files
│   │   └── config/         # Configuration
│   └── package.json
└── CLAUDE.md               # This file
```

## Theme Colors

```css
--primary-green: #3c574b;   /* Deep teal/forest green */
--dark-green: #0f2c23;      /* Dark navy green */
--accent-lime: #e2fea5;     /* Bright lime/chartreuse */
--secondary-cream: #f8ffe8; /* Cream/off-white */
--bg-dark: #0f2c23;         /* Background */
--bg-card: #2d4a3f;         /* Card background */
```

## Fonts
- Headlines: "Dela Gothic One"
- Body: "Bricolage Grotesque"
- Functional: "Inter"

## Commands

### Frontend
```bash
cd frontend
npm run dev      # Start dev server (port 3000)
npm run build    # Build for production
npm run preview  # Preview production build
```

### Move Contracts (Sui)
```bash
cd move
sui move build   # Compile contracts
sui move test    # Run tests
sui client publish --gas-budget 100000000  # Deploy
```

## Integration Status

### Completed
- [x] Project setup and structure
- [x] SUITRUMP theme applied (colors, fonts)
- [x] Branding updated (BLUE → SUIT)
- [x] Frontend builds successfully
- [x] Demo mode works

### In Progress
- [ ] Sui wallet integration (@mysten/dapp-kit)
- [ ] Move contract development
- [ ] Frontend-contract integration

### Pending
- [ ] Deploy contracts to Sui Testnet
- [ ] Full end-to-end testing
- [ ] Deploy frontend to Vercel

## Important Notes

1. **Demo Mode**: Works without wallet - use `?demo=true` URL param
2. **Wallet**: Sui wallet integration pending, placeholder hooks in place
3. **Contracts**: Move contracts need to be written for each game
4. **ethers.js**: Removed - using Sui SDK instead (pending full integration)

## Lessons Learned

### From Blue Casino Project
- Always get user approval before deploying
- Never overwrite existing deployments without confirmation
- Test locally first, then deploy
